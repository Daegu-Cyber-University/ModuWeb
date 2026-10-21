/**
 * @fileoverview 내 색상 WAT 연결(changeColorTheme 훅·getCustomColors·setCustomColors) 단위 테스트
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { deriveThemeColors } from '../../src/core/colorContrast.js';
import { CUSTOM_COLOR_DEFAULTS, CUSTOM_COLOR_VARS } from '../../src/wat/CustomColorTheme.js';

function makeWat() {
	const wat = Object.create(WAT.prototype);
	wat.updatePersonalSettingsUI = jest.fn();
	wat.savePreferences = jest.fn();
	wat.syncStyleToIframes = jest.fn();
	return wat;
}

function cleanRoot() {
	const root = document.documentElement;
	Object.values(CUSTOM_COLOR_VARS).forEach(name => root.style.removeProperty(name));
	delete root.dataset.watLinkUnderline;
	delete root.dataset.colorTheme;
}

const rootVar = name => document.documentElement.style.getPropertyValue(name);

beforeEach(() => {
	localStorage.clear();
	cleanRoot();
});

afterEach(() => {
	localStorage.clear();
	cleanRoot();
	jest.restoreAllMocks();
});

describe('changeColorTheme(\'custom\')', () => {
	test('저장된 색으로 루트 전용 변수를 쓰고 색상 모드를 custom으로 바꾼다', () => {
		localStorage.setItem('watCustomColors', JSON.stringify({ v: 1, bg: '#000000', fg: '#ffff00' }));
		const wat = makeWat();

		wat.changeColorTheme('custom');

		const theme = deriveThemeColors('#000000', '#ffff00');
		expect(document.documentElement.dataset.colorTheme).toBe('custom');
		expect(rootVar(CUSTOM_COLOR_VARS.bg)).toBe(theme.bg);
		expect(rootVar(CUSTOM_COLOR_VARS.fg)).toBe(theme.fg);
		expect(rootVar(CUSTOM_COLOR_VARS.link)).toBe(theme.link);
	});

	test('저장한 색이 없으면 기본 조합으로 바로 동작한다 (색상 모드 순환 중 오류 없음)', () => {
		const wat = makeWat();

		wat.changeColorTheme('custom');

		expect(rootVar(CUSTOM_COLOR_VARS.bg)).toBe(CUSTOM_COLOR_DEFAULTS.bg);
		expect(rootVar(CUSTOM_COLOR_VARS.fg)).toBe(CUSTOM_COLOR_DEFAULTS.fg);
	});

	test('변수를 쓴 뒤에 iframe 동기화를 한다 (iframe이 새 값을 복사하도록)', () => {
		const wat = makeWat();
		wat.syncStyleToIframes = jest.fn(() => {
			expect(rootVar(CUSTOM_COLOR_VARS.bg)).toBe(CUSTOM_COLOR_DEFAULTS.bg);
		});

		wat.changeColorTheme('custom');

		expect(wat.syncStyleToIframes).toHaveBeenCalledWith('colorTheme', 'custom');
	});

	test('다른 색상 모드에서는 전용 변수를 건드리지 않는다', () => {
		localStorage.setItem('watCustomColors', JSON.stringify({ v: 1, bg: '#000000', fg: '#ffff00' }));
		const wat = makeWat();

		['initial', 'light', 'dark', 'reverse'].forEach(theme => wat.changeColorTheme(theme));

		expect(rootVar(CUSTOM_COLOR_VARS.bg)).toBe('');
		expect(document.documentElement.dataset.colorTheme).toBe('reverse');
	});
});

describe('getCustomColors / setCustomColors', () => {
	test('getCustomColors는 저장값을, 없으면 null을 돌려준다', () => {
		const wat = makeWat();
		expect(wat.getCustomColors()).toBeNull();
		localStorage.setItem('watCustomColors', JSON.stringify({ v: 1, bg: '#0B1F3A', fg: '#FFFFFF' }));
		expect(wat.getCustomColors()).toEqual({ bg: '#0b1f3a', fg: '#ffffff' });
	});

	test('setCustomColors는 저장하고 색상 모드를 custom으로 바꾼 뒤 true', () => {
		const wat = makeWat();
		wat.changeColorTheme = jest.fn();

		expect(wat.setCustomColors({ bg: '#0b1f3a', fg: '#ffffff' })).toBe(true);

		expect(JSON.parse(localStorage.getItem('watCustomColors'))).toEqual({ v: 1, bg: '#0b1f3a', fg: '#ffffff' });
		expect(wat.changeColorTheme).toHaveBeenCalledWith('custom');
	});

	test('잘못된 색이면 저장·모드 변경 없이 false', () => {
		const wat = makeWat();
		wat.changeColorTheme = jest.fn();

		expect(wat.setCustomColors({ bg: 'url(x)', fg: '#ffffff' })).toBe(false);

		expect(localStorage.getItem('watCustomColors')).toBeNull();
		expect(wat.changeColorTheme).not.toHaveBeenCalled();
	});
});
