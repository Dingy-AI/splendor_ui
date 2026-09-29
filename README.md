# Blake Splendor web

A browser based two player Splendor game. The first playable rules pass uses the uploaded Python environment's 90 development cards and 10 nobles, with a TypeScript game engine. Blake currently makes local heuristic moves; the trained PyTorch model is not connected yet. The board has the approved cute gem look.

## Run locally

Requires a current Node.js release (20.19+ or 22.12+) and npm.

```bash
npm install
npm run dev
```

Open the local URL Vite prints. Run `npm run build` to check the TypeScript build. No backend or Python process is needed to play this version.

## Play

Enter a seed and press **Start over**, or generate a new one. The same seed deals the same decks and nobles. Pick a legal gem action, click a market card and choose Buy or Reserve, click a deck to reserve its top card, or click a reserved card to buy it. Return gems when holding more than ten; claim an eligible visitor when prompted. A player reaching 15 points triggers the final round, and equal turns determine the winner. Ties on points use the fewest purchased cards.

The engine mirrors the supplied environment's two player supply, gem taking, reserve, payment, noble, and final round behavior. It pays colored gems first and uses gold only for a shortage; the Python environment also enumerates optional gold substitutions, which the UI does not expose yet. The seeded shuffle is reproducible within this app, but uses a JavaScript PRNG rather than NumPy's generator, so the same numeric seed does not deal the identical Python board. The opponent uses a temporary local heuristic, not the `.pt` model. The reference image is under `public/design`.

## Next passes

Connect the model's observation encoder and action mapping, export to a browser runtime, then add evaluation and exploration controls. The engine is isolated in `src/game` for this integration.
