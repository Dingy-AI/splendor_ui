import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { COLORS, type Card, type Color, type Cost, type GemColor, type Motif, type Noble, type Player, type Game, type Tier } from '../game/game'

type CardArt = Record<string, { name: string; image: string }>
type ProfileSide = 'player' | 'ai'
type ProfileOption = { id: string; name: string; image: string }

const PROFILE_OPTIONS: Record<ProfileSide, ProfileOption[]> = {
  player: [
    { id: 'traveler', name: 'Rowan', image: '/design/player-concepts/player.png' },
    { id: 'traveler-female', name: 'Mira', image: '/design/player-concepts/player-female.png' },
    { id: 'traveler-black-woman', name: 'Amara', image: '/design/player-concepts/player-black-woman.png' },
    { id: 'traveler-african-man', name: 'Kofi', image: '/design/player-concepts/player-african-man.png' },
    { id: 'traveler-south-asian-man', name: 'Nikhil', image: '/design/player-concepts/player-south-asian-man.png' },
    { id: 'traveler-east-asian-woman', name: 'Hana', image: '/design/player-concepts/player-east-asian-woman.png' },
    { id: 'traveler-middle-eastern-woman', name: 'Layla', image: '/design/player-concepts/player-middle-eastern-woman.png' },
    { id: 'traveler-blonde-man', name: 'Theo', image: '/design/player-concepts/player-blonde-man.png' },
    { id: 'traveler-blonde-woman', name: 'Elise', image: '/design/player-concepts/player-blonde-woman.png' },
  ],
  ai: [
    { id: 'drew-blue', name: 'Blue Owl', image: '/design/ai-concepts/drew-ai.png' },
    { id: 'drew-flower', name: 'Flower Owl', image: '/design/ai-concepts/drew-ai-female.png' },
    { id: 'drew-russet', name: 'Russet Owl', image: '/design/ai-concepts/drew-ai-female-russet.png' },
  ],
}

function savedProfile(side: ProfileSide): string {
  const fallback = PROFILE_OPTIONS[side][0].id
  try {
    const value = window.localStorage.getItem(`splendor-${side}-profile`)
    return PROFILE_OPTIONS[side].some(option => option.id === value) ? value! : fallback
  } catch {
    return fallback
  }
}

const GEM_NAMES: Record<GemColor, string> = {
  red: 'Ruby', blue: 'Sapphire', green: 'Emerald', white: 'Diamond', black: 'Onyx', gold: 'Gold',
}

function Gem({ color, small = false }: { color: GemColor; small?: boolean }) {
  return <span className={`gem gem-${color}${small ? ' gem-small' : ''}`} role="img" aria-label={GEM_NAMES[color]}>
    <span className="gem-face" aria-hidden="true" />
  </span>
}

function GemArt({ color }: { color: GemColor }) {
  return <img className="gem-art" src={`/design/gem-concepts/${color}.png`} alt="" aria-hidden="true" draggable={false} />
}

function CostList({ cost, forNoble = false }: { cost: Cost; forNoble?: boolean }) {
  return <div className="cost-list" aria-label={forNoble ? 'Great Spirit requirements' : 'Gem cost'}>
    {COLORS.filter((color) => cost[color]).map((color) =>
      <span className="cost-item" key={color} aria-label={`${cost[color]} ${color} ${forNoble ? 'bonuses' : 'gems'}`}>
        {forNoble ? <Gem color={color} small /> : <GemArt color={color} />}<strong aria-hidden="true">{cost[color]}</strong>
      </span>,
    )}
  </div>
}

function CardMotif({ motif }: { motif: Motif }) {
  const paths: Record<Motif, React.ReactNode> = {
    flower: <><path d="M40 72V43" /><path d="M40 58Q24 48 21 60Q27 70 40 64M40 55Q56 43 62 57Q55 67 40 63" /><circle cx="40" cy="34" r="8" /><circle cx="40" cy="18" r="9" /><circle cx="55" cy="28" r="9" /><circle cx="49" cy="46" r="9" /><circle cx="30" cy="46" r="9" /><circle cx="25" cy="28" r="9" /><circle cx="40" cy="34" r="6" className="motif-center" /></>,
    bridge: <><path d="M10 61Q40 16 70 61V68H10Z" /><path d="M21 61Q40 34 59 61" className="motif-cutout" /><path d="M6 72H74M16 55V69M64 55V69" /></>,
    lantern: <><path d="M40 9V19M30 20H50M27 27Q40 16 53 27L50 63Q40 71 30 63Z" /><path d="M30 36H50M30 54H50M40 66V76" /><circle cx="40" cy="45" r="6" className="motif-center" /></>,
    shop: <><path d="M17 35L24 17H56L63 35V70H17Z" /><path d="M15 35H65L61 45Q55 50 50 45Q45 50 40 45Q35 50 30 45Q25 50 19 45Z" /><path d="M31 70V52H49V70M28 23H52" /></>,
    star: <><path d="M40 11L47 30L67 31L52 43L57 63L40 52L23 63L28 43L13 31L33 30Z" /><circle cx="16" cy="16" r="2" /><circle cx="64" cy="16" r="2" /><circle cx="68" cy="69" r="2" /></>,
    leaf: <><path d="M19 59Q16 19 64 15Q69 61 35 65Q25 65 19 59Z" /><path d="M15 73Q34 43 57 27M26 53L28 34M37 41L53 43" /></>,
  }
  return <svg className="motif-svg" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[motif]}</svg>
}

interface MarketActions { buy?: () => void; reserve?: () => void; close: () => void }
interface ReservedActions { buy?: () => void; close: () => void }
interface DeckActions { reserve: () => void; close: () => void }

function MarketCard({ card, art, onClick, selected, reservable, actions }: { card: Card; art?: CardArt[string]; onClick?: () => void; selected?: boolean; reservable?: boolean; actions?: MarketActions }) {
  const name = art?.name ?? card.name
  return <div className="market-card-shell">
    <button type="button" onClick={onClick} aria-pressed={selected} className={`market-card scene-${card.motif}${card.tier === 1 && art ? ' tier-1-art-card' : ''}${selected ? ' selected-card' : ''}${reservable ? ' reservable-card' : ''}`} aria-label={`${name}, tier ${card.tier}, ${card.points} points, ${card.bonus} bonus${reservable ? ', click to reserve' : ''}`}>
      <div className="card-top"><span className="point-badge" aria-label={`${card.points} points`}>{card.points}</span><span className="bonus-badge" aria-label={`${card.bonus} bonus`}><Gem color={card.bonus} small /></span></div>
      <div className="card-art">{art ? <>{card.tier === 1 && <img className="tier-1-art-fill" src={art.image} alt="" aria-hidden="true" loading="lazy" />}<img className="card-art-image" src={art.image} alt="" loading="lazy" /></> : <><span className="art-hill hill-back" /><span className="art-hill hill-front" /><CardMotif motif={card.motif} /></>}</div>
      <div className="card-name" title={name}>{name}</div>
      <CostList cost={card.cost} />
    </button>
    {selected && actions && <div className="card-actions-overlay" role="group" aria-label={`Actions for ${name}`}>
      <button type="button" className="card-overlay-close" onClick={actions.close} aria-label="Close card actions">✕</button>
      {actions.buy && <button type="button" onClick={actions.buy}>Buy</button>}
      {actions.reserve && <button type="button" onClick={actions.reserve}>Reserve</button>}
      {!actions.buy && !actions.reserve && <span>No action available</span>}
    </div>}
  </div>
}

function NobleTile({ noble, onClick }: { noble: Noble; onClick?: () => void }) {
  const requirements = noble.colors.map(color => `${noble.cost[color]} ${color}`).join(', ')
  return <button type="button" onClick={onClick} disabled={!onClick} className={`noble-tile noble-${noble.tone}`} aria-label={`Great Spirit ${noble.animal_name}, ${noble.points} points, requires ${requirements} bonuses`}>
    <span className="noble-points">{noble.points} <span aria-hidden="true">✦</span></span>
    <div className="noble-portrait"><img src={noble.portrait} alt="" loading="lazy" /></div>
    <span className="noble-name">{noble.animal_name}</span>
    <CostList cost={noble.cost} forNoble />
  </button>
}

function GemBank({ bank, held, selected, selectedDiscards, onGem, onGold, onDiscardGem, onConfirmDiscards, onClearDiscards, reserveMode, reserveFull, onConfirm, onClear, canConfirm }: { bank: Game['bank']; held: Player['gems']; selected: Color[]; selectedDiscards: GemColor[]; onGem?: (color: Color) => void; onGold?: () => void; onDiscardGem?: (color: GemColor) => void; onConfirmDiscards?: () => void; onClearDiscards?: () => void; reserveMode: boolean; reserveFull: boolean; onConfirm?: () => void; onClear?: () => void; canConfirm: boolean }) {
  const colors: GemColor[] = [...COLORS, 'gold']
  const discardCount = Object.values(held).reduce((sum, count) => sum + count, 0) - 10
  return <section className="bank-panel" aria-labelledby="bank-title">
    <h2 id="bank-title">Gem bank <span aria-hidden="true">✿</span></h2>
    <div className="bank-grid">{colors.map(color => color === 'gold'
      ? <button type="button" className={`bank-gem bank-gem-button bank-gold${reserveMode ? ' bank-gem-selected' : ''}${onDiscardGem && held.gold > 0 ? ' bank-gem-discard' : ''}${selectedDiscards.includes('gold') ? ' bank-gem-discard-selected' : ''}`} key={color}
          onClick={onDiscardGem ? () => onDiscardGem('gold') : onGold} disabled={onDiscardGem ? held.gold === 0 : !onGold} aria-pressed={onDiscardGem ? selectedDiscards.includes('gold') : reserveMode}
          aria-label={onDiscardGem ? `Select gold to return; you hold ${held.gold}, ${selectedDiscards.filter(c => c === 'gold').length} selected` : `Reserve a card; ${bank.gold} gold available; ${reserveFull ? 'reserve pile full' : bank.gold ? 'gain one gold when reserving' : 'reserve without gaining gold'}`}>
          <GemArt color={color} /><span className="bank-count" aria-hidden="true">{bank[color]}</span>
          <span className="gem-label">{onDiscardGem ? `${held.gold} held` : reserveFull ? 'Reserve full' : 'Reserve mode'}</span>
          {onDiscardGem && selectedDiscards.includes('gold') && <span className="gem-selection-count" aria-hidden="true">×{selectedDiscards.filter(c => c === 'gold').length}</span>}
        </button>
      : <button type="button" className={`bank-gem bank-gem-button${selected.includes(color) ? ' bank-gem-selected' : ''}${onDiscardGem && held[color] > 0 ? ' bank-gem-discard' : ''}${selectedDiscards.includes(color) ? ' bank-gem-discard-selected' : ''}`} key={color}
          onClick={() => onDiscardGem ? onDiscardGem(color) : onGem?.(color)} disabled={onDiscardGem ? held[color] === 0 : !onGem || bank[color] === 0}
          aria-pressed={onDiscardGem ? selectedDiscards.includes(color) : selected.includes(color)} aria-label={onDiscardGem ? `Select ${GEM_NAMES[color]} to return; you hold ${held[color]}, ${selectedDiscards.filter(c => c === color).length} selected` : `${GEM_NAMES[color]}, ${bank[color]} available, ${selected.filter(c => c === color).length} selected`}>
          <GemArt color={color} /><span className="bank-count" aria-hidden="true">{bank[color]}</span>
          <span className="gem-label">{onDiscardGem ? `${held[color]} held` : GEM_NAMES[color]}</span>
          {(onDiscardGem ? selectedDiscards.filter(c => c === color).length : selected.filter(c => c === color).length) > 0 && <span className="gem-selection-count" aria-hidden="true">×{onDiscardGem ? selectedDiscards.filter(c => c === color).length : selected.filter(c => c === color).length}</span>}
        </button>
    )}</div>
    {onDiscardGem && <div className="bank-order" aria-live="polite">
      <p>{selectedDiscards.length} / {discardCount} selected to return. Gems stay in your hand until you confirm.</p>
      <div className="bank-order-buttons"><button type="button" className="confirm-gems" disabled={selectedDiscards.length !== discardCount} onClick={onConfirmDiscards}>Confirm return</button><button type="button" className="clear-gems" disabled={!selectedDiscards.length} onClick={onClearDiscards}>Clear</button></div>
    </div>}
    {onGem && <div className="bank-order" aria-live="polite">
      <p>{reserveMode ? `Choose a glowing card or deck to reserve.${bank.gold ? ' Gain one gold.' : ' No gold remains, but you can still reserve.'} Click gold again to cancel.` : selected.length ? `Selected: ${selected.map(color => GEM_NAMES[color]).join(' + ')}` : 'Choose three different gems, or two of one color when four remain.'}</p>
      <div className="bank-order-buttons"><button type="button" className="confirm-gems" disabled={!canConfirm} onClick={onConfirm}>Confirm gems</button><button type="button" className="clear-gems" disabled={!selected.length} onClick={onClear}>Clear</button></div>
    </div>}
  </section>
}

function ReservedCard({ card, art, hidden, onClick }: { card: Card; art?: CardArt[string]; hidden: boolean; onClick?: () => void }) {
  const costText = COLORS.filter(color => card.cost[color]).map(color => `${card.cost[color]} ${color}`).join(', ') || 'free'
  const name = art?.name ?? card.name
  if (hidden) return <button type="button" className="reserve-button reserve-face-down" disabled aria-label={`Face-down tier ${card.tier} reserved card`}>
    <span className="reserve-back-symbol" aria-hidden="true">✿</span><span>Tier {card.tier}</span><span>Face down</span>
  </button>
  return <button type="button" className={`market-card reserve-button reserve-card-view scene-${card.motif}${card.tier === 1 && art ? ' tier-1-art-card' : ''}`} onClick={onClick} disabled={!onClick}
    aria-label={`${name}, tier ${card.tier}, ${card.points} points, ${card.bonus} bonus, costs ${costText}`}>
    <div className="card-top"><span className="point-badge" aria-label={`${card.points} points`}>{card.points}</span><span className="bonus-badge" aria-label={`${card.bonus} bonus`}><Gem color={card.bonus} small /></span></div>
    <div className="card-art">{art ? <>{card.tier === 1 && <img className="tier-1-art-fill" src={art.image} alt="" aria-hidden="true" loading="lazy" />}<img className="card-art-image" src={art.image} alt="" loading="lazy" /></> : <><span className="art-hill hill-back" /><span className="art-hill hill-front" /><CardMotif motif={card.motif} /></>}</div>
    <div className="card-name" title={name}>{name}</div>
    <CostList cost={card.cost} />
  </button>
}

function PlayerArea({ player, cardArt, portrait, displayName, onChangeProfile, onReserve, selectedReserve, reservedActions }: { player: Player; cardArt: CardArt; portrait: string; displayName?: string; onChangeProfile: (trigger: HTMLButtonElement) => void; onReserve?: (slot: number) => void; selectedReserve?: number | null; reservedActions?: ReservedActions }) {
  const name = displayName ?? player.name
  return <section className={`player-area player-${player.tone}`} aria-label={`${name}'s area`}>
    <div className="player-summary">
      <div className="player-identity"><div className="player-profile"><button type="button" className="player-avatar" onClick={event => onChangeProfile(event.currentTarget)} aria-label={`Change ${player.id === 'p2' ? 'AI' : 'player'} profile`}><img src={portrait} alt="" /><span className="profile-hover-label" aria-hidden="true">Change Profile</span></button><h2>{name}</h2></div><div className="player-score"><span>{player.points} points</span></div></div>
      <div className="player-gems" aria-label="Gem holdings">{([...COLORS, 'gold'] as GemColor[]).map((color) => <div className="player-gem" key={color} aria-label={`${player.gems[color]} ${GEM_NAMES[color]}`}><GemArt color={color} /><span aria-hidden="true">{player.gems[color]}</span></div>)}</div>
      <div className="player-holdings">
        <div className="reserve-area"><h3>Reserved <span>{player.reserves.filter(Boolean).length} / 3</span></h3><div className="reserve-slots">{player.reserves.map((card, index) => <div className={`reserve-slot${selectedReserve === index ? ' reserve-slot-selected' : ''}`} key={index} aria-label={card ? undefined : `Empty reserve slot ${index + 1} of 3`}>{card ? <ReservedCard card={card} art={cardArt[card.id]} hidden={player.id==='p2' && player.reserveHidden[index]} onClick={onReserve ? () => onReserve(index) : undefined} /> : <span aria-hidden="true">✧</span>}{card && selectedReserve === index && reservedActions && <div className="reserve-card-actions" role="group" aria-label={`Actions for reserved ${cardArt[card.id]?.name ?? card.name}`}><button type="button" className="card-overlay-close" onClick={reservedActions.close} aria-label="Close reserved card actions">✕</button>{reservedActions.buy ? <button type="button" onClick={reservedActions.buy}>Buy</button> : <span>Need gems</span>}</div>}</div>)}</div></div>
        <div className="player-nobles-area" aria-label={`${name}'s welcomed Great Spirits`}>
          <h3>Great Spirits <span>{player.nobles.length} / 3</span></h3>
          <div className="player-noble-slots">{Array.from({ length: 3 }, (_, index) => {
          const visitor = player.nobles[index]
          return <div className={`player-noble-slot${visitor ? ' claimed' : ''}`} key={index}
            aria-label={visitor ? `Great Spirit ${visitor.animal_name}, ${visitor.points} points, required ${COLORS.filter(color => visitor.cost[color]).map(color => `${visitor.cost[color]} ${color} bonuses`).join(', ')}` : `Empty Great Spirit slot ${index + 1} of 3`}>
            {visitor ? <>
              <span className="player-noble-points" aria-hidden="true">{visitor.points}</span>
              <img src={visitor.portrait} alt="" loading="lazy" />
              <span className="player-noble-name">{visitor.animal_name}</span>
              <CostList cost={visitor.cost} forNoble />
            </> : <span aria-hidden="true">✧</span>}
          </div>
          })}</div>
        </div>
        <div className="purchased-area"><h3>Purchased cards <span>· permanent bonuses</span></h3><div className="purchased-columns">{COLORS.map((color) => <div className={`purchased-column column-${color}`} key={color} aria-label={`${color} bonus cards, ${player.purchased[color].length}`}>
      <div className="column-heading"><Gem color={color} small /><span>{color}</span><b>{player.purchased[color].length}</b></div>
      <div className="purchased-stack">{player.purchased[color].length ? player.purchased[color].map((card) => <div className={`purchased-mini scene-${card.motif}`} key={card.id} title={cardArt[card.id]?.name ?? card.name}>{cardArt[card.id] ? <img className="purchased-mini-art" src={cardArt[card.id].image} alt="" loading="lazy" /> : <CardMotif motif={card.motif} />}<span className="mini-point">{card.points}</span></div>) : <div className="stack-empty" aria-hidden="true">✧</div>}</div>
        </div>)}</div></div>
      </div>
    </div>
  </section>
}

function TierDeck({ tier, count, selected, reservable, onClick, actions }: { tier: Tier; count: number; selected: boolean; reservable: boolean; onClick?: () => void; actions?: DeckActions }) {
  const roman = tier === 1 ? 'I' : tier === 2 ? 'II' : 'III'
  return <div className="deck-card-shell tier-deck-shell">
    <button type="button" className={`deck-card${reservable ? ' reservable-card' : ''}${selected ? ' selected-deck' : ''}`} onClick={onClick} disabled={!onClick || count === 0}
      aria-pressed={selected} aria-label={`Tier ${tier} deck, ${count} cards left, click for reserve option`}>
      <b>Tier {roman}</b><span aria-hidden="true">✿</span><small>{count} left</small>
    </button>
    {selected && actions && <div className="deck-actions-overlay" role="group" aria-label={`Tier ${tier} deck actions`}><button type="button" className="card-overlay-close" onClick={actions.close} aria-label="Close deck actions">✕</button><button type="button" onClick={actions.reserve}>Reserve</button></div>}
  </div>
}

export default function BoardPreview({ board, evaluationBar, onCard, onNoble, onReserve, onDeck, selected, selectedDeck, selectedReserve, selectedGems = [], selectedDiscards = [], onGem, onGold, onDiscardGem, onConfirmDiscards, onClearDiscards, reserveMode = false, onConfirmGems, onClearGems, canConfirmGems = false, marketActions, reservedActions, deckActions }: { board: Game; evaluationBar?: ReactNode; onCard?: (tier: 1 | 2 | 3, slot: number) => void; onNoble?: (slot: number) => void; onReserve?: (slot: number) => void; onDeck?: (tier: 1 | 2 | 3) => void; selected?: string; selectedDeck?: 1 | 2 | 3 | null; selectedReserve?: number | null; selectedGems?: Color[]; selectedDiscards?: GemColor[]; onGem?: (color: Color) => void; onGold?: () => void; onDiscardGem?: (color: GemColor) => void; onConfirmDiscards?: () => void; onClearDiscards?: () => void; reserveMode?: boolean; onConfirmGems?: () => void; onClearGems?: () => void; canConfirmGems?: boolean; marketActions?: MarketActions; reservedActions?: ReservedActions; deckActions?: DeckActions }) {
  const tiers = [3, 2, 1] as const
  const reserveFull = board.players[0].reserves.every(card => card !== null)
  const [cardArt, setCardArt] = useState<CardArt>({})
  const [profiles, setProfiles] = useState<Record<ProfileSide, string>>(() => ({ player: savedProfile('player'), ai: savedProfile('ai') }))
  const [activeProfile, setActiveProfile] = useState<ProfileSide | null>(null)
  const profileTrigger = useRef<HTMLButtonElement | null>(null)
  const profileDialog = useRef<HTMLDivElement | null>(null)
  const selectedProfile = (side: ProfileSide) => PROFILE_OPTIONS[side].find(option => option.id === profiles[side]) ?? PROFILE_OPTIONS[side][0]
  const portraitFor = (side: ProfileSide) => selectedProfile(side).image

  const closeProfilePicker = () => {
    setActiveProfile(null)
    profileTrigger.current?.focus()
  }
  const chooseProfile = (side: ProfileSide, id: string) => {
    setProfiles(current => ({ ...current, [side]: id }))
    try { window.localStorage.setItem(`splendor-${side}-profile`, id) } catch { /* Browser storage may be unavailable. */ }
    closeProfilePicker()
  }

  useEffect(() => {
    if (!activeProfile) return
    profileDialog.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeProfilePicker()
      if (event.key === 'Tab' && profileDialog.current) {
        const buttons = profileDialog.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === profileDialog.current)) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeProfile])

  useEffect(() => {
    const controller = new AbortController()
    const loadArt = async (base: string): Promise<CardArt> => {
      const response = await fetch(`${base}manifest.json`, { signal: controller.signal })
      if (!response.ok) throw new Error(`Could not load card art from ${base}`)
      const entries: { id: number; name: string; file: string }[] = await response.json()
      return Object.fromEntries(entries.map(entry => [String(entry.id), {
        name: entry.name,
        image: `${base}${entry.file}`,
      }]))
    }

    Promise.all([
      loadArt('/design/card-concepts/tier_3/national-wonders/').catch(() => ({})),
      loadArt('/design/card-concepts/tier_2/fantasy-architecture/').catch(() => ({})),
      loadArt('/design/card-concepts/tier_1/village-foundations/').catch(() => ({})),
    ]).then(([tier3Art, tier2Art, tier1Art]) => {
      if (!controller.signal.aborted) setCardArt({ ...tier3Art, ...tier2Art, ...tier1Art })
    })
    return () => controller.abort()
  }, [])
  return <div className="game-board">
    <div className="opponent-layout"><PlayerArea player={board.players[1]} cardArt={cardArt} portrait={portraitFor('ai')} onChangeProfile={trigger => { profileTrigger.current = trigger; setActiveProfile('ai') }} /></div>
    <div className="board-sidepanels">
      <section className="noble-section" aria-labelledby="noble-title"><h2 id="noble-title">Great Spirits <span aria-hidden="true">✦</span></h2><div className="noble-list">{board.nobles.map((noble, slot) => noble ? <NobleTile noble={noble} key={slot} onClick={onNoble ? () => onNoble(slot) : undefined} /> : <div className="noble-tile empty-tile" key={slot}>Welcomed</div>)}</div></section>
      {evaluationBar}
    </div>
    <div className="market-layout">
      <GemBank bank={board.bank} held={board.players[0].gems} selected={selectedGems} selectedDiscards={selectedDiscards} onGem={onGem} onGold={onGold} onDiscardGem={onDiscardGem} onConfirmDiscards={onConfirmDiscards} onClearDiscards={onClearDiscards} reserveMode={reserveMode} reserveFull={reserveFull} onConfirm={onConfirmGems} onClear={onClearGems} canConfirm={canConfirmGems} />
      <section className="market-panel" aria-label="Development card market">{tiers.map((tier) => <div className="market-row" key={tier}>
        <TierDeck tier={tier} count={board.decks[tier].length} selected={selectedDeck === tier} reservable={reserveMode && !reserveFull && board.decks[tier].length > 0} onClick={onDeck && !reserveFull ? () => onDeck(tier) : undefined} actions={selectedDeck === tier ? deckActions : undefined} />
        <div className="market-cards">{board.market[tier].map((card, slot) => card ? <MarketCard card={card} art={cardArt[card.id]} key={slot} selected={selected===`${tier}-${slot}`} actions={selected===`${tier}-${slot}` ? marketActions : undefined} reservable={reserveMode && !reserveFull} onClick={onCard ? () => onCard(tier, slot) : undefined} /> : <div className="market-card empty-tile" key={slot}>Empty</div>)}</div>
      </div>)}</section>
    </div>
    <div className="players-layout"><PlayerArea player={board.players[0]} cardArt={cardArt} portrait={portraitFor('player')} displayName={selectedProfile('player').name} onChangeProfile={trigger => { profileTrigger.current = trigger; setActiveProfile('player') }} onReserve={onReserve} selectedReserve={selectedReserve} reservedActions={reservedActions} /></div>
    {activeProfile && createPortal(
      <div className="profile-picker-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeProfilePicker() }}>
        <div className="profile-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-picker-title" tabIndex={-1} ref={profileDialog}>
          <div className="profile-picker-heading"><div><p>Choose a portrait</p><h2 id="profile-picker-title">Change {activeProfile === 'ai' ? 'Drew’s' : 'Your'} Profile</h2></div><button type="button" className="profile-picker-close" onClick={closeProfilePicker} aria-label="Close profile chooser">✕</button></div>
          <div className="profile-picker-options">{PROFILE_OPTIONS[activeProfile].map(option => <button type="button" className={`profile-picker-option${profiles[activeProfile] === option.id ? ' selected' : ''}`} key={option.id} onClick={() => chooseProfile(activeProfile, option.id)} aria-pressed={profiles[activeProfile] === option.id}>
            <img src={option.image} alt="" /><span>{option.name}</span>{profiles[activeProfile] === option.id && <strong>Selected</strong>}
          </button>)}</div>
        </div>
      </div>, document.body,
    )}
  </div>
}
