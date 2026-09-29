import { useEffect, useMemo, useRef, useState } from 'react'
import BoardPreview from './components/BoardPreview'
import PaymentEditor from './components/PaymentEditor'
import { COLORS, applyAction, chooseBlakeAction, createGame, legalActions, type Action, type Color, type Game, type GemColor, type GoldPayment, type Tier } from './game/game'
import { matchingTake, selectBankGem } from './game/gemSelection'

function makeSeed(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
function initialSeed() { return new URLSearchParams(window.location.search).get('seed') || makeSeed() }
function actionLabel(action: Action): string {
  switch (action.type) {
    case 'take': return `Take ${action.colors.join(' + ')}`
    case 'discard': return `Return ${action.color}`
    case 'noble': return `Welcome visitor ${action.slot + 1}`
    case 'reserveDeck': return `Reserve from tier ${action.tier} deck`
    case 'buy': return 'Buy card'
    case 'buyReserve': return 'Buy reserved card'
    case 'reserve': return 'Reserve card'
  }
}

export default function App() {
  const musicRef = useRef<HTMLAudioElement>(null)
  const musicWantedRef = useRef(true)
  const trackIndexRef = useRef(0)
  const [musicOn, setMusicOn] = useState(false)
  const [musicTracks, setMusicTracks] = useState<string[]>([])
  const [musicIssue, setMusicIssue] = useState<'blocked' | 'empty' | 'playlist' | 'failed' | null>(null)
  const [game, setGame] = useState<Game>(() => createGame(initialSeed()))
  const [seedDraft, setSeedDraft] = useState(game.seed)
  const [selected, setSelected] = useState<{ tier: Tier; slot: number } | null>(null)
  const [selectedDeck, setSelectedDeck] = useState<Tier | null>(null)
  const [selectedReserve, setSelectedReserve] = useState<number | null>(null)
  const [selectedGems, setSelectedGems] = useState<Color[]>([])
  const [selectedDiscards, setSelectedDiscards] = useState<GemColor[]>([])
  const [reserveMode, setReserveMode] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState<'market' | 'reserve' | null>(null)
  const [message, setMessage] = useState('Your turn. Choose gems or a card.')
  const legal = useMemo(() => legalActions(game), [game])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/audio/playlist.json', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Playlist unavailable')
        return response.json() as Promise<{ tracks: string[] }>
      })
      .then(playlist => {
        const tracks = Array.isArray(playlist.tracks) ? playlist.tracks.filter(track => typeof track === 'string') : []
        setMusicTracks(tracks)
        if (!tracks.length) setMusicIssue('empty')
      })
      .catch(error => {
        if (error instanceof Error && error.name !== 'AbortError') setMusicIssue('playlist')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (musicTracks.length && musicWantedRef.current) void playTrack(trackIndexRef.current)
  }, [musicTracks])

  useEffect(() => {
    if (!musicTracks.length || musicOn) return
    const startOnInteraction = (event: Event) => {
      if (!musicWantedRef.current || (event.target instanceof Element && event.target.closest('.music-toggle'))) return
      void playTrack(trackIndexRef.current)
    }
    document.addEventListener('pointerdown', startOnInteraction, true)
    document.addEventListener('keydown', startOnInteraction, true)
    return () => {
      document.removeEventListener('pointerdown', startOnInteraction, true)
      document.removeEventListener('keydown', startOnInteraction, true)
    }
  }, [musicTracks, musicOn])

  useEffect(() => {
    if (game.currentPlayer !== 1 || game.phase === 'over') return
    const timer = window.setTimeout(() => {
      setGame(current => current.currentPlayer !== 1 || current.phase === 'over' ? current : applyAction(current, chooseBlakeAction(current)))
      setMessage('Blake made a move.')
      setSelected(null)
      setSelectedDeck(null)
      setSelectedReserve(null)
      setPaymentTarget(null)
    }, 420)
    return () => clearTimeout(timer)
  }, [game])
  useEffect(() => {
    if (!paymentTarget) return
    document.querySelector<HTMLElement>('.payment-modal')?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPaymentTarget(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paymentTarget])

  function move(action: Action) {
    if (game.currentPlayer !== 0 || game.phase === 'over') return
    try {
      setGame(current => applyAction(current, action))
      setSelected(null)
      setSelectedDeck(null)
      setSelectedReserve(null)
      setSelectedGems([])
      setSelectedDiscards([])
      setReserveMode(false)
      setPaymentTarget(null)
      setMessage('Move played.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid move')
    }
  }
  function reset(value: string) {
    const seed = value.trim() || makeSeed()
    setGame(createGame(seed))
    setSeedDraft(seed)
    setSelected(null)
    setSelectedDeck(null)
    setSelectedReserve(null)
    setSelectedGems([])
    setSelectedDiscards([])
    setReserveMode(false)
    setPaymentTarget(null)
    setMessage('New game. Your turn.')
    const url = new URL(window.location.href)
    url.searchParams.set('seed', seed)
    window.history.replaceState(null, '', url)
  }

  const chosen = selected && game.market[selected.tier][selected.slot]
  const chosenReserved = selectedReserve !== null && game.players[0].reserves[selectedReserve]
  const cardActions = selected ? legal.filter(a => (a.type === 'buy' || a.type === 'reserve') && a.tier === selected.tier && a.slot === selected.slot) : []
  const reserveActions = selectedReserve !== null ? legal.filter(a => a.type === 'buyReserve' && a.slot === selectedReserve) : []
  const canBuyCard = cardActions.some(a => a.type === 'buy')
  const canBuyReserved = reserveActions.some(a => a.type === 'buyReserve')
  const reserveCardAction = cardActions.find((a): a is Extract<Action, { type: 'reserve' }> => a.type === 'reserve')
  const reserveDeckAction = selectedDeck !== null ? legal.find((a): a is Extract<Action, { type: 'reserveDeck' }> => a.type === 'reserveDeck' && a.tier === selectedDeck) : undefined
  const forced = legal.filter(a => a.type === 'noble')
  const takes = legal.filter((a): a is Extract<Action, { type: 'take' }> => a.type === 'take')
  const selectedTake = matchingTake(takes, selectedGems)
  const canReserve = legal.some(a => a.type === 'reserve' || a.type === 'reserveDeck')
  const paymentCard = paymentTarget === 'market' ? chosen : paymentTarget === 'reserve' ? chosenReserved : null
  const paymentActions = paymentTarget === 'market' ? cardActions : paymentTarget === 'reserve' ? reserveActions : []
  const winner = game.phase === 'over' ? (game.winners.length === 2 ? 'A tie' : game.winners[0] === 0 ? 'You win!' : 'Blake wins!') : null
  const gemsToReturn = Object.values(game.players[0].gems).reduce((sum, count) => sum + count, 0) - 10

  function confirmPayment(goldPayment: GoldPayment) {
    const action = paymentActions.find(a => (a.type === 'buy' || a.type === 'buyReserve') && COLORS.every(color => a.goldPayment[color] === goldPayment[color]))
    if (action) move(action)
    else setMessage('That payment is no longer available. Choose a payment again.')
  }
  function selectGem(color: Color) {
    setSelectedGems(current => selectBankGem(current, color, takes))
    setReserveMode(false)
    setPaymentTarget(null)
    setSelected(null)
    setSelectedDeck(null)
    setSelectedReserve(null)
  }
  function discardGem(color: GemColor) {
    if (game.currentPlayer !== 0 || game.phase !== 'discard') return
    setSelectedDiscards(current => {
      const selectedCount = current.filter(candidate => candidate === color).length
      if (current.length >= gemsToReturn || selectedCount >= game.players[0].gems[color]) {
        if (!selectedCount) return current
        const lastIndex = current.lastIndexOf(color)
        return current.filter((_, index) => index !== lastIndex)
      }
      return [...current, color]
    })
  }
  function confirmDiscards() {
    if (game.currentPlayer !== 0 || game.phase !== 'discard' || selectedDiscards.length !== gemsToReturn) return
    try {
      let next = game
      for (const color of selectedDiscards) next = applyAction(next, { type: 'discard', color })
      setGame(next)
      setSelectedDiscards([])
      setMessage('Gems returned.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid return')
    }
  }
  function selectCard(tier: Tier, slot: number) {
    if (reserveMode) {
      const action = legal.find((a): a is Extract<Action, { type: 'reserve' }> => a.type === 'reserve' && a.tier === tier && a.slot === slot)
      if (action) move(action)
      return
    }
    setSelected({ tier, slot })
    setSelectedDeck(null)
    setSelectedReserve(null)
    setSelectedGems([])
    setPaymentTarget(null)
  }

  async function playTrack(index: number, failed = 0): Promise<void> {
    const music = musicRef.current
    if (!music || !musicTracks.length || !musicWantedRef.current) return
    const nextIndex = index % musicTracks.length
    trackIndexRef.current = nextIndex
    if (music.getAttribute('src') !== musicTracks[nextIndex]) music.src = musicTracks[nextIndex]
    music.volume = 0.65
    try {
      await music.play()
      if (musicWantedRef.current) {
        setMusicOn(true)
        setMusicIssue(null)
      }
      else music.pause()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setMusicOn(false)
        setMusicIssue('blocked')
        return
      }
      if (musicWantedRef.current && failed + 1 < musicTracks.length) await playTrack(index + 1, failed + 1)
      else if (musicWantedRef.current) {
        musicWantedRef.current = false
        setMusicOn(false)
        setMusicIssue('failed')
        setMessage('Could not play the M4A songs in this browser.')
      }
    }
  }

  async function toggleMusic() {
    const music = musicRef.current
    if (!music) return
    if (musicOn) {
      musicWantedRef.current = false
      music.pause()
      setMusicOn(false)
      setMusicIssue(null)
      return
    }
    if (!musicTracks.length) {
      setMessage('Add .m4a songs to public/audio, then restart the app.')
      return
    }
    musicWantedRef.current = true
    music.volume = 0.65
    if (!music.getAttribute('src')) {
      await playTrack(trackIndexRef.current)
      return
    }
    try {
      await music.play()
      if (musicWantedRef.current) {
        setMusicOn(true)
        setMusicIssue(null)
      }
      else music.pause()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setMusicIssue('blocked')
        return
      }
      await playTrack(trackIndexRef.current + 1)
    }
  }

  return <div className="app-shell">
    <div className="world-background" aria-hidden="true">
      <span className="world-glow" />
      <span className="world-sunbeam" />
      <span className="world-night" /><span className="world-stars" /><span className="world-moon" />
      <span className="world-leaf world-leaf-one" /><span className="world-leaf world-leaf-two" />
      <span className="world-petal world-petal-one" /><span className="world-petal world-petal-two" /><span className="world-petal world-petal-three" />
      <span className="world-petal world-petal-four" /><span className="world-petal world-petal-five" /><span className="world-petal world-petal-six" />
      <span className="world-firefly world-firefly-one" /><span className="world-firefly world-firefly-two" /><span className="world-firefly world-firefly-three" /><span className="world-firefly world-firefly-four" />
    </div>
    <audio ref={musicRef} preload="none" onEnded={() => { if (musicWantedRef.current) void playTrack(trackIndexRef.current + 1) }} />
    <header className="site-header"><div className="brand"><span className="brand-gem" aria-hidden="true">◆</span> Blake</div><div className="header-actions"><button type="button" className="music-toggle" onClick={toggleMusic} aria-pressed={musicOn} aria-label={musicOn ? 'Mute background music' : 'Play background music'}><span aria-hidden="true">♫</span> {musicOn ? 'Music on' : musicIssue === 'blocked' ? 'Start music' : 'Music off'}</button><nav aria-label="Main navigation"><span className="nav-current" aria-current="page">Play</span></nav></div></header>
    {musicIssue === 'blocked' && <button type="button" className="music-start-prompt" onClick={toggleMusic}>♫ Start music</button>}
    {(musicIssue === 'empty' || musicIssue === 'playlist' || musicIssue === 'failed') && <div className="music-problem" role="status">{musicIssue === 'empty' ? 'No .m4a songs found in public/audio. Add songs and restart npm run dev.' : musicIssue === 'playlist' ? 'Music playlist unavailable. Restart npm run dev to regenerate it.' : 'These .m4a files could not be played by this browser.'}</div>}
    <main>
      <div className="intro"><div className="intro-copy"><p className="eyebrow">Play · two players</p><h1>A little world of gems</h1><p className="lead">Play a complete Splendor game against Blake. The board uses the supplied card catalog and rules. Blake currently chooses moves with a simple local strategy while we prepare the model.</p></div>
        <form className="seed-panel" onSubmit={e => { e.preventDefault(); reset(seedDraft) }}><h2>New seeded game</h2><p>Use the same seed to replay the same deck and visitor setup. Starting over resets all moves.</p><label htmlFor="game-seed">Game seed</label><div className="seed-row"><input id="game-seed" value={seedDraft} onChange={e => setSeedDraft(e.target.value)} spellCheck={false} /><button type="submit">Start over</button></div><button type="button" className="seed-random" onClick={() => reset(makeSeed())}>✦ Generate a new game</button></form>
      </div>
      <section className="play-controls" aria-label="Game controls">
        <div className="play-status"><strong>{winner || (game.currentPlayer === 0 ? 'Your turn' : 'Blake is thinking…')}</strong><span>Turn {game.turn + 1} · You {game.players[0].points} — {game.players[1].points} Blake</span><span>{game.endTriggered && game.phase !== 'over' ? 'Final round in progress. ' : ''}{game.currentPlayer === 0 && game.phase === 'discard' ? `Select ${gemsToReturn} ${gemsToReturn === 1 ? 'gem' : 'gems'} to return in the bank, then confirm.` : message}</span></div>
        {game.currentPlayer === 0 && forced.length > 0 && <div className="forced-controls"><h2>Choose one visitor</h2><div className="action-list">{forced.map((a, i) => <button key={i} onClick={() => move(a)}>{actionLabel(a)}</button>)}</div></div>}
        {winner && <button onClick={() => reset(game.seed)}>Replay this seed</button>}
      </section>
      <BoardPreview board={game} selected={selected ? `${selected.tier}-${selected.slot}` : undefined} selectedDeck={selectedDeck} selectedReserve={selectedReserve} selectedGems={selectedGems} reserveMode={reserveMode}
        marketActions={chosen ? { buy: canBuyCard ? () => setPaymentTarget('market') : undefined, reserve: reserveCardAction ? () => move(reserveCardAction) : undefined, close: () => setSelected(null) } : undefined}
        reservedActions={chosenReserved ? { buy: canBuyReserved ? () => setPaymentTarget('reserve') : undefined, close: () => setSelectedReserve(null) } : undefined}
        deckActions={reserveDeckAction ? { reserve: () => move(reserveDeckAction), close: () => setSelectedDeck(null) } : undefined}
        onGold={game.currentPlayer === 0 && game.phase === 'main' && canReserve ? () => { setReserveMode(active => !active); setSelected(null); setSelectedDeck(null); setSelectedReserve(null); setSelectedGems([]); setPaymentTarget(null) } : undefined}
        onGem={game.currentPlayer === 0 && game.phase === 'main' ? selectGem : undefined} onDiscardGem={game.currentPlayer === 0 && game.phase === 'discard' ? discardGem : undefined} selectedDiscards={selectedDiscards} onConfirmDiscards={confirmDiscards} onClearDiscards={() => setSelectedDiscards([])} canConfirmGems={Boolean(selectedTake)} onConfirmGems={() => { if (selectedTake) move(selectedTake) }} onClearGems={() => setSelectedGems([])}
        onCard={game.currentPlayer === 0 && game.phase === 'main' ? selectCard : undefined} onReserve={game.currentPlayer === 0 && game.phase === 'main' ? slot => { setSelectedReserve(slot); setSelected(null); setSelectedDeck(null); setSelectedGems([]); setReserveMode(false); setPaymentTarget(null) } : undefined}
        onDeck={game.currentPlayer === 0 && game.phase === 'main' ? tier => { setSelectedDeck(tier); setSelected(null); setSelectedReserve(null); setSelectedGems([]); setReserveMode(false); setPaymentTarget(null) } : undefined}
        onNoble={game.currentPlayer === 0 && game.phase === 'noble' ? slot => { const action = legal.find((a): a is Extract<Action, { type: 'noble' }> => a.type === 'noble' && a.slot === slot); if (action) move(action) } : undefined} />
      {game.currentPlayer === 0 && game.phase === 'main' && paymentCard && <div className="payment-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPaymentTarget(null) }}>
        <div className="payment-modal" role="dialog" aria-modal="true" aria-label={`Payment for ${paymentCard.name}`} tabIndex={-1}>
          <PaymentEditor key={`${paymentTarget}-${paymentCard.id}`} card={paymentCard} player={game.players[0]} onConfirm={confirmPayment} onCancel={() => setPaymentTarget(null)} />
        </div>
      </div>}
      <details className="game-history"><summary>Move history</summary><ol>{game.log.map((entry, i) => <li key={i}>{entry}</li>)}</ol></details>
      <details className="design-reference"><summary>View the approved design reference</summary><img src="/design/play-board-reference.png" alt="Approved board concept with cute gem characters, portrait market cards, three reserve slots per player, and five purchased-card columns." /></details>
    </main>
  </div>
}
