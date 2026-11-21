/* branches.html — all 106 branches: search, region filter, status this week per list; tap → branch sheet */
hafmBoot(function () {
  renderShell({active: 'branches', title: t('branches'), sub: `${TOTAL_BRANCHES} ${t('branchesWord')} · ${cities().length} ${L('مدينة', 'cities')}`});
  const lists = activeLists();
  const reps = lists.map(l => ({l, rep: ensureCurrentWeek(l.id)}));
  let city = '', q = '', f = 'all', pos = cachedPosition(), byDist = false;

  const admin = isAdmin();
  const doneIn = b => reps.filter(x => x.rep.checks[b.no]).length;
  const hasBad = b => reps.some(x => { const c = x.rep.checks[b.no]; return c && Object.values(c.s || {}).some(s => statusKey(s) === 'bad'); });

  $('#page').innerHTML = `
    <div class="search-box">${ic('search')}<input class="input" id="q" type="search" placeholder="${L('ابحث بالاسم أو الاسم المتداول أو الكود أو المدير…', 'Search by name, team name, code or manager…')}"></div>
    <select class="input" id="city"><option value="">${L('كل المدن', 'All cities')} (${TOTAL_BRANCHES})</option>${cities().map(c => `<option value="${esc(c.en)}">${esc(lang === 'ar' ? c.ar : c.en)} (${c.count})</option>`).join('')}</select>
    <div class="seg" id="seg">
      <button class="on" data-f="all" type="button">${t('all')}</button>
      <button data-f="complete" type="button">${L('مكتملة', 'Complete')}</button>
      <button data-f="partial" type="button">${L('ناقصة', 'Incomplete')}</button>
      <button data-f="bad" type="button">${L('بها مشاكل', 'With problems')}</button>
    </div>
    <div class="row spread"><p class="small muted" id="count"></p>
      <div class="row" style="gap:6px">${admin ? `<button class="btn sm dark" id="addBranch" type="button">${ic('plus')} ${L('فرع جديد', 'New branch')}</button>` : ''}
      <button class="btn sm ghost" id="nearSort" type="button">${ic('nav')} ${L('الأقرب إليّ', 'Nearest to me')}</button></div></div>
    <div class="rows" id="list"></div>
    <div id="hiddenBranches"></div>`;

  function draw() {
    const arr = BRANCHES.filter(b => (!city || b.cityEn === city)
      && branchMatches(b, q)
      && (f === 'all' || (f === 'complete' ? doneIn(b) === reps.length : f === 'partial' ? doneIn(b) < reps.length : hasBad(b))));
    if (byDist && pos) arr.sort((a, c) => (geoOf(a) ? distKm(pos, geoOf(a)) : 1e9) - (geoOf(c) ? distKm(pos, geoOf(c)) : 1e9));
    $('#count').textContent = `${arr.length} / ${TOTAL_BRANCHES} ${t('branchesWord')} · ${t('thisWeek')}`;
    $('#list').innerHTML = arr.map(b => {
      const d = doneIn(b);
      return `<button class="item-row" data-no="${b.no}" type="button">
        <span class="lead ${d === reps.length ? 'done' : ''}">${d === reps.length ? ic('check') : b.no}</span>
        <div class="grow"><div class="title">${esc(bName(b))} <span class="small muted ltr">${esc(b.code)}</span></div>
        <div class="sub">${esc(cityName(b))} · ${esc(b.manager)}</div>
        <div class="row" style="gap:4px;margin-top:6px;flex-wrap:wrap">${reps.map(x => { const c = x.rep.checks[b.no]; const bad = c && Object.values(c.s || {}).some(s => statusKey(s) === 'bad');
          return `<span class="badge ${c ? (bad ? 'red' : 'ok') : ''}" title="${esc(listName(x.l))}">${ic(listIcon(x.l))}${c ? (bad ? '!' : '✓') : '…'}</span>`; }).join('')}</div></div>
        ${pos && geoOf(b) ? `<span class="dist">${fmtDist(distKm(pos, geoOf(b)))}</span>` : ''}
        <span class="trail">${ic('chevron', 'flip-ltr')}</span></button>`;
    }).join('') || `<div class="empty">${ic('search')}<b>${t('noResults')}</b></div>`;
    $$('#list .item-row').forEach(r => r.addEventListener('click', () => openBranch(branchByNo(r.dataset.no))));
    drawHidden();
  }
  /* admins: deleted branches can be brought back */
  function drawHidden() {
    const box = $('#hiddenBranches'); if (!box) return;
    const del = admin ? deletedBranches() : [];
    box.innerHTML = del.length ? sectionHead(L('فروع محذوفة', 'Deleted branches'), L('مخفية من التطبيق، وإدخالاتها السابقة محفوظة.', 'Hidden from the app; their past entries are kept.')) +
      `<div class="rows">${del.map(b => `<div class="item-row"><span class="lead">${b.no}</span><div class="grow"><div class="title">${esc(bName(b))} <span class="small muted ltr">${esc(b.code || '')}</span></div><div class="sub">${esc(cityName(b) || '')}</div></div>
        <button class="btn sm ghost" data-undel="${b.no}" type="button">${ic('refresh')} ${t('restore')}</button></div>`).join('')}</div>` : '';
    $$('[data-undel]', box).forEach(x => x.addEventListener('click', async () => {
      const no = +x.dataset.undel, e = state.branchEdits[no] || {};
      try { await persistBranch(no, e.data || {}, false); toast(L('أُعيد الفرع', 'Branch restored')); draw(); } catch (err) { toast(apiErrorText(err), 'error'); }
    }));
  }

  /* ---------- admin: add / edit / delete branches ---------- */
  async function persistBranch(no, data, deleted) {
    if (REMOTE) {
      const r = await api('hafm_save_branch', {p_token: getSession().token, p_no: no, p_data: data, p_deleted: !!deleted});
      no = r.no;
    } else if (no == null) {
      no = Math.max(0, ...BASE_BRANCHES.map(b => b.no), ...Object.keys(state.branchEdits).map(Number)) + 1;
    }
    state.branchEdits[no] = {data, deleted: !!deleted};
    applyBranchEdits(); save();
    return no;
  }
  function branchForm(b) {
    const creating = !b; b = b || {};
    const allCities = cities();
    const managers = [...new Set(BRANCHES.map(x => x.manager).filter(Boolean))].sort();
    const inList = allCities.some(c => c.en === b.cityEn);
    sheet(`<h3>${creating ? L('إضافة فرع', 'Add a branch') : L('تعديل الفرع', 'Edit branch')}${creating ? '' : ` <span class="small muted">#${b.no}</span>`}</h3>
      <form id="bf" novalidate>
        <label class="lbl">${L('كود الفرع', 'Branch code')}</label><input class="input ltr" id="bCode" value="${esc(b.code || '')}" placeholder="B130" maxlength="12">
        <label class="lbl">${L('الاسم الرسمي (كما في الإكسل)', 'Official name (as in Excel)')}</label><input class="input ltr" id="bName" value="${esc(b.name || '')}" placeholder="Mansurah" maxlength="60">
        <label class="lbl">${L('الاسم المتداول بالعربية (اختياري)', 'Team name in Arabic (optional)')}</label><input class="input" id="bAliasAr" value="${esc(b.aliasAr || '')}" placeholder="${L('مثال: فرع معن', 'e.g. فرع معن')}" maxlength="60">
        <label class="lbl">${L('الاسم المتداول بالإنجليزية (اختياري)', 'Team name in English (optional)')}</label><input class="input ltr" id="bAliasEn" value="${esc(b.aliasEn || '')}" placeholder="e.g. Maan" maxlength="60">
        <p class="hint">${L('يظهر بجانب الاسم الرسمي في كل التطبيق، ويمكن البحث به. ملفات Excel تبقى بالاسم الرسمي.', 'Shown next to the official name across the app and searchable. Excel keeps the official name.')}</p>
        <label class="lbl">${L('المدينة', 'City')}</label>
        <select class="input" id="bCity">${allCities.map(c => `<option value="${esc(c.en)}" ${c.en === b.cityEn ? 'selected' : ''}>${esc(lang === 'ar' ? c.ar : c.en)}</option>`).join('')}<option value="__new" ${b.cityEn && !inList ? 'selected' : ''}>${L('مدينة أخرى…', 'Another city…')}</option></select>
        <div id="newCity" class="${b.cityEn && !inList ? '' : 'hidden'}">
          <input class="input" id="bCityAr" value="${esc(b.cityAr || '')}" placeholder="${L('اسم المدينة بالعربية', 'City in Arabic')}" style="margin-top:8px">
          <input class="input ltr" id="bCityEn" value="${esc(b.cityEn || '')}" placeholder="City in English" style="margin-top:8px">
        </div>
        <label class="lbl">${L('مدير المنطقة', 'Area manager')}</label><input class="input ltr" id="bMgr" list="mgrs" value="${esc(b.manager || '')}" maxlength="60"><datalist id="mgrs">${managers.map(m => `<option value="${esc(m)}">`).join('')}</datalist>
        <label class="lbl">${L('الموقع (لاقتراح أقرب فرع)', 'Location (for the nearest-branch suggestion)')}</label>
        <div class="row"><input class="input ltr" id="bLat" value="${esc(b.lat != null ? b.lat : (geoOf(b) ? geoOf(b).lat : ''))}" placeholder="24.71" inputmode="decimal">
          <input class="input ltr" id="bLng" value="${esc(b.lng != null ? b.lng : (geoOf(b) ? geoOf(b).lng : ''))}" placeholder="46.68" inputmode="decimal"></div>
        <button class="btn sm ghost" id="bHere" type="button" style="margin-top:8px">${ic('nav')} ${L('استخدم موقعي الحالي (وأنت داخل الفرع)', 'Use my current location (while at the branch)')}</button>
        <p class="err" id="bErr"></p>
        <button class="btn primary block" type="submit" style="margin-top:6px">${ic('check')} ${t('save')}</button>
        ${creating ? '' : `<button class="btn ghost block" id="bDel" type="button" style="margin-top:10px;color:var(--bad)">${ic('trash')} ${L('حذف الفرع', 'Delete branch')}</button>`}
      </form>`, (w, close) => {
      $('#bCity', w).addEventListener('change', e => $('#newCity', w).classList.toggle('hidden', e.target.value !== '__new'));
      $('#bHere', w).addEventListener('click', async () => {
        try { sessionStorage.setItem('hafmList.pos', 'null'); const p2 = await getPosition(); $('#bLat', w).value = p2.lat.toFixed(6); $('#bLng', w).value = p2.lng.toFixed(6); toast(L('أُخذ موقعك الحالي', 'Current location set')); }
        catch (err) { toast(geoErrorText(err), 'error'); }
      });
      $('#bf', w).addEventListener('submit', async e => {
        e.preventDefault();
        const v = id => $(id, w).value.trim();
        const code = v('#bCode').toUpperCase(), name = v('#bName');
        let cityEn = $('#bCity', w).value, cityAr;
        if (cityEn === '__new') { cityEn = v('#bCityEn'); cityAr = v('#bCityAr'); } else cityAr = (allCities.find(c => c.en === cityEn) || {}).ar;
        const lat = v('#bLat'), lng = v('#bLng');
        const err = msg => { $('#bErr', w).textContent = msg; };
        if (!code || !name) return err(L('اكتب كود الفرع واسمه الرسمي.', 'Enter the branch code and official name.'));
        if (!cityEn || !cityAr) return err(L('اختر المدينة أو اكتب اسمها باللغتين.', 'Pick the city or type it in both languages.'));
        if (BRANCHES.some(x => x.code.toUpperCase() === code && x.no !== b.no)) return err(L('هذا الكود مستخدم لفرع آخر.', 'This code is used by another branch.'));
        if ((lat || lng) && (isNaN(+lat) || isNaN(+lng) || Math.abs(+lat) > 90 || Math.abs(+lng) > 180)) return err(L('الإحداثيات غير صحيحة.', 'Invalid coordinates.'));
        const same = BRANCHES.find(x => x.cityEn === cityEn) || {};
        const data = {code, name, aliasAr: v('#bAliasAr'), aliasEn: v('#bAliasEn'), cityEn, cityAr,
          regionEn: b.cityEn === cityEn && b.regionEn ? b.regionEn : (same.regionEn || ''), regionAr: b.cityEn === cityEn && b.regionAr ? b.regionAr : (same.regionAr || ''),
          manager: v('#bMgr'), lat: lat ? +lat : null, lng: lng ? +lng : null};
        try { await persistBranch(creating ? null : b.no, data, false); close(); toast(creating ? L('أُضيف الفرع', 'Branch added') : t('saved')); draw(); }
        catch (e2) { err(apiErrorText(e2)); }
      });
      const del = $('#bDel', w);
      if (del) del.addEventListener('click', async () => {
        const entries = state.reports.reduce((n, r) => n + (r.checks[b.no] && !r.seed ? 1 : 0), 0);
        const ok1 = await dialog({title: L(`حذف فرع «${bName(b)}»؟`, `Delete branch “${bName(b)}”?`), danger: true, okText: L('متابعة', 'Continue'),
          body: esc(L(`سيختفي الفرع من القوائم والتقارير وملفات Excel لجميع الموظفين.${entries ? ` إدخالاته السابقة (${entries}) تبقى محفوظة ويمكن إعادة الفرع لاحقاً.` : ''}`,
            `The branch disappears from lists, reports and Excel for everyone.${entries ? ` Its past entries (${entries}) are kept and the branch can be restored.` : ''}`))});
        if (!ok1) return;
        const ok2 = await dialog({title: L('تأكيد أخير', 'Final confirmation'), danger: true, okText: L('حذف الفرع', 'Delete branch'), cancelText: L('تراجع', 'Keep it'),
          body: esc(L(`هل أنت متأكد من حذف «${bName(b)}» (${b.code})؟`, `Are you sure you want to delete “${bName(b)}” (${b.code})?`))});
        if (!ok2) return;
        try {
          const data = {}; ['code', 'name', 'aliasAr', 'aliasEn', 'cityEn', 'cityAr', 'regionEn', 'regionAr', 'manager', 'lat', 'lng'].forEach(k => { if (b[k] !== undefined) data[k] = b[k]; });
          await persistBranch(b.no, data, true); close(); toast(L('حُذف الفرع', 'Branch deleted')); draw();
        } catch (e3) { toast(apiErrorText(e3), 'error'); }
      });
    });
  }

  function openBranch(b) {
    const hist = state.reports.filter(r => r.checks[b.no]).sort((a, c) => c.weekStart.localeCompare(a.weekStart)).slice(0, 6);
    sheet(`<div class="branch-card" style="margin-bottom:14px"><span class="code ltr">${esc(b.code)}</span> <span class="small" style="color:#cfc4b6">#${b.no}</span>
        <h2>${esc(bName(b))}</h2><div class="meta"><span>${ic('pin')} ${esc(cityName(b))} · ${esc(lang === 'ar' ? b.regionAr : b.regionEn)}</span><span>${ic('user')} ${esc(b.manager)}</span>${geoOf(b) ? `<a class="map-link" href="${esc(geoOf(b).maps)}" target="_blank" rel="noopener">${ic('nav')} ${L('الخريطة', 'Map')}${pos ? ' · ' + fmtDist(distKm(pos, geoOf(b))) : ''}</a>` : ''}</div></div>
      <h3>${t('thisWeek')}</h3>
      <div class="rows" style="margin-top:10px">${reps.map(x => { const c = x.rep.checks[b.no];
        const bad = c ? list2bad(x.l, c) : [];
        return `<a class="item-row" href="entry.html?list=${x.l.id}&branch=${b.no}"><span class="lead ${listTone(x.l)}">${ic(listIcon(x.l))}</span>
          <div class="grow"><div class="title">${esc(listName(x.l))}</div><div class="sub">${c ? `${esc(c.auditor || L('الملف الأصلي', 'original file'))}${bad.length ? ' · ' + bad.map(it => esc(itemLabel(it))).join('، ') : ''}` : L('لم يُدخل بعد — اضغط للبدء', 'Not entered yet — tap to start')}</div></div>
          ${c ? (bad.length ? `<span class="badge red">${bad.length}</span>` : `<span class="badge ok">${ic('check')}</span>`) : `<span class="btn sm primary">${t('start')}</span>`}</a>`; }).join('')}</div>
      ${hist.length ? `<h3 style="margin-top:18px">${L('السجل', 'History')}</h3><div class="rows" style="margin-top:10px">${hist.map(r => { const l = getList(r.checklistId); if (!l) return ''; const c = r.checks[b.no]; const bad = list2bad(l, c);
        return `<div class="item-row"><div class="grow"><div class="title">${esc(listName(l))}</div><div class="sub">${esc(weekLabel(r.weekStart))}${c.auditor ? ' · ' + esc(c.auditor) : ''}</div></div>${bad.length ? `<span class="badge red">${bad.length} ${t('notFixed')}</span>` : `<span class="badge ok">${ic('check')}</span>`}</div>`; }).join('')}</div>` : ''}
      ${admin ? `<button class="btn ghost block" id="editBranch" type="button" style="margin-top:16px">${ic('edit')} ${L('تعديل الفرع أو حذفه', 'Edit or delete branch')}</button>` : ''}
      <button class="btn ghost block" data-close style="margin-top:10px" type="button">${L('إغلاق', 'Close')}</button>`, (w, close) => {
      const eb = $('#editBranch', w); if (eb) eb.addEventListener('click', () => { close(); setTimeout(() => branchForm(b), 260); });
    });
  }
  const list2bad = (l, c) => l.items.filter(it => statusKey(c.s[it.id]) === 'bad');

  $('#nearSort').addEventListener('click', async e => {
    const btn = e.currentTarget;
    if (byDist) { byDist = false; btn.classList.remove('primary'); draw(); return; }
    btn.disabled = true;
    try { pos = await getPosition(); byDist = true; btn.classList.add('primary'); draw(); window.scrollTo({top: 0}); }
    catch (err) { toast(geoErrorText(err), 'error'); }
    btn.disabled = false;
  });
  const ab = $('#addBranch'); if (ab) ab.addEventListener('click', () => branchForm(null));
  $('#q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); draw(); });
  $('#city').addEventListener('change', e => { city = e.target.value; draw(); });
  $$('#seg button').forEach(b => b.addEventListener('click', () => { f = b.dataset.f; $$('#seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  draw();
});
