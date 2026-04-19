import { useState, useEffect } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';

export default function MemoryMatch() {
  const EMOJIS = ['🚀', '🎮', '🍕', '🎸', '🏀', '🎨', '🌙', '⚡', '🔥', '❄️', '🌊', '🎪'];

  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [bestMoves, setBestMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [status, setStatus] = useState({ msg: "Click cards to find matching pairs", type: "" });

  useEffect(() => {
    initGame();
  }, []);

  // Load best moves from localStorage on mount
  useEffect(() => {
    const savedBestMoves = localStorage.getItem('memorymatchBestMoves');
    if (savedBestMoves) {
      setBestMoves(parseInt(savedBestMoves, 10));
    }
  }, []);

  useEffect(() => {
    if (matched.length === EMOJIS.length * 2) {
      setGameWon(true);
      // Save best moves
      if (bestMoves === 0 || moves < bestMoves) {
        setBestMoves(moves);
        localStorage.setItem('memorymatchBestMoves', moves.toString());
      }
      setStatus({ msg: `✓ You won! Moves: ${moves}`, type: 'ok' });
    }
  }, [matched, moves, bestMoves]);

  const initGame = () => {
    const shuffled = [...EMOJIS, ...EMOJIS].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setGameWon(false);
    setStatus({ msg: "Click cards to find matching pairs", type: "" });
  };

  const handleClick = (index) => {
    if (gameWon || matched.includes(index) || flipped.includes(index)) return;

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped;
      if (cards[first] === cards[second]) {
        setMatched([...matched, first, second]);
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 600);
      }
      setMoves(moves + 1);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-center items-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-pink-400">🧠 MEMORY MATCH</h2>
        <p className="text-sm text-gray-400 mb-4">Find all matching pairs!</p>
      </div>

      <div className="flex gap-4 justify-center w-full text-center mb-2">
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Moves</p>
          <p className="text-lg font-bold text-pink-400">{moves}</p>
        </div>
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Best</p>
          <p className="text-lg font-bold text-emerald-400">{bestMoves > 0 ? bestMoves : '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-4">
        {cards.map((emoji, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(idx)}
            className={`w-16 h-16 rounded-lg font-bold text-2xl transition-all transform ${
              flipped.includes(idx) || matched.includes(idx)
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-600 hover:bg-slate-500'
            }`}
            disabled={matched.includes(idx)}
          >
            {flipped.includes(idx) || matched.includes(idx) ? emoji : '?'}
          </button>
        ))}
      </div>

      <ActionBtn onClick={initGame}>New Game</ActionBtn>

      <StatusBar status={status} />
    </div>
  );
}
