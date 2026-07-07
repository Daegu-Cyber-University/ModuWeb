# Changelog

모든 주요 변경 사항은 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
[유의적 버전](https://semver.org/lang/ko/)을 준수합니다.

---

## [Unreleased]

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

[Unreleased]: https://github.com/Daegu-Cyber-University/ModuWeb/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/Daegu-Cyber-University/ModuWeb/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/Daegu-Cyber-University/ModuWeb/releases/tag/v2.0.0
