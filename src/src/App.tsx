import { useEffect, useRef, useState } from 'react'
import BoardPreview from './components/BoardPreview'
import EvaluationBar from './components/EvaluationBar'
import PaymentEditor from './components/PaymentEditor'
import { COLORS, createGame, type Action, type Color, type Game, type GemColor, type GoldPayment, type Tier } from './game/game'
import { evaluateGame, newGame, playAiMove, playMoves, type FirstPlayer, type ModelEvaluation, type RemoteAction } from './ai/client'
import { matchingTake, selectBankGem } from './game/gemSelection'

function makeSeed(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
function initialSeed() { return new URLSearchParams(window.location.search).get('seed') || makeSeed() }
function initialFirstPlayer(): FirstPlayer {
  return new URLSearchParams(window.location.search).get('first') === 'drew' ? 'drew' : 'you'
}
function createDrewGame(seed: string): Game {
  const game = createGame(seed)
  game.players[1].name = 'Drew'
  return game
}
function actionLabel(action: Action): string {
  switch (action.type) {
    case 'take': return `Take ${action.colors.join(' + ')}`
    case 'discard': return `Return ${action.color}`
    case 'noble': return `Welcome Great Spirit ${action.slot + 1}`
    case 'reserveDeck': return `Reserve from tier ${action.tier} deck`
    case 'buy': return 'Buy card'
    case 'buyReserve': return 'Buy reserved card'
    case 'reserve': return 'Reserve card'
  }
}

function HowToPlayOverlay({ onClose }: { onClose: () => void }) {
  return <div className="htp-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="htp-dialog" role="dialog" aria-modal="true" aria-labelledby="htp-title" aria-describedby="htp-summary" tabIndex={-1}>
      <header className="htp-header">
        <div>
          <p className="htp-kicker">How to play</p>
          <h2 id="htp-title">Create wonders. Attract Great Spirits.</h2>
          <p id="htp-summary">You are a young god shaping a corner of the world. Gather gems, create wonders, and earn enough Glory to draw the attention of the Great Spirits.</p>
        </div>
        <button type="button" className="htp-close" onClick={onClose} aria-label="Close how to play">✕</button>
      </header>

      <div className="htp-scroll">
        <section className="htp-section">
          <h3>Your turn</h3>
          <p>Choose exactly one main action:</p>
          <div className="htp-action-grid">
            <article><span className="htp-step">1</span><div><strong>Gather gems</strong><p>Take 3 different colors. If fewer than 3 colors remain in the bank, take the available colors. Or take 2 of one color when at least 4 of that color remain.</p></div></article>
            <article><span className="htp-step">2</span><div><strong>Create a wonder</strong><p>Pay the cost of a face-up card or one you reserved. Its color becomes a permanent discount, and any Glory on the card is added to your score.</p></div></article>
            <article><span className="htp-step">3</span><div><strong>Reserve a card</strong><p>Reserve a face-up card or the top card of a tier. If gold is available, take 1 gold. You may keep at most 3 reserved cards.</p></div></article>
          </div>
        </section>

        <div className="htp-two-column">
          <section className="htp-section htp-small-section">
            <div className="htp-section-heading"><span className="htp-symbol">◆</span><h3>Gold is wild</h3></div>
            <p>Gold may replace any colored gem when paying for a card. Gold itself does not count as a permanent discount.</p>
          </section>

          <section className="htp-section htp-small-section">
            <div className="htp-section-heading"><span className="htp-symbol">✦</span><h3>Permanent mastery</h3></div>
            <p>Each card you create gives 1 permanent bonus of its color. Every bonus reduces future costs of that color by 1.</p>
          </section>

          <section className="htp-section htp-small-section htp-spirit-section">
            <div className="htp-section-heading"><span className="htp-symbol">☾</span><h3>Great Spirits</h3></div>
            <p>At the end of your turn, a Great Spirit is attracted to your realm if your permanent bonuses meet its requirements. If several qualify, choose one. Its Glory is added immediately.</p>
          </section>

          <section className="htp-section htp-small-section">
            <div className="htp-section-heading"><span className="htp-symbol htp-number-symbol">10</span><h3>Gem limit</h3></div>
            <p>You may hold no more than 10 gems total, including gold. If you exceed the limit, return gems to the bank until you hold 10.</p>
          </section>
        </div>

        <section className="htp-section htp-end-section">
          <div className="htp-section-heading"><span className="htp-symbol htp-number-symbol">15</span><h3>Ending the game</h3></div>
          <p>Reaching 15 Glory starts the final round. Finish the round so both players have taken the same number of turns. The player with the most Glory wins. If tied, the player who created fewer cards wins; if still tied, the game is a tie.</p>
        </section>
      </div>

      <footer className="htp-footer">
        <button type="button" onClick={onClose}>Back to the game</button>
      </footer>
    </section>
  </div>
}

export default function App() {
  const rulesButtonRef = useRef<HTMLButtonElement>(null)
  const musicRef = useRef<HTMLAudioElement>(null)
  const musicWantedRef = useRef(true)
  const trackIndexRef = useRef(0)
  const [musicOn, setMusicOn] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [musicTracks, setMusicTracks] = useState<string[]>([])
  const [musicIssue, setMusicIssue] = useState<'blocked' | 'empty' | 'playlist' | 'failed' | null>(null)
  const [game, setGame] = useState<Game>(() => createDrewGame(initialSeed()))
  const [seedDraft, setSeedDraft] = useState(game.seed)
  const [firstPlayerDraft, setFirstPlayerDraft] = useState<FirstPlayer>(initialFirstPlayer)
  const [activeFirstPlayer, setActiveFirstPlayer] = useState<FirstPlayer>(initialFirstPlayer)
  const [selected, setSelected] = useState<{ tier: Tier; slot: number } | null>(null)
  const [selectedDeck, setSelectedDeck] = useState<Tier | null>(null)
  const [selectedReserve, setSelectedReserve] = useState<number | null>(null)
  const [selectedGems, setSelectedGems] = useState<Color[]>([])
  const [selectedDiscards, setSelectedDiscards] = useState<GemColor[]>([])
  const [reserveMode, setReserveMode] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState<'market' | 'reserve' | null>(null)
  const [message, setMessage] = useState('Your turn. Choose gems or a card.')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [remoteLegal, setRemoteLegal] = useState<RemoteAction[]>([])
  const [pending, setPending] = useState(true)
  const [aiFailed, setAiFailed] = useState(false)
  const [showEvaluation, setShowEvaluation] = useState(false)
  const [evaluation, setEvaluation] = useState<ModelEvaluation | null>(null)
  const [evaluationLoading, setEvaluationLoading] = useState(false)
  const [evaluationError, setEvaluationError] = useState<string | null>(null)
  const generation = useRef(0)
  const legal: Action[] = remoteLegal

  useEffect(() => { void reset(initialSeed(), initialFirstPlayer()) }, [])

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
    if (!sessionId || pending || aiFailed || game.currentPlayer !== 1 || game.phase === 'over') return
    const currentGeneration = generation.current
    const timer = window.setTimeout(async () => {
      setPending(true)
      try {
        const result = await playAiMove(sessionId)
        if (generation.current !== currentGeneration) return
        setGame(result.game)
        setRemoteLegal(result.legalActions)
        setMessage('Drew made a move.')
        setSelected(null)
        setSelectedDeck(null)
        setSelectedReserve(null)
        setPaymentTarget(null)
      } catch (error) {
        if (generation.current !== currentGeneration) return
        setAiFailed(true)
        setMessage(error instanceof Error ? error.message : 'Drew could not move')
      } finally {
        if (generation.current === currentGeneration) setPending(false)
      }
    }, 420)
    return () => clearTimeout(timer)
  }, [game, sessionId, pending, aiFailed])

  useEffect(() => {
    if (!showEvaluation || !sessionId) {
      setEvaluation(null)
      setEvaluationLoading(false)
      setEvaluationError(null)
      return
    }
    const controller = new AbortController()
    const currentGeneration = generation.current
    setEvaluationLoading(true)
    setEvaluationError(null)
    evaluateGame(sessionId, controller.signal)
      .then(result => {
        if (!controller.signal.aborted && currentGeneration === generation.current) setEvaluation(result)
      })
      .catch(error => {
        if (!controller.signal.aborted && currentGeneration === generation.current)
          setEvaluationError(error instanceof Error ? error.message : 'Evaluation unavailable')
      })
      .finally(() => {
        if (!controller.signal.aborted && currentGeneration === generation.current) setEvaluationLoading(false)
      })
    return () => controller.abort()
  }, [showEvaluation, sessionId, game])
  useEffect(() => {
    if (!paymentTarget) return
    document.querySelector<HTMLElement>('.payment-modal')?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPaymentTarget(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paymentTarget])

  useEffect(() => {
    if (!showRules) return
    const dialog = document.querySelector<HTMLElement>('.htp-dialog')
    dialog?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowRules(false)
      } else if (event.key === 'Tab' && dialog) {
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (!first || !last) return
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      rulesButtonRef.current?.focus()
    }
  }, [showRules])

  async function move(action: Action) {
    if (!sessionId || pending || game.currentPlayer !== 0 || game.phase === 'over') return
    const actionId = (action as RemoteAction).actionId
    if (!Number.isInteger(actionId)) { setMessage('This action is unavailable. Start a new game.'); return }
    const currentGeneration = generation.current
    setPending(true)
    try {
      const result = await playMoves(sessionId, [actionId])
      if (generation.current !== currentGeneration) return
      setGame(result.game)
      setRemoteLegal(result.legalActions)
      setSelected(null)
      setSelectedDeck(null)
      setSelectedReserve(null)
      setSelectedGems([])
      setSelectedDiscards([])
      setReserveMode(false)
      setPaymentTarget(null)
      setMessage('Move played.')
    } catch (error) {
      if (generation.current === currentGeneration) setMessage(error instanceof Error ? error.message : 'Invalid move')
    } finally {
      if (generation.current === currentGeneration) setPending(false)
    }
  }
  async function reset(value: string, firstPlayer: FirstPlayer = firstPlayerDraft) {
    const seed = value.trim() || makeSeed()
    const currentGeneration = ++generation.current
    setPending(true)
    setAiFailed(false)
    setSessionId(null)
    setRemoteLegal([])
    setEvaluation(null)
    setSeedDraft(seed)
    setFirstPlayerDraft(firstPlayer)
    setSelected(null)
    setSelectedDeck(null)
    setSelectedReserve(null)
    setSelectedGems([])
    setSelectedDiscards([])
    setReserveMode(false)
    setPaymentTarget(null)
    setMessage('Connecting to Drew…')
    const url = new URL(window.location.href)
    url.searchParams.set('seed', seed)
    url.searchParams.set('first', firstPlayer)
    window.history.replaceState(null, '', url)
    try {
      const result = await newGame(seed, firstPlayer)
      if (generation.current !== currentGeneration) return
      setGame(result.game)
      setActiveFirstPlayer(firstPlayer)
      setSessionId(result.session)
      setRemoteLegal(result.legalActions)
      setMessage(firstPlayer === 'you' ? 'Your turn. Choose gems or a card.' : 'Drew goes first.')
    } catch (error) {
      if (generation.current === currentGeneration) setMessage(error instanceof Error ? error.message : 'Could not connect to Drew')
    } finally {
      if (generation.current === currentGeneration) setPending(false)
    }
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
  const winner = game.phase === 'over' ? (game.winners.length === 2 ? 'A tie' : game.winners[0] === 0 ? 'You win!' : 'Drew wins!') : null
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
  async function confirmDiscards() {
    if (!sessionId || pending || game.currentPlayer !== 0 || game.phase !== 'discard' || selectedDiscards.length !== gemsToReturn) return
    const actionIds = selectedDiscards.map(color => remoteLegal.find(action => action.type === 'discard' && action.color === color)?.actionId)
    if (actionIds.some(id => id === undefined)) { setMessage('Invalid gem return'); return }
    const currentGeneration = generation.current
    setPending(true)
    try {
      const result = await playMoves(sessionId, actionIds as number[])
      if (generation.current !== currentGeneration) return
      setGame(result.game)
      setRemoteLegal(result.legalActions)
      setSelectedDiscards([])
      setMessage('Gems returned.')
    } catch (error) {
      if (generation.current === currentGeneration) setMessage(error instanceof Error ? error.message : 'Invalid return')
    } finally {
      if (generation.current === currentGeneration) setPending(false)
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
    <header className="site-header"><div className="brand"><span className="brand-gem" aria-hidden="true">◆</span> Drew</div><div className="header-actions"><button ref={rulesButtonRef} type="button" className="how-to-play-button" onClick={() => setShowRules(true)} aria-label="How to play" aria-haspopup="dialog" aria-expanded={showRules}><span className="how-to-play-icon" aria-hidden="true">?</span><span className="how-to-play-label">How to play</span></button><button type="button" className="music-toggle" onClick={toggleMusic} aria-pressed={musicOn} aria-label={musicOn ? 'Mute background music' : 'Play background music'}><span aria-hidden="true">♫</span> {musicOn ? 'Music on' : musicIssue === 'blocked' ? 'Start music' : 'Music off'}</button><nav aria-label="Main navigation"><span className="nav-current" aria-current="page">Play</span></nav></div></header>
    {musicIssue === 'blocked' && <button type="button" className="music-start-prompt" onClick={toggleMusic}>♫ Start music</button>}
    {(musicIssue === 'empty' || musicIssue === 'playlist' || musicIssue === 'failed') && <div className="music-problem" role="status">{musicIssue === 'empty' ? 'No .m4a songs found in public/audio. Add songs and restart npm run dev.' : musicIssue === 'playlist' ? 'Music playlist unavailable. Restart npm run dev to regenerate it.' : 'These .m4a files could not be played by this browser.'}</div>}
    {showRules && <HowToPlayOverlay onClose={() => setShowRules(false)} />}
    <main>
      <div className="intro"><div className="intro-copy"><p className="eyebrow">Play · two players</p><h1>A little world of gems</h1><p className="lead">Play a complete Splendor game against Drew. The board uses the supplied card catalog and rules. Drew plays using the trained 4,000-game model and MCTS search.</p></div>
        <form className="seed-panel" onSubmit={e => { e.preventDefault(); void reset(seedDraft) }}><h2>New seeded game</h2><p>Use the same seed to replay the same deck and Great Spirit setup. Starting over resets all moves.</p><label htmlFor="game-seed">Game seed</label><div className="seed-row"><input id="game-seed" value={seedDraft} onChange={e => setSeedDraft(e.target.value)} spellCheck={false} /><button type="submit">Start over</button></div><fieldset className="first-player-field"><legend>Who goes first?</legend><div className="first-player-options"><label><input type="radio" name="first-player" checked={firstPlayerDraft === 'you'} onChange={() => setFirstPlayerDraft('you')} /> You</label><label><input type="radio" name="first-player" checked={firstPlayerDraft === 'drew'} onChange={() => setFirstPlayerDraft('drew')} /> Drew</label></div></fieldset><button type="button" className="seed-random" onClick={() => void reset(makeSeed())}>✦ Generate a new game</button></form>
      </div>
      <section className="play-controls" aria-label="Game controls">
        <div className="play-status"><strong>{winner || (!sessionId ? pending ? 'Connecting to Drew…' : 'Drew is offline' : game.currentPlayer === 0 ? 'Your turn' : aiFailed ? 'Drew needs a retry' : 'Drew is thinking…')}</strong><span>Turn {game.turn + 1} · You {game.players[0].points} — {game.players[1].points} Drew</span><span>{game.endTriggered && game.phase !== 'over' ? 'Final round in progress. ' : ''}{!pending && !!sessionId && game.currentPlayer === 0 && game.phase === 'discard' ? `Select ${gemsToReturn} ${gemsToReturn === 1 ? 'gem' : 'gems'} to return in the bank, then confirm.` : message}</span></div>
        {!sessionId && !pending && <button onClick={() => void reset(seedDraft)}>Reconnect</button>}
        {!pending && game.currentPlayer === 0 && forced.length > 0 && <div className="forced-controls"><h2>Choose one Great Spirit</h2><div className="action-list">{forced.map((a, i) => <button key={i} onClick={() => move(a)}>{actionLabel(a)}</button>)}</div></div>}
        {winner && <button onClick={() => void reset(game.seed, activeFirstPlayer)}>Replay this seed</button>}
        {aiFailed && <button onClick={() => setAiFailed(false)}>Retry Drew’s move</button>}
        <label className="evaluation-toggle"><input type="checkbox" checked={showEvaluation} onChange={event => setShowEvaluation(event.target.checked)} /> Show model evaluation</label>
        {showEvaluation && <p className="evaluation-explanation">Blake’s value-head estimate of the expected result: win + half a draw. This is a model estimate, not a calibrated chance against a human.</p>}
      </section>
      <div className="board-with-evaluation">
      {showEvaluation && <EvaluationBar evaluation={evaluation} loading={evaluationLoading} error={evaluationError} />}
      <BoardPreview board={game} selected={selected ? `${selected.tier}-${selected.slot}` : undefined} selectedDeck={selectedDeck} selectedReserve={selectedReserve} selectedGems={selectedGems} reserveMode={reserveMode}
        marketActions={chosen ? { buy: canBuyCard ? () => setPaymentTarget('market') : undefined, reserve: reserveCardAction ? () => move(reserveCardAction) : undefined, close: () => setSelected(null) } : undefined}
        reservedActions={chosenReserved ? { buy: canBuyReserved ? () => setPaymentTarget('reserve') : undefined, close: () => setSelectedReserve(null) } : undefined}
        deckActions={reserveDeckAction ? { reserve: () => move(reserveDeckAction), close: () => setSelectedDeck(null) } : undefined}
        onGold={!pending && !!sessionId && game.currentPlayer === 0 && game.phase === 'main' && canReserve ? () => { setReserveMode(active => !active); setSelected(null); setSelectedDeck(null); setSelectedReserve(null); setSelectedGems([]); setPaymentTarget(null) } : undefined}
        onGem={!pending && !!sessionId && game.currentPlayer === 0 && game.phase === 'main' ? selectGem : undefined} onDiscardGem={!pending && !!sessionId && game.currentPlayer === 0 && game.phase === 'discard' ? discardGem : undefined} selectedDiscards={selectedDiscards} onConfirmDiscards={confirmDiscards} onClearDiscards={() => setSelectedDiscards([])} canConfirmGems={Boolean(selectedTake)} onConfirmGems={() => { if (selectedTake) move(selectedTake) }} onClearGems={() => setSelectedGems([])}
        onCard={!pending && !!sessionId && game.currentPlayer === 0 && game.phase === 'main' ? selectCard : undefined} onReserve={!pending && !!sessionId && game.currentPlayer === 0 && game.phase === 'main' ? slot => { setSelectedReserve(slot); setSelected(null); setSelectedDeck(null); setSelectedGems([]); setReserveMode(false); setPaymentTarget(null) } : undefined}
        onDeck={!pending && !!sessionId && game.currentPlayer === 0 && game.phase === 'main' ? tier => { setSelectedDeck(tier); setSelected(null); setSelectedReserve(null); setSelectedGems([]); setReserveMode(false); setPaymentTarget(null) } : undefined}
        onNoble={!pending && !!sessionId && game.currentPlayer === 0 && game.phase === 'noble' ? slot => { const action = legal.find((a): a is Extract<Action, { type: 'noble' }> => a.type === 'noble' && a.slot === slot); if (action) move(action) } : undefined} />
      </div>
      {!pending && !!sessionId && game.currentPlayer === 0 && game.phase === 'main' && paymentCard && <div className="payment-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPaymentTarget(null) }}>
        <div className="payment-modal" role="dialog" aria-modal="true" aria-label={`Payment for ${paymentCard.name}`} tabIndex={-1}>
          <PaymentEditor key={`${paymentTarget}-${paymentCard.id}`} card={paymentCard} player={game.players[0]} onConfirm={confirmPayment} onCancel={() => setPaymentTarget(null)} />
        </div>
      </div>}
      <details className="game-history"><summary>Move history</summary><ol>{game.log.map((entry, i) => <li key={i}>{entry}</li>)}</ol></details>
      <details className="design-reference"><summary>View the approved design reference</summary><img src="/design/play-board-reference.png" alt="Approved board concept with cute gem characters, portrait market cards, three reserve slots per player, and five purchased-card columns." /></details>
    </main>
  </div>
}
