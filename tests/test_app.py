"""영어 말하기 코치 v6 자동 점검.
쓰기: python3 tests/test_app.py <저장소 폴더> <캡처 폴더> <가짜 음성 wav> [구간 ...]
구간: s1 설정 · s2 레벨 테스트 · s3 하루 루틴 · s4 약점/구문/기록/백업 · s5 날짜 · s6 옮겨 오기/저장 · s7 오류 · s8 아이패드"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from playwright.sync_api import sync_playwright

ROOT, OUT, WAV = sys.argv[1], sys.argv[2], sys.argv[3]
WANT = sys.argv[4:] or ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]
BK = os.path.join(OUT, "backup_s3.json")
t = T()
ev = lambda pg, js: pg.evaluate(js)

# 녹음을 건너뛰고 싶을 때 쓰는 가짜 녹음 (기기 측정·WAV 만들기는 진짜 함수를 탄다)
HELP = """
window.__fakeClip = function(sec, gap){
  var sr=16000, n=Math.floor(sec*sr), x=new Float32Array(n), ph=0, g=gap||0.15;
  for(var i=0;i<n;i++){ var tt=i/sr, cyc=tt%1.0, f0=130+70*Math.abs(Math.sin(tt*1.3)), v=0; ph+=2*Math.PI*f0/sr; for(var k=1;k<=6;k++) v+=Math.sin(k*ph)/k; x[i]= cyc<(1-g) ? 0.2*v : 0.0004*Math.sin(i*0.7); }
  return clipOf(x, analyze(x, sr));
};
window.__fillBatch = function(){ var A=window.__ec.A; A.clips=A.items.map(function(){ return window.__fakeClip(1.2); }); A.i=A.items.length-1; A.phase='shown'; window.__ec.render(); };
"""
def page(b, viewport=PHONE, init=None, perms=PERMS):
    return new_page(b, t, viewport, HELP + (init or ""), perms)
def shot(pg, name): pg.screenshot(path=os.path.join(OUT, name + ".png"), full_page=True)
def view(pg, name): pg.screenshot(path=os.path.join(OUT, name + ".png"))
def calls(pg, mode=None): return ev(pg, "window.__calls.filter(c => c.kind==='gen'" + (" && c.mode==='%s'" % mode if mode else "") + ").map(c => ({model:c.model, mode:c.mode, audio:c.audio, bytes:c.bytes, temp:c.temp, plan:c.plan, mime:c.mime, json:c.json, key:c.key}))")
def last_text(pg): return ev(pg, "(function(){ var c=window.__calls.filter(c => c.kind==='gen'); return c.length ? c[c.length-1].text : ''; })()")
def last_sys(pg): return ev(pg, "(function(){ var c=window.__calls.filter(c => c.kind==='gen'); return c.length ? c[c.length-1].sys : ''; })()")
def fill_batch_and_send(pg):
    ev(pg, "window.__fillBatch()"); click(pg, "bNext"); wait_phase(pg, "done")

def s1(b):
    print("\n== s1 처음 열기와 설정 ==")
    ctx, pg, errs = page(b)
    t.check("s1 빈 기기에서 오류 없이 열림", not errs, errs)
    t.check("s1 아래 메뉴 5개", pg.locator("#ecNav button").count() == 5)
    t.check("s1 홈에 시작 안내(키 없음)", "이용 키가 한 번 필요" in text(pg))
    t.check("s1 등급 전 안내", "아직 레벨 테스트를 하지 않았습니다" in text(pg))
    t.check("s1 기본 집중 약점 3개", pg.locator('#ecMain [data-act="tagOpen"]').count() == 3 and "기본 추천" in text(pg))
    t.check("s1 실전 미션 3개", pg.locator(".ec-miss").count() == 3)
    t.check("s1 한 단계 예상 기간 표시", "약 1년 3개월" in text(pg))
    for tab in ["train", "weak", "phr", "rec", "set", "home"]:
        click(pg, "tab", tab); bad = handlers_ok(pg); t.check("s1 처리기·id 중복 점검(" + tab + ")", bad == [], bad)
    shot(pg, "p01_home_empty")
    # 키 없이 시작 → 설정으로
    for a in ["phr", "dr", "talk", "retell", "test"]:
        click(pg, "tab", "train"); click(pg, "start", a)
        t.check("s1 키 없이 「%s」 시작 → 설정 안내" % a, ev(pg, "window.__ec.U.tab") == "set" and "먼저 Gemini 이용 키" in text(pg) and ev(pg, "window.__ec.A") is None)
    # 빈 키
    click(pg, "gSave"); t.check("s1 빈 키 저장 → 안내", "Gemini 이용 키를 넣어 주세요" in text(pg))
    # 틀린 키
    ev(pg, "window.__mock.listStatus = 400"); pg.fill("#ecGKey", "WRONG"); click(pg, "gSave")
    pg.wait_for_function("document.querySelector('#ecMain').innerText.indexOf('올바르지 않습니다') >= 0", timeout=8000)
    t.check("s1 틀린 키 → 올바르지 않다는 안내", True)
    t.check("s1 틀린 키로는 모델 목록 없음", pg.locator("#ecGModelPick").count() == 0)
    ev(pg, "window.__mock.listStatus = 200")
    set_key(pg)
    chain = ev(pg, "window.__ec.G.chain")
    t.check("s1 모델 순서: 정식 Flash 새 것 → 옛 것 → 미리보기 → Lite", chain == ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.5-flash-preview", "gemini-3.1-flash-lite"], chain)
    t.check("s1 키 저장됨", ev(pg, "localStorage.getItem('ec_gkey')") == "AIzaTESTKEY123")
    t.check("s1 모델 목록 요청에 키 전달", ev(pg, "window.__calls.filter(c => c.kind==='list').slice(-1)[0].key") == "AIzaTESTKEY123")
    t.check("s1 모델 선택 상자와 순서 표시", pg.locator("#ecGModelPick option").count() == 5 and pg.locator(".ec-ol li").count() == 4 and "사용 가능" in text(pg))
    shot(pg, "p02_settings")
    pg.select_option("#ecGModelPick", "gemini-3.1-flash-lite")
    t.check("s1 먼저 쓸 모델 바꾸기", ev(pg, "localStorage.getItem('ec_gmodel')") == "gemini-3.1-flash-lite" and pg.locator(".ec-ol li").first.inner_text().startswith("gemini-3.1-flash-lite"))
    pg.select_option("#ecGModelPick", "")
    t.check("s1 자동으로 되돌리기", ev(pg, "localStorage.getItem('ec_gmodel')") == "" and pg.locator(".ec-ol li").first.inner_text().startswith("gemini-3.5-flash"))
    click(pg, "gReset"); t.check("s1 한도 기록 지우기 안내", "한도 기록을 지웠습니다" in text(pg))
    # 하루 목표
    click(pg, "minutes", "15"); t.check("s1 하루 15분 → 계획 바뀜", ev(pg, "window.__ec.DB.set.minutes") == 15 and "구문 5개" in text(pg) and "약 2년 7개월" in text(pg))
    click(pg, "minutes", "60"); t.check("s1 하루 60분 → 계획 바뀜", "구문 10개" in text(pg) and "약 8개월" in text(pg))
    click(pg, "minutes", "30"); t.check("s1 하루 30분으로", pg.locator('.ec-seg [aria-pressed="true"]').inner_text() == "30분")
    pg.uncheck("#ecAuto"); t.check("s1 자동 읽기 끄기 저장", ev(pg, "JSON.parse(localStorage.getItem('ec6_set')).autoSpeak") is False)
    click(pg, "voice"); t.check("s1 목소리 들어 보기 오류 없음", not errs, errs)
    # 키 기억 안 하기
    pg.uncheck("#ecGRemember"); click(pg, "gSave"); pg.wait_for_timeout(300)
    t.check("s1 기억 끄면 기기에 키를 두지 않음", ev(pg, "localStorage.getItem('ec_gkey')") is None and ev(pg, "window.__ec.G.key") == "AIzaTESTKEY123")
    pg.check("#ecGRemember"); click(pg, "gSave"); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_function("window.__ec")
    t.check("s1 다시 열어도 키·설정 유지", ev(pg, "window.__ec.G.key") == "AIzaTESTKEY123" and ev(pg, "window.__ec.DB.set.autoSpeak") is False and ev(pg, "window.__ec.G.chain.length") == 4)
    t.check("s1 키 있으면 시작 안내 사라짐", "이용 키가 한 번 필요" not in text(pg))
    click(pg, "tab", "set"); t.check("s1 설정에 키가 채워져 있음", pg.input_value("#ecGKey") == "AIzaTESTKEY123")
    click(pg, "gClear"); t.check("s1 키 지우기", ev(pg, "localStorage.getItem('ec_gkey')") is None and pg.input_value("#ecGKey") == "")
    # 위·아래 이동 단추
    click(pg, "tab", "home"); pg.wait_for_timeout(100)
    click(pg, "bottom"); pg.wait_for_timeout(900); y1 = ev(pg, "window.scrollY")
    click(pg, "top"); pg.wait_for_timeout(900); y2 = ev(pg, "window.scrollY")
    t.check("s1 ▼ 맨 아래로 / ▲ 맨 위로", y1 > 300 and y2 == 0, (y1, y2))
    t.check("s1 끝까지 오류 없음", not errs, errs); ctx.close()

def s2(b):
    print("\n== s2 레벨 테스트 ==")
    ctx, pg, errs = page(b); set_key(pg)
    click(pg, "tab", "home"); click(pg, "start", "test")
    t.check("s2 안내 화면", phase(pg) == "intro" and "공인 시험이 아닌" in text(pg))
    click(pg, "xBegin")
    kinds = ["read", "daily", "story", "explain"]
    for i, k in enumerate(kinds):
        want = ev(pg, "D.TEST['%s'][0]" % k)
        t.check("s2 과제 %d 문제 표시" % (i + 1), want[:30] in pg.locator(".ec-task").inner_text())
        t.check("s2 과제 %d 듣기 단추(낭독은 없음)" % (i + 1), pg.locator(".ec-task .ec-mini").count() == (0 if k == "read" else 1))
        if i == 0:
            rec(pg, 1.2); pg.wait_for_timeout(300)
            t.check("s2 너무 짧으면 다시", "너무 짧습니다" in note(pg) and phase(pg) == "ask")
            shot(pg, "p03_test_task")
        rec(pg, 6.8); wait_phase(pg, "shown")
        if i == 1:
            click(pg, "xRedo"); t.check("s2 다시 녹음", phase(pg) == "ask" and ev(pg, "window.__ec.A.tasks[1].clip") is None)
            rec(pg, 6.8); wait_phase(pg, "shown")
        t.check("s2 과제 %d 다음 단추 글" % (i + 1), ("채점 보내기" if i == 3 else "다음 과제") in text(pg))
        click(pg, "xNext")
    wait_phase(pg, "done", 30000)
    cs = calls(pg, "test")
    t.check("s2 채점 요청 4번, 각각 녹음 1개, 온도 0, JSON", len(cs) == 4 and all(c["audio"] == 1 and c["temp"] == 0 and c["json"] == "application/json" and c["mime"] == "audio/wav" for c in cs), cs)
    t.check("s2 요청에 과제 종류·측정값·채점 기준", "TASK TYPE: explain" in last_text(pg) and "Device measurements" in last_text(pg) and "strict, consistent examiner" in last_sys(pg) and "g_sva =" in last_sys(pg))
    r = ev(pg, "window.__ec.DB.log[window.__ec.DB.log.length-1]")
    t.check("s2 테스트 기록 저장", r["k"] == "test" and len(r["tasks"]) == 4 and r["lv"] and r["score"] is not None)
    # 점수를 따로 계산해 대조
    clamp = lambda v, a, c: max(a, min(c, v)); avg = lambda a: sum(a) / len(a)
    S = {"read": [72, 66, None, None, 90], "daily": [70, 64, 62, 60, 75], "story": [68, 62, 58, 61, 70], "explain": [66, 60, 55, 58, 62]}
    flu = []; idev = []
    for task in r["tasks"]:
        m = task["m"]; span = m[6]; wpm = 27 / (span / 60); ppm = m[2] / (span / 60)
        if task["k"] != "read": flu.append((clamp(40 + (wpm - 60) * 2 / 3, 20, 100) + clamp(103 - 2.8 * ppm, 20, 100)) / 2)
        idev.append(clamp(22 + 9 * m[4], 20, 95))
    exp = {"pron": avg([S[k][0] for k in kinds]), "inton": (avg([S[k][1] for k in kinds]) + avg(idev)) / 2, "flu": avg(flu), "gram": avg([62, 58, 55]), "vocab": avg([60, 61, 58]), "task": avg([S[k][4] for k in kinds])}
    total = exp["pron"] * .25 + exp["inton"] * .15 + exp["flu"] * .20 + exp["gram"] * .20 + exp["vocab"] * .10 + exp["task"] * .10
    t.check("s2 부분 점수가 따로 한 계산과 맞음", all(abs(r["parts"][k] - exp[k]) <= 1.6 for k in exp), (r["parts"], exp))
    t.check("s2 총점이 따로 한 계산과 맞음", abs(r["score"] - total) <= 1.0, (r["score"], total))
    bands = [(89, "C1"), (82, "B2+"), (75, "B2"), (68, "B1+"), (60, "B1"), (52, "A2+"), (0, "A2")]
    t.check("s2 등급 경계", r["lv"] == next(n for m, n in bands if r["score"] >= m), r["lv"])
    t.check("s2 등급 경계값 함수", ev(pg, "[51.9,52,59.9,60,67.9,68,74.9,75,81.9,82,88.9,89].map(v => levelOf(v).id).join(',')") == "A2,A2+,A2+,B1,B1,B1+,B1+,B2,B2,B2+,B2+,C1")
    t.check("s2 약점 꼬리표 저장(시제·th·군말)", all(g in r["tags"] for g in ["g_tense", "p_th", "d_filler"]), r["tags"])
    t.check("s2 결과 화면: 등급·여섯 항목·안내", pg.locator(".ec-level b").first.inner_text() == r["lv"] and pg.locator(".ec-score").count() == 6 and "공인 시험이 아닌" in text(pg))
    bad = handlers_ok(pg); t.check("s2 결과 화면 처리기", bad == [], bad)
    shot(pg, "p04_test_result")
    click(pg, "xHome")
    t.check("s2 홈에 등급 표시", pg.locator(".ec-level b").first.inner_text() == r["lv"] and "마지막 테스트 오늘" in text(pg) and ev(pg, "window.__ec.A") is None)
    # 두 번째: 중간에 실패 → 이어서 채점
    click(pg, "start", "test"); click(pg, "xBegin")
    t.check("s2 두 번째 테스트는 다른 문제", ev(pg, "window.__ec.A.set") == 1 and ev(pg, "window.__ec.A.tasks[1].prompt === D.TEST.daily[1]"))
    ev(pg, "(function(){ var A=window.__ec.A; A.tasks.forEach(function(x){ x.clip=window.__fakeClip(8, 0.6); }); A.i=3; A.phase='shown'; window.__ec.render(); window.__mock.plan=['ok','403']; })()")
    n0 = len(calls(pg, "test")); click(pg, "xNext"); wait_phase(pg, "fail")
    t.check("s2 채점 중 실패 → 안내와 이어서 채점", "이 키로는 쓸 수 없습니다" in note(pg) and has(pg, "xSend") and "녹음은 그대로" in text(pg))
    click(pg, "xSend"); wait_phase(pg, "done", 30000)
    t.check("s2 이어서 채점은 남은 과제만 (1+1+3)", len(calls(pg, "test")) - n0 == 5, len(calls(pg, "test")) - n0)
    t.check("s2 지난번과 비교 표시", "지난번보다" in text(pg))
    r2 = ev(pg, "window.__ec.DB.log[window.__ec.DB.log.length-1]")
    t.check("s2 멈춤 많은 녹음은 유창성 점수가 낮음", r2["parts"]["flu"] < r["parts"]["flu"] and "d_pause" in r2["tags"], (r2["parts"], r2["tags"]))
    click(pg, "xRec")
    t.check("s2 기록에 등급 변화 그림", pg.locator("svg.ec-chart").count() == 2 and pg.locator("svg.ec-chart circle").count() == 2)
    # 세 번째: 한 과제를 못 알아들음 → 그 과제만 다시
    click(pg, "tab", "home"); click(pg, "start", "test"); click(pg, "xBegin")
    ev(pg, "(function(){ var A=window.__ec.A; A.tasks.forEach(function(x){ x.clip=window.__fakeClip(7); }); A.i=3; A.phase='shown'; window.__ec.render(); window.__mock.testEmptyAt=2; })()")
    click(pg, "xNext"); wait_phase(pg, "fail")
    t.check("s2 한 과제를 못 알아들으면 그 과제만 다시", "경험 이야기" in note(pg) and has(pg, "xRedoTask"))
    click(pg, "xRedoTask"); t.check("s2 그 과제로 돌아감", phase(pg) == "ask" and ev(pg, "window.__ec.A.i") == 2)
    rec(pg, 6.8); wait_phase(pg, "shown"); click(pg, "xNext"); wait_phase(pg, "done", 30000)
    t.check("s2 테스트 기록 3개", ev(pg, "tests().length") == 3)
    # 그만두기 확인
    click(pg, "xHome"); click(pg, "start", "test"); click(pg, "xBegin")
    ev(pg, "(function(){ var A=window.__ec.A; A.tasks[0].clip=window.__fakeClip(7); A.phase='shown'; window.__ec.render(); })()")
    click(pg, "quit"); t.check("s2 녹음이 있으면 그만두기 전에 물음", "그만두면 사라집니다" in text(pg) and ev(pg, "window.__ec.A") is not None)
    click(pg, "stay"); t.check("s2 계속하기", "그만두면 사라집니다" not in text(pg) and phase(pg) == "shown")
    click(pg, "quit"); click(pg, "quit", "yes"); t.check("s2 그만두기", ev(pg, "window.__ec.A") is None and ev(pg, "tests().length") == 3)
    ev(pg, "(function(){ window.__ec.A = {type:'test', title:'레벨 테스트', phase:'done', tasks:[], tags:[], out:{parts:{}, total:61, level:'B1'}, prev:{score:58}}; window.__ec.go('train'); })()")
    t.check("s2 등급이 오르면 알려 줌", "등급이 올랐습니다: A2+ → B1" in text(pg))
    ev(pg, "(function(){ window.__ec.A.prev = {score:60.5}; window.__ec.render(); })()")
    t.check("s2 같은 등급이면 오름 안내 없음", "등급이 올랐습니다" not in text(pg) and "지난번보다 +0.5" in text(pg))
    ev(pg, "window.__ec.A = null")
    t.check("s2 끝까지 오류 없음", not errs, errs); ctx.close()

def s3(b):
    print("\n== s3 하루 루틴 ==")
    ctx, pg, errs = page(b); set_key(pg); click(pg, "tab", "home")
    t.check("s3 루틴 시작 단추", "오늘 루틴 시작: ① 구문 복습" in text(pg))
    click(pg, "routine")
    t.check("s3 구문 8개, 모두 새 구문(듣고 따라 말하기)", ev(pg, "window.__ec.A.items.length") == 8 and ev(pg, "window.__ec.A.items.every(x => x.task==='shadow')"))
    t.check("s3 새 구문은 상황별로 하나씩", ev(pg, "window.__ec.A.items.map(x => x.ref).join(',')") == "daily1,keep1,story1,gospel1,worship1,prayer1,sermon1,daily2")
    t.check("s3 새 구문은 영어가 보임", pg.locator(".ec-task.en").count() == 1 and "1 / 8" in text(pg))
    bad = handlers_ok(pg); t.check("s3 묶음 훈련 처리기", bad == [], bad)
    shot(pg, "p05_batch_ask")
    rec(pg, 1.3); wait_phase(pg, "shown")
    t.check("s3 녹음 뒤 스스로 비교 안내", "내 녹음" in text(pg) and has(pg, "bRedo") and has(pg, "bNext"))
    click(pg, "bRedo"); t.check("s3 다시 녹음", phase(pg) == "ask" and ev(pg, "window.__ec.A.clips.length") == 0)
    rec(pg, 1.3); wait_phase(pg, "shown"); click(pg, "bNext")
    for i in range(1, 8):
        t.check("s3 구문 %d번째 진행 표시" % (i + 1), ("%d / 8" % (i + 1)) in text(pg)) if i in (1, 7) else None
        rec(pg, 1.2); wait_phase(pg, "shown")
        if i == 7: t.check("s3 마지막은 채점 보내기", "채점 보내기" in text(pg))
        click(pg, "bNext")
    wait_phase(pg, "done")
    c = calls(pg, "batch")
    t.check("s3 구문 8개를 요청 한 번으로", len(c) == 1 and c[0]["audio"] == 8 and c[0]["temp"] == 0.2, c)
    t.check("s3 녹음 크기(앞뒤 조용한 부분 잘라 냄)", all(20000 < x < 80000 for x in c[0]["bytes"]), c[0]["bytes"])
    tx = last_text(pg)
    t.check("s3 요청에 항목 8줄과 학습자 정보", tx.count("| TASK shadow |") == 8 and "KNOWN PATTERNS" in tx and "ITEM 8 |" in tx)
    t.check("s3 결과 4 / 8", pg.locator(".ec-big").inner_text().replace(" ", "") == "4/8" and pg.locator(".ec-res.ok").count() == 4 and pg.locator(".ec-res.no").count() == 4)
    srs = ev(pg, "window.__ec.DB.srs"); d = ev(pg, "window.__ec.today()")
    t.check("s3 구문 상자 갱신: 맞은 것·틀린 것 모두 내일", len(srs) == 8 and srs["daily1"] == {"b": 1, "d": d + 1, "n": 1, "k": 1, "l": d} and srs["keep1"] == {"b": 1, "d": d + 1, "n": 1, "k": 0, "l": d}, srs)
    day = ev(pg, "window.__ec.dayRec()"); t.check("s3 오늘 구문 8, 말한 문장 8", day["st"]["phr"] == 8 and day["said"] == 8, day)
    r = ev(pg, "window.__ec.DB.log[0]"); t.check("s3 구문 기록 저장", r["k"] == "phr" and r["n"] == 8 and r["ok"] == 4 and r["it"][1] == ["keep1", 0, 52, "g_sva", "He go to school"], r)
    shot(pg, "p06_batch_done")
    t.check("s3 결과에 다음 복습·약점 표시·다음 단계", "다음 복습: 내일" in text(pg) and pg.locator('.ec-res.no [data-act="tagOpen"]').count() == 4 and "다음 단계: ② 약점·어순 훈련" in text(pg))
    # 틀린 것만 다시: 상자는 건드리지 않는다
    click(pg, "bWrong")
    t.check("s3 틀린 것만 다시 4개", ev(pg, "window.__ec.A.items.length") == 4 and "틀린 것 다시" in text(pg))
    ev(pg, "window.__mock.batch='all'"); fill_batch_and_send(pg)
    t.check("s3 다시 한 것은 상자·루틴 숫자에 반영 안 함", ev(pg, "window.__ec.DB.srs.keep1.n") == 1 and ev(pg, "window.__ec.dayRec().st.phr") == 8 and ev(pg, "window.__ec.DB.log.length") == 2)
    ev(pg, "window.__mock.batch='alt'")
    # ② 약점·어순 훈련
    click(pg, "start", "dr")
    refs = ev(pg, "window.__ec.A.items.map(x => x.ref)")
    t.check("s3 훈련 6문장: 약점 둘 + 어순 원칙", len(refs) == 6 and refs[0].startswith("g_sva:") and refs[5].startswith("o_"), refs)
    t.check("s3 우리말만 보이고 정답은 가려짐", pg.locator(".ec-answer").count() == 0 and pg.locator(".ec-task.en").count() == 0 and "연습 포인트" in text(pg))
    rec(pg, 1.2); wait_phase(pg, "shown")
    t.check("s3 녹음 뒤 정답 공개", pg.locator(".ec-answer").count() == 1 and ev(pg, "window.__ec.A.items[0].en") in pg.locator(".ec-answer").inner_text())
    shot(pg, "p07_drill_shown")
    click(pg, "bNext"); rec(pg, 1.2); wait_phase(pg, "shown"); click(pg, "bNext"); rec(pg, 1.2); wait_phase(pg, "shown"); click(pg, "bNext")
    t.check("s3 「여기까지만 채점」 단추", "여기까지만 채점 (3개)" in text(pg))
    click(pg, "bSend"); wait_phase(pg, "done")
    t.check("s3 3개만 채점", calls(pg, "batch")[-1]["audio"] == 3 and ev(pg, "window.__ec.dayRec().st.dr") == 3 and "TASK translate" in last_text(pg) and "FOCUS: g_sva (subject-verb" in last_text(pg))
    r = ev(pg, "window.__ec.DB.log[window.__ec.DB.log.length-1]")
    t.check("s3 틀린 훈련은 그 약점 꼬리표로 기록", r["k"] == "dr" and r["it"][1][1] == 0 and r["it"][1][3] == "g_sva", r["it"])
    click(pg, "start", "dr"); refs2 = ev(pg, "window.__ec.A.items.map(x => x.ref)")
    t.check("s3 다음 훈련은 덜 한 문장부터", "g_sva:2" in refs2 and "g_sva:0" not in refs2, refs2)
    fill_batch_and_send(pg); t.check("s3 훈련 단계 채움", ev(pg, "stepDone('dr')"))
    t.check("s3 다음 단계는 대화", "다음 단계: ③ 선생님과 대화" in text(pg))
    # ③ 대화
    click(pg, "quit"); pg.select_option("#ecScene", "0"); click(pg, "start", "talk")
    t.check("s3 대화 시작: 선생님 말·녹음 단추", pg.locator(".ec-bub").count() == 1 and has(pg, "rec") and phase(pg) == "idle")
    q0 = ev(pg, "window.__ec.A.q")
    rec(pg, 2.6); pg.wait_for_function("window.__ec.A.turns.length === 1", timeout=15000)
    c = calls(pg, "talk")[-1]; tx = last_text(pg)
    t.check("s3 대화 요청: 녹음 1, 온도 0.4", c["audio"] == 1 and c["temp"] == 0.4 and c["model"] == "gemini-3.5-flash", c)
    t.check("s3 대화 요청 내용: 장면·대화·약점·측정", "Scenario: 일상 대화 (daily)" in tx and ("Coach: " + q0) in tx and "KNOWN PATTERNS" in tx and "pitch range" in tx)
    t.check("s3 외우는 구문을 선생님에게 알림", "EXPRESSIONS HE IS MEMORIZING" in tx and "There are four of us in my family." in tx.split("EXPRESSIONS HE IS MEMORIZING")[1])
    t.check("s3 지시문: 분류표·기기 판정·정직", "p_epen =" in last_sys(pg) and "Do not assign the tags d_flat" in last_sys(pg) and "Never invent a problem" in last_sys(pg) and '"chunks"' in last_sys(pg))
    body = text(pg)
    t.check("s3 피드백 구성", all(k in body for k in ["잘한 점", "다음에 고칠 한 가지", "문법·표현", "발음", "억양·유창성", "이렇게 말하면 자연스럽습니다", "영어 어순으로 끊어 보기", "외워 둘 구문", "기기 측정"]))
    r = ev(pg, "window.__ec.DB.log[window.__ec.DB.log.length-1]")
    t.check("s3 대화 기록: 꼬리표 정리(없는 꼬리표→어색한 표현, 기기 꼬리표는 AI 것 버림)", r["tags"] == ["g_order", "g_sva", "g_tense", "g_word", "p_fp", "p_epen", "d_ending"], r["tags"])
    t.check("s3 문법 4개까지만, 발음 종류가 아닌 꼬리표는 비움", len(r["fx"]) == 4 and r["pr"][2] == {"w": "very", "g": ""})
    t.check("s3 이미 있는 구문은 담겨 있다고 표시", "구문에 담겨 있습니다" in body and pg.locator('[data-act="tSave"]').count() == 1)
    click(pg, "tSave", "0.1")
    t.check("s3 내 구문에 담기", ev(pg, "window.__ec.DB.my.length") == 1 and ev(pg, "window.__ec.DB.my[0].en") == "I'm looking forward to it." and pg.locator('[data-act="tSave"]').count() == 0)
    bad = handlers_ok(pg); t.check("s3 대화 화면 처리기", bad == [], bad)
    shot(pg, "p08_talk_feedback")
    # 2번째: 연결 끊김 → 녹음 그대로 → 다시 보내기
    ev(pg, "(function(){ window.__mock.plan=['net','net','net','net','net','net','net','net']; var A=window.__ec.A; A.pend=window.__fakeClip(3); talkSend(); })()")
    wait_phase(pg, "fail", 30000)
    t.check("s3 연결 끊김: 안내·녹음 유지·다시 보내기", "구글에 연결하지 못했습니다" in note(pg) and has(pg, "tResend") and ev(pg, "!!window.__ec.A.pend") and "방금 녹음은 그대로" in text(pg))
    nb = calls(pg, "talk")[-1]["bytes"][0]; ev(pg, "window.__mock.plan=[]")
    click(pg, "tResend"); pg.wait_for_function("window.__ec.A.turns.length === 2", timeout=15000)
    t.check("s3 다시 보내기는 같은 녹음", calls(pg, "talk")[-1]["bytes"][0] == nb and "또 빠졌어요" in text(pg))
    # 3번째: 한도 → 다음 모델
    ev(pg, "(function(){ window.__mock.plan=['429day']; var A=window.__ec.A; A.pend=window.__fakeClip(3); talkSend(); })()")
    pg.wait_for_function("window.__ec.A.turns.length === 3", timeout=15000)
    t.check("s3 한도가 차면 다음 모델로", calls(pg, "talk")[-1]["model"] == "gemini-2.5-flash" and ev(pg, "window.__ec.G.block['gemini-3.5-flash'] > Date.now()") and "gemini-2.5-flash" in text(pg))
    ev(pg, "gReset()")
    # 4번째: 코드 울타리에 싸인 답
    ev(pg, "(function(){ window.__mock.plan=['fenced']; var A=window.__ec.A; A.pend=window.__fakeClip(3); talkSend(); })()")
    pg.wait_for_function("window.__ec.A.turns.length === 4", timeout=15000)
    t.check("s3 지난 대답은 한 줄로 접힘", pg.locator(".ec-fold").count() == 3 and pg.locator(".ec-turn").count() == 1)
    h_fold = ev(pg, "document.documentElement.scrollHeight")
    view(pg, "p09_talk_folded_top"); shot(pg, "p09_talk_folded")
    click(pg, "tFold", "0"); t.check("s3 접힌 대답 펼치기", pg.locator(".ec-turn").count() == 2 and pg.locator(".ec-fold").count() == 2)
    click(pg, "tFold", "0"); t.check("s3 다시 접기", pg.locator(".ec-turn").count() == 1 and pg.locator(".ec-fold").count() == 3)
    click(pg, "tAll"); h_open = ev(pg, "document.documentElement.scrollHeight")
    t.check("s3 모두 펼치기", pg.locator(".ec-turn").count() == 4 and pg.locator(".ec-fold").count() == 0)
    t.check("s3 접으면 화면 길이가 크게 줄어듦", h_fold < h_open * 0.45, (h_fold, h_open))
    click(pg, "tFold", "1"); t.check("s3 펼친 상태에서 하나만 접기", pg.locator(".ec-turn").count() == 3 and pg.locator(".ec-fold").count() == 1)
    click(pg, "tAll"); click(pg, "tAll"); t.check("s3 모두 접기", pg.locator(".ec-turn").count() == 1)
    t.check("s3 대화 4번 채움", ev(pg, "window.__ec.dayRec().st.talk") == 4 and "오늘 대화 4 / 4번" in text(pg))
    # 다른 화면에 다녀와도 그대로
    click(pg, "tab", "home"); t.check("s3 진행 중 표시 점", pg.locator(".ec-dot").count() == 1)
    click(pg, "tab", "train"); t.check("s3 훈련으로 돌아오면 대화 그대로", ev(pg, "window.__ec.A.turns.length") == 4 and pg.locator(".ec-bub").count() == 1)
    click(pg, "tEnd")
    t.check("s3 대화 마치기 요약", phase(pg) == "end" and "대답 4번" in text(pg) and "3인칭 단수·수일치 4번" in text(pg))
    shot(pg, "p10_talk_end")
    # ④ 다시 말하기
    click(pg, "start", "retell")
    t.check("s3 다시 말하기: 오늘 대답 3개 대기", ev(pg, "window.__ec.A.queue.length") == 3 and phase(pg) == "study")
    t.check("s3 익히기 화면", all(k in text(pg) for k in ["처음 한 말", "고칠 곳", "이렇게 말하면 자연스럽습니다", "영어 어순으로 끊어 보기"]))
    shot(pg, "p11_retell_study")
    click(pg, "rHide")
    t.check("s3 가리면 우리말 덩어리만", phase(pg) == "hidden" and pg.locator(".ec-chunk b").count() == 0 and pg.locator(".ec-chunk i").count() == 5 and "There are four of us" not in text(pg))
    shot(pg, "p12_retell_hidden")
    click(pg, "rShow"); t.check("s3 다시 보기", phase(pg) == "study"); click(pg, "rHide")
    rec(pg, 2.6); wait_phase(pg, "done")
    tx = last_text(pg)
    t.check("s3 다시 말하기 요청", "MODE: retell" in tx and "FIRST ATTEMPT: " in tx and "TARGET: There are four of us" in tx and calls(pg, "retell")[-1]["temp"] == 0.3)
    t.check("s3 처음과 이번 비교표", pg.locator("table.ec-t tr").count() == 8 and "전하려던 내용의 88%" in text(pg) and "고쳐진 것" in text(pg) and "아직 남은 것" in text(pg))
    r = ev(pg, "window.__ec.DB.log[window.__ec.DB.log.length-1]")
    t.check("s3 다시 말하기 기록", r["k"] == "retell" and r["src"] == ev(pg, "window.__ec.A.queue[0].id") and "g_prep" in r["tags"] and r["cov"] == 88, r)
    shot(pg, "p13_retell_done")
    click(pg, "rAgain"); t.check("s3 한 번 더", phase(pg) == "study" and ev(pg, "window.__ec.A.i") == 0)
    click(pg, "rHide"); ev(pg, "(function(){ var A=window.__ec.A; A.pend=window.__fakeClip(3); retellSend(); })()"); wait_phase(pg, "done")
    click(pg, "rNext"); t.check("s3 다음 대답", phase(pg) == "study" and ev(pg, "window.__ec.A.i") == 1)
    t.check("s3 다시 말하기 단계 채움 → 루틴 끝", ev(pg, "window.__ec.dayRec().st.retell") == 2 and ev(pg, "nextStep()") is None)
    click(pg, "tab", "home")
    t.check("s3 홈: 네 단계 모두 완료", pg.locator(".ec-step.done").count() == 4 and "오늘 루틴을 마쳤습니다" in text(pg))
    day = ev(pg, "window.__ec.dayRec()")
    t.check("s3 홈: 시간·말한 문장·연속 1일", day["sec"] > 20 and day["said"] >= 30 and "연속 1일" in text(pg), day)
    t.check("s3 홈: 집중 약점이 기록으로 바뀜", "최근 2주" in text(pg) and "기본 추천" not in text(pg))
    shot(pg, "p14_home_after")
    n = ev(pg, "window.__ec.DB.log.length")
    with open(BK, "w", encoding="utf-8") as f: f.write(json.dumps(ev(pg, "backupMake()"), ensure_ascii=False))
    pg.reload(); pg.wait_for_function("window.__ec")
    t.check("s3 다시 열어도 기록 그대로", ev(pg, "window.__ec.DB.log.length") == n and ev(pg, "window.__ec.dayRec().st.talk") == 4 and ev(pg, "Object.keys(window.__ec.DB.srs).length") == 8 and ev(pg, "window.__ec.DB.my.length") == 1 and pg.locator(".ec-step.done").count() == 4)
    t.check("s3 끝까지 오류 없음", not errs, errs); ctx.close()

def s4(b):
    print("\n== s4 약점·구문·기록·백업 ==")
    bk = open(BK, encoding="utf-8").read() if os.path.exists(BK) else None
    if not bk: t.check("s4 s3의 백업 파일 필요", False); return
    n_log = len(json.loads(bk)["log"])
    ctx, pg, errs = page(b); set_key(pg)
    # 빈 기기에서 가져오기
    click(pg, "tab", "rec"); t.check("s4 빈 기기: 기록 없음", ev(pg, "window.__ec.DB.log.length") == 0 and "아직 기록이 없습니다" in text(pg))
    pg.fill("#ecBkText", bk); click(pg, "bkPaste")
    t.check("s4 빈 기기에서 가져오기: 기록 +%d" % n_log, ev(pg, "window.__ec.DB.log.length") == n_log and ("기록 +%d개" % n_log) in text(pg) and "지운 것은 없습니다" in text(pg))
    t.check("s4 가져온 구문 상자·내 구문·날짜", ev(pg, "Object.keys(window.__ec.DB.srs).length") == 8 and ev(pg, "window.__ec.DB.my.length") == 1 and ev(pg, "window.__ec.dayRec().st.talk") == 4)
    pg.fill("#ecBkText", bk); click(pg, "bkPaste")
    t.check("s4 같은 백업을 또 가져와도 늘지 않음", ev(pg, "window.__ec.DB.log.length") == n_log and "기록 +0개" in text(pg))
    pg.fill("#ecBkText", "이건 백업이 아닙니다 {"); click(pg, "bkPaste")
    t.check("s4 엉뚱한 글: 안내하고 기록 유지", "백업 글을 읽지 못했습니다" in text(pg) and ev(pg, "window.__ec.DB.log.length") == n_log)
    pg.fill("#ecBkText", '{"app":"other","log":[{"id":"x","t":1}]}'); click(pg, "bkPaste")
    t.check("s4 다른 앱 파일은 거절", ev(pg, "window.__ec.DB.log.length") == n_log)
    # 서로 다른 기록 합치기
    merged = ev(pg, """(function(){ var o=JSON.parse(%s); o.log=[{id:'other-1',t:Date.now()-5000,k:'talk',sc:'daily',tx:'from other device',nat:'x',s:[70,70,70,70],m:[5,4,1,0.6,6,100,5],tags:['g_art']}]; o.srs={daily1:{b:3,d:99999,n:5,k:4,l:20000}, keep1:{b:0,d:1,n:0,k:0,l:1}}; o.my=[{id:'myother',en:'Peace be with you.',ko:'평안이 함께하기를.'},{id:'mydup',en:"i'm looking forward to it.",ko:''}];
      var dk=String(window.__ec.today()); o.day={}; o.day[dk]={sec:5, said:999, st:{phr:1,dr:99,talk:1,retell:0}}; o.day['20000']={sec:600,said:3,st:{phr:5,dr:0,talk:0,retell:0}};
      return backupMerge(o); })()""" % json.dumps(bk))
    t.check("s4 합치기 결과 숫자", merged == {"log": 1, "srs": 1, "my": 1, "day": 2}, merged)
    t.check("s4 합치기: 기록은 합집합·시간순", ev(pg, "window.__ec.DB.log.length") == n_log + 1 and ev(pg, "window.__ec.DB.log.every((r,i,a) => !i || a[i-1].t <= r.t)"))
    t.check("s4 합치기: 구문은 더 많이 본 쪽", ev(pg, "window.__ec.DB.srs.daily1.n") == 5 and ev(pg, "window.__ec.DB.srs.keep1.n") == 1)
    t.check("s4 합치기: 날짜별로 큰 값", ev(pg, "window.__ec.dayRec().said") == 999 and ev(pg, "window.__ec.dayRec().st.dr") == 99 and ev(pg, "window.__ec.dayRec().st.talk") == 4 and ev(pg, "window.__ec.DB.day['20000'].sec") == 600)
    t.check("s4 합치기: 내 구문은 같은 영어면 하나", ev(pg, "window.__ec.DB.my.length") == 2)
    pg.reload(); pg.wait_for_function("window.__ec")
    t.check("s4 합친 것이 저장됨", ev(pg, "window.__ec.DB.log.length") == n_log + 1 and ev(pg, "window.__ec.DB.my.length") == 2)
    # 약점
    click(pg, "tab", "weak")
    t.check("s4 약점 지도: 집중 표시 3개, 기록 있는 항목", pg.locator(".ec-badge.bad").count() == 3 and "최근 2주" in text(pg) and "누적" in text(pg))
    bad = handlers_ok(pg); t.check("s4 약점 화면 처리기", bad == [], bad)
    shot(pg, "p15_weak")
    n_seen = pg.locator('#ecMain [data-act="tagOpen"]').count()
    click(pg, "tagMore"); t.check("s4 나머지 항목 펼치기", pg.locator('#ecMain [data-act="tagOpen"]').count() == 25)
    click(pg, "tagMore"); t.check("s4 나머지 항목 접기", pg.locator('#ecMain [data-act="tagOpen"]').count() == n_seen)
    click(pg, "tagOpen", "g_sva")
    t.check("s4 약점 상세: 설명·예문·내가 틀린 말·훈련 문장", all(k in text(pg) for k in ["왜 틀리나", "이렇게 고칩니다", "바른 예", "내가 실제로 틀린 말", "my son like swimming", "훈련 문장 6개"]))
    t.check("s4 같은 실수는 한 번만 보여 줌", text(pg).count("my son like swimming") == 1)
    shot(pg, "p16_tag_detail")
    click(pg, "tagBack"); t.check("s4 목록으로", "내 약점 지도" in text(pg))
    click(pg, "tagOpen", "g_sva"); t.check("s4 다시 열기", "왜 틀리나" in text(pg))
    click(pg, "tagDrill", "g_sva")
    t.check("s4 이 약점 훈련 시작(6문장)", ev(pg, "window.__ec.A.items.length") == 6 and ev(pg, "window.__ec.A.title") == "3인칭 단수·수일치 훈련" and ev(pg, "window.__ec.U.tab") == "train")
    ev(pg, "(function(){ var A=window.__ec.A; A.clips[0]=window.__fakeClip(1.2); A.phase='shown'; window.__ec.render(); })()"); click(pg, "bNext")
    click(pg, "tab", "home"); click(pg, "start", "talk")
    t.check("s4 진행 중에 다른 훈련을 누르면 알려 줌", "진행 중인 훈련이 있습니다" in note(pg) and ev(pg, "window.__ec.A.type") == "batch")
    click(pg, "quit"); t.check("s4 그만두기 전에 물음", "그만두면 사라집니다" in text(pg))
    click(pg, "stay"); click(pg, "quit"); click(pg, "quit", "yes")
    t.check("s4 그만두면 훈련 목록", ev(pg, "window.__ec.A") is None and "레벨 테스트" in text(pg))
    n0 = ev(pg, "window.__ec.DB.log.length")
    click(pg, "tab", "weak"); click(pg, "ordOpen", "o_svo")
    t.check("s4 어순 원칙 상세", "주어와 동사부터 말한다" in text(pg) and "훈련 문장" in text(pg))
    click(pg, "ordDrill", "o_svo"); t.check("s4 어순 훈련 시작(4문장)", ev(pg, "window.__ec.A.items.length") == 4 and "어순 원칙 — 주어와 동사부터 말한다" in text(pg))
    click(pg, "quit"); t.check("s4 녹음 없으면 바로 나감", ev(pg, "window.__ec.A") is None)
    # 전달 훈련은 기기 측정으로 판정
    click(pg, "tab", "weak"); click(pg, "tagMore"); click(pg, "tagOpen", "d_pause"); click(pg, "tagDrill", "d_pause")
    ev(pg, "(function(){ var A=window.__ec.A; A.clips=A.items.map(function(x,i){ return window.__fakeClip(4, i===0 ? 0.6 : 0.15); }); A.i=A.items.length-1; A.phase='shown'; window.__ec.render(); window.__mock.batch='all'; })()")
    click(pg, "bNext"); wait_phase(pg, "done")
    t.check("s4 멈춤 훈련은 기기 측정으로 판정", ev(pg, "window.__ec.A.res[0].ok") is False and "번 멈췄어요" in ev(pg, "window.__ec.A.res[0].note") and ev(pg, "window.__ec.A.res[1].ok") is True and ev(pg, "window.__ec.DB.log[window.__ec.DB.log.length-1].it[0][3]") == "d_pause")
    click(pg, "quit")
    # 구문
    click(pg, "tab", "phr")
    t.check("s4 구문 화면: 전체 92개(기본 90 + 내 구문 2), 상태 숫자", pg.locator(".ec-ph").count() == 92 and pg.locator(".ec-stat").count() == 3)
    exp = {"daily": 12, "keep": 12, "story": 14, "gospel": 12, "worship": 14, "prayer": 12, "sermon": 14, "my": 2, "all": 92}
    got = {}
    for c in exp: click(pg, "phCat", c); got[c] = pg.locator(".ec-ph").count()
    t.check("s4 상황별 구문 개수", got == exp, got)
    bad = handlers_ok(pg); t.check("s4 구문 화면 처리기", bad == [], bad)
    shot(pg, "p17_phrases")
    click(pg, "phAdd"); t.check("s4 빈 구문 담기 → 안내", "영어 구문을 넣어 주세요" in text(pg))
    pg.fill("#ecPhEn", "Let me pray for you."); pg.fill("#ecPhKo", "제가 기도해 드릴게요."); click(pg, "phAdd")
    t.check("s4 새 구문 담기", ev(pg, "window.__ec.DB.my.length") == 3 and "담았습니다" in text(pg))
    pg.fill("#ecPhEn", "let me PRAY for you."); click(pg, "phAdd")
    t.check("s4 이미 있는 구문 → 안내(대소문자 무시), 쓴 글은 남김", "이미 있는 구문입니다" in text(pg) and pg.input_value("#ecPhEn") == "let me PRAY for you." and ev(pg, "window.__ec.DB.my.length") == 3)
    pg.fill("#ecPhEn", "Nice to meet you. I'm a pastor from Korea."); click(pg, "phAdd")
    t.check("s4 기본 구문과 같아도 거절", "이미 있는 구문입니다" in text(pg) and ev(pg, "window.__ec.DB.my.length") == 3)
    pg.fill("#ecPhEn", "  God   is faithful to us. "); pg.fill("#ecPhKo", "하나님은 우리에게 신실하십니다."); click(pg, "phAdd")
    t.check("s4 내 구문 담기(공백 정리)", ev(pg, "window.__ec.DB.my.slice(-1)[0].en") == "God is faithful to us." and "담았습니다" in text(pg) and pg.input_value("#ecPhEn") == "" and ev(pg, "window.__ec.U.phCat") == "my")
    n_my = ev(pg, "window.__ec.DB.my.length")
    t.check("s4 담은 구문이 새 구문 맨 앞", ev(pg, "pickPhrases(20).filter(x => x.task==='shadow')[0].en") in ["Peace be with you.", "I'm looking forward to it.", "God is faithful to us."])
    pid = ev(pg, "window.__ec.DB.my.slice(-1)[0].id")
    click(pg, "phDel", pid); t.check("s4 빼기 전 한 번 더 물음", "정말 뺄까요" in text(pg) and ev(pg, "window.__ec.DB.my.length") == n_my)
    click(pg, "phDel", pid); t.check("s4 빼기", ev(pg, "window.__ec.DB.my.length") == n_my - 1)
    pg.locator(".ec-ph .ec-mini").first.click(); t.check("s4 구문 듣기 오류 없음", not errs, errs)
    click(pg, "phCat", "all"); click(pg, "start", "phr")
    t.check("s4 구문 화면에서 복습 시작", ev(pg, "window.__ec.A.kind") == "phr"); click(pg, "quit")
    # 기록
    click(pg, "tab", "rec")
    t.check("s4 기록 화면: 시간 그림·목록", pg.locator("svg.ec-chart").count() == 1 and pg.locator("svg.ec-chart rect").count() == 14 and pg.locator('[data-act="logOpen"]').count() == min(20, ev(pg, "window.__ec.DB.log.length")))
    for k in ["talk", "retell", "phr", "dr"]:
        rid = ev(pg, "window.__ec.DB.log.filter(r => r.k==='%s').slice(-1)[0].id" % k)
        click(pg, "logOpen", rid); opened = pg.locator("#ecMain .ec-turn").count() == 1; bad = handlers_ok(pg)
        click(pg, "logOpen", rid); closed = pg.locator("#ecMain .ec-turn").count() == 0
        click(pg, "logOpen", rid); again = pg.locator("#ecMain .ec-turn").count() == 1; click(pg, "logOpen", rid)
        t.check("s4 기록 상세 열기·닫기·다시 열기(%s)" % k, opened and closed and again and bad == [], bad)
    ev(pg, "(function(){ for(var i=0;i<30;i++) logAdd({k:'dr', n:2, ok:1, it:[['g_sva:0',1,90,'',''],['g_sva:1',0,40,'g_sva','he go']]}); window.__ec.render(); })()")
    t.check("s4 기록 20개씩", pg.locator('[data-act="logOpen"]').count() == 20 and has(pg, "logMore"))
    click(pg, "logMore"); t.check("s4 더 보기", pg.locator('[data-act="logOpen"]').count() == min(50, ev(pg, "window.__ec.DB.log.length")) > 20)
    shot(pg, "p18_records")
    click(pg, "repCopy"); pg.wait_for_timeout(300); clip = ev(pg, "navigator.clipboard.readText()")
    t.check("s4 Claude에게 보낼 요약 복사", "최근 2주 요약" in clip and "자주 나온 약점" in clip and "my son like swimming → my son likes swimming" in clip and "요약을 복사했습니다" in text(pg), clip[:200])
    click(pg, "bkCopy"); pg.wait_for_timeout(300); clip = ev(pg, "navigator.clipboard.readText()"); o = json.loads(clip)
    t.check("s4 백업 글 복사: 이 앱 표시, 키 없음", o["app"] == "english-coach" and len(o["log"]) == ev(pg, "window.__ec.DB.log.length") and "AIza" not in clip and "gkey" not in clip)
    with pg.expect_download() as dl: click(pg, "bkDown")
    path = dl.value.path(); body = open(path, encoding="utf-8").read()
    t.check("s4 백업 파일 받기", dl.value.suggested_filename.startswith("english-coach-backup-") and json.loads(body)["v"] == 6 and "AIza" not in body and "백업 파일을 내려받았습니다" in text(pg))
    # 파일로 가져오기 (다른 빈 기기)
    ctx2, pg2, errs2 = page(b); click(pg2, "tab", "rec")
    pg2.set_input_files("#ecBkFile", path); pg2.wait_for_function("window.__ec.DB.log.length > 0", timeout=8000)
    t.check("s4 파일로 가져오기", ev(pg2, "window.__ec.DB.log.length") == len(o["log"]) and "합쳤습니다" in text(pg2) and not errs2, errs2)
    click(pg2, "tab", "home"); t.check("s4 가져온 기기의 홈에 기록 반영", "최근 2주" in text(pg2)); ctx2.close()
    # 자동 복사가 막힌 브라우저
    ev(pg, "(function(){ navigator.clipboard.writeText = function(){ return Promise.reject(new Error('blocked')); }; })()")
    click(pg, "repCopy"); pg.wait_for_selector("#ecCopyArea", timeout=4000)
    t.check("s4 자동 복사가 막히면 글 상자로", "최근 2주 요약" in pg.input_value("#ecCopyArea") and "자동 복사가 막혀" in text(pg) and pg.locator("#ecCopyArea").count() == 1)
    click(pg, "bkCopy"); pg.wait_for_timeout(200)
    t.check("s4 백업 복사도 글 상자로(상자는 하나)", pg.locator("#ecCopyArea").count() == 1 and '"app":"english-coach"' in pg.input_value("#ecCopyArea"))
    t.check("s4 끝까지 오류 없음", not errs, errs); ctx.close()

def s5(b):
    print("\n== s5 날짜가 바뀔 때 ==")
    ctx, pg, errs = page(b); set_key(pg); click(pg, "minutes", "15")
    ev(pg, "window.__mock.batch='all'"); click(pg, "tab", "home"); click(pg, "routine")
    t.check("s5 15분 계획: 구문 5개", ev(pg, "window.__ec.A.items.length") == 5); fill_batch_and_send(pg)
    d0 = ev(pg, "window.__ec.today()")
    t.check("s5 첫날: 맞힌 구문은 내일 복습", ev(pg, "dueList().length") == 0 and ev(pg, "window.__ec.DB.srs.daily1.d") == d0 + 1 and ev(pg, "window.__ec.streak()") == 1)
    click(pg, "quit")
    ev(pg, "window.__ec.Clock.shift = 86400000; window.__ec.go('home')")
    t.check("s5 다음 날: 오늘 숫자가 새로 시작", ev(pg, "window.__ec.today()") == d0 + 1 and "0분" in pg.locator(".ec-today").inner_text() and pg.locator(".ec-step.done").count() == 0 and "오늘 루틴 시작" in text(pg))
    t.check("s5 다음 날: 복습할 구문 5개", ev(pg, "dueList().length") == 5)
    click(pg, "tab", "phr"); t.check("s5 구문 화면에 복습 안내", "복습할 것 5개" in text(pg) and "연습 중" in text(pg))
    click(pg, "start", "phr")
    t.check("s5 본 구문은 우리말만 보고 말하기", ev(pg, "window.__ec.A.items.every(x => x.task==='recall')") and pg.locator(".ec-task.en").count() == 0 and "우리말을 보고 영어로" in text(pg) and ev(pg, "window.__ec.A.items[0].en") not in text(pg))
    shot(pg, "p19_recall")
    fill_batch_and_send(pg)
    t.check("s5 이어 맞히면 3일 뒤", ev(pg, "window.__ec.DB.srs.daily1") == {"b": 2, "d": d0 + 4, "n": 2, "k": 2, "l": d0 + 1} and "다음 복습: 3일 뒤" in text(pg))
    t.check("s5 이틀 연속", ev(pg, "window.__ec.streak()") == 2)
    t.check("s5 상자 간격 0·1·3·7·14·30·60", ev(pg, "(function(){ var out=[], d=window.__ec.today(); DB.srs.zz={b:1,d:d,n:1,k:1,l:d}; for(var i=0;i<6;i++){ var s=srsMark('zz', true); out.push(s.d-d); } var f=srsMark('zz', false); out.push(f.b, f.d-d); delete DB.srs.zz; return out.join(','); })()") == "3,7,14,30,60,60,1,1")
    click(pg, "quit"); ev(pg, "window.__ec.Clock.shift = 5*86400000; window.__ec.go('home')")
    t.check("s5 며칠 쉬면 연속 0일", ev(pg, "window.__ec.streak()") == 0 and "연속 0일" in text(pg))
    t.check("s5 쉰 뒤에도 기록은 그대로", ev(pg, "window.__ec.DB.log.length") == 2 and ev(pg, "Object.keys(window.__ec.DB.day).length") >= 2)
    # 약점 통계: 추세와 졸업
    out = ev(pg, """(function(){ var now=Date.now()+window.__ec.Clock.shift, D1=86400000, n=0;
      function add(daysAgo, tags){ DB.log.push({id:'syn'+(n++), t: now - daysAgo*D1 + n*1000, k:'talk', sc:'daily', tx:'x', nat:'y', s:[60,60,60,60], m:[20,15,daysAgo>7?8:3,1, daysAgo>7?3.5:6, daysAgo>7?70:95, 20], tags:tags, fx:[]}); }
      for(var i=0;i<4;i++) add(25, ['g_art','g_sva','g_tense']);
      for(var i=0;i<4;i++) add(20, ['g_sva','g_tense']);
      for(var i=0;i<5;i++) add(10, ['g_sva','p_th']);
      for(var i=0;i<6;i++) add(3, ['g_sva','p_th','p_th2']);
      DB.log.sort(function(a,b){ return a.t-b.t; });
      var S=tagStats(), by={}; S.list.forEach(function(s){ by[s.g]=s; });
      return {aR:S.aR, aP:S.aP, art:by.g_art, sva:by.g_sva, tense:by.g_tense, th:by.p_th, focus:focusTags(), first:S.list[0].g}; })()""")
    t.check("s5 최근 2주·그 전 2주 대답 수", out["aR"] == 11 and out["aP"] == 8, (out["aR"], out["aP"]))
    t.check("s5 사라진 약점은 졸업", out["art"]["grad"] is True and out["art"]["tot"] == 4 and out["art"]["r"] == 0 and "g_art" not in out["focus"], out["art"])
    t.check("s5 줄어든 약점", out["tense"]["trend"] == "down" and out["tense"]["grad"] is True, out["tense"])
    t.check("s5 계속 나오는 약점은 비슷, 졸업 아님", out["sva"]["trend"] == "same" and out["sva"]["grad"] is False and out["sva"]["r"] == 11 and out["sva"]["p"] == 8, out["sva"])
    t.check("s5 새로 나타난 약점", out["th"]["trend"] == "new" and out["th"]["r"] == 11, out["th"])
    t.check("s5 집중 약점: 많이 나온 순, 모자라면 기본으로 채움(졸업한 것 포함 안 함)", out["focus"][:2] == ["g_sva", "p_th"] and len(out["focus"]) == 3, out["focus"])
    t.check("s5 분류표에 없는 꼬리표는 세지 않음", out["first"] == "g_sva")
    click(pg, "tab", "weak"); t.check("s5 약점 화면에 졸업·추세 표시", pg.locator(".ec-badge.good").count() == 2 and "새로 나타남" in text(pg) and "줄어듦" in text(pg))
    shot(pg, "p20_weak_trend")
    click(pg, "tab", "home")
    t.check("s5 홈에 이번 주 변화(기기 측정)", "이번 주 변화" in text(pg) and pg.locator("table.ec-t tr").count() == 4)
    t.check("s5 선생님에게 주는 정보에 최근 약점", "g_sva x11" in ev(pg, "profileText()") and "p_th x11" in ev(pg, "profileText()"))
    t.check("s5 기기 판정: 평평·멈춤·느림", ev(pg, "deviceTags({span:30,pauses:8,st:3.2},30).join(',')") == "d_flat,d_pause,d_slow" and ev(pg, "deviceTags({span:30,pauses:2,st:6},60).join(',')") == "" and ev(pg, "deviceTags({span:30,pauses:2,st:6},30,true).join(',')") == "" and ev(pg, "deviceTags({span:4,pauses:5,st:2},3).length") == 0)
    # 다시 말하기: 오늘 대답이 없으면 최근 것
    click(pg, "start", "retell"); t.check("s5 오늘 대답이 없으면 최근 대답으로 다시 말하기", ev(pg, "window.__ec.A.queue.length") == 3); click(pg, "quit"); click(pg, "tab", "home")
    # 실전 미션
    ids = ev(pg, "Array.from(document.querySelectorAll('.ec-miss')).map(e => e.getAttribute('data-arg'))")
    click(pg, "miss", ids[0]); w = ev(pg, "weekNo(window.__ec.today())")
    t.check("s5 미션 표시", pg.locator(".ec-miss.done").count() == 1 and ev(pg, "!!window.__ec.DB.miss[%d]['%s']" % (w, ids[0])))
    click(pg, "miss", ids[0]); t.check("s5 미션 표시 풀기", pg.locator(".ec-miss.done").count() == 0)
    click(pg, "miss", ids[1])
    ev(pg, "window.__ec.Clock.shift = 12*86400000; window.__ec.go('home')")
    ids2 = ev(pg, "Array.from(document.querySelectorAll('.ec-miss')).map(e => e.getAttribute('data-arg'))")
    t.check("s5 주가 바뀌면 다른 미션", ids2 != ids and pg.locator(".ec-miss.done").count() == 0 and len(set(ids2)) == 3, (ids, ids2))
    t.check("s5 지난 주 미션 표시는 남아 있음", ev(pg, "!!window.__ec.DB.miss[%d]['%s']" % (w, ids[1])))
    ev(pg, "DB.log.push({id:'tt', t: Date.now()+window.__ec.Clock.shift-8*86400000, k:'test', score:61, lv:'B1', parts:{}, tasks:[], tags:[]}); DB.log.sort(function(a,b){ return a.t-b.t; }); window.__ec.go('home')")
    t.check("s5 테스트한 지 일주일이 넘으면 다시 볼 때라고 안내", "마지막 테스트 8일 전 — 다시 볼 때입니다" in text(pg))
    t.check("s5 시간 세기: 누르는 동안만, 한 번에 최대 90초", ev(pg, "(function(){ var r=dayRec(); r.sec=0; lastTick=0; tick(); lastTick-=30000; tick(); var a=r.sec; lastTick-=200000; tick(); return [Math.round(a), Math.round(r.sec)]; })()") == [30, 30])
    t.check("s5 끝까지 오류 없음", not errs, errs); ctx.close()

V5 = """
if(!localStorage.getItem('ec6_migrated') && !localStorage.getItem('ec_history')){
  var now=Date.now();
  localStorage.setItem('ec_history', JSON.stringify([
    {t:now-86400000*2, mode:'speak', title:'자기소개', overall:71, acc:74, fluency:66, prosody:70, comp:null, wpm:92, pauses:4, n:40},
    {t:now-86400000, mode:'read', title:'축도', overall:80, acc:82, fluency:78, prosody:79, comp:95, wpm:110, pauses:1, n:31},
    {t:now-3600000*3, mode:'talk', title:'일상 대화', overall:60.5, acc:68, fluency:55, prosody:61, gram:58, wpm:71.3, pauses:14, st:3.9, n:52},
    {t:now-3600000*2, mode:'talk', title:'일상 대화', overall:63, acc:70, fluency:58, prosody:62, gram:62, wpm:66, pauses:19, st:4.4, n:61},
    {t:now-3600000, mode:'talk', title:'일상 대화', overall:65, acc:72, fluency:60, prosody:64, gram:64, wpm:78, pauses:11, st:5.0, n:47},
    null, {mode:'talk'}
  ]));
  localStorage.setItem('ec_gkey','AIzaOLDKEY'); localStorage.setItem('ec_gmodel',''); localStorage.setItem('ec_gchain', JSON.stringify(['gemini-3.5-flash','gemini-3.1-flash-lite']));
  localStorage.setItem('ec_autospeak','off'); localStorage.setItem('ec_key','azure-old'); localStorage.setItem('ec_region','koreacentral');
}
"""
def s6(b):
    print("\n== s6 이전 기록 옮겨 오기와 저장 ==")
    ctx, pg, errs = page(b, init=V5)
    t.check("s6 v5 기록 5개 옮겨 옴(깨진 항목은 건너뜀)", ev(pg, "window.__ec.MIGRATED") == 5 and ev(pg, "window.__ec.DB.log.length") == 5 and ev(pg, "window.__ec.DB.log.every(r => r.k==='old')") and not errs, errs)
    t.check("s6 원본은 지우지 않음", ev(pg, "JSON.parse(localStorage.getItem('ec_history')).length") == 7 and ev(pg, "localStorage.getItem('ec_key')") == "azure-old")
    t.check("s6 키·모델 순서·자동 읽기 설정 이어받음", ev(pg, "window.__ec.G.key") == "AIzaOLDKEY" and ev(pg, "window.__ec.G.chain.length") == 2 and ev(pg, "window.__ec.DB.set.autoSpeak") is False)
    r = ev(pg, "window.__ec.DB.log[4]"); t.check("s6 옮긴 기록 내용", r["title"] == "일상 대화" and r["s"] == [72, 64, 60, 64] and r["m"][2] == 11 and r["m"][4] == 5 and r["m"][5] == 78, r)
    click(pg, "tab", "rec"); t.check("s6 기록 화면에 이전 기록 표시", pg.locator('[data-act="logOpen"]').count() == 5 and "이전 기록" in text(pg))
    rid = r["id"]; click(pg, "logOpen", rid); t.check("s6 이전 기록 상세", "이전 버전에서 옮겨 온 기록" in text(pg) and handlers_ok(pg) == [])
    shot(pg, "p21_migrated")
    pg.reload(); pg.wait_for_function("window.__ec")
    t.check("s6 다시 열어도 중복으로 옮기지 않음", ev(pg, "window.__ec.MIGRATED") == 0 and ev(pg, "window.__ec.DB.log.length") == 5)
    click(pg, "tab", "home"); click(pg, "start", "talk")
    t.check("s6 옮겨 온 키로 바로 대화 시작", ev(pg, "window.__ec.A && window.__ec.A.type") == "talk")
    ev(pg, "(function(){ var A=window.__ec.A; A.pend=window.__fakeClip(3); talkSend(); })()"); pg.wait_for_function("window.__ec.A.turns.length === 1", timeout=15000)
    t.check("s6 새 기록이 이전 기록 뒤에 쌓임", ev(pg, "window.__ec.DB.log.length") == 6 and ev(pg, "window.__ec.DB.log[5].k") == "talk" and calls(pg)[-1]["key"] == "AIzaOLDKEY")
    ctx.close()
    # 깨진 저장값
    ctx, pg, errs = page(b, init="localStorage.setItem('ec6_log','not json'); localStorage.setItem('ec6_srs','[1,2]'); localStorage.setItem('ec6_day','null'); localStorage.setItem('ec6_my','{}'); localStorage.setItem('ec6_set','\"x\"'); localStorage.setItem('ec6_miss','7'); localStorage.setItem('ec_gchain','oops'); localStorage.setItem('ec_history','{bad');")
    t.check("s6 저장값이 깨져 있어도 열림", not errs and ev(pg, "window.__ec.DB.log.length") == 0 and ev(pg, "window.__ec.DB.set.minutes") == 30 and pg.locator(".ec-step").count() == 4, errs)
    for tab in ["train", "weak", "phr", "rec", "set"]: click(pg, "tab", tab)
    t.check("s6 깨진 저장값으로 모든 화면 열림", not errs, errs); ctx.close()
    # 저장이 막힌 브라우저
    ctx, pg, errs = page(b, init="Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };")
    t.check("s6 저장이 막혀도 열림", not errs, errs)
    click(pg, "tab", "set"); pg.fill("#ecGKey", "AIzaTESTKEY123"); click(pg, "gSave")
    pg.wait_for_function("document.querySelector('#ecMain').innerText.indexOf('키가 확인됐습니다') >= 0", timeout=8000)
    t.check("s6 저장이 막히면 키는 열어 둔 동안만", "열어 둔 동안만 기억" in text(pg))
    click(pg, "tab", "home"); click(pg, "start", "dr"); ev(pg, "window.__mock.batch='all'"); fill_batch_and_send(pg)
    t.check("s6 저장이 막혀도 훈련은 되고 경고를 보임", "저장 공간이 부족하거나 저장이 막혀" in pg.locator("#ecWarn").inner_text() and ev(pg, "window.__ec.DB.log.length") == 1 and not errs, errs)
    ctx.close()
    # 공간이 모자라면 오래된 기록의 긴 글만 덜어 냄
    ctx, pg, errs = page(b)
    out = ev(pg, """(function(){ var old=Date.now()-70*86400000;
      DB.log.push({id:'old1', t:old, k:'talk', sc:'daily', q:'Q', tx:'OLDTEXT '+Array(200).join('word '), nat:'OLDTEXT natural', ch:[{en:'a',ko:'b'}], s:[60,61,62,63], m:[10,8,2,0.7,5,90,9], tags:['g_sva'], fx:[{a:'he go',b:'he goes',g:'g_sva'}]});
      var real=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){ if(k==='ec6_log' && v.indexOf('OLDTEXT')>=0) throw new Error('QuotaExceededError'); return real.call(this,k,v); };
      logAdd({k:'talk', sc:'daily', tx:'new text', nat:'new natural', s:[70,70,70,70], m:[5,4,0,0,6,100,5], tags:[], fx:[]});
      var saved=JSON.parse(localStorage.getItem('ec6_log')); return {n:saved.length, old:saved[0], neu:saved[1], fail:DB.saveFail}; })()""")
    t.check("s6 공간이 모자라면 두 달 넘은 글만 덜고 저장", out["n"] == 2 and "tx" not in out["old"] and "nat" not in out["old"] and out["old"]["s"] == [60, 61, 62, 63] and out["old"]["tags"] == ["g_sva"] and out["old"]["fx"][0]["b"] == "he goes" and out["neu"]["tx"] == "new text" and out["fail"] is False, out)
    click(pg, "tab", "rec"); click(pg, "logOpen", "old1"); t.check("s6 글을 덜어 낸 기록도 열림", "덜어 냈습니다" in text(pg) and not errs, errs)
    ctx.close()

def s7(b):
    print("\n== s7 오류 상황 ==")
    ctx, pg, errs = page(b); set_key(pg); click(pg, "tab", "train"); pg.select_option("#ecScene", "0"); click(pg, "start", "talk")
    send = "(function(){ var A=window.__ec.A; A.pend=window.__fakeClip(3); talkSend(); })()"
    # 마이크 거부
    ev(pg, "(function(){ window.__gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = function(){ var e=new Error('Permission denied'); e.name='NotAllowedError'; return Promise.reject(e); }; })()")
    click(pg, "rec"); pg.wait_for_function("document.querySelector('#ecMsg').innerText.length > 0", timeout=5000)
    t.check("s7 마이크 거부 안내, 단추는 다시 눌림", "마이크 사용이 허용되지 않았습니다" in note(pg) and ev(pg, "window.__ec.REC.busy") is False and pg.locator(".ec-btn.rec").is_enabled())
    ev(pg, "(function(){ navigator.mediaDevices.getUserMedia = function(){ var e=new Error('Requested device not found'); e.name='NotFoundError'; return Promise.reject(e); }; })()")
    click(pg, "rec"); pg.wait_for_function("document.querySelector('#ecMsg').innerText.indexOf('찾지 못했습니다') >= 0", timeout=5000)
    t.check("s7 마이크 없음 안내", True)
    # 소리가 없는 녹음
    ev(pg, "(function(){ navigator.mediaDevices.getUserMedia = function(){ var c=new AudioContext(), d=c.createMediaStreamDestination(); return Promise.resolve(d.stream); }; })()")
    rec(pg, 1.2); pg.wait_for_function("document.querySelector('#ecMsg').innerText.indexOf('소리가 잡히지') >= 0", timeout=5000)
    t.check("s7 소리 없는 녹음은 보내지 않음", len(calls(pg, "talk")) == 0 and phase(pg) == "idle")
    ev(pg, "(function(){ navigator.mediaDevices.getUserMedia = window.__gum; })()")
    # 선생님이 못 알아들음
    ev(pg, "window.__mock.talkEmpty = true"); ev(pg, send); pg.wait_for_function("document.querySelector('#ecMsg').innerText.indexOf('알아듣지 못했다고') >= 0", timeout=10000)
    t.check("s7 못 알아들으면 기록하지 않고 다시 녹음", ev(pg, "window.__ec.DB.log.length") == 0 and phase(pg) == "idle" and ev(pg, "window.__ec.A.pend") is None)
    ev(pg, "window.__mock.talkEmpty = false")
    cases = [("bad", "답을 읽지 못했습니다"), ("empty", "차단 사유: OTHER"), ("403", "이 키로는 쓸 수 없습니다")]
    for plan, msg in cases:
        ev(pg, "window.__mock.plan=['%s']" % plan); ev(pg, send); wait_phase(pg, "fail")
        t.check("s7 %s → 안내와 다시 보내기" % plan, msg in note(pg) and has(pg, "tResend") and ev(pg, "!!window.__ec.A.pend"), note(pg))
    click(pg, "tDrop"); t.check("s7 새로 녹음 고르기", phase(pg) == "idle" and ev(pg, "window.__ec.A.pend") is None and has(pg, "rec"))
    # 모델이 사라짐 → 목록 다시 받고 다음 모델
    nl = ev(pg, "window.__calls.filter(c => c.kind==='list').length")
    ev(pg, "window.__mock.plan=['404']; window.__mock.models = window.__mock.models.filter(function(n){ return n!=='gemini-3.5-flash'; })"); ev(pg, send)
    pg.wait_for_function("window.__ec.A.turns.length === 1", timeout=15000)
    t.check("s7 없는 모델 → 목록을 새로 받아 다음 모델로", ev(pg, "window.__calls.filter(c => c.kind==='list').length") == nl + 1 and calls(pg)[-1]["model"] == "gemini-2.5-flash" and ev(pg, "window.__ec.G.chain.indexOf('gemini-3.5-flash')") == -1)
    ev(pg, "window.__mock.plan=['500']"); ev(pg, send); pg.wait_for_function("window.__ec.A.turns.length === 2", timeout=15000)
    t.check("s7 서버 오류 → 다음 모델, 1분 대기 표시", calls(pg)[-1]["model"] == "gemini-3.5-flash-preview" and 0 < ev(pg, "window.__ec.G.block['gemini-2.5-flash'] - Date.now()") <= 60000)
    ev(pg, "gReset(); window.__mock.plan=['429min']"); ev(pg, send); pg.wait_for_function("window.__ec.A.turns.length === 3", timeout=15000)
    t.check("s7 분당 한도 → 알려 준 시간만큼 대기", 19000 < ev(pg, "window.__ec.G.block['gemini-2.5-flash'] - Date.now()") <= 21000)
    ev(pg, "gReset(); window.__mock.plan=['net','ok']"); ev(pg, send); pg.wait_for_function("window.__ec.A.turns.length === 4", timeout=15000)
    t.check("s7 한 번 끊기면 같은 모델로 자동 재시도", [c["model"] for c in calls(pg)[-2:]] == ["gemini-2.5-flash", "gemini-2.5-flash"])
    # 모든 모델 한도 소진
    ev(pg, "gReset(); window.__mock.plan=['429day','429day','429day']"); ev(pg, send); wait_phase(pg, "fail")
    t.check("s7 모든 모델 한도 소진 → 언제 다시 되는지 안내, 녹음 유지", "오늘 무료 한도를 모든 모델에서 다 썼습니다" in note(pg) and "쯤 다시 쓸 수 있습니다" in note(pg) and ev(pg, "!!window.__ec.A.pend"), note(pg))
    click(pg, "tab", "set"); t.check("s7 설정에 모델별 상태", text(pg).count("오늘 한도 소진") == 3 and ev(pg, "window.__ec.A.phase") == "fail")
    click(pg, "gReset"); t.check("s7 한도 기록 지우기", text(pg).count("사용 가능") == 3)
    click(pg, "tab", "train"); click(pg, "tResend"); pg.wait_for_function("window.__ec.A.turns.length === 5", timeout=15000)
    t.check("s7 설정에 다녀와서 다시 보내기", True)
    # 답을 기다리는 중에 그만두면 버림
    n0 = ev(pg, "window.__ec.DB.log.length"); ev(pg, "window.__mock.plan=['slow']"); ev(pg, send); click(pg, "quit")
    t.check("s7 기다리는 중 그만두려 하면 물음", "그만두면 사라집니다" in text(pg) and phase(pg) == "sending")
    click(pg, "quit", "yes"); pg.wait_for_timeout(1800)
    t.check("s7 기다리는 중 그만두면 조용히 버림", ev(pg, "window.__ec.A") is None and ev(pg, "window.__ec.DB.log.length") == n0 and not errs, errs)
    # 녹음 중 그만두기
    click(pg, "start", "talk"); click(pg, "rec"); pg.wait_for_selector(".ec-btn.rec.on"); click(pg, "quit"); pg.wait_for_timeout(200)
    t.check("s7 녹음 중 그만두기", ev(pg, "window.__ec.A") is None and ev(pg, "window.__ec.REC.on") is False and ev(pg, "CAP") is None and not errs, errs)
    # 최대 시간에 자동으로 멈춤
    click(pg, "start", "dr"); click(pg, "rec"); pg.wait_for_selector(".ec-btn.rec.on"); ev(pg, "window.__ec.REC.max = 1.2"); wait_phase(pg, "shown", 6000)
    t.check("s7 최대 시간이 되면 자동으로 멈춤", ev(pg, "window.__ec.REC.on") is False and ev(pg, "window.__ec.A.clips.length") == 1)
    # 묶음: 한 개가 안 들림
    ev(pg, "window.__mock.batch='silent'"); fill_batch_and_send(pg)
    t.check("s7 안 들린 항목은 틀림 처리·안내", ev(pg, "window.__ec.A.res[0].ok") is False and "들리지 않았어요" in ev(pg, "window.__ec.A.res[0].note"))
    ev(pg, "window.__mock.batch='alt'")
    # 묶음 전송 실패 → 다시 보내기
    click(pg, "quit"); click(pg, "start", "dr"); ev(pg, "window.__fillBatch(); window.__mock.plan=['403']"); click(pg, "bNext"); wait_phase(pg, "fail")
    t.check("s7 묶음 전송 실패: 녹음 유지", "녹음 6개는 그대로" in text(pg) and has(pg, "bSend"))
    click(pg, "bSend"); wait_phase(pg, "done"); t.check("s7 묶음 다시 보내기", calls(pg, "batch")[-1]["audio"] == 6)
    click(pg, "quit")
    # 원고 낭독
    pg.select_option("#ecScene", "6"); t.check("s7 낭독 장면은 원고 칸이 나옴", pg.locator("#ecScript").count() == 1)
    click(pg, "start", "talk"); t.check("s7 원고 없이 시작 → 안내", "읽을 영어 원고를 먼저" in note(pg) and ev(pg, "window.__ec.A") is None)
    pg.fill("#ecScript", "The Lord bless you and keep you. The Lord make his face shine on you."); click(pg, "start", "talk")
    t.check("s7 원고 낭독 시작", pg.locator(".ec-script").count() == 1 and ev(pg, "window.__ec.A.script.length") > 20)
    ev(pg, send); pg.wait_for_function("window.__ec.A.turns.length === 1", timeout=15000)
    t.check("s7 낭독 요청에 원고 포함", "He is reading this text aloud" in last_text(pg) and "The Lord bless you and keep you." in last_text(pg) and "(read)" in last_text(pg))
    click(pg, "quit"); click(pg, "start", "retell")
    t.check("s7 낭독은 다시 말하기 대상이 아님", ev(pg, "window.__ec.A.queue.every(r => r.sc !== 'read')"))
    click(pg, "quit")
    # 대화 기록이 없을 때 다시 말하기
    ctx2, pg2, errs2 = page(b); set_key(pg2); click(pg2, "tab", "train"); click(pg2, "start", "retell")
    t.check("s7 대화 전에는 다시 말하기 안내", "먼저 「선생님과 대화」를" in note(pg2) and ev(pg2, "window.__ec.A") is None and not errs2, errs2); ctx2.close()
    t.check("s7 끝까지 오류 없음", not errs, errs); ctx.close()

def s8(b):
    print("\n== s8 아이패드 크기 ==")
    bk = open(BK, encoding="utf-8").read() if os.path.exists(BK) else None
    ctx, pg, errs = page(b, viewport=IPAD); set_key(pg)
    if bk: ev(pg, "backupMerge(JSON.parse(%s))" % json.dumps(bk))
    ev(pg, """(function(){ var now=Date.now(); [58.2, 61.4, 65.9].forEach(function(sc, i){ DB.log.push({id:'t'+i, t: now-(21-i*7)*86400000, k:'test', score:sc, lv:levelOf(sc).id, parts:{pron:66,inton:60,flu:55+i*4,gram:58,vocab:60,task:70}, tasks:[], tags:[]}); });
      DB.log.sort(function(a,b){ return a.t-b.t; }); for(var i=1;i<12;i++){ dayRec(today()-i).sec = (i%4===0 ? 0 : 900+i*150); } dbSave('log'); dbSave('day'); window.__ec.go('home'); })()""")
    t.check("s8 가로 넘침 없음(홈)", ev(pg, "document.documentElement.scrollWidth <= window.innerWidth"))
    shot(pg, "t01_home")
    for tab in ["train", "weak", "phr", "rec", "set"]:
        click(pg, "tab", tab); bad = handlers_ok(pg)
        t.check("s8 %s: 처리기·가로 넘침" % tab, bad == [] and ev(pg, "document.documentElement.scrollWidth <= window.innerWidth"), bad)
        shot(pg, "t02_" + tab)
    click(pg, "tab", "rec"); t.check("s8 등급 변화 그림(테스트 3번)", pg.locator("svg.ec-chart circle").count() == 3 and pg.locator("svg.ec-chart polyline").count() == 1)
    click(pg, "tab", "train"); pg.select_option("#ecScene", "2"); click(pg, "start", "talk")
    rec(pg, 2.6); pg.wait_for_function("window.__ec.A.turns.length === 1", timeout=15000)
    rec(pg, 2.6); pg.wait_for_function("window.__ec.A.turns.length === 2", timeout=15000)
    t.check("s8 대화 두 번: 첫 대답 접힘", pg.locator(".ec-fold").count() == 1 and pg.locator(".ec-turn").count() == 1 and "간증 나누기" in text(pg))
    t.check("s8 가로 넘침 없음(대화)", ev(pg, "document.documentElement.scrollWidth <= window.innerWidth"))
    shot(pg, "t03_talk"); click(pg, "tEnd"); click(pg, "start", "retell"); shot(pg, "t04_retell")
    click(pg, "quit"); click(pg, "start", "phr"); shot(pg, "t05_batch"); rec(pg, 1.2); wait_phase(pg, "shown"); view(pg, "t06_batch_shown")
    click(pg, "quit"); click(pg, "quit", "yes")
    t.check("s8 끝까지 오류 없음", not errs, errs); ctx.close()
    # 휴대폰 가로 넘침
    ctx, pg, errs = page(b); set_key(pg)
    if bk: ev(pg, "backupMerge(JSON.parse(%s)); window.__ec.go('home')" % json.dumps(bk))
    wide = []
    for tab in ["home", "train", "weak", "phr", "rec", "set"]:
        click(pg, "tab", tab)
        if not ev(pg, "document.documentElement.scrollWidth <= window.innerWidth"): wide.append(tab)
    t.check("s8 휴대폰 크기에서 가로 넘침 없음", wide == [], wide)
    view(pg, "p22_phone_view"); ctx.close()

srv = serve(ROOT)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=CHROME_ARGS + ["--use-file-for-fake-audio-capture=" + WAV])
    for name in WANT: globals()[name](b)
    b.close()
sys.exit(t.done())
