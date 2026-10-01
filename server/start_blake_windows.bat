@echo off
cd /d "%~dp0"
python app.py --checkpoint checkpoints\model_4000_games.pt --simulations 200
pause
