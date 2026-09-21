/* Lango shell — shared header/footer injector. Removes duplication. */
import { loadStore } from "./store.js";

export function mountShell(opts = {}) {
  const { active = "", showUtility = true } = opts;
  const store = loadStore();
  const streakEl = document.querySelectorAll("[data-streak]");
  streakEl.forEach((el) => (el.textContent = `${store.streak} day streak`));
  const xpEls = document.querySelectorAll("[data-xp]");
  xpEls.forEach((el) => (el.textContent = `${store.xp} XP`));

  // Theme init
  const theme = store.settings?.theme || "system";
  applyTheme(theme);

  // Active nav
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.getAttribute("data-nav") === active) a.setAttribute("aria-current", "page");
  });
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", dark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
}
