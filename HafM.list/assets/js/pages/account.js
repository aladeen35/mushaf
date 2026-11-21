/* account.html — profile, language, change PIN, sign out; admins: users & permissions on this device, backup/restore */
hafmBoot(function () {
  renderShell({active: 'account', title: t('account')});
  const u = currentUser();
  const myRole = roleOf(u.email);
  let codeOn = null; // admins: is the e-mail verification code required?
  let remoteUsers = null; // admins in shared mode: everyone registered (from the database)
  const loadUsers = () => api('hafm_list_users', {p_token: getSession().token}).then(list => { remoteUsers = list; render(); }).catch(err => toast(apiErrorText(err), 'error'));

  function stats() {
    let total = 0, weeks = new Set(), bad = 0;
    state.reports.forEach(r => Object.values(r.checks).forEach(c => { if (c.email === u.email) { total++; weeks.add(r.weekStart); if (Object.values(c.s || {}).some(s => statusKey(s) === 'bad')) bad++; } }));
    return {total, weeks: weeks.size, bad};
  }
  function render() {
    const st = stats();
    const users = REMOTE ? (remoteUsers || []).map(x => ({email: x.email, name: x.name, role: x.role, lastLogin: x.last_login, hasPin: x.has_pin, entries: x.entries}))
      : Object.values(state.users).sort((a, b) => (b.lastLogin || '').localeCompare(a.lastLogin || ''));
    const grants = REMOTE ? users.filter(x => x.role !== 'auditor').map(x => [x.email, x.role]) : Object.entries(state.perms);
    const roleFor = x => REMOTE ? x.role : roleOf(x.email);
    $('#page').innerHTML = `
      <section class="card profile">
        <span class="avatar">${esc(initials(u.name))}</span>
        <div class="grow"><h2 style="font-size:20px">${esc(u.name)}</h2><div class="small muted ltr" style="text-align:start">${esc(u.email)}</div>
          <span class="badge ${myRole === 'admin' ? 'dark' : myRole === 'editor' ? 'havan' : 'teal'}" style="margin-top:6px">${ic('shield')} ${esc(roleName(myRole))}</span></div>
      </section>
      <div class="kpis">
        <div class="kpi"><b>${st.total}</b><span>${L('فروع فحصتها', 'Branches checked')}</span></div>
        <div class="kpi havan"><b>${st.weeks}</b><span>${L('أسابيع', 'Weeks')}</span></div>
        <div class="kpi"><b>${state.quiz.correct}/${state.quiz.total}</b><span>${L('الاختبار', 'Quiz')}</span></div>
      </div>

      ${sectionHead(L('الإعدادات', 'Settings'))}
      <div class="rows menu">
        <div class="item-row"><span class="lead">${ic('globe')}</span><div class="grow"><div class="title">${t('language')}</div></div>
          <div class="seg"><button type="button" data-lang="ar" class="${lang === 'ar' ? 'on' : ''}">العربية</button><button type="button" data-lang="en" class="${lang === 'en' ? 'on' : ''}">English</button></div></div>
        <button class="item-row" id="changePin" type="button"><span class="lead">${ic('key')}</span><div class="grow"><div class="title">${L('تغيير رمز الدخول', 'Change PIN')}</div><div class="sub">${L('4 أرقام تُسأل عنها في كل زيارة', '4 digits asked on every visit')}</div></div><span class="trail">${ic('chevron', 'flip-ltr')}</span></button>
        <button class="item-row" id="editName" type="button"><span class="lead">${ic('edit')}</span><div class="grow"><div class="title">${L('تعديل الاسم', 'Edit name')}</div><div class="sub">${L('يظهر مع كل فرع تفحصه', 'Shown on every branch you check')}</div></div><span class="trail">${ic('chevron', 'flip-ltr')}</span></button>
        ${canEditLists() ? `<a class="item-row" href="admin.html"><span class="lead teal">${ic('list')}</span><div class="grow"><div class="title">${t('manageLists')}</div><div class="sub">${L('إنشاء وتعديل وأرشفة القوائم والسيرفيات', 'Create, edit and archive lists & surveys')}</div></div><span class="trail">${ic('chevron', 'flip-ltr')}</span></a>` : ''}
        <button class="item-row" id="copyHash" type="button"><span class="lead">${ic('copy')}</span><div class="grow"><div class="title">${L('نسخ رمز الصلاحية', 'Copy permission hash')}</div><div class="sub">${L('يرسله الموظف للمشرف ليضيفه في config.js كمشرف', 'Send to an admin to add you to config.js')}</div></div></button>
        <button class="item-row" id="logout" type="button"><span class="lead" style="background:var(--bad-bg);color:var(--bad)">${ic('logout')}</span><div class="grow"><div class="title">${t('logout')}</div></div></button>
      </div>

      ${myRole === 'admin' ? `
      ${REMOTE ? `${sectionHead(L('رمز التحقق بالإيميل', 'E-mail verification code'), L('عند التفعيل: يصل رمز من 6 أرقام لإيميل العمل عند التسجيل أو نسيان رمز الدخول.', 'When on: a 6-digit code is e-mailed at sign-up and for a forgotten PIN.'))}
      <div class="card">
        <div class="row spread"><b>${codeOn == null ? L('جارٍ التحميل…', 'Loading…') : codeOn ? L('مفعّل ✅', 'On ✅') : L('غير مفعّل', 'Off')}</b>
          <button class="btn sm ${codeOn ? 'ghost' : 'primary'}" id="codeToggle" type="button" ${codeOn == null ? 'disabled' : ''}>${codeOn ? L('إيقاف', 'Turn off') : L('تفعيل', 'Turn on')}</button></div>
        <button class="btn sm ghost" id="codeTest" type="button" style="margin-top:10px">${ic('mail')} ${L('أرسل رمزاً تجريبياً إلى إيميلي', 'Send a test code to my e-mail')}</button>
        <p class="hint">${L('جرّب الإرسال أولاً — إن لم يصل الرمز فخدمة الإيميل (Resend) لم تُربط بعد.', 'Test first — if no code arrives, the e-mail service (Resend) is not connected yet.')}</p>
      </div>` : ''}
      ${sectionHead(L('الصلاحيات', 'Permissions'), L('امنح «محرّر قوائم» لمن يحق له إضافة القوائم وتعديلها.', 'Grant “list editor” to people allowed to add and edit lists.'))}
      <form class="card" id="grantForm">
        <label class="lbl" for="gEmail" style="margin-top:0">${L('إيميل الموظف', 'Employee e-mail')}</label>
        <input class="input ltr" id="gEmail" type="email" placeholder="name@halfm.sa">
        <div class="seg" id="gRole" style="margin-top:10px"><button type="button" class="on" data-r="editor">${t('editor')}</button><button type="button" data-r="admin">${t('admin')}</button></div>
        <p class="err" id="gErr"></p>
        <button class="btn primary block" type="submit">${ic('shield')} ${L('منح الصلاحية', 'Grant')}</button>
      </form>
      <div class="rows">${grants.length ? grants.map(([e, r]) => `<div class="item-row"><span class="lead havan">${ic('shield')}</span><div class="grow"><div class="title ltr" style="text-align:start">${esc(e)}</div><div class="sub">${esc(roleName(r))}</div></div><button class="btn sm ghost" data-revoke="${esc(e)}" type="button">${L('سحب', 'Revoke')}</button></div>`).join('') : `<p class="small muted">${L('لا صلاحيات ممنوحة على هذا الجهاز بعد. المشرفون الدائمون في config.js.', 'No grants on this device yet. Permanent admins live in config.js.')}</p>`}</div>

      ${sectionHead(REMOTE ? L('المستخدمون', 'Users') : L('المستخدمون على هذا الجهاز', 'Users on this device'), REMOTE && !remoteUsers ? L('جارٍ التحميل…', 'Loading…') : `${users.length}`)}
      <div class="rows">${users.map(x => `<div class="item-row"><span class="avatar" style="width:40px;height:40px;font-size:14px">${esc(initials(x.name))}</span>
        <div class="grow"><div class="title">${esc(x.name)}</div><div class="sub ltr" style="text-align:start">${esc(x.email)} · ${esc(roleName(roleFor(x)))}</div><div class="sub">${x.lastLogin ? L('آخر دخول ', 'last sign-in ') + esc(timeAgo(x.lastLogin)) : L('لم يدخل بعد', 'never signed in')}${REMOTE ? ' · ' + L(`${x.entries} إدخال`, `${x.entries} entries`) + (x.hasPin ? '' : ' · ' + L('بانتظار اختيار رمز', 'PIN not set')) : ''}</div></div>
        ${x.email !== u.email ? `<button class="btn sm ghost" data-reset="${esc(x.email)}" type="button">${ic('key')} ${L('إعادة الرمز', 'Reset PIN')}</button>` : ''}</div>`).join('')}</div>

` : ''}


      ${REMOTE ? `<div class="card cream flat small" style="margin-top:22px">${ic('cloud')} ${L('متصل بقاعدة بيانات الفريق — كل الإدخالات والقوائم مشتركة بين جميع الموظفين.', 'Connected to the team database — all entries and lists are shared by every employee.')}${state.outbox.length ? ' · ' + L(`${state.outbox.length} بانتظار الإرسال`, `${state.outbox.length} waiting to be sent`) : ''}</div>` : `
      ${sectionHead(L('النسخ الاحتياطي ونقل البيانات', 'Backup & data transfer'), L('البيانات محفوظة على هذا الجهاز — نزّل نسختك وأرسلها للمشرف ليدمجها في جهازه.', 'Data lives on this device — download your copy and send it to an admin to merge.'))}
      <div class="row wrap">
        <button class="btn ghost" id="backup" type="button">${ic('download')} ${L('تنزيل نسخة JSON', 'Download JSON backup')}</button>
        ${canEditLists() ? `<label class="btn ghost" for="restoreIn">${ic('upload')} ${L('استيراد / دمج نسخة', 'Import / merge backup')}</label>
        <input id="restoreIn" type="file" accept="application/json,.json" class="hidden">` : ''}
      </div>`}

      <div class="foot-note"><img src="assets/img/logo.svg" alt="">HafM.list · ${t('appFull')}<br>${REMOTE ? L('قاعدة بيانات مشتركة', 'Shared database') : L('البيانات محفوظة على هذا الجهاز (localStorage).', 'Data is stored on this device (localStorage).')}</div>`;
    bind();
  }
  function bind() {
    $$('[data-lang]').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; save(); location.reload(); }));
    $('#logout').addEventListener('click', async () => { if (await dialog({title: t('logout'), body: esc(L('سيُطلب رمزك عند الدخول القادم.', 'Your PIN will be asked next time.')), okText: t('logout')})) signOut(); });
    $('#copyHash').addEventListener('click', async () => {
      const h = adminHash(u.email);
      try { await navigator.clipboard.writeText(h); toast(L('تم النسخ', 'Copied')); }
      catch (e) { dialog({title: L('رمز الصلاحية', 'Permission hash'), body: `<code class="ltr" style="word-break:break-all;display:block">${h}</code>`, okText: 'OK'}); }
    });
    $('#editName').addEventListener('click', () => sheet(`<h3>${L('تعديل الاسم', 'Edit name')}</h3>
      <input class="input" id="nm" value="${esc(u.name)}" maxlength="60" style="margin-top:12px"><button class="btn primary block" id="nmSave" style="margin-top:12px" type="button">${t('save')}</button>`,
      (w, close) => $('#nmSave', w).addEventListener('click', async () => {
        const v = $('#nm', w).value.trim(); if (v.length < 3) return;
        if (REMOTE) { try { await api('hafm_set_name', {p_token: getSession().token, p_name: v}); updateSession({name: v}); state.lastName = v; } catch (err) { toast(apiErrorText(err), 'error'); return; } }
        u.name = v; save(); close(); toast(t('saved')); render(); })));
    $('#changePin').addEventListener('click', () => sheet(`<h3>${L('تغيير رمز الدخول', 'Change PIN')}</h3>
      <label class="lbl">${L('الرمز الحالي', 'Current PIN')}</label><input class="input ltr" id="p0" inputmode="numeric" maxlength="4" type="password" autocomplete="off">
      <label class="lbl">${L('الرمز الجديد (4 أرقام)', 'New PIN (4 digits)')}</label><input class="input ltr" id="p1" inputmode="numeric" maxlength="4" type="password" autocomplete="off">
      <label class="lbl">${L('تأكيد الرمز الجديد', 'Confirm new PIN')}</label><input class="input ltr" id="p2" inputmode="numeric" maxlength="4" type="password" autocomplete="off">
      <p class="err" id="pErr"></p><button class="btn primary block" id="pSave" type="button">${t('save')}</button>`, (w, close) => {
      $('#pSave', w).addEventListener('click', async () => {
        const p0 = $('#p0', w).value, p1 = $('#p1', w).value, p2 = $('#p2', w).value;
        if (REMOTE) {
          if (!/^\d{4}$/.test(p1)) { $('#pErr', w).textContent = L('الرمز 4 أرقام.', 'PIN must be 4 digits.'); return; }
          if (p1 !== p2) { $('#pErr', w).textContent = L('الرمزان غير متطابقين.', 'PINs do not match.'); return; }
          try { await api('hafm_change_pin', {p_token: getSession().token, p_old: p0, p_new: p1}); close(); toast(L('تم تغيير الرمز', 'PIN changed')); }
          catch (err) { $('#pErr', w).textContent = err.code === 'wrong_pin' ? L('الرمز الحالي غير صحيح.', 'Current PIN is wrong.') : apiErrorText(err); }
          return;
        }
        if (pinHash(u.email, p0) !== u.pinHash) { $('#pErr', w).textContent = L('الرمز الحالي غير صحيح.', 'Current PIN is wrong.'); return; }
        if (!/^\d{4}$/.test(p1)) { $('#pErr', w).textContent = L('الرمز 4 أرقام.', 'PIN must be 4 digits.'); return; }
        if (p1 !== p2) { $('#pErr', w).textContent = L('الرمزان غير متطابقين.', 'PINs do not match.'); return; }
        u.pinHash = pinHash(u.email, p1); save(); close(); toast(L('تم تغيير الرمز', 'PIN changed'));
      });
    }));
    if ($('#backup')) $('#backup').addEventListener('click', () => {
      const data = JSON.stringify({app: 'HafM.list', exportedAt: new Date().toISOString(), checklists: state.checklists, reports: state.reports, perms: state.perms}, null, 1);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type: 'application/json'})); a.download = `HafM.list_backup_${todayStr()}.json`; a.click();
    });
    if ($('#restoreIn')) $('#restoreIn').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const d = JSON.parse(await file.text()); if (d.app !== 'HafM.list' || !Array.isArray(d.reports)) throw new Error('format');
        let added = 0;
        (d.checklists || []).forEach(l => { if (!getList(l.id)) { state.checklists.push(l); state.nextId = Math.max(state.nextId, l.id + 1); } });
        d.reports.forEach(r => {
          let mine = state.reports.find(x => x.checklistId === r.checklistId && x.weekStart === r.weekStart);
          if (!mine) { mine = Object.assign({}, r, {id: state.nextId++, checks: {}}); state.reports.push(mine); }
          Object.entries(r.checks || {}).forEach(([no, c]) => { const cur = mine.checks[no]; if (!cur || (c.at || '') > (cur.at || '')) { mine.checks[no] = c; added++; } });
        });
        if (isAdmin()) Object.assign(state.perms, d.perms || {});
        save(); toast(L(`تم دمج ${added} إدخال`, `Merged ${added} entries`)); render();
      } catch (err) { toast(L('ملف غير صالح', 'Invalid file'), 'error'); }
    });
    if (myRole !== 'admin') return;
    if (REMOTE && !remoteUsers) loadUsers();
    if (REMOTE && codeOn == null) api('hafm_get_code_required', {p_token: getSession().token}).then(v => { codeOn = !!v; render(); }).catch(() => {});
    if ($('#codeToggle')) $('#codeToggle').addEventListener('click', async () => {
      const on = !codeOn;
      if (on && !(await dialog({title: L('تفعيل رمز التحقق', 'Turn on verification'), body: esc(L('تأكد أن الرمز التجريبي وصل إلى إيميلك قبل التفعيل، وإلا لن يستطيع الموظفون الجدد التسجيل.', 'Make sure the test code reached your inbox first, or new employees will not be able to sign up.')), okText: L('تفعيل', 'Turn on')}))) return;
      try { codeOn = await api('hafm_set_code_required', {p_token: getSession().token, p_on: on}); render(); toast(t('saved')); } catch (err) { toast(apiErrorText(err), 'error'); }
    });
    if ($('#codeTest')) $('#codeTest').addEventListener('click', async e => {
      const b = e.currentTarget; b.disabled = true;
      try { await sendEmailCode(u.email); toast(L('أُرسل — افحص بريدك (والبريد غير المرغوب)', 'Sent — check your inbox (and spam)')); }
      catch (err) { toast(apiErrorText(err), 'error'); }
      b.disabled = false;
    });
    let gRole = 'editor';
    $$('#gRole button').forEach(b => b.addEventListener('click', () => { gRole = b.dataset.r; $$('#gRole button').forEach(x => x.classList.toggle('on', x === b)); }));
    $('#grantForm').addEventListener('submit', e => {
      e.preventDefault(); const em = normEmail($('#gEmail').value);
      if (!emailAllowed(em)) { $('#gErr').textContent = L('إيميل عمل غير صالح.', 'Invalid work e-mail.'); return; }
      if (REMOTE) { api('hafm_set_role', {p_token: getSession().token, p_email: em, p_role: gRole}).then(() => { toast(L('تم منح الصلاحية', 'Permission granted')); loadUsers(); }).catch(err => { $('#gErr').textContent = apiErrorText(err); }); return; }
      state.perms[em] = gRole; save(); toast(L('تم منح الصلاحية', 'Permission granted')); render();
    });
    $$('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.revoke === u.email && !(CFG.ADMIN_EMAIL_HASHES || []).includes(adminHash(u.email))) { toast(L('لا يمكنك سحب صلاحيتك الوحيدة.', 'You cannot revoke your own only admin role.'), 'error'); return; }
      if (!(await dialog({title: L('سحب الصلاحية', 'Revoke'), body: esc(b.dataset.revoke), danger: true, okText: L('سحب', 'Revoke')}))) return;
      if (REMOTE) { api('hafm_set_role', {p_token: getSession().token, p_email: b.dataset.revoke, p_role: 'auditor'}).then(loadUsers).catch(err => toast(apiErrorText(err), 'error')); return; }
      delete state.perms[b.dataset.revoke]; save(); render();
    }));
    $$('[data-reset]').forEach(b => b.addEventListener('click', async () => {
      const x = REMOTE ? users0().find(y => y.email === b.dataset.reset) : state.users[b.dataset.reset];
      if (await dialog({title: L('إعادة تعيين الرمز', 'Reset PIN'), body: esc(L(`سيختار ${x.name} رمزاً جديداً عند دخوله القادم.`, `${x.name} will choose a new PIN at next sign-in.`)), okText: L('إعادة تعيين', 'Reset')})) {
        if (REMOTE) { api('hafm_reset_pin', {p_token: getSession().token, p_email: x.email}).then(() => { toast(L('تمت إعادة التعيين', 'PIN reset')); loadUsers(); }).catch(err => toast(apiErrorText(err), 'error')); return; }
        x.pinHash = null; x.fails = 0; x.lockUntil = 0; save(); toast(L('تمت إعادة التعيين', 'PIN reset')); render();
      }
    }));
  }
  const users0 = () => remoteUsers || [];
  render();
});
