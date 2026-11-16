"use strict";
/* 영어 말하기 코치 — 화면과 훈련 흐름. 기준은 SPEC.md. */
const U = { tab: "home", scene: 0, f: { script: "", phEn: "", phKo: "", askEn: "", bk: "", gkey: "" }, remember: true, tagSel: null, ordSel: null, showZero: false,
  phCat: "all", logN: 20, logOpen: null, note: null, gmsg: null, bkMsg: null, phMsg: null, repMsg: null, copy: null, delAsk: null, talkN: 0, flash: null, smsg: null, diag: null, back: null, ask: null, mic: "", nickMsg: null, loopSrc: "cum", loopRate: +store.get("ec_looprate") || 1, loopEcho: true, loopForever: true, loopMsg: null, shortMsg: null, natOpen: false, natN: 5, natMsg: null, natBusy: null };
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
const KIND = { talk: "대화", retell: "다시 말하기", phr: "구문", dr: "훈련", test: "레벨 테스트", old: "이전 기록" };

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
  U.tab = tab; U.note = (tab === "train" && A && A.phase === "fail" && A.failMsg) ? { text: A.failMsg, err: true } : ((tab === "train" && A && A.phase === "sending" && A.prog) ? { text: A.prog } : null);
  if (tab === "train") U.flash = null;
  render(); window.scrollTo(0, 0);
}

/* ---------- 하던 일 보관과 이어 하기 ---------- */
const hasPend = a => !!a && (a.type === "talk" || a.type === "retell" ? !!a.pend : hasWork(a));
function pendSave() { if (hasPend(A)) idbSet("pend", { t: Date.now(), a: A }); else idbDel("pend"); }
/* 채점이 끝났을 때: 훈련 화면을 보고 있으면 true, 다른 화면이면 알림을 띄우고 false */
function arrived(text) { pendSave(); if (A) A.autoTried = false; if (U.tab !== "train") { U.flash = { text }; render(); return false; } U.note = null; render(); return true; }
function failed(me, why, kind) {
  me.phase = "fail"; me.failMsg = why; me.failKind = kind || "other"; pendSave();
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
function missionsOfWeek(w) { const n = D.MISSIONS.length; return [0, 1, 2].map(i => D.MISSIONS[((w * 3 + i) % n + n) % n]); }
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
function weekHtml() {
  const W = weekView(), goal = DB.set.minutes, st = streak(), r = dayRec(), tdone = dayDone(today()), ns = nextStep();
  let left = 0; const p = PLAN(); ["phr", "dr", "talk", "retell"].forEach(k => { if (p[k] > 0 && r.st[k] < p[k]) left++; });
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
function drawHome() {
  const d = today(), r = dayRec(d), p = PLAN(), goal = DB.set.minutes, min = r.sec / 60, ts = tests(), last = ts[ts.length - 1], prev = ts[ts.length - 2];
  let h = "";
  if (!G.key) h += card("시작하기", '<p>선생님(Gemini)이 녹음을 들으려면 이용 키가 한 번 필요합니다.</p>' + btn("설정 열기", "tab", "set"));
  if (fbReady() && SYNC.ask) h += card("계정 확인이 필요합니다", '<p>이 기기의 기록을 지금 로그인한 계정에 합칠지 정해 주세요.</p>' + btn("설정에서 정하기", "tab", "set"));
  else if (fbReady() && !AUTH.uid) h += card("기기를 바꿔도 기록이 이어지게", '<p class="ec-sub">구글로 로그인하면 휴대폰·아이패드·노트북에서 같은 기록을 씁니다. 기록은 합치기만 하고 지우지 않습니다.</p>' + btn("구글로 로그인", "login"));
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
  /* 오늘 */
  const ns = nextStep(), st = streak();
  let t = '<div class="ec-row between"><b class="ec-today">' + Math.floor(min) + '분 <span class="ec-sub">/ ' + goal + '분</span></b><span class="ec-sub">말한 문장 ' + r.said + '개 · 연속 ' + st + '일</span></div>';
  t += '<div class="ec-bar"><i style="width:' + clamp(Math.round(min / goal * 100), 0, 100) + '%"></i></div>';
  t += '<div class="ec-steps">' + ["phr", "dr", "talk", "retell"].filter(k => p[k] > 0).map(k => {
    const done = stepDone(k);
    return '<button class="ec-step' + (done ? " done" : "") + '" data-act="start" data-arg="' + k + '"><span>' + STEP_NAME[k] + '</span><b>' + (done ? "✓ " : "") + Math.min(r.st[k], 99) + ' / ' + p[k] + '</b></button>';
  }).join("") + '</div>';
  t += ns ? btn((r.st.phr + r.st.dr + r.st.talk + r.st.retell ? "이어서 하기: " : "오늘 루틴 시작: ") + STEP_NAME[ns], "routine", null, "wide") : '<div class="ec-msg">오늘 루틴을 마쳤습니다. 더 하고 싶으면 「훈련」에서 골라 주세요.</div>';
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
  h += card("이번 주 실전 미션", '<p class="ec-sub">앱은 훈련장이고 실전은 사람과 합니다. 한 것은 눌러서 표시해 주세요.</p>' + missionsOfWeek(w).map(m => '<button class="ec-miss' + (mk[m.id] > 0 ? " done" : "") + '" data-act="miss" data-arg="' + m.id + '"><i>' + (mk[m.id] > 0 ? "✓" : "") + '</i><span>' + esc(m.t) + '</span></button>').join(""));
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
  let h = '<p class="ec-sub">선생님과의 대화에서 내 말을 자연스럽게 고쳐 준 답안이 여기에 모입니다. 문장마다 듣고, 쓰고 싶은 문장은 내 구문에 담아 입으로 익히세요. 기록과 함께 계정에 저장됩니다.</p>' +
    btn(L.length ? (U.natOpen ? "접기" : "모범답안 보기 (대화 " + L.length + "번 · " + n + "문장)") : "아직 대화 기록이 없습니다", "natOpen", null, L.length ? (U.natOpen ? "ghost" : "") : "ghost");
  if (U.natOpen && L.length) {
    const have = {}; allPhrases().forEach(p => { have[p.en.toLowerCase()] = 1; });
    const noKo = L.slice(0, U.natN).some(r => natSents(r.nat, r.ns).some(x => !x.ko && !have[x.en.toLowerCase()]));
    L.slice(0, U.natN).forEach(r => { const sc = D.SCENES.find(x => x.id === r.sc), dt = new Date(r.t);
      h += '<div class="ec-hr"></div><p class="ec-sub"><b>' + (dt.getMonth() + 1) + "월 " + dt.getDate() + "일 · " + esc(sc ? sc.name : "대화") + '</b>' + (r.q ? '<br>질문: ' + esc(r.q) : "") + '</p>' + natHtml(r.nat, r.ns); });
    if (noKo) h += '<p class="ec-sub">예전 답안에는 우리말 뜻이 없어, 「뜻 받아 담기」를 누르면 선생님에게 뜻을 받아서 담습니다(요청 한 번). 이번 판부터 하는 대화는 뜻이 함께 나옵니다.</p>';
    if (L.length > U.natN) h += '<div class="ec-row">' + btn("더 보기 (" + (L.length - U.natN) + "번 남음)", "natMore", null, "ghost small") + '</div>';
  }
  return h + msgBox(U.natMsg);
}
/* 이어 듣기: 고른 문장 묶음을 차례로 읽어 준다 */
const LOOP_SRC = { cum: "오늘·어제 익힌 문장", fix: "틀렸던 문장", nat: "선생님 모범답안 (최근 대화 5번)", my: "내 구문 전체", learn: "연습 중인 구문" };
function loopItems(src) {
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
function askHtml() {
  const a = U.ask; if (!a) return "";
  if (a.busy) return '<div class="ec-msg">선생님에게 물어보는 중입니다…</div>';
  if (a.err) return '<div class="ec-msg err">' + esc(a.err) + '</div>';
  const r = a.r, ex = (Array.isArray(r.examples) ? r.examples : []).filter(e => e && e.en).slice(0, 3);
  let h = '<div class="ec-hr"></div><p><b>' + esc(r.en) + '</b> ' + say(r.en, "듣기", "teacher") + '</p><p>' + esc(r.meaning_ko || "") + '</p>';
  if (r.when_ko) h += '<p class="ec-sub">이럴 때: ' + esc(r.when_ko) + '</p>';
  if (r.note_ko) h += '<p class="ec-sub">조심: ' + esc(r.note_ko) + '</p>';
  h += '<div class="ec-row">' + btn(a.added && a.added.m ? "담았습니다" : "이 표현 내 구문에 담기", "askAdd", "m", a.added && a.added.m ? "ghost small" : "small") + '</div>';
  ex.forEach((e, i) => { h += '<p>' + esc(e.en) + ' ' + say(e.en, "듣기") + '<br><span class="ec-sub">' + esc(e.ko || "") + '</span></p><div class="ec-row">' + btn(a.added && a.added[i] ? "담았습니다" : "이 예문 담기", "askAdd", String(i), "ghost small") + '</div>'; });
  return h + msgBox(a.msg);
}
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
  h += row("레벨 테스트", "과제 4개(낭독, 일상 질문, 경험 이야기, 설명). 약 6분, 채점 요청 4번. 일주일에 한 번을 권합니다.", "지금까지 " + tests().length + "번", btn("시작", "start", "test", "ghost"));
  return h;
}

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
  const body = A.type === "batch" ? drawBatch() : (A.type === "talk" ? drawTalk() : (A.type === "retell" ? drawRetell() : drawTest()));
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
  if (it.task === "shadow") return "새 구문입니다. 듣고 그대로 따라 말해 보세요.";
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
  if (it.task === "recall" || it.task === "translate") h += '<div class="ec-task">' + esc(it.ko) + '</div>';
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
function batchSend() {
  const me = A; me.items = me.items.slice(0, me.clips.length);
  const n = me.items.length; if (!n) return;
  me.phase = "sending"; me.quitAsk = false; me.failMsg = ""; pendSave(); setMsg(""); render();
  /* 녹음을 세 개씩 나눠 보낸다. 한 번에 보내는 양이 작아야 느린 연결에서도 끊기지 않고, 끊겨도 받은 데까지는 남는다. */
  if (!Array.isArray(me.part) || me.part.length > n) me.part = [];
  const CH = 3;
  const step = () => {
    if (A !== me) return;
    const from = me.part.length;
    if (from >= n) { finish(); return; }
    const k = Math.min(n, from + CH) - from;
    setMsg("채점 중 " + from + " / " + n + "…");
    const parts = [{ text: "MODE: batch\n" + profileText() + "\nThere are " + k + " items." }];
    for (let j = 0; j < k; j++) {
      const it = me.items[from + j];
      parts.push({ text: "ITEM " + (j + 1) + " | TASK " + it.task + " | TARGET: " + it.en + " | FOCUS: " + (it.focus ? it.focus + " (" + (TAG_EN[it.focus] || FOCUS_EN[it.focus] || "") + ")" : "none") });
      parts.push({ inlineData: { mimeType: "audio/wav", data: me.clips[from + j].b64 } });
    }
    gCall({ sys: sysFor("batch"), parts, temp: 0.2 }, s => { if (A === me) setMsg(s + " (" + from + " / " + n + ")"); }, (r, model) => {
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
      if (me.kind === "phr" && !me.again) srsMark(it.ref, x.ok);
    });
    if (me.kind === "phr" && !me.again) dbSave("srs");
    logAdd({ k: me.kind, n, ok: res.filter(x => x.ok).length, it: me.items.map((it, i) => [it.ref, res[i].ok ? 1 : 0, res[i].score, res[i].tag, res[i].ok ? "" : res[i].heard.slice(0, 80)]), md: model });
    const day = dayRec(); if (me.step) day.st[me.step] += n; day.said += res.filter(x => x.heard).length; daySave();
    me.res = res; me.phase = "done";
    if (arrived(me.title + " 채점이 끝났습니다.")) window.scrollTo(0, 0);
  };
  step();
}
function drawBatchDone() {
  const ok = A.res.filter(x => x.ok).length, n = A.res.length, wrong = n - ok;
  let h = '<div class="ec-big"><b class="' + sCls(ok / n * 100) + '">' + ok + '</b> / ' + n + '</div>';
  h += A.items.map((it, i) => {
    const x = A.res[i], s = A.kind === "phr" ? DB.srs[it.ref] : null;
    return '<div class="ec-res ' + (x.ok ? "ok" : "no") + '"><div class="ec-res-h"><b>' + (x.ok ? "✓" : "✗") + '</b> ' + esc(it.en) + ' ' + say(it.en) + '</div>' +
      (it.task !== "read" && it.ko ? '<div class="ec-sub">' + esc(it.ko) + '</div>' : "") +
      (x.heard ? '<div class="ec-kv">들린 말: ' + esc(x.heard) + '</div>' : "") + (x.note ? '<div class="ec-tip">' + esc(x.note) + '</div>' : "") +
      '<div class="ec-row">' + (x.ok ? "" : tagChip(x.tag)) + (s ? '<span class="ec-sub">다음 복습: ' + dueText(s) + '</span>' : "") + '</div></div>';
  }).join("");
  h += '<div class="ec-row">' + (wrong ? btn("틀린 것만 다시 (" + wrong + "개)", "bWrong", null, "ghost") : "") + nextBtn() + '</div>';
  h += '<div class="ec-kv">AI 채점은 참고 의견입니다. 맞게 말했는데 틀렸다고 나오면 다시 해 보세요.</div>';
  return card(esc(A.title) + " 결과", h);
}

/* ---------- 선생님과 대화 ---------- */
function openerFor(sc) { const list = [sc.open].concat(sc.more || []); return list[(today() + U.talkN) % list.length]; }
function startTalk(idx) {
  if (!needKey()) return;
  const sc = D.SCENES[idx];
  if (sc.script && !U.f.script.trim()) { go("train"); setMsg("읽을 영어 원고를 먼저 넣어 주세요.", true); return; }
  A = { type: "talk", title: sc.name, scene: idx, script: sc.script ? U.f.script.trim().slice(0, 3000) : "", turns: [], q: openerFor(sc), phase: "idle", pend: null, allOpen: false, more: stepDone("talk") };   /* 오늘 몫을 이미 채우고 다시 시작했으면 끊지 않는다 */
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
      fx: c.gram.map(g => ({ a: g.said.slice(0, 120), b: g.better.slice(0, 120), g: g.tag })), pr: c.pron.map(x => ({ w: x.word, g: x.tag })), md: model });
    const day = dayRec(); day.st.talk++; day.said += sentences(c.transcript); daySave();
    me.turns.push({ q: me.q, r: c, m: p.m, words, tags, id: rec.id, model, open: false });
    me.q = c.reply || "Thank you. Please tell me more."; me.pend = null; me.phase = "idle";
    if (!me.more && stepDone("talk")) me.goal = true;            /* 오늘 정한 횟수를 채우면 여기서 끝낸다 */
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
    return h + card("오늘 대화 " + PLAN().talk + "번을 채웠습니다", '<p class="ec-sub">위에서 방금 대답의 고침을 확인하고 마치면 됩니다. 정한 횟수를 채웠으니 여기서 끝냅니다.</p><div class="ec-row">' +
      btn("대화 마치기", "tEnd") + (ns && ns !== "talk" ? btn("다음: " + STEP_NAME[ns], "tNext", null, "ghost") : "") + '</div><div class="ec-row end">' + btn("더 이야기하기", "tMore", null, "ghost small") + '</div>');
  }
  h += '<div class="ec-bub"><small>선생님</small>' + esc(A.q) + '<div>' + say(A.q, "다시 듣기", "teacher") + '</div></div>';
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
    logAdd({ k: "retell", src: src.id, tx: c.transcript.slice(0, 900), cov: c.covered, s: [c.sc.pron, c.sc.inton, c.sc.flu, c.sc.gram], m: me.mp, tags, fx: c.left.map(g => ({ a: g.said.slice(0, 120), b: g.better.slice(0, 120), g: g.tag })), pr: c.pron.map(x => ({ w: x.word, g: x.tag })), md: model });
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
  T.forEach((t, i) => { tags = tags.concat(tagsOf(t.res, t.clip.m, calc[i].words, t.k === "read")); fx = fx.concat(t.res.gram.map(g => ({ a: g.said.slice(0, 120), b: g.better.slice(0, 120), g: g.tag }))); pr = pr.concat(t.res.pron.map(x => ({ w: x.word, g: x.tag }))); });
  const prev = tests().slice(-1)[0] || null;
  logAdd({ k: "test", score: out.total, lv: out.level, parts: out.parts, set: A.set, tags: uniq(tags), fx: fx.slice(0, 8), pr: pr.slice(0, 8), md: T[0].model,
    tasks: T.map((t, i) => ({ k: t.k, tx: t.res.transcript.slice(0, 600), s: [t.res.sc.pron, t.res.sc.inton, t.res.sc.gram, t.res.sc.vocab, t.res.sc.task], m: mPack(t.clip.m, calc[i].words), c: t.res.comment.slice(0, 300) })) });
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
    h += '<h3>' + TEST_NAME[t.k] + '</h3><div class="ec-kv">속도 ' + (w ? Math.round(w) + "단어/분" : "–") + ' · 분당 멈춤 ' + (pp != null ? pp.toFixed(0) : "–") + ' · 높낮이 폭 ' + (t.clip.m.st != null ? t.clip.m.st.toFixed(1) + "반음" : "–") + '</div><p>' + esc(t.res.comment) + '</p><div class="ec-said small">' + esc(t.res.transcript) + '</div>';
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
  const due = dueList().length, cats = [["all", "전체"]].concat(Object.keys(D.CATS).map(c => [c, D.CATS[c]]), [["my", "내 구문"]]);
  let h = card("구문", '<div class="ec-scores">' + statCell("익힘", cnt.known) + statCell("연습 중", cnt.learning) + statCell("새 구문", cnt.new) + '</div><p class="ec-sub">문장을 만들지 말고 덩어리째 꺼내 쓰는 연습입니다. 맞히면 1·3·7·14·30·60일 뒤에 다시 묻고, 네 번 이어 맞히면 「익힘」입니다.</p>' +
    btn(due ? "오늘 복습 시작 (복습할 것 " + due + "개)" : "새 구문 익히기", "start", "phr", "wide"));
  const fx = fixList();
  const cu = pickCumul(20);
  h += card("누적 암송 (오늘 + 어제)", '<p class="ec-sub">오늘 익힌 문장에 어제 익힌 문장을 얹어, 우리말만 보고 이어서 말해 봅니다. 정답은 채점한 뒤에 나옵니다. 자기 전에 한 번 하면 좋습니다. 복습 간격은 바뀌지 않습니다.</p>' +
    btn(cu.length ? "누적 암송 시작 (" + cu.length + "문장)" : "오늘·어제 익힌 문장이 아직 없습니다", "cumGo", null, cu.length ? "" : "ghost"));
  h += card("틀렸던 문장 다시 말하기", '<p class="ec-sub">대화·다시 말하기·레벨 테스트에서 선생님이 고쳐 준 문장은 자동으로 내 구문에 담깁니다. 처음에는 듣고 따라 말하고, 다음부터는 틀렸던 말을 보고 바른 문장으로 말합니다. 입에 붙을 때까지 1·3·7·14·30·60일 간격으로 다시 나옵니다.</p>' +
    '<div class="ec-row">' + btn(fx.length ? "틀렸던 문장 훈련 (" + fx.length + "개 중 " + Math.min(8, fx.length) + "개)" : "아직 고친 문장이 없습니다", "fixGo", null, fx.length ? "" : "ghost") + btn("지난 기록에서 모으기", "fixScan", null, "ghost small") + '</div>' + msgBox(U.fixMsg));
  h += card("이어 듣기 · 따라 말하기", loopCard());
  h += card("선생님 모범답안 모음", natCard());
  h += card("마주친 표현 물어보기", '<p class="ec-sub">오늘 듣거나 읽은 영어 표현을 넣으면 뜻, 내가 쓸 수 있는 상황, 예문을 알려 줍니다. 마음에 들면 내 구문에 담아 입으로 익히세요.</p>' +
    '<label for="ecAskEn">영어 표현</label><input type="text" id="ecAskEn" data-bind="askEn" value="' + esc(U.f.askEn) + '" placeholder="예: I\'m swamped.">' +
    '<div class="ec-row">' + btn(U.ask && U.ask.busy ? "물어보는 중…" : "물어보기", "askGo", null, U.ask && U.ask.busy ? "ghost" : "") + (U.ask && !U.ask.busy ? btn("지우기", "askClear", null, "ghost small") : "") + '</div>' + askHtml());
  h += card("내 구문 담기", '<label for="ecPhEn">영어</label><input type="text" id="ecPhEn" data-bind="phEn" value="' + esc(U.f.phEn) + '" placeholder="예: Let me pray for you."><label for="ecPhKo">우리말 뜻</label><input type="text" id="ecPhKo" data-bind="phKo" value="' + esc(U.f.phKo) + '" placeholder="예: 제가 기도해 드릴게요.">' +
    '<div class="ec-row">' + btn("담기", "phAdd") + '</div>' + msgBox(U.phMsg));
  const list = all.filter(p => U.phCat === "all" || p.c === U.phCat);
  h += '<section class="ec-card"><div class="ec-cats">' + cats.map(c => '<button class="ec-cat" data-act="phCat" data-arg="' + c[0] + '" aria-pressed="' + (U.phCat === c[0]) + '">' + esc(c[1]) + '</button>').join("") + '</div>' +
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
  return esc(r.title || "") + " · 평균 " + r0(avg(r.s || []));
}
function recDetail(r) {
  let h = "";
  if (r.k === "talk" || r.k === "retell") {
    const s = r.s || [], m = r.m || [];
    h += (r.q ? '<p class="ec-sub">질문: ' + esc(r.q) + '</p>' : "") + '<div class="ec-said small">' + esc(r.tx || "(글은 저장 공간을 위해 덜어 냈습니다)") + '</div><div class="ec-scores">' + scoreCell("발음", s[0]) + scoreCell("억양", s[1]) + scoreCell("유창성", s[2]) + scoreCell("문법", s[3]) + '</div>';
    h += '<div class="ec-kv">속도 ' + (m[5] != null ? m[5] + "단어/분" : "–") + ' · 멈춤 ' + (m[2] != null ? m[2] + "번" : "–") + ' · 높낮이 폭 ' + (m[4] != null ? m[4] + "반음" : "–") + '</div>';
    if (r.nat) h += '<h3>자연스러운 표현</h3><div class="ec-nat">' + esc(r.nat) + ' ' + say(r.nat) + '</div>';
    if ((r.fx || []).length) h += r.fx.map(f => '<div class="ec-fix"><del>' + esc(f.a) + '</del> → <b>' + esc(f.b) + '</b></div>').join("");
  } else if (r.k === "phr" || r.k === "dr") {
    h += (r.it || []).map(x => { const it = itemByRef(x[0]); return '<div class="ec-fix"><b>' + (x[1] ? "✓" : "✗") + '</b> ' + esc(it ? it.en : x[0]) + (x[4] ? '<div class="ec-sub">들린 말: ' + esc(x[4]) + '</div>' : "") + '</div>'; }).join("");
  } else if (r.k === "test") {
    h += '<div class="ec-scores">' + Object.keys(PART_NAME).map(k => scoreCell(PART_NAME[k], (r.parts || {})[k])).join("") + '</div>' + (r.tasks || []).map(t => '<h3>' + TEST_NAME[t.k] + '</h3><p class="ec-sub">' + esc(t.c || "") + '</p><div class="ec-said small">' + esc(t.tx || "") + '</div>').join("");
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
  const fx = []; for (let i = DB.log.length - 1; i >= 0 && fx.length < 8; i--) (DB.log[i].fx || []).forEach(f => { if (fx.length < 8) fx.push("- " + f.a + " → " + f.b + " [" + (D.TAGS[f.g] ? D.TAGS[f.g].n : "") + "]"); });
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
  let g = '<p class="ec-sub">선생님 역할을 하는 구글 Gemini의 이용 키입니다. 기록·백업 파일에는 들어가지 않습니다. 구글로 로그인하면 본인만 읽을 수 있는 계정 저장소에 함께 두어, 다른 기기에서도 자동으로 채워집니다. 키는 aistudio.google.com 의 「Get API key」에서 무료로 만듭니다.</p>' +
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
  h += card("하루 목표", '<div class="ec-seg">' + [5, 15, 30, 60].map(m => '<button data-act="minutes" data-arg="' + m + '" aria-pressed="' + (DB.set.minutes === m) + '">' + m + '분</button>').join("") + '</div><p class="ec-sub">' + DB.set.minutes + '분이면 하루에 구문 ' + PLAN().phr + '개, 훈련 ' + PLAN().dr + '문장, 대화 ' + PLAN().talk + '번' + (PLAN().retell ? ', 다시 말하기 ' + PLAN().retell + '번' : '') + '입니다.' + (DB.set.minutes === 5 ? ' 짧게 매일 하는 과정입니다. 하루 목표는 이 기기에만 적용되어 사람마다 다르게 고를 수 있습니다.' : '') + ' 주 6일 기준 한 단계에 ' + planMonths(200) + '.</p>');
  h += card("소리", '<label class="ec-check"><input type="checkbox" id="ecAuto" data-chg="auto"' + (DB.set.autoSpeak ? " checked" : "") + '> 선생님 말과 정답을 자동으로 읽어 주기</label><p class="ec-sub">' + (XI.key && XI.voice ? "지금 읽어 주는 목소리: ElevenLabs " + esc(XI.name) + ". 막히면 기기 목소리로 읽습니다." : "읽어 주는 목소리는 기기에 들어 있는 영어 음성입니다.") + '</p>' + btn("목소리 들어 보기", "voice", null, "ghost small") + drawXi());
  h += drawSyncCard();
  h += '<p class="ec-ver">영어 말하기 코치 v' + BUILD + ' · 설계 문서 SPEC.md</p>';
  return h;
}

/* ---------- 누르기 ---------- */
const ACT = {
  tab: a => { U.tagSel = null; U.ordSel = null; U.delAsk = null; U.back = null; go(a); },
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
  bRedo: () => { A.clips.length = A.i; A.phase = "ask"; setMsg(""); render(); autoSay(A.items[A.i]); },
  bNext: () => { if (A.i + 1 >= A.items.length) { batchSend(); return; } A.i++; A.phase = "ask"; setMsg(""); render(); window.scrollTo(0, 0); autoSay(A.items[A.i]); },
  bSend: () => { if (A.clips.length) batchSend(); },
  bWrong: () => { const items = A.items.filter((it, i) => !A.res[i].ok), a = A; A = null; startBatch(a.kind, items, a.title.replace(/ — 틀린 것 다시$/, "") + " — 틀린 것 다시", null); if (A) A.again = true; },
  /* 대화 */
  tResend: () => talkSend(),
  tDrop: () => { A.pend = null; A.phase = "idle"; setMsg(""); render(); },
  tFold: a => { const t = A.turns[+a]; if (t) { t.open = !t.open; if (A.allOpen) { A.allOpen = false; A.turns.forEach((x, i) => { x.open = i !== +a; }); } render(); } },
  tAll: () => { A.allOpen = !A.allOpen; if (!A.allOpen) A.turns.forEach(t => { t.open = false; }); render(); },
  tSave: a => { const p = String(a).split("."), t = A.turns[+p[0]], ph = t && t.r.phrases[+p[1]]; if (ph) { addMyPhrase(ph.en, ph.ko); syncSoon(); render(); } },
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
    gCall({ sys: sysFor("ask"), temp: 0.2, parts: [{ text: "MODE: ask\nEXPRESSION: " + en }] }, () => {}, r => {
      const ko = r && String(r.meaning_ko || "").trim();
      if (!ko) { show({ text: "뜻을 받지 못했습니다. 잠시 뒤에 다시 눌러 주세요.", err: true }); return; }
      const ok = addMyPhrase(en, ko); if (ok) syncSoon();
      show({ text: ok ? "뜻을 받아 내 구문에 담았습니다: " + ko : "이미 내 구문에 있습니다." });
    }, why => show({ text: why || "뜻을 받지 못했습니다. 잠시 뒤에 다시 눌러 주세요.", err: true })); },
  nickSave: () => { const n = String(U.f.nick != null ? U.f.nick : (DB.set.nick || "")).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 20);
    DB.set.nick = n; dbSave("set"); U.f.nick = null; U.nickMsg = { text: n ? "「" + n + "」(으)로 저장했습니다." + (boardOn() ? "" : " 지금은 공유가 꺼져 있습니다.") : "이름을 비웠습니다. 구글 계정 이름으로 보입니다." }; syncSoon(300); render(); },
  loopGo: () => { if (REC.on) return; const it = loopItems(U.loopSrc); if (!it.length) { U.loopMsg = { text: "이 묶음에는 아직 문장이 없습니다. 다른 묶음을 골라 주세요." }; render(); return; }
    U.loopMsg = null; loopStart(it, { rate: U.loopRate, echo: U.loopEcho, forever: U.loopForever }); render(); },
  loopStop: () => { loopStop(); speakStop(); render(); },
  yestGo: () => { if (REC.on) return; const it = pickYest(3); if (!it.length) { U.shortMsg = { text: "구문을 한 번 익히면 다음 날부터 여기에 복습 문제가 나옵니다." }; render(); return; }
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    A = null; U.tagSel = null; U.ordSel = null; U.shortMsg = null; startBatch("phr", it, "지난 문장 복습", null); if (A) A.again = true; },
  todayGo: () => { const i = D.SCENES.findIndex(x => x.id === "today"); if (i < 0) return; U.scene = i; ACT.start("talk"); },
  askGo: () => {
    if (U.ask && U.ask.busy) return;
    const q = String(U.f.askEn || "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!q) { U.ask = { err: "영어 표현을 넣어 주세요." }; render(); return; }
    const me = U.ask = { q: q, busy: true }, show = () => { if (U.tab === "phr" && !REC.on) render(); };
    render();
    gCall({ sys: sysFor("ask"), temp: 0.2, parts: [{ text: "MODE: ask\nEXPRESSION: " + q }] }, () => {}, r => {
      if (U.ask !== me) return; me.busy = false;
      if (!r || !String(r.en || "").trim()) me.err = (r && r.meaning_ko) || "영어 표현으로 알아듣지 못했습니다. 철자를 확인해 주세요."; else me.r = r;
      show();
    }, why => { if (U.ask !== me) return; me.busy = false; me.err = why || "답을 받지 못했습니다. 잠시 뒤에 다시 물어봐 주세요."; show(); });
  },
  askClear: () => { U.ask = null; U.f.askEn = ""; render(); },
  askAdd: a => { const me = U.ask; if (!me || !me.r) return; const ex = (Array.isArray(me.r.examples) ? me.r.examples : []).filter(e => e && e.en);
    const it = a === "m" ? { en: me.r.en, ko: me.r.meaning_ko } : ex[+a]; if (!it) return;
    const r = addMyPhrase(it.en, it.ko); me.added = me.added || {};
    if (r === false) { me.added[a] = true; me.msg = { text: "이미 내 구문에 있습니다." }; }
    else if (r) { me.added[a] = true; me.msg = { text: "담았습니다. 다음 구문 복습에 먼저 나옵니다." }; syncSoon(); }
    render(); },
  cumGo: () => { if (REC.on) return; const it = pickCumul(20); if (!it.length) return;
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    A = null; U.tagSel = null; U.ordSel = null; startBatch("phr", it, "누적 암송", null); if (A) A.again = true; },
  fixGo: () => { if (REC.on) return; if (!fixList().length) { U.fixMsg = { text: "아직 고친 문장이 없습니다. 대화나 다시 말하기를 하면 여기에 모입니다." }; render(); return; }
    if (A && hasWork(A)) { A.quitAsk = false; go("train"); setMsg("진행 중인 훈련이 있습니다. 먼저 마치거나 「← 목록」으로 끝내 주세요.", true); return; }
    A = null; U.tagSel = null; U.ordSel = null; U.fixMsg = null; startBatch("phr", pickFix(8), "틀렸던 문장 다시 말하기", null); },
  fixScan: () => { const n = fixCollect(); U.fixMsg = { text: n ? "지난 기록에서 고친 문장 " + n + "개를 내 구문에 담았습니다." : "새로 담을 문장이 없습니다. 이미 모두 담겨 있습니다." }; if (n) syncSoon(); render(); },
  phAdd: () => {
    const r = addMyPhrase(U.f.phEn, U.f.phKo);
    if (r === null) U.phMsg = { text: "영어 구문을 넣어 주세요.", err: true };
    else if (r === false) U.phMsg = { text: "이미 있는 구문입니다.", err: true };
    else { U.phMsg = { text: "담았습니다. 다음 구문 복습에 먼저 나옵니다." }; U.f.phEn = ""; U.f.phKo = ""; U.phCat = "my"; syncSoon(); }
    render();
  },
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
  miss: a => { const w = weekNo(today()), m = DB.miss[w] || (DB.miss[w] = {}); m[a] = m[a] > 0 ? -now() : now(); dbSave("miss"); syncSoon(); render(); },
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
function updIdle() { return !REC.on && !(A && (A.phase === "sending" || hasWork(A))) && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)); }
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
pendRestore();
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
LOOP.onPaint = () => { const el = $("ecLoopSt"); if (LOOP.on) { if (el) { el.className = "ec-msg"; el.textContent = loopStatus(); } } else if (U.tab === "phr" && !REC.on) { const y = window.scrollY; render(); window.scrollTo(0, y); } };
