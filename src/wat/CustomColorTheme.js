/**
 * @fileoverview 내 색상(사용자 지정 배경·글자색)의 저장소와 루트 CSS 변수 경계
 * @module src/wat/CustomColorTheme
 * @description 저장은 배경·글자색 두 값만 하고, 링크·보조색은 적용할 때마다 계산한다.
 *              JS는 전용 변수(--wat-custom-*)에만 쓰고, CSS가 data-color-theme="custom"일 때만
 *              기존 테마 변수에 연결한다 — 다른 색상 모드로 바꿔도 정리할 것이 없다.
 */
import { Constants } from '../core/constants.js';
import { safeParseJSON } from '../core/safeParseJSON.js';
import { normalizeHex, deriveThemeColors } from '../core/colorContrast.js';

/** 저장한 색이 없을 때 쓰는 조합 — 크림 바탕 진갈색 글자 (12.0:1, 눈부심 완화) */
export const CUSTOM_COLOR_DEFAULTS = Object.freeze({ bg: '#fdf6e3', fg: '#3b2f1e' });

/** 파생 색 → 루트 전용 변수 이름 (webAccTools.css의 :root[data-color-theme="custom"] 블록과 짝) */
export const CUSTOM_COLOR_VARS = Object.freeze({
	bg: '--wat-custom-bg',
	fg: '--wat-custom-fg',
	link: '--wat-custom-link',
	bgSub: '--wat-custom-bg-sub',
	fgSub: '--wat-custom-fg-sub'
});

// 링크가 본문과 색으로 구분되지 않을 때 밑줄을 켜는 플래그 (data-wat-link-underline)
const LINK_UNDERLINE_KEY = 'watLinkUnderline';

/** 배경색 견본 — 밝은 5색 × 어두운 글자 4색은 모두 7:1 이상 (견본 조합에 쓰인 색은 모두 포함) */
export const BG_SWATCHES = Object.freeze([
	{ id: 'white', hex: '#ffffff' },
	{ id: 'cream', hex: '#fdf6e3' },
	{ id: 'lightYellow', hex: '#fff8c5' },
	{ id: 'lightBlue', hex: '#e6f0fa' },
	{ id: 'lightGray', hex: '#e8e8e8' },
	{ id: 'darkGray', hex: '#333333' },
	{ id: 'navy', hex: '#0b1f3a' },
	{ id: 'black', hex: '#000000' }
]);

/** 글자색 견본 — 어두운 배경 3색 × 밝은 글자 4색도 모두 7:1 이상 */
export const FG_SWATCHES = Object.freeze([
	{ id: 'black', hex: '#000000' },
	{ id: 'darkBrown', hex: '#3b2f1e' },
	{ id: 'navy', hex: '#0b1f3a' },
	// #4d4d4d는 연회색 배경(#e8e8e8)과 6.9:1이라 #444444로 낮췄다
	{ id: 'darkGray', hex: '#444444' },
	{ id: 'white', hex: '#ffffff' },
	{ id: 'lightGray', hex: '#d9d9d9' },
	{ id: 'yellow', hex: '#ffff00' },
	{ id: 'skyBlue', hex: '#7fdbff' }
]);

/** 출발점으로 쓰는 견본 조합 */
export const CUSTOM_COLOR_PRESETS = Object.freeze([
	{ id: 'yellowOnBlack', bg: '#000000', fg: '#ffff00' },
	{ id: 'brownOnCream', bg: '#fdf6e3', fg: '#3b2f1e' },
	{ id: 'whiteOnNavy', bg: '#0b1f3a', fg: '#ffffff' },
	{ id: 'blackOnLightYellow', bg: '#fff8c5', fg: '#000000' },
	{ id: 'navyOnLightBlue', bg: '#e6f0fa', fg: '#0b1f3a' },
	// 빛에 민감한 사용자용 — 휘도가 낮은 조합
	{ id: 'lightGrayOnDarkGray', bg: '#333333', fg: '#d9d9d9' }
]);

/**
 * 저장된 내 색상을 불러옵니다
 * 가져오기 파일은 값 검증 없이 저장되므로(SettingsApplier.importSettings) 여기서 형식을 검증한다.
 * @param {Storage} [storage=localStorage]
 * @returns {{bg:string, fg:string}|null} 없거나 손상·위조된 값이면 null
 */
export function loadCustomColors(storage = globalThis.localStorage) {
	let raw;
	try {
		raw = storage.getItem(Constants.STORAGE_KEYS.CUSTOM_COLORS);
	} catch (e) {
		return null;
	}
	const saved = safeParseJSON(raw, null);
	if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
	const bg = normalizeHex(saved.bg);
	const fg = normalizeHex(saved.fg);
	return bg && fg ? { bg, fg } : null;
}

/**
 * 내 색상을 저장합니다
 * @param {{bg:string, fg:string}} colors
 * @param {Storage} [storage=localStorage]
 * @returns {boolean} 저장 성공 여부 (잘못된 색·저장소 예외면 false)
 */
export function saveCustomColors(colors, storage = globalThis.localStorage) {
	const bg = normalizeHex(colors && colors.bg);
	const fg = normalizeHex(colors && colors.fg);
	if (!bg || !fg) return false;
	try {
		storage.setItem(Constants.STORAGE_KEYS.CUSTOM_COLORS, JSON.stringify({ v: 1, bg, fg }));
		return true;
	} catch (e) {
		console.warn('[WAT] 내 색상 저장 실패:', e.message);
		return false;
	}
}

/**
 * 파생 색을 루트 요소의 전용 변수로 씁니다 (CSSOM이라 CSP의 인라인 스타일 제한에 걸리지 않는다)
 * @param {HTMLElement} root - 대상 루트 (문서 또는 iframe의 documentElement)
 * @param {{bg:string, fg:string}|null} colors - null이면 변수와 플래그를 지운다
 * @returns {Object|null} 적용한 파생 색 (deriveThemeColors 결과)
 */
export function applyCustomColorVars(root, colors) {
	if (!root || !root.style) return null;
	const theme = colors ? deriveThemeColors(colors.bg, colors.fg) : null;
	Object.entries(CUSTOM_COLOR_VARS).forEach(([key, name]) => {
		if (theme) {
			root.style.setProperty(name, theme[key]);
		} else {
			root.style.removeProperty(name);
		}
	});
	if (theme && theme.linkUnderline) {
		root.dataset[LINK_UNDERLINE_KEY] = 'true';
	} else {
		delete root.dataset[LINK_UNDERLINE_KEY];
	}
	return theme;
}

/**
 * 전용 변수와 밑줄 플래그를 다른 루트로 복사합니다 (원본에 없으면 대상에서도 지운다)
 * @param {HTMLElement} fromRoot - 메인 문서 루트
 * @param {HTMLElement} toRoot - 같은 출처 iframe 문서 루트
 * @returns {void}
 */
export function copyCustomColorVars(fromRoot, toRoot) {
	if (!fromRoot || !fromRoot.style || !toRoot || !toRoot.style) return;
	Object.values(CUSTOM_COLOR_VARS).forEach(name => {
		const value = fromRoot.style.getPropertyValue(name);
		if (value) {
			toRoot.style.setProperty(name, value);
		} else {
			toRoot.style.removeProperty(name);
		}
	});
	if (fromRoot.dataset[LINK_UNDERLINE_KEY]) {
		toRoot.dataset[LINK_UNDERLINE_KEY] = fromRoot.dataset[LINK_UNDERLINE_KEY];
	} else {
		delete toRoot.dataset[LINK_UNDERLINE_KEY];
	}
}
