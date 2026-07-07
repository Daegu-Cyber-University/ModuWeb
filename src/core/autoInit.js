/**
 * @fileoverview script 태그 data-속성 기반 자동 초기화 — "1줄 설치" 지원
 * @module src/core/autoInit
 * @description
 *   <script src=".../webAccTools.js" data-wat-auto></script> 한 줄만으로
 *   초기화 코드 없이 도구를 삽입할 수 있게 한다. 속성이 없으면 아무 동작도 하지
 *   않으므로 기존 수동 초기화(new WAT(...)) 사용자는 영향받지 않는다 (opt-in).
 *
 *   지원 속성:
 *   - data-wat-auto              자동 초기화 활성화 (필수 스위치)
 *   - data-wat-config="..."      config.json 경로(스크립트 위치 기준) 또는 인라인 JSON('{'로 시작)
 *   - data-wat-language="ko"     기본 언어
 *   - data-wat-container="#id"   컨테이너 셀렉터
 *   - data-wat-inject-css="false" CSS 자동 주입 끄기
 */

/**
 * script 태그의 data-wat-* 속성을 WAT 생성자 옵션으로 변환합니다
 * @param {HTMLScriptElement} script - 속성을 읽을 script 요소
 * @returns {Object} WAT 생성자 옵션 객체
 */
export function parseAutoInitOptions(script) {
	const options = {};

	const rawConfig = script.getAttribute('data-wat-config');
	if (rawConfig) {
		const trimmed = rawConfig.trim();
		if (trimmed.startsWith('{')) {
			// 인라인 JSON — 서버에 config.json을 두지 않고도 설정 가능
			try {
				options.config = JSON.parse(trimmed);
			} catch (error) {
				console.warn('[WAT] data-wat-config 인라인 JSON 파싱 실패 — 기본 설정으로 진행합니다:', error.message);
			}
		} else {
			// 경로는 스크립트 위치 기준으로 해석 — 하위 페이지에서의 상대 경로 404 방지 (watInit.js와 동일)
			try {
				options.configPath = new URL(trimmed, script.src || document.baseURI).href;
			} catch (error) {
				options.configPath = trimmed;
			}
		}
	}

	const language = script.getAttribute('data-wat-language');
	if (language) {
		options.language = language;
	}

	const container = script.getAttribute('data-wat-container');
	if (container) {
		options.containerSelector = container;
	}

	if (script.getAttribute('data-wat-inject-css') === 'false') {
		options.injectCss = false;
	}

	return options;
}

/**
 * script에 data-wat-auto 속성이 있으면 DOM 준비 후 WAT를 자동 초기화합니다
 * @param {HTMLScriptElement|null} script - document.currentScript (모듈 로드 시점에 캡처)
 * @param {Function} WATClass - WAT 생성자
 * @returns {boolean} 자동 초기화가 예약/실행되었으면 true
 */
export function maybeAutoInit(script, WATClass) {
	if (typeof window === 'undefined' || typeof document === 'undefined') return false;
	if (!script || typeof script.hasAttribute !== 'function' || !script.hasAttribute('data-wat-auto')) {
		return false;
	}

	const start = () => {
		// watInit.js 등 다른 경로로 이미 초기화됐으면 중복 인스턴스를 만들지 않음
		if (window.watPlugin) {
			console.warn('[WAT] 이미 초기화된 인스턴스(window.watPlugin)가 있어 자동 초기화를 건너뜁니다.');
			return;
		}
		try {
			const instance = new WATClass(parseAutoInitOptions(script));
			window.watPlugin = instance; // watInit.js와 동일한 전역 핸들
			instance.init();
		} catch (error) {
			console.error('[WAT] 자동 초기화에 실패했습니다:', error);
		}
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start, { once: true });
	} else {
		start();
	}
	return true;
}
