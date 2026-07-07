/**
 * @fileoverview WAT (Web Accessibility Tool) 진입점
 * @version __MODUWEB_VERSION__
 */
import { WAT } from './wat/WAT.js';
import { maybeAutoInit } from './core/autoInit.js';

// 전역에 등록 (기존 동작 유지)
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

// "1줄 설치" — <script src=".../webAccTools.js" data-wat-auto></script>
// IIFE 번들은 동기 실행되므로 이 시점의 document.currentScript가 로드한 script 태그다
if (typeof document !== 'undefined') {
	maybeAutoInit(document.currentScript, WAT);
}

// Public API - ESM 사용자를 위한 named exports
// 내부 구현 클래스(ContainerManager, StyleBatchProcessor 등)는 노출하지 않습니다.
export { WAT };
export { ErrorHandler } from './core/ErrorHandler.js';
export { StateManager } from './wat/StateManager.js';
export { TTSManager } from './tts/TTSManager.js';
export { STTManager } from './stt/STTManager.js';
