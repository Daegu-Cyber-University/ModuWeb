/**
 * @fileoverview 색상 모드 '반전'과 채도 조절을 함께 켤 때의 filter 계약
 * @description
 *   - 반전(:root[data-color-theme="reverse"])과 채도(:root[data-saturation="…"])는 둘 다
 *     :root의 filter 한 속성을 쓰고 특이도가 같다(0,2,0). 조합 규칙이 없으면 뒤에 선언된
 *     채도 filter가 invert(1)을 덮어, 페이지는 반전되지 않고 재반전 규칙이 걸린
 *     미디어·위젯만 뒤집혀 보인다.
 *   - 조합은 invert(1)을 먼저 둔다. 미디어·위젯은 invert(1)로 재반전되므로, 채도 필터가
 *     뒤에 와야 재반전 결과에 채도만 남아 채도 단독 모드와 같은 모습이 된다.
 *     (색약 보정 url() 필터는 색 공간이 달라 invert와 순서를 바꾸면 결과가 달라진다)
 *   jsdom은 filter를 렌더링하지 않으므로 CSS 규칙 계약으로 검증하고,
 *   실제 화면은 examples/color-filter.html에서 확인한다.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, '..', '..', 'dist', 'assets', 'css', 'webAccTools.css');
const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** 패널의 채도 옵션 가운데 filter를 거는 값 (initial 제외) */
const SATURATION_LEVELS = ['low', 'high', 'monochrome', 'protanopia', 'deuteranopia'];

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
 * :root에 속성 셀렉터만 붙은 셀렉터에서 속성 목록을 정렬해 반환 (순서 무관 비교용)
 * @param {string} selector - 정규화된 셀렉터
 * @returns {string|null} 'a|b' 형태 키, :root 속성 셀렉터가 아니면 null
 */
function rootAttributeKey(selector) {
	const match = selector.match(/^:root((?:\[[^\]]+\])+)$/);
	return match ? match[1].slice(1, -1).split('][').sort().join('|') : null;
}

/**
 * 주어진 속성 셀렉터를 모두(그리고 그것만) 단 :root 규칙의 filter 값 — 같은 셀렉터가
 * 여러 번 나오면 마지막 선언을 따른다
 * @param {...string} attributes - 속성 셀렉터 본문 (예: 'data-saturation="low"')
 * @returns {string|null} filter 값, 없으면 null
 */
function rootFilter(...attributes) {
	const key = [...attributes].sort().join('|');
	const filters = rules()
		.filter((rule) => rule.selectors.some((selector) => rootAttributeKey(selector) === key))
		.map((rule) => rule.body.match(/(?:^|[;\s])filter:\s*([^;]+)/))
		.filter(Boolean)
		.map((match) => match[1].trim());
	return filters.length > 0 ? filters[filters.length - 1] : null;
}

describe('색상 모드 반전 + 채도 조절', () => {
	test('반전 단독은 invert(1)을 건다', () => {
		expect(rootFilter('data-color-theme="reverse"')).toBe('invert(1)');
	});

	test.each(SATURATION_LEVELS)('반전 + 채도 %s: invert(1) 뒤에 해당 채도 필터를 함께 건다', (level) => {
		const saturationFilter = rootFilter(`data-saturation="${level}"`);
		expect(saturationFilter).not.toBeNull();
		expect(rootFilter('data-color-theme="reverse"', `data-saturation="${level}"`))
			.toBe(`invert(1) ${saturationFilter}`);
	});
});
