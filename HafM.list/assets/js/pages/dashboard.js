/* dashboard.html[?list=N&n=4] — compare the last N weeks of one list: KPIs with change, coverage and not-fixed per week,
   week table, item × week heat table, region × week coverage, branches with recurring problems. */
hafmBoot(function () {
  renderShell({active: 'reports', back: 'reports.html', title: L('لوحة المقارنة', 'Comparison dashboard'), sub: L('مقارنة الأسابيع', 'Week-by-week comparison')});
  const lists = state.checklists.filter(l => !l.archived || reportsOf(l.id).length);
  let listId = +qs('list') || (lists[0] && lists[0].id);
  if (!getList(listId)) listId = lists[0] && lists[0].id;
  let n = qs('n') != null ? +qs('n') : 4;
  let incCur = qs('cur') === '1'; // the running week is left out by default: it is still being filled

  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  function weekStats(list, rep) {
    const c = {ok: 0, fixed: 0, bad: 0, nc: 0, na: 0}, items = list.items.map(() => ({ok: 0, fixed: 0, bad: 0, nc: 0, na: 0, n: 0}));
    let badBranches = 0, done = 0;
    const byCity = {};
    Object.entries(rep.checks).forEach(([no, ch]) => {
      const b = branchByNo(no); if (!b) return;
      done++; byCity[b.cityEn] = (byCity[b.cityEn] || 0) + 1;
      let hasBad = false;
      list.items.forEach((it, i) => { const k = statusKey(ch.s[it.id]); if (!k) return; c[k]++; items[i][k]++; items[i].n++; if (k === 'bad') hasBad = true; });
      if (hasBad) badBranches++;
    });
    const marks = c.ok + c.fixed + c.bad + c.nc + c.na;
    return {rep, done, c, marks, okPct: pct(c.ok, marks), cover: pct(done, TOTAL_BRANCHES), badBranches, items, byCity};
  }

  function render() {
    const list = getList(listId);
    const cw = currentWeekStart();
    const all = reportsOf(list.id).filter(r => Object.keys(r.checks).length && (incCur || r.weekStart !== cw));
    const weeks = (n > 0 ? all.slice(0, n) : all).map(r => weekStats(list, r)); // newest first
    history.replaceState({}, '', `dashboard.html?list=${list.id}&n=${n}${incCur ? '&cur=1' : ''}`);
    const isFixed = list.kind === 'fixed';
    const tl = isFixed ? {} : toneLabels(list);
    const okLbl = isFixed ? t('okay') : (tl.ok || L('نعم ✅', 'Yes ✅')), badLbl = isFixed ? t('notFixed') : (tl.bad || L('لا ❌', 'No ❌'));

    const head = `
      <div class="seg no-print" id="listSeg">${lists.map(l => `<button type="button" data-id="${l.id}" class="${l.id === list.id ? 'on' : ''}">${esc(listName(l))}</button>`).join('')}</div>
      <div class="row spread wrap">
        <p class="small muted">${L('عدد الأسابيع للمقارنة', 'Weeks to compare')}</p>
        <button type="button" class="chip ${incCur ? 'teal' : ''}" id="curBtn">${incCur ? ic('check') : ''} ${L('تضمين الأسبوع الحالي (جارٍ)', 'Include the running week')}</button>
        <div class="seg" id="nSeg">${[2, 4, 8, 12, 0].map(k => `<button type="button" data-n="${k}" class="${k === n ? 'on' : ''}">${k ? k : t('all')}</button>`).join('')}</div>
      </div>`;
    if (!weeks.length) {
      $('#page').innerHTML = head + `<div class="empty">${ic('chart')}<b>${L('لا توجد أسابيع بها إدخالات لهذه القائمة بعد.', 'No weeks with entries for this list yet.')}</b></div>`;
      bind(); return;
    }
    const cur = weeks[0], prev = weeks[1];
    const delta = (a, b, unit, goodUp) => {
      if (b == null) return `<span class="delta muted">${L('لا أسبوع سابق', 'no previous week')}</span>`;
      const d = a - b; if (!d) return `<span class="delta muted">= ${L('بلا تغيير', 'no change')}</span>`;
      const good = goodUp ? d > 0 : d < 0;
      return `<span class="delta ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${unit} ${good ? L('تحسّن', 'better') : L('تراجع', 'worse')}</span>`;
    };
    const asc = weeks.slice().reverse(); // oldest → newest for charts
    const wk = r => `W${weekInfo(r.weekStart).no}${r.weekStart === cw ? '*' : ''}`;
    const bars = (vals, max, cls, fmt, tip) => `<div class="vbars">${asc.map((w, i) => {
      const v = vals(w), h = max ? Math.max(v ? 3 : 0, v / max * 100) : 0;
      return `<div class="vbar" title="${esc(tip(w))}"><b class="vbar-v">${fmt(v)}</b><div class="vbar-track"><i class="${cls}" style="height:${h}%"></i></div><span class="vbar-l">${wk(w.rep)}</span></div>`;
    }).join('')}</div>`;
    const maxBad = Math.max(1, ...weeks.map(w => w.c.bad));
    const shade = p => `rgba(90,163,141,${(0.08 + p / 100 * 0.55).toFixed(2)})`;

    // branches with problems in 2+ of the selected weeks
    const rec = {};
    weeks.forEach(w => Object.entries(w.rep.checks).forEach(([no, ch]) => {
      const bad = list.items.filter(it => statusKey(ch.s[it.id]) === 'bad');
      if (bad.length && branchByNo(no)) (rec[no] = rec[no] || []).push({w: w.rep.weekStart, items: bad.map(it => itemLabel(it))});
    }));
    const recurring = Object.entries(rec).filter(([, a]) => a.length >= 2).sort((a, b) => b[1].length - a[1].length);
    const cityRows = cities().map(c => ({c, total: BRANCHES.filter(b => b.cityEn === c.en).length}));

    $('#page').innerHTML = head + `
      <section class="card">
        <p class="small muted">${L('آخر أسبوع في المقارنة', 'Latest week compared')}</p>
        <h2 style="font-size:20px">${esc(weekLabel(cur.rep.weekStart))}${cur.rep.weekStart === cw ? ` <span class="badge havan">${L('جارٍ', 'running')}</span>` : ''}</h2>
        <p class="small muted">${prev ? L('مقارنة بـ ', 'vs ') + esc(weekLabel(prev.rep.weekStart)) : ''}</p>
      </section>
      <div class="kpis kpis-4">
        <div class="kpi"><b>${cur.cover}%</b><span>${L('تغطية الفروع', 'Branch coverage')} (${cur.done}/${TOTAL_BRANCHES})</span>${delta(cur.cover, prev && prev.cover, '%', true)}</div>
        <div class="kpi"><b>${cur.okPct}%</b><span>${okLbl}</span>${delta(cur.okPct, prev && prev.okPct, '%', true)}</div>
        <div class="kpi red"><b>${cur.c.bad}</b><span>${badLbl}</span>${delta(cur.c.bad, prev && prev.c.bad, '', false)}</div>
        <div class="kpi havan"><b>${cur.badBranches}</b><span>${L('فروع بها مشاكل', 'Branches with problems')}</span>${delta(cur.badBranches, prev && prev.badBranches, '', false)}</div>
      </div>

      ${sectionHead(L('تغطية الفروع أسبوعياً', 'Weekly branch coverage'), L('نسبة الفروع التي أُدخلت من أصل ', 'Share of branches entered, out of ') + TOTAL_BRANCHES)}
      <div class="card">${bars(w => w.cover, 100, 'teal', v => v + '%', w => `${weekLabel(w.rep.weekStart)}: ${w.done}/${TOTAL_BRANCHES}`)}</div>

      ${sectionHead(L(`${badLbl} أسبوعياً`, `${badLbl} per week`), L('عدد البنود التي بقيت بلا إصلاح', 'Items left unresolved'))}
      <div class="card">${bars(w => w.c.bad, maxBad, 'red', v => String(v), w => `${weekLabel(w.rep.weekStart)}: ${w.c.bad} ${badLbl} · ${w.badBranches} ${L('فرع', 'branches')}`)}</div>

      ${sectionHead(L('مقارنة الأسابيع', 'Weeks side by side'))}
      <div class="table-wrap"><table><thead><tr><th>${t('week')}</th><th class="num">${t('submitted')}</th><th class="num">${okLbl}</th>${isFixed ? `<th class="num">${t('fixedLbl')}</th>` : ''}<th class="num">${badLbl}</th>${isFixed ? `<th class="num">${t('notChecked')}</th>` : ''}<th class="num">${t('na')}</th><th class="num">${okLbl} %</th></tr></thead><tbody>
        ${weeks.map(w => `<tr><td>${esc(weekName(w.rep.weekStart))}<br><span class="small muted">${esc(weekSpan(w.rep.weekStart))}</span></td><td class="num">${w.done}</td><td class="num">${w.c.ok}</td>${isFixed ? `<td class="num">${w.c.fixed}</td>` : ''}<td class="num">${w.c.bad ? `<span class="pill bad">${w.c.bad}</span>` : 0}</td>${isFixed ? `<td class="num">${w.c.nc}</td>` : ''}<td class="num">${w.c.na}</td><td class="num"><b>${w.okPct}%</b></td></tr>`).join('')}
      </tbody></table></div>

      ${sectionHead(L('البنود عبر الأسابيع', 'Items across weeks'), L(`نسبة «${okLbl}» لكل بند — كلما غمق اللون ارتفعت النسبة`, `Share of “${okLbl}” per item — darker = higher`))}
      <div class="table-wrap"><table><thead><tr><th>${L('البند', 'Item')}</th>${asc.map(w => `<th class="num">${wk(w.rep)}</th>`).join('')}</tr></thead><tbody>
        ${list.items.map((it, i) => `<tr><td>${esc(itemLabel(it))}</td>${asc.map(w => { const x = w.items[i], p = pct(x.ok, x.n);
          return `<td class="num heat" style="background:${x.n ? shade(p) : 'transparent'}" title="${esc(`${weekLabel(w.rep.weekStart)} — ${itemLabel(it)}: ${x.ok}/${x.n} ${okLbl}${x.bad ? ` · ${x.bad} ${badLbl}` : ''}`)}">${x.n ? p + '%' : '—'}${x.bad ? `<br><span class="pill bad">${x.bad}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>

      ${sectionHead(L('التغطية حسب المنطقة', 'Coverage by region'))}
      <div class="table-wrap"><table><thead><tr><th>${L('المنطقة', 'Region')}</th>${asc.map(w => `<th class="num">${wk(w.rep)}</th>`).join('')}</tr></thead><tbody>
        ${cityRows.map(({c, total}) => `<tr><td>${esc(lang === 'ar' ? c.ar : c.en)} <span class="small muted">(${total})</span></td>${asc.map(w => { const d = w.byCity[c.en] || 0;
          return `<td class="num heat" style="background:${shade(pct(d, total))}">${d}/${total}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>

      ${sectionHead(L('مشاكل متكررة', 'Recurring problems'), L(`فروع فيها «${badLbl}» في أسبوعين أو أكثر من الأسابيع المختارة`, `Branches with “${badLbl}” in 2+ of the selected weeks`))}
      <div class="rows">${recurring.length ? recurring.map(([no, a]) => { const b = branchByNo(no);
        return `<a class="item-row" href="branches.html"><span class="lead" style="background:var(--bad-bg);color:var(--bad)">${a.length}×</span>
          <div class="grow"><div class="title">${esc(bName(b))} <span class="small muted ltr">${esc(b.code)}</span></div>
          <div class="sub">${a.map(x => `${esc(weekName(x.w))}: ${x.items.map(esc).join('، ')}`).join(' · ')}</div></div></a>`; }).join('')
        : `<div class="empty">${ic('check')}<b>${L('لا مشاكل متكررة في هذه الأسابيع', 'No recurring problems in these weeks')}</b></div>`}</div>

      <p class="hint">${L('الأسابيع المستوردة من ملفات Excel والواتساب تظهر باسم «الملف الأصلي» أو «رسالة الواتساب».', 'Weeks imported from Excel files and WhatsApp show the auditor as “original file” or “WhatsApp”.')}</p>`;
    bind();
  }
  function bind() {
    $$('#listSeg button').forEach(b => b.addEventListener('click', () => { listId = +b.dataset.id; render(); }));
    const cb = $('#curBtn'); if (cb) cb.addEventListener('click', () => { incCur = !incCur; render(); });
    $$('#nSeg button').forEach(b => b.addEventListener('click', () => { n = +b.dataset.n; render(); }));
    const on = $('#listSeg .on'); if (on) on.scrollIntoView({inline: 'center', block: 'nearest'});
  }
  render();
});
