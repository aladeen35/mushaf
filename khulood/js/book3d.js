/* book3d: paginated 3D page-turning book (RTL), per chapter */
(function () {
  const { $, esc, CATS, chapters, chapterById, rich, store, toast } = Core;
  const TOK = /<button[^>]*>[\s\S]*?<\/button>|<span class="ayah-inline"[^>]*>[\s\S]*?<\/span>|[^\s<]+|\s+/g;
  let state = null;

  function blocksFor(ch) {
    const B = [];
    B.push({ kind: "title", html: `<div class="orn">۞</div><div class="kicker">التبويب ${esc(ch.num)}</div><h1>${esc(ch.title)}</h1>${ch.era ? `<p style="text-align:center">${esc(ch.era)}</p>` : ""}<div class="orn">۞</div>` });
    if (ch.intro) B.push({ kind: "p", html: rich(ch.intro) });
    (ch.sections || []).forEach((s) => {
      B.push({ kind: "h", html: `<h2>${esc(s.h)}</h2>` });
      (s.p || []).forEach((p) => B.push({ kind: "p", html: rich(p) }));
    });
    if ((ch.stories || []).length) B.push({ kind: "h", html: `<h2>القصص والروايات</h2>` });
    (ch.stories || []).forEach((st) => {
      const c = CATS[st.cat] || CATS.history;
      B.push({ kind: "sh", cat: st.cat, id: st.id, html: `<h3>${esc(st.title)}</h3><div class="src">● ${esc(c.name)}${st.source ? " — " + rich(st.source) : ""}${st.grade ? " — " + esc(st.grade) : ""}</div>` });
      (st.body || []).forEach((p) => B.push({ kind: "sp", cat: st.cat, html: rich(p) }));
      if (st.critique) B.push({ kind: "sp", cat: st.cat, cls: "critique", html: "تعليق المحقق: " + rich(st.critique) });
    });
    const sm = ch.summary || {};
    [["khulasa", "خلاصة الفصل"], ["thabit", "الثابت بالنص"], ["ihtiraz", "ما يحتاج إلى احتراز"], ["lessons", "الدروس العقدية والتربوية"], ["sources", "المراجع المباشرة"], ["bridge", "الجسر إلى الفصل التالي"]].forEach(([k, t]) => {
      if (sm[k]) { B.push({ kind: "h", html: `<h2>${t}</h2>` }); B.push({ kind: "p", html: rich(sm[k]) }); }
    });
    return B;
  }

  function wrapBlock(b, inner) {
    if (b.kind === "h" || b.kind === "title") return inner;
    const p = `<p${b.cls ? ` class="${b.cls}"` : ""}>${inner}</p>`;
    if (b.kind === "sh") return `<div class="pstory" data-cat="${b.cat}" data-story="${b.id}">${inner}</div>`;
    if (b.kind === "sp") return `<div class="pstory" data-cat="${b.cat}">${p}</div>`;
    return p;
  }

  function paginate(blocks, w, h, runner) {
    const meas = document.createElement("div");
    meas.className = "measure book";
    meas.innerHTML = `<div class="page" style="width:${w}px;height:${h}px;position:relative"><div class="runner">${esc(runner)}</div><div class="content"></div></div>`;
    document.body.appendChild(meas);
    const page = meas.firstChild, box = page.lastChild;
    // usable height: page minus padding (top 34, bottom 40)
    const limit = h - 74;
    const pages = [];
    let cur = [];
    const fits = () => box.scrollHeight <= limit;
    const flush = () => { if (cur.length) pages.push({ html: cur.join(""), story: null }); cur = []; box.innerHTML = ""; };
    blocks.forEach((b) => {
      if (b.kind === "title") { flush(); pages.push({ html: b.html, title: true }); return; }
      let html = wrapBlock(b, b.html);
      box.insertAdjacentHTML("beforeend", html);
      if (fits()) { cur.push(html); return; }
      box.lastChild.remove();
      // headings: never leave at the bottom; move to next page
      if (b.kind === "h" || b.kind === "sh") { flush(); box.insertAdjacentHTML("beforeend", html); cur.push(html); return; }
      // split paragraph by tokens
      let toks = b.html.match(TOK) || [];
      while (toks.length) {
        let lo = 0, hi = toks.length;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          box.insertAdjacentHTML("beforeend", wrapBlock(b, toks.slice(0, mid).join("")));
          const ok = fits();
          box.lastChild.remove();
          if (ok) lo = mid; else hi = mid - 1;
        }
        if (lo === 0) {
          if (!cur.length) lo = Math.min(toks.length, 12); // pathological: force progress
          else { flush(); continue; }
        }
        const part = wrapBlock(b, toks.slice(0, lo).join(""));
        box.insertAdjacentHTML("beforeend", part); cur.push(part);
        toks = toks.slice(lo);
        while (toks.length && /^\s+$/.test(toks[0])) toks.shift();
        if (toks.length) flush();
      }
    });
    flush();
    meas.remove();
    return pages;
  }

  function dims() {
    const vw = Math.min(window.innerWidth, document.documentElement.clientWidth);
    const vh = window.innerHeight;
    const double = vw >= 900;
    const pw = double ? Math.min(520, Math.floor((vw - 100) / 2)) : Math.min(vw - 24, 560);
    const ph = Math.max(420, Math.min(vh - 190, Math.round(pw * (double ? 1.42 : 1.55))));
    return { double, pw, ph };
  }

  function render(view, chId, startPage) {
    const ch = chapterById[chId] || chapters[0];
    if (!ch) { view.innerHTML = `<div class="wrap empty">لا يوجد محتوى بعد.</div>`; return; }
    const d = dims();
    const pages = paginate(blocksFor(ch), d.pw, d.ph, ch.short || ch.title);
    const total = pages.length;
    const bm = store.data.bookmarks["book:" + ch.id];
    let start = startPage != null ? startPage : bm ? bm.page : 0;
    view.innerHTML = `<div class="book-stage">
      <div class="book-bar">
        <select id="bkCh">${chapters.map((c) => `<option value="${c.id}" ${c.id === ch.id ? "selected" : ""}>${esc(c.num)}. ${esc(c.title)}</option>`).join("")}</select>
        <button class="pill-btn" id="bkMark">🔖 حفظ الصفحة</button>
        <a class="pill-btn" href="#read-${ch.id}">📰 وضع المدونة</a>
      </div>
      <div class="book ${d.double ? "double" : "single"}" id="book" style="width:${d.double ? d.pw * 2 : d.pw}px;height:${d.ph}px"><div class="spine-shadow"></div></div>
      <div class="book-nav"><button id="bkNext" title="التالي">‹</button><span id="bkPos" class="book-hint"></span><button id="bkPrev" title="السابق">›</button></div>
      <div class="book-hint">اسحب أو انقر على حافة الصفحة لتقليبها · الأسهم في لوحة المفاتيح</div>
    </div>`;
    const book = $("#book", view);
    const pageHTML = (p, i) => p ? `<div class="page ${p.title ? "title-page" : ""}">${p.title ? "" : `<div class="runner">${esc(ch.short || ch.title)}</div>`}<div class="content">${p.html}</div><div class="folio">${i + 1}</div></div>` : `<div class="page"></div>`;
    const leaves = [];
    if (d.double) {
      for (let j = 0; j * 2 < total; j++) {
        const L = document.createElement("div");
        L.className = "leaf";
        L.innerHTML = `<div class="face front">${pageHTML(pages[2 * j], 2 * j)}</div><div class="face back">${pageHTML(pages[2 * j + 1], 2 * j + 1)}</div>`;
        book.appendChild(L); leaves.push(L);
      }
    } else {
      pages.forEach((p, i) => {
        const L = document.createElement("div");
        L.className = "leaf";
        L.innerHTML = `<div class="face front">${pageHTML(p, i)}</div>`;
        book.appendChild(L); leaves.push(L);
      });
    }
    const n = leaves.length;
    // s = number of flipped leaves; for single mode we keep the last page visible
    const maxS = d.double ? n : n - 1;
    let s = d.double ? Math.min(Math.ceil(start / 2), maxS) : Math.min(start, maxS);

    function layout(animIdx) {
      leaves.forEach((L, j) => {
        const flipped = j < s;
        L.classList.toggle("flipped", flipped);
        L.style.zIndex = j === animIdx ? 400 : flipped ? j + 1 : n - j + 1;
      });
      const first = d.double ? Math.max(0, 2 * s - 1) : s;
      const last = d.double ? Math.min(total, 2 * s + 1) : s + 1;
      $("#bkPos", view).textContent = `${first + 1}${last - first > 1 ? "–" + last : ""} / ${total}`;
      store.progress({ lastChapter: ch.id, mode: "book" });
      state.page = first;
    }
    function go(ns) {
      if (ns < 0) { const prev = chapters[chapters.indexOf(ch) - 1]; if (prev) location.hash = `#book-${prev.id}`; return; }
      if (ns > maxS) { const next = chapters[chapters.indexOf(ch) + 1]; if (next) { location.hash = `#book-${next.id}`; } else toast("نهاية الكتاب"); return; }
      const anim = ns > s ? s : ns;
      s = ns; layout(anim);
      setTimeout(() => layout(-1), 950);
    }
    state = { ch: ch.id, next: () => go(s + 1), prev: () => go(s - 1), page: 0 };
    layout(-1);

    $("#bkNext", view).onclick = state.next;
    $("#bkPrev", view).onclick = state.prev;
    $("#bkCh", view).onchange = (e) => (location.hash = `#book-${e.target.value}`);
    $("#bkMark", view).onclick = () => { store.setBookmark("book:" + ch.id, { type: "book", chapter: ch.id, page: state.page, title: `صفحة ${state.page + 1}`, chTitle: ch.title }); toast("حُفظت الصفحة"); };
    book.addEventListener("click", (e) => {
      if (e.target.closest(".ref,[data-q],[data-h],a,button")) return;
      const r = book.getBoundingClientRect();
      const x = e.clientX - r.left;
      // RTL: left side = forward
      if (x < r.width / 2) state.next(); else state.prev();
    });
    let tx = null;
    book.addEventListener("touchstart", (e) => (tx = e.touches[0].clientX), { passive: true });
    book.addEventListener("touchend", (e) => {
      if (tx == null) return;
      const dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) < 40) return;
      dx > 0 ? state.next() : state.prev();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (!state || !location.hash.startsWith("#book") || e.target.closest("input,select,textarea")) return;
    if (e.key === "ArrowLeft" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); state.next(); }
    if (e.key === "ArrowRight" || e.key === "PageUp") { e.preventDefault(); state.prev(); }
  });
  let rt;
  window.addEventListener("resize", () => {
    if (!state || !location.hash.startsWith("#book")) return;
    clearTimeout(rt);
    rt = setTimeout(() => render($("#view"), state.ch, state.page), 250);
  });

  window.Book3D = { render, get state() { return state; } };
})();
