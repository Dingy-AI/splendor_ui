import { useState } from 'react'
import { COLORS, effectiveCost, type Card, type Color, type GoldPayment, type Player } from '../game/game'

type Allocation = Record<Color, { colored: number; gold: number }>
const emptyAllocation = (): Allocation => Object.fromEntries(COLORS.map(color => [color, { colored: 0, gold: 0 }])) as Allocation

function GemIcon({ color }: { color: Color | 'gold' }) {
  return <span className={`gem gem-small gem-${color}`} aria-hidden="true"><span className="gem-face" /></span>
}

export default function PaymentEditor({ card, player, onConfirm, onCancel }: { card: Card; player: Player; onConfirm: (gold: GoldPayment) => void; onCancel: () => void }) {
  const [allocation, setAllocation] = useState<Allocation>(emptyAllocation)
  const due = effectiveCost(player, card)
  const goldUsed = COLORS.reduce((total, color) => total + allocation[color].gold, 0)
  const totalDue = COLORS.reduce((total, color) => total + due[color], 0)
  const totalAssigned = COLORS.reduce((total, color) => total + allocation[color].colored + allocation[color].gold, 0)
  const complete = totalAssigned === totalDue

  function change(color: Color, kind: 'colored' | 'gold', direction: 1 | -1) {
    const row = allocation[color]
    const assigned = row.colored + row.gold
    if (direction === 1 && (assigned >= due[color] || (kind === 'gold' ? goldUsed >= player.gems.gold : row.colored >= player.gems[color]))) return
    if (direction === -1 && row[kind] === 0) return
    setAllocation(current => ({ ...current, [color]: { ...current[color], [kind]: current[color][kind] + direction } }))
  }

  return <section className="payment-panel" aria-label={`Choose payment for ${card.name}`}>
    <div className="payment-heading"><div><h2>Pay for {card.name}</h2><p>Choose how to cover each color after permanent bonuses. Gold may replace any color. Gems are spent only when you confirm.</p></div><button type="button" className="payment-cancel" onClick={onCancel}>Cancel</button></div>
    <div className="payment-rows">{COLORS.filter(color => (card.cost[color] || 0) > 0).map(color => {
      const row = allocation[color]
      const remaining = due[color] - row.colored - row.gold
      const bonuses = player.purchased[color].length
      const costBreakdown = <div className="payment-cost-breakdown">
        <strong>{card.cost[color]} {color} cost</strong>
        <small>{bonuses} {bonuses === 1 ? 'bonus' : 'bonuses'} → {due[color]} {due[color] === 1 ? 'gem' : 'gems'} to pay</small>
      </div>
      if (due[color] === 0) return <div className="payment-row payment-row-covered" key={color}>
        <div className="payment-requirement"><GemIcon color={color} />{costBreakdown}</div>
        <div className="payment-covered">No payment required</div>
      </div>
      return <div className="payment-row" key={color}>
        <div className="payment-requirement"><GemIcon color={color} />{costBreakdown}<span className="payment-remaining">{remaining ? `${remaining} left` : 'Covered'}</span></div>
        <div className="payment-choices"><button type="button" onClick={() => change(color, 'colored', 1)} disabled={!remaining || row.colored >= player.gems[color]} aria-label={`Use one ${color} gem for ${color} cost`}><GemIcon color={color} /> Use {color} <span>{row.colored}/{player.gems[color]}</span></button>
          <button type="button" onClick={() => change(color, 'gold', 1)} disabled={!remaining || goldUsed >= player.gems.gold} aria-label={`Use one gold gem for ${color} cost`}><GemIcon color="gold" /> Use gold <span>{row.gold}</span></button></div>
        {(row.colored > 0 || row.gold > 0) && <div className="payment-assigned" aria-label={`Assigned ${row.colored} ${color} and ${row.gold} gold`}>
          {row.colored > 0 && <button type="button" onClick={() => change(color, 'colored', -1)} aria-label={`Remove one ${color} gem from payment`}><GemIcon color={color} /> ×{row.colored} <span aria-hidden="true">−</span></button>}
          {row.gold > 0 && <button type="button" onClick={() => change(color, 'gold', -1)} aria-label={`Remove one gold gem from ${color} payment`}><GemIcon color="gold" /> ×{row.gold} <span aria-hidden="true">−</span></button>}
        </div>}
      </div>
    })}</div>
    <div className="payment-footer"><span>{totalDue ? `${totalAssigned} / ${totalDue} cost covered · ${goldUsed} / ${player.gems.gold} gold used` : 'Free with your permanent bonuses'}</span><div><button type="button" className="payment-clear" onClick={() => setAllocation(emptyAllocation())} disabled={!totalAssigned}>Clear</button><button type="button" className="payment-confirm" disabled={!complete} onClick={() => onConfirm(Object.fromEntries(COLORS.map(color => [color, allocation[color].gold])) as GoldPayment)}>Confirm purchase</button></div></div>
  </section>
}
