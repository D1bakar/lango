/* Lango store v2 — localStorage only. Migrates v1 -> v2. TZ-safe streak. */
const KEY_V1 = "lango.v1";
const KEY = "lango.v2";

function defaultStore() {
  return {
    version: 2,
    lang: null,
    xp: 0,
    level: 1,
    streak: 0,
    lastDay: null,
    done: {},
    mastery: {},
    settings: { theme: "system", goal: 50, tts: true, ttsRate: 1 },
  };
}

function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayStr(d);
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultStore(), ...JSON.parse(raw) };
    // migrate v1
    const v1 = localStorage.getItem(KEY_V1);
    if (v1) {
      const p = JSON.parse(v1);
      const migrated = { ...defaultStore(), lang: p.lang ?? null, xp: p.xp ?? 0, done: p.done ?? {}, streak: p.streak ?? 0, lastDay: p.lastDay ?? null };
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
    return defaultStore();
  } catch {
    return defaultStore();
  }
}

export function saveStore(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function setLanguage(tag) {
  const s = loadStore();
  s.lang = tag;
  saveStore(s);
  return s;
}

export function addXp(amount) {
  const s = loadStore();
  s.xp += amount;
  s.level = Math.floor(s.xp / 200) + 1;
  const today = todayStr();
  if (s.lastDay !== today) {
    s.streak = s.lastDay === yesterdayStr() ? s.streak + 1 : 1;
    s.lastDay = today;
  }
  saveStore(s);
  return s;
}

export function markDone(tag, score, lessonId = null) {
  const s = loadStore();
  s.done[tag] = { score, at: new Date().toISOString(), lessonId };
  saveStore(s);
  return s;
}

export function setMastery(wordKey, value) {
  const s = loadStore();
  s.mastery[wordKey] = Math.max(0, Math.min(5, value));
  saveStore(s);
  return s;
}

export function updateSettings(patch) {
  const s = loadStore();
  s.settings = { ...s.settings, ...patch };
  saveStore(s);
  return s;
}

export function clearProgress() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(KEY_V1);
  return defaultStore();
}

export function exportProgress() {
  return JSON.stringify(loadStore(), null, 2);
}

export function importProgress(json) {
  const parsed = JSON.parse(json);
  const merged = { ...defaultStore(), ...parsed, version: 2 };
  saveStore(merged);
  return merged;
}
