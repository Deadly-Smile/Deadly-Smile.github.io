// Read-only access to the Supabase question bank via its REST API (PostgREST).
// Plain fetch with the publishable key — no supabase-js needed for reads.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const IMAGE_BUCKET = "question-images";
const PAGE_SIZE = 1000; // PostgREST's default max-rows

export const isRemoteConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const CATEGORY_COLUMNS = "id,name,parent_id,updated_at";
export const QUESTION_COLUMNS = [
  "id", "category_id", "type", "question_text", "options", "correct_option_label",
  "answer_text", "explanation", "solution", "extra_sections", "language", "tags",
  "images", "source_title", "source_url", "created_at", "updated_at",
].join(",");

async function getJson(path) {
  if (!isRemoteConfigured) {
    throw new Error("Supabase isn't configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).");
  }
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
  } catch {
    throw new Error("Couldn't reach the server — check your connection.");
  }
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).message ?? ""; } catch { /* non-JSON error body */ }
    throw new Error(`Server error ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

async function getAllPages(table, query) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await getJson(`${table}?${query}&limit=${PAGE_SIZE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

// Rows changed since `since` (inclusive), or every row when since is null.
export function fetchChanged(table, columns, since) {
  const filter = since ? `&updated_at=gte.${encodeURIComponent(since)}` : "";
  return getAllPages(table, `select=${columns}${filter}&order=updated_at.asc,id.asc`);
}

export async function fetchIds(table) {
  const rows = await getAllPages(table, "select=id&order=id.asc");
  return new Set(rows.map(r => r.id));
}

export function imageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
