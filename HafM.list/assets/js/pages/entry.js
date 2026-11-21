/* entry.html?list=N&branch=NO[&week=YYYY-MM-DD] — fill one branch for one checklist (separate page) */
(function () {
  if (!requireAuth()) return;
  const list = getList(qs('list')), b = branchByNo(qs('branch'));
  if (!list || !b) { location.replace('home.html'); return; }
  const weekParam = qs('week');
  const rep = (weekParam && state.reports.find(r => r.checklistId === list.id && r.weekStart === weekParam)) || ensureCurrentWeek(list.id);
  const isPast = rep.weekStart !== currentWeekStart();
  const backUrl = `list.html?id=${list.id}&city=${encodeURIComponent(b.cityEn)}`;
  renderShell({active: 'home', back: backUrl, title: b.name, sub: listName(list)});
  const u = currentUser();
  const sts = statusesFor(list);
  const existing = rep.checks[b.no];
  let draft = existing ? {s: Object.assign({}, existing.s), remarks: existing.remarks || ''} : {s: {}, remarks: ''};
  let dirty = false;

  const filledCount = () => list.items.filter(it => draft.s[it.id] != null && draft.s[it.id] !== '').length;
  const inCity = BRANCHES.filter(x => x.cityEn === b.cityEn);
  const idx = inCity.findIndex(x => x.no === b.no);
  const prevB = inCity[(idx - 1 + inCity.length) % inCity.length], nextB = inCity[(idx + 1) % inCity.length];
  const link = x => `entry.html?list=${list.id}&branch=${x.no}${isPast ? '&week=' + rep.weekStart : ''}`;

  function render() {
    const f = filledCount(), n = list.items.length;
    $('#page').innerHTML = `
      <section class="branch-card">
        <span class="code ltr">${esc(b.code)}</span> <span class="small" style="color:#cfc4b6">#${b.no}</span>
        <h2>${esc(b.name)}</h2>
        <div class="meta">
          <span>${ic('pin')} ${esc(cityName(b))} · ${esc(lang === 'ar' ? b.regionAr : b.regionEn)}</span>
          <span>${ic('user')} ${esc(b.manager)}</span>
          <span>${ic('clipboard')} ${esc(listName(list))}</span>
          <span>${ic('calendar')} ${isPast ? t('weekRange', {a: rep.weekStart, b: rep.weekEnd}) : esc(D(todayStr()))}</span>
        </div>
      </section>
      ${isPast ? `<div class="card cream flat small">${ic('alert')} ${L('تعدّل تقرير أسبوع سابق.', 'You are editing a past week’s report.')}</div>` : ''}
      ${existing ? `<div class="card cream flat small">${ic('check')} ${L('أُدخل', 'Submitted')} ${existing.auditor ? L('بواسطة', 'by') + ' <b>' + esc(existing.auditor) + '</b>' : L('من الملف الأصلي', 'from the original file')} ${existing.at && !existing.seed ? '· ' + esc(timeAgo(existing.at)) : ''} — ${L('يمكنك التعديل والحفظ.', 'you can edit and save.')}</div>` : ''}
      <div class="row spread">
        <div class="fill-meter grow"><span>${f}/${n}</span><div class="bar"><i style="width:${n ? f / n * 100 : 0}%"></i></div></div>
      </div>
      <div class="row wrap no-print">
        <button class="btn sm primary" id="allOk" type="button">${ic('check')} ${t('markAllOk')}</button>
        <button class="btn sm ghost" id="copyPrev" type="button">${ic('copy')} ${t('copyPrev')}</button>
        <button class="btn sm ghost" id="clear" type="button">${ic('x')} ${t('clear')}</button>
      </div>
      <div class="stack" id="items">
        ${list.items.map((it, i) => {
          const v = draft.s[it.id]; const k = statusKey(v);
          return `<div class="q-card ${k ? 'filled' : ''} ${k === 'bad' ? 'flag' : ''}">
            <div class="q-head"><span class="q-num">${k ? ic('check') : i + 1}</span><div class="grow"><h3>${esc(itemLabel(it))}</h3>${itemSub(it) ? `<p>${esc(itemSub(it))}</p>` : ''}</div></div>
            <div class="st-grid ${list.kind === 'survey' ? 'three' : ''}">${sts.map((s, si) => `<button type="button" class="st-btn ${list.kind === 'survey' ? 'big' : ''} ${v === s ? 'sel-' + statusKey(s) : ''}" data-item="${esc(it.id)}" data-sidx="${si}" aria-pressed="${v === s}">${list.kind === 'survey' ? esc(s) : esc(statusText(s))}</button>`).join('')}</div>
            ${k === 'bad' ? `<div class="warn">${ic('alert')} ${list.kind === 'survey' ? t('deviation') : t('notFixedWarn')}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
      <div>
        <label class="lbl" for="remarks">${t('remarks')}</label>
        <textarea class="input" id="remarks" rows="3" placeholder="${t('remarksPh')}">${esc(draft.remarks)}</textarea>
        <p class="hint">${t('auditor')}: <b>${esc(u.name)}</b> · ${esc(u.email)}</p>
      </div>
      <div class="sticky-actions no-print">
        <button class="btn primary" id="saveBtn" type="button">${ic('check')} ${t('save')}</button>
        <button class="btn dark" id="saveNextBtn" type="button">${t('saveNext')} ${ic('chevron', 'flip-ltr')}</button>
      </div>
      <div class="row spread no-print" style="margin-top:6px">
        <a class="btn sm ghost" href="${link(prevB)}">${ic('back', 'flip-ltr')} ${esc(prevB.name)}</a>
        <a class="btn sm ghost" href="${link(nextB)}">${esc(nextB.name)} ${ic('chevron', 'flip-ltr')}</a>
      </div>`;
    bind();
  }
  function bind() {
    $$('.st-btn').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.item, s = sts[+btn.dataset.sidx];
      draft.s[id] = draft.s[id] === s ? null : s; dirty = true; keepRemarks(); render();
    }));
    $('#remarks').addEventListener('input', e => { draft.remarks = e.target.value; dirty = true; });
    $('#allOk').addEventListener('click', () => { keepRemarks(); list.items.forEach(it => { draft.s[it.id] = list.kind === 'survey' ? '✅' : 'Okay'; }); dirty = true; render(); });
    $('#clear').addEventListener('click', () => { draft = {s: {}, remarks: ''}; dirty = true; render(); });
    $('#copyPrev').addEventListener('click', () => {
      const prev = reportsOf(list.id).filter(r => r.id !== rep.id && r.weekStart < rep.weekStart && r.checks[b.no])[0];
      if (!prev) { toast(t('noPrev'), 'error'); return; }
      const pc = prev.checks[b.no]; draft = {s: Object.assign({}, pc.s), remarks: pc.remarks || ''}; dirty = true; render();
      toast(L(`نُسخ من أسبوع ${D(prev.weekStart)}`, `Copied from week ${prev.weekStart}`));
    });
    $('#saveBtn').addEventListener('click', () => doSave(false));
    $('#saveNextBtn').addEventListener('click', () => doSave(true));
  }
  const keepRemarks = () => { const r = $('#remarks'); if (r) draft.remarks = r.value; };
  async function doSave(goNext) {
    keepRemarks();
    const missing = list.items.length - filledCount();
    if (missing === list.items.length && !draft.remarks.trim()) { toast(L('اختر حالة بند واحد على الأقل.', 'Choose at least one item status.'), 'error'); return; }
    if (missing > 0 && !(await dialog({title: L('بنود ناقصة', 'Missing items'), body: esc(t('incomplete', {n: missing})), okText: t('save')}))) return;
    const s = {}; list.items.forEach(it => { s[it.id] = draft.s[it.id] == null ? null : draft.s[it.id]; });
    rep.checks[b.no] = {s, remarks: draft.remarks.trim(), auditor: u.name, email: u.email, at: new Date().toISOString(),
      history: ((existing && existing.history) || []).concat(existing && existing.auditor ? [{auditor: existing.auditor, at: existing.at}] : []).slice(-5)};
    save(); dirty = false;
    toast(t('saved') + ' — ' + b.name);
    if (goNext) {
      const after = inCity.slice(idx + 1).concat(inCity.slice(0, idx));
      const nxt = after.find(x => !rep.checks[x.no]);
      if (nxt) setTimeout(() => go(link(nxt)), 350);
      else { toast(L('اكتملت كل فروع المنطقة 🎉', 'All branches in this region are done 🎉')); setTimeout(() => go(backUrl), 900); }
    } else setTimeout(() => go(backUrl), 500);
  }
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  render();
})();
