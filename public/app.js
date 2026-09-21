/* Lango app.js — backward-compat shim. New code imports from ./js/store.js + ./js/loader.js */
export { loadStore, saveStore, setLanguage, addXp, markDone, clearProgress } from "./js/store.js";
export { loadLanguages, getQuery } from "./js/loader.js";
