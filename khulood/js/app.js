/* app: router, chrome, settings wiring, service worker */
(function () {
  const { $, $$, esc, chapters, settings, saveSettings } = Core;
  const view = $("#view");

  function drawer(open) {
    $("#drawer").classList.toggle("open", open);
    $("#scrim").classList.toggle("on", open);
  }
  $("#menuBtn").onclick = () => drawer(true);
  $("#scrim").onclick = () => drawer(false);
  $("#toc").innerHTML = `<div class="drawer-links"><a href="#home">الرئيسية</a><a href="#compare">المقارنة</a><a href="#tree">الأنساب</a><a href="#atlas">الأطلس</a><a href="#saved">محفوظاتي</a><a href="#book-${(chapters[0] || {}).id}">وضع الكتاب</a></div>` +
    chapters.map((c) => `<li><a href="#read-${c.id}" data-ch="${c.id}"><span class="n">${esc(c.num)}</span><span>${esc(c.title)}</span></a></li>`).join("");
  $("#toc").onclick = (e) => { if (e.target.closest("a")) drawer(false); };

  function route() {
    // routes: #home #read-ch05 #read-ch05-s12 #book-ch05 #book-ch05-p14 #compare-flood #tree #atlas #saved
    const h = location.hash.replace(/^#\/?/, "");
    const m = /^([a-z]+)(?:-(.*))?$/.exec(h) || [];
    const r = m[1] === "home" ? "" : m[1], rest = m[2] || "";
    let a = rest, b;
    if (r === "read") { a = rest.slice(0, 4); b = rest.length > 4 ? rest : undefined; }
    if (r === "book") { const bm = /^(ch\d\d)(?:-p(\d+))?$/.exec(rest) || []; a = bm[1]; b = bm[2]; }
    $$("[data-nav]").forEach((x) => x.classList.toggle("on", x.dataset.nav === (r || "home")));
    $$("#toc a[data-ch]").forEach((x) => x.classList.toggle("on", x.dataset.ch === a));
    view.onclick = null;
    if (r === "read") Reader.renderChapter(view, a, b);
    else if (r === "book") Book3D.render(view, a, b != null ? +b : null);
    else if (r === "compare") Explore.compare(view, a);
    else if (r === "tree") Explore.tree(view);
    else if (r === "atlas") Explore.atlas(view);
    else if (r === "saved") Explore.saved(view);
    else Explore.home(view);
    if (r !== "read") window.scrollTo(0, 0);
    document.body.dataset.route = r || "home";
    const lc = (Core.store.data.progress || {}).lastChapter || (chapters[0] || {}).id;
    $("#tabRead").href = "#read-" + ((r === "read" || r === "book") && a ? a : lc);
    $("#tabBook").href = "#book-" + ((r === "read" || r === "book") && a ? a : lc);
  }
  window.addEventListener("hashchange", route);
  Core.store.on(() => { if ((location.hash || "").startsWith("#saved")) Explore.saved(view); });

  /* settings */
  $("#settingsBtn").onclick = () => {
    $("#setFont").value = settings.font;
    $$("#setTheme button").forEach((b) => b.classList.toggle("on", b.dataset.v === settings.theme));
    $("#setRecite").checked = !!settings.recite;
    $("#setReciter").value = settings.reciter;
    Audio_.loadVoices();
    Core.openModal("settingsModal");
  };
  $("#setFont").oninput = (e) => { settings.font = +e.target.value; saveSettings(); };
  $("#setFont").onchange = () => { if (location.hash.startsWith("#book")) route(); };
  $("#setTheme").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    settings.theme = settings.theme === b.dataset.v ? "auto" : b.dataset.v; saveSettings();
    $$("#setTheme button").forEach((x) => x.classList.toggle("on", x.dataset.v === settings.theme));
  };
  $("#setVoice").onchange = (e) => { settings.voice = e.target.value; saveSettings(); };
  $("#setRecite").onchange = (e) => { settings.recite = e.target.checked; saveSettings(); };
  $("#setReciter").onchange = (e) => { settings.reciter = e.target.value; saveSettings(); };

  $("#authBtn").onclick = Core.openAuth;
  $("#searchBtn").onclick = () => { Core.openModal("searchModal"); setTimeout(() => $("#searchInput").focus(), 30); };
  Explore.wireSearch();

  window.App = { drawer, route };
  Core.initFirebase();
  route();

  if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|claudeusercontent/.test(location.hostname)) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
