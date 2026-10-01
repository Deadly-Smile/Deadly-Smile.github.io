import { useState } from "react";
import { OptionList, AnswerDetails } from "./QuestionContent";

// One question's answer flow, shared by Study and Exam:
//   MCQ:   pick an option → Check → correct/wrong highlighted
//   Short: Show answer → self-grade "Got it" / "Missed it"
// onAnswer(answer) fires once with { picked } or { selfGrade }; the parent
// keys this by question id so moving to another question resets it.
// `initialAnswer` restores an already-answered question (e.g. exam resumed).
export default function AnswerControls({ question, optionOrder, initialAnswer = null, onAnswer, children }) {
  const [picked, setPicked] = useState(initialAnswer?.picked ?? null);
  const [answer, setAnswer] = useState(initialAnswer);
  const [shortRevealed, setShortRevealed] = useState(initialAnswer != null);
  const answered = answer != null;

  function commit(a) {
    if (answered) return;
    setAnswer(a);
    onAnswer(a);
  }

  if (question.type === "mcq") {
    return (
      <>
        <OptionList
          question={question}
          optionOrder={optionOrder}
          picked={picked}
          revealed={answered}
          onPick={answered ? undefined : setPicked}
        />
        <div className="tk-qb-study-actions">
          {!answered && (
            <button className="tk-action-btn" disabled={picked == null} onClick={() => commit({ picked })}>
              Check answer
            </button>
          )}
          {children}
        </div>
        {answered && (
          <p className={answer.picked === question.correctOptionLabel ? "tk-qb-result tk-qb-result--ok" : "tk-qb-result tk-qb-result--bad"}>
            {answer.picked === question.correctOptionLabel ? "✓ Correct" : "✗ Wrong"}
          </p>
        )}
        {answered && <AnswerDetails question={question} />}
      </>
    );
  }

  return (
    <>
      <div className="tk-qb-study-actions">
        {!shortRevealed && (
          <button className="tk-action-btn" onClick={() => setShortRevealed(true)}>Show answer</button>
        )}
        {shortRevealed && !answered && (
          <>
            <button className="tk-action-btn" onClick={() => commit({ selfGrade: true })}>✓ Got it</button>
            <button className="tk-action-btn tk-danger" onClick={() => commit({ selfGrade: false })}>✗ Missed it</button>
          </>
        )}
        {children}
      </div>
      {answered && (
        <p className={answer.selfGrade ? "tk-qb-result tk-qb-result--ok" : "tk-qb-result tk-qb-result--bad"}>
          {answer.selfGrade ? "✓ Marked correct" : "✗ Marked wrong"}
        </p>
      )}
      {shortRevealed && <AnswerDetails question={question} />}
    </>
  );
}
