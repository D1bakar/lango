/* Lango SRS lite — SM2-inspired 0-5 mastery, due queue from store. */
import { loadStore, setMastery } from "./store.js";
import { wordKey } from "./loader.js";

export function gradeWord(tag, front, correct) {
  const s = loadStore();
  const k = wordKey(tag, front);
  const cur = s.mastery[k] ?? 0;
  const next = correct ? Math.min(5, cur + 1) : Math.max(0, cur - 1);
  setMastery(k, next);
  return next;
}

export function dueWords(course, limit = 10) {
  const s = loadStore();
  const words = course.words || [];
  const scored = words.map((w) => ({ w, m: s.mastery[wordKey(course.tag, w.front)] ?? 0 }));
  scored.sort((a, b) => a.m - b.m);
  return scored.filter((x) => x.m < 4).slice(0, limit).map((x) => x.w);
}

export function courseProgress(course) {
  const s = loadStore();
  const words = course.words || [];
  if (!words.length) return 0;
  const sum = words.reduce((acc, w) => acc + (s.mastery[wordKey(course.tag, w.front)] ?? 0), 0);
  return Math.round((sum / (words.length * 5)) * 100);
}
