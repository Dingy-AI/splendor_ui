"""Local human-vs-Model-4 game API. Run from this directory with Python."""
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import uuid

import torch

from game_view import describe_action, snapshot
from splendor_v1.env.core.action_constants import ACTION_SPACE_SIZE
from splendor_v1.env.core.constants import OBSERVATION_SIZE
from splendor_v1.env.env import SplendorEnv
from splendor_v1.env.core.enums import NodeType
from splendor_v1.mcts.mcts_v5_direct import MCTS
from splendor_v1.network.model_4_legal_scorer import SplendorNetwork


class HostedSplendorEnv(SplendorEnv):
    """Use the chosen first player when deciding when the final round ends."""

    def __init__(self, first_player):
        super().__init__(num_players=2)
        self.first_player = first_player

    def _check_terminated(self, state):
        if not state.end_triggered or state.node_type != NodeType.MAIN_DECISION:
            return False
        if state.current_player != self.first_player:
            return False
        state.winners = self._compute_winners(state)
        state.game_over = True
        return True


class GameService:
    def __init__(self, checkpoint_path, simulations, device):
        checkpoint = torch.load(checkpoint_path, map_location='cpu', weights_only=False)
        self.model = SplendorNetwork(OBSERVATION_SIZE, ACTION_SPACE_SIZE)
        self.model.load_state_dict(checkpoint['model_state_dict'], strict=True)
        self.model.to(device).eval()
        self.simulations = simulations
        self.sessions = {}
        self.lock = threading.RLock()

    def new_game(self, seed, first_player='you'):
        if not isinstance(seed, str) or len(seed) > 128:
            raise ValueError('Seed must be a string of at most 128 characters')
        if first_player not in ('you', 'drew'):
            raise ValueError('First player must be "you" or "drew"')
        env = HostedSplendorEnv(first_player=0 if first_player == 'you' else 1)
        numeric_seed = int.from_bytes(hashlib.sha256(seed.encode('utf-8')).digest()[:4], 'big')
        env.reset(seed=numeric_seed)
        env.state.current_player = env.first_player
        session_id = uuid.uuid4().hex
        with self.lock:
            self.sessions[session_id] = {'env': env, 'seed': seed, 'log': []}
        return {'session': session_id, **snapshot(env, seed, [])}

    def player_move(self, session_id, action_ids):
        if not isinstance(action_ids, list) or not 1 <= len(action_ids) <= 5:
            raise ValueError('Expected one to five action IDs')
        with self.lock:
            session = self.sessions[session_id]
            env = session['env']
            # Commit only after the complete group of forced discards is valid.
            next_state = env.state.clone()
            labels = []
            for action_id in action_ids:
                if not isinstance(action_id, int) or isinstance(action_id, bool):
                    raise ValueError('Invalid action ID')
                if next_state.game_over or next_state.current_player != 0:
                    raise ValueError('It is not the player’s turn')
                legal = {env.action_to_id(action): action for action in env._legal_actions(next_state)}
                if action_id not in legal:
                    raise ValueError(f'Illegal action ID: {action_id}')
                action = legal[action_id]
                labels.append(describe_action(next_state, action, 0))
                env.step(action, state=next_state)
            env.state = next_state
            session['log'].extend(labels)
            return {'session': session_id, **snapshot(env, session['seed'], session['log'])}

    def ai_move(self, session_id):
        with self.lock:
            session = self.sessions[session_id]
            env = session['env']
            state = env.state
            if state.game_over or state.current_player != 1:
                raise ValueError('It is not Drew’s turn')
            search = MCTS(
                simulations=self.simulations, rollout_type='neural',
                selection_type='puct', model=self.model, c_puct=3.0,
                adaptive_simulations=True,
            )
            with torch.inference_mode():
                action = search.search(env, state, add_root_noise=False)
            if action is None or action not in env._legal_actions(state):
                raise RuntimeError('Drew did not choose a legal action')
            label = describe_action(state, action, 1)
            env.step(action)
            session['log'].append(label)
            return {'session': session_id, **snapshot(env, session['seed'], session['log'])}

    def evaluate(self, session_id):
        with self.lock:
            state = self.sessions[session_id]['env'].state
            if state.game_over:
                you_win = 0 in state.winners
                drew_win = 1 in state.winners
                win, draw, loss = ((1.0, 0.0, 0.0) if you_win and not drew_win else
                                   (0.0, 0.0, 1.0) if drew_win and not you_win else
                                   (0.0, 1.0, 0.0))
            else:
                env = self.sessions[session_id]['env']
                observation = env.observation_encoder.encoder(state)
                weight = self.model.action_embedding.weight
                tensor = torch.as_tensor(observation, dtype=weight.dtype,
                                         device=weight.device).unsqueeze(0)
                with torch.inference_mode():
                    # Model 4 predicts LOSS, DRAW, WIN for the side to move.
                    probabilities = torch.softmax(self.model.forward_wdl(tensor), dim=-1)[0].tolist()
                loss, draw, win = probabilities if state.current_player == 0 else (
                    probabilities[2], probabilities[1], probabilities[0]
                )
            return {'expectedScore': win + draw / 2,
                    'win': win, 'draw': draw, 'loss': loss,
                    'final': state.game_over}


def make_handler(service, origin):
    class Handler(BaseHTTPRequestHandler):
        def _headers(self, code=200):
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()

        def do_OPTIONS(self):
            self._headers(204)

        def do_POST(self):
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if size > 8192:
                    raise ValueError('Request too large')
                data = json.loads(self.rfile.read(size))
                if self.path == '/api/game':
                    result = service.new_game(data.get('seed', ''), data.get('firstPlayer', 'you'))
                elif self.path == '/api/move':
                    result = service.player_move(data['session'], data['actionIds'])
                elif self.path == '/api/ai':
                    result = service.ai_move(data['session'])
                elif self.path == '/api/eval':
                    result = service.evaluate(data['session'])
                else:
                    self._headers(404)
                    self.wfile.write(b'{"error":"Unknown endpoint"}')
                    return
                self._headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except (ValueError, KeyError) as exc:
                self._headers(400)
                self.wfile.write(json.dumps({'error': str(exc)}).encode('utf-8'))
            except Exception as exc:
                self._headers(500)
                self.wfile.write(json.dumps({'error': f'{type(exc).__name__}: {exc}'}).encode('utf-8'))

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--simulations', type=int, default=200)
    parser.add_argument('--device', default='cpu', choices=('cpu', 'cuda'))
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--origin', default='http://127.0.0.1:5173')
    args = parser.parse_args()
    service = GameService(args.checkpoint, args.simulations, args.device)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(service, args.origin))
    print(f'Blake Model 4 ready on http://127.0.0.1:{args.port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
