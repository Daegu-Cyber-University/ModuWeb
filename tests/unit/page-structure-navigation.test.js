/**
 * @fileoverview 페이지 구조 대화상자에서 항목으로 이동 — 포커스가 대상으로 옮겨 가고, 이동 버튼마다 이름이 다르다
 * @description
 *   - 제목·랜드마크·링크로 이동하면 대화상자만 닫히고 포커스가 body로 사라져, 키보드 사용자는 처음부터
 *     다시 탭해야 했다 (WCAG 2.4.3). 대상이 포커스를 받을 수 없으면 임시 tabindex=-1을 주고 옮긴다.
 *   - '해당 위치로 이동' 버튼의 이름이 모두 같아 어느 항목으로 가는지 알 수 없었다 (WCAG 2.4.6).
 *   실제 openPageStructure로 대화상자를 열고, 포커스 트랩·정리는 실제 OverlayManager를 쓴다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PageStructure } from '../../src/wat/PageStructure.js';
import { OverlayManager } from '../../src/wat/OverlayManager.js';

const MARKER = '해당 위치로 이동';

function makePageStructure() {
	const plugin = {
		selector: '#watContainer',
		getLocalizedText: jest.fn((key) => (key === 'panel.personal.options.pageStructure.options.marker' ? MARKER : `[${key}]`)),
		_assetUrl: jest.fn((path) => `/${path}`)
	};
	plugin.overlayManager = new OverlayManager(plugin);
	plugin.trapFocus = (layer, previous, overlay) => plugin.overlayManager.trap(layer, previous, overlay);
	return new PageStructure(plugin);
}

/** 대화상자를 열고 해당 탭 패널의 이동 버튼 목록을 돌려준다 */
function openAndGetMarkers(tabId) {
	makePageStructure().openPageStructure();
	return Array.from(document.querySelectorAll(`#${tabId}_panel .btn_marker`));
}

/** 버튼의 접근 이름 — aria-label이 없으면 내용(이미지 alt)에서 계산된다 */
function accessibleName(button) {
	if (button.hasAttribute('aria-label')) return button.getAttribute('aria-label');
	return Array.from(button.querySelectorAll('img')).map((img) => img.alt).join(' ').trim() || button.textContent.trim();
}

beforeEach(() => {
	document.body.innerHTML = `
		<div id="watContainer"><button id="opener">페이지 구조</button></div>
		<header><h1 id="h-site">사이트 이름</h1></header>
		<main id="main-area">
			<h2 id="h-news">새 소식</h2>
			<p><a id="link-guide" href="/guide">이용 안내</a> <a id="link-faq" href="/faq">자주 묻는 질문</a></p>
		</main>`;
	// jsdom은 scrollIntoView를 구현하지 않는다
	Element.prototype.scrollIntoView = jest.fn();
	document.getElementById('opener').focus();
});

afterEach(() => {
	delete Element.prototype.scrollIntoView;
	document.body.innerHTML = '';
	document.body.className = '';
});

describe('항목으로 이동하면 포커스가 대상으로 옮겨 간다 (WCAG 2.4.3)', () => {
	test('제목으로 이동하면 그 제목에 포커스가 가고, 포커스가 떠나면 임시 tabindex를 지운다', () => {
		const markers = openAndGetMarkers('pgStruct_heading');
		const heading = document.getElementById('h-news');

		markers[1].click();

		expect(document.getElementById('pgStructure_layer')).toBeNull();
		expect(document.activeElement).toBe(heading);
		expect(heading.getAttribute('tabindex')).toBe('-1');
		expect(heading.scrollIntoView).toHaveBeenCalled();

		document.getElementById('opener').focus();
		expect(heading.hasAttribute('tabindex')).toBe(false);
	});

	test('랜드마크로 이동하면 그 영역에 포커스가 간다', () => {
		const markers = openAndGetMarkers('pgStruct_landmark');
		const main = document.getElementById('main-area');
		// 수집 순서: banner(header), main
		markers[1].click();

		expect(document.activeElement).toBe(main);
	});

	test('링크로 이동하면 원래 링크에 포커스가 가고 tabindex는 건드리지 않는다', () => {
		const markers = openAndGetMarkers('pgStruct_link');
		const link = document.getElementById('link-faq');

		markers[1].click();

		expect(document.activeElement).toBe(link);
		expect(link.hasAttribute('tabindex')).toBe(false);
	});

	test('페이지가 이미 tabindex를 준 대상은 이동 뒤에도 그 값을 지우지 않는다', () => {
		const heading = document.getElementById('h-news');
		heading.setAttribute('tabindex', '-1');
		const markers = openAndGetMarkers('pgStruct_heading');

		markers[1].click();
		document.getElementById('opener').focus();

		expect(heading.getAttribute('tabindex')).toBe('-1');
	});
});

describe('이동 버튼의 이름에 항목이 들어간다 (WCAG 2.4.6)', () => {
	test.each([
		['pgStruct_heading', ['사이트 이름', '새 소식']],
		['pgStruct_link', ['이용 안내', '자주 묻는 질문']]
	])('%s: 버튼마다 항목 텍스트를 포함해 이름이 서로 다르다', (tabId, itemTexts) => {
		const names = openAndGetMarkers(tabId).map(accessibleName);

		expect(names).toHaveLength(itemTexts.length);
		names.forEach((name, i) => {
			expect(name).toContain(itemTexts[i]);
			expect(name).toContain(MARKER);
		});
		expect(new Set(names).size).toBe(names.length);
	});
});
