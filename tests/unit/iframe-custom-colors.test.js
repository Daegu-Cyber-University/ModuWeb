/**
 * @fileoverview 내 색상 변수의 같은 출처 iframe 반영(IframeStyler) 단위 테스트
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { IframeStyler } from '../../src/wat/IframeStyler.js';
import { CUSTOM_COLOR_VARS, applyCustomColorVars } from '../../src/wat/CustomColorTheme.js';

function makeStyler() {
	return new IframeStyler({
		styleMode: 'static',
		excludeSelector: '',
		getFontFamily: jest.fn(() => '')
	});
}

function addIframe() {
	const iframe = document.createElement('iframe');
	document.body.appendChild(iframe);
	return iframe.contentDocument;
}

function cleanRoot() {
	const root = document.documentElement;
	applyCustomColorVars(root, null);
	delete root.dataset.colorTheme;
}

beforeEach(() => {
	document.body.innerHTML = '';
	cleanRoot();
});

afterEach(() => {
	document.body.innerHTML = '';
	cleanRoot();
});

describe('iframe 초기 처리(applyStylesToIframeDocument)', () => {
	test('내 색상 변수와 밑줄 플래그를 iframe 루트에 복사한다', () => {
		applyCustomColorVars(document.documentElement, { bg: '#fdf6e3', fg: '#3b2f1e' });
		document.documentElement.dataset.colorTheme = 'custom';
		const iframeDoc = addIframe();

		makeStyler().applyStylesToIframeDocument(iframeDoc, 'test-iframe');

		const iframeRoot = iframeDoc.documentElement;
		expect(iframeRoot.dataset.colorTheme).toBe('custom');
		Object.values(CUSTOM_COLOR_VARS).forEach(name => {
			expect(iframeRoot.style.getPropertyValue(name)).toBe(document.documentElement.style.getPropertyValue(name));
		});
		expect(iframeRoot.dataset.watLinkUnderline).toBe('true');
	});

	test('CSS link가 없는 standalone 환경에서도 예외 없이 처리한다', () => {
		applyCustomColorVars(document.documentElement, { bg: '#000000', fg: '#ffff00' });
		const iframeDoc = addIframe();

		expect(() => makeStyler().applyStylesToIframeDocument(iframeDoc, 'test-iframe')).not.toThrow();
	});
});

describe('색상 모드 동기화(syncStyleToIframes)', () => {
	test('colorTheme 동기화 때 변수를 복사한다', () => {
		const iframeDoc = addIframe();
		applyCustomColorVars(document.documentElement, { bg: '#0b1f3a', fg: '#ffffff' });

		makeStyler().syncStyleToIframes('colorTheme', 'custom');

		expect(iframeDoc.documentElement.dataset.colorTheme).toBe('custom');
		expect(iframeDoc.documentElement.style.getPropertyValue(CUSTOM_COLOR_VARS.bg)).toBe('#0b1f3a');
	});

	test('원본 루트에 변수가 없으면 iframe에서도 지운다', () => {
		const iframeDoc = addIframe();
		applyCustomColorVars(iframeDoc.documentElement, { bg: '#0b1f3a', fg: '#ffffff' });

		makeStyler().syncStyleToIframes('colorTheme', 'dark');

		expect(iframeDoc.documentElement.style.getPropertyValue(CUSTOM_COLOR_VARS.bg)).toBe('');
	});

	test('다른 스타일 동기화는 내 색상 변수를 건드리지 않는다', () => {
		const iframeDoc = addIframe();
		applyCustomColorVars(iframeDoc.documentElement, { bg: '#0b1f3a', fg: '#ffffff' });

		makeStyler().syncStyleToIframes('fontSize', 'size-2x');

		expect(iframeDoc.documentElement.style.getPropertyValue(CUSTOM_COLOR_VARS.bg)).toBe('#0b1f3a');
	});
});
