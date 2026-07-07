/**
 * @fileoverview 외부 유래 URL의 안전성 검증 유틸 (WAT.js/Dictionary.js 공용)
 * @module src/core/safeUrl
 */

/**
 * config 등 외부 유래 URL의 스킴을 검증합니다 — javascript: 등 위험 스킴 차단
 * @param {string} url - 검증할 URL
 * @returns {boolean} http(s) URL이면 true
 */
export function isSafeHttpUrl(url) {
	if (typeof url !== 'string' || !url) return false;
	try {
		const parsed = new URL(url, typeof document !== 'undefined' ? document.baseURI : undefined);
		return parsed.protocol === 'https:' || parsed.protocol === 'http:';
	} catch (e) {
		return false;
	}
}
