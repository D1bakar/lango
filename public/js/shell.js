/* Lango v3 shell — injects identical sidebar + tabbar + footer everywhere. */
import { loadStore } from "./store.js";

const ICONS = {
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  courses: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/></svg>',
  review: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v5h5"/></svg>',
  words: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  stats: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/></svg>',
};

const NAV = [
  { id: "home", label: "Home", href: "./index.html" },
  { id: "courses", label: "Courses", href: "./languages.html" },
  { id: "review", label: "Review", href: "./review.html" },
  { id: "words", label: "Words", href: "./words.html" },
  { id: "stats", label: "Stats", href: "./stats.html" },
  { id: "settings", label: "Settings", href: "./settings.html" },
];

export function mountShell(opts = {}) {
  const { active = "", layout = "wide" } = opts;
  const store = loadStore();
  applyTheme(store.settings?.theme || "system");

  const shell = document.getElementById("shell");
  if (shell) {
    shell.classList.add("shell", `shell-${layout}`);
    if (!shell.dataset.built) {
      shell.dataset.built = "1";
      shell.innerHTML =
        `<aside class="sidebar" aria-label="Primary"><a href="./index.html" class="brand"><span class="brand-mark">L</span><span class="brand-name">Lango</span></a><nav class="side-nav">` +
        NAV.map((n) => `<a href="${n.href}" data-nav="${n.id}" ${n.id === active ? 'aria-current="page"' : ""}>${ICONS[n.id] || ""}<span>${n.label}</span></a>`).join("") +
        `</nav><div class="side-foot"><span class="pill" data-streak>${store.streak} day streak</span><span class="pill" data-xp>${store.xp} XP</span></div></aside>` +
        `<div class="shell-main"><header class="topbar"><span class="topbar-title">Lango</span><span class="pill" data-streak>${store.streak} day streak</span></header><main id="main" class="page page-enter"></main><footer class="site-footer"><div class="foot-inner"><span>Lango · frontend-only · <span data-xp>${store.xp} XP</span></span><nav><a href="./languages.html">Courses</a><a href="./review.html">Review</a><a href="./stats.html">Stats</a><a href="./settings.html">Settings</a></nav></div></footer></div>` +
        `<nav class="tabbar" aria-label="Primary">` +
        NAV.slice(0, 5).map((n) => `<a href="${n.href}" data-nav="${n.id}" ${n.id === active ? 'aria-current="page"' : ""}>${ICONS[n.id] || ""}<span>${n.label}</span></a>`).join("") +
        `</nav>`;
      const realMain = document.querySelector("main[data-content]");
      if (realMain) {
        const target = shell.querySelector("main.page");
        target.replaceWith(realMain);
        realMain.classList.add("page", "page-enter");
        realMain.id = "main";
      }
    }
  }

  document.querySelectorAll("[data-streak]").forEach((el) => (el.textContent = `${store.streak} day streak`));
  document.querySelectorAll("[data-xp]").forEach((el) => (el.textContent = `${store.xp} XP`));
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.getAttribute("data-nav") === active) a.setAttribute("aria-current", "page");
  });

  // SPA-like view transitions for internal links
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href$=".html"], a[href*=".html?"]');
    if (!a || e.metaKey || e.ctrlKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (document.startViewTransition) {
      e.preventDefault();
      document.startViewTransition(() => (location.href = a.href));
    }
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
