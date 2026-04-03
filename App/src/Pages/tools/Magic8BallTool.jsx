import { useState } from "react";

const ANSWERS = [
  // Positive
  { text: "Yes, definitely", type: "positive" },
  { text: "It is certain", type: "positive" },
  { text: "The signs point to yes", type: "positive" },
  { text: "Go for it!", type: "positive" },
  { text: "Absolutely!", type: "positive" },
  { text: "Without a doubt", type: "positive" },
  { text: "Outlook good", type: "positive" },
  { text: "Seize the day", type: "positive" },

  // Negative
  { text: "Don't count on it", type: "negative" },
  { text: "Not likely", type: "negative" },
  { text: "Absolutely not", type: "negative" },
  { text: "Better luck next time", type: "negative" },
  { text: "My sources say no", type: "negative" },
  { text: "Outlook uncertain", type: "negative" },
  { text: "Not in your favor", type: "negative" },
  { text: "Highly doubtful", type: "negative" },

  // Neutral / Mysterious
  { text: "Ask again later", type: "neutral" },
  { text: "Reply hazy, try again", type: "neutral" },
  { text: "Cannot predict now", type: "neutral" },
  { text: "The universe is silent", type: "neutral" },
  { text: "Signs unclear", type: "neutral" },
  { text: "Perhaps...", type: "neutral" },
  { text: "The future is unwritten", type: "neutral" },
  { text: "Time will tell", type: "neutral" },

  // Action-oriented / Funny
  { text: "Flip a coin", type: "funny" },
  { text: "Your guess is as good as mine", type: "funny" },
  { text: "Probably not, but who knows?", type: "funny" },
  { text: "If you build it, they will come", type: "funny" },
  { text: "Only the shadow knows", type: "funny" },
  { text: "Trust your gut", type: "funny" },
  { text: "Fake it till you make it", type: "funny" },
  { text: "YOLO, go crazy", type: "funny" },
  { text: "The odds are ever in your favor", type: "funny" },
  { text: "🎱 spin again", type: "funny" },
];

export default function Magic8BallTool() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [questionText, setQuestionText] = useState("");

  const askBall = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setAnswer(null);

    // Spin for 1.5 seconds
    setTimeout(() => {
      const randomAnswer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
      setAnswer(randomAnswer);
      setIsSpinning(false);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && questionText.trim()) {
      askBall();
    }
  };

  return (
    <div className="tk-magic8-container">
      <h2 style={{ fontSize: "1.8rem", color: "#00ff88", marginBottom: "2rem", textAlign: "center", letterSpacing: "0.1em" }}>
        ✨ COSMIC ORACLE ✨
      </h2>

      <div className="tk-magic8-input-section">
        <label style={{ fontSize: "0.75rem", color: "#aaa", letterSpacing: "0.1em", marginBottom: "8px", display: "block" }}>
          ASK YOUR QUESTION
        </label>
        <input
          type="text"
          placeholder="What should I do?"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="tk-magic8-input"
        />
      </div>

      <div className="tk-magic8-ball-wrapper">
        <div className={`tk-magic8-ball ${isSpinning ? "tk-spinning" : ""}`}>
          <div className="tk-magic8-inner">
            {answer ? (
              <div className={`tk-magic8-answer tk-${answer.type}`}>
                <div className="tk-magic8-answer-text">{answer.text}</div>
              </div>
            ) : (
              <div className="tk-magic8-idle">?</div>
            )}
          </div>
        </div>

        <div className="tk-magic8-glow"></div>
      </div>

      <button
        onClick={askBall}
        disabled={isSpinning}
        className="tk-magic8-button"
      >
        {isSpinning ? "SEEKING ANSWERS..." : "ASK THE ORACLE"}
      </button>

      {answer && (
        <div className="tk-magic8-answer-display">
          {questionText && <div className="tk-magic8-question">{questionText}</div>}
          <div className={`tk-magic8-result tk-${answer.type}`}>
            {answer.text}
          </div>
        </div>
      )}

      <div style={{ marginTop: "2rem", padding: "1rem", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "4px", fontSize: "0.7rem", color: "#666", textAlign: "center", fontFamily: "'Space Mono', monospace" }}>
        Ask a yes/no question or seek guidance from the universe. The oracle awaits...
      </div>
    </div>
  );
}
