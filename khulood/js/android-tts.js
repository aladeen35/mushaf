/* Android app: speechSynthesis on top of the native TextToSpeech bridge (WebView has no Web Speech API) */
(function () {
  if (window.speechSynthesis || !window.AndroidTTS) return;
  let cur = null, seq = 0, base = 0;
  function Utterance(text) { this.text = text; this.rate = 1; this.lang = "ar-SA"; this.voice = null; }
  const voice = { name: "صوت أندرويد", lang: "ar-SA", voiceURI: "android", localService: true, default: true };
  const S = {
    speaking: false, paused: false, pending: false, onvoiceschanged: null,
    getVoices() { return [voice]; },
    speak(u) {
      cur = u; base = 0; u._last = 0; u._id = "u" + ++seq;
      S.speaking = true; S.paused = false;
      AndroidTTS.speak(u.text, u._id, +u.rate || 1);
    },
    cancel() { if (cur) cur._id = null; cur = null; S.speaking = false; S.paused = false; AndroidTTS.stop(); },
    pause() { if (!cur) return; S.paused = true; cur._id = null; AndroidTTS.stop(); },
    resume() {
      if (!cur || !S.paused) return;
      S.paused = false; base = cur._last; cur._id = "u" + ++seq;
      AndroidTTS.speak(cur.text.slice(base), cur._id, +cur.rate || 1);
    },
  };
  window.__ttsEvt = function (type, id, pos) {
    const u = cur;
    if (!u || u._id !== id) return;
    if (type === "start") { if (base === 0 && u.onstart) u.onstart({}); }
    else if (type === "boundary") { u._last = base + pos; if (u.onboundary) u.onboundary({ name: "word", charIndex: base + pos }); }
    else if (type === "end") { cur = null; S.speaking = false; if (u.onend) u.onend({}); }
    else if (type === "error") { cur = null; S.speaking = false; if (u.onerror) u.onerror({ error: "synthesis-failed" }); }
  };
  window.SpeechSynthesisUtterance = Utterance;
  window.speechSynthesis = S;
})();
