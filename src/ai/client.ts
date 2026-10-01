import type { Action, Game } from '../game/game'

export type RemoteAction = Action & { actionId: number }
export type GameSnapshot = { session: string; game: Game; legalActions: RemoteAction[] }
export type ModelEvaluation = { expectedScore: number; win: number; draw: number; loss: number; final: boolean }

const API = import.meta.env.VITE_BLAKE_API_URL ?? 'http://127.0.0.1:8765'

async function post(path: string, body: unknown): Promise<GameSnapshot> {
  const response = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json() as GameSnapshot & { error?: string }
  if (!response.ok) throw new Error(result.error ?? `AI server returned ${response.status}`)
  return result
}

export type FirstPlayer = 'you' | 'drew'
export const newGame = (seed: string, firstPlayer: FirstPlayer) => post('/api/game', { seed, firstPlayer })
export const playMoves = (session: string, actionIds: number[]) => post('/api/move', { session, actionIds })
export const playAiMove = (session: string) => post('/api/ai', { session })
export async function evaluateGame(session: string, signal?: AbortSignal): Promise<ModelEvaluation> {
  const response = await fetch(`${API}/api/eval`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }), signal,
  })
  const result = await response.json() as ModelEvaluation & { error?: string }
  if (!response.ok) throw new Error(result.error ?? `AI server returned ${response.status}`)
  return result
}
