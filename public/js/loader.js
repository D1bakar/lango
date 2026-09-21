/* Lango loader v2 — supports flat words[] (v1) + units/lessons (v2). */
const URLS = ["./data/languages.json", "./data/courses/index.json", "/api/languages"];

export function normalizeCourse(raw) {
  const flat = Array.isArray(raw.words) ? raw.words : [];
  const units = Array.isArray(raw.units) ? raw.units : [];
  // Build flattened word list from units if flat empty
  let allWords = flat;
  if (!allWords.length && units.length) {
    allWords = units.flatMap((u) => (u.lessons || []).flatMap((l) => (l.words || []).map((w) => ({ ...w, _unit: u.id, _lesson: l.id }))));
  }
  const lessons = units.flatMap((u) => (u.lessons || []).map((l) => ({ ...l, unitId: u.id, unitTitle: u.title })));
  return { ...raw, words: allWords, lessons, totalLessons: lessons.length || 1, totalWords: allWords.length };
}

export async function loadLanguages() {
  let lastErr = null;
  for (const u of URLS) {
    try {
      const res = await fetch(u, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : data.courses || [];
      if (!arr.length) continue;
      return arr.map(normalizeCourse);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("languages.json not found");
}

export function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function wordKey(tag, front) {
  return `${tag}:${front}`;
}
