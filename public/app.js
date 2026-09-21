/* Lango shared frontend store. No backend. Static JSON + localStorage. */

const STORE_KEY = "lango.v1";
const DATA_URL = "./data/languages.json";

function defaultStore() {
  return { lang: null, xp: 0, done: {}, streak: 0, lastDay: null };
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw);
    return { ...defaultStore(), ...parsed };
  } catch {
    return defaultStore();
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked - ignore, app still works for session */
  }
}

export function setLanguage(tag) {
  const store = loadStore();
  store.lang = tag;
  saveStore(store);
  return store;
}

export function addXp(amount) {
  const store = loadStore();
  store.xp += amount;
  const today = new Date().toISOString().slice(0, 10);
  if (store.lastDay !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    store.streak = store.lastDay === yesterday ? store.streak + 1 : 1;
    store.lastDay = today;
  }
  saveStore(store);
  return store;
}

export function markDone(tag, score) {
  const store = loadStore();
  store.done[tag] = { score, at: new Date().toISOString() };
  saveStore(store);
  return store;
}

export function clearProgress() {
  localStorage.removeItem(STORE_KEY);
  return defaultStore();
}

export async function loadLanguages() {
  const res = await fetch(DATA_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("languages.json not found: " + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("languages.json must be an array");
  return data;
}

export function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name);
}
