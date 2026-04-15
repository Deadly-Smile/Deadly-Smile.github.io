import { useState, useRef, useEffect } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';

export default function FlappyBird() {
  const canvasRef = useRef(null);
  const [gameActive, setGameActive] = useState(false);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState({ msg: "Click or press SPACE to flap", type: "" });
  const gameStateRef = useRef({
    bird: { x: 50, y: 150, width: 20, height: 20, velocity: 0 },
    pipes: [],
    score: 0,
    gameOver: false,
  });

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 500;
  const PIPE_WIDTH = 60;
  const PIPE_GAP = 120;
  const GRAVITY = 0.5;
  const FLAP_STRENGTH = -12;

  const startGame = () => {
    setGameActive(true);
    setScore(0);
    setStatus({ msg: "Avoid the pipes!", type: "ok" });
    gameStateRef.current = {
      bird: { x: 50, y: 150, width: 20, height: 20, velocity: 0 },
      pipes: [],
      score: 0,
      gameOver: false,
    };

    const handleFlap = () => {
      if (gameStateRef.current.gameOver) return;
      gameStateRef.current.bird.velocity = FLAP_STRENGTH;
    };

    window.addEventListener('click', handleFlap);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleFlap();
      }
    });

    let pipeCounter = 0;
    const gameLoop = setInterval(() => {
      const state = gameStateRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      // Apply gravity
      state.bird.velocity += GRAVITY;
      state.bird.y += state.bird.velocity;

      // Generate pipes
      pipeCounter++;
      if (pipeCounter % 80 === 0) {
        const gapStart = Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 40) + 20;
        state.pipes.push({
          x: CANVAS_WIDTH,
          gapStart: gapStart,
          gapEnd: gapStart + PIPE_GAP,
          width: PIPE_WIDTH,
        });
      }

      // Move pipes
      state.pipes = state.pipes.filter((pipe) => {
        pipe.x -= 5;
        return pipe.x + pipe.width > 0;
      });

      // Check collision with pipes
      state.pipes.forEach((pipe) => {
        const birdLeft = state.bird.x;
        const birdRight = state.bird.x + state.bird.width;
        const birdTop = state.bird.y;
        const birdBottom = state.bird.y + state.bird.height;

        if (
          birdRight > pipe.x &&
          birdLeft < pipe.x + pipe.width &&
          (birdTop < pipe.gapStart || birdBottom > pipe.gapEnd)
        ) {
          state.gameOver = true;
        }

        // Score when passing pipe
        if (pipe.x + pipe.width < state.bird.x && !pipe.scored) {
          pipe.scored = true;
          state.score += 1;
          setScore(state.score);
        }
      });

      // Check collision with ceiling/ground
      if (state.bird.y < 0 || state.bird.y + state.bird.height > CANVAS_HEIGHT) {
        state.gameOver = true;
      }

      if (state.gameOver) {
        setGameActive(false);
        setStatus({ msg: `Game Over! Score: ${state.score}`, type: 'err' });
        window.removeEventListener('click', handleFlap);
        clearInterval(gameLoop);
        return;
      }

      // Draw
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw pipes
      ctx.fillStyle = '#10b981';
      state.pipes.forEach((pipe) => {
        // Top pipe
        ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapStart);
        // Bottom pipe
        ctx.fillRect(pipe.x, pipe.gapEnd, pipe.width, CANVAS_HEIGHT - pipe.gapEnd);
      });

      // Draw bird
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(state.bird.x + state.bird.width / 2, state.bird.y + state.bird.height / 2, state.bird.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw score
      ctx.fillStyle = '#fff';
      ctx.font = '24px Arial';
      ctx.fillText(`Score: ${state.score}`, 20, 40);
    }, 30);
  };

  const resetGame = () => {
    setGameActive(false);
    setScore(0);
    setStatus({ msg: "Click or press SPACE to flap", type: "" });
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-center items-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-yellow-400">🐦 FLAPPY BIRD</h2>
        <p className="text-sm text-gray-400 mb-4">Avoid the pipes! Click or press SPACE to flap</p>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-yellow-500 rounded bg-slate-950 cursor-pointer"
      />

      <div className="flex gap-4 justify-center w-full text-center">
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Score</p>
          <p className="text-lg font-bold text-yellow-400">{score}</p>
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
