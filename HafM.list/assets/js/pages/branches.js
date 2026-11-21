/* branches.html — all 106 branches: search, region filter, status this week per list; tap → branch sheet */
(function () {
  if (!requireAuth()) return;
  renderShell({active: 'branches', title: t('branches'), sub: `${TOTAL_BRANCHES} ${t('branchesWord')} · ${cities().length} ${L('مدينة', 'cities')}`});
  const lists = activeLists();
  const reps = lists.map(l => ({l, rep: ensureCurrentWeek(l.id)}));
  let city = '', q = '', f = 'all';

  const doneIn = b => reps.filter(x => x.rep.checks[b.no]).length;
  const hasBad = b => reps.some(x => { const c = x.rep.checks[b.no]; return c && Object.values(c.s || {}).some(s => statusKey(s) === 'bad'); });

  $('#page').innerHTML = `
    <div class="search-box">${ic('search')}<input class="input" id="q" type="search" placeholder="${L('ابحث بالاسم أو الكود أو المدير…', 'Search by name, code or manager…')}"></div>
    <select class="input" id="city"><option value="">${L('كل المدن', 'All cities')} (${TOTAL_BRANCHES})</option>${cities().map(c => `<option value="${esc(c.en)}">${esc(lang === 'ar' ? c.ar : c.en)} (${c.count})</option>`).join('')}</select>
    <div class="seg" id="seg">
      <button class="on" data-f="all" type="button">${t('all')}</button>
      <button data-f="complete" type="button">${L('مكتملة', 'Complete')}</button>
      <button data-f="partial" type="button">${L('ناقصة', 'Incomplete')}</button>
      <button data-f="bad" type="button">${L('بها مشاكل', 'With problems')}</button>
    </div>
    <p class="small muted" id="count"></p>
    <div class="rows" id="list"></div>`;

  function draw() {
    const arr = BRANCHES.filter(b => (!city || b.cityEn === city)
      && (!q || b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || b.manager.toLowerCase().includes(q) || b.cityAr.includes(q))
      && (f === 'all' || (f === 'complete' ? doneIn(b) === reps.length : f === 'partial' ? doneIn(b) < reps.length : hasBad(b))));
    $('#count').textContent = `${arr.length} / ${TOTAL_BRANCHES} ${t('branchesWord')} · ${t('thisWeek')}`;
    $('#list').innerHTML = arr.map(b => {
      const d = doneIn(b);
      return `<button class="item-row" data-no="${b.no}" type="button">
        <span class="lead ${d === reps.length ? 'done' : ''}">${d === reps.length ? ic('check') : b.no}</span>
        <div class="grow"><div class="title">${esc(b.name)} <span class="small muted ltr">${esc(b.code)}</span></div>
        <div class="sub">${esc(cityName(b))} · ${esc(b.manager)}</div>
        <div class="row" style="gap:4px;margin-top:6px;flex-wrap:wrap">${reps.map(x => { const c = x.rep.checks[b.no]; const bad = c && Object.values(c.s || {}).some(s => statusKey(s) === 'bad');
          return `<span class="badge ${c ? (bad ? 'red' : 'ok') : ''}" title="${esc(listName(x.l))}">${ic(listIcon(x.l))}${c ? (bad ? '!' : '✓') : '…'}</span>`; }).join('')}</div></div>
        <span class="trail">${ic('chevron', 'flip-ltr')}</span></button>`;
    }).join('') || `<div class="empty">${ic('search')}<b>${t('noResults')}</b></div>`;
    $$('#list .item-row').forEach(r => r.addEventListener('click', () => openBranch(branchByNo(r.dataset.no))));
  }
  function openBranch(b) {
    const hist = state.reports.filter(r => r.checks[b.no]).sort((a, c) => c.weekStart.localeCompare(a.weekStart)).slice(0, 6);
    sheet(`<div class="branch-card" style="margin-bottom:14px"><span class="code ltr">${esc(b.code)}</span> <span class="small" style="color:#cfc4b6">#${b.no}</span>
        <h2>${esc(b.name)}</h2><div class="meta"><span>${ic('pin')} ${esc(cityName(b))} · ${esc(lang === 'ar' ? b.regionAr : b.regionEn)}</span><span>${ic('user')} ${esc(b.manager)}</span></div></div>
      <h3>${t('thisWeek')}</h3>
      <div class="rows" style="margin-top:10px">${reps.map(x => { const c = x.rep.checks[b.no];
        const bad = c ? list2bad(x.l, c) : [];
        return `<a class="item-row" href="entry.html?list=${x.l.id}&branch=${b.no}"><span class="lead ${listTone(x.l)}">${ic(listIcon(x.l))}</span>
          <div class="grow"><div class="title">${esc(listName(x.l))}</div><div class="sub">${c ? `${esc(c.auditor || L('الملف الأصلي', 'original file'))}${bad.length ? ' · ' + bad.map(it => esc(itemLabel(it))).join('، ') : ''}` : L('لم يُدخل بعد — اضغط للبدء', 'Not entered yet — tap to start')}</div></div>
          ${c ? (bad.length ? `<span class="badge red">${bad.length}</span>` : `<span class="badge ok">${ic('check')}</span>`) : `<span class="btn sm primary">${t('start')}</span>`}</a>`; }).join('')}</div>
      ${hist.length ? `<h3 style="margin-top:18px">${L('السجل', 'History')}</h3><div class="rows" style="margin-top:10px">${hist.map(r => { const l = getList(r.checklistId); if (!l) return ''; const c = r.checks[b.no]; const bad = list2bad(l, c);
        return `<div class="item-row"><div class="grow"><div class="title">${esc(listName(l))}</div><div class="sub">${esc(weekLabel(r.weekStart))}${c.auditor ? ' · ' + esc(c.auditor) : ''}</div></div>${bad.length ? `<span class="badge red">${bad.length} ${t('notFixed')}</span>` : `<span class="badge ok">${ic('check')}</span>`}</div>`; }).join('')}</div>` : ''}
      <button class="btn ghost block" data-close style="margin-top:16px" type="button">${L('إغلاق', 'Close')}</button>`);
  }
  const list2bad = (l, c) => l.items.filter(it => statusKey(c.s[it.id]) === 'bad');

  $('#q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); draw(); });
  $('#city').addEventListener('change', e => { city = e.target.value; draw(); });
  $$('#seg button').forEach(b => b.addEventListener('click', () => { f = b.dataset.f; $$('#seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  draw();
})();
