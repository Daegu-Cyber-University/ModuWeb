/**
 * @fileoverview HTML 이스케이프 유틸리티
 * @module src/core/escapeHTML
 */

/**
 * HTML 템플릿 문자열에 삽입되는 외부 유래 값(config 라벨 등)의 이스케이프 — XSS 방지
 * @param {*} value - 이스케이프할 값 (null/undefined는 빈 문자열로)
 * @returns {string} 이스케이프된 문자열
 */
export function escapeHTML(value) {
	if (value === null || value === undefined) return '';
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
