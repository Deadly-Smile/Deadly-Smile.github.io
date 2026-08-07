// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the pure parser. Run manually with:
//   node src/Pages/tools/QuestionBank/parser.test.js
import { parseOcrText } from "./parser.js";

let failures = 0;

function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures++;
    console.error(`✗ ${name}`);
    console.error("  expected:", JSON.stringify(expected));
    console.error("  actual:  ", JSON.stringify(actual));
  } else {
    console.log(`✓ ${name}`);
  }
}

// ── Ticket Section 1: Bangla reference format ────────────────────────────────
{
  const raw = `৯. কোনটি কাজী নজরুল ইসলামের প্রবন্ধ গ্রন্থ?

(ক) মৃতুক্ষুধা (খ) সিন্ধু হিন্দোল (গ) যুগবাণী (ঘ) অগ্নিবীণা

উত্তর: (গ) যুগবাণী`;
  const [result] = parseOcrText(raw);
  check("bangla: parses cleanly", result.needsReview, false);
  check("bangla: language", result.language, "bn");
  check("bangla: question text", result.questionText, "কোনটি কাজী নজরুল ইসলামের প্রবন্ধ গ্রন্থ?");
  check("bangla: correct option label", result.correctOptionLabel, "গ");
  check("bangla: option gha text", result.options[3], { label: "ঘ", text: "অগ্নিবীণা" });
}

// ── Ticket Section 1a: English variant ───────────────────────────────────────
{
  const raw = `59. Which play is filled with nonsensical conversations, meaningless dialogues,
and characters who often become forgetful?

(a) Pygmalion (b) The Skin Game (c) Waiting for Godot (d) Candida

Answer: (c) Waiting for Godot`;
  const [result] = parseOcrText(raw);
  check("english: parses cleanly", result.needsReview, false);
  check("english: language", result.language, "en");
  check(
    "english: question text (multi-line concatenated)",
    result.questionText,
    "Which play is filled with nonsensical conversations, meaningless dialogues, and characters who often become forgetful?"
  );
  check("english: correct option label", result.correctOptionLabel, "c");
  check("english: option d text", result.options[3], { label: "d", text: "Candida" });
}

// ── Multiple questions in one OCR block (e.g. a photographed worksheet page) ──
{
  const raw = `১. প্রশ্ন এক?
(ক) অ (খ) আ (গ) ই (ঘ) ঈ
উত্তর: (ক) অ

২. প্রশ্ন দুই?
(ক) ক (খ) খ (গ) গ (ঘ) ঘ
উত্তর: (খ) খ`;
  const results = parseOcrText(raw);
  check("multi-question: splits into 2 blocks", results.length, 2);
  check("multi-question: first answer", results[0].correctOptionLabel, "ক");
  check("multi-question: second answer", results[1].correctOptionLabel, "খ");
}

// ── Known-bad: missing answer line ───────────────────────────────────────────
{
  const raw = `৩. উত্তরবিহীন প্রশ্ন?
(ক) এক (খ) দুই (গ) তিন (ঘ) চার`;
  const [result] = parseOcrText(raw);
  check("missing answer line: flagged for review", result.needsReview, true);
  check("missing answer line: raw text preserved", result.rawOcrText, raw);
}

// ── Known-bad: only 3 of 4 option markers (OCR dropped one glyph) ────────────
{
  const raw = `৪. অসম্পূর্ণ অপশন?
(ক) এক (খ) দুই (গ) তিন
উত্তর: (ক) এক`;
  const [result] = parseOcrText(raw);
  check("incomplete options: flagged for review", result.needsReview, true);
}

// ── Known-bad: no recognizable marker set at all ─────────────────────────────
{
  const raw = `৫. পুরোপুরি অস্পষ্ট OCR টেক্সট
কিছু এলোমেলো শব্দ যা কোনো কাঠামো অনুসরণ করে না`;
  const [result] = parseOcrText(raw);
  check("garbled text: flagged for review", result.needsReview, true);
  check("garbled text: language unknown", result.language, null);
}

// ── Answer letter doesn't match any parsed option ────────────────────────────
{
  const raw = `৬. ভুল উত্তর অক্ষর?
(ক) এক (খ) দুই (গ) তিন (ঘ) চার
উত্তর: (ঙ) কিছু`;
  const [result] = parseOcrText(raw);
  check("mismatched answer letter: flagged for review", result.needsReview, true);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll parser checks passed.");
}
