# ModuWeb (Web Accessibility Tools)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub release](https://img.shields.io/github/release/Daegu-Cyber-University/ModuWeb.svg)](https://github.com/Daegu-Cyber-University/ModuWeb/releases)
[![GitHub stars](https://img.shields.io/github/stars/Daegu-Cyber-University/ModuWeb.svg)](https://github.com/Daegu-Cyber-University/ModuWeb/stargazers)

> 모두를 위한 웹 - 웹 접근성 향상을 위한 통합 도구

## 📋 목차

- [소개](#-소개)
- [주요 기능](#-주요-기능)
- [빠른 시작](#-빠른-시작)
- [설치 방법](#-설치-방법)
- [사용법](#-사용법)
- [설정 옵션](#-설정-옵션)
- [API 문서](#-api-문서)
- [예제](#-예제)
- [브라우저 지원](#-브라우저-지원)
- [기여하기](#-기여하기)
- [라이선스](#-라이선스)
- [지원](#-지원)

## 📖 소개

**ModuWeb (Web Accessibility Tools)**은 웹 접근성을 향상시키기 위한 종합적인 JavaScript 라이브러리입니다. 

### 🎯 주요 특징

- 🚀 **간편한 통합**: 단 몇 줄의 코드로 웹사이트에 접근성 기능 추가
- 🌍 **다국어 지원**: 한국어, 영어, 일본어, 중국어, 독일어 지원
- 📱 **반응형 설계**: 데스크톱과 모바일 모두 지원
- ♿ **WCAG 2.1 AA 준수**: 국제 웹 접근성 표준 준수
- 🎨 **커스터마이징 가능**: 다양한 테마와 설정 옵션
- 📚 **풍부한 기능**: TTS, STT, 화면 확대, 색상 조절 등

이 도구를 사용하면 웹사이트 관리자와 개발자가 최소한의 노력으로 웹 접근성을 크게 개선할 수 있습니다.

## ✨ 주요 기능

### 👁️ 시각적 접근성
- **글꼴 조절**: 텍스트 크기 및 폰트 종류를 조절
- **텍스트 정렬**: 텍스트 좌우 정렬 및 간격 조절
- **저시력 지원**: 화면 전체 크기 조절

### 🎨 색상 인식 지원
- **색상 대비 조절**: 고대비 모드 지원
- **색상 반전**: 화면 색상 반전 기능
- **채도 조절**: 채도 및 명암 조절

### 🎯 집중력 지원
- **커서 도구**: 마우스 위치 강조
- **읽기 지원**: 웹페이지 콘텐츠 읽기를 위한 집중력 지원
- **미디어 제어**: 미디어 콘텐츠 및 애니메이션 제어

### 🔊 청각적 접근성
- **TTS (Text-to-Speech)**: 텍스트를 음성으로 변환
- **STT (Speech-to-Text)**: 음성을 텍스트로 변환

### 📚 보조 지원도구
- **사전 기능**: 오픈 사전 검색 지원
- **읽기 모드**: 집중 읽기를 위한 단순화된 화면
- **다국어 지원**: 한국어, 영어, 일본어, 중국어 지원

### ⌨️ 키보드 접근성
- **키보드 내비게이션**: 마우스 없이 모든 기능 접근 가능
- **포커스 표시기**: 현재 포커스된 요소 강조 표시
- **단축키**: 빠른 기능 접근을 위한 키보드 단축키

### 🛠️ 설정 관리
- **프로필 기능**: 장애 유형별 프로필 일괄 적용
- **설정 저장**: 도구 사용성 지원을 위한 설정 저장

## 🚀 빠른 시작

### GitHub에서 직접 다운로드

1. [릴리스 페이지](https://github.com/Daegu-Cyber-University/ModuWeb/releases)에서 최신 버전 다운로드
2. `/dist` 폴더의 파일들을 프로젝트에 복사
3. HTML에서 파일 로드

```html
<link rel="stylesheet" href="path/to/dist/assets/css/webAccTools.css">
<script src="path/to/dist/webAccTools.js"></script>
```

### Git Clone

```bash
git clone https://github.com/Daegu-Cyber-University/ModuWeb.git
cd ModuWeb
```

## 📚 사용법

### 기본 사용법
```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>접근성 도구 예제</title>
    <link rel="stylesheet" href="path/to/dist/assets/css/webAccTools.css">
</head>
<body>
    <h1>웹사이트 제목</h1>
    <p>접근성이 향상된 웹사이트입니다.</p>
    
    <!-- WAT 도구가 자동으로 여기에 추가됩니다 -->
    
    <script src="path/to/dist/webAccTools.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // 기본 설정으로 WAT 초기화
            const wat = new WAT();
            wat.init();
        });
    </script>
</body>
</html>
```

### 고급 설정
```javascript
let watOptions = {};
document.addEventListener('DOMContentLoaded', () => {
    watOptions = {
            configPath: '../config.json',		// config.json

            colorTheme: false,
            fontFamily: {
                'Koddi Udon Gothic': {
                    enabled: true,
                    url: '../dist/assets/fonts/koddi-udon-gothic/koddi-udon-gothic.css'
                }
            },
            language: { languages: ["ko", "en-US"]}
    };
    const wat = new WAT(watOptions);
    window.watPlugin = wat;
    wat.init();
});
```

## ⚙️ 설정 옵션

### 기본 설정

```javascript
const wat = new WAT({
    position: 'right',        // 'left', 'right', 'top', 'bottom'
    language: 'ko',          // 'ko', 'en-US', 'en-GB', 'ja', 'zh', 'de'
    theme: 'light',          // 'light', 'dark', 'auto'
    configPath: './config.json'  // 설정 파일 경로 (선택사항)
});
```

### 고급 설정

```javascript
const wat = new WAT({
    configPath: './config.json',
    colorTheme: true,
    fontFamily: {
        'Koddi Udon Gothic': {
            enabled: true,
            url: './assets/fonts/koddi-udon-gothic/koddi-udon-gothic.css'
        }
    },
    language: { 
        languages: ["ko", "en-US", "ja"] 
    },
    features: {
        tts: true,           // Text-to-Speech
        stt: true,           // Speech-to-Text
        magnifier: true,     // 화면 확대
        colorAdjust: true,   // 색상 조절
        dictionary: false    // 사전 기능 (config.json 필요)
    }
});
```

### config.json 설정 파일

프로젝트 루트에 `config.json` 파일을 생성하여 고급 기능을 활성화할 수 있습니다. 
[config.example.json](./config.example.json) 파일을 참고하세요.

```json
{
  "api": {
    "dictionary": {
      "enabled": true,
      "serverEndpoint": "https://your-api-server.com/dictionary"
    }
  },
  "settings": {
    "defaultLanguage": "ko",
    "theme": "light"
  }
}
```
```

## 📖 API 문서

### WAT 클래스

#### 생성자
```javascript
new WAT(options)
```

**매개변수:**
- `options` (Object): 설정 객체

#### 메서드

##### `init()`
접근성 도구를 초기화합니다.
```javascript
wat.init();
```

##### `show()`
접근성 도구 패널을 표시합니다.
```javascript
wat.show();
```

##### `hide()`
접근성 도구 패널을 숨깁니다.
```javascript
wat.hide();
```

##### `toggle()`
접근성 도구 패널을 토글합니다.
```javascript
wat.toggle();
```

##### `setLanguage(lang)`
언어를 변경합니다.
```javascript
wat.setLanguage('en'); // 영어로 변경
```

##### `setTheme(theme)`
테마를 변경합니다.
```javascript
wat.setTheme('dark'); // 다크 테마로 변경
```

##### `adjustFontSize(percentage)`
글꼴 크기를 조절합니다.
```javascript
wat.adjustFontSize(150); // 150%로 확대
```

##### `toggleHighContrast()`
고대비 모드를 토글합니다.
```javascript
wat.toggleHighContrast();
```

##### `toggleColorInvert()`
색상 반전을 토글합니다.
```javascript
wat.toggleColorInvert();
```

##### `speakText(text, options)`
텍스트를 음성으로 읽습니다.
```javascript
wat.speakText('안녕하세요', {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
});
```

##### `startSpeechRecognition(callback)`
음성 인식을 시작합니다.
```javascript
wat.startSpeechRecognition((result) => {
    console.log('인식된 텍스트:', result);
});
```

### 이벤트

#### `wat:initialized`
도구가 초기화되었을 때 발생합니다.
```javascript
document.addEventListener('wat:initialized', (event) => {
    console.log('WAT 초기화 완료');
});
```

#### `wat:settingsChanged`
설정이 변경되었을 때 발생합니다.
```javascript
document.addEventListener('wat:settingsChanged', (event) => {
    console.log('설정 변경:', event.detail);
});
```

#### `wat:fontSizeChanged`
글꼴 크기가 변경되었을 때 발생합니다.
```javascript
document.addEventListener('wat:fontSizeChanged', (event) => {
    console.log('글꼴 크기:', event.detail.size);
});
```

## 💡 예제

### 기본 예제
- [기본 사용법](./examples/basic.html) - 가장 간단한 사용 예제
- [커스텀 설정](./examples/custom-examples.html) - 고급 설정 옵션 적용
- [API 사용법](./examples/api-examples.html) - 프로그래밍 방식으로 제어

더 많은 예제는 [`examples`](./examples/) 폴더를 참고하세요.

## 🌐 브라우저 지원

| 브라우저 | 최소 버전 |
|---------|----------|
| Chrome | 60+ |
| Firefox | 55+ |
| Safari | 12+ |
| Edge | 79+ |
| Opera | 47+ |

## 📱 모바일 지원

- iOS Safari 12+
- Android Chrome 60+
- Samsung Internet 8.0+

## 🎯 접근성 준수

이 라이브러리는 다음 접근성 표준을 준수합니다:

- **WCAG 2.1 AA**: Web Content Accessibility Guidelines
- **KWCAG 2.1**: 한국형 웹 콘텐츠 접근성 가이드라인


### 버그 리포트 및 기능 요청

- [이슈 페이지](https://github.com/Daegu-Cyber-University/ModuWeb/issues)에서 버그 리포트나 기능 요청을 해주세요
- 버그 리포트 시 재현 가능한 예제를 포함해주세요

### 코딩 스타일

- JavaScript ES6+ 문법 사용
- JSDoc 주석으로 문서화
- 들여쓰기는 탭 사용
- 세미콜론 사용

## 📄 라이선스

이 프로젝트는 [Apache License 2.0](./LICENSE)으로 라이선스가 부여됩니다.

```
Copyright 2025 DAEGU CYBER UNIVERSITY

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## 📞 지원

### 문의사항

- 📧 **이메일**: idaegu@dcu.ac.kr
- 🌐 **웹사이트**: [대구사이버대학교](https://www.dcu.ac.kr)
- 🐛 **버그 리포트**: [GitHub Issues](https://github.com/Daegu-Cyber-University/ModuWeb/issues)

### 문서

- 📚 **API 문서**: [docs/](./docs/) 폴더 참고
- 💡 **사용 예제**: [examples/](./examples/) 폴더 참고
- ⚙️ **설정 가이드**: [config.example.json](./config.example.json) 참고

### 커뮤니티

- 💬 **토론**: [GitHub Discussions](https://github.com/Daegu-Cyber-University/ModuWeb/discussions)
- 📋 **릴리스 노트**: [GitHub Releases](https://github.com/Daegu-Cyber-University/ModuWeb/releases)


---

<div align="center">

**🌟 Web Accessibility Tools로 더 접근 가능한 웹을 만들어 보세요! 🌟**

[⬆️ 맨 위로 돌아가기](#moduweb-web-accessibility-tools)

</div>
