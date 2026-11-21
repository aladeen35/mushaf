/* admin.html[?new=1|?edit=N] — manage checklists & surveys (admins and list editors only) */
(function () {
  if (!requireAuth()) return;
  const editId = qs('edit'), isNew = qs('new') === '1';
  renderShell({active: 'account', back: editId || isNew ? 'admin.html' : 'home.html', title: t('manageLists'), sub: L('القوائم والسيرفيات', 'Lists & surveys')});
  if (!canEditLists()) {
    $('#page').innerHTML = `<div class="empty">${ic('lock')}<b>${t('noPermission')}</b><p>${L('اطلب من المشرف منحك صلاحية «محرّر قوائم».', 'Ask an admin to grant you the “list editor” role.')}</p><a class="btn ghost" href="home.html">${t('home')}</a></div>`;
    return;
  }
  const u = currentUser();
  const hasData = l => state.reports.some(r => r.checklistId === l.id && Object.keys(r.checks).length);

  /* ---------- overview ---------- */
  function overview() {
    const act = state.checklists.filter(l => !l.archived), arch = state.checklists.filter(l => l.archived);
    const row = l => {
      const rep = l.archived ? null : ensureCurrentWeek(l.id);
      return `<div class="item-row"><span class="lead ${listTone(l)}">${ic(listIcon(l))}</span>
        <div class="grow"><div class="title">${esc(listName(l))}</div>
        <div class="sub">${l.kind === 'fixed' ? t('fixed') : t('survey')} · ${l.items.length} ${t('items')}${rep ? ` · ${doneCount(rep)}/${TOTAL_BRANCHES} ${t('submitted')}` : ''}${l.createdBy ? ' · ' + esc(l.createdBy) : ''}</div></div>
        ${l.locked ? `<span class="badge">${ic('lock')}</span>` : l.archived
          ? `<button class="btn sm ghost" data-restore="${l.id}" type="button">${t('restore')}</button>`
          : `<a class="btn sm ghost" href="admin.html?edit=${l.id}">${ic('edit')} ${t('edit')}</a>`}</div>`;
    };
    $('#page').innerHTML = `
      <a class="btn btn-arrow dark block" href="admin.html?new=1"><span class="circ">${ic('plus')}</span>${L('إنشاء قائمة أو سيرفي جديد', 'Create a new list or survey')}</a>
      ${sectionHead(L('القوائم النشطة', 'Active lists'), `${act.length}`)}
      <div class="rows">${act.map(row).join('')}</div>
      ${arch.length ? sectionHead(L('المؤرشفة', 'Archived'), `${arch.length}`) + `<div class="rows">${arch.map(row).join('')}</div>` : ''}
      <p class="hint">${ic('lock')} ${L('القوائم المدمجة (المشروبات و Hot Cookies) مقفلة لأنها مرتبطة بقالب الإكسل ورسالة الواتساب الأصلية.', 'Built-in lists (Beverages, Hot Cookies) are locked: they mirror the original Excel template and WhatsApp survey.')}</p>`;
    $$('[data-restore]').forEach(b => b.addEventListener('click', () => { const l = getList(b.dataset.restore); l.archived = false; save(); toast(t('saved')); overview(); }));
  }

  /* ---------- editor ---------- */
  function editor(list) {
    const creating = !list;
    const d = creating ? {name: '', nameAr: '', kind: 'survey', icon: 'clipboard', tone: 'havan', items: [{id: '', label: '', labelAr: ''}]}
      : JSON.parse(JSON.stringify(list));
    if (!creating && list.locked) { location.replace('admin.html'); return; }
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
            ${!hasData(list) ? `<button class="btn ghost" id="delBtn" type="button" style="color:var(--bad)">${ic('trash')} ${t('delete')}</button>` : ''}</div>` : ''}
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
      $('#f').addEventListener('submit', e => {
        e.preventDefault(); sync();
        const nameAr = d.nameAr.trim(), nameEn = d.name.trim();
        const items = d.items.map(it => ({id: it.id, label: it.label.trim() || it.labelAr.trim(), labelAr: it.labelAr.trim() || it.label.trim()})).filter(it => it.label);
        if (!nameAr && !nameEn) { $('#fErr').textContent = L('اكتب اسم القائمة.', 'Enter a list name.'); return; }
        if (!items.length) { $('#fErr').textContent = L('أضف بنداً واحداً على الأقل.', 'Add at least one item.'); return; }
        const used = new Set();
        items.forEach(it => { if (!it.id) { let base = slugify(it.label), id = base, k = 2; const taken = x => used.has(x) || items.some(o => o !== it && o.id === x); while (taken(id)) id = base + '-' + k++; it.id = id; } used.add(it.id); });
        if (creating) {
          const l = {id: state.nextId++, name: nameEn || nameAr, nameAr: nameAr || nameEn, kind: d.kind, slug: null, icon: d.icon, tone: d.tone, items,
            createdBy: u.name, createdAt: new Date().toISOString()};
          state.checklists.push(l); save(); toast(L('تم إنشاء القائمة', 'List created'));
          setTimeout(() => go(`list.html?id=${l.id}`), 400);
        } else {
          Object.assign(list, {name: nameEn || nameAr, nameAr: nameAr || nameEn, kind: kindLocked ? list.kind : d.kind, icon: d.icon, tone: d.tone, items,
            updatedBy: u.name, updatedAt: new Date().toISOString()});
          save(); toast(t('saved')); setTimeout(() => go('admin.html'), 400);
        }
      });
      const arch = $('#archBtn');
      if (arch) arch.addEventListener('click', async () => {
        if (await dialog({title: t('archive'), body: esc(L('ستختفي القائمة من الصفحة الرئيسية، وتبقى تقاريرها محفوظة. يمكنك استعادتها لاحقاً.', 'The list leaves the home page; its reports stay. You can restore it later.')), okText: t('archive')})) {
          list.archived = true; save(); go('admin.html');
        }
      });
      const del = $('#delBtn');
      if (del) del.addEventListener('click', async () => {
        if (await dialog({title: t('delete'), body: esc(L('حذف نهائي لقائمة بلا إدخالات.', 'Permanently delete a list with no entries.')), okText: t('delete'), danger: true})) {
          state.checklists = state.checklists.filter(x => x.id !== list.id); state.reports = state.reports.filter(r => r.checklistId !== list.id); save(); go('admin.html');
        }
      });
    }
    draw();
  }

  if (isNew) editor(null);
  else if (editId) { const l = getList(editId); if (!l) location.replace('admin.html'); else editor(l); }
  else overview();
})();
