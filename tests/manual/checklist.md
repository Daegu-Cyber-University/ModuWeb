# 모듈 분리 후 수동 브라우저 테스트 체크리스트

모듈 분리 및 Rollup 빌드 완료 후, 아래 항목을 브라우저에서 직접 확인하세요.  
테스트 페이지: `examples/basic.html`, `examples/api-examples.html`

---

## 1. 기본 초기화

- [ ] `new WAT({ configPath: './config.json' }).init()` 정상 실행
- [ ] `wat:initialized` 이벤트 콘솔 출력 확인
- [ ] WAT UI 패널이 화면에 렌더링됨
- [ ] 열기/닫기 버튼 동작 확인
- [ ] `window.WAT` 전역 참조 정상 등록 (`console.log(window.WAT)`)

---

## 2. 설정 로드 (config.json)

- [ ] `config.json` fetch 성공 (Network 탭 확인)
- [ ] 사전 기능 활성화 여부가 config에 따라 올바르게 반영
- [ ] `resources.fonts` 설정에 따른 폰트 URL 동적 로드 확인
- [ ] config 파일 없을 때 fallback 기본값으로 정상 동작

---

## 3. TTS (Text-to-Speech)

- [ ] AutoTTS: TTS 버튼 클릭 후 페이지 요소 순차 읽기
- [ ] FocusTTS: 텍스트 더블클릭 시 해당 텍스트 읽기
- [ ] KeyboardTTS: 텍스트 선택 후 단축키로 읽기
- [ ] TTS 일시정지 / 재개 / 정지 동작
- [ ] 읽기 속도 조절 정상 동작
- [ ] TTS 중 다른 기능 전환 시 정상 종료

---

## 4. STT (Speech-to-Text)

- [ ] 마이크 권한 요청 팝업 표시
- [ ] 음성 인식 시작/종료 토글
- [ ] 인식된 음성 명령어 처리 (예: "크게", "작게", "닫기")
- [ ] 인식 실패 시 오류 메시지 표시

---

## 5. 사전 검색

- [ ] 단어 선택 후 사전 검색 패널 열림
- [ ] JSONP 요청 정상 발송 (Network 탭 확인)
- [ ] 검색 결과 렌더링
- [ ] 타임아웃/오류 시 에러 메시지 표시
- [ ] 검색 캐시 동작 (동일 단어 재검색 시 캐시 사용)

---

## 6. 스타일 / 접근성 기능

- [ ] 글꼴 크기 조절 (+/- 버튼)
- [ ] 폰트 변경 (Nanum Myeongjo / Noto Serif KR)
- [ ] 고대비 모드 토글
- [ ] 색상 반전 토글
- [ ] 화면 확대/축소
- [ ] 읽기 가이드 라인 표시

---

## 7. 설정 저장 및 복원

- [ ] 설정 변경 후 페이지 새로고침 시 설정 유지 (localStorage)
- [ ] 설정 초기화 버튼 동작
- [ ] 접근성 프로필 적용 (저시력 / 노인 등)

---

## 8. 다국어

- [ ] 한국어 UI 표시
- [ ] 영어(en-US) 전환 후 UI 텍스트 변경 확인
- [ ] 일본어(ja) 전환 후 UI 텍스트 변경 확인

---

## 9. iframe 처리

- [ ] iframe 포함 페이지에서 WAT 초기화 정상
- [ ] iframe 내부 스타일 동기화 확인

---

## 10. 중복 로드 방지

- [ ] 동일 페이지에 `webAccTools.js`를 두 번 로드해도 경고만 출력되고 중복 실행 없음

---

## 11. 빌드 결과 비교

- [x] `dist/webAccTools.js` 파일 크기: 510KB (legacy 544.6KB 대비 -6.3%, ±10% 이내)
- [x] `dist/webAccTools.min.js` 파일 생성 확인 (522KB)
- [x] 소스맵(`dist/webAccTools.js.map`) 파일 생성 확인
- [x] 모든 핵심 클래스 포함 확인 (WAT, StateManager, TTSManager, STTManager, ErrorHandler 등 14개)
- [x] `window.WAT = WAT` 전역 등록 코드 포함
- [ ] 브라우저 DevTools의 Sources 탭에서 원본 소스 파일 확인 가능

## 12. 자동화 테스트 결과 (2026-03-16)

- [x] Phase 1 테스트: core-simple (constants, defaults, localization, validation) - 통과
- [x] Phase 2 테스트: ErrorHandler - 17개 테스트 통과
- [x] Phase 3 테스트: ContainerManager, StyleBatchProcessor, OptionsProcessor, ConfigurationManager - 32개 테스트 통과
- [x] Phase 4 테스트: StateManager - 19개 테스트 통과
- [x] 전체 테스트: 84개 테스트 통과 (4개 테스트 스위트)

---

## 접근성·테마 보강 확인 (2026-08)

### 키보드·스크린리더
- [ ] Escape 키로 메인 패널이 닫히고 포커스가 열기 버튼으로 복원됨
- [ ] Alt+Shift+T/D/S 단축키 동작, `settings.ui.keyboardShortcuts: false`로 비활성화됨
- [ ] 아이콘 모드에서 Tab으로 라디오 옵션 도달, 화살표 키로 값 변경 가능
- [ ] 스크린리더가 프로필 토글을 "프로필명 + 스위치 + 켜짐/꺼짐"으로 낭독 (전부 "꺼짐"이 아님)
- [ ] 옵션 아코디언이 "접힘/펼쳐짐"으로 낭독되고 열린 뒤에도 조작 가능
- [ ] 알림 발생 시 스크린리더가 메시지를 낭독함 (첫 알림 포함)

### 테마
- [ ] 어둡게: 호스트는 어둡게 평탄화되고 위젯 패널·읽기 가이드·알림은 원래 모습 유지
- [ ] 밝게: 흰 배경 + 진한 글자로 대비가 올라감 (전체가 뿌옇게 밝아지지 않음)
- [ ] 반전: 페이지는 반전되지만 사진·영상·위젯 UI는 원본 색 유지
- [ ] OS 모션 감소 설정 시 위젯 전환 애니메이션 없음

### 반응형
- [ ] 375px 뷰포트에서 패널이 화면을 벗어나지 않고 아이콘 그리드가 2열로 표시됨
- [ ] 데스크톱(1280px)에서 기존과 동일 (500px 패널, 3열)

---

## 테스트 환경

| 브라우저 | 버전 | 확인일 | 결과 |
|---------|------|--------|------|
| Chrome  |      |        |      |
| Edge    |      |        |      |
| Firefox |      |        |      |
| Safari  |      |        |      |
