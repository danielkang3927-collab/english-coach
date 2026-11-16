"""자동 점검 공통: 로컬 서버, 가짜 마이크, 가짜 Gemini 응답."""
import json, sys, threading, http.server, socketserver, functools

PORT = 8765
URL = "http://127.0.0.1:%d/index.html" % PORT
CHROME_ARGS = ["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
PHONE = {"width": 390, "height": 844}
IPAD = {"width": 820, "height": 1180}
PERMS = ["microphone", "clipboard-read", "clipboard-write"]

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()

def serve(root):
    h = functools.partial(Q, directory=root)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

# 구글 서버 대신 답하는 가짜. window.__mock 으로 실패 상황을 조절한다.
MOCK = r"""
(function(){
  window.__calls = [];
  window.__mock = { models:["gemini-2.5-flash","gemini-3.5-flash-preview","gemini-3.1-flash-lite","gemini-3.5-flash","gemini-3.5-pro","gemini-2.5-flash-image","text-embedding-004"],
    plan:[], batch:"alt", talkEmpty:false, testEmptyAt:-1, listStatus:200, n:0 };
  var T = ["My family is four. My first son like swimming. We go to Vietnam last year. Thank you.",
           "Yesterday I go to church and meet many people. It was very good time. Thank you.",
           "I want to share gospel with my neighbor. He don't know Jesus yet.",
           "We eat dinner together and my wife cook Korean food for them."];
  function reply(mode, text, audio){
    var M = window.__mock, n = M.n++;
    if(mode === "ask"){
      if(/zzzz/.test(text)) return {en:"", meaning_ko:"영어 표현이 아닌 것 같아요.", when_ko:"", examples:[], note_ko:""};
      return {en:"I'm swamped.", meaning_ko:"일이 너무 많아서 정신이 없어요.", when_ko:"가까운 사이에서 바쁘다고 말할 때 써요.", examples:[{en:"I'm swamped this week.", ko:"이번 주는 일이 너무 많아요."},{en:"Sorry, I was swamped yesterday.", ko:"미안해요, 어제 너무 바빴어요."}], note_ko:""};
    }
    if(mode === "talk"){
      if(M.talkEmpty) return {transcript:"", reply:"", scores:{pronunciation:null,intonation:null,fluency:null,grammar:null}};
      return {transcript:T[n % T.length], reply:"Thank you for sharing. What did you do last weekend?", praise_ko:"가족 이야기를 또렷하게 시작했어요.", focus_ko:"주어가 하나일 때 동사에 s를 붙여 보세요.",
        repeat_ko: n ? "3인칭 -s가 또 빠졌어요: 'my son like'." : "",
        pronunciation:[{word:"family", heard_ko:"p 소리처럼 들렸어요.", tip_ko:"윗니를 아랫입술에 살짝 대세요.", tag:"p_fp"},{word:"church", heard_ko:"끝에 '이'가 붙었어요.", tip_ko:"ch에서 바로 끊으세요.", tag:"p_epen"},{word:"very", heard_ko:"b처럼 들렸어요.", tip_ko:"윗니를 아랫입술에.", tag:"g_sva"}],
        intonation_ko:"문장 끝이 모두 같은 높이였어요.", fluency_ko:"단어 사이 멈춤이 잦았어요.",
        grammar:[{said:"My family is four", better:"There are four of us in my family", why_ko:"가족 수는 There are 로 말해요.", tag:"g_order"},{said:"my son like swimming", better:"my son likes swimming", why_ko:"주어가 하나라서 s가 붙어요.", tag:"g_sva"},{said:"We go to Vietnam last year", better:"We went to Vietnam last year", why_ko:"지난 일이라 과거형이에요.", tag:"g_tense"},{said:"very good time", better:"a really good time", why_ko:"관사가 필요해요.", tag:"not_a_tag"},{said:"extra", better:"dropped", why_ko:"", tag:"g_art"}],
        natural:"There are four of us in my family. My first son likes swimming. We went to Vietnam last year.",
        sents:[{en:"There are four of us in my family.", ko:"우리 가족은 네 명이에요."},{en:"My first son likes swimming.", ko:"큰아들은 수영을 좋아해요."},{en:"We went to Vietnam last year.", ko:"우리는 작년에 베트남에 갔어요."}],
        chunks:[{en:"There are four of us", ko:"우리는 네 명이에요"},{en:"in my family", ko:"우리 가족은"},{en:"We went", ko:"우리는 갔어요"},{en:"to Vietnam", ko:"베트남에"},{en:"last year", ko:"작년에"}],
        order_ko:"'누가 + 한다'를 먼저 말하고 장소와 시간을 뒤에 붙이세요.",
        phrases:[{en:"There are four of us in my family.", ko:"우리 가족은 네 명입니다."},{en:"I'm looking forward to it.", ko:"기대하고 있어요."}],
        delivery_tags:["d_ending","d_flat","bogus"], scores:{pronunciation:68, intonation:61, fluency:58, grammar:55}};
    }
    if(mode === "batch"){
      var lines = text.split("\n").filter(function(l){ return /^ITEM \d+ \|/.test(l); }), items = [];
      lines.forEach(function(l, i){
        var target = /TARGET: (.*?) \| FOCUS/.exec(l)[1], focus = /FOCUS: (\w+)/.exec(l)[1];
        var ok = M.batch === "all" ? true : (M.batch === "none" ? false : i % 2 === 0);
        if(M.batch === "silent" && i === 0){ items.push({i:i+1, heard:"", ok:true, score:null, note_ko:"", tag:""}); return; }
        items.push({i:i+1, heard: ok ? target : "He go to school", ok:ok, score: ok ? 88 : 52, note_ko: ok ? "또렷하게 말했어요." : "동사 끝에 s가 빠졌어요.", tag: ok ? "" : (focus === "none" ? "g_sva" : "")});
      });
      return {items:items};
    }
    if(mode === "retell") return {transcript:"There are four of us in my family. My first son likes swimming. We went to Vietnam last year.", covered:88, fixed_ko:"likes와 went를 바르게 말했어요.", left:[{said:"go trip", better:"go on a trip", why_ko:"go on a trip 이 한 덩어리예요.", tag:"g_prep"}], pronunciation:[{word:"Vietnam", heard_ko:"", tip_ko:"v는 윗니를 아랫입술에.", tag:"p_vb"}], cheer_ko:"처음보다 훨씬 매끄러워졌어요.", delivery_tags:[], scores:{pronunciation:74, intonation:66, fluency:70, grammar:82}};
    if(mode === "test"){
      var k = /TASK TYPE: (\w+)/.exec(text)[1], idx = ["read","daily","story","explain"].indexOf(k);
      if(M.testEmptyAt === idx){ M.testEmptyAt = -1; return {transcript:"", scores:{}, comment_ko:""}; }
      var S = {read:[72,66,null,null,90], daily:[70,64,62,60,75], story:[68,62,58,61,70], explain:[66,60,55,58,62]}[k];
      return {transcript:"Every morning I wake up early and make coffee then I read the Bible for about twenty minutes and I pray for my family and my church.", scores:{pronunciation:S[0], intonation:S[1], grammar:S[2], vocabulary:S[3], task:S[4]}, natural: k === "read" ? "" : "Every morning I wake up early and make coffee. Then I read the Bible for about twenty minutes.", sents: k === "read" ? [] : [{en:"Every morning I wake up early and make coffee.", ko:"매일 아침 일찍 일어나 커피를 내려요."},{en:"Then I read the Bible for about twenty minutes.", ko:"그리고 20분쯤 성경을 읽어요."}], comment_ko:"뜻은 분명하게 전달돼요. 기본 문법 실수가 자주 나와요.", grammar: k === "read" ? [] : [{said:"I go yesterday", better:"I went yesterday", tag:"g_tense"}], pronunciation:[{word:"think", tag:"p_th"}], delivery_tags: k === "story" ? ["d_filler"] : []};
    }
    return {};
  }
  var real = window.fetch;
  window.fetch = function(url, opt){
    url = String(url);
    if(url.indexOf("api.elevenlabs.io") >= 0){
      var X = window.__xi = window.__xi || {tts:[], mode:"ok"}; var key = (opt.headers||{})["xi-api-key"];
      var js = function(st, o){ return Promise.resolve(new Response(JSON.stringify(o), {status:st})); };
      if(key !== "sk_test_elevenlabs_key_0001") return js(401, {detail:{status:"invalid_api_key", message:"Invalid API key"}});
      if(url.indexOf("/voices") >= 0) return js(200, {voices:[{voice_id:"vF1", name:"Alice", labels:{gender:"female", accent:"british"}}, {voice_id:"vM2", name:"Zed", labels:{gender:"male", accent:"british"}}, {voice_id:"vM1", name:"Brian", labels:{gender:"male", accent:"american"}}]});
      if(url.indexOf("/user/subscription") >= 0) return js(200, {character_count:120, character_limit:10000});
      if(url.indexOf("/text-to-speech/") >= 0){
        if(X.mode === "quota") return js(401, {detail:{status:"quota_exceeded", message:"quota"}});
        if(X.bad && url.indexOf("/text-to-speech/" + X.bad) >= 0) return js(400, {detail:{status:"voice_not_allowed", message:"This voice is not available on your plan"}});
        X.tts.push({voice:url.split("/text-to-speech/")[1].split("?")[0], body:JSON.parse(opt.body)});
        return Promise.resolve(new Response(new Uint8Array(600).buffer, {status:200}));
      }
      return js(404, {detail:{status:"not_found"}});
    }
    if(url.indexOf("generativelanguage.googleapis.com") >= 0 && url.indexOf("/interactions") >= 0){
      var GT0 = window.__gt = window.__gt || {calls:[], mode:"ok"}; var bd = JSON.parse(opt.body); GT0.calls.push({model:bd.model, voice:bd.generation_config.speech_config[0].voice, text:bd.input[0].content[0].text});
      if(GT0.mode !== "ok") return Promise.resolve(new Response(JSON.stringify({error:{code:429}}), {status:429}));
      var wav = new Uint8Array(44 + 4800); var hd = [82,73,70,70,228,18,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,192,93,0,0,128,187,0,0,2,0,16,0,100,97,116,97,192,18,0,0]; for(var q=0;q<44;q++) wav[q]=hd[q];
      var bs = ""; for(var q2=0;q2<wav.length;q2++) bs += String.fromCharCode(wav[q2]);
      return Promise.resolve(new Response(JSON.stringify({steps:[{content:[{type:"audio", mime_type:"audio/wav", data:btoa(bs)}]}]}), {status:200}));
    }
    if(url.indexOf("generativelanguage.googleapis.com") < 0) return real.apply(this, arguments);
    var M = window.__mock;
    function resp(status, obj){ return new Promise(function(res){ setTimeout(function(){ res(new Response(JSON.stringify(obj), {status:status})); }, 25); }); }
    if(url.indexOf("/models?") >= 0){
      window.__calls.push({kind:"list", key:(opt.headers||{})["x-goog-api-key"]});
      if(M.listStatus !== 200) return resp(M.listStatus, {error:{message: M.listStatus === 400 ? "API key not valid. Please pass a valid API key." : "denied"}});
      return resp(200, {models: M.models.map(function(n){ return {name:"models/"+n, supportedGenerationMethods: /embedding/.test(n) ? ["embedContent"] : ["generateContent"]}; })});
    }
    var model = decodeURIComponent(/models\/([^:]+):/.exec(url)[1]), body = JSON.parse(opt.body), parts = body.contents[0].parts;
    var text = parts.filter(function(p){ return p.text; }).map(function(p){ return p.text; }).join("\n"), audio = parts.filter(function(p){ return p.inlineData; });
    var mode = /MODE: (\w+)/.exec(text)[1];
    var call = {kind:"gen", model:model, mode:mode, audio:audio.length, bytes:audio.map(function(a){ return a.inlineData.data.length; }), mime:audio.length ? audio[0].inlineData.mimeType : "", text:text, sys:body.systemInstruction.parts[0].text, temp:body.generationConfig.temperature, json:body.generationConfig.responseMimeType, key:opt.headers["x-goog-api-key"]};
    window.__calls.push(call);
    var plan = M.plan.length ? M.plan.shift() : "ok"; call.plan = plan;
    if(/^slow-/.test(plan)){ var later = plan.slice(5); return new Promise(function(res){ setTimeout(res, 1200); }).then(function(){ M.plan.unshift(later); window.__calls.pop(); return window.fetch(url, opt); }); }
    if(plan === "net") return new Promise(function(_, rej){ setTimeout(function(){ rej(new TypeError("Failed to fetch")); }, 20); });
    if(plan === "429day") return resp(429, {error:{code:429, message:"Quota exceeded for metric: generate_content_free_tier_requests, limit: 20 PerDay", status:"RESOURCE_EXHAUSTED"}});
    if(plan === "429min") return resp(429, {error:{code:429, message:"Quota exceeded per minute", details:[{"@type":"type.googleapis.com/google.rpc.RetryInfo", retryDelay:"21s"}]}});
    if(plan === "500") return resp(503, {error:{message:"The model is overloaded."}});
    if(plan === "404") return resp(404, {error:{message:"models/" + model + " is not found"}});
    if(plan === "403") return resp(403, {error:{message:"Permission denied"}});
    if(plan === "bad") return resp(200, {candidates:[{content:{parts:[{text:"this is not json"}]}}]});
    if(plan === "empty") return resp(200, {candidates:[], promptFeedback:{blockReason:"OTHER"}});
    var out = reply(mode, text, audio.length);
    if(plan === "slow") return new Promise(function(res){ setTimeout(function(){ res(new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(out)}]}}]}), {status:200})); }, 1200); });
    return resp(200, {candidates:[{content:{parts:[{text: plan === "fenced" ? "```json\n" + JSON.stringify(out) + "\n```" : JSON.stringify(out)}]}}]});
  };
})();
"""

class T:
    def __init__(self): self.fails = []; self.n = 0
    def check(self, name, cond, extra=""):
        self.n += 1
        print(("PASS " if cond else "FAIL ") + name + ((" :: " + str(extra)) if (extra != "" and not cond) else ""), flush=True)
        if not cond: self.fails.append(name)
    def done(self):
        print("\n%d checks, %d failed" % (self.n, len(self.fails)))
        for f in self.fails: print("  FAILED: " + f)
        return 1 if self.fails else 0

def sel(act, arg=None):
    return '[data-act="%s"]' % act + ('[data-arg="%s"]' % arg if arg is not None else "")
def click(pg, act, arg=None, nth=0):
    pg.locator(", ".join(box + " " + sel(act, arg) for box in ["#ecMain", ".ec-head", "#ecNav", ".ec-fab", "#ecWarn"])).nth(nth).click()
def has(pg, act, arg=None): return pg.locator(sel(act, arg)).count() > 0
def phase(pg): return pg.evaluate("window.__ec.A ? window.__ec.A.phase : null")
def wait_phase(pg, ph, timeout=15000): pg.wait_for_function("window.__ec.A && window.__ec.A.phase === '%s'" % ph, timeout=timeout)
def rec(pg, sec):
    click(pg, "rec"); pg.wait_for_selector(".ec-btn.rec.on", timeout=8000); pg.wait_for_timeout(int(sec * 1000)); click(pg, "rec")
def text(pg): return pg.locator("#ecMain").inner_text()
def note(pg): return pg.locator("#ecMsg").inner_text() if pg.locator("#ecMsg").count() else ""
def handlers_ok(pg):
    """화면에 있는 모든 버튼·입력에 처리기가 연결돼 있는지"""
    return pg.evaluate("""() => { const bad=[]; document.querySelectorAll('[data-act]').forEach(e=>{ if(typeof window.__ec.ACT[e.getAttribute('data-act')]!=='function') bad.push('act:'+e.getAttribute('data-act')); });
      document.querySelectorAll('[data-chg]').forEach(e=>{ if(typeof window.__ec.CHG[e.getAttribute('data-chg')]!=='function') bad.push('chg:'+e.getAttribute('data-chg')); });
      document.querySelectorAll('button').forEach(e=>{ if(!e.getAttribute('data-act')) bad.push('nobind:'+e.textContent.slice(0,20)); });
      const ids={}; document.querySelectorAll('[id]').forEach(e=>{ ids[e.id]=(ids[e.id]||0)+1; }); Object.keys(ids).forEach(k=>{ if(ids[k]>1) bad.push('dupid:'+k); });
      return bad; }""")
def set_key(pg, key="AIzaTESTKEY123"):
    click(pg, "tab", "set"); pg.fill("#ecGKey", key); click(pg, "gSave")
    pg.wait_for_function("document.querySelector('#ecMain').innerText.indexOf('키가 확인됐습니다') >= 0", timeout=8000)
def new_page(b, t, viewport=PHONE, init=None, perms=PERMS, fake=None):
    ctx = b.new_context(viewport=viewport, permissions=perms)
    if fake: fake.attach(ctx)
    ctx.add_init_script(MOCK)
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
    pg.goto(URL); pg.wait_for_function("window.__ec && document.querySelector('#ecNav button')")
    return ctx, pg, errs


# ---------------------------------------------------------------------------
# 가짜 구글·Firebase 서버. 여러 기기(브라우저 창)가 같은 서버를 본다.
# 문서 형식은 Firebase REST 문서(accounts:signInWithIdp, securetoken, Firestore documents)를 따른다.
# ---------------------------------------------------------------------------
import re, base64, urllib.parse, datetime

FBCFG = {"apiKey": "AIzaFAKEWEBKEY", "projectId": "english-coach-test", "clientId": "1234-abc.apps.googleusercontent.com", "redirect": URL}
FB_GATE = "window.__FB = %s;" % json.dumps(FBCFG)                      # 처음 화면(로그인 권유)까지 보는 점검용
FB_INIT = FB_GATE + 'try{localStorage.setItem("ec_gateskip","1")}catch(e){}'   # 나머지 점검은 처음 화면을 건너뛴 상태에서 시작
CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "content-type": "application/json; charset=utf-8"}

def b64u(b): return base64.urlsafe_b64encode(b).decode().rstrip("=")
def make_jwt(payload): return b64u(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()) + "." + b64u(json.dumps(payload, ensure_ascii=False).encode("utf-8")) + ".c2ln"
def jwt_payload(tok):
    try:
        p = tok.split(".")[1]; return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)).decode("utf-8"))
    except Exception: return None

class FakeGoogle:
    def __init__(self):
        self.account = {"sub": "1001", "email": "pastor@example.com", "name": "강동윤"}
        self.docs = {}                      # 경로 → {fields, createTime, updateTime}
        self.tokens = set(); self.n = 0; self.clock = 0
        self.auth_requests = []; self.idp_requests = []; self.count = {"get": 0, "patch": 0, "commit": 0, "query": 0, "refresh": 0, "idp": 0, "delete": 0}
        # 실패 상황 스위치
        self.oauth_error = None; self.bad_state = False; self.bad_nonce = False; self.provider_off = False; self.reject_id_token = False
        self.revoked = False; self.reject_once = False; self.down = False; self.before_patch = None
    # ---- 공통 ----
    def now(self):
        self.clock += 1
        return (datetime.datetime(2026, 11, 15, 0, 0, 0) + datetime.timedelta(milliseconds=self.clock)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    def send(self, route, status, obj): route.fulfill(status=status, headers=CORS, body=json.dumps(obj, ensure_ascii=False))
    def err(self, route, status, st, msg=None): self.send(route, status, {"error": {"code": status, "message": msg or st, "status": st}})
    def attach(self, ctx):
        ctx.route(re.compile(r"^https://accounts\.google\.com/o/oauth2/v2/auth"), self.h_oauth)
        ctx.route(re.compile(r"^https://identitytoolkit\.googleapis\.com/"), self.h_idp)
        ctx.route(re.compile(r"^https://securetoken\.googleapis\.com/"), self.h_token)
        ctx.route(re.compile(r"^https://firestore\.googleapis\.com/"), self.h_fs)
    def new_token(self, uid):
        self.n += 1; tok = "IDT.%s.%d" % (uid, self.n); self.tokens.add(tok); return tok
    def logs(self, uid): return {k.split("/log/")[1]: v for k, v in self.docs.items() if k.startswith("users/%s/log/" % uid)}
    def state(self, uid):
        d = self.docs.get("users/%s/state/main" % uid); return json.loads(d["fields"]["j"]["stringValue"]) if d else None
    # ---- 구글 로그인 화면 (바로 돌려보낸다) ----
    def h_oauth(self, route, request):
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(request.url).query)); self.auth_requests.append(q)
        if q.get("redirect_uri") != FBCFG["redirect"] or q.get("client_id") != FBCFG["clientId"]:
            route.fulfill(status=400, headers={"content-type": "text/html; charset=utf-8"}, body="<h1>400 redirect_uri_mismatch</h1>"); return
        if self.oauth_error: frag = "error=%s&state=%s" % (self.oauth_error, q.get("state", ""))
        else:
            a = self.account
            idt = make_jwt({"iss": "https://accounts.google.com", "aud": q["client_id"], "sub": a["sub"], "email": a["email"], "name": a["name"], "nonce": "wrong" if self.bad_nonce else q.get("nonce", "")})
            frag = urllib.parse.urlencode({"state": "wrong" if self.bad_state else q.get("state", ""), "access_token": "AT." + a["sub"], "token_type": "Bearer", "expires_in": "3599", "scope": "email profile openid", "id_token": idt, "authuser": "0", "prompt": "none"})
        route.fulfill(status=200, headers={"content-type": "text/html; charset=utf-8"}, body="<script>location.replace(%s)</script>" % json.dumps(q["redirect_uri"] + "#" + frag))
    # ---- Firebase 로그인 ----
    def h_idp(self, route, request):
        if request.method == "OPTIONS": route.fulfill(status=204, headers=CORS); return
        self.count["idp"] += 1
        key = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(request.url).query)).get("key")
        body = json.loads(request.post_data or "{}"); self.idp_requests.append(body)
        if key != FBCFG["apiKey"]: self.err(route, 400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key."); return
        if self.provider_off: self.err(route, 400, "INVALID_ARGUMENT", "OPERATION_NOT_ALLOWED : The identity provider configuration is disabled."); return
        pb = dict(urllib.parse.parse_qsl(body.get("postBody", ""))); acct = None
        if pb.get("providerId") == "google.com" and "id_token" in pb and not self.reject_id_token:
            c = jwt_payload(pb["id_token"])
            if c and c.get("aud") == FBCFG["clientId"]: acct = c
        elif pb.get("providerId") == "google.com" and pb.get("access_token", "").startswith("AT."):
            sub = pb["access_token"][3:]; acct = {"sub": sub, "email": self.account["email"] if self.account["sub"] == sub else sub + "@example.com", "name": self.account["name"]}
        if not acct: self.err(route, 400, "INVALID_ARGUMENT", "INVALID_IDP_RESPONSE : Invalid Idp Response: the Google id_token is not allowed to be used with this application."); return
        uid = "U" + acct["sub"]
        self.send(route, 200, {"federatedId": "https://accounts.google.com/" + acct["sub"], "providerId": "google.com", "localId": uid, "emailVerified": True, "email": acct["email"],
                               "displayName": acct.get("name", ""), "idToken": self.new_token(uid), "refreshToken": "RT." + uid, "expiresIn": "3600", "kind": "identitytoolkit#VerifyAssertionResponse"})
    def h_token(self, route, request):
        if request.method == "OPTIONS": route.fulfill(status=204, headers=CORS); return
        self.count["refresh"] += 1
        f = dict(urllib.parse.parse_qsl(request.post_data or "")); rt = f.get("refresh_token", "")
        if self.revoked or f.get("grant_type") != "refresh_token" or not rt.startswith("RT."): self.err(route, 400, "INVALID_ARGUMENT", "TOKEN_EXPIRED"); return
        uid = rt[3:]; self.send(route, 200, {"expires_in": "3600", "token_type": "Bearer", "refresh_token": rt, "id_token": self.new_token(uid), "user_id": uid, "project_id": "1234"})
    # ---- Firestore ----
    def h_fs(self, route, request):
        if request.method == "OPTIONS": route.fulfill(status=204, headers=CORS); return
        if self.down: self.err(route, 503, "UNAVAILABLE", "The service is currently unavailable."); return
        u = urllib.parse.urlparse(request.url); q = dict(urllib.parse.parse_qsl(u.query))
        root = "/v1/projects/%s/databases/(default)/documents" % FBCFG["projectId"]; path = urllib.parse.unquote(u.path)
        if not path.startswith(root): self.err(route, 404, "NOT_FOUND", "database not found"); return
        rest = path[len(root):].lstrip("/")
        auth = request.headers.get("authorization", "")
        if not auth: self.err(route, 403, "PERMISSION_DENIED", "Missing or insufficient permissions."); return
        tok = auth.replace("Bearer ", "")
        if self.reject_once: self.reject_once = False; self.tokens.discard(tok)
        if tok not in self.tokens: self.err(route, 401, "UNAUTHENTICATED", "Request had invalid authentication credentials."); return
        uid = tok.split(".")[1]; mine = lambda p: p.startswith("users/%s/" % uid)
        body = json.loads(request.post_data) if request.post_data else {}
        if rest == ":commit" and request.method == "POST":
            self.count["commit"] += 1; pre = "projects/%s/databases/(default)/documents/" % FBCFG["projectId"]; ws = body.get("writes", [])
            if len(ws) > 500: self.err(route, 400, "INVALID_ARGUMENT", "too many writes"); return
            for w in ws:
                if "update" not in w or not w["update"]["name"].startswith(pre) or not mine(w["update"]["name"][len(pre):]): self.err(route, 403, "PERMISSION_DENIED", "Missing or insufficient permissions."); return
            ts = self.now()
            for w in ws:
                p = w["update"]["name"][len(pre):]; f = dict(w["update"].get("fields", {}))
                for tr in w.get("updateTransforms", []):
                    if tr.get("setToServerValue") == "REQUEST_TIME": f[tr["fieldPath"]] = {"timestampValue": ts}
                old = self.docs.get(p); self.docs[p] = {"fields": f, "createTime": old["createTime"] if old else ts, "updateTime": ts}
            self.send(route, 200, {"writeResults": [{"updateTime": ts} for _ in ws], "commitTime": ts}); return
        if rest.endswith(":runQuery") and request.method == "POST":
            self.count["query"] += 1; parent = rest[:-len(":runQuery")]
            if not mine(parent + "/"): self.err(route, 403, "PERMISSION_DENIED", "Missing or insufficient permissions."); return
            sq = body["structuredQuery"]; col = sq["from"][0]["collectionId"]; field = sq["orderBy"][0]["field"]["fieldPath"]
            rows = [(k, v) for k, v in self.docs.items() if k.startswith(parent + "/" + col + "/") and field in v["fields"]]
            ff = sq.get("where", {}).get("fieldFilter")
            if ff:
                val = ff["value"]["timestampValue"]; get = lambda v: v["fields"][ff["field"]["fieldPath"]]["timestampValue"]
                rows = [r for r in rows if (get(r[1]) > val if ff["op"] == "GREATER_THAN" else get(r[1]) >= val)]
            rows.sort(key=lambda r: (r[1]["fields"][field]["timestampValue"], r[0])); rows = rows[: sq.get("limit", 10 ** 9)]
            rt = self.now(); pre = "projects/%s/databases/(default)/documents/" % FBCFG["projectId"]
            self.send(route, 200, [{"document": {"name": pre + k, "fields": v["fields"], "createTime": v["createTime"], "updateTime": v["updateTime"]}, "readTime": rt} for k, v in rows] or [{"readTime": rt}]); return
        if rest == "board" and request.method == "GET":          # 함께 보기: 로그인한 누구나 목록을 읽는다
            self.count["get"] += 1; pre = "projects/%s/databases/(default)/documents/" % FBCFG["projectId"]
            if getattr(self, "board_deny", False): self.err(route, 403, "PERMISSION_DENIED", "Missing or insufficient permissions."); return
            self.send(route, 200, {"documents": [{"name": pre + k, **v} for k, v in sorted(self.docs.items()) if k.startswith("board/")]}); return
        if rest.startswith("board/") and not getattr(self, "board_deny", False) and (request.method == "GET" or rest == "board/" + uid): mine = lambda p: True
        shared_ok = rest.startswith("shared/") and (request.method == "GET" or uid == getattr(self, "share_owner", "U1001"))   # 함께 쓰는 키: 읽기는 로그인한 누구나, 쓰기는 주인만
        if not mine(rest) and not shared_ok: self.err(route, 403, "PERMISSION_DENIED", "Missing or insufficient permissions."); return
        if request.method == "GET":
            self.count["get"] += 1; d = self.docs.get(rest)
            if not d: self.err(route, 404, "NOT_FOUND", "Document not found."); return
            self.send(route, 200, {"name": "projects/%s/databases/(default)/documents/%s" % (FBCFG["projectId"], rest), **d}); return
        if request.method == "PATCH":
            self.count["patch"] += 1
            if self.before_patch and rest.endswith("/state/main"): hook = self.before_patch; self.before_patch = None; hook(self, rest)
            d = self.docs.get(rest)
            if q.get("currentDocument.exists") == "false" and d: self.err(route, 409, "ALREADY_EXISTS", "Document already exists."); return
            if "currentDocument.updateTime" in q and (not d or d["updateTime"] != q["currentDocument.updateTime"]): self.err(route, 400, "FAILED_PRECONDITION", "the stored version does not match the required base version"); return
            ts = self.now(); self.docs[rest] = {"fields": body.get("fields", {}), "createTime": d["createTime"] if d else ts, "updateTime": ts}
            self.send(route, 200, {"name": rest, **self.docs[rest]}); return
        if request.method == "DELETE": self.count["delete"] += 1; self.err(route, 403, "PERMISSION_DENIED", "Missing or insufficient permissions."); return
        self.err(route, 400, "INVALID_ARGUMENT", "unsupported")

def wait_js(pg, js, timeout=15000):
    """화면이 다른 주소로 갔다 오는 동안에도 기다린다"""
    import time
    end = time.time() + timeout / 1000
    while True:
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        if time.time() > end: raise AssertionError("기다리다 시간 초과: " + js[:120])
        pg.wait_for_timeout(120)
