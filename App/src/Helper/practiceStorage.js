const CODE_KEY_PREFIX = "practice_code_";
const SOLVED_KEY = "practice_solved";

export function getSavedCode(problemId) {
  try {
    return localStorage.getItem(CODE_KEY_PREFIX + problemId);
  } catch {
    return null;
  }
}

export function saveCode(problemId, code) {
  try {
    localStorage.setItem(CODE_KEY_PREFIX + problemId, code);
    return true;
  } catch {
    return false;
  }
}

export function getSolvedSet() {
  try {
    const raw = localStorage.getItem(SOLVED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markSolved(problemId) {
  try {
    const solved = getSolvedSet();
    solved.add(problemId);
    localStorage.setItem(SOLVED_KEY, JSON.stringify([...solved]));
    return true;
  } catch {
    return false;
  }
}
