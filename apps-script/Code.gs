// Invictus Fighter - landing page + quiz backend (Google Apps Script web app).
// 
// Setup (once):
// 1. script.google.com > New project, paste this file + appsscript.json.
// 2. Run setup() once and approve the permissions.
// 3. Deploy > New deployment > Web app: Execute as "Me", Who has access "Anyone". Copy the /exec URL.
// 
// Leads sheet "مايو" (الورقة1): A:H are the columns the CRMs import (unchanged).
// I:L are added at the end and are never imported by the CRMs:
// I token (quiz code) | J campaign | K ad | L ref/page

var LEADS_ID = '1nA0AHHrsAWPMYTYBiVNzI4w7MRhNm_QZaEBJx0dgsc0';
var LEADS_TAB = 'الورقة1';
var TZ = 'Asia/Riyadh';
var COL = { date: 1, child: 2, parent: 3, phone: 4, age: 5, goal: 6, branch: 7, source: 8, token: 9, campaign: 10, ad: 11, ref: 12 };
var EXTRA_HEADERS = ['رمز الاختبار', 'الحملة', 'الإعلان', 'مرجع'];
var RESULTS_HEADERS = ['الرمز', 'أول حفظ', 'آخر تحديث', 'الحالة', 'اسم البطل', 'العمر', 'الفرع', 'المصدر',
'النمط', 'أعلى محور', 'درجة أعلى محور', 'الثقة', 'الانفعال', 'التنمر', 'الشاشات', 'الطاقة', 'التركيز',
'رياضة سابقة', 'تنبيه تنمر', 'رابط النتيجة', 'الإجابات'];
var QUIZ_URL = 'https://join.invictus-ksa.info/quiz/?t=';
var GOALS = ['بناء شخصية', 'تفريغ طاقة و ترفيه', 'غرس قيم أخلاقية', 'تعزيز اللياقة البدنية', 'الثقة والدفاع عن النفس', 'احتراف و بطولات'];
var BRANCHES = ['حي الوادي', 'حي الياسمين', 'حي القيروان'];
var SOURCES = ['زيارة مباشرة', 'سناب شات', 'انستجرام', 'Google Ads', 'مشاركة من الاختبار'];
var AXES = ['conf', 'anger', 'bully', 'screen', 'energy', 'focus'];

// ---------- setup ----------
function setup() {
var sh = leadsSheet_();
sh.getRange(1, COL.token, 1, EXTRA_HEADERS.length).setValues([EXTRA_HEADERS]);
var props = PropertiesService.getScriptProperties();
if (!props.getProperty('RESULTS_ID')) {
var ss = SpreadsheetApp.create('نتائج اختبار شخصية البطل');
var r = ss.getSheets()[0];
r.setName('النتائج');
r.getRange(1, 1, 1, RESULTS_HEADERS.length).setValues([RESULTS_HEADERS]).setFontWeight('bold');
r.setFrozenRows(1);
r.setRightToLeft(true);
props.setProperty('RESULTS_ID', ss.getId());
}
ScriptApp.getProjectTriggers().forEach(function (t) {
if (t.getHandlerFunction() === 'backfillTokens') ScriptApp.deleteTrigger(t);
});
ScriptApp.newTrigger('backfillTokens').timeBased().everyMinutes(5).create();
backfillTokens();
Logger.log('Results file: https://docs.google.com/spreadsheets/d/' + props.getProperty('RESULTS_ID'));
}

// ---------- web endpoints ----------
function doGet(e) {
var p = (e && e.parameter) || {};
try {
if (p.action === 'lead') return json_(getLead_(p.t));
if (p.action === 'find') return json_(findLead_(p.p, p.n));
return json_({ ok: true, service: 'invictus-quiz' });
} catch (err) {
return json_({ ok: false, error: String(err) });
}
}

function doPost(e) {
try {
var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
if (body.action === 'register') return json_(register_(body));
if (body.action === 'saveQuiz') return json_(saveQuiz_(body));
return json_({ ok: false, error: 'unknown action' });
} catch (err) {
return json_({ ok: false, error: String(err) });
}
}

// ---------- register ----------
function register_(b) {
var child = clean_(b.childName, 40), parent = clean_(b.parent, 40);
var phone = normPhone_(b.phone), age = parseInt(b.age, 10);
var goal = GOALS.indexOf(b.goal) >= 0 ? b.goal : '';
var branch = BRANCHES.indexOf(b.branch) >= 0 ? b.branch : '';
var source = SOURCES.indexOf(b.source) >= 0 ? b.source : 'زيارة مباشرة';
if (!child || !parent || !phone || !(age >= 1 && age <= 17) || !goal || !branch) return { ok: false, error: 'invalid' };

var lock = LockService.getScriptLock();
lock.waitLock(20000);
try {
var sh = leadsSheet_();
var last = sh.getLastRow();
// same phone + child name in the last 300 rows within 30 minutes -> reuse (double tap / back button)
var from = Math.max(2, last - 299), n = last - from + 1;
if (n > 0) {
var rows = sh.getRange(from, 1, n, COL.token).getValues();
var now = new Date().getTime();
for (var i = rows.length - 1; i >= 0; i--) {
var r = rows[i];
if (String(r[COL.phone - 1]) === phone && clean_(r[COL.child - 1], 40) === child && r[COL.token - 1]) {
var t = r[COL.date - 1] instanceof Date ? r[COL.date - 1].getTime() : Date.parse(String(r[COL.date - 1]).replace(' ', 'T') + '+03:00');
if (!isNaN(t) && now - t < 30 * 60 * 1000) return { ok: true, token: String(r[COL.token - 1]), dup: true };
}
}
}
var token = newToken_();
var row = [
Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd H:mm:ss'), child, parent, phone, ageText_(age), goal, branch, source,
token, clean_(b.campaign, 120), clean_(b.ad, 120), clean_((b.ref ? b.ref + ' ' : '') + (b.page || ''), 120)
];
sh.appendRow(row);
return { ok: true, token: token };
} finally {
lock.releaseLock();
}
}

// ---------- lead lookup (quiz prefill) ----------
function getLead_(token) {
token = String(token || '').trim();
if (!/^[a-f0-9]{12}$/.test(token)) return { ok: false, error: 'not_found' };
var sh = leadsSheet_();
var cell = sh.getRange(2, COL.token, Math.max(1, sh.getLastRow() - 1), 1).createTextFinder(token).matchEntireCell(true).findNext();
if (!cell) return { ok: false, error: 'not_found' };
var r = sh.getRange(cell.getRow(), 1, 1, COL.source).getValues()[0];
var res = findResult_(token);
var out = { ok: true, name: firstName_(r[COL.child - 1]), age: parseAge_(r[COL.age - 1]), done: false };
if (res && res.status === 'مكتمل') { out.done = true; out.result = res.result; }
return out;
}

// ---------- find a recent lead by phone + child name (parents coming from Snap/Meta native forms) ----------
// The platforms cannot pass the form answers in the end-screen link, so the parent types the phone and the
// child's name; both must match a registration from the last 3 days. Returns only the token.
function findLead_(phone, child) {
var ph = normPhone_(phone);
if (!ph) return { ok: false, error: 'bad_phone' };
var nm = normName_(child);
if (nm.length < 2) return { ok: false, error: 'bad_name' };
var sh = leadsSheet_();
var last = sh.getLastRow();
if (last < 2) return { ok: false, error: 'not_found' };
var start = Math.max(2, last - 499);
var vals = sh.getRange(start, 1, last - start + 1, COL.token).getValues();
var cutoff = Date.now() - 3 * 24 * 3600 * 1000;
for (var i = vals.length - 1; i >= 0; i--) {
var r = vals[i];
if (normPhone_(r[COL.phone - 1]) !== ph) continue;
var d = r[0] instanceof Date ? r[0].getTime() : Date.parse(String(r[0]).trim().replace(' ', 'T') + '+03:00');
if (d && d < cutoff) continue;
var rn = normName_(r[COL.child - 1]);
if (!rn || (rn.indexOf(nm) < 0 && nm.indexOf(rn) < 0)) continue;
var t = String(r[COL.token - 1]).trim();
if (!/^[a-f0-9]{12}$/.test(t)) { t = newToken_(); sh.getRange(start + i, COL.token).setValue(t); }
return { ok: true, t: t };
}
return { ok: false, error: 'not_found' };
}
function normName_(s) {
return clean_(s, 60).replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
.replace(/^البطل\s*/, '').replace(/\s+/g, '').replace(/[اه]$/, '').toLowerCase();
}

// ---------- save quiz (partial or complete) ----------
function saveQuiz_(b) {
var token = String(b.t || '').trim();
if (!/^[a-f0-9]{12}$/.test(token)) return { ok: false, error: 'bad_token' };
var lead = getLeadRow_(token);
if (!lead) return { ok: false, error: 'not_found' };
var scores = b.scores || {};
AXES.forEach(function (k) { scores[k] = Math.max(0, Math.min(6, parseInt(scores[k], 10) || 0)); });
var done = b.done === true;

var lock = LockService.getScriptLock();
lock.waitLock(20000);
try {
var sh = resultsSheet_();
var existing = findResult_(token, sh);
if (existing && existing.status === 'مكتمل') return { ok: true, done: true, result: existing.result, locked: true };
var now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd H:mm:ss');
var result = {
name: firstName_(lead[COL.child - 1]), age: parseAge_(lead[COL.age - 1]), type: String(b.type || ''),
top: String(b.top || ''), second: String(b.second || ''), scores: scores, sport: clean_(b.sport, 40)
};
var row = [
token, existing ? existing.created : now, now, done ? 'مكتمل' : 'جزئي', result.name, result.age,
lead[COL.branch - 1], lead[COL.source - 1], done ? typeLabel_(result.type) : '', done ? axisLabel_(result.top) : '',
done ? scores[result.top] || '' : '', scores.conf, scores.anger, scores.bully, scores.screen, scores.energy, scores.focus,
result.sport, scores.bully >= 5 ? 'نعم' : '', QUIZ_URL + token, JSON.stringify({ answers: b.answers || [], result: result })
];
if (existing) sh.getRange(existing.row, 1, 1, row.length).setValues([row]);
else sh.appendRow(row);
return { ok: true, done: done, result: done ? result : null };
} finally {
lock.releaseLock();
}
}

// ---------- tokens for leads that came from elsewhere (old Snap form via Zapier) ----------
function backfillTokens() {
var lock = LockService.getScriptLock();
if (!lock.tryLock(10000)) return;
try {
var sh = leadsSheet_();
var last = sh.getLastRow();
if (last < 2) return;
var rng = sh.getRange(2, COL.child, last - 1, COL.token - COL.child + 1);
var vals = rng.getValues(), changed = false;
for (var i = 0; i < vals.length; i++) {
var row = vals[i];
if (String(row[0]).trim() && !String(row[row.length - 1]).trim()) { row[row.length - 1] = newToken_(); changed = true; }
}
if (changed) sh.getRange(2, COL.token, vals.length, 1).setValues(vals.map(function (r) { return [r[r.length - 1]]; }));
} finally {
lock.releaseLock();
}
}

// ---------- helpers ----------
function leadsSheet_() { return SpreadsheetApp.openById(LEADS_ID).getSheetByName(LEADS_TAB); }
function resultsSheet_() {
var id = PropertiesService.getScriptProperties().getProperty('RESULTS_ID');
if (!id) throw new Error('Run setup() first');
return SpreadsheetApp.openById(id).getSheets()[0];
}
function getLeadRow_(token) {
var sh = leadsSheet_();
var cell = sh.getRange(2, COL.token, Math.max(1, sh.getLastRow() - 1), 1).createTextFinder(token).matchEntireCell(true).findNext();
return cell ? sh.getRange(cell.getRow(), 1, 1, COL.token).getValues()[0] : null;
}
function findResult_(token, sh) {
sh = sh || resultsSheet_();
if (sh.getLastRow() < 2) return null;
var cell = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(token).matchEntireCell(true).findNext();
if (!cell) return null;
var r = sh.getRange(cell.getRow(), 1, 1, RESULTS_HEADERS.length).getValues()[0];
var parsed = {};
try { parsed = JSON.parse(r[RESULTS_HEADERS.length - 1]); } catch (e) { }
return { row: cell.getRow(), created: r[1], status: r[3], result: parsed.result || null };
}
function newToken_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function clean_(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 80); }
function digits_(s) {
return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
}
function normPhone_(v) {
var d = digits_(v).replace(/\D/g, '');
if (d.indexOf('00966') === 0) d = d.slice(5); else if (d.indexOf('966') === 0) d = d.slice(3);
if (d.charAt(0) === '0') d = d.slice(1);
return /^5\d{8}$/.test(d) ? '966' + d : '';
}
function parseAge_(v) { var m = digits_(v).replace(/[٫،,]/g, '.').match(/\d+(\.\d+)?/); return m ? Math.floor(parseFloat(m[0])) : 0; }
function ageText_(n) { return n === 1 ? 'سنة' : n === 2 ? 'سنتين' : n <= 10 ? n + ' سنوات' : n + ' سنة'; }
function firstName_(s) {
var w = clean_(s, 40).split(' ');
// keep compound first names together: عبد الله، عبد الرحمن، أبو بكر
if (w.length > 1 && /^(عبد|أبو|ابو)$/.test(w[0])) return w[0] + ' ' + w[1];
return w[0] || '';
}
function typeLabel_(k) {
return { anger: 'صاحب الإرادة', energy: 'الشعلة', conf: 'المراقب الذكي', bully: 'صاحب القلب الطيب', focus: 'الحالم المبدع', balanced: 'المتوازن' }[k] || k;
}
function axisLabel_(k) {
return { conf: 'الثقة', anger: 'الانفعال', bully: 'التنمر', screen: 'الشاشات', energy: 'الطاقة', focus: 'التركيز' }[k] || k;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
