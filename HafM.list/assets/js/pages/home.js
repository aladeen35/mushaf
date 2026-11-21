/* home.html — dashboard: greeting, list cards (each opens its own page), daily issue, quiz, my recent entries */
hafmBoot(function () {
  renderShell({active: 'home'});
  const u = currentUser();
  const ws = currentWeekStart(), we = fmtDate(addDays(parseDate(ws), 6));
  const lists = activeLists();
  const reps = lists.map(l => ({l, rep: ensureCurrentWeek(l.id)}));
  const firstName = String(u.name).split(' ')[0];

  // week totals
  let mine = 0, open = 0, subs = 0;
  reps.forEach(({rep}) => Object.values(rep.checks).forEach(c => {
    subs++; if (c.email === u.email) mine++;
    if (Object.values(c.s || {}).some(s => statusKey(s) === 'bad')) open++;
  }));

  const listCard = ({l, rep}) => {
    const done = doneCount(rep), pct = Math.round(done / TOTAL_BRANCHES * 100);
    return `<a class="list-card tone-${listTone(l)}" href="list.html?id=${l.id}">
      <span class="go">${ic('arrow', 'arrow-ic')}</span>
      <span class="l-ic">${ic(listIcon(l))}</span>
      <h3>${esc(listName(l))}</h3>
      <span class="meta">${l.kind === 'fixed' ? t('fixed') : t('survey')} · ${l.items.length} ${t('items')}</span>
      <div class="foot"><span class="num">${done}<small>/${TOTAL_BRANCHES}</small></span><span class="badge ${pct === 100 ? 'ok' : 'teal'}">${pct}%</span></div>
      <div class="bar ${listTone(l) === 'havan' ? 'havan' : ''}"><i style="width:${pct}%"></i></div>
    </a>`;
  };

  // my recent entries
  const recent = [];
  state.reports.forEach(r => { const l = getList(r.checklistId); if (!l) return;
    Object.entries(r.checks).forEach(([no, c]) => { if (c.email === u.email && c.at) recent.push({l, r, no, c}); }); });
  recent.sort((a, b) => b.c.at.localeCompare(a.c.at));

  const hr = riyadhHour();
  $('#page').innerHTML = `
    <section class="hero">
      <div class="week-no" aria-label="${esc(weekName(ws))}"><b>${weekInfo(ws).no}</b><span>${L('الأسبوع', 'Week')}</span></div>
      <span class="eyebrow">${esc(niceDate(todayStr()))}</span>
      <h1>${hr < 12 ? t('goodMorning') : t('goodEvening')}، ${esc(firstName)}</h1>
      <p>${L('اختر قائمة لتبدأ فحص الفروع — التقرير الأسبوعي يُفتح تلقائياً.', 'Pick a list to start checking branches — the weekly report opens automatically.')}</p>
      <div class="chips"><span class="chip">${ic('calendar')} ${esc(weekLabel(ws))}</span><span class="chip">${ic('shield')} ${esc(roleName(roleOf(u.email)))}</span></div>
    </section>

    <div class="kpis">
      <div class="kpi"><b>${fmtNum(subs)}</b><span>${L('إدخالات الأسبوع', 'Entries this week')}</span></div>
      <div class="kpi havan"><b>${fmtNum(mine)}</b><span>${L('إدخالاتك', 'Your entries')}</span></div>
      <a class="kpi red" href="reports.html"><b>${fmtNum(open)}</b><span>${L('فروع بمشاكل مفتوحة', 'Branches with open issues')}</span></a>
    </div>

    ${sectionHead(t('checklists'), t('checklistsHint'), canEditLists() ? `<a class="btn sm ghost" href="admin.html">${ic('edit')} ${t('manageLists')}</a>` : '')}
    <div class="list-grid">
      ${reps.map(listCard).join('')}
      ${canEditLists() ? `<a class="list-card new" href="admin.html?new=1"><span class="plus">${ic('plus')}</span><h3>${t('newList')}</h3><span class="meta">${TOTAL_BRANCHES} ${t('branchesWord')}</span></a>` : ''}
    </div>

    ${sectionHead(t('dailyIssue'), L('تتجدد كل يوم تلقائياً — نفس المخالفة لكل الفريق.', 'Renews every day — the same issue for the whole team.'))}
    ${dailyCardHTML()}

    ${sectionHead(t('quiz'), L('سؤال عشوائي من مخالفات التدقيق — نتيجتك تُحفظ.', 'A random question from the audit issues — your score is saved.'))}
    <div class="card" id="quiz"></div>

    ${recent.length ? sectionHead(L('آخر إدخالاتك', 'Your recent entries')) + `<div class="rows">${recent.slice(0, 5).map(x => {
      const b = branchByNo(x.no); if (!b) return '';
      const bad = Object.values(x.c.s || {}).filter(s => statusKey(s) === 'bad').length;
      return `<a class="item-row" href="entry.html?list=${x.l.id}&branch=${b.no}${x.r.weekStart !== ws ? '&week=' + x.r.weekStart : ''}">
        <span class="lead ${listTone(x.l)}">${ic(listIcon(x.l))}</span>
        <div class="grow"><div class="title">${esc(b.name)} <span class="small muted">${esc(b.code)}</span></div>
        <div class="sub">${esc(listName(x.l))} · ${esc(timeAgo(x.c.at))}</div></div>
        ${bad ? `<span class="badge red">${bad} ${t('notFixed')}</span>` : `<span class="badge ok">${ic('check')}</span>`}</a>`;
    }).join('')}</div>` : ''}

    <div class="foot-note"><img src="assets/img/logo.svg" alt="">${t('appFull')} · HafM.list</div>`;
  renderQuiz($('#quiz'));
});
