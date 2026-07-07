# webAccTools 종합 코드 리뷰 & 개선 계획 (2026-07-07)

- 기준 커밋: `0c2f99f` (버그 수정 110건 반영 후)
- 관점: 보안 · 접근성 · 안정성/성능 · 유지보수성 · 사용성
- 방식: 관점별 병렬 감사 후 핵심 발견을 코드로 재대조 검증
- 이전 버그 리뷰: [code-review-2026-07-07.md](code-review-2026-07-07.md)

> 이번 리뷰는 "버그"보다 **구조·품질·사용자 경험**에 초점을 둔다. 개별 결함 뒤에 공통 근본 원인(신·구 시스템 병존, 산발적 상태 관리, 문서-코드 불일치)이 반복해서 나타난다.

---

## 0. 총평 — 5개 관점을 관통하는 3가지 근본 원인

| 근본 원인 | 어디서 나타나는가 | 파생 결함 |
|---|---|---|
| **A. 신·구 시스템 병존** | 탭 2벌, 레거시 TTS 890줄, 상태 이원화(currentScreenScale), 데드코드 12+ | 유지보수 혼란, 회귀 위험, 번들 비대 |
| **B. 상태→UI/ARIA 동기화가 산발적** | aria-checked 미갱신, 알림 aria-live 부재, 프로필 미복원, 저장 피드백 없음 | 접근성 Critical 2건, 사용성 High 3건 |
| **C. 문서·설정·코드가 각자 진실을 주장** | README API 8종 미존재, config.example 미사용 키, 언어 목록 3중화 | 개발자 설치 실패, 국제화 결함 |

→ 개별 패치보다 **이 3가지를 구조적으로 푸는 것**이 ROI가 높다. 로드맵(§7)은 이 순서를 따른다.

---

## 1. 보안

지난 커밋으로 XSS 다수·URL 스킴 검증·프로토타입 오염·CI 주입은 실제로 수정됨(재검증 완료). 남은 것:

### S-1 [High] 사전(JSONP) `serverEndpoint` 스킴 미검증 — 임의 JS 실행 벡터
- `WAT.js`의 `_fetchJSONP` — 응답이 `<script src>`로 **호스트 페이지 컨텍스트에서 실행**됨. `isSafeHttpUrl` 유틸이 폰트·링크엔 적용됐으나 정작 script src가 되는 endpoint엔 미적용.
- 사전 서버 침해·평문 http MITM 시 호스트 세션 탈취. `displayDictionResult`를 textContent로 고쳐도 실행 벡터는 파싱 이전(script 태그)이라 무력.
- **조치**: `fetch()`+CORS+JSON 전환. 전환 전 최소 방어로 endpoint에 `isSafeHttpUrl`(https 전용) 강제.

### S-2 [Medium] "저장소 확인" 버튼이 호스트 오리진 localStorage 전체를 콘솔·alert로 덤프
- `WAT.js:2863-2896` — reset은 WAT 키만 지우도록 고쳐졌으나 check 경로는 여전히 `Object.keys(localStorage)` 전체 순회. 호스트의 로그인 토큰 등이 콘솔에 노출. `WAT_DEBUG_ENABLED` 가드도 없음.
- 최종 사용자 노출 UI라 화면공유·원격지원 상황에서 유출. **조치**: `Constants.STORAGE_KEYS`만 순회.

### S-3 [Low] 페이지 구조 마커 버튼의 innerHTML alt 미이스케이프 (`WAT.js:8176, 8243`) — 출처는 로케일(개발자 제어)이라 실위험 낮으나 정책 일관성 위반. createElement로 교체.

### S-4 [Low] devDependency 취약점 5건(ws/picomatch/js-yaml 등) — **전부 devDep**, 배포물 미포함. `npm audit fix` + CI audit 게이트.

---

## 2. 접근성 (도구 자체의 WCAG 2.1 AA)

> 접근성 도구가 스스로 접근 불가능한 것은 가장 심각한 유형. 커밋 0c2f99f 이후에도 남은 것:

### AC-1 [Critical] `role="switch"`의 `aria-checked`가 토글 시 갱신 안 됨 — WCAG 4.1.2 ✅검증
- 생성 시 리터럴 1곳(`WAT.js:3000`)만 있고, 변경 핸들러 `_handleCheckboxChange`는 텍스트·data속성만 갱신. **코드 전체에 `setAttribute('aria-checked')` 0건**.
- 이미지→텍스트 변환, 미디어 정지, 사전 등 모든 스위치가 시각적으로 켜져도 스크린리더엔 영구 "off". 시각장애 사용자가 자기가 켠 기능을 확인 불가.

### AC-2 [Critical] 주 알림 경로(`showNotification`/`showEndNotification`)에 라이브 리전 없음 — WCAG 4.1.3 ✅검증
- `WAT.js:10513` — `div.wat-notification`에 `textContent`만, `role`/`aria-live` 없음. TTS 종료·영역 끝·설정 피드백·음성명령 알림 20여 곳이 이 채널.
- (참고: 사전 알림·음성상태창은 이미 role 보유 — 정작 가장 많이 쓰는 경로만 누락)

### AC-3 [High] 언어 변경 시 `<html lang>` 미갱신 — WCAG 3.1.2 ✅검증
- `utterance.lang`만 갱신, `documentElement.lang` 대입 0건. 영어 UI로 바꿔도 스크린리더가 한국어 엔진으로 영어 라벨을 읽어 발음 붕괴.

### AC-4 [High] 개인설정 라디오 그룹에 fieldset/legend·radiogroup 없음 — WCAG 1.3.1
- `.setWrap>.setTitle(role=button)+ul` 구조. 환경설정 탭은 fieldset을 쓰는데 개인설정만 비일관. 그룹 경계·그룹명이 프로그램적으로 노출 안 됨.

### AC-5 [High] `.setTitle`이 `role="button"`인데 tabindex·키핸들러 없음 — WCAG 2.1.1
- 마우스로만 동작하는 "다음 옵션 순환" 기능. 스크린리더는 "버튼"으로 안내하나 키보드로 활성화 불가(역할 약속 위반).

### AC-6 [High] 고대비 테마의 `:root` filter가 fixed 패널을 깨뜨리고 도구 UI까지 반전 — WCAG 1.4.10
- `css:27-47` `filter: invert(1)` 등을 html에 걸면 하위 `position:fixed`(WAT 패널·열기 버튼)의 컨테이닝 블록이 바뀌어 스크롤 시 어긋남. 도구 UI 자체도 반전됨. 저시력 핵심 기능이 켜는 순간 오히려 깨짐.

### AC-7 [High] VoiceCommand 상태창·알림 전부 한국어 하드코딩 — WCAG 3.1.2
- `VoiceCommand.js`의 상태 텍스트·피드백 20여 곳이 `getLocalizedText` 우회. 음성명령은 시각장애 대상 기능이라 영향 큼.

### AC-8~9 [Medium] 색상 대비 미달 — WCAG 1.4.3 / 1.4.11
- 알림 warning `#ff9800`=2.16:1, error `#f44336`=3.68:1, 음성상태 processing `#FFC107`=1.63:1 (4.5:1 미달). 스위치 off 트랙 `#ccc` vs 흰 배경=1.61:1 (3:1 미달).

### AC-10~12 [Medium] 슬라이더 outline 제거(2.4.7), 사전 모달 aria-modal·배경 inert 부재(4.1.2), 패널 열기/닫기 시 포커스 이동·복원 없음(2.4.3)

### AC-13~16 [Low] reduced-motion 부분 적용, 소형 터치 타깃(스위치 40×20), **`data-color-theme` vs `data-wat-color-theme` 접두 불일치로 고대비 보정 규칙 사문화(AC-15)**, screen-scale CSS 주석 처리로 확대 무동작 가능성(AC-16) — 뒤 둘은 안정성 팀 발견과 교차, 확인 필요

---

## 3. 안정성 / 성능

지난 Critical/High는 소스 대조 결과 실제 수정 확인. 심각한 신규 크래시 없음. 남은 것은 낭비·누수·죽은 코드:

### P-1 [Medium] 프로필 1회 적용에 `savePreferences` 약 18회 폭주 + 시각 설정 2~3회 재적용
- `applyProfileSettings`(`WAT.js:3563`) 체인: change*9종 → `_syncIndividualSettingsUI`가 라디오마다 change 이벤트 재디스패치 → 각자 다시 savePreferences → 50ms raw setTimeout으로 한 번 더 반복. 값은 정확하나(dataset 기반) localStorage 쓰기·이벤트가 폭주. 3668의 raw setTimeout은 cleanup 미추적.

### P-2 [Medium] 언어 변경 시 detached 노드 누수
- 언어 onchange → `generateHTMLElements` → `innerHTML=""`로 패널 파괴하나, 강참조 `_eventListeners` Map(`WAT.js:458`)의 이전 패널 노드 엔트리가 제거 안 됨. 여러 번 전환 시 누적.

### P-3 [Low] 죽은 코드/시스템: `checkAndRecoverTTS`·`setTTSListeners`·`setPageScrollListeners`·`tts_draggableText` 등 미호출, 레거시 focusin TTS 시스템 병존(활성 경로 없음), `_destroyed`가 init에서 리셋 안 됨.

### 성능 병목 순위 (1만 노드 페이지)
| 순위 | 핫스팟 | 비용 | 시점 |
|---|---|---|---|
| **1** | `markDynamicStyledElements` — 요소당 `getComputedStyle` **2회**(`shouldExcludeElement`가 재사용 없이 또 호출) | 1만 노드 = 2만 회 리플로우, init 동기 블로킹 수백ms~수초 | init 1회 |
| 2 | body MutationObserver + `_extractClassesFromElement`(노드당 querySelectorAll×4) | 동적 페이지 상시 | 상시 |
| 3 | 페이지 구조/TTS 추출 조상 getComputedStyle (1000링크×깊이15≈1.5만) | 다이얼로그 열 때 수백ms | 온디맨드 |
| 4 | StyleBatchProcessor 배치 50 → 1만 요소 시 ≈3.3초 완료 지연 | 스타일 변경 시 |

**최우선**: 순위 1의 `shouldExcludeElement`에 이미 계산한 `computed`를 넘겨 재사용 → init 리플로우 절반 감축.

---

## 4. 유지보수성

- **WAT.js 10,847줄 = 코드의 78%** 단일 클래스. 이미 core/tts/stt 매니저 구조가 있으므로 그리로 마이그레이션 미완이 핵심.
- **신·구 병존**: (A) 탭 2벌이 같은 버튼에 중복 바인딩(`_finalizeSetup`의 showTabContent[display, ARIA 없음] + `setupTabs`의 activateTab[hidden, aria-selected]) — **둘 다 살아있음**. (B) 레거시 TTS 890줄은 활성 경로 없이 죽어있음(제거 후보). (C) 상태 80% 일원화, `currentScreenScale` dual-write 잔존.
- **데드 코드**: 미호출 7 + @example-only 5 + 간접 데드(getTTSStatus) + validation.js(import만) + 레거시 TTS 890줄 ≈ **1,200줄+ 제거 가능**.
- **중복**: iframe/메인 스타일 함수 5쌍(통합 中), TTS 텍스트 추출은 WAT.js에 있고 AutoTTS/FocusTTS가 역참조(→BaseTTS로 이동, 下), 언어 결정 3중화(中).
- **테스트**: 84개가 core+StateManager만 커버. **WAT.js·tts·stt 78%가 0% 커버**.
- **문서**: README 공개 API 8종(setTheme/adjustFontSize 등) 코드에 **미존재**, 생성자 옵션(position/theme/features) 미소비, ARCHITECTURE 로케일 목록 4개(실제 6개)·src 구조 미기재, CONTRIBUTING "dist 직접 편집"이 빌드 파이프라인과 모순.
- **인프라**: ESLint/Prettier 부재(규칙은 문서화만), raw setTimeout 28곳(래퍼 미경유), CI가 dist 최신성(빌드 후 git diff) 미검증.

---

## 5. 사용성

**최종 사용자**
- U-1 [High] 프로필 선택 상태가 재방문 시 미복원 — `selectedProfile`을 setItem만 하고 **읽는 코드 없음** ✅검증. 개별 설정만 복원되어 프로필 토글이 "꺼짐"으로 보이고, 다시 켜면 설정이 리셋됨.
- U-2 [High] "초기화" 버튼이 시각 변화도 확인 절차도 없음 — removeItem만 하고 알림·confirm·리셋 적용 없음. 파괴적 동작인데 되돌리기 없음.
- U-3 [Medium] "저장"에 성공 피드백 없음(`msg.success.save` 정의됐으나 미사용), "저장 확인"은 개발자용 콘솔 덤프+영문 alert.
- U-4 [Medium] 음성 명령 도움말 부재 — 지원 명령어를 알 방법 없음, 안내가 한국어 하드코딩(AC-7과 동일).
- U-5 [Low] 색상 대비·채도·반전이 단일 CSS `filter`라 동시 적용 불가(UI는 동시 선택 가능한 듯 보임).

**통합 개발자**
- U-6 [High] README 생성자 옵션·공개 API 다수가 코드에 미연결 — `new WAT({theme, position, features})` 조용히 무시, `wat.setTheme()` 등 TypeError. (문서 정정 우선)
- U-7 [Medium] config.example.json에 코드가 안 읽는 키 다수(behavior.*, accessibility.* 등), 프로필 로케일 키가 실제 프로필 3종과 불일치.
- U-8 [Low] config 로드 실패가 console.warn만 — 개발 모드 경고 배너 필요.

---

## 6. 우선순위 종합 (관점 교차)

| 순위 | 항목 | 관점 | 근거 |
|---|---|---|---|
| 1 | **AC-1 aria-checked 갱신** | 접근성 | Critical, 도구 정체성 훼손, 수정 간단 |
| 2 | **AC-2 알림 aria-live** | 접근성 | Critical, 주 알림 채널, 수정 간단 |
| 3 | **S-1 JSONP endpoint 검증** | 보안 | 유일한 임의 코드 실행 벡터 |
| 4 | **S-2 저장소 확인 정보 노출** | 보안 | 최종 사용자 노출 UI, 수정 간단 |
| 5 | **U-1/U-2 프로필 복원·초기화 피드백** | 사용성 | 핵심 기능이 "고장난 것처럼" 보임 |
| 6 | **AC-3 html lang / AC-7 음성명령 로케일** | 접근성 | 다국어 사용자에게 도구 무의미 |
| 7 | **U-6 README 정정** | 사용성/문서 | 개발자 설치 실패, 문서만 고치면 됨 |
| 8 | **AC-6 고대비 filter 패널 깨짐** | 접근성 | 저시력 핵심 기능 |
| 9 | **P-1 프로필 저장 폭주 / 성능 순위1** | 안정성 | 체감 랙 |

---

## 7. 단계별 개선 로드맵

각 단계는 독립적으로 릴리스 가능하도록 구성. **W(주) 단위는 대략치.**

### 스프린트 1 — "즉효 수정" (빠른 개선, ~1주)
문서·CSS·소규모 코드로 사용자 체감이 가장 큰 것부터. 리스크 낮음.
- **접근성**: AC-1(aria-checked 갱신 — `_handleCheckboxChange`에 setAttribute 추가), AC-2(showNotification에 `role="status" aria-live="polite"`, 오류는 alert), AC-8/9(색상 대비값 상향), AC-15(`data-wat-color-theme` 접두 통일)
- **보안**: S-2(저장소 확인을 WAT 키로 한정), S-1 최소방어(endpoint에 isSafeHttpUrl https 강제)
- **사용성**: U-2(초기화에 confirm+알림+resetWatSettings 연결), U-3(저장 성공 알림), U-6(README를 실제 옵션/API로 정정), U-7(config.example 미사용 키 정리)
- **인프라**: npm audit fix(S-4), CHANGELOG/checklist 총계 오기 수정

### 스프린트 2 — "안전망 구축" (선행 필수, ~1주)
이후 리팩터의 회귀 감지 기반.
- 테스트 추가: 로케일 키 파리티(6개 언어 379키 일치 락), VoiceCommand 파싱, StateManager 계층 알림, TTSManager 상태 머신, 텍스트 추출 스냅샷
- CI: 빌드 후 `git diff --exit-code dist`(드리프트 게이트) + npm audit 게이트
- ESLint 도입: `no-restricted-syntax`로 raw setTimeout/setInterval 금지(기존 28곳은 warn/점진 전환)

### 스프린트 3 — "죽은 코드·병존 제거" (~1~2주)
무손실 감량으로 이후 분석 표면 축소. 스프린트 2의 테스트가 안전망.
- 데드 코드 제거: 미호출 7 + @example-only 5 + validation.js 정리 (~350줄)
- 레거시 TTS 클러스터 890줄 제거(텍스트 추출 9287~9739은 보존) — 죽은 isTTSActive/focusDetectFlag 세팅·구독 동반 정리
- 탭 시스템 단일화: `setupTabs/activateTab`(접근성 정합)만 남기고 `_finalizeSetup` 클릭 바인딩·showTabContent 제거 (AC와 겹침)

### 스프린트 4 — "상태·국제화 일원화" (~1주)
근본 원인 B·C 해소.
- 상태: `currentScreenScale` dual-write 제거 → state 단일화. AC-1을 넘어 **상태→ARIA 바인딩을 한 곳에서**(applySetting 테이블에서 aria-checked/selected/pressed 동시 갱신)
- 국제화: 지원 언어 목록·ko 기본값을 constants 단일화, ConfigurationManager→OptionsProcessor 위임. AC-3(html lang), AC-7·U-4(음성명령 로케일화) 포함
- 프로필 지속성: selectedProfile 읽기 경로 신설, loadPreferences와 통합(U-1)

### 스프린트 5 — "모듈 추출" (~3~4주, 다단계)
WAT.js 분해. 결합도 낮은 순.
1. **IframeStyler**(~760줄) + iframe/메인 스타일 5쌍 통합 — 리스크 낮음(읽기 위주)
2. **Dictionary**(~500줄, JSONP→fetch 전환 겸) + **PageStructure**(~430줄)
3. **텍스트 추출 → BaseTTS 이동**(~450줄) — 역참조 해소
4. **PanelBuilder**(~1650줄) / **SettingsApplier**(~920줄) — 최후, 횡단 서비스(localization/state/persist) 위임 인터페이스 선안정화 필요
- 공통 오버레이 프리미티브 추출(aria-modal·inert·포커스 트랩/복원·Escape·reduced-motion)로 사전·페이지구조·설정 패널 통합(AC-6/11/12)

### 병행 — 성능
- 스프린트 3~4 중 `markDynamicStyledElements`의 `shouldExcludeElement` computed 재사용(성능 순위1, 최우선), 배치 크기 재평가

---

## 8. 구조적 개선 3대 권고 (관점 통합)

1. **상태→UI/ARIA를 단일 바인딩 계층으로.** 스위치·라디오·탭의 시각 상태와 aria-checked/selected/pressed, data-속성을 한 곳(applySetting 유사 테이블)에서 동시 갱신. AC-1·AC-15·P-1·B(근본원인) 동시 해소.

2. **통지·모달을 공통 프리미티브로.** 로케일 기반 + aria-live 기본 부여 알림 디스패처 하나로 showNotification·사전·음성·피드백 4중 구현 수렴(AC-2·AC-7·U-3). aria-modal·inert·포커스 트랩을 갖춘 오버레이 컴포넌트로 3개 모달 통합(AC-6/11/12).

3. **문서-코드 계약을 단일 스키마로 강제.** 지원 옵션·config 키를 선언적 목록(constants)으로 정의하고, getConfigValue가 그 목록만 조회, 예제·문서를 목록에서 생성. README·config.example·언어목록 불일치(U-6/7·C)가 재발 불가능해짐.
