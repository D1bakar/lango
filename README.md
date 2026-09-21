# Lango

Frontend-only language starter. No account, no database. Progress stays in your browser.

Two beginner courses (Spanish, English). Each is 10 words, about 5 minutes: 5 flashcards + 5-question check. +10 XP per correct answer.

## What is inside?

```
server.js                <- static host for local dev. No DB, no auth.
public/
  index.html             <- landing: hero, stats, courses, method, FAQ
  languages.html         <- course directory with persistent pick
  lesson.html            <- player: flip cards, quiz, XP, streak
  learn.html             <- legacy redirect -> languages.html
  status.html            <- retired, points home
  app.js                 <- store: localStorage lango.v1 + static loader
  style.css              <- tokens, focus, reduced-motion
  data/languages.json    <- 2 courses x 10 words
data/
  languages.json         <- legacy copy (API fallback)
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
GET /               -> Landing
GET /languages      -> Course directory
GET /lesson?lang=es -> Lesson player
GET /learn          -> 301 -> /languages (legacy)
GET /status         -> 301 -> / (retired)
GET /health         -> { "ok": true }
GET /api/languages  -> public/data/languages.json
```

## Flow

- Pick: languages.html saves tag to localStorage
- Practice: lesson.html?lang=es flips 5, quizzes 5
- Keep: XP + streak update locally, retry anytime
