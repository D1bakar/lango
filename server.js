// Tiny kitchen for Lango start.
// Static host for frontend-only app. No DB, no auth.

import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Where am I? Find my own folder.
const here = path.dirname(fileURLToPath(import.meta.url));

// Create the waiter.
const app = express();
const PORT = 3001;

// 1. Show static frontend.
app.use(express.static(path.join(here, "public")));

// 2. Health road. Kept for uptime checks.
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 3. Languages road. Prefer new frontend dataset, fallback to legacy.
app.get("/api/languages", (req, res) => {
  const next = path.join(here, "public", "data", "languages.json");
  const legacy = path.join(here, "data", "languages.json");
  const file = fs.existsSync(next) ? next : legacy;
  const text = fs.readFileSync(file, "utf-8");
  res.type("application/json").send(text);
});

// Pretty roads for humans.
app.get("/languages", (req, res) => {
  res.sendFile(path.join(here, "public", "languages.html"));
});

app.get("/lesson", (req, res) => {
  res.sendFile(path.join(here, "public", "lesson.html"));
});

// Legacy: /learn -> /languages, /status -> /.
app.get("/learn", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(301, "/languages" + q);
});

app.get("/status", (req, res) => {
  res.redirect(301, "/");
});

// Start listening on door 3001.
app.listen(PORT, () => {
  console.log(`Lango fresh awake on http://localhost:${PORT}`);
});
