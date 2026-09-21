// Tiny kitchen for Lango start.
// This file does only 3 things:
// 1. Call the waiter (express).
// 2. Show drawings from public/ folder.
// 3. Give the tiny book when someone asks.

import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Where am I? Find my own folder.
const here = path.dirname(fileURLToPath(import.meta.url));

// Create the waiter.
const app = express();
const PORT = 3001;

// 1. Show drawings. If browser asks for /, give public/index.html.
app.use(express.static(path.join(here, "public")));

// 2. Health road. Robots ask: are you awake?
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 3. Languages road. Give the tiny book.
app.get("/api/languages", (req, res) => {
  const file = path.join(here, "data", "languages.json");
  const text = fs.readFileSync(file, "utf-8");
  res.type("application/json").send(text);
});

// Pretty roads for humans: /learn and /status show their drawings.
app.get("/learn", (req, res) => {
  res.sendFile(path.join(here, "public", "learn.html"));
});

app.get("/status", (req, res) => {
  res.sendFile(path.join(here, "public", "status.html"));
});

// Start listening on door 3001.
app.listen(PORT, () => {
  console.log(`Lango fresh awake on http://localhost:${PORT}`);
});
