# Contributing to ModuWeb

ModuWeb에 기여해 주셔서 감사합니다! 이 문서는 기여 방법을 안내합니다.

## 목차

- [행동 강령](#행동-강령)
- [개발 환경 설정](#개발-환경-설정)
- [기여 방법](#기여-방법)
- [코딩 스타일](#코딩-스타일)
- [커밋 메시지 규칙](#커밋-메시지-규칙)
- [Pull Request 절차](#pull-request-절차)
- [버그 리포트](#버그-리포트)
- [기능 요청](#기능-요청)

---

## 행동 강령

모든 기여자는 서로를 존중하고 건설적인 방식으로 소통해 주세요.

---

## 개발 환경 설정

### 1. 저장소 Fork 및 Clone

```bash
git clone https://github.com/YOUR_USERNAME/ModuWeb.git
cd ModuWeb
```

### 2. 설정 파일 생성

```bash
# Windows
copy config.example.json config.json

# macOS / Linux
cp config.example.json config.json
```

`config.json`을 열어 로컬 환경에 맞게 수정하세요. 로컬에서 사전 기능을 테스트하려면 `api.dictionary.serverEndpoint`가 **JSONP 형식**으로 응답하는 주소여야 합니다. `examples/dict_sample.json`은 응답 형식 예시이므로 그대로 `serverEndpoint`로 연결할 수 없을 수 있습니다.

### 3. 개발 서버 실행

별도 빌드 도구 없이 `dist/` 폴더의 파일을 직접 편집합니다.  
`examples/` 폴더의 HTML 파일을 브라우저에서 열어 테스트하세요.

---

## 기여 방법

1. 작업할 이슈를 [Issues](https://github.com/Daegu-Cyber-University/ModuWeb/issues)에서 찾거나 새로 등록하세요.
2. 이슈 번호에 맞는 브랜치를 생성합니다.  
   예: `feature/123-add-new-font`, `fix/456-tts-crash`
3. 변경 사항을 구현하고 `examples/` 폴더에서 직접 테스트합니다.
4. 변경 이유를 명확히 담은 커밋 메시지를 작성합니다.
5. Pull Request를 `main` 브랜치 대상으로 생성합니다.

---

## 코딩 스타일

- **언어**: Vanilla JavaScript (ES2022+, `class` 문법, `async/await`)
- **들여쓰기**: 탭(Tab) 사용
- **세미콜론**: 사용
- **변수 선언**: `const` 우선, 재할당 필요 시 `let`. `var` 사용 금지
- **JSDoc**: 모든 public 메서드에 JSDoc 주석 작성 (한국어/영어 병기)
- **에러 처리**: `WAT.ErrorHandler` 클래스를 통한 중앙집중식 처리
- **DOM 조작**: `innerHTML` 직접 할당 지양, `createElement` + `setAttribute` 사용

### 금지 사항

- `var` 키워드 사용
- `for...in` 루프 내 `hasOwnProperty` 직접 호출 (대신 `Object.keys()` 또는 `Object.hasOwn()` 사용)
- 외부 API 키나 서버 URL을 코드에 직접 하드코딩 (반드시 `config.json`에 위치)
- jQuery 등 외부 라이브러리 의존성 추가

---

## 커밋 메시지 규칙

[Conventional Commits](https://www.conventionalcommits.org/ko/v1.0.0/) 형식을 따릅니다.

```
<type>(<scope>): <subject>

[optional body]
```

**type 종류:**

| type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 기능 변경 없는 코드 개선 |
| `docs` | 문서 수정 |
| `style` | 코드 스타일(포맷) 수정 |
| `chore` | 빌드 설정, 의존성 등 기타 변경 |

**예시:**
```
feat(tts): 읽기 속도 단계별 조절 기능 추가
fix(dictionary): JSONP 타임아웃 후 콜백 누수 수정
refactor(config): 하드코딩된 폰트 URL을 config.json으로 이동
docs(readme): 로컬 개발 환경 설정 가이드 추가
```

---

## Pull Request 절차

1. PR 제목은 커밋 메시지 규칙을 따릅니다.
2. PR 설명에 다음 항목을 포함합니다:
   - 변경 이유 및 방법
   - 테스트한 브라우저 목록
   - 관련 이슈 번호 (`Closes #123`)
3. `config.json`은 PR에 포함하지 마세요 (`.gitignore` 대상).
4. 변경 사항이 기존 기능을 깨지 않는지 `examples/` 폴더에서 직접 확인하세요.

---

## 버그 리포트

[Issues](https://github.com/Daegu-Cyber-University/ModuWeb/issues)에 다음 내용을 포함하여 등록해 주세요.

- **재현 방법**: 단계별로 상세히 기술
- **기대 동작**: 어떻게 동작해야 하는지
- **실제 동작**: 현재 어떻게 동작하는지
- **환경**: 브라우저 종류/버전, OS
- **재현 가능한 예제**: 가능하다면 코드 스니펫 또는 링크

---

## 기능 요청

[Issues](https://github.com/Daegu-Cyber-University/ModuWeb/issues)에 `enhancement` 라벨과 함께 등록해 주세요.

- 기능의 목적과 사용 사례를 설명해 주세요.
- 가능하다면 예상 API 또는 사용법을 포함해 주세요.

---

감사합니다! 여러분의 기여가 ModuWeb을 더 나은 접근성 도구로 만듭니다.
