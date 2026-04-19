import { useState, useEffect } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';

export default function Hangman() {
  const WORDS = ['JAVASCRIPT', 'PYTHON', 'REACT', 'DEVELOPER', 'PROGRAMMING', 'COMPUTER', 'ALGORITHM', 'DATABASE', 'NETWORK', 'BROWSER', 'CONSOLE', 'FUNCTION', 'VARIABLE', 'CONSTANT', 'OBJECT', 'ARRAY', 'STRING', 'NUMBER', 'BOOLEAN', 'INFINITY', 'TYPESCRIPT', 'FRAMEWORK', 'COMPONENT', 'INTERFACE', 'MODULE', 'PACKAGE', 'LIBRARY', 'REPOSITORY', 'COMMIT', 'BRANCH', 'MERGE', 'SYNTAX', 'COMPILER', 'DEBUGGER', 'ASYNC', 'PROMISE', 'CALLBACK', 'CLOSURE', 'PROTOTYPE', 'INHERITANCE', 'ENCAPSULATION', 'POLYMORPHISM', 'ABSTRACTION', 'EXCEPTION', 'ITERATION', 'RECURSION', 'PARAMETER', 'ARGUMENT', 'OPERATOR', 'EXPRESSION', 'STATEMENT', 'DECLARATION', 'ASSIGNMENT', 'INITIALIZER', 'VALIDATION', 'SANITIZATION', 'ENCRYPTION', 'COMPRESSION', 'OPTIMIZATION', 'REFACTORING', 'TESTING', 'DEPLOYMENT', 'KUBERNETES', 'DOCKER', 'MICROSERVICE', 'ARCHITECTURE', 'SCALABILITY', 'PERFORMANCE', 'SECURITY', 'ELEPHANT', 'MOUNTAIN', 'BUTTERFLY', 'TREASURE', 'ADVENTURE', 'LIGHTHOUSE', 'WATERMELON', 'DINOSAUR', 'RAINBOW', 'CHOCOLATE', 'ADVENTURE', 'BIRTHDAY', 'DIAMOND', 'FIREWORKS', 'GUITAR', 'HURRICANE', 'JOURNEY', 'KEYBOARD', 'LANTERN', 'MONOPOLY'];
  
  const [word, setWord] = useState(WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [guesses, setGuesses] = useState([]);
  const [wrong, setWrong] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [status, setStatus] = useState({ msg: "Guess letters to reveal the word", type: "" });
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [highScores, setHighScores] = useState(() => JSON.parse(localStorage.getItem('hangmanScores')) || []);
  const [currentScore, setCurrentScore] = useState(null);

  const MAX_WRONG = 6;
  const revealed = word.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ');
  const wrongLetters = guesses.filter(g => !word.includes(g)).join(', ');
  const isWon = revealed.replace(/\s/g, '') === word;
  const isLost = wrong >= MAX_WRONG;

  // Timer effect
  useEffect(() => {
    if (gameOver || won) return;
    
    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver, won]);

  // Calculate score based on time and difficulty
  const calculateScore = () => {
    const baseScore = 1000;
    const timeBonus = Math.max(0, 300 - timeElapsed) * 2; // Lose points for time
    const wordLengthBonus = word.length * 50;
    const wrongPenalty = wrong * 100;
    return Math.max(100, Math.round(baseScore + timeBonus + wordLengthBonus - wrongPenalty));
  };

  // Save high score when game is won
  useEffect(() => {
    if (won && currentScore === null) {
      const score = calculateScore();
      setCurrentScore(score);
      const newScores = [...highScores, { score, word, timestamp: new Date().toLocaleTimeString(), mistakes: wrong }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Keep top 10 scores
      setHighScores(newScores);
      localStorage.setItem('hangmanScores', JSON.stringify(newScores));
    }
  }, [won]);

  const guessLetter = (letter) => {
    if (gameOver || won || guesses.includes(letter)) return;

    const newGuesses = [...guesses, letter];
    setGuesses(newGuesses);

    if (!word.includes(letter)) {
      const newWrong = wrong + 1;
      setWrong(newWrong);
      if (newWrong >= MAX_WRONG) {
        setGameOver(true);
        setStatus({ msg: `Game Over! The word was: ${word}`, type: 'err' });
      }
    } else if (newGuesses.filter(g => word.includes(g)).length === word.split('').filter((v, i, a) => a.indexOf(v) === i).length) {
      setWon(true);
      setStatus({ msg: `✓ You won! The word was: ${word}`, type: 'ok' });
    }
  };

  const newGame = () => {
    const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    setWord(newWord);
    setGuesses([]);
    setWrong(0);
    setGameOver(false);
    setWon(false);
    setTimeElapsed(0);
    setCurrentScore(null);
    setStatus({ msg: "Guess letters to reveal the word", type: "" });
  };

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const topScore = highScores.length > 0 ? highScores[0].score : 0;
  const isNewRecord = currentScore && topScore > 0 && currentScore >= topScore;

  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-center items-center relative overflow-y-auto">
      {/* Celebration animation */}
      {won && (
        <>
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
            }
            .confetti { animation: confetti-fall 2.5s ease-in forwards; }
          `}</style>
          <div className="fixed inset-0 pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="confetti absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-20px`,
                  width: '10px',
                  height: '10px',
                  background: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94'][Math.floor(Math.random() * 5)],
                  borderRadius: '50%',
                  animationDelay: `${Math.random() * 0.5}s`,
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-purple-400">🎯 HANGMAN</h2>
        <p className="text-sm text-gray-400 mb-4">Guess the word before running out of lives!</p>
      </div>

      {/* Timer and Stats Row */}
      <div className="flex gap-6 justify-center text-center flex-wrap">
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Time</p>
          <p className="text-lg font-bold text-cyan-400">{timeElapsed}s</p>
        </div>
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Wrong</p>
          <p className="text-lg font-bold text-red-400">{wrong}/{MAX_WRONG}</p>
        </div>
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Guessed</p>
          <p className="text-lg font-bold text-yellow-400">{guesses.length}</p>
        </div>
      </div>

      {/* Current and High Score */}
      <div className="flex gap-6 justify-center text-center flex-wrap">
        {currentScore !== null && (
          <div className={`${isNewRecord ? 'bg-green-900' : 'bg-slate-800'} p-3 rounded px-6 border-2 ${isNewRecord ? 'border-yellow-400' : 'border-slate-700'}`}>
            <p className="text-xs text-gray-400">Current Score</p>
            <p className={`text-xl font-bold ${isNewRecord ? 'text-yellow-300' : 'text-green-400'}`}>{currentScore}</p>
            {isNewRecord && <p className="text-xs text-yellow-400">🏆 New Record!</p>}
          </div>
        )}
        {highScores.length > 0 && (
          <div className="bg-slate-800 p-3 rounded px-6">
            <p className="text-xs text-gray-400">High Score</p>
            <p className="text-xl font-bold text-orange-400">{topScore}</p>
          </div>
        )}
      </div>

      <div className="text-4xl font-bold tracking-widest text-blue-400 mb-4 font-mono">
        {revealed}
      </div>

      {wrongLetters && (
        <div className="text-center">
          <p className="text-xs text-gray-400">Wrong Letters</p>
          <p className="text-sm text-red-400 font-mono">{wrongLetters}</p>
        </div>
      )}

      <div className="grid grid-cols-7 gap-2 mb-4">
        {ALPHABET.map((letter) => (
          <button
            key={letter}
            onClick={() => guessLetter(letter)}
            disabled={guesses.includes(letter) || gameOver || won}
            className={`w-10 h-10 rounded font-bold transition-all ${
              guesses.includes(letter)
                ? word.includes(letter)
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-600'
            }`}
          >
            {letter}
          </button>
        ))}
      </div>

      <ActionBtn onClick={newGame}>New Game</ActionBtn>
      {highScores.length > 0 && (
        <div className="mt-4 bg-slate-900 rounded p-4 w-full max-w-sm">
          <h3 className="text-center text-yellow-400 font-bold mb-3">🏆 Top 10 Scores</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {highScores.map((entry, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm bg-slate-800 p-2 rounded">
                <span className="text-gray-400">#{idx + 1}</span>
                <span className="text-cyan-400">{entry.word}</span>
                <span className="text-orange-400 font-bold">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <StatusBar msg={status.msg} type={status.type} />
    </div>
  );
}
