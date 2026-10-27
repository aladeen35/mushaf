/* audio: speech synthesis with word highlighting, Quran recitation, optional pre-recorded files */
(function () {
  const { $, settings, saveSettings, toast, ayatOf, parseRef } = Core;
  const synth = window.speechSynthesis;
  let voices = [];
  const PREFER = [/natural|neural|online/i, /hamed|zariyah|salma|shakir|layla|fatima|omar/i, /google/i, /ar-SA/i, /ar-EG/i, /ar/i];

  function rankVoice(v) {
    let s = 0;
    PREFER.forEach((re, i) => { if (re.test(v.name + " " + v.lang)) s += (PREFER.length - i) * 10; });
    if (!v.localService) s += 5;
    return s;
  }
  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices().filter((v) => /^ar/i.test(v.lang)).sort((a, b) => rankVoice(b) - rankVoice(a));
    const sel = $("#setVoice");
    if (sel) {
      sel.innerHTML = voices.length
        ? voices.map((v) => `<option value="${Core.esc(v.voiceURI)}">${Core.esc(v.name)} (${v.lang})</option>`).join("")
        : `<option value="">لا يوجد صوت عربي في هذا المتصفح</option>`;
      if (settings.voice) sel.value = settings.voice;
    }
    const hint = $("#voiceHint");
    if (hint) hint.textContent = voices.length
      ? "أفضل الأصوات الطبيعية: متصفح Edge (أصوات Microsoft Natural مثل حامد وزارية)، أو Chrome على أندرويد (صوت Google العربي). تُلوَّن الكلمة المنطوقة لحظيًا."
      : "لم يُعثر على صوت عربي. ثبّت حزمة الصوت العربية في إعدادات النظام (تحويل النص إلى كلام)، أو استخدم Edge/Chrome.";
  }
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  function pickVoice() {
    return voices.find((v) => v.voiceURI === settings.voice) || voices[0] || null;
  }

  /* ---------- word wrapping ---------- */
  const WORD = /[^\s]+/g;
  function wrapWords(root) {
    if (root.dataset.wrapped) return Array.from(root.querySelectorAll(".w"));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest("button,.src,.story-actions,.badge,h3 .badge") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      if (!n.nodeValue.trim()) return;
      const frag = document.createDocumentFragment();
      let last = 0;
      n.nodeValue.replace(WORD, (m, i) => {
        if (i > last) frag.appendChild(document.createTextNode(n.nodeValue.slice(last, i)));
        const s = document.createElement("span");
        s.className = "w"; s.textContent = m; frag.appendChild(s);
        last = i + m.length;
      });
      if (last < n.nodeValue.length) frag.appendChild(document.createTextNode(n.nodeValue.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
    root.dataset.wrapped = "1";
    return Array.from(root.querySelectorAll(".w"));
  }

  /* Build playable units from an element: text chunks for TTS, ayah groups for recitation */
  function buildUnits(el) {
    const words = wrapWords(el);
    const units = [];
    let cur = null;
    const flush = () => { if (cur && cur.words.length) units.push(cur); cur = null; };
    words.forEach((w) => {
      const ay = w.closest(".ayah-inline");
      if (ay) {
        if (!cur || cur.type !== "ayah" || cur.node !== ay) { flush(); cur = { type: "ayah", node: ay, ref: ay.dataset.q, words: [] }; }
        cur.words.push(w);
        return;
      }
      if (!cur || cur.type !== "tts") { flush(); cur = { type: "tts", words: [] }; }
      cur.words.push(w);
      // split long chunks at sentence ends (some engines cut long utterances)
      const t = w.textContent;
      if (cur.words.length > 28 && /[.!؟?:؛]$/.test(t)) flush();
      else if (cur.words.length > 60 && /[،,]$/.test(t)) flush();
    });
    flush();
    units.forEach((u) => {
      if (u.type !== "tts") return;
      let off = 0;
      u.offsets = u.words.map((w) => { const o = off; off += w.textContent.length + 1; return o; });
      u.text = u.words.map((w) => w.textContent).join(" ");
    });
    return units;
  }

  /* ---------- player ---------- */
  const P = { queue: [], qi: 0, units: [], ui: 0, playing: false, paused: false, token: 0, audio: new Audio(), keep: null, fallbackT: null };
  P.audio.preload = "auto";

  function clearHL() { document.querySelectorAll(".w.speaking").forEach((w) => w.classList.remove("speaking")); }
  function hl(w) {
    clearHL();
    if (!w) return;
    w.classList.add("speaking");
    const r = w.getBoundingClientRect();
    if (r.top < 90 || r.bottom > innerHeight - 90) w.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function dock(show) { $("#audioDock").hidden = !show; }
  function setPlayIcon() { $("#audPlay").textContent = P.playing && !P.paused ? "⏸" : "▶"; }

  function playQueue(items, start = 0) {
    stop(true);
    P.queue = items; P.qi = start;
    dock(true);
    startItem();
  }
  function startItem() {
    const it = P.queue[P.qi];
    if (!it) { stop(); return; }
    document.querySelectorAll(".story.playing").forEach((s) => s.classList.remove("playing"));
    it.el.classList.add("playing");
    $("#audTitle").textContent = it.title || "";
    $("#audSub").textContent = `${P.qi + 1} / ${P.queue.length}${it.sub ? " — " + it.sub : ""}`;
    if (it.id) Core.store.progress({ lastStory: it.id, lastChapter: it.chapter });
    P.playing = true; P.paused = false; setPlayIcon();
    if (it.audio) return playRecorded(it);
    P.units = buildUnits(it.body || it.el);
    P.ui = 0;
    nextUnit();
  }
  function nextUnit() {
    const tok = ++P.token;
    const u = P.units[P.ui];
    if (!u) { advance(1); return; }
    if (u.type === "ayah" && settings.recite) return reciteUnit(u, tok);
    speakUnit(u.type === "ayah" ? Object.assign({}, u, { text: u.words.map((w) => w.textContent).join(" "), offsets: offsetsOf(u.words) }) : u, tok);
  }
  function offsetsOf(words) { let o = 0; return words.map((w) => { const x = o; o += w.textContent.length + 1; return x; }); }

  function speakUnit(u, tok) {
    if (!synth) { toast("المتصفح لا يدعم القراءة الصوتية"); stop(); return; }
    const ut = new SpeechSynthesisUtterance(u.text);
    const v = pickVoice();
    if (v) ut.voice = v;
    ut.lang = (v && v.lang) || "ar-SA";
    ut.rate = +settings.rate || 1;
    let gotBoundary = false;
    ut.onboundary = (e) => {
      if (tok !== P.token || e.name === "sentence") return;
      gotBoundary = true;
      let i = 0;
      while (i + 1 < u.offsets.length && u.offsets[i + 1] <= e.charIndex) i++;
      hl(u.words[i]);
    };
    ut.onstart = () => {
      if (tok !== P.token) return;
      hl(u.words[0]);
      // estimate highlighting if the engine sends no boundary events
      let i = 0;
      const per = 60000 / (150 * (+settings.rate || 1));
      clearInterval(P.fallbackT);
      P.fallbackT = setInterval(() => {
        if (gotBoundary || tok !== P.token || P.paused) { if (gotBoundary) clearInterval(P.fallbackT); return; }
        i = Math.min(i + 1, u.words.length - 1); hl(u.words[i]);
      }, per);
    };
    ut.onend = () => { clearInterval(P.fallbackT); if (tok !== P.token) return; P.ui++; nextUnit(); };
    ut.onerror = (e) => { clearInterval(P.fallbackT); if (tok !== P.token || e.error === "interrupted" || e.error === "canceled") return; P.ui++; nextUnit(); };
    synth.cancel();
    synth.speak(ut);
    // Chrome desktop stops remote voices after ~15 s: nudge it
    clearInterval(P.keep);
    if (v && !v.localService && !/android/i.test(navigator.userAgent)) {
      P.keep = setInterval(() => { if (synth.speaking && !P.paused) { synth.pause(); synth.resume(); } }, 10000);
    }
  }

  function ayahUrl(s, a) {
    const p = (n, l) => String(n).padStart(l, "0");
    return `https://everyayah.com/data/${settings.reciter || "Alafasy_128kbps"}/${p(s, 3)}${p(a, 3)}.mp3`;
  }
  function reciteUnit(u, tok) {
    const ay = ayatOf(u.ref);
    let k = 0;
    u.words.forEach((w) => w.classList.add("speaking"));
    const playOne = () => {
      if (tok !== P.token) return;
      if (k >= ay.length) { u.words.forEach((w) => w.classList.remove("speaking")); P.ui++; nextUnit(); return; }
      P.audio.src = ayahUrl(ay[k].s, ay[k].a);
      P.audio.playbackRate = 1;
      P.audio.onended = () => { k++; playOne(); };
      P.audio.onerror = () => { // offline: read the verse with TTS instead
        if (tok !== P.token) return;
        u.words.forEach((w) => w.classList.remove("speaking"));
        speakUnit(Object.assign({}, u, { text: u.words.map((w) => w.textContent).join(" "), offsets: offsetsOf(u.words) }), tok);
      };
      P.audio.play().catch(() => P.audio.onerror());
    };
    hl(u.words[0]);
    playOne();
  }

  function playRecorded(it) {
    const tok = ++P.token;
    const words = wrapWords(it.body || it.el);
    P.audio.src = it.audio;
    P.audio.playbackRate = +settings.rate || 1;
    P.audio.ontimeupdate = () => {
      if (tok !== P.token || !it.marks) return;
      const t = P.audio.currentTime;
      let i = 0;
      while (i + 1 < it.marks.length && it.marks[i + 1] <= t) i++;
      hl(words[i]);
    };
    P.audio.onended = () => { if (tok === P.token) advance(1); };
    P.audio.onerror = () => { if (tok !== P.token) return; it.audio = null; startItem(); };
    P.audio.play().catch(() => P.audio.onerror());
  }

  function advance(d) {
    P.qi += d;
    if (P.qi < 0) P.qi = 0;
    if (P.qi >= P.queue.length) { stop(); toast("انتهى الاستماع"); return; }
    halt(); startItem();
  }
  function halt() {
    P.token++;
    clearInterval(P.keep); clearInterval(P.fallbackT);
    if (synth) synth.cancel();
    P.audio.pause();
    clearHL();
  }
  function stop(keepDock) {
    halt();
    P.playing = false; P.paused = false; setPlayIcon();
    document.querySelectorAll(".story.playing").forEach((s) => s.classList.remove("playing"));
    if (!keepDock) dock(false);
  }
  function toggle() {
    if (!P.playing) { if (P.queue.length) startItem(); return; }
    if (P.paused) {
      P.paused = false;
      if (!P.audio.paused || P.audio.src && P.audio.currentTime > 0 && !P.audio.ended && P.units[P.ui] && P.units[P.ui].type === "ayah") P.audio.play();
      else if (synth && synth.paused) synth.resume();
      else nextUnit();
    } else {
      P.paused = true;
      if (synth && synth.speaking) synth.pause();
      P.audio.pause();
    }
    setPlayIcon();
  }

  /* standalone recitation from the verse popup */
  let reciteTok = 0;
  function reciteRef(ref, btn) {
    const ay = ayatOf(ref);
    const my = ++reciteTok;
    const a = new Audio();
    let k = 0;
    const next = () => {
      if (my !== reciteTok || k >= ay.length) { if (btn) btn.textContent = "▶ استماع للتلاوة"; return; }
      a.src = ayahUrl(ay[k].s, ay[k].a);
      a.onended = () => { k++; next(); };
      a.onerror = () => { if (btn) btn.textContent = "تعذر تحميل التلاوة (تحقق من الاتصال)"; };
      a.play().catch(a.onerror);
    };
    if (btn) {
      btn.textContent = "⏹ إيقاف";
      btn.onclick = () => { reciteTok++; a.pause(); btn.textContent = "▶ استماع للتلاوة"; btn.onclick = () => reciteRef(ref, btn); };
    }
    next();
    Core.$("#refModal").addEventListener("click", function h(e) { if (e.target.closest("[data-close]") || e.target.id === "refModal") { reciteTok++; a.pause(); this.removeEventListener("click", h); } });
  }

  /* dock wiring */
  $("#audPlay").onclick = toggle;
  $("#audNext").onclick = () => advance(1);
  $("#audPrev").onclick = () => advance(-1);
  $("#audClose").onclick = () => stop();
  $("#audRate").value = String(settings.rate || 1);
  $("#audRate").onchange = (e) => { settings.rate = +e.target.value; saveSettings(); if (P.playing && !P.paused) { const i = P.ui; halt(); P.ui = i; nextUnit(); } };
  window.addEventListener("hashchange", () => { if (P.playing && !location.hash.startsWith("#read")) stop(); });

  window.Audio_ = { playQueue, stop, toggle, reciteRef, loadVoices, get state() { return P; } };
})();
