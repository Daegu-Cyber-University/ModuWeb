import { describe, it, expect } from '@jest/globals';
import { escapeHtml, sanitizeDictionaryUrl } from '../../src/core/htmlEscape.js';

describe('htmlEscape', () => {
	describe('escapeHtml', () => {
		it('이스케이프 특수문자', () => {
			expect(escapeHtml('<a href="x">y</a>')).toBe(
				'&lt;a href=&quot;x&quot;&gt;y&lt;/a&gt;'
			);
		});

		it('null/undefined 는 빈 문자열', () => {
			expect(escapeHtml(null)).toBe('');
			expect(escapeHtml(undefined)).toBe('');
		});
	});

	describe('sanitizeDictionaryUrl', () => {
		it('http/https 만 통과', () => {
			expect(sanitizeDictionaryUrl('https://dict.example/entry')).toBe(
				'https://dict.example/entry'
			);
			expect(sanitizeDictionaryUrl('http://dict.example/entry')).toBe(
				'http://dict.example/entry'
			);
		});

		it('javascript: 등 위험 스킴 거부', () => {
			expect(sanitizeDictionaryUrl('javascript:alert(1)')).toBeNull();
			expect(sanitizeDictionaryUrl('data:text/html,xxx')).toBeNull();
		});

		it('상대 경로는 base 인자로 해석', () => {
			expect(sanitizeDictionaryUrl('/path', 'https://site.example/root/')).toBe(
				'https://site.example/path'
			);
		});
	});
});
