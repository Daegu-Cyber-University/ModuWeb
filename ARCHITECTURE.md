# ModuWeb 아키텍처 및 구성도

## 시스템 전체 구조

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI["사용자 인터페이스<br/>- UI Panel<br/>- Settings Dialog<br/>- Control Buttons"]
    end

    subgraph "Core Engine"
        WAT["WAT Main Class<br/>메인 플러그인 엔진<br/>- 초기화<br/>- 생명주기 관리<br/>- 통합 제어"]
        
        SM["State Manager<br/>상태 관리 시스템<br/>- 중앙집중식 상태<br/>- 옵저버 패턴<br/>- 히스토리 관리"]
        
        EH["Error Handler<br/>에러 관리<br/>- 에러 추적<br/>- 복구 전략<br/>- 로깅"]
    end

    subgraph "Visual Accessibility Features"
        VA1["Font Controller<br/>- 글꼴 크기<br/>- 글꼴 종류<br/>- 행간 조절"]
        
        VA2["Color & Contrast<br/>- 고대비 모드<br/>- 색상 반전<br/>- 채도 조절"]
        
        VA3["Visual Tools<br/>- 화면 확대<br/>- 커서 강조<br/>- 읽기 가이드"]
    end

    subgraph "Audio Features"
        TTS["TTS Module<br/>음성 변환<br/>- Auto TTS<br/>- Focus TTS<br/>- Keyboard TTS"]
        
        STT["STT Module<br/>음성 인식<br/>- Voice Input<br/>- Voice Commands<br/>- Voice Search"]
    end

    subgraph "Supporting Features"
        DICT["Dictionary<br/>- 단어 검색<br/>- 오픈 사전<br/>- 용어 정보"]
        
        PROFILE["Profile Manager<br/>- 장애 유형별 설정<br/>- 프로필 저장<br/>- 빠른 적용"]
        
        MEDIA["Media Control<br/>- 애니메이션 제어<br/>- 자동재생 제어<br/>- 콘텐츠 관리"]
    end

    subgraph "Data Management"
        CONFIG["Configuration<br/>설정 관리<br/>- config.json<br/>- 옵션 처리<br/>- 다국어 설정"]
        
        STORAGE["LocalStorage<br/>로컬 저장<br/>- 사용자 설정<br/>- 프로필<br/>- 히스토리"]
        
        I18N["Internationalization<br/>다국어 지원<br/>- 한국어<br/>- 영어<br/>- 일본어<br/>- 중국어"]
    end

    subgraph "Presentation Layer"
        STYLE["Style Manager<br/>스타일 처리<br/>- CSS 적용<br/>- 일괄 처리<br/>- 캐싱"]
        
        CONTAINER["Container Manager<br/>UI 컨테이너<br/>- DOM 구조<br/>- 요소 관리<br/>- 이벤트 처리"]
    end

    %% Connections
    UI --> WAT
    WAT --> SM
    WAT --> EH
    WAT --> VA1
    WAT --> VA2
    WAT --> VA3
    WAT --> TTS
    WAT --> STT
    WAT --> DICT
    WAT --> PROFILE
    WAT --> MEDIA
    
    SM --> CONFIG
    SM --> STORAGE
    SM --> I18N
    
    VA1 --> STYLE
    VA2 --> STYLE
    VA3 --> STYLE
    TTS --> STYLE
    STT --> STYLE
    
    STYLE --> CONTAINER
    CONTAINER --> UI

```

---

## 초기화 프로세스

```mermaid
sequenceDiagram
    participant HTML as HTML Page
    participant Script as webAccTools.js
    participant Init as watInit.js
    participant WAT as WAT Instance
    participant Config as ConfigManager
    participant DOM as DOM Elements
    participant Storage as LocalStorage

    HTML->>Script: Script Load
    Script->>Script: WAT Class Definition<br/>(StateManager, TTSManager, etc.)
    
    Init->>Init: DOMContentLoaded Event
    Init->>WAT: new WAT(options)
    WAT->>Config: Load configuration
    Config->>Storage: Check saved settings
    Storage-->>Config: Return saved data
    
    WAT->>DOM: Initialize UI Panel
    DOM->>WAT: DOM Ready
    
    WAT->>WAT: Register Event Listeners
    WAT->>WAT: Initialize Features
    WAT->>Script: Emit 'wat:initialized'
    
    Script-->>HTML: Ready for User Interaction

```

---

## 기능별 프로세스 플로우

### TTS (Text-to-Speech) 프로세스

```mermaid
graph LR
    USER["사용자 인터랙션<br/>클릭/포커스"]
    
    subgraph TTS["TTS 처리 플로우"]
        T1["텍스트 추출<br/>- 선택된 요소<br/>- 자식 텍스트<br/>- 속성값"]
        T2["텍스트 정규화<br/>- 공백 제거<br/>- 특수문자 처리<br/>- 길이 확인"]
        T3["음성 합성<br/>Web Speech API<br/>또는<br/>제3의 API"]
        T4["재생 제어<br/>- 시작/일시정지<br/>- 속도 조절<br/>- 볼륨 조절"]
        T5["UI 반영<br/>- 하이라이트<br/>- 진행률 표시<br/>- 상태 업데이트"]
    end
    
    STORAGE[("LocalStorage<br/>설정 저장")]
    
    USER --> T1 --> T2 --> T3 --> T4 --> T5
    T3 -.-> STORAGE
    T4 -.-> STORAGE

```

### STT (Speech-to-Text) 프로세스

```mermaid
graph LR
    USER["사용자 음성 입력<br/>마이크"]
    
    subgraph STT["STT 처리 플로우"]
        S1["음성 인식 시작<br/>Web Speech API"]
        S2["음성 -> 텍스트<br/>변환"]
        S3["명령어 분석<br/>- 검색<br/>- 네비게이션<br/>- 제어"]
        S4["명령어 실행<br/>또는<br/>텍스트 입력"]
        S5["결과 표시<br/>- 인식 결과<br/>- 실행 확인<br/>- 오류 처리"]
    end
    
    STATE[("State Manager<br/>상태 업데이트")]
    
    USER --> S1 --> S2 --> S3 --> S4 --> S5
    S3 -.-> STATE
    S4 -.-> STATE

```

### 시각적 설정 적용 프로세스

```mermaid
graph LR
    USER["사용자 설정 변경<br/>UI에서"]
    
    subgraph VISUAL["시각적 설정 플로우"]
        V1["설정값 수집<br/>- 글꼴 크기<br/>- 색상 모드<br/>- 명암도"]
        V2["State 업데이트<br/>StateManager<br/>상태 변경"]
        V3["CSS 생성<br/>StyleBatchProcessor<br/>일괄 처리"]
        V4["DOM에 적용<br/>- <style> 태그<br/>- 인라인 스타일<br/>- 클래스 추가"]
        V5["LocalStorage 저장<br/>다음 방문시<br/>복구"]
    end
    
    OBSERVER["옵저버 패턴<br/>변경 감지"]
    
    USER --> V1 --> OBSERVER
    OBSERVER --> V2 --> V3 --> V4
    V4 --> V5

```

---

## 🏗️ 클래스 구조 및 역할

```mermaid
graph TB
    subgraph "Core Classes"
        WAT["<b>WAT</b><br/>메인 플러그인<br/>- 초기화 & 생명주기<br/>- 기능 통합 제어<br/>- UI 관리"]
        SM["<b>StateManager</b><br/>중앙 상태 관리<br/>- 옵저버 패턴<br/>- 히스토리 추적<br/>- 깊은 병합"]
    end

    subgraph "Audio Classes"
        TTS["<b>TTSManager</b><br/>음성 합성 제어"]
        AutoTTS["<b>AutoTTS</b><br/>자동 읽기"]
        FocusTTS["<b>FocusTTS</b><br/>포커스 기반 읽기"]
        KeyboardTTS["<b>KeyboardTTS</b><br/>키보드 단축키"]
        STT["<b>STTManager</b><br/>음성 인식 제어"]
        VC["<b>VoiceCommand</b><br/>음성 명령어"]
    end

    subgraph "Management Classes"
        EM["<b>ErrorHandler</b><br/>에러 처리<br/>- 에러 추적<br/>- 복구 전략<br/>- 로깅"]
        CM["<b>ContainerManager</b><br/>UI 컨테이너 관리<br/>- DOM 생성<br/>- 이벤트 바인딩"]
        CFG["<b>ConfigurationManager</b><br/>설정 관리<br/>- 파일 로드<br/>- 옵션 처리<br/>- 기본값"]
    end

    subgraph "Utility Classes"
        SBP["<b>StyleBatchProcessor</b><br/>스타일 일괄 처리"]
        OP["<b>OptionsProcessor</b><br/>옵션 처리"]
    end

    WAT --> SM
    WAT --> TTS
    WAT --> STT
    WAT --> EM
    WAT --> CM
    WAT --> CFG
    
    TTS --> AutoTTS
    TTS --> FocusTTS
    TTS --> KeyboardTTS
    STT --> VC
    
    SM --> SBP
    SM --> OP
    
```

---

## 📦 파일 구조

```
ModuWeb/
├── 📄 webAccTools.js (메인 번들)
│   ├── StateManager
│   ├── TTSManager
│   │   ├── AutoTTS
│   │   ├── FocusTTS
│   │   └── KeyboardTTS
│   ├── STTManager
│   │   └── VoiceCommand
│   ├── WAT (메인 클래스)
│   │   ├── ErrorHandler
│   │   ├── ContainerManager
│   │   ├── ConfigurationManager
│   │   ├── StyleBatchProcessor
│   │   └── OptionsProcessor
│   └── Utility Functions
│
├── 📄 watInit.js (초기화 스크립트)
│   └── DOMContentLoaded 핸들러
│
├── 📄 config.json (설정 파일)
│   ├── UI 설정
│   ├── 기능 옵션
│   ├── 다국어 텍스트
│   └── API 키
│
└── 📁 assets/
    ├── 📁 css/
    │   ├── webAccTools.css (메인 스타일)
    │   └── 테마 파일들
    ├── 📁 js/
    │   └── 추가 유틸리티
    ├── 📁 fonts/
    │   └── 접근성 폰트들
    ├── 📁 images/
    │   └── UI 아이콘들
    └── 📁 locales/
        ├── ko.json (한국어)
        ├── en.json (영어)
        ├── ja.json (일본어)
        └── zh.json (중국어)
```

---

## 🔌 이벤트 흐름

```mermaid
graph LR
    Browser["브라우저 이벤트"]
    
    subgraph "Event Handlers"
        EH1["Click Events<br/>UI 버튼 클릭"]
        EH2["Keyboard Events<br/>단축키"]
        EH3["Focus Events<br/>포커스 변경"]
        EH4["Change Events<br/>설정 변경"]
    end
    
    subgraph "Processing"
        P1["이벤트 리스너<br/>감지"]
        P2["핸들러 실행<br/>기능 수행"]
        P3["State 업데이트<br/>상태 변경"]
    end
    
    subgraph "Response"
        R1["DOM 업데이트<br/>UI 반영"]
        R2["LocalStorage 저장<br/>설정 유지"]
        R3["Custom Event 발생<br/>wat:eventname"]
    end
    
    Browser --> EH1
    Browser --> EH2
    Browser --> EH3
    Browser --> EH4
    
    EH1 --> P1
    EH2 --> P1
    EH3 --> P1
    EH4 --> P1
    
    P1 --> P2 --> P3
    P3 --> R1
    P3 --> R2
    P3 --> R3

```

---

## 🚀 주요 특징

| 계층 | 역할 | 핵심 기술 |
|------|------|---------|
| **UI Layer** | 사용자 인터페이스 | HTML/CSS, 동적 DOM 조작 |
| **Core Engine** | 통합 제어 & 상태관리 | StateManager, 옵저버 패턴 |
| **Feature Layer** | 접근성 기능 구현 | TTS, STT, 시각적 조정 |
| **Data Layer** | 설정 & 저장소 | LocalStorage, JSON 설정 |
| **Utility Layer** | 보조 기능 | CSS 처리, 에러 관리 |

---

## ⚡ 주요 프로세스

1. **초기화 프로세스**: HTML 로드 → Script 로드 → DOMContentLoaded → WAT 초기화 → 설정 로드 → UI 생성 → Ready
2. **TTS 프로세스**: 사용자 클릭 → 텍스트 추출 → 음성 합성 → 재생 & UI 반영 → 상태 저장
3. **시각적 설정**: 사용자 입력 → State 업데이트 → CSS 생성 → DOM 적용 → 저장
4. **에러 처리**: 에러 발생 → ErrorHandler 감지 → 복구 전략 실행 → 사용자에게 안내

---

## 🔐 데이터 흐름

```
사용자 입력
    ↓
Event Handler
    ↓
StateManager.set()
    ↓
옵저버 알림
    ↓
Feature Module (TTS, 시각조정 등)
    ↓
StyleBatchProcessor / UI Update
    ↓
DOM 반영
    ↓
LocalStorage 저장
    ↓
다음 방문시 복구
```

---

이 문서는 WAT의 주요 모듈 관계와 처리 흐름을 한눈에 정리한 것입니다.
