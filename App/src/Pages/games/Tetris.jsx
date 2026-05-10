import { useState, useRef, useEffect } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';

const TETRIS_BLOCKS = {
  I: {
    pattern: [[1, 1, 1, 1]],
    width: 4,
    height: 1,
  },
  O: {
    pattern: [[1, 1], [1, 1]],
    width: 2,
    height: 2,
  },
  T: {
    pattern: [[0, 1, 0], [1, 1, 1]],
    width: 3,
    height: 2,
  },
  S: {
    pattern: [[0, 1, 1], [1, 1, 0]],
    width: 3,
    height: 2,
  },
  Z: {
    pattern: [[1, 1, 0], [0, 1, 1]],
    width: 3,
    height: 2,
  },
  J: {
    pattern: [[1, 0, 0], [1, 1, 1]],
    width: 3,
    height: 2,
  },
  L: {
    pattern: [[0, 0, 1], [1, 1, 1]],
    width: 3,
    height: 2,
  },
};

const GRID_WIDTH = 12;
const GRID_HEIGHT = 30;
const CELL_SIZE = 15;

export default function Tetris() {
  const canvasRef = useRef(null);
  const nextCanvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameActive, setGameActive] = useState(false);
  const [status, setStatus] = useState({ msg: "Click START to begin", type: "" });
  const [nextBlock, setNextBlock] = useState(null);
  const gameSpeedRef = useRef(500);

  const gameStateRef = useRef({
    grid: Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null)),
    currentBlock: null,
    nextBlock: null,
    currentX: 0,
    currentY: 0,
    score: 0,
    level: 1,
    linesCleared: 0,
    gameOver: false,
    gameSpeed: 500,
  });

  // Load high score from localStorage on mount
  useEffect(() => {
    const savedHighScore = localStorage.getItem('tetrisHighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  const saveHighScore = (newScore) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('tetrisHighScore', newScore.toString());
    }
  };

  const getRandomBlock = () => {
    const blockTypes = Object.keys(TETRIS_BLOCKS);
    const type = blockTypes[Math.floor(Math.random() * blockTypes.length)];
    return { ...TETRIS_BLOCKS[type], type };
  };

  const canBlockMove = (x, y, block) => {
    for (let row = 0; row < block.pattern.length; row++) {
      for (let col = 0; col < block.pattern[row].length; col++) {
        if (block.pattern[row][col]) {
          const gridX = x + col;
          const gridY = y + row;

          if (gridX < 0 || gridX >= GRID_WIDTH || gridY >= GRID_HEIGHT) {
            return false;
          }

          if (gridY >= 0 && gameStateRef.current.grid[gridY][gridX] !== null) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const placeBlock = (x, y, block) => {
    const state = gameStateRef.current;
    for (let row = 0; row < block.pattern.length; row++) {
      for (let col = 0; col < block.pattern[row].length; col++) {
        if (block.pattern[row][col]) {
          const gridX = x + col;
          const gridY = y + row;
          if (gridY >= 0) {
            state.grid[gridY][gridX] = 1;
          }
        }
      }
    }
  };

  const checkLines = () => {
    const state = gameStateRef.current;
    const linesToClear = [];

    for (let row = 0; row < GRID_HEIGHT; row++) {
      if (state.grid[row].every(cell => cell !== null)) {
        linesToClear.push(row);
      }
    }

    if (linesToClear.length > 0) {
      linesToClear.forEach(row => {
        state.grid.splice(row, 1);
        state.grid.unshift(Array(GRID_WIDTH).fill(null));
      });

      const points = [40, 100, 300, 1200][linesToClear.length - 1] || 1200;
      state.score += points * state.level;
      state.linesCleared += linesToClear.length;
      state.level = 1 + Math.floor(state.linesCleared / 10);
      state.gameSpeed = Math.max(100, 500 - state.level * 30);
      gameSpeedRef.current = state.gameSpeed;
      setLevel(state.level);

      return true;
    }
    return false;
  };

  const drawGame = (state) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid background with 1990s style
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(0, 0, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);

    // Draw grid lines (subtle, 1990s style)
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_WIDTH; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
      ctx.stroke();
    }
    for (let i = 0; i <= GRID_HEIGHT; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(GRID_WIDTH * CELL_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw placed blocks
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_WIDTH; col++) {
        if (state.grid[row][col]) {
          // Draw green border with dot (retro style)
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 1;
          ctx.strokeRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          // Draw dot in middle
          const centerX = col * CELL_SIZE + CELL_SIZE / 2;
          const centerY = row * CELL_SIZE + CELL_SIZE / 2;
          ctx.fillStyle = '#00FF00';
          ctx.beginPath();
          ctx.arc(centerX, centerY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw current block
    if (state.currentBlock) {
      for (let row = 0; row < state.currentBlock.pattern.length; row++) {
        for (let col = 0; col < state.currentBlock.pattern[row].length; col++) {
          if (state.currentBlock.pattern[row][col]) {
            const x = state.currentX + col;
            const y = state.currentY + row;
            if (y >= 0) {
              // Draw green border with dot (retro style)
              ctx.strokeStyle = '#00FF00';
              ctx.lineWidth = 1;
              ctx.strokeRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
              // Draw dot in middle
              const centerX = x * CELL_SIZE + CELL_SIZE / 2;
              const centerY = y * CELL_SIZE + CELL_SIZE / 2;
              ctx.fillStyle = '#00FF00';
              ctx.beginPath();
              ctx.arc(centerX, centerY, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    // Draw border (1990s arcade style)
    ctx.strokeStyle = '#00F0F0';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
  };

  const drawNextBlock = () => {
    const canvas = nextCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (nextBlock) {
      const offsetX = (canvas.width / 2 - (nextBlock.width * CELL_SIZE) / 2) / CELL_SIZE;
      const offsetY = (canvas.height / 2 - (nextBlock.height * CELL_SIZE) / 2) / CELL_SIZE;

      for (let row = 0; row < nextBlock.pattern.length; row++) {
        for (let col = 0; col < nextBlock.pattern[row].length; col++) {
          if (nextBlock.pattern[row][col]) {
            const x = (offsetX + col) * CELL_SIZE;
            const y = (offsetY + row) * CELL_SIZE;
            // Draw green border with dot (retro style)
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
            // Draw dot in middle
            const centerX = x + CELL_SIZE / 2;
            const centerY = y + CELL_SIZE / 2;
            ctx.fillStyle = '#00FF00';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    ctx.strokeStyle = '#00F0F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  };

  const startGame = () => {
    setGameActive(true);
    setScore(0);
    setLevel(1);
    setStatus({ msg: "Use arrow keys to move, Z/X to rotate. Space to drop!", type: "ok" });

    const initialBlock = getRandomBlock();
    const nextBlockToDraw = getRandomBlock();

    gameStateRef.current = {
      grid: Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null)),
      currentBlock: initialBlock,
      nextBlock: nextBlockToDraw,
      currentX: Math.floor(GRID_WIDTH / 2) - 2,
      currentY: 0,
      score: 0,
      level: 1,
      linesCleared: 0,
      gameOver: false,
      gameSpeed: 500,
    };

    gameSpeedRef.current = 500;
    setNextBlock(nextBlockToDraw);

    // Draw initial game state
    if (canvasRef.current) {
      drawGame(gameStateRef.current);
      drawNextBlock();
    }

    const handleKeyDown = (e) => {
      const state = gameStateRef.current;
      if (state.gameOver) return;

      if (e.key === 'ArrowLeft' && canBlockMove(state.currentX - 1, state.currentY, state.currentBlock)) {
        state.currentX--;
      }
      if (e.key === 'ArrowRight' && canBlockMove(state.currentX + 1, state.currentY, state.currentBlock)) {
        state.currentX++;
      }
      if (e.key === 'ArrowDown' && canBlockMove(state.currentX, state.currentY + 1, state.currentBlock)) {
        state.currentY++;
        state.score += 1;
      }
      if (e.key === ' ') {
        e.preventDefault();
        while (canBlockMove(state.currentX, state.currentY + 1, state.currentBlock)) {
          state.currentY++;
          state.score += 2;
        }
      }
      if ((e.key === 'z' || e.key === 'Z')) {
        rotateBlock(state.currentBlock, -1);
      }
      if ((e.key === 'x' || e.key === 'X')) {
        rotateBlock(state.currentBlock, 1);
      }
      drawGame(state);
    };

    const rotateBlock = (block, direction) => {
      const state = gameStateRef.current;
      const { pattern } = block;
      const newPattern = [];

      if (direction > 0) {
        for (let col = 0; col < pattern[0].length; col++) {
          const row = [];
          for (let r = pattern.length - 1; r >= 0; r--) {
            row.push(pattern[r][col]);
          }
          newPattern.push(row);
        }
      } else {
        for (let col = pattern[0].length - 1; col >= 0; col--) {
          const row = [];
          for (let r = 0; r < pattern.length; r++) {
            row.push(pattern[r][col]);
          }
          newPattern.push(row);
        }
      }

      const tempPattern = block.pattern;
      const tempWidth = block.width;
      const tempHeight = block.height;

      block.pattern = newPattern;
      block.width = tempHeight;
      block.height = tempWidth;

      if (!canBlockMove(state.currentX, state.currentY, block)) {
        block.pattern = tempPattern;
        block.width = tempWidth;
        block.height = tempHeight;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const gameLoop = setInterval(() => {
      const state = gameStateRef.current;

      if (canBlockMove(state.currentX, state.currentY + 1, state.currentBlock)) {
        state.currentY++;
      } else {
        placeBlock(state.currentX, state.currentY, state.currentBlock);
        checkLines();
        setScore(state.score);

        state.currentBlock = state.nextBlock;
        state.nextBlock = getRandomBlock();
        state.currentX = Math.floor(GRID_WIDTH / 2) - 2;
        state.currentY = 0;

        setNextBlock(state.nextBlock);

        if (!canBlockMove(state.currentX, state.currentY, state.currentBlock)) {
          state.gameOver = true;
          setGameActive(false);
          saveHighScore(state.score);
          setStatus({ msg: `Game Over! Final Score: ${state.score}`, type: "err" });
          window.removeEventListener('keydown', handleKeyDown);
          clearInterval(gameLoop);
          return;
        }
      }

      drawGame(state);
      drawNextBlock();
    }, gameSpeedRef.current);
  };

  const resetGame = () => {
    setGameActive(false);
    setScore(0);
    setLevel(1);
    setStatus({ msg: "Click START to begin", type: "" });
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-center items-center mt-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-cyan-400 mb-2">TETRIS</h2>
      </div>

      <div className="flex gap-8 items-start">
        <div>
          <canvas
            ref={canvasRef}
            width={GRID_WIDTH * CELL_SIZE}
            height={GRID_HEIGHT * CELL_SIZE}
            className="border-4 border-cyan-400 bg-slate-950 shadow-lg"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 text-white font-mono">
            <div className="text-center border-2 border-cyan-400 p-3 bg-slate-900/50">
              <div className="text-yellow-300 text-sm">SCORE</div>
              <div className="text-2xl font-bold text-cyan-400">{score}</div>
            </div>
            <div className="text-center border-2 border-cyan-400 p-3 bg-slate-900/50">
              <div className="text-yellow-300 text-sm">LEVEL</div>
              <div className="text-2xl font-bold text-cyan-400">{level}</div>
            </div>
            <div className="text-center border-2 border-cyan-400 p-3 bg-slate-900/50">
              <div className="text-yellow-300 text-sm">HIGH SCORE</div>
              <div className="text-2xl font-bold text-cyan-400">{highScore}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <ActionBtn onClick={startGame} disabled={gameActive} className="bg-cyan-500 hover:bg-cyan-400">
          {gameActive ? '▶ PLAYING' : '▶ START'}
        </ActionBtn>
        <ActionBtn onClick={resetGame} className="bg-red-500 hover:bg-red-400">
          ■ RESET
        </ActionBtn>
      </div>

      <StatusBar status={status} />

      <div className="text-center text-gray-400 text-sm max-w-md mt-4">
        <p>← → Move | ↓ Soft Drop | SPACE Hard Drop | Z/X Rotate</p>
      </div>
    </div>
  );
}
