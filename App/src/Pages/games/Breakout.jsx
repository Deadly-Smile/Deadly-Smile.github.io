import { useState, useRef, useEffect } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';

export default function Breakout() {
  const canvasRef = useRef(null);
  const [gameActive, setGameActive] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState({ msg: "Click START to begin", type: "" });
  const gameStateRef = useRef({
    score: 0,
    level: 1,
    bricksDestroyed: 0,
  });

  const initGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    return {
      canvas,
      ctx: canvas.getContext('2d'),
      ball: { x: canvas.width / 2, y: canvas.height - 60, dx: 4, dy: -4, radius: 5 },
      paddle: { x: canvas.width / 2 - 40, y: canvas.height - 20, width: 80, height: 10, dx: 0 },
      bricks: generateBricks(gameStateRef.current.level),
      keys: {},
      gameOver: false,
      won: false,
    };
  };

  const generateBricks = (lvl) => {
    const bricks = [];
    const cols = 8;
    const rows = 3 + Math.min(lvl - 1, 3);
    const brickWidth = 65;
    const brickHeight = 12;
    const padding = 5;
    const offsetTop = 40;
    const offsetLeft = 8;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = offsetLeft + c * (brickWidth + padding);
        const y = offsetTop + r * (brickHeight + padding);
        bricks.push({
          x,
          y,
          width: brickWidth,
          height: brickHeight,
          active: true,
          color: `hsl(${(r * 60 + c * 30) % 360}, 70%, 50%)`,
        });
      }
    }
    return bricks;
  };

  const drawGame = (state) => {
    const { ctx, canvas, ball, paddle, bricks } = state;
    
    // Clear canvas
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Draw bricks
    bricks.forEach((brick) => {
      if (brick.active) {
        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
      }
    });

    // Draw paddle
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.strokeRect(paddle.x, paddle.y, paddle.width, paddle.height);

    // Draw ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const updateGame = (state) => {
    const { canvas, ball, paddle, bricks, keys } = state;

    // Move paddle
    if (keys['ArrowLeft'] && paddle.x > 0) paddle.x -= 7;
    if (keys['ArrowRight'] && paddle.x < canvas.width - paddle.width) paddle.x += 7;

    // Move ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collision
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
      ball.dx *= -1;
      ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x));
    }

    if (ball.y - ball.radius < 0) {
      ball.dy *= -1;
      ball.y = Math.max(ball.radius, ball.y);
    }

    // Paddle collision
    if (
      ball.y + ball.radius >= paddle.y &&
      ball.y - ball.radius <= paddle.y + paddle.height &&
      ball.x >= paddle.x &&
      ball.x <= paddle.x + paddle.width &&
      ball.dy > 0
    ) {
      ball.dy *= -1;
      const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
      ball.dx += hitPos * 3;
      ball.y = paddle.y - ball.radius;
    }

    // Brick collision
    bricks.forEach((brick) => {
      if (
        brick.active &&
        ball.x > brick.x &&
        ball.x < brick.x + brick.width &&
        ball.y > brick.y &&
        ball.y < brick.y + brick.height
      ) {
        brick.active = false;
        ball.dy *= -1;
        gameStateRef.current.score += 10 * gameStateRef.current.level;
        gameStateRef.current.bricksDestroyed += 1;
      }
    });

    // Game over - ball fell
    if (ball.y - ball.radius > canvas.height) {
      state.gameOver = true;
    }

    // Win condition - all bricks destroyed
    if (bricks.every((b) => !b.active)) {
      state.won = true;
    }

    // Speed increase with level
    const speed = 5 + gameStateRef.current.level;
    const ballSpeed = Math.sqrt(ball.dx ** 2 + ball.dy ** 2);
    if (ballSpeed < speed) {
      const scale = speed / ballSpeed;
      ball.dx *= scale;
      ball.dy *= scale;
    }
  };

  const startGame = () => {
    setGameActive(true);
    setScore(0);
    setLevel(1);
    gameStateRef.current = { score: 0, level: 1, bricksDestroyed: 0 };
    setStatus({ msg: "Game started! Use arrows to move.", type: "ok" });
    const state = initGame();

    const handleKeyDown = (e) => {
      state.keys[e.key] = true;
    };

    const handleKeyUp = (e) => {
      state.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const gameLoop = () => {
      if (state.gameOver) {
        setGameActive(false);
        setStatus({ msg: `Game Over! Final Score: ${gameStateRef.current.score}`, type: "err" });
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        return;
      }

      if (state.won) {
        gameStateRef.current.level += 1;
        setLevel(gameStateRef.current.level);
        setStatus({ msg: `✓ Level ${gameStateRef.current.level - 1} Complete! Next level...`, type: "ok" });
        state.bricks = generateBricks(gameStateRef.current.level);
        state.ball = { x: state.canvas.width / 2, y: state.canvas.height - 60, dx: 4, dy: -4, radius: 5 };
        state.gameOver = false;
        state.won = false;
      }

      updateGame(state);
      drawGame(state);
      setScore(gameStateRef.current.score);
      setLevel(gameStateRef.current.level);

      requestAnimationFrame(gameLoop);
    };

    gameLoop();
  };

  const resetGame = () => {
    setGameActive(false);
    setScore(0);
    setLevel(1);
    gameStateRef.current = { score: 0, level: 1, bricksDestroyed: 0 };
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setStatus({ msg: "Game reset. Click START to begin", type: "" });
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-center items-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-blue-400">🎮 BREAKOUT</h2>
        <p className="text-sm text-gray-400 mb-4">
          Break all bricks before the ball falls! Use arrow keys to move the paddle.
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={580}
        height={340}
        className="border-2 border-indigo-500 rounded bg-slate-950"
      />

      <div className="flex gap-4 justify-center w-full text-center">
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Level</p>
          <p className="text-lg font-bold text-blue-400">{level}</p>
        </div>
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Score</p>
          <p className="text-lg font-bold text-yellow-400">{score}</p>
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        <ActionBtn
          onClick={startGame}
          disabled={gameActive}
        >
          {gameActive ? "Playing..." : "Start Game"}
        </ActionBtn>
        <ActionBtn onClick={resetGame}>
          Reset
        </ActionBtn>
      </div>

      <StatusBar status={status} />
    </div>
  );
}
