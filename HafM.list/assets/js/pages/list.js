/* list.html?id=N[&city=X] — one checklist's own page: week progress → region → branch (opens entry.html) */
(function () {
  if (!requireAuth()) return;
  const list = getList(qs('id'));
  if (!list || list.archived) { location.replace('home.html'); return; }
  renderShell({active: 'home', back: 'home.html', title: listName(list), sub: list.kind === 'fixed' ? t('fixed') : t('survey')});
  const rep = ensureCurrentWeek(list.id);
  let city = qs('city');
  const allCities = cities();

  function branchRow(b) {
    const c = rep.checks[b.no];
    const bad = c ? Object.values(c.s || {}).filter(s => statusKey(s) === 'bad').length : 0;
    return `<a class="item-row" href="entry.html?list=${list.id}&branch=${b.no}">
      <span class="lead ${c ? 'done' : ''}">${c ? ic('check') : b.no}</span>
      <div class="grow"><div class="title">${esc(b.name)} <span class="small muted ltr">${esc(b.code)}</span></div>
      <div class="sub">${esc(b.manager)}${c ? ' · ' + esc(c.auditor || L('الملف الأصلي', 'original file')) : ''}</div></div>
      ${c ? (bad ? `<span class="badge red">${bad} ${ic('alert')}</span>` : `<span class="badge ok">${t('submitted')}</span>`) : `<span class="badge">${t('pending')}</span>`}
      <span class="trail">${ic('chevron', 'flip-ltr')}</span></a>`;
  }

  function render() {
    const done = doneCount(rep), pct = done / TOTAL_BRANCHES * 100;
    const head = `
      <section class="card" style="display:flex;gap:16px;align-items:center">
        ${ring(pct, 78, done)}
        <div class="grow">
          <div class="row" style="gap:8px"><span class="badge ${listTone(list) === 'havan' ? 'havan' : 'teal'}">${ic(listIcon(list))} ${list.kind === 'fixed' ? t('fixed') : t('survey')}</span>
          ${list.locked ? `<span class="badge">${ic('lock')} ${L('مدمجة', 'Built-in')}</span>` : ''}</div>
          <h2 style="font-size:20px;margin-top:6px">${esc(listName(list))}</h2>
          <p class="small muted">${t('weekRange', {a: rep.weekStart, b: rep.weekEnd})} · ${done}/${TOTAL_BRANCHES} ${t('submitted')} · ${list.items.length} ${t('items')}</p>
        </div>
      </section>
      <div class="row wrap">
        <a class="btn sm ghost" href="reports.html?list=${list.id}">${ic('chart')} ${L('تقرير الأسبوع', 'Weekly report')}</a>
        <button class="btn sm ghost" id="itemsBtn" type="button">${ic('list')} ${L('البنود', 'Items')} (${list.items.length})</button>
        ${canEditLists() && !list.locked ? `<a class="btn sm ghost" href="admin.html?edit=${list.id}">${ic('edit')} ${t('edit')}</a>` : ''}
      </div>
      <div class="steps" aria-label="steps">
        <span class="${city ? 'done' : 'on'}"><i>${city ? '✓' : '1'}</i>${L('المنطقة', 'Region')}</span><span class="sep"></span>
        <span class="${city ? 'on' : ''}"><i>2</i>${L('الفرع', 'Branch')}</span><span class="sep"></span>
        <span><i>3</i>${L('الفحص', 'Check')}</span>
      </div>`;

    let body;
    if (!city) {
      body = `${sectionHead(t('chooseRegion'), L('مرتبة حسب عدد الفروع.', 'Sorted by number of branches.'))}
        <div class="search-box">${ic('search')}<input class="input" id="q" type="search" placeholder="${L('أو ابحث مباشرة عن فرع بالاسم أو الكود…', 'Or search any branch by name or code…')}"></div>
        <div id="results" class="rows"></div>
        <div class="tiles" id="tiles">${allCities.map(c => {
          const inCity = BRANCHES.filter(b => b.cityEn === c.en), d = inCity.filter(b => rep.checks[b.no]).length;
          return `<button class="tile ${d === inCity.length ? 'complete' : ''}" data-city="${esc(c.en)}" type="button">
            <div class="t-top"><span class="t-name">${esc(lang === 'ar' ? c.ar : c.en)}</span>${d === inCity.length ? ic('check') : ic('pin')}</div>
            <span class="t-sub">${inCity.length} ${t('branchesWord')} · ${d} ${t('submitted')}</span>
            <div class="bar"><i style="width:${Math.round(d / inCity.length * 100)}%"></i></div></button>`;
        }).join('')}</div>`;
    } else {
      const c = allCities.find(x => x.en === city) || {en: city, ar: city};
      const inCity = BRANCHES.filter(b => b.cityEn === city);
      const d = inCity.filter(b => rep.checks[b.no]).length;
      body = `${sectionHead(`${lang === 'ar' ? c.ar : c.en}`, `${t('chooseBranch')} · ${d}/${inCity.length} ${t('submitted')}`,
          `<button class="btn sm ghost" id="changeCity" type="button">${ic('pin')} ${L('تغيير المنطقة', 'Change region')}</button>`)}
        ${inCity.length > 6 ? `<div class="search-box">${ic('search')}<input class="input" id="q2" type="search" placeholder="${t('search')}"></div>` : ''}
        <div class="seg" id="segF"><button class="on" data-f="all" type="button">${t('all')} ${inCity.length}</button><button data-f="pending" type="button">${t('pending')} ${inCity.length - d}</button><button data-f="done" type="button">${t('submitted')} ${d}</button></div>
        <div class="rows" id="bl"></div>`;
    }
    $('#page').innerHTML = head + body;

    $('#itemsBtn').addEventListener('click', () => sheet(`<h3>${esc(listName(list))}</h3><p class="muted small">${L('البنود التي تُفحص في كل فرع', 'Items checked at every branch')}</p>
      <div class="rows" style="margin-top:12px">${list.items.map((it, i) => `<div class="item-row"><span class="lead">${i + 1}</span><div class="grow"><div class="title">${esc(itemLabel(it))}</div>${itemSub(it) ? `<div class="sub">${esc(itemSub(it))}</div>` : ''}</div></div>`).join('')}</div>
      <p class="small muted" style="margin-top:12px">${L('الحالات', 'Statuses')}: ${statusesFor(list).map(s => esc(statusText(s))).join(' · ')}</p>`));

    if (!city) {
      $$('#tiles .tile').forEach(b => b.addEventListener('click', () => { city = b.dataset.city; history.pushState({city}, '', `list.html?id=${list.id}&city=${encodeURIComponent(city)}`); render(); window.scrollTo(0, 0); }));
      $('#q').addEventListener('input', e => {
        const q = e.target.value.trim().toLowerCase();
        $('#tiles').classList.toggle('hidden', !!q);
        $('#results').innerHTML = q ? (BRANCHES.filter(b => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || b.cityAr.includes(q) || b.cityEn.toLowerCase().includes(q)).map(branchRow).join('') || `<div class="empty">${ic('search')}<b>${t('noResults')}</b></div>`) : '';
      });
    } else {
      $('#changeCity').addEventListener('click', () => { city = null; history.pushState({}, '', `list.html?id=${list.id}`); render(); });
      let f = 'all', q = '';
      const draw = () => {
        const arr = BRANCHES.filter(b => b.cityEn === city)
          .filter(b => f === 'all' || (f === 'done' ? rep.checks[b.no] : !rep.checks[b.no]))
          .filter(b => !q || b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || b.manager.toLowerCase().includes(q));
        $('#bl').innerHTML = arr.map(branchRow).join('') || `<div class="empty">${ic('check')}<b>${t('noResults')}</b></div>`;
      };
      $$('#segF button').forEach(b => b.addEventListener('click', () => { f = b.dataset.f; $$('#segF button').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
      const q2 = $('#q2'); if (q2) q2.addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); draw(); });
      draw();
    }
  }
  window.addEventListener('popstate', () => { city = qs('city'); render(); });
  render();
})();
