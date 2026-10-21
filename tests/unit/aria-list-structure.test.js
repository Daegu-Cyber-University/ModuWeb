/**
 * @fileoverview 탭 목록·라디오 그룹의 소유 구조 — ul에 tablist·radiogroup 역할을 주면 안쪽 li는 role="none"이어야 한다 (WCAG 1.3.1)
 * @description
 *   ul[role=tablist]·ul[role=radiogroup] 안의 li가 암묵적 listitem 역할을 그대로 가지면
 *   - tab·radio가 tablist·radiogroup에 직접 속하지 않아 "N개 중 X번째" 같은 그룹 정보가 끊기고
 *   - 목록 밖 listitem이 생겨 axe aria-required-children·aria-required-parent·listitem 위반이 난다.
 *   탭 목록은 실제 _createTabNavigation, 라디오 그룹은 실제 PanelBuilder로 만든다.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';

/** 역할이 없어도 의미가 없는 태그 — 소유 관계 사이에 끼어도 된다 */
const GENERIC_TAGS = ['DIV', 'SPAN'];
const PRESENTATIONAL_ROLES = ['none', 'presentation'];

/**
 * element에서 위로 올라가 ownerRole을 가진 조상까지 가는 사이의 요소가 모두 의미 없는(generic·none) 요소인지
 * @param {Element} element - tab 또는 radio
 * @param {string} ownerRole - 'tablist' | 'radiogroup'
 * @returns {Element[]} 소유 관계를 끊는 중간 요소 목록 (비어 있어야 정상)
 */
function blockingAncestors(element, ownerRole) {
	const blocking = [];
	let node = element.parentElement;
	while (node && node.getAttribute('role') !== ownerRole) {
		const role = node.getAttribute('role');
		const isGeneric = role === null ? GENERIC_TAGS.includes(node.tagName) : PRESENTATIONAL_ROLES.includes(role);
		if (!isGeneric) blocking.push(node);
		node = node.parentElement;
	}
	if (!node) throw new Error(`${ownerRole} 조상이 없다`);
	return blocking;
}

function makeWat() {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.fontSizeRatios = { initial: 1, 'size-1p5x': 1.5 };
	wat.getLocalizedText = jest.fn((key) => key);
	wat.loadWebFont = jest.fn();
	return wat;
}

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('패널 탭 목록', () => {
	test('탭 버튼과 tablist 사이의 li는 role="none"이라 탭이 tablist에 직접 속한다', () => {
		const mainPanel = document.createElement('div');
		document.body.appendChild(mainPanel);
		makeWat()._createTabNavigation(mainPanel);

		const tabs = Array.from(mainPanel.querySelectorAll('[role="tab"]'));
		expect(tabs).toHaveLength(2);
		tabs.forEach((tab) => {
			expect(blockingAncestors(tab, 'tablist').map((el) => el.tagName)).toEqual([]);
		});
	});
});

describe('개인 옵션 라디오 그룹', () => {
	test.each(['fontSize', 'fontFamily', 'colorTheme', 'readGuide'])('%s: 라디오와 radiogroup 사이의 li는 role="none"이다', (option) => {
		const li = makeWat()._getPanelBuilder().buildOption(option);
		document.body.appendChild(li);

		const radios = Array.from(li.querySelectorAll('input[type="radio"]'));
		expect(radios.length).toBeGreaterThan(1);
		radios.forEach((radio) => {
			expect(blockingAncestors(radio, 'radiogroup').map((el) => el.tagName)).toEqual([]);
		});
	});

	test('라디오가 아닌 항목(스위치·버튼)의 목록은 목록 구조를 그대로 둔다', () => {
		const builder = makeWat()._getPanelBuilder();
		['stopAni', 'pageScroll'].forEach((option) => {
			const list = builder.buildOption(option).querySelector('ul.opt_lists');
			expect(list.hasAttribute('role')).toBe(false);
			list.querySelectorAll(':scope > li').forEach((item) => expect(item.hasAttribute('role')).toBe(false));
		});
	});
});
