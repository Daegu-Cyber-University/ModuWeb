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
- [x] 전체 테스트: 94개 테스트 통과 (4개 테스트 스위트)

---

## 테스트 환경

| 브라우저 | 버전 | 확인일 | 결과 |
|---------|------|--------|------|
| Chrome  |      |        |      |
| Edge    |      |        |      |
| Firefox |      |        |      |
| Safari  |      |        |      |
