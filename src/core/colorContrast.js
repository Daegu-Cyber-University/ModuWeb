/**
 * @fileoverview 색 변환·명도 대비 계산 유틸리티 (WCAG 2.x 상대 휘도 기준)
 * @module src/core/colorContrast
 * @description '내 색상'의 추천색·파생 색(링크·보조색) 계산을 맡는 순수 함수 모음. DOM에 의존하지 않는다.
 */

/** 명도 대비 기준값 — AA(1.4.3), AAA(1.4.6), 링크와 주변 본문의 구분(1.4.1 기법 G183) */
export const CONTRAST = Object.freeze({ AA: 4.5, AAA: 7, LINK_VS_TEXT: 3 });

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
// 임계 휘도와 정확히 같은 값에서 부동소수 오차로 대비가 6.9999…가 되는 것을 막는 여유
const EPSILON = 1e-12;
// 검정·흰색과의 대비가 같아지는 휘도(약 0.179) — 이보다 어두운 배경에는 밝은 색이 대비가 크다
const MID_LUMINANCE = Math.sqrt(1.05 * 0.05) - 0.05;

/**
 * 색 문자열을 '#rrggbb' 소문자로 정규화합니다 ('#' 생략·3자리 허용)
 * @param {*} value - 검사할 값 (localStorage·가져오기 파일 등 외부 유래 값 포함)
 * @returns {string|null} 정규화된 hex, 형식이 다르면 null (CSS 주입 문자열도 여기서 걸러진다)
 */
export function normalizeHex(value) {
	if (typeof value !== 'string') return null;
	const match = HEX_PATTERN.exec(value.trim());
	if (!match) return null;
	let digits = match[1].toLowerCase();
	if (digits.length === 3) {
		digits = digits.split('').map(c => c + c).join('');
	}
	return '#' + digits;
}

/**
 * @param {string} hex
 * @returns {{r:number, g:number, b:number}|null} 0~255 채널, 잘못된 색이면 null
 */
export function hexToRgb(hex) {
	const normalized = normalizeHex(hex);
	if (!normalized) return null;
	const n = parseInt(normalized.slice(1), 16);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * @param {{r:number, g:number, b:number}} rgb - 채널 값 (범위 밖 값은 0~255로 자르고 반올림)
 * @returns {string} '#rrggbb'
 */
export function rgbToHex({ r, g, b }) {
	return '#' + [r, g, b]
		.map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'))
		.join('');
}

/**
 * @param {string} hex
 * @returns {{h:number, s:number, l:number}|null} h 0~360, s·l 0~1
 */
export function hexToHsl(hex) {
	const rgb = hexToRgb(hex);
	if (!rgb) return null;
	const r = rgb.r / 255;
	const g = rgb.g / 255;
	const b = rgb.b / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	let h = 0;
	let s = 0;
	if (d !== 0) {
		s = d / (1 - Math.abs(2 * l - 1));
		if (max === r) {
			h = 60 * (((g - b) / d) % 6);
		} else if (max === g) {
			h = 60 * ((b - r) / d + 2);
		} else {
			h = 60 * ((r - g) / d + 4);
		}
		if (h < 0) h += 360;
	}
	return { h, s, l };
}

/**
 * @param {{h:number, s:number, l:number}} hsl
 * @returns {string} '#rrggbb'
 */
export function hslToHex({ h, s, l }) {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const hp = (((h % 360) + 360) % 360) / 60;
	const x = c * (1 - Math.abs((hp % 2) - 1));
	let rgb;
	if (hp < 1) rgb = [c, x, 0];
	else if (hp < 2) rgb = [x, c, 0];
	else if (hp < 3) rgb = [0, c, x];
	else if (hp < 4) rgb = [0, x, c];
	else if (hp < 5) rgb = [x, 0, c];
	else rgb = [c, 0, x];
	const m = l - c / 2;
	return rgbToHex({ r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 });
}

/**
 * WCAG 2.x 상대 휘도
 * @param {string} hex
 * @returns {number} 0~1, 잘못된 색이면 NaN
 */
export function relativeLuminance(hex) {
	const rgb = hexToRgb(hex);
	if (!rgb) return NaN;
	const linear = channel => {
		const v = channel / 255;
		return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

/**
 * 두 색의 명도 대비 (순서 무관)
 * @param {string} a
 * @param {string} b
 * @returns {number} 1~21 원값 (판정은 이 값으로, 표시는 floorRatio로)
 */
export function contrastRatio(a, b) {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * 표시용 대비 — 반올림하면 4.49가 "4.5"로 보여 기준 충족으로 오해되므로 내림한다
 * @param {number} ratio
 * @param {number} [digits=1] - 소수 자릿수
 * @returns {number}
 */
export function floorRatio(ratio, digits = 1) {
	const factor = Math.pow(10, digits);
	// 여유값을 더하지 않는다 — 기준 바로 아래 값이 기준값으로 보이면 contrastLevel 판정과 어긋난다
	return Math.floor(ratio * factor) / factor;
}

/**
 * @param {number} ratio
 * @returns {'aaa'|'aa'|'low'}
 */
export function contrastLevel(ratio) {
	if (ratio >= CONTRAST.AAA) return 'aaa';
	if (ratio >= CONTRAST.AA) return 'aa';
	return 'low';
}

/**
 * sRGB 채널 선형 보간
 * @param {string} a - t=0일 때의 색
 * @param {string} b - t=1일 때의 색
 * @param {number} t - 0~1
 * @returns {string|null}
 */
export function mixHex(a, b, t) {
	const ca = hexToRgb(a);
	const cb = hexToRgb(b);
	if (!ca || !cb) return null;
	return rgbToHex({
		r: ca.r + (cb.r - ca.r) * t,
		g: ca.g + (cb.g - ca.g) * t,
		b: ca.b + (cb.b - ca.b) * t
	});
}

/**
 * 색조·채도를 고정하고 명도만 움직여 휘도 경계에 닿는 명도를 찾습니다.
 * 같은 h·s에서는 명도가 커질수록 RGB 각 채널이 줄지 않으므로 휘도가 단조 증가한다 — 그래서 이분 탐색이 성립한다.
 * (대비는 앵커 휘도를 지나며 줄었다 늘어 단조롭지 않으므로 대비로 직접 탐색하면 틀린다)
 * @param {number} h
 * @param {number} s
 * @param {number} limit - 휘도 경계
 * @param {'dark'|'light'} side - dark: 휘도 ≤ limit인 가장 큰 명도, light: 휘도 ≥ limit인 가장 작은 명도
 * @returns {number} 명도 (판정은 8비트로 반올림한 hex 기준이라 결과 색이 경계를 실제로 만족한다)
 */
function lightnessAtLuminance(h, s, limit, side) {
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		const y = relativeLuminance(hslToHex({ h, s, l: mid }));
		if (side === 'dark') {
			if (y <= limit) lo = mid; else hi = mid;
		} else {
			if (y >= limit) hi = mid; else lo = mid;
		}
	}
	return side === 'dark' ? lo : hi;
}

/**
 * 앵커 색과 목표 대비를 이루는 상대편 색을 추천합니다 (상대편 색의 색조 유지, 명도만 최소 조정)
 * @param {string} anchorHex - 사용자가 방금 고른 색
 * @param {string} targetHex - 추천 대상 슬롯의 현재 색 (색조의 기준)
 * @param {{target?: number}} [options] - 목표 대비 (기본 7:1)
 * @returns {{hex:string, ratio:number, method:'keep'|'hue'|'blackWhite'}|null}
 *          keep: 이미 목표 이상 / hue: 같은 색조로 맞춤 / blackWhite: 같은 색조로는 불가해 검정·흰색 중 대비 큰 쪽
 *          (blackWhite도 항상 √21≈4.58 이상이라 AA는 보장된다)
 */
export function suggestCounterpart(anchorHex, targetHex, { target = CONTRAST.AAA } = {}) {
	const anchor = normalizeHex(anchorHex);
	const current = normalizeHex(targetHex);
	if (!anchor || !current) return null;

	const currentRatio = contrastRatio(anchor, current);
	if (currentRatio >= target) {
		return { hex: current, ratio: currentRatio, method: 'keep' };
	}

	const anchorLuminance = relativeLuminance(anchor);
	const { h, s, l } = hexToHsl(current);
	const candidates = [];
	const darkLimit = (anchorLuminance + 0.05) / target - 0.05 - EPSILON;
	if (darkLimit >= 0) candidates.push(lightnessAtLuminance(h, s, darkLimit, 'dark'));
	const lightLimit = target * (anchorLuminance + 0.05) - 0.05 + EPSILON;
	if (lightLimit <= 1) candidates.push(lightnessAtLuminance(h, s, lightLimit, 'light'));

	if (candidates.length > 0) {
		const nearest = candidates.reduce((a, b) => (Math.abs(a - l) <= Math.abs(b - l) ? a : b));
		const hex = hslToHex({ h, s, l: nearest });
		return { hex, ratio: contrastRatio(anchor, hex), method: 'hue' };
	}

	const hex = contrastRatio(anchor, '#000000') >= contrastRatio(anchor, '#ffffff') ? '#000000' : '#ffffff';
	return { hex, ratio: contrastRatio(anchor, hex), method: 'blackWhite' };
}

// 링크색 후보 색조 (파랑 → 보라 → 청록 → 자주 → 초록 → 주황) — 관례상 링크로 읽히는 파랑을 먼저 시도
const LINK_HUES = [215, 265, 190, 300, 140, 30];
const LINK_SATURATION = 0.9;

/**
 * 배경과 정확히 ratio 대비가 되는(배경에서 가장 가까운) 색을 지정 색조로 만듭니다
 * @returns {string|null} 그 방향으로 ratio가 불가능하면 null
 */
function colorAtContrastBoundary(bg, hue, ratio) {
	const bgLuminance = relativeLuminance(bg);
	if (bgLuminance < MID_LUMINANCE) {
		const limit = ratio * (bgLuminance + 0.05) - 0.05 + EPSILON;
		if (limit > 1) return null;
		return hslToHex({ h: hue, s: LINK_SATURATION, l: lightnessAtLuminance(hue, LINK_SATURATION, limit, 'light') });
	}
	const limit = (bgLuminance + 0.05) / ratio - 0.05 - EPSILON;
	if (limit < 0) return null;
	return hslToHex({ h: hue, s: LINK_SATURATION, l: lightnessAtLuminance(hue, LINK_SATURATION, limit, 'dark') });
}

/**
 * 링크색을 계산합니다 — 배경과 4.5:1 이상, 가능하면 본문과 3:1 이상 구분
 * 배경에 가장 가까운 4.5:1 경계색을 쓰면 반대편에 있는 본문색과의 차이가 가장 커진다.
 * @param {string} bgHex
 * @param {string} fgHex
 * @returns {{hex:string, underline:boolean}|null} underline: 색만으로 본문과 구분되지 않아 밑줄이 필요함
 */
export function deriveLinkColor(bgHex, fgHex) {
	const bg = normalizeHex(bgHex);
	const fg = normalizeHex(fgHex);
	if (!bg || !fg) return null;

	for (const hue of LINK_HUES) {
		const hex = colorAtContrastBoundary(bg, hue, CONTRAST.AA);
		if (hex && contrastRatio(hex, fg) >= CONTRAST.LINK_VS_TEXT) {
			return { hex, underline: false };
		}
	}
	// 색으로는 본문과 구분할 수 없으면 밑줄로 구분하고, 색은 배경과 더 또렷하게 (가능하면 7:1)
	const hex = colorAtContrastBoundary(bg, LINK_HUES[0], CONTRAST.AAA) || colorAtContrastBoundary(bg, LINK_HUES[0], CONTRAST.AA);
	return { hex, underline: true };
}

// 보조 배경은 주 배경에서 본문 쪽으로 이만큼 섞는다 (사전 결과·발음 상자 구분용)
const SUB_BG_MIX = 0.06;
// 보조 글자색은 본문에서 배경 쪽으로 최대 이만큼까지 흐리게
const SUB_FG_MAX_MIX = 35;

/**
 * 보조 배경색·보조 글자색을 계산합니다 (placeholder, 사전 발음 상자 등이 쓰는 --wat-*-sub)
 * @param {string} bgHex
 * @param {string} fgHex
 * @returns {{bgSub:string, fgSub:string}|null} 보조 글자색은 보조·주 배경 모두와 4.5:1 이상인 범위에서 가장 흐린 색
 *          (본문 대비가 원래 부족하면 본문색 그대로)
 */
export function deriveSubColors(bgHex, fgHex) {
	const bg = normalizeHex(bgHex);
	const fg = normalizeHex(fgHex);
	if (!bg || !fg) return null;

	const bgSub = mixHex(bg, fg, SUB_BG_MIX);
	let fgSub = fg;
	// 채널마다 보간 방향이 달라 휘도가 단조롭지 않을 수 있으므로 이분 탐색 대신 1% 단위로 훑는다
	for (let step = SUB_FG_MAX_MIX; step > 0; step--) {
		const candidate = mixHex(fg, bg, step / 100);
		if (contrastRatio(candidate, bgSub) >= CONTRAST.AA && contrastRatio(candidate, bg) >= CONTRAST.AA) {
			fgSub = candidate;
			break;
		}
	}
	return { bgSub, fgSub };
}

/**
 * '내 색상' 테마에 필요한 색 전체를 계산합니다 (저장은 bg·fg만, 나머지는 적용할 때마다 이 함수로 파생)
 * @param {string} bgHex
 * @param {string} fgHex
 * @returns {{bg:string, fg:string, link:string, linkUnderline:boolean, bgSub:string, fgSub:string}|null}
 */
export function deriveThemeColors(bgHex, fgHex) {
	const bg = normalizeHex(bgHex);
	const fg = normalizeHex(fgHex);
	if (!bg || !fg) return null;
	const link = deriveLinkColor(bg, fg);
	const sub = deriveSubColors(bg, fg);
	return { bg, fg, link: link.hex, linkUnderline: link.underline, bgSub: sub.bgSub, fgSub: sub.fgSub };
}

// [상한, 키] — 값이 상한 미만인 첫 구간
const TONE_STEPS = [[0.2, 'veryDark'], [0.38, 'dark'], [0.62, 'base'], [0.8, 'light'], [Infinity, 'veryLight']];
const HUE_STEPS = [
	[15, 'red'], [40, 'orange'], [65, 'yellow'], [90, 'yellowGreen'], [150, 'green'], [185, 'teal'],
	[205, 'sky'], [240, 'blue'], [265, 'indigo'], [290, 'purple'], [320, 'magenta'], [345, 'pink'], [Infinity, 'red']
];
const pickStep = (steps, value) => steps.find(([limit]) => value < limit)[1];

/**
 * 스크린리더가 '#2b2100'을 한 글자씩 읽지 않도록 대략적인 색 이름을 고릅니다 (문구는 로케일이 정한다)
 * 무채색도 '밝은 회색'처럼 명도 단계 + 회색으로 부른다 — 견본 이름(검정·진회색·연회색·흰색)을 쓰면
 * 견본과 다른 색이 같은 이름으로 불려 같은 색으로 오해된다.
 * @param {string} hex
 * @returns {{kind:'neutral'|'chromatic', tone:string, hue:string}|null} 무채색의 hue는 'gray'
 */
export function describeColor(hex) {
	const hsl = hexToHsl(hex);
	if (!hsl) return null;
	const { h, s, l } = hsl;
	// 채도가 낮거나 아주 어둡고 밝은 색은 색조보다 명도로 부르는 편이 정확하다
	if (s < 0.15 || l < 0.06 || l > 0.96) {
		return { kind: 'neutral', tone: pickStep(TONE_STEPS, l), hue: 'gray' };
	}
	return { kind: 'chromatic', tone: pickStep(TONE_STEPS, l), hue: pickStep(HUE_STEPS, h) };
}
