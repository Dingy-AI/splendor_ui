"""Translate the Python game's authoritative state into the existing React board shape."""
import json
from pathlib import Path

from splendor_v1.env.core.enums import ActionType, GemColor, NodeType

COLORS = ('white', 'blue', 'green', 'red', 'black')
CATALOG = json.loads((Path(__file__).parent / 'catalog.json').read_text(encoding='utf-8'))
CARDS = {str(item['id']): item for item in CATALOG['cards']}
NOBLES = {str(item['id']): item for item in CATALOG['nobles']}
MOTIFS = ('flower', 'bridge', 'lantern', 'shop', 'star', 'leaf')
TONES = ('peach', 'mint', 'blue', 'lilac', 'butter')


def card_view(card):
    if card is None:
        return None
    if str(card.id) not in CARDS:
        raise ValueError(f'Unknown card ID: {card.id}')
    return {
        'id': str(card.id), 'tier': card.tier, 'points': card.points,
        'bonus': card.bonus_color.name.lower(),
        'cost': {color.name.lower(): count for color, count in card.cost.items() if count},
        'name': f"Gem card {card.id}", 'motif': MOTIFS[card.id % len(MOTIFS)],
    }


def noble_view(noble):
    if noble is None:
        return None
    item = NOBLES[str(noble.id)]
    return {
        'id': str(noble.id), 'name': item['name'], 'animal_name': item['animal_name'],
        'portrait': item['portrait'], 'colors': item['colors'], 'points': noble.points,
        'cost': {color.name.lower(): count for color, count in noble.requirement.items() if count},
        'tone': TONES[noble.id % len(TONES)],
    }


def player_view(player, index):
    purchased = {color: [] for color in COLORS}
    for card in player.purchased_cards:
        purchased[card.bonus_color.name.lower()].append(card_view(card))
    reserves = []
    for card, hidden in zip(player.reserved_cards, player.reserved_card_hidden):
        # The opponent's face-down card remains secret in the browser response.
        reserves.append({'id': 'hidden', 'tier': card.tier, 'points': 0,
                         'bonus': 'white', 'cost': {}, 'name': 'Face-down card',
                         'motif': 'leaf'} if index == 1 and hidden else card_view(card))
    return {
        'id': f'p{index + 1}', 'name': 'You' if index == 0 else 'Drew',
        'tone': 'rose' if index == 0 else 'sky', 'points': player.points,
        'gems': {color.name.lower(): player.gems[color] for color in GemColor},
        'reserves': (reserves + [None] * 3)[:3],
        'reserveHidden': (list(player.reserved_card_hidden) + [False] * 3)[:3],
        'purchased': purchased, 'nobles': [noble_view(noble) for noble in player.nobles],
    }


def action_view(env, action):
    kind = action.action_type
    output = {'actionId': env.action_to_id(action)}
    if kind == ActionType.TAKE_GEMS:
        output.update(type='take', colors=[color.name.lower() for color in action.gem_colors])
    elif kind == ActionType.DISCARD_GEMS:
        output.update(type='discard', color=action.gem_colors[0].name.lower())
    elif kind == ActionType.RESERVE_VISIBLE:
        output.update(type='reserve', tier=action.tier, slot=action.slot)
    elif kind == ActionType.RESERVE_TOP_DECK:
        output.update(type='reserveDeck', tier=action.tier)
    elif kind == ActionType.BUY_VISIBLE:
        output.update(type='buy', tier=action.tier, slot=action.slot,
                      goldPayment={color: action.gold_payment[i] for i, color in enumerate(COLORS)})
    elif kind == ActionType.BUY_RESERVED:
        output.update(type='buyReserve', slot=action.reserved_index,
                      goldPayment={color: action.gold_payment[i] for i, color in enumerate(COLORS)})
    elif kind == ActionType.TAKE_NOBLE:
        output.update(type='noble', slot=action.noble_index)
    else:
        raise ValueError(f'Unsupported action type: {kind}')
    return output


def describe_action(state, action, actor):
    label = 'You' if actor == 0 else 'Drew'
    kind = action.action_type
    if kind == ActionType.TAKE_GEMS:
        detail = 'took ' + ', '.join(color.name.lower() for color in action.gem_colors)
    elif kind == ActionType.DISCARD_GEMS:
        detail = 'returned a ' + action.gem_colors[0].name.lower() + ' gem'
    elif kind == ActionType.RESERVE_VISIBLE:
        detail = f'reserved tier {action.tier} card {state.visible_cards[action.tier][action.slot].id}'
    elif kind == ActionType.RESERVE_TOP_DECK:
        detail = f'reserved a face-down tier {action.tier} card'
    elif kind == ActionType.BUY_VISIBLE:
        detail = f'bought tier {action.tier} card {state.visible_cards[action.tier][action.slot].id}'
    elif kind == ActionType.BUY_RESERVED:
        detail = f'bought reserved card {state.players[actor].reserved_cards[action.reserved_index].id}'
    elif kind == ActionType.TAKE_NOBLE:
        detail = f'welcomed {noble_view(state.nobles[action.noble_index])["animal_name"]}'
    else:
        detail = kind.name.lower()
    return f'{label} {detail}'


def snapshot(env, seed, log):
    state = env.state
    phase = ('over' if state.game_over else
             {NodeType.MAIN_DECISION: 'main', NodeType.OVERFLOW_DISCARD: 'discard',
              NodeType.NOBLE_CLAIM: 'noble'}[state.node_type])
    board = {
        'seed': seed,
        'bank': {color.name.lower(): state.bank[color] for color in GemColor},
        'nobles': [noble_view(noble) for noble in state.nobles],
        'market': {str(tier): [card_view(card) for card in state.visible_cards[tier]]
                   for tier in (1, 2, 3)},
        # The board only reads each deck's length. Never send hidden deck order.
        'decks': {str(tier): [None] * len(state.decks[tier]) for tier in (1, 2, 3)},
        'players': [player_view(player, i) for i, player in enumerate(state.players)],
        'currentPlayer': state.current_player, 'phase': phase,
        'turn': state.turn_number, 'endTriggered': state.end_triggered,
        'winners': list(state.winners), 'log': log[-16:][::-1],
    }
    legal = [] if state.game_over or state.current_player != 0 else [
        action_view(env, action) for action in env._legal_actions(state)
    ]
    return {'game': board, 'legalActions': legal}
