"use strict";
/* 영어 말하기 코치 — 구글 로그인과 기기 사이 이어 쓰기.
   Firebase를 주소로 직접 부른다(따로 받는 라이브러리 없음). 로그인은 구글 화면으로 갔다가 이 주소로 돌아오는 방식이라
   팝업·다른 사이트 저장 허용이 필요 없다. 저장은 합치기만 한다. 기준은 SPEC.md 13장. */
const FB = Object.assign({
  apiKey: "AIzaSyC5L0aBtelJOIIMzRqe7nDIStKoUelDQQo",   /* Firebase 웹 앱의 apiKey (공개 값. 콘솔 화면의 글자를 그대로 옮김) */
  projectId: "english-coach-3ffba",                    /* Firebase 프로젝트 ID */
  clientId: "419523194632-e50n9ovkp5nsdnnrh65dgbhc2i4g2q3d.apps.googleusercontent.com",   /* 구글 OAuth 웹 클라이언트 ID (Web client, auto created by Google Service) */
  redirect: "https://danielkang3927-collab.github.io/english-coach/"   /* 구글 콘솔 「승인된 리디렉션 URI」와 글자까지 같아야 한다 */
}, window.__FB || {});
const fbReady = () => !!(FB.apiKey && FB.projectId && FB.clientId);
const AUTH = { uid: "", email: "", name: "", id: "", exp: 0, refresh: "", pending: null };
const SYNC = { uid: "", email: "", st: "", un: [], last: 0, err: "", busy: false, again: false, ask: null, timer: null, onPaint: null, onKeys: null, stats: { up: 0, down: 0 } };
const enc = encodeURIComponent;
const FS_ROOT = () => "projects/" + FB.projectId + "/databases/(default)/documents";
const FS_URL = () => "https://firestore.googleapis.com/v1/" + FS_ROOT();
const jparse = tx => { try { return JSON.parse(tx); } catch (e) { return null; } };
const apiErr = j => String((j && j.error && (j.error.message || j.error.status)) || "");
function paint() { if (SYNC.onPaint) SYNC.onPaint(); }

/* ---------- 이 기기에 남기는 값 ---------- */
function authLoad() {
  const a = jparse(store.get("ec6_auth") || "null");
  if (a && a.uid && a.refresh) { AUTH.uid = String(a.uid); AUTH.email = String(a.email || ""); AUTH.name = String(a.name || ""); AUTH.id = String(a.id || ""); AUTH.exp = +a.exp || 0; AUTH.refresh = String(a.refresh); }
  const s = jparse(store.get("ec6_sync") || "null");
  if (s && typeof s === "object") { SYNC.uid = String(s.uid || ""); SYNC.email = String(s.email || ""); SYNC.st = String(s.st || ""); SYNC.un = Array.isArray(s.un) ? s.un.filter(x => typeof x === "string") : []; SYNC.last = +s.last || 0; }
}
function authSave() { return store.set("ec6_auth", JSON.stringify({ uid: AUTH.uid, email: AUTH.email, name: AUTH.name, id: AUTH.id, exp: AUTH.exp, refresh: AUTH.refresh })); }
function syncSave() { return store.set("ec6_sync", JSON.stringify({ uid: SYNC.uid, email: SYNC.email, st: SYNC.st, un: SYNC.un, last: SYNC.last })); }
function signedOut(why) { AUTH.uid = ""; AUTH.id = ""; AUTH.exp = 0; AUTH.refresh = ""; AUTH.email = ""; AUTH.name = ""; store.del("ec6_auth"); SYNC.ask = null; if (why) SYNC.err = why; paint(); }
function logout() { clearTimeout(SYNC.timer); signedOut(""); SYNC.err = ""; paint(); }   /* 이 기기의 기록은 그대로 둔다 */

/* ---------- 로그인: 구글 화면으로 갔다가 돌아온다 ---------- */
function randHex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, b => ("0" + b.toString(16)).slice(-2)).join(""); }
function loginUrl(st, nonce) {
  return "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + enc(FB.clientId) + "&redirect_uri=" + enc(FB.redirect) + "&response_type=" + enc("token id_token") +
    "&scope=" + enc("openid email profile") + "&nonce=" + nonce + "&state=" + st + "&prompt=select_account";
}
function loginStart() {
  if (!fbReady()) return "구글 로그인 연결 값이 아직 없습니다.";
  const st = randHex(16), nonce = randHex(16);
  if (!store.set("ec6_oauth", JSON.stringify({ st, nonce, t: Date.now() }))) return "이 브라우저가 저장을 막고 있어 로그인할 수 없습니다. 사생활 보호 모드를 끄고 다시 해 주세요.";
  location.href = loginUrl(st, nonce);
  return "";
}
function jwtPayload(tok) { try { const p = String(tok).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(decodeURIComponent(escape(atob(p + "===".slice((p.length + 3) % 4))))); } catch (e) { return null; } }
/* 돌아온 주소에 로그인 결과가 붙어 있으면 처리한다. 없으면 null. */
function loginReturn() {
  const h = String(location.hash || "");
  if (!/(^#|&)(access_token|id_token|error)=/.test(h)) return null;
  const p = {};
  h.replace(/^#/, "").split("&").forEach(kv => { const i = kv.indexOf("="); if (i > 0) { try { p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " ")); } catch (e) {} } });
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { try { location.hash = ""; } catch (x) {} }
  const saved = jparse(store.get("ec6_oauth") || "null"); store.del("ec6_oauth");
  if (p.error) return Promise.reject(new Error(p.error === "access_denied" ? "로그인을 취소했습니다." : "구글 로그인 오류: " + p.error));
  if (!saved || !p.state || p.state !== saved.st || Date.now() - saved.t > 15 * 60000) return Promise.reject(new Error("로그인 확인 값이 맞지 않습니다. 다시 로그인해 주세요."));
  if (p.id_token) { const c = jwtPayload(p.id_token); if (!c || c.nonce !== saved.nonce) return Promise.reject(new Error("로그인 확인 값(nonce)이 맞지 않습니다. 다시 로그인해 주세요.")); }
  if (!p.id_token && !p.access_token) return Promise.reject(new Error("구글이 로그인 값을 돌려주지 않았습니다. 다시 로그인해 주세요."));
  return idpExchange(p);
}
function idpPost(postBody) {
  return fetchT("https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=" + enc(FB.apiKey), { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postBody, requestUri: FB.redirect, returnSecureToken: true, returnIdpCredential: true }) }, 30000)
    .then(res => res.text().then(tx => ({ ok: res.ok, status: res.status, j: jparse(tx) })));
}
function idpExchange(p) {                          /* 구글이 준 값을 Firebase 로그인으로 바꾼다. id_token이 안 되면 access_token으로 */
  const tries = [];
  if (p.id_token) tries.push("id_token=" + enc(p.id_token) + "&providerId=google.com");
  if (p.access_token) tries.push("access_token=" + enc(p.access_token) + "&providerId=google.com");
  const errs = [];
  const go = i => {
    if (i >= tries.length) return Promise.reject(new Error("로그인을 마치지 못했습니다. (" + errs.join(" / ").slice(0, 200) + ")"));
    return idpPost(tries[i]).then(r => {
      if (r.ok && r.j && r.j.idToken && r.j.refreshToken && r.j.localId) {
        AUTH.uid = String(r.j.localId); AUTH.email = String(r.j.email || ""); AUTH.name = String(r.j.displayName || ""); AUTH.id = String(r.j.idToken); AUTH.refresh = String(r.j.refreshToken);
        AUTH.exp = Date.now() + (+r.j.expiresIn || 3600) * 1000; authSave(); return true;
      }
      errs.push(apiErr(r.j) || ("HTTP " + r.status)); return go(i + 1);
    }, e => { errs.push("연결 실패: " + String(e && e.message || e).slice(0, 60)); return go(i + 1); });
  };
  return go(0);
}
function afterLogin() {                            /* 로그인 직후: 이 기기 기록이 다른 계정 것이면 합칠지 먼저 묻는다 */
  if (SYNC.uid && SYNC.uid !== AUTH.uid && (DB.log.length || Object.keys(DB.srs).length || DB.my.length)) { SYNC.ask = { email: AUTH.email, old: SYNC.email }; paint(); return Promise.resolve(false); }
  return bindAccount();
}
function bindAccount() {                           /* 로그인할 때는 이 기기 기록을 모두 올리고 처음부터 다시 받는다 (합치기라 여러 번 해도 같다) */
  SYNC.uid = AUTH.uid; SYNC.email = AUTH.email; SYNC.un = DB.log.map(r => r.id); SYNC.st = ""; SYNC.ask = null; syncSave();
  return syncNow();
}
function authResume() {                            /* 앱을 열 때: 로그인돼 있으면 조용히 맞춘다 */
  if (!fbReady() || !AUTH.uid) return;
  if (SYNC.uid !== AUTH.uid) { afterLogin(); return; }
  syncSoon(1500);
}

/* ---------- 로그인 표(토큰) ---------- */
function authToken(force) {
  if (!AUTH.refresh) return Promise.reject(new Error("로그인이 필요합니다."));
  if (!force && AUTH.id && AUTH.exp - Date.now() > 300000) return Promise.resolve(AUTH.id);
  if (AUTH.pending) return AUTH.pending;
  AUTH.pending = fetchT("https://securetoken.googleapis.com/v1/token?key=" + enc(FB.apiKey), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=refresh_token&refresh_token=" + enc(AUTH.refresh) }, 30000)
    .catch(() => { throw new Error("로그인 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요."); })
    .then(res => res.text().then(tx => {
      const j = jparse(tx);
      if (!res.ok || !j || !j.id_token) {
        const m = apiErr(j) || ("HTTP " + res.status);
        if (/TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|INVALID_REFRESH_TOKEN|MISSING_REFRESH_TOKEN|PROJECT_NUMBER_MISMATCH/.test(m)) { signedOut("로그인이 풀렸습니다. 다시 로그인해 주세요. 이 기기의 기록은 그대로 있습니다."); throw new Error("로그인이 풀렸습니다."); }
        throw new Error("로그인 확인 실패: " + m.slice(0, 120));
      }
      AUTH.id = String(j.id_token); if (j.refresh_token) AUTH.refresh = String(j.refresh_token); AUTH.exp = Date.now() + (+j.expires_in || 3600) * 1000; authSave();
      return AUTH.id;
    }))
    .then(v => { AUTH.pending = null; return v; }, e => { AUTH.pending = null; throw e; });
  return AUTH.pending;
}

/* ---------- Firestore ---------- */
function fsCall(method, url, body, retried) {
  return authToken().then(tok => fetchT(url, { method, headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: body == null ? undefined : JSON.stringify(body) }, 40000)
      .catch(() => { throw new Error("구글 저장소에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요."); }))
    .then(res => res.text().then(tx => {
      if (res.status === 401 && !retried) return authToken(true).then(() => fsCall(method, url, body, true));
      return { status: res.status, ok: res.ok, j: jparse(tx) };
    }));
}
function fsFail(r, what) {
  const m = apiErr(r.j), e = new Error(what + " 실패 (" + r.status + (m ? " " + m.slice(0, 120) : "") + ")");
  const st = r.j && r.j.error && r.j.error.status;
  e.conflict = r.status === 409 || r.status === 412 || st === "FAILED_PRECONDITION" || st === "ALREADY_EXISTS" || st === "ABORTED";
  if (r.status === 403) e.message = what + " 실패: 저장소 권한이 없습니다. Firestore 규칙을 확인해 주세요. (403)";
  return e;
}
function fsGet(path) {
  return fsCall("GET", FS_URL() + "/" + path).then(r => {
    if (r.status === 404) return { exists: false };
    if (!r.ok || !r.j) throw fsFail(r, "읽기");
    return { exists: true, fields: r.j.fields || {}, updateTime: r.j.updateTime || "" };
  });
}
function fsPatch(path, fields, pre) {
  const q = pre && pre.updateTime ? "?currentDocument.updateTime=" + enc(pre.updateTime) : "?currentDocument.exists=false";
  return fsCall("PATCH", FS_URL() + "/" + path + q, { fields }).then(r => { if (!r.ok) throw fsFail(r, "저장"); return r.j; });
}
const idOk = id => typeof id === "string" && /^[A-Za-z0-9_.-]{1,120}$/.test(id) && id !== "." && id !== "..";
function syncMark(id) { if (!AUTH.uid || SYNC.ask) return; if (SYNC.un.indexOf(id) < 0) SYNC.un.push(id); syncSave(); syncSoon(4000); }
function syncMarkAll() { if (!AUTH.uid || SYNC.ask) return; SYNC.un = DB.log.map(r => r.id); syncSave(); syncSoon(2000); }
function syncSoon(ms) { if (!fbReady() || !AUTH.uid || SYNC.ask) return; clearTimeout(SYNC.timer); SYNC.timer = setTimeout(() => { syncNow(); }, ms == null ? 4000 : ms); }

/* 받기: 서버가 찍은 시각(st) 순으로, 지난번에 받은 곳 다음부터. 늦게 올라온 옛 기록도 빠지지 않는다. */
/* 올리고 받는 요청의 모양은 여기 한 곳에서만 만든다. 연결 점검도 같은 모양으로 실제 서버에 시험해 본다. */
const logWrite = (coll, id, rec) => ({ update: { name: FS_ROOT() + "/users/" + AUTH.uid + "/" + coll + "/" + id, fields: { t: { integerValue: String(Math.round(rec.t)) }, j: { stringValue: JSON.stringify(rec) } } },
  updateTransforms: [{ fieldPath: "st", setToServerValue: "REQUEST_TIME" }] });
const logQuery = (coll, after, incl) => {
  const q = { from: [{ collectionId: coll }], orderBy: [{ field: { fieldPath: "st" }, direction: "ASCENDING" }], limit: 300 };
  if (after) q.where = { fieldFilter: { field: { fieldPath: "st" }, op: incl ? "GREATER_THAN_OR_EQUAL" : "GREATER_THAN", value: { timestampValue: after } } };
  return { structuredQuery: q };
};
function pullLog() {
  const have = {}; DB.log.forEach(r => { have[r.id] = 1; });
  let added = 0, mark = SYNC.st;
  const page = (after, incl, guard) => {
    return fsCall("POST", FS_URL() + "/users/" + AUTH.uid + ":runQuery", logQuery("log", after, incl)).then(r => {
      if (!r.ok || !Array.isArray(r.j)) throw fsFail(r, "기록 받기");
      let n = 0, fresh = 0, last = after;
      r.j.forEach(x => {
        const d = x && x.document; if (!d || !d.fields) return; n++;
        const st = d.fields.st && d.fields.st.timestampValue; if (st) last = st;
        const rec = jparse(d.fields.j && d.fields.j.stringValue);
        if (rec && rec.id && rec.t && !have[rec.id]) { DB.log.push(rec); have[rec.id] = 1; added++; fresh++; }
      });
      if (last) mark = last;
      if (n >= 300 && guard < 200 && (last !== after || fresh > 0)) return page(last, true, guard + 1);
    });
  };
  return page(SYNC.st, false, 0).then(() => {
    if (added) { DB.log.sort((x, y) => x.t - y.t); if (!dbSave("log")) throw new Error("받은 기록을 이 기기에 저장하지 못했습니다."); }
    SYNC.st = mark; SYNC.stats.down += added; syncSave();
    return added;
  });
}
/* 올리기: 아직 안 올린 기록만, 100개씩. 올린 뒤에만 목록에서 뺀다. */
function pushLog() {
  const by = {}; DB.log.forEach(r => { by[r.id] = r; });
  const ids = SYNC.un.filter(id => by[id] && idOk(id));
  SYNC.un = SYNC.un.filter(id => by[id] && idOk(id));
  const step = i => {
    if (i >= ids.length) return Promise.resolve();
    const part = ids.slice(i, i + 100);
    const writes = part.map(id => logWrite("log", id, by[id]));
    return fsCall("POST", FS_URL() + ":commit", { writes }).then(r => {
      if (!r.ok) throw fsFail(r, "기록 올리기");
      const done = {}; part.forEach(id => { done[id] = 1; });
      SYNC.un = SYNC.un.filter(id => !done[id]); SYNC.stats.up += part.length; syncSave();
      return step(i + 100);
    });
  };
  return step(0);
}
/* 구문 상자·날짜별 시간 등: 서버 것과 합친 뒤, 달라졌을 때만 올린다. 그사이 다른 기기가 고쳤으면 다시 합친다. */
function syncState(tryN) {
  const path = "users/" + AUTH.uid + "/state/main";
  return fsGet(path).then(doc => {
    const remote = doc.exists ? jparse(doc.fields.j && doc.fields.j.stringValue) : null;
    if (remote) { stateMerge(remote); STATE_KEYS.forEach(dbSave); }
    const local = stateOut(), norm = o => { const x = {}; STATE_KEYS.forEach(k => { x[k] = o && o[k] != null ? o[k] : (k === "my" ? [] : {}); }); return x; };
    if (remote && canon(norm(remote)) === canon(norm(local))) return;
    return fsPatch(path, { t: { integerValue: String(Date.now()) }, j: { stringValue: JSON.stringify(local) } }, doc.exists ? { updateTime: doc.updateTime } : null)
      .catch(e => { if (e.conflict && (tryN || 0) < 4) return syncState((tryN || 0) + 1); throw e; });
  });
}
/* ---------- 이용 키도 계정에 함께 둔다 (본인만 읽을 수 있는 users/{uid}/state/keys). 나중에 바꾼 쪽이 이긴다. ---------- */
const KEYS_T = () => { try { return JSON.parse(store.get("ec_keyt") || "{}") || {}; } catch (e) { return {}; } };
function keyTouch(k) { const t = KEYS_T(); t[k] = Date.now(); store.set("ec_keyt", JSON.stringify(t)); if (typeof syncSoon === "function") syncSoon(1500); }
function keysLocal() {
  const t = KEYS_T(), g = store.get("ec_gkey") || "", x = store.get("ec_xikey") || "";
  return { g: { v: g, t: +t.g || (g ? 1 : 0) }, x: { v: x, t: +t.x || (x ? 1 : 0), voice: store.get("ec_xivoice") || "", name: store.get("ec_xiname") || "" } };
}
function syncKeys() {
  const path = "users/" + AUTH.uid + "/state/keys", uid = AUTH.uid;
  return fsGet(path).then(doc => {
    if (AUTH.uid !== uid) return false;
    let R = {}; if (doc.exists) R = jparse(doc.fields.j && doc.fields.j.stringValue) || {};
    const L = keysLocal(), out = {}, t = KEYS_T(); let up = false, got = [];
    ["g", "x"].forEach(k => {
      const r = R[k] && typeof R[k] === "object" ? R[k] : null, l = L[k];
      if (r && (+r.t || 0) > l.t) { out[k] = r; got.push(k); t[k] = +r.t; }
      else { out[k] = l; if (l.t > ((r && +r.t) || 0)) up = true; }
    });
    if (got.length) {
      store.set("ec_keyt", JSON.stringify(t));
      if (got.indexOf("g") >= 0) { const v = String(out.g.v || ""); if (v) store.set("ec_gkey", v); else store.del("ec_gkey"); G.key = v; if (v) gList(() => { paint(); }, () => {}); }
      if (got.indexOf("x") >= 0) { const v = String(out.x.v || "");
        if (v) { store.set("ec_xikey", v); XI.key = v; if (out.x.voice) { XI.voice = String(out.x.voice); XI.name = String(out.x.name || ""); store.set("ec_xivoice", XI.voice); store.set("ec_xiname", XI.name); } XI.off = 0; xiVoices().then(() => { if (!XI.voice && XI.voices[0]) xiSetVoice(XI.voices[0].id); paint(); }, () => {}); }
        else xiClear(); }
      if (SYNC.onKeys) SYNC.onKeys(got);
    }
    if (!up) return got.length > 0;
    return fsPatch(path, { j: { stringValue: JSON.stringify(out) } }, doc.exists ? doc : null).then(() => true);
  }).catch(() => false);                              /* 키 맞추기가 안 돼도 기록 맞추기는 성공으로 둔다. 다음에 다시 한다. */
}
function syncNow() {
  if (!fbReady() || !AUTH.uid || SYNC.ask) return Promise.resolve(false);
  if (SYNC.busy) { SYNC.again = true; return Promise.resolve(false); }
  clearTimeout(SYNC.timer); SYNC.busy = true; SYNC.err = ""; paint();
  const uid = AUTH.uid;
  return pullLog().then(pushLog).then(() => syncState(0)).then(() => syncKeys()).then(() => { SYNC.last = Date.now(); SYNC.err = ""; }, e => { if (AUTH.uid === uid) SYNC.err = String(e && e.message || e).slice(0, 220); })
    .then(() => { SYNC.busy = false; syncSave(); paint(); if (SYNC.again) { SYNC.again = false; return syncNow(); } return !SYNC.err; });
}
function syncFull() { SYNC.st = ""; SYNC.un = DB.log.map(r => r.id); syncSave(); return syncNow(); }   /* 처음부터 다시 맞춘다 (모두 받고 모두 올림) */

/* ---------- 연결 점검: 어디서 막히는지 한 줄씩 ---------- */
function diagRun() {
  const out = [], add = (ok, text) => { out.push({ ok, text }); };
  if (!fbReady()) { add(false, "연결 값(apiKey·projectId·clientId)이 아직 들어 있지 않습니다."); return Promise.resolve(out); }
  add(true, "연결 값: 프로젝트 " + FB.projectId + " · 돌아올 주소 " + FB.redirect);
  const idp = idpPost("id_token=check&providerId=google.com").then(r => {
    const m = apiErr(r.j);
    if (/INVALID_IDP_RESPONSE|INVALID_ID_TOKEN|invalid/i.test(m) && !/API key/i.test(m)) add(true, "로그인 서버: 구글 로그인이 켜져 있습니다.");
    else if (/OPERATION_NOT_ALLOWED/.test(m)) add(false, "로그인 서버: 구글 로그인이 꺼져 있습니다. Authentication → 로그인 방법에서 Google을 켜 주세요.");
    else if (/CONFIGURATION_NOT_FOUND/.test(m)) add(false, "로그인 서버: Authentication을 아직 시작하지 않았습니다.");
    else if (/API key/i.test(m)) add(false, "로그인 서버: apiKey가 맞지 않습니다. (" + m.slice(0, 80) + ")");
    else add(false, "로그인 서버: 예상과 다른 답 (" + r.status + " " + m.slice(0, 100) + ")");
  }, e => add(false, "로그인 서버에 연결하지 못했습니다. (" + String(e && e.message || e).slice(0, 60) + ")"));
  const open = fetchT(FS_URL() + "/users/_check/state/main", { method: "GET" }, 30000).then(res => res.text().then(tx => {
    const j = jparse(tx), m = apiErr(j);
    if (res.status === 403) add(true, "저장소: 만들어져 있고, 로그인하지 않은 사람에게는 잠겨 있습니다.");
    else if (res.status === 404 && /database|does not exist/i.test(m)) add(false, "저장소: Firestore 데이터베이스가 아직 없습니다.");
    else if (res.status === 200 || res.status === 404) add(false, "저장소: 로그인 없이도 읽힙니다. Firestore 규칙을 안내한 내용으로 바꿔 주세요.");
    else add(false, "저장소: 예상과 다른 답 (" + res.status + " " + m.slice(0, 100) + ")");
  }), e => add(false, "저장소에 연결하지 못했습니다. (" + String(e && e.message || e).slice(0, 60) + ")"));
  return Promise.all([idp, open]).then(() => {
    if (!AUTH.uid) { add(true, "로그인하면 내 기록 읽기·쓰기도 점검합니다."); return out; }
    const path = "users/" + AUTH.uid + "/state/ping", stamp = String(Date.now());
    return authToken(true).then(() => { add(true, "로그인 표: 새로 받았습니다. (" + AUTH.email + ")"); return fsCall("PATCH", FS_URL() + "/" + path, { fields: { t: { stringValue: stamp } } }); })
      .then(r => { if (!r.ok) throw fsFail(r, "쓰기"); add(true, "내 기록 쓰기: 됩니다."); return fsGet(path); })
      .then(d => { add(d.exists && d.fields.t && d.fields.t.stringValue === stamp, "내 기록 읽기: " + (d.exists ? "됩니다." : "쓴 것이 보이지 않습니다."));
        return fsCall("POST", FS_URL() + ":commit", { writes: [logWrite("diag", "ping", { id: "ping", t: +stamp })] }); })
      .then(r => { if (!r.ok) throw fsFail(r, "기록 올리는 방식 시험"); add(true, "기록 올리는 방식: 됩니다. (시험용 자리에만 썼습니다)");
        return fsCall("POST", FS_URL() + "/users/" + AUTH.uid + ":runQuery", logQuery("diag", "2000-01-01T00:00:00Z", false)); })
      .then(r => { if (!r.ok || !Array.isArray(r.j)) throw fsFail(r, "기록 받는 방식 시험");
        const hit = r.j.some(x => { const d = x && x.document, rec = d && d.fields && jparse(d.fields.j && d.fields.j.stringValue); return !!(rec && String(rec.t) === stamp && d.fields.st && d.fields.st.timestampValue); });
        add(hit, "기록 받는 방식: " + (hit ? "됩니다." : "방금 올린 것이 보이지 않습니다."));
        return fsCall("GET", FS_URL() + "/users/_other_/state/main"); })
      .then(r => { add(r.status === 403, "남의 기록: " + (r.status === 403 ? "읽을 수 없습니다. (정상)" : "읽힙니다. 규칙을 확인해 주세요. (" + r.status + ")")); return out; })
      .catch(e => { add(false, String(e && e.message || e).slice(0, 160)); return out; });
  });
}
