import { useState, useRef, useEffect } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';

export default function Snake() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [status, setStatus] = useState({ msg: "Click START to begin", type: "" });

  // Load high score from localStorage on mount
  useEffect(() => {
    const savedHighScore = localStorage.getItem('snakeHighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  const saveHighScore = (newScore) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('snakeHighScore', newScore.toString());
    }
  };
  const gameStateRef = useRef({
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 15 },
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    score: 0,
    gameOver: false,
  });

  const GRID_SIZE = 20;
  const CELL_SIZE = 20;

  const startGame = () => {
    setGameActive(true);
    setScore(0);
    setStatus({ msg: "Use arrow keys to move. Don't hit the walls or yourself!", type: "ok" });
    gameStateRef.current = {
      snake: [{ x: 10, y: 10 }],
      food: { x: 15, y: 15 },
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      score: 0,
      gameOver: false,
    };

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
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

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
        window.removeEventListener('keydown', handleKeyDown);
        clearInterval(gameLoop);
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

      // Draw
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
    }, 100);
  };

  const resetGame = () => {
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
        <ActionBtn onClick={startGame} disabled={gameActive}>
          {gameActive ? "Playing..." : "Start Game"}
        </ActionBtn>
        <ActionBtn onClick={resetGame}>Reset</ActionBtn>
      </div>

      <StatusBar status={status} />
    </div>
  );
}
