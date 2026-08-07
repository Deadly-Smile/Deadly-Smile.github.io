import { useEffect, useState } from "react";
import { getMostWrong, getCategoryCoverage } from "../stats";

export default function StatsPanel({ categories, questions }) {
  const [mostWrong, setMostWrong] = useState(null);
  const [coverage, setCoverage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMostWrong(questions, 20), getCategoryCoverage(categories, questions)]).then(([wrong, cov]) => {
      if (!cancelled) {
        setMostWrong(wrong);
        setCoverage(cov);
      }
    });
    return () => { cancelled = true; };
  }, [categories, questions]);

  if (!mostWrong || !coverage) {
    return <p className="tk-qb-tree-empty">Loading stats…</p>;
  }

  return (
    <div className="tk-qb-stats">
      <section>
        <h3 className="tk-pane-label">MOST WRONG ANSWERED</h3>
        {mostWrong.length === 0 ? (
          <p className="tk-qb-tree-empty">No wrong answers recorded yet — attempt some questions in Study or Exam mode.</p>
        ) : (
          <div className="tk-qb-question-list">
            {mostWrong.map(({ question, stat }) => (
              <div key={question.id} className="tk-qb-stats-row">
                <span className="tk-qb-question-text">{question.questionText}</span>
                <span className="tk-qb-badge tk-qb-badge--warn">
                  {stat.timesWrong}/{stat.timesShown} wrong ({Math.round((stat.timesWrong / stat.timesShown) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="tk-pane-label">CATEGORY COVERAGE</h3>
        {coverage.length === 0 ? (
          <p className="tk-qb-tree-empty">No categories with questions yet.</p>
        ) : (
          <div className="tk-qb-coverage-list">
            {coverage.map(({ category, total, covered }) => (
              <div key={category.id} className="tk-qb-coverage-row">
                <span className="tk-qb-coverage-label">{category.name}</span>
                <div className="tk-qb-coverage-bar">
                  <div
                    className="tk-qb-coverage-bar-fill"
                    style={{ width: `${total ? Math.round((covered / total) * 100) : 0}%` }}
                  />
                </div>
                <span className="tk-qb-coverage-count">{covered}/{total}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
