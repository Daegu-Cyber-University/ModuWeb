/**
 * @fileoverview 위젯 자체 글자의 명도 대비 계약 — 알림 상자·바닥글 (WCAG 1.4.3)
 * @description
 *   - _notify 알림은 흰 글자 14px(보통 크기)인데 배경이 성공 #10b981(2.54:1)·경고 #f59e0b(2.15:1)·
 *     정보 #3b82f6(3.68:1)·오류 #ef4444(3.76:1)로 4.5:1에 못 미쳤다.
 *   - 바닥글 링크(.dcu-link, 12px 굵게)는 #0d6efd on #f8f8f8(4.24:1)이었다.
 *   글자색·배경색은 CSS 규칙에서 읽고, 대비는 WCAG 상대 휘도 공식(colorContrast.contrastRatio)으로 잰다.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { contrastRatio } from '../../src/core/colorContrast.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, '..', '..', 'dist', 'assets', 'css', 'webAccTools.css');
const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** 셀렉터 목록을 최상위 쉼표로만 나눈다 (:is(a, b) 안의 쉼표는 구분자가 아님) */
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

/** 최상위(@media 밖) 규칙만 { selectors, body } 목록으로 반환 — 기본 표시 색을 읽는다 */
function topLevelRules() {
	const out = [];
	let depth = 0;
	let start = 0;
	let selector = '';
	for (let i = 0; i < css.length; i++) {
		const ch = css[i];
		if (ch === '{') {
			if (depth === 0) {
				selector = css.slice(start, i);
				start = i + 1;
			}
			depth++;
		} else if (ch === '}') {
			depth--;
			if (depth === 0) {
				if (!selector.trim().startsWith('@')) {
					out.push({ selectors: splitSelectors(selector), body: css.slice(start, i) });
				}
				start = i + 1;
			}
		}
	}
	return out;
}

/**
 * 셀렉터 하나에 걸린 최상위 규칙에서 속성의 마지막 #hex 값을 읽는다
 * @param {string} target - 셀렉터
 * @param {string} property - 'color' | 'background-color'
 * @returns {string|null} #rrggbb 또는 #rgb
 */
function hexFor(target, property) {
	const bodies = topLevelRules().filter((rule) => rule.selectors.includes(target)).map((rule) => rule.body).join(';');
	const matches = [...bodies.matchAll(new RegExp(`(?:^|[;\\s{])${property}:\\s*(#[0-9a-fA-F]{3,6})\\b`, 'g'))];
	return matches.length ? matches[matches.length - 1][1] : null;
}

describe('알림 상자 — 흰 글자 14px가 배경과 4.5:1 이상', () => {
	const text = hexFor('.wat-user-feedback', 'color');

	test('알림 글자색은 흰색이다 (전제)', () => {
		expect(text).toMatch(/^#fff(fff)?$/i);
	});

	test.each(['success', 'error', 'warning', 'info'])('%s 알림 배경', (type) => {
		const background = hexFor(`.wat-feedback-${type}`, 'background-color');
		expect(background).not.toBeNull();
		expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
	});
});

describe('바닥글 — 12px 글자가 배경과 4.5:1 이상', () => {
	const background = hexFor('#wat_footer', 'background-color');

	test('저작권 문구', () => {
		expect(contrastRatio(hexFor('#wat_footer', 'color'), background)).toBeGreaterThanOrEqual(4.5);
	});

	test('대구사이버대학교 링크(.dcu-link)', () => {
		expect(contrastRatio(hexFor('#wat_footer .dcu-link', 'color'), background)).toBeGreaterThanOrEqual(4.5);
	});
});
