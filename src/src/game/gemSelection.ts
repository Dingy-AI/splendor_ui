import { COLORS, type Action, type Color } from './game'

type TakeAction = Extract<Action, { type: 'take' }>

function counts(colors: Color[]): number[] {
  return COLORS.map(color => colors.filter(candidate => candidate === color).length)
}

export function matchingTake(actions: TakeAction[], selected: Color[]): TakeAction | undefined {
  if (!selected.length) return undefined
  const requested = counts(selected)
  return actions.find(action => counts(action.colors).every((count, index) => count === requested[index]))
}

function canFinish(actions: TakeAction[], selected: Color[]): boolean {
  const requested = counts(selected)
  return actions.some(action => counts(action.colors).every((count, index) => count >= requested[index]))
}

export function selectBankGem(selected: Color[], color: Color, actions: TakeAction[]): Color[] {
  const occurrences = selected.filter(candidate => candidate === color).length

  // A second click on a single color means taking two of that color when legal.
  if (selected.length === 1 && occurrences === 1 && canFinish(actions, [color, color])) {
    return [color, color]
  }

  // Click a selected color again to remove it; Clear removes the whole selection.
  if (occurrences) {
    const next = [...selected]
    next.splice(next.indexOf(color), 1)
    return next
  }

  const next = [...selected, color]
  return next.length <= 3 && canFinish(actions, next) ? next : selected
}
