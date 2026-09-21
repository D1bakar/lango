/* Lango TTS — speechSynthesis wrapper with voice pick + rate. */
export function ttsSupported() {
  return "speechSynthesis" in window;
}

export function pickVoice(langTag) {
  if (!ttsSupported()) return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const map = {
    es: ["es"], en: ["en"], ja: ["ja"], fr: ["fr"], de: ["de"], it: ["it"],
    pt: ["pt"], nl: ["nl"], ko: ["ko"], zh: ["zh", "cmn"], hi: ["hi"],
    ar: ["ar"], tr: ["tr"], ru: ["ru"], pl: ["pl"], sv: ["sv"], el: ["el"],
    th: ["th"], vi: ["vi"], id: ["id"], fi: ["fi"], he: ["he"],
  };
  const prefs = map[langTag] || ["en"];
  for (const p of prefs) {
    const v = voices.find((x) => x.lang?.toLowerCase().startsWith(p));
    if (v) return v;
  }
  return voices.find((x) => x.default) || voices[0];
}

export function speak(text, { lang = "es", rate = 1 } = {}) {
  if (!ttsSupported()) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = rate;
    speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}
