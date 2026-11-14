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
    if(mode === "talk"){
      if(M.talkEmpty) return {transcript:"", reply:"", scores:{pronunciation:null,intonation:null,fluency:null,grammar:null}};
      return {transcript:T[n % T.length], reply:"Thank you for sharing. What did you do last weekend?", praise_ko:"가족 이야기를 또렷하게 시작했어요.", focus_ko:"주어가 하나일 때 동사에 s를 붙여 보세요.",
        repeat_ko: n ? "3인칭 -s가 또 빠졌어요: 'my son like'." : "",
        pronunciation:[{word:"family", heard_ko:"p 소리처럼 들렸어요.", tip_ko:"윗니를 아랫입술에 살짝 대세요.", tag:"p_fp"},{word:"church", heard_ko:"끝에 '이'가 붙었어요.", tip_ko:"ch에서 바로 끊으세요.", tag:"p_epen"},{word:"very", heard_ko:"b처럼 들렸어요.", tip_ko:"윗니를 아랫입술에.", tag:"g_sva"}],
        intonation_ko:"문장 끝이 모두 같은 높이였어요.", fluency_ko:"단어 사이 멈춤이 잦았어요.",
        grammar:[{said:"My family is four", better:"There are four of us in my family", why_ko:"가족 수는 There are 로 말해요.", tag:"g_order"},{said:"my son like swimming", better:"my son likes swimming", why_ko:"주어가 하나라서 s가 붙어요.", tag:"g_sva"},{said:"We go to Vietnam last year", better:"We went to Vietnam last year", why_ko:"지난 일이라 과거형이에요.", tag:"g_tense"},{said:"very good time", better:"a really good time", why_ko:"관사가 필요해요.", tag:"not_a_tag"},{said:"extra", better:"dropped", why_ko:"", tag:"g_art"}],
        natural:"There are four of us in my family. My first son likes swimming. We went to Vietnam last year.",
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
      return {transcript:"Every morning I wake up early and make coffee then I read the Bible for about twenty minutes and I pray for my family and my church.", scores:{pronunciation:S[0], intonation:S[1], grammar:S[2], vocabulary:S[3], task:S[4]}, comment_ko:"뜻은 분명하게 전달돼요. 기본 문법 실수가 자주 나와요.", grammar: k === "read" ? [] : [{said:"I go yesterday", better:"I went yesterday", tag:"g_tense"}], pronunciation:[{word:"think", tag:"p_th"}], delivery_tags: k === "story" ? ["d_filler"] : []};
    }
    return {};
  }
  var real = window.fetch;
  window.fetch = function(url, opt){
    url = String(url);
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
    pg.locator("#ecMain " + sel(act, arg) + ", .ec-head " + sel(act, arg) + ", #ecNav " + sel(act, arg) + ", .ec-fab " + sel(act, arg)).nth(nth).click()
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
def new_page(b, t, viewport=PHONE, init=None, perms=PERMS):
    ctx = b.new_context(viewport=viewport, permissions=perms)
    ctx.add_init_script(MOCK)
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
    pg.goto(URL); pg.wait_for_function("window.__ec && document.querySelector('#ecNav button')")
    return ctx, pg, errs
