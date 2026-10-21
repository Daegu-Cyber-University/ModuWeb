import { describe, test, expect } from '@jest/globals';
import {
	CONTRAST,
	normalizeHex,
	hexToRgb,
	rgbToHex,
	hexToHsl,
	hslToHex,
	relativeLuminance,
	contrastRatio,
	floorRatio,
	contrastLevel,
	mixHex,
	suggestCounterpart,
	deriveLinkColor,
	deriveSubColors,
	deriveThemeColors,
	describeColor
} from '../../src/core/colorContrast.js';

// 시드 고정 의사난수 (mulberry32) — 속성 테스트를 매번 같은 입력으로 재현
function seededRandom(seed) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function randomHex(rand) {
	return '#' + [0, 1, 2].map(() => Math.floor(rand() * 256).toString(16).padStart(2, '0')).join('');
}

// 편집기 견본 조합과 같은 색 — 파생 색 조건을 실제 사용 조합으로 검증
const SAMPLE_PAIRS = [
	['#000000', '#ffff00'],
	['#fdf6e3', '#3b2f1e'],
	['#0b1f3a', '#ffffff'],
	['#fff8c5', '#000000'],
	['#e6f0fa', '#0b1f3a'],
	['#333333', '#d9d9d9'],
	['#ffffff', '#000000']
];

describe('normalizeHex', () => {
	test('6자리·3자리·# 생략·대문자·앞뒤 공백을 #rrggbb 소문자로 정규화한다', () => {
		expect(normalizeHex('#ABCDEF')).toBe('#abcdef');
		expect(normalizeHex('abcdef')).toBe('#abcdef');
		expect(normalizeHex('#abc')).toBe('#aabbcc');
		expect(normalizeHex('abc')).toBe('#aabbcc');
		expect(normalizeHex('  #abc ')).toBe('#aabbcc');
	});

	test('색 이름·잘못된 길이·CSS 주입 문자열·비문자열은 거부한다', () => {
		['red', '#12345', '#ggg', '#fff;}', '#fff;background:url(x)', '', null, undefined, 123, {}].forEach(value => {
			expect(normalizeHex(value)).toBeNull();
		});
	});
});

describe('RGB·HSL 변환', () => {
	test('hexToRgb와 rgbToHex는 서로 되돌린다', () => {
		expect(hexToRgb('#0b1f3a')).toEqual({ r: 11, g: 31, b: 58 });
		expect(rgbToHex({ r: 11, g: 31, b: 58 })).toBe('#0b1f3a');
	});

	test('rgbToHex는 범위를 벗어난 채널을 0~255로 자르고 반올림한다', () => {
		expect(rgbToHex({ r: -10, g: 127.6, b: 300 })).toBe('#0080ff');
	});

	test('HSL 왕복 변환의 오차는 채널당 1 이하다', () => {
		const rand = seededRandom(7);
		for (let i = 0; i < 200; i++) {
			const hex = randomHex(rand);
			const back = hexToRgb(hslToHex(hexToHsl(hex)));
			const orig = hexToRgb(hex);
			expect(Math.abs(back.r - orig.r)).toBeLessThanOrEqual(1);
			expect(Math.abs(back.g - orig.g)).toBeLessThanOrEqual(1);
			expect(Math.abs(back.b - orig.b)).toBeLessThanOrEqual(1);
		}
	});
});

describe('휘도와 대비', () => {
	test('relativeLuminance: 검정 0, 흰색 1, #777777은 약 0.184', () => {
		expect(relativeLuminance('#000000')).toBe(0);
		expect(relativeLuminance('#ffffff')).toBe(1);
		expect(relativeLuminance('#777777')).toBeCloseTo(0.1845, 3);
	});

	test('contrastRatio: 검정/흰색은 21, 순서와 무관하다', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
		expect(contrastRatio('#3b2f1e', '#fdf6e3')).toBeCloseTo(contrastRatio('#fdf6e3', '#3b2f1e'), 10);
	});

	test('contrastRatio: #777777과 흰색은 AA(4.5) 미만이다', () => {
		expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(CONTRAST.AA);
	});

	test('floorRatio는 올리지 않고 내린다 — 4.49를 4.5로 보이지 않게', () => {
		expect(floorRatio(4.583)).toBe(4.5);
		expect(floorRatio(4.49)).toBe(4.4);
		expect(floorRatio(7.02)).toBe(7);
		expect(floorRatio(21)).toBe(21);
	});

	test('floorRatio 표시는 contrastLevel 판정과 어긋나지 않는다 (기준 바로 아래 값)', () => {
		expect(floorRatio(4.49999999999)).toBeLessThan(CONTRAST.AA);
		expect(floorRatio(6.99999999999)).toBeLessThan(CONTRAST.AAA);
	});

	test('contrastLevel 경계값', () => {
		expect(contrastLevel(21)).toBe('aaa');
		expect(contrastLevel(7)).toBe('aaa');
		expect(contrastLevel(6.99)).toBe('aa');
		expect(contrastLevel(4.5)).toBe('aa');
		expect(contrastLevel(4.49)).toBe('low');
	});

	test('mixHex는 sRGB 채널을 선형 보간한다', () => {
		expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
		expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
		expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
	});
});

describe('suggestCounterpart', () => {
	test('이미 목표 대비 이상이면 바꾸지 않는다(keep)', () => {
		const result = suggestCounterpart('#ffffff', '#000000');
		expect(result.method).toBe('keep');
		expect(result.hex).toBe('#000000');
		expect(result.ratio).toBeCloseTo(21, 5);
	});

	test('같은 색조로 7:1을 맞출 수 있으면 대상 색의 색조를 유지한다', () => {
		const result = suggestCounterpart('#000000', '#3b2f1e');
		expect(result.method).toBe('hue');
		expect(result.ratio).toBeGreaterThanOrEqual(CONTRAST.AAA);
		expect(Math.abs(hexToHsl(result.hex).h - hexToHsl('#3b2f1e').h)).toBeLessThanOrEqual(2);
	});

	test('밝은 배경에 밝은 글자색이면 같은 색조의 짙은 색을 추천한다', () => {
		const result = suggestCounterpart('#fdf6e3', '#ffff00');
		expect(result.method).toBe('hue');
		expect(result.ratio).toBeGreaterThanOrEqual(CONTRAST.AAA);
		expect(relativeLuminance(result.hex)).toBeLessThan(relativeLuminance('#fdf6e3'));
	});

	test('목표 대비에 아주 근접한 최소 조정을 고른다(7.0~7.3)', () => {
		const result = suggestCounterpart('#ffffff', '#7fdbff');
		expect(result.ratio).toBeGreaterThanOrEqual(CONTRAST.AAA);
		expect(result.ratio).toBeLessThan(7.3);
	});

	test('같은 색조로 7:1이 불가능하면 검정·흰색 중 대비가 큰 쪽(빨강 → 검정)', () => {
		const result = suggestCounterpart('#ff0000', '#3b2f1e');
		expect(result.method).toBe('blackWhite');
		expect(result.hex).toBe('#000000');
	});

	test('무작위 500쌍: 결과 대비는 항상 √21 이상, hue 방식은 7 이상, ratio는 실제 대비와 같다', () => {
		const rand = seededRandom(20261021);
		for (let i = 0; i < 500; i++) {
			const anchor = randomHex(rand);
			const target = randomHex(rand);
			const result = suggestCounterpart(anchor, target);
			expect(result.ratio).toBeCloseTo(contrastRatio(anchor, result.hex), 10);
			expect(result.ratio).toBeGreaterThanOrEqual(Math.sqrt(21) - 1e-9);
			if (result.method !== 'blackWhite') {
				expect(result.ratio).toBeGreaterThanOrEqual(CONTRAST.AAA);
			}
		}
	});

	test('잘못된 색이면 null', () => {
		expect(suggestCounterpart('red', '#000000')).toBeNull();
		expect(suggestCounterpart('#000000', '#12')).toBeNull();
	});
});

describe('deriveLinkColor', () => {
	test.each(SAMPLE_PAIRS)('배경 %s / 본문 %s: 링크는 배경과 4.5 이상, 밑줄이 없으면 본문과 3 이상', (bg, fg) => {
		const { hex, underline } = deriveLinkColor(bg, fg);
		expect(contrastRatio(hex, bg)).toBeGreaterThanOrEqual(CONTRAST.AA);
		if (!underline) {
			expect(contrastRatio(hex, fg)).toBeGreaterThanOrEqual(CONTRAST.LINK_VS_TEXT);
		}
	});

	test('검정 바탕 노란 글자는 밑줄 없이 본문과 구분되는 링크색을 쓴다', () => {
		expect(deriveLinkColor('#000000', '#ffff00').underline).toBe(false);
	});

	test('크림 바탕 진갈색 글자는 본문과 구분이 어려워 밑줄을 긋고, 대신 배경과 7 이상으로 또렷하게', () => {
		const { hex, underline } = deriveLinkColor('#fdf6e3', '#3b2f1e');
		expect(underline).toBe(true);
		expect(contrastRatio(hex, '#fdf6e3')).toBeGreaterThanOrEqual(CONTRAST.AAA);
	});
});

describe('deriveSubColors', () => {
	test.each(SAMPLE_PAIRS)('배경 %s / 본문 %s: 보조 글자색은 보조 배경·주 배경 모두와 4.5 이상', (bg, fg) => {
		const { bgSub, fgSub } = deriveSubColors(bg, fg);
		expect(contrastRatio(fgSub, bgSub)).toBeGreaterThanOrEqual(CONTRAST.AA);
		expect(contrastRatio(fgSub, bg)).toBeGreaterThanOrEqual(CONTRAST.AA);
	});

	test('보조 배경은 주 배경과 거의 같은 색이다(본문 쪽으로 6%)', () => {
		expect(deriveSubColors('#ffffff', '#000000').bgSub).toBe(mixHex('#ffffff', '#000000', 0.06));
	});
});

describe('deriveThemeColors', () => {
	test('정규화한 주 색과 링크·보조 색을 함께 돌려준다', () => {
		const theme = deriveThemeColors('#FDF6E3', '3b2f1e');
		const link = deriveLinkColor('#fdf6e3', '#3b2f1e');
		const sub = deriveSubColors('#fdf6e3', '#3b2f1e');
		expect(theme).toEqual({
			bg: '#fdf6e3',
			fg: '#3b2f1e',
			link: link.hex,
			linkUnderline: link.underline,
			bgSub: sub.bgSub,
			fgSub: sub.fgSub
		});
	});

	test('잘못된 색이면 null', () => {
		expect(deriveThemeColors('#fff;}', '#000000')).toBeNull();
	});
});

describe('describeColor', () => {
	test('무채색은 회색과 명도 단계로 — 견본 이름(검정·진회색·연회색·흰색)과 다른 어휘를 쓴다', () => {
		expect(describeColor('#000000')).toEqual({ kind: 'neutral', tone: 'veryDark', hue: 'gray' });
		expect(describeColor('#ffffff')).toEqual({ kind: 'neutral', tone: 'veryLight', hue: 'gray' });
		expect(describeColor('#808080')).toEqual({ kind: 'neutral', tone: 'base', hue: 'gray' });
		expect(describeColor('#bebebe')).toEqual({ kind: 'neutral', tone: 'light', hue: 'gray' });
	});

	test('유채색은 명도 단계와 색조 이름', () => {
		expect(describeColor('#ff0000')).toEqual({ kind: 'chromatic', tone: 'base', hue: 'red' });
		expect(describeColor('#0b1f3a')).toEqual({ kind: 'chromatic', tone: 'veryDark', hue: 'blue' });
		expect(describeColor('#ffff00')).toEqual({ kind: 'chromatic', tone: 'base', hue: 'yellow' });
	});

	test('잘못된 색이면 null', () => {
		expect(describeColor('nope')).toBeNull();
	});
});
