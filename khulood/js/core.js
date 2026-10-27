/* core: helpers, settings, user store (local + Firebase), verse/hadith popups */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const CATS = {
    islamic: { name: "مصادر إسلامية", color: "أخضر", short: "قرآن وسنة وآثار" },
    israiliyat: { name: "إسرائيليات", color: "أحمر", short: "منقول عن أهل الكتاب" },
    history: { name: "كتب التاريخ", color: "أزرق", short: "عربية وغربية وآثار" },
    christian: { name: "التراث المسيحي", color: "أسود", short: "الأناجيل والكنيسة" },
    popular: { name: "قصص شعبية", color: "برتقالي", short: "متداولة لا أصل لها" },
  };
  const SUBCAT = { quran: "القرآن الكريم", hadith: "السنة النبوية", sahaba: "آثار الصحابة", arabic: "تاريخ عربي", western: "تاريخ غربي", archaeology: "آثار وحفريات" };

  const chapters = (window.BOOK && BOOK.chapters) || [];
  const chapterById = Object.fromEntries(chapters.map((c) => [c.id, c]));
  const storyIndex = {};
  chapters.forEach((c) => (c.stories || []).forEach((s) => (storyIndex[s.id] = { story: s, chapter: c })));

  /* ---------- Quran helpers ---------- */
  function parseRef(ref) {
    const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(String(ref).replace(/\s|–/g, (c) => (c === "–" ? "-" : "")));
    if (!m) return null;
    return { s: +m[1], a: +m[2], b: +(m[3] || m[2]) };
  }
  function refLabel(ref) {
    const r = parseRef(ref);
    if (!r) return ref;
    const name = (QURAN.surahs && QURAN.surahs[r.s]) || "سورة " + r.s;
    return `${name}: ${r.a}${r.b !== r.a ? "–" + r.b : ""}`;
  }
  function ayatOf(ref) {
    const r = parseRef(ref);
    if (!r) return [];
    const out = [];
    for (let i = r.a; i <= r.b; i++) {
      const t = QURAN.ayat[`${r.s}:${i}`];
      if (t) out.push({ s: r.s, a: i, t });
    }
    return out;
  }

  /* ---------- inline markup ---------- */
  function rich(text) {
    let html = esc(text);
    html = html.replace(/\{\{(qt|q|h):([^}]+)\}\}/g, (m, kind, val) => {
      val = val.trim();
      if (kind === "h") {
        const h = HADITH[val];
        return h ? `<button class="ref h" data-h="${esc(val)}">${esc(h.title || "حديث")}</button>` : "";
      }
      if (kind === "qt") {
        const txt = ayatOf(val).map((x) => x.t).join(" ۝ ");
        return `<span class="ayah-inline" data-q="${esc(val)}">${esc(txt)}</span> <button class="ref" data-q="${esc(val)}">${esc(refLabel(val))}</button>`;
      }
      return `<button class="ref" data-q="${esc(val)}">${esc(refLabel(val))}</button>`;
    });
    return html;
  }
  /* plain text for speech: q chips -> spoken surah ref omitted, qt -> verse segment marker */
  function speechSegments(text) {
    const segs = [];
    let last = 0;
    const re = /\{\{(qt|q|h):([^}]+)\}\}/g;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) segs.push({ type: "text", text: text.slice(last, m.index) });
      if (m[1] === "qt") segs.push({ type: "ayah", ref: m[2].trim() });
      last = re.lastIndex;
    }
    if (last < text.length) segs.push({ type: "text", text: text.slice(last) });
    return segs;
  }
  function plain(text) {
    return String(text || "").replace(/\{\{(qt|q|h):([^}]+)\}\}/g, (m, k, v) => (k === "qt" ? ayatOf(v.trim()).map((x) => x.t).join(" ") : ""));
  }

  /* ---------- settings ---------- */
  const SKEY = "mws.settings";
  const settings = Object.assign({ font: 19, theme: "auto", voice: "", recite: true, reciter: "Alafasy_128kbps", rate: 1, mode: "read", hidden: [] }, readJSON(SKEY, {}));
  function readJSON(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function saveSettings() { writeJSON(SKEY, settings); applySettings(); }
  function applySettings() {
    document.documentElement.style.setProperty("--fs", settings.font + "px");
    if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", settings.theme);
  }

  /* ---------- user store ---------- */
  const UKEY = "mws.user";
  const blank = () => ({ favorites: {}, bookmarks: {}, progress: {}, quiz: {}, updated: 0 });
  let data = Object.assign(blank(), readJSON(UKEY, {}));
  const listeners = new Set();
  let remote = null; // {save(data)}
  let saveTimer = null;
  function commit() {
    data.updated = Date.now();
    writeJSON(UKEY, data);
    listeners.forEach((f) => f(data));
    if (remote) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => remote.save(data).catch((e) => console.warn("sync", e)), 800);
    }
  }
  const store = {
    get data() { return data; },
    on(f) { listeners.add(f); },
    isFav(id) { return !!data.favorites[id]; },
    toggleFav(id) {
      if (data.favorites[id]) delete data.favorites[id]; else data.favorites[id] = Date.now();
      commit(); return !!data.favorites[id];
    },
    setBookmark(key, val) { data.bookmarks[key] = Object.assign({ ts: Date.now() }, val); commit(); },
    removeBookmark(key) { delete data.bookmarks[key]; commit(); },
    progress(patch) { Object.assign(data.progress, patch, { ts: Date.now() }); commit(); },
    quiz(ch, score) { data.quiz[ch] = Math.max(score, data.quiz[ch] || 0); commit(); },
    merge(other) {
      if (!other) return;
      data.favorites = Object.assign({}, other.favorites, data.favorites);
      data.bookmarks = Object.assign({}, other.bookmarks, data.bookmarks);
      data.quiz = Object.assign({}, other.quiz, data.quiz);
      if ((other.progress && other.progress.ts || 0) > (data.progress.ts || 0)) data.progress = other.progress;
      commit();
    },
    attachRemote(r) { remote = r; },
  };

  /* ---------- auth (Firebase if configured, otherwise device-only) ---------- */
  const auth = { user: null, mode: "local", fb: null };
  const FB_VER = "10.12.2";
  function fbConfigured() {
    const c = window.FIREBASE_CONFIG;
    return c && c.apiKey && c.appId && !/PASTE|YOUR/.test(c.apiKey);
  }
  async function initFirebase() {
    if (!fbConfigured()) { renderAuthBtn(); return; }
    try {
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
      const [{ initializeApp }, A, F] = await Promise.all([
        import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js"),
      ]);
      const app = initializeApp(window.FIREBASE_CONFIG);
      const fauth = A.getAuth(app);
      const db = window.FIRESTORE_DB_ID ? F.getFirestore(app, window.FIRESTORE_DB_ID) : F.getFirestore(app);
      auth.fb = { A, F, fauth, db };
      auth.mode = "firebase";
      A.onAuthStateChanged(fauth, async (u) => {
        auth.user = u ? { uid: u.uid, name: u.displayName || u.email, email: u.email } : null;
        if (u) {
          const ref = F.doc(db, "users", u.uid);
          try {
            const snap = await F.getDoc(ref);
            if (snap.exists()) store.merge(snap.data().state);
          } catch (e) { console.warn(e); }
          store.attachRemote({ save: (d) => F.setDoc(ref, { state: d, name: auth.user.name || "", updatedAt: F.serverTimestamp() }, { merge: true }) });
          commit();
        } else store.attachRemote(null);
        renderAuthBtn();
      });
    } catch (e) {
      console.warn("Firebase unavailable", e);
      auth.mode = "local";
      renderAuthBtn();
    }
  }
  function renderAuthBtn() {
    const b = $("#authBtn");
    if (!b) return;
    if (auth.user) { b.textContent = (auth.user.name || "حسابي").split(" ")[0]; b.classList.add("primary"); }
    else { b.textContent = "دخول"; b.classList.remove("primary"); }
  }
  function openAuth() {
    const body = $("#authBody");
    if (auth.user) {
      body.innerHTML = `<h3>حسابي</h3><p>مرحبًا ${esc(auth.user.name || "")}<br><small class="hint">${esc(auth.user.email || "")}</small></p>
        <p class="hint">تُحفظ القصص المفضلة وأماكن التوقف ونتائج الاختبارات في حسابك وتتزامن بين أجهزتك.</p>
        <div class="cta"><a class="btn" href="#saved">محفوظاتي</a><button class="btn" id="signOut">تسجيل الخروج</button></div>`;
      $("#signOut").onclick = async () => { await auth.fb.A.signOut(auth.fb.fauth); closeModal("authModal"); toast("تم تسجيل الخروج"); };
    } else if (auth.mode === "firebase") {
      body.innerHTML = `<h3>تسجيل الدخول</h3>
        <p class="hint">سجّل الدخول لحفظ القصص المفضلة وأماكن التوقف ومزامنتها بين الهاتف والحاسوب.</p>
        <button class="btn primary" id="gSign" style="width:100%;justify-content:center">الدخول بحساب Google</button>
        <div style="text-align:center;margin:10px 0" class="hint">أو بالبريد الإلكتروني</div>
        <label class="field">البريد <input type="email" id="aEmail" autocomplete="email"></label>
        <label class="field">كلمة المرور <input type="password" id="aPass" autocomplete="current-password"></label>
        <div class="cta"><button class="btn primary" id="aIn">دخول</button><button class="btn" id="aUp">إنشاء حساب</button><button class="btn" id="aReset">نسيت كلمة المرور</button></div>
        <p class="hint" id="aMsg"></p>`;
      const { A, fauth } = auth.fb;
      const msg = (t) => ($("#aMsg").textContent = t);
      const done = () => { closeModal("authModal"); toast("تم تسجيل الدخول"); };
      $("#gSign").onclick = () => A.signInWithPopup(fauth, new A.GoogleAuthProvider()).then(done).catch((e) => msg(fbErr(e)));
      $("#aIn").onclick = () => A.signInWithEmailAndPassword(fauth, $("#aEmail").value.trim(), $("#aPass").value).then(done).catch((e) => msg(fbErr(e)));
      $("#aUp").onclick = () => A.createUserWithEmailAndPassword(fauth, $("#aEmail").value.trim(), $("#aPass").value).then(done).catch((e) => msg(fbErr(e)));
      $("#aReset").onclick = () => A.sendPasswordResetEmail(fauth, $("#aEmail").value.trim()).then(() => msg("أُرسل رابط إعادة التعيين إلى بريدك.")).catch((e) => msg(fbErr(e)));
    } else {
      body.innerHTML = `<h3>الحفظ والمزامنة</h3>
        <p>محفوظاتك (القصص المفضلة، أماكن التوقف، نتائج الاختبارات) تُحفظ الآن <b>على هذا الجهاز</b> تلقائيًا.</p>
        <p class="hint">لتفعيل تسجيل الدخول والمزامنة بين الأجهزة عبر Firebase (مشروع alwasoog-e2d17) أضِف مفاتيح تطبيق الويب في ملف <code>firebase-config.js</code> كما هو موضح في ملف README.</p>
        <div class="cta"><a class="btn" href="#saved">محفوظاتي</a><button class="btn" id="exportData">تصدير نسخة احتياطية</button><label class="btn">استيراد<input type="file" id="importData" accept="application/json" hidden></label></div>`;
      $("#exportData").onclick = () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
        a.download = "khulood-backup.json"; a.click();
      };
      $("#importData").onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        f.text().then((t) => { store.merge(JSON.parse(t)); toast("تم الاستيراد"); }).catch(() => toast("ملف غير صالح"));
      };
    }
    openModal("authModal");
  }
  function fbErr(e) {
    const c = (e && e.code) || "";
    const map = {
      "auth/invalid-email": "البريد غير صالح", "auth/missing-password": "أدخل كلمة المرور", "auth/weak-password": "كلمة المرور ضعيفة (6 أحرف على الأقل)",
      "auth/email-already-in-use": "البريد مسجل مسبقًا", "auth/invalid-credential": "بيانات الدخول غير صحيحة", "auth/popup-closed-by-user": "أُغلقت نافذة الدخول",
      "auth/unauthorized-domain": "هذا النطاق غير مضاف في Firebase (Authorized domains)", "auth/operation-not-allowed": "طريقة الدخول غير مفعلة في Firebase",
    };
    return map[c] || "تعذر الإكمال: " + (c || e);
  }

  /* ---------- modals / toast ---------- */
  function openModal(id) { $("#" + id).hidden = false; }
  function closeModal(id) { $("#" + id).hidden = true; }
  let toastT;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2200); }

  function showAyat(ref) {
    const ay = ayatOf(ref);
    const r = parseRef(ref);
    $("#refBody").innerHTML = `<div class="ttl">${esc(refLabel(ref))}</div>
      <div class="ayat">${ay.map((x) => `${esc(x.t)} <span class="num">﴿${x.a}﴾</span>`).join(" ")}</div>
      <div class="meta"><button class="btn" id="reciteBtn">▶ استماع للتلاوة</button>
      <a class="btn" target="_blank" rel="noopener" href="https://quran.com/${r.s}/${r.a}${r.b !== r.a ? "-" + r.b : ""}">quran.com ↗</a>
      <span>الرسم العثماني — مصحف المدينة (Tanzil)</span></div>`;
    $("#reciteBtn").onclick = () => window.Audio_ && Audio_.reciteRef(ref, $("#reciteBtn"));
    openModal("refModal");
  }
  function showHadith(id) {
    const h = HADITH[id];
    if (!h) return;
    $("#refBody").innerHTML = `<div class="ttl" style="color:var(--accent)">${esc(h.title)}</div>
      <div class="hadith-text">${esc(h.text)}</div>
      <div class="meta"><span class="grade">${esc(h.grade || "")}</span><span>${esc(h.source || "")}${h.number ? " — رقم " + esc(h.number) : ""}</span>
      ${h.url ? `<a class="btn" target="_blank" rel="noopener" href="${esc(h.url)}">sunnah.com ↗</a>` : ""}
      <a class="btn" target="_blank" rel="noopener" href="https://dorar.net/hadith/search?q=${encodeURIComponent((h.text || "").replace(/^معنى الحديث:\s*/, "").slice(0, 60))}">الدرر السنية ↗</a></div>`;
    openModal("refModal");
  }
  document.addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]");
    if (q && q.classList.contains("ref")) { e.preventDefault(); showAyat(q.dataset.q); return; }
    const h = e.target.closest("[data-h]");
    if (h) { e.preventDefault(); showHadith(h.dataset.h); return; }
    const c = e.target.closest("[data-close]");
    if (c) { const id = c.dataset.close; if (id === "drawer") window.App && App.drawer(false); else closeModal(id); return; }
    if (e.target.classList.contains("modal")) e.target.hidden = true;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".modal").forEach((m) => (m.hidden = true)); });

  window.Core = { $, $$, esc, CATS, SUBCAT, chapters, chapterById, storyIndex, rich, plain, speechSegments, refLabel, ayatOf, parseRef,
    settings, saveSettings, applySettings, store, auth, initFirebase, openAuth, openModal, closeModal, toast, readJSON, writeJSON };
  applySettings();
})();
