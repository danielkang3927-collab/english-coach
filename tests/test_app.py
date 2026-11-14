import json, sys, threading, http.server, socketserver, functools, time
from playwright.sync_api import sync_playwright

ROOT = sys.argv[1]
OUT = sys.argv[2]
PORT = 8765

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
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])

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
    check("A3 처음 안내 문구", "설정·안내" in pg.inner_text("#ecMsg"))
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
        known = {"tab", "mode", "pick", "rec", "word", "copy", "again", "savekey", "clearkey", "copyhist"}
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
        pg.click('[data-tab="practice"]'); pg.screenshot(path="%s/%s-practice.png" % (OUT, name), full_page=True)
        over = pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
        check(name + " B28 좌우 넘침 없음", not over)
        check(name + " B29 화면 오류 없음", not errs, errs)
        ctx.close()
    b.close()
print("\n실패 %d건" % len(fails), fails)
sys.exit(1 if fails else 0)
