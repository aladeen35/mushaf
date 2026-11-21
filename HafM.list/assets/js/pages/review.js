/* review.html — 56 quality-audit issues (bilingual) with search + level filter, plus quiz */
hafmBoot(function () {
  renderShell({active: 'review', title: t('review'), sub: L('مخالفات تدقيق الجودة — تدريب ومراجعة', 'Quality-audit issues — training & review')});
  const n = lvl => AUDIT_ISSUES.filter(i => i.levelEn === lvl).length;
  let level = 'all', q = '';
  $('#page').innerHTML = `
    ${dailyCardHTML()}
    <div class="card" id="quiz"></div>
    ${sectionHead(L('دليل المخالفات', 'Issue guide'), L('56 مخالفة من دليل إدارة ضمان الجودة — مبسطة وباللغتين.', '56 issues from the Quality Assurance guide — simplified, bilingual.'))}
    <div class="search-box">${ic('search')}<input class="input" id="q" type="search" placeholder="${L('ابحث بالعنوان أو الكود أو الوصف…', 'Search by title, code or description…')}"></div>
    <div class="seg" id="seg">
      <button class="on" data-l="all" type="button">${t('all')} ${AUDIT_ISSUES.length}</button>
      <button data-l="Critical" type="button">🔴 ${t('critical')} ${n('Critical')}</button>
      <button data-l="Major" type="button">🟡 ${t('major')} ${n('Major')}</button>
      <button data-l="Minor" type="button">🟢 ${t('minor')} ${n('Minor')}</button>
    </div>
    <p class="small muted" id="count"></p>
    <div class="stack" id="issues"></div>`;
  renderQuiz($('#quiz'));
  function draw() {
    const arr = AUDIT_ISSUES.filter(i => (level === 'all' || i.levelEn === level) && (!q
      || [i.code, i.titleEn, i.titleAr, i.descEn, i.descAr, i.exampleEn, i.exampleAr].some(x => x && String(x).toLowerCase().includes(q))));
    $('#count').textContent = `${arr.length} / ${AUDIT_ISSUES.length}`;
    $('#issues').innerHTML = arr.map(i => {
      const other = lang === 'ar' ? i.titleEn : i.titleAr;
      return `<article class="issue">
        <div class="top"><span class="code ltr">${esc(i.code)}</span><span class="level ${i.levelEn}">${levelName(i.levelEn)}</span></div>
        <h3>${esc(issueTitle(i))}</h3>${other ? `<div class="alt">${esc(other)}</div>` : ''}
        ${i.descEn ? `<p style="margin-top:8px">${esc(issueDesc(i))}</p>
          <details><summary>${ic('sparkle')} ${t('example')} · ${L('الإنجليزية', 'Arabic')}</summary>
            <div class="ex">💡 ${esc(issueExample(i))}</div>
            <p class="small muted" style="margin-top:8px">${esc(lang === 'ar' ? i.descEn : i.descAr)}</p>
            <p class="small muted">${esc(lang === 'ar' ? i.exampleEn : i.exampleAr)}</p></details>`
        : `<p class="small muted" style="margin-top:8px">${L('عنوان فقط في الدليل الأصلي — تُعرض دون شرح مخترع.', 'Title only in the original guide — shown without an invented description.')}</p>
          ${i.details && i.details.length > 2 ? `<details><summary>${L('نص الشريحة', 'Slide text')}</summary><div class="ex small">${i.details.slice(2).map(esc).join(' · ')}</div></details>` : ''}`}
      </article>`;
    }).join('') || `<div class="empty">${ic('search')}<b>${t('noResults')}</b></div>`;
  }
  $('#q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); draw(); });
  $$('#seg button').forEach(b => b.addEventListener('click', () => { level = b.dataset.l; $$('#seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  draw();
});
