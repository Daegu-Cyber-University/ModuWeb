# webAccTools 전체 코드 리뷰 보고서 (2026-07-07)

- 대상: `src/` 19파일 13,117줄 전체 + `watInit.js` 3종 + `scripts/` + CI 워크플로 + 로케일 6종 + 테스트
- 방법: 병렬 리뷰(WAT.js 5구간 분할 + 모듈별) 후 주요 발견을 본 세션에서 코드 재대조 검증
- 결과: 유효 발견 약 **125건** (Critical 4 / High 22 / Medium 다수 / Low 다수)
- ✅ 표시 = 메인 세션에서 소스 코드 직접 재확인 완료

---

## Critical (호스트 페이지 파괴 / 제어 불능)

### C-1. 컨테이너 생성 실패 시 호스트 페이지 전체 삭제 ✅
- [ContainerManager.js:41](../src/core/ContainerManager.js) + [WAT.js:1901](../src/wat/WAT.js)
- 컨테이너 생성이 실패하면 recovery가 `document.body` 자체를 컨테이너로 반환하고, 이어서 `container.innerHTML = ""`가 실행되어 **페이지 본문 전체가 삭제**된다.
- 시나리오: 통합 사이트가 `containerTargetSelector`에 문법 오류 선택자를 넘기면 `querySelector`가 throw → fallback으로 body 반환 → body가 비워짐. 에러는 WARNING 로그만 남음.
- 수정: recovery에서 body를 반환하지 말고 초기화를 중단(throw 또는 null 반환 후 상위에서 abort). `innerHTML=""` 전에 컨테이너가 플러그인 소유(`wat-` id)인지 검증.

### C-2. "설정 삭제"가 호스트 사이트의 localStorage 전체를 삭제 ✅
- [WAT.js:2787](../src/wat/WAT.js)
- `localStorage.clear(Constants.STORAGE_KEYS.SETTINGS)` — `clear()`는 인자를 무시하는 API이므로 WAT 키만이 아니라 **오리진 전체 스토리지**(호스트의 로그인 토큰, 장바구니 등)가 삭제된다.
- 수정: `localStorage.removeItem(Constants.STORAGE_KEYS.SETTINGS)` (+ CONTAINER 등 WAT 키들 개별 삭제).

### C-3. 자동 읽기(TTS) 정지 후 저절로 재시작 (좀비 재생) ✅
- [AutoTTS.js:256-261](../src/tts/AutoTTS.js)
- `_stopCurrentSpeech()`가 `speechSynthesis.cancel()` 전에 `onend` 콜백을 떼지 않는다. cancel 시 `end` 이벤트를 발생시키는 브라우저(Firefox 등)에서 정지된 발화의 `onend` → `_scheduleAutoAdvance()` → 1초 뒤 첫 요소부터 재생 재개. 매니저 상태는 INACTIVE인데 음성은 계속 나옴. Next/Prev 클릭 시에도 같은 원리로 요소 건너뜀 발생.
- 수정: cancel 전 `this.currentUtterance.onend = null` (BaseTTS.js:122-131은 이미 이렇게 함 — AutoTTS만 누락).

### C-4. 마이크 권한 거부 시 무한 재시도 + 알림 무한 표출 ✅
- [VoiceCommand.js:323-332](../src/stt/VoiceCommand.js)
- `not-allowed`(권한 거부)를 포함한 모든 에러가 동일하게 `_startCooldown()` → 2초 뒤 자동 재시작으로 이어져, 권한 거부 상태에서 **영구 재시도 루프 + 2초마다 알림**이 반복된다. `config.maxRetries`(34행)는 선언만 되고 미사용.
- 수정: `not-allowed`/`audio-capture`는 재시도 없이 완전 정지 + 매니저에 실패 통지. `no-speech`/`network`는 maxRetries까지 백오프 재시도.

---

## High (기능 마비 / XSS / 호스트 페이지 간섭)

### H-1. `togglePanel()` 호출 즉시 크래시 — 존재하지 않는 상수 키 ✅
- [WAT.js:2453-2456](../src/wat/WAT.js) / [constants.js](../src/core/constants.js)
- `Constants.ELEMENT_IDS.SETTINGS_PANEL / OPTIONS_PANEL / SETTINGS_BUTTON`은 ELEMENT_IDS에 없음(실제 키: `PANEL_SET`/`PANEL_OPT`/`BTN_SET`; `SETTINGS_PANEL`은 다른 객체(셀렉터)에 있음). `getElementById(undefined)` → null → `.hidden` 접근에서 TypeError. WAT.js:2480의 `MAIN_WRAPPER`(실제 키 `MAIN_WRAP`)도 동일 유형.
- 같은 유형: `Constants.CSS_CLASSES.UI_SELECTED` 미정의 → `classList.add(undefined)`가 리터럴 `"undefined"` 클래스를 추가, button형 설정 UI 선택 표시 전멸 (WAT.js:6228, 2875) ✅

### H-2. Shift+T/D/S 전역 단축키가 폼 입력을 가로챔 ✅
- [WAT.js:1631-1649](../src/wat/WAT.js) (등록: 4054)
- document 전역 keydown에서 input/textarea/contentEditable 가드 없이 `preventDefault()` — 플러그인이 붙은 모든 페이지에서 대문자 T/D/S 타이핑이 불가능해짐.
- 수정: `e.target.matches('input,textarea,select') || e.target.isContentEditable` 가드 + Alt+Shift 조합 권장.

### H-3. 사전(JSONP) 응답 → innerHTML 주입 XSS ✅
- [WAT.js:7501-7520](../src/wat/WAT.js)
- `item.title/description/pronunciation`을 `innerHTML`로 주입, `item.link`는 스킴 검증 없이 `href` 대입(`javascript:` 허용). JSONP 구조상 서버 신뢰가 전제인데 응답 데이터 무검증까지 겹침.
- 수정: 전부 `textContent`로, link는 `http(s):` 스킴 화이트리스트.

### H-4. 설정 패널 innerHTML 템플릿 XSS (config/로케일 경유)
- [WAT.js:2880-2959](../src/wat/WAT.js) `createSettingsItem`
- `titleText`, `itemLabel`, `item.value`, `item.src`를 이스케이프 없이 문자열 결합 후 innerHTML 주입. config.json의 `fontSizeOptions[].label` 등이 그대로 들어감.
- 수정: `createElementWithAttrs` + `textContent` 조합으로 재작성 (같은 파일에 안전한 유틸이 이미 존재).

### H-5. 자동 스크롤 정지 불능 — 저장 위치 불일치 ✅
- [WAT.js:6915](../src/wat/WAT.js) (시작: `this.scrollInterval`) vs 6929 (정지: `state.get('plugin.scrollInterval')` — 항상 null)
- `stopPageScroll()`이 rAF를 취소하지 못해 자동 스크롤이 멈추지 않고 버튼 상태 복원도 안 됨. cleanup의 legacy 타이머 정리도 같은 키를 읽어 무효.

### H-6. TTS 재생 속도 하드코딩 — 사용자 설정 완전 무시 ✅
- [WAT.js:8224-8227](../src/wat/WAT.js) (동일: 8398, 8666)
- `const ttsSpeed = 2; utterance.rate = ...` — 속도 슬라이더가 쓰는 `plugin.readingSpeed`를 읽는 곳이 코드 전체에 없음. 접근성 도구에서 읽기 속도 설정 무시는 핵심 기능 결함.

### H-7. 페이지 구조 다이얼로그가 `%` 포함 링크에서 전체 실패 ✅
- [WAT.js:8051](../src/wat/WAT.js)
- `decodeURI(link.textContent || ...)` — "50% 할인" 같은 링크 텍스트에서 URIError → `openPageStructure()` 중단, `body.overlay-active` 클래스만 잔존.
- 수정: 링크 텍스트에 decodeURI 적용 자체가 잘못 — href에만, try/catch로.

### H-8. 손상된 localStorage 값이면 생성자부터 사망 ✅
- [WAT.js:70, 99](../src/wat/WAT.js) (같은 패턴: 3819, 6290/6300)
- try/catch 없는 `JSON.parse(localStorage.getItem(...))` — `watSettings`에 비JSON 문자열이 있으면 `new WAT()` 자체가 throw. 같은 키를 2679에서는 try/catch로 파싱(비일관).

### H-9. `setupTabs()`가 호스트 페이지의 ARIA 탭을 하이재킹
- [WAT.js:2336-2337, 2400-2414](../src/wat/WAT.js)
- `document.querySelectorAll('[role="tab"]')` 전역 검색으로 호스트 탭에 리스너를 붙이고 `hidden`/`aria-selected` 강제 변경. 언어 변경마다 재실행되어 리스너 중복 누적(제거 경로 없음).
- 같은 계열: location.hash 무검증 → 호스트 임의 요소에 `display:block` 강제 (WAT.js:2238, 2427-2436), 탭 클릭마다 pushState로 호스트 히스토리 오염 (2233), `closePageStructure`가 호스트의 `.overlay` 요소를 오삭제 (7803, 8135).

### H-10. 프로필 검증 실패 후 프로필 토글 영구 고장
- [WAT.js:3530](../src/wat/WAT.js) → 3598-3599
- 실패 경로에서 `profileToggle.textContent = ...`가 내부 `.watSet-button-label` span을 파괴 → 다음 토글 클릭 시 `querySelector` null → TypeError.

### H-11. cleanup이 TTS 하이라이트 래퍼째 삭제 — 호스트 본문 텍스트 소실
- [WAT.js:10317](../src/wat/WAT.js)
- `.wat-tts_wrapper`를 unwrap 없이 `el.remove()` — 드래그 읽기 중 cleanup되면 감싸진 원본 텍스트가 페이지에서 영구 삭제. 올바른 unwrap 로직(`_cleanupTTSHighlight`, 9005)이 같은 파일에 있음.

### H-12. cleanup이 ttsManager를 정리하지 않음 — 파괴 후에도 읽기 동작
- [FocusTTS.js:25-26](../src/tts/FocusTTS.js) + WAT.js cleanup(679-683)
- FocusTTS의 document 레벨 dblclick/mouseup 리스너가 WAT의 추적 레지스트리를 우회해 직접 등록되고 cleanup에서 해제되지 않음 → 플러그인 파괴 후에도 드래그하면 발화 + 전체 객체 그래프 GC 불가.

### H-13. 포커스 TTS 이중 발화 — 신·구 두 경로가 같은 이벤트 처리
- [WAT.js:1696-1706](../src/wat/WAT.js) (레거시) + [FocusTTS.js:50-65](../src/tts/FocusTTS.js) (신규)
- mouseup 한 번에 레거시 `tts_draggableText()`와 FocusTTS 핸들러가 모두 발화·상호 cancel — 서로 다른 하이라이트 래퍼가 중첩 생성되고 각자 자기 것만 정리해 DOM 잔여물 발생.

### H-14. Chrome 장문 TTS ~15초 무음 정지 미대응
- [BaseTTS.js:116](../src/tts/BaseTTS.js), [AutoTTS.js:220](../src/tts/AutoTTS.js)
- 청킹/resume 킵얼라이브 없이 단일 utterance로 발화 — Chrome 원격 음성에서 긴 본문 읽기가 15초쯤 멈추고 `onend` 미발생으로 자동 진행 체인 사망.

### H-15. iframe 로드 판정이 항상 false — 스타일 영구 미적용
- [WAT.js:10177](../src/wat/WAT.js)
- `iframe.complete || iframe.readyState === 'complete'` — HTMLIFrameElement에 없는 속성. 이미 로드된 iframe은 load 재발화가 없어 영원히 처리 안 됨. 올바른 검사: `iframe.contentDocument?.readyState === 'complete'`.

### H-16. 옵션 값 하나가 null이면 전체 설정이 조용히 fallback으로 초기화
- [OptionsProcessor.js:23](../src/core/OptionsProcessor.js) + [ConfigurationManager.js:73-79](../src/core/ConfigurationManager.js)
- `typeof null === 'object'` → `null.ratio` TypeError → safeExecute recovery가 컨테이너·스타일·언어(ko 고정) 전부 하드코딩 기본값으로 대체. 옵션 하나의 오류가 전 설정 소실로 증폭.

### H-17. 동적 스타일 마킹의 셀렉터 조립이 무방비 — config 오타 하나로 기능군 전멸
- [WAT.js:4762-4798](../src/wat/WAT.js)
- config의 `excludeSelector`·`container.id`를 이스케이프 없이 `:not()` 문자열에 연결, try/catch 없음 → SyntaxError로 폰트/자간/줄간격/정렬 동적 적용 전체 비활성화.

### H-18. 로케일 미존재 키 21개 — "null"이 읽히고 표시됨
- 코드가 조회하는 키 중 21개가 6개 언어 파일 어디에도 없음 (`getLocalizedText`는 null 반환):
  - `tts.*` 13개 (`tts.image.label` 등) → TTS가 **"null "을 발화**
  - `panel.tts.start/stop/focusStop/focusStart` 4개 → 한국어 하드코딩 폴백이 모든 언어에 노출
  - `dictionary.pronunciation` → 화면에 "null:" 렌더링, `msg.warning.profileNotFound`, `msg.error.general`, `msg.info.dictionaryNotFound`
- en-GB는 `text.emphasize` 키를 `text.emphasise`로 개명해 조회 실패 (키는 유지, 값만 철자 변경해야 함).
- 로케일 로드 실패 시 모든 버튼 `aria-label="null"` (WAT.js:1749-1751 null 반환 + 호출부 무가드).

### H-19. 배포 스크립트/CI 결함
- **watInit.js 3종 불일치**: 루트판은 `./accTest/config.json` 하드코딩 + 디버그 로그 잔재 — dist판과 파일명이 같아 배포 뒤섞임 시 config 로드가 조용히 실패 ([watInit.js:4](../watInit.js) vs [dist/watInit.js:4](../dist/watInit.js))
- **release.yml awk 버그**: 릴리스 노트 추출 범위가 헤더 1줄로 붕괴해 **모든 릴리스 본문이 빈 문자열** (.github/workflows/release.yml:77-79, 로컬 재현 확인됨)
- **release.yml 스크립트 주입**: 태그명이 `${{ }}`로 셸에 직접 삽입 (CWE-78) — `env:` 경유로 수정 필요 (75, 93-103행)
- **CI가 테스트·빌드를 안 돌림**: `node --check dist/*`만 수행 — src 수정 후 dist 재빌드를 잊어도 어떤 게이트에도 안 걸림. jest 스위트가 있는데 CI 미실행.

---

## Medium (28건 요약 — 주제별)

**상태 불일치 / 이원화**
- 화면 배율이 `this.currentScreenScale`(마스크 모드가 읽는 state와 별개)에만 갱신 → 배율 변경 후 읽기 가이드 마스크 좌표 어긋남 (WAT.js:5665 vs 5765)
- 마스크에 역방향 대신 정방향 scale 적용 — zoom과 중첩되어 2.25배 (WAT.js:5826)
- `changeColorTheme`/`changeSaturation`만 iframe 동기화 누락 (WAT.js:6117, 6140)
- StateManager 알림이 정확 일치 경로만 — 부모 경로 set 시 자식 구독자 우회, `update()` API 사실상 사용 불가 (StateManager.js:65, 108)
- STTManager: 미지원 브라우저에서 UI는 "실행 중"으로 전이 (STTManager.js:55), `_stopAllSTT()`가 상태/UI 미갱신 (83)
- VoiceCommand: stop 후 보류 결과로 명령 실행(`abort()` 미사용, 290), 타임아웃이 인식을 실제로 안 멈춤 (183), 명령 매칭이 배열순·부분문자열 (430), `input[type=submit]`은 매칭되나 클릭 안 됨 (443)
- 자동 스크롤 자연 종료 시 `aria-pressed` 미복원 → 재시작에 2클릭 (WAT.js:6845)

**원상복구 실패 (접근성 도구가 페이지를 훼손)**
- 스타일 리셋이 `removeProperty`로 원본 인라인 스타일까지 삭제 — `_originalStyleMap`을 저장만 하고 복원에 안 씀 (WAT.js:5380 외)
- `range.extractContents()` 폴백이 선택 경계 요소를 분할 — 하이라이트 해제 후에도 분할 잔존, 리스너 소실 (BaseTTS.js:48, WAT.js:8599)
- `toggleDisplayContents` 복원 시 `.displayNone`이던 요소도 일괄 `.blind` 부여 (WAT.js:6643)
- 포커스 TTS 중 비버튼 클릭 시 호스트 요소에 tabIndex=0 영구 부여 (WAT.js:1553)
- 이미지 텍스트 변환 중복 호출 시 placeholder 누적, 해제 시 1개만 제거 (WAT.js:6571)

**경합 / 비동기**
- 스타일 배치 큐(rAF 분할 처리)와 즉시 리셋의 경합 — 리셋 후 큐 잔량이 폰트를 되적용 (WAT.js:5569)
- config 로드 타임아웃 후 늦은 응답이 `_config`를 사용 도중 교체 (WAT.js:7052) — 대기 함수도 2벌(3초/5초)
- FocusTTS 100ms 지연 콜백이 disable 후에도 발화 (FocusTTS.js:59), `utterance.ended`는 존재하지 않는 속성 (72)
- VoiceCommand start/stop 경합 — onstart가 INACTIVE를 덮어써 UI 꺼짐+마이크 청취 (VoiceCommand.js:65, 269)
- AutoTTS utterance에 onerror 없음 — Chrome interrupted/error 시 자동 진행 영구 정지 (AutoTTS.js:210)

**메모리 / 리스너**
- `beforeunload`/`pagehide`를 document에 등록(window 이벤트) — 자동 cleanup 영원히 미실행 (WAT.js:501, 1341)
- tts_updateHighlight가 호출마다 keydown 리스너 누적 — Enter 한 번에 click 다중 실행 (WAT.js:8264)
- `_createObserver` 같은 타입 재생성 시 이전 옵저버 disconnect 없이 유실 (WAT.js:4613)
- showNotification 등 raw setTimeout + removeChild — 선제거 시 NotFoundError, destroy 후 발화 (WAT.js:10272, 8339)

**성능**
- body 전역 MutationObserver가 사실상 매 변경마다 전체 캐시 무효화 + 노드당 4회 querySelectorAll (WAT.js:1131)
- `markDynamicStyledElements`: 전 요소 × (textContent 서브트리 문자열화 + getComputedStyle 다회) — 대형 페이지 초기화 수백 ms~수 초 블로킹 (WAT.js:4798, iframe판 9761도 동일+가드 누락 divergence)
- 페이지 구조/TTS 추출: 요소마다 조상 전체 getComputedStyle — 링크 1,000개 × 깊이 15 = 15,000회 (WAT.js:7966, 8020)
- 읽기 가이드 mousemove 무스로틀 + 매 이벤트 querySelector (WAT.js:6416)

**보안(주의 수준)**
- config URL(폰트/CSS/copyrightUrl)을 스킴 검증 없이 link/href 주입 + static 객체 변이로 인스턴스 간 전파 (constants.js:90, WAT.js:1897, 2002, 5620, 7178)
- config 딥머지에 `__proto__` 가드 없음 (WAT.js:7082), StateManager.set도 `__proto__` 경로 오염 가능 (StateManager.js:53)
- `sessionStorage` 무가드 접근 — 쿠키 차단/샌드박스 iframe에서 debugLog 경유 정상 경로 사망 (ErrorHandler.js:200)
- ErrorHandler: 존재하지 않는 `handleError` 호출로 config 실패 중앙 처리 데드 코드 (WAT.js:7011), 기본 카테고리 `CATEGORIES.ERROR` 미정의 (ErrorHandler.js:67)
- dcu_watManualInit 재호출 가드 없음 — 인스턴스/리스너 누적 (dist/watInit_ver-manual.js:5)
- 상대 configPath가 문서 URL 기준 해석 — 하위 페이지에서 조용한 404 (dist/watInit.js:4)

**기타 논리 오류**
- `getConfigValue('ui.modalWidth')` 경로가 실제 구조(`settings.ui.*`)와 불일치 — config 값 상시 무시 (WAT.js:7485)
- 폰트 라디오 `checked` 로직이 enabled와 혼동 — 마지막 폰트가 기본 선택 (WAT.js:3175)
- 프로필 적용 1회에 설정 재적용 2~3회 + savePreferences 10회+ (WAT.js:3569, 3994)
- `Defaults.PROFILES` 정적 객체를 UI 상태로 직접 변이 (WAT.js:3545)
- alt 폴백 `||` 결합으로 title 분기 데드 코드 + `alt=""` 장식 이미지도 "설명 없음" 변환, placeholder에 innerHTML 주입 (WAT.js:6690, 6716, 6590)
- label for/id 불일치 (WAT.js:2922), `toggleAttribute(name,'false')` 오용 (2462), `'filedset'` 오타 요소 (2513), null 가드 순서 오류 (3049), 빈 프로필에서 `[0]` 접근 크래시 (3517)

## Low (요약)

- 선택자 캐시 키 충돌(`.a .b` vs `.a>.b` 동일 키) (WAT.js:1094)
- SVG 포커스 시 `className.includes` TypeError — 포커스 TTS 불능 (WAT.js:1613)
- ES 모듈 로드 시 `document.currentScript` null → basePath 소실 → 에셋 404 연쇄 (WAT.js:21)
- `__MODUWEB_VERSION_JSON__` 비번들 환경 ReferenceError → `wat:initialized` 미발생 (WAT.js:540, rollup.config.js:112)
- 빈 테이블 TTS "테이블 NaN" (WAT.js:9426), 라디오 0개 시 NaN 인덱스 (4462)
- `label[for="${id}"]` CSS.escape 부재, aria-labelledby 다중 ID 미지원 (WAT.js:9453, 9471)
- cleanup 직후 `_setTimeout` 재등록으로 정리 상태 오염 (WAT.js:696)
- `_eventListeners`가 강참조 Map — detached 노드 누적 (WAT.js:1284)
- utterance lang/voice 미지정 (BaseTTS.js:105), AutoTTS stop이 elements 미해제 (AutoTTS.js:28)
- STT 옵션(interimResults 등) 하드코딩으로 무시 (VoiceCommand.js:261), 상태 레이어 aria-live 부재 + UI 문구 한국어 하드코딩 (76)
- rem 환산 기준 오류 (WAT.js:4791), loadStyleCss 로딩 중에도 성공 resolve (5030)
- `.min.js`가 실제로는 minify 안 됨 (rollup.config.js:139)
- .env 파서 인라인 주석 미제거 (scripts/write-config-from-env.mjs:18)
- release.yml 서드파티 액션 태그 미고정 (softprops/action-gh-release@v2)
- `patterns.properNoun/particles`가 6개 언어 모두 한국어 정규식 그대로 (의도 확인 필요)
- StateManager `get(path, default)` 두 번째 인자 무시 (StateManager.js:43), 경로 중간 원시값 TypeError (57)
- 죽은 코드: validation.js 전체, `setTTSListeners`/`setPageScrollListeners`, `resetProfileSettings`(키 불일치), `createSettingsItem`의 controlsHtml, StyleBatchProcessor 미사용 메서드 4종, ErrorHandler RECOVERY_STRATEGIES(no-op)

---

## 테스트 커버리지

- 커버: core 8파일 + StateManager (10/19 파일) — 그러나 줄 수 기준 **~88%가 미테스트**
- 미커버: **WAT.js(10,589줄) 전체**, tts/ 5파일, stt/ 2파일
- 시급 순위: ① 로케일 키 존재 스냅샷 테스트(H-18 계열 회귀 전부 차단, 비용 최소) ② VoiceCommand 명령 파싱(순수 함수에 가까움) ③ TTSManager/AutoTTS 상태 전환
- CI에서 `npm test` + `npm run build` + dist 최신성 검사 추가 필요 (H-19)

## 구조 개선 방향 (요약)

1. **WAT.js(10,589줄) 분해** — 이미 존재하는 매니저 구조(core/tts/stt)로의 마이그레이션을 완료할 것. 현재 신·구 시스템이 병존하는 곳마다 버그가 남: TTS 경로 2벌(H-13), 탭 시스템 2벌(H-9), 상태 저장소 2벌(scrollInterval H-5, screenScale), config 대기 함수 2벌.
2. **자원 추적 래퍼 강제** — `_setTimeout`/`_addGlobalEventListener`/`_registerObserver` 인프라가 이미 있으나 raw API 사용처가 십수 곳. ESLint `no-restricted-properties`로 빌드에서 차단 권장.
3. **DOM 주입 정책** — "외부/페이지 유래 문자열은 textContent, 마크업은 createElement 조합"으로 통일하면 XSS 계열(H-3, H-4, Medium 다수)이 구조적으로 소멸.
4. **`change*` 계열 테이블 주도 통합** — 동일 골격 복붙에서 iframe sync 누락 등 divergence 발생. `{key, datasetAttr, applyFn}` 테이블 + 공통 `applySetting()`으로.
5. **에러 처리 정직화** — ErrorHandler의 recovery가 "성공"을 가장해 설정 전체 소실을 숨김(H-16, C-1). 복구 불가능한 실패는 실패로 전파할 것.
