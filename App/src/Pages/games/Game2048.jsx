import { useState, useEffect } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';

export default function Game2048() {
  const [board, setBoard] = useState(initBoard());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [status, setStatus] = useState({ msg: "Use arrow keys to move tiles", type: "" });

  // Load high score from localStorage on mount
  useEffect(() => {
    const savedHighScore = localStorage.getItem('game2048HighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  const saveHighScore = (newScore) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('game2048HighScore', newScore.toString());
    }
  };

  function initBoard() {
    const newBoard = Array(4).fill(null).map(() => Array(4).fill(0));
    addNewTile(newBoard);
    addNewTile(newBoard);
    return newBoard;
  }

  function addNewTile(board) {
    const empty = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (board[i][j] === 0) empty.push([i, j]);
      }
    }
    if (empty.length === 0) return;
    const [x, y] = empty[Math.floor(Math.random() * empty.length)];
    board[x][y] = Math.random() < 0.9 ? 2 : 4;
  }

  function moveBoard(direction) {
    const newBoard = board.map(row => [...row]);
    let moved = false;
    let newScore = score;

    const compress = (arr) => {
      const temp = arr.filter(v => v !== 0);
      return [...Array(4 - temp.length).fill(0), ...temp];
    };

    const merge = (arr) => {
      for (let i = 3; i > 0; i--) {
        if (arr[i] === arr[i - 1] && arr[i] !== 0) {
          arr[i] *= 2;
          newScore += arr[i];
          arr[i - 1] = 0;
        }
      }
      return arr;
    };

    if (direction === 'left' || direction === 'right') {
      for (let i = 0; i < 4; i++) {
        const old = newBoard[i].join('');
        newBoard[i] = direction === 'left' ? compress(merge(compress(newBoard[i]))) : compress(merge(compress(newBoard[i].reverse()))).reverse();
        if (newBoard[i].join('') !== old) moved = true;
      }
    } else {
      for (let j = 0; j < 4; j++) {
        const col = [newBoard[0][j], newBoard[1][j], newBoard[2][j], newBoard[3][j]];
        const old = col.join('');
        const newCol = direction === 'up' ? compress(merge(compress(col))) : compress(merge(compress(col.reverse()))).reverse();
        for (let i = 0; i < 4; i++) newBoard[i][j] = newCol[i];
        if (newCol.join('') !== old) moved = true;
      }
    }

    if (moved) {
      addNewTile(newBoard);
      setBoard(newBoard);
      setScore(newScore);

      // Check for 2048
      if (newBoard.flat().some(v => v === 2048) && !won) {
        setWon(true);
        setStatus({ msg: "✓ You reached 2048!", type: "ok" });
      }

      // Check game over
      const canMove = ['left', 'right', 'up', 'down'].some(dir => {
        const test = newBoard.map(row => [...row]);
        moveBoard(dir); // This is a bit hacky but for simplicity
        return test.flat().join('') !== newBoard.flat().join('');
      });

      if (!canMove && !newBoard.flat().some(v => v === 0)) {
        setGameOver(true);
        saveHighScore(newScore);
        setStatus({ msg: `Game Over! Score: ${newScore}`, type: "err" });
      }
    }

    return moved;
  }

  const handleKeyPress = (e) => {
    if (gameOver && !won) return;
    if (e.key === 'ArrowLeft') moveBoard('left');
    if (e.key === 'ArrowRight') moveBoard('right');
    if (e.key === 'ArrowUp') moveBoard('up');
    if (e.key === 'ArrowDown') moveBoard('down');
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-center items-center" onKeyDown={handleKeyPress} tabIndex="0">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-cyan-400">2048</h2>
        <p className="text-sm text-gray-400 mb-4">Combine tiles to reach 2048!</p>
      </div>

      <div className="flex gap-4 justify-center w-full text-center mb-2">
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Score</p>
          <p className="text-lg font-bold text-cyan-400">{score}</p>
        </div>
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">High Score</p>
          <p className="text-lg font-bold text-emerald-400">{highScore}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 bg-slate-700 p-4 rounded">
        {board.map((row, i) =>
          row.map((cell, j) => (
            <div
              key={`${i}-${j}`}
              className={`w-20 h-20 flex items-center justify-center rounded font-bold text-xl ${
                cell === 0
                  ? 'bg-slate-600 text-slate-600'
                  : cell <= 4
                  ? 'bg-blue-500 text-white'
                  : cell <= 16
                  ? 'bg-purple-500 text-white'
                  : cell <= 128
                  ? 'bg-pink-500 text-white'
                  : cell <= 512
                  ? 'bg-red-500 text-white'
                  : cell <= 2048
                  ? 'bg-yellow-500 text-black'
                  : 'bg-green-500 text-white'
              }`}
            >
              {cell !== 0 && cell}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 justify-center">
        <ActionBtn onClick={() => { saveHighScore(score); setBoard(initBoard()); setScore(0); setGameOver(false); setWon(false); setStatus({ msg: "Game restarted!", type: "" }); }}>
          New Game
        </ActionBtn>
      </div>

      <StatusBar status={status} />
    </div>
  );
}
