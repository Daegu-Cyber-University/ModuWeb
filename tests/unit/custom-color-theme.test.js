/**
 * @fileoverview 내 색상 저장소·루트 변수 경계(CustomColorTheme) 단위 테스트
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Constants } from '../../src/core/constants.js';
import { CONTRAST, normalizeHex, contrastRatio, relativeLuminance, deriveThemeColors } from '../../src/core/colorContrast.js';
import {
	CUSTOM_COLOR_DEFAULTS,
	CUSTOM_COLOR_VARS,
	BG_SWATCHES,
	FG_SWATCHES,
	CUSTOM_COLOR_PRESETS,
	loadCustomColors,
	saveCustomColors,
	applyCustomColorVars,
	copyCustomColorVars
} from '../../src/wat/CustomColorTheme.js';

const KEY = 'watCustomColors';

function cleanRoot() {
	const root = document.documentElement;
	Object.values(CUSTOM_COLOR_VARS).forEach(name => root.style.removeProperty(name));
	delete root.dataset.watLinkUnderline;
}

beforeEach(() => {
	localStorage.clear();
	cleanRoot();
});

afterEach(() => {
	localStorage.clear();
	cleanRoot();
	jest.restoreAllMocks();
});

describe('저장 키', () => {
	test('STORAGE_KEYS에 watCustomColors가 있어 초기화·내보내기·가져오기 순회 대상이 된다', () => {
		expect(Constants.STORAGE_KEYS.CUSTOM_COLORS).toBe(KEY);
		expect(Object.values(Constants.STORAGE_KEYS)).toContain(KEY);
	});
});

describe('loadCustomColors', () => {
	test('저장값이 없으면 null', () => {
		expect(loadCustomColors()).toBeNull();
	});

	test('손상된 JSON이면 예외 없이 null', () => {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		localStorage.setItem(KEY, '{broken');
		expect(loadCustomColors()).toBeNull();
	});

	test('색 형식이 아니거나 CSS 주입 문자열이면 null (가져오기 파일은 값 검증 없이 저장되므로)', () => {
		[
			{ bg: 'red', fg: '#000000' },
			{ bg: '#ffffff', fg: '#fff;background:url(x)' },
			{ bg: '#ffffff' },
			['#ffffff', '#000000'],
			'string'
		].forEach(value => {
			localStorage.setItem(KEY, JSON.stringify(value));
			expect(loadCustomColors()).toBeNull();
		});
	});

	test('정상 값은 소문자 #rrggbb로 정규화해 돌려준다', () => {
		localStorage.setItem(KEY, JSON.stringify({ v: 1, bg: '#FDF6E3', fg: '3b2f1e' }));
		expect(loadCustomColors()).toEqual({ bg: '#fdf6e3', fg: '#3b2f1e' });
	});

	test('저장소 접근이 예외를 던져도 null', () => {
		const storage = { getItem: () => { throw new Error('denied'); } };
		expect(loadCustomColors(storage)).toBeNull();
	});
});

describe('saveCustomColors', () => {
	test('{v:1, bg, fg} 형식으로 정규화해 기록하고 true', () => {
		expect(saveCustomColors({ bg: '#000', fg: '#FFFF00' })).toBe(true);
		expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ v: 1, bg: '#000000', fg: '#ffff00' });
	});

	test('잘못된 색이면 기록하지 않고 false', () => {
		expect(saveCustomColors({ bg: 'nope', fg: '#000000' })).toBe(false);
		expect(saveCustomColors(null)).toBe(false);
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	test('저장소가 예외를 던지면(용량 초과 등) false', () => {
		const storage = { setItem: () => { throw new Error('QuotaExceeded'); } };
		expect(saveCustomColors({ bg: '#000000', fg: '#ffffff' }, storage)).toBe(false);
	});
});

describe('applyCustomColorVars', () => {
	test('파생 색 5개를 전용 변수로 쓴다', () => {
		const root = document.documentElement;
		applyCustomColorVars(root, { bg: '#000000', fg: '#ffff00' });
		const theme = deriveThemeColors('#000000', '#ffff00');
		expect(root.style.getPropertyValue(CUSTOM_COLOR_VARS.bg)).toBe(theme.bg);
		expect(root.style.getPropertyValue(CUSTOM_COLOR_VARS.fg)).toBe(theme.fg);
		expect(root.style.getPropertyValue(CUSTOM_COLOR_VARS.link)).toBe(theme.link);
		expect(root.style.getPropertyValue(CUSTOM_COLOR_VARS.bgSub)).toBe(theme.bgSub);
		expect(root.style.getPropertyValue(CUSTOM_COLOR_VARS.fgSub)).toBe(theme.fgSub);
	});

	test('기존 테마 변수(--wat-color-main 등)는 직접 건드리지 않는다', () => {
		const root = document.documentElement;
		applyCustomColorVars(root, { bg: '#000000', fg: '#ffff00' });
		expect(root.style.getPropertyValue('--wat-color-main')).toBe('');
		expect(root.style.getPropertyValue('--wat-bgColor-main')).toBe('');
	});

	test('링크가 본문과 색으로 구분되지 않으면 밑줄 플래그를 켜고, 구분되면 지운다', () => {
		const root = document.documentElement;
		applyCustomColorVars(root, { bg: '#fdf6e3', fg: '#3b2f1e' });
		expect(root.dataset.watLinkUnderline).toBe('true');
		applyCustomColorVars(root, { bg: '#000000', fg: '#ffff00' });
		expect(root.dataset.watLinkUnderline).toBeUndefined();
	});

	test('null이면 변수와 플래그를 모두 지운다', () => {
		const root = document.documentElement;
		applyCustomColorVars(root, { bg: '#fdf6e3', fg: '#3b2f1e' });
		applyCustomColorVars(root, null);
		Object.values(CUSTOM_COLOR_VARS).forEach(name => {
			expect(root.style.getPropertyValue(name)).toBe('');
		});
		expect(root.dataset.watLinkUnderline).toBeUndefined();
	});
});

describe('copyCustomColorVars', () => {
	test('변수와 밑줄 플래그를 다른 루트로 복사한다', () => {
		const from = document.documentElement;
		const to = document.createElement('div');
		applyCustomColorVars(from, { bg: '#fdf6e3', fg: '#3b2f1e' });
		copyCustomColorVars(from, to);
		Object.values(CUSTOM_COLOR_VARS).forEach(name => {
			expect(to.style.getPropertyValue(name)).toBe(from.style.getPropertyValue(name));
		});
		expect(to.dataset.watLinkUnderline).toBe('true');
	});

	test('원본에 없으면 대상에서도 지운다', () => {
		const from = document.createElement('div');
		const to = document.createElement('div');
		applyCustomColorVars(to, { bg: '#fdf6e3', fg: '#3b2f1e' });
		copyCustomColorVars(from, to);
		Object.values(CUSTOM_COLOR_VARS).forEach(name => {
			expect(to.style.getPropertyValue(name)).toBe('');
		});
		expect(to.dataset.watLinkUnderline).toBeUndefined();
	});

	test('style이 없는 루트는 예외 없이 무시한다', () => {
		expect(() => copyCustomColorVars(document.documentElement, {})).not.toThrow();
		expect(() => copyCustomColorVars(null, document.documentElement)).not.toThrow();
	});
});

describe('견본과 기본값', () => {
	test('견본 색은 모두 유효한 hex이고 슬롯 안에서 id가 겹치지 않는다', () => {
		[BG_SWATCHES, FG_SWATCHES].forEach(list => {
			expect(list.length).toBe(8);
			list.forEach(swatch => expect(normalizeHex(swatch.hex)).toBe(swatch.hex));
			expect(new Set(list.map(s => s.id)).size).toBe(list.length);
		});
	});

	test('견본 조합에 쓰인 색은 모두 해당 슬롯 견본에 있다 (조합을 고르면 견본이 체크되도록)', () => {
		CUSTOM_COLOR_PRESETS.forEach(preset => {
			expect(BG_SWATCHES.map(s => s.hex)).toContain(preset.bg);
			expect(FG_SWATCHES.map(s => s.hex)).toContain(preset.fg);
		});
	});

	test('밝은 배경 × 어두운 글자, 어두운 배경 × 밝은 글자 조합은 모두 7:1 이상이다', () => {
		// 검정·흰색과의 대비가 같아지는 휘도(약 0.179)를 경계로 밝고 어두움을 나눈다
		const isLight = hex => relativeLuminance(hex) > 0.179;
		BG_SWATCHES.forEach(bg => {
			FG_SWATCHES.filter(fg => isLight(fg.hex) !== isLight(bg.hex)).forEach(fg => {
				expect(contrastRatio(bg.hex, fg.hex)).toBeGreaterThanOrEqual(CONTRAST.AAA);
			});
		});
	});

	test('슬롯마다 밝은 색과 어두운 색을 3개 이상씩 둔다 (어느 쪽으로 고르든 짝이 될 견본이 있게)', () => {
		const isLight = hex => relativeLuminance(hex) > 0.179;
		[BG_SWATCHES, FG_SWATCHES].forEach(list => {
			expect(list.filter(s => isLight(s.hex)).length).toBeGreaterThanOrEqual(3);
			expect(list.filter(s => !isLight(s.hex)).length).toBeGreaterThanOrEqual(3);
		});
	});

	test('견본 조합은 모두 유효하고 AAA(7:1) 이상이며 id가 겹치지 않는다', () => {
		expect(CUSTOM_COLOR_PRESETS.length).toBe(6);
		CUSTOM_COLOR_PRESETS.forEach(preset => {
			expect(normalizeHex(preset.bg)).toBe(preset.bg);
			expect(normalizeHex(preset.fg)).toBe(preset.fg);
			expect(contrastRatio(preset.bg, preset.fg)).toBeGreaterThanOrEqual(CONTRAST.AAA);
		});
		expect(new Set(CUSTOM_COLOR_PRESETS.map(p => p.id)).size).toBe(CUSTOM_COLOR_PRESETS.length);
	});

	test('기본 조합은 크림 바탕 진갈색 글자이고 견본 조합에 들어 있다', () => {
		expect(CUSTOM_COLOR_DEFAULTS).toEqual({ bg: '#fdf6e3', fg: '#3b2f1e' });
		expect(CUSTOM_COLOR_PRESETS.some(p => p.bg === CUSTOM_COLOR_DEFAULTS.bg && p.fg === CUSTOM_COLOR_DEFAULTS.fg)).toBe(true);
	});
});
