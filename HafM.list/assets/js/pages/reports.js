/* reports.html[?list=N&week=YYYY-MM-DD] — weekly report per list: KPIs, distribution, problems, by item, by city, auditors, pending, Excel */
hafmBoot(function () {
  renderShell({active: 'reports', title: t('reports'), sub: L('تقارير أسبوعية لكل قائمة', 'Weekly reports per list')});
  const lists = state.checklists.filter(l => !l.archived || reportsOf(l.id).length);
  let listId = +qs('list') || (lists[0] && lists[0].id);
  if (!getList(listId)) listId = lists[0].id;
  let week = qs('week');

  function render() {
    const list = getList(listId);
    if (!list.archived) ensureCurrentWeek(list.id);
    const reps = reportsOf(list.id);
    if (!week || !reps.find(r => r.weekStart === week)) week = reps[0] && reps[0].weekStart;
    const rep = reps.find(r => r.weekStart === week);
    history.replaceState({}, '', `reports.html?list=${list.id}&week=${week}`);
    const checks = rep ? Object.entries(rep.checks).filter(([no]) => branchByNo(no)) : [];
    const cnt = {ok: 0, fixed: 0, bad: 0, nc: 0, na: 0, empty: 0};
    const perItem = list.items.map(() => ({ok: 0, fixed: 0, bad: 0, nc: 0, na: 0}));
    const problems = [], auditors = {};
    checks.forEach(([no, c]) => {
      const bad = [];
      list.items.forEach((it, i) => { const k = statusKey(c.s[it.id]); if (k) { cnt[k]++; perItem[i][k]++; if (k === 'bad') bad.push(it); } else cnt.empty++; });
      if (bad.length) problems.push({b: branchByNo(no), c, bad});
      const a = c.auditor || L('الملف الأصلي', 'Original file'); auditors[a] = (auditors[a] || 0) + 1;
    });
    const totalMarks = cnt.ok + cnt.fixed + cnt.bad + cnt.nc + cnt.na;
    const pctOf = k => totalMarks ? (cnt[k] / totalMarks * 100) : 0;
    const done = checks.length;
    const pendingByCity = cities().map(c => ({c, list: BRANCHES.filter(b => b.cityEn === c.en && !(rep && rep.checks[b.no]))})).filter(x => x.list.length);
    const isFixed = list.kind === 'fixed';
    const lbl = {ok: isFixed ? t('okay') : L('نعم ✅', 'Yes ✅'), fixed: t('fixedLbl'), bad: isFixed ? t('notFixed') : L('لا ❌', 'No ❌'), nc: t('notChecked'), na: t('na')};
    const keys = isFixed ? ['ok', 'fixed', 'bad', 'nc', 'na'] : ['ok', 'bad', 'na'];

    $('#page').innerHTML = `
      <div class="seg no-print" id="listSeg">${lists.map(l => `<button type="button" data-id="${l.id}" class="${l.id === list.id ? 'on' : ''}">${esc(listName(l))}</button>`).join('')}</div>
      <div class="card">
        <div class="row spread wrap">
          <div><span class="badge ${listTone(list) === 'havan' ? 'havan' : 'teal'}">${ic(listIcon(list))} ${list.kind === 'fixed' ? t('fixed') : t('survey')}</span>
            <h2 style="font-size:20px;margin-top:6px">${esc(listName(list))}</h2></div>
          ${ring(done / TOTAL_BRANCHES * 100, 72)}
        </div>
        <label class="lbl" for="weekSel">${t('week')}</label>
        <select class="input" id="weekSel">${reps.map(r => `<option value="${r.weekStart}" ${r.weekStart === week ? 'selected' : ''}>${esc(weekLabel(r.weekStart))}${r.weekStart === currentWeekStart() ? ' · ' + t('thisWeek') : ''}${r.seed ? ' · ' + L('الملف الأصلي', 'original file') : ''}</option>`).join('')}</select>
        <div class="row wrap no-print" style="margin-top:14px">
          <button class="btn primary" id="xlsBtn" type="button" ${rep ? '' : 'disabled'}>${ic('download')} ${t('exportExcel')}</button>
          <button class="btn dark" id="xlsAllBtn" type="button">${ic('download')} ${L('Excel لكل القوائم والموظفين', 'Excel: all lists & auditors')}</button>
          <button class="btn ghost" id="printBtn" type="button">${ic('printer')} ${t('print')}</button>
        </div>
        <p class="hint">${list.slug === 'beverage' ? L('ملف Excel بنفس قالب «All_Branches» الأصلي: الألوان، القوائم المنسدلة، المعادلات، والعمود D مخفي.', 'Excel in the original “All_Branches” template: colours, drop-downs, formulas, hidden column D.') : L('ملف Excel بنفس تنسيق قالب المشروبات مع أعمدة بنود هذه القائمة.', 'Excel in the beverage template style with this list’s item columns.')}</p>
        ${rep && rep.seed ? `<p class="hint">${ic('alert')} ${L(`تقرير مأخوذ من الملف الأصلي: التاريخ داخل الإكسل ${D('2026-11-01')} بينما اسم الملف يقول 14–20 نوفمبر 2026.`, 'From the original file: its date cell said 2026-11-01 while its name said 14–20 Nov 2026.')}</p>` : ''}
      </div>

      <div class="kpis">
        <div class="kpi"><b>${done}<small style="font-size:14px;color:var(--muted)">/${TOTAL_BRANCHES}</small></b><span>${L('فروع مُرسلة', 'Branches submitted')}</span></div>
        <div class="kpi"><b>${fmtNum(cnt.ok)}</b><span>${lbl.ok}</span></div>
        <div class="kpi red"><b>${fmtNum(cnt.bad)}</b><span>${lbl.bad}</span></div>
      </div>

      <div class="card">
        <h3>${L('توزيع الحالات', 'Status distribution')}</h3>
        <div class="stack-bar" style="margin-top:12px">${keys.map(k => `<i class="${k}" style="width:${pctOf(k)}%" title="${lbl[k]} ${cnt[k]}"></i>`).join('')}</div>
        <div class="legend">${keys.map(k => `<span><i class="${k}" style="background:var(--${k === 'ok' ? 'ok' : k === 'fixed' ? 'fx' : k === 'bad' ? 'bad' : k === 'nc' ? 'nc' : 'na'})"></i>${lbl[k]} <b>${cnt[k]}</b></span>`).join('')}</div>
      </div>

      ${sectionHead(L('المشاكل غير المُصلحة', 'Open (not fixed) problems'), problems.length ? L(`${problems.length} فرع يحتاج متابعة`, `${problems.length} branch(es) need follow-up`) : '')}
      <div class="rows">${problems.length ? problems.map(p => `<a class="item-row" href="entry.html?list=${list.id}&branch=${p.b.no}${week !== currentWeekStart() ? '&week=' + week : ''}">
          <span class="lead" style="background:var(--bad-bg);color:var(--bad)">${ic('alert')}</span>
          <div class="grow"><div class="title">${esc(bName(p.b))} <span class="small muted ltr">${esc(p.b.code)}</span></div>
          <div class="sub">${p.bad.map(it => esc(itemLabel(it))).join(' · ')}${p.c.remarks ? ' — «' + esc(p.c.remarks) + '»' : ''}</div></div>
          ${p.c.auditor ? `<span class="badge">${esc(p.c.auditor)}</span>` : ''}</a>`).join('')
        : `<div class="empty">${ic('check')}<b>${L('لا مشاكل غير مصلحة', 'No open problems')}</b></div>`}</div>

      ${sectionHead(L('الملخص حسب البند', 'Summary by item'))}
      <div class="table-wrap"><table><thead><tr><th>${L('البند', 'Item')}</th>${keys.map(k => `<th class="num">${lbl[k]}</th>`).join('')}</tr></thead><tbody>
        ${list.items.map((it, i) => `<tr><td>${esc(itemLabel(it))}</td>${keys.map(k => `<td class="num">${perItem[i][k] ? `<span class="pill ${k}">${perItem[i][k]}</span>` : '<span class="muted">0</span>'}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>

      ${sectionHead(L('التقدم حسب المنطقة', 'Progress by region'))}
      <div class="table-wrap"><table><thead><tr><th>${L('المنطقة', 'Region')}</th><th class="num">${t('submitted')}</th><th style="min-width:120px">${t('progress')}</th></tr></thead><tbody>
        ${cities().map(c => { const all = BRANCHES.filter(b => b.cityEn === c.en), d = all.filter(b => rep && rep.checks[b.no]).length;
          return `<tr><td>${esc(lang === 'ar' ? c.ar : c.en)}</td><td class="num">${d}/${all.length}</td><td><div class="bar"><i style="width:${d / all.length * 100}%"></i></div></td></tr>`; }).join('')}
      </tbody></table></div>

      ${sectionHead(L('الفاحصون', 'Auditors'))}
      <div class="rows">${Object.keys(auditors).length ? Object.entries(auditors).sort((a, b) => b[1] - a[1]).map(([a, n], i) => `<div class="item-row"><span class="lead ${i === 0 ? 'havan' : ''}">${i === 0 ? ic('star') : esc(initials(a))}</span><div class="grow"><div class="title">${esc(a)}</div></div><span class="badge teal">${n} ${t('branchesWord')}</span></div>`).join('') : `<div class="empty">${ic('users')}<b>—</b></div>`}</div>

      ${sectionHead(L('فروع لم تُدخل', 'Pending branches'), `${TOTAL_BRANCHES - done} ${t('branchesWord')}`)}
      <div class="rows">${pendingByCity.map(x => `<details class="card flat"><summary class="row spread" style="cursor:pointer"><b>${esc(lang === 'ar' ? x.c.ar : x.c.en)}</b><span class="badge">${x.list.length}</span></summary>
        <div class="small muted" style="margin-top:8px">${x.list.map(b => `<a href="entry.html?list=${list.id}&branch=${b.no}${week !== currentWeekStart() ? '&week=' + week : ''}" style="text-decoration:underline">${esc(bName(b))}</a>`).join(' · ')}</div></details>`).join('') || `<div class="empty">${ic('check')}<b>${L('كل الفروع أُدخلت 🎉', 'All branches submitted 🎉')}</b></div>`}</div>`;

    $$('#listSeg button').forEach(b => b.addEventListener('click', () => { listId = +b.dataset.id; week = null; render(); }));
    $('#weekSel').addEventListener('change', e => { week = e.target.value; render(); });
    $('#printBtn').addEventListener('click', () => window.print());
    $('#xlsAllBtn').addEventListener('click', async e => {
      const btn = e.currentTarget; btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = L('جارٍ التجهيز…', 'Preparing…');
      try { await exportAll(week); toast(L('تم تنزيل ملف كل القوائم', 'All-lists Excel downloaded')); }
      catch (err) { console.error(err); toast(L('تعذّر تحميل مكتبة Excel — تحقق من الاتصال.', 'Could not load the Excel library — check your connection.'), 'error'); }
      btn.disabled = false; btn.innerHTML = old;
    });
    $('#xlsBtn').addEventListener('click', async e => {
      const btn = e.currentTarget; btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = L('جارٍ التجهيز…', 'Preparing…');
      try { await exportReport(list, rep); toast(L('تم تنزيل ملف Excel', 'Excel file downloaded')); }
      catch (err) { console.error(err); toast(L('تعذّر تحميل مكتبة Excel — تحقق من الاتصال.', 'Could not load the Excel library — check your connection.'), 'error'); }
      btn.disabled = false; btn.innerHTML = old;
    });
    const on = $('#listSeg .on'); if (on) on.scrollIntoView({inline: 'center', block: 'nearest'});
  }
  render();
});
