import { useState } from 'react';
import { ActionBtn, StatusBar } from '../tools/tk-shared';

export default function Hangman() {
  const WORDS = ['JAVASCRIPT', 'PYTHON', 'REACT', 'DEVELOPER', 'PROGRAMMING', 'COMPUTER', 'ALGORITHM', 'DATABASE', 'NETWORK', 'BROWSER', 'CONSOLE', 'FUNCTION', 'VARIABLE', 'CONSTANT', 'OBJECT', 'ARRAY', 'STRING', 'NUMBER', 'BOOLEAN', 'INFINITY', 'TYPESCRIPT', 'FRAMEWORK', 'COMPONENT', 'INTERFACE', 'MODULE', 'PACKAGE', 'LIBRARY', 'REPOSITORY', 'COMMIT', 'BRANCH', 'MERGE', 'SYNTAX', 'COMPILER', 'DEBUGGER', 'ASYNC', 'PROMISE', 'CALLBACK', 'CLOSURE', 'PROTOTYPE', 'INHERITANCE', 'ENCAPSULATION', 'POLYMORPHISM', 'ABSTRACTION', 'EXCEPTION', 'ITERATION', 'RECURSION', 'PARAMETER', 'ARGUMENT', 'OPERATOR', 'EXPRESSION', 'STATEMENT', 'DECLARATION', 'ASSIGNMENT', 'INITIALIZER', 'VALIDATION', 'SANITIZATION', 'ENCRYPTION', 'COMPRESSION', 'OPTIMIZATION', 'REFACTORING', 'TESTING', 'DEPLOYMENT', 'KUBERNETES', 'DOCKER', 'MICROSERVICE', 'ARCHITECTURE', 'SCALABILITY', 'PERFORMANCE', 'SECURITY'];
  
  const [word, setWord] = useState(WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [guesses, setGuesses] = useState([]);
  const [wrong, setWrong] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [status, setStatus] = useState({ msg: "Guess letters to reveal the word", type: "" });

  const MAX_WRONG = 6;
  const revealed = word.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ');
  const wrongLetters = guesses.filter(g => !word.includes(g)).join(', ');
  const isWon = revealed.replace(/\s/g, '') === word;
  const isLost = wrong >= MAX_WRONG;

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
    setStatus({ msg: "Guess letters to reveal the word", type: "" });
  };

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-center items-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 text-purple-400">🎯 HANGMAN</h2>
        <p className="text-sm text-gray-400 mb-4">Guess the word before running out of lives!</p>
      </div>

      <div className="text-4xl font-bold tracking-widest text-blue-400 mb-4 font-mono">
        {revealed}
      </div>

      <div className="flex gap-4 justify-center text-center">
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Wrong</p>
          <p className="text-lg font-bold text-red-400">{wrong}/{MAX_WRONG}</p>
        </div>
        <div className="bg-slate-800 p-2 rounded px-4">
          <p className="text-xs text-gray-400">Guessed</p>
          <p className="text-lg font-bold text-yellow-400">{guesses.length}</p>
        </div>
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

      <StatusBar status={status} />
    </div>
  );
}
