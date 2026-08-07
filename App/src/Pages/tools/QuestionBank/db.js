import { openDB } from "idb";
import { findDuplicate, byCategoryId } from "./dedupe";

const DB_NAME = "question-bank-db";
const DB_VERSION = 2;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains("categories")) {
          const categories = db.createObjectStore("categories", { keyPath: "id", autoIncrement: true });
          categories.createIndex("parentId", "parentId");
        }

        // v1 -> v2 adds a multiEntry tagIds index on the *existing* questions
        // store — via the upgrade transaction, not createObjectStore (which
        // only applies to brand-new stores). Existing records simply won't
        // appear in tag-filtered lookups until they're tagged; nothing breaks.
        let questions;
        if (!db.objectStoreNames.contains("questions")) {
          questions = db.createObjectStore("questions", { keyPath: "id", autoIncrement: true });
          questions.createIndex("categoryId", "categoryId");
        } else {
          questions = transaction.objectStore("questions");
        }
        if (!questions.indexNames.contains("tagIds")) {
          questions.createIndex("tagIds", "tagIds", { multiEntry: true });
        }

        if (!db.objectStoreNames.contains("tags")) {
          const tags = db.createObjectStore("tags", { keyPath: "id", autoIncrement: true });
          tags.createIndex("name", "name");
        }
        if (!db.objectStoreNames.contains("questionStats")) {
          db.createObjectStore("questionStats", { keyPath: "questionId" });
        }
      },
    });
  }
  return dbPromise;
}

// Pre-migration question records predate tagIds/explanation/isFavorite/isRead
// — every read goes through this so the rest of the app never has to guard
// against those fields being missing.
function normalizeQuestion(q) {
  return { explanation: "", isFavorite: false, isRead: false, tagIds: [], ...q };
}

function normalizeDbError(e) {
  if (e?.name === "QuotaExceededError" || e?.code === 22) {
    const err = new Error(
      "Storage is full — your browser ran out of local space. Delete some questions or free up disk space, then try again."
    );
    err.isQuotaExceeded = true;
    return err;
  }
  return e;
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getAllCategories() {
  const db = await getDB();
  return db.getAll("categories");
}

export async function addCategory(name, parentId = null) {
  const db = await getDB();
  const id = await db.add("categories", { name: name.trim(), parentId });
  return { id, name: name.trim(), parentId };
}

export async function renameCategory(id, name) {
  const db = await getDB();
  const cat = await db.get("categories", id);
  if (!cat) return null;
  const updated = { ...cat, name: name.trim() };
  await db.put("categories", updated);
  return updated;
}

// Returns { blocked: true, categoryCount, questionCount } if the subtree is
// non-empty and cascade wasn't requested, otherwise deletes and returns { blocked: false }.
export async function deleteCategory(id, { cascade = false } = {}) {
  const db = await getDB();
  const allCategories = await db.getAll("categories");
  const idsToDelete = collectSubtreeIds(allCategories, id);

  const tx = db.transaction(["categories", "questions"], "readonly");
  const allQuestions = await tx.objectStore("questions").getAll();
  await tx.done;
  const affectedQuestions = allQuestions.filter(q => idsToDelete.has(q.categoryId));

  if (!cascade && (idsToDelete.size > 1 || affectedQuestions.length > 0)) {
    return {
      blocked: true,
      categoryCount: idsToDelete.size - 1,
      questionCount: affectedQuestions.length,
    };
  }

  const delTx = db.transaction(["categories", "questions"], "readwrite");
  for (const q of affectedQuestions) await delTx.objectStore("questions").delete(q.id);
  for (const catId of idsToDelete) await delTx.objectStore("categories").delete(catId);
  await delTx.done;
  return { blocked: false };
}

export function collectSubtreeIds(allCategories, rootId) {
  const ids = new Set([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const cat of allCategories) {
      if (ids.has(cat.parentId) && !ids.has(cat.id)) {
        ids.add(cat.id);
        added = true;
      }
    }
  }
  return ids;
}

// Builds a nested tree (children[] + depth) from the flat parentId-linked list.
export function buildCategoryTree(categories) {
  const byParent = new Map();
  for (const cat of categories) {
    const key = cat.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(cat);
  }
  function attach(parentId, depth) {
    return (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(cat => ({ ...cat, depth, children: attach(cat.id, depth + 1) }));
  }
  return attach(null, 0);
}

// ─── Questions ───────────────────────────────────────────────────────────────

export async function getAllQuestions() {
  const db = await getDB();
  const all = await db.getAll("questions");
  return all.map(normalizeQuestion);
}

// Single save path shared by the manual entry form and the OCR review flow.
export async function saveQuestion(question) {
  const db = await getDB();
  try {
    const record = normalizeQuestion({ ...question, createdAt: question.createdAt ?? Date.now() });
    const id = await db.put("questions", record);
    return { ...record, id: record.id ?? id };
  } catch (e) {
    throw normalizeDbError(e);
  }
}

// Generic patch for existing questions — favoriting, marking read, and
// editing tags/explanation all go through this rather than the full save path.
export async function patchQuestion(id, patch) {
  const db = await getDB();
  const existing = await db.get("questions", id);
  if (!existing) return null;
  const updated = normalizeQuestion({ ...existing, ...patch, id });
  await db.put("questions", updated);
  return updated;
}

export async function deleteQuestion(id) {
  const db = await getDB();
  await db.delete("questions", id);
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export async function getAllTags() {
  const db = await getDB();
  return db.getAll("tags");
}

// Case-insensitive dedupe, mirroring the category name-matching already used
// by importBank — used both for inline "create tag while tagging" UI and for
// remapping tag ids during sync/import.
export async function getOrCreateTag(name) {
  const trimmed = name.trim();
  const db = await getDB();
  const existing = await db.getAll("tags");
  const match = existing.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
  if (match) return match;
  const id = await db.add("tags", { name: trimmed });
  return { id, name: trimmed };
}

export async function renameTag(id, name) {
  const db = await getDB();
  const tag = await db.get("tags", id);
  if (!tag) return null;
  const updated = { ...tag, name: name.trim() };
  await db.put("tags", updated);
  return updated;
}

// Removes the tag from every question that has it before deleting it —
// tagIds arrays don't get automatic referential cleanup from IndexedDB.
export async function deleteTag(id) {
  const db = await getDB();
  const tagged = await db.getAllFromIndex("questions", "tagIds", id);
  const tx = db.transaction(["questions", "tags"], "readwrite");
  for (const q of tagged) {
    await tx.objectStore("questions").put({ ...q, tagIds: (q.tagIds ?? []).filter(t => t !== id) });
  }
  await tx.objectStore("tags").delete(id);
  await tx.done;
}

// ─── Merge an exported bank into the local one ──────────────────────────────
// Shared by JSON import (Phase 4) and QR/P2P device sync (Phase 5) — both hand
// this the same { categories, questions } shape from export.js/serializeBank.
// Categories are matched/created by name-under-resolved-parent (their source
// ids are just local autoincrement values and won't line up across devices).
// Questions are matched by dedupe.js's text fingerprint and skipped if a match
// already exists in the same (resolved) category — never overwrites anything.
export async function importBank({ categories: importedCategories, questions: importedQuestions, tags: importedTags = [] }) {
  const resolvedTagId = new Map();
  const tagCountBefore = (await getAllTags()).length;
  for (const tag of importedTags) {
    const match = await getOrCreateTag(tag.name);
    resolvedTagId.set(tag.id, match.id);
  }
  const addedTags = (await getAllTags()).length - tagCountBefore;

  const localCategories = await getAllCategories();
  const resolvedId = new Map([[null, null]]);
  const remaining = [...importedCategories];
  let addedCategories = 0;

  let progressed = true;
  while (remaining.length > 0 && progressed) {
    progressed = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const cat = remaining[i];
      const parentKey = cat.parentId ?? null;
      if (!resolvedId.has(parentKey)) continue;
      const localParentId = resolvedId.get(parentKey);
      let match = localCategories.find(
        c => (c.parentId ?? null) === localParentId && c.name.trim().toLowerCase() === cat.name.trim().toLowerCase()
      );
      if (!match) {
        match = await addCategory(cat.name, localParentId);
        localCategories.push(match);
        addedCategories++;
      }
      resolvedId.set(cat.id, match.id);
      remaining.splice(i, 1);
      progressed = true;
    }
  }
  // Leftover categories reference a parent id missing from the payload (corrupt
  // export) — attach them at the root rather than dropping them.
  for (const cat of remaining) {
    const match = await addCategory(cat.name, null);
    resolvedId.set(cat.id, match.id);
    addedCategories++;
  }

  const localQuestions = await getAllQuestions();
  let addedQuestions = 0;
  let skippedQuestions = 0;
  for (const q of importedQuestions) {
    const localCategoryId = resolvedId.get(q.categoryId ?? null);
    if (localCategoryId == null) { skippedQuestions++; continue; }
    const candidate = {
      ...q,
      categoryId: localCategoryId,
      tagIds: (q.tagIds ?? []).map(tid => resolvedTagId.get(tid)).filter(id => id != null),
    };
    delete candidate.id;
    if (findDuplicate(localQuestions, candidate, byCategoryId)) {
      skippedQuestions++;
      continue;
    }
    const saved = await saveQuestion(candidate);
    localQuestions.push(saved);
    addedQuestions++;
  }

  return { addedCategories, addedQuestions, skippedQuestions, addedTags };
}
