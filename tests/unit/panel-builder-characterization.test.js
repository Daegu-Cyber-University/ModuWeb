/**
 * @fileoverview 설정 패널 UI 생성 클러스터 특성화 테스트 (Phase 6-6 추출 대비)
 * @description PanelBuilder 추출 전후로 동일하게 통과해야 하는 현재 동작 고정 테스트.
 *              WAT 공개 표면(인스턴스 메서드 호출)을 통해 검증하므로 내부 구현 이동에 영향받지 않는다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Constants } from '../../src/core/constants.js';
import { Defaults } from '../../src/core/defaults.js';

/**
 * 패널 생성에 필요한 서비스만 갖춘 최소 WAT 인스턴스 생성
 * (생성자는 ConfigurationManager 등 무거운 의존을 가지므로 우회)
 */
function makeWat(overrides = {}) {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.fontSizeRatios = { initial: 1, 'size-1p5x': 1.5, 'size-2x': 2 };
	wat.letterSpacingRatios = { initial: 0, wide_normal: 0.05, wide_more: 0.1 };
	wat.lineHeightRatios = { initial: 1, 'size-1p5x': 1.5, 'size-2x': 2 };
	wat.screenScaleRatios = { initial: 1, 'scale-1p2x': 1.2, 'scale-1p5x': 1.5, 'scale-2x': 2 };
	wat.language = 'ko';
	wat.languageOptions = ['ko', 'en'];
	wat.languageConfig = {};
	// 로케일은 키 그대로 반환 — 구조 검증에 집중
	wat.getLocalizedText = jest.fn((key) => key);
	wat.loadWebFont = jest.fn();
	wat._setTimeout = jest.fn();
	wat.savePreferences = jest.fn();
	wat.updateViewMode = jest.fn();
	wat.toggleProfile = jest.fn();
	wat.showNotification = jest.fn();
	wat.exportSettings = jest.fn();
	wat._promptImportSettings = jest.fn();
	return Object.assign(wat, overrides);
}

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '';
});

afterEach(() => {
	localStorage.clear();
});

describe('개인 옵션 팩토리 — 라디오 계열', () => {
	// [메서드명, name 속성, 기대 값 목록, 비활성 값 목록]
	const radioCases = [
		['createColorThemeSettings', 'colorTheme', ['initial', 'light', 'dark', 'reverse'], []],
		['createSaturationSettings', 'saturation', ['initial', 'low', 'high', 'monochrome'], []],
		['createScreenScaleSettings', 'screenScale', ['initial', 'scale-1p2x', 'scale-1p5x', 'scale-2x'], []],
		['createTxtAlignSettings', 'txtAlign', ['initial', 'left', 'center', 'right'], []],
		['createReadGuideSettings', 'readGuide', ['unset', 'mask', 'underline', 'bigCursor'], []],
		['createImgDisplayModeSettings', 'imgDisplayMode', ['initial', 'hide', 'convert'], []],
		['createFontSizeSettings', 'fontSize', ['initial', 'size-1p5x', 'size-2x'], []],
		['createLetterSpacingSettings', 'letterSpacing', ['initial', 'wide_normal', 'wide_more'], []],
		['createLineHeightSettings', 'lineHeight', ['initial', 'size-1p5x', 'size-2x'], []]
	];

	test.each(radioCases)('%s: name=%s 값·비활성 상태 고정', (method, name, values, disabledValues) => {
		const wat = makeWat();
		const li = wat[method]();

		expect(li).toBeInstanceOf(HTMLLIElement);
		const radios = Array.from(li.querySelectorAll('input[type="radio"]'));
		expect(radios.map(r => r.value)).toEqual(values);
		radios.forEach(r => expect(r.name).toBe(name));
		expect(radios.filter(r => r.disabled).map(r => r.value)).toEqual(disabledValues);

		// 라디오 그룹 시맨틱 + 이전/다음 순환 버튼 (WCAG 1.3.1 / 2.1.1)
		expect(li.querySelector('ul.opt_lists[role="radiogroup"]')).not.toBeNull();
		expect(li.querySelector('.btn_chgOpt.prev')).not.toBeNull();
		expect(li.querySelector('.btn_chgOpt.next')).not.toBeNull();
		expect(li.querySelector('.setTitle[role="button"][tabindex="0"]')).not.toBeNull();
	});

	test('ratio가 false인 항목은 옵션에서 제외된다', () => {
		const wat = makeWat({ fontSizeRatios: { initial: 1, 'size-1p5x': false, 'size-2x': 2 } });
		const li = wat.createFontSizeSettings();
		const values = Array.from(li.querySelectorAll('input[type="radio"]')).map(r => r.value);
		expect(values).toEqual(['initial', 'size-2x']);
	});

	test('fontSize: initial이 기본 선택된다', () => {
		const wat = makeWat();
		const li = wat.createFontSizeSettings();
		const checked = Array.from(li.querySelectorAll('input[type="radio"]')).filter(r => r.checked);
		expect(checked.map(r => r.value)).toEqual(['initial']);
	});
});

describe('개인 옵션 팩토리 — 폰트 패밀리', () => {
	test('기본 FONT_FAMILY_OPTIONS 병합: 전체 폰트 노출 + initial 선택 + 웹폰트 로드', () => {
		const wat = makeWat();
		const li = wat.createFontFamilySettings();
		const radios = Array.from(li.querySelectorAll('input[type="radio"]'));
		expect(radios.map(r => r.value)).toEqual(['initial', 'nanum-myeongjo', 'noto-serif-kr', 'koddi-udon-gothic']);
		expect(radios.filter(r => r.checked).map(r => r.value)).toEqual(['initial']);
		// url이 있는 폰트만 동적 로드 (nanum, noto — koddi는 url:null)
		expect(wat.loadWebFont).toHaveBeenCalledTimes(2);
	});

	test('options.fontFamily로 폰트 비활성/추가 가능', () => {
		const wat = makeWat();
		wat.options = {
			fontFamily: {
				'nanum-myeongjo': false,
				customFont: { label: 'Custom', fontFamily: 'Custom, sans-serif', enabled: true }
			}
		};
		const li = wat.createFontFamilySettings();
		const values = Array.from(li.querySelectorAll('input[type="radio"]')).map(r => r.value);
		expect(values).not.toContain('nanum-myeongjo');
		expect(values).toContain('customFont');
	});
});

describe('개인 옵션 팩토리 — 체크박스(스위치) 계열', () => {
	const checkboxCases = [
		['createMediaStopSettings', 'mediaStop', 'stop'],
		['createMediaMuteSettings', 'mediaMute', 'mute'],
		['createStopAniSettings', 'stopAni', 'stop'],
		['createDictionSettings', 'diction', 'on']
	];

	test.each(checkboxCases)('%s: name=%s value=%s 스위치 시맨틱 고정', (method, name, value) => {
		const wat = makeWat();
		const li = wat[method]();

		const checkbox = li.querySelector('input[type="checkbox"]');
		expect(checkbox).not.toBeNull();
		expect(checkbox.name).toBe(name);
		expect(checkbox.value).toBe(value);
		// 스위치 role + 상태 표기 (스크린리더 상태 안내)
		expect(checkbox.getAttribute('role')).toBe('switch');
		expect(checkbox.getAttribute('aria-checked')).toBe('false');
		expect(li.querySelector('.switch-state')).not.toBeNull();
		expect(li.querySelector('label.switch-label')).not.toBeNull();
	});
});

describe('개인 옵션 팩토리 — 버튼 계열', () => {
	test('createPageScrollSettings: toggle/up/down 버튼 + 상태 텍스트', () => {
		const wat = makeWat();
		const li = wat.createPageScrollSettings();
		const buttons = Array.from(li.querySelectorAll('button.wat-items'));
		expect(buttons.map(b => b.value)).toEqual(['toggle', 'up', 'down']);
		const toggle = buttons[0];
		expect(toggle.getAttribute('data-stateText-on')).not.toBeNull();
		expect(toggle.getAttribute('data-stateText-off')).not.toBeNull();
		expect(toggle.classList.contains('btn_iconSet')).toBe(true);
		expect(toggle.classList.contains('btn_toggle')).toBe(true);
	});

	test('createTTSSettings: toggle/prev/next/focus_toggle — prev·next는 초기 비활성', () => {
		const wat = makeWat();
		const li = wat.createTTSSettings();
		const buttons = Array.from(li.querySelectorAll('button.wat-items'));
		expect(buttons.map(b => b.value)).toEqual(['toggle', 'prev', 'next', 'focus_toggle']);
		expect(buttons.filter(b => b.disabled).map(b => b.value)).toEqual(['prev', 'next']);
	});

	test('createSTTSettings: start 버튼 1개', () => {
		const wat = makeWat();
		const buttons = Array.from(wat.createSTTSettings().querySelectorAll('button.wat-items'));
		expect(buttons.map(b => b.value)).toEqual(['start']);
	});

	test('createPageStructureSettings: show 버튼 + 상태 텍스트', () => {
		const wat = makeWat();
		const li = wat.createPageStructureSettings();
		const buttons = Array.from(li.querySelectorAll('button.wat-items'));
		expect(buttons.map(b => b.value)).toEqual(['show']);
		expect(buttons[0].getAttribute('data-stateText-off')).not.toBeNull();
	});
});

describe('createSettingsItem 동작', () => {
	test('라디오: 제목 클릭 시 다음 옵션으로 순환하며 change 이벤트를 발생시킨다', () => {
		const wat = makeWat();
		const li = wat.createSettingsItem('radio', 'title', 'demo', [
			{ value: 'a', label: 'A', checked: true },
			{ value: 'b', label: 'B' },
			{ value: 'c', label: 'C' }
		]);
		document.body.appendChild(li);

		const changed = [];
		li.addEventListener('change', (e) => changed.push(e.target.value));

		li.querySelector('.setTitle').click();
		const radios = Array.from(li.querySelectorAll('input[type="radio"]'));
		expect(radios.find(r => r.checked).value).toBe('b');
		expect(changed).toEqual(['b']);

		// 마지막에서 다시 처음으로 순환
		li.querySelector('.setTitle').click();
		li.querySelector('.setTitle').click();
		expect(radios.find(r => r.checked).value).toBe('a');
	});

	test('라디오: 비활성 옵션은 순환에서 건너뛴다', () => {
		const wat = makeWat();
		const li = wat.createSettingsItem('radio', 'title', 'demo', [
			{ value: 'a', label: 'A', checked: true },
			{ value: 'b', label: 'B', disabled: true },
			{ value: 'c', label: 'C' }
		]);
		document.body.appendChild(li);
		li.querySelector('.setTitle').click();
		const radios = Array.from(li.querySelectorAll('input[type="radio"]'));
		expect(radios.find(r => r.checked).value).toBe('c');
	});

	test('체크박스: 제목 클릭 시 토글되고 change 이벤트를 발생시킨다', () => {
		const wat = makeWat();
		const li = wat.createSettingsItem('checkbox', 'title', 'demo', [
			{ value: 'on', label: 'On', label_toggle: 'Off' }
		]);
		document.body.appendChild(li);

		const checkbox = li.querySelector('input[type="checkbox"]');
		const changed = [];
		li.addEventListener('change', () => changed.push(checkbox.checked));

		li.querySelector('.setTitle').click();
		expect(checkbox.checked).toBe(true);
		li.querySelector('.setTitle').click();
		expect(checkbox.checked).toBe(false);
		expect(changed).toEqual([true, false]);
	});

	test('버튼: 제목 클릭 시 첫 활성 버튼이 클릭된다 (비활성 버튼 건너뜀)', () => {
		const wat = makeWat();
		const li = wat.createSettingsItem('button', 'title', 'demo', [
			{ value: 'first', label: 'First', disabled: true },
			{ value: 'second', label: 'Second' }
		]);
		document.body.appendChild(li);

		const clicked = [];
		li.querySelectorAll('button.wat-items').forEach(b =>
			b.addEventListener('click', () => clicked.push(b.value)));

		li.querySelector('.setTitle').click();
		expect(clicked).toEqual(['second']);
	});

	test('제목(role=button)은 Enter/Space 키로도 활성화된다 (WCAG 2.1.1)', () => {
		const wat = makeWat();
		const li = wat.createSettingsItem('radio', 'title', 'demo', [
			{ value: 'a', label: 'A', checked: true },
			{ value: 'b', label: 'B' }
		]);
		document.body.appendChild(li);

		const title = li.querySelector('.setTitle');
		title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		const radios = Array.from(li.querySelectorAll('input[type="radio"]'));
		expect(radios.find(r => r.checked).value).toBe('b');
	});

	test('라벨·제목의 HTML은 이스케이프된다 (XSS 방지)', () => {
		const wat = makeWat();
		const li = wat.createSettingsItem('radio', '<b>evil</b>', 'demo', [
			{ value: 'a', label: '<img src=x onerror=alert(1)>' }
		]);
		expect(li.querySelector('img')).toBeNull();
		expect(li.querySelector('b')).toBeNull();
		expect(li.querySelector('label').textContent).toContain('<img src=x onerror=alert(1)>');
		expect(li.querySelector('.setTitle').textContent).toBe('<b>evil</b>');
	});
});

describe('createProfileSettings', () => {
	test('Defaults.PROFILES 기반 프로필 UI 구조 고정', () => {
		const wat = makeWat();
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createProfileSettings(container);

		expect(container.querySelector('#watSetWrap_profile')).not.toBeNull();
		const profiles = Object.keys(Defaults.PROFILES);
		profiles.forEach(profile => {
			const fieldset = container.querySelector(`.watSet-profile-item-container[data-profile="${profile}"]`);
			expect(fieldset).not.toBeNull();

			// 토글 스위치 (role=switch는 aria-checked로 상태 전달, 초기 꺼짐)
			const toggle = fieldset.querySelector(`#watSet_profile_button_toggle_${profile}`);
			expect(toggle.getAttribute('role')).toBe('switch');
			expect(toggle.getAttribute('aria-checked')).toBe('false');
			// 접근명은 상태 라벨("꺼짐")이 아니라 프로필 제목 라벨을 가리킨다
			expect(toggle.getAttribute('aria-labelledby')).toBe(`watSet_profile_title_label_${profile}`);
			expect(fieldset.querySelector(`#watSet_profile_title_label_${profile}`)).not.toBeNull();

			// 프로필별 개별 항목 체크박스: 설정 키와 data-key 일치, enabled 초기값 반영
			const settings = Defaults.PROFILES[profile].settings;
			Object.keys(settings).forEach(key => {
				const checkbox = fieldset.querySelector(`.profileListItemInput[data-key="${key}"]`);
				expect(checkbox).not.toBeNull();
				expect(checkbox.checked).toBe(Defaults.PROFILES[profile].enabled[key]);
			});
		});
	});

	test('options에서 false로 끈 기능은 프로필 체크박스에서 제외된다', () => {
		const wat = makeWat({ options: { fontSize: false } });
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createProfileSettings(container);

		const lowVision = container.querySelector('.watSet-profile-item-container[data-profile="lowVision"]');
		expect(lowVision.querySelector('.profileListItemInput[data-key="fontSize"]')).toBeNull();
		expect(lowVision.querySelector('.profileListItemInput[data-key="fontFamily"]')).not.toBeNull();
	});

	test('토글 스위치는 제목바(legend) 안에 위치한다 — fieldset 절대배치 클리핑 회귀 방지', () => {
		// fieldset 직속에 두면 절대배치 기준이 legend 아래 익명 콘텐츠 박스가 되어
		// 제목바 밖(overflow:hidden)으로 밀려 잘리므로, 반드시 legend 안에 있어야 한다.
		const wat = makeWat();
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createProfileSettings(container);

		const legend = container.querySelector('.watSet-profile-item-container[data-profile="lowVision"] legend.watSet-profile-title');
		expect(legend).not.toBeNull();
		expect(legend.querySelector('#watSet_profile_button_toggle_lowVision')).not.toBeNull();
	});

	test('프로필 토글 클릭은 toggleProfile로 위임된다', () => {
		const wat = makeWat();
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createProfileSettings(container);
		container.querySelector('#watSet_profile_button_toggle_lowVision').click();

		expect(wat.toggleProfile).toHaveBeenCalledWith('lowVision', expect.any(HTMLElement));
	});

	test('옵션 아코디언 버튼: disclosure 패턴 — aria-expanded·aria-controls·aria-hidden 토글', () => {
		const wat = makeWat();
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createProfileSettings(container);
		const fieldset = container.querySelector('.watSet-profile-item-container[data-profile="lowVision"]');
		const accordion = fieldset.querySelector('.watSet-profile-button-accordion');
		const inner = container.querySelector('#watSet_profile_items_wrap_lowVision');

		expect(accordion.getAttribute('role')).toBeNull(); // switch 아님 — 기본 button
		expect(accordion.getAttribute('aria-controls')).toBe('watSet_profile_items_wrap_lowVision');

		accordion.click();
		expect(accordion.getAttribute('aria-expanded')).toBe('true');
		expect(inner.classList.contains(Constants.CSS_CLASSES.ACTIVE)).toBe(true);
		expect(inner.getAttribute('aria-hidden')).toBe('false');
		// 열린 버튼이 사용 불가로 안내되던 회귀 방지
		expect(accordion.getAttribute('aria-disabled')).toBeNull();

		accordion.click();
		expect(accordion.getAttribute('aria-expanded')).toBe('false');
		expect(inner.getAttribute('aria-hidden')).toBe('true');
	});
});

describe('createToolsSettings', () => {
	test('위치·보기모드·언어·저장 섹션 구조 고정', () => {
		const wat = makeWat();
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createToolsSettings(container);

		// 도구 위치: right 기본 선택
		const positionRadios = Array.from(container.querySelectorAll('input[name="toolPosition"]'));
		expect(positionRadios.map(r => r.value)).toEqual(['left', 'right']);
		expect(positionRadios.find(r => r.checked).value).toBe('right');

		// 보기 모드: icon 기본 선택
		const viewModeRadios = Array.from(container.querySelectorAll('input[name="viewMode"]'));
		expect(viewModeRadios.map(r => r.value)).toEqual(['icon', 'list']);
		expect(viewModeRadios.find(r => r.checked).value).toBe('icon');

		// 언어: languageOptions 2개 → 셀렉터 노출
		expect(container.querySelector('#watSetWrap_language')).not.toBeNull();

		// 저장: 저장/삭제/확인/내보내기/가져오기 5종 버튼
		const storageButtons = Array.from(container.querySelectorAll('input[name="watSet_storage"]'));
		expect(storageButtons.map(b => b.id)).toEqual([
			'watSet_storage_save', 'watSet_storage_reset', 'watSet_storage_check',
			'watSet_storage_export', 'watSet_storage_import'
		]);
	});

	test('저장된 viewMode가 있으면 해당 라디오가 선택된다', () => {
		localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, JSON.stringify({ viewMode: 'list' }));
		const wat = makeWat();
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createToolsSettings(container);
		const viewModeRadios = Array.from(container.querySelectorAll('input[name="viewMode"]'));
		expect(viewModeRadios.find(r => r.checked).value).toBe('list');
	});

	test('언어 옵션이 1개면 언어 셀렉터를 만들지 않는다', () => {
		const wat = makeWat({ languageOptions: ['ko'] });
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createToolsSettings(container);
		expect(container.querySelector('#watSetWrap_language')).toBeNull();
	});

	test('위치 변경 시 html dataset 갱신 + 저장', () => {
		const wat = makeWat();
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createToolsSettings(container);
		const left = container.querySelector('input[name="toolPosition"][value="left"]');
		left.checked = true;
		left.dispatchEvent(new Event('change'));

		expect(document.documentElement.dataset.watPosition).toBe('left');
		expect(wat.savePreferences).toHaveBeenCalled();
		delete document.documentElement.dataset.watPosition;
	});

	test('저장/내보내기/가져오기 버튼이 해당 동작으로 위임된다', () => {
		const wat = makeWat();
		const container = document.createElement('div');
		document.body.appendChild(container);

		wat.createToolsSettings(container);

		container.querySelector('#watSet_storage_save').click();
		expect(wat.savePreferences).toHaveBeenCalled();
		expect(wat.showNotification).toHaveBeenCalled();

		container.querySelector('#watSet_storage_export').click();
		expect(wat.exportSettings).toHaveBeenCalled();

		container.querySelector('#watSet_storage_import').click();
		expect(wat._promptImportSettings).toHaveBeenCalled();
	});
});

describe('_createPersonalOptions 조립', () => {
	test('18개 옵션이 personalOpt_item으로 추가되고 options=false 항목은 제외된다', () => {
		const wat = makeWat({ options: { tts: false, stt: false } });
		const listElement = document.createElement('ul');
		document.body.appendChild(listElement);

		wat._createPersonalOptions(listElement);

		const items = Array.from(listElement.querySelectorAll(':scope > .personalOpt_item'));
		// 전체 18종 중 tts/stt 2종 제외 = 16
		expect(items).toHaveLength(16);
		expect(listElement.querySelector('.personalOpt_item.tts')).toBeNull();
		expect(listElement.querySelector('.personalOpt_item.stt')).toBeNull();
		expect(listElement.querySelector('.personalOpt_item.fontSize')).not.toBeNull();
		// optionsList 캐시도 채워진다 (이후 참조용)
		expect(Object.keys(wat.optionsList)).toHaveLength(18);
	});
});
