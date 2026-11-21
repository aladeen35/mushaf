/* admin.html[?new=1|?edit=N] — manage checklists & surveys (admins and list editors only) */
hafmBoot(function () {
  const editId = qs('edit'), isNew = qs('new') === '1';
  renderShell({active: 'account', back: editId || isNew ? 'admin.html' : 'home.html', title: t('manageLists'), sub: L('القوائم والسيرفيات', 'Lists & surveys')});
  if (!canEditLists()) {
    $('#page').innerHTML = `<div class="empty">${ic('lock')}<b>${t('noPermission')}</b><p>${L('اطلب من المشرف منحك صلاحية «محرّر قوائم».', 'Ask an admin to grant you the “list editor” role.')}</p><a class="btn ghost" href="home.html">${t('home')}</a></div>`;
    return;
  }
  const u = currentUser();
  /* save a list: shared database when connected, else this device */
  async function persist(l) {
    if (!REMOTE) { if (!getList(l.id)) state.checklists.push(l); save(); return l; }
    const saved = await api('hafm_save_checklist', {p_token: getSession().token, p_list: l});
    saved.archived = !!saved.archived;
    const i = state.checklists.findIndex(x => x.id === saved.id || x.id === l.id);
    if (i >= 0) state.checklists[i] = saved; else state.checklists.push(saved);
    save(); return saved;
  }
  const fail = err => toast(apiErrorText(err), 'error');
  const hasData = l => state.reports.some(r => r.checklistId === l.id && Object.keys(r.checks).length);
  const entryCount = l => state.reports.filter(r => r.checklistId === l.id && !r.seed).reduce((n, r) => n + Object.keys(r.checks).length, 0);
  const admin = isAdmin();
  /* who may do what: admins everything (except changing the beverage items, tied to the Excel template); editors their own lists */
  const canEdit = l => (admin ? l.id !== 1 : !l.locked);
  const canDelete = l => (admin ? true : !l.locked && !hasData(l));

  /* delete with TWO warnings; the server keeps a recovery copy of the list and its entries */
  async function deleteList(l, after) {
    const n = entryCount(l), name = listName(l);
    const ok1 = await dialog({title: L(`حذف «${name}»؟`, `Delete “${name}”?`), danger: true, okText: L('متابعة', 'Continue'),
      body: esc(n ? L(`هذه القائمة فيها ${n} إدخال من الفروع. ستُحذف القائمة وكل إدخالاتها من كل الأسابيع، ولن تظهر في التقارير ولا في ملفات Excel، لجميع الموظفين.`,
        `This list has ${n} branch entr${n > 1 ? 'ies' : 'y'}. The list and all its entries, in every week, will be removed for everyone, from reports and Excel files.`)
        : L('ستُحذف القائمة من التطبيق لجميع الموظفين.', 'The list will be removed from the app for everyone.'))});
    if (!ok1) return;
    const ok2 = await dialog({title: L('تأكيد أخير', 'Final confirmation'), danger: true, okText: L('حذف نهائياً', 'Delete permanently'), cancelText: L('تراجع', 'Keep it'),
      body: `<p>${esc(L(`هل أنت متأكد من حذف «${name}» نهائياً؟`, `Are you sure you want to permanently delete “${name}”?`))}</p>
        <p class="small muted" style="margin-top:8px">${esc(L('إن كنت تريد إخفاءها فقط مع الاحتفاظ بتقاريرها فاستخدم «أرشفة» بدل الحذف.', 'To only hide it and keep its reports, use “Archive” instead.'))}</p>`});
    if (!ok2) return;
    try {
      if (REMOTE) await api('hafm_delete_checklist', {p_token: getSession().token, p_id: l.id});
      state.checklists = state.checklists.filter(x => x.id !== l.id); state.reports = state.reports.filter(r => r.checklistId !== l.id); save();
      toast(L(`حُذفت «${name}»`, `“${name}” deleted`)); after();
    } catch (err) { fail(err); }
  }
  async function restoreBuiltIns() {
    try {
      for (const b of defaultChecklists()) if (!getList(b.id)) await persist(b);
      toast(L('استُعيدت القوائم المدمجة', 'Built-in lists restored')); overview();
    } catch (err) { fail(err); }
  }

  /* ---------- overview ---------- */
  function overview() {
    const act = state.checklists.filter(l => !l.archived), arch = state.checklists.filter(l => l.archived);
    const row = l => {
      const rep = l.archived ? null : ensureCurrentWeek(l.id);
      return `<div class="item-row"><span class="lead ${listTone(l)}">${ic(listIcon(l))}</span>
        <div class="grow"><div class="title">${esc(listName(l))}</div>
        <div class="sub">${l.kind === 'fixed' ? t('fixed') : t('survey')} · ${l.items.length} ${t('items')}${rep ? ` · ${doneCount(rep)}/${TOTAL_BRANCHES} ${t('submitted')}` : ''}${l.createdBy ? ' · ' + esc(l.createdBy) : ''}</div></div>
        <div class="row" style="gap:6px">
          ${l.archived ? `<button class="btn sm ghost" data-restore="${l.id}" type="button">${t('restore')}</button>`
            : canEdit(l) ? `<a class="btn sm ghost" href="admin.html?edit=${l.id}">${ic('edit')} ${t('edit')}</a>`
            : `<span class="badge" title="${L('مرتبطة بقالب الإكسل', 'Tied to the Excel template')}">${ic('lock')}</span>`}
          ${admin && !l.archived ? `<button class="icon-btn" data-archive="${l.id}" type="button" aria-label="${t('archive')}" title="${t('archive')}" style="width:38px;height:38px">${ic('archive')}</button>` : ''}
          ${canDelete(l) ? `<button class="icon-btn" data-del="${l.id}" type="button" aria-label="${t('delete')}" title="${t('delete')}" style="width:38px;height:38px;color:var(--bad)">${ic('trash')}</button>` : ''}
        </div></div>`;
    };
    const missing = admin && defaultChecklists().filter(b => !getList(b.id));
    $('#page').innerHTML = `
      <a class="btn btn-arrow dark block" href="admin.html?new=1"><span class="circ">${ic('plus')}</span>${L('إنشاء قائمة أو سيرفي جديد', 'Create a new list or survey')}</a>
      ${sectionHead(L('القوائم النشطة', 'Active lists'), `${act.length}`)}
      <div class="rows">${act.map(row).join('')}</div>
      ${arch.length ? sectionHead(L('المؤرشفة', 'Archived'), `${arch.length}`) + `<div class="rows">${arch.map(row).join('')}</div>` : ''}
      ${missing && missing.length ? `<button class="btn ghost block" id="restoreBuiltIns" type="button">${ic('refresh')} ${L('استعادة القوائم المدمجة', 'Restore built-in lists')}: ${missing.map(b => esc(listName(b))).join('، ')}</button>` : ''}
      <p class="hint">${admin
        ? L('بصفتك مشرفاً: تستطيع تعديل وأرشفة وحذف أي قائمة. بنود «فحص جودة المشروبات» ثابتة لأنها مرتبطة بقالب الإكسل الأصلي. الحذف يطلب تأكيدين.', 'As an admin you can edit, archive and delete any list. The beverage list’s items stay fixed (original Excel template). Deleting asks twice.')
        : L('محرّر القوائم يعدّل قوائمه ويحذف ما لا إدخالات فيه. القوائم المدمجة يديرها المشرف.', 'List editors edit their lists and delete lists with no entries. Built-in lists are managed by admins.')}</p>`;
    $$('[data-restore]').forEach(b => b.addEventListener('click', () => { const l = getList(b.dataset.restore); persist(Object.assign({}, l, {archived: false})).then(() => { toast(t('saved')); overview(); }).catch(fail); }));
    $$('[data-archive]').forEach(b => b.addEventListener('click', async () => {
      const l = getList(b.dataset.archive);
      if (await dialog({title: t('archive'), body: esc(L(`ستختفي «${listName(l)}» من الصفحة الرئيسية، وتبقى تقاريرها محفوظة. يمكنك استعادتها لاحقاً.`, `“${listName(l)}” leaves the home page; its reports stay. You can restore it later.`)), okText: t('archive')}))
        persist(Object.assign({}, l, {archived: true})).then(() => { toast(t('saved')); overview(); }).catch(fail);
    }));
    $$('[data-del]').forEach(b => b.addEventListener('click', () => deleteList(getList(b.dataset.del), overview)));
    const rb = $('#restoreBuiltIns'); if (rb) rb.addEventListener('click', restoreBuiltIns);
  }

  /* ---------- editor ---------- */
  function editor(list) {
    const creating = !list;
    const d = creating ? {name: '', nameAr: '', kind: 'survey', icon: 'clipboard', tone: 'havan', items: [{id: '', label: '', labelAr: ''}]}
      : JSON.parse(JSON.stringify(list));
    if (!creating && !canEdit(list)) { location.replace('admin.html'); return; }
    const kindLocked = !creating && hasData(list);

    function draw() {
      $('#page').innerHTML = `
        <h1 style="font-size:26px">${creating ? t('newList') : L('تعديل القائمة', 'Edit list')}</h1>
        <form class="stack" id="f" novalidate>
          <div class="card">
            <label class="lbl" for="nAr" style="margin-top:0">${L('اسم القائمة (العربية)', 'List name (Arabic)')}</label>
            <input class="input" id="nAr" value="${esc(d.nameAr)}" maxlength="70" placeholder="${L('مثال: نظافة منطقة التحضير', 'e.g. نظافة منطقة التحضير')}">
            <label class="lbl" for="nEn">${L('اسم القائمة (English)', 'List name (English)')}</label>
            <input class="input ltr" id="nEn" value="${esc(d.name)}" maxlength="70" placeholder="e.g. Prep area cleanliness">
            <label class="lbl">${L('النوع', 'Type')}</label>
            <div class="seg" id="kind">
              <button type="button" data-k="survey" class="${d.kind === 'survey' ? 'on' : ''}" ${kindLocked ? 'disabled' : ''}>${t('survey')} — ✅ / ❌ / N/A</button>
              <button type="button" data-k="fixed" class="${d.kind === 'fixed' ? 'on' : ''}" ${kindLocked ? 'disabled' : ''}>${t('fixed')} — ${L('5 حالات', '5 statuses')}</button>
            </div>
            <p class="hint">${kindLocked ? L('لا يمكن تغيير النوع بعد وجود إدخالات.', 'Type cannot change once entries exist.') : d.kind === 'fixed' ? 'Okay · Not okay and fixed · Not fixed · Not checked · not available' : L('نعم ✅ · لا ❌ · لا ينطبق — و❌ يُعلَّم كانحراف فوراً.', 'Yes ✅ · No ❌ · N/A — ❌ is flagged as a deviation.')}</p>
            <label class="lbl">${L('الأيقونة', 'Icon')}</label>
            <div class="row wrap" id="icons">${LIST_ICONS.map(i => `<button type="button" class="icon-btn ${d.icon === i ? 'sel' : ''}" data-i="${i}" style="${d.icon === i ? 'background:var(--teal);border-color:var(--teal)' : ''}">${ic(i)}</button>`).join('')}</div>
            <label class="lbl">${L('اللون', 'Colour')}</label>
            <div class="seg" id="tone">${[['teal', L('تيل', 'Teal')], ['havan', L('هافان', 'Havan')], ['dark', L('داكن', 'Dark')]].map(([k, n]) => `<button type="button" data-t="${k}" class="${(d.tone || 'teal') === k ? 'on' : ''}">${n}</button>`).join('')}</div>
          </div>

          <div class="card">
            <div class="row spread"><h3>${L('البنود', 'Items')} (${d.items.length})</h3><button class="btn sm ghost" id="addItem" type="button">${ic('plus')} ${L('بند', 'Item')}</button></div>
            <div class="stack" id="items" style="margin-top:12px">${d.items.map((it, i) => `
              <div class="q-card" style="padding:12px" data-row="${i}">
                <div class="row"><span class="q-num">${i + 1}</span><div class="grow"></div>
                  <button class="icon-btn" data-up="${i}" type="button" ${i === 0 ? 'disabled' : ''} aria-label="up" style="width:34px;height:34px">${ic('up')}</button>
                  <button class="icon-btn" data-down="${i}" type="button" ${i === d.items.length - 1 ? 'disabled' : ''} aria-label="down" style="width:34px;height:34px">${ic('down')}</button>
                  <button class="icon-btn" data-del="${i}" type="button" aria-label="${t('delete')}" style="width:34px;height:34px;color:var(--bad)">${ic('trash')}</button></div>
                <input class="input" data-ar="${i}" value="${esc(it.labelAr)}" placeholder="${L('اسم البند بالعربية', 'Item name in Arabic')}" style="margin-top:8px">
                <input class="input ltr" data-en="${i}" value="${esc(it.label)}" placeholder="Item name in English" style="margin-top:8px">
              </div>`).join('')}</div>
            <details style="margin-top:12px"><summary class="small" style="cursor:pointer;font-weight:700;color:var(--teal-dd)">${L('لصق عدة بنود دفعة واحدة', 'Paste several items at once')}</summary>
              <textarea class="input" id="bulk" rows="4" style="margin-top:8px" placeholder="Staff knowledge | معرفة الموظفين&#10;Small parchment paper usage | استخدام ورق الزبدة الصغير"></textarea>
              <p class="hint">${L('سطر لكل بند: English | العربية', 'One per line: English | Arabic')}</p>
              <button class="btn sm ghost" id="bulkAdd" type="button">${ic('plus')} ${L('إضافة البنود', 'Add items')}</button></details>
            ${!creating && hasData(list) ? `<p class="hint">${ic('alert')} ${L('حذف بند يخفيه من التقارير القادمة، وتبقى بياناته القديمة محفوظة.', 'Deleting an item hides it from reports; its old data stays stored.')}</p>` : ''}
          </div>
          <p class="err" id="fErr"></p>
          <button class="btn primary block" type="submit">${ic('check')} ${creating ? t('create') : t('save')}</button>
          ${!creating ? `<div class="row wrap"><button class="btn ghost" id="archBtn" type="button">${ic('archive')} ${t('archive')}</button>
            ${canDelete(list) ? `<button class="btn ghost" id="delBtn" type="button" style="color:var(--bad)">${ic('trash')} ${t('delete')}</button>` : ''}</div>` : ''}
        </form>`;
      bind();
    }
    const sync = () => {
      d.nameAr = $('#nAr').value; d.name = $('#nEn').value;
      d.items.forEach((it, i) => { it.labelAr = $(`[data-ar="${i}"]`).value; it.label = $(`[data-en="${i}"]`).value; });
    };
    function bind() {
      $$('#kind button').forEach(b => b.addEventListener('click', () => { sync(); d.kind = b.dataset.k; if (creating) { d.tone = d.kind === 'fixed' ? 'teal' : 'havan'; d.icon = d.kind === 'fixed' ? 'list' : 'clipboard'; } draw(); }));
      $$('#icons button').forEach(b => b.addEventListener('click', () => { sync(); d.icon = b.dataset.i; draw(); }));
      $$('#tone button').forEach(b => b.addEventListener('click', () => { sync(); d.tone = b.dataset.t; draw(); }));
      $('#addItem').addEventListener('click', () => { sync(); d.items.push({id: '', label: '', labelAr: ''}); draw(); const last = $$('[data-ar]').pop(); if (last) last.focus(); });
      $$('[data-del]').forEach(b => b.addEventListener('click', () => { sync(); d.items.splice(+b.dataset.del, 1); if (!d.items.length) d.items.push({id: '', label: '', labelAr: ''}); draw(); }));
      $$('[data-up]').forEach(b => b.addEventListener('click', () => { sync(); const i = +b.dataset.up; [d.items[i - 1], d.items[i]] = [d.items[i], d.items[i - 1]]; draw(); }));
      $$('[data-down]').forEach(b => b.addEventListener('click', () => { sync(); const i = +b.dataset.down; [d.items[i + 1], d.items[i]] = [d.items[i], d.items[i + 1]]; draw(); }));
      $('#bulkAdd').addEventListener('click', () => {
        sync();
        const lines = $('#bulk').value.split('\n').map(s => s.trim()).filter(Boolean);
        if (!lines.length) return;
        d.items = d.items.filter(it => it.label.trim() || it.labelAr.trim());
        lines.forEach(line => { const [en, ar] = line.split('|').map(s => (s || '').trim()); d.items.push({id: '', label: en || ar, labelAr: ar || en}); });
        draw(); toast(L(`أُضيف ${lines.length} بند`, `${lines.length} item(s) added`));
      });
      $('#f').addEventListener('submit', async e => {
        e.preventDefault(); sync();
        const nameAr = d.nameAr.trim(), nameEn = d.name.trim();
        const items = d.items.map(it => ({id: it.id, label: it.label.trim() || it.labelAr.trim(), labelAr: it.labelAr.trim() || it.label.trim()})).filter(it => it.label);
        if (!nameAr && !nameEn) { $('#fErr').textContent = L('اكتب اسم القائمة.', 'Enter a list name.'); return; }
        if (!items.length) { $('#fErr').textContent = L('أضف بنداً واحداً على الأقل.', 'Add at least one item.'); return; }
        const used = new Set();
        items.forEach(it => { if (!it.id) { let base = slugify(it.label), id = base, k = 2; const taken = x => used.has(x) || items.some(o => o !== it && o.id === x); while (taken(id)) id = base + '-' + k++; it.id = id; } used.add(it.id); });
        if (creating) {
          const btn = $('#f button[type=submit]'); btn.disabled = true;
          try {
            const l = await persist({id: REMOTE ? null : state.nextId++, name: nameEn || nameAr, nameAr: nameAr || nameEn, kind: d.kind, slug: null, icon: d.icon, tone: d.tone, items,
              createdBy: u.name, createdAt: new Date().toISOString()});
            toast(L('تم إنشاء القائمة', 'List created')); setTimeout(() => go(`list.html?id=${l.id}`), 400);
          } catch (err) { btn.disabled = false; fail(err); }
        } else {
          try {
            await persist(Object.assign({}, list, {name: nameEn || nameAr, nameAr: nameAr || nameEn, kind: kindLocked ? list.kind : d.kind, icon: d.icon, tone: d.tone, items,
              updatedBy: u.name, updatedAt: new Date().toISOString()}));
            toast(t('saved')); setTimeout(() => go('admin.html'), 400);
          } catch (err) { fail(err); }
        }
      });
      const arch = $('#archBtn');
      if (arch) arch.addEventListener('click', async () => {
        if (await dialog({title: t('archive'), body: esc(L('ستختفي القائمة من الصفحة الرئيسية، وتبقى تقاريرها محفوظة. يمكنك استعادتها لاحقاً.', 'The list leaves the home page; its reports stay. You can restore it later.')), okText: t('archive')})) {
          persist(Object.assign({}, list, {archived: true})).then(() => go('admin.html')).catch(fail);
        }
      });
      const del = $('#delBtn');
      if (del) del.addEventListener('click', () => deleteList(list, () => go('admin.html')));
    }
    draw();
  }

  if (isNew) editor(null);
  else if (editId) { const l = getList(editId); if (!l) location.replace('admin.html'); else editor(l); }
  else overview();
});
