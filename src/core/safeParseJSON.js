/**
 * @fileoverview 안전한 JSON 파싱 유틸리티
 * @module src/core/safeParseJSON
 */

/**
 * localStorage 등 외부 유래 문자열의 안전한 JSON 파싱 — 손상된 값이 초기화 전체를 중단시키지 않도록
 * @param {string|null} raw - 파싱할 원본 문자열
 * @param {*} [fallback={}] - 파싱 실패/빈 값일 때 반환할 기본값
 * @returns {*} 파싱 결과 또는 기본값
 */
export function safeParseJSON(raw, fallback = {}) {
	if (raw === null || raw === undefined) return fallback;
	try {
		return JSON.parse(raw);
	} catch (e) {
		console.warn('[WAT] 저장된 설정 값이 손상되어 기본값을 사용합니다:', e.message);
		return fallback;
	}
}
