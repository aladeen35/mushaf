/* reader: blog-style chapter view, story cards, quiz */
(function () {
  const { $, $$, esc, CATS, SUBCAT, chapters, chapterById, rich, store, settings, saveSettings, toast } = Core;

  function catBadge(st) {
    const c = CATS[st.cat] || CATS.history;
    const sub = SUBCAT[st.subcat] ? " · " + SUBCAT[st.subcat] : "";
    return `<span class="badge">${esc(c.name + sub)}</span>`;
  }

  function storyHTML(st, ch) {
    const fav = store.isFav(st.id);
    return `<article class="story" id="${esc(st.id)}" data-cat="${esc(st.cat)}" data-id="${esc(st.id)}">
      <div class="story-head"><h3>${esc(st.title)}</h3>${catBadge(st)}</div>
      <div class="src">${st.source ? `<span><b>المصدر:</b> ${rich(st.source)}</span>` : ""}${st.grade ? `<span><b>الدرجة:</b> ${esc(st.grade)}</span>` : ""}</div>
      <div class="body">${(st.body || []).map((p) => `<p>${rich(p)}</p>`).join("")}</div>
      ${st.critique ? `<div class="critique">${rich(st.critique)}</div>` : ""}
      ${(st.refs || []).length ? `<div class="refs">${st.refs.map((r) => `<button class="ref" data-q="${esc(r)}">${esc(Core.refLabel(r))}</button>`).join("")}</div>` : ""}
      <div class="story-actions">
        <button data-act="listen">🔊 استماع</button>
        <button data-act="fav" class="${fav ? "on" : ""}">${fav ? "★ في المفضلة" : "☆ أضف للمفضلة"}</button>
        <button data-act="mark">🔖 علامة توقف</button>
        <button data-act="share">↗ مشاركة</button>
      </div>
    </article>`;
  }

  function quizHTML(ch) {
    const qs = ch.quiz || [];
    if (!qs.length) return "";
    const best = store.data.quiz[ch.id];
    return `<section class="quiz" data-ch="${esc(ch.id)}"><h3>اختبر فهمك</h3>
      <p class="hint">${qs.length} أسئلة لترسيخ الدروس العقدية والتربوية${best != null ? ` — أفضل نتيجة لك: ${best}/${qs.length}` : ""}</p>
      ${qs.map((q, i) => `<div class="q" data-i="${i}"><div class="qt">${i + 1}. ${esc(q.q)}</div>
        <div class="opts">${q.options.map((o, j) => `<button data-j="${j}">${esc(o)}</button>`).join("")}</div>
        <div class="explain" hidden></div></div>`).join("")}
      <p class="hint" id="quizScore"></p></section>`;
  }

  function wireQuiz(root, ch) {
    const box = root.querySelector(".quiz");
    if (!box) return;
    let answered = 0, right = 0;
    box.addEventListener("click", (e) => {
      const b = e.target.closest(".opts button");
      if (!b) return;
      const qEl = b.closest(".q");
      if (qEl.dataset.done) return;
      const q = ch.quiz[+qEl.dataset.i];
      const j = +b.dataset.j;
      qEl.dataset.done = 1;
      answered++;
      if (j === q.answer) { right++; b.classList.add("ok"); } else { b.classList.add("bad"); qEl.querySelectorAll(".opts button")[q.answer].classList.add("ok"); }
      const ex = qEl.querySelector(".explain"); ex.hidden = false; ex.textContent = q.explain || "";
      if (answered === ch.quiz.length) {
        store.quiz(ch.id, right);
        box.querySelector("#quizScore").textContent = `النتيجة: ${right} من ${ch.quiz.length}${right === ch.quiz.length ? " — أحسنت! 🌿" : ""}`;
      }
    });
  }

  function countCats(ch) {
    const c = {};
    (ch.stories || []).forEach((s) => (c[s.cat] = (c[s.cat] || 0) + 1));
    return c;
  }

  function renderChapter(view, id, focus) {
    const ch = chapterById[id] || chapters[0];
    if (!ch) { view.innerHTML = `<div class="wrap empty">لا يوجد محتوى بعد.</div>`; return; }
    const idx = chapters.indexOf(ch);
    const prev = chapters[idx - 1], next = chapters[idx + 1];
    const counts = countCats(ch);
    const hidden = new Set(settings.hidden || []);
    const sm = ch.summary || {};
    view.innerHTML = `<div class="wrap narrow">
      <div class="reader-tools">
        <span class="legend" id="catFilter">${Object.entries(CATS).filter(([k]) => counts[k]).map(([k, c]) =>
          `<span class="chip toggle ${hidden.has(k) ? "off" : ""}" data-cat="${k}"><i style="background:var(--c-${k})"></i>${c.name} ${counts[k]}</span>`).join("")}</span>
        <span class="grow"></span>
        <button class="pill-btn" id="listenAll">🔊 استمع للتبويب</button>
        <a class="pill-btn" href="#book-${ch.id}">📖 وضع الكتاب</a>
      </div>
      <article class="article">
        <div class="kicker">التبويب ${esc(ch.num)} من ${chapters.length}${ch.era ? " · " + esc(ch.era) : ""}</div>
        <h1>${esc(ch.title)}</h1>
        ${ch.intro ? `<p class="lead">${rich(ch.intro)}</p>` : ""}
        ${(ch.sections || []).map((s) => `<section class="sec"><h2>${esc(s.h)}</h2>${(s.p || []).map((p) => `<p>${rich(p)}</p>`).join("")}
          ${(s.refs || []).length ? `<div class="refs">${s.refs.map((r) => `<button class="ref" data-q="${esc(r)}">${esc(Core.refLabel(r))}</button>`).join("")}</div>` : ""}</section>`).join("")}
        ${(ch.stories || []).length ? `<h2>القصص والروايات (${ch.stories.length})</h2>` : ""}
        <div id="stories">${(ch.stories || []).map((s) => storyHTML(s, ch)).join("")}</div>
        <div class="boxes">
          ${sm.khulasa ? `<div class="box wide"><h4>خلاصة الفصل</h4>${rich(sm.khulasa)}</div>` : ""}
          ${sm.thabit ? `<div class="box"><h4>الثابت بالنص</h4>${rich(sm.thabit)}</div>` : ""}
          ${sm.ihtiraz ? `<div class="box warn"><h4>ما يحتاج إلى احتراز</h4>${rich(sm.ihtiraz)}</div>` : ""}
          ${sm.lessons ? `<div class="box"><h4>الدروس العقدية والتربوية</h4>${rich(sm.lessons)}</div>` : ""}
          ${sm.sources ? `<div class="box"><h4>المراجع المباشرة</h4>${rich(sm.sources)}</div>` : ""}
          ${sm.bridge ? `<div class="box wide"><h4>الجسر إلى الفصل التالي</h4>${rich(sm.bridge)}</div>` : ""}
        </div>
        ${quizHTML(ch)}
        <nav class="chapter-nav">
          ${prev ? `<a class="btn" href="#read-${prev.id}">→ ${esc(prev.short || prev.title)}</a>` : "<span></span>"}
          ${next ? `<a class="btn primary" href="#read-${next.id}">${esc(next.short || next.title)} ←</a>` : ""}
        </nav>
      </article>${Explore.footer()}</div>`;

    applyFilter(view);
    wireQuiz(view, ch);
    store.progress({ lastChapter: ch.id, mode: "read" });

    $("#catFilter", view).addEventListener("click", (e) => {
      const chip = e.target.closest("[data-cat]"); if (!chip) return;
      const k = chip.dataset.cat;
      const set = new Set(settings.hidden || []);
      set.has(k) ? set.delete(k) : set.add(k);
      settings.hidden = [...set]; saveSettings();
      chip.classList.toggle("off");
      applyFilter(view);
    });
    $("#listenAll", view).onclick = () => {
      const items = $$(".story", view).filter((s) => !s.hidden).map((el) => itemFor(el, ch));
      if (items.length) Audio_.playQueue(items, 0);
    };
    $("#stories", view).addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const el = b.closest(".story"); const id = el.dataset.id;
      const st = Core.storyIndex[id].story;
      if (b.dataset.act === "listen") {
        const all = $$(".story", view).filter((s) => !s.hidden);
        Audio_.playQueue(all.map((x) => itemFor(x, ch)), all.indexOf(el));
      } else if (b.dataset.act === "fav") {
        const on = store.toggleFav(id);
        b.classList.toggle("on", on); b.textContent = on ? "★ في المفضلة" : "☆ أضف للمفضلة";
        toast(on ? "أُضيفت إلى المفضلة" : "أُزيلت من المفضلة");
      } else if (b.dataset.act === "mark") {
        store.setBookmark("read:" + ch.id, { type: "read", chapter: ch.id, story: id, title: st.title, chTitle: ch.title });
        toast("حُفظ مكان التوقف");
      } else if (b.dataset.act === "share") {
        const url = location.href.split("#")[0] + `#read-${id}`;
        const text = `${st.title} — تطبيق خلود`;
        const copy = () => navigator.clipboard ? navigator.clipboard.writeText(url).then(() => toast("نُسخ الرابط")).catch(() => toast(url)) : toast(url);
        if (navigator.share) navigator.share({ title: text, url }).catch(copy); else copy();
      }
    });
    if (focus) {
      const el = document.getElementById(focus);
      if (el) setTimeout(() => { el.scrollIntoView({ block: "start" }); el.classList.add("playing"); setTimeout(() => el.classList.remove("playing"), 1600); }, 60);
    } else window.scrollTo(0, 0);
  }

  function applyFilter(view) {
    const hidden = new Set(settings.hidden || []);
    $$(".story", view).forEach((s) => (s.hidden = hidden.has(s.dataset.cat)));
  }

  function itemFor(el, ch) {
    const st = Core.storyIndex[el.dataset.id].story;
    return { el, body: el.querySelector(".body"), id: st.id, chapter: ch.id, title: st.title, sub: CATS[st.cat].name, audio: st.audio || null, marks: st.marks || null };
  }

  window.Reader = { renderChapter, storyHTML, catBadge, countCats };
})();
