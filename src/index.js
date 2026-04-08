/**
 * @fileoverview WAT (Web Accessibility Tool) 진입점
 * @version __MODUWEB_VERSION__
 */
import { WAT } from './wat/WAT.js';

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

// Public API - ESM 사용자를 위한 named exports
// 내부 구현 클래스(ContainerManager, StyleBatchProcessor 등)는 노출하지 않습니다.
export { WAT };
export { ErrorHandler } from './core/ErrorHandler.js';
export { StateManager } from './wat/StateManager.js';
export { TTSManager } from './tts/TTSManager.js';
export { STTManager } from './stt/STTManager.js';
