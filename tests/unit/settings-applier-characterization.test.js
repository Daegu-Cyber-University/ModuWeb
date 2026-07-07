/**
 * @fileoverview 설정 저장/복원/프로필 적용 클러스터 특성화 테스트 (Phase 6-7 추출 대비)
 * @description SettingsApplier 추출 전후로 동일하게 통과해야 하는 현재 동작 고정 테스트.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Constants } from '../../src/core/constants.js';
import { Defaults } from '../../src/core/defaults.js';

const CHANGE_METHODS = [
	'changeFontSize', 'changeFontFamily', 'changeScreenScale', 'changeTextAlign',
	'changeLetterSpacing', 'changeLineHeight', 'changeColorTheme', 'changeSaturation',
	'changeReadGuide', 'changeImgDisplayMode'
];

function makeWat(overrides = {}) {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.screenScaleRatios = { initial: 1, 'scale-1p2x': 1.2, 'scale-1p5x': 1.5, 'scale-2x': 2 };
	wat.getLocalizedText = jest.fn((key) => key);
	wat.state = { set: jest.fn(), get: jest.fn() };
	wat._dispatchStateEvent = jest.fn();
	wat._notify = jest.fn();
	wat._setTimeout = jest.fn();
	wat._skipSavePreferences = false;
	CHANGE_METHODS.forEach(m => { wat[m] = jest.fn(); });
	wat.toggleImgTextConversion = jest.fn();
	wat.toggleDisplayContents = jest.fn();
	wat.toggleDataAttribute = jest.fn();
	return Object.assign(wat, overrides);
}

/** documentElement에 남는 설정 흔적 제거 */
function resetDocumentElement() {
	const html = document.documentElement;
	['fontSize', 'fontFamily', 'screenScale', 'colorTheme', 'saturation',
		'imgDisplayMode', 'watViewmode', 'watPosition', 'watLanguage'].forEach(k => { delete html.dataset[k]; });
	['data-txt-align', 'data-letter-spacing', 'data-line-height', 'data-read-guide'].forEach(a => html.removeAttribute(a));
}

/** 프로필 UI 최소 골격 생성 (체크박스 상태 포함) */
function buildProfileDom(profileName, checkedKeys) {
	const profile = Defaults.PROFILES[profileName];
	const fieldset = document.createElement('fieldset');
	fieldset.className = 'watSet-profile-item-container';
	fieldset.setAttribute('data-profile', profileName);

	const toggle = document.createElement('button');
	toggle.className = 'profileToggle';
	toggle.setAttribute('aria-pressed', 'false');
	toggle.setAttribute('data-profile', profileName);
	const label = document.createElement('span');
	label.className = 'watSet-button-label';
	toggle.appendChild(label);
	fieldset.appendChild(toggle);

	Object.keys(profile.settings).forEach(key => {
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.className = 'profileListItemInput';
		checkbox.setAttribute('data-key', key);
		checkbox.checked = checkedKeys.includes(key);
		fieldset.appendChild(checkbox);
	});

	const container = document.createElement('div');
	container.className = 'watSet-item-container profile-container';
	container.appendChild(fieldset);
	document.body.appendChild(container);
	return { fieldset, toggle };
}

beforeEach(() => {
	jest.useFakeTimers();
	localStorage.clear();
	document.body.innerHTML = '';
	resetDocumentElement();
});

afterEach(() => {
	jest.runOnlyPendingTimers();
	jest.useRealTimers();
	localStorage.clear();
	resetDocumentElement();
});

describe('savePreferences', () => {
	test('documentElement 상태를 수집해 localStorage에 저장하고 상태/이벤트를 갱신한다', () => {
		const wat = makeWat();
		document.documentElement.dataset.fontSize = 'size-2x';
		document.documentElement.setAttribute('data-txt-align', 'center');

		wat.savePreferences();

		const saved = JSON.parse(localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS));
		expect(saved.fontSize).toBe('size-2x');
		expect(saved.txtAlign).toBe('center');
		// 미설정 항목은 기본값으로 채워진다
		expect(saved.fontFamily).toBe(Defaults.SETTINGS.fontFamily);
		expect(saved.viewMode).toBe(Defaults.SETTINGS.viewMode);

		expect(wat.state.set).toHaveBeenCalledWith('settings', expect.objectContaining({ fontSize: 'size-2x' }));
		expect(wat._dispatchStateEvent).toHaveBeenCalledWith('settings:saved', expect.any(Object));
	});

	test('_skipSavePreferences 중에는 저장하지 않는다', () => {
		const wat = makeWat({ _skipSavePreferences: true });
		wat.savePreferences();
		expect(localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS)).toBeNull();
		expect(wat.state.set).not.toHaveBeenCalled();
	});
});

describe('loadPreferences', () => {
	test('저장값과 기본값을 병합해 반환하고 라디오 UI를 동기화한다', () => {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, JSON.stringify({ fontSize: 'size-2x', screenScale: 'scale-1p5x' }));

		// fontSize 라디오 골격
		document.body.innerHTML = `
			<li class="personalOpt_item fontSize"><ul class="opt_lists">
				<li class="opt_item"><input type="radio" class="wat-item-type-radio" name="fontSize" value="initial"></li>
				<li class="opt_item"><input type="radio" class="wat-item-type-radio" name="fontSize" value="size-2x"></li>
			</ul></li>`;

		const wat = makeWat();
		const settings = wat.loadPreferences();

		expect(settings.fontSize).toBe('size-2x');
		expect(settings.txtAlign).toBe(Defaults.SETTINGS.txtAlign); // 기본값 폴백

		const radio = document.querySelector('input[name="fontSize"][value="size-2x"]');
		expect(radio.checked).toBe(true);
		expect(radio.closest('.opt_item').classList.contains('selectOn')).toBe(true);
		// initial이 아닌 값이므로 그룹 컨테이너에도 selectOn
		expect(radio.closest('.personalOpt_item').classList.contains('selectOn')).toBe(true);

		// 화면 배율 비율이 상태에 반영된다
		expect(wat.state.set).toHaveBeenCalledWith('plugin.currentScreenScale', 1.5);
		expect(wat._dispatchStateEvent).toHaveBeenCalledWith('settings:loaded',
			expect.objectContaining({ wasEmpty: false }));
	});

	test('손상된 저장값은 기본값으로 대체된다', () => {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, '{broken');
		const wat = makeWat();
		const settings = wat.loadPreferences();
		expect(settings.fontSize).toBe(Defaults.SETTINGS.fontSize);
	});
});

describe('_applySettingToPage', () => {
	test('설정 키를 대응하는 change 메서드로 라우팅한다', () => {
		const wat = makeWat();
		const routes = [
			['fontSize', 'changeFontSize'], ['fontFamily', 'changeFontFamily'],
			['screenScale', 'changeScreenScale'], ['txtAlign', 'changeTextAlign'],
			['letterSpacing', 'changeLetterSpacing'], ['lineHeight', 'changeLineHeight'],
			['colorTheme', 'changeColorTheme'], ['saturation', 'changeSaturation'],
			['readGuide', 'changeReadGuide'], ['imgDisplayMode', 'changeImgDisplayMode']
		];
		routes.forEach(([key, method]) => {
			wat._applySettingToPage(key, 'v');
			expect(wat[method]).toHaveBeenCalledWith('v');
		});
	});

	test('viewMode/toolPosition은 documentElement dataset에 적용된다', () => {
		const wat = makeWat();
		wat._applySettingToPage('viewMode', 'list');
		wat._applySettingToPage('toolPosition', 'left');
		expect(document.documentElement.dataset.watViewmode).toBe('list');
		expect(document.documentElement.dataset.watPosition).toBe('left');
	});
});

describe('applyProfileSettings', () => {
	test('체크된 항목만 프로필 값으로, 나머지는 기본값으로 적용 후 선택 상태를 저장한다', () => {
		const wat = makeWat();
		wat._syncIndividualSettingsUI = jest.fn();
		wat.savePreferences = jest.fn();
		buildProfileDom('lowVision', ['fontSize', 'fontFamily', 'letterSpacing']);

		wat.applyProfileSettings('lowVision');

		// 프로필 값 적용
		expect(wat.changeFontSize).toHaveBeenCalledWith('size-1p5x');
		expect(wat.changeFontFamily).toHaveBeenCalledWith('koddi-udon-gothic');
		expect(wat.changeLetterSpacing).toHaveBeenCalledWith('wide_normal');
		// 프로필에 없는 항목은 기본값으로 리셋
		expect(wat.changeColorTheme).toHaveBeenCalledWith(Defaults.SETTINGS.colorTheme);

		// 적용 후 저장 + 선택 프로필 기록
		expect(wat.savePreferences).toHaveBeenCalled();
		const saved = JSON.parse(localStorage.getItem(Constants.STORAGE_KEYS.SELECTED_PROFILE));
		expect(saved.profileName).toBe('lowVision');
		expect(saved.enabledSettings.fontSize).toBe(true);
		// 적용 중 임시로 켠 저장 스킵 플래그는 복원된다
		expect(wat._skipSavePreferences).toBe(false);
	});

	test('체크 해제된 항목은 프로필 값 대신 기본값이 적용된다', () => {
		const wat = makeWat();
		wat._syncIndividualSettingsUI = jest.fn();
		wat.savePreferences = jest.fn();
		buildProfileDom('lowVision', ['fontFamily']); // fontSize·letterSpacing 체크 해제

		wat.applyProfileSettings('lowVision');

		expect(wat.changeFontSize).toHaveBeenCalledWith(Defaults.SETTINGS.fontSize);
		expect(wat.changeFontFamily).toHaveBeenCalledWith('koddi-udon-gothic');
	});

	test('하나도 체크되지 않으면 경고 후 적용을 중단한다', () => {
		const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
		const wat = makeWat();
		wat._syncIndividualSettingsUI = jest.fn();
		const { toggle } = buildProfileDom('colorBlindness', []);

		wat.applyProfileSettings('colorBlindness');

		expect(alertSpy).toHaveBeenCalled();
		expect(wat.changeSaturation).not.toHaveBeenCalled();
		expect(toggle.getAttribute('aria-pressed')).toBe('false');
		expect(localStorage.getItem(Constants.STORAGE_KEYS.SELECTED_PROFILE)).toBeNull();
	});

	test('알 수 없는 프로필은 경고만 남기고 무시한다', () => {
		const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
		const wat = makeWat();
		wat.applyProfileSettings('nope');
		expect(warnSpy).toHaveBeenCalled();
		expect(wat.changeFontSize).not.toHaveBeenCalled();
	});
});

describe('toggleProfile', () => {
	test('꺼진 프로필을 켜면 applyProfileSettings가 호출되고 형제 토글은 꺼진다', () => {
		const wat = makeWat();
		wat.applyProfileSettings = jest.fn();
		const { toggle } = buildProfileDom('lowVision', ['fontSize']);
		// 형제 프로필 추가
		const sibling = document.createElement('button');
		sibling.className = 'profileToggle';
		sibling.setAttribute('aria-pressed', 'true');
		const siblingLabel = document.createElement('span');
		siblingLabel.className = 'watSet-button-label';
		sibling.appendChild(siblingLabel);
		toggle.closest('.profile-container').appendChild(sibling);

		wat.toggleProfile('lowVision', toggle);

		expect(wat.applyProfileSettings).toHaveBeenCalledWith('lowVision');
		expect(toggle.getAttribute('aria-pressed')).toBe('true');
		expect(toggle.classList.contains(Constants.CSS_CLASSES.ACTIVE)).toBe(true);
		expect(sibling.getAttribute('aria-pressed')).toBe('false');
	});

	test('켜진 프로필을 끄면 접근성 설정이 기본값으로 리셋되고 선택 기록이 제거된다', () => {
		const wat = makeWat();
		wat._syncIndividualSettingsUI = jest.fn();
		wat.savePreferences = jest.fn();
		localStorage.setItem(Constants.STORAGE_KEYS.SELECTED_PROFILE, '{"profileName":"lowVision"}');
		const { toggle } = buildProfileDom('lowVision', ['fontSize']);
		toggle.setAttribute('aria-pressed', 'true');
		toggle.classList.add(Constants.CSS_CLASSES.ACTIVE);

		wat.toggleProfile('lowVision', toggle);

		expect(wat.changeFontSize).toHaveBeenCalledWith(Defaults.SETTINGS.fontSize);
		expect(wat.changeReadGuide).toHaveBeenCalledWith(Defaults.SETTINGS.readGuide);
		expect(toggle.getAttribute('aria-pressed')).toBe('false');
		expect(toggle.classList.contains(Constants.CSS_CLASSES.ACTIVE)).toBe(false);
		expect(localStorage.getItem(Constants.STORAGE_KEYS.SELECTED_PROFILE)).toBeNull();
		expect(wat.savePreferences).toHaveBeenCalled();
	});
});

describe('resetProfileSettings', () => {
	test('dyslexia: 폰트·줄간격·애니메이션·읽기가이드를 리셋한다', () => {
		const wat = makeWat();
		wat._syncIndividualSettingsUI = jest.fn();

		wat.resetProfileSettings('dyslexia');

		expect(wat.changeFontFamily).toHaveBeenCalledWith('initial');
		expect(wat.changeLineHeight).toHaveBeenCalledWith('initial');
		expect(wat.toggleDataAttribute).toHaveBeenCalledWith('stopAni', false);
		expect(wat.changeReadGuide).toHaveBeenCalledWith('');
		expect(wat._syncIndividualSettingsUI).toHaveBeenCalledWith(
			expect.objectContaining({ fontFamily: 'initial', lineHeight: 'initial', readGuide: 'unset' }));
	});

	test('lowVision: 폰트 크기·패밀리와 이미지 변환을 리셋한다', () => {
		const wat = makeWat();
		wat._syncIndividualSettingsUI = jest.fn();

		wat.resetProfileSettings('lowVision');

		expect(wat.changeFontSize).toHaveBeenCalledWith('initial');
		expect(wat.toggleImgTextConversion).toHaveBeenCalledWith(false);
		expect(wat.toggleDisplayContents).toHaveBeenCalledWith(false);
	});
});

describe('_restoreSelectedProfileUI', () => {
	test('저장된 프로필 선택 상태를 토글·체크박스 UI에 복원한다', () => {
		const wat = makeWat();
		const { fieldset, toggle } = buildProfileDom('lowVision', []);
		localStorage.setItem(Constants.STORAGE_KEYS.SELECTED_PROFILE, JSON.stringify({
			profileName: 'lowVision',
			enabledSettings: { fontSize: true, fontFamily: false, letterSpacing: true }
		}));

		wat._restoreSelectedProfileUI();

		expect(toggle.getAttribute('aria-pressed')).toBe('true');
		expect(toggle.classList.contains(Constants.CSS_CLASSES.ACTIVE)).toBe(true);
		expect(fieldset.querySelector('[data-key="fontSize"]').checked).toBe(true);
		expect(fieldset.querySelector('[data-key="fontFamily"]').checked).toBe(false);
	});

	test('프로필 구성이 사라졌으면 저장값을 정리한다', () => {
		const wat = makeWat();
		localStorage.setItem(Constants.STORAGE_KEYS.SELECTED_PROFILE, '{"profileName":"ghost"}');
		wat._restoreSelectedProfileUI();
		expect(localStorage.getItem(Constants.STORAGE_KEYS.SELECTED_PROFILE)).toBeNull();
	});

	test('저장값이 없으면 아무 것도 하지 않는다', () => {
		const wat = makeWat();
		expect(() => wat._restoreSelectedProfileUI()).not.toThrow();
	});
});

describe('_syncIndividualSettingsUI', () => {
	test('설정값에 맞는 라디오를 체크하고 selectOn 클래스를 동기화한다', () => {
		document.body.innerHTML = `
			<li class="personalOpt_item fontSize"><ul class="opt_lists">
				<li class="opt_item selectOn"><input type="radio" class="wat-item-type-radio" name="fontSize" value="initial"></li>
				<li class="opt_item"><input type="radio" class="wat-item-type-radio" name="fontSize" value="size-2x"></li>
			</ul></li>`;
		const wat = makeWat();

		wat._syncIndividualSettingsUI({ fontSize: 'size-2x' });

		const radio = document.querySelector('input[value="size-2x"]');
		expect(radio.checked).toBe(true);
		expect(radio.closest('.opt_item').classList.contains('selectOn')).toBe(true);
		expect(document.querySelector('input[value="initial"]').closest('.opt_item').classList.contains('selectOn')).toBe(false);
		expect(radio.closest('.personalOpt_item').classList.contains('selectOn')).toBe(true);
	});

	test('initial 값이면 그룹 컨테이너의 selectOn을 제거한다', () => {
		document.body.innerHTML = `
			<li class="personalOpt_item fontSize selectOn"><ul class="opt_lists">
				<li class="opt_item"><input type="radio" class="wat-item-type-radio" name="fontSize" value="initial"></li>
			</ul></li>`;
		const wat = makeWat();

		wat._syncIndividualSettingsUI({ fontSize: 'initial' });

		expect(document.querySelector('.personalOpt_item').classList.contains('selectOn')).toBe(false);
	});

	test('readGuide 모드 버튼의 활성 상태를 동기화한다', () => {
		document.body.innerHTML = `
			<button data-read-guide-mode="mask"></button>
			<button data-read-guide-mode="underline" class="active" aria-pressed="true"></button>`;
		const wat = makeWat();

		wat._syncIndividualSettingsUI({ readGuide: 'mask' });

		const mask = document.querySelector('[data-read-guide-mode="mask"]');
		const underline = document.querySelector('[data-read-guide-mode="underline"]');
		expect(mask.classList.contains(Constants.CSS_CLASSES.ACTIVE)).toBe(true);
		expect(mask.getAttribute('aria-pressed')).toBe('true');
		expect(underline.classList.contains(Constants.CSS_CLASSES.ACTIVE)).toBe(false);
		expect(underline.getAttribute('aria-pressed')).toBe('false');
	});

	test('잘못된 인자는 조용히 무시한다', () => {
		const wat = makeWat();
		expect(() => wat._syncIndividualSettingsUI(null)).not.toThrow();
		expect(() => wat._syncIndividualSettingsUI('str')).not.toThrow();
	});
});

describe('setInitialPreferences / getSelectedProfileName', () => {
	test('setInitialPreferences: 설정 로드 후 UI 동기화와 프로필 복원을 수행한다', () => {
		const wat = makeWat();
		wat.loadPreferences = jest.fn(() => ({ fontSize: 'size-2x' }));
		wat._syncIndividualSettingsUI = jest.fn();
		wat._restoreSelectedProfileUI = jest.fn();

		wat.setInitialPreferences();

		expect(wat.loadPreferences).toHaveBeenCalled();
		expect(wat._restoreSelectedProfileUI).toHaveBeenCalled();
		jest.advanceTimersByTime(150);
		expect(wat._syncIndividualSettingsUI).toHaveBeenCalledWith({ fontSize: 'size-2x' });
	});

	test('getSelectedProfileName: 켜진 프로필 토글의 data-profile을 반환한다', () => {
		const wat = makeWat();
		const { toggle } = buildProfileDom('dyslexia', []);
		expect(wat.getSelectedProfileName()).toBeNull();
		toggle.setAttribute('aria-pressed', 'true');
		expect(wat.getSelectedProfileName()).toBe('dyslexia');
	});
});
