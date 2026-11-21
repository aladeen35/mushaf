/* index.html — splash → welcome → sign in (work e-mail + 4-digit PIN) */
(function () {
  const next = (() => { const n = qs('next'); return n && /^[a-z]+\.html(\?[\w=&%.-]*)?$/i.test(n) ? n : 'home.html'; })();
  if (getSession()) { location.replace(next); return; }

  // inject icons declared in markup
  $$('[data-icon]').forEach(el => { el.insertAdjacentHTML('afterbegin', ic(el.dataset.icon, (el.dataset.iconCls || '') + (el.dataset.icon === 'arrow' ? ' arrow-ic' : ''))); });
  $$('.lang-switch button').forEach(b => {
    b.classList.toggle('on', b.dataset.lang === lang);
    b.addEventListener('click', () => { lang = b.dataset.lang; save(); applyLang(); $$('.lang-switch button').forEach(x => x.classList.toggle('on', x.dataset.lang === lang)); if (pin.mode) renderPinText(); });
  });
  $('#nameIn').placeholder = L('مثال: محمد أحمد', 'e.g. Mohammed Ahmed');

  const pin = {mode: null, email: null, value: '', first: ''};
  let pendingEmail = null, pendingName = null;
  let pendingCode = null, codeFlow = null, codeRequired = false, resendTimer = null; // codeFlow: 'new' | 'reset'
  const show = id => { $$('.screen').forEach(s => s.classList.toggle('on', s.id === id)); window.scrollTo(0, 0); };
  const step = id => { $$('.l-step').forEach(s => s.classList.toggle('hidden', s.id !== id)); };

  // splash first (shorter on repeat visits)
  const seen = sessionStorage.getItem('hafm.splash');
  setTimeout(() => { $('#splash').classList.add('out'); }, seen ? 700 : 2300);
  sessionStorage.setItem('hafm.splash', '1');

  const known = state.lastEmail && (REMOTE ? state.lastName : state.users[state.lastEmail]);
  if (known) { pendingName = state.lastName || null; show('login'); openPin('enter', state.lastEmail); }
  else show('welcome');
  if (qs('expired')) setTimeout(() => toast(L('انتهت الجلسة — أدخل رمزك من جديد.', 'Session expired — enter your PIN again.'), 'error'), 900);

  $('#startBtn').addEventListener('click', () => { show('login'); step('stepEmail'); setTimeout(() => $('#emailIn').focus(), 300); });
  $('#loginBack').addEventListener('click', () => {
    if (!$('#stepCode').classList.contains('hidden')) { step('stepEmail'); return; }
    if (!$('#stepName').classList.contains('hidden') || (pin.mode && pin.mode !== 'enter')) { step('stepEmail'); pin.mode = null; return; }
    if (!$('#stepPin').classList.contains('hidden')) { step('stepEmail'); pin.mode = null; return; }
    show('welcome');
  });
  $('#switchAcc').addEventListener('click', () => { pin.mode = null; $('#emailIn').value = ''; step('stepEmail'); $('#emailIn').focus(); });

  /* e-mail step */
  $('#stepEmail').addEventListener('submit', e => {
    e.preventDefault();
    const em = normEmail($('#emailIn').value);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { $('#emailErr').textContent = L('اكتب إيميلاً صحيحاً.', 'Enter a valid e-mail.'); return; }
    if (!emailAllowed(em)) {
      const d = (CFG.ALLOWED_EMAIL_DOMAINS || []).map(x => '@' + x).join(L(' أو ', ' or '));
      $('#emailErr').textContent = L(`الدخول بإيميل العمل فقط (${d}).`, `Work e-mail only (${d}).`); return;
    }
    $('#emailErr').textContent = '';
    pendingEmail = em;
    if (REMOTE) {
      const btn = $('#stepEmail button[type=submit]'); btn.disabled = true;
      api('hafm_user_status', {p_email: em}).then(st => {
        codeRequired = !!st.code_required;
        if (st.exists && st.has_pin) { pendingName = st.name; openPin('enter', em); }
        else if (codeRequired) { pendingName = st.exists ? st.name : null; startCode('new', em); }
        else if (st.exists) { pendingName = st.name; openPin('create', em); }
        else { $('#newEmailLbl').textContent = em; step('stepName'); setTimeout(() => $('#nameIn').focus(), 200); }
      }).catch(err => { $('#emailErr').textContent = apiErrorText(err); }).finally(() => { btn.disabled = false; });
      return;
    }
    const u = state.users[em];
    if (u && u.pinHash) openPin('enter', em);
    else if (u && !u.pinHash) { pendingName = u.name; openPin('create', em); } // PIN was reset by an admin
    else { $('#newEmailLbl').textContent = em; step('stepName'); setTimeout(() => $('#nameIn').focus(), 200); }
  });
  /* verification code step (shared mode, when the admin turned codes on) */
  function startResendTimer() {
    let s = 60; const b = $('#resendBtn'); clearInterval(resendTimer); b.disabled = true;
    const tick = () => { b.textContent = L(`إعادة الإرسال بعد ${s} ث`, `Resend in ${s}s`); if (s-- <= 0) { clearInterval(resendTimer); b.disabled = false; b.textContent = L('إعادة إرسال الرمز', 'Resend code'); } };
    tick(); resendTimer = setInterval(tick, 1000);
  }
  async function startCode(flow, em) {
    codeFlow = flow; pendingEmail = em; pendingCode = null;
    $('#codeEmailLbl').textContent = em; $('#codeIn').value = ''; $('#codeErr').textContent = '';
    step('stepCode'); pin.mode = null;
    try { await sendEmailCode(em); startResendTimer(); setTimeout(() => $('#codeIn').focus(), 200); toast(L('أُرسل الرمز إلى إيميلك', 'Code sent to your e-mail')); }
    catch (err) { $('#codeErr').textContent = apiErrorText(err); $('#resendBtn').disabled = false; $('#resendBtn').textContent = L('إعادة المحاولة', 'Try again'); }
  }
  $('#resendBtn').addEventListener('click', () => startCode(codeFlow, pendingEmail));
  $('#codeIn').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); if (e.target.value.length === 6) $('#stepCode').requestSubmit(); });
  $('#stepCode').addEventListener('submit', e => {
    e.preventDefault();
    const c = $('#codeIn').value;
    if (!/^\d{6}$/.test(c)) { $('#codeErr').textContent = L('الرمز 6 أرقام.', 'The code has 6 digits.'); return; }
    pendingCode = c; $('#codeErr').textContent = '';
    if (codeFlow === 'new') { $('#newEmailLbl').textContent = pendingEmail; if (pendingName && !$('#nameIn').value) $('#nameIn').value = /[\s]/.test(pendingName) ? pendingName : ''; step('stepName'); setTimeout(() => $('#nameIn').focus(), 200); }
    else openPin('create', pendingEmail);
  });

  /* name step */
  $('#stepName').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('#nameIn').value.trim().replace(/\s+/g, ' ');
    if (n.length < 3) { $('#nameErr').textContent = L('اكتب اسمك الكامل.', 'Enter your full name.'); return; }
    $('#nameErr').textContent = ''; pendingName = n; openPin('create', pendingEmail);
  });

  /* PIN pad */
  function openPin(mode, email) {
    pin.mode = mode; pin.email = email; pin.value = ''; pin.first = '';
    step('stepPin'); renderPinText(); drawDots(); $('#pinErr').textContent = '';
  }
  function renderPinText() {
    const u = REMOTE ? null : state.users[pin.email];
    const name = (u && u.name) || pendingName || '';
    $('#pinWho').innerHTML = `<span class="avatar">${esc(initials(name))}</span><div><b>${esc(name)}</b><small class="ltr">${esc(pin.email || '')}</small></div>`;
    const txt = {
      enter: [L('أدخل رمز الدخول', 'Enter your PIN'), L('الرمز المكوّن من 4 أرقام الذي اخترته.', 'The 4-digit PIN you chose.')],
      create: [L('اختر رمز دخول', 'Choose a PIN'), L('4 أرقام خاصة بك — ستُسأل عنها في كل زيارة.', '4 digits only you know — asked on every visit.')],
      confirm: [L('أكّد الرمز', 'Confirm your PIN'), L('أعد كتابة الرمز نفسه.', 'Type the same PIN again.')]
    }[pin.mode] || ['', ''];
    $('#pinTitle').textContent = txt[0]; $('#pinSub').textContent = txt[1];
    $('#forgotBtn').style.visibility = pin.mode === 'enter' ? 'visible' : 'hidden';
    $('#switchAcc').classList.toggle('hidden', pin.mode !== 'enter');
  }
  function drawDots(cls) {
    const d = $('#pinDots'); d.className = 'pin-dots' + (cls ? ' ' + cls : '');
    $$('i', d).forEach((x, i) => x.classList.toggle('on', i < pin.value.length));
  }
  function fail(msg) {
    $('#pinErr').textContent = msg; pin.value = ''; drawDots('shake');
    if (navigator.vibrate) navigator.vibrate(120);
    setTimeout(() => drawDots(), 420);
  }
  function press(k) {
    if (!pin.mode) return;
    if (k === 'del') { pin.value = pin.value.slice(0, -1); drawDots(); return; }
    if (pin.value.length >= 4) return;
    pin.value += k; drawDots(); $('#pinErr').textContent = '';
    if (pin.value.length === 4) submitPin();
  }
  let busy = false;
  function remoteDone(res) { drawDots('ok'); remoteSignIn(res); setTimeout(() => location.replace(next), 250); }
  function submitPin() {
    const em = pin.email;
    if (REMOTE && pin.mode === 'enter') {
      if (busy) return; busy = true;
      api('hafm_login', {p_email: em, p_pin: pin.value})
        .then(res => { if (res && res.error) fail(L('الرمز غير صحيح.', 'Wrong PIN.')); else remoteDone(res); })
        .catch(err => { if (err.code === 'not_registered') { openPin('create', em); toast(L('اختر رمزاً جديداً لحسابك.', 'Choose a new PIN for your account.')); } else fail(apiErrorText(err)); })
        .finally(() => { busy = false; });
      return;
    }
    if (REMOTE && pin.mode === 'confirm' && pin.value === pin.first) {
      if (busy) return; busy = true;
      api('hafm_register', {p_email: em, p_name: pendingName || '', p_pin: pin.value, p_code: pendingCode})
        .then(res => { toast(codeFlow === 'reset' ? L('تم تعيين رمزك الجديد', 'New PIN set') : L('تم إنشاء حسابك', 'Account created')); remoteDone(res); })
        .catch(err => {
          if (err.code === 'wrong_code' || err.code === 'code_expired') { step('stepCode'); $('#codeIn').value = ''; $('#codeErr').textContent = apiErrorText(err); pin.mode = null; return; }
          pin.mode = 'create'; pin.first = ''; renderPinText(); fail(apiErrorText(err));
        })
        .finally(() => { busy = false; });
      return;
    }
    if (pin.mode === 'enter') {
      const u = state.users[em];
      if (u.lockUntil && Date.now() < u.lockUntil) {
        const s = Math.ceil((u.lockUntil - Date.now()) / 1000);
        fail(L(`محاولات كثيرة — انتظر ${s} ثانية.`, `Too many attempts — wait ${s}s.`)); return;
      }
      if (pinHash(em, pin.value) === u.pinHash) {
        u.fails = 0; u.lockUntil = 0; drawDots('ok'); signIn(em); setTimeout(() => location.replace(next), 250);
      } else {
        u.fails = (u.fails || 0) + 1;
        if (u.fails >= 5) { u.lockUntil = Date.now() + 60000; u.fails = 0; }
        save(); fail(L('الرمز غير صحيح.', 'Wrong PIN.'));
      }
    } else if (pin.mode === 'create') {
      if (/^(\d)\1{3}$/.test(pin.value) || ['1234', '4321', '0123'].includes(pin.value)) { fail(L('رمز سهل التخمين — اختر رمزاً آخر.', 'Too easy to guess — choose another PIN.')); return; }
      pin.first = pin.value; pin.value = ''; pin.mode = 'confirm'; renderPinText(); drawDots();
    } else if (pin.mode === 'confirm') {
      if (pin.value !== pin.first) { pin.mode = 'create'; pin.first = ''; renderPinText(); fail(L('الرمزان غير متطابقين — حاول مجدداً.', 'PINs do not match — try again.')); return; }
      const existing = state.users[em];
      const noAdmins = !(CFG.ADMIN_EMAIL_HASHES || []).length && !Object.values(state.perms).includes('admin');
      state.users[em] = Object.assign(existing || {createdAt: new Date().toISOString()}, {email: em, name: (existing && existing.name) || pendingName, pinHash: pinHash(em, pin.value), fails: 0, lockUntil: 0});
      if (noAdmins) state.perms[em] = 'admin'; // bootstrap: first account on a device with no configured admin
      save(); drawDots('ok'); signIn(em);
      toast(L('تم إنشاء حسابك', 'Account created'));
      setTimeout(() => location.replace(next), 450);
    }
  }
  $$('#keypad [data-k]').forEach(b => b.addEventListener('click', () => press(b.dataset.k)));
  document.addEventListener('keydown', e => {
    if ($('#stepPin').classList.contains('hidden') || !$('#login').classList.contains('on')) return;
    if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del');
  });
  $('#forgotBtn').addEventListener('click', async () => {
    if (REMOTE) {
      let st = null; try { st = await api('hafm_user_status', {p_email: pin.email}); } catch (e) {}
      if (st && st.code_required) {
        if (await dialog({title: L('نسيت رمز الدخول؟', 'Forgot your PIN?'), body: esc(L(`سنرسل رمز تحقق إلى ${pin.email} لتختار رمز دخول جديداً.`, `We will e-mail a code to ${pin.email} so you can choose a new PIN.`)), okText: L('أرسل الرمز', 'Send code')})) {
          codeRequired = true; pendingName = st.name; startCode('reset', pin.email);
        }
        return;
      }
    }
    forgotInfo();
  });
  const forgotInfo = () => dialog({
    title: L('نسيت رمز الدخول؟', 'Forgot your PIN?'),
    body: esc(REMOTE ? L('اطلب من المشرف إعادة تعيين رمزك من: حسابي ← المستخدمون. بعدها اكتب إيميلك واختر رمزاً جديداً — يعمل على أي جهاز.',
      'Ask an admin to reset your PIN from: Account → Users. Then enter your e-mail and choose a new PIN — on any device.')
      : L('اطلب من مشرف النظام إعادة تعيين رمزك من: حسابي ← المستخدمون على هذا الجهاز. بعدها اكتب إيميلك واختر رمزاً جديداً.',
      'Ask an admin to reset your PIN from: Account → Users on this device. Then enter your e-mail and choose a new PIN.')),
    okText: L('حسناً', 'OK'), cancelText: L('إغلاق', 'Close')
  });
})();
