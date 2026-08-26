# Changelog

모든 주요 변경 사항은 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
[유의적 버전](https://semver.org/lang/ko/)을 준수합니다.

---

## [Unreleased]

### 수정
- **'창 축소'가 시각적으로 거의 동작하지 않던 문제**: 높이 축소 규칙이 주석 처리된 채 남아 축소해도 제목·탭만 사라지고 본문이 전체 높이로 그대로 보였다. 축소 상태를 200×52px 헤더 바로 정의 — 본문·푸터를 `display:none`으로 접어 보이지 않는 컨트롤 93개가 탭 순서에 남던 문제(WCAG 2.4.3)와 축소 상태에서 마지막 항목이 푸터에 가려진 채 탭 되던 문제를 함께 해소. 또한 `restoreMinimizeState()`가 정의만 있고 호출되지 않아 저장된 축소 상태가 재방문 시 복원되지 않던 것을 init에 연결해 수정. (참고: 축소 시 폭이 500px로 남는다는 기존 관찰은 비표시 탭에서 트랜지션이 진행되지 않는 측정 환경 문제였고, 화면 표시 중에는 정상적으로 200px로 전환됨을 확인)
- **모달에서 키보드 포커스가 보이지 않는 곳으로 빠지던 문제**: 페이지 구조·사전 검색 다이얼로그를 열면 초기 포커스가 레이어 자신(tabindex=-1)에 있는데, 포커스 트랩이 첫/마지막 요소에서만 개입해 이 상태에서 Shift+Tab 한 번에 포커스가 오버레이 뒤 콘텐츠로 이탈했다. 한 번 나가면 트랩 리스너(레이어 keydown)가 더는 개입하지 못해 가려진 페이지를 계속 탐색하게 되는 문제. 목록 밖 포커스도 경계로 순환시키고, CSS로 숨긴 요소를 순환 경계에서 제외하며, 문서 수준 focusin 안전망(모달 밖으로 나간 포커스 즉시 복귀, teardown 시 해제)을 추가
- **applySelector 대상에 `undefined` 클래스가 붙던 문제**: `Constants.CSS_CLASSES`에 `APPLY` 키가 없어 `classList.add(undefined)`로 문자열 "undefined"가 부여되고 `.wat-apply` 스타일 경로가 무력화됐다. `APPLY`/`EXCLUDE` 상수를 정의하고 제외 클래스도 하드코딩 대신 상수를 쓰도록 정리

---

## [2.3.4] - 2026-08-10

### 수정
- **조작 대상 크기를 WCAG 2.2 기준(24×24)으로 통일**: 프로필 옵션 열기 버튼(24×19), 환경설정 라디오 항목(20×13), 아이콘 모드 선택 라벨(높이 15px)이 새 기준에 못 미쳤다. 최소 크기를 확보해 개인 설정·환경설정을 아이콘/목차 보기 양쪽에서 모두 충족하도록 수정. 두 보기 모드의 조작 요소 166개를 브라우저에서 실측해 미달 0건 확인

---

## [2.3.3] - 2026-08-10

### 수정
- **패널을 끝까지 스크롤해도 마지막 항목이 푸터에 가려지던 문제**: 본문 영역이 `height:100%`로 헤더 높이를 고려하지 않아 패널 아래로 밀리고, 푸터가 `position:absolute`로 그 위를 덮고 있었다. 헤더·본문·푸터를 flex 흐름으로 정리해 본문이 남은 높이만 차지하도록 수정 — 고정 `calc()` 높이 6곳도 함께 제거. 환경설정·개별 설정 × 아이콘·목차 보기 × 최소화 상태를 여러 창 크기에서 확인

---

## [2.3.2] - 2026-08-10

### 제거
- **저장 설정의 '저장 확인' 버튼**: 개발 중 저장 여부를 확인하려고 두었던 버튼으로, 최종 사용자에게는 불필요해 제거했다. 전용 로케일 키(`storage.options.check`, `msg.state`, `msg.info.storageCheck`)도 6개 언어에서 함께 정리

---

## [2.3.1] - 2026-08-10

### 수정
- **프로필 항목 테두리가 여전히 깨져 보이던 문제**: 2.3.0에서 테두리를 `box-shadow` 링으로 바꿨으나, 제목바(`legend`)의 배경이 링 위를 덮어 아래쪽 일부만 보였다. 링 대신 `legend`에 `float`를 주어 rendered legend에서 제외시키는 방식으로 교체 — 테두리 4면이 정상으로 그려진다 (닫힘·펼침 모두 확인)

---

## [2.3.0] - 2026-08-10

### 추가
- **낭독 음성 선택**: 환경설정에서 화면 낭독에 사용할 음성을 고를 수 있습니다. 현재 언어 음성을 먼저 묶어 보여주고, 선택한 음성은 저장되어 다음 방문에 복원됩니다. 음성을 지원하지 않는 브라우저에서는 항목이 표시되지 않으며, 저장된 음성이 없는 기기에서는 브라우저 기본 음성으로 자동 대체됩니다 (6개 언어 라벨)

### 수정
- **프로필 항목 테두리가 깨져 보이던 문제**: 제목바(`legend`)가 폭 전체를 차지해 HTML 명세의 rendered legend 동작에 따라 `fieldset` 위쪽 테두리가 통째로 지워지고 있었다. 테두리를 `box-shadow` 링으로 그려 제목바 영향을 받지 않게 수정
- 프로필 옵션을 펼쳤을 때 컨테이너 밖으로 번지던 진한 그림자를 제목바 구분선으로 교체

### 변경
- 낭독 언어 코드 변환 로직을 TTSManager로 통합 (AutoTTS·BaseTTS 중복 제거)

---

## [2.2.0] - 2026-08-04

### 수정
- **어둡게(dark) 테마에서 텍스트가 보이지 않던 문제**: 배경만 `#333`으로 강제하고 글자색을 지정하지 않아, 원래 어두웠던 텍스트가 같은 색 배경에 묻혔다(호스트 페이지 폼 라벨은 대비 1.00으로 완전 불가시). 전경색 규칙을 추가하고 링크·아이콘 글리프·폼 컨트롤 예외를 분리했다. 자동 측정 기준 패널 46/48 → 0/41, 호스트 16/21 → 0/21 실패
- **`pre`/`code` 본문이 잘려 보이던 문제**: 인라인 요소에 강제된 배경 상자가 줄마다 윗줄 글자를 덮었다. 인라인 요소 배경을 투명 처리해 해소
- **CI dist 드리프트 게이트 상시 실패**: Windows(CRLF)에서 빌드하면 인라인되는 CSS·`ko.json`이 LF 체크아웃 환경과 1400곳 달라졌다. 텍스트 자산을 LF로 정규화해 빌드 산출물을 플랫폼 독립적으로 변경
- `check-css-selectors.mjs`가 `:is()`·`[attr="a,b"]` 내부 쉼표를 셀렉터 구분자로 잘못 인식하던 문제
- **CSS 셀렉터·경로 불일치로 죽어 있던 스타일 복구**: `data-wat-(color-theme|read-guide|screen-scale)` 셀렉터 19곳이 JS가 세팅하는 속성명과 달라 TTS 하이라이트·사전 알림의 테마 대응이 미적용되던 문제. iframe CSS 주입도 상수 경로 오기로 항상 건너뛰어지고 있었다. 회귀 방지 테스트 추가
- **프로필 해제 비대칭**: 저시력 프로필 해제 시 자간이 복원되지 않고, 프로필이 건드리지 않은 설정(이미지 변환·애니메이션 정지)을 강제 해제하던 문제
- **언어 설정 유실**: 저장된 언어가 dataset에 복원되지 않아 다른 설정을 저장하면 언어가 기본값으로 덮어써지던 문제
- **포커스 트랩 결함**: 모달 내용이 바뀌어도 설치 시점 요소만 순환하고 disabled 요소를 경계로 잡던 문제 — keydown 시 재조회로 전환
- **TTS 알림이 화면 높이만큼 늘어나던 문제**: 중복 정의된 CSS의 top/bottom 충돌. 알림 스타일을 CSS 단일 출처로 정리하고 무시되던 등장 애니메이션 복구
- **프로필 토글 ARIA**: `role=switch` 상태를 `aria-checked`로 전달(기존 `aria-pressed`는 스크린리더에 미전달), 접근명이 전부 "꺼짐"으로 낭독되던 `aria-labelledby` 오지정 수정, 옵션 아코디언을 disclosure 패턴(`aria-expanded`+`aria-controls`)으로 정정

### 변경
- **밝게(light) 테마**: 전역 `brightness(1.3)` 필터(글자까지 밝아져 대비가 오히려 하락)를 어둡게 테마와 대칭인 고대비 라이트 팔레트로 교체
- **반전(reverse) 테마**: 이미지·영상 등 미디어와 위젯 UI를 재반전해 원본 색 유지
- **다크/밝게 평탄화의 위젯 자기 보호**: `.wat-exclude` 트리를 평탄화에서 제외해 위젯 패널·읽기 가이드·알림이 테마에 침식되지 않도록 변경. 호스트 페이지용 제외 탈출구 `.designWrap`은 하위 트리까지 확장
- **단축키 변경**: `Shift+T/D/S` → `Alt+Shift+T/D/S` (WCAG 2.1.4 문자 키 단축키 해소). `settings.ui.keyboardShortcuts: false`로 비활성화 가능
- **알림 낭독을 상주 라이브 리전 방식으로 전환**: 리전을 텍스트와 함께 삽입하면 일부 스크린리더가 첫 알림을 놓치는 문제 대응
- 다크 테마 서브 배경 `#666` → `#4a4a4a` (서브 텍스트와 3.6:1 → 5.5:1)

### 추가
- **패널에서 어둡게 테마 선택 활성화**: 비활성 사유였던 다크모드 결함이 모두 수정되어 색상 모드 라디오에서 선택 가능
- **OS 접근성 설정 자동 반영**: 첫 방문 시 OS 다크 모드·모션 감소 설정을 초기값으로 적용 (`settings.ui.respectOsPreferences: false`로 해제)
- **브라우저 언어 자동 감지**: 저장된 언어가 없으면 브라우저 언어를 지원 목록에 매칭해 초기 언어로 사용 (`language.autoDetect: false`로 해제)
- **색약 보정 필터 2종**: 채도 옵션에 적색약·녹색약 보정 추가 — SVG 색행렬 기반, 흰색·회색은 보존하고 문제 색상만 이동
- **페이지 구조 탐색에 랜드마크 탭**: main/nav/aside 등 영역 목록과 위치 이동 (섹셔닝 내부 header/footer, 이름 없는 region은 규격대로 제외). 역할명은 6개 언어의 자연어("본문"·"내비게이션" 등)로 표기
- **색약 보정 필터 데모 페이지**: 색상 표본·상태 표시·차트 범례로 보정 전후를 비교하는 `examples/color-filter.html`
- **장애 유형 프로필 4종 추가** (기존 3종 → 7종): 시각 장애(이미지 대체텍스트 + 포커스 낭독 자동 시작), 고령자(글자·행간·자간 확대 + 커서 강조), 움직임 민감(애니메이션·미디어 정지 + 채도 완화 — 광과민성 발작·전정 장애 대응), 신체 장애(화면 확대 + 커서 강조 + 음성 명령 안내). UI 라벨 6개 언어 지원, 프로필 아이콘 3종 신규 제작
- **프로필 엔진 확장**: 토글형 설정(stopAni·mediaStop·mediaMute)과 동작형 항목(TTS 포커스 낭독 시작, STT 사용 안내 알림)을 프로필에 묶을 수 있게 적용·해제 대칭 구현
- **패널 접근성 보강**: Escape로 패널 닫기(+포커스 복원), 아이콘 모드 라디오 키보드·스크린리더 접근 복원(화살표 이동, "N개 중 X" 낭독), `:focus-visible` 포커스 링, 터치 대상 24px 이상 확대, `prefers-reduced-motion` 존중, aside 랜드마크 이름
- **좁은 화면 대응**: 패널 폭 뷰포트 맞춤(밀어내기 대신 덮기), 아이콘 그리드 2열, `100dvh` 폴백
- **데모 페이지 SEO**: 전 페이지 meta description·canonical·og/twitter 태그, robots.txt·sitemap.xml, Pages 루트를 리다이렉트 대신 실제 랜딩 페이지로 교체
- GitHub Pages 데모 자동 배포 워크플로, 영문 README, 이슈/PR 템플릿, 행동 강령

### 제거
- 호출자 없는 유틸·상수·CSS 규칙 정리 (약 600줄), 복붙 중복 통합(동적 스타일 4종·설정 적용 3중 복제·라디오 동기화 3중 사본)

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
