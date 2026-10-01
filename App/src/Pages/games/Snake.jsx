import { useState, useRef, useEffect } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';
import { usePersistentState, readPersisted, writePersisted, removePersisted } from '../../Utils/usePersistentState';

const SAVE_KEY = 'game:snake:save';

// Pre-usePersistentState high score, carried over on first load.
const legacyHighScore = () => {
  try { return parseInt(localStorage.getItem('snakeHighScore'), 10) || 0; } catch { return 0; }
};

const isValidSave = (s) =>
  s && Array.isArray(s.snake) && s.snake.length > 0 && s.food && s.direction && Number.isFinite(s.score);

export default function Snake() {
  const canvasRef = useRef(null);
  // An unfinished game left behind when the player navigated away; resumes paused.
  const [savedGame, setSavedGame] = useState(() => {
    const s = readPersisted(SAVE_KEY, null);
    return isValidSave(s) ? s : null;
  });
  const [score, setScore] = useState(() => savedGame?.score ?? 0);
  const [highScore, setHighScore] = usePersistentState('game:snake:highScore', legacyHighScore);
  const [gameActive, setGameActive] = useState(false);
  const [status, setStatus] = useState(() => savedGame
    ? { msg: "Game paused. Click RESUME to continue", type: "" }
    : { msg: "Click START to begin", type: "" });

  const saveHighScore = (newScore) => setHighScore(h => Math.max(h, newScore));
  const gameStateRef = useRef({
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 15 },
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    score: 0,
    gameOver: false,
  });
  const stopLoopRef = useRef(null); // set while a game loop is running

  const GRID_SIZE = 20;
  const CELL_SIZE = 20;

  const draw = (state) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(canvas.width, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw snake
    state.snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#10b981' : '#6ee7b7';
      ctx.fillRect(segment.x * CELL_SIZE + 1, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });

    // Draw food
    ctx.fillStyle = '#f97316';
    ctx.fillRect(state.food.x * CELL_SIZE + 2, state.food.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
  };

  // Show the paused board of a restored game.
  useEffect(() => {
    if (savedGame) draw(savedGame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving mid-game stops the loop and stores a snapshot to resume from.
  useEffect(() => {
    const snapshot = () => {
      const state = gameStateRef.current;
      if (!stopLoopRef.current || state.gameOver) return;
      writePersisted(SAVE_KEY, { ...state, nextDirection: state.direction });
    };
    window.addEventListener('pagehide', snapshot);
    return () => {
      window.removeEventListener('pagehide', snapshot);
      snapshot();
      stopLoopRef.current?.();
    };
  }, []);

  const startGame = () => {
    runGame({
      snake: [{ x: 10, y: 10 }],
      food: { x: 15, y: 15 },
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      score: 0,
      gameOver: false,
    });
  };

  const resumeGame = () => {
    if (savedGame) runGame({ ...savedGame, gameOver: false });
  };

  const runGame = (initialState) => {
    stopLoopRef.current?.();
    removePersisted(SAVE_KEY);
    setSavedGame(null);
    setGameActive(true);
    setScore(initialState.score);
    setStatus({ msg: "Use arrow keys to move. Don't hit the walls or yourself!", type: "ok" });
    gameStateRef.current = initialState;

    const handleKeyDown = (e) => {
      const { direction, nextDirection } = gameStateRef.current;
      if (e.key === 'ArrowUp' && direction.y === 0) gameStateRef.current.nextDirection = { x: 0, y: -1 };
      if (e.key === 'ArrowDown' && direction.y === 0) gameStateRef.current.nextDirection = { x: 0, y: 1 };
      if (e.key === 'ArrowLeft' && direction.x === 0) gameStateRef.current.nextDirection = { x: -1, y: 0 };
      if (e.key === 'ArrowRight' && direction.x === 0) gameStateRef.current.nextDirection = { x: 1, y: 0 };
    };

    window.addEventListener('keydown', handleKeyDown);

    const gameLoop = setInterval(() => {
      const state = gameStateRef.current;
      if (!canvasRef.current) return;

      // Update direction
      state.direction = state.nextDirection;

      // Move snake
      const head = { x: state.snake[0].x + state.direction.x, y: state.snake[0].y + state.direction.y };

      // Check collision with walls
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        state.gameOver = true;
      }

      // Check collision with self
      if (state.snake.some((segment) => segment.x === head.x && segment.y === head.y)) {
        state.gameOver = true;
      }

      if (state.gameOver) {
        setGameActive(false);
        saveHighScore(state.score);
        setStatus({ msg: `Game Over! Final Score: ${state.score}`, type: "err" });
        stopLoopRef.current?.();
        return;
      }

      state.snake.unshift(head);

      // Check if food is eaten
      if (head.x === state.food.x && head.y === state.food.y) {
        state.score += 10;
        setScore(state.score);
        state.food = {
          x: Math.floor(Math.random() * GRID_SIZE),
          y: Math.floor(Math.random() * GRID_SIZE),
        };
      } else {
        state.snake.pop();
      }

      draw(state);
    }, 100);

    stopLoopRef.current = () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(gameLoop);
      stopLoopRef.current = null;
    };
  };

  const resetGame = () => {
    stopLoopRef.current?.();
    removePersisted(SAVE_KEY);
    setSavedGame(null);
    setGameActive(false);
    setScore(0);
    setStatus({ msg: "Click START to begin", type: "" });
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-center items-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-green-400">🐍 SNAKE</h2>
        <p className="text-sm text-gray-400 mb-4">Eat food, avoid walls and yourself!</p>
      </div>

      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="border-2 border-green-500 rounded bg-slate-950"
      />

      <div className="flex gap-4 justify-center w-full text-center">
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Score</p>
          <p className="text-lg font-bold text-green-400">{score}</p>
        </div>
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">High Score</p>
          <p className="text-lg font-bold text-emerald-400">{highScore}</p>
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        {savedGame && !gameActive && <ActionBtn onClick={resumeGame}>Resume</ActionBtn>}
        <ActionBtn onClick={startGame} disabled={gameActive}>
          {gameActive ? "Playing..." : savedGame ? "New Game" : "Start Game"}
        </ActionBtn>
        <ActionBtn onClick={resetGame}>Reset</ActionBtn>
      </div>

      <StatusBar status={status} />
    </div>
  );
}
