/**
 * 사전·외부 문자열 표시용 HTML 이스케이프 및 URL 검증
 * @module src/core/htmlEscape
 */

/**
 * 텍스트 노드나 attribute에 넣기 전 HTML 특수문자 이스케이프
 * @param {*} value - 원본 값
 * @returns {string}
 */
export function escapeHtml(value) {
	if (value == null) return '';
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * 사전 링크 등 사용자에게 노출할 http(s) URL만 허용
 * @param {string} href - 후보 URL
 * @param {string} [base=typeof location !== 'undefined' ? location.href : 'https://example.org/'] - URL 해석 기준
 * @returns {string|null} - 안전하면 정규화된 href, 아니면 null
 */
export function sanitizeDictionaryUrl(href, base) {
	if (!href || typeof href !== 'string') return null;
	const b = base ?? (typeof window !== 'undefined' && window.location
		? window.location.href
		: 'https://example.org/');
	try {
		const u = new URL(href.trim(), b);
		if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
	} catch {
		/* invalid URL */
	}
	return null;
}
