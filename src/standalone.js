/**
 * @fileoverview WAT standalone 진입점 — 파일 1개 복사로 동작하는 단일 파일 번들
 * @version __MODUWEB_VERSION__
 * @description
 *   빌드 시 rollup의 wat-inline-assets 플러그인이 가상 모듈(virtual:wat-inline-assets)로
 *   CSS(이미지 data URI 재작성 포함)·한국어 로케일·JS 참조 이미지를 주입한다.
 *   산출물(dist/webAccTools.standalone.min.js) 하나만 웹루트에 복사하면
 *   assets 폴더·config.json·네트워크 없이 동작한다 (폐쇄망/오프라인 지원).
 *
 *   제한: 한국어 외 언어(en-US 등)는 온라인 + assets/locales 배포 시에만 로드되고,
 *   사전 검색은 config의 serverEndpoint 설정이 필요하다 (기존과 동일).
 */
import { WAT } from './wat/WAT.js';
import { maybeAutoInit } from './core/autoInit.js';
import { inlineCss, koLocale, imageMap } from 'virtual:wat-inline-assets';

// 임베드 자산 등록 — loadLocale/_assetUrl이 fetch·basePath 대신 이것을 우선 사용
WAT.embeddedLocales = { ko: koLocale };
WAT.embeddedAssets = imageMap;

/**
 * 인라인 CSS를 <style id="wat-inline-style">로 주입합니다.
 * _ensureStylesheet가 이 id를 인식해 <link> 중복 주입을 건너뛴다.
 */
function injectStyles() {
	if (document.getElementById('wat-inline-style')) return;
	const style = document.createElement('style');
	style.id = 'wat-inline-style';
	style.textContent = inlineCss;
	document.head.appendChild(style);
}

// 전역 등록 (index.js와 동일한 규약)
if (typeof window !== 'undefined') {
	if (window.WAT) {
		console.warn('WAT is already defined. Duplicate script include detected.');
	} else {
		try {
			window.WAT = WAT;
		} catch (error) {
			console.error('Failed to register WAT globally:', error);
		}
	}
}

if (typeof document !== 'undefined') {
	injectStyles();
	// "1줄 설치" — <script src=".../webAccTools.standalone.min.js" data-wat-auto></script>
	maybeAutoInit(document.currentScript, WAT);
}

// Public API - ESM 사용자를 위한 named exports (index.js와 동일)
export { WAT };
export { ErrorHandler } from './core/ErrorHandler.js';
export { StateManager } from './wat/StateManager.js';
export { TTSManager } from './tts/TTSManager.js';
export { STTManager } from './stt/STTManager.js';
