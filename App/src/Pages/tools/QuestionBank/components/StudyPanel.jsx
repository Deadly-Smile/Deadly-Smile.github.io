import { useMemo, useState } from "react";
import QuestionFilterPicker, { filterQuestions } from "./QuestionFilterPicker";
import StudyCard from "./StudyCard";

export default function StudyPanel({ categories, questions, tags, onChanged }) {
  const [categoryId, setCategoryId] = useState(null);
  const [tagIds, setTagIds] = useState([]);

  const filtered = useMemo(
    () => filterQuestions(questions, categories, { categoryId, tagIds }),
    [questions, categories, categoryId, tagIds]
  );

  return (
    <div className="tk-qb-study">
      <QuestionFilterPicker
        categories={categories}
        tags={tags}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        tagIds={tagIds}
        onTagIdsChange={setTagIds}
      />
      <p className="tk-qb-review-reason">{filtered.length} question(s) match.</p>
      <div className="tk-qb-question-list">
        {filtered.map(q => <StudyCard key={q.id} question={q} onChanged={onChanged} />)}
      </div>
    </div>
  );
}
