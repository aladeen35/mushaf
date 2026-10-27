/* explore: home, compare, genealogy tree + timeline, atlas, saved, search */
(function () {
  const { $, $$, esc, CATS, chapters, chapterById, storyIndex, rich, store } = Core;
  const APK_URL = "https://aladeen35.github.io/mushaf/khulood/khulood-1.0.0.apk";
  const X = window.EXTRA || { compare: [], tree: { nodes: [], edges: [], timeline: [] }, places: [] };

  /* ---------- home ---------- */
  function home(view) {
    const nst = chapters.reduce((a, c) => a + (c.stories || []).length, 0);
    const words = chapters.reduce((a, c) => a + JSON.stringify(c).split(/\s+/).length, 0);
    const p = store.data.progress || {};
    const last = p.lastChapter && chapterById[p.lastChapter];
    const lastStory = p.lastStory && storyIndex[p.lastStory];
    view.innerHTML = `<div class="hero-band"><div class="wrap hero">
      <div>
        <div class="kicker gold">خلود · لتخليد ذكرى الأنبياء والتابعين</div>
        <h1>موسوعة الأنبياء والرسل والصالحين</h1>
        <p>من بداية الخلق إلى العصر الحاضر، بمنظور إسلامي سني يميّز بين القطعي والمظنون والمنقول المختلف فيه، ويعرض كل قصة بلون مصدرها.</p>
        <div class="cta">
          <a class="btn gold" href="#book-${(last || chapters[0] || {}).id || "ch01"}">📖 افتح الكتاب</a>
          <a class="btn light" href="#read-${(last || chapters[0] || {}).id || "ch01"}">📰 القراءة كمدونة</a>
          ${window.AndroidTTS ? "" : `<a class="btn light" href="${APK_URL}" target="_blank" rel="noopener">⬇ تطبيق أندرويد</a>`}
        </div>
      </div>
      <div class="hero-cover"><img src="img/khulood-logo.webp" alt="شعار خلود — لتخليد ذكرى الأنبياء والتابعين"><div class="s">موسوعة الأنبياء والرسل والصالحين<br>ترتيب م. علاء الدين البشري عمر</div></div>
    </div></div>
    <div class="wrap">
      ${last ? `<a class="continue" href="${p.mode === "book" ? "#book-" + last.id : "#read-" + (lastStory ? p.lastStory : last.id)}">
        <span style="font-size:26px">🔖</span><span><b>تابع من حيث توقفت</b><br><small>${esc(last.title)}${lastStory ? " — " + esc(lastStory.story.title) : ""}</small></span></a>` : ""}
      <div class="stats">
        <div class="stat"><b>${chapters.length}</b><span>تبويبًا</span></div>
        <div class="stat"><b>${nst}</b><span>قصة ورواية</span></div>
        <div class="stat"><b>≈${Math.round(words / 250)}</b><span>صفحة</span></div>
        <div class="stat"><b>${Object.keys(QURAN.ayat).length}</b><span>آية موثقة</span></div>
      </div>
      <h2 class="section-title">مفتاح الألوان</h2>
      <div class="legend">${Object.entries(CATS).map(([k, c]) => `<span class="chip"><i style="background:var(--c-${k})"></i><b>${c.color}</b> — ${c.name}: ${c.short}</span>`).join("")}</div>
      <h2 class="section-title">أدوات الباحث</h2>
      <div class="tools-grid">
        <a href="#compare" class="tool"><span>⚖</span><b>المقارنة الرباعية</b><small>الحدث الواحد في أربعة مصادر</small></a>
        <a href="#tree" class="tool"><span>🌳</span><b>شجرة الأنساب</b><small>الثابت بخط متصل والمختلف فيه متقطع</small></a>
        <a href="#atlas" class="tool"><span>🗺</span><b>الأطلس المحقق</b><small>قطعي · راجح · ظني</small></a>
        <a href="#saved" class="tool"><span>★</span><b>محفوظاتي</b><small>المفضلة وأماكن التوقف</small></a>
      </div>
      <h2 class="section-title">التبويبات</h2>
      <div class="ch-grid">${chapters.map((c) => {
        const cnt = Reader.countCats(c); const tot = (c.stories || []).length || 1;
        return `<a class="ch-card" href="#read-${c.id}"><div class="n">التبويب ${esc(c.num)}</div><h3>${esc(c.title)}</h3>
          <div class="bar">${Object.keys(CATS).map((k) => cnt[k] ? `<i style="width:${(cnt[k] / tot) * 100}%;background:var(--c-${k})"></i>` : "").join("")}</div>
          <div class="meta">${(c.stories || []).length} قصة${store.data.quiz[c.id] != null ? ` · الاختبار ${store.data.quiz[c.id]}/${(c.quiz || []).length}` : ""}</div></a>`;
      }).join("")}</div>
      ${footer()}
    </div>`;
  }
  function footer() {
    return `<footer class="credits">
      <div class="credit-book"><img src="img/khulood-logo.webp" alt="خلود"><div><b>خلود</b> — موسوعة الأنبياء والرسل والصالحين<br>
        <small>ترتيب المهندس علاء الدين البشري عمر، صدقة جارية عن روح والده وأجداده وموتى المسلمين. جُمعت وحُررت بمساعدة الذكاء الاصطناعي مع مراجعة المصادر.</small></div></div>
      <div class="credit-co"><img src="img/bushra-tech.webp" alt="البشري للتكنولوجيا"><div>من إنتاج<br><b>البشري للتكنولوجيا</b><br><small dir="ltr">Al‑Bushra Technology · Building meaningful digital products</small></div></div>
    </footer>`;
  }

  /* ---------- compare ---------- */
  function compare(view, id) {
    const items = X.compare;
    const cur = items.find((c) => c.id === id) || items[0];
    view.innerHTML = `<div class="wrap">
      <h1 class="page-title">محرك المقارنة الرباعي</h1>
      <p class="hint">الحدث الواحد في أربعة أعمدة متجاورة: الأخضر (الوحي)، الأحمر (الإسرائيليات)، الأزرق (التاريخ)، الأسود (التراث المسيحي) — لبيان هيمنة النص القرآني وتنزيهه للأنبياء.</p>
      <div class="cmp-tabs">${items.map((c) => `<button class="${c.id === cur.id ? "on" : ""}" data-id="${c.id}">${esc(c.title)}</button>`).join("")}</div>
      <div class="verdict"><b>خلاصة المقارنة: </b>${rich(cur.verdict)}</div>
      <div class="cmp-grid">${["islamic", "israiliyat", "history", "christian"].map((k) => {
        const col = cur.cols[k]; if (!col) return "";
        return `<div class="cmp-col" data-cat="${k}"><h4>${CATS[k].color} — ${CATS[k].name}</h4><div class="src">${esc(col.source)}</div><div>${rich(col.text)}</div></div>`;
      }).join("")}</div>
      ${cur.chapter && chapterById[cur.chapter] ? `<p style="margin-top:14px"><a class="btn" href="#read-${cur.chapter}">اقرأ التبويب كاملًا ←</a></p>` : ""}
    </div>`;
    $(".cmp-tabs", view).onclick = (e) => { const b = e.target.closest("button"); if (b) location.hash = "#compare-" + b.dataset.id; };
  }

  /* ---------- genealogy tree ---------- */
  function tree(view) {
    const T = X.tree;
    view.innerHTML = `<div class="wrap">
      <h1 class="page-title">شجرة الأنساب والتسلسل الزمني</h1>
      <div class="viz-legend">
        <span><svg width="46" height="10"><line x1="0" y1="5" x2="46" y2="5" class="tedge"/></svg> ثابت بالنص القطعي أو بإجماع النسابين</span>
        <span><svg width="46" height="10"><line x1="0" y1="5" x2="46" y2="5" class="tedge dashed"/></svg> مختلف فيه أو منقول بلا دليل قاطع</span>
        <span class="hint">«لا تُملأ الفجوات بأنساب لا أصل لها» — اسحب للتحريك، واستخدم العجلة أو الإصبعين للتكبير، وانقر على أي اسم.</span>
      </div>
      <div class="viz" id="treeViz"></div>
      <div class="info-panel" id="treeInfo">انقر على اسم أو خط لعرض درجة الثبوت.</div>
      <h2 class="section-title">التسلسل الزمني التقريبي</h2>
      <div class="timeline">${T.timeline.map((e) => `<div class="era"><div><h4>${esc(e.era)}</h4><div class="d">${esc(e.date)}</div>
        <span class="cert">${esc(e.certainty)}</span></div><div class="items">${e.items.map((i) => `<span class="chip">${esc(i)}</span>`).join("")}</div></div>`).join("")}</div>
    </div>`;
    const W = 150, H = 66, NW = 128, NH = 38;
    const pos = (n) => ({ x: 60 + n.x * W, y: 40 + n.y * H });
    const byId = Object.fromEntries(T.nodes.map((n) => [n.id, n]));
    const maxX = Math.max(...T.nodes.map((n) => n.x)), maxY = Math.max(...T.nodes.map((n) => n.y));
    const vw = 120 + maxX * W + NW, vh = 80 + maxY * H + NH;
    const box = $("#treeViz", view);
    const hgt = Math.min(Math.max(window.innerHeight - 260, 420), 760);
    const svg = d3.select(box).append("svg").attr("height", hgt).attr("viewBox", `0 0 ${box.clientWidth} ${hgt}`);
    const g = svg.append("g");
    T.edges.forEach((e) => {
      const a = pos(byId[e.from]), b = pos(byId[e.to]);
      let d;
      if (e.rel === "sibling") d = `M${a.x - NW / 2},${a.y} L${b.x + NW / 2},${b.y}`;
      else { const my = (a.y + NH / 2 + b.y - NH / 2) / 2; d = `M${a.x},${a.y + NH / 2} C${a.x},${my} ${b.x},${my} ${b.x},${b.y - NH / 2}`; }
      g.append("path").attr("d", d).attr("class", "tedge " + (e.type === "dashed" ? "dashed" : ""))
        .style("cursor", "pointer").on("click", () => info(`<b>${esc(byId[e.from].label)} ← ${esc(byId[e.to].label)}</b> — ${e.type === "dashed" ? "<span style='color:var(--c-popular)'>غير قطعي</span>" : "<span style='color:var(--c-islamic)'>ثابت</span>"}<br>${esc(e.note)}`));
    });
    T.nodes.forEach((n) => {
      const p = pos(n);
      const ng = g.append("g").attr("class", "tnode " + n.kind).attr("transform", `translate(${p.x - NW / 2},${p.y - NH / 2})`);
      ng.append("rect").attr("width", NW).attr("height", NH).attr("rx", 10);
      ng.append("text").attr("x", NW / 2).attr("y", NH / 2 + 5).attr("text-anchor", "middle").text(n.label);
      ng.on("click", () => info(`<b>${esc(n.label)}</b><br>${esc(n.note || "")}${n.ch && chapterById[n.ch] ? `<br><a href="#read-${n.ch}">اقرأ في التبويب: ${esc(chapterById[n.ch].title)} ←</a>` : ""}`));
    });
    const zoom = d3.zoom().scaleExtent([0.25, 2.5]).on("zoom", (ev) => g.attr("transform", ev.transform));
    svg.call(zoom);
    const k = Math.max(0.55, Math.min(1, box.clientWidth / vw));
    svg.call(zoom.transform, d3.zoomIdentity.translate((box.clientWidth - vw * k) / 2, 10).scale(k));
    function info(h) { $("#treeInfo", view).innerHTML = h; }
  }

  /* ---------- atlas ---------- */
  const GRADES = { qati: ["قطعي", "مواقع ثابتة بالنص والتواتر"], rajih: ["راجح", "ترجيح أثري وتاريخي"], zanni: ["ظني", "تعيينات غير جازمة"] };
  let worldCache = null;
  async function atlas(view) {
    view.innerHTML = `<div class="wrap">
      <h1 class="page-title">الأطلس الجغرافي المحقق</h1>
      <div class="viz-legend" id="gradeFilter">${Object.entries(GRADES).map(([k, g]) => `<span class="chip toggle" data-g="${k}"><svg width="12" height="12"><circle cx="6" cy="6" r="5" class="pin ${k}"/></svg> <b>${g[0]}</b> — ${g[1]}</span>`).join("")}</div>
      <div class="viz" id="atlasViz"><div class="empty">جارٍ تحميل الخريطة…</div></div>
      <div class="info-panel" id="atlasInfo">انقر على موقع لعرض درجة توثيقه.</div>
      <div class="place-list" id="placeList"></div>
    </div>`;
    if (!worldCache) worldCache = await fetch("vendor/countries-50m.json").then((r) => r.json()).catch(() => null);
    const box = $("#atlasViz", view);
    box.innerHTML = "";
    const w = box.clientWidth, h = Math.min(Math.max(window.innerHeight - 280, 400), 680);
    const proj = d3.geoMercator().center([42, 26]).scale(w * 1.6).translate([w / 2, h / 2]);
    const path = d3.geoPath(proj);
    const svg = d3.select(box).append("svg").attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);
    svg.append("rect").attr("width", w).attr("height", h).attr("class", "sea");
    const g = svg.append("g");
    if (worldCache) {
      const land = topojson.feature(worldCache, worldCache.objects.countries);
      g.append("g").selectAll("path").data(land.features).join("path").attr("d", path).attr("class", "land");
    }
    const hidden = new Set();
    const pins = g.append("g");
    function draw(k = 1) {
      pins.selectAll("*").remove();
      X.places.filter((p) => !hidden.has(p.grade)).forEach((p) => {
        const [x, y] = proj([p.lon, p.lat]);
        pins.append("circle").attr("cx", x).attr("cy", y).attr("r", 6 / k).attr("class", "pin " + p.grade).attr("stroke-width", 2 / k)
          .on("click", () => show(p));
        pins.append("text").attr("x", x).attr("y", y - 9 / k).attr("text-anchor", "middle").attr("class", "pin-label").style("font-size", 11 / k + "px").text(p.name);
      });
    }
    function show(p) {
      $("#atlasInfo", view).innerHTML = `<b>${esc(p.name)}</b> <span class="cert">${GRADES[p.grade][0]}</span><br>${esc(p.note)}${p.people ? `<br><small>الأعلام: ${esc(p.people)}</small>` : ""}${p.ch && chapterById[p.ch] ? `<br><a href="#read-${p.ch}">التبويب: ${esc(chapterById[p.ch].title)} ←</a>` : ""}`;
    }
    let curK = 1;
    const zoom = d3.zoom().scaleExtent([0.6, 12]).on("zoom", (ev) => { g.attr("transform", ev.transform); if (Math.abs(ev.transform.k - curK) > 0.05) { curK = ev.transform.k; draw(curK); } });
    svg.call(zoom);
    draw();
    $("#gradeFilter", view).onclick = (e) => {
      const c = e.target.closest("[data-g]"); if (!c) return;
      hidden.has(c.dataset.g) ? hidden.delete(c.dataset.g) : hidden.add(c.dataset.g);
      c.classList.toggle("off"); draw(curK);
    };
    $("#placeList", view).innerHTML = Object.keys(GRADES).map((k) => `<h3 class="section-title" style="font-size:20px">${GRADES[k][0]}</h3><div class="legend">${X.places.filter((p) => p.grade === k).map((p) => `<span class="chip toggle" data-p="${p.id}"><i class="pin ${k}" style="background:var(--c-${k === "qati" ? "islamic" : k === "rajih" ? "history" : "popular"})"></i>${esc(p.name)}</span>`).join("")}</div>`).join("");
    $("#placeList", view).onclick = (e) => {
      const c = e.target.closest("[data-p]"); if (!c) return;
      const p = X.places.find((x) => x.id === c.dataset.p); show(p);
      const [x, y] = proj([p.lon, p.lat]);
      svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity.translate(w / 2 - x * 4, h / 2 - y * 4).scale(4));
      box.scrollIntoView({ behavior: "smooth", block: "center" });
    };
  }

  /* ---------- saved ---------- */
  function saved(view) {
    const d = store.data;
    const favs = Object.keys(d.favorites).filter((id) => storyIndex[id]).sort((a, b) => d.favorites[b] - d.favorites[a]);
    const marks = Object.entries(d.bookmarks).sort((a, b) => b[1].ts - a[1].ts);
    view.innerHTML = `<div class="wrap narrow">
      <h1 class="page-title">محفوظاتي</h1>
      <p class="hint">${Core.auth.user ? "متزامنة مع حسابك." : `محفوظة على هذا الجهاز — <a href="#" id="loginLink">سجّل الدخول</a> للمزامنة بين الأجهزة.`}</p>
      <h2 class="section-title">أماكن التوقف (${marks.length})</h2>
      <div class="saved-list">${marks.length ? marks.map(([k, m]) => `<div class="continue"><span style="font-size:22px">🔖</span>
        <a style="flex:1;text-decoration:none;color:inherit" href="${m.type === "book" ? `#book-${m.chapter}-p${m.page}` : `#read-${m.story || m.chapter}`}"><b>${esc(m.title)}</b><br><small>${esc(m.chTitle || "")} · ${m.type === "book" ? "وضع الكتاب" : "وضع المدونة"}</small></a>
        <button class="icon-btn" data-del="${esc(k)}" title="حذف">✕</button></div>`).join("") : `<div class="empty">لا توجد علامات بعد. استخدم زر 🔖 في القصة أو في وضع الكتاب.</div>`}</div>
      <h2 class="section-title">القصص المفضلة (${favs.length})</h2>
      <div class="article">${favs.length ? favs.map((id) => { const { story, chapter } = storyIndex[id]; return `<div class="kicker"><a href="#read-${id}">${esc(chapter.title)}</a></div>` + Reader.storyHTML(story, chapter); }).join("") : `<div class="empty" style="font-family:var(--ui);font-size:15px">لا توجد قصص مفضلة بعد. اضغط ☆ على أي قصة.</div>`}</div>
    </div>`;
    view.onclick = (e) => {
      const del = e.target.closest("[data-del]");
      if (del) { store.removeBookmark(del.dataset.del); saved(view); return; }
      if (e.target.id === "loginLink") { e.preventDefault(); Core.openAuth(); return; }
      const fav = e.target.closest('[data-act="fav"]');
      if (fav) { store.toggleFav(fav.closest(".story").dataset.id); saved(view); return; }
      const listen = e.target.closest('[data-act="listen"]');
      if (listen) { const el = listen.closest(".story"); const s = storyIndex[el.dataset.id]; Audio_.playQueue([{ el, body: el.querySelector(".body"), id: s.story.id, chapter: s.chapter.id, title: s.story.title, sub: CATS[s.story.cat].name }]); }
    };
  }

  /* ---------- search ---------- */
  const norm = (s) => String(s || "").replace(/[ً-ْٰ۟-ۭ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\{\{[^}]+\}\}/g, " ");
  let index = null;
  function buildIndex() {
    index = [];
    chapters.forEach((c) => {
      (c.stories || []).forEach((s) => index.push({ href: `#read-${s.id}`, title: s.title, ctx: c.title, cat: s.cat, text: norm(s.title + " " + (s.body || []).join(" ") + " " + (s.source || "")) }));
      (c.sections || []).forEach((s) => index.push({ href: `#read-${c.id}`, title: s.h, ctx: c.title, cat: null, text: norm(s.h + " " + (s.p || []).join(" ")) }));
    });
  }
  function search(q) {
    if (!index) buildIndex();
    const nq = norm(q).trim();
    if (nq.length < 2) return [];
    const terms = nq.split(/\s+/);
    return index.map((it) => {
      let score = 0;
      for (const t of terms) { const i = it.text.indexOf(t); if (i < 0) return null; score += norm(it.title).includes(t) ? 5 : 1; }
      const i = it.text.indexOf(terms[0]);
      return Object.assign({ score, snip: it.text.slice(Math.max(0, i - 50), i + 90) }, it);
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 40);
  }
  function wireSearch() {
    const inp = $("#searchInput"), out = $("#searchResults");
    let t;
    inp.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const res = search(inp.value);
        const terms = norm(inp.value).trim().split(/\s+/).filter(Boolean);
        out.innerHTML = res.length ? res.map((r) => `<a class="sr" href="${r.href}" style="--cat:${r.cat ? `var(--c-${r.cat})` : "var(--line)"}"><b>${esc(r.title)}</b><small>${esc(r.ctx)}</small>
          <small>…${terms.reduce((s, x) => s.split(esc(x)).join(`<mark>${esc(x)}</mark>`), esc(r.snip))}…</small></a>`).join("") : inp.value.trim().length > 1 ? `<div class="empty">لا نتائج</div>` : "";
      }, 120);
    };
    out.onclick = (e) => { if (e.target.closest("a")) Core.closeModal("searchModal"); };
  }

  window.Explore = { footer, home, compare, tree, atlas, saved, wireSearch };
})();
