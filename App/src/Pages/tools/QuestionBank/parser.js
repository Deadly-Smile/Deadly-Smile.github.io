// Pure, rules-based parser: raw OCR text -> structured MCQ question guess(es).
// No NLP/ML — just the structural markers described in the ticket (Section 6b).
// Never silently discards unparsable text: anything that doesn't fit the rules
// comes back with needsReview: true and the raw text intact for manual editing.

const BN_LABELS = ["ক", "খ", "গ", "ঘ"];
const EN_LABELS = ["a", "b", "c", "d"];

const QUESTION_START_RE = /^[০-৯0-9]+[.।]\s*/;
const BN_OPTION_LINE_RE = /\(ক\).*\(খ\).*\(গ\).*\(ঘ\)/;
const EN_OPTION_LINE_RE = /\([aA]\).*\([bB]\).*\([cC]\).*\([dD]\)/;
const BN_OPTION_MATCH_RE = /\((ক|খ|গ|ঘ)\)/g;
const EN_OPTION_MATCH_RE = /\(([aAbBcCdD])\)/g;
const BN_ANSWER_LINE_RE = /^উত্তর[ঃ:]?/;
const EN_ANSWER_LINE_RE = /^answer\s*:?/i;
const BN_ANSWER_LETTER_RE = /\((ক|খ|গ|ঘ)\)/;
const EN_ANSWER_LETTER_RE = /\(([aAbBcCdD])\)/;

function detectLanguage(lines) {
  const joined = lines.join(" ");
  if (BN_OPTION_LINE_RE.test(joined) || BN_LABELS.every(l => joined.includes(`(${l})`))) return "bn";
  if (EN_OPTION_LINE_RE.test(joined) || EN_LABELS.every(l => new RegExp(`\\(${l}\\)`, "i").test(joined))) return "en";
  return null;
}

function extractOptions(line, language) {
  const pattern = language === "bn" ? BN_OPTION_MATCH_RE : EN_OPTION_MATCH_RE;
  const matches = [...line.matchAll(pattern)];
  if (matches.length < 4) return null;
  const options = [];
  for (let i = 0; i < 4; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : line.length;
    const label = language === "bn" ? matches[i][1] : matches[i][1].toLowerCase();
    options.push({ label, text: line.slice(start, end).trim() });
  }
  return options;
}

function needsReview(reason, lines, language = null) {
  return { needsReview: true, reason, rawOcrText: lines.join("\n"), language };
}

// Splits a raw OCR text block into per-question chunks by locating lines that
// start with a question number — handles both "one question per image" and
// "multiple questions per image" source material without extra configuration.
export function splitIntoBlocks(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (QUESTION_START_RE.test(line)) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks.length > 0 ? blocks : (lines.length > 0 ? [lines] : []);
}

function parseBlock(lines) {
  const language = detectLanguage(lines);
  if (!language) {
    return needsReview("Couldn't detect a Bangla (ক/খ/গ/ঘ) or English (a/b/c/d) option marker set.", lines);
  }

  const optionLineRe = language === "bn" ? BN_OPTION_LINE_RE : EN_OPTION_LINE_RE;
  const optionLineIndex = lines.findIndex(l => optionLineRe.test(l));
  if (optionLineIndex === -1) {
    return needsReview("Couldn't find a single line containing all 4 options.", lines, language);
  }

  const options = extractOptions(lines[optionLineIndex], language);
  if (!options) {
    return needsReview("Found an option-marker line but couldn't split it into 4 options.", lines, language);
  }

  const questionLines = lines.slice(0, optionLineIndex);
  if (questionLines.length === 0) {
    return needsReview("No question text found before the options line.", lines, language);
  }
  const questionText = questionLines.join(" ").replace(QUESTION_START_RE, "").trim();
  if (!questionText) {
    return needsReview("Question text was empty after stripping the leading number.", lines, language);
  }

  const answerLineRe = language === "bn" ? BN_ANSWER_LINE_RE : EN_ANSWER_LINE_RE;
  const answerLine = lines.slice(optionLineIndex + 1).find(l => answerLineRe.test(l));
  if (!answerLine) {
    return needsReview("No answer line found (expected 'উত্তর:' or 'Answer:').", lines, language);
  }

  const letterRe = language === "bn" ? BN_ANSWER_LETTER_RE : EN_ANSWER_LETTER_RE;
  const letterMatch = answerLine.match(letterRe);
  if (!letterMatch) {
    return needsReview("Answer line found but no bracketed option letter in it.", lines, language);
  }
  const correctOptionLabel = language === "bn" ? letterMatch[1] : letterMatch[1].toLowerCase();
  if (!options.some(o => o.label === correctOptionLabel)) {
    return needsReview(`Answer letter "(${correctOptionLabel})" doesn't match any parsed option.`, lines, language);
  }

  return {
    needsReview: false,
    questionText,
    options,
    correctOptionLabel,
    language,
    rawOcrText: lines.join("\n"),
  };
}

// Main entry point: raw OCR text -> array of parsed (or needs-review) questions.
export function parseOcrText(rawText) {
  return splitIntoBlocks(rawText).map(parseBlock);
}
