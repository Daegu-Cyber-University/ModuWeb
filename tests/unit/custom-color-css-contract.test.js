/**
 * @fileoverview 내 색상 CSS 계약 — custom 테마 블록과 평탄화 규칙이 JS(CustomColorTheme)와 맞물리는지 검증
 * @description jsdom은 CSS 캐스케이드를 계산하지 않으므로 규칙 텍스트로 계약을 고정하고,
 *              실제 렌더링은 브라우저에서 확인한다.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deriveThemeColors } from '../../src/core/colorContrast.js';
import { CUSTOM_COLOR_DEFAULTS, CUSTOM_COLOR_VARS } from '../../src/wat/CustomColorTheme.js';

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

/** CSS의 모든 규칙을 { selectors, body } 목록으로 반환 */
function rules() {
	return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
		selectors: splitSelectors(m[1].replace(/^[\s\S]*@[a-z-]+[^{]*$/, '')),
		body: m[2]
	}));
}

const CUSTOM_ROOT = ':root[data-color-theme="custom"]';
const DARK_ROOT = ':root[data-color-theme="dark"]';

// 기존 테마 변수 ← 내 색상 전용 변수(파생 색 키)
const THEME_VAR_LINKS = {
	'--wat-color-main': 'fg',
	'--wat-color-sub': 'fgSub',
	'--wat-color-link': 'link',
	'--wat-bgColor-main': 'bg',
	'--wat-bgColor-sub': 'bgSub'
};

function customBlockBody() {
	return rules()
		.filter((rule) => rule.selectors.length === 1 && rule.selectors[0] === CUSTOM_ROOT)
		.map((rule) => rule.body)
		.join(';');
}

describe('custom 테마 변수 블록', () => {
	test('기존 테마 변수 5개를 --wat-custom-* 전용 변수에 연결한다', () => {
		const body = customBlockBody();
		Object.entries(THEME_VAR_LINKS).forEach(([themeVar, key]) => {
			const pattern = new RegExp(`${themeVar}:\\s*var\\(\\s*${CUSTOM_COLOR_VARS[key]}\\s*,`);
			expect(body).toMatch(pattern);
		});
	});

	test('var() 폴백값은 기본 조합에서 계산한 색과 같다 (JS와 CSS의 단일 출처)', () => {
		const body = customBlockBody();
		const theme = deriveThemeColors(CUSTOM_COLOR_DEFAULTS.bg, CUSTOM_COLOR_DEFAULTS.fg);
		Object.entries(THEME_VAR_LINKS).forEach(([themeVar, key]) => {
			const match = new RegExp(`${themeVar}:\\s*var\\(\\s*${CUSTOM_COLOR_VARS[key]}\\s*,\\s*(#[0-9a-f]{6})\\s*\\)`, 'i').exec(body);
			expect(match).not.toBeNull();
			expect(match[1].toLowerCase()).toBe(theme[key]);
		});
	});

	test('위젯 포커스 테두리 색(--wat-color-point-tp1)은 바꾸지 않는다 — 위젯 배경은 흰색 고정', () => {
		expect(customBlockBody()).not.toMatch(/--wat-color-point-tp1/);
	});
});

describe('평탄화 규칙', () => {
	test('어둡게 모드의 페이지 규칙마다 같은 규칙 안에 내 색상 짝이 있다', () => {
		const darkRules = rules().filter((rule) => rule.selectors.some((s) => s.startsWith(`${DARK_ROOT} `)));
		// 배경·글자, 인라인 투명, 의사요소, 링크, 폼 컨트롤, placeholder
		expect(darkRules.length).toBeGreaterThanOrEqual(6);
		darkRules.forEach((rule) => {
			rule.selectors
				.filter((s) => s.startsWith(`${DARK_ROOT} `))
				.forEach((darkSelector) => {
					expect(rule.selectors).toContain(darkSelector.replace(DARK_ROOT, CUSTOM_ROOT));
				});
		});
	});

	test('링크 밑줄은 내 색상이면서 밑줄 플래그가 켜졌을 때만 적용한다', () => {
		const underlineRules = rules().filter((rule) => /text-decoration-line:\s*underline/.test(rule.body)
			&& rule.selectors.some((s) => s.includes('data-wat-link-underline')));
		expect(underlineRules.length).toBe(1);
		underlineRules[0].selectors.forEach((selector) => {
			expect(selector.startsWith(`${CUSTOM_ROOT}[data-wat-link-underline="true"] `)).toBe(true);
		});
	});
});

describe('편집기 스타일', () => {
	/** 셀렉터 목록에 target이 들어 있는 규칙들의 선언을 이어 붙여 반환 */
	function declarationsFor(target) {
		return rules()
			.filter((rule) => rule.selectors.includes(target))
			.map((rule) => rule.body)
			.join(';');
	}

	test('색 칩과 미리보기는 Windows 고대비(강제 색상) 모드에서도 고른 색을 그대로 보인다', () => {
		expect(declarationsFor('#watWrap .wat-cc-chip')).toMatch(/forced-color-adjust:\s*none/);
		expect(declarationsFor('#watWrap .wat-cc-preview')).toMatch(/forced-color-adjust:\s*none/);
	});

	test('편집기 안의 [hidden] 요소는 다른 display 규칙이 있어도 숨겨진다', () => {
		expect(declarationsFor('#watWrap .wat-cc [hidden]')).toMatch(/display:\s*none\s*!important/);
	});

	test('편집기 셀렉터는 모두 #watWrap 아래로 한정된다 (호스트 페이지 누수 방지)', () => {
		rules()
			.flatMap((rule) => rule.selectors)
			.filter((selector) => selector.includes('wat-cc'))
			.forEach((selector) => expect(selector.startsWith('#watWrap ')).toBe(true));
	});
});
