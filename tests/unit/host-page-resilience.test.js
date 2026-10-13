/**
 * @fileoverview 호스트 페이지에 붙었을 때의 위젯 표시 계약 (글자색 보호·축소 아이콘 띠·버튼 묶음 크기)
 * @description
 *   - 호스트의 전역 규칙(예: * {color: #333})은 요소에 직접 적용되어 상속보다 우선한다.
 *     어두운 배경 위 위젯 글자가 부모 색 상속에만 기대면 호스트 색에 덮여 대비가 무너진다 (WCAG 1.4.3).
 *   - 축소 상태는 200px 폭의 아이콘 띠로 기능 아이콘과 조작 버튼을 보여야 한다.
 *   - 버튼형 항목(화면 낭독·페이지 스크롤 등)의 조작 버튼은 글리프·아이콘 크기나 호스트 글꼴과
 *     상관없이 같은 크기로 한 줄을 채워야 한다.
 *   jsdom은 CSS 명시도·상속을 계산하지 않으므로 CSS는 규칙 계약으로 검증하고,
 *   실제 렌더링은 브라우저에서 확인한다.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WAT } from '../../src/wat/WAT.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, '..', '..', 'dist', 'assets', 'css', 'webAccTools.css');
const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 셀렉터 목록을 최상위 쉼표로만 나눈다 (:is(a, b) 안의 쉼표는 구분자가 아님)
 * @param {string} group - 셀렉터 목록 문자열
 * @returns {string[]} 공백을 정규화한 셀렉터 배열
 */
function splitSelectors(group) {
	const out = [];
	let buf = '';
	let depth = 0;
	for (const ch of group) {
		if (ch === '(' || ch === '[') depth++;
		else if (ch === ')' || ch === ']') depth--;
		else if (ch === ',' && depth === 0) {
			out.push(buf);
			buf = '';
			continue;
		}
		buf += ch;
	}
	out.push(buf);
	return out.map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

/** CSS의 모든 규칙을 { selectors, body } 목록으로 반환 (@media 내부 규칙 포함) */
function rules() {
	return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
		selectors: splitSelectors(m[1].replace(/^[\s\S]*@[a-z-]+[^{]*$/, '')),
		body: m[2]
	}));
}

/**
 * 셀렉터 목록에 target이 들어 있는 규칙들의 선언을 이어 붙여 반환
 * @param {string} target - 찾을 셀렉터
 */
function declarationsFor(target) {
	return rules()
		.filter((rule) => rule.selectors.includes(target))
		.map((rule) => rule.body)
		.join(';');
}

describe('호스트 전역 글자색 규칙에 대한 보호 (WCAG 1.4.3)', () => {
	test('헤더 제목은 흰 글자색을 직접 지정한다 — 상속에만 기대면 호스트 * {color}에 덮인다', () => {
		expect(declarationsFor('#wat_title')).toMatch(/(^|[;\s])color:\s*#fff(fff)?\s*(;|$)/i);
	});

	test('알림의 메시지·아이콘은 알림 상자의 흰 글자색을 직접 상속한다', () => {
		expect(declarationsFor('.wat-user-feedback > *')).toMatch(/color:\s*inherit/);
	});

	test('음성 명령 상태 표시의 문구는 상태 상자의 흰 글자색을 직접 상속한다', () => {
		expect(declarationsFor('.wat-voice-status > *')).toMatch(/color:\s*inherit/);
	});
});

describe('축소 상태 — 200px 아이콘 띠', () => {
	test('패널 본문을 접거나 높이를 헤더만큼 줄이지 않는다 (아이콘·조작 버튼 표시)', () => {
		expect(declarationsFor('.wat-minimized #wat_panel_Opt')).not.toMatch(/display:\s*none/);
		expect(declarationsFor('.wat-minimized #watWrap')).not.toMatch(/(^|[;\s])height:/);
	});

	test('탭을 숨기고, 기능 목록을 1열로 놓고, 제목 글자를 접어 아이콘만 남긴다', () => {
		expect(declarationsFor('.wat-minimized #wat_panel_Opt_tab')).toMatch(/display:\s*none/);
		expect(declarationsFor('.wat-container.wat-minimized #wat .personalList')).toMatch(/grid-template-columns:\s*1fr\s*(;|$)/);
		expect(declarationsFor('.wat-container.wat-minimized #wat .setWrap .setTitle')).toMatch(/font-size:\s*0\s*(;|$)/);
	});

	test('아이콘 배치 규칙은 목록 보기에서도 축소 상태에 적용된다', () => {
		// 아이콘 보기 전용으로만 걸린 규칙이 남아 있으면 목록 보기의 축소 띠가 좁은 폭에 깨진다
		const iconModeSelectors = rules()
			.flatMap((rule) => rule.selectors)
			.filter((selector) => selector.includes('data-wat-viewmode="icon"'));
		expect(iconModeSelectors.length).toBeGreaterThan(0);
		expect(iconModeSelectors.filter((selector) => !selector.includes('.wat-minimized'))).toEqual([]);
	});
});

/**
 * 선언 문자열에서 속성의 px 값을 읽는다 (min-height·line-height처럼 이름 끝이 같은 속성과 구분)
 * @param {string} declarations - declarationsFor가 돌려준 선언 문자열
 * @param {string} property - 속성 이름
 * @returns {number|null} px 값, 선언이 없으면 null
 */
function pxValue(declarations, property) {
	const match = declarations.match(new RegExp(`(?:^|[;\\s])${property}:\\s*([\\d.]+)px`));
	return match ? Number(match[1]) : null;
}

/**
 * padding 축약 선언에서 위아래 여백의 합(px)을 읽는다
 * @param {string} declarations - declarationsFor가 돌려준 선언 문자열
 * @returns {number|null} 위아래 여백 합, padding 선언이 없으면 null
 */
function verticalPadding(declarations) {
	const match = declarations.match(/(?:^|[;\s])padding:\s*([^;]+)/);
	if (!match) return null;
	const [top, , bottom = top] = match[1].trim().split(/\s+/).map((value) => parseFloat(value) || 0);
	return top + bottom;
}

describe('버튼형 항목의 조작 버튼 — 글리프·아이콘 크기와 상관없이 같은 크기', () => {
	const ITEM = '#watWrap .setWrap.button .opt_lists .opt_item';
	const BUTTON = '#watWrap .setWrap.button .opt_lists .btn_basic';
	const GLYPH = '#watWrap .setWrap.button .opt_lists .btn_iconSet::after';
	const FOCUS_ICON = '#watWrap .setWrap.button .opt_lists .btn_iconSet.btn_focus::after';

	test('칸 너비를 내용과 상관없이 똑같이 나눈다 — 화면 낭독의 돋보기 버튼만 넓어지지 않는다', () => {
		expect(declarationsFor(ITEM)).toMatch(/(^|[;\s])flex:\s*1 1 0(px|%)?\s*(;|$)/);
		expect(declarationsFor(ITEM)).toMatch(/min-width:\s*0/);
	});

	test('버튼 최소 높이 안에 가장 큰 아이콘이 들어가 아이콘 버튼만 높아지지 않는다 (24px 이상, WCAG 2.5.8)', () => {
		const minHeight = pxValue(declarationsFor(BUTTON), 'min-height');
		const iconHeight = pxValue(declarationsFor(FOCUS_ICON), 'height');
		expect(minHeight).toBeGreaterThanOrEqual(24);
		// 위아래 여백과 아래 테두리 1px을 더해도 최소 높이를 넘지 않아야 모든 버튼 높이가 같다
		expect(iconHeight + verticalPadding(declarationsFor(BUTTON)) + 1).toBeLessThanOrEqual(minHeight);
	});

	test('호스트의 button 여백이나 글꼴 줄 높이에 버튼 크기가 흔들리지 않는다', () => {
		expect(verticalPadding(declarationsFor(BUTTON))).not.toBeNull();
		expect(declarationsFor(GLYPH)).toMatch(/line-height:\s*1\s*(;|$)/);
	});
});

describe('toggleMinimize — 축소하면 아이콘 목록(개별 설정 탭)을 보여준다', () => {
	beforeEach(() => {
		localStorage.clear();
		document.body.innerHTML = `
			<div id="watContainer" class="wat-container">
				<button type="button" id="wat_btnMinimize"></button>
				<ul role="tablist">
					<li><button type="button" role="tab" id="wat_personal" aria-selected="false" tabindex="-1">개별 설정</button></li>
					<li><button type="button" role="tab" id="wat_settings" aria-selected="true" tabindex="0">환경설정</button></li>
				</ul>
				<div id="wat_Panel_Opt_personal" role="tabpanel" aria-labelledby="wat_personal" hidden></div>
				<div id="wat_Panel_Opt_settings" role="tabpanel" aria-labelledby="wat_settings"></div>
			</div>
		`;
	});

	test('환경설정 탭을 보던 중 축소하면 개별 설정 탭으로 전환된다', () => {
		const wat = Object.create(WAT.prototype);
		wat.container = document.getElementById('watContainer');
		wat.getLocalizedText = jest.fn((key) => key);

		wat.toggleMinimize();

		expect(wat.container.classList.contains('wat-minimized')).toBe(true);
		expect(document.getElementById('wat_personal').getAttribute('aria-selected')).toBe('true');
		expect(document.getElementById('wat_Panel_Opt_personal').hidden).toBe(false);
		expect(document.getElementById('wat_Panel_Opt_settings').hidden).toBe(true);
	});
});
