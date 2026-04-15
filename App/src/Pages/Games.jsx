import { useState } from "react";
import Breakout from "./games/Breakout";
import Minesweeper from "./games/Minesweeper";
import Snake from "./games/Snake";
import Game2048 from "./games/Game2048";
import Hangman from "./games/Hangman";
import MemoryMatch from "./games/MemoryMatch";
import FlappyBird from "./games/FlappyBird";

const GAMES = [
  { id: "breakout", label: "🎮 BREAKOUT", component: Breakout, desc: "Break bricks and level up!" },
  { id: "minesweeper", label: "💣 MINESWEEPER", component: Minesweeper, desc: "Find all safe cells!" },
  { id: "snake", label: "🐍 SNAKE", component: Snake, desc: "Eat food, avoid yourself!" },
  { id: "2048", label: "2️⃣048", component: Game2048, desc: "Combine tiles to reach 2048" },
  { id: "hangman", label: "🎯 HANGMAN", component: Hangman, desc: "Guess the word" },
  { id: "memory", label: "🧠 MEMORY", component: MemoryMatch, desc: "Find matching pairs" },
  { id: "flappy", label: "🐦 FLAPPY BIRD", component: FlappyBird, desc: "Avoid the pipes" },
];

const Games = () => {
  const [selectedGame, setSelectedGame] = useState(null);

  if (selectedGame) {
    const game = GAMES.find((g) => g.id === selectedGame);
    const GameComponent = game.component;

    return (
      <div className="h-screen flex flex-col bg-slate-900 relative">
        <button
          onClick={() => setSelectedGame(null)}
          className="fixed top-4 left-4 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg z-50"
          title="Back to Games"
        >
          ← Back
        </button>
        <div className="flex-1 overflow-auto">
          <GameComponent />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text mb-3">
            🎮 GAMES
          </h1>
          <p className="text-gray-400 text-lg">Select a game to play</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game.id)}
              className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-slate-750 to-slate-800 border-2 border-indigo-500/30 hover:border-indigo-500 p-6 transition-all hover:shadow-xl hover:shadow-indigo-500/20"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/0 to-indigo-600/0 group-hover:from-indigo-600/10 group-hover:to-indigo-600/10 transition-all" />
              <div className="relative z-10 text-center">
                <div className="text-4xl mb-3">{game.label.split(" ")[0]}</div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {game.label.split(" ").slice(1).join(" ")}
                </h2>
                <div className="h-1 w-12 bg-gradient-to-r from-blue-400 to-cyan-400 rounded mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{game.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-12 bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-3">📋 Available Games ({GAMES.length})</h3>
          <ul className="space-y-2 text-gray-400 grid grid-cols-1 md:grid-cols-2">
            {GAMES.map((game) => (
              <li key={game.id}>
                <span className="text-indigo-400 font-semibold">{game.label}</span> - {game.desc}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Games;
