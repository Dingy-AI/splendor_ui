import catalog from './catalog.json'

export const COLORS = ['white', 'blue', 'green', 'red', 'black'] as const
export type Color = typeof COLORS[number]
export type GemColor = Color | 'gold'
export type Cost = Partial<Record<Color, number>>
export type GoldPayment = Record<Color, number>
export type Motif = 'flower' | 'bridge' | 'lantern' | 'shop' | 'star' | 'leaf'
export interface Card { id: string; tier: 1 | 2 | 3; points: number; bonus: Color; cost: Cost; name: string; motif: Motif }
export interface Noble { id: string; name: string; animal_name: string; portrait: string; colors: Color[]; points: number; cost: Cost; tone: 'peach' | 'mint' | 'blue' | 'lilac' | 'butter' }
export interface Player { id: string; name: string; tone: 'rose' | 'sky'; points: number; gems: Record<GemColor, number>; reserves: (Card | null)[]; reserveHidden: boolean[]; purchased: Record<Color, Card[]>; nobles: Noble[] }
export type Tier = 1 | 2 | 3
export interface Game { seed: string; bank: Record<GemColor, number>; nobles: (Noble | null)[]; market: Record<Tier, (Card | null)[]>; decks: Record<Tier, Card[]>; players: [Player, Player]; currentPlayer: 0 | 1; phase: 'main' | 'discard' | 'noble' | 'over'; turn: number; endTriggered: boolean; winners: number[]; log: string[] }
export type Action = { type: 'take'; colors: Color[] } | { type: 'reserve'; tier: Tier; slot: number } | { type: 'reserveDeck'; tier: Tier } | { type: 'buy'; tier: Tier; slot: number; goldPayment: GoldPayment } | { type: 'buyReserve'; slot: number; goldPayment: GoldPayment } | { type: 'discard'; color: GemColor } | { type: 'noble'; slot: number }
const allGems: GemColor[] = [...COLORS, 'gold']
const motifs: Motif[] = ['flower', 'bridge', 'lantern', 'shop', 'star', 'leaf']
const tones: Noble['tone'][] = ['peach', 'mint', 'blue', 'lilac', 'butter']
export const cards: Card[] = catalog.cards.map(c => ({...c, tier: c.tier as Tier, bonus: c.bonus as Color, cost: c.cost as Cost, name: `Gem card ${c.id}`, motif: motifs[Number(c.id) % motifs.length]}))
export const nobleCatalog: Noble[] = catalog.nobles.map(n => ({...n, cost: n.cost as Cost, colors: n.colors as Color[], tone: tones[Number(n.id) % tones.length]}))
const emptyGems = (): Record<GemColor, number> => ({white:0,blue:0,green:0,red:0,black:0,gold:0})
const player = (id: string, name: string, tone: Player['tone']): Player => ({id,name,tone,points:0,gems:emptyGems(),reserves:[null,null,null],reserveHidden:[false,false,false],purchased:{white:[],blue:[],green:[],red:[],black:[]},nobles:[]})
function random(seed: string) { let h=2166136261; for(const ch of seed){h^=ch.codePointAt(0)!;h=Math.imul(h,16777619)}; return () => {h+=0x6d2b79f5;let v=h;v=Math.imul(v^(v>>>15),v|1);v^=v+Math.imul(v^(v>>>7),v|61);return ((v^(v>>>14))>>>0)/4294967296} }
function shuffle<T>(source: T[], rng: () => number): T[] {const a=[...source];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function createGame(seed: string): Game {const rng=random(seed); const decks={} as Game['decks'];const market={} as Game['market'];for(const tier of [1,2,3] as const){decks[tier]=shuffle(cards.filter(c=>c.tier===tier),rng);market[tier]=Array.from({length:4},()=>decks[tier].pop()!)}return {seed,decks,market,nobles:shuffle(nobleCatalog,rng).slice(0,3),bank:{white:4,blue:4,green:4,red:4,black:4,gold:5},players:[player('p1','You','rose'),player('p2','Blake','sky')],currentPlayer:0,phase:'main',turn:0,endTriggered:false,winners:[],log:[]}}
export function effectiveCost(p: Player, c: Card): GoldPayment {
  return Object.fromEntries(COLORS.map(color => [color, Math.max(0, (c.cost[color] || 0) - p.purchased[color].length)])) as GoldPayment
}

export function payment(p: Player, c: Card, goldPayment: GoldPayment): Record<GemColor, number> | null {
  const used = emptyGems()
  const due = effectiveCost(p, c)
  for (const color of COLORS) {
    const gold = goldPayment[color]
    if (!Number.isInteger(gold) || gold < 0 || gold > due[color]) return null
    used[color] = due[color] - gold
    if (used[color] > p.gems[color]) return null
    used.gold += gold
  }
  return used.gold <= p.gems.gold ? used : null
}

export function paymentOptions(p: Player, c: Card): GoldPayment[] {
  const due = effectiveCost(p, c)
  const options: GoldPayment[] = []
  const assigned = {} as GoldPayment
  function addColor(index: number, goldUsed: number) {
    if (index === COLORS.length) {
      options.push({ ...assigned })
      return
    }
    const color = COLORS[index]
    const minimumGold = Math.max(0, due[color] - p.gems[color])
    for (let gold = minimumGold; gold <= due[color] && goldUsed + gold <= p.gems.gold; gold++) {
      assigned[color] = gold
      addColor(index + 1, goldUsed + gold)
    }
  }
  addColor(0, 0)
  return options
}
const qualifies=(p:Player,n:Noble)=>COLORS.every(c=>p.purchased[c].length >= (n.cost[c]||0))
export function legalActions(g: Game): Action[] {
  if (g.phase === 'over') return []
  const p = g.players[g.currentPlayer]
  if (g.phase === 'discard') return allGems.filter(color => p.gems[color] > 0).map(color => ({ type: 'discard', color }))
  if (g.phase === 'noble') return g.nobles.flatMap((n, slot) => n && qualifies(p, n) ? [{ type: 'noble' as const, slot }] : [])
  const actions: Action[] = []
  for (const tier of [1, 2, 3] as const) {
    g.market[tier].forEach((card, slot) => {
      if (!card) return
      for (const goldPayment of paymentOptions(p, card)) actions.push({ type: 'buy', tier, slot, goldPayment })
      if (p.reserves.some(entry => entry === null)) actions.push({ type: 'reserve', tier, slot })
    })
    if (p.reserves.some(entry => entry === null) && g.decks[tier].length) actions.push({ type: 'reserveDeck', tier })
  }
  p.reserves.forEach((card, slot) => {
    if (card) for (const goldPayment of paymentOptions(p, card)) actions.push({ type: 'buyReserve', slot, goldPayment })
  })
  const available = COLORS.filter(color => g.bank[color] > 0)
  if (available.length >= 3) {
    for (let i = 0; i < available.length; i++)
      for (let j = i + 1; j < available.length; j++)
        for (let k = j + 1; k < available.length; k++) actions.push({ type: 'take', colors: [available[i], available[j], available[k]] })
  } else if (available.length) actions.push({ type: 'take', colors: available })
  for (const color of COLORS) if (g.bank[color] >= 4) actions.push({ type: 'take', colors: [color, color] })
  return actions
}
function finish(g:Game, claimedNoble=false){const p=g.players[g.currentPlayer];if(allGems.reduce((n,c)=>n+p.gems[c],0)>10){g.phase='discard';return}if(!claimedNoble&&g.nobles.some(n=>n&&qualifies(p,n))){g.phase='noble';return}if(g.endTriggered&&g.currentPlayer===1){g.phase='over';const top=Math.max(...g.players.map(x=>x.points));const fewest=Math.min(...g.players.filter(x=>x.points===top).map(x=>COLORS.reduce((n,c)=>n+x.purchased[c].length,0)));g.winners=g.players.flatMap((x,i)=>x.points===top&&COLORS.reduce((n,c)=>n+x.purchased[c].length,0)===fewest?[i]:[]);return}g.phase='main';g.currentPlayer=g.currentPlayer===0?1:0;g.turn++}
export function applyAction(state:Game,action:Action):Game {if(!legalActions(state).some(a=>JSON.stringify(a)===JSON.stringify(action)))throw new Error('Illegal action');const g:Game=structuredClone(state);const p=g.players[g.currentPlayer];let label='';if(action.type==='take'){for(const c of action.colors){p.gems[c]++;g.bank[c]--}label=`took ${action.colors.join(', ')}`}else if(action.type==='discard'){p.gems[action.color]--;g.bank[action.color]++;label=`returned ${action.color}`}else if(action.type==='reserve'||action.type==='reserveDeck'){const c=action.type==='reserve'?g.market[action.tier][action.slot]:g.decks[action.tier].pop()!;if(!c)throw new Error('No card');const reserveSlot=p.reserves.findIndex(x=>x===null);p.reserves[reserveSlot]=c;p.reserveHidden[reserveSlot]=action.type==='reserveDeck';if(action.type==='reserve')g.market[action.tier][action.slot]=g.decks[action.tier].pop()||null;if(g.bank.gold){g.bank.gold--;p.gems.gold++}label=action.type==='reserveDeck'?`reserved a face-down tier ${action.tier} card`:`reserved tier ${action.tier} card ${c.id}`}else if(action.type==='buy'||action.type==='buyReserve'){const c=action.type==='buy'?g.market[action.tier][action.slot]:p.reserves[action.slot];if(!c)throw new Error('No card');const used=payment(p,c,action.goldPayment)!;for(const color of allGems){p.gems[color]-=used[color];g.bank[color]+=used[color]}p.purchased[c.bonus].push(c);p.points+=c.points;if(action.type==='buy')g.market[action.tier][action.slot]=g.decks[action.tier].pop()||null;else {p.reserves[action.slot]=null;p.reserveHidden[action.slot]=false;}if(p.points>=15)g.endTriggered=true;label=`bought tier ${c.tier} card ${c.id}`}else if(action.type==='noble'){const n=g.nobles[action.slot]!;p.nobles.push(n);p.points+=n.points;g.nobles[action.slot]=null;if(p.points>=15)g.endTriggered=true;label=`welcomed ${n.name}`}g.log=[`${p.name} ${label}`, ...g.log].slice(0,16);finish(g,action.type==='noble');return g}
