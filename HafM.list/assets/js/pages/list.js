/* list.html?id=N[&city=X] — one checklist's own page: week progress → region → branch (opens entry.html) */
hafmBoot(function () {
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
      ${c && c.pending ? `<span class="badge pending">${ic('cloud')} ${L('بانتظار الإرسال', 'Not sent yet')}</span>` : c ? (bad ? `<span class="badge red">${bad} ${ic('alert')}</span>` : `<span class="badge ok">${t('submitted')}</span>`) : `<span class="badge">${t('pending')}</span>`}
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
          <p class="small muted">${esc(weekLabel(rep.weekStart))} · ${done}/${TOTAL_BRANCHES} ${t('submitted')} · ${list.items.length} ${t('items')}</p>
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
      body = `<section class="card near" id="near">
          <div class="row"><span class="lead teal" style="width:44px;height:44px;border-radius:14px;display:grid;place-items:center;flex:none">${ic('nav')}</span>
            <div class="grow"><h3>${L('اقتراح الفرع حسب موقعك', 'Suggest a branch from your location')}</h3><p class="small muted">${L('يُحدَّد أقرب فرع من مواقع الفروع على خرائط Google.', 'Finds the closest branch from the branches’ Google Maps locations.')}</p></div></div>
          <div id="nearOut"></div>
          <button class="btn primary block" id="nearBtn" type="button" style="margin-top:12px">${ic('pin')} ${L('حدد موقعي', 'Use my location')}</button>
        </section>
        ${sectionHead(t('chooseRegion'), L('مرتبة حسب عدد الفروع.', 'Sorted by number of branches.'))}
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
      const showNear = pos => {
        const near = nearestBranches(pos, 3);
        const at = near[0] && near[0].km < 0.35;
        $('#nearOut').innerHTML = `${at ? `<p class="near-hit">${ic('check')} ${L('أنت في فرع', 'You are at')} <b>${esc(near[0].b.name)}</b></p>` : ''}
          <div class="rows" style="margin-top:10px">${near.map((x, i) => { const c = rep.checks[x.b.no];
            return `<a class="item-row ${i === 0 ? 'near-first' : ''}" href="entry.html?list=${list.id}&branch=${x.b.no}">
              <span class="lead ${i === 0 ? 'done' : ''}">${i === 0 ? ic('pin') : x.b.no}</span>
              <div class="grow"><div class="title">${esc(x.b.name)} <span class="small muted ltr">${esc(x.b.code)}</span></div>
              <div class="sub">${esc(cityName(x.b))} · ${fmtDist(x.km)}${i === 0 ? ' · ' + L('الأقرب إليك', 'closest to you') : ''}${c ? ' · ' + t('submitted') : ''}</div></div>
              <span class="btn sm ${i === 0 ? 'primary' : 'ghost'}">${c ? t('edit') : t('start')}</span></a>`; }).join('')}</div>
          ${pos.acc > 500 ? `<p class="hint">${L('دقة الموقع ضعيفة', 'Low accuracy')} (±${fmtDist(pos.acc / 1000)})</p>` : ''}`;
        $('#nearBtn').innerHTML = `${ic('refresh')} ${L('تحديث الموقع', 'Refresh location')}`;
      };
      $('#nearBtn').addEventListener('click', async () => {
        const btn = $('#nearBtn'); btn.disabled = true; btn.innerHTML = L('جارٍ تحديد الموقع…', 'Locating…');
        try { sessionStorage.setItem('hafmList.pos', 'null'); showNear(await getPosition()); }
        catch (err) { $('#nearOut').innerHTML = `<p class="err">${esc(geoErrorText(err))}</p>`; btn.innerHTML = `${ic('pin')} ${L('حدد موقعي', 'Use my location')}`; }
        btn.disabled = false;
      });
      const cp = cachedPosition(); if (cp) showNear(cp);
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
});
