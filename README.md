# Lango

Tiny start. Like a sand hut before a castle.

A super simple language learning starter for beginners:
one tiny server + plain HTML pages. No database, no login, no AI yet.

## What is inside?

```
server.js           <- tiny kitchen (Express). Shows pages + gives data.
public/
  index.html        <- drawing 1: Hello Lango
  learn.html        <- drawing 2: Choose a language
  status.html       <- drawing 3: Is the kitchen awake?
  style.css         <- colors for drawings
data/
  languages.json    <- tiny book: just 2 languages
```

## How to start?

You need only Node 22.

```bash
npm install
npm run dev
```

Open: http://localhost:3001

## Roads (API)

```
GET /               -> Hello page
GET /learn          -> Learn page
GET /status         -> Status page
GET /health         -> { "ok": true } (for robots)
GET /api/languages  -> tiny book of languages
```

## Levels

- Level 0 (now): empty box + hello works
- Level 1 (next): learn page reads from tiny book
- Later: database, login, lessons, AI teacher
