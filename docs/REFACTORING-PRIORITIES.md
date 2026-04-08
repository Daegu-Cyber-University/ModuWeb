# WAT.js 모듈 분할 — 우선순위(로드맵)

`src/wat/WAT.js`는 UI 패널, 사전, 스타일, 프로필, 이벤트 등이 한 클래스에 모여 있습니다. 아래는 **리스크 대비 효과**가 큰 순으로 정한 분리 후보입니다. 항목은 독립적이지 않을 수 있어, 상위 항목부터 순차 검토하는 것을 권장합니다.

## 1순위: 사전(Dictionary) 플로우

- **범위**: JSONP 요청, 모달 표시, 오류/미발견 UI, `displayDictionResult` 및 인접 private 메서드.
- **이유**: 외부 네트워크·신뢰 경계가 명확하고, [`src/core/jsonpFetch.js`](../src/core/jsonpFetch.js)처럼 이미 추출 가능한 조각이 있음.
- **산출물 예시**: `src/wat/DictionaryController.js` 또는 `src/features/dictionary/DictionaryModal.js`.

## 2순위: UI 패널/컨테이너 생성

- **범위**: 도구 패널 DOM 조립, 버튼·탭·드래그, `ContainerManager`와 중복되지 않는 WAT 전용 UI 조립 로직.
- **이유**: DOM 변경이 잦아 회귀가 많음. 테스트하기 어려운 블록을 한 곳으로 모으면 스냅샷/스모크 테스트를 붙이기 쉬움.

## 3순위: 설정 적용·폰트/리소스 반영

- **범위**: `_applyConfigResources`, `_getFallbackConfig`, 저장 설정을 페이지에 반영하는 `_applySavedSettingsToPage` 계열.
- **이유**: `ConfigurationManager`·`StateManager`와 경계를 맞추면 설정 관련 버그 추적이 쉬워짐.

## 4순위: 읽기 가이드·페이지 구조 마킹

- **범위**: 페이지 구조, 마커, blind/placeholder 치환 등 긴 텍스트/DOM 순회 블록.
- **이유**: 성능·접근성 이슈가 여기서 자주 발생. 분리 후 프로파일링 단위가 명확해짐.

## 5순위: 프로필·미디어 제어 등 나머지 기능 블록

- **범위**: 프로필 적용, 애니메이션/미디어 제어, 단축키 라우팅.
- **이유**: 기능별로 응집도를 높이면 기능 플래그(`features`)와 설정 스키마를 맞추기 쉬움.

## 분할 시 공통 원칙

- **WAT**는 생명주기(`init`, 설정 로드, 매니저 조립)와 퍼블릭 API만 남기고, 세부 동작은 `WAT`에 주입하거나 이벤트로 위임.
- **StateManager 구독**이 흩어져 있으면 분할 후 “한 기능 = 한 observer 모듈” 형태로 정리.
- 각 단계마다 `npm test` 및 `examples/` 수동 시나리오([`tests/manual/checklist.md`](../tests/manual/checklist.md))로 회귀를 확인합니다.

이 문서는 아키텍처 개요([`ARCHITECTURE.md`](../ARCHITECTURE.md))와 함께 두고, 이슈/PR에서 “몇 순위 범위인지”를 레퍼런스로 쓸 수 있습니다.
