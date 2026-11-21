/* HafM.list — core: storage, auth, i18n, dates, icons, page shell.
   Loaded on every page after config.js and data.js. Vanilla JS, no build step. */
'use strict';
const CFG = window.HAFM_CONFIG || {};
const LS_KEY = 'hafmList.v2';
const LS_V1 = 'halfMillionQualityAppV1';
const SS_SESSION = 'hafmList.session';
/* BRANCHES (data.js) is the base list; admins' edits / additions / deletions (state.branchEdits, synced) are applied on top */
const BASE_BRANCHES = BRANCHES.map(b => Object.assign({}, b));
let TOTAL_BRANCHES = BRANCHES.length;
const REMOTE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY);

/* ---------- tiny DOM helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qs = k => new URLSearchParams(location.search).get(k);
const go = url => { location.href = url; };

/* ---------- SHA-256 (sync, for PIN + admin hashes; works on file:// and http) ---------- */
function sha256(ascii) {
  const bytes = new TextEncoder().encode(ascii);
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = bytes.length, withPad = ((l + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(withPad); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(withPad - 4, l * 8); dv.setUint32(withPad - 8, Math.floor(l / 0x20000000));
  const w = new Uint32Array(64); const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < withPad; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15],7) ^ rotr(w[j-15],18) ^ (w[j-15] >>> 3);
      const s1 = rotr(w[j-2],17) ^ rotr(w[j-2],19) ^ (w[j-2] >>> 10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) | 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let j = 0; j < 64; j++) {
      const t1 = (h + (rotr(e,6) ^ rotr(e,11) ^ rotr(e,25)) + ((e & f) ^ (~e & g)) + K[j] + w[j]) | 0;
      const t2 = ((rotr(a,2) ^ rotr(a,13) ^ rotr(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0]=(H[0]+a)|0; H[1]=(H[1]+b)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0; H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/* ---------- i18n ---------- */
const I18N = {
  ar: {
    appName:'قوائم الجودة', appFull:'1/2 Million Quality list', brand:'هاف مليون',
    home:'الرئيسية', reports:'التقارير', branches:'الفروع', review:'المراجعة', account:'حسابي', lists:'القوائم',
    hello:'أهلاً', goodMorning:'صباح الجودة', goodEvening:'مساء الجودة',
    checklists:'قوائم الفحص والسيرفي', checklistsHint:'اختر بطاقة القائمة لتنتقل إلى صفحتها، ثم المنطقة والفرع.',
    fixed:'فحص ثابت', survey:'سيرفي', items:'بنود', item:'بند', branchesWord:'فرع', submitted:'مُرسَل', pending:'لم يُدخل',
    current:'الحالية', thisWeek:'هذا الأسبوع', week:'الأسبوع', weekRange:'السبت {a} — الجمعة {b}',
    newList:'قائمة جديدة', manageLists:'إدارة القوائم', open:'فتح', start:'ابدأ',
    dailyIssue:'مخالفة اليوم', example:'مثال', quiz:'سؤال المراجعة', nextQuestion:'سؤال آخر', yourScore:'نتيجتك',
    correct:'إجابة صحيحة', wrong:'إجابة غير صحيحة', correctAnswer:'الإجابة الصحيحة', trueText:'صح', falseText:'خطأ',
    critical:'حرجة', major:'كبرى', minor:'بسيطة', all:'الكل',
    chooseRegion:'اختر المنطقة', chooseBranch:'اختر الفرع', search:'بحث…', noResults:'لا نتائج',
    back:'رجوع', save:'حفظ', saved:'تم الحفظ', saveNext:'حفظ والفرع التالي', markAllOk:'الكل سليم', copyPrev:'نسخ من آخر تقرير', clear:'مسح',
    remarks:'ملاحظات', remarksPh:'اكتب ملاحظة عن الفرع (اختياري)…', auditor:'الفاحص', date:'التاريخ',
    deviation:'انحراف — يحتاج إجراءً / تدريباً. أبلغ فوراً.', notFixedWarn:'مشكلة غير مصلحة — اذكر السبب في الملاحظات.',
    incomplete:'بنود لم تُعبّأ: {n}. هل تريد الحفظ على أي حال؟', noPrev:'لا يوجد تقرير سابق لهذا الفرع.',
    logout:'تسجيل الخروج', language:'اللغة', role:'الصلاحية', admin:'مشرف', editor:'محرّر قوائم', auditorRole:'فاحص',
    cancel:'إلغاء', confirm:'تأكيد', delete:'حذف', edit:'تعديل', archive:'أرشفة', restore:'استعادة', create:'إنشاء',
    exportExcel:'تصدير Excel', print:'طباعة', offline:'أنت غير متصل — البيانات تُحفظ على هذا الجهاز.',
    progress:'التقدم', okay:'سليمة', notFixed:'غير مصلحة', fixedLbl:'أُصلحت', notChecked:'لم تُفحص', na:'غير متوفر',
    noPermission:'هذه الصفحة للمشرفين ومحرري القوائم فقط.', viewOnly:'عرض فقط'
  },
  en: {
    appName:'Quality Lists', appFull:'1/2 Million Quality list', brand:'Half Million',
    home:'Home', reports:'Reports', branches:'Branches', review:'Review', account:'Account', lists:'Lists',
    hello:'Hello', goodMorning:'Good morning', goodEvening:'Good evening',
    checklists:'Checklists & surveys', checklistsHint:'Tap a list card to open its page, then pick a region and a branch.',
    fixed:'Fixed check', survey:'Survey', items:'items', item:'item', branchesWord:'branches', submitted:'submitted', pending:'Pending',
    current:'Current', thisWeek:'This week', week:'Week', weekRange:'Sat {a} — Fri {b}',
    newList:'New list', manageLists:'Manage lists', open:'Open', start:'Start',
    dailyIssue:'Issue of the day', example:'Example', quiz:'Review question', nextQuestion:'Another question', yourScore:'Your score',
    correct:'Correct', wrong:'Not correct', correctAnswer:'Correct answer', trueText:'True', falseText:'False',
    critical:'Critical', major:'Major', minor:'Minor', all:'All',
    chooseRegion:'Choose a region', chooseBranch:'Choose a branch', search:'Search…', noResults:'No results',
    back:'Back', save:'Save', saved:'Saved', saveNext:'Save & next branch', markAllOk:'All okay', copyPrev:'Copy last report', clear:'Clear',
    remarks:'Remarks', remarksPh:'Add a note about the branch (optional)…', auditor:'Auditor', date:'Date',
    deviation:'Deviation — action / training needed. Report immediately.', notFixedWarn:'Not fixed — explain the reason in remarks.',
    incomplete:'{n} item(s) not filled. Save anyway?', noPrev:'No previous report for this branch.',
    logout:'Sign out', language:'Language', role:'Role', admin:'Admin', editor:'List editor', auditorRole:'Auditor',
    cancel:'Cancel', confirm:'Confirm', delete:'Delete', edit:'Edit', archive:'Archive', restore:'Restore', create:'Create',
    exportExcel:'Export Excel', print:'Print', offline:'You are offline — data is saved on this device.',
    progress:'Progress', okay:'Okay', notFixed:'Not fixed', fixedLbl:'Fixed', notChecked:'Not checked', na:'N/A',
    noPermission:'This page is for admins and list editors only.', viewOnly:'View only'
  }
};
let lang = 'ar';
/* isolate ISO dates / codes so they stay left-to-right inside Arabic sentences */
const D = s => '\u2066' + String(s).replace(/-/g, '\u2011') + '\u2069';
function t(k, vars) {
  let s = (I18N[lang] && I18N[lang][k]) || I18N.ar[k] || k;
  if (vars) Object.keys(vars).forEach(v => { s = s.replace('{' + v + '}', /^\d{4}-\d{2}-\d{2}$/.test(vars[v]) ? D(vars[v]) : vars[v]); });
  return s;
}
const L = (ar, en) => (lang === 'ar' ? ar : en);
const listName = l => (lang === 'ar' ? (l.nameAr || l.name) : (l.name || l.nameAr));
const itemLabel = it => (lang === 'ar' ? (it.labelAr || it.label) : (it.label || it.labelAr));
const itemSub = it => (lang === 'ar' ? (it.label !== it.labelAr ? it.label : '') : (it.labelAr !== it.label ? it.labelAr : ''));
const cityName = b => (lang === 'ar' ? b.cityAr : b.cityEn);
const levelName = l => (lang === 'ar' ? ({Critical:'حرجة', Major:'كبرى', Minor:'بسيطة'}[l] || l) : l);
const issueTitle = i => (lang === 'ar' ? (i.titleAr || i.titleEn) : (i.titleEn || i.titleAr));
const issueDesc = i => (lang === 'ar' ? (i.descAr || i.descEn) : (i.descEn || i.descAr));
const issueExample = i => (lang === 'ar' ? (i.exampleAr || i.exampleEn) : (i.exampleEn || i.exampleAr));
const fmtNum = n => Number(n || 0).toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US');

/* ---------- dates (Asia/Riyadh, weeks Saturday → Friday) ---------- */
function riyadhToday() {
  const p = {}; new Intl.DateTimeFormat('en-CA', {timeZone: CFG.TIME_ZONE || 'Asia/Riyadh', year:'numeric', month:'2-digit', day:'2-digit'})
    .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
}
function riyadhHour() { return +new Intl.DateTimeFormat('en-GB', {timeZone: CFG.TIME_ZONE || 'Asia/Riyadh', hour:'2-digit', hour12:false}).format(new Date()); }
const fmtDate = d => d.toISOString().slice(0, 10);
const parseDate = s => new Date(s + 'T00:00:00Z');
function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function weekStartOf(d) { const sd = CFG.WEEK_START_DAY == null ? 6 : CFG.WEEK_START_DAY; return addDays(d, -((d.getUTCDay() - sd + 7) % 7)); }
const todayStr = () => fmtDate(riyadhToday());
/* Week number of the year. Weeks run Saturday → Friday.
   'first-full' (config default): week 1 starts on the first Saturday of the year → 2026: 14–20 Nov = 46, 21–27 Nov = 47.
   'jan1' (= Excel WEEKNUM(date,16)): week 1 is the Sat–Fri week that contains 1 January → 21–27 Nov 2026 = 48. */
function weekInfo(ws) {
  const s = typeof ws === 'string' ? parseDate(ws) : ws;
  if (CFG.WEEK1_RULE === 'first-full') {
    let y = s.getUTCFullYear(), first = weekStartOf(addDays(new Date(Date.UTC(y, 0, 1)), 6));
    if (s < first) { y--; first = weekStartOf(addDays(new Date(Date.UTC(y, 0, 1)), 6)); }
    return {no: Math.round((s - first) / 604800000) + 1, year: y};
  }
  const y = addDays(s, 6).getUTCFullYear(); // the year of the week's Friday
  return {no: Math.round((s - weekStartOf(new Date(Date.UTC(y, 0, 1)))) / 604800000) + 1, year: y};
}
/* "21–27 نوفمبر 2026" / "21–27 Nov 2026" (spans months/years when needed) */
function weekSpan(ws) {
  const a = parseDate(ws), b = addDays(a, 6);
  const loc = lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  const f = o => new Intl.DateTimeFormat(loc, Object.assign({timeZone: 'UTC'}, o));
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${f({month: 'long', year: 'numeric'}).format(b)}`;
  if (a.getUTCFullYear() === b.getUTCFullYear()) return `${f({day: 'numeric', month: 'short'}).format(a)} – ${f({day: 'numeric', month: 'short', year: 'numeric'}).format(b)}`;
  return `${f({day: 'numeric', month: 'short', year: 'numeric'}).format(a)} – ${f({day: 'numeric', month: 'short', year: 'numeric'}).format(b)}`;
}
const weekName = ws => { const w = weekInfo(ws); return L(`الأسبوع ${w.no}`, `Week ${w.no}`); };
const weekLabel = ws => `${weekName(ws)} · ${weekSpan(ws)}`;
const currentWeekStart = () => fmtDate(weekStartOf(riyadhToday()));
const riyadhDayNumber = () => Math.floor(riyadhToday().getTime() / 86400000);
function niceDate(s) {
  try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}).format(parseDate(s)); }
  catch (e) { return s; }
}
function timeAgo(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return L('الآن', 'now');
  if (m < 60) return L(`قبل ${m} د`, `${m}m ago`);
  const h = Math.round(m / 60); if (h < 24) return L(`قبل ${h} س`, `${h}h ago`);
  const d = Math.round(h / 24); return L(`قبل ${d} يوم`, `${d}d ago`);
}

/* ---------- statuses ---------- */
const SURVEY_STATUSES = ['✅', '❌', 'N/A'];
const statusesFor = list => (list.kind === 'survey' ? SURVEY_STATUSES : BEVERAGE_STATUSES);
function statusKey(s) {
  if (s == null || s === '') return '';
  if (s === 'Okay' || s === '✅') return 'ok';
  if (s === 'Not okay and fixed') return 'fixed';
  if (s === 'Not fixed' || s === '❌') return 'bad';
  if (String(s).trim() === 'Not checked') return 'nc';
  if (s === 'not available' || s === 'N/A') return 'na';
  return '';
}
function statusText(s) {
  const k = statusKey(s);
  if (!k) return '—';
  const ar = {ok:'سليم', fixed:'غير سليم وأُصلح', bad:'غير مصلح', nc:'لم يُفحص', na:'غير متوفر'};
  if (lang === 'ar') return (s === '✅' || s === '❌' || s === 'N/A') ? ({ok:'نعم ✅', bad:'لا ❌', na:'لا ينطبق'}[k]) : ar[k];
  return (s === '✅' ? 'Yes ✅' : s === '❌' ? 'No ❌' : String(s).trim());
}

/* ---------- default data ---------- */
const BEV_AR = {'Hibiscus':'كركديه','Passion Fruit':'باشن فروت','Matcha':'ماتشا','Hot Chocolate':'شوكولاتة ساخنة','Espresso':'إسبريسو',
  'Ethiopian Drip (Hot)':'تقطير إثيوبي ساخن','Ethiopian Drip (Cold)':'تقطير إثيوبي بارد','Brazil (Hot)':'برازيلي ساخن','Brazil (Cold)':'برازيلي بارد'};
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
function defaultChecklists() {
  return [
    {id:1, name:'Beverage Quality Checklist', nameAr:'فحص جودة المشروبات', kind:'fixed', slug:'beverage', icon:'coffee', locked:true,
     items: PRODUCTS.map(p => ({id: slugify(p), label: p, labelAr: BEV_AR[p] || p}))},
    {id:2, name:'Hot Cookies', nameAr:'هوت كوكيز', kind:'survey', slug:'hot-cookies', icon:'cookie', locked:true,
     items:[
       {id:'staff-knowledge', label:'Staff knowledge — Hot Cookies SOPs & specifications', labelAr:'معرفة الموظفين — إجراءات ومواصفات Hot Cookies'},
       {id:'parchment-paper', label:'Small parchment paper usage', labelAr:'استخدام ورق الزبدة الصغير'},
       {id:'turbo-chef-280', label:'Turbo Chef temperature at 280 °C', labelAr:'حرارة توربو شيف 280°'}]}
  ];
}
function seedBeverageReport(list) {
  // Original file: date 2026-11-01 — 50 of 106 submitted: 425 Okay / 9 fixed / 3 Not fixed / 9 Not checked / 4 not available.
  const checks = {};
  BRANCHES.forEach(b => {
    const vals = PRODUCTS.map(p => b.checks[p]);
    if (vals.some(v => v != null)) {
      const s = {}; list.items.forEach((it, i) => { s[it.id] = vals[i]; });
      checks[b.no] = {s, remarks: b.remarks || '', auditor: null, email: null, at: '2026-11-01T09:00:00Z', seed: true};
    }
  });
  return {id: 1, checklistId: 1, weekStart: '2026-10-31', weekEnd: '2026-11-06', date: '2026-11-01', seed: true, checks};
}
function freshState() {
  const checklists = defaultChecklists();
  return {version: 2, lang: 'ar', users: {}, perms: {}, checklists, reports: [seedBeverageReport(checklists[0])],
    quiz: {correct: 0, total: 0, streak: 0, best: 0}, nextId: 100, lastEmail: null, createdAt: new Date().toISOString()};
}
/* migrate data typed in the first standalone version (localStorage key halfMillionQualityAppV1) */
function migrateV1(st) {
  try {
    const v1 = JSON.parse(localStorage.getItem(LS_V1) || 'null');
    if (!v1 || !Array.isArray(v1.checklists)) return st;
    const idMap = {};
    v1.checklists.forEach(l => {
      let target = st.checklists.find(x => x.id === l.id && x.slug && x.slug === l.slug);
      if (!target) {
        target = {id: st.nextId++, name: l.name, nameAr: l.nameAr || l.name, kind: l.kind, slug: null, icon: l.kind === 'survey' ? 'clipboard' : 'list',
          items: l.items.map((it, i) => ({id: slugify(it.label) + '-' + i, label: it.label, labelAr: it.labelAr || it.label}))};
        st.checklists.push(target);
      }
      idMap[l.id] = target;
    });
    (v1.reports || []).forEach(r => {
      const list = idMap[r.checklistId]; if (!list) return;
      if (list.id === 1 && r.weekStart === '2026-10-31') return; // seed already present
      let rep = st.reports.find(x => x.checklistId === list.id && x.weekStart === r.weekStart);
      if (!rep) { rep = {id: st.nextId++, checklistId: list.id, weekStart: r.weekStart, weekEnd: r.weekEnd, date: r.date, checks: {}}; st.reports.push(rep); }
      Object.entries(r.checks || {}).forEach(([no, c]) => {
        const s = {}; list.items.forEach((it, i) => { s[it.id] = (c.statuses || [])[i] == null ? null : c.statuses[i]; });
        rep.checks[no] = {s, remarks: c.remarks || '', auditor: c.auditor || null, email: null, at: null};
      });
    });
    if (v1.quizScore) { st.quiz.correct += v1.quizScore.correct || 0; st.quiz.total += v1.quizScore.total || 0; }
    st.migratedV1 = new Date().toISOString();
  } catch (e) { console.warn('v1 migration skipped', e); }
  return st;
}
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.version === 2 && Array.isArray(s.checklists)) return s; } catch (e) {}
  const st = REMOTE ? freshState() : migrateV1(freshState());
  try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {}
  return st;
}
let state = loadState();
lang = state.lang || 'ar';
/* first start in shared mode: entries typed only on this device before the database existed are not kept */
if (REMOTE && !state.remoteMode) {
  state.reports = state.reports.filter(r => r.seed); state.outbox = []; state.lastSync = null; state.remoteMode = new Date().toISOString();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
}
if (!state.outbox) state.outbox = [];
if (!state.branchEdits) state.branchEdits = {};
/* rebuild BRANCHES from the base + edits: {no: {data:{…fields}, deleted:bool}} */
function applyBranchEdits() {
  const edits = state.branchEdits || {};
  const out = [];
  BASE_BRANCHES.forEach(b => { const e = edits[b.no]; if (e && e.deleted) return; out.push(e ? Object.assign({}, b, e.data || {}, {no: b.no}) : Object.assign({}, b)); });
  Object.keys(edits).map(Number).filter(no => !BASE_BRANCHES.some(b => b.no === no)).sort((a, b) => a - b).forEach(no => {
    const e = edits[no]; if (e.deleted) return;
    out.push(Object.assign({no, code: '', name: '', manager: '', regionEn: '', regionAr: '', cityEn: '', cityAr: '', checks: {}, remarks: null}, e.data || {}, {no}));
  });
  BRANCHES.length = 0; out.forEach(b => BRANCHES.push(b));
  TOTAL_BRANCHES = BRANCHES.length;
}
const deletedBranches = () => Object.entries(state.branchEdits || {}).filter(([, e]) => e.deleted).map(([no, e]) => Object.assign({}, BASE_BRANCHES.find(b => b.no === +no) || {}, e.data || {}, {no: +no}));
applyBranchEdits();
/* official name plus the name the team uses (e.g. Mansurah · معن) */
function branchAlias(b) { return (lang === 'ar' ? (b.aliasAr || b.aliasEn) : (b.aliasEn || b.aliasAr)) || ''; }
const bName = b => (branchAlias(b) ? `${b.name} · ${branchAlias(b)}` : b.name);
const branchMatches = (b, q) => !q || [b.name, b.code, b.manager, b.cityAr, b.cityEn, b.aliasAr, b.aliasEn].some(x => x && String(x).toLowerCase().includes(q));
function save() {
  state.lang = lang;
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { toast(L('تعذّر الحفظ — مساحة التخزين ممتلئة.', 'Could not save — storage is full.'), 'error'); }
}
window.addEventListener('storage', e => { if (e.key === LS_KEY && e.newValue) { try { state = JSON.parse(e.newValue); } catch (x) {} } });

const activeLists = () => state.checklists.filter(l => !l.archived);
const getList = id => state.checklists.find(l => l.id === +id);
function ensureCurrentWeek(listId) {
  const ws = currentWeekStart();
  let r = state.reports.find(x => x.checklistId === listId && x.weekStart === ws);
  if (!r) {
    r = {id: state.nextId++, checklistId: listId, weekStart: ws, weekEnd: fmtDate(addDays(parseDate(ws), 6)), date: ws, checks: {}};
    state.reports.push(r); save();
  }
  return r;
}
const reportsOf = listId => state.reports.filter(r => r.checklistId === listId).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
const doneCount = rep => Object.keys(rep.checks).filter(no => branchByNo(no)).length; // deleted branches do not count
function cities() {
  const m = new Map();
  BRANCHES.forEach(b => { if (!m.has(b.cityEn)) m.set(b.cityEn, {en: b.cityEn, ar: b.cityAr, count: 0}); m.get(b.cityEn).count++; });
  return Array.from(m.values()).sort((a, b) => b.count - a.count || a.en.localeCompare(b.en));
}
const branchByNo = no => BRANCHES.find(b => b.no === +no);

/* ---------- location: nearest branch (BRANCH_GEO from branch-geo.js, Linktree map links) ---------- */
const geoOf = b => (b && b.lat != null && b.lng != null && b.lat !== '' ? {lat: +b.lat, lng: +b.lng, maps: `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`, place: b.name}
  : (typeof BRANCH_GEO !== 'undefined' && BRANCH_GEO[b.no]) || null);
function distKm(a, b) {
  const r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const fmtDist = km => km < 1 ? L(`${Math.round(km * 1000)} م`, `${Math.round(km * 1000)} m`) : L(`${km < 10 ? km.toFixed(1) : Math.round(km)} كم`, `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);
/* current position, cached 5 minutes in this tab so the browser does not ask again on every page */
function getPosition() {
  try { const c = JSON.parse(sessionStorage.getItem('hafmList.pos') || 'null'); if (c && Date.now() - c.t < 300000) return Promise.resolve(c); } catch (e) {}
  return new Promise((res, rej) => {
    if (!navigator.geolocation) { rej(new Error('unsupported')); return; }
    navigator.geolocation.getCurrentPosition(p => {
      const c = {lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: Date.now()};
      try { sessionStorage.setItem('hafmList.pos', JSON.stringify(c)); } catch (e) {}
      res(c);
    }, err => rej(err), {enableHighAccuracy: true, timeout: 15000, maximumAge: 60000});
  });
}
const cachedPosition = () => { try { const c = JSON.parse(sessionStorage.getItem('hafmList.pos') || 'null'); return c && Date.now() - c.t < 300000 ? c : null; } catch (e) { return null; } };
function nearestBranches(pos, n) {
  return BRANCHES.map(b => ({b, g: geoOf(b)})).filter(x => x.g).map(x => ({b: x.b, g: x.g, km: distKm(pos, x.g)}))
    .sort((a, c) => a.km - c.km).slice(0, n || 3);
}
function geoErrorText(err) {
  if (err && err.code === 1) return L('لم يُسمح بالوصول للموقع — فعّله من إعدادات المتصفح ثم أعد المحاولة.', 'Location permission denied — allow it in browser settings and retry.');
  if (err && err.message === 'unsupported') return L('المتصفح لا يدعم تحديد الموقع.', 'This browser does not support location.');
  if (!window.isSecureContext) return L('تحديد الموقع يعمل فقط عبر https.', 'Location only works over https.');
  return L('تعذّر تحديد الموقع — تأكد من تشغيل GPS وأعد المحاولة.', 'Could not get your location — check GPS and retry.');
}

/* ---------- auth: name + work e-mail + 4-digit PIN (device-local) ---------- */
const normEmail = e => String(e || '').trim().toLowerCase();
const pinHash = (email, pin) => sha256('hafm-pin|' + normEmail(email) + '|' + pin);
const adminHash = email => sha256('hafm-admin|' + normEmail(email));
function emailAllowed(email) {
  const e = normEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const doms = CFG.ALLOWED_EMAIL_DOMAINS || [];
  return !doms.length || doms.some(d => e.endsWith('@' + d.toLowerCase()));
}
function roleOf(email) {
  const e = normEmail(email); if (!e) return 'auditor';
  if (REMOTE) { const s = getSession(); return s && s.email === e ? (s.role || 'auditor') : 'auditor'; }
  if ((CFG.ADMIN_EMAIL_HASHES || []).includes(adminHash(e))) return 'admin';
  return state.perms[e] || 'auditor';
}
const roleName = r => t(r === 'admin' ? 'admin' : r === 'editor' ? 'editor' : 'auditorRole');
function getSession() {
  try { const s = JSON.parse(sessionStorage.getItem(SS_SESSION) || 'null'); if (s && s.email && (REMOTE ? s.token : state.users[s.email])) return s; } catch (e) {}
  return null;
}
function currentUser() {
  const s = getSession(); if (!s) return null;
  return REMOTE ? {email: s.email, name: s.name, role: s.role} : state.users[s.email];
}
const canEditLists = () => { const u = currentUser(); return !!u && ['admin', 'editor'].includes(roleOf(u.email)); };
const isAdmin = () => { const u = currentUser(); return !!u && roleOf(u.email) === 'admin'; };
function signIn(email) {
  const e = normEmail(email);
  sessionStorage.setItem(SS_SESSION, JSON.stringify({email: e, at: new Date().toISOString()}));
  state.lastEmail = e; state.users[e].lastLogin = new Date().toISOString(); save();
}
function signOut() {
  const s = getSession();
  if (REMOTE && s && s.token) api('hafm_logout', {p_token: s.token}).catch(() => {});
  sessionStorage.removeItem(SS_SESSION); setTimeout(() => go('index.html'), REMOTE ? 150 : 0);
}
function requireAuth() {
  if (!getSession()) {
    const page = location.pathname.split('/').pop() + location.search;
    location.replace('index.html?next=' + encodeURIComponent(page));
    return false;
  }
  return true;
}
/* ---------- shared database (Supabase RPC; see supabase/hafm_schema.sql) ---------- */
class ApiError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }
async function api(fn, body) {
  let res;
  try {
    res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/${fn}`, {method: 'POST', keepalive: fn === 'hafm_logout',
      headers: {'apikey': CFG.SUPABASE_KEY, 'Content-Type': 'application/json'}, body: JSON.stringify(body || {})});
  } catch (e) { throw new ApiError('network', e.message); }
  const txt = await res.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!res.ok) {
    const m = (data && data.message) || ('http_' + res.status);
    throw new ApiError(m.startsWith('hafm:') ? m.slice(5).split(':')[0] : 'server', m);
  }
  return data;
}
async function sendEmailCode(email) {
  let res;
  try {
    res = await fetch(`${CFG.SUPABASE_URL}/functions/v1/hafm-send-code`, {method: 'POST',
      headers: {'apikey': CFG.SUPABASE_KEY, 'Content-Type': 'application/json'}, body: JSON.stringify({email, lang})});
  } catch (e) { throw new ApiError('network', e.message); }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(d.error || 'server', d.error);
  return true;
}
function apiErrorText(err) {
  const c = err && err.code;
  if (c === 'wrong_code') return L('رمز التحقق غير صحيح.', 'Wrong verification code.');
  if (c === 'code_expired') return L('انتهت صلاحية الرمز — اطلب رمزاً جديداً.', 'The code expired — request a new one.');
  if (c === 'too_soon') return L('انتظر دقيقة قبل طلب رمز جديد.', 'Wait a minute before requesting a new code.');
  if (c === 'too_many') return L('طلبات كثيرة — حاول بعد ساعة.', 'Too many requests — try again in an hour.');
  if (c === 'email_not_configured' || c === 'send_failed') return L('تعذّر إرسال الإيميل حالياً — تواصل مع المشرف.', 'Could not send the e-mail right now — contact the admin.');
  if (c === 'network') return L('لا يوجد اتصال بالإنترنت.', 'No internet connection.');
  if (c === 'email_domain') return L('الدخول بإيميل العمل فقط (@halfm.sa).', 'Work e-mail only (@halfm.sa).');
  if (c === 'forbidden') return L('ليست لديك صلاحية لهذا الإجراء.', 'You do not have permission for this.');
  if (c === 'session_expired') return L('انتهت الجلسة — أدخل رمزك من جديد.', 'Session expired — enter your PIN again.');
  if (c === 'locked') { const s = String(err.message).split(':').pop(); return L(`محاولات كثيرة — انتظر ${s} ثانية.`, `Too many attempts — wait ${s}s.`); }
  if (c === 'has_entries') return L('لا يمكن حذف قائمة لها إدخالات — استخدم الأرشفة.', 'A list with entries cannot be deleted — archive it.');
  if (c === 'wrong_pin') return L('الرمز غير صحيح.', 'Wrong PIN.');
  return L('تعذّر الاتصال بالخادم — حاول مجدداً.', 'Server error — please try again.');
}
function remoteSignIn(res) {
  const e = normEmail(res.email);
  if (state.syncUser !== e) { state.lastSync = null; state.syncUser = e; } // full pull for a new user on this device
  sessionStorage.setItem(SS_SESSION, JSON.stringify({email: e, name: res.name, role: res.role, token: res.token, at: new Date().toISOString()}));
  state.lastEmail = e; state.lastName = res.name; save();
}
function updateSession(patch) { const s = getSession(); if (s) sessionStorage.setItem(SS_SESSION, JSON.stringify(Object.assign(s, patch))); }
function reportFor(listId, ws, create) {
  let r = state.reports.find(x => x.checklistId === +listId && x.weekStart === ws && !x.seed);
  if (!r && create) { r = {id: state.nextId++, checklistId: +listId, weekStart: ws, weekEnd: fmtDate(addDays(parseDate(ws), 6)), date: ws, checks: {}}; state.reports.push(r); }
  return r;
}
const outboxKey = x => `${x.l}|${x.w}|${x.b}`;
async function syncPull() {
  const s = getSession(); if (!s) return;
  const res = await api('hafm_pull', {p_token: s.token, p_since: state.lastSync || null});
  if (Array.isArray(res.checklists) && res.checklists.length) state.checklists = res.checklists.map(l => Object.assign({}, l, {archived: !!l.archived}));
  const pending = new Set(state.outbox.map(outboxKey));
  (res.entries || []).forEach(e => {
    if (pending.has(outboxKey(e))) return;
    const r = reportFor(e.l, e.w, true);
    r.checks[e.b] = {s: e.s || {}, remarks: e.r || '', auditor: e.a, email: e.e, at: e.t, history: e.h || []};
  });
  if (Array.isArray(res.branches)) {
    const ed = {}; res.branches.forEach(x => { ed[x.no] = {data: x.data || {}, deleted: !!x.deleted}; });
    state.branchEdits = ed; applyBranchEdits();
  }
  state.lastSync = res.server_time;
  if (res.me) updateSession({name: res.me.name, role: res.me.role});
  save();
}
async function flushOutbox() {
  const s = getSession(); if (!s || !state.outbox.length) return 0;
  let sent = 0;
  for (const x of state.outbox.slice()) {
    if (x.email !== s.email) continue;
    try {
      const r = await api('hafm_save_entry', {p_token: s.token, p_checklist_id: x.l, p_week_start: x.w, p_branch_no: x.b, p_statuses: x.s, p_remarks: x.r});
      state.outbox = state.outbox.filter(o => outboxKey(o) !== outboxKey(x));
      const rep2 = reportFor(x.l, x.w, true); if (rep2.checks[x.b]) { rep2.checks[x.b].at = r.t; rep2.checks[x.b].auditor = r.a; rep2.checks[x.b].pending = false; }
      sent++; save();
    } catch (err) {
      if (err.code === 'network' || err.code === 'session_expired') throw err;
      state.outbox = state.outbox.filter(o => outboxKey(o) !== outboxKey(x)); save(); // rejected by the server (e.g. list deleted)
      toast(apiErrorText(err), 'error');
    }
  }
  return sent;
}
/* save one branch entry: local first, then send (queued if offline). Returns true when it reached the server. */
async function saveEntryRemote(listId, ws, no, s, remarks) {
  const u = getSession();
  state.outbox = state.outbox.filter(o => outboxKey(o) !== `${listId}|${ws}|${no}`);
  state.outbox.push({l: +listId, w: ws, b: +no, s, r: remarks, email: u.email, at: new Date().toISOString()});
  save();
  try { await flushOutbox(); return !state.outbox.some(o => outboxKey(o) === `${listId}|${ws}|${no}`); }
  catch (err) { if (err.code === 'session_expired') handleExpired(); return false; }
}
function handleExpired() {
  sessionStorage.removeItem(SS_SESSION);
  const page = location.pathname.split('/').pop() + location.search;
  location.replace('index.html?expired=1&next=' + encodeURIComponent(page));
}
/* page boot: auth check, then (shared mode) send queued entries + pull the latest data before drawing the page */
function hafmBoot(render) {
  if (!requireAuth()) return;
  if (!REMOTE) { render(); return; }
  const first = !state.lastSync;
  let ov = null;
  if (first) { ov = document.createElement('div'); ov.className = 'sync-overlay'; ov.innerHTML = `<div class="spinner"></div><p>${L('جارٍ تحميل بيانات الفريق…', 'Loading team data…')}</p>`; document.body.appendChild(ov); }
  let done = false;
  const finish = () => { if (done) return; done = true; if (ov) ov.remove(); render(); };
  const work = (async () => { await flushOutbox(); await syncPull(); })();
  work.then(finish).catch(err => {
    if (err.code === 'session_expired') { handleExpired(); return; }
    finish(); if (err.code === 'network') toast(t('offline'), 'error'); else toast(apiErrorText(err), 'error');
  });
  setTimeout(finish, first ? 9000 : 3500);
  window.addEventListener('online', () => { flushOutbox().then(n => { if (n) toast(L(`أُرسل ${n} إدخال محفوظ`, `${n} saved entr${n > 1 ? 'ies' : 'y'} sent`)); }).catch(() => {}); });
}
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/* ---------- icons (line style, 24px grid, currentColor) ---------- */
const ICONS = {
  cloud:'<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.5 4.3 4.3 0 0 0 7 18z"/>',
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  chart:'<path d="M3 21h18"/><rect x="5" y="11" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="16" y="13" width="3" height="5" rx="1"/>',
  store:'<path d="M4 4h16l1.5 5H2.5z"/><path d="M2.5 9a3.2 3.2 0 0 0 6.3 0 3.2 3.2 0 0 0 6.4 0 3.2 3.2 0 0 0 6.3 0"/><path d="M4.5 12v9h15v-9"/><path d="M10 21v-5h4v5"/>',
  book:'<path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5c-3-.5-6 0-8 1.5z"/><path d="M12 6v14.5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.8c2.2.6 3.5 2.4 3.5 5.2"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M17 17 7 7"/><path d="M7 16V7h9"/>',
  back:'<path d="M9 5l7 7-7 7"/>',
  chevron:'<path d="M15 5l-7 7 7 7"/>',
  up:'<path d="M6 15l6-6 6 6"/>',
  down:'<path d="M6 9l6 6 6-6"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  download:'<path d="M12 3v12"/><path d="M7 10.5l5 5 5-5"/><path d="M4 20h16"/>',
  upload:'<path d="M12 16V4"/><path d="M7 8.5l5-5 5 5"/><path d="M4 20h16"/>',
  logout:'<path d="M14 4h5v16h-5"/><path d="M9 8l-4 4 4 4"/><path d="M5 12h11"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
  coffee:'<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c-.8 1 .8 2 0 3M12 3c-.8 1 .8 2 0 3"/>',
  cookie:'<path d="M20.5 12.5A8.5 8.5 0 1 1 11.5 3.5a3 3 0 0 0 4 3.5 3 3 0 0 0 5 5.5z"/><circle cx="8.5" cy="10" r=".9"/><circle cx="13" cy="15" r=".9"/><circle cx="8.5" cy="15.5" r=".9"/><circle cx="12" cy="10.5" r=".6"/>',
  clipboard:'<rect x="5" y="4.5" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M8.5 10.5l1.3 1.3 2.4-2.4M14 11h2M8.5 16.5l1.3 1.3 2.4-2.4M14 17h2"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  nav:'<path d="M12 2.5l7 18-7-4-7 4z"/>',
  pin:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash:'<path d="M4 7h16"/><path d="M9.5 7V4h5v3"/><path d="M6 7l1 14h10l1-14"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M15 8l2 2"/>',
  star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  bulb:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  alert:'<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9"/><path d="M10 13h4"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14.7-4.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.7 4.3l1.3-1.8"/><path d="M20 20v-4.5h-4.5"/>',
  printer:'<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  filter:'<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z"/>',
  flag:'<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>',
  grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  droplet:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  thermo:'<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
  broom:'<path d="M14 4l6 6"/><path d="M17 7l-6.5 6.5"/><path d="M10.5 13.5c-3 0-6 2-6.5 6.5 4.5-.5 6.5-3.5 6.5-6.5z"/><path d="M7 17l2-2"/>',
  box:'<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>'
};
const LIST_ICONS = ['coffee', 'cookie', 'clipboard', 'list', 'droplet', 'thermo', 'broom', 'box', 'shield', 'star', 'flag', 'grid'];
function ic(name, cls) { return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.list}</svg>`; }
const listIcon = l => l.icon || (l.kind === 'survey' ? 'clipboard' : 'list');
const listTone = l => (l.tone || (l.kind === 'survey' ? 'havan' : 'teal'));

/* ---------- toasts / dialogs ---------- */
function toast(msg, type) {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const el = document.createElement('div'); el.className = 'toast ' + (type || '');
  el.innerHTML = ic(type === 'error' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';
  box.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 2600);
}
function dialog({title, body, okText, cancelText, danger}) {
  return new Promise(res => {
    const wrap = document.createElement('div'); wrap.className = 'dialog-wrap';
    wrap.innerHTML = `<div class="dialog" role="dialog" aria-modal="true"><h3>${esc(title || '')}</h3><div class="dialog-body">${body || ''}</div>
      <div class="dialog-actions"><button class="btn ghost" data-r="0" type="button">${esc(cancelText || t('cancel'))}</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-r="1" type="button">${esc(okText || t('confirm'))}</button></div></div>`;
    document.body.appendChild(wrap); requestAnimationFrame(() => wrap.classList.add('in'));
    const close = v => { wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 200); res(v); };
    wrap.addEventListener('click', e => { if (e.target === wrap) close(false); const b = e.target.closest('[data-r]'); if (b) close(b.dataset.r === '1'); });
  });
}
function sheet(html, onMount) {
  const wrap = document.createElement('div'); wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div>${html}</div>`;
  document.body.appendChild(wrap); requestAnimationFrame(() => wrap.classList.add('in'));
  const close = () => { wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 250); };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  if (onMount) onMount(wrap, close);
  return close;
}

/* ---------- shell: top bar + bottom navigation ---------- */
const NAV = [
  {id:'home', href:'home.html', icon:'home'},
  {id:'reports', href:'reports.html', icon:'chart'},
  {id:'branches', href:'branches.html', icon:'store'},
  {id:'review', href:'review.html', icon:'book'},
  {id:'account', href:'account.html', icon:'user'}
];
function renderShell(opts) {
  opts = opts || {};
  const u = currentUser();
  const top = document.createElement('header'); top.className = 'topbar' + (opts.hero ? ' on-hero' : '');
  top.innerHTML = `
    ${opts.back ? `<a class="icon-btn" href="${esc(opts.back)}" aria-label="${t('back')}">${ic('back', 'flip-ltr')}</a>` : `<a class="brand" href="home.html" aria-label="Half Million"><img src="assets/img/${opts.hero ? 'logo-light' : 'logo'}.svg" alt="½M" width="62" height="28"></a>`}
    <div class="top-title">${opts.title ? `<b>${esc(opts.title)}</b>` : `<b>${t('appName')}</b>`}${opts.sub ? `<small>${esc(opts.sub)}</small>` : `<small>${t('appFull')}</small>`}</div>
    <div class="lang-switch" role="group" aria-label="${t('language')}">
      <button type="button" data-lang="ar" class="${lang === 'ar' ? 'on' : ''}">ع</button>
      <button type="button" data-lang="en" class="${lang === 'en' ? 'on' : ''}">En</button>
    </div>
    ${u ? `<a class="avatar" href="account.html" title="${esc(u.name)}">${esc(initials(u.name))}</a>` : ''}`;
  document.body.prepend(top);
  $$('.lang-switch button', top).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.lang === lang) return; lang = b.dataset.lang; save(); location.reload();
  }));
  if (opts.nav !== false) {
    const nav = document.createElement('nav'); nav.className = 'bottomnav'; nav.setAttribute('aria-label', 'Main');
    nav.innerHTML = NAV.map(n => `<a href="${n.href}" class="${n.id === opts.active ? 'active' : ''}" ${n.id === opts.active ? 'aria-current="page"' : ''}>
      <span class="nav-ic">${ic(n.icon)}</span><span>${t(n.id)}</span></a>`).join('');
    document.body.appendChild(nav);
    document.body.classList.add('has-nav');
  }
  const off = document.createElement('div'); off.className = 'offline-bar'; off.textContent = t('offline'); document.body.appendChild(off);
  const upd = () => off.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', upd); window.addEventListener('offline', upd); upd();
}
function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-ar]').forEach(el => { el.textContent = lang === 'ar' ? el.dataset.ar : el.dataset.en; });
}
/* section heading with havan bar (brand style) */
const sectionHead = (title, sub, extra) => `<div class="sec-head"><div><h2>${esc(title)}</h2>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div>${extra || ''}</div>`;
/* ring progress */
function ring(pct, size, label) {
  const r = 16, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return `<span class="ring" style="--s:${size || 56}px"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="${r}" class="ring-bg"/><circle cx="20" cy="20" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/></svg><b>${label != null ? label : Math.round(pct) + '%'}</b></span>`;
}

/* ---------- PWA service worker ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
/* page boot: set direction early */
applyLang();
