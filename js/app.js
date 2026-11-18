"use strict";
/* 영어 말하기 코치 — 화면과 훈련 흐름. 기준은 SPEC.md. */
const U = { tab: "home", scene: 0, f: { script: "", phEn: "", phKo: "", askEn: "", bk: "", gkey: "" }, remember: true, tagSel: null, ordSel: null, showZero: false,
  phCat: "all", logN: 20, logOpen: null, note: null, gmsg: null, bkMsg: null, phMsg: null, repMsg: null, copy: null, delAsk: null, talkN: 0, flash: null, smsg: null, diag: null, back: null, ask: null, mic: "", missMsg: null, lisMission: null, lisTopic: store.get("ec_listopic") || "faith", lisBusy: false, lisMsg: null, lisOld: false, nickMsg: null, loopSrc: "cum", loopRate: +store.get("ec_looprate") || 1, loopEcho: true, loopForever: true, loopMsg: null, shortMsg: null, natOpen: false, natN: 5, natMsg: null, natBusy: null };
let A = null;                                     /* 진행 중인 훈련 */
let SAY = [], KEEP = [];                                     /* 「듣기」 버튼이 읽을 글 */
const REC = { on: false, busy: false, t0: 0, timer: null, max: 0, done: null };

/* ---------- 작은 조각 ---------- */
const say = (text, label, role) => { SAY.push(role ? { t: text, role: role } : text); return '<button class="ec-mini" data-act="say" data-arg="' + (SAY.length - 1) + '">' + (label || "듣기") + '</button>'; };
const btn = (label, act, arg, cls) => '<button class="ec-btn ' + (cls || "") + '" data-act="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : "") + '>' + label + '</button>';
const sCls = n => n == null ? "" : (n >= 80 ? "s-good" : (n >= 60 ? "s-mid" : "s-bad"));
const r0 = n => n == null || isNaN(n) ? "–" : String(Math.round(n));
const scoreCell = (label, v) => '<div class="ec-score"><b class="' + sCls(v) + '">' + r0(v) + '</b><span>' + label + '</span></div>';
const statCell = (label, text) => '<div class="ec-score"><b class="ec-stat">' + text + '</b><span>' + label + '</span></div>';
const tagChip = g => g && D.TAGS[g] ? '<button class="ec-chip" data-act="tagOpen" data-arg="' + g + '">' + esc(D.TAGS[g].n) + '</button>' : "";
const card = (title, body, cls) => '<section class="ec-card ' + (cls || "") + '">' + (title ? '<h2>' + title + '</h2>' : "") + body + '</section>';
const short = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const msgBox = m => m ? '<div class="ec-msg' + (m.err ? " err" : "") + '">' + esc(m.text) + '</div>' : "";
const waitHtml = () => '<p class="ec-sub" id="ecWait"></p>';          /* 보내는 동안 몇 초째인지 (1초마다 채운다) */
const noteHtml = () => '<div id="ecMsg" class="' + (U.note ? "ec-msg" + (U.note.err ? " err" : "") : "") + '">' + (U.note ? esc(U.note.text) : "") + '</div>';
function setMsg(text, err) {
  if (A && A.phase === "sending" && text && !err) { A.prog = text; A.progAt = Date.now(); }       /* 다른 화면에 갔다 와도 진행 안내가 남게 */
  U.note = text ? { text, err: !!err } : null;
  const el = $("ecMsg"); if (el) { el.className = text ? "ec-msg" + (err ? " err" : "") : ""; el.textContent = text || ""; }
}
const hm = sec => { const m = Math.floor(sec / 60); return m >= 60 ? Math.floor(m / 60) + "시간 " + (m % 60) + "분" : m + "분"; };
const dueText = s => { const n = s.d - today(); return n <= 0 ? "오늘" : (n === 1 ? "내일" : n + "일 뒤"); };
const avgOf = s => avg([s.pron, s.inton, s.flu, s.gram]);
const KIND = { talk: "대화", retell: "다시 말하기", phr: "구문", dr: "훈련", test: "레벨 테스트", listen: "듣기", old: "이전 기록" };

/* ---------- 그리기 ---------- */
const TABS = [["home", "홈"], ["train", "훈련"], ["weak", "약점"], ["phr", "구문"], ["rec", "기록"]];
/* 처음 화면: 로그인하지 않았으면 구글 로그인부터 권한다. 「로그인 없이 시작」을 누르면 다시 묻지 않는다. */
const gateOn = () => fbReady() && !AUTH.uid && !store.get("ec_gateskip") && !A && !REC.on;
function drawGate() {
  return '<div class="ec-card ec-gate"><img class="ec-gateimg" src="icons/icon-192.png?v=12" alt="" width="88" height="88"><h2>영어 말하기 코치</h2>' +
    '<p>구글로 로그인하면 휴대폰·아이패드·노트북 어디서 열어도 같은 기록으로 이어집니다. 기록은 합치기만 하고 지우지 않습니다.</p>' +
    btn("구글로 로그인", "login", null, "wide") + msgBox(U.smsg) +
    '<p class="ec-sub">로그인하지 않으면 기록이 이 기기에만 남습니다. 나중에 「설정」에서 로그인할 수 있습니다.</p>' + btn("로그인 없이 시작", "gateSkip", null, "ghost small") + '</div>';
}
function render() {
  SAY = []; KEEP = [];
  if (A && U.tab === "train" && !document.hidden && A.phase !== "sending" && store.get("ec_unseen")) store.del("ec_unseen");
  let h;
  const gate = gateOn();
  document.body.classList.toggle("ec-gated", gate);
  if (gate) h = drawGate();
  else if (U.tab === "home") h = drawHome();
  else if (U.tab === "train") h = A ? drawStage() : drawTrain();
  else if (U.tab === "weak") h = drawWeak();
  else if (U.tab === "phr") h = drawPhrases();
  else if (U.tab === "rec") h = drawRecords();
  else h = drawSettings();
  $("ecMain").innerHTML = h;
  $("ecNav").innerHTML = TABS.map(t => '<button class="ec-navb" data-act="tab" data-arg="' + t[0] + '" aria-current="' + (U.tab === t[0] ? "page" : "false") + '">' + t[1] + (t[0] === "train" && A ? '<i class="ec-dot"></i>' : "") + '</button>').join("");
  $("ecWarn").innerHTML = (DB.saveFail ? '<div class="ec-msg err">이 기기의 저장 공간이 부족하거나 저장이 막혀 있습니다. 「기록」에서 백업을 내려받아 주세요.</div>' : "") +
    (AUTH.uid && SYNC.err && !SYNC.busy && U.tab !== "set" ? '<div class="ec-msg err">구글 저장이 잠시 멈췄습니다. 기록은 이 기기에 그대로 있습니다. 「설정」에서 확인해 주세요.</div>' : "") +
    (U.flash ? '<button class="ec-flash" data-act="flash">' + esc(U.flash.text) + ' <b>보기 →</b></button>' : "");
  keepAwake(REC.on || !!(A && A.phase === "sending"));
}
function go(tab) {
  navPush(tab);
  U.tab = tab; U.note = (tab === "train" && A && A.phase === "fail" && A.failMsg) ? { text: A.failMsg, err: true } : ((tab === "train" && A && A.phase === "sending" && A.prog) ? { text: A.prog } : null);
  if (tab === "train") U.flash = null;
  render(); window.scrollTo(0, 0);
}

/* ---------- 하던 일 보관과 이어 하기 ---------- */
const hasPend = a => !!a && (a.type === "talk" || a.type === "retell" ? !!a.pend : hasWork(a));
function pendSave() { if (hasPend(A)) idbSet("pend", { t: Date.now(), a: A }); else idbDel("pend"); }
/* 채점이 끝났을 때: 훈련 화면을 보고 있으면 true, 다른 화면이면 알림을 띄우고 false */
function arrived(text) { pendSave(); if (A) A.autoTried = false;
  /* 보고 있지 않을 때 끝난 결과는 표시를 남겨, 화면이 닫혔다 열려도 기록에서 바로 보이게 한다 */
  if (document.hidden || U.tab !== "train") { const last = DB.log[DB.log.length - 1]; if (last) store.set("ec_unseen", last.id); } else store.del("ec_unseen");
  if (U.tab !== "train") { U.flash = { text }; render(); return false; } U.note = null; render(); return true; }
function failed(me, why, kind) {
  me.phase = "fail"; me.failMsg = why; me.failKind = kind || "other"; me.autoAt = 0;
  if (kind === "quota") {                            /* 분당 한도에 잠깐 걸린 것이면 사람이 누르지 않아도 풀릴 때 스스로 다시 보낸다 (세 번까지) */
    const t = Date.now(), until = gOrder().map(n => G.block[n] || 0).filter(u => u > t), soon = until.length ? Math.min.apply(null, until) : 0;
    if (soon && soon - t <= 150000 && (me.autoWaitN || 0) < 3) { me.autoWaitN = (me.autoWaitN || 0) + 1; me.autoAt = soon + 2000; why = me.failMsg = waitText(me); }
  }
  pendSave();
  if (U.tab !== "train") { U.flash = { text: me.title + ": 채점이 멈췄습니다." }; render(); } else { render(); setMsg(why, true); }
}
function resumeSend() { if (!A) return; if (A.type === "batch") batchSend(); else if (A.type === "talk") talkSend(); else if (A.type === "retell") retellSend(); else if (A.type === "test") testSend(); }
function pendRestore() {                           /* 화면이 닫혔다 다시 열렸을 때 하던 훈련과 녹음을 되살린다 */
  return idbGet("pend").then(p => {
    const a = p && p.a;
    if (!a || A) return;
    const good = (a.type === "batch" && Array.isArray(a.items) && Array.isArray(a.clips)) || (a.type === "talk" && Array.isArray(a.turns) && a.pend) || (a.type === "retell" && Array.isArray(a.queue) && a.pend) || (a.type === "test" && Array.isArray(a.tasks));
    if (!good || Date.now() - (+p.t || 0) > 48 * 3600000) { idbDel("pend"); return; }
    A = a; A.quitAsk = false; A.autoTried = false;
    const was = A.phase;
    if (was === "sending") { A.phase = "fail"; A.failMsg = "보내던 중에 화면이 닫혔습니다. 녹음은 그대로 있습니다."; A.failKind = "net"; }
    U.flash = { text: A.title + (was === "sending" && G.key ? ": 멈췄던 채점을 이어서 합니다." : ": 하던 훈련이 남아 있습니다.") };
    render();
    if (was === "sending" && G.key) resumeSend();
  });
}
let WAKE = null;
function keepAwake(on) {                           /* 녹음·채점 중에는 화면이 저절로 꺼지지 않게 (지원하는 기기에서만) */
  try {
    if (on) { if (!WAKE && navigator.wakeLock && !document.hidden) { WAKE = "wait"; navigator.wakeLock.request("screen").then(w => { WAKE = w; w.addEventListener("release", () => { if (WAKE === w) WAKE = null; }); }, () => { WAKE = null; }); } }
    else if (WAKE && WAKE !== "wait") { const w = WAKE; WAKE = null; w.release().catch(() => {}); }
  } catch (e) { WAKE = null; }
}

/* ---------- 홈 ---------- */
function planMonths(hours) { const perWeek = DB.set.minutes * 6 / 60, mo = Math.round(hours / perWeek / 4.345); return mo >= 12 ? "약 " + Math.floor(mo / 12) + "년" + (mo % 12 ? " " + (mo % 12) + "개월" : "") : "약 " + mo + "개월"; }
function missionsOfWeek(w) { const L = easyMode() ? D.MISSIONS.filter(m => D.EASY_MISSIONS.indexOf(m.id) >= 0) : D.MISSIONS, n = L.length; return [0, 1, 2].map(i => L[((w * 3 + i) % n + n) % n]); }
function weekChange() {
  const d = today(), pick = (a, b) => DB.log.filter(r => r.k === "talk" && r.m && dayNo(r.t) > d - a && dayNo(r.t) <= d - b);
  const cur = pick(7, 0), prev = pick(14, 7); if (cur.length < 2 || prev.length < 2) return null;
  const f = (L, i) => avg(L.map(r => r.m[i])), pp = L => avg(L.map(r => r.m[6] >= 5 ? r.m[2] / (r.m[6] / 60) : null));
  return { wpm: [f(prev, 5), f(cur, 5)], ppm: [pp(prev), pp(cur)], st: [f(prev, 4), f(cur, 4)] };
}
function boardHtml() {
  if (!boardOn()) return '<p class="ec-sub">함께 보기를 꺼 두었습니다. 내 현황은 공유되지 않고, 다른 사람의 현황도 보이지 않습니다.</p><div class="ec-row">' + btn("설정에서 켜기", "tab", "set", "ghost small") + '</div>';
  const w = weekNo(today()), d = today(), me = AUTH.uid, all = BOARD.list || [];
  const act = all.filter(x => x.w === w && (x.mn > 0 || x.dn > 0)).sort((a, b) => b.dn - a.dn || b.mn - a.mn), rest = all.length - act.length;
  let h = '<p><b>' + (act.length ? "이번 주 " + act.length + "명이 함께 연습하고 있습니다." : "이번 주에는 아직 시작한 사람이 없습니다. 첫 사람이 되어 보세요.") + '</b></p>';
  h += act.map(x => '<div class="ec-bd' + (x.id === me ? " me" : "") + '"><span>' + (x.d === d && x.td === 2 ? "✓ " : x.d === d && x.td === 1 ? "· " : "") + esc(x.n || "이름 없음") + (x.id === me ? " (나)" : "") + '</span><small>루틴 ' + x.dn + '일 · ' + hm(x.mn * 60) + (x.st >= 2 ? ' · 연속 ' + x.st + '일' : "") + '</small></div>').join("");
  if (rest > 0) h += '<p class="ec-sub">이번 주 시작 전: ' + rest + '명</p>';
  h += '<p class="ec-sub">이름 앞의 ✓는 오늘 루틴을 마친 사람, ·는 오늘 연습한 사람입니다. 서로에게는 이름과 이번 주 루틴 일수·연습 시간·연속 일수만 보입니다. 점수·녹음·문장은 보이지 않습니다.' + (BOARD.err ? ' <span class="s-bad">지금은 불러오지 못했습니다.</span>' : "") + '</p>';
  return h;
}
/* 성장 예상 그래프: 지금 점수에서 하루 목표·주 6일로 24개월. 가정에 따른 그림이지 약속이 아니다. */
function growthHtml(score) {
  const min = DB.set.minutes, G0 = growthPlan(score, min, 6, 24), W = 330, H = 190, L = 38, R = 12, T = 10, B = 22;
  const lo = Math.max(40, Math.floor((score - 6) / 5) * 5), hi = 92, x = m => L + m * (W - L - R) / 24, y = v => T + (hi - clamp(v, lo, hi)) / (hi - lo) * (H - T - B);
  let s = '<svg class="ec-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="앞으로 24개월 성장 예상">';
  LEVELS.filter(v => v.min > lo && v.min < hi).forEach(v => { s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v.min) + '" y2="' + y(v.min) + '"/><text class="lab" x="2" y="' + (y(v.min) + 3) + '">' + v.id + '</text>'; });
  [0, 6, 12, 18, 24].forEach(m => { s += '<text class="lab" x="' + (m === 24 ? W - 2 : x(m)) + '" y="' + (H - 6) + '" text-anchor="' + (m === 24 ? "end" : "middle") + '">' + (m ? m + "개월" : "지금") + '</text>'; });
  s += '<polyline fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" points="' + G0.pts.map(p => x(p.m).toFixed(1) + "," + y(p.s).toFixed(1)).join(" ") + '"/>';
  const real = recentMinPerDay(), G1 = real >= 1 && Math.abs(real * 7 - min * 6) > 20 ? growthPlan(score, real, 7, 24) : null;
  if (G1) s += '<polyline fill="none" stroke="var(--sub)" stroke-width="1.5" stroke-dasharray="4 3" points="' + G1.pts.map(p => x(p.m).toFixed(1) + "," + y(p.s).toFixed(1)).join(" ") + '"/>';
  s += '<circle cx="' + x(0) + '" cy="' + y(score) + '" r="4" fill="var(--brand)"/>';
  G0.marks.forEach(k => { s += '<circle cx="' + x(k.m) + '" cy="' + y(k.min) + '" r="4.5" fill="var(--card)" stroke="var(--good)" stroke-width="2"/><text class="lab" x="' + x(k.m) + '" y="' + (y(k.min) - 8) + '" text-anchor="middle" style="fill:var(--good);font-weight:700">' + k.m + '개월</text>'; });
  s += '</svg>';
  const end = G0.pts[24].s, cur = SCORE_MAP.filter(r => score >= r.from && score < r.to)[0];
  let h = s + '<p><b>하루 ' + min + '분 · 주 6일</b>을 이어 가면 ' + (G0.marks.length ? G0.marks.map(k => '<b>' + k.id + '</b> ' + (k.m >= 12 ? Math.floor(k.m / 12) + "년" + (k.m % 12 ? " " + (k.m % 12) + "개월" : "") : k.m + "개월") + " 뒤").join(", ") : "지금 등급을 다지게 됩니다") + '. 2년 뒤 예상 ' + end.toFixed(0) + '점 (' + levelOf(end).id + ').</p>';
  if (G1) h += '<p class="ec-sub">점선은 지난 7일 실제 속도(하루 평균 ' + Math.round(real) + '분)로 갈 때입니다.</p>';
  h += '<table class="ec-t"><tr><th>등급</th><th>토익</th><th>토플 iBT</th><th>뉴텝스</th></tr>' + SCORE_MAP.map(r => '<tr' + (cur && cur.id === r.id ? ' class="ec-cur"' : "") + '><td>' + r.id + (cur && cur.id === r.id ? " (지금)" : "") + '</td><td>' + r.toeic + '</td><td>' + r.toefl + '</td><td>' + r.teps + '</td></tr>').join("") + '</table>';
  h += '<p class="ec-sub">예상은 "한 단계에 B2 아래 200시간, B2 위 300시간"이라는 가정으로 그린 것이고 개인차가 큽니다. 시험 점수는 등급 대응표의 범위이며, 이 앱은 말하기만 재므로 실제 시험 점수(듣기·읽기)와 다를 수 있습니다. 뉴텝스는 공식 대응표가 없어 기관 환산표로 어림했습니다.</p>';
  return h;
}
function weekHtml() {
  const W = weekView(), goal = DB.set.minutes, st = streak(), r = dayRec(), tdone = dayDone(today()), ns = nextStep();
  let left = 0; const p = PLAN(); STEPS.forEach(k => { if (p[k] > 0 && !stepDone(k)) left++; });
  let cheer;
  if (tdone) cheer = "오늘 루틴을 마쳤습니다. 이번 주 " + W.done + "일째 완료입니다." + (st >= 2 ? " 연속 " + st + "일째 이어 가고 있습니다." : "");
  else if (r.sec >= 60 || r.said > 0) cheer = "오늘 " + Math.floor(r.sec / 60) + "분 했습니다. 루틴 완료까지 " + left + "단계 남았습니다.";
  else if (st > 0) cheer = "연속 " + st + "일째입니다. 오늘 한 단계만 해도 이어집니다.";
  else cheer = W.act ? "이번 주 " + W.act + "일 연습했습니다. 오늘 한 단계로 다시 이어 가 보세요." : "오늘 한 단계만 해도 이번 주 첫 칸이 채워집니다.";
  let h = '<div class="ec-msg ec-cheer">' + cheer + '</div>';
  h += '<div class="ec-wk">' + W.days.map(x => '<div class="ec-wd' + (x.done ? " done" : "") + (x.today ? " now" : "") + (x.future ? " later" : "") + '"><span>' + x.name + '</span><b>' + (x.future ? "·" : x.done ? "✓" : x.min > 0 ? x.min : "–") + '</b><small>' + (x.future ? "" : x.done ? x.min + "분" : x.min > 0 ? "분" : "") + '</small></div>').join("") + '</div>';
  h += '<div class="ec-scores">' + statCell("루틴 완료", W.done + " / " + W.passed + "일") + statCell("이번 주", hm(W.min * 60)) + statCell("맞힌 문장", W.n ? W.ok + " / " + W.n : "–") + statCell("대화 대답", W.turns + "번") + '</div>';
  const diff = W.min - W.prevMin;
  h += '<p class="ec-sub">✓는 그날 루틴을 모두 마친 날, 숫자는 연습한 분입니다. 말한 문장 ' + W.said + '개' + (W.prevMin || W.min ? ' · 지난주 같은 요일까지 ' + W.prevMin + '분, 이번 주 ' + W.min + '분 <span class="' + (diff >= 0 ? "s-good" : "s-bad") + '">(' + (diff >= 0 ? "+" : "") + diff + '분)</span>' : "") + '</p>';
  return h;
}
const KEY_HOW = '<details class="ec-keyhow"' + '><summary>내 키 받는 법 (무료, 2분) — 눌러서 펼치기</summary>' +
  '<ol>' +
  '<li>아래 주소를 누릅니다. 새 창이 열립니다.<br><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></li>' +
  '<li><b>내 구글 계정</b>으로 로그인합니다. 이 앱에 로그인한 그 계정이면 됩니다. 다른 사람 계정으로 만들면 그 사람과 한도를 나눠 쓰게 됩니다.</li>' +
  '<li>처음이면 이용 약관 동의 화면이 나옵니다. 읽고 동의합니다.</li>' +
  '<li><b>「API 키 만들기」</b>(영어 화면은 Create API key)를 누릅니다. 프로젝트를 고르라고 하면 맨 위에 나오는 것을 그대로 고르거나 「새 프로젝트에서 만들기」를 누릅니다.</li>' +
  '<li>AIza로 시작하는 긴 글자가 나옵니다. 옆의 <b>복사</b> 단추를 누릅니다.</li>' +
  '<li>이 앱으로 돌아와 아래 「Gemini 이용 키」 칸을 길게 눌러 <b>붙여넣기</b> 합니다.</li>' +
  '<li><b>「저장하고 모델 확인」</b>을 누릅니다. 「키가 확인됐습니다」가 나오면 끝입니다.</li>' +
  '</ol>' +
  '<p class="ec-sub">· 무료입니다. 카드 등록이나 결제 설정은 하지 않아도 됩니다(하라고 나오면 건너뛰세요).<br>· 키는 비밀번호처럼 다뤄 주세요. 카톡이나 다른 사람에게 보내지 마세요.<br>· 한 번 넣으면 내 구글 계정에 저장되어, 내 휴대폰·패드·노트북 어디서 로그인해도 자동으로 채워집니다.<br>· 무료 한도는 하루치입니다. 다 쓰면 다음 날 오후 5시쯤(한국 시간) 다시 열립니다.</p></details>';
function drawHome() {
  const d = today(), r = dayRec(d), p = PLAN(), goal = DB.set.minutes, min = r.sec / 60, ts = tests(), last = ts[ts.length - 1], prev = ts[ts.length - 2];
  let h = "";
  if (!G.key) h += card("시작하기", '<p>선생님(Gemini)이 녹음을 들으려면 이용 키가 한 번 필요합니다.</p>' + btn("설정 열기", "tab", "set"));
  if (fbReady() && SYNC.ask) h += card("계정 확인이 필요합니다", '<p>이 기기의 기록을 지금 로그인한 계정에 합칠지 정해 주세요.</p>' + btn("설정에서 정하기", "tab", "set"));
  else if (fbReady() && !AUTH.uid) h += card("기기를 바꿔도 기록이 이어지게", '<p class="ec-sub">구글로 로그인하면 휴대폰·아이패드·노트북에서 같은 기록을 씁니다. 기록은 합치기만 하고 지우지 않습니다.</p>' + btn("구글로 로그인", "login"));
  if (!G.key && AUTH.uid) h += card("내 Gemini 키를 넣어 주세요 (무료, 2분)", '<p class="ec-sub">채점은 각자 자기 구글 계정의 무료 키로 합니다. 한 번 넣으면 내 계정에 저장되어 내 휴대폰·패드·노트북 어디서 로그인해도 자동으로 채워집니다. 다른 사람과는 나누지 않습니다.</p><div class="ec-row">' + btn("설정에서 키 넣기 (받는 법 안내)", "keyHow", null, "") + '</div>');
  if (easyMode()) h += card("기초 과정으로 진행 중", '<p class="ec-sub">쉬운 문장을 천천히, 짧게, 되풀이합니다. 오늘 할 일은 아래 「오늘」의 단계만 차례로 누르면 됩니다. 소리가 빠르면 「설정」에서 더 느리게 바꿀 수 있습니다.</p><p class="ec-sub">익힌 쉬운 구문 <b>' + D.BASIC.filter(p => phraseState(p.id) === "known").length + '</b> / ' + D.BASIC.length + ' · 연습 중 ' + D.BASIC.filter(p => phraseState(p.id) === "learning").length + '</p>');
  h += card("나의 학습 현황", weekHtml());
  /* 등급과 목표 */
  let lv = "";
  if (last) {
    const L = levelOf(last.score), N = nextLevel(last.score), ago = d - dayNo(last.t);
    lv += '<div class="ec-level"><b>' + L.id + '</b><div><div class="ec-lvs">' + last.score.toFixed(1) + '점' + (prev ? ' <span class="' + (last.score >= prev.score ? "s-good" : "s-bad") + '">(' + (last.score >= prev.score ? "+" : "") + (last.score - prev.score).toFixed(1) + ')</span>' : "") + '</div><div class="ec-sub">' + esc(L.d) + '</div></div></div>';
    if (N) lv += '<div class="ec-bar"><i style="width:' + clamp(Math.round((last.score - L.min) / (N.min - L.min) * 100), 3, 100) + '%"></i></div><div class="ec-sub">다음 등급 ' + N.id + '까지 ' + (N.min - last.score).toFixed(1) + '점 · ' + esc(N.d) + '</div>';
    lv += '<div class="ec-row between"><span class="ec-sub">마지막 테스트 ' + (ago === 0 ? "오늘" : ago + "일 전") + (ago >= 7 ? " — 다시 볼 때입니다" : "") + '</span>' + btn("레벨 테스트", "start", "test", ago >= 7 ? "small" : "ghost small") + '</div>';
  } else {
    lv += '<p>아직 레벨 테스트를 하지 않았습니다. 지금 수준을 재 두어야 늘었는지 알 수 있습니다. 6분쯤 걸립니다.</p>' + btn("레벨 테스트 시작", "start", "test");
  }
  lv += '<div class="ec-goal">목표: 일상 소통 <b>B1+</b> → 간증·복음 <b>B2</b> → 예배 인도·설교 <b>B2+</b></div>';
  lv += '<div class="ec-sub">누적 연습 ' + hm(totalSec()) + '. 한 단계(예: B1 → B2)에 약 200시간이 기준이고, 하루 ' + goal + '분·주 6일이면 ' + planMonths(200) + '입니다. 개인차가 큽니다.</div>';
  h += card("참고 등급", lv);
  if (last) h += card("앞으로의 성장 예상", growthHtml(last.score));
  /* 오늘 */
  const ns = nextStep(), st = streak();
  let t = '<div class="ec-row between"><b class="ec-today">' + Math.floor(min) + '분 <span class="ec-sub">/ ' + goal + '분</span></b><span class="ec-sub">말한 문장 ' + r.said + '개 · 연속 ' + st + '일</span></div>';
  t += '<div class="ec-bar"><i style="width:' + clamp(Math.round(min / goal * 100), 0, 100) + '%"></i></div>';
  t += '<div class="ec-steps">' + STEPS.filter(k => p[k] > 0 && !(k === "rev" && r.st.revNA && !(r.st.rev > 0))).map(k => {
    const done = stepDone(k);
    return '<button class="ec-step' + (done ? " done" : "") + '" data-act="start" data-arg="' + k + '"><span>' + STEP_NAME[k] + '</span><b>' + (done ? "✓ " : "") + Math.min(r.st[k] || 0, 99) + ' / ' + p[k] + '</b></button>';
  }).join("") + '</div>';
  t += ns ? btn((STEPS.reduce((s0, k) => s0 + (r.st[k] || 0), 0) ? "이어서 하기: " : "오늘 루틴 시작: ") + STEP_NAME[ns], "routine", null, "wide") : '<div class="ec-msg">오늘 루틴을 마쳤습니다. 더 하고 싶으면 「훈련」에서 골라 주세요.</div>';
  h += card("오늘", t);
  const yq = pickYest(3), ya = yestAgo();
  h += card("짧게 하나만", '<p class="ec-sub">시작할 때는 지난번 문장 세 개를 우리말만 보고 말해 보고, 하루를 마칠 때는 오늘 있었던 일을 세 문장으로 말해 고침을 받습니다. 고쳐 준 문장은 내 구문에 담겨 다시 나옵니다.</p>' +
    '<div class="ec-row">' + btn(yq.length ? (ya === 1 ? "어제" : ya + "일 전") + " 복습 " + yq.length + "문제" : "복습할 지난 문장이 아직 없습니다", "yestGo", null, yq.length ? "" : "ghost") + btn("오늘 하루 세 문장", "todayGo", null, "ghost") + '</div>' + msgBox(U.shortMsg));
  /* 집중 약점 */
  const S = tagStats(), by = {}; S.list.forEach(s => { by[s.g] = s; });
  h += card("지금 집중할 약점 세 가지", focusTags().map(g => '<button class="ec-item" data-act="tagOpen" data-arg="' + g + '"><b>' + esc(D.TAGS[g].n) + '</b><small>' + (by[g].r ? "최근 2주 " + by[g].r + "번" : "기본 추천 (아직 기록 없음)") + ' · ' + esc(D.TAGS[g].fix) + '</small></button>').join("") +
    '<div class="ec-row end">' + btn("약점 전체 보기", "tab", "weak", "ghost small") + '</div>');
  /* 이번 주 변화 */
  const wk = weekChange();
  if (wk) {
    const row = (name, a, b, unit, up) => a == null || b == null ? "" : '<tr><td>' + name + '</td><td>' + a.toFixed(1) + unit + '</td><td>' + b.toFixed(1) + unit + '</td><td class="' + ((b - a) * up >= 0 ? "s-good" : "s-bad") + '">' + (b >= a ? "+" : "") + (b - a).toFixed(1) + '</td></tr>';
    h += card("이번 주 변화 (기기 측정)", '<table class="ec-t"><tr><th></th><th>지난 7일</th><th>이번 7일</th><th>변화</th></tr>' + row("속도 (단어/분)", wk.wpm[0], wk.wpm[1], "", 1) + row("분당 멈춤", wk.ppm[0], wk.ppm[1], "", -1) + row("높낮이 폭 (반음)", wk.st[0], wk.st[1], "", 1) + '</table>');
  }
  /* 실전 미션 */
  const w = weekNo(d), mk = DB.miss[w] || {};
  const mr = missRes()[w] || {}, mdone = missionsOfWeek(w).filter(m => mk[m.id] > 0).length;
  h += card("이번 주 실전 미션", '<p class="ec-sub">누르면 앱 안에서 바로 시작합니다. 마치면 앱이 스스로 표시하고 결과를 적어 둡니다. 이번 주 ' + mdone + ' / 3 완료.</p>' + missionsOfWeek(w).map(m => '<button class="ec-miss' + (mk[m.id] > 0 ? " done" : "") + '" data-act="missGo" data-arg="' + m.id + '"><i>' + (mk[m.id] > 0 ? "✓" : "▶") + '</i><span>' + esc(m.t) + (mk[m.id] > 0 ? '<small class="ec-sub"><br>완료' + (mr[m.id] ? " · " + esc(mr[m.id]) : "") + ' · 다시 하려면 누르세요</small>' : "") + '</span></button>').join("") + msgBox(U.missMsg));
  return h;
}

/* 모범답안을 문장별로: 듣기, (뜻이 있으면) 내 구문에 담기 */
function natHtml(nat, sents) {
  const a = natSents(nat, sents), have = {}; allPhrases().forEach(p => { have[p.en.toLowerCase()] = 1; });
  let h = '<div class="ec-nat">' + a.map(x => {
    let b = "";
    KEEP.push(x);
    if (have[x.en.toLowerCase()]) b = ' <span class="ec-sub" style="white-space:nowrap">담김</span>';
    else if (x.ko) b = ' <button class="ec-mini" data-act="natAdd" data-arg="' + (KEEP.length - 1) + '">담기</button>';
    else b = U.natBusy === x.en ? ' <span class="ec-sub" style="white-space:nowrap">뜻 받는 중…</span>' : ' <button class="ec-mini" data-act="natAsk" data-arg="' + (KEEP.length - 1) + '">뜻 받아 담기</button>';
    return '<p>' + esc(x.en) + ' ' + say(x.en, "듣기", "teacher") + b + (x.ko ? '<br><span class="ec-sub">' + esc(x.ko) + '</span>' : "") + '</p>';
  }).join("") + '</div>';
  if (a.length > 1) h += '<div class="ec-row">' + say(nat, "전체 이어 듣기", "teacher") + '</div>';
  return h;
}
function natCard() {
  const L = natList(); let n = 0; L.forEach(r => { n += natSents(r.nat, r.ns).length; });
  let h = '<p class="ec-sub">선생님과의 대화와 레벨 테스트에서 내 말을 자연스럽게 고쳐 준 답안이 여기에 모입니다. 문장마다 듣고, 쓰고 싶은 문장은 내 구문에 담아 입으로 익히세요. 기록과 함께 계정에 저장됩니다.</p>' +
    btn(L.length ? (U.natOpen ? "접기" : "모범답안 보기 (대답 " + L.length + "개 · " + n + "문장)") : "아직 대화 기록이 없습니다", "natOpen", null, L.length ? (U.natOpen ? "ghost" : "") : "ghost");
  if (U.natOpen && L.length) {
    const have = {}; allPhrases().forEach(p => { have[p.en.toLowerCase()] = 1; });
    const noKo = L.slice(0, U.natN).some(r => natSents(r.nat, r.ns).some(x => !x.ko && !have[x.en.toLowerCase()]));
    L.slice(0, U.natN).forEach(r => { const sc = { name: r.name }, dt = new Date(r.t);
      h += '<div class="ec-hr"></div><p class="ec-sub"><b>' + (dt.getMonth() + 1) + "월 " + dt.getDate() + "일 · " + esc(sc ? sc.name : "대화") + '</b>' + (r.q ? '<br>질문: ' + esc(r.q) : "") + '</p>' + natHtml(r.nat, r.ns); });
    if (noKo) h += '<p class="ec-sub">예전 답안에는 우리말 뜻이 없어, 「뜻 받아 담기」를 누르면 선생님에게 뜻을 받아서 담습니다(요청 한 번). 이번 판부터 하는 대화는 뜻이 함께 나옵니다.</p>';
    if (L.length > U.natN) h += '<div class="ec-row">' + btn("더 보기 (" + (L.length - U.natN) + "번 남음)", "natMore", null, "ghost small") + '</div>';
  }
  return h + msgBox(U.natMsg);
}
/* 이어 듣기: 고른 문장 묶음을 차례로 읽어 준다 */
const LOOP_SRC = { lis: "듣기 이야기 (최근 3편)", cum: "오늘·어제 익힌 문장", fix: "틀렸던 문장", nat: "선생님 모범답안 (최근 대화 5번)", my: "내 구문 전체", learn: "연습 중인 구문" };
function loopItems(src) {
  if (src === "lis") { const o = []; lisList().slice(0, 3).forEach(p => p.sents.forEach(x => o.push({ en: x.en, role: "teacher" }))); return o; }
  if (src === "fix") return fixList().map(p => ({ en: p.en }));
  if (src === "nat") { const o = []; natList().slice(0, 5).forEach(r => natSents(r.nat, r.ns).forEach(x => o.push({ en: x.en, role: "teacher" }))); return o; }
  if (src === "my") return DB.my.map(p => ({ en: p.en }));
  if (src === "learn") return allPhrases().filter(p => phraseState(p.id) === "learning").slice(0, 40).map(p => ({ en: p.en }));
  return pickCumul(40).map(x => ({ en: x.en }));
}
function loopStatus() { if (!LOOP.on) return ""; const it = LOOP.list[LOOP.i] || LOOP.list[0]; return "읽는 중 " + (Math.min(LOOP.i, LOOP.list.length - 1) + 1) + " / " + LOOP.list.length + " — " + (it ? it.en : ""); }
function loopCard() {
  const n = loopItems(U.loopSrc).length, sel = (id, chg, cur, opts) => '<select id="' + id + '" data-chg="' + chg + '">' + opts.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") + '</select>';
  return '<p class="ec-sub">고른 문장을 차례로 읽어 줍니다. 문장마다 읽은 길이만큼 틈을 두니 그 사이에 소리 내어 따라 말하세요. 이동 중에 듣고 중얼거리기에 좋습니다. 한 번 받은 소리는 기기에 남아 다시 들을 때 크레딧이 들지 않습니다.</p>' +
    '<label for="ecLoopSrc">들을 문장</label>' + sel("ecLoopSrc", "loopSrc", U.loopSrc, Object.keys(LOOP_SRC).map(k => [k, LOOP_SRC[k]])) +
    '<label for="ecLoopRate">빠르기</label>' + sel("ecLoopRate", "loopRate", U.loopRate, [[0.7, "느리게"], [0.85, "조금 느리게"], [1, "보통"], [1.15, "조금 빠르게"], [1.5, "1.5배속"]]) +
    '<label class="ec-check"><input type="checkbox" id="ecLoopEcho" data-chg="loopEcho"' + (U.loopEcho ? " checked" : "") + '> 문장마다 따라 말할 틈 두기</label>' +
    '<label class="ec-check"><input type="checkbox" id="ecLoopForever" data-chg="loopForever"' + (U.loopForever ? " checked" : "") + '> 멈춤을 누를 때까지 되풀이</label>' +
    '<div class="ec-row">' + (LOOP.on ? btn("■ 멈춤", "loopStop") : btn(n ? "▶ 이어 듣기 시작 (" + n + "문장)" : "들을 문장이 아직 없습니다", "loopGo", null, n ? "" : "ghost")) + '</div>' +
    '<div id="ecLoopSt" class="' + (LOOP.on ? "ec-msg" : "") + '">' + esc(loopStatus()) + '</div>' + msgBox(U.loopMsg);
}
function badgeHtml() { const B = badgeList(), got = B.filter(b => b.ok).length;
  return '<p class="ec-sub">' + B.length + '개 가운데 ' + got + '개를 받았습니다. 기록에서 바로 계산하므로 기기를 바꿔도 그대로입니다.</p><div class="ec-bgs">' + B.map(b => '<div class="ec-bg' + (b.ok ? " on" : "") + '"><b>' + (b.ok ? "★ " : "") + esc(b.n) + '</b><small>' + esc(b.d) + (b.ok ? "" : " · " + b.now + " / " + b.goal) + '</small></div>').join("") + '</div>'; }
function attendHtml() { const A0 = attendance(12), done = A0.filter(x => x.v === 2).length, act = A0.filter(x => x.v >= 1).length;
  return '<div class="ec-att">' + ["월", "화", "수", "목", "금", "토", "일"].map(n => '<span>' + n + '</span>').join("") + A0.map(x => '<i class="' + (x.v === 2 ? "full" : x.v === 1 ? "part" : x.v < 0 ? "later" : "") + (x.today ? " now" : "") + '"></i>').join("") + '</div><p class="ec-sub">진한 칸은 루틴을 모두 마친 날(' + done + '일), 연한 칸은 일부만 한 날입니다. 12주 동안 연습한 날 ' + act + '일.</p>'; }
/* ---------- 훈련 목록 ---------- */
function drawTrain() {
  const p = PLAN(), r = dayRec(), due = dueList().length, f = focusTags(), sc = D.SCENES[U.scene];
  const row = (title, desc, count, action) => '<section class="ec-card"><div class="ec-row between"><h2>' + title + '</h2><span class="ec-sub">' + count + '</span></div><p class="ec-sub">' + desc + '</p>' + action + '</section>';
  let h = noteHtml();
  h += row(STEP_NAME.phr, "복습할 구문 " + due + "개. 새 구문은 듣고 따라 말하고, 본 구문은 우리말만 보고 말합니다. 녹음을 모아 한 번에 채점합니다.", "오늘 " + r.st.phr + " / " + p.phr, btn("시작", "start", "phr"));
  h += row(STEP_NAME.dr, "지금 약점: " + f.slice(0, 2).map(g => esc(D.TAGS[g].n)).join(", ") + " + 영어 어순 원칙 하나.", "오늘 " + r.st.dr + " / " + p.dr, btn("시작", "start", "dr"));
  h += row(STEP_NAME.talk, "대답할 때마다 발음·억양·문법·어순을 짚어 주고, 자연스러운 표현과 외워 둘 구문을 알려 줍니다.", "오늘 " + r.st.talk + " / " + p.talk + "번",
    '<label for="ecScene">장면</label><select id="ecScene" data-chg="scene">' + D.SCENES.map((s, i) => '<option value="' + i + '"' + (i === U.scene ? " selected" : "") + '>' + esc(s.name) + '</option>').join("") + '</select>' +
    (sc.script ? '<label for="ecScript">읽을 영어 원고 (설교, 기도문, 「말씀함께」 영어 본문 등)</label><textarea id="ecScript" data-bind="script" placeholder="여기에 영어 원고를 붙여 넣으세요">' + esc(U.f.script) + '</textarea>' : "") +
    '<div class="ec-row">' + btn("시작", "start", "talk") + '</div>');
  h += row(STEP_NAME.retell, "오늘 대화에서 고칠 것이 많았던 대답을, 자연스러운 표현을 익힌 뒤 가리고 다시 말합니다. 실력이 붙는 단계입니다.", "오늘 " + r.st.retell + " / " + p.retell, btn("시작", "start", "retell"));
  const lp = lisList();
  h += '<section class="ec-card"><div class="ec-row between"><h2>' + STEP_NAME.lis + '</h2><span class="ec-sub">' + (p.lis > 0 ? "오늘 " + (r.st.lis || 0) + " / " + p.lis + "편 · " : "") + '지금까지 ' + DB.log.filter(r => r.k === "listen").length + '번</span></div>' +
    '<p class="ec-sub">선생님이 내 수준에 맞춰 새로 쓴 1분 이야기를 성우 목소리로 듣습니다. ① 글 없이 듣기 → ② 안 들린 문장 받아쓰기 → ③ 글 보며 왜 안 들렸는지 확인 → ④ 따라 말하기. 이야기 하나에 요청 한 번입니다.</p>' +
    '<label for="ecLisTopic">주제</label><select id="ecLisTopic" data-chg="lisTopic">' + Object.keys(LIS_TOPICS).map(k => '<option value="' + k + '"' + (k === U.lisTopic ? " selected" : "") + '>' + LIS_TOPICS[k][0] + '</option>').join("") + '</select>' +
    '<div class="ec-row">' + btn(U.lisBusy ? "이야기를 쓰는 중…" : "새 이야기로 시작", "lisNew", null, U.lisBusy ? "ghost" : "") + (lp.length ? btn("지난 이야기 다시 (" + lp.length + ")", "lisOld", null, "ghost") : "") + '</div>' + msgBox(U.lisMsg) +
    (U.lisOld && lp.length ? lp.slice(0, 10).map(p => '<button class="ec-item" data-act="lisOpen" data-arg="' + esc(p.id) + '"><b>' + esc(p.title) + '</b><small>' + esc(p.titleKo || "") + ' · 문장 ' + p.sents.length + '개</small></button>').join("") : "") +
    '<details class="ec-lisown"><summary>내 글로 듣기 (영어 설교 원고, 「말씀함께」 영어 본문 등)</summary><textarea id="ecLisOwn" data-bind="lisOwn" placeholder="내가 쓴 영어 글을 붙여 넣으세요. 남의 방송 대본이나 책은 넣지 마세요.">' + esc(U.f.lisOwn || "") + '</textarea><div class="ec-row">' + btn("이 글로 시작", "lisOwn", null, "small") + '</div></details></section>';
  h += row("레벨 테스트", "과제 4개(낭독, 일상 질문, 경험 이야기, 설명). 약 6분, 채점 요청 4번. 일주일에 한 번을 권합니다.", "지금까지 " + tests().length + "번", btn("시작", "start", "test", "ghost"));
  return h;
}

/* ---------- 듣기 코너 ---------- */
const LIS_STEP = ["① 글 없이 듣기", "② 받아쓰기", "③ 글 보며 듣기", "④ 따라 말하기"];
function lisStart(p, topic) {
  if (REC.on) return;
  A = { type: "listen", title: "듣기 · " + p.title, p: p, topic: topic || "", mission: U.lisMission || null, step: 0, heard: 0, show: false, pick: {}, dict: lisPick(p.sents).map(i => ({ i: i, typed: "", res: null })), phase: "idle" };
  loopStop(); speakStop(); go("train");
}
const lisQs = () => (A && A.p && A.p.qs || []).map((q, i) => ({ q: q, i: i })).filter(x => x.q.opts && x.q.opts.length);
const lisQn = () => lisQs().length, lisQdone = () => lisQs().filter(x => A.pick[x.i] != null).length, lisQok = () => lisQs().filter(x => A.pick[x.i] === x.q.ans).length;
function lisPick(sents) { const n = sents.length, k = Math.min(easyMode() ? 2 : 3, n), out = []; for (let j = 0; j < k; j++) { const i = Math.min(n - 1, Math.round((j + 0.5) * n / k - 0.5)); if (out.indexOf(i) < 0) out.push(i); } return out; }
function lisAll(echo) { loopStart(A.p.sents.map(x => ({ en: x.en, role: "teacher" })), { rate: U.loopRate, echo: !!echo, forever: !!echo }); A.heard++; render(); }
function drawListen() {
  const p = A.p, st = A.step;
  let h = '<div class="ec-steps">' + LIS_STEP.map((n, i) => '<button class="ec-step' + (i < st ? " done" : "") + '" data-act="lisStep" data-arg="' + i + '"' + (i === st ? ' aria-current="step"' : "") + '><span>' + n + '</span><b>' + (i < st ? "✓" : i === st ? "지금" : "") + '</b></button>').join("") + '</div>';
  const player = (echo) => '<div class="ec-row">' + (LOOP.on ? btn("■ 멈춤", "loopStop") : btn(echo ? "▶ 따라 말하기 시작" : "▶ 전체 듣기", "lisPlay", echo ? "echo" : "")) + '</div><div id="ecLoopSt" class="' + (LOOP.on ? "ec-msg" : "") + '">' + (LOOP.on ? "읽는 중 " + (Math.min(LOOP.i, LOOP.list.length - 1) + 1) + " / " + LOOP.list.length : "") + '</div>';
  if (st === 0) {
    h += card("① 글 없이 듣기", '<p class="ec-sub">글을 보지 말고 두 번 들어 보세요. 낱말 하나하나가 아니라 누가, 무엇을, 왜 했는지만 잡으면 됩니다. 듣고 나서 아래 질문의 답을 고르면 바로 채점합니다.</p>' + player(false) +
      '<p class="ec-sub">들은 횟수 ' + A.heard + '번</p>' +
      (p.qs.length ? '<h3>듣고 나서 답을 골라 보세요</h3>' + p.qs.map((q, i) => { const pick = A.pick[i];
        if (!(q.opts && q.opts.length)) return '<p>' + (i + 1) + '. ' + esc(q.q) + (A.show ? '<br><span class="ec-sub">→ ' + esc(q.a) + '</span>' : "") + '</p>';
        return '<p><b>' + (i + 1) + '. ' + esc(q.q) + '</b></p><div class="ec-opts">' + q.opts.map((o, j) => '<button class="ec-opt' + (pick == null ? "" : j === q.ans ? " right" : j === pick ? " wrong" : "") + '" data-act="lisAns" data-arg="' + i + "|" + j + '"' + (pick == null ? "" : " disabled") + '>' + (pick == null ? "" : j === q.ans ? "✓ " : j === pick ? "✗ " : "") + esc(o) + '</button>').join("") + '</div>' +
          (pick == null ? "" : '<p class="' + (pick === q.ans ? "s-good" : "s-bad") + '">' + (pick === q.ans ? "맞았습니다." : "틀렸습니다. 정답: " + esc(q.opts[q.ans])) + '</p>'); }).join("") +
        (p.qs.some(q => !(q.opts && q.opts.length)) && !A.show ? '<div class="ec-row">' + btn("답 확인", "lisShow", null, "ghost small") + '</div>' : "") +
        (lisQn() && lisQdone() === lisQn() ? '<div class="ec-msg">' + lisQn() + '문제 가운데 ' + lisQok() + '문제를 맞혔습니다.' + (lisQok() < lisQn() ? " 한 번 더 듣고 어디서 놓쳤는지 확인해 보세요." : "") + '</div>' : "") : "") +
      '<div class="ec-row end">' + btn("다음: 받아쓰기", "lisStep", "1") + '</div>');
  } else if (st === 1) {
    h += card("② 받아쓰기", '<p class="ec-sub">문장을 듣고 들리는 대로 적어 보세요. 여러 번 들어도 됩니다. 철자보다 낱말을 잡았는지가 중요합니다. 못 들은 낱말이 바로 귀가 아직 못 잡는 소리입니다.</p>' +
      A.dict.map((d, k) => { const s = p.sents[d.i];
        let b = '<h3>문장 ' + (k + 1) + ' ' + say(s.en, "듣기", "teacher") + '</h3>';
        if (!d.res) b += '<input type="text" id="ecDict' + k + '" data-bind="dict' + k + '" value="' + esc(U.f["dict" + k] || "") + '" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="들린 대로 영어로"><div class="ec-row">' + btn("확인", "lisCheck", String(k), "small") + '</div>';
        else b += '<div class="ec-nat"><p>' + d.res.words.map((w, i) => d.res.hit[i] ? esc(w) : '<b class="s-bad">' + esc(w) + '</b>').join(" ") + '</p><p class="ec-sub">내가 적은 것: ' + esc(d.typed || "(비움)") + '<br>들은 낱말 ' + d.res.ok + ' / ' + d.res.n + (s.note ? '<br>' + esc(s.note) : "") + '</p></div>';
        return b; }).join("") +
      '<div class="ec-row end">' + btn("다음: 글 보며 듣기", "lisStep", "2") + '</div>');
  } else if (st === 2) {
    h += card("③ 글 보며 듣기", '<p class="ec-sub">이제 글을 보며 듣습니다. 안 들렸던 곳이 왜 안 들렸는지 풀이를 보고, 그 문장만 다시 들어 보세요. 소리가 이어지거나 약해지는 곳을 알면 다음부터 들립니다.</p>' + player(false) +
      p.sents.map(s => '<div class="ec-fix"><b>' + esc(s.en) + '</b> ' + say(s.en, "듣기", "teacher") + (s.ko ? '<div class="ec-sub">' + esc(s.ko) + '</div>' : "") + (s.note ? '<div>' + esc(s.note) + '</div>' : "") + '</div>').join("") +
      (p.words.length ? '<h3>알아 둘 말</h3>' + p.words.map(w => '<p>' + esc(w.en) + ' <span class="ec-sub">' + esc(w.ko) + '</span></p>').join("") : "") +
      '<div class="ec-row end">' + btn("다음: 따라 말하기", "lisStep", "3") + '</div>');
  } else {
    h += card("④ 따라 말하기", '<p class="ec-sub">문장마다 읽은 길이만큼 틈을 둡니다. 그 사이에 들은 그대로 소리 내어 따라 말하세요. 입으로 낼 수 있는 소리가 귀에도 들립니다. 처음에는 글을 보고, 다음에는 보지 않고 해 보세요.</p>' + player(true) +
      '<details><summary class="ec-sub">글 보기</summary>' + p.sents.map(s => '<p>' + esc(s.en) + '</p>').join("") + '</details>' +
      '<p class="ec-sub">며칠 뒤 「구문」의 「이어 듣기」에서 "듣기 이야기"를 골라 길에서 다시 들으면 굳습니다.</p><div class="ec-row end">' + btn("듣기 마치기", "lisDone") + '</div>');
  }
  return h;
}
function waitText(me) { return "무료 사용 한도(1분에 보낼 수 있는 횟수)를 잠시 넘었습니다. " + Math.max(1, Math.ceil((me.autoAt - Date.now()) / 1000)) + "초 뒤에 자동으로 다시 보냅니다. 녹음은 그대로 있으니 기다리시면 됩니다."; }
/* ---------- 녹음 공통 ---------- */
function recBtn(label) {
  if (REC.on) return '<button class="ec-btn rec on" data-act="rec">■ 녹음 끝내기 <span id="ecRecT">0:00</span></button>';
  return '<button class="ec-btn rec" data-act="rec"' + (REC.busy ? " disabled" : "") + '>● ' + (label || "녹음 시작") + '</button>';
}
function recStart(max, done) {
  if (REC.on || REC.busy) return;
  REC.busy = true; setMsg(""); loopStop(); speakStop();
  capStart(() => {
    REC.busy = false; REC.on = true; REC.t0 = Date.now(); REC.max = max; REC.done = done;
    REC.timer = setInterval(() => { const s = (Date.now() - REC.t0) / 1000, el = $("ecRecT"); if (el) el.textContent = fmtSec(s); if (s >= REC.max) recStop(); }, 250);
    render();
  }, why => { REC.busy = false; render(); setMsg(why, true); });
}
function recStop() {
  if (!REC.on) return;
  REC.on = false; clearInterval(REC.timer);
  const pcm = capStop(), done = REC.done; REC.done = null;
  if (!pcm || !pcm.length) { render(); setMsg("녹음된 소리가 없습니다. 다시 해 주세요.", true); return; }
  done(pcm, analyze(pcm, 16000));
}
function recAbort() { if (REC.on) { REC.on = false; clearInterval(REC.timer); REC.done = null; capStop(); } }
function clipOf(pcm, m) { return { b64: wavBase64(trimPcm(pcm, 16000, m), 16000), m }; }
function needKey() {
  if (G.key) return true;
  U.gmsg = { text: "먼저 Gemini 이용 키를 넣어 주세요. 키가 있어야 선생님이 녹음을 들을 수 있습니다.", err: true };
  go("set"); return false;
}
function hasWork(a) {
  if (!a) return false;
  if (a.type === "batch") return a.phase !== "done" && a.clips.length > 0;
  if (a.type === "talk") return a.phase === "sending" || a.phase === "fail";
  if (a.type === "retell") return a.phase === "sending" || a.phase === "fail";
  if (a.type === "test") return a.phase !== "done" && a.phase !== "intro" && a.tasks.some(t => t.clip);
  return false;
}
function endAct() { recAbort(); speakStop(); A = null; U.note = null; U.flash = null; pendSave(); render(); window.scrollTo(0, 0); }
function nextBtn() { const ns = nextStep(); return ns ? btn("다음 단계: " + STEP_NAME[ns], "start", ns) : '<div class="ec-msg">오늘 루틴을 모두 마쳤습니다.</div>'; }
function drawStage() {
  let h = '<div class="ec-row between ec-stagehead">' + btn("← 목록", "quit", null, "ghost small") + '<b>' + esc(A.title) + '</b></div>';
  if (A.quitAsk) h += '<div class="ec-msg err">아직 채점하지 않은 녹음이 있습니다. 그만두면 사라집니다.<div class="ec-row">' + btn("그만두기", "quit", "yes", "small") + btn("계속하기", "stay", null, "ghost small") + '</div></div>';
  const body = A.type === "batch" ? drawBatch() : (A.type === "talk" ? drawTalk() : (A.type === "retell" ? drawRetell() : (A.type === "listen" ? drawListen() : drawTest())));
  return h + body + (body.indexOf('id="ecMsg"') < 0 ? noteHtml() : "");
}

/* ---------- 묶음 훈련: 구문 복습, 약점·어순 훈련 ---------- */
function startBatch(kind, items, title, step) {
  if (!needKey()) return;
  if (!items.length) { go("train"); setMsg("지금 할 문장이 없습니다.", false); return; }
  A = { type: "batch", kind, title, items, i: 0, phase: "ask", clips: [], step, res: null };
  go("train"); autoSay(items[0]);
}
function autoSay(it) { if (DB.set.autoSpeak && it && (it.task === "shadow" || it.task === "read")) speak(it.en); }
function startPhr() { const p = PLAN().phr, done = dayRec().st.phr; startBatch("phr", pickPhrases(done < p ? Math.max(3, p - done) : p), "구문 복습", "phr"); }
function startDr() { const p = PLAN().dr, done = dayRec().st.dr; startBatch("dr", pickDrills(done < p && p - done >= 4 ? p - done : p), "약점·어순 훈련", "dr"); }
function taskLine(it) {
  if (it.task === "recall") return String(it.ko || "").indexOf(FIX_MARK) === 0 ? "전에 틀렸던 말입니다. 바른 문장으로 말해 보세요." : "우리말을 보고 영어로 말해 보세요.";
  if (it.task === "shadow") return fixWas(it.ref) != null ? "선생님이 고쳐 준 문장입니다. 듣고 그대로 따라 말해 보세요." : "새 구문입니다. 듣고 그대로 따라 말해 보세요.";
  if (it.task === "translate") return "영어 어순으로 바로 말해 보세요. 주어와 동사부터.";
  return "소리 내어 읽어 보세요.";
}
function focusLine(it) {
  if (it.rule) { const o = D.ORDER.filter(x => x.id === it.rule)[0]; return o ? "어순 원칙 — " + o.t : ""; }
  return it.focus && D.TAGS[it.focus] ? "연습 포인트 — " + D.TAGS[it.focus].n + ": " + D.TAGS[it.focus].fix : "";
}
function drawBatch() {
  const n = A.items.length;
  if (A.phase === "done") return drawBatchDone();
  if (A.phase === "sending") return card("", '<p>선생님이 녹음 ' + A.clips.length + '개를 듣고 있습니다…</p>' + noteHtml() + waitHtml());
  if (A.phase === "fail") return card("", noteHtml() + '<p class="ec-sub">녹음 ' + A.clips.length + '개는 그대로 있습니다.</p>' + btn("다시 보내기", "bSend"));
  const it = A.items[A.i], shown = A.phase === "shown", fl = focusLine(it);
  let h = '<div class="ec-prog"><span>' + (A.i + 1) + ' / ' + n + '</span><div class="ec-bar"><i style="width:' + Math.round((A.i + (shown ? 1 : 0)) / n * 100) + '%"></i></div></div>';
  h += '<p class="ec-sub">' + taskLine(it) + '</p>' + (fl ? '<div class="ec-focus">' + esc(fl) + '</div>' : "");
  if (it.task === "recall" || it.task === "translate") {
    const isFix = String(it.ko || "").indexOf(FIX_MARK) === 0, mask = isFix || it.hinted;      /* 틀렸던 말은 우리말 뜻이 없으니 첫 글자 힌트를 처음부터 보여 준다 */
    h += '<div class="ec-task">' + esc(it.ko) + (mask ? '<small class="ec-hintmask">' + (isFix ? "바른 문장: " : "힌트: ") + esc(hintMask(it.en)) + '</small>' : "") + '</div>';
    if (!shown && !REC.on) h += '<div class="ec-row">' + (mask ? "" : btn("첫 글자 힌트", "bHint", null, "ghost small")) + '<button class="ec-btn ghost small" data-act="bPeek">' + (it.heard ? "정답 다시 듣기" : "모르겠으면 정답 듣기") + '</button></div>' + (it.heard ? '<p class="ec-sub">정답을 들었습니다. 듣고 따라 말해도 됩니다. 이 문장은 내일 다시 묻습니다.</p>' : "");
  }
  else h += '<div class="ec-task en">' + esc(it.en) + ' ' + say(it.en) + '<small>' + esc(it.ko) + '</small></div>';
  if (shown) {
    const c = A.clips[A.i];
    const hid = it.task === "recall" || it.task === "translate";     /* 스스로 떠올려 말하는 문제는 채점 전에 정답을 보여 주지 않는다 */
    h += '<div class="ec-kv">내 녹음 ' + c.m.speech.toFixed(1) + '초' + (c.m.st != null ? ' · 높낮이 폭 ' + c.m.st.toFixed(1) + '반음' : "") + (hid ? ' — 정답은 채점한 뒤에 보여 드립니다.' : ' — 들은 소리와 스스로 비교해 보세요.') + '</div>';
    h += '<div class="ec-row">' + btn("다시 녹음", "bRedo", null, "ghost") + btn(A.i + 1 < n ? "다음 →" : "채점 보내기", "bNext") + '</div>';
  } else h += recBtn();
  h += noteHtml();
  if (!shown && !REC.on && A.clips.length > 0) h += '<div class="ec-row end">' + btn("여기까지만 채점 (" + A.clips.length + "개)", "bSend", null, "ghost small") + '</div>';
  return card("", h);
}
function batchRec() {
  const it = A.items[A.i];
  recStart(20, (pcm, m) => {
    if (m.speech < 0.3) { render(); setMsg("소리가 잡히지 않았습니다. 조금 더 크게, 다시 녹음해 주세요.", true); return; }
    A.clips[A.i] = clipOf(pcm, m); A.phase = "shown"; pendSave(); setMsg(""); render();
    if (DB.set.autoSpeak && it.task !== "recall" && it.task !== "translate") speak(it.en);
  });
}
const FOCUS_EN = { d_flat: "flat intonation: stress the key words and move the pitch", d_pause: "too many pauses: say it in one or two breath groups", d_slow: "slow speed: say it smoothly at a natural pace" };
/* 미리 채점: 녹음을 다 모을 때까지 기다리지 않고, 다음 문장으로 넘어가는 동안 앞 문장을 먼저 채점해 둔다. 마지막에 누르면 거의 바로 결과가 나온다. */
function batchParts(me, from, k) {
  const parts = [{ text: "MODE: batch\n" + profileText() + "\nThere are " + k + " items." }];
  for (let j = 0; j < k; j++) { const it = me.items[from + j];
    parts.push({ text: "ITEM " + (j + 1) + " | TASK " + it.task + " | TARGET: " + it.en + " | FOCUS: " + (it.focus ? it.focus + " (" + (TAG_EN[it.focus] || FOCUS_EN[it.focus] || "") + ")" : "none") });
    parts.push({ inlineData: { mimeType: "audio/wav", data: me.clips[from + j].b64 } }); }
  return parts;
}
const preLive = me => !!me.preBusy && Date.now() - (me.preAt || 0) < 60000;
function batchPre() {
  const me = A; if (!me || me.type !== "batch" || !G.key || store.get("ec_nopre") === "1" || preLive(me) || me.phase === "sending" || me.phase === "done" || me.phase === "fail") return;
  if (!Array.isArray(me.part)) me.part = [];
  const from = me.part.length, k = Math.min(3, Math.min(me.i, me.clips.length) - from); if (k < 1) return;      /* 지금 문장 앞의 녹음만 (다시 녹음할 수 없는 것) */
  me.preBusy = true; me.preAt = Date.now();
  const end = () => { me.preBusy = false; };
  gCall({ sys: sysFor("batch"), parts: batchParts(me, from, k), temp: 0.2, lite: true }, () => {}, (r, model) => {
    end(); if (A !== me || me.phase === "done" || (me.part || []).length !== from) return;
    me.part = me.part.concat(cleanBatch(r, k)); me.md = model; pendSave(); if (me.phase !== "sending") batchPre();
  }, () => { end(); });
}
function batchSend() {
  const me = A; me.items = me.items.slice(0, me.clips.length);
  const n = me.items.length; if (!n) return;
  if (Array.isArray(me.part) && me.part.length > n) me.part = me.part.slice(0, n);       /* 「여기까지만 채점」: 미리 채점해 둔 것 가운데 보낼 만큼만 */
  me.phase = "sending"; me.quitAsk = false; me.failMsg = ""; pendSave(); setMsg(""); render();
  /* 녹음을 세 개씩 나눠 보낸다. 한 번에 보내는 양이 작아야 느린 연결에서도 끊기지 않고, 끊겨도 받은 데까지는 남는다. */
  if (!Array.isArray(me.part)) me.part = [];
  const CH = 3;
  const step = () => {
    if (A !== me || me.phase !== "sending") return;
    if (preLive(me)) { setMsg("채점 중 " + me.part.length + " / " + n + "…"); setTimeout(step, 250); return; }   /* 미리 보내 둔 채점이 돌아오기를 기다린다 */
    const from = me.part.length;
    if (from >= n) { finish(); return; }
    const k = Math.min(n, from + CH) - from;
    setMsg("채점 중 " + from + " / " + n + "…");
    const parts = batchParts(me, from, k);
    gCall({ sys: sysFor("batch"), parts, temp: 0.2, lite: true }, s => { if (A === me) setMsg(s + " (" + from + " / " + n + ")"); }, (r, model) => {
      if (A !== me || me.phase !== "sending") return;
      me.part = me.part.concat(cleanBatch(r, k)); me.md = model; pendSave(); step();
    }, (why, kind) => { if (A === me && me.phase === "sending") failed(me, why + (me.part.length ? " (" + me.part.length + "개까지는 채점해 두었습니다.)" : ""), kind); });
  };
  const finish = () => {
    const res = me.part, model = me.md || ""; me.part = [];
    me.items.forEach((it, i) => {
      const x = res[i], m = me.clips[i].m, words = wc(x.heard);
      if (x.heard && DEVICE_TAGS[it.focus]) {      /* 전달 훈련은 기기 측정으로 판정 */
        if (it.focus === "d_flat" && m.st != null) { x.ok = m.st >= 4; x.note = "높낮이 폭 " + m.st.toFixed(1) + "반음 — " + (x.ok ? "충분히 움직였어요." : "4반음 이상이 목표예요. 핵심 단어를 더 높고 길게."); }
        if (it.focus === "d_pause") { x.ok = m.pauses === 0; x.note = x.ok ? "끊기지 않고 한 호흡에 말했어요." : "중간에 " + m.pauses + "번 멈췄어요. 한 호흡에 이어서 말해 보세요."; }
        if (it.focus === "d_slow" && m.span >= 1 && words) { const w = words / (m.span / 60); x.ok = w >= 110; x.note = "분당 " + Math.round(w) + "단어 — " + (x.ok ? "자연스러운 속도예요." : "110단어 이상이 목표예요. 단어를 이어서 말해 보세요."); }
      }
      if (!x.ok && !x.tag && me.kind === "dr" && x.heard) x.tag = it.focus;
      if (x.ok) x.tag = "";
      if (me.kind === "phr" && !me.again) { if (x.ok && it.heard) srsPeek(it.ref); else srsMark(it.ref, x.ok); }
    });
    if (me.kind === "phr" && !me.again) dbSave("srs");
    logAdd({ k: me.kind, n, ok: res.filter(x => x.ok).length, it: me.items.map((it, i) => [it.ref, res[i].ok ? 1 : 0, res[i].score, res[i].tag, res[i].ok ? "" : res[i].heard.slice(0, 80)]), md: model });
    const day = dayRec(); if (me.step) day.st[me.step] = (day.st[me.step] || 0) + (me.step === "rev" ? 1 : n); day.said += res.filter(x => x.heard).length; daySave();
    me.res = res; me.phase = "done";
    if (me.mission) { const rc = me.items.map((it, i) => ({ it: it, r: res[i] })).filter(x => x.it.task === "recall"), okN = rc.filter(x => x.r && x.r.ok).length;
      me.missOk = rc.length > 0 && okN >= Math.ceil(rc.length * 2 / 3); me.missNote = "외워 말하기 " + okN + " / " + rc.length + " 맞음";
      if (me.missOk) missDone(me.mission, me.missNote); }
    if (arrived(me.title + " 채점이 끝났습니다.")) window.scrollTo(0, 0);
  };
  step();
}
function drawBatchDone() {
  const ok = A.res.filter(x => x.ok).length, n = A.res.length, wrong = n - ok;
  let h = '<div class="ec-big"><b class="' + sCls(ok / n * 100) + '">' + ok + '</b> / ' + n + '</div>';
  if (A.mission) h += '<div class="ec-msg' + (A.missOk ? "" : " err") + '">' + (A.missOk ? "미션을 마쳤습니다 ✓ " : "아직 미션 완료가 아닙니다. ") + esc(A.missNote || "") + (A.missOk ? "" : " — 세 문장 가운데 두 문장 이상을 외워 말하면 완료입니다. 홈에서 다시 눌러 도전하세요.") + '</div>';
  h += A.items.map((it, i) => {
    const x = A.res[i], s = A.kind === "phr" ? DB.srs[it.ref] : null;
    return '<div class="ec-res ' + (x.ok ? "ok" : "no") + '"><div class="ec-res-h"><b>' + (x.ok ? "✓" : "✗") + '</b> ' + esc(it.en) + ' ' + say(it.en) + '</div>' +
      (it.task !== "read" && it.ko ? '<div class="ec-sub">' + esc(it.ko) + '</div>' : "") +
      (fixWas(it.ref) != null && String(it.ko || "").indexOf(FIX_MARK) !== 0 ? '<div class="ec-sub">전에는 「' + esc(fixWas(it.ref)) + '」라고 했어요.</div>' : "") +
      (x.heard ? '<div class="ec-kv">들린 말: ' + esc(x.heard) + '</div>' : "") + (x.note ? '<div class="ec-tip">' + esc(x.note) + '</div>' : "") +
      '<div class="ec-row">' + (x.ok ? "" : tagChip(x.tag)) + (s ? '<span class="ec-sub">다음 복습: ' + dueText(s) + '</span>' : "") + '</div></div>';
  }).join("");
  h += '<div class="ec-row">' + (wrong ? btn("틀린 것만 다시 (" + wrong + "개)", "bWrong", null, "ghost") : "") + nextBtn() + '</div>';
  h += '<div class="ec-kv">AI 채점은 참고 의견입니다. 맞게 말했는데 틀렸다고 나오면 다시 해 보세요.</div>';
  return card(esc(A.title) + " 결과", h);
}

/* ---------- 선생님과 대화 ---------- */
function openerFor(sc) { const list = [sc.open].concat(sc.more || []); return list[(today() + U.talkN) % list.length]; }
function startTalk(idx, mission) {
  if (!needKey()) return;
  const sc = D.SCENES[idx];
  if (sc.script && !U.f.script.trim()) { go("train"); setMsg("읽을 영어 원고를 먼저 넣어 주세요.", true); return; }
  A = { type: "talk", title: sc.name, scene: idx, script: sc.script ? U.f.script.trim().slice(0, 3000) : "", turns: [], q: openerFor(sc), phase: "idle", pend: null, allOpen: false, more: stepDone("talk") };   /* 오늘 몫을 이미 채우고 다시 시작했으면 끊지 않는다 */
  if (easyMode() && !sc.script && !mission) { const eo = D.EASY_OPEN[(today() + U.talkN) % D.EASY_OPEN.length]; A.title = "쉬운 대화"; A.q = eo.en; A.qKo = eo.ko; A.hint = eo.hint; }
  if (mission) { A.title = "미션 · " + mission.t; A.q = mission.open; A.mission = mission.id; A.more = false; }
  U.talkN++; go("train");
  if (DB.set.autoSpeak) speak(A.q, "teacher");
}
function talkContext(a, m) {
  const sc = D.SCENES[a.scene], L = ["MODE: talk", "Scenario: " + sc.name + " (" + sc.id + ")"];
  if (sc.script && a.script) L.push("He is reading this text aloud. Compare what you hear with it and note skipped or misread words. Here 'reply' is one short instruction for the next reading, and 'natural', 'chunks' and 'phrases' may be empty:\n" + a.script);
  const hist = []; a.turns.slice(-4).forEach(t => { hist.push("Coach: " + t.q); hist.push("Learner: " + t.r.transcript); }); hist.push("Coach: " + a.q);
  L.push("Conversation so far:\n" + hist.join("\n")); L.push(profileText()); L.push(metricsText(m));
  L.push("The attached audio is his new answer to your last line. Evaluate it and reply.");
  return L.join("\n\n");
}
function talkRec() {
  recStart(D.SCENES[A.scene].script ? 180 : 90, (pcm, m) => {
    if (m.speech < 0.5) { render(); setMsg("소리가 잡히지 않았습니다. 조금 더 크게, 다시 녹음해 주세요.", true); return; }
    A.pend = clipOf(pcm, m); talkSend();
  });
}
function talkSend() {
  const me = A, p = me.pend; if (!p) return;
  me.phase = "sending"; me.quitAsk = false; me.failMsg = ""; pendSave(); setMsg(""); render();
  gCall({ sys: sysFor("talk"), temp: 0.4, parts: [{ text: talkContext(me, p.m) }, { inlineData: { mimeType: "audio/wav", data: p.b64 } }] }, s => { if (A === me) setMsg(s); }, (r, model) => {
    if (A !== me) return;
    const c = cleanTalk(r);
    if (!c.transcript) { me.pend = null; me.phase = "idle"; pendSave(); if (U.tab !== "train") U.flash = { text: me.title + ": 말소리를 알아듣지 못했다고 합니다." }; render(); setMsg("선생님이 말소리를 알아듣지 못했다고 합니다. 다시 녹음해 주세요.", true); return; }
    const sc = D.SCENES[me.scene], words = wc(c.transcript), tags = tagsOf(c, p.m, words, !!sc.script);
    const rec = logAdd({ k: "talk", sc: sc.id, q: me.q.slice(0, 240), tx: c.transcript.slice(0, 900), nat: c.natural.slice(0, 900), ns: c.sents.map(x => ({ en: x.en, ko: x.ko })), ch: c.chunks, s: [c.sc.pron, c.sc.inton, c.sc.flu, c.sc.gram], m: mPack(p.m, words), tags,
      fx: c.gram.map(g => fxOf(g)), pr: c.pron.map(x => ({ w: x.word, g: x.tag })), md: model });
    const day = dayRec(); day.st.talk++; day.said += sentences(c.transcript); daySave();
    me.turns.push({ q: me.q, r: c, m: p.m, words, tags, id: rec.id, model, open: false });
    me.q = c.reply || "Thank you. Please tell me more."; me.qKo = c.replyKo || ""; me.hint = c.hint || null; me.hintOpen = false; me.pend = null; me.phase = "idle";
    if (!me.more && stepDone("talk")) me.goal = true;            /* 오늘 정한 횟수를 채우면 여기서 끝낸다 */
    if (me.mission && !me.missed) { me.missed = true; me.goal = true; me.more = false; missDone(me.mission, "발음 " + r0(c.sc.pron) + " · 문법 " + r0(c.sc.gram) + " · " + words + "단어"); }
    if (arrived(me.title + ": 선생님 답이 왔습니다.")) { const el = $("ecLast"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); if (DB.set.autoSpeak && !me.goal) speak(me.q, "teacher"); }
  }, (why, kind) => { if (A === me) failed(me, why, kind); });
}
function turnOpen(t, i, last) {
  const r = t.r, m = t.m, wpm = wpmOf(m, t.words), ppm = ppmOf(m), dev = t.tags.filter(g => DEVICE_TAGS[g] || g === "d_filler" || g === "d_ending");
  let h = '<div class="ec-turn"' + (last ? ' id="ecLast"' : "") + '><div class="ec-row between"><small class="ec-sub">' + (i + 1) + '번째 대답 · ' + esc(short(t.q, 48)) + '</small>' + (last ? "" : btn("접기", "tFold", i, "ghost small")) + '</div>';
  h += '<div class="ec-said">' + esc(r.transcript) + '</div>';
  h += '<div class="ec-scores">' + scoreCell("발음", r.sc.pron) + scoreCell("억양", r.sc.inton) + scoreCell("유창성", r.sc.flu) + scoreCell("문법", r.sc.gram) + '</div>';
  h += '<div class="ec-kv">기기 측정 — 속도 ' + (wpm ? Math.round(wpm) + "단어/분" : "–") + ' · 멈춤 ' + m.pauses + '번' + (ppm != null ? " (분당 " + ppm.toFixed(0) + ")" : "") + ' · 높낮이 폭 ' + (m.st != null ? m.st.toFixed(1) + "반음 (" + pitchLabel(m.st) + ")" : "측정 안 됨") + '</div>';
  if (dev.length) h += '<div class="ec-row">' + dev.map(tagChip).join("") + '</div>';
  if (r.repeat) h += '<div class="ec-alert">' + esc(r.repeat) + '</div>';
  if (r.praise) h += '<h3>잘한 점</h3><p>' + esc(r.praise) + '</p>';
  if (r.focus) h += '<h3>다음에 고칠 한 가지</h3><p>' + esc(r.focus) + '</p>';
  if (r.gram.length) h += '<h3>문법·표현</h3>' + r.gram.map(g => '<div class="ec-fix"><del>' + esc(g.said) + '</del> → <b>' + esc(g.better) + '</b> ' + say(g.better) + '<div class="ec-sub">' + esc(g.why) + '</div>' + tagChip(g.tag) + '</div>').join("");
  if (r.pron.length) h += '<h3>발음</h3>' + r.pron.map(p => '<div class="ec-fix"><b>' + esc(p.word) + '</b> ' + say(p.word) + ' <span class="ec-sub">' + esc(p.heard) + '</span><div>' + esc(p.tip) + '</div>' + tagChip(p.tag) + '</div>').join("");
  if (r.inton || r.flu) h += '<h3>억양·유창성</h3><p>' + esc(r.inton) + ' ' + esc(r.flu) + '</p>';
  if (r.natural) h += '<h3>이렇게 말하면 자연스럽습니다</h3>' + natHtml(r.natural, r.sents) + '<p class="ec-sub">문장마다 따로 들을 수 있습니다. 이 답안은 「구문」의 「선생님 모범답안 모음」에 모입니다.</p>';
  if (r.chunks.length) h += '<h3>영어 어순으로 끊어 보기</h3>' + chunkHtml(r.chunks, false) + (r.order ? '<p class="ec-sub">' + esc(r.order) + '</p>' : "");
  else if (r.order) h += '<h3>어순</h3><p>' + esc(r.order) + '</p>';
  if (r.phrases.length) h += '<h3>외워 둘 구문</h3>' + r.phrases.map((p, j) => {
    const have = allPhrases().some(x => x.en.toLowerCase() === p.en.toLowerCase());
    return '<div class="ec-fix"><b>' + esc(p.en) + '</b> ' + say(p.en) + '<div class="ec-sub">' + esc(p.ko) + '</div>' + (have ? '<span class="ec-sub">구문에 담겨 있습니다 ✓</span>' : btn("내 구문에 담기", "tSave", i + "." + j, "ghost small")) + '</div>';
  }).join("");
  return h + '<div class="ec-kv">' + esc(t.model || "") + ' · AI 평가는 참고 의견입니다.</div></div>';
}
function chunkHtml(ch, koOnly) { return '<div class="ec-chunks">' + ch.map(c => '<span class="ec-chunk">' + (koOnly ? "" : '<b>' + esc(c.en) + '</b>') + '<i>' + esc(c.ko) + '</i></span>').join("") + '</div>'; }
function drawTalk() {
  const sc = D.SCENES[A.scene];
  if (A.phase === "end") return drawTalkEnd();
  let h = '<div class="ec-row between ec-talkhead"><span class="ec-sub">오늘 대화 ' + dayRec().st.talk + ' / ' + PLAN().talk + '번</span>' + (A.turns.length > 1 ? btn(A.allOpen ? "지난 대답 접기" : "지난 대답 펼치기", "tAll", null, "ghost small") : "") + '</div>';
  A.turns.forEach((t, i) => {
    const last = i === A.turns.length - 1;
    h += (last || A.allOpen || t.open) ? turnOpen(t, i, last)
      : '<button class="ec-fold" data-act="tFold" data-arg="' + i + '"><span>' + (i + 1) + '. ' + esc(short(t.r.transcript, 60)) + '</span><b class="' + sCls(avgOf(t.r.sc)) + '">' + r0(avgOf(t.r.sc)) + '</b></button>';
  });
  if (A.goal && !A.more && A.phase === "idle") {
    const ns = nextStep();
    return h + card(A.mission ? "미션을 마쳤습니다 ✓" : "오늘 대화 " + PLAN().talk + "번을 채웠습니다", '<p class="ec-sub">위에서 방금 대답의 고침을 확인하고 마치면 됩니다. 정한 횟수를 채웠으니 여기서 끝냅니다.</p><div class="ec-row">' +
      btn("대화 마치기", "tEnd") + (ns && ns !== "talk" ? btn("다음: " + STEP_NAME[ns], "tNext", null, "ghost") : "") + '</div><div class="ec-row end">' + btn("더 이야기하기", "tMore", null, "ghost small") + '</div>');
  }
  h += '<div class="ec-bub"><small>선생님</small>' + esc(A.q) + (A.qKo ? '<div class="ec-sub">' + esc(A.qKo) + '</div>' : "") + '<div>' + say(A.q, "다시 듣기", "teacher") + (A.hint ? ' ' + btn(A.hintOpen ? "힌트 닫기" : "어떻게 대답할지 힌트", "tHint", null, "ghost small") : "") + '</div>' +
    (A.hint && A.hintOpen ? '<div class="ec-nat"><p>' + esc(A.hint.en) + ' ' + say(A.hint.en, "듣기") + (A.hint.ko ? '<br><span class="ec-sub">' + esc(A.hint.ko) + '</span>' : "") + '</p><p class="ec-sub">이렇게 시작해도 좋습니다. 듣고 따라 말한 뒤, 내 이야기로 바꿔 보세요.</p></div>' : "") + '</div>';
  if (sc.script) h += '<div class="ec-task en ec-script">' + esc(A.script) + '</div>';
  let b = "";
  if (A.phase === "sending") b += '<p>선생님이 듣고 있습니다…</p>';
  else if (A.phase === "fail") b += '<p class="ec-sub">방금 녹음은 그대로 있습니다.</p><div class="ec-row">' + btn("방금 녹음 다시 보내기", "tResend") + btn("새로 녹음", "tDrop", null, "ghost") + '</div>';
  else b += recBtn("대답 녹음");
  b += noteHtml();
  if (A.turns.length && A.phase === "idle" && !REC.on) b += '<div class="ec-row end">' + btn("대화 마치기", "tEnd", null, "ghost small") + '</div>';
  return h + card("", b);
}
function drawTalkEnd() {
  const T = A.turns, cnt = {}; T.forEach(t => t.tags.forEach(g => { cnt[g] = (cnt[g] || 0) + 1; }));
  const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 5), f = k => avg(T.map(t => t.r.sc[k]));
  let h = '<p>대답 ' + T.length + '번을 했습니다.</p><div class="ec-scores">' + scoreCell("발음", f("pron")) + scoreCell("억양", f("inton")) + scoreCell("유창성", f("flu")) + scoreCell("문법", f("gram")) + '</div>';
  if (top.length) h += '<h3>이번 대화에서 나온 약점</h3><div class="ec-row">' + top.map(g => '<button class="ec-chip" data-act="tagOpen" data-arg="' + g + '">' + esc(D.TAGS[g].n) + ' ' + cnt[g] + '번</button>').join("") + '</div>';
  h += '<p class="ec-sub">고친 표현은 「다시 말하기」에서 한 번 더 말해야 내 것이 됩니다.</p><div class="ec-row">' + btn("다시 말하기로", "start", "retell") + btn("훈련 목록", "quit", "yes", "ghost") + '</div>';
  return card("대화를 마쳤습니다", h);
}

/* ---------- 다시 말하기 ---------- */
function retellQueue() {
  const d = today(); let c = DB.log.filter(r => r.k === "talk" && r.nat && r.sc !== "read" && dayNo(r.t) === d);
  if (!c.length) c = DB.log.filter(r => r.k === "talk" && r.nat && r.sc !== "read").slice(-5);
  const done = {}; DB.log.forEach(r => { if (r.k === "retell" && dayNo(r.t) === d) done[r.src] = 1; });
  return c.slice().sort((a, b) => (done[a.id] ? 1 : 0) - (done[b.id] ? 1 : 0) || (b.fx || []).length - (a.fx || []).length || b.t - a.t).slice(0, Math.max(3, PLAN().retell));
}
function startRetell() {
  if (!needKey()) return;
  const q = retellQueue();
  if (!q.length) { A = null; go("train"); setMsg("다시 말할 대답이 아직 없습니다. 먼저 「선생님과 대화」를 해 주세요.", true); return; }
  A = { type: "retell", title: "다시 말하기", queue: q, i: 0, phase: "study", pend: null, res: null, m: null };
  go("train");
}
function drawRetell() {
  const src = A.queue[A.i], head = '<div class="ec-prog"><span>' + (A.i + 1) + ' / ' + A.queue.length + '</span></div>' + (src.q ? '<p class="ec-sub">질문: ' + esc(src.q) + '</p>' : "");
  if (A.phase === "study") {
    let h = head + '<h3>처음 한 말</h3><div class="ec-said">' + esc(src.tx || "") + '</div>';
    if ((src.fx || []).length) h += '<h3>고칠 곳</h3>' + src.fx.map(f => '<div class="ec-fix"><del>' + esc(f.a) + '</del> → <b>' + esc(f.b) + '</b> ' + say(f.b) + '</div>').join("");
    h += '<h3>이렇게 말하면 자연스럽습니다</h3><div class="ec-nat">' + esc(src.nat) + ' ' + say(src.nat) + '</div>';
    if ((src.ch || []).length) h += '<h3>영어 어순으로 끊어 보기</h3>' + chunkHtml(src.ch, false);
    h += '<p class="ec-sub">소리 내어 두세 번 따라 읽은 뒤, 가리고 다시 말해 보세요. 똑같이 외울 필요는 없습니다.</p>' + btn("가리고 다시 말하기", "rHide", null, "wide");
    return card("", h);
  }
  if (A.phase === "hidden") {
    let h = head + ((src.ch || []).length ? '<p class="ec-sub">우리말 덩어리를 영어 순서대로 말해 보세요.</p>' + chunkHtml(src.ch, true) : '<p class="ec-sub">처음 한 말을 고쳐서 다시 말해 보세요.</p><div class="ec-said">' + esc(src.tx || "") + '</div>');
    h += recBtn("다시 말하기 녹음") + noteHtml() + (REC.on ? "" : '<div class="ec-row end">' + btn("다시 보기", "rShow", null, "ghost small") + '</div>');
    return card("", h);
  }
  if (A.phase === "sending") return card("", head + '<p>선생님이 듣고 있습니다…</p>' + noteHtml() + waitHtml());
  if (A.phase === "fail") return card("", head + noteHtml() + '<p class="ec-sub">방금 녹음은 그대로 있습니다.</p><div class="ec-row">' + btn("다시 보내기", "rResend") + btn("새로 녹음", "rHide", null, "ghost") + '</div>');
  /* 결과: 처음과 이번을 나란히 */
  const r = A.res, m0 = src.m || [], m1 = A.mp, s0 = src.s || [];
  const ppm = m => m && m[6] >= 5 ? m[2] / (m[6] / 60) : null;
  const row = (name, a, b, up, dig) => '<tr><td>' + name + '</td><td>' + (a == null ? "–" : a.toFixed(dig)) + '</td><td>' + (b == null ? "–" : b.toFixed(dig)) + '</td><td class="' + (a == null || b == null ? "" : ((b - a) * up >= 0 ? "s-good" : "s-bad")) + '">' + (a == null || b == null ? "" : (b >= a ? "+" : "") + (b - a).toFixed(dig)) + '</td></tr>';
  let h = head + '<div class="ec-said">' + esc(r.transcript) + '</div>';
  h += '<table class="ec-t"><tr><th></th><th>처음</th><th>이번</th><th>변화</th></tr>' + row("속도 (단어/분)", m0[5], m1[5], 1, 0) + row("분당 멈춤", ppm(m0), ppm(m1), -1, 1) + row("높낮이 폭 (반음)", m0[4], m1[4], 1, 1) +
    row("발음", s0[0], r.sc.pron, 1, 0) + row("억양", s0[1], r.sc.inton, 1, 0) + row("유창성", s0[2], r.sc.flu, 1, 0) + row("문법", s0[3], r.sc.gram, 1, 0) + '</table>';
  if (r.covered != null) h += '<div class="ec-kv">전하려던 내용의 ' + r.covered + '%를 말했습니다.</div>';
  if (r.cheer) h += '<div class="ec-alert good">' + esc(r.cheer) + '</div>';
  if (r.fixed) h += '<h3>고쳐진 것</h3><p>' + esc(r.fixed) + '</p>';
  if (r.left.length) h += '<h3>아직 남은 것</h3>' + r.left.map(g => '<div class="ec-fix"><del>' + esc(g.said) + '</del> → <b>' + esc(g.better) + '</b> ' + say(g.better) + '<div class="ec-sub">' + esc(g.why) + '</div>' + tagChip(g.tag) + '</div>').join("");
  if (r.pron.length) h += '<h3>발음</h3>' + r.pron.map(p => '<div class="ec-fix"><b>' + esc(p.word) + '</b> ' + say(p.word) + '<div>' + esc(p.tip) + '</div>' + tagChip(p.tag) + '</div>').join("");
  h += '<div class="ec-row">' + btn("한 번 더", "rAgain", null, "ghost") + (A.i + 1 < A.queue.length ? btn("다음 대답 →", "rNext") : nextBtn()) + '</div><div class="ec-kv">AI 평가는 참고 의견입니다.</div>';
  return card("", h);
}
function retellRec() {
  recStart(90, (pcm, m) => {
    if (m.speech < 0.5) { render(); setMsg("소리가 잡히지 않았습니다. 다시 녹음해 주세요.", true); return; }
    A.pend = clipOf(pcm, m); retellSend();
  });
}
function retellSend() {
  const me = A, p = me.pend, src = me.queue[me.i]; if (!p) return;
  me.phase = "sending"; me.quitAsk = false; me.failMsg = ""; pendSave(); setMsg(""); render();
  const text = ["MODE: retell", "QUESTION: " + (src.q || ""), "FIRST ATTEMPT: " + (src.tx || ""), "TARGET: " + src.nat, profileText(), metricsText(p.m), "The attached audio is his second attempt."].join("\n\n");
  gCall({ sys: sysFor("retell"), temp: 0.3, parts: [{ text }, { inlineData: { mimeType: "audio/wav", data: p.b64 } }] }, s => { if (A === me) setMsg(s); }, (r, model) => {
    if (A !== me) return;
    const c = cleanRetell(r);
    if (!c.transcript) { me.pend = null; me.phase = "hidden"; pendSave(); if (U.tab !== "train") U.flash = { text: me.title + ": 말소리를 알아듣지 못했다고 합니다." }; render(); setMsg("선생님이 말소리를 알아듣지 못했다고 합니다. 다시 녹음해 주세요.", true); return; }
    const words = wc(c.transcript), tags = tagsOf(c, p.m, words, false);
    me.mp = mPack(p.m, words);
    logAdd({ k: "retell", src: src.id, tx: c.transcript.slice(0, 900), cov: c.covered, s: [c.sc.pron, c.sc.inton, c.sc.flu, c.sc.gram], m: me.mp, tags, fx: c.left.map(g => fxOf(g)), pr: c.pron.map(x => ({ w: x.word, g: x.tag })), md: model });
    const day = dayRec(); day.st.retell++; day.said += sentences(c.transcript); daySave();
    me.res = c; me.pend = null; me.phase = "done";
    if (arrived("다시 말하기 채점이 끝났습니다.")) window.scrollTo(0, 0);
  }, (why, kind) => { if (A === me) failed(me, why, kind); });
}

/* ---------- 레벨 테스트 ---------- */
const TEST_NAME = { read: "① 낭독", daily: "② 일상 질문", story: "③ 경험 이야기", explain: "④ 설명·의견" };
const TEST_HOW = { read: "아래 글을 평소 말하듯 자연스럽게 읽어 주세요.", daily: "30초에서 1분쯤, 준비 없이 바로 대답해 주세요.", story: "지난 일을 순서대로, 30초에서 1분쯤 이야기해 주세요.", explain: "이유를 들어 30초에서 1분쯤 설명해 주세요." };
function startTest() {
  if (!needKey()) return;
  const set = tests().length % 4;
  A = { type: "test", title: "레벨 테스트", set, i: 0, phase: "intro", tasks: ["read", "daily", "story", "explain"].map(k => ({ k, prompt: D.TEST[k][set % D.TEST[k].length], clip: null, res: null })), out: null };
  go("train");
}
function drawTest() {
  if (A.phase === "intro") return card("", '<p>과제 네 개로 지금 수준을 잽니다. 약 6분, 채점 요청은 4번 씁니다.</p><ul class="ec-ul"><li>조용한 곳에서, 준비하거나 받아 적지 말고 평소처럼 말해 주세요.</li><li>같은 조건으로 반복해야 변화가 보입니다. 일주일에 한 번을 권합니다.</li><li>속도·멈춤·높낮이는 기기가 직접 재고, 발음·문법은 채점 기준표를 준 AI가 봅니다. 공인 시험이 아닌 참고 등급입니다.</li></ul>' + btn("시작", "xBegin", null, "wide"));
  if (A.phase === "done") return drawTestDone();
  if (A.phase === "sending") return card("", '<p>채점하고 있습니다. 과제마다 20초에서 1분쯤 걸립니다. 다른 화면에 다녀와도 계속됩니다.</p>' + noteHtml() + waitHtml());
  if (A.phase === "fail") return card("", noteHtml() + '<p class="ec-sub">녹음은 그대로 있습니다.</p><div class="ec-row">' + btn("이어서 채점", "xSend") + (A.redo != null ? btn(TEST_NAME[A.tasks[A.redo].k] + " 다시 녹음", "xRedoTask", null, "ghost") : "") + '</div>');
  const t = A.tasks[A.i], shown = A.phase === "shown";
  let h = '<div class="ec-prog"><span>' + (A.i + 1) + ' / ' + A.tasks.length + '</span><div class="ec-bar"><i style="width:' + Math.round((A.i + (shown ? 1 : 0)) / A.tasks.length * 100) + '%"></i></div></div>';
  h += '<h3>' + TEST_NAME[t.k] + '</h3><p class="ec-sub">' + TEST_HOW[t.k] + '</p><div class="ec-task en">' + esc(t.prompt) + (t.k === "read" ? "" : ' ' + say(t.prompt)) + '</div>';
  if (shown) h += '<div class="ec-kv">녹음 ' + t.clip.m.speech.toFixed(0) + '초 (말한 시간)</div><div class="ec-row">' + btn("다시 녹음", "xRedo", null, "ghost") + btn(A.tasks.some(x => !x.clip) ? "다음 과제 →" : "채점 보내기", "xNext") + '</div>';
  else h += recBtn();
  return card("", h + noteHtml());
}
function testRec() {
  const t = A.tasks[A.i];
  recStart(t.k === "read" ? 100 : 80, (pcm, m) => {
    if (m.speech < 5) { render(); setMsg("너무 짧습니다. 5초 이상 말해 주세요.", true); return; }
    t.clip = clipOf(pcm, m); t.res = null; A.phase = "shown"; pendSave(); setMsg(""); render();
  });
}
function testSend() {
  const me = A; me.phase = "sending"; me.quitAsk = false; me.redo = null; me.failMsg = ""; U.note = null; pendSave(); render();
  const step = () => {
    if (A !== me) return;
    const i = me.tasks.findIndex(t => !t.res);
    if (i < 0) { testFinish(); return; }
    const t = me.tasks[i]; setMsg("채점 중 " + (i + 1) + " / " + me.tasks.length + "…");
    const text = ["MODE: test", "TASK TYPE: " + t.k, (t.k === "read" ? "PASSAGE he was asked to read aloud: " : "QUESTION he was asked: ") + t.prompt, metricsText(t.clip.m)].join("\n\n");
    gCall({ sys: sysFor("test"), temp: 0, parts: [{ text }, { inlineData: { mimeType: "audio/wav", data: t.clip.b64 } }] }, s => { if (A === me) setMsg(s); }, (r, model) => {
      if (A !== me) return;
      const c = cleanTest(r);
      if (!c.transcript || c.sc.pron == null) { me.redo = i; failed(me, TEST_NAME[t.k] + " 녹음에서 말소리를 알아듣지 못했다고 합니다. 그 과제만 다시 녹음해 주세요.", "other"); return; }
      t.res = c; t.model = model; pendSave(); step();
    }, (why, kind) => { if (A === me) failed(me, why, kind); });
  };
  step();
}
function testFinish() {
  const T = A.tasks, calc = T.map(t => ({ k: t.k, m: t.clip.m, words: wc(t.res.transcript), sc: t.res.sc })), out = testScore(calc);
  let tags = [], fx = [], pr = [];
  T.forEach((t, i) => { tags = tags.concat(tagsOf(t.res, t.clip.m, calc[i].words, t.k === "read")); fx = fx.concat(t.res.gram.map(g => fxOf(g))); pr = pr.concat(t.res.pron.map(x => ({ w: x.word, g: x.tag }))); });
  const prev = tests().slice(-1)[0] || null;
  logAdd({ k: "test", score: out.total, lv: out.level, parts: out.parts, set: A.set, tags: uniq(tags), fx: fx.slice(0, 8), pr: pr.slice(0, 8), md: T[0].model,
    tasks: T.map((t, i) => ({ k: t.k, tx: t.res.transcript.slice(0, 600), s: [t.res.sc.pron, t.res.sc.inton, t.res.sc.gram, t.res.sc.vocab, t.res.sc.task], m: mPack(t.clip.m, calc[i].words), c: t.res.comment.slice(0, 300), nat: (t.res.natural || "").slice(0, 900), ns: (t.res.sents || []).map(x => ({ en: x.en, ko: x.ko })) })) });
  const day = dayRec(); T.forEach(t => { day.said += sentences(t.res.transcript); }); daySave();
  A.out = out; A.prev = prev; A.tags = uniq(tags); A.phase = "done";
  if (arrived("레벨 테스트 채점이 끝났습니다.")) window.scrollTo(0, 0);
}
const PART_NAME = { pron: "발음 25%", inton: "억양 15%", flu: "유창성 20%", gram: "문법 20%", vocab: "표현 10%", task: "과제 수행 10%" };
function drawTestDone() {
  const o = A.out, L = levelOf(o.total), N = nextLevel(o.total);
  let h = '<div class="ec-level"><b>' + L.id + '</b><div><div class="ec-lvs">' + (o.total == null ? "–" : o.total.toFixed(1)) + '점' + (A.prev ? ' <span class="' + (o.total >= A.prev.score ? "s-good" : "s-bad") + '">(지난번보다 ' + (o.total >= A.prev.score ? "+" : "") + (o.total - A.prev.score).toFixed(1) + ')</span>' : "") + '</div><div class="ec-sub">' + esc(L.d) + '</div></div></div>';
  if (A.prev && o.total > A.prev.score && levelOf(A.prev.score).id !== L.id) h += '<div class="ec-alert good">등급이 올랐습니다: ' + levelOf(A.prev.score).id + ' → ' + L.id + '</div>';
  if (N) h += '<div class="ec-sub">다음 등급 ' + N.id + '까지 ' + (N.min - o.total).toFixed(1) + '점</div>';
  h += '<div class="ec-scores">' + Object.keys(PART_NAME).map(k => scoreCell(PART_NAME[k], o.parts[k])).join("") + '</div>';
  h += '<div class="ec-kv">유창성은 기기 측정(속도·멈춤)만으로, 억양은 기기 측정과 AI 점수의 평균으로 계산했습니다.</div>';
  if (A.tags.length) h += '<h3>이번 테스트에서 나온 약점</h3><div class="ec-row">' + A.tags.map(tagChip).join("") + '</div>';
  A.tasks.forEach(t => {
    const w = wpmOf(t.clip.m, wc(t.res.transcript)), pp = ppmOf(t.clip.m);
    h += '<h3>' + TEST_NAME[t.k] + '</h3><div class="ec-kv">속도 ' + (w ? Math.round(w) + "단어/분" : "–") + ' · 분당 멈춤 ' + (pp != null ? pp.toFixed(0) : "–") + ' · 높낮이 폭 ' + (t.clip.m.st != null ? t.clip.m.st.toFixed(1) + "반음" : "–") + '</div><p>' + esc(t.res.comment) + '</p><div class="ec-said small">' + esc(t.res.transcript) + '</div>' + (t.res.natural ? '<p class="ec-sub">이렇게 말하면 자연스럽습니다</p>' + natHtml(t.res.natural, t.res.sents) : "");
  });
  h += '<div class="ec-msg">공인 시험이 아닌 참고 등급입니다. 같은 조건에서 반복해 변화를 보는 데 씁니다.</div><div class="ec-row">' + btn("홈으로", "xHome") + btn("기록 보기", "xRec", null, "ghost") + '</div>';
  return card("레벨 테스트 결과", h);
}

/* ---------- 약점 ---------- */
const TREND = { down: "줄어듦", up: "늘어남", same: "비슷", new: "새로 나타남", quiet: "최근 없음", "": "" };
function drawWeak() {
  if (U.tagSel) return drawTagDetail(U.tagSel);
  if (U.ordSel) return drawOrderDetail(U.ordSel);
  const S = tagStats(), focus = focusTags(), seen = S.list.filter(s => s.tot > 0), zero = S.list.filter(s => !s.tot);
  const line = s => {
    const T = D.TAGS[s.g], badge = s.grad ? '<em class="ec-badge good">졸업</em>' : (focus.indexOf(s.g) >= 0 ? '<em class="ec-badge bad">집중</em>' : "");
    return '<button class="ec-item" data-act="tagOpen" data-arg="' + s.g + '"><b>' + esc(T.n) + ' ' + badge + '</b><small>' + (s.tot ? "최근 2주 " + s.r + "번 · 그 전 2주 " + s.p + "번 · " + TREND[s.trend] + " · 누적 " + s.tot + "번" : "아직 나오지 않음") + '</small></button>';
  };
  let h = card("내 약점 지도", '<p class="ec-sub">모든 대답과 훈련을 같은 분류표로 세어 둡니다. 최근 2주에 대답 ' + S.aR + '개' + (S.aP ? ", 그 전 2주에 " + S.aP + "개" : "") + '를 분석했습니다. 세 번 넘게 나왔던 약점이 최근 대답 10개에서 사라지면 「졸업」입니다.</p>' +
    (seen.length ? seen.map(line).join("") : '<div class="ec-msg">아직 기록이 없습니다. 대화를 하면 여기에 쌓입니다. 그때까지는 기본 추천 세 가지로 훈련합니다.</div>' + focus.map(g => line({ g, tot: 0 })).join("")) +
    (zero.length && seen.length ? '<div class="ec-row end">' + btn(U.showZero ? "나머지 접기" : "아직 나오지 않은 항목 " + zero.length + "개 보기", "tagMore", null, "ghost small") + '</div>' + (U.showZero ? zero.map(line).join("") : "") : ""));
  h += card("영어 어순 원칙 일곱 가지", '<p class="ec-sub">한국어 순서로 떠올린 생각을 영어 순서로 내보내는 원칙입니다. 하나씩 눌러 훈련하세요.</p>' + D.ORDER.map((o, i) => '<button class="ec-item" data-act="ordOpen" data-arg="' + o.id + '"><b>' + (i + 1) + '. ' + esc(o.t) + '</b><small>' + esc(o.ex.en) + '</small></button>').join(""));
  return h;
}
const backLabel = () => U.back && U.back.tab !== "weak" ? "← 보던 화면으로" : "← 약점 목록";
function drawTagDetail(g) {
  const T = D.TAGS[g], S = tagStats().list.filter(s => s.g === g)[0], bad = mistakesOf(g, 6);
  let h = '<div class="ec-row">' + btn(backLabel(), "tagBack", null, "ghost small") + '</div>';
  let b = '<p class="ec-sub">' + (S.tot ? "최근 2주 " + S.r + "번 · 그 전 2주 " + S.p + "번 · 누적 " + S.tot + "번" + (S.grad ? " · 졸업" : "") : "아직 기록 없음") + '</p><h3>왜 틀리나</h3><p>' + esc(T.why) + '</p><h3>이렇게 고칩니다</h3><p>' + esc(T.fix) + '</p>';
  if (T.ex) b += '<h3>바른 예</h3>' + T.ex.map(e => '<div class="ec-fix"><b>' + esc(e) + '</b> ' + say(e) + '</div>').join("");
  if (bad.length) b += '<h3>내가 실제로 틀린 말</h3>' + bad.map(x => '<div class="ec-fix"><del>' + esc(x.a) + '</del>' + (x.b ? ' → <b>' + esc(x.b) + '</b> ' + say(x.b) : "") + '<div class="ec-sub">' + stamp(x.t).slice(5, 10) + '</div></div>').join("");
  b += '<h3>훈련 문장 ' + T.dr.length + '개</h3>' + T.dr.map(q => '<div class="ec-fix">' + (T.k === "g" ? esc(q.ko) + '<div><b>' + esc(q.en) + '</b> ' + say(q.en) + '</div>' : '<b>' + esc(q.en) + '</b> ' + say(q.en) + '<div class="ec-sub">' + esc(q.ko) + '</div>') + '</div>').join("");
  b += btn("이 약점 훈련 시작 (" + T.dr.length + "문장)", "tagDrill", g, "wide");
  return h + card(esc(T.n), b);
}
function drawOrderDetail(id) {
  const o = D.ORDER.filter(x => x.id === id)[0];
  let b = '<p>' + esc(o.d) + '</p><div class="ec-answer"><small>' + esc(o.ex.ko) + '</small>' + esc(o.ex.en) + ' ' + say(o.ex.en) + '</div><h3>훈련 문장</h3>' +
    o.dr.map(q => '<div class="ec-fix">' + esc(q.ko) + '<div><b>' + esc(q.en) + '</b> ' + say(q.en) + '</div></div>').join("") + btn("이 원칙 훈련 시작 (" + o.dr.length + "문장)", "ordDrill", id, "wide");
  return '<div class="ec-row">' + btn(backLabel(), "tagBack", null, "ghost small") + '</div>' + card(esc(o.t), b);
}

/* ---------- 구문 ---------- */
function drawPhrases() {
  const all = allPhrases(), cnt = { new: 0, learning: 0, known: 0 }; all.forEach(p => { cnt[phraseState(p.id)]++; });
  const due = dueList().length, cats = [["all", "전체"]].concat(basicList().length ? [["basic", "기초"]] : [], Object.keys(D.CATS).filter(c => stdList().some(p => p.c === c)).map(c => [c, D.CATS[c]]), [["my", "내 구문"]]);
  let h = card("구문", '<div class="ec-scores">' + statCell("익힘", cnt.known) + statCell("연습 중", cnt.learning) + statCell("새 구문", cnt.new) + '</div><p class="ec-sub">문장을 만들지 말고 덩어리째 꺼내 쓰는 연습입니다. 맞히면 1·3·7·14·30·60일 뒤에 다시 묻고, 네 번 이어 맞히면 「익힘」입니다.</p>' +
    btn(due ? "오늘 복습 시작 (복습할 것 " + due + "개)" : "새 구문 익히기", "start", "phr", "wide"));
  const fx = fixList();
  const cu = pickCumul(20);
  h += card("누적 암송 (오늘 + 어제)", '<p class="ec-sub">오늘 익힌 문장에 어제 익힌 문장을 얹어, 우리말만 보고 이어서 말해 봅니다. 정답은 채점한 뒤에 나옵니다. 자기 전에 한 번 하면 좋습니다. 복습 간격은 바뀌지 않습니다.</p>' +
    btn(cu.length ? "누적 암송 시작 (" + cu.length + "문장)" : "오늘·어제 익힌 문장이 아직 없습니다", "cumGo", null, cu.length ? "" : "ghost"));
  h += card("틀렸던 문장 다시 말하기", '<p class="ec-sub">대화·다시 말하기·레벨 테스트에서 선생님이 고쳐 준 문장은 자동으로 내 구문에 담깁니다. 처음 두 번은 듣고 따라 말하고, 그다음부터는 우리말 뜻을 보고 말합니다. 전에 틀렸던 말은 채점한 뒤에 보여 줍니다. 입에 붙을 때까지 1·3·7·14·30·60일 간격으로 다시 나옵니다.</p>' +
    '<div class="ec-row">' + btn(fx.length ? "틀렸던 문장 훈련 (" + fx.length + "개 중 " + Math.min(8, fx.length) + "개)" : "아직 고친 문장이 없습니다", "fixGo", null, fx.length ? "" : "ghost") + btn("지난 기록에서 모으기", "fixScan", null, "ghost small") + '</div>' + msgBox(U.fixMsg));
  h += card("이어 듣기 · 따라 말하기", loopCard());
  h += card("선생님 모범답안 모음", natCard());
  const list = all.filter(p => U.phCat === "all" || p.c === U.phCat);
  h += '<section class="ec-card"><div class="ec-cats">' + cats.map(c => '<button class="ec-cat" data-act="phCat" data-arg="' + c[0] + '" aria-pressed="' + (U.phCat === c[0]) + '">' + esc(c[1]) + ' ' + (c[0] === "all" ? all.length : all.filter(p => p.c === c[0]).length) + '</button>').join("") + '</div>' +
    (list.length ? list.map(p => {
      const st = phraseState(p.id), s = DB.srs[p.id];
      return '<div class="ec-ph"><div><b>' + esc(p.en) + '</b> ' + say(p.en) + '</div><div class="ec-sub">' + esc(p.ko) + '</div><div class="ec-row"><em class="ec-badge ' + (st === "known" ? "good" : "") + '">' + (st === "known" ? "익힘" : (st === "learning" ? "연습 중 · 다음 복습 " + dueText(s) : "새 구문")) + '</em>' +
        (p.c === "my" ? btn(U.delAsk === p.id ? "정말 뺄까요? 한 번 더" : "빼기", "phDel", p.id, "ghost small") : "") + '</div></div>';
    }).join("") : '<div class="ec-msg">' + (U.phCat === "my" ? "아직 담은 구문이 없습니다. 대화 피드백의 「내 구문에 담기」나 위 칸으로 담을 수 있습니다." : "구문이 없습니다.") + '</div>') + '</section>';
  return h;
}

/* ---------- 기록 ---------- */
function levelChart(ts) {
  const W = 320, H = 150, L = 34, R = 10, T = 8, B = 18, y = v => T + (100 - clamp(v, 40, 100)) / 60 * (H - T - B), n = ts.length, x = i => n === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (n - 1);
  let s = '<svg class="ec-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="레벨 테스트 점수 변화">';
  LEVELS.slice(1).forEach(v => { s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v.min) + '" y2="' + y(v.min) + '"/><text class="lab" x="2" y="' + (y(v.min) + 3) + '">' + v.id + '</text>'; });
  if (n > 1) s += '<polyline class="ln" points="' + ts.map((t, i) => x(i).toFixed(1) + "," + y(t.score).toFixed(1)).join(" ") + '"/>';
  ts.forEach((t, i) => { s += '<circle class="pt" cx="' + x(i).toFixed(1) + '" cy="' + y(t.score).toFixed(1) + '" r="3.5"/>'; if (i === 0 || i === n - 1) s += '<text class="lab" text-anchor="' + (i === 0 && n > 1 ? "start" : "end") + '" x="' + (i === 0 && n > 1 ? L : W - R) + '" y="' + (H - 4) + '">' + dayLabel(dayNo(t.t)) + '</text>'; });
  return s + '</svg>';
}
function minutesChart() {
  const d = today(), W = 320, H = 110, L = 6, B = 16, T = 6, goal = DB.set.minutes, days = []; for (let i = 13; i >= 0; i--) days.push(d - i);
  const mx = Math.max(goal * 1.2, ...days.map(x => (DB.day[x] ? DB.day[x].sec : 0) / 60)), bw = (W - L * 2) / 14, y = v => T + (1 - v / mx) * (H - T - B);
  let s = '<svg class="ec-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="최근 14일 연습 시간">';
  days.forEach((x, i) => { const v = (DB.day[x] ? DB.day[x].sec : 0) / 60; s += '<rect class="' + (v >= goal ? "bar full" : "bar") + '" x="' + (L + i * bw + 2).toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + (bw - 4).toFixed(1) + '" height="' + Math.max(0, H - B - y(v)).toFixed(1) + '" rx="2"/>'; if (i % 2 === 1) s += '<text class="lab" text-anchor="middle" x="' + (L + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 4) + '">' + dayLabel(x) + '</text>'; });
  return s + '<line class="goal" x1="' + L + '" x2="' + (W - L) + '" y1="' + y(goal) + '" y2="' + y(goal) + '"/></svg>';
}
function recSummary(r) {
  if (r.k === "talk" || r.k === "retell") return "평균 " + r0(avg(r.s || [])) + " · " + esc(short(r.tx || "", 40));
  if (r.k === "phr" || r.k === "dr") return r.ok + " / " + r.n + " 맞음";
  if (r.k === "test") return r.lv + " · " + (r.score == null ? "–" : r.score.toFixed(1)) + "점";
  if (r.k === "listen") return esc(r.title || "") + (r.qn ? " · 질문 " + r.qk + " / " + r.qn : "") + (r.dn ? " · 받아쓰기 " + r.dk + " / " + r.dn + " 낱말" : "");
  return esc(r.title || "") + " · 평균 " + r0(avg(r.s || []));
}
function recDetail(r) {
  let h = "";
  if (r.k === "talk" || r.k === "retell") {
    const s = r.s || [], m = r.m || [];
    h += (r.q ? '<p class="ec-sub">질문: ' + esc(r.q) + '</p>' : "") + '<div class="ec-said small">' + esc(r.tx || "(글은 저장 공간을 위해 덜어 냈습니다)") + '</div><div class="ec-scores">' + scoreCell("발음", s[0]) + scoreCell("억양", s[1]) + scoreCell("유창성", s[2]) + scoreCell("문법", s[3]) + '</div>';
    h += '<div class="ec-kv">속도 ' + (m[5] != null ? m[5] + "단어/분" : "–") + ' · 멈춤 ' + (m[2] != null ? m[2] + "번" : "–") + ' · 높낮이 폭 ' + (m[4] != null ? m[4] + "반음" : "–") + '</div>';
    if (r.nat) h += '<h3>자연스러운 표현</h3>' + natHtml(r.nat, r.ns);
    if ((r.fx || []).length) h += r.fx.map(f => '<div class="ec-fix"><del>' + esc(f.a) + '</del> → <b>' + esc(f.b) + '</b></div>').join("");
  } else if (r.k === "phr" || r.k === "dr") {
    h += (r.it || []).map(x => { const it = itemByRef(x[0]); return '<div class="ec-fix"><b>' + (x[1] ? "✓" : "✗") + '</b> ' + esc(it ? it.en : x[0]) + (x[4] ? '<div class="ec-sub">들린 말: ' + esc(x[4]) + '</div>' : "") + '</div>'; }).join("");
  } else if (r.k === "listen") {
    h += '<p class="ec-sub">' + esc(r.topic || "") + ' · 문장 ' + (r.n || 0) + '개' + (r.dn ? ' · 받아쓰기에서 들은 낱말 ' + r.dk + ' / ' + r.dn : "") + '</p>' + (r.tx ? '<div class="ec-said small">' + esc(r.tx) + '</div>' : "");
  } else if (r.k === "test") {
    h += '<div class="ec-scores">' + Object.keys(PART_NAME).map(k => scoreCell(PART_NAME[k], (r.parts || {})[k])).join("") + '</div>' + (r.tasks || []).map(t => '<h3>' + TEST_NAME[t.k] + '</h3><p class="ec-sub">' + esc(t.c || "") + '</p><div class="ec-said small">' + esc(t.tx || "") + '</div>' + (t.nat ? '<p class="ec-sub">이렇게 말하면 자연스럽습니다</p>' + natHtml(t.nat, t.ns) : "")).join("");
  } else {
    const s = r.s || [];
    h += '<div class="ec-scores">' + scoreCell("발음", s[0]) + scoreCell("억양", s[1]) + scoreCell("유창성", s[2]) + scoreCell("문법", s[3]) + '</div><div class="ec-kv">이전 버전에서 옮겨 온 기록입니다.</div>';
  }
  if ((r.tags || []).length) h += '<div class="ec-row">' + r.tags.map(tagChip).join("") + '</div>';
  return h;
}
function drawRecords() {
  const ts = tests(), days = Object.keys(DB.day).filter(d => DB.day[d].sec >= 60).length, said = Object.keys(DB.day).reduce((s, d) => s + (DB.day[d].said || 0), 0);
  let h = card("쌓인 것", '<div class="ec-scores">' + statCell("누적 시간", hm(totalSec())) + statCell("연습한 날", days + "일") + statCell("말한 문장", said + "개") + statCell("연속", streak() + "일") + '</div>');
  if (fbReady() && AUTH.uid) h += card("함께 하는 사람들", boardHtml());
  h += card("최근 12주 출석", attendHtml());
  h += card("배지", badgeHtml());
  h += card("참고 등급 변화", ts.length ? levelChart(ts) + '<p class="ec-sub">테스트 ' + ts.length + '번. 점선은 등급 경계입니다.</p>' : '<div class="ec-msg">레벨 테스트를 하면 여기에 변화가 그려집니다.</div>' + btn("레벨 테스트 시작", "start", "test", "ghost"));
  h += card("최근 14일 연습 시간", minutesChart() + '<p class="ec-sub">가로선이 하루 목표 ' + DB.set.minutes + '분입니다.</p>');
  const log = DB.log.slice().reverse(), show = log.slice(0, U.logN);
  if (U.unseenMsg) h = msgBox(U.unseenMsg) + h;
  h += card("연습 기록 " + log.length + "개", (show.length ? show.map(r => '<button class="ec-fold" data-act="logOpen" data-arg="' + esc(r.id) + '"><span><small>' + stamp(r.t).slice(5) + ' · ' + (KIND[r.k] || "기록") + '</small>' + recSummary(r) + '</span></button>' + (U.logOpen === r.id ? '<div class="ec-turn">' + recDetail(r) + '</div>' : "")).join("") : '<div class="ec-msg">아직 기록이 없습니다.</div>') +
    (log.length > U.logN ? '<div class="ec-row end">' + btn("더 보기", "logMore", null, "ghost small") + '</div>' : ""));
  h += card("Claude에게 코칭받기", '<p class="ec-sub">최근 2주 요약을 복사해 Claude 대화에 붙여 넣으면 더 깊은 코칭을 받을 수 있습니다. 내가 한 영어 문장이 들어갑니다.</p>' + btn("요약 복사", "repCopy", null, "ghost") + msgBox(U.repMsg) + copyArea("repMsg"));
  h += card("백업", '<p class="ec-sub">기록은 이 기기의 이 브라우저에만 있습니다. 가끔 백업을 받아 두세요. 가져오기는 지우지 않고 합치기만 합니다. 이용 키는 백업에 들어가지 않습니다.</p><div class="ec-row">' + btn("백업 파일 받기", "bkDown") + btn("백업 글 복사", "bkCopy", null, "ghost") + '</div>' +
    '<label for="ecBkFile">백업 파일 가져오기</label><input type="file" id="ecBkFile" data-chg="bkFile" accept=".json,application/json,text/plain"><label for="ecBkText">또는 백업 글 붙여 넣기</label><textarea id="ecBkText" data-bind="bk" placeholder="백업 글을 여기에 붙여 넣으세요">' + esc(U.f.bk) + '</textarea><div class="ec-row">' + btn("붙여 넣은 글 합치기", "bkPaste", null, "ghost") + '</div>' + msgBox(U.bkMsg) + copyArea("bkMsg"));
  return h;
}
function coachReport() {
  const d = today(), S = tagStats(), ts = tests(), last = ts[ts.length - 1], rec = DB.log.filter(r => r.k === "talk" && dayNo(r.t) > d - 14), L = [];
  let sec = 0; for (let i = 0; i < 14; i++) sec += DB.day[d - i] ? DB.day[d - i].sec : 0;
  L.push("[영어 말하기 코치 — 최근 2주 요약 " + stamp(now()).slice(0, 10) + "]");
  L.push("연습 시간: " + hm(sec) + " (하루 목표 " + DB.set.minutes + "분), 연속 " + streak() + "일, 누적 " + hm(totalSec()));
  L.push("참고 등급: " + (last ? last.lv + " " + last.score.toFixed(1) + "점 (" + stamp(last.t).slice(0, 10) + ") — 발음 " + r0(last.parts.pron) + ", 억양 " + r0(last.parts.inton) + ", 유창성 " + r0(last.parts.flu) + ", 문법 " + r0(last.parts.gram) + ", 표현 " + r0(last.parts.vocab) : "아직 테스트 전"));
  if (rec.length) L.push("대화 대답 " + rec.length + "개 평균: 속도 " + r0(avg(rec.map(r => r.m[5]))) + "단어/분, 대답당 멈춤 " + r1(avg(rec.map(r => r.m[2]))) + "번, 높낮이 폭 " + r1(avg(rec.map(r => r.m[4]))) + "반음");
  const top = S.list.filter(s => s.r > 0).slice(0, 6);
  L.push("자주 나온 약점: " + (top.length ? top.map(s => D.TAGS[s.g].n + " " + s.r + "번(" + TREND[s.trend] + ")").join(", ") : "기록 없음"));
  const fx = []; for (let i = DB.log.length - 1; i >= 0 && fx.length < 8; i--) (DB.log[i].fx || []).forEach(f => { if (fx.length < 8 && !sameSay(f.a, f.b)) fx.push("- " + f.a + " → " + f.b + " [" + (D.TAGS[f.g] ? D.TAGS[f.g].n : "") + "]"); });
  if (fx.length) L.push("최근 틀린 말:\n" + fx.join("\n"));
  const cnt = { new: 0, learning: 0, known: 0 }; allPhrases().forEach(p => { cnt[phraseState(p.id)]++; });
  L.push("구문: 익힘 " + cnt.known + ", 연습 중 " + cnt.learning + ", 새 구문 " + cnt.new);
  L.push("이 기록을 보고, 지금 가장 먼저 고칠 것과 이번 주 연습 방법을 코칭해 주세요.");
  return L.join("\n");
}
const copyArea = key => U.copy && U.copy.key === key ? '<textarea id="ecCopyArea" readonly>' + esc(U.copy.text) + '</textarea>' : "";
function copyText(text, okMsg, key) {
  const fallback = () => { U.copy = { key, text }; U[key] = { text: "자동 복사가 막혀 있습니다. 아래 글을 길게 눌러 전체 선택한 뒤 복사해 주세요." }; render(); const a = $("ecCopyArea"); if (a) { a.focus(); a.select(); } };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { U.copy = null; U[key] = { text: okMsg }; render(); }, fallback);
    else fallback();
  } catch (e) { fallback(); }
}
function mergeText(text) {
  let o = null; try { o = JSON.parse(String(text || "").trim()); } catch (e) {}
  const out = o ? backupMerge(o) : null;
  if (!out) { U.bkMsg = { text: "백업 글을 읽지 못했습니다. 이 앱에서 받은 백업인지 확인해 주세요. 기존 기록은 그대로입니다.", err: true }; render(); return; }
  U.f.bk = ""; U.bkMsg = { text: "합쳤습니다. 기록 +" + out.log + "개, 구문 상태 " + out.srs + "개 갱신, 내 구문 +" + out.my + "개, 날짜 " + out.day + "일 반영. 지운 것은 없습니다." }; render();
}

/* ---------- 설정 ---------- */
function drawXi() {
  let h = '<hr class="ec-hr"><h3 class="ec-h3">더 자연스러운 목소리 (ElevenLabs, 선택)</h3><p class="ec-sub">elevenlabs.io 에서 만든 API 키를 넣으면 원어민 성우 목소리로 읽어 줍니다. 키는 기록·백업 파일에는 들어가지 않고, 구글로 로그인하면 계정 저장소에 함께 두어 다른 기기에서도 자동으로 채워집니다. 한 번 읽은 문장은 기기에 저장해 두어 다시 들을 때는 크레딧이 들지 않습니다.</p>';
  if (!XI.key) return h + '<label for="ecXiKey">ElevenLabs API 키</label><input type="password" id="ecXiKey" data-bind="xiKey" value="' + esc(U.f.xiKey || "") + '" placeholder="sk_…" autocomplete="off">' +
    '<div class="ec-row">' + btn("저장하고 목소리 고르기", "xiSave") + '</div>' + msgBox(U.xiMsg);
  h += '<label for="ecXiVoice">선생님 목소리 (미국식이 위에, 남녀가 섞여 있습니다)</label><select id="ecXiVoice" data-chg="xiVoice">' +
    (XI.voices.length ? XI.voices : (XI.voice ? [{ id: XI.voice, name: XI.name, gender: "", accent: "" }] : [])).map(v => '<option value="' + esc(v.id) + '"' + (v.id === XI.voice ? " selected" : "") + '>' + esc(v.name) + (v.gender || v.accent ? " · " + esc([v.gender === "male" ? "남자" : (v.gender === "female" ? "여자" : v.gender), v.accent].filter(Boolean).join(" · ")) : "") + '</option>').join("") + '</select>';
  h += '<p class="ec-sub">대화의 선생님은 늘 이 목소리로 말하고, 구문·훈련 문장은 목소리 ' + (XI.pool.length || 1) + '가지' + (XI.poolNames.length ? " (" + esc(XI.poolNames.join(", ")) + ")" : "") + '가 번갈아 읽습니다. 같은 문장은 늘 같은 목소리라 크레딧이 다시 들지 않습니다. 크레딧이 떨어지면 Gemini 목소리 → 기기 목소리 순서로 넘어가고, 다음 달에 다시 차면 자동으로 돌아옵니다.</p>';
  if (GT.note && XI.note) h += '<div class="ec-msg err">' + esc(GT.note) + '</div>';
  { const P = XI.pre, all = ttsTexts(), ch = all.reduce((n, t) => n + t.length, 0);
    h += '<div class="ec-row">' + (P && P.on ? btn("받는 중 " + P.i + " / " + P.n + " · 멈추기", "xiPreStop", null, "ghost") : btn("문장 소리 모두 미리 받기 (" + all.length + "문장)", "xiPre", null, "ghost")) + '</div>' +
      '<p class="ec-sub">구문·내 구문·훈련 문장을 ElevenLabs로 한 번 만들어 이 기기에 저장합니다. 그 뒤로는 들을 때 크레딧이 들지 않습니다. 전부 처음 받으면 약 ' + ch.toLocaleString() + '자(크레딧 ' + Math.round(ch / 2).toLocaleString() + '~' + ch.toLocaleString() + ')가 들고, 이미 받은 문장은 건너뜁니다. 기기마다 따로 받아야 합니다.</p>' + (P && P.msg && !P.on ? '<div class="ec-msg">' + esc(P.msg) + '</div>' : ''); }
  if (XI.limit) h += '<p class="ec-sub">이번 달 사용 ' + XI.used.toLocaleString() + ' / ' + XI.limit.toLocaleString() + ' 크레딧</p>';
  if (XI.note) h += '<div class="ec-msg err">' + esc(XI.note) + '</div>';
  return h + '<div class="ec-row">' + btn("목록·사용량 새로 받기", "xiRefresh", null, "ghost small") + btn("키 지우기", "xiDel", null, "ghost small") + '</div>' + msgBox(U.xiMsg);
}
function xiSetup(key, first) {
  U.xiMsg = { text: "확인하는 중…" }; render();
  xiVoices(key).then(vs => {
    if (!vs.length) throw new Error("쓸 수 있는 목소리가 없습니다.");
    XI.key = key; store.set("ec_xikey", key); U.f.xiKey = "";
    if (!XI.voices.some(v => v.id === XI.voice)) xiSetVoice(vs[0].id);
    return xiUsage(key).catch(() => null);
  }).then(() => { keyTouch("x"); XI.off = 0; GT.off = 0; store.del("ec_xioff"); store.del("ec_gtoff"); XI.note = ""; U.xiMsg = { text: first ? "연결했습니다. 목소리는 " + XI.name + " 입니다. 「목소리 들어 보기」로 확인해 보세요." : "새로 받았습니다." }; if (U.tab === "set") render(); },
    e => { U.xiMsg = { text: String(e && e.message || e), err: true }; if (U.tab === "set") render(); });
}
function drawSyncCard() {
  let b;
  if (!fbReady()) b = '<p class="ec-sub">지금은 이 기기의 이 브라우저에 저장됩니다. 구글 로그인은 연결 값을 넣는 마지막 단계가 남았습니다. 그때까지는 「기록」의 백업을 써 주세요.</p>';
  else if (SYNC.ask) b = '<div class="ec-msg err">이 기기의 기록은 다른 계정(' + esc(SYNC.ask.old || "이전 계정") + ')으로 이어 쓰던 것입니다. 지금 로그인한 ' + esc(SYNC.ask.email || "새 계정") + ' 계정에 합칠까요? 합치면 이 기기의 기록이 이 계정에도 올라갑니다.</div><div class="ec-row">' + btn("이 계정에 합치기", "acctMerge") + btn("합치지 않고 로그아웃", "logout", null, "ghost") + '</div>';
  else if (!AUTH.uid) b = (SYNC.err ? '<div class="ec-msg err">' + esc(SYNC.err) + '</div>' : "") + '<p class="ec-sub">구글로 로그인하면 휴대폰·아이패드·노트북 어디서 열어도 기록이 이어집니다. 기록은 지우거나 덮어쓰지 않고 합치기만 합니다. Gemini·ElevenLabs 이용 키도 함께 맞춰지므로 한 기기에서 한 번만 넣으면 됩니다.</p>' + btn("구글로 로그인", "login", null, "wide");
  else b = '<p><b>' + esc(AUTH.email || AUTH.name || "로그인됨") + '</b></p><p class="ec-sub">' + (SYNC.busy ? "기록을 맞추는 중…" : (SYNC.last ? "마지막으로 맞춘 때 " + stamp(SYNC.last).slice(5) : "아직 맞추지 않음")) + ' · 이 기기 기록 ' + DB.log.length + '개 · ' + (SYNC.un.length ? '아직 올리지 않은 것 ' + SYNC.un.length + '개' : '모두 올라가 있음') + '</p>' +
    (SYNC.err ? '<div class="ec-msg err">' + esc(SYNC.err) + ' 기록은 이 기기에 그대로 있습니다.</div>' : "") +
    '<div class="ec-row">' + btn("지금 맞추기", "syncGo") + btn("처음부터 다시 맞추기", "syncAll", null, "ghost small") + btn("로그아웃", "logout", null, "ghost small") + '</div>';
  b += msgBox(U.smsg);
  if (fbReady()) b += '<div class="ec-row">' + btn("연결 점검", "diag", null, "ghost small") + '</div>' + (U.diag ? '<ul class="ec-ul ec-diag">' + U.diag.map(x => '<li class="' + (x.ok ? "s-good" : "s-bad") + '">' + (x.ok ? "✓ " : "✗ ") + esc(x.text) + '</li>').join("") + '</ul>' : "");
  return card("기록 저장 (구글 로그인)", b);
}
function drawSettings() {
  const order = gOrder();
  let g = '<p class="ec-sub">선생님 역할을 하는 구글 Gemini의 이용 키입니다. 기록·백업 파일에는 들어가지 않습니다. <b>사람마다 자기 키를 넣습니다.</b> 구글로 로그인하면 본인만 읽을 수 있는 계정 저장소에 두어, 내 다른 기기에서도 자동으로 채워집니다. 다른 사람과는 나누지 않습니다.</p>' + KEY_HOW.replace('class="ec-keyhow"', 'class="ec-keyhow"' + (G.key && !U.keyHow ? "" : " open")) +
    '<label for="ecGKey">Gemini 이용 키</label><input type="password" id="ecGKey" data-bind="gkey" value="' + esc(U.f.gkey) + '" autocomplete="off" placeholder="AIza…">' +
    '<label class="ec-check"><input type="checkbox" id="ecGRemember" data-chg="remember"' + (U.remember ? " checked" : "") + '> 이 기기에 키 기억하기</label>' +
    '<div class="ec-row">' + btn("저장하고 모델 확인", "gSave") + btn("키 지우기", "gClear", null, "ghost") + '</div>' + msgBox(U.gmsg);
  if (order.length) g += '<label for="ecGModelPick">먼저 쓸 모델</label><select id="ecGModelPick" data-chg="gmodel"><option value=""' + (G.model ? "" : " selected") + '>자동 (가장 좋은 모델부터)</option>' + G.chain.map(n => '<option value="' + esc(n) + '"' + (n === G.model ? " selected" : "") + '>' + esc(n) + '</option>').join("") + '</select>' +
    '<div class="ec-sub ec-gap">쓰는 순서 (막히면 자동으로 다음 모델)</div><ol class="ec-ol">' + order.map(n => '<li>' + esc(n) + ' <span class="ec-sub">— ' + gStateOf(n) + '</span></li>').join("") + '</ol><div class="ec-row">' + btn("한도 기록 지우고 다시 시도", "gReset", null, "ghost small") + '</div>';
  let h = card("선생님 연결 (Gemini)", g);
  if (fbReady()) h += card("함께 보기", '<p class="ec-sub">이 앱을 쓰는 사람들끼리 이번 주 학습 현황을 서로 봅니다. 보이는 것은 아래 이름과 이번 주 루틴 일수·연습 시간·연속 일수뿐입니다. 이름은 구글 계정 이름으로 보이고, 아래 칸에 적으면 그 이름으로 바뀝니다. 로그인한 사람은 누구나 볼 수 있습니다.</p>' +
    '<label class="ec-check"><input type="checkbox" id="ecShare" data-chg="share"' + (boardOn() ? " checked" : "") + '> 내 학습 현황을 함께 보기에 공유하기</label>' +
    '<p class="ec-sub">지금 보이는 이름: <b>' + esc(boardName() || "이름 없음") + '</b></p><label for="ecNick">다른 이름으로 보이게 (비우면 구글 계정 이름)</label><input type="text" id="ecNick" data-bind="nick" maxlength="20" value="' + esc(U.f.nick != null ? U.f.nick : (DB.set.nick || "")) + '" placeholder="예: 요셉">' +
    '<div class="ec-row">' + btn("이름 저장", "nickSave") + '</div>' + msgBox(U.nickMsg) + (AUTH.uid ? "" : '<p class="ec-sub">구글로 로그인해야 함께 보기가 켜집니다.</p>'));
  h += card("이번 버전에서 바뀐 것", '<p class="ec-sub">지금 ' + BUILD + '판입니다. 새 판이 나오면 앱을 쓰지 않는 틈에 자동으로 바뀝니다.</p>' + D.CHANGELOG.slice(0, 6).map(c => '<p class="ec-sub"><b>v' + c[0] + '</b> ' + esc(c[1].slice(5).replace("-", "/")) + ' — ' + esc(c[2]) + '</p>').join(""));
  h += card("마이크를 매번 묻지 않게", '<p class="ec-sub">마이크 허용을 기억하는 것은 앱이 아니라 기기의 브라우저입니다. 아래처럼 한 번 「허용」으로 바꿔 두면 이 기기에서는 다시 묻지 않습니다.</p>' +
    '<p><b>이 기기의 지금 상태:</b> ' + (U.mic === "granted" ? '<span class="s-good">항상 허용됨</span>' : U.mic === "denied" ? '<span class="s-bad">막혀 있음</span>' : U.mic === "prompt" ? "켤 때마다 물어봄" : "알 수 없음 (이 브라우저는 알려 주지 않습니다)") + '</p>' +
    '<p class="ec-sub"><b>아이폰·아이패드 (Safari)</b><br>① 이 앱을 Safari로 연 채 주소창의 「가가」 또는 「⋯」 단추 → 「웹사이트 설정」 → 마이크 → 「허용」<br>② 또는 설정 앱 → 앱 → Safari → 마이크 → 「허용」 (모든 사이트에 적용)</p>' +
    '<p class="ec-sub"><b>크롬 (안드로이드·컴퓨터)</b><br>주소창 왼쪽 단추 → 「사이트 설정」 → 마이크 → 「허용」</p>' +
    '<p class="ec-sub">홈 화면에 추가한 앱은 Safari와 따로 물을 수 있습니다. 그때는 ②번을 해 주세요.</p>');
  h += card("하루 목표", '<div class="ec-seg">' + [5, 15, 30, 60].map(m => '<button data-act="minutes" data-arg="' + m + '" aria-pressed="' + (DB.set.minutes === m) + '">' + m + '분</button>').join("") + '</div><p class="ec-sub">' + DB.set.minutes + '분이면 하루에 구문 ' + PLAN().phr + '개, 훈련 ' + PLAN().dr + '문장, 대화 ' + PLAN().talk + '번' + (PLAN().retell ? ', 다시 말하기 ' + PLAN().retell + '번' : '') + '입니다.' + (PLAN().rev || PLAN().lis ? ' 여기에 ' + [PLAN().rev ? "지난 문장 복습 3문제" : "", PLAN().lis ? "듣기 이야기 한 편" : ""].filter(Boolean).join("과 ") + '이 더해집니다.' : '') + (DB.set.minutes === 5 ? ' 짧게 매일 하는 과정입니다. 하루 목표는 이 기기에만 적용되어 사람마다 다르게 고를 수 있습니다.' : '') + ' 주 6일 기준 한 단계에 ' + planMonths(200) + '.</p>');
  { const em = easyMode(), cur = DB.set.level || "auto", lt = tests().slice(-1)[0];
    h += card("과정 수준", '<div class="ec-seg">' + [["auto", "자동"], ["easy", "기초"], ["std", "표준"]].map(x => '<button data-act="level" data-arg="' + x[0] + '" aria-pressed="' + (cur === x[0]) + '">' + x[1] + '</button>').join("") + '</div>' +
      '<p class="ec-sub">지금: <b>' + (em ? "기초 과정" : "표준 과정") + '</b>' + (cur === "auto" ? " (자동 — " + (lt ? "최근 레벨 테스트 " + lt.lv + " 기준" : "레벨 테스트 전이라 표준") + ")" : "") + '</p>' +
      '<p class="ec-sub"><b>기초 과정</b>은 영어를 막 시작한 분을 위한 과정입니다. 쉬운 구문 40개부터 익히고, 읽어 주는 소리가 느려지고, 선생님이 짧고 쉬운 말로 묻고 우리말 뜻과 대답 힌트를 함께 보여 주며, 듣기 이야기도 짧고 쉬워집니다. 하루 분량도 가볍습니다. 이 설정은 이 기기에만 적용됩니다.</p>' +
      '<label for="ecRate">읽어 주는 빠르기</label><select id="ecRate" data-chg="rate">' + [["", "자동 (기초 과정은 느리게)"], ["0.7", "아주 느리게"], ["0.8", "느리게"], ["0.9", "조금 느리게"], ["1", "보통"]].map(o => '<option value="' + o[0] + '"' + (String(DB.set.rate || "") === o[0] ? " selected" : "") + '>' + o[1] + '</option>').join("") + '</select>'); }
  h += card("소리", '<label class="ec-check"><input type="checkbox" id="ecAuto" data-chg="auto"' + (DB.set.autoSpeak ? " checked" : "") + '> 선생님 말과 정답을 자동으로 읽어 주기</label><p class="ec-sub">' + (XI.key && XI.voice ? "지금 읽어 주는 목소리: ElevenLabs " + esc(XI.name) + ". 막히면 기기 목소리로 읽습니다." : "읽어 주는 목소리는 기기에 들어 있는 영어 음성입니다.") + '</p>' + btn("목소리 들어 보기", "voice", null, "ghost small") + drawXi());
  h += drawSyncCard();
  h += '<p class="ec-ver">영어 말하기 코치 v' + BUILD + ' · 설계 문서 SPEC.md</p>';
  return h;
}

/* ---------- 누르기 ---------- */
const ACT = {
  tab: a => { U.unseenMsg = null; U.tagSel = null; U.ordSel = null; U.delAsk = null; U.back = null; go(a); },
  top: () => window.scrollTo({ top: 0, behavior: "smooth" }),
  bottom: () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }),
  xiSave: () => { const k = String(U.f.xiKey || "").trim(); if (k.length < 20) { U.xiMsg = { text: "ElevenLabs 키를 붙여 넣어 주세요.", err: true }; render(); return; } xiUnlock(); xiSetup(k, true); },
  xiRefresh: () => { xiSetup(XI.key, false); },
  xiPre: () => { if (!XI.key || !XI.voice) return; XI.off = 0; store.del("ec_xioff"); ttsPrefetch(() => { if (U.tab === "set") render(); }); render(); },
  xiPreStop: () => { if (XI.pre) XI.pre.stop = true; },
  xiDel: () => { speakStop(); xiClear(); keyTouch("x"); U.xiMsg = { text: "ElevenLabs 키를 지웠습니다. 기기 목소리로 읽습니다." }; render(); },
  say: a => { const t = SAY[+a]; if (t && t.t) speak(t.t, t.role); else if (t) speak(t); },
  voice: () => { if (!speak("Hello. I am your English coach. Let's practice together.", "teacher")) { U.gmsg = { text: "이 브라우저는 읽어 주기를 지원하지 않습니다.", err: true }; render(); } },
  routine: () => { const ns = nextStep(); ACT.start(ns || "talk"); },
  start: a => {
    if (REC.on) return;
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    A = null; U.tagSel = null; U.ordSel = null;
    if (a === "rev") { ACT.yestGo(); return; }
    if (a === "lis") { U.lisMission = null; go("train"); ACT.lisNew(); return; }
    if (a === "phr") startPhr(); else if (a === "dr") startDr(); else if (a === "talk") startTalk(U.scene); else if (a === "retell") startRetell(); else if (a === "test") startTest();
  },
  quit: a => { if (!A) { go("train"); return; } if (a !== "yes" && hasWork(A) && !A.quitAsk) { recAbort(); A.quitAsk = true; render(); window.scrollTo(0, 0); return; } endAct(); },
  stay: () => { if (A) { A.quitAsk = false; render(); } },
  rec: () => {
    if (REC.on) { recStop(); return; }
    if (!A) return;
    if (A.type === "batch" && A.phase === "ask") batchRec();
    else if (A.type === "talk" && A.phase === "idle") talkRec();
    else if (A.type === "retell" && A.phase === "hidden") retellRec();
    else if (A.type === "test" && A.phase === "ask") testRec();
  },
  /* 묶음 훈련 */
  bHint: () => { if (!A || A.type !== "batch" || REC.on) return; A.items[A.i].hinted = true; pendSave(); render(); },
  bPeek: () => { if (!A || A.type !== "batch" || REC.on) return; const it = A.items[A.i]; it.heard = true; pendSave(); render(); speak(it.en); },
  bRedo: () => { A.clips.length = A.i; A.phase = "ask"; setMsg(""); render(); autoSay(A.items[A.i]); },
  bNext: () => { if (A.i + 1 >= A.items.length) { batchSend(); return; } A.i++; A.phase = "ask"; setMsg(""); render(); window.scrollTo(0, 0); autoSay(A.items[A.i]); batchPre(); },
  bSend: () => { if (A.clips.length) batchSend(); },
  bWrong: () => { const items = A.items.filter((it, i) => !A.res[i].ok), a = A; A = null; startBatch(a.kind, items, a.title.replace(/ — 틀린 것 다시$/, "") + " — 틀린 것 다시", null); if (A) A.again = true; },
  /* 대화 */
  tResend: () => talkSend(),
  tDrop: () => { A.pend = null; A.phase = "idle"; setMsg(""); render(); },
  tFold: a => { const t = A.turns[+a]; if (t) { t.open = !t.open; if (A.allOpen) { A.allOpen = false; A.turns.forEach((x, i) => { x.open = i !== +a; }); } render(); } },
  tAll: () => { A.allOpen = !A.allOpen; if (!A.allOpen) A.turns.forEach(t => { t.open = false; }); render(); },
  tSave: a => { const p = String(a).split("."), t = A.turns[+p[0]], ph = t && t.r.phrases[+p[1]]; if (ph) { addMyPhrase(ph.en, ph.ko); syncSoon(); render(); } },
  tHint: () => { if (A && A.type === "talk") { const y = window.scrollY; A.hintOpen = !A.hintOpen; render(); window.scrollTo(0, y); } },
  level: a => { if (["auto", "easy", "std"].indexOf(a) < 0) return; if (a === "auto") delete DB.set.level; else DB.set.level = a; dbSave("set"); render(); },
  tMore: () => { if (!A || A.type !== "talk") return; A.more = true; render(); if (DB.set.autoSpeak) speak(A.q, "teacher"); },
  tNext: () => { if (!A || A.type !== "talk" || REC.on) return; const ns = nextStep(); A = null; pendSave(); ACT.start(ns || "retell"); },
  tEnd: () => { A.phase = "end"; render(); window.scrollTo(0, 0); },
  /* 다시 말하기 */
  rHide: () => { A.pend = null; A.phase = "hidden"; setMsg(""); speakStop(); render(); window.scrollTo(0, 0); },
  rShow: () => { A.phase = "study"; setMsg(""); render(); },
  rResend: () => retellSend(),
  rAgain: () => { A.res = null; A.phase = "study"; render(); window.scrollTo(0, 0); },
  rNext: () => { A.i++; A.res = null; A.phase = "study"; render(); window.scrollTo(0, 0); },
  /* 레벨 테스트 */
  xBegin: () => { A.phase = "ask"; render(); window.scrollTo(0, 0); },
  xRedo: () => { A.tasks[A.i].clip = null; A.phase = "ask"; setMsg(""); render(); },
  xNext: () => { const i = A.tasks.findIndex(t => !t.clip); if (i < 0) { testSend(); return; } A.i = i; A.phase = "ask"; setMsg(""); render(); window.scrollTo(0, 0); },
  xSend: () => testSend(),
  xRedoTask: () => { A.i = A.redo; A.tasks[A.i].clip = null; A.tasks[A.i].res = null; A.redo = null; A.phase = "ask"; setMsg(""); render(); },
  xHome: () => { A = null; pendSave(); go("home"); },
  xRec: () => { A = null; pendSave(); go("rec"); },
  /* 약점 */
  tagOpen: a => { if (!D.TAGS[a]) return; if (!U.tagSel && !U.ordSel) U.back = { tab: U.tab, y: window.scrollY }; U.tagSel = a; U.ordSel = null; go("weak"); },
  tagBack: () => { const b = U.back; U.back = null; U.tagSel = null; U.ordSel = null; go(b ? b.tab : "weak"); if (b) window.scrollTo(0, b.y); },
  tagMore: () => { U.showZero = !U.showZero; render(); },
  tagDrill: a => { U.back = null; if (A && hasWork(A)) { ACT.start("dr"); return; } A = null; startBatch("dr", tagDrills(a), D.TAGS[a].n + " 훈련", null); },
  ordOpen: a => { if (!U.tagSel && !U.ordSel) U.back = { tab: U.tab, y: window.scrollY }; U.ordSel = a; U.tagSel = null; go("weak"); },
  ordDrill: a => { U.back = null; if (A && hasWork(A)) { ACT.start("dr"); return; } A = null; startBatch("dr", orderDrills(a), "어순 훈련", null); },
  /* 구문 */
  phCat: a => { U.phCat = a; U.delAsk = null; render(); },
  natOpen: () => { U.natOpen = !U.natOpen; U.natN = 5; U.natMsg = null; render(); },
  natMore: () => { U.natN += 10; render(); },
  natAdd: a => { const x = KEEP[+a]; if (!x) return; const y = window.scrollY, r = addMyPhrase(x.en, x.ko);
    const m = { text: r ? "내 구문에 담았습니다. 다음 구문 복습에 먼저 나옵니다." : "이미 내 구문에 있습니다." };
    if (r) syncSoon(); if (U.tab === "phr") U.natMsg = m; render(); if (U.tab !== "phr") setMsg(m.text); window.scrollTo(0, y); },
  natAsk: a => { const x = KEEP[+a]; if (!x || U.natBusy) return; const en = x.en, y0 = window.scrollY;
    const show = m => { U.natBusy = null; if (U.tab === "phr") { U.natMsg = m; if (!REC.on) { const y = window.scrollY; render(); window.scrollTo(0, y); } } else if (!REC.on) setMsg(m.text, m.err); };
    U.natBusy = en; U.natMsg = null; render(); window.scrollTo(0, y0);
    gCall({ sys: sysFor("ask"), temp: 0.2, lite: true, parts: [{ text: "MODE: ask\nEXPRESSION: " + en }] }, () => {}, r => {
      const ko = r && String(r.meaning_ko || "").trim();
      if (!ko) { show({ text: "뜻을 받지 못했습니다. 잠시 뒤에 다시 눌러 주세요.", err: true }); return; }
      const ok = addMyPhrase(en, ko); if (ok) syncSoon();
      show({ text: ok ? "뜻을 받아 내 구문에 담았습니다: " + ko : "이미 내 구문에 있습니다." });
    }, why => show({ text: why || "뜻을 받지 못했습니다. 잠시 뒤에 다시 눌러 주세요.", err: true })); },
  nickSave: () => { const n = String(U.f.nick != null ? U.f.nick : (DB.set.nick || "")).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 20);
    DB.set.nick = n; dbSave("set"); U.f.nick = null; U.nickMsg = { text: n ? "「" + n + "」(으)로 저장했습니다." + (boardOn() ? "" : " 지금은 공유가 꺼져 있습니다.") : "이름을 비웠습니다. 구글 계정 이름으로 보입니다." }; syncSoon(300); render(); },
  loopGo: () => { if (REC.on) return; LOOP.mission = null; const it = loopItems(U.loopSrc); if (!it.length) { U.loopMsg = { text: "이 묶음에는 아직 문장이 없습니다. 다른 묶음을 골라 주세요." }; render(); return; }
    U.loopMsg = null; loopStart(it, { rate: U.loopRate, echo: U.loopEcho, forever: U.loopForever }); render(); },
  loopStop: () => { loopStop(); speakStop(); render(); },
  lisNew: (arg, el) => {
    if (el) U.lisMission = null;                     /* 단추로 직접 시작한 듣기는 미션이 아니다 */
    if (U.lisBusy || REC.on) return;
    if (!needKey()) return;
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    const topic = LIS_TOPICS[U.lisTopic] ? U.lisTopic : "daily", lv = easyMode() ? "A1-A2" : ((tests().slice(-1)[0] || {}).lv || "B1"), easyLis = easyMode() ? "\nBEGINNER OVERRIDE: write exactly 5 sentences of 4 to 8 words each, using only the most common everyday words, present or simple past tense, no idioms, no contractions harder than I'm / it's / don't. The two questions must be very easy." : "";
    const seen = lisList().slice(0, 8).map(p => p.title).join("; ");
    U.lisBusy = true; U.lisMsg = { text: "선생님이 이야기를 쓰고 있습니다. 20초쯤 걸립니다." }; render();
    const end = m => { U.lisBusy = false; U.lisMsg = m; if (U.tab === "train" && !A) render(); };
    gCall({ sys: SYS_LISTEN, temp: 0.9, lite: true, parts: [{ text: "MODE: listen\nTOPIC: " + LIS_TOPICS[topic][1] + "\nLEARNER LEVEL (CEFR): " + lv + ". Keep vocabulary at or slightly below this level." + easyLis + "\nDo not repeat these earlier titles: " + (seen || "none") }] }, () => {}, r => {
      const p = lisClean(r);
      if (p.sents.length < 4) { end({ text: "이야기를 제대로 받지 못했습니다. 한 번 더 눌러 주세요.", err: true }); return; }
      p.id = "L" + newId(); p.t = now(); p.topic = LIS_TOPICS[topic][0]; lisSave(p); U.lisBusy = false; U.lisMsg = null;
      if (A || REC.on) { U.flash = { text: "듣기 이야기가 준비됐습니다. 「훈련」의 듣기에서 「지난 이야기 다시」로 열 수 있습니다." }; render(); return; }
      lisStart(p, p.topic);
    }, why => end({ text: why || "이야기를 받지 못했습니다. 잠시 뒤에 다시 눌러 주세요.", err: true }));
  },
  lisOld: () => { U.lisOld = !U.lisOld; render(); },
  lisOpen: a => { U.lisMission = null; const p = lisList().filter(x => x.id === a)[0]; if (!p) return; if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; } U.lisOld = false; lisStart(p, p.topic); },
  lisOwn: () => { U.lisMission = null; const p = lisFromText(U.f.lisOwn); if (p.sents.length < 2) { U.lisMsg = { text: "영어 글을 두 문장 이상 넣어 주세요.", err: true }; render(); return; }
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    p.id = "L" + newId(); p.t = now(); p.topic = "내 글"; p.title = "내 글 · " + p.sents[0].en.split(" ").slice(0, 4).join(" "); lisSave(p); U.lisMsg = null; lisStart(p, "내 글"); },
  lisPlay: a => { if (!A || A.type !== "listen") return; lisAll(a === "echo"); },
  lisAns: a => { if (!A || A.type !== "listen") return; const m = String(a).split("|"), i = +m[0], j = +m[1], q = A.p.qs[i]; if (!q || !q.opts || !(j >= 0 && j < q.opts.length) || A.pick[i] != null) return; const y = window.scrollY; A.pick[i] = j; render(); window.scrollTo(0, y); },
  lisShow: () => { if (A && A.type === "listen") { A.show = true; render(); } },
  lisStep: a => { if (!A || A.type !== "listen") return; const y = +a; if (!(y >= 0 && y <= 3)) return; loopStop(); speakStop(); A.step = y; render(); window.scrollTo(0, 0); },
  lisCheck: a => { if (!A || A.type !== "listen") return; const d = A.dict[+a]; if (!d) return; const y = window.scrollY; d.typed = String(U.f["dict" + a] || "").trim().slice(0, 300); d.res = lisDiff(A.p.sents[d.i].en, d.typed); render(); window.scrollTo(0, y); },
  lisDone: () => { if (!A || A.type !== "listen") return; loopStop(); speakStop();
    const dn = A.dict.filter(d => d.res).reduce((s, d) => s + d.res.n, 0), dk = A.dict.filter(d => d.res).reduce((s, d) => s + d.res.ok, 0);
    logAdd({ k: "listen", title: A.p.title, topic: A.topic, n: A.p.sents.length, dn: dn, dk: dk, qn: lisQdone(), qk: lisQok(), heard: A.heard, tx: A.p.sents.map(x => x.en).join(" ").slice(0, 900) });
    [0, 1, 2].forEach(k => { U.f["dict" + k] = ""; }); { const dy = dayRec(); dy.st.lis = (dy.st.lis || 0) + 1; daySave(); }
    const qn0 = lisQdone(), qk0 = lisQok(); if (A.mission) missDone(A.mission, (qn0 ? "질문 " + qk0 + " / " + qn0 : "들음") + (dn ? " · 받아쓰기 " + dk + " / " + dn : "")); A = null; pendSave(); U.lisMsg = { text: "듣기를 마쳤습니다." + (qn0 ? " 질문 " + qk0 + " / " + qn0 + "." : "") + (dn ? " 받아쓰기에서 낱말 " + dk + " / " + dn + "개를 들었습니다." : "") + " 며칠 뒤 「이어 듣기」에서 다시 들어 보세요." }; go("train"); },
  keyHow: () => { U.keyHow = true; go("set"); setTimeout(() => { const el = $("ecGKey"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" }); }, 80); },
  yestGo: () => { if (REC.on) return; const it = pickYest(3); if (!it.length) { U.shortMsg = { text: "구문을 한 번 익히면 다음 날부터 여기에 복습 문제가 나옵니다." }; render(); return; }
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    A = null; U.tagSel = null; U.ordSel = null; U.shortMsg = null; startBatch("phr", it, "지난 문장 복습", "rev"); if (A) A.again = true; },
  todayGo: () => { const i = D.SCENES.findIndex(x => x.id === "today"); if (i < 0) return; U.scene = i; ACT.start("talk"); },
  cumGo: () => { if (REC.on) return; const it = pickCumul(20); if (!it.length) return;
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    A = null; U.tagSel = null; U.ordSel = null; startBatch("phr", it, "누적 암송", null); if (A) A.again = true; },
  fixGo: () => { if (REC.on) return; if (!fixList().length) { U.fixMsg = { text: "아직 고친 문장이 없습니다. 대화나 다시 말하기를 하면 여기에 모입니다." }; render(); return; }
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    A = null; U.tagSel = null; U.ordSel = null; U.fixMsg = null; startBatch("phr", pickFix(8), "틀렸던 문장 다시 말하기", null); },
  fixScan: () => { const n = fixCollect(); U.fixMsg = { text: n ? "지난 기록에서 고친 문장 " + n + "개를 내 구문에 담았습니다." : "새로 담을 문장이 없습니다. 이미 모두 담겨 있습니다." }; if (n) syncSoon(); render(); },
  phDel: a => { if (U.delAsk !== a) { U.delAsk = a; render(); return; } DB.my = DB.my.filter(p => p.id !== a); DB.gone[a] = now(); dbSave("my"); dbSave("gone"); syncSoon(); U.delAsk = null; render(); },
  /* 기록 */
  logOpen: a => { U.logOpen = U.logOpen === a ? null : a; render(); },
  logMore: () => { U.logN += 30; render(); },
  repCopy: () => copyText(coachReport(), "요약을 복사했습니다. Claude 대화에 붙여 넣어 주세요.", "repMsg"),
  bkCopy: () => copyText(JSON.stringify(backupMake()), "백업 글을 복사했습니다. 메모장이나 메일에 붙여 넣어 보관해 주세요.", "bkMsg"),
  bkDown: () => {
    try {
      const blob = new Blob([JSON.stringify(backupMake())], { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "english-coach-backup-" + stamp(now()).slice(0, 10) + ".json"; document.body.appendChild(a); a.click();
      setTimeout(() => { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 2000);
      U.bkMsg = { text: "백업 파일을 내려받았습니다 (기록 " + DB.log.length + "개). 내려받기가 안 되면 「백업 글 복사」를 써 주세요." };
    } catch (e) { U.bkMsg = { text: "파일을 만들지 못했습니다. 「백업 글 복사」를 써 주세요.", err: true }; }
    render();
  },
  bkPaste: () => mergeText(U.f.bk),
  /* 설정 */
  gSave: () => {
    G.key = U.f.gkey.trim();
    if (!G.key) { U.gmsg = { text: "Gemini 이용 키를 넣어 주세요.", err: true }; render(); return; }
    let kept = true; if (U.remember) kept = store.set("ec_gkey", G.key); else store.del("ec_gkey");
    U.gmsg = { text: "모델 목록을 불러오는 중…" }; render();
    gList(pick => { if (U.remember && kept) keyTouch("g"); U.gmsg = { text: "키가 확인됐습니다. 「" + pick + "」부터 쓰고, 한도가 차면 아래 순서대로 자동으로 넘어갑니다." + (U.remember && !kept ? " (이 브라우저가 저장을 막아, 열어 둔 동안만 기억합니다.)" : "") }; if (U.tab === "set") render(); },
      why => { U.gmsg = { text: why, err: true }; if (U.tab === "set") render(); });
  },
  gClear: () => { G.key = ""; U.f.gkey = ""; store.del("ec_gkey"); keyTouch("g"); U.gmsg = { text: "키를 지웠습니다." + (AUTH.uid ? " 로그인한 다른 기기에서도 지워집니다." : "") }; render(); },
  gReset: () => { gReset(); U.gmsg = { text: "한도 기록을 지웠습니다. 다음 요청부터 가장 좋은 모델로 다시 시도합니다." }; render(); },
  minutes: a => { const m = +a; if ([5, 15, 30, 60].indexOf(m) >= 0) { DB.set.minutes = m; dbSave("set"); render(); } },
  missGo: a => { const m = D.MISSIONS.filter(x => x.id === a)[0]; if (!m || REC.on) return; U.missMsg = null;
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    if (m.kind === "loop") { const src = ["cum", "learn", "lis", "nat", "my"].filter(k => loopItems(k).length >= 3)[0];
      if (!src) { U.missMsg = { text: "이어 들을 문장이 아직 없습니다. 「구문」을 한 번 익히면 할 수 있습니다." }; render(); return; }
      U.loopSrc = src; U.loopEcho = true; U.loopForever = false; LOOP.mission = m.id; go("phr"); loopStart(loopItems(src), { rate: U.loopRate, echo: true, forever: false }); LOOP.mission = m.id; render();
      setTimeout(() => { const el = $("ecLoopSrc"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" }); }, 60); return; }
    if (!needKey()) return;
    A = null; U.tagSel = null; U.ordSel = null;
    if (m.kind === "talk") { startTalk(D.SCENES.findIndex(x => x.id === "free"), m); return; }
    if (m.kind === "listen") { U.lisTopic = m.topic; U.lisMission = m.id; go("train"); ACT.lisNew(); return; }
    if (m.kind === "batch") { const it = m.items.map((x, i) => ({ ref: "mis:" + m.id + ":" + i, task: "shadow", ko: x.ko, en: x.en, focus: "" })).concat(m.items.map((x, i) => ({ ref: "mis:" + m.id + ":" + i, task: "recall", ko: x.ko, en: x.en, focus: "" })));
      startBatch("phr", it, "미션 · " + m.t, null); if (A) { A.again = true; A.mission = m.id; } } },
  flash: () => { U.flash = null; go("train"); },
  /* 구글 로그인 */
  gateSkip: () => { store.set("ec_gateskip", "1"); U.smsg = null; go("home"); },
  login: () => {
    if (REC.on) return;
    daySave();
    const leave = () => { const e = loginStart(); if (e) { U.smsg = { text: e, err: true }; go("set"); } };
    if (hasPend(A)) idbSet("pend", { t: Date.now(), a: A }).then(leave, leave); else leave();
  },
  logout: () => { logout(); U.smsg = { text: "로그아웃했습니다. 이 기기의 기록은 그대로 있습니다." }; U.diag = null; render(); },
  acctMerge: () => { U.smsg = { text: "기록을 합치는 중…" }; render(); bindAccount().then(ok => { U.smsg = ok ? { text: "이 계정에 합쳤습니다." } : null; render(); }); },
  syncGo: () => { U.smsg = null; syncNow().then(ok => { U.smsg = ok ? { text: "맞췄습니다. 올린 기록 " + SYNC.stats.up + "개, 받은 기록 " + SYNC.stats.down + "개 (이번에 연 뒤로)." } : null; if (U.tab === "set") render(); }); },
  syncAll: () => { U.smsg = null; syncFull().then(ok => { U.smsg = ok ? { text: "처음부터 다시 맞췄습니다. 이 기기 기록 " + DB.log.length + "개." } : null; if (U.tab === "set") render(); }); },
  diag: () => { U.diag = [{ ok: true, text: "점검 중…" }]; render(); diagRun().then(out => { U.diag = out; if (U.tab === "set") render(); }); }
};
const CHG = {
  share: el => { DB.set.share = !!el.checked; dbSave("set"); U.nickMsg = { text: el.checked ? "공유를 켰습니다." : "공유를 껐습니다. 올려 둔 내 현황을 비웁니다." }; syncSoon(300); render(); },
  loopSrc: el => { U.loopSrc = el.value; U.loopMsg = null; if (LOOP.on) { loopStop(); speakStop(); } render(); },
  loopRate: el => { U.loopRate = +el.value || 1; store.set("ec_looprate", String(U.loopRate)); if (LOOP.on) { LOOP.rate = U.loopRate; try { if (XI.audio) XI.audio.defaultPlaybackRate = LOOP.rate; } catch (e) {} } },
  loopEcho: el => { U.loopEcho = !!el.checked; if (LOOP.on) LOOP.echo = U.loopEcho; },
  loopForever: el => { U.loopForever = !!el.checked; if (LOOP.on) LOOP.forever = U.loopForever; },
  lisTopic: el => { U.lisTopic = el.value; store.set("ec_listopic", U.lisTopic); },
  rate: el => { const v = +el.value; if (v >= 0.5 && v <= 1.2) DB.set.rate = v; else delete DB.set.rate; dbSave("set"); speakStop(); },
  scene: el => { U.scene = +el.value || 0; render(); },
  remember: el => { U.remember = el.checked; },
  xiVoice: el => { xiSetVoice(el.value); keyTouch("x"); XI.off = 0; U.xiMsg = null; render(); speak("Hello. I am your English coach.", "teacher"); },
  auto: el => { DB.set.autoSpeak = el.checked; dbSave("set"); if (!el.checked) speakStop(); },
  gmodel: el => { G.model = el.value; store.set("ec_gmodel", G.model); U.gmsg = { text: G.model ? "「" + G.model + "」을 먼저 씁니다." : "가장 좋은 모델부터 자동으로 씁니다." }; render(); },
  bkFile: el => { const f = el.files && el.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => mergeText(rd.result); rd.onerror = () => { U.bkMsg = { text: "파일을 읽지 못했습니다.", err: true }; render(); }; rd.readAsText(f); }
};
document.addEventListener("click", e => {
  const el = e.target.closest ? e.target.closest("[data-act]") : null; if (!el || el.disabled) return;
  const f = ACT[el.getAttribute("data-act")]; if (!f) return;
  tick(); f(el.getAttribute("data-arg"), el);
});
document.addEventListener("change", e => { const k = e.target.getAttribute && e.target.getAttribute("data-chg"); if (k && CHG[k]) { tick(); CHG[k](e.target); } });
document.addEventListener("input", e => { const k = e.target.getAttribute && e.target.getAttribute("data-bind"); if (k) U.f[k] = e.target.value; });
/* 학습 시간: 앱을 보고 있는 동안 센다. 건드리는 것(누르기·밀기·글자)과 녹음·채점·듣기는 '쓰는 중'으로 본다. */
["scroll", "touchstart", "pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, tick, { passive: true }));
setInterval(() => {
  let speaking = false; try { speaking = !!(window.speechSynthesis && window.speechSynthesis.speaking); } catch (e) {}
  const turned = beat(REC.on || !!(A && A.phase === "sending") || speaking);
  if (A && A.phase === "sending" && A.t0 && Date.now() - Math.max(A.t0, A.progAt || 0) > 100000) {   /* 100초 동안 아무 진전이 없으면 멈추고 다시 보낼 수 있게 한다 */
    gCancelAll(); failed(A, "선생님의 답이 너무 오래 오지 않아 멈췄습니다. 녹음은 그대로 있습니다. 「다시 보내기」를 눌러 주세요.", "net");
  }
  if (A && A.phase === "fail" && A.autoAt) {
    if (Date.now() >= A.autoAt) { A.autoAt = 0; if (G.key && !REC.on) { if (U.tab === "train") setMsg("한도가 풀려 다시 보냅니다…"); resumeSend(); } }
    else { A.failMsg = waitText(A); if (U.tab === "train") setMsg(A.failMsg, true); }
  }
  if (A && A.phase === "sending") { if (!A.t0) A.t0 = Date.now(); const w = $("ecWait"); if (w) w.textContent = Math.round((Date.now() - A.t0) / 1000) + "초째 기다리는 중"; } else if (A && A.t0) A.t0 = 0;
  if (turned && U.tab === "home" && !REC.on) render();
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {                           /* 떠날 때: 녹음은 거기까지 담고, 시간 세기를 멈춘다 */
    daySave(); U.hidAt = Date.now();
    if (REC.on) { recStop(); setMsg("다른 화면으로 나가서 녹음을 거기까지만 담았습니다."); }
    return;
  }
  if (A && A.phase === "sending" && U.hidAt && Date.now() - U.hidAt > 20000 && G.key) {   /* 오래 나갔다 오면 보내던 요청이 멈춰 있을 수 있어, 끊고 받은 데부터 다시 보낸다 */
    gCancelAll(); A.t0 = Date.now(); A.progAt = 0; if (U.tab === "train") setMsg("돌아와서 이어서 보냅니다…"); resumeSend();
  }
  else if (A && A.phase === "fail" && A.failKind === "net" && !A.autoTried && G.key) { A.autoTried = true; if (U.tab === "train") setMsg("돌아와서 이어서 보냅니다…"); resumeSend(); }
  else render();
  if (Date.now() - SYNC.last > 120000) syncSoon(800);
});
window.addEventListener("pagehide", daySave);

/* ---------- 시작 ---------- */
const MIGRATED = dbLoad();
gLoad(); authLoad(); /* ---------- 새 판이 올라오면 저절로 바꿔 탄다. 녹음·채점 중에는 기다렸다가 끝난 뒤에 한다. ---------- */
const UPD = { want: 0, last: 0 };
function updIdle() { return !A && !REC.on && !ttsPlaying() && !(A && (A.phase === "sending" || hasWork(A))) && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)); }
function updGo() {
  if (!UPD.want || UPD.want <= BUILD || !updIdle()) return false;
  let did = ""; try { did = sessionStorage.getItem("ec_upd") || ""; } catch (e) {}
  if (did === String(UPD.want)) return false;                    /* 같은 판으로는 한 번만 시도한다 (되풀이 방지) */
  try { sessionStorage.setItem("ec_upd", String(UPD.want)); } catch (e) { return false; }
  dbSave("day"); location.replace(location.pathname + "?v=" + UPD.want); return true;
}
function updCheck() {
  if (Date.now() - UPD.last < 60000) { updGo(); return Promise.resolve(false); }
  UPD.last = Date.now();
  return fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => { const n = j && +j.build; if (n > BUILD) { UPD.want = n; return updGo(); } return false; }, () => false);
}
xiLoad(); setTimeout(updCheck, 3000); setInterval(updCheck, 5 * 60000); document.addEventListener("visibilitychange", () => { if (!document.hidden) updCheck(); });
SYNC.onKeys = got => { if (got.indexOf("g") >= 0) { U.f.gkey = G.key; U.remember = true; } U.keyMsg = "계정에 저장해 둔 이용 키를 이 기기에 넣었습니다."; }; xiEnsurePool().then(ok => { if (ok && U.tab === "set") render(); }); document.addEventListener("pointerdown", () => { xiUnlock(); }, true);
U.f.gkey = G.key; U.remember = G.key ? !!store.get("ec_gkey") : true; U.scene = today() % 6;
G.onChain = () => { if (U.tab === "set") render(); };
SYNC.onPaint = () => { if (REC.on) return; const ae = document.activeElement, typing = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName); if (!typing && (U.tab === "set" || U.tab === "home" || U.tab === "rec")) render(); };
const BACK = fbReady() ? loginReturn() : null;    /* 구글 로그인 화면에서 돌아온 것인지 */
if (BACK) { U.tab = "set"; U.smsg = { text: "로그인을 확인하는 중…" }; }
render();
if (BACK) BACK.then(() => { U.smsg = { text: "로그인했습니다. 기록을 맞추는 중…" }; render(); return afterLogin(); })
  .then(() => { U.smsg = SYNC.ask || SYNC.err ? null : { text: "로그인했고 기록을 맞췄습니다." }; render(); }, e => { U.smsg = { text: String(e && e.message || e), err: true }; render(); });
else authResume();
pendRestore().then(() => {                          /* 나가 있는 동안 채점이 끝났는데 화면이 닫혔던 경우: 그 결과를 기록에서 펼쳐 보여 준다 */
  const id = store.get("ec_unseen"); if (!id) return;
  if (A) { if (A.phase === "done" || A.type === "talk") return; }
  store.del("ec_unseen"); if (A || !DB.log.some(r => r.id === id)) return;
  U.tab = "rec"; U.logOpen = id; U.unseenMsg = { text: "나가 있는 동안 채점이 끝났습니다. 그 결과를 아래 연습 기록에 펼쳐 두었습니다." }; render();
  setTimeout(() => { const el = document.querySelector('[data-act="logOpen"][data-arg="' + id + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); }, 60);
});
window.__ec = { U, DB, G, REC, ACT, CHG, Clock, AUTH, SYNC, FB, get A() { return A; }, set A(v) { A = v; }, render, go, tick, beat, dbLoad, dbSave, logAdd, srsMark, tagStats, focusTags, pickPhrases, pickDrills, testScore, levelOf, backupMake, backupMerge, coachReport, analyze, sysFor, profileText, dayRec, today, streak, MIGRATED };
/* 마이크 허용 상태(브라우저가 알려 줄 때만). 바뀌면 설정 화면에 바로 보이게. */
function micWatch() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return;
    navigator.permissions.query({ name: "microphone" }).then(st => {
      const set = () => { U.mic = st.state; if (U.tab === "set" && !REC.on) render(); };
      U.mic = st.state; st.onchange = set;
    }).catch(() => {});
  } catch (e) {}
}
micWatch();
/* 이어 듣기 진행 표시: 화면 전체를 다시 그리지 않고 한 줄만 바꾼다. 끝나면 단추를 되돌린다. */
LOOP.onPaint = () => { const el = $("ecLoopSt"); if (LOOP.on) { if (el) { el.className = "ec-msg"; el.textContent = (A && A.type === "listen" && U.tab === "train") ? "읽는 중 " + (Math.min(LOOP.i, LOOP.list.length - 1) + 1) + " / " + LOOP.list.length : loopStatus(); } } else if ((U.tab === "phr" || (U.tab === "train" && A && A.type === "listen")) && !REC.on) { const y = window.scrollY; render(); window.scrollTo(0, y); } };
/* 맨 위에서 아래로 길게 당겨 새로 고침. 스치는 손짓에는 반응하지 않도록 110px 넘게, 0.35초 넘게 당긴 뒤 놓았을 때만. 녹음·채점·훈련 중에는 하지 않는다. */
const PULL = { y0: null, x0: 0, t0: 0, d: 0, el: null, NEED: 110, HOLD: 350 };
function pullOk() { return window.scrollY <= 0 && !REC.on && !(A && (A.phase === "sending" || hasWork(A))) && !ttsPlaying() && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)); }
function pullShow(d, ready) { if (!PULL.el) { PULL.el = document.createElement("div"); PULL.el.className = "ec-pull"; document.body.appendChild(PULL.el); }
  PULL.el.textContent = ready ? "놓으면 새로 고침" : "더 당기면 새로 고침"; PULL.el.className = "ec-pull" + (ready ? " ready" : ""); PULL.el.style.transform = "translate(-50%," + (d > 30 ? Math.min(70, d / 2) - 30 : -60) + "px)"; }
function pullReady() { return PULL.d >= PULL.NEED && Date.now() - PULL.t0 >= PULL.HOLD; }
function pullRefresh() { daySave(); const go = () => { location.reload(); };
  if (typeof syncNow === "function" && AUTH.uid) { let done = false; const fin = () => { if (!done) { done = true; go(); } }; syncNow().then(fin, fin); setTimeout(fin, 4000); } else go(); }
document.addEventListener("touchstart", e => { PULL.blocked = e.touches.length === 1 && window.scrollY <= 0 && !pullOk() && !!(A && hasWork(A)); PULL.by = e.touches[0].clientY;
  PULL.y0 = (e.touches.length === 1 && pullOk()) ? e.touches[0].clientY : null; PULL.x0 = e.touches[0].clientX; PULL.t0 = Date.now(); PULL.d = 0; }, { passive: true });
document.addEventListener("touchmove", e => { if (PULL.y0 == null) { if (PULL.blocked && e.touches[0].clientY - PULL.by > PULL.NEED) { pullShow(120, false); PULL.el.textContent = "채점하지 않은 녹음이 있어 새로 고치지 않습니다"; clearTimeout(PULL.bt); PULL.bt = setTimeout(() => pullShow(0, false), 1800); PULL.blocked = false; } return; } const dy = e.touches[0].clientY - PULL.y0, dx = Math.abs(e.touches[0].clientX - PULL.x0);
  if (dy <= 0 || dx > dy * 0.6 || window.scrollY > 0) { PULL.d = 0; if (dy < -10 || dx > 40) PULL.y0 = null; pullShow(0, false); return; }
  PULL.d = dy; pullShow(dy, pullReady()); }, { passive: true });
document.addEventListener("touchend", () => { if (PULL.y0 == null) return; const ok = pullReady() && pullOk(); PULL.y0 = null; if (ok) { if (PULL.el) PULL.el.textContent = "새로 고치는 중…"; pullRefresh(); } else pullShow(0, false); PULL.d = 0; }, { passive: true });
document.addEventListener("touchcancel", () => { PULL.y0 = null; PULL.d = 0; pullShow(0, false); }, { passive: true });
/* 뒤로 가기: 화면을 옮길 때마다 브라우저 기록에 남겨, 옆으로 미는 손짓·기기의 뒤로 단추로 앞 화면의 보던 자리로 돌아간다. */
const NAV = { i: 0, busy: false };
function navPush(tab) {
  if (NAV.busy || tab === U.tab) return;
  try { history.replaceState({ ec: 1, i: NAV.i, tab: U.tab, y: Math.round(window.scrollY) }, ""); NAV.i++; history.pushState({ ec: 1, i: NAV.i, tab: tab, y: 0 }, ""); } catch (e) {}
}
function navBack() { if (NAV.i > 0 && !REC.on) { try { history.back(); return true; } catch (e) {} } return false; }
window.addEventListener("popstate", e => {
  const st = e.state; if (!st || !st.ec || REC.on) return;
  NAV.i = st.i || 0; NAV.busy = true;
  U.tagSel = null; U.ordSel = null; U.delAsk = null; U.back = null; U.unseenMsg = null; U.tab = st.tab || "home";
  U.note = (U.tab === "train" && A && A.phase === "fail" && A.failMsg) ? { text: A.failMsg, err: true } : null;
  render(); NAV.busy = false;
  const y = st.y || 0; window.scrollTo(0, y); setTimeout(() => window.scrollTo(0, y), 30);
});
try { history.replaceState({ ec: 1, i: 0, tab: U.tab, y: 0 }, ""); } catch (e) {}
/* 옆으로 미는 손짓 = 뒤로. 옆으로 굴리는 줄(상황 고르기)이나 글 칸에서 시작한 손짓, 위아래로 움직인 손짓은 빼고, 90px 넘게 밀었을 때만. */
const SWIPE = { x: null, y: 0, t: 0 };
document.addEventListener("touchstart", e => { const el = e.target; SWIPE.x = (e.touches.length === 1 && !(el && el.closest && el.closest("input,textarea,select,.ec-cats,.ec-att,[data-noswipe]"))) ? e.touches[0].clientX : null; SWIPE.y = e.touches[0].clientY; SWIPE.t = Date.now(); SWIPE.dx = 0; SWIPE.dy = 0; }, { passive: true });
document.addEventListener("touchmove", e => { if (SWIPE.x == null) return; SWIPE.dx = e.touches[0].clientX - SWIPE.x; SWIPE.dy = e.touches[0].clientY - SWIPE.y; }, { passive: true });
document.addEventListener("touchend", () => { if (SWIPE.x == null) return; const dx = Math.abs(SWIPE.dx || 0), dy = Math.abs(SWIPE.dy || 0); SWIPE.x = null; if (dx >= 90 && dy < 45 && dx > dy * 2.5 && Date.now() - SWIPE.t < 900) navBack(); }, { passive: true });
/* 이어 듣기 미션: 한 바퀴를 끝까지 들으면 마침 */
LOOP.onPass = n => { if (LOOP.mission) { const id = LOOP.mission; LOOP.mission = null; missDone(id, n + "문장을 끝까지 들음"); U.loopMsg = { text: "미션을 마쳤습니다 ✓ " + n + "문장을 끝까지 들었습니다." }; } };
/* 패드의 트랙패드·마우스 휠: 맨 위에서 위로 계속 굴리면(당기면) 같은 기준으로 새로 고침. 110만큼 넘게, 0.35초 넘게 이어졌을 때만. */
const WPULL = { d: 0, t0: 0, last: 0, done: false };
window.addEventListener("wheel", e => {
  const now = Date.now();
  if (window.scrollY > 0 || e.deltaY >= 0 || !pullOk()) { WPULL.d = 0; WPULL.done = false; if (PULL.y0 == null) pullShow(0, false); return; }
  if (now - WPULL.last > 400) { WPULL.d = 0; WPULL.t0 = now; WPULL.done = false; }
  WPULL.last = now; WPULL.d += -e.deltaY; if (WPULL.done) return;
  const ready = WPULL.d >= PULL.NEED * 2 && now - WPULL.t0 >= PULL.HOLD; pullShow(WPULL.d / 2, ready);
  clearTimeout(WPULL.tm); WPULL.tm = setTimeout(() => { if (WPULL.done) return; const ok = WPULL.d >= PULL.NEED * 2 && WPULL.last - WPULL.t0 >= PULL.HOLD && pullOk(); WPULL.d = 0; if (ok) { WPULL.done = true; if (PULL.el) PULL.el.textContent = "새로 고치는 중…"; pullRefresh(); } else pullShow(0, false); }, 220);
}, { passive: true });
/* 뜻이 없는 예전 틀렸던 문장의 뜻을 한 번 받아 둔다 (앱을 열고 잠시 뒤, 하던 훈련이 없을 때) */
setTimeout(() => { if (G.key && !A && !REC.on) fixFill(n => { if (n && U.tab === "phr" && !REC.on && !A) render(); }); }, 6000);
