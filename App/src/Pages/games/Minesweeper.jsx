import { useState, useRef, useEffect } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';

export default function Minesweeper() {
  const [difficulty, setDifficulty] = useState('easy');
  const [board, setBoard] = useState(null);
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [time, setTime] = useState(0);
  const [bestTime, setBestTime] = useState({});
  const [status, setStatus] = useState({ msg: "Select difficulty and click START", type: "" });
  const timerRef = useRef(null);

  // Load best times from localStorage on mount
  useEffect(() => {
    const savedBestTimes = localStorage.getItem('minesweeperBestTimes');
    if (savedBestTimes) {
      setBestTime(JSON.parse(savedBestTimes));
    }
  }, []);

  const saveBestTime = (difficulty, newTime) => {
    const currentBest = bestTime[difficulty] || Infinity;
    if (newTime < currentBest) {
      const updatedBestTimes = { ...bestTime, [difficulty]: newTime };
      setBestTime(updatedBestTimes);
      localStorage.setItem('minesweeperBestTimes', JSON.stringify(updatedBestTimes));
    }
  };

  const DIFFICULTIES = {
    easy: { rows: 8, cols: 8, mines: 10, label: 'Easy' },
    medium: { rows: 12, cols: 12, mines: 30, label: 'Medium' },
    hard: { rows: 16, cols: 16, mines: 60, label: 'Hard' },
    expert: { rows: 16, cols: 30, mines: 99, label: 'Expert' },
  };

  const initBoard = () => {
    const config = DIFFICULTIES[difficulty];
    const { rows, cols, mines } = config;
    const newBoard = Array(rows)
      .fill(null)
      .map(() =>
        Array(cols)
          .fill(null)
          .map(() => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
      );

    // Place mines randomly
    let placedMines = 0;
    while (placedMines < mines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (!newBoard[r][c].mine) {
        newBoard[r][c].mine = true;
        placedMines++;
      }
    }

    // Calculate adjacent mine counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!newBoard[r][c].mine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newBoard[nr][nc].mine) {
                count++;
              }
            }
          }
          newBoard[r][c].adjacent = count;
        }
      }
    }

    return newBoard;
  };

  const revealCell = (boardState, r, c) => {
    const config = DIFFICULTIES[difficulty];
    const { rows, cols } = config;

    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    if (boardState[r][c].revealed || boardState[r][c].flagged) return;

    const cell = boardState[r][c];

    if (cell.mine) {
      // Hit a mine - game over
      boardState[r][c].revealed = true;
      return 'lose';
    }

    boardState[r][c].revealed = true;

    if (cell.adjacent === 0) {
      // Flood fill if no adjacent mines
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) {
            revealCell(boardState, r + dr, c + dc);
          }
        }
      }
    }

    return 'continue';
  };

  const checkWin = (boardState) => {
    const config = DIFFICULTIES[difficulty];
    const { rows, cols } = config;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!boardState[r][c].mine && !boardState[r][c].revealed) {
          return false;
        }
      }
    }
    return true;
  };

  const handleLeftClick = (r, c) => {
    if (!gameActive || gameOver || won) return;

    const newBoard = board.map((row) => [...row]);
    const result = revealCell(newBoard, r, c);

    if (result === 'lose') {
      setGameActive(false);
      setGameOver(true);
      setStatus({ msg: '💣 Hit a mine! Game Over!', type: 'err' });
      clearInterval(timerRef.current);
      // Reveal all mines
      const config = DIFFICULTIES[difficulty];
      for (let i = 0; i < config.rows; i++) {
        for (let j = 0; j < config.cols; j++) {
          if (newBoard[i][j].mine) newBoard[i][j].revealed = true;
        }
      }
    } else if (checkWin(newBoard)) {
      setGameActive(false);
      setWon(true);
      saveBestTime(difficulty, time);
      setStatus({ msg: `✓ You won! Time: ${time}s`, type: 'ok' });
      clearInterval(timerRef.current);
    }

    setBoard(newBoard);
  };

  const handleRightClick = (e, r, c) => {
    e.preventDefault();
    if (!gameActive || gameOver || won) return;
    if (board[r][c].revealed) return;

    const newBoard = board.map((row) => [...row]);
    newBoard[r][c].flagged = !newBoard[r][c].flagged;
    setBoard(newBoard);
  };

  const startGame = () => {
    const newBoard = initBoard();
    setBoard(newBoard);
    setGameActive(true);
    setGameOver(false);
    setWon(false);
    setTime(0);
    setStatus({ msg: 'Game started! Left-click to reveal, right-click to flag.', type: 'ok' });

    timerRef.current = setInterval(() => {
      setTime((t) => t + 1);
    }, 1000);
  };

  const resetGame = () => {
    clearInterval(timerRef.current);
    setBoard(null);
    setGameActive(false);
    setGameOver(false);
    setWon(false);
    setTime(0);
    setStatus({ msg: 'Select difficulty and click START', type: '' });
  };

  const config = DIFFICULTIES[difficulty];
  const config2 = board ? DIFFICULTIES[difficulty] : null;

  const flaggedCount = board ? board.flat().filter((c) => c.flagged).length : 0;
  const minesCount = config2 ? config2.mines : 0;

  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-center items-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-blue-400">💣 MINESWEEPER</h2>
        <p className="text-sm text-gray-400 mb-4">
          Left-click to reveal, right-click to flag mines. Avoid the explosions!
        </p>
      </div>

      {!gameActive && !gameOver && !won && (
        <div className="flex gap-3 flex-wrap justify-center">
          {Object.entries(DIFFICULTIES).map(([key, diff]) => (
            <button
              key={key}
              onClick={() => setDifficulty(key)}
              className={`px-4 py-2 rounded font-semibold transition-all ${
                difficulty === key
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              {diff.label}
            </button>
          ))}
        </div>
      )}

      {board && (
        <div className="flex gap-3 justify-center items-center mb-2">
          <div className="bg-slate-800 px-3 py-1 rounded text-center">
            <p className="text-xs text-gray-400">Mines</p>
            <p className="text-lg font-bold text-red-400">{minesCount - flaggedCount}</p>
          </div>
          <div className="bg-slate-800 px-3 py-1 rounded text-center">
            <p className="text-xs text-gray-400">Flags</p>
            <p className="text-lg font-bold text-yellow-400">{flaggedCount}</p>
          </div>
          <div className="bg-slate-800 px-3 py-1 rounded text-center">
            <p className="text-xs text-gray-400">Time</p>
            <p className="text-lg font-bold text-blue-400">{time}s</p>
          </div>
          <div className="bg-slate-800 px-3 py-1 rounded text-center">
            <p className="text-xs text-gray-400">Best</p>
            <p className="text-lg font-bold text-emerald-400">{bestTime[difficulty] ? `${bestTime[difficulty]}s` : '-'}</p>
          </div>
        </div>
      )}

      {board && (
        <div
          className="overflow-auto border-2 border-indigo-500 rounded bg-slate-950"
          style={{ maxHeight: '400px', maxWidth: '600px' }}
        >
          <div className="inline-block">
            {board.map((row, r) => (
              <div key={r} className="flex">
                {row.map((cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    onContextMenu={(e) => handleRightClick(e, r, c)}
                    onClick={() => handleLeftClick(r, c)}
                    className={`
                      w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer border border-slate-600
                      transition-all select-none
                      ${
                        cell.revealed
                          ? cell.mine
                            ? 'bg-red-600 text-white'
                            : cell.adjacent === 0
                            ? 'bg-slate-700 text-gray-400'
                            : 'bg-slate-700 text-blue-300'
                          : 'bg-slate-500 hover:bg-slate-400'
                      }
                    `}
                    title={`Row ${r + 1}, Col ${c + 1}`}
                  >
                    {cell.flagged && !cell.revealed && '🚩'}
                    {cell.revealed && cell.mine && '💣'}
                    {cell.revealed && !cell.mine && cell.adjacent > 0 && cell.adjacent}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-center">
        <ActionBtn
          onClick={startGame}
          disabled={gameActive}
        >
          {gameActive ? 'Playing...' : 'Start Game'}
        </ActionBtn>
        <ActionBtn onClick={resetGame}>
          Reset
        </ActionBtn>
      </div>

      <StatusBar status={status} />
    </div>
  );
}
