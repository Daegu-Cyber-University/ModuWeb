/**
 * @fileoverview 내 색상 편집기(CustomColorEditor) 단위 테스트
 * @description 추천 흐름(배경·글자 대칭, 승인·거절, 추천 핑퐁 방지), 저장·취소, 입력 검증,
 *              기존 패널 이벤트 위임과의 비간섭을 검증한다. 문구는 실제 ko 로케일을 쓴다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WAT } from '../../src/wat/WAT.js';
import { Defaults } from '../../src/core/defaults.js';
import { CONTRAST, contrastRatio } from '../../src/core/colorContrast.js';
import { CustomColorEditor } from '../../src/wat/CustomColorEditor.js';
import { BG_SWATCHES, FG_SWATCHES } from '../../src/wat/CustomColorTheme.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ko = JSON.parse(readFileSync(join(__dirname, '..', '..', 'dist', 'assets', 'locales', 'ko.json'), 'utf8'));

const ANNOUNCE_DELAY = 500;

function makePlugin() {
	const plugin = Object.create(WAT.prototype);
	plugin.options = {};
	plugin.state = { get: jest.fn(key => (key === 'locale' ? ko : undefined)), set: jest.fn() };
	plugin._setTimeout = jest.fn((cb, delay) => setTimeout(cb, delay));
	plugin._clearTimeout = jest.fn(id => clearTimeout(id));
	plugin._announceToLiveRegion = jest.fn();
	plugin._notify = jest.fn();
	plugin.setCustomColors = jest.fn(() => true);
	return plugin;
}

function mount(plugin = makePlugin()) {
	const editor = new CustomColorEditor(plugin);
	const root = editor.build();
	document.body.appendChild(root);
	return { plugin, editor, root };
}

const q = (root, selector) => root.querySelector(selector);
const slotRadios = (root, slot) => Array.from(root.querySelectorAll(`input[type="radio"][name="watSet_customColors_${slot}"]`));
const checkedValue = (root, slot) => (slotRadios(root, slot).find(r => r.checked) || {}).value || null;
const suggestCard = root => q(root, '.wat-cc-suggest');
const applyButton = (root, slot) => q(root, `#watSet_customColors_suggestApply_${slot}`);
const optionOrder = root => Array.from(suggestCard(root).querySelectorAll('.wat-cc-suggest-option')).map(row => row.dataset.slot);
const isShown = el => !el.hidden;

function pickSwatch(root, slot, hex) {
	const radio = slotRadios(root, slot).find(r => r.value === hex);
	radio.checked = true;
	radio.dispatchEvent(new Event('change', { bubbles: true }));
}

function typeHex(root, slot, text) {
	const input = q(root, `#watSet_customColors_${slot}_hex`);
	input.value = text;
	input.dispatchEvent(new Event('change', { bubbles: true }));
	return input;
}

function hexToRgbString(hex) {
	const n = parseInt(hex.slice(1), 16);
	return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

beforeEach(() => {
	jest.useFakeTimers();
	localStorage.clear();
	document.body.innerHTML = '';
	delete document.documentElement.dataset.saturation;
});

afterEach(() => {
	jest.runOnlyPendingTimers();
	jest.useRealTimers();
	localStorage.clear();
	document.body.innerHTML = '';
	delete document.documentElement.dataset.saturation;
});

describe('구조와 이름', () => {
	test('바깥 fieldset·legend와 배경·글자 슬롯 fieldset 두 개가 있다', () => {
		const { root } = mount();
		expect(root.tagName).toBe('FIELDSET');
		expect(root.id).toBe('watSetWrap_customColors');
		expect(q(root, ':scope > legend').textContent).not.toBe('');
		['bg', 'fg'].forEach(slot => {
			const slotSet = q(root, `fieldset.wat-cc-slot[data-slot="${slot}"]`);
			expect(slotSet).not.toBeNull();
			expect(q(slotSet, 'legend').textContent).not.toBe('');
		});
	});

	test('슬롯마다 같은 name의 견본 라디오 8개가 있고 모두 라벨이 연결된다', () => {
		const { root } = mount();
		['bg', 'fg'].forEach(slot => {
			const radios = slotRadios(root, slot);
			expect(radios).toHaveLength(8);
			radios.forEach(radio => {
				const label = q(root, `label[for="${radio.id}"]`);
				expect(label).not.toBeNull();
				expect(label.textContent.trim()).not.toBe('');
			});
		});
	});

	test('색 선택기·색상 코드 입력·저장·취소·견본 조합 6개에 이름이 있다', () => {
		const { root } = mount();
		['bg', 'fg'].forEach(slot => {
			['picker', 'hex'].forEach(kind => {
				const input = q(root, `#watSet_customColors_${slot}_${kind}`);
				expect(input).not.toBeNull();
				expect(q(root, `label[for="${input.id}"]`).textContent.trim()).not.toBe('');
			});
		});
		expect(q(root, '#watSet_customColors_bg_picker').type).toBe('color');
		expect(q(root, '#watSet_customColors_save').textContent.trim()).not.toBe('');
		expect(q(root, '#watSet_customColors_cancel').textContent.trim()).not.toBe('');
		const presets = root.querySelectorAll('.wat-cc-preset');
		expect(presets).toHaveLength(6);
		presets.forEach(button => expect(button.textContent.trim()).not.toBe(''));
	});

	test('로케일의 색 이름(colorNames)에는 견본 이름으로 쓰이는 키만 있다', () => {
		const used = new Set([
			...BG_SWATCHES.map(s => s.id),
			...FG_SWATCHES.map(s => s.id)
		]);
		const names = Object.keys(ko.panel.settings.manage.options.customColors.colorNames);
		expect(names.filter(key => !used.has(key))).toEqual([]);
		expect([...used].filter(key => !names.includes(key))).toEqual([]);
	});

	test('견본에 없는 색은 견본 이름으로 부르지 않는다 — 6개 언어, 무작위 색 400개', () => {
		const swatchHexes = new Set([...BG_SWATCHES, ...FG_SWATCHES].map(s => s.hex));
		let seed = 20261021;
		const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
		const colors = ['#bebebe', '#808080', '#f0f0f0', '#101010', '#e0d000', '#0f2244'];
		while (colors.length < 400) {
			const hex = '#' + [0, 1, 2].map(() => Math.floor(rand() * 256).toString(16).padStart(2, '0')).join('');
			if (!swatchHexes.has(hex)) colors.push(hex);
		}
		['ko', 'en-US', 'en-GB', 'ja', 'zh', 'de'].forEach(lang => {
			const locale = JSON.parse(readFileSync(join(__dirname, '..', '..', 'dist', 'assets', 'locales', `${lang}.json`), 'utf8'));
			const plugin = makePlugin();
			plugin.state.get = jest.fn(key => (key === 'locale' ? locale : undefined));
			const editor = new CustomColorEditor(plugin);
			const swatchNames = new Set(Object.values(locale.panel.settings.manage.options.customColors.colorNames).map(n => n.toLowerCase()));
			colors.forEach(hex => {
				const name = editor._colorName(hex, 'bg');
				expect(name).not.toBe('');
				if (swatchNames.has(name.toLowerCase())) throw new Error(`${lang} ${hex} → 견본 이름 "${name}"`);
			});
			// 견본과 정확히 같은 색은 견본 이름 그대로
			expect(editor._colorName('#e8e8e8', 'bg')).toBe(locale.panel.settings.manage.options.customColors.colorNames.lightGray);
		});
	});

	test('추천으로 나온 회색(#bebebe)은 견본 "연회색"이 아니라 "밝은 회색"으로 표시된다', () => {
		const { root } = mount();
		typeHex(root, 'bg', '#bebebe');
		const current = q(root, 'fieldset.wat-cc-slot[data-slot="bg"] .wat-cc-current').textContent;
		expect(current).toContain('밝은 회색');
		expect(current).not.toContain('연회색');
	});

	test('ko 로케일의 모든 legend·label·button 문구가 비어 있지 않다', () => {
		const { root } = mount();
		root.querySelectorAll('legend, label, button, .wat-cc-subtitle').forEach(el => {
			expect(el.textContent.trim()).not.toBe('');
		});
	});
});

describe('기존 패널 이벤트 위임과의 비간섭', () => {
	test('개별 설정용 클래스(.wat-item-type-*, .setCont, .opt_item)를 쓰지 않는다', () => {
		const { root } = mount();
		expect(root.querySelector('[class*="wat-item-type-"], .setCont, .setWrap, .opt_item')).toBeNull();
	});

	test('입력 name이 접근성 설정 키와 겹치지 않는다', () => {
		const { root } = mount();
		const settingKeys = Object.keys(Defaults.SETTINGS);
		root.querySelectorAll('input').forEach(input => {
			expect(settingKeys).not.toContain(input.name);
		});
	});

	test('버튼 id에 전역 클릭 위임이 반응하는 문자열(tts_, pageScroll_)이 없다', () => {
		const { root } = mount();
		root.querySelectorAll('button').forEach(button => {
			expect(button.id).not.toMatch(/tts_|pageScroll_/);
		});
	});

	test('편집기 라디오의 change는 전역 위임(_handleRadioChange)에서 아무 설정도 바꾸지 않는다', () => {
		const { root } = mount();
		const wat = Object.create(WAT.prototype);
		wat.setRadioListeners = jest.fn();
		wat._handleCheckboxChange = jest.fn();
		const radio = slotRadios(root, 'bg')[0];
		wat._handleRadioChange({ target: radio });
		expect(wat.setRadioListeners).not.toHaveBeenCalled();
		expect(wat._handleCheckboxChange).not.toHaveBeenCalled();
	});
});

describe('처음 그리기', () => {
	test('저장한 색이 없으면 기본 조합(크림 바탕 진갈색 글자)을 보여 준다', () => {
		const { root } = mount();
		expect(checkedValue(root, 'bg')).toBe('#fdf6e3');
		expect(checkedValue(root, 'fg')).toBe('#3b2f1e');
		expect(isShown(suggestCard(root))).toBe(false);
	});

	test('저장한 색이 있으면 그 색을 보여 준다', () => {
		localStorage.setItem('watCustomColors', JSON.stringify({ v: 1, bg: '#0b1f3a', fg: '#ffffff' }));
		const { root } = mount();
		expect(checkedValue(root, 'bg')).toBe('#0b1f3a');
		expect(checkedValue(root, 'fg')).toBe('#ffffff');
	});

	test('미리보기는 현재 초안 색으로 칠해진다', () => {
		const { root } = mount();
		const preview = q(root, '.wat-cc-preview');
		expect(preview.style.backgroundColor).toBe(hexToRgbString('#fdf6e3'));
		expect(preview.style.color).toBe(hexToRgbString('#3b2f1e'));
	});
});

describe('추천 흐름', () => {
	test('배경색을 바꾸면 추천 카드에 글자색·배경색 두 선택지가 나오고, 각 추천은 남는 쪽 색과 7:1 이상이다', () => {
		const { root, editor } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');

		expect(isShown(suggestCard(root))).toBe(true);
		const { fg, bg } = editor.suggestion.options;
		// 글자색을 바꾸는 선택지는 새 배경(남색)을 그대로 두고, 배경색을 바꾸는 선택지는 지금 글자색(진갈색)을 그대로 둔다
		expect(contrastRatio('#0b1f3a', fg.hex)).toBeGreaterThanOrEqual(CONTRAST.AAA);
		expect(contrastRatio('#3b2f1e', bg.hex)).toBeGreaterThanOrEqual(CONTRAST.AAA);
		expect(applyButton(root, 'fg')).not.toBeNull();
		expect(applyButton(root, 'bg')).not.toBeNull();
		expect(q(root, '#watSet_customColors_suggestManual')).not.toBeNull();
	});

	test('두 적용 버튼은 이름이 서로 달라 어느 쪽을 바꾸는지 구분된다', () => {
		const { root } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		const fgName = applyButton(root, 'fg').textContent.trim();
		const bgName = applyButton(root, 'bg').textContent.trim();
		expect(fgName).not.toBe('');
		expect(bgName).not.toBe('');
		expect(fgName).not.toBe(bgName);
	});

	test('방금 바꾼 쪽의 반대편이 첫 번째 선택지다 (막 고른 색을 지키는 쪽이 먼저)', () => {
		const bgFirst = mount();
		pickSwatch(bgFirst.root, 'bg', '#0b1f3a');
		expect(optionOrder(bgFirst.root)).toEqual(['fg', 'bg']);
		expect(bgFirst.editor.suggestion.primary).toBe('fg');
		bgFirst.root.remove();

		const fgFirst = mount();
		pickSwatch(fgFirst.root, 'fg', '#ffffff');
		expect(optionOrder(fgFirst.root)).toEqual(['bg', 'fg']);
		expect(fgFirst.editor.suggestion.primary).toBe('bg');
	});

	test('추천 카드는 방금 바꾼 슬롯 바로 뒤에 놓인다 (배경·글자 대칭)', () => {
		const bgFirst = mount();
		pickSwatch(bgFirst.root, 'bg', '#0b1f3a');
		expect(q(bgFirst.root, 'fieldset.wat-cc-slot[data-slot="bg"]').nextElementSibling).toBe(suggestCard(bgFirst.root));
		bgFirst.root.remove();

		const fgFirst = mount();
		pickSwatch(fgFirst.root, 'fg', '#ffffff');
		expect(q(fgFirst.root, 'fieldset.wat-cc-slot[data-slot="fg"]').nextElementSibling).toBe(suggestCard(fgFirst.root));
	});

	test('추천 안내는 잠시 기다렸다가 한 번만, 두 선택지를 함께 낭독한다', () => {
		const { root, plugin } = mount();
		pickSwatch(root, 'bg', '#333333');
		pickSwatch(root, 'bg', '#0b1f3a');
		expect(plugin._announceToLiveRegion).not.toHaveBeenCalled();
		jest.advanceTimersByTime(ANNOUNCE_DELAY);
		expect(plugin._announceToLiveRegion).toHaveBeenCalledTimes(1);
		const message = plugin._announceToLiveRegion.mock.calls[0][0];
		const slots = ko.panel.settings.manage.options.customColors.slots;
		expect(message).toContain(slots.fg);
		expect(message).toContain(slots.bg);
	});

	test('새 조합이 이미 7:1 이상이면 추천 카드를 띄우지 않는다', () => {
		const { root } = mount();
		pickSwatch(root, 'bg', '#ffffff');
		expect(isShown(suggestCard(root))).toBe(false);
	});

	test('[글자색 바꾸기]: 글자색이 추천색으로 바뀌고 카드가 사라지며 포커스는 글자색 슬롯으로 간다', () => {
		const { root, editor } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		const suggested = editor.suggestion.options.fg.hex;

		applyButton(root, 'fg').click();

		expect(editor.draft).toEqual({ bg: '#0b1f3a', fg: suggested });
		expect(editor.slotState.fg).toBe('suggested');
		expect(isShown(suggestCard(root))).toBe(false);
		expect(q(root, 'fieldset.wat-cc-slot[data-slot="fg"]').contains(document.activeElement)).toBe(true);
		expect(q(root, '#watSet_customColors_fg_hex').value).toBe(suggested);
	});

	test('[배경색 바꾸기]: 방금 고른 배경 대신 글자색에 맞춘 배경으로 바뀌고 포커스는 배경색 슬롯으로 간다', () => {
		const { root, editor } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		const suggested = editor.suggestion.options.bg.hex;

		applyButton(root, 'bg').click();

		expect(editor.draft).toEqual({ bg: suggested, fg: '#3b2f1e' });
		expect(editor.slotState.bg).toBe('suggested');
		expect(isShown(suggestCard(root))).toBe(false);
		expect(q(root, 'fieldset.wat-cc-slot[data-slot="bg"]').contains(document.activeElement)).toBe(true);
		expect(q(root, '.wat-cc-contrast').dataset.level).toBe('aaa');
	});

	test('추천을 승인한 뒤에도 글자색을 직접 바꿀 수 있다', () => {
		const { root, editor } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		applyButton(root, 'fg').click();

		pickSwatch(root, 'fg', '#7fdbff');

		expect(editor.draft.fg).toBe('#7fdbff');
		expect(editor.slotState.fg).toBe('manual');
	});

	test('승인한 글자색은 배경을 다시 바꾸면 다시 추천 대상이 된다', () => {
		const { root, editor } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		applyButton(root, 'fg').click();

		pickSwatch(root, 'bg', '#fdf6e3');

		expect(isShown(suggestCard(root))).toBe(true);
		expect(editor.suggestion.primary).toBe('fg');
	});

	test('[직접 고를게요]: 초안은 그대로, 카드가 사라지고 포커스는 첫 선택지(글자색) 견본으로 간다', () => {
		const { root, editor } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		const before = { ...editor.draft };

		q(root, '#watSet_customColors_suggestManual').click();

		expect(editor.draft).toEqual(before);
		expect(isShown(suggestCard(root))).toBe(false);
		expect(document.activeElement.name).toBe('watSet_customColors_fg');
	});

	test('추천 핑퐁 방지: 직접 고른 쪽은 자동 추천 대상이 아니고, 대비가 부족하면 [추천 받기]만 보인다', () => {
		const { root, editor } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		q(root, '#watSet_customColors_suggestManual').click();
		pickSwatch(root, 'fg', '#000000'); // 남색 바탕에 검정 글자 — 대비 부족

		expect(isShown(suggestCard(root))).toBe(false);
		const request = q(root, '#watSet_customColors_request');
		expect(isShown(request)).toBe(true);
		expect(q(root, '.wat-cc-contrast').dataset.level).toBe('low');

		request.click();

		// 두 선택지를 모두 보여 주되, 마지막으로 바꾼 쪽(글자색)의 반대편인 배경색이 먼저
		expect(isShown(suggestCard(root))).toBe(true);
		expect(optionOrder(root)).toEqual(['bg', 'fg']);
		expect(document.activeElement.id).toBe('watSet_customColors_suggestApply_bg');
	});

	test('대비가 충분하면 [추천 받기]는 숨긴다', () => {
		const { root } = mount();
		expect(isShown(q(root, '#watSet_customColors_request'))).toBe(false);
	});

	test('견본 조합을 고르면 두 색이 함께 바뀌고 추천 카드는 없다', () => {
		const { root, editor } = mount();
		q(root, '#watSet_customColors_preset_yellowOnBlack').click();
		expect(editor.draft).toEqual({ bg: '#000000', fg: '#ffff00' });
		expect(checkedValue(root, 'bg')).toBe('#000000');
		expect(checkedValue(root, 'fg')).toBe('#ffff00');
		expect(isShown(suggestCard(root))).toBe(false);
	});

	test('체크 해제 상태로 들어온 change(음성 명령 경로)는 무시한다', () => {
		const { root, editor } = mount();
		const radio = slotRadios(root, 'bg').find(r => r.value === '#000000');
		radio.checked = false;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
		expect(editor.draft.bg).toBe('#fdf6e3');
	});
});

describe('색상 코드 입력과 색 선택기', () => {
	test('잘못된 코드는 aria-invalid와 오류 문구를 보이고 초안을 바꾸지 않는다', () => {
		const { root, editor } = mount();
		const input = typeHex(root, 'bg', 'zzz');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		const error = q(root, '#watSet_customColors_bg_hexError');
		expect(isShown(error)).toBe(true);
		expect(input.getAttribute('aria-describedby')).toContain(error.id);
		expect(editor.draft.bg).toBe('#fdf6e3');
	});

	test('잘못된 코드를 확정하면 어느 칸이 왜 틀렸는지 라이브 리전으로 한 번 알린다 (WCAG 3.3.1·4.1.3)', () => {
		const { root, plugin } = mount();
		const cc = ko.panel.settings.manage.options.customColors;
		const expected = cc.hexErrorAnnounce.replace('{slot}', cc.slots.bg).replace('{error}', cc.hexError);

		typeHex(root, 'bg', 'zzz');
		jest.advanceTimersByTime(ANNOUNCE_DELAY);

		expect(plugin._announceToLiveRegion).toHaveBeenCalledTimes(1);
		expect(plugin._announceToLiveRegion).toHaveBeenCalledWith(expected, 'polite');
	});

	test('직전 변경의 대기 중 안내가 오류 안내를 덮어쓰지 않는다', () => {
		const { root, plugin } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		typeHex(root, 'bg', 'zzz');
		jest.advanceTimersByTime(ANNOUNCE_DELAY);

		expect(plugin._announceToLiveRegion).toHaveBeenCalledTimes(1);
		expect(plugin._announceToLiveRegion.mock.calls[0][0]).toContain(ko.panel.settings.manage.options.customColors.hexError);
	});

	test('3자리·# 생략 코드는 정규화해 받아들이고 오류 표시를 지운다', () => {
		const { root, editor } = mount();
		typeHex(root, 'bg', 'zzz');
		const input = typeHex(root, 'bg', 'abc');
		expect(editor.draft.bg).toBe('#aabbcc');
		expect(input.value).toBe('#aabbcc');
		expect(input.hasAttribute('aria-invalid')).toBe(false);
		expect(isShown(q(root, '#watSet_customColors_bg_hexError'))).toBe(false);
	});

	test('견본과 같은 코드를 입력하면 그 견본이 체크된다', () => {
		const { root } = mount();
		typeHex(root, 'bg', '#0B1F3A');
		expect(checkedValue(root, 'bg')).toBe('#0b1f3a');
	});

	test('잘못 입력한 코드는 반대편 슬롯을 바꿔도 지워지지 않는다', () => {
		const { root } = mount();
		const input = typeHex(root, 'bg', 'zzz');
		pickSwatch(root, 'fg', '#000000');
		expect(input.value).toBe('zzz');
		expect(input.getAttribute('aria-invalid')).toBe('true');
	});

	test('앞뒤 공백이 붙은 코드를 붙여 넣어도 잘리지 않고 받아들인다', () => {
		const { root, editor } = mount();
		typeHex(root, 'bg', '  #1a2b3c  ');
		expect(editor.draft.bg).toBe('#1a2b3c');
	});

	test('견본에 없는 색이면 어느 견본도 체크하지 않는다', () => {
		const { root } = mount();
		typeHex(root, 'bg', '#123456');
		expect(checkedValue(root, 'bg')).toBeNull();
	});

	test('색 선택기를 끄는 중(input)에는 미리보기만 바뀌고 추천 카드는 확정(change) 때 나온다', () => {
		const { root } = mount();
		const picker = q(root, '#watSet_customColors_bg_picker');
		picker.value = '#0b1f3a';
		picker.dispatchEvent(new Event('input', { bubbles: true }));
		expect(q(root, '.wat-cc-preview').style.backgroundColor).toBe(hexToRgbString('#0b1f3a'));
		expect(isShown(suggestCard(root))).toBe(false);

		picker.dispatchEvent(new Event('change', { bubbles: true }));
		expect(isShown(suggestCard(root))).toBe(true);
	});
});

describe('저장과 취소', () => {
	test('[저장하고 적용]은 초안을 setCustomColors로 넘기고 성공 알림을 띄운다', () => {
		const { root, plugin } = mount();
		q(root, '#watSet_customColors_preset_whiteOnNavy').click();
		q(root, '#watSet_customColors_save').click();
		expect(plugin.setCustomColors).toHaveBeenCalledWith({ bg: '#0b1f3a', fg: '#ffffff' });
		expect(plugin._notify).toHaveBeenCalledWith(expect.any(String), { type: 'success' });
	});

	test('대비가 4.5:1 미만이어도 저장하되 경고 알림을 띄운다', () => {
		const { root, plugin } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		q(root, '#watSet_customColors_suggestManual').click();
		pickSwatch(root, 'fg', '#000000');

		q(root, '#watSet_customColors_save').click();

		expect(plugin.setCustomColors).toHaveBeenCalledWith({ bg: '#0b1f3a', fg: '#000000' });
		expect(plugin._notify).toHaveBeenCalledWith(expect.any(String), { type: 'warning' });
	});

	test('저장에 실패하면 오류 알림', () => {
		const { root, plugin } = mount();
		plugin.setCustomColors.mockReturnValue(false);
		q(root, '#watSet_customColors_save').click();
		expect(plugin._notify).toHaveBeenCalledWith(expect.any(String), { type: 'error' });
	});

	test('저장 후 상태가 초기화되어, 다시 배경을 바꾸면 글자색을 추천한다', () => {
		const { root, editor } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		q(root, '#watSet_customColors_suggestManual').click();
		pickSwatch(root, 'fg', '#ffffff');
		q(root, '#watSet_customColors_save').click();
		expect(editor.slotState).toEqual({ bg: 'default', fg: 'default' });

		pickSwatch(root, 'bg', '#fdf6e3');
		expect(editor.suggestion.primary).toBe('fg');
	});

	test('[취소]는 저장하지 않고 저장된 색으로 되돌린다', () => {
		localStorage.setItem('watCustomColors', JSON.stringify({ v: 1, bg: '#000000', fg: '#ffff00' }));
		const { root, plugin, editor } = mount();
		pickSwatch(root, 'bg', '#ffffff');
		typeHex(root, 'fg', 'zzz');

		q(root, '#watSet_customColors_cancel').click();

		expect(plugin.setCustomColors).not.toHaveBeenCalled();
		expect(editor.draft).toEqual({ bg: '#000000', fg: '#ffff00' });
		expect(checkedValue(root, 'bg')).toBe('#000000');
		expect(isShown(suggestCard(root))).toBe(false);
		expect(q(root, '#watSet_customColors_fg_hex').hasAttribute('aria-invalid')).toBe(false);
	});
});

describe('다시 그리기와 안내', () => {
	test('build()를 다시 불러도(언어 변경으로 패널 재생성) 편집 중인 초안을 유지한다', () => {
		const { root, editor } = mount();
		pickSwatch(root, 'bg', '#0b1f3a');
		root.remove();

		const rebuilt = editor.build();
		document.body.appendChild(rebuilt);

		expect(checkedValue(rebuilt, 'bg')).toBe('#0b1f3a');
		expect(isShown(suggestCard(rebuilt))).toBe(true);
	});

	test('채도·색약 보정이 켜져 있으면 실제 대비가 다를 수 있다는 안내를 보인다', () => {
		document.documentElement.dataset.saturation = 'monochrome';
		const { root } = mount();
		expect(isShown(q(root, '.wat-cc-notice'))).toBe(true);
	});

	test('채도가 기본이면 안내를 숨긴다', () => {
		document.documentElement.dataset.saturation = 'initial';
		const { root } = mount();
		expect(isShown(q(root, '.wat-cc-notice'))).toBe(false);
	});
});
