DREW / BLAKE MODEL 4 INTEGRATION

Merge src/ into your current web project's src/ directory. Add server/ beside
package.json. The original board artwork stays in your existing public/ folder.
The checkpoint is bundled at server/checkpoints/model_4000_games.pt.

Run locally on Windows:
1. Activate the Python environment you use for your Splendor bot (with PyTorch).
   Ensure numpy and gymnasium are installed in it too.
2. From server/, run:
     python app.py --checkpoint checkpoints/model_4000_games.pt --simulations 200
   Or double-click start_blake_windows.bat if your default Python has the packages.
3. From the web project root, run:
     npm run dev
4. Open http://127.0.0.1:5173. The page will connect to the Python game service.

The Python environment owns the deck, legal moves, rules, and game state. The
browser only receives the visible board, player-legal action IDs, and opaque
session token. Drew's face-down reserved cards and deck order are not sent.
The AI endpoint runs one MCTS decision per request, including forced discards or
Great Spirit claims. The UI will keep showing Drew thinking until his turn ends.

The web API URL defaults to http://127.0.0.1:8765. Set VITE_BLAKE_API_URL
if you change it. For another Vite origin, pass --origin to server/app.py.
The server is for a trusted local game session; it binds only to 127.0.0.1.

Validation in the Codex workspace: TypeScript check and Vite build passed;
Python files compile. The Python environment produced a legal opening snapshot,
accepted player moves, ran 80 legal steps with a search stub, hid Drew's
face-down reserve, and handled a two-gem forced discard. All 90 cards and 10 Great Spirits match the UI catalog.
The actual 4,000-game model cannot be executed here because PyTorch and
Gymnasium are unavailable in this workspace. Run the local server to verify
strict checkpoint loading and a full trained MCTS turn in your Python setup.


# to install the files 
py -m venv .venv

# open in command line 

.\.venv\Scripts\Activate.ps1


python -m pip install torch numpy gymnasium
cd server
python app.py --checkpoint checkpoints/model_4000_games.pt --simulations 200
