import json, sys, threading, http.server, socketserver, functools, time
from playwright.sync_api import sync_playwright

ROOT = sys.argv[1]
OUT = sys.argv[2]
PORT = 8765
FAKE_WAV = sys.argv[3] if len(sys.argv) > 3 else ""

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    h = functools.partial(Q, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

def word(w, off, dur, acc, phs, flags=None, err="None"):
    fb = {"Prosody": {"Break": {"ErrorTypes": ["None"], "UnexpectedBreak": {"Confidence": 0.1}, "MissingBreak": {"Confidence": 0.1}},
                      "Intonation": {"ErrorTypes": [], "Monotone": {"SyllablePitchDeltaConfidence": 0.3}}}}
    if flags:
        if "UnexpectedBreak" in flags: fb["Prosody"]["Break"]["UnexpectedBreak"]["Confidence"] = 0.9
        if "Monotone" in flags: fb["Prosody"]["Intonation"]["ErrorTypes"] = ["Monotone"]
    return {"Word": w, "Offset": int(off*1e7), "Duration": int(dur*1e7),
            "PronunciationAssessment": {"AccuracyScore": acc, "ErrorType": err, "Feedback": fb},
            "Syllables": [{"Syllable": "".join(p for p, _ in phs), "PronunciationAssessment": {"AccuracyScore": acc}}],
            "Phonemes": [{"Phoneme": p, "PronunciationAssessment": {"AccuracyScore": a}} for p, a in phs]}

def seg(text, words, flu, pros, off, dur):
    return {"RecognitionStatus": "Success", "Offset": int(off*1e7), "Duration": int(dur*1e7), "DisplayText": text,
            "NBest": [{"Display": text, "PronunciationAssessment": {"AccuracyScore": 80, "FluencyScore": flu, "ProsodyScore": pros, "PronScore": 78},
                       "Words": words}]}

SPEAK = [
    seg("I think the Lord is really faithful.", [
        word("I", 0.5, 0.2, 98, [("aɪ", 98)]),
        word("think", 0.8, 0.4, 52, [("θ", 30), ("ɪ", 80), ("ŋ", 70), ("k", 90)]),
        word("the", 1.3, 0.2, 70, [("ð", 55), ("ə", 85)]),
        word("Lord", 2.4, 0.5, 58, [("l", 62), ("ɔ", 60), ("r", 40), ("d", 80)], flags=["UnexpectedBreak"]),
        word("is", 3.0, 0.2, 95, [("ɪ", 95), ("z", 95)]),
        word("really", 3.3, 0.5, 45, [("r", 35), ("i", 60), ("l", 40), ("i", 70)]),
        word("faithful", 3.9, 0.6, 66, [("f", 70), ("eɪ", 85), ("θ", 40), ("f", 72), ("ə", 80), ("l", 60)]),
    ], 62, 71, 0.5, 4.0),
    seg("He loves three things.", [
        word("He", 6.2, 0.2, 96, [("h", 96), ("i", 96)]),
        word("loves", 6.5, 0.4, 82, [("l", 75), ("ʌ", 85), ("v", 78), ("z", 90)]),
        word("three", 7.0, 0.4, 55, [("θ", 35), ("r", 50), ("i", 85)]),
        word("things", 7.5, 0.5, 64, [("θ", 45), ("ɪ", 80), ("ŋ", 70), ("z", 75)]),
    ], 74, 69, 6.2, 1.8),
]
READ = [
    seg("Now go in peace may the grace of Lord Jesus be with you all.", [
        word(w, 0.4*i, 0.3, a, [("x", a)]) for i, (w, a) in enumerate(
            [("Now", 90), ("go", 92), ("in", 95), ("peace", 70), ("may", 88), ("the", 80), ("grace", 58), ("of", 90), ("Lord", 61),
             ("Jesus", 85), ("really", 77), ("be", 93), ("with", 66), ("you", 97), ("all", 84)])
    ], 81, 77, 0, 6.2)
]

MOCK = """
(function(){
  var SEGS = %s;
  var mode = function(){ return window.__mockMode || 'speak'; };
  function Rec(){ }
  Rec.prototype.startContinuousRecognitionAsync = function(ok, err){
    var self=this;
    if(window.__mockFail==='mic'){ setTimeout(function(){ err('NotAllowedError: Permission denied'); }, 10); return; }
    setTimeout(function(){ ok(); }, 10);
    if(window.__mockFail==='auth'){ setTimeout(function(){ self.canceled(self, {reason:1, errorCode:1, errorDetails:'WebSocket upgrade failed: Authentication error (401).'}); }, 60); return; }
    var segs = SEGS[mode()];
    segs.forEach(function(s, i){
      setTimeout(function(){
        self.recognizing && self.recognizing(self, {result:{text:'...'}});
        self.recognized(self, {result:{reason:3, text:s.DisplayText, properties:{getProperty:function(){ return JSON.stringify(s); }}}});
      }, 40 + 30*i);
    });
  };
  Rec.prototype.stopContinuousRecognitionAsync = function(ok){ setTimeout(ok, 10); };
  Rec.prototype.close = function(){ window.__closed = (window.__closed||0)+1; };
  function PAC(ref){ this.ref=ref; window.__lastRef=ref; }
  Object.defineProperty(PAC.prototype,'enableProsodyAssessment',{set:function(v){ window.__prosodyOn=v; }});
  Object.defineProperty(PAC.prototype,'phonemeAlphabet',{set:function(v){ window.__alphabet=v; }});
  PAC.prototype.applyTo=function(){};
  window.SpeechSDK = {
    SpeechConfig:{ fromSubscription:function(k,r){ window.__region=r; return {}; } },
    AudioConfig:{ fromDefaultMicrophoneInput:function(){ return {}; } },
    PronunciationAssessmentConfig: PAC,
    PronunciationAssessmentGradingSystem:{HundredMark:1}, PronunciationAssessmentGranularity:{Phoneme:1},
    SpeechRecognizer: Rec,
    ResultReason:{RecognizedSpeech:3}, CancellationReason:{Error:1},
    CancellationErrorCode:{1:'AuthenticationFailure', 4:'ConnectionFailure'},
    PropertyId:{SpeechServiceResponse_JsonResult:'j'}
  };
})();
""" % json.dumps({"speak": SPEAK, "read": READ})

fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" :: " + str(extra) if extra and not cond else ""))
    if not cond: fails.append(name)

srv = serve()
URL = "http://127.0.0.1:%d/index.html" % PORT
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=" + FAKE_WAV, "--autoplay-policy=no-user-gesture-required"])

    # ---------- A. 진짜 라이브러리 ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, permissions=["microphone"])
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    check("A1 라이브러리 로드", pg.evaluate("!!(window.SpeechSDK && SpeechSDK.PronunciationAssessmentConfig && SpeechSDK.SpeechRecognizer)"))
    cfgjson = pg.evaluate("""(function(){ var s=SpeechSDK; var c=new s.PronunciationAssessmentConfig('hello world', s.PronunciationAssessmentGradingSystem.HundredMark, s.PronunciationAssessmentGranularity.Phoneme, false); c.phonemeAlphabet='IPA'; c.enableProsodyAssessment=true; return c.toJSON(); })()""")
    print("   설정 JSON:", cfgjson)
    cj = json.loads(cfgjson)
    check("A2 설정에 IPA·음소 단위·억양 포함", cj.get("phonemeAlphabet") == "IPA" and cj.get("granularity") == "Phoneme" and str(cj.get("EnableProsodyAssessment", cj.get("enableProsodyAssessment"))).lower() == "true", cfgjson)
    pg.click('[data-tab="practice"]')
    check("A3 처음 안내 문구", "Azure" in pg.inner_text("#ecMsg"))
    pg.click('[data-act="rec"]')
    check("A4 키 없이 시작하면 안내", "이용 키" in pg.inner_text("#ecMsg"))
    pg.click('[data-tab="setup"]'); pg.fill("#ecKey", "0000000000000000000000000000fake"); pg.fill("#ecRegion", "KoreaCentral "); pg.click('[data-act="savekey"]')
    check("A5 지역 이름 정리", pg.input_value("#ecRegion") == "koreacentral")
    pg.click('[data-tab="practice"]'); pg.click('[data-act="rec"]')
    try:
        pg.wait_for_function("document.querySelector('#ecMsg .err') && window.__ec.S.state==='idle'", timeout=40000)
        m = pg.inner_text("#ecMsg"); print("   가짜 키 결과 문구:", m)
        check("A6 가짜 키: 한글 오류 문구 + 대기 상태 복귀", len(m) > 5 and not pg.is_disabled("#ecRec"))
    except Exception as e:
        st = pg.evaluate("window.__ec.S.state"); print("   상태:", st, "문구:", pg.inner_text("#ecMsg"))
        if st == "rec":
            pg.click('[data-act="rec"]'); pg.wait_for_function("window.__ec.S.state==='idle'", timeout=15000)
            print("   끝낸 뒤 문구:", pg.inner_text("#ecMsg"))
            check("A6 가짜 키: 끝내기 뒤 대기 상태 복귀 + 문구", len(pg.inner_text("#ecMsg")) > 5)
        else:
            check("A6 가짜 키 처리", False, str(e)[:200])
    check("A7 화면 오류 없음", not errs, errs)
    ctx.close()

    # ---------- B. 흉내 라이브러리로 전체 흐름 ----------
    for name, vp in (("phone", {"width": 390, "height": 844}), ("ipad", {"width": 820, "height": 1180})):
        ctx = b.new_context(viewport=vp, permissions=["clipboard-read", "clipboard-write"])
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(URL); pg.evaluate(MOCK)
        # 모든 data-act 요소에 처리기가 있는지: 문서 단위 연결이므로 종류만 대조
        acts = pg.evaluate("Array.from(new Set(Array.from(document.querySelectorAll('[data-act]')).map(e=>e.getAttribute('data-act'))))")
        known = {"tab", "mode", "pick", "rec", "word", "copy", "again", "savekey", "clearkey", "copyhist", "tstart", "trec", "say", "tcopy", "gsave", "gmodels", "gclear"}
        check(name + " B0 버튼 종류가 모두 처리 목록에 있음", set(acts) <= known, acts)
        pg.click('[data-tab="setup"]'); pg.fill("#ecKey", "k"); pg.fill("#ecRegion", "eastus"); pg.check("#ecRemember"); pg.click('[data-act="savekey"]')
        check(name + " B1 저장 문구", "저장했습니다" in pg.inner_text("#ecKeyMsg"))
        pg.click('[data-tab="practice"]')
        # 말하기: 5개 질문 모두 눌러 보기
        for i in range(5):
            pg.click('[data-act="pick"][data-i="%d"]' % i)
            check(name + " B2 질문 %d 표시" % (i+1), pg.inner_text("#ecTask").strip() != "" and pg.get_attribute('[data-act="pick"][data-i="%d"]' % i, "aria-pressed") == "true")
        pg.click('[data-act="pick"][data-i="2"]')
        for rnd in (1, 2):   # 열기 → 닫기 → 다시 열기
            pg.click('[data-act="rec"]'); pg.wait_for_function("window.__ec.S.state==='rec'")
            check(name + " B3-%d 녹음 중 버튼 문구" % rnd, "끝내고 채점" in pg.inner_text("#ecRec"))
            pg.wait_for_timeout(200); pg.click('[data-act="rec"]')
            pg.wait_for_selector("#ecResult:not(.ec-hide)")
            sc = pg.inner_text("#ecScores");
            check(name + " B4-%d 점수 4칸" % rnd, pg.locator("#ecScores .ec-score").count() == 4, sc)
            check(name + " B5-%d 단어 11개" % rnd, pg.locator("#ecWords .ec-word").count() == 11)
            check(name + " B6-%d 약한 소리에 θ" % rnd, "θ" in pg.inner_text("#ecWeak"))
            check(name + " B7-%d 어색한 끊김 표시" % rnd, "Lord" in pg.inner_text("#ecProsody"))
            pg.click('#ecWords .ec-word >> text=think');
            check(name + " B8-%d 단어 상세 열림" % rnd, pg.is_visible("#ecDetail") and "θ" in pg.inner_text("#ecDetail"))
            pg.click('#ecWords .ec-word >> text=think')
            check(name + " B9-%d 단어 상세 닫힘" % rnd, not pg.is_visible("#ecDetail"))
            pg.click('#ecWords .ec-word >> text=three')
            check(name + " B10-%d 다른 단어 다시 열림" % rnd, pg.is_visible("#ecDetail") and "three" in pg.inner_text("#ecDetail"))
            pg.click('[data-act="copy"]'); pg.wait_for_timeout(150)
            clip = pg.evaluate("navigator.clipboard.readText()")
            check(name + " B11b-%d 예시 단어 중복 없음" % rnd, "faithful, faithful" not in clip)
            check(name + " B11-%d 결과 복사 내용" % rnd, "영어 말하기 코치 결과" in clip and "think(52)" in clip and "약한 소리" in clip, clip[:200])
            if rnd == 1 and name == "phone": print("---- 복사되는 글 ----\n" + clip + "\n--------------------")
            if rnd == 1: pg.screenshot(path="%s/%s-result.png" % (OUT, name), full_page=True)
            pg.click('[data-act="again"]')
            check(name + " B12-%d 다시 하기로 결과 닫힘" % rnd, not pg.is_visible("#ecResult"))
        check(name + " B13 마이크 닫기 2회", pg.evaluate("window.__closed") == 2)
        check(name + " B13b 억양 켬·IPA가 설정에 전달", pg.evaluate("window.__prosodyOn===true && window.__alphabet==='IPA'"))
        # 읽기
        pg.evaluate("window.__mockMode='read'")
        pg.click('[data-mode="read"]')
        check(name + " B14 읽기 항목 6개", pg.locator('[data-act="pick"]').count() == 6)
        pg.click('[data-act="pick"][data-i="5"]')
        check(name + " B15 직접 넣기 입력칸 보임", pg.is_visible("#ecCustom") and not pg.is_visible("#ecTask"))
        pg.click('[data-act="rec"]')
        check(name + " B16 원고 없이 시작하면 안내", "원고" in pg.inner_text("#ecMsg"))
        pg.click('[data-act="pick"][data-i="3"]')
        pg.click('[data-act="rec"]'); pg.wait_for_function("window.__ec.S.state==='rec'"); pg.wait_for_timeout(150); pg.click('[data-act="rec"]')
        pg.wait_for_selector("#ecResult:not(.ec-hide)")
        check(name + " B17 읽기 점수 5칸(완성도)", pg.locator("#ecScores .ec-score").count() == 5 and "완성도" in pg.inner_text("#ecScores"))
        check(name + " B18 빠뜨린 단어 표시", pg.locator("#ecWords .w-omit").count() > 5 and "원고에 없음" in pg.inner_text("#ecWords"))
        check(name + " B19 원고가 채점 설정에 전달", pg.evaluate("window.__lastRef").startswith("Now go in peace."))
        comp = pg.evaluate("window.__ec.S.last.comp"); print("   완성도:", round(comp, 1))
        check(name + " B20 완성도 계산(원고 31단어 중 14단어)", abs(comp - 100*14/31) < 0.01, comp)
        pg.screenshot(path="%s/%s-read.png" % (OUT, name), full_page=True)
        # 오류 경로
        pg.click('[data-act="again"]'); pg.evaluate("window.__mockFail='mic'"); pg.click('[data-act="rec"]')
        pg.wait_for_function("document.querySelector('#ecMsg .err')")
        check(name + " B21 마이크 거부 문구", "마이크 사용이 허용되지" in pg.inner_text("#ecMsg") and pg.evaluate("window.__ec.S.state") == "idle")
        pg.evaluate("window.__mockFail='auth'"); pg.click('[data-act="rec"]')
        pg.wait_for_function("document.querySelector('#ecMsg .err') && /키/.test(document.querySelector('#ecMsg').innerText)")
        check(name + " B22 키 오류 문구 + 대기 복귀", pg.evaluate("window.__ec.S.state") == "idle" and not pg.is_disabled("#ecRec"))
        pg.evaluate("window.__mockFail=null")
        # 기록
        pg.click('[data-tab="history"]')
        check(name + " B23 기록 3건", pg.locator("#ecHist tr").count() == 4, pg.inner_text("#ecHist"))
        pg.click('[data-act="copyhist"]'); pg.wait_for_timeout(150)
        check(name + " B24 기록 복사", "연습 기록" in pg.evaluate("navigator.clipboard.readText()"))
        pg.screenshot(path="%s/%s-history.png" % (OUT, name), full_page=True)
        # 새로 고쳐도 키·기록 유지, 지우기
        pg.reload(); pg.evaluate(MOCK)
        check(name + " B25 새로 고침 뒤 키 기억", pg.evaluate("document.getElementById('ecKey').value") == "k" and pg.inner_text("#ecMsg").strip() == "")
        pg.click('[data-tab="history"]'); check(name + " B26 새로 고침 뒤 기록 유지", pg.locator("#ecHist tr").count() == 4)
        pg.click('[data-tab="setup"]'); pg.screenshot(path="%s/%s-setup.png" % (OUT, name), full_page=True)
        pg.click('[data-act="clearkey"]')
        check(name + " B27 키 지우기", pg.input_value("#ecKey") == "" and pg.evaluate("localStorage.getItem('ec_key')") is None)
        pg.click('[data-tab="practice"]'); pg.wait_for_timeout(50); pg.screenshot(path="%s/%s-practice.png" % (OUT, name), full_page=True)
        over = pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
        check(name + " B28 좌우 넘침 없음", not over)
        check(name + " B29 화면 오류 없음", not errs, errs)
        ctx.close()

    # ---------- C. 대화형 선생님 (Gemini 흉내 응답 + 실제 녹음 경로) ----------
    GEM = {"transcript": "I think the Lord is really faithful. He love me.", "reply": "That is a beautiful thing to say. When did you first feel that God is faithful?",
           "praise_ko": "문장을 끝까지 또렷하게 말했어요.", "focus_ko": "th 소리를 낼 때 혀끝을 이 사이에 살짝 내밀어 보세요.",
           "pronunciation": [{"word": "think", "heard_ko": "sink처럼 들렸어요.", "tip_ko": "혀끝을 윗니와 아랫니 사이에 두고 바람을 내보내세요."},
                             {"word": "really", "heard_ko": "r과 l이 비슷하게 들렸어요.", "tip_ko": "r은 혀를 말아 어디에도 닿지 않게, l은 혀끝을 윗잇몸에 붙이세요."}],
           "intonation_ko": "문장 끝이 모두 같은 높이로 끝났어요. 중요한 단어 faithful을 더 높고 길게 말해 보세요.", "fluency_ko": "중간에 한 번 길게 멈췄어요.",
           "grammar": [{"said": "He love me.", "better": "He loves me.", "why_ko": "주어가 He이면 동사에 s를 붙여요."}],
           "natural": "I believe the Lord is truly faithful. He loves me.", "scores": {"pronunciation": 62, "intonation": 58, "fluency": 70, "grammar": 75}}
    FETCH = """
    (function(){
      window.__calls=[]; window.__spoken=[];
      var GEM=%s;
      window.fetch=function(url, opt){
        opt=opt||{}; var rec={url:String(url), method:opt.method||'GET', key:(opt.headers||{})['x-goog-api-key']}; 
        if(opt.body){ try{ var b=JSON.parse(opt.body); rec.audioHead=b.contents[0].parts[1].inlineData.data.slice(0,6); rec.mime=b.contents[0].parts[1].inlineData.mimeType; rec.ctx=b.contents[0].parts[0].text; rec.audioLen=b.contents[0].parts[1].inlineData.data.length; }catch(e){ rec.err=String(e); } }
        window.__calls.push(rec);
        var mode=window.__gmode||'ok', status=200, body;
        if(/models\\?pageSize/.test(url)){
          if(mode==='badkey'){ status=400; body={error:{message:'API key not valid. Please pass a valid API key.'}}; }
          else body={models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-flash-preview-tts',supportedGenerationMethods:['generateContent']},{name:'models/gemini-embedding-001',supportedGenerationMethods:['embedContent']}]};
        } else if(mode==='quota'){ status=429; body={error:{message:'Quota exceeded'}}; }
        else if(mode==='nomodel'){ status=404; body={error:{message:'model not found'}}; }
        else if(mode==='garbage'){ body={candidates:[{content:{parts:[{text:'sorry, I cannot'}]}}]}; }
        else { body={candidates:[{content:{parts:[{text:'```json\\n'+JSON.stringify(GEM)+'\\n```'}]}}]}; }
        var tx=JSON.stringify(body);
        return new Promise(function(res){ setTimeout(function(){ res({ok:status>=200&&status<300, status:status, text:function(){ return Promise.resolve(tx); }}); }, 30); });
      };
      if(window.speechSynthesis){ var o=window.speechSynthesis.speak.bind(window.speechSynthesis); window.speechSynthesis.speak=function(u){ window.__spoken.push(u.text); try{ o(u); }catch(e){} }; }
    })();
    """ % json.dumps(GEM)
    for name, vp in (("phone", {"width": 390, "height": 844}), ("ipad", {"width": 820, "height": 1180})):
        ctx = b.new_context(viewport=vp, permissions=["microphone", "clipboard-read", "clipboard-write"])
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(URL); pg.evaluate(FETCH)
        check(name + " C0 첫 화면이 대화 탭 + 버전 v2", pg.is_visible("#tab-talk") and pg.inner_text("#ecVer") == "v2")
        check(name + " C1 키 없을 때 안내", "Gemini" in pg.inner_text("#ecTMsg"))
        # 소리 분석 단위 시험: 150Hz 1초, 0.7초 쉼, 200Hz 1초
        an = pg.evaluate("""(function(){ var r=16000, n=r*3.2, x=new Float32Array(n); function tone(a,b,f){ for(var i=a;i<b;i++) x[i]=0.3*Math.sin(2*Math.PI*f*i/r)+0.1*Math.sin(4*Math.PI*f*i/r); }
          tone(r*0.2,r*1.2,150); tone(r*1.9,r*2.9,200); return window.__ec.analyze(x,r); })()""")
        print("   분석값:", {k: (round(v, 2) if isinstance(v, (int, float)) else v) for k, v in an.items()})
        check(name + " C2 멈춤 1회·약 0.7초", an["pauses"] == 1 and abs(an["longest"] - 0.7) < 0.08, an)
        check(name + " C3 말한 시간 약 2초", abs(an["speech"] - 2.0) < 0.15, an)
        check(name + " C4 높낮이 폭 약 5반음", an["st"] is not None and abs(an["st"] - 4.98) < 0.6 and 140 < an["f0"] < 210, an)
        sil = pg.evaluate("window.__ec.analyze(new Float32Array(16000*2),16000)")
        check(name + " C5 무음이면 말소리 0", sil["speech"] == 0 and sil["st"] is None, sil)
        check(name + " C6 WAV 머리글", pg.evaluate("atob(window.__ec.wavBase64(new Float32Array(1600),16000)).slice(0,4)") == "RIFF")
        # 설정
        pg.click('[data-tab="setup"]'); pg.click('[data-act="gsave"]')
        check(name + " C7 키 없이 저장하면 안내", "넣어 주세요" in pg.inner_text("#ecGMsg"))
        pg.fill("#ecGKey", "test-key"); pg.check("#ecGRemember")
        pg.evaluate("window.__gmode='badkey'"); pg.click('[data-act="gmodels"]'); pg.wait_for_function("/올바르지 않습니다/.test(document.getElementById('ecGMsg').innerText)")
        check(name + " C8 잘못된 키 문구", True)
        pg.evaluate("window.__gmode='ok'"); pg.click('[data-act="gmodels"]'); pg.wait_for_function("/키가 확인됐습니다/.test(document.getElementById('ecGMsg').innerText)")
        opts = pg.evaluate("Array.from(document.getElementById('ecGModelPick').options).map(o=>o.value)")
        check(name + " C9 모델 목록에서 음성합성·임베딩 제외", opts == ["gemini-2.5-flash", "gemini-3.5-flash"], opts)
        check(name + " C10 저장된 모델 유지", pg.input_value("#ecGModel") == "gemini-2.5-flash")
        pg.select_option("#ecGModelPick", "gemini-3.5-flash")
        check(name + " C11 모델 바꾸기", pg.input_value("#ecGModel") == "gemini-3.5-flash" and pg.evaluate("localStorage.getItem('ec_gmodel')") == "gemini-3.5-flash")
        check(name + " C11b 바꾼 모델이 안내 문구에 반영", "gemini-3.5-flash" in pg.inner_text("#ecGMsg") and "gemini-2.5-flash" not in pg.inner_text("#ecGMsg"))
        pg.screenshot(path="%s/%s-talk-setup.png" % (OUT, name), full_page=True)
        # 대화
        pg.click('[data-tab="talk"]')
        check(name + " C12 주제 7개", pg.locator("#ecScene option").count() == 7)
        pg.select_option("#ecScene", "5")
        check(name + " C13 낭독 주제는 원고 칸 보임", pg.is_visible("#ecScript"))
        pg.click('[data-act="tstart"]')
        check(name + " C14 원고 없이 시작하면 안내", "원고" in pg.inner_text("#ecTMsg"))
        pg.select_option("#ecScene", "2")
        check(name + " C15 다른 주제는 원고 칸 숨김", not pg.is_visible("#ecScript"))
        pg.click('[data-act="tcopy"]')
        check(name + " C16 대답 전 복사는 안내", "아직" in pg.inner_text("#ecTMsg"))
        pg.click('[data-act="tstart"]')
        check(name + " C17 선생님 첫 말", pg.locator("#ecChat .ec-bub").count() == 1 and "know Jesus" in pg.inner_text("#ecChat"))
        check(name + " C18 첫 말 자동 읽기", pg.evaluate("window.__spoken.length") == 1)
        for rnd in (1, 2):
            pg.click('[data-act="trec"]'); pg.wait_for_function("window.__ec.T.state==='rec'", timeout=10000)
            check(name + " C19-%d 녹음 중 버튼" % rnd, "끝내고 보내기" in pg.inner_text("#ecTRec"))
            pg.wait_for_timeout(5600)
            pg.click('[data-act="trec"]')
            pg.wait_for_function("window.__ec.T.state==='idle' && document.querySelectorAll('#ecChat .ec-turn').length===%d" % rnd, timeout=15000)
            call = pg.evaluate("window.__calls[window.__calls.length-1]")
            check(name + " C20-%d 요청: 모델·키·WAV 소리" % rnd, "models/gemini-3.5-flash:generateContent" in call["url"] and call["key"] == "test-key" and call.get("audioHead") == "UklGR" + call.get("audioHead", "")[5:] and call.get("mime") == "audio/wav" and call.get("audioLen", 0) > 100000, {k: call.get(k) for k in ("url", "key", "audioHead", "mime", "audioLen", "err")})
            m = pg.evaluate("window.__ec.T.turns.filter(t=>t.role==='me').pop().m")
            if rnd == 1: print("   실제 녹음 분석값:", {k: (round(v, 2) if isinstance(v, (int, float)) else v) for k, v in m.items()})
            check(name + " C21-%d 실제 녹음에서 말소리·높낮이 측정" % rnd, m["speech"] > 2.5 and m["st"] is not None and m["pauses"] >= 1, m)
            check(name + " C22-%d 측정값이 요청에 전달" % rnd, "pitch range" in call["ctx"] and "Scenario: 간증 나누기" in call["ctx"])
            if rnd == 2: check(name + " C22b 이전 대화가 요청에 포함", "Learner: I think the Lord" in call["ctx"])
            card = pg.inner_text("#ecChat .ec-turn >> nth=%d" % (rnd-1))
            check(name + " C23-%d 결과 카드 내용" % rnd, all(x in card for x in ["I think the Lord", "62", "sink처럼", "He loves me.", "원어민이라면", "기기에서 잰 값", "높낮이 폭"]), card[:300])
            check(name + " C24-%d 선생님 다음 말 + 자동 읽기" % rnd, pg.locator("#ecChat .ec-bub").count() == rnd+1 and pg.evaluate("window.__spoken[window.__spoken.length-1]").startswith("That is a beautiful"))
            n0 = pg.evaluate("window.__spoken.length")
            pg.click('#ecChat .ec-turn >> nth=%d >> [data-act="say"] >> nth=0' % (rnd-1))
            check(name + " C25-%d 단어 듣기 버튼" % rnd, pg.evaluate("window.__spoken.length") == n0+1 and pg.evaluate("window.__spoken[window.__spoken.length-1]") == "think")
            if rnd == 1: pg.screenshot(path="%s/%s-talk.png" % (OUT, name), full_page=True)
        pg.click('[data-act="tcopy"]'); pg.wait_for_timeout(150)
        clip = pg.evaluate("navigator.clipboard.readText()")
        check(name + " C26 대화 결과 복사", "대화 결과" in clip and "나(2):" in clip and "gemini-3.5-flash" in clip and "He loves me." in clip, clip[:200])
        if name == "phone": print("---- 복사되는 글 ----\n" + clip + "\n--------------------")
        # 오류 경로: 한도 초과, 모델 없음, 읽을 수 없는 답 → 대기 상태 복귀
        for mode, word in (("quota", "한도"), ("nomodel", "모델"), ("garbage", "읽지 못했습니다")):
            pg.evaluate("window.__gmode='%s'" % mode)
            pg.click('[data-act="trec"]'); pg.wait_for_function("window.__ec.T.state==='rec'", timeout=10000); pg.wait_for_timeout(2500); pg.click('[data-act="trec"]')
            pg.wait_for_function("window.__ec.T.state==='idle' && !!document.querySelector('#ecTMsg .err')", timeout=15000)
            check(name + " C27 오류(%s) 문구 + 대기 복귀" % mode, word in pg.inner_text("#ecTMsg") and not pg.is_disabled("#ecTRec") and pg.locator("#ecChat .ec-turn").count() == 2, pg.inner_text("#ecTMsg"))
        pg.evaluate("window.__gmode='ok'")
        # 너무 짧은 녹음
        pg.click('[data-act="trec"]'); pg.wait_for_function("window.__ec.T.state==='rec'", timeout=10000); pg.wait_for_timeout(250); pg.click('[data-act="trec"]')
        pg.wait_for_function("window.__ec.T.state==='idle'", timeout=8000)
        check(name + " C28 너무 짧은 녹음 안내", "짧습니다" in pg.inner_text("#ecTMsg") or "잡히지" in pg.inner_text("#ecTMsg"), pg.inner_text("#ecTMsg"))
        # 새 대화 → 다시 시작 (열기→닫기→다시 열기)
        pg.select_option("#ecScene", "0"); pg.click('[data-act="tstart"]')
        check(name + " C29 새 대화로 초기화", pg.locator("#ecChat .ec-turn").count() == 0 and pg.locator("#ecChat .ec-bub").count() == 1 and "family" in pg.inner_text("#ecChat"))
        pg.click('[data-tab="history"]')
        check(name + " C30 기록에 대화 2건", pg.locator("#ecHist tr").count() == 3 and "대화" in pg.inner_text("#ecHist"), pg.inner_text("#ecHist"))
        pg.reload(); pg.evaluate(FETCH)
        check(name + " C31 새로 고침 뒤 키·모델 기억", pg.evaluate("document.getElementById('ecGKey').value") == "test-key" and pg.evaluate("document.getElementById('ecGModel').value") == "gemini-3.5-flash" and pg.inner_text("#ecTMsg").strip() == "")
        pg.click('[data-tab="setup"]'); pg.click('[data-act="gclear"]')
        check(name + " C32 키 지우기", pg.evaluate("localStorage.getItem('ec_gkey')") is None)
        pg.click('[data-tab="talk"]')
        over = pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
        check(name + " C33 좌우 넘침 없음", not over)
        check(name + " C34 화면 오류 없음", not errs, errs)
        ctx.close()
    b.close()
print("\n실패 %d건" % len(fails), fails)
sys.exit(1 if fails else 0)
