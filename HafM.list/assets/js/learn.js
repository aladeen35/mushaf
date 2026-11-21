/* Daily issue card + review quiz (shared by home.html and review.html).
   Daily card: deterministic — AUDIT_ISSUES[Riyadh day number % 56], same for everyone on the same day.
   Quiz bank: only the 44 issues that have both a description and an example (12 are title-only in the source deck). */
'use strict';
const FULL_ISSUES = AUDIT_ISSUES.filter(i => i.descEn && i.exampleEn);
const todayIssue = () => AUDIT_ISSUES[riyadhDayNumber() % AUDIT_ISSUES.length];

function dailyCardHTML() {
  const i = todayIssue();
  const other = lang === 'ar' ? i.titleEn : i.titleAr;
  return `<article class="daily">
    <div class="top"><span class="chip havan">${ic('bulb')} ${t('dailyIssue')}</span><span class="level ${i.levelEn}">${esc(i.code)} · ${levelName(i.levelEn)}</span></div>
    <h3>${esc(issueTitle(i))}</h3>${other ? `<div class="en">${esc(other)}</div>` : ''}
    ${i.descEn ? `<p>${esc(issueDesc(i))}</p>` : `<p class="muted">${L('عنوان فقط في الدليل الأصلي — تُعرض دون شرح مخترع.', 'Title only in the original guide — shown without an invented description.')}</p>`}
    ${i.exampleEn ? `<div class="ex">${ic('sparkle')}<div><b>${t('example')}:</b> ${esc(issueExample(i))}</div></div>` : ''}
    <div class="row spread" style="margin-top:12px"><span class="small muted">${ic('calendar')} ${esc(niceDate(todayStr()))}</span>
      <a class="btn sm ghost" href="review.html">${L('كل المخالفات', 'All issues')}</a></div>
  </article>`;
}

let quizQ = null, quizAnswered = false;
const shuffle = a => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
function pickQuiz() {
  const issue = FULL_ISSUES[Math.floor(Math.random() * FULL_ISSUES.length)];
  const r = Math.random();
  const explain = issueDesc(issue), example = issueExample(issue);
  if (r < 0.33) {
    const lvl = ['Critical', 'Major', 'Minor'][Math.floor(Math.random() * 3)];
    quizQ = {kind: 'tf', issue, tag: L('صح أم خطأ', 'True or false'),
      q: L(`«${issueTitle(issue)}» مخالفة ${levelName(lvl)}.`, `“${issueTitle(issue)}” is a ${lvl} issue.`),
      options: [{text: t('trueText'), value: 'true'}, {text: t('falseText'), value: 'false'}], answer: String(lvl === issue.levelEn), explain, example};
  } else if (r < 0.66) {
    quizQ = {kind: 'level', issue, tag: L('اختيار من متعدد', 'Multiple choice'),
      q: L(`ما مستوى مخالفة «${issueTitle(issue)}»؟`, `What level is “${issueTitle(issue)}”?`),
      options: ['Critical', 'Major', 'Minor'].map(o => ({text: levelName(o), value: o})), answer: issue.levelEn, explain, example};
  } else {
    const picks = shuffle([issue, ...shuffle(FULL_ISSUES.filter(i => i.code !== issue.code)).slice(0, 2)]);
    quizQ = {kind: 'desc', issue, tag: L('اختيار من متعدد', 'Multiple choice'),
      q: L('أي مخالفة يصفها هذا الشرح؟', 'Which issue does this describe?') + ` — ${explain}`,
      options: picks.map(o => ({text: issueTitle(o), value: o.code})), answer: issue.code, explain, example};
  }
  quizAnswered = false;
}
function renderQuiz(el) {
  if (!quizQ) pickQuiz();
  const sc = state.quiz;
  el.innerHTML = `<div class="row spread"><span class="chip teal">${ic('target')} ${t('quiz')}</span><span class="score">${ic('star')} ${sc.correct} / ${sc.total}</span></div>
    <p class="small muted" style="margin-top:12px">${esc(quizQ.tag)} · ${esc(quizQ.issue.code)}</p>
    <h3 style="margin-top:2px">${esc(quizQ.q)}</h3>
    <div class="quiz-opts">${quizQ.options.map((o, i) => `<button class="quiz-opt" data-i="${i}" type="button">${esc(o.text)}</button>`).join('')}</div>
    <div class="quiz-out"></div>
    <div class="row spread" style="margin-top:12px"><span class="small muted">${sc.streak ? L(`🔥 سلسلة صحيحة: ${sc.streak}`, `🔥 Streak: ${sc.streak}`) : ''}${sc.best ? ' · ' + L(`الأفضل ${sc.best}`, `best ${sc.best}`) : ''}</span>
      <button class="btn sm ghost next-q" type="button">${ic('refresh')} ${t('nextQuestion')}</button></div>`;
  $$('.quiz-opt', el).forEach(b => b.addEventListener('click', () => {
    if (quizAnswered) return; quizAnswered = true;
    const chosen = quizQ.options[+b.dataset.i];
    const ok = String(chosen.value) === String(quizQ.answer);
    sc.total++; if (ok) { sc.correct++; sc.streak = (sc.streak || 0) + 1; sc.best = Math.max(sc.best || 0, sc.streak); } else sc.streak = 0;
    save();
    $$('.quiz-opt', el).forEach((x, i) => {
      x.disabled = true;
      if (String(quizQ.options[i].value) === String(quizQ.answer)) x.classList.add('correct');
      else if (i === +b.dataset.i) x.classList.add('wrong');
    });
    const right = quizQ.options.find(o => String(o.value) === String(quizQ.answer));
    $('.quiz-out', el).innerHTML = `<div class="quiz-feed"><b>${ok ? '✅ ' + t('correct') : '❌ ' + t('wrong')}</b> — ${t('correctAnswer')}: <b>${esc(right ? right.text : '')}</b>
      ${quizQ.kind !== 'level' ? `<div class="small" style="margin-top:6px"><span class="level ${quizQ.issue.levelEn}">${levelName(quizQ.issue.levelEn)}</span> ${esc(issueTitle(quizQ.issue))}</div>` : ''}
      <p class="small" style="margin-top:6px">${esc(quizQ.explain || '')}</p>${quizQ.example ? `<p class="small muted">💡 ${t('example')}: ${esc(quizQ.example)}</p>` : ''}</div>`;
    $('.score', el).innerHTML = `${ic('star')} ${sc.correct} / ${sc.total}`;
  }));
  $('.next-q', el).addEventListener('click', () => { pickQuiz(); renderQuiz(el); });
}
