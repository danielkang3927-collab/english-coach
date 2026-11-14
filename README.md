# 영어 말하기 코치

선교지 영어 준비용 발음·억양 연습 페이지. 미국식 영어 기준.

- `index.html` 앱 전체 (한 파일)
- `speech-sdk.js` Microsoft Speech SDK 브라우저 묶음 1.53.0 (MIT, `speech-sdk.LICENSE.txt`)
- `tests/test_app.py` 배포 전 점검: `python3 tests/test_app.py <앱 폴더> <캡처 폴더> tests/fake_speech.wav`

「대화」 탭은 Google Gemini가 녹음을 듣고 코칭한다(무료 이용 키). 「정밀 채점」 탭은 Azure Speech 키가 있을 때 쓴다.

이용 키는 코드에 넣지 않는다. 사용자가 앱의 「설정·안내」에 직접 입력하며 그 기기에만 저장된다.
