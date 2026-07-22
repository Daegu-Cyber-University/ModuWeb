# Changelog

모든 주요 변경 사항은 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
[유의적 버전](https://semver.org/lang/ko/)을 준수합니다.

---

## [Unreleased]

### 수정
- **어둡게(dark) 테마에서 텍스트가 보이지 않던 문제**: 배경만 `#333`으로 강제하고 글자색을 지정하지 않아, 원래 어두웠던 텍스트가 같은 색 배경에 묻혔다(호스트 페이지 폼 라벨은 대비 1.00으로 완전 불가시). 전경색 규칙을 추가하고 링크·아이콘 글리프·폼 컨트롤 예외를 분리했다. 자동 측정 기준 패널 46/48 → 0/41, 호스트 16/21 → 0/21 실패
- **`pre`/`code` 본문이 잘려 보이던 문제**: 인라인 요소에 강제된 배경 상자가 줄마다 윗줄 글자를 덮었다. 인라인 요소 배경을 투명 처리해 해소
- **CI dist 드리프트 게이트 상시 실패**: Windows(CRLF)에서 빌드하면 인라인되는 CSS·`ko.json`이 LF 체크아웃 환경과 1400곳 달라졌다. 텍스트 자산을 LF로 정규화해 빌드 산출물을 플랫폼 독립적으로 변경
- `check-css-selectors.mjs`가 `:is()`·`[attr="a,b"]` 내부 쉼표를 셀렉터 구분자로 잘못 인식하던 문제

### 추가
- **장애 유형 프로필 4종 추가** (기존 3종 → 7종): 시각 장애(이미지 대체텍스트 + 포커스 낭독 자동 시작), 고령자(글자·행간·자간 확대 + 커서 강조), 움직임 민감(애니메이션·미디어 정지 + 채도 완화 — 광과민성 발작·전정 장애 대응), 신체 장애(화면 확대 + 커서 강조 + 음성 명령 안내). UI 라벨 6개 언어 지원, 프로필 아이콘 3종 신규 제작
- **프로필 엔진 확장**: 토글형 설정(stopAni·mediaStop·mediaMute)과 동작형 항목(TTS 포커스 낭독 시작, STT 사용 안내 알림)을 프로필에 묶을 수 있게 적용·해제 대칭 구현
- GitHub Pages 데모 자동 배포 워크플로, 영문 README, 이슈/PR 템플릿, 행동 강령

---

## [2.1.0] - 2026-07-14

### 추가
- **standalone 단일 파일 번들**: `webAccTools.standalone.min.js` — CSS·한국어 로케일·이미지를 인라인하여 파일 1개 복사만으로 폐쇄망에서 동작
- **1줄 설치 지원**: `<script … data-wat-auto>` auto-init, 인라인 config, CSS 자동 주입, 실제 minify 적용
- **배포 zip 패키징**: `npm run package` → `package-build/moduweb-<버전>.zip` (standalone + dist + 설치 가이드 동봉)
- **.env 단일 설정 관리 체계**: 선언적 매핑 테이블 기반 `config.json` 빌드 자동 생성, 비밀키 유입 차단 가드, 값 타입 검증
- **CSS 셀렉터 누수 감사 스크립트** + CI 게이트 (`npm run lint:css`)
- **특성화 테스트 안전망**: 알림·포커스트랩·config 로드 (Phase 0)

### 변경
- **WAT.js 모듈 분해 (Phase 6)**: `IframeStyler`, `Dictionary`(JSONP 보안 개선), `PageStructure`, `TextExtractor`, `PanelBuilder`(개인 옵션 18종 데이터 테이블화), `SettingsApplier`(설정 영속화·프로필 적용 분리), `OverlayManager`(모달 오버레이 정리 일원화) 추출
- 상태·국제화 일원화, 알림 통합, 설정 내보내기/가져오기 추가 (Phase 5)
- Material Icons CDN 의존 제거

### 수정
- 코드 리뷰 발견 사항 전면 수정 — Critical 4건 포함 약 110건
- 접근성 수정 5건 (Phase 1)
- 프로필 설정 토글 스위치 잘림/레이아웃 깨짐 수정

### 제거
- 데드코드 약 1,150줄 — 레거시 TTS 클러스터·미호출 함수·탭 이중화 (Phase 4)

### 문서 (코드-문서 정합성 정정)
- **README API 문서**: 코드에 존재하지 않던 `show()`, `hide()`, `toggle()`, `setLanguage()`, `setTheme()`, `adjustFontSize()`, `toggleHighContrast()`, `toggleColorInvert()` 메서드 문서를 제거하고, 실제 구현 메서드(`changeFontSize`/`changeFontFamily`/`changeColorTheme`/`changeSaturation`/`changeScreenScale`/`changeReadGuide`/`changeTTSSpeed` 등 `change*` 계열, `togglePanel`/`applyProfileSettings`/`resetWatSettings` 등)와 `ttsManager.toggleAutoTTS()`/`toggleFocusTTS()`, `sttManager.toggleVoiceCommand()` 위임 메서드로 교체
- **README 생성자 옵션**: 코드가 읽지 않는 `position`/`theme`/`features` 옵션을 제거하고, 실제 소비 옵션(`configPath`, `language`, `containerID`, `containerTargetSelector`, `containerTargetPosition`, `applySelector`, `excludeSelector`, `styleMode`, `styleCssPath`, `fontFamily`, 비율 옵션들)로 교체
- **README 이벤트**: 실제로 발생하지 않는 `wat:settingsChanged`/`wat:fontSizeChanged`/`wat:stt:stateChanged` 항목 제거 (실제 발생 이벤트는 `wat:initialized` 뿐)
- **ARCHITECTURE.md**: 로케일 목록을 실제 6개(`ko`, `en-US`, `en-GB`, `ja`, `zh`, `de`)로 정정(`en.json` 없음), 존재하지 않는 `assets/js/` 폴더 언급 제거, `config.json` 설명을 실제 구조(`api.dictionary`/`resources.fonts`/`branding`/`settings.ui`)로 정정, `src/` 19개 모듈 레이아웃 섹션 추가(`WAT.js` 약 10,800줄 단일 파일이며 매니저 구조로 분해 진행 중임을 명시)
- **CONTRIBUTING.md**: "빌드 도구 없이 `dist/` 직접 편집" 안내를 실제 워크플로(`src/` 편집 → `npm install`/`npm run build`(Rollup)/`npm test`)로 정정
- **config.example.json**: 코드가 읽지 않는 키(`api.dictionary.retryCount`, `api.dictionary.providers`, `settings.behavior.*`, `settings.accessibility.*`, `settings.ui.autoClose`, `settings.ui.theme`) 제거, `settings.language.supportedLanguages`를 실제 6개 언어로 정정
- **tests/manual/checklist.md**: 전체 테스트 개수 `94` → `84`로 정정

---

## [2.0.1] - 2026-03-16

### 개선
- 빌드 배너·`wat:initialized` 이벤트의 버전 문자열을 `package.json`과 단일화 (Rollup 빌드 시 주입)
- `npm version` 직후 dist가 올바른 버전으로 재생성되도록 스크립트 훅 정리
- `watInit.js`, `dist/watInit.js`, `dist/watInit_ver-manual.js`에서 암묵적 전역 변수(`watOptions`) 선언을 `const`로 수정
- `dist/webAccTools.js`의 `hasOwnProperty` 직접 호출 패턴을 `Object.hasOwn()` / `Object.keys()` 기반으로 교체

### 설정 관리 고도화
- `config.json`, `config.example.json`에 `resources.fonts` 및 `branding` 섹션 추가
- 하드코딩되었던 외부 폰트 URL(Nanum Myeongjo, Noto Serif KR, Material Icons)과 저작권 링크 URL을 `config.json`에서 읽도록 리팩토링
- `_getFallbackConfig()`에 `resources` / `branding` 기본값 추가
- `_applyConfigResources()` 메서드 신규 추가 — config 로드 완료 후 `FONT_FAMILY_OPTIONS` URL을 동적으로 갱신

### 문서
- README에 로컬 개발 환경 설정 가이드 추가 (`config.example.json` → `config.json` 복사 절차 포함)
- README의 `config.json` 예시를 신규 `resources` / `branding` 구조로 업데이트

---

## [2.0.0] - 2025-10

### 추가
- WAT (Web Accessibility Tool) 2.0 초기 릴리즈
- TTS (Text-to-Speech): AutoTTS, FocusTTS, KeyboardTTS 3가지 모드
- STT (Speech-to-Text): 음성 명령어(VoiceCommand) 지원
- 사전 검색 기능 (JSONP 방식, jQuery 의존성 없음)
- 다국어 지원: 한국어, 영어(US/GB), 일본어, 중국어, 독일어
- 색상 조절, 화면 확대, 글꼴 변경, 읽기 지원 등 시각 접근성 기능
- `config.json` 기반 외부 설정 파일 지원
- 중앙집중식 에러 처리 (`ErrorHandler`)
- 옵저버 패턴 기반 상태 관리 (`StateManager`)
- WCAG 2.1 AA / KWCAG 2.1 준수

### 변경
- jQuery 의존성 완전 제거, 순수 Vanilla JavaScript로 전환

---

[Unreleased]: https://github.com/Daegu-Cyber-University/ModuWeb/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/Daegu-Cyber-University/ModuWeb/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/Daegu-Cyber-University/ModuWeb/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/Daegu-Cyber-University/ModuWeb/releases/tag/v2.0.0
