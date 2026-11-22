/* Excel export (ExcelJS, loaded on demand).
   - Beverage list: exact copy of the original "All_Branches" template (A1:S117, colours, hidden column D,
     drop-downs, COUNTIF formulas, conditional formatting, summary by product).
   - Any other list: same visual language with dynamic columns. */
'use strict';
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = CFG.EXCELJS_URL; s.onload = res; s.onerror = () => rej(new Error('ExcelJS')); document.head.appendChild(s);
  });
}
const XL = {
  navy: 'FF1F4E78', blue: 'FF2F75B5', cream: 'FFFFF9E5', grey: 'FFBFBFBF',
  fill: argb => ({type: 'pattern', pattern: 'solid', fgColor: {argb}}),
  font: o => Object.assign({name: 'Aptos Narrow', size: 11, color: {argb: 'FF000000'}}, o || {}),
  col: n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
};
XL.thin = {style: 'thin', color: {argb: XL.grey}};
XL.border = {left: XL.thin, right: XL.thin, top: XL.thin, bottom: XL.thin};

async function downloadWorkbook(wb, name) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const statusRules = (ref, start) => [
  {type: 'cellIs', operator: 'equal', priority: start, formulae: ['"Okay"'], style: {font: {color: {argb: 'FF006100'}}, fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFC6EFCE'}}}},
  {type: 'cellIs', operator: 'equal', priority: start + 1, formulae: ['"Not okay and fixed"'], style: {font: {color: {argb: 'FF9C5700'}}, fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFFFEB9C'}}}},
  {type: 'cellIs', operator: 'equal', priority: start + 2, formulae: ['"Not fixed"'], style: {font: {color: {argb: 'FF9C0006'}}, fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFFFC7CE'}}}},
  {type: 'cellIs', operator: 'equal', priority: start + 3, formulae: ['"Not checked"'], style: {font: {color: {argb: 'FF404040'}}, fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: 'FFE7E6E6'}}}}
];

/* ---------- beverage — original template ---------- */
async function exportBeverage(list, rep, into) {
  await loadExcelJS();
  const wb = into || new ExcelJS.Workbook(); wb.creator = 'HafM.list'; wb.created = new Date();
  const ws = wb.addWorksheet('All_Branches');
  ws.columns = [6.46, 7.53, 25.42, 25.42, 13.18, 13.18, 13.18, 13.18, 13.18, 13.18, 13.18, 13.18, 13.18, 9.14, 9.14, 9.14, 9.14, 9.14, 29.19].map(width => ({width}));
  ws.getColumn(4).hidden = true; // Area Manager is hidden in the original
  // row 1
  ws.mergeCells('A1:S1');
  const c1 = ws.getCell('A1'); c1.value = 'DAILY BEVERAGE QUALITY CHECKLIST – ALL BRANCHES';
  c1.font = XL.font({size: 16, bold: true, color: {argb: 'FFFFFFFF'}}); c1.fill = XL.fill(XL.navy); c1.alignment = {horizontal: 'center', vertical: 'middle'};
  ws.getRow(1).height = 32.1;
  // row 2
  ws.getCell('A2').value = 'Date:'; ws.getCell('A2').font = XL.font({bold: true});
  const dc = ws.getCell('C2'); dc.value = new Date(Date.UTC(+rep.date.slice(0, 4), +rep.date.slice(5, 7) - 1, +rep.date.slice(8, 10))); dc.numFmt = 'yyyy-mm-dd';
  dc.fill = XL.fill(XL.cream); dc.border = XL.border; dc.font = XL.font(); dc.alignment = {horizontal: 'center'};
  ws.mergeCells('M2:S2');
  ws.getCell('M2').value = 'Status options: Okay · Not okay and fixed · Not fixed (not okay, not fixed) · Not checked';
  ws.getCell('M2').font = XL.font({italic: true, color: {argb: 'FF595959'}});
  // row 4 header
  const headers = ['No.', 'Code', 'Branch Name', 'Area Manager', ...PRODUCTS, 'Okay', 'Not okay and fixed', 'Not fixed', 'Not checked ', 'not available', 'Remarks'];
  ws.getRow(4).height = 36;
  headers.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1); cell.value = h;
    cell.font = XL.font({bold: true, color: {argb: 'FFFFFFFF'}}); cell.fill = XL.fill(i >= 13 && i <= 17 ? XL.blue : XL.navy);
    cell.alignment = {horizontal: 'center', vertical: 'middle', wrapText: true}; cell.border = XL.border;
  });
  // rows 5..(4 + number of branches) — 106 branches = rows 5..110 as in the original
  const LR = 4 + BRANCHES.length, SR = LR + 2;
  const ids = list.items.map(it => it.id);
  BRANCHES.forEach((b, idx) => {
    const r = 5 + idx, row = ws.getRow(r); row.height = 18;
    const chk = rep.checks[b.no];
    row.getCell(1).value = {formula: 'ROW()-4', result: idx + 1};
    row.getCell(2).value = b.code; row.getCell(3).value = b.name; row.getCell(4).value = b.manager;
    for (let c = 1; c <= 19; c++) { const cell = row.getCell(c); cell.font = XL.font(); cell.border = XL.border; cell.alignment = {vertical: 'middle', horizontal: (c <= 2 || (c >= 5 && c <= 18)) ? 'center' : undefined}; }
    PRODUCTS.forEach((p, i) => {
      const cell = row.getCell(5 + i);
      const v = chk ? chk.s[ids[i]] : null; cell.value = v == null ? null : v;
      cell.fill = XL.fill(XL.cream);
    });
    for (let c = 14; c <= 18; c++) row.getCell(c).value = {formula: `COUNTIF($E${r}:$M${r},${XL.col(c)}$4)`};
    row.getCell(19).value = chk && chk.remarks ? chk.remarks : null;
    row.getCell(19).alignment = {vertical: 'middle', wrapText: false};
  });
  ws.dataValidations.add(`E5:M${LR}`, {type: 'list', allowBlank: true, formulae: ['"Okay,Not okay and fixed,Not fixed,Not checked , not available"']});
  ws.addConditionalFormatting({ref: `C5:D${LR}`, rules: [{type: 'expression', priority: 1, formulae: ['$P5>0'], style: {font: {color: {argb: 'FF9C0006'}}}}]});
  ws.addConditionalFormatting({ref: `E5:M${LR}`, rules: statusRules(`E5:M${LR}`, 2)});
  // summary SR..SR+5 (112..117 in the original)
  ws.getRow(SR).height = 41.25;
  ws.mergeCells(`A${SR}:C${SR}`);
  const sh = ws.getCell(`A${SR}`); sh.value = 'SUMMARY BY PRODUCT';
  sh.font = XL.font({bold: true, color: {argb: 'FFFFFFFF'}}); sh.fill = XL.fill(XL.navy); sh.alignment = {horizontal: 'center', vertical: 'middle'};
  PRODUCTS.forEach((p, i) => {
    const cell = ws.getCell(SR, 5 + i); cell.value = p;
    cell.font = XL.font({bold: true, color: {argb: 'FFFFFFFF'}}); cell.fill = XL.fill(XL.navy);
    cell.alignment = {horizontal: 'center', vertical: 'middle', wrapText: true}; cell.border = XL.border;
  });
  ['Okay', 'Not okay and fixed', 'Not fixed', 'Not checked ', 'not available'].forEach((label, li) => {
    const r = SR + 1 + li; ws.mergeCells(`A${r}:C${r}`);
    const lc = ws.getCell(r, 1); lc.value = label; lc.font = XL.font({bold: true}); lc.border = XL.border;
    PRODUCTS.forEach((p, i) => {
      const col = XL.col(5 + i), cell = ws.getCell(r, 5 + i);
      cell.value = {formula: `COUNTIF(${col}$5:${col}$${LR},$A${r})`}; cell.font = XL.font(); cell.border = XL.border; cell.alignment = {horizontal: 'center'};
    });
  });
  ws.views = [{state: 'frozen', xSplit: 4, ySplit: 4, topLeftCell: 'E5', activeCell: 'E5'}];
  ws.pageSetup = {orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:4'};
  if (!into) await downloadWorkbook(wb, `Beverage_Tasting_${rep.weekStart}.xlsx`);
}

/* ---------- any other list — dynamic columns ---------- */
async function exportGeneric(list, rep, into, sheetName) {
  await loadExcelJS();
  const wb = into || new ExcelJS.Workbook(); wb.creator = 'HafM.list'; wb.created = new Date();
  const ws = wb.addWorksheet(sheetName || 'All_Branches');
  const sts = statusesFor(list), n = list.items.length;
  const firstItem = 6, lastItem = firstItem + n - 1, firstCnt = lastItem + 1, lastCnt = firstCnt + sts.length - 1;
  const audCol = lastCnt + 1, remCol = lastCnt + 2, lastCol = remCol;
  const L1 = XL.col(firstItem), L2 = XL.col(lastItem);
  ws.columns = [6.5, 7.5, 25.4, 25.4, 14].concat(Array(n).fill(16), Array(sts.length).fill(9.5), [20, 32]).map(width => ({width}));
  ws.getColumn(4).hidden = true;
  ws.mergeCells(1, 1, 1, lastCol);
  const c1 = ws.getCell('A1'); c1.value = (list.name || list.nameAr).toUpperCase() + ' – ALL BRANCHES';
  c1.font = XL.font({size: 16, bold: true, color: {argb: 'FFFFFFFF'}}); c1.fill = XL.fill(XL.navy); c1.alignment = {horizontal: 'center', vertical: 'middle'};
  ws.getRow(1).height = 32.1;
  ws.getCell('A2').value = 'Week:'; ws.getCell('A2').font = XL.font({bold: true});
  ws.getCell('C2').value = `Week ${weekInfo(rep.weekStart).no} · ${rep.weekStart} → ${rep.weekEnd}`; ws.getCell('C2').fill = XL.fill(XL.cream); ws.getCell('C2').border = XL.border;
  ws.getCell(2, firstItem).value = (list.nameAr && list.nameAr !== list.name ? list.nameAr + ' · ' : '') + 'Status options: ' + (list.kind === 'survey' ? surveyOptions(list).map(o => o.en && o.en !== o.v ? `${o.v} = ${o.en}` : o.v) : sts.map(s => s.trim())).join(' · ');
  ws.getCell(2, firstItem).font = XL.font({italic: true, color: {argb: 'FF595959'}});
  const headers = ['No.', 'Code', 'Branch Name', 'Area Manager', 'City', ...list.items.map(it => it.labelAr && it.labelAr !== it.label ? `${it.label}\n${it.labelAr}` : it.label), ...sts, 'Auditor', 'Remarks'];
  ws.getRow(4).height = 48;
  headers.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1); cell.value = h;
    cell.font = XL.font({bold: true, color: {argb: 'FFFFFFFF'}}); cell.fill = XL.fill(i + 1 >= firstCnt && i + 1 <= lastCnt ? XL.blue : XL.navy);
    cell.alignment = {horizontal: 'center', vertical: 'middle', wrapText: true}; cell.border = XL.border;
  });
  const lastRow = 4 + BRANCHES.length;
  BRANCHES.forEach((b, idx) => {
    const r = 5 + idx, row = ws.getRow(r); row.height = 18; const chk = rep.checks[b.no];
    const vals = [{formula: 'ROW()-4', result: idx + 1}, b.code, b.name, b.manager, b.cityEn];
    vals.forEach((v, i) => { row.getCell(i + 1).value = v; });
    list.items.forEach((it, i) => {
      const cell = row.getCell(firstItem + i); const v = chk ? chk.s[it.id] : null; cell.value = v == null ? null : v;
      cell.fill = XL.fill(XL.cream);
    });
    sts.forEach((s, i) => { row.getCell(firstCnt + i).value = {formula: `COUNTIF($${L1}${r}:$${L2}${r},${XL.col(firstCnt + i)}$4)`}; });
    row.getCell(audCol).value = chk ? (chk.auditor || null) : null;
    row.getCell(remCol).value = chk && chk.remarks ? chk.remarks : null;
    for (let c = 1; c <= lastCol; c++) { const cell = row.getCell(c); cell.font = XL.font(); cell.border = XL.border; if (c <= 2 || (c >= firstItem && c <= lastCnt)) cell.alignment = {horizontal: 'center', vertical: 'middle'}; }
  });
  const ref = `${L1}5:${L2}${lastRow}`;
  ws.dataValidations.add(ref, {type: 'list', allowBlank: true, formulae: ['"' + sts.join(',') + '"']});
  if (list.kind === 'survey') {
    const TC = {ok: ['FF006100', 'FFC6EFCE'], bad: ['FF9C0006', 'FFFFC7CE'], fixed: ['FF9C5700', 'FFFFEB9C'], nc: ['FF404040', 'FFE7E6E6'], na: ['FF5D4396', 'FFECE6F7']};
    ws.addConditionalFormatting({ref, rules: surveyOptions(list).map((o, i) => ({type: 'cellIs', operator: 'equal', priority: i + 1, formulae: ['"' + String(o.v).replace(/"/g, '""') + '"'],
      style: {font: {color: {argb: (TC[o.tone] || TC.nc)[0]}}, fill: {type: 'pattern', pattern: 'solid', bgColor: {argb: (TC[o.tone] || TC.nc)[1]}}}}))});
  } else ws.addConditionalFormatting({ref, rules: statusRules(ref, 1)});
  // summary
  const sr = lastRow + 2;
  ws.getRow(sr).height = 41.25;
  ws.mergeCells(sr, 1, sr, 3);
  const sh = ws.getCell(sr, 1); sh.value = 'SUMMARY BY ITEM'; sh.font = XL.font({bold: true, color: {argb: 'FFFFFFFF'}}); sh.fill = XL.fill(XL.navy); sh.alignment = {horizontal: 'center', vertical: 'middle'};
  list.items.forEach((it, i) => { const cell = ws.getCell(sr, firstItem + i); cell.value = it.label; cell.font = XL.font({bold: true, color: {argb: 'FFFFFFFF'}}); cell.fill = XL.fill(XL.navy); cell.alignment = {horizontal: 'center', vertical: 'middle', wrapText: true}; cell.border = XL.border; });
  sts.forEach((s, li) => {
    const r = sr + 1 + li; ws.mergeCells(r, 1, r, 3);
    const lc = ws.getCell(r, 1); lc.value = s; lc.font = XL.font({bold: true}); lc.border = XL.border;
    list.items.forEach((it, i) => { const col = XL.col(firstItem + i), cell = ws.getCell(r, firstItem + i); cell.value = {formula: `COUNTIF(${col}$5:${col}$${lastRow},$A${r})`}; cell.border = XL.border; cell.alignment = {horizontal: 'center'}; cell.font = XL.font(); });
  });
  ws.views = [{state: 'frozen', xSplit: 5, ySplit: 4, topLeftCell: XL.col(firstItem) + '5'}];
  ws.pageSetup = {orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:4'};
  const safe = String(list.name || 'List').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'List';
  if (!into) await downloadWorkbook(wb, `${safe}_W${weekInfo(rep.weekStart).no}_${rep.weekStart}.xlsx`);
}
async function exportReport(list, rep) {
  if (list.slug === 'beverage') return exportBeverage(list, rep);
  return exportGeneric(list, rep);
}

/* ---------- one workbook for the whole week: every list (one sheet each) + auditors summary ---------- */
async function exportAll(weekStart) {
  await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const lists = state.checklists.filter(l => !l.archived || state.reports.some(r => r.checklistId === l.id && r.weekStart === weekStart && Object.keys(r.checks).length));
  const used = new Set(['All_Branches', 'Auditors']);
  const sheetFor = l => {
    let base = String(l.name || l.nameAr || 'List').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 28) || 'List', n = base, k = 2;
    while (used.has(n)) n = base.slice(0, 26) + ' ' + k++;
    used.add(n); return n;
  };
  const empty = l => ({checklistId: l.id, weekStart, weekEnd: fmtDate(addDays(parseDate(weekStart), 6)), date: weekStart, checks: {}});
  for (const l of lists) {
    const rep = state.reports.find(r => r.checklistId === l.id && r.weekStart === weekStart && !r.seed) || state.reports.find(r => r.checklistId === l.id && r.weekStart === weekStart) || empty(l);
    if (l.slug === 'beverage') await exportBeverage(l, rep, wb); else await exportGeneric(l, rep, wb, sheetFor(l));
  }
  // auditors summary
  const ws = wb.addWorksheet('Auditors');
  ws.columns = [{width: 28}, {width: 32}].concat(lists.map(() => ({width: 16})), [{width: 12}, {width: 14}]);
  ws.mergeCells(1, 1, 1, 4 + lists.length);
  const c1 = ws.getCell('A1'); c1.value = `AUDITORS – WEEK ${weekInfo(weekStart).no} (${weekStart} → ${fmtDate(addDays(parseDate(weekStart), 6))})`;
  c1.font = XL.font({size: 14, bold: true, color: {argb: 'FFFFFFFF'}}); c1.fill = XL.fill(XL.navy); c1.alignment = {horizontal: 'center', vertical: 'middle'};
  ws.getRow(1).height = 28;
  const head = ['Auditor', 'E-mail', ...lists.map(l => l.name || l.nameAr), 'Total', 'Not fixed / ❌'];
  head.forEach((h, i) => { const c = ws.getCell(3, i + 1); c.value = h; c.font = XL.font({bold: true, color: {argb: 'FFFFFFFF'}}); c.fill = XL.fill(XL.navy); c.border = XL.border; c.alignment = {horizontal: 'center', vertical: 'middle', wrapText: true}; });
  ws.getRow(3).height = 32;
  const by = {};
  lists.forEach((l, li) => state.reports.filter(r => r.checklistId === l.id && r.weekStart === weekStart).forEach(r => Object.entries(r.checks).filter(([no]) => branchByNo(no)).map(([, c]) => c).forEach(c => {
    const key = c.email || c.auditor || 'Original file';
    const a = by[key] || (by[key] = {name: c.auditor || 'Original file', email: c.email || '', n: lists.map(() => 0), bad: 0});
    a.n[li]++; if (Object.values(c.s || {}).some(v => statusKey(v) === 'bad')) a.bad++;
  })));
  Object.values(by).sort((a, b) => b.n.reduce((x, y) => x + y, 0) - a.n.reduce((x, y) => x + y, 0)).forEach((a, i) => {
    const row = [a.name, a.email, ...a.n, a.n.reduce((x, y) => x + y, 0), a.bad];
    row.forEach((v, j) => { const c = ws.getCell(4 + i, j + 1); c.value = v; c.font = XL.font({bold: j === 0}); c.border = XL.border; if (j >= 2) c.alignment = {horizontal: 'center'}; });
  });
  ws.views = [{state: 'frozen', ySplit: 3}];
  await downloadWorkbook(wb, `HafM_All_Lists_W${weekInfo(weekStart).no}_${weekStart}.xlsx`);
}
