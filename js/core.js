"use strict";
/* 영어 말하기 코치 — 기록, 간격 반복, 녹음·측정, Gemini 연결, 선생님 지시문. 화면은 app.js, 구글 저장은 sync.js. */
const BUILD = 42;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avg = a => { a = a.filter(x => x != null && isFinite(x)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const uniq = a => a.filter((x, i) => x && a.indexOf(x) === i);
const r1 = n => n == null || !isFinite(n) ? null : Math.round(n * 10) / 10;
const num = v => { if (v == null || v === "") return null; v = Number(v); return isFinite(v) ? clamp(Math.round(v), 0, 100) : null; };
const wc = s => String(s || "").split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
const sentences = s => Math.max(1, String(s || "").split(/[.!?]+/).filter(x => /[A-Za-z]/.test(x)).length);
const fmtSec = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); };
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------- 날짜 ---------- */
const Clock = { shift: 0 };                       /* 점검용: 날짜를 앞뒤로 옮긴다 */
const now = () => Date.now() + Clock.shift;
const dayNo = t => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);
const today = () => dayNo(now());
const weekNo = d => Math.floor((d - 4) / 7);      /* 월요일에 시작하는 주 */
const dayLabel = d => { const x = new Date(d * 86400000); return (x.getUTCMonth() + 1) + "/" + x.getUTCDate(); };
const stamp = t => { const d = new Date(t), z = n => ("0" + n).slice(-2); return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) + " " + z(d.getHours()) + ":" + z(d.getMinutes()); };
const hhmm = t => { const d = new Date(t), z = n => ("0" + n).slice(-2); return z(d.getHours()) + ":" + z(d.getMinutes()); };

/* ---------- 기록 저장소 ---------- */
const KEYS = { log: "ec6_log", srs: "ec6_srs", my: "ec6_my", set: "ec6_set", day: "ec6_day", miss: "ec6_miss", gone: "ec6_gone" };
const DB = { log: [], srs: {}, my: [], set: { minutes: 30, autoSpeak: true }, day: {}, miss: {}, gone: {}, saveFail: false };
function dbLoad() {
  const rd = (k, d) => { try { const v = JSON.parse(store.get(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const log = rd(KEYS.log, []), srs = rd(KEYS.srs, {}), my = rd(KEYS.my, []), set = rd(KEYS.set, {}), day = rd(KEYS.day, {}), miss = rd(KEYS.miss, {}), gone = rd(KEYS.gone, {});
  const isMap = v => v && typeof v === "object" && !Array.isArray(v);
  DB.gone = isMap(gone) ? gone : {};
  DB.log = Array.isArray(log) ? log.filter(r => r && r.id && r.t) : [];
  DB.srs = srs && typeof srs === "object" && !Array.isArray(srs) ? srs : {};
  DB.my = Array.isArray(my) ? my.filter(p => p && p.id && p.en) : [];
  DB.day = {};
  if (isMap(day)) Object.keys(day).forEach(d => { const r = day[d]; if (!isMap(r) || !/^\d+$/.test(d)) return; const st = isMap(r.st) ? r.st : {}; DB.day[d] = { sec: +r.sec || 0, said: +r.said || 0, st: { phr: +st.phr || 0, dr: +st.dr || 0, talk: +st.talk || 0, retell: +st.retell || 0, rev: +st.rev || 0, lis: +st.lis || 0 } }; if (st.revNA) DB.day[d].st.revNA = 1; });
  DB.miss = miss && typeof miss === "object" && !Array.isArray(miss) ? miss : {};
  DB.set = { minutes: 30, autoSpeak: true };
  if (set && typeof set === "object") { if ([5, 15, 30, 60].indexOf(set.minutes) >= 0) DB.set.minutes = set.minutes; if (set.autoSpeak === false) DB.set.autoSpeak = false; if (set.share === false) DB.set.share = false; if (typeof set.nick === "string") DB.set.nick = set.nick.slice(0, 20); if (set.level === "easy" || set.level === "std") DB.set.level = set.level; if (+set.rate >= 0.5 && +set.rate <= 1.2) DB.set.rate = +set.rate; }
  return migrate();
}
function dbSave(name) {
  let ok = store.set(KEYS[name], JSON.stringify(DB[name]));
  if (!ok && name === "log") {                    /* 공간이 모자라면 두 달 넘은 기록의 긴 글만 덜어 낸다 (점수·약점은 남김) */
    const old = now() - 60 * 86400000;
    DB.log.forEach(r => { if (r.t < old) { delete r.tx; delete r.nat; delete r.ch; delete r.q; } });
    ok = store.set(KEYS[name], JSON.stringify(DB[name]));
  }
  if (!ok) DB.saveFail = true;
  return ok;
}
function newId() { return now().toString(36) + "-" + Math.random().toString(36).slice(2, 6); }
function logAdd(rec) { rec.id = newId(); rec.t = now(); DB.log.push(rec); dbSave("log"); fixAdd(rec); if (typeof syncMark === "function") syncMark(rec.id); return rec; }
/* 고친 문장 → 내 구문. 틀리게 말한 문장을 보여 주고 바른 문장을 소리 내어 말하게 한다 (간격 반복은 구문과 같다). */
const FIX_MARK = "틀렸던 말: ";
function fixOk(a, b) { const w = String(b || "").trim().split(/\s+/).length; return !!a && !/[\u3131-\uD7A3]/.test(String(a)) && w >= 3 && w <= 16 && /[A-Za-z]/.test(b) && String(a).trim().toLowerCase() !== String(b).trim().toLowerCase(); }
/* 틀렸던 문장은 내 구문에 「틀렸던 말: X ¦ 뜻: Y」로 담는다. 뜻이 있으면 우리말 뜻을 보고 말하는 보통 구문처럼 익히고, 틀렸던 말은 채점 뒤에만 보여 준다. */
const FIX_SEP = " ¦ 뜻: ";
function fixParts(ko) { ko = String(ko || ""); if (ko.indexOf(FIX_MARK) !== 0) return null; const r = ko.slice(FIX_MARK.length), i = r.indexOf(FIX_SEP); return i < 0 ? { was: r, mean: "" } : { was: r.slice(0, i), mean: r.slice(i + FIX_SEP.length) }; }
function fixWas(id) { const p = DB.my.filter(x => x.id === id)[0], f = p && fixParts(p.ko); return f ? f.was : null; }
const koShow = ko => { const f = fixParts(ko); return f && f.mean ? f.mean : String(ko || ""); };
function fixAdd(rec) { let n = 0; ((rec && rec.fx) || []).forEach(f => { if (!f || !fixOk(f.a, f.b)) return;
    const full = f.s && f.k && fixOk(f.a, f.s) && !DB.my.some(p => p.en.toLowerCase() === String(f.b).trim().toLowerCase());      /* 온전한 문장과 뜻이 있으면 조각 대신 문장으로 */
    if (addMyPhrase(full ? f.s : f.b, FIX_MARK + String(f.a).trim() + (full ? FIX_SEP + String(f.k).trim() : ""))) n++; }); return n; }
/* 뜻이 없는 예전 틀렸던 문장: 선생님에게 뜻을 한 번에 받아 채운다 (글 요청 한 번, 스무 개까지) */
const SYS_MEAN = 'You translate short English phrases for a Korean learner. Return ONLY JSON: {"items": [{"i": int, "ko": string}]} with one natural, short Korean meaning (polite 해요체 where a sentence) for each numbered phrase. No explanations.';
let FIX_FILLING = false;
function fixFill(done) {
  const todo = fixList().filter(p => !fixParts(p.ko).mean).slice(0, 20);
  if (!todo.length || FIX_FILLING || !G.key) { if (done) done(0); return; }
  FIX_FILLING = true;
  gCall({ sys: SYS_MEAN, temp: 0.1, lite: true, parts: [{ text: "MODE: mean\n" + todo.map((p, i) => (i + 1) + ". " + p.en).join("\n") }] }, () => {}, r => {
    FIX_FILLING = false; let n = 0;
    (Array.isArray(r && r.items) ? r.items : []).forEach(x => { const p = todo[(+x.i | 0) - 1], ko = String(x && x.ko || "").replace(/\s+/g, " ").trim().slice(0, 120);
      if (p && ko && /[\uAC00-\uD7A3]/.test(ko) && !fixParts(p.ko).mean) { p.ko = (p.ko + FIX_SEP + ko).slice(0, 320); n++; } });
    if (n) { dbSave("my"); if (typeof syncSoon === "function") syncSoon(); }
    if (done) done(n);
  }, () => { FIX_FILLING = false; if (done) done(0); });
}
function fixCollect() { let n = 0; DB.log.forEach(r => { n += fixAdd(r); }); return n; }
function fixList() { return DB.my.filter(p => String(p.ko || "").indexOf(FIX_MARK) === 0); }
function pickFix(n) {
  const d = today(), box = p => { const s = DB.srs[p.id]; return s && s.n > 0 ? (s.d <= d ? s.b : 50 + s.b) : -1; };
  return fixList().slice().sort((x, y) => box(x) - box(y) || y.t - x.t).slice(0, n)
    .map(p => ({ ref: p.id, task: taskFor(p.id), ko: koShow(p.ko), en: p.en, focus: "" }));
}
/* 이전 버전(v1~v5) 기록을 옮겨 온다. 원본(ec_history)은 지우지 않는다. */
function migrate() {
  if (store.get("ec6_migrated")) return 0;
  let a = []; try { a = JSON.parse(store.get("ec_history") || "[]"); } catch (e) {}
  if (!Array.isArray(a)) a = [];
  const have = {}; DB.log.forEach(r => { have[r.id] = 1; });
  let n = 0;
  a.forEach((h, i) => {
    if (!h || !h.t) return; const id = "v5-" + h.t + "-" + i; if (have[id]) return;
    DB.log.push({ id, t: h.t, k: "old", mode: String(h.mode || ""), title: String(h.title || ""), s: [num(h.acc), num(h.prosody), num(h.fluency), num(h.gram)],
      m: [null, null, h.pauses == null ? null : h.pauses, null, h.st == null ? null : r1(h.st), h.wpm == null ? null : Math.round(h.wpm)], n: h.n || 0 });
    n++;
  });
  if (n) { DB.log.sort((x, y) => x.t - y.t); dbSave("log"); }
  if (store.get("ec_autospeak") === "off") { DB.set.autoSpeak = false; dbSave("set"); }
  store.set("ec6_migrated", "1");
  return n;
}

/* ---------- 하루 기록: 연습 시간, 말한 문장 수, 루틴 단계 ---------- */
/* 기초 과정: 설정에서 고르거나(easy/std), 고르지 않았으면 최근 레벨 테스트가 B1 아래일 때 자동으로 켠다 */
function easyMode() { if (DB.set.level === "easy") return true; if (DB.set.level === "std") return false; const t = DB.log.filter(r => r.k === "test" && r.score != null).slice(-1)[0]; return !!t && t.score < 60; }
/* 읽어 주는 빠르기: 설정에서 고른 값, 없으면 기초 과정은 0.8배 */
function sayRate() { const r = +DB.set.rate; return r >= 0.5 && r <= 1.2 ? r : (easyMode() ? 0.8 : 1); }
const PLAN = () => { const P = easyMode() ? D.PLAN_EASY : D.PLAN; return P[DB.set.minutes] || P[30]; };
function dayRec(d) { d = d == null ? today() : d; return DB.day[d] || (DB.day[d] = { sec: 0, said: 0, st: { phr: 0, dr: 0, talk: 0, retell: 0, rev: 0, lis: 0 } }); }
const STEPS = ["rev", "phr", "dr", "talk", "retell", "lis"];
/* 복습·듣기 단계는 이 날부터 루틴에 들어갔다. 그 전 날들의 「루틴 완료」는 예전 네 단계로만 본다. */
function steps2From() { let v = +store.get("ec_steps2") || 0; if (!v) { v = today(); store.set("ec_steps2", String(v)); } return v; }
let lastAct = 0, lastBeat = 0, lastDaySave = 0;
const IDLE_MS = 5 * 60000;
function tick() { lastAct = now(); }               /* 화면을 건드렸다는 표시 */
/* 1초마다 부른다. 앱을 보고 있고 최근 5분 안에 건드렸으면(또는 녹음·채점 중이면) 그 시간을 학습 시간에 더한다. */
function beat(busy) {
  const t = now(), dt = lastBeat ? t - lastBeat : 0; lastBeat = t;
  if (busy) lastAct = t;
  if (typeof document !== "undefined" && document.hidden) return false;
  if (!(dt > 0 && dt < 5000) || t - lastAct >= IDLE_MS) return false;   /* 멈춰 있다가 깨어난 긴 틈은 세지 않는다 */
  const r = dayRec(), was = Math.floor(r.sec / 60);
  r.sec = Math.round((r.sec + dt / 1000) * 10) / 10;
  if (t - lastDaySave > 10000) daySave();
  return Math.floor(r.sec / 60) !== was;
}
function daySave() { lastDaySave = now(); dbSave("day"); }
function dayActive(d) { const r = DB.day[d]; return !!r && (r.sec >= 300 || STEPS.reduce((s, k) => s + (r.st[k] || 0), 0) > 0); }
function streak() { let d = today(), n = 0; if (!dayActive(d)) d--; while (dayActive(d)) { n++; d--; } return n; }
/* 이번 주(월~일) 학습 현황: 날마다 한 시간·루틴 완료 여부, 맞힌 문장, 지난주 같은 요일까지와 견줌 */
function dayDone(d) { const r = DB.day[d], p = PLAN(), from = steps2From(); return !!r && !!r.st && STEPS.every(k => !(p[k] > 0) || (r.st[k] || 0) >= p[k] || ((k === "rev" || k === "lis") && d < from) || (k === "rev" && r.st.revNA)); }
function weekView() {
  const d = today(), mon = weekNo(d) * 7 + 4, days = [], names = ["월", "화", "수", "목", "금", "토", "일"];
  let sec = 0, said = 0, done = 0, act = 0, prev = 0, ok = 0, n = 0, turns = 0;
  for (let i = 0; i < 7; i++) { const x = mon + i, r = DB.day[x] || { sec: 0, said: 0 }, dn = x <= d && dayDone(x);
    days.push({ d: x, name: names[i], min: Math.floor((r.sec || 0) / 60), done: dn, today: x === d, future: x > d });
    if (x <= d) { sec += r.sec || 0; said += r.said || 0; if (dn) done++; if ((r.sec || 0) >= 60 || (r.said || 0) > 0) act++; prev += (DB.day[x - 7] || {}).sec || 0; } }
  DB.log.forEach(r => { const x = dayNo(r.t); if (x < mon || x > d) return; if (r.k === "phr" || r.k === "dr") { ok += +r.ok || 0; n += +r.n || 0; } else if (r.k === "talk") turns++; });
  return { days, min: Math.floor(sec / 60), prevMin: Math.floor(prev / 60), said, done, act, ok, n, turns, passed: d - mon + 1 };
}
/* 실전 미션 마침 표시 (앱이 스스로 한다). 결과 한 줄은 이 기기에만 둔다. */
function missRes() { try { return JSON.parse(store.get("ec_missres") || "{}") || {}; } catch (e) { return {}; } }
function missDone(id, res) {
  const w = weekNo(today()), m = DB.miss[w] || (DB.miss[w] = {}); if (!D.MISSIONS.some(x => x.id === id)) return false;
  m[id] = now(); dbSave("miss");
  const r = missRes(); Object.keys(r).forEach(k => { if (+k < w - 8) delete r[k]; }); (r[w] || (r[w] = {}))[id] = String(res || "").slice(0, 80); store.set("ec_missres", JSON.stringify(r));
  if (typeof syncSoon === "function") syncSoon(); return true;
}
/* 성장 예상: 한 단계에 드는 시간을 B2 아래는 200시간, B2 위는 300시간으로 잡는다(가정). 점수 1점에 드는 시간으로 바꿔 달마다 더한다. */
const SCORE_MAP = [
  { id: "B1", from: 60, to: 75, toeic: "550~784", toefl: "42~71", teps: "약 210~300" },
  { id: "B2", from: 75, to: 89, toeic: "785~944", toefl: "72~94", teps: "약 300~425" }
];
function hoursPerPoint(score) { return score < 75 ? 200 / 15 : 300 / 14; }
function growthPlan(score, minPerDay, daysPerWeek, months) {
  const perMonth = minPerDay * daysPerWeek * 4.345 / 60, pts = [{ m: 0, s: score }], marks = []; let s = score;
  const goals = LEVELS.filter(L => L.min > score);
  for (let m = 1; m <= (months || 24); m++) { let h = perMonth; while (h > 0 && s < 96) { const step = Math.min(h, 1); s += step / hoursPerPoint(s); h -= step; }
    goals.forEach(L => { if (s >= L.min && !marks.some(x => x.id === L.id)) marks.push({ id: L.id, m: m, min: L.min }); }); pts.push({ m: m, s: Math.round(s * 10) / 10 }); }
  return { pts: pts, marks: marks, perMonth: perMonth };
}
function recentMinPerDay() { const d = today(); let s = 0; for (let i = 0; i < 7; i++) s += ((DB.day[d - i] || {}).sec || 0); return s / 60 / 7; }
function totalSec() { let s = 0; Object.keys(DB.day).forEach(d => { s += DB.day[d].sec || 0; }); return s; }
function stepDone(step) { const r = dayRec(), p = PLAN();
  if (step === "rev" && p.rev > 0 && !(r.st.rev > 0)) { if (r.st.revNA) return true; if (!pickYest(3).length) { r.st.revNA = 1; return true; } return false; }   /* 복습할 지난 문장이 없는 날은 건너뛴다 */
  return (r.st[step] || 0) >= (p[step] || 0); }
function nextStep() { const o = STEPS; for (let i = 0; i < o.length; i++) if (!stepDone(o[i])) return o[i]; return null; }
const STEP_NAME = { rev: "⓪ 지난 문장 복습", phr: "① 구문 복습", dr: "② 약점·어순 훈련", talk: "③ 선생님과 대화", retell: "④ 다시 말하기", lis: "⑤ 듣기 · 귀 뚫기" };

/* ---------- 구문 간격 반복 ---------- */
const IV = [0, 1, 3, 7, 14, 30, 60];
/* 정답을 듣고 맞힌 문장: 단계는 올리지 않고 내일 다시 묻는다 */
function srsPeek(id) { const d = today(), s = DB.srs[id] || (DB.srs[id] = { b: 0, d: d, n: 0, k: 0, l: d }); s.n++; s.k++; s.l = d; s.b = Math.max(1, s.b); s.d = d + 1; return s; }
/* 첫 글자 힌트: 낱말마다 첫 글자만 남기고 나머지는 밑줄 */
function hintMask(en) { return String(en || "").split(/\s+/).map(w => w.replace(/[A-Za-z0-9]+(?:'[A-Za-z]+)?/g, (m, off) => off === 0 || !/[A-Za-z0-9]/.test(w.slice(0, off)) ? m[0] + m.slice(1).replace(/[A-Za-z0-9]/g, "_") : m)).join(" "); }
function srsMark(id, ok) {
  const d = today(), s = DB.srs[id] || (DB.srs[id] = { b: 0, d: d, n: 0, k: 0, l: d });
  s.n++; s.l = d;
  if (ok) { s.k++; s.b = Math.min(6, s.b + 1); s.d = d + IV[s.b]; } else { s.b = 1; s.d = d + 1; }
  return s;
}
/* 누적 암송: 오늘과 어제 익힌 문장을 우리말만 보고 이어서 말한다 (어제 것부터). 날마다 새 문장에 어제 문장을 얹어 다시 해 보는 방식. */
function pickCumul(max) {
  const d = today(), by = {}; allPhrases().forEach(p => { by[p.id] = p; });
  return Object.keys(DB.srs).filter(id => by[id] && DB.srs[id].n > 0 && DB.srs[id].l >= d - 1 && DB.srs[id].l <= d)
    .sort((x, y) => DB.srs[x].l - DB.srs[y].l).slice(0, max || 20)
    .map(id => ({ ref: id, task: "recall", ko: by[id].ko, en: by[id].en, focus: "" }));
}
/* 어제 복습: 어제 익힌 문장 가운데 덜 익은 것부터 세 개를 우리말만 보고 말한다. 어제 한 것이 없으면 가장 최근에 한 날의 문장. */
function pickYest(max) {
  const d = today(), by = {}; allPhrases().forEach(p => { by[p.id] = p; });
  const ids = Object.keys(DB.srs).filter(id => by[id] && DB.srs[id].n > 0 && DB.srs[id].l < d);
  if (!ids.length) return [];
  const last = Math.max.apply(null, ids.map(id => DB.srs[id].l));
  return ids.filter(id => DB.srs[id].l === last).sort((x, y) => DB.srs[x].b - DB.srs[y].b).slice(0, max || 3)
    .map(id => ({ ref: id, task: "recall", ko: by[id].ko, en: by[id].en, focus: "" }));
}
function yestAgo() { const d = today(), ls = Object.keys(DB.srs).filter(id => DB.srs[id].n > 0 && DB.srs[id].l < d).map(id => DB.srs[id].l); return ls.length ? d - Math.max.apply(null, ls) : 0; }
/* 선생님 모범답안: 문장별로 끊어 듣고, 모아 두었다가 다시 쓴다. 따로 저장하지 않고 대화 기록(log)에서 꺼낸다. */
function natSplit(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [], out = [];
  raw.forEach(x => { x = x.trim(); if (!x) return;
    const prev = out[out.length - 1];
    if (prev && (/\b(Mr|Mrs|Ms|Dr|St|Rev)\.$/.test(prev) || !/[A-Za-z0-9]/.test(x))) out[out.length - 1] = prev + " " + x; else out.push(x); });
  return out;
}
function natSents(nat, sents) {
  const sp = natSplit(nat), a = (Array.isArray(sents) ? sents : []).filter(x => x && x.en);
  const key = t => String(t).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (a.length && key(a.map(x => x.en).join("")) === key(nat)) return a.map(x => ({ en: String(x.en).trim(), ko: String(x.ko || "").trim() }));
  const by = {}; a.forEach(x => { by[key(x.en)] = String(x.ko || "").trim(); });
  return sp.map(en => ({ en: en, ko: by[key(en)] || "" }));
}
function natList() {                               /* 대화 대답과 레벨 테스트 대답의 모범답안을 한데, 새것부터 */
  const out = [], ok = s => s && /[A-Za-z]/.test(s);
  DB.log.forEach(r => { if (!r) return;
    if (r.k === "talk" && ok(r.nat)) { const sc = D.SCENES.find(x => x.id === r.sc); out.push({ t: r.t, name: sc ? sc.name : "대화", q: r.q || "", nat: r.nat, ns: r.ns }); }
    else if (r.k === "test") (r.tasks || []).forEach((t, i) => { if (ok(t.nat)) out.push({ t: r.t - i, name: "레벨 테스트 · " + (TEST_NAME[t.k] || ""), q: "", nat: t.nat, ns: t.ns }); }); });
  return out.sort((x, y) => y.t - x.t);
}
function basicList() { return easyMode() ? D.BASIC : D.BASIC.filter(p => DB.srs[p.id] && DB.srs[p.id].n > 0); }   /* 표준 과정에서는 이미 익히던 기초 구문만 남긴다 */
/* 기초 과정에서는 표준 구문 가운데 쉬운 두 갈래(일상·생활, 대화 이어가기)만 쓴다. 간증·설교 같은 어려운 구문은 전에 익히던 것이 있어도 복습에 나오지 않는다. */
function stdList() { return easyMode() ? D.PHRASES.filter(p => p.c === "daily" || p.c === "keep") : D.PHRASES; }
function allPhrases() { return DB.my.map(p => ({ id: p.id, c: "my", en: p.en, ko: koShow(p.ko) })).concat(basicList(), stdList()); }
function phraseState(id) { const s = DB.srs[id]; if (!s || !s.n) return "new"; return s.b >= 4 ? "known" : "learning"; }
function newOrder() {                              /* 새 구문 순서: 내가 담은 것 먼저, 그다음 상황별로 하나씩 돌아가며 */
  const cats = Object.keys(D.CATS), by = {}; cats.forEach(c => { by[c] = stdList().filter(p => p.c === c); });
  const out = DB.my.map(p => ({ id: p.id, c: "my", en: p.en, ko: koShow(p.ko) })).concat(easyMode() ? D.BASIC : []);   /* 기초 과정은 쉬운 구문 40개를 먼저 */
  for (let i = 0; ; i++) { let any = false; cats.forEach(c => { if (by[c][i]) { out.push(by[c][i]); any = true; } }); if (!any) break; }
  return out;
}
function dueList() {
  const d = today(), map = {}; allPhrases().forEach(p => { map[p.id] = p; });
  return Object.keys(DB.srs).filter(id => map[id] && DB.srs[id].n > 0 && DB.srs[id].d <= d)
    .sort((a, b) => DB.srs[a].d - DB.srs[b].d || DB.srs[a].b - DB.srs[b].b).map(id => map[id]);
}
function pickPhrases(n) {
  const due = dueList(), fresh = newOrder().filter(p => !(DB.srs[p.id] && DB.srs[p.id].n > 0));
  return due.slice(0, n).concat(fresh.slice(0, Math.max(0, n - due.length)))
    .map(p => ({ ref: p.id, task: taskFor(p.id), ko: p.ko, en: p.en, focus: "" }));
}
/* 새 구문은 한 번, 틀렸던 문장은 두 번 듣고 따라 말한 뒤에 우리말만 보고 말한다 */
function taskFor(id) { const s = DB.srs[id], need = fixWas(id) != null ? 2 : 1; return s && s.k >= need ? "recall" : "shadow"; }
function addMyPhrase(en, ko) {
  en = String(en || "").trim().replace(/\s+/g, " "); ko = String(ko || "").trim();
  if (!en) return null;
  const low = en.toLowerCase();
  if (allPhrases().some(p => p.en.toLowerCase() === low)) return false;
  const p = { id: "my" + newId(), en: en.slice(0, 200), ko: ko.slice(0, 320), t: now() };
  DB.my.push(p); dbSave("my"); return p;
}

/* ---------- 약점 통계 ---------- */
const FREE = { talk: 1, retell: 1, test: 1 };
const DEVICE_TAGS = { d_flat: 1, d_pause: 1, d_slow: 1 };
const DEFAULT_FOCUS = ["g_sva", "g_tense", "g_order"];
function tagEvents() {
  const ev = [];
  DB.log.forEach(r => {
    if (FREE[r.k]) (r.tags || []).forEach(g => ev.push({ t: r.t, g }));
    else if (r.k === "phr" || r.k === "dr") (r.it || []).forEach(x => { if (!x[1] && x[3]) ev.push({ t: r.t, g: x[3] }); });
  });
  return ev;
}
function tagStats() {
  const d = today(), free = DB.log.filter(r => FREE[r.k]), S = {};
  D.TAG_IDS.forEach(g => { S[g] = { g, r: 0, p: 0, tot: 0, last: 0 }; });
  tagEvents().forEach(e => { const s = S[e.g]; if (!s) return; const dd = dayNo(e.t); s.tot++; if (e.t > s.last) s.last = e.t; if (dd > d - 14) s.r++; else if (dd > d - 28) s.p++; });
  const aR = free.filter(r => dayNo(r.t) > d - 14).length, aP = free.filter(r => { const x = dayNo(r.t); return x <= d - 14 && x > d - 28; }).length;
  const list = D.TAG_IDS.map(g => S[g]);
  list.forEach(s => {
    s.grad = s.tot > 3 && free.filter(r => r.t > s.last).length >= 10;
    if (!s.tot) s.trend = "";
    else if (!s.p) s.trend = s.r ? "new" : "quiet";
    else if (!s.r) s.trend = "down";
    else { const a = aR >= 3 && aP >= 3 ? s.r / aR : s.r, b = aR >= 3 && aP >= 3 ? s.p / aP : s.p; s.trend = a < b * 0.8 ? "down" : (a > b * 1.2 ? "up" : "same"); }
  });
  list.sort((x, y) => y.r - x.r || y.p - x.p || y.tot - x.tot || D.TAG_IDS.indexOf(x.g) - D.TAG_IDS.indexOf(y.g));
  return { list, aR, aP };
}
function focusTags() {
  const ids = tagStats().list.filter(s => s.r > 0 && !s.grad).slice(0, 3).map(s => s.g);
  DEFAULT_FOCUS.forEach(g => { if (ids.length < 3 && ids.indexOf(g) < 0) ids.push(g); });
  return ids;
}
function mistakesOf(tag, n) {                      /* 그 약점으로 실제 틀린 문장 (최근 것부터, 같은 것은 한 번만) */
  const out = [], seen = {};
  const add = (t, a, b) => { const k = (a + "|" + b).toLowerCase(); if (a && !seen[k] && out.length < n) { seen[k] = 1; out.push({ t, a, b }); } };
  for (let i = DB.log.length - 1; i >= 0 && out.length < n; i--) {
    const r = DB.log[i];
    (r.fx || []).forEach(f => { if (f.g === tag) add(r.t, f.a, f.b); });
    (r.pr || []).forEach(p => { if (p.g === tag) add(r.t, p.w, ""); });
    if (r.k === "dr" || r.k === "phr") (r.it || []).forEach(x => { if (!x[1] && x[3] === tag && x[4]) { const it = itemByRef(x[0]); add(r.t, x[4], it ? it.en : ""); } });
  }
  return out;
}

/* ---------- 훈련 문장 고르기 ---------- */
function itemByRef(ref) {
  if (String(ref).indexOf("mis:") === 0) { const m = String(ref).split(":"), ms = D.MISSIONS.filter(x => x.id === m[1])[0], it = ms && ms.items && ms.items[+m[2]]; return it ? { ref: ref, ko: it.ko, en: it.en } : null; }
  const i = String(ref).indexOf(":");
  if (i < 0) { const p = allPhrases().filter(x => x.id === ref)[0]; return p ? { ref, ko: p.ko, en: p.en } : null; }
  const key = ref.slice(0, i), idx = parseInt(ref.slice(i + 1), 10);
  if (D.TAGS[key] && D.TAGS[key].dr[idx]) return drillItem(key, idx);
  const o = D.ORDER.filter(x => x.id === key)[0];
  return o && o.dr[idx] ? orderItem(o, idx) : null;
}
function drillItem(tag, idx) { const T = D.TAGS[tag], q = T.dr[idx]; return { ref: tag + ":" + idx, task: T.k === "g" ? "translate" : "read", ko: q.ko, en: q.en, focus: tag }; }
function orderItem(o, idx) { const q = o.dr[idx]; return { ref: o.id + ":" + idx, task: "translate", ko: q.ko, en: q.en, focus: "g_order", rule: o.id }; }
function drillCounts() { const c = {}; DB.log.forEach(r => { if (r.k === "dr") (r.it || []).forEach(x => { c[x[0]] = (c[x[0]] || 0) + 1; }); }); return c; }
function leastDone(prefix, len, n, counts) {
  const idx = []; for (let i = 0; i < len; i++) idx.push(i);
  idx.sort((a, b) => (counts[prefix + ":" + a] || 0) - (counts[prefix + ":" + b] || 0) || a - b);
  return idx.slice(0, n);
}
function leastOrder(counts) {
  const sum = o => o.dr.reduce((s, q, i) => s + (counts[o.id + ":" + i] || 0), 0);
  return D.ORDER.slice().sort((a, b) => sum(a) - sum(b) || D.ORDER.indexOf(a) - D.ORDER.indexOf(b))[0];
}
function pickDrills(n) {
  const top = focusTags().slice(0, 2), counts = drillCounts(), split = n >= 8 ? [3, 3, 2] : (n >= 6 ? [2, 2, 2] : [2, 1, 1]), out = [];
  top.forEach((g, i) => { leastDone(g, D.TAGS[g].dr.length, split[i], counts).forEach(idx => out.push(drillItem(g, idx))); });
  const o = leastOrder(counts);
  leastDone(o.id, o.dr.length, split[2], counts).forEach(idx => out.push(orderItem(o, idx)));
  return out;
}
function tagDrills(tag) { return D.TAGS[tag].dr.map((q, i) => drillItem(tag, i)); }
function orderDrills(id) { const o = D.ORDER.filter(x => x.id === id)[0]; return o ? o.dr.map((q, i) => orderItem(o, i)) : []; }

/* ---------- 참고 등급 ---------- */
const LEVELS = [
  { id: "A2", min: 0, d: "짧고 익숙한 말은 하지만 문장이 자주 끊깁니다." },
  { id: "A2+", min: 52, d: "익숙한 주제로 간단한 대화를 이어 갑니다." },
  { id: "B1", min: 60, d: "일상 주제를 스스로 이어 말하고 경험을 간단히 이야기합니다." },
  { id: "B1+", min: 68, d: "간증처럼 긴 이야기를 순서대로 말할 수 있습니다." },
  { id: "B2", min: 75, d: "원어민과 무리 없이 대화하고 복음을 자기 말로 설명합니다." },
  { id: "B2+", min: 82, d: "원고에 덜 기대어 예배를 인도하고 설교합니다." },
  { id: "C1", min: 89, d: "복잡한 주제도 자연스럽고 정확하게 말합니다." }
];
function levelOf(score) { let L = LEVELS[0]; LEVELS.forEach(x => { if (score != null && score >= x.min) L = x; }); return L; }
function nextLevel(score) { const i = LEVELS.indexOf(levelOf(score)); return LEVELS[i + 1] || null; }
function fluScore(m, words) {                      /* 유창성은 기기 측정만 쓴다 */
  if (!m || m.span < 5 || !words) return null;
  const wpm = words / (m.span / 60), ppm = m.pauses / (m.span / 60);
  return (clamp(40 + (wpm - 60) * 2 / 3, 20, 100) + clamp(103 - 2.8 * ppm, 20, 100)) / 2;
}
function intonDev(m) { return m && m.st != null ? clamp(22 + 9 * m.st, 20, 95) : null; }
const TEST_W = { pron: 25, inton: 15, flu: 20, gram: 20, vocab: 10, task: 10 };
function testScore(tasks) {                        /* tasks: [{k, m, words, sc:{pron,inton,gram,vocab,task}}] */
  const sp = tasks.filter(t => t.k !== "read");
  const iAI = avg(tasks.map(t => t.sc.inton)), iDev = avg(tasks.map(t => intonDev(t.m)));
  let flu = avg(sp.map(t => fluScore(t.m, t.words))); if (flu == null) flu = avg(tasks.map(t => fluScore(t.m, t.words)));
  const parts = { pron: avg(tasks.map(t => t.sc.pron)), inton: iDev == null ? iAI : (iAI == null ? iDev : (iAI + iDev) / 2), flu,
    gram: avg(sp.map(t => t.sc.gram)), vocab: avg(sp.map(t => t.sc.vocab)), task: avg(tasks.map(t => t.sc.task)) };
  let sum = 0, w = 0; Object.keys(TEST_W).forEach(k => { if (parts[k] != null) { sum += parts[k] * TEST_W[k]; w += TEST_W[k]; } });
  const total = w ? Math.round(sum / w * 10) / 10 : null;
  Object.keys(parts).forEach(k => { parts[k] = parts[k] == null ? null : Math.round(parts[k]); });
  return { parts, total, level: total == null ? null : levelOf(total).id };
}
function tests() { return DB.log.filter(r => r.k === "test" && r.score != null); }

/* ---------- 녹음: 마이크 소리를 그대로 받아 WAV로 ---------- */
let CAP = null;
function explainStart(e) {
  if (/NotAllowed|Permission|denied/i.test(e)) return "마이크 사용이 허용되지 않았습니다. 브라우저 설정에서 이 사이트의 마이크를 허용해 주세요.";
  if (/NotFound|no.*microphone|Requested device/i.test(e)) return "마이크를 찾지 못했습니다.";
  return "녹음을 시작하지 못했습니다. " + e.slice(0, 140);
}
function capStart(ok, fail) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fail("이 브라우저는 마이크 녹음을 지원하지 않습니다."); return; }
  navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }).then(stream => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain(), chunks = [];
      mute.gain.value = 0;
      proc.onaudioprocess = e => { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
      CAP = { stream, ctx, src, proc, mute, chunks, rate: ctx.sampleRate };
      ok();
    } catch (e) { try { stream.getTracks().forEach(t => t.stop()); } catch (x) {} fail("녹음을 시작하지 못했습니다. " + (e && e.message || e)); }
  }).catch(e => { fail(explainStart(String((e && e.name) || "") + " " + String((e && e.message) || e))); });
}
function capStop() {
  const c = CAP; CAP = null; if (!c) return null;
  try { c.proc.onaudioprocess = null; c.src.disconnect(); c.proc.disconnect(); c.mute.disconnect(); } catch (e) {}
  try { c.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { c.ctx.close(); } catch (e) {}
  let n = 0, i; for (i = 0; i < c.chunks.length; i++) n += c.chunks[i].length;
  const all = new Float32Array(n); let o = 0; for (i = 0; i < c.chunks.length; i++) { all.set(c.chunks[i], o); o += c.chunks[i].length; }
  return resample(all, c.rate, 16000);
}
function resample(x, from, to) {
  if (from === to) return x;
  const ratio = from / to, n = Math.floor(x.length / ratio), y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio), b = Math.min(x.length, Math.floor((i + 1) * ratio)); let s = 0, c = 0;
    for (let j = a; j < b; j++) { s += x[j]; c++; }
    y[i] = c ? s / c : 0;
  }
  return y;
}
function wavBase64(pcm, rate) {
  const n = pcm.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf); let i;
  const w = (o, str) => { for (let k = 0; k < str.length; k++) v.setUint8(o + k, str.charCodeAt(k)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); }
  const bytes = new Uint8Array(buf), CH = 0x8000; let out = "";
  for (i = 0; i < bytes.length; i += CH) out += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(out);
}

/* ---------- 기기 안에서 재는 값: 말한 시간, 멈춤, 높낮이 폭 ---------- */
function pct(arr, p) { if (!arr.length) return 0; const a = Array.prototype.slice.call(arr).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]; }
function analyze(pcm, rate) {
  const F = Math.round(rate * 0.02), nF = Math.floor(pcm.length / F), rms = new Float32Array(nF); let i, j;
  for (i = 0; i < nF; i++) { let s = 0; for (j = 0; j < F; j++) { const v = pcm[i * F + j]; s += v * v; } rms[i] = Math.sqrt(s / F); }
  const out = { dur: pcm.length / rate, span: 0, speech: 0, pauses: 0, longest: 0, f0: null, st: null, loud: pct(rms, 0.95), a: 0, b: pcm.length };
  if (!nF) return out;
  const floor = pct(rms, 0.1), peak = pct(rms, 0.95), thr = Math.max(floor * 3, peak * 0.12, 0.003), voiced = [];
  for (i = 0; i < nF; i++) voiced.push(rms[i] > thr);
  const first = voiced.indexOf(true), last = voiced.lastIndexOf(true);
  if (first < 0 || peak < 0.004) return out;
  out.span = (last - first + 1) * 0.02; out.a = first * F; out.b = (last + 1) * F;
  let run = 0;
  for (i = first; i <= last; i++) {
    if (voiced[i]) { out.speech += 0.02; if (run >= 25) { out.pauses++; if (run * 0.02 > out.longest) out.longest = run * 0.02; } run = 0; }
    else run++;
  }
  /* 높낮이: 8kHz로 줄여 자기상관으로 기본 주파수 추정 (75~400Hz) */
  const d = resample(pcm, rate, 8000), W = 320, lo = 20, hi = 106, f0s = [];
  for (i = first; i <= last; i += 2) {
    if (!voiced[i]) continue;
    const st = Math.floor(i * 0.02 * 8000); if (st + W + hi >= d.length) break;
    let e0 = 0; for (j = 0; j < W; j++) e0 += d[st + j] * d[st + j];
    if (e0 <= 0) continue;
    let best = 0, bl = 0;
    for (let lag = lo; lag <= hi; lag++) {
      let c = 0, e1 = 0;
      for (j = 0; j < W; j++) { c += d[st + j] * d[st + j + lag]; e1 += d[st + j + lag] * d[st + j + lag]; }
      const r = c / Math.sqrt(e0 * e1 + 1e-12);
      if (r > best) { best = r; bl = lag; }
    }
    if (best > 0.6 && bl > 0) f0s.push(8000 / bl);
  }
  if (f0s.length >= 10) { const p10 = pct(f0s, 0.1), p90 = pct(f0s, 0.9); out.f0 = pct(f0s, 0.5); out.st = 12 * Math.log(p90 / p10) / Math.LN2; }
  return out;
}
function trimPcm(pcm, rate, m) {                   /* 앞뒤 조용한 부분을 잘라 보내는 양을 줄인다 */
  const a = Math.max(0, m.a - Math.round(rate * 0.25)), b = Math.min(pcm.length, m.b + Math.round(rate * 0.3));
  return b - a < rate * 0.2 ? pcm : pcm.subarray(a, b);
}
function wpmOf(m, words) { return m && m.span >= 2 && words ? words / (m.span / 60) : null; }
function ppmOf(m) { return m && m.span >= 5 ? m.pauses / (m.span / 60) : null; }
function mPack(m, words) { const w = wpmOf(m, words); return [r1(m.dur), r1(m.speech), m.pauses, r1(m.longest), r1(m.st), w == null ? null : Math.round(w), r1(m.span)]; }
function deviceTags(m, words, reading) {           /* 평평한 억양·잦은 멈춤·느린 속도는 기기 측정으로 판정 */
  const out = []; if (!m || m.span < 6) return out;
  const wpm = wpmOf(m, words), ppm = ppmOf(m);
  if (m.st != null && m.st < 4) out.push("d_flat");
  if (ppm != null && ppm > 12) out.push("d_pause");
  if (!reading && wpm != null && wpm < 85) out.push("d_slow");
  return out;
}
function pitchLabel(st) { if (st == null) return "측정 안 됨"; if (st < 4) return "좁음"; if (st < 7) return "보통"; return "넓음"; }

/* ---------- 소리 내어 읽기 ---------- */
function speakDevice(text) {
  try {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/\s*\/\s*/g, " ")); u.lang = "en-US"; u.rate = 0.95 * (LOOP.on ? LOOP.rate : sayRate());
    const vs = window.speechSynthesis.getVoices() || [], v = vs.filter(x => x.lang === "en-US")[0];
    if (v) u.voice = v;
    window.speechSynthesis.speak(u); return true;
  } catch (e) { return false; }
}
/* ---------- ElevenLabs 목소리 (선택). 키는 이 기기에만 둔다. 한 번 읽은 문장은 기기에 저장해 다시 쓰므로 크레딧이 또 들지 않는다. ---------- */
const XI = { key: "", voice: "", name: "", pool: [], poolNames: [], voices: [], used: null, limit: null, audio: null, url: "", note: "", off: 0, seq: 0, open: false, stats: { net: 0, hit: 0 } };
const XI_BASE = "https://api.elevenlabs.io/v1/", XI_MODEL = "eleven_flash_v2_5", XI_MAX = 400;
const XI_SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
function xiLoad() { XI.key = store.get("ec_xikey") || ""; XI.voice = store.get("ec_xivoice") || ""; XI.name = store.get("ec_xiname") || ""; XI.off = +store.get("ec_xioff") || 0; if (typeof GT !== "undefined") GT.off = +store.get("ec_gtoff") || 0; try { XI.pool = JSON.parse(store.get("ec_xipool") || "[]") || []; XI.poolNames = JSON.parse(store.get("ec_xipooln") || "[]") || []; } catch (e) { XI.pool = []; XI.poolNames = []; } }
/* 목소리 묶음이 아직 없으면(예전 판에서 키를 넣은 경우) 열 때 한 번 받아 온다 */
function xiEnsurePool() { return (XI.key && XI.pool.length < 2) ? xiVoices().then(() => true, () => false) : Promise.resolve(false); }
function xiOn() { return !!(XI.key && XI.voice) && Date.now() > XI.off; }
function xiErr(status, tx) {
  let d = ""; try { const j = JSON.parse(tx); d = (j.detail && (j.detail.status || j.detail.message)) || j.message || ""; if (typeof d !== "string") d = JSON.stringify(d); } catch (e) { d = String(tx || "").slice(0, 80); }
  if (/api_key_id_used_as_api_key/i.test(d)) return "넣으신 것은 키가 아니라 키의 번호(ID)입니다. 키 값은 만들 때 한 번만 보입니다. ElevenLabs에서 키를 새로 만들고, 그때 화면에 뜨는 sk_ 로 시작하는 글자를 복사해 넣어 주세요.";
  if (/quota_exceeded/i.test(d)) return "ElevenLabs 이번 달 무료 크레딧을 다 썼습니다. 그동안은 Gemini 목소리로 읽고, 크레딧이 다시 차면 자동으로 ElevenLabs로 돌아옵니다.";
  if (status === 401 && /missing_permissions/i.test(d)) return "ElevenLabs 키에 권한이 부족합니다. 키를 만들 때 「Text to Speech」와 「Voices 읽기」 권한을 켜 주세요.";
  if (status === 401) return "ElevenLabs 키가 올바르지 않습니다. 다시 확인해 주세요. (" + d.slice(0, 60) + ")";
  if (status === 429) return "ElevenLabs 요청이 잠시 몰렸습니다. 조금 뒤에 다시 됩니다.";
  return "ElevenLabs 오류 (" + status + " " + d.slice(0, 80) + ")";
}
function xiGet(path, key) {
  return fetchT(XI_BASE + path, { method: "GET", headers: { "xi-api-key": key || XI.key } }, 20000).then(res => res.text().then(tx => { if (!res.ok) throw new Error(xiErr(res.status, tx)); return JSON.parse(tx); }),
    e => { throw new Error("ElevenLabs에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요."); });
}
function xiMix(vs) {                                   /* 남자·여자를 번갈아 놓는다 (남자부터) */
  const m = vs.filter(v => v.gender === "male"), f = vs.filter(v => v.gender === "female"), o = vs.filter(v => v.gender !== "male" && v.gender !== "female"), out = [];
  for (let i = 0; i < Math.max(m.length, f.length); i++) { if (m[i]) out.push(m[i]); if (f[i]) out.push(f[i]); }
  return out.concat(o);
}
function xiVoices(key) {                              /* 미국식이 위로, 그 안에서 남녀를 섞는다 */
  return xiGet("voices", key).then(j => {
    const L = x => String(x || "").toLowerCase();
    const vs = ((j && j.voices) || []).filter(v => v && v.voice_id && v.name).map(v => ({ id: String(v.voice_id), name: String(v.name), gender: L(v.labels && v.labels.gender), accent: L(v.labels && v.labels.accent) }));
    vs.sort((a, b) => a.name.localeCompare(b.name));
    const us = xiMix(vs.filter(v => /americ/.test(v.accent))), rest = xiMix(vs.filter(v => !/americ/.test(v.accent)));
    XI.voices = us.concat(rest);
    const pv = (us.length >= 2 ? us : XI.voices).slice(0, 6);
    XI.pool = pv.map(v => v.id); XI.poolNames = pv.map(v => v.name); store.set("ec_xipool", JSON.stringify(XI.pool)); store.set("ec_xipooln", JSON.stringify(XI.poolNames));
    return XI.voices;
  });
}
function xiUsage(key) { return xiGet("user/subscription", key).then(j => { XI.used = +j.character_count || 0; XI.limit = +j.character_limit || 0; return j; }); }
function xiSetVoice(id) { const v = XI.voices.filter(x => x.id === id)[0]; if (!v) return; XI.voice = v.id; XI.name = v.name; store.set("ec_xivoice", v.id); store.set("ec_xiname", v.name); }
function xiClear() { XI.key = ""; XI.voice = ""; XI.name = ""; XI.voices = []; XI.pool = []; XI.used = XI.limit = null; XI.note = ""; ["ec_xikey", "ec_xivoice", "ec_xiname", "ec_xipool", "ec_xipooln"].forEach(k => store.del(k)); }
/* 소리가 나는 중에는 절대 건드리지 않는다. (화면을 만질 때마다 무음을 다시 틀어 듣던 소리가 끊기던 원인) */
function xiBusyNow() { try { return !!(XI.audio && !XI.audio.paused && !XI.audio.ended && XI.audio.src && XI.audio.src.indexOf("blob:") === 0); } catch (e) { return false; } }
function xiUnlock() { if (XI.open || !XI.key || xiBusyNow()) return; try { if (!XI.audio) XI.audio = new Audio(); XI.audio.src = XI_SILENT; const p = XI.audio.play(); if (p && p.then) p.then(() => { XI.open = true; }, () => {}); } catch (e) {} }
function xiPlay(buf, type) {
  return new Promise(res => {
    try {
      if (!XI.audio) XI.audio = new Audio();
      if (XI.url) URL.revokeObjectURL(XI.url);
      XI.url = URL.createObjectURL(new Blob([buf], { type: type || "audio/mpeg" })); XI.audio.src = XI.url;
      const rate = LOOP.on ? LOOP.rate : sayRate(); try { XI.audio.defaultPlaybackRate = rate; XI.audio.playbackRate = rate; } catch (e) {}   /* 높낮이는 그대로 두고 빠르기만 바꾼다 */
      const p = XI.audio.play(); if (p && p.then) p.then(() => { XI.open = true; res(true); }, () => res(false)); else { XI.open = true; res(true); }
    } catch (e) { res(false); }
  });
}
const ttsHash = t => { let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; };
/* 선생님(대화)은 늘 같은 목소리, 나머지 문장은 여러 목소리. 같은 문장은 늘 같은 목소리라 저장해 둔 것을 다시 쓴다. */
function xiVoiceFor(t, role) { const pool = XI.pool.length ? XI.pool : [XI.voice]; return role === "teacher" ? XI.voice : pool[ttsHash(t) % pool.length]; }
function xiDropVoice(v) { const i = XI.pool.indexOf(v); if (i >= 0 && v !== XI.voice) { XI.pool.splice(i, 1); if (XI.poolNames) XI.poolNames.splice(i, 1); store.set("ec_xipool", JSON.stringify(XI.pool)); store.set("ec_xipooln", JSON.stringify(XI.poolNames || [])); } }
/* 소리 한 개를 구한다: 기기에 있으면 그것, 없으면 ElevenLabs에서 만들어 기기에 저장. 묶음 목소리가 이 계정에서 안 되면 그 목소리를 빼고 선생님 목소리로 만든다. */
function xiBuf(t, role, voice0) {
  const voice = voice0 || xiVoiceFor(t, role), id = "tts:" + voice + ":" + t;
  return idbGet(id).catch(() => null).then(buf => {
    if (buf && buf.byteLength > 200) { XI.stats.hit++; return { buf, made: false }; }
    return fetchT(XI_BASE + "text-to-speech/" + voice + "?output_format=mp3_44100_128", { method: "POST", headers: { "xi-api-key": XI.key, "Content-Type": "application/json" }, body: JSON.stringify({ text: t, model_id: XI_MODEL }) }, 7000)
      .then(res => { if (!res.ok) return res.text().then(tx => { const e = new Error(xiErr(res.status, tx)); e.status = res.status; e.quota = /크레딧을 다 썼/.test(e.message); throw e; }); return res.arrayBuffer(); })
      .then(b => { XI.stats.net++; idbSet(id, b).catch(() => {}); return { buf: b, made: true }; }, e => {
        if (e && e.status >= 400 && e.status < 500 && e.status !== 429 && !e.quota && voice !== XI.voice && XI.voice) { xiDropVoice(voice); return xiBuf(t, "teacher", XI.voice); }
        throw e;
      });
  });
}
function xiSay(t, role, my) { return xiBuf(t, role).then(x => { if (my !== XI.seq) return true; XI.note = ""; return xiPlay(x.buf); }); }
/* 앱에 들어 있는 문장 전부 (구문 → 내 구문 → 훈련 문장 순). 미리 받아 두면 들을 때 크레딧이 들지 않는다. */
const ttsNorm = x => String(x).replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim();
function ttsTexts() {
  const seen = {}, out = [], add = x => { const t = ttsNorm(x); if (t && t.length <= XI_MAX && /[A-Za-z]/.test(t) && !seen[t]) { seen[t] = 1; out.push(t); } };
  D.PHRASES.forEach(p => add(p.en)); DB.my.forEach(p => add(p.en));
  const walk = o => { if (!o || typeof o !== "object") return; if (typeof o.en === "string") add(o.en); if (Array.isArray(o.ex)) o.ex.forEach(x => { if (typeof x === "string") add(x); }); Object.keys(o).forEach(k => walk(o[k])); };
  walk(D.ORDER); walk(D.TAGS);
  return out;
}
function ttsPrefetch(onProg) {
  if (XI.pre && XI.pre.on) return;
  const list = ttsTexts(), P = XI.pre = { on: true, n: list.length, i: 0, made: 0, chars: 0, msg: "", stop: false };
  const end = msg => { P.on = false; P.msg = msg; if (onProg) onProg(); };
  const step = () => {
    if (P.stop) { end("멈췄습니다. " + P.i + " / " + P.n + "개까지 기기에 있습니다."); return; }
    if (P.i >= P.n) { end("문장 " + P.n + "개가 모두 기기에 저장되어 있습니다. (이번에 새로 만든 것 " + P.made + "개 · " + P.chars.toLocaleString() + "자)"); return; }
    const t = list[P.i];
    xiBuf(t).then(x => { P.i++; if (x.made) { P.made++; P.chars += t.length; } if (onProg && (x.made || P.i % 10 === 0)) onProg(); setTimeout(step, x.made ? 250 : 0); },
      e => { if (e && e.quota) ttsOff("x", 6 * 3600000); XI.note = String(e && e.message || e); end(P.i + " / " + P.n + "개까지 받았습니다. " + XI.note); });
  };
  step();
}
/* Gemini 목소리: ElevenLabs 크레딧이 떨어졌을 때 대신 읽는다. 이것도 안 되면 기기 목소리. */
const GT = { off: 0, note: "", models: ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"], teacher: "Achird", pool: ["Kore", "Puck", "Charon", "Aoede", "Leda", "Orus"], stats: { net: 0, hit: 0 } };
function gtFetch(t, voice, i) {
  return fetchT(G_BASE + "interactions", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": G.key },
    body: JSON.stringify({ model: GT.models[i], input: [{ type: "user_input", content: [{ type: "text", text: t }] }], response_format: { type: "audio" }, generation_config: { speech_config: [{ voice: voice }] } }) }, 8000)
    .then(res => res.text().then(tx => {
      if (!res.ok) { if (i + 1 < GT.models.length) return gtFetch(t, voice, i + 1); throw new Error("Gemini 목소리를 쓰지 못했습니다 (" + res.status + "). 기기 목소리로 읽습니다."); }
      let d = ""; try { (JSON.parse(tx).steps || []).forEach(st => (st.content || []).forEach(c => { if (!d && c && typeof c.data === "string" && c.data.length > 100) d = c.data; })); } catch (e) {}
      if (!d) throw new Error("Gemini 목소리 응답에 소리가 없습니다. 기기 목소리로 읽습니다.");
      const bin = atob(d), u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
      return u.buffer;
    }));
}
function gtSay(t, role, my) {
  const voice = role === "teacher" ? GT.teacher : GT.pool[ttsHash(t) % GT.pool.length], id = "tts:g:" + voice + ":" + t;
  return idbGet(id).catch(() => null).then(buf => {
    if (buf && buf.byteLength > 200) { GT.stats.hit++; return buf; }
    return gtFetch(t, voice, 0).then(b => { GT.stats.net++; idbSet(id, b).catch(() => {}); return b; });
  }).then(buf => { if (my !== XI.seq) return true; GT.note = ""; return xiPlay(buf, "audio/wav"); });
}
/* 누른 그 순간(손가락 동작 안)에 소리 낼 준비를 해 둔다. 아이폰은 이렇게 해야 조금 뒤에 받은 소리를 틀 수 있다. */
function ttsPrime() { if (XI.open) return; try { if (!XI.audio) XI.audio = new Audio(); XI.audio.src = XI_SILENT; const p = XI.audio.play(); if (p && p.then) p.then(() => { XI.open = true; }, () => {}); } catch (e) {} }
function ttsBusy(on) {
  try { let el = document.getElementById("ecTts"); if (!el) { if (!on) return; el = document.createElement("div"); el.id = "ecTts"; el.textContent = "소리 불러오는 중…"; el.setAttribute("style", "position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:60;background:rgba(20,40,34,.92);color:#fff;font-size:13px;padding:7px 14px;border-radius:999px;pointer-events:none"); document.body.appendChild(el); } el.style.display = on ? "block" : "none"; } catch (e) {}
}
function ttsOff(k, ms) { const u = Date.now() + ms; if (k === "x") XI.off = u; else GT.off = u; store.set(k === "x" ? "ec_xioff" : "ec_gtoff", String(u)); }
function speak(text, role) {
  if (!XI.key) { XI.seq++; return speakDevice(text); }   /* 차례 번호를 올려야 이어 듣기가 다른 「듣기」를 알아챈다 */
  ttsPrime();
  const t = ttsNorm(text);
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  const my = ++XI.seq, short = t && t.length <= XI_MAX;
  const viaG = () => (short && G.key && Date.now() > GT.off) ? gtSay(t, role, my).catch(e => { GT.note = String(e && e.message || e); ttsOff("g", 30 * 60000); return false; }) : Promise.resolve(false);
  const first = (short && xiOn()) ? xiSay(t, role, my).catch(e => { XI.note = String(e && e.message || e); ttsOff("x", e && e.quota ? 6 * 3600000 : 2 * 60000); return viaG(); }) : viaG();
  ttsBusy(true);
  first.then(ok => { if (my === XI.seq) ttsBusy(false); if (!ok && my === XI.seq) speakDevice(text); });
  return true;
}
/* ---------- 이어 듣기: 문장 목록을 차례로 읽고, 따라 말할 틈을 두고, 멈출 때까지 되풀이 ---------- */
const LOOP = { on: false, list: [], i: 0, id: 0, rate: 1, echo: true, forever: true, onPaint: null };
/* 소리가 나는 중인가 (이어 듣기, 받아 온 소리, 기기 목소리). 새 버전으로 바꾸는 일은 이때 하지 않는다. */
function ttsPlaying() { try { return LOOP.on || !!(XI.audio && !XI.audio.paused && !XI.audio.ended && XI.audio.currentTime > 0) || !!(window.speechSynthesis && window.speechSynthesis.speaking); } catch (e) { return false; } }
/* 소리 없는 구간을 오디오로 만들어 이어 붙인다. 타이머는 화면이 꺼지면 멈추지만 재생 중인 오디오는 이어진다. */
function silentWav(ms) {
  const sr = 8000, n = Math.max(1, Math.round(sr * ms / 1000)), buf = new ArrayBuffer(44 + n), dv = new DataView(buf), w = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
  w(0, "RIFF"); dv.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, "data"); dv.setUint32(40, n, true);
  for (let i = 0; i < n; i++) dv.setUint8(44 + i, 128);
  return buf;
}
function loopGap(ms) {
  return new Promise(res => {
    let done = false; const fin = () => { if (done) return; done = true; clearTimeout(t); try { if (XI.audio) XI.audio.removeEventListener("ended", fin); } catch (e) {} res(); };
    const t = setTimeout(fin, ms + 1500);
    if (!XI.key || !XI.audio) { clearTimeout(t); setTimeout(fin, ms); return; }
    try { XI.audio.addEventListener("ended", fin); xiPlay(silentWav(ms), "audio/wav").then(ok => { if (!ok) { try { XI.audio.removeEventListener("ended", fin); } catch (e) {} setTimeout(fin, ms); } else { try { XI.audio.playbackRate = 1; } catch (e) {} } }); } catch (e) { setTimeout(fin, ms); }
  });
}
function loopPaint() { if (LOOP.onPaint) try { LOOP.onPaint(); } catch (e) {} }
function speakWait(text, role) {                     /* 한 문장을 읽고 끝나면 걸린 시간(ms)을 준다. 다른 소리가 끼어들면 -1 */
  return new Promise(res => {
    if (!speak(text, role)) { res(-1); return; }
    const my = XI.seq, t0 = Date.now(); let started = 0, over = false;
    const onEnd = () => { if (over || XI.seq !== my || !started) return; over = true; clearInterval(iv); try { XI.audio.removeEventListener("ended", onEnd); } catch (e) {} res(Date.now() - started); };
    const hook = () => { try { if (XI.audio) XI.audio.addEventListener("ended", onEnd); } catch (e) {} }; hook();
    const iv = setInterval(() => {
      if (over) return;
      if (XI.seq !== my) { over = true; clearInterval(iv); try { if (XI.audio) XI.audio.removeEventListener("ended", onEnd); } catch (e) {} res(-1); return; }
      const a = XI.audio, ap = !!(a && !a.paused && !a.ended && a.currentTime > 0), sp = !!(window.speechSynthesis && window.speechSynthesis.speaking), now = Date.now();
      if (ap && a.playbackRate !== LOOP.rate && LOOP.on) { try { a.playbackRate = LOOP.rate; } catch (e) {} }
      if (!started) { if (ap || sp) { started = now; hook(); } else if (now - t0 > 25000) { over = true; clearInterval(iv); res(0); } return; }
      if (!ap && !sp && now - started > 250) { over = true; clearInterval(iv); try { if (XI.audio) XI.audio.removeEventListener("ended", onEnd); } catch (e) {} res(now - started); }
    }, 120);
  });
}
function loopStop() { if (!LOOP.on) return; LOOP.on = false; LOOP.id++; try { if (XI.audio) { XI.audio.defaultPlaybackRate = 1; XI.audio.playbackRate = 1; } } catch (e) {} try { if (navigator.mediaSession) navigator.mediaSession.playbackState = "none"; } catch (e) {} loopPaint(); }
function loopStart(list, opt) {
  loopStop(); list = (list || []).filter(x => x && x.en); if (!list.length) return false;
  opt = opt || {}; LOOP.list = list; LOOP.i = 0; LOOP.rate = +opt.rate || 1; LOOP.echo = opt.echo !== false; LOOP.forever = opt.forever !== false; LOOP.on = true;
  const id = ++LOOP.id, wait = ms => new Promise(r => setTimeout(r, ms));
  ttsPrime(); try { if (XI.audio) XI.audio.defaultPlaybackRate = LOOP.rate; } catch (e) {}
  try { if (navigator.mediaSession) { navigator.mediaSession.setActionHandler("pause", loopStop); navigator.mediaSession.setActionHandler("stop", loopStop); } } catch (e) {}
  const step = () => {
    if (id !== LOOP.id || !LOOP.on) return;
    if (LOOP.i >= LOOP.list.length) { if (LOOP.onPass) try { LOOP.onPass(LOOP.list.length); } catch (e) {} if (!LOOP.forever) { loopStop(); return; } LOOP.i = 0; }
    const it = LOOP.list[LOOP.i]; loopPaint();
    try { if (navigator.mediaSession && window.MediaMetadata) { navigator.mediaSession.metadata = new MediaMetadata({ title: it.en, artist: "이어 듣기 " + (LOOP.i + 1) + " / " + LOOP.list.length, album: "영어 말하기 코치" }); navigator.mediaSession.playbackState = "playing"; } } catch (e) {}
    speakWait(it.en, it.role).then(ms => {
      if (id !== LOOP.id || !LOOP.on) return;
      if (ms < 0) { loopStop(); return; }               /* 다른 「듣기」를 눌렀거나 녹음을 시작했으면 멈춘다 */
      const seq0 = XI.seq;
      return loopGap(LOOP.echo ? Math.min(12000, Math.max(1200, ms * 1.15 + 500)) : 600).then(() => { if (id !== LOOP.id || !LOOP.on) return; if (XI.seq !== seq0) { loopStop(); return; } LOOP.i++; step(); });
    });
  };
  step(); return true;
}
/* ---------- 배지·출석: 저장하지 않고 기록에서 계산한다 ---------- */
function bestStreak() { const ds = Object.keys(DB.day).map(Number).filter(dayActive).sort((a, b) => a - b); let best = 0, run = 0, prev = null; ds.forEach(d => { run = prev != null && d === prev + 1 ? run + 1 : 1; if (run > best) best = run; prev = d; }); return best; }
function badgeList() {
  const bs = Math.max(bestStreak(), streak()), act = Object.keys(DB.day).filter(d => dayActive(+d)).length, rd = Object.keys(DB.day).filter(d => dayDone(+d)).length;
  const known = allPhrases().filter(p => phraseState(p.id) === "known").length, hrs = totalSec() / 3600, nt = DB.log.filter(r => r.k === "talk").length, nr = DB.log.filter(r => r.k === "retell").length;
  const fx = fixList().filter(p => DB.srs[p.id] && DB.srs[p.id].n > 0).length, ts = DB.log.filter(r => r.k === "test" && r.score != null).length;
  const B = (id, n, d, now, goal) => ({ id: id, n: n, d: d, ok: now >= goal, now: Math.min(now, goal), goal: goal });
  return [
    B("first", "첫걸음", "처음으로 연습한 날", act, 1), B("s3", "3일 연속", "사흘 이어서 연습", bs, 3), B("s7", "7일 연속", "일주일 이어서 연습", bs, 7), B("s30", "30일 연속", "한 달 이어서 연습", bs, 30),
    B("r1", "루틴 첫 완료", "하루 루틴을 모두 마침", rd, 1), B("r10", "루틴 10일", "루틴을 마친 날 10일", rd, 10), B("r50", "루틴 50일", "루틴을 마친 날 50일", rd, 50),
    B("k10", "구문 10개 익힘", "네 번 이어 맞힌 구문 10개", known, 10), B("k50", "구문 50개 익힘", "네 번 이어 맞힌 구문 50개", known, 50),
    B("t20", "대화 20번", "선생님과 대답 20번", nt, 20), B("t100", "대화 100번", "선생님과 대답 100번", nt, 100), B("re10", "다시 말하기 10번", "고친 표현으로 다시 말함", nr, 10),
    B("f10", "틀린 문장 10개 다시", "틀렸던 문장 10개를 다시 말함", fx, 10), B("h10", "10시간", "누적 연습 10시간", Math.floor(hrs), 10), B("h50", "50시간", "누적 연습 50시간", Math.floor(hrs), 50), B("lv", "첫 레벨 테스트", "지금 수준을 재어 봄", ts, 1)
  ];
}
function attendance(weeks) { const d = today(), mon = weekNo(d) * 7 + 4, start = mon - 7 * ((weeks || 12) - 1), out = []; for (let x = start; x < mon + 7; x++) out.push({ d: x, v: x > d ? -1 : dayDone(x) ? 2 : dayActive(x) ? 1 : 0, today: x === d }); return out; }
function speakStop() { XI.seq++; ttsBusy(false); try { if (XI.audio) XI.audio.pause(); } catch (e) {} try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }

/* ---------- Gemini 연결: 좋은 모델부터, 막히면 다음 모델로 ---------- */
const G = { key: "", model: "", chain: [], block: {}, dead: {}, onChain: null };
const G_BASE = "https://generativelanguage.googleapis.com/v1beta/";
function gLoad() {
  G.key = store.get("ec_gkey") || ""; G.model = store.get("ec_gmodel") || "";
  try { const c = JSON.parse(store.get("ec_gchain") || "[]"); if (Array.isArray(c)) G.chain = c; } catch (e) {}
  try { const q = JSON.parse(store.get("ec_gquota") || "{}"); if (q && typeof q === "object") G.block = q; } catch (e) {}
}
function gErr(status, bodyText) {
  let m = ""; try { const j = JSON.parse(bodyText); m = (j.error && j.error.message) || ""; } catch (e) { m = String(bodyText || ""); }
  if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(m)) return "Gemini 이용 키가 올바르지 않습니다. 「설정」에서 다시 확인해 주세요.";
  if (status === 401 || status === 403) return "이 키로는 쓸 수 없습니다. 키를 새로 만들거나 권한을 확인해 주세요. (" + m.slice(0, 120) + ")";
  if (status === 404) return "선택한 모델을 찾지 못했습니다. 「설정」에서 「저장하고 모델 확인」을 눌러 주세요.";
  if (status === 429) return "무료 사용 한도를 잠시 넘었습니다. 1분쯤 뒤에 다시 해 주세요.";
  if (status >= 500) return "구글 서버가 잠시 응답하지 않습니다. 조금 뒤에 다시 해 주세요.";
  return "Gemini 요청이 거절됐습니다. (" + status + ") " + m.slice(0, 160);
}
function gVer(n) { const m = /gemini-(\d+(?:\.\d+)?)/.exec(n); return m ? parseFloat(m[1]) : 0; }
function gRank(names) {                            /* 정식 Flash(새 것 먼저) → 미리보기 Flash → Flash-Lite → 미리보기 Flash-Lite */
  const grp = n => (/lite/.test(n) ? 2 : 0) + (/preview|exp|latest/.test(n) ? 1 : 0);
  let pool = names.filter(n => /flash/.test(n)); if (!pool.length) pool = names.slice();
  return pool.slice().sort((x, y) => grp(x) - grp(y) || gVer(y) - gVer(x) || (x < y ? -1 : 1));
}
function gNextReset() { const d = new Date(); let r = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0); if (r <= d.getTime()) r += 86400000; return r; }
function gBlock(model, until) { G.block[model] = until; store.set("ec_gquota", JSON.stringify(G.block)); }
/* 답이 없거나 서버 오류를 낸 모델은 점점 길게 쉬게 한다 (10분 → 30분 → 1시간 30분 → 3시간). 한 번 잘 되면 처음으로 돌아간다. */
function gSlowLoad() { try { const q = JSON.parse(store.get("ec_gslow") || "{}"); G.slow = (q && typeof q === "object") ? q : {}; } catch (e) { G.slow = {}; } }
function gSlow(model) { if (!G.slow) gSlowLoad(); const n = (G.slow[model] = (+G.slow[model] || 0) + 1); store.set("ec_gslow", JSON.stringify(G.slow)); gBlock(model, Date.now() + Math.min(180, 10 * Math.pow(3, n - 1)) * 60000); }
function gFine(model) { if (!G.slow) gSlowLoad(); if (G.slow[model]) { delete G.slow[model]; store.set("ec_gslow", JSON.stringify(G.slow)); } }
function gFree(model) { const u = G.block[model]; return !G.dead[model] && !(u && u > Date.now()); }
/* 모델 순서. 무료 한도는 Flash가 하루 20번쯤, Flash-Lite가 하루 500번쯤이라, 짧은 문장 채점(lite)은 Lite부터 써서 좋은 모델의 한도를 대화·레벨 테스트에 남긴다. */
/* 깨진 우리말 찾기: 쓰이지 않는 한글 글자(예: 멃, 퓩)가 들어 있으면 모델이 글자를 잘못 만든 것이다. */
let KO_SET = null;
function koBadText(t) { if (!KO_SET) { KO_SET = {}; for (let i = 0; i < D.KO_COMMON.length; i++) KO_SET[D.KO_COMMON[i]] = 1; }
  t = String(t || ""); for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3 && !KO_SET[t[i]]) return true; } return false; }
function koBad(o) { if (typeof o === "string") return koBadText(o); if (o && typeof o === "object") return Object.keys(o).some(k => koBad(o[k])); return false; }
function koStrip(o) { if (typeof o === "string") return koBadText(o) ? "" : o; if (Array.isArray(o)) return o.map(koStrip); if (o && typeof o === "object") { const r = {}; Object.keys(o).forEach(k => { r[k] = koStrip(o[k]); }); return r; } return o; }
function gOrder(lite) {
  let c = G.chain.filter(n => n !== G.model);
  if (lite && !G.model) c = c.filter(n => /lite/i.test(n)).concat(c.filter(n => !/lite/i.test(n)));
  if (G.model) c.unshift(G.model); return c;
}
function gReset() { G.block = {}; G.dead = {}; G.slow = {}; store.del("ec_gquota"); store.del("ec_gslow"); if (G.onChain) G.onChain(); }
function gStateOf(n) { const u = G.block[n]; return G.dead[n] ? "쓸 수 없음" : (u && u > Date.now() ? ((G.slow && G.slow[n]) ? "응답이 느려 쉬는 중 · " + hhmm(u) + "쯤 다시 시도" : (u - Date.now() > 10 * 60000 ? "오늘 한도 소진 · " + hhmm(u) + "쯤 다시 열림" : "잠시 대기 중")) : "사용 가능"); }
function gList(done, fail) {
  fetch(G_BASE + "models?pageSize=200", { headers: { "x-goog-api-key": G.key } }).then(res => res.text().then(tx => {
    if (!res.ok) { fail(gErr(res.status, tx)); return; }
    let j = {}; try { j = JSON.parse(tx); } catch (e) {}
    const names = (j.models || []).filter(m => {
      const n = String(m.name || ""), ok = (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0;
      return ok && /gemini/.test(n) && !/tts|image|embedding|live|native-audio|robotics|computer|gemma|pro/i.test(n);
    }).map(m => String(m.name).replace(/^models\//, "")).filter(n => !G.dead[n]);
    const chain = gRank(names);
    if (!chain.length) { fail("키는 확인됐지만 쓸 수 있는 모델을 찾지 못했습니다."); return; }
    G.chain = chain; store.set("ec_gchain", JSON.stringify(chain));
    if (G.model && chain.indexOf(G.model) < 0) { G.model = ""; store.set("ec_gmodel", ""); }
    if (G.onChain) G.onChain();
    done(gOrder()[0], chain);
  })).catch(() => { fail("구글에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요."); });
}
function gStuck() {
  const t = Date.now(), until = gOrder().map(n => G.block[n] || 0).filter(u => u > t);
  if (!until.length) return "쓸 수 있는 모델을 찾지 못했습니다. 「설정」에서 「저장하고 모델 확인」을 다시 눌러 주세요.";
  const soon = Math.min.apply(null, until);
  if (soon - t > 10 * 60000) return "오늘 무료 한도를 모든 모델에서 다 썼습니다. " + hhmm(soon) + "쯤 다시 쓸 수 있습니다. 녹음은 그대로 두었으니 그때 「다시 보내기」를 눌러 주세요.";
  return "무료 사용 한도를 잠시 넘었습니다. 1분쯤 뒤에 「다시 보내기」를 눌러 주세요.";
}
function parseJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}
function fetchT(url, opt, ms) {
  const ctl = (typeof AbortController !== "undefined") ? new AbortController() : null; let timer = null;
  if (ctl) { opt.signal = ctl.signal; timer = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, ms); }
  return fetch(url, opt).then(r => { if (timer) clearTimeout(timer); return r; }, e => { if (timer) clearTimeout(timer); throw e; });
}
/* 답의 본문을 다 받을 때까지를 시간 제한에 넣는다 (머리말만 오고 본문이 멈추는 경우에도 끊긴다) */
function fetchTx(url, opt, ms) {
  const ctl = (typeof AbortController !== "undefined") ? new AbortController() : null; let timer = null;
  if (ctl) { opt.signal = ctl.signal; timer = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, ms); }
  const off = () => { if (timer) clearTimeout(timer); };
  return fetch(url, opt).then(r => r.text().then(tx => ({ status: r.status, ok: r.ok, tx }))).then(x => { off(); return x; }, e => { off(); throw e; });
}
const G_ACTIVE = [];
function gCancelAll() { G_ACTIVE.splice(0).forEach(h => { try { h.cancel(); } catch (e) {} }); }
/* req: {sys, parts, temp}. status(글): 진행 안내. done(답 객체, 모델 이름). fail(이유, 종류: net 연결 · quota 한도 · 그 밖). */
const G_WAIT = 50000;                                /* 한 모델을 기다리는 가장 긴 시간 */
function gCall(req, status, done0, fail0) {
  if (!G.key) { fail0("Gemini 이용 키가 없습니다. 「설정」에서 키를 넣어 주세요."); return; }
  /* 답이 늦으면 기다리지 않고 다음 모델에도 함께 보낸다. 먼저 온 답을 쓰고, 늦은 모델은 한동안 건너뛴다. */
  let settled = false, hedgeT = null; const live = {};
  const liveN = () => Object.keys(live).length;
  const handle = { cancel: () => { settled = true; clearTimeout(hedgeT); } }; G_ACTIVE.push(handle);
  const gone = () => { const i = G_ACTIVE.indexOf(handle); if (i >= 0) G_ACTIVE.splice(i, 1); };
  const done = (r, model) => { if (settled) return; settled = true; gone(); clearTimeout(hedgeT); Object.keys(live).forEach(m => { if (m !== model) gSlow(m); }); if (G.onChain) G.onChain(); done0(r, model); };
  const fail = (why, kind) => { if (settled) return; if (liveN() > 0) return; settled = true; gone(); clearTimeout(hedgeT); fail0(why, kind); };
  const nAudio = (req.parts || []).filter(p => p && p.inlineData).length, hedgeMs = G.hedgeMs || (12000 + 2500 * nAudio);
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: req.sys }] },
    contents: [{ role: "user", parts: req.parts }],
    generationConfig: { responseMimeType: "application/json", temperature: req.temp == null ? 0.4 : req.temp }
  });
  const tried = [], netTry = {}; let lastNet = "", netN = 0;
  const next0 = why => { if (why) status(why); if (!G.chain.length) { gList(() => run(), fail); return; } run(); };
  function run() {
    if (settled) return;
    const order = gOrder(req.lite).filter(gFree).filter(n => tried.indexOf(n) < 0);
    if (!order.length || tried.length >= 6 || netN >= 3) {      /* 연결 문제는 세 번까지만 해 보고 멈춘다 (녹음은 그대로 남는다) */
      if (liveN() > 0) return;
      if (G.onChain) G.onChain();
      if (lastNet) fail("구글에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 「다시 보내기」를 눌러 주세요. (" + lastNet + ")", "net"); else fail(gStuck(), "quota"); return;
    }
    const model = order[0]; tried.push(model); live[model] = 1;
    clearTimeout(hedgeT);
    hedgeT = setTimeout(() => {
      if (settled || tried.length >= 6) return;
      const more = gOrder(req.lite).filter(gFree).filter(n => tried.indexOf(n) < 0);
      if (more.length) { status("「" + model + "」의 답이 늦어 「" + more[0] + "」에도 함께 보내는 중…"); run(); }
    }, hedgeMs);
    fetchTx(G_BASE + "models/" + encodeURIComponent(model) + ":generateContent", {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": G.key }, body
    }, G_WAIT).then(res => Promise.resolve(res.tx).then(tx => {
      delete live[model]; if (settled) return;
      const next = why => { if (liveN() > 0) return; next0(why); };          /* 함께 보낸 다른 모델이 아직 답하는 중이면 그쪽을 기다린다 */
      if (res.status === 404) { G.dead[model] = 1; if (liveN() > 0) return; status("「" + model + "」을 쓸 수 없어 다른 모델을 찾는 중…"); gList(() => run(), fail); return; }
      if (res.status === 429) {
        const day = /per\s*day|PerDay/i.test(tx), m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(tx);
        gBlock(model, day ? gNextReset() : Date.now() + Math.max(20, m ? parseFloat(m[1]) : 60) * 1000);
        next("「" + model + "」 한도가 차서 다음 모델로 보내는 중…"); return;
      }
      if (res.status >= 500) { gSlow(model); next("「" + model + "」이 응답하지 않아 다음 모델로 보내는 중… (이 모델은 한동안 건너뜁니다)"); return; }
      if (res.status === 400 && /not support|unsupported|modalit/i.test(tx) && !/API key/i.test(tx)) { G.dead[model] = 1; next("「" + model + "」은 녹음을 듣지 못해 다음 모델로 보내는 중…"); return; }
      if (!res.ok) { fail(gErr(res.status, tx)); return; }
      let j = null; try { j = JSON.parse(tx); } catch (e) {}
      const cand = j && j.candidates && j.candidates[0], parts = cand && cand.content && cand.content.parts || [];
      const text = parts.map(p => p.text || "").join("");
      if (!text) { fail("선생님이 답을 주지 않았습니다." + (j && j.promptFeedback && j.promptFeedback.blockReason ? " (차단 사유: " + j.promptFeedback.blockReason + ")" : "") + " 「다시 보내기」를 눌러 주세요."); return; }
      const r = parseJson(text);
      if (!r || typeof r !== "object") { fail("선생님의 답을 읽지 못했습니다. 「다시 보내기」를 눌러 주세요."); return; }
      if (koBad(r)) {                                   /* 우리말 글자가 깨졌으면 한 번은 다른 모델로 다시 받고, 그래도 깨진 문장은 비운다 */
        gSlow(model);
        const more = gOrder(req.lite).filter(gFree).filter(n => tried.indexOf(n) < 0);
        if (!req.koRetried && more.length && liveN() === 0) { req.koRetried = true; status("「" + model + "」의 우리말 글자가 깨져 다른 모델로 다시 받는 중…"); run(); return; }
        done(koStrip(r), model); return;
      }
      gFine(model);
      done(r, model);
    })).catch(e => {
      delete live[model]; if (settled) return;
      const next = why => { if (liveN() > 0) return; next0(why); };
      lastNet = String((e && e.name === "AbortError") ? "응답 시간 초과" : ((e && e.message) || e)).slice(0, 60);
      const slow = !!(e && e.name === "AbortError"); netN++;
      if (slow) gSlow(model);
      if (liveN() > 0) return;
      if (netN >= 3) { run(); return; }
      if (slow) { next("「" + model + "」이 " + Math.round(G_WAIT / 1000) + "초 넘게 답이 없어 다음 모델로 보내는 중… (이 모델은 한동안 건너뜁니다)"); return; }   /* 느린 모델은 다시 기다리지 않는다 */
      if (!netTry[model]) { netTry[model] = 1; tried.splice(tried.indexOf(model), 1); status("연결이 끊겨 다시 보내는 중… (" + netN + "번째)"); setTimeout(run, 1500); return; }
      next("「" + model + "」에 연결되지 않아 다음 모델로 보내는 중…");
    });
  }
  next0("");
  return handle;
}

/* ---------- 선생님에게 주는 지시문 ---------- */
const TAG_EN = {
  g_sva: "subject-verb agreement, missing 3rd-person -s, do/does, have/has (he go, my son like)",
  g_tense: "wrong tense (a past event told in the present; 'have been' with a finished time like last year)",
  g_art: "missing or wrong article a/an/the",
  g_prep: "wrong or missing preposition, or wrong collocation (go trip, listen music, discuss about)",
  g_plural: "plural form missing or wrong (two son, many peoples)",
  g_poss: "missing possessive or determiner (my, his, their, 's)",
  g_order: "Korean-style word order or sentence structure (My family is four; I Vietnam went)",
  g_be: "missing or extra be-verb, or missing subject (I happy; Is very good)",
  g_comp: "comparison forms (more better, most ... than)",
  g_word: "awkward or unnatural wording, wrong word choice",
  p_fp: "f pronounced like p (family -> pamily)",
  p_vb: "v pronounced like b (very -> berry)",
  p_rl: "r and l confused",
  p_th: "th pronounced as s, d or t (think -> sink, the -> de)",
  p_zj: "z pronounced like j (zoo -> joo)",
  p_epen: "extra vowel added after a final consonant or inside a cluster (church-i, and-eu)",
  p_vowel: "vowel quality or length (ship/sheep, full/fool, cat/cut)",
  p_stress: "wrong word stress",
  p_cluster: "consonant cluster simplified or broken (street, world, asked)",
  p_final: "final consonant or ending dropped (want -> wan; -ed and -s endings not heard)",
  d_filler: "frequent fillers (uh, um, Korean fillers)",
  d_ending: "habitual closing phrase that does not fit (for example ending every answer with 'Thank you')"
};
const LEARNER_STD = "A Korean pastor who will serve as a missionary in about two years. His goals, in order: (1) everyday communication on the mission field, (2) sharing his testimony and the gospel naturally, (3) leading worship and preaching in English. Target accent: General American.";
const LEARNER_EASY = [
  "A Korean adult who is a real BEGINNER (CEFR A1-A2). Until now the learner has only studied single words and simple greetings. The goal is to enjoy short daily practice and slowly become able to say short everyday sentences. Target accent: General American.",
  "BEGINNER RULES (these override anything below that conflicts):",
  "- Everything you say in English must be very easy: sentences of 8 words or fewer, only the most common everyday words, present or simple past tense, no idioms.",
  "- In a conversation, 'reply' is at most 2 short sentences and ends with ONE easy question (yes/no, or what / where / who / do you like).",
  "- 'natural' keeps the learner's own idea but in short easy sentences. Do not make it longer or more advanced.",
  "- Give at most 2 corrections and at most 2 pronunciation notes: only what matters most. Start every piece of feedback with something the learner did well.",
  "- In drills, ok is true when a listener would understand the sentence. Do not fail a sentence for accent alone.",
  "- Korean feedback is warm, short and concrete. Never use grammar terms."
].join("\n");
const EASY_TALK_EXTRA = '\nFor this beginner ALSO include in the JSON: "reply_ko": string (the Korean meaning of "reply"), "hint": {"en": string, "ko": string} (ONE very easy sentence, 7 words or fewer, the learner could say to answer your new question).';
const SYS_COMMON = [
  "You are Coach, a warm and honest native speaker of General American English who teaches speaking to ONE Korean learner, lesson after lesson.",
  "",
  "LEARNER",
  LEARNER_STD,
  "",
  "HOW YOU LISTEN",
  "- You receive audio recordings. Listen to the audio itself. Judge pronunciation and intonation only from what you actually hear, never from the words alone.",
  "- Write transcripts exactly as spoken, mistakes included. Never silently correct a transcript.",
  "- Never invent a problem you did not hear. If a recording is silent, too noisy, or not English, say so plainly, leave the transcript empty and use null for scores.",
  "- Measurements made on his device (speaking time, pauses, pitch range) may be given. Trust those numbers over your impression. Do not assign the tags d_flat, d_pause or d_slow; the device decides those.",
  "",
  "HOW YOU GIVE FEEDBACK",
  "- Every field ending in _ko is natural Korean in polite 해요체, one or two short sentences, concrete. Say what to do with the mouth, tongue, stress or word order. No grammar lectures.",
  "- English that you address to him is simple and clear (CEFR A2-B1) in short sentences.",
  "- Most important first. A few sharp points help more than many.",
  "- Correct only the part that is wrong. Keep the rest of his sentence the way he said it, so he can see exactly what changed.",
  "- When you say why something is wrong, give the reason in one Korean line with as few grammar terms as possible.",
  "- Praise is specific: quote the words he said well. Criticism is brief.",
  "- Encourage honestly. Never inflate scores. Scores are integers 0-100; 100 means indistinguishable from an educated native speaker, 60 means understandable with effort.",
  "",
  "PATTERN TAGS",
  "Every correction carries exactly one tag id from this fixed list, copied exactly. For a grammar or wording correction with no better fit use g_word. For a pronunciation item with no fit use an empty string.",
  Object.keys(TAG_EN).map(k => k + " = " + TAG_EN[k]).join("\n"),
  "",
  "OUTPUT",
  "Return ONLY one JSON object with exactly the keys requested below. No markdown, no extra keys, no comments."
].join("\n");
const SYS_MODE = {
  talk: [
    "MODE: talk — a spoken conversation lesson. The recording is his new answer to your last line.",
    "Return this JSON:",
    '{"transcript": string,',
    ' "reply": string (your next line in the conversation: 1 to 3 short sentences that respond to what he said and end with ONE question or ONE instruction. Stay in the scenario. When it is natural, ask something that makes him practice one of his known patterns, for example a past event if tense is a known pattern),',
    ' "praise_ko": string (one specific thing he did well in THIS answer),',
    ' "focus_ko": string (the single most important thing to fix next time),',
    ' "repeat_ko": string (if he repeated one of his KNOWN PATTERNS, name it and quote the words; if he avoided a known pattern that he usually makes, praise that; otherwise empty),',
    ' "pronunciation": [{"word": string, "heard_ko": string (how it sounded), "tip_ko": string (how to fix it), "tag": string}] (at most 4, only sounds you really heard wrong),',
    ' "intonation_ko": string (stress, rhythm, pitch movement),',
    ' "fluency_ko": string (pauses, speed, restarts; use the device numbers),',
    ' "grammar": [{"said": string (his words), "better": string, "why_ko": string, "tag": string, "sent": string (the full corrected sentence that contains "better", 14 words or fewer, in simple words), "sent_ko": string (the natural Korean meaning of "sent")}] (at most 4),',
    ' "natural": string (his whole answer the way a native speaker would say it: same meaning, same length, simple words he can reuse),',
    ' "sents": [{"en": string, "ko": string}] (every sentence of "natural", in the same order, one sentence per item, each with its natural Korean meaning),',
    ' "chunks": [{"en": string, "ko": string}] (take the ONE or TWO sentences of "natural" where his word order was most Korean, or the first two sentences if order was fine; cut them into meaning chunks in English order — subject+verb first, then object, place, time, reason; "ko" is the Korean meaning of that chunk only; at most 10 chunks),',
    ' "order_ko": string (one tip on English word order based on this answer, or empty if his order was fine),',
    ' "phrases": [{"en": string, "ko": string}] (1 to 3 short reusable expressions from "natural" worth memorizing as a unit, useful for his goals),',
    ' "delivery_tags": [string] (only d_filler and/or d_ending when clearly present, else empty),',
    ' "scores": {"pronunciation": int, "intonation": int, "fluency": int, "grammar": int}}'
  ].join("\n"),
  batch: [
    "MODE: batch — a set of short drill recordings, judged together. Before each recording there is a line: ITEM i | TASK kind | TARGET: ... | FOCUS: ...",
    "TASK kinds:",
    "- recall: he saw only the Korean meaning and tried to say the TARGET expression from memory. ok is true when what he said has the same meaning, correct grammar, and is clearly understandable. Small wording differences that are still correct and natural are ok.",
    "- shadow: he saw and heard the TARGET, then repeated it. ok is true when every content word is present and clearly understandable.",
    "- translate: he saw a Korean sentence and tried to say it in English. TARGET is one good answer; another correct, natural sentence with the same meaning is also ok. Check FOCUS carefully: ok is false if the FOCUS point is wrong, even when the rest is fine.",
    "- read: he read the TARGET aloud to practice FOCUS (a sound or a delivery habit). ok is true only when the FOCUS sound or feature was right in most places where it occurs.",
    "For each item give: i (number as given), heard (exact transcript), ok (boolean), score (int 0-100 for this item), note_ko (ONE short Korean sentence: what to fix, or what was good), tag (the tag id of the main error, or empty string when ok).",
    "If a recording is silent or cannot be understood: heard is empty, ok is false, score is null, and note_ko says it was not heard.",
    'Return this JSON: {"items": [{"i": int, "heard": string, "ok": boolean, "score": int, "note_ko": string, "tag": string}]} with exactly one entry per ITEM, in order.'
  ].join("\n"),
  retell: [
    "MODE: retell — task repetition. Earlier he answered a question (FIRST ATTEMPT). You gave him a natural version (TARGET). He studied it, hid it, and now says it again from memory. The recording is this second attempt.",
    "Judge whether the second attempt keeps the corrections. It does not need to match TARGET word for word.",
    "Return this JSON:",
    '{"transcript": string,',
    ' "covered": int (0-100: how much of the meaning of TARGET he conveyed),',
    ' "fixed_ko": string (which mistakes from the first attempt are now fixed; quote the words),',
    ' "left": [{"said": string, "better": string, "why_ko": string, "tag": string, "sent": string (the full corrected sentence that contains "better", 14 words or fewer, in simple words), "sent_ko": string (the natural Korean meaning of "sent")}] (mistakes still present, at most 3),',
    ' "pronunciation": [{"word": string, "heard_ko": string, "tip_ko": string, "tag": string}] (at most 3),',
    ' "cheer_ko": string (one honest sentence comparing this attempt with the first),',
    ' "delivery_tags": [string] (only d_filler and/or d_ending),',
    ' "scores": {"pronunciation": int, "intonation": int, "fluency": int, "grammar": int}}'
  ].join("\n"),
  test: [
    "MODE: test — one task of a level check. Be a strict, consistent examiner. Do not coach here; rate. Rate the same performance the same way every time.",
    "Score each criterion 0-100. Choose the anchor that fits best, then adjust by at most 7 points.",
    "pronunciation — 90: sounds are clear and easy to follow, accent rarely gets in the way. 75: clearly accented but always intelligible, a few sound errors. 60: several consistent sound errors; a listener must concentrate at times. 45: many errors; words are often hard to recognize. 30: mostly unintelligible.",
    "intonation — 90: natural stress, rhythm and pitch movement. 75: stress mostly right, rhythm somewhat even. 60: flat or syllable-by-syllable; sentence stress often missing. 45: monotone, word by word. 30: no phrasing at all.",
    "grammar — 90: handles complex sentences, rare slips. 75: good control of simple sentences, some errors in complex ones. 60: frequent errors in basic forms (agreement, tense, articles) but the meaning stays clear. 45: errors in most sentences; meaning sometimes unclear. 30: isolated words or memorized bits only.",
    "vocabulary — 90: precise and flexible. 75: enough words for the topic, some roundabout wording. 60: basic words, repetition, searching for words. 45: very limited; often cannot find the word. 30: a few words only.",
    "task — 90: answers fully with detail and clear order. 75: answers with some detail. 60: answers briefly or only in part. 45: barely addresses the task. 30: does not address it.",
    "For TASK TYPE read: grammar and vocabulary are null, and task measures reading accuracy (90: no skipped or misread words; 75: one to three; 60: four to seven; 45: more).",
    "Return this JSON:",
    '{"transcript": string,',
    ' "scores": {"pronunciation": int, "intonation": int, "grammar": int or null, "vocabulary": int or null, "task": int},',
    ' "comment_ko": string (two sentences: the main strength, then the main limit),',
    ' "natural": string (for TASK TYPE read: an empty string. Otherwise his whole answer the way a native speaker would say it: same meaning, same length, simple words he can reuse),',
    ' "sents": [{"en": string, "ko": string}] (every sentence of "natural", in the same order, one sentence per item, each with its natural Korean meaning; empty for TASK TYPE read),',
    ' "grammar": [{"said": string, "better": string, "tag": string, "sent": string (the full corrected sentence that contains "better", 14 words or fewer, in simple words), "sent_ko": string (the natural Korean meaning of "sent")}] (at most 4),',
    ' "pronunciation": [{"word": string, "tag": string}] (at most 4),',
    ' "delivery_tags": [string] (only d_filler and/or d_ending)}'
  ].join("\n")
};
SYS_MODE.ask = [
  "MODE: ask — no recording this time. He met an English expression today and typed it. Explain it so that he can use it himself.",
  "Return this JSON:",
  '{"en": string (the expression in its natural, correct form; fix spelling if he mistyped it),',
  ' "meaning_ko": string (what it means, one short line),',
  ' "when_ko": string (the situations where he can use it himself, and how formal or casual it is, one or two short sentences),',
  ' "examples": [{"en": string, "ko": string}] (two or three short example sentences he could really say in daily life or ministry, CEFR A2-B1),',
  ' "note_ko": string (one caution if there is a common mistake Koreans make with it; otherwise empty)}',
  "If what he typed is not English or makes no sense, set en to an empty string and say so in meaning_ko."
].join("\n");
/* ---------- 듣기 코너: 선생님이 새로 쓴 짧은 이야기(방송 대본을 옮기지 않는다) ---------- */
const LIS_TOPICS = { news: ["쉬운 뉴스", "an easy news-style report about a general, timeless topic such as science, health, weather, daily life or culture. Write it yourself from general knowledge; do not copy or imitate any real broadcast, and do not present invented events as real current news"], faith: ["신앙 이야기", "a short Christian devotional reflection or testimony-style story in simple words (no long Bible quotations)"], daily: ["일상 이야기", "a short everyday story about family, food, travel or work"], field: ["선교지 생활", "a short story about daily life on a mission field: meeting neighbors, the market, a visit, a small problem solved"] };
const SYS_LISTEN = [
  "You write listening practice for ONE Korean adult learner of American English. Write original text yourself. Never reproduce or closely imitate a real broadcast, article, book or song.",
  "Write for the ear: natural spoken American English with contractions and common linking, short clear sentences.",
  "Return ONLY one JSON object, no markdown:",
  '{"title": string (English, up to 6 words), "title_ko": string,',
  ' "sents": [{"en": string (one sentence, 6 to 16 words), "ko": string (natural Korean meaning), "note_ko": string (ONE short Korean line on why this sentence is hard to catch by ear: a linked sound, a weak or reduced word, a contraction, or a dropped t/d, quoting the English words; empty if nothing special)}] (exactly 8 sentences that form one coherent story or report),',
  ' "questions": [{"q_ko": string, "options_ko": [string, string, string, string], "answer": int (0-3, the index of the correct option), "a_ko": string (the correct answer as a short Korean sentence)}] (exactly 2 gist questions in Korean about the main points. Each has four short Korean options: one correct, three plausible but clearly wrong according to the text. Put the correct option at a random position),',
  ' "words": [{"en": string, "ko": string}] (3 to 5 words or expressions from the text worth knowing)}'
].join("\n");
function lisClean(r) {
  const s = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const sents = (Array.isArray(r && r.sents) ? r.sents : []).map(x => ({ en: s(x && x.en).slice(0, 220), ko: s(x && x.ko).slice(0, 220), note: s(x && x.note_ko).slice(0, 220) })).filter(x => /[A-Za-z]{2}/.test(x.en)).slice(0, 12);
  return { title: s(r && r.title).slice(0, 60) || "Listening", titleKo: s(r && r.title_ko).slice(0, 60), sents: sents,
    qs: (Array.isArray(r && r.questions) ? r.questions : []).map(x => {
      const q = { q: s(x && x.q_ko).slice(0, 200), a: s(x && x.a_ko).slice(0, 200), opts: [], ans: -1 };
      const o = (Array.isArray(x && x.options_ko) ? x.options_ko : []).map(v => s(v).slice(0, 120)).filter(Boolean).slice(0, 4), k = Math.round(+(x && x.answer));
      if (o.length >= 3 && k >= 0 && k < o.length && o.filter((v, i) => o.indexOf(v) === i).length === o.length) {     /* 보기를 섞어 정답 자리가 한쪽으로 몰리지 않게 */
        const idx = o.map((v, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
        q.opts = idx.map(i => o[i]); q.ans = idx.indexOf(k); if (!q.a) q.a = o[k];
      }
      return q; }).filter(x => x.q).slice(0, 3),
    words: (Array.isArray(r && r.words) ? r.words : []).map(x => ({ en: s(x && x.en).slice(0, 60), ko: s(x && x.ko).slice(0, 80) })).filter(x => x.en).slice(0, 5) };
}
/* 내 글 넣기: 붙여 넣은 영어 글을 문장으로 나눈다 (뜻과 풀이는 없다) */
function lisFromText(text) { const sents = natSplit(String(text || "").slice(0, 3000)).filter(x => /[A-Za-z]{2}/.test(x)).slice(0, 14).map(en => ({ en: en.slice(0, 260), ko: "", note: "" })); return { title: "내 글", titleKo: "", sents: sents, qs: [], words: [] }; }
/* 받아쓰기 채점: 낱말 단위로 맞춘 것만 센다 (순서를 지켜 가장 길게 겹치는 부분) */
function lisWords(t) { return String(t || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean); }
function lisDiff(target, typed) {
  const a = lisWords(target), b = lisWords(typed), n = a.length, m = b.length, L = [];
  for (let i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = new Array(n).fill(false); let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { hit[i] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  return { words: a, hit: hit, ok: hit.filter(Boolean).length, n: n };
}
const LIS_KEY = "ec_listen";
function lisList() { try { const a = JSON.parse(store.get(LIS_KEY) || "[]"); return Array.isArray(a) ? a.filter(x => x && Array.isArray(x.sents) && x.sents.length) : []; } catch (e) { return []; } }
function lisSave(p) { const a = lisList().filter(x => x.id !== p.id); a.unshift(p); store.set(LIS_KEY, JSON.stringify(a.slice(0, 30))); }
const sysFor = mode => (easyMode() ? SYS_COMMON.replace(LEARNER_STD, LEARNER_EASY) : SYS_COMMON) + "\n\n" + SYS_MODE[mode] + (easyMode() && mode === "talk" ? EASY_TALK_EXTRA : "");
function profileText() {                           /* 매 요청에 넣는 학습자 정보: 최근 2주 약점, 외우는 구문 */
  const st = tagStats().list.filter(s => s.r > 0 && !s.grad && TAG_EN[s.g]).slice(0, 5), L = [];
  if (st.length) L.push("KNOWN PATTERNS (his most frequent in the last 14 days): " + st.map(s => s.g + " x" + s.r).join(", ") + ".");
  else L.push("KNOWN PATTERNS: none recorded yet. From earlier lessons: g_sva, g_tense, g_order.");
  const learn = Object.keys(DB.srs).filter(id => DB.srs[id].b >= 1 && DB.srs[id].b <= 3).slice(-6).map(id => { const p = itemByRef(id); return p ? p.en : ""; }).filter(Boolean);
  if (learn.length) L.push("EXPRESSIONS HE IS MEMORIZING (if he uses one well, mention it in praise_ko): " + learn.join(" | "));
  return L.join("\n");
}
function metricsText(m) {
  return "Device measurements for this recording: length " + m.dur.toFixed(1) + "s, speaking time " + m.speech.toFixed(1) + "s, pauses of 0.5s or longer: " + m.pauses +
    (m.pauses ? " (longest " + m.longest.toFixed(1) + "s)" : "") + (m.st != null ? ", pitch range " + m.st.toFixed(1) + " semitones (under 4 is flat)" : "") + ".";
}
const tagOk = (g, kind) => { g = String(g || "").trim(); return D.TAGS[g] && !DEVICE_TAGS[g] && (!kind || D.TAGS[g].k === kind) ? g : ""; };
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n || 600);
function cleanScores(s) { s = s || {}; return { pron: num(s.pronunciation), inton: num(s.intonation), flu: num(s.fluency), gram: num(s.grammar), vocab: num(s.vocabulary), task: num(s.task) }; }
function cleanGram(a, n) { return (Array.isArray(a) ? a : []).slice(0, n).map(g => ({ said: str(g && g.said, 160), better: str(g && g.better, 160), why: str(g && g.why_ko, 240), tag: tagOk(g && g.tag) || "g_word", sent: str(g && g.sent, 160), sentKo: str(g && g.sent_ko, 160) })).filter(g => g.better && !sameSay(g.said, g.better)); }
/* 기록에 남기는 고침: a 틀렸던 말, b 고친 말, g 약점, s 고친 말이 든 온전한 문장, k 그 문장의 우리말 뜻 */
function fxOf(g) { const o = { a: g.said.slice(0, 120), b: g.better.slice(0, 120), g: g.tag }; if (g.sent && g.sentKo && !koBadText(g.sentKo)) { o.s = g.sent.slice(0, 140); o.k = g.sentKo.slice(0, 120); } return o; }
/* 고친 말이 원래 말과 같으면(대소문자·구두점만 다르면) 고침이 아니다 */
function sameSay(a, b) { const n = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); return n(a) === n(b); }
function cleanPron(a, n) { return (Array.isArray(a) ? a : []).slice(0, n).map(p => ({ word: str(p && p.word, 40), heard: str(p && p.heard_ko, 160), tip: str(p && p.tip_ko, 240), tag: tagOk(p && p.tag, "p") })).filter(p => p.word); }
function cleanDelivery(a) { return uniq((Array.isArray(a) ? a : []).map(x => String(x)).filter(x => x === "d_filler" || x === "d_ending")); }
function cleanPairs(a, n) { return (Array.isArray(a) ? a : []).slice(0, n).map(c => ({ en: str(c && c.en, 160), ko: str(c && c.ko, 160) })).filter(c => c.en); }
function cleanTalk(r) {
  return { transcript: str(r.transcript, 1500), reply: str(r.reply, 500), replyKo: str(r.reply_ko, 300), hint: (r.hint && str(r.hint.en, 120)) ? { en: str(r.hint.en, 120), ko: str(r.hint.ko, 160) } : null, praise: str(r.praise_ko, 300), focus: str(r.focus_ko, 300), repeat: str(r.repeat_ko, 300),
    pron: cleanPron(r.pronunciation, 4), inton: str(r.intonation_ko, 300), flu: str(r.fluency_ko, 300), gram: cleanGram(r.grammar, 4), natural: str(r.natural, 1500), sents: cleanPairs(r.sents, 12),
    chunks: cleanPairs(r.chunks, 10), order: str(r.order_ko, 300), phrases: cleanPairs(r.phrases, 3), delivery: cleanDelivery(r.delivery_tags), sc: cleanScores(r.scores) };
}
function cleanBatch(r, n) {
  const a = Array.isArray(r.items) ? r.items : [], out = [];
  for (let i = 0; i < n; i++) {
    const x = a.filter(y => y && Number(y.i) === i + 1)[0] || a[i] || {};
    const heard = str(x.heard, 300);
    out.push({ heard, ok: x.ok === true && !!heard, score: num(x.score), note: str(x.note_ko, 240) || (heard ? "" : "말소리가 들리지 않았어요."), tag: tagOk(x.tag) });
  }
  return out;
}
function cleanRetell(r) {
  return { transcript: str(r.transcript, 1500), covered: num(r.covered), fixed: str(r.fixed_ko, 400), left: cleanGram(r.left, 3), pron: cleanPron(r.pronunciation, 3),
    cheer: str(r.cheer_ko, 300), delivery: cleanDelivery(r.delivery_tags), sc: cleanScores(r.scores) };
}
function cleanTest(r) {
  return { transcript: str(r.transcript, 1500), sc: cleanScores(r.scores), comment: str(r.comment_ko, 400), natural: str(r.natural, 1500), sents: cleanPairs(r.sents, 12),
    gram: (Array.isArray(r.grammar) ? r.grammar : []).slice(0, 4).map(g => ({ said: str(g && g.said, 160), better: str(g && g.better, 160), why: "", tag: tagOk(g && g.tag) || "g_word" })).filter(g => g.better && !sameSay(g.said, g.better)),
    pron: (Array.isArray(r.pronunciation) ? r.pronunciation : []).slice(0, 4).map(p => ({ word: str(p && p.word, 40), tag: tagOk(p && p.tag, "p") })).filter(p => p.word),
    delivery: cleanDelivery(r.delivery_tags) };
}
function tagsOf(c, m, words, reading) {
  return uniq((c.gram || c.left || []).map(g => g.tag).concat((c.pron || []).map(p => p.tag), c.delivery || [], deviceTags(m, words, reading)));
}

/* ---------- 합치기 규칙 (백업 가져오기와 구글 저장이 함께 쓴다. 덮어쓰지 않는다) ---------- */
function stateOut() { return { srs: DB.srs, my: DB.my, gone: DB.gone, day: DB.day, miss: DB.miss }; }
function canon(v) {                                 /* 열쇠 순서와 상관없이 같은 내용이면 같은 글이 되게 */
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}
function stateMerge(o) {                            /* o의 내용을 이 기기 기록에 합친다. 바뀐 개수를 돌려준다 */
  const out = { srs: 0, my: 0, day: 0, miss: 0, gone: 0 }, isMap = v => v && typeof v === "object" && !Array.isArray(v);
  if (!isMap(o)) return out;
  /* 구문 상자: 더 많이 본 쪽 */
  const srs = isMap(o.srs) ? o.srs : {};
  Object.keys(srs).forEach(id => { const a = DB.srs[id], b = srs[id]; if (!b || typeof b.n !== "number") return; if (!a || b.n > a.n || (b.n === a.n && b.l > a.l)) { DB.srs[id] = { b: b.b | 0, d: b.d | 0, n: b.n | 0, k: b.k | 0, l: b.l | 0 }; out.srs++; } });
  /* 내가 뺀 구문 표시: 합집합. 표시된 구문은 어느 기기에서도 뺀다 */
  const gone = isMap(o.gone) ? o.gone : {};
  Object.keys(gone).forEach(id => { if (!DB.gone[id]) { DB.gone[id] = +gone[id] || 1; out.gone++; } });
  /* 내 구문: 합집합 (같은 영어는 하나) */
  (Array.isArray(o.my) ? o.my : []).forEach(p => { if (p && p.id && p.en && !DB.gone[p.id] && !DB.my.some(q => q.id === p.id || q.en.toLowerCase() === String(p.en).toLowerCase())) { DB.my.push({ id: String(p.id), en: String(p.en), ko: String(p.ko || ""), t: +p.t || now() }); out.my++; } });
  (Array.isArray(o.my) ? o.my : []).forEach(p => { const q = p && p.id && DB.my.filter(x => x.id === p.id)[0], a = q && fixParts(q.ko), b = q && fixParts(p.ko); if (a && b && !a.mean && b.mean) { q.ko = String(p.ko).slice(0, 320); out.my++; } });   /* 다른 기기에서 채운 뜻을 받아 온다 */
  const before = DB.my.length; DB.my = DB.my.filter(p => !DB.gone[p.id]); if (DB.my.length !== before) out.my++;
  /* 날짜별 시간·문장 수·단계: 큰 값 */
  const day = isMap(o.day) ? o.day : {};
  Object.keys(day).forEach(d => {
    const b = day[d]; if (!isMap(b) || !/^\d+$/.test(d)) return; const had = !!DB.day[d], a = dayRec(+d), bs = isMap(b.st) ? b.st : {}, was = JSON.stringify(a);
    a.sec = Math.max(a.sec, +b.sec || 0); a.said = Math.max(a.said, +b.said || 0);
    STEPS.forEach(k => { a.st[k] = Math.max(a.st[k] || 0, +bs[k] || 0); }); if (bs.revNA) a.st.revNA = 1;
    if (!had || was !== JSON.stringify(a)) out.day++;
  });
  /* 미션 표시: 나중에 누른 쪽 (양수 = 했음, 음수 = 표시를 풂) */
  const miss = isMap(o.miss) ? o.miss : {};
  Object.keys(miss).forEach(w => { const b = miss[w]; if (!isMap(b)) return; const a = DB.miss[w] || (DB.miss[w] = {}); Object.keys(b).forEach(id => { const v = +b[id] || 0; if (v && Math.abs(v) > Math.abs(+a[id] || 0)) { a[id] = v; out.miss++; } }); });
  return out;
}
const STATE_KEYS = ["srs", "my", "gone", "day", "miss"];

/* ---------- 백업: 내보내기와 합쳐서 가져오기 (지우지 않는다) ---------- */
function backupMake() { return { app: "english-coach", v: BUILD, t: now(), log: DB.log, srs: DB.srs, my: DB.my, gone: DB.gone, day: DB.day, miss: DB.miss, set: { minutes: DB.set.minutes } }; }
function logMerge(list) {                           /* 기록은 번호 기준 합집합 */
  const have = {}; DB.log.forEach(r => { have[r.id] = 1; });
  let n = 0;
  (Array.isArray(list) ? list : []).forEach(r => { if (r && r.id && r.t && !have[r.id]) { DB.log.push(r); have[r.id] = 1; n++; } });
  if (n) DB.log.sort((x, y) => x.t - y.t);
  return n;
}
function backupMerge(o) {
  if (!o || typeof o !== "object" || o.app !== "english-coach") return null;
  const n = logMerge(o.log), st = stateMerge(o);
  ["log"].concat(STATE_KEYS).forEach(dbSave);
  if (typeof syncMarkAll === "function") syncMarkAll();
  return { log: n, srs: st.srs, my: st.my, day: st.day };
}

/* ---------- 하던 일 보관: 녹음은 크기가 커서 IndexedDB에 둔다 ---------- */
const IDB = { db: null };
function idbOpen() {
  return new Promise(res => {
    if (IDB.db) { res(IDB.db); return; }
    try {
      const rq = indexedDB.open("ec6", 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore("kv"); } catch (e) {} };
      rq.onsuccess = () => { IDB.db = rq.result; res(IDB.db); };
      rq.onerror = () => res(null); rq.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
}
function idbDo(mode, fn) {
  return idbOpen().then(db => new Promise(res => {
    if (!db) { res(null); return; }
    try { const tx = db.transaction("kv", mode), rq = fn(tx.objectStore("kv")); tx.oncomplete = () => res(rq && rq.result !== undefined ? rq.result : true); tx.onerror = tx.onabort = () => res(null); }
    catch (e) { res(null); }
  }));
}
const idbSet = (k, v) => idbDo("readwrite", st => st.put(v, k));
const idbGet = k => idbDo("readonly", st => st.get(k));
const idbDel = k => idbDo("readwrite", st => st.delete(k));
