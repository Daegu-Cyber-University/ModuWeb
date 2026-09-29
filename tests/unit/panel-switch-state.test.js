/**
 * @fileoverview 개인 옵션 스위치의 상태 표시(aria-checked·상태 문구) 동기화 테스트
 * @description 스위치 옆 상태 문구(.switch-state)와 aria-checked는 실제 checked와 같아야 한다.
 *              처음 그릴 때, 사용자가 켜고 끌 때(change), 프로필이 켜고 끌 때, 코드가
 *              updatePersonalSettingsUI로 값을 맞출 때 모두 같은 표시가 나와야 한다. 프로필과
 *              updatePersonalSettingsUI는 change를 보내지 않고 표시만 맞춰, 호출부가 이미 실행한
 *              부수 효과(미디어 정지 등)가 스위치 핸들러에서 한 번 더 실행되지 않아야 한다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';

// 로케일은 키 그대로 반환하므로 상태 문구는 로케일 키로 비교한다 (on: 켜짐 문구, off: 꺼짐 문구)
const MEDIA_STOP = { on: 'panel.personal.options.mediaControl.options.stop', off: 'panel.personal.options.mediaControl.options.play' };
const MEDIA_MUTE = { on: 'panel.personal.options.soundControl.options.mute', off: 'panel.personal.options.soundControl.options.unmute' };
const STOP_ANI = { on: 'panel.personal.options.animationControl.options.stop', off: 'panel.personal.options.animationControl.options.play' };
const DICTION = { on: 'panel.personal.options.diction.options.on', off: 'panel.personal.options.diction.options.off' };

const CHANGE_METHODS = [
	'changeFontSize', 'changeFontFamily', 'changeScreenScale', 'changeTextAlign',
	'changeLetterSpacing', 'changeLineHeight', 'changeColorTheme', 'changeSaturation',
	'changeReadGuide', 'changeImgDisplayMode'
];

/**
 * 스위치·프로필 UI 생성과 프로필 적용에 필요한 서비스만 갖춘 최소 WAT 인스턴스
 * (생성자는 ConfigurationManager 등 무거운 의존을 가지므로 우회).
 * 스위치의 부수 효과는 호출 횟수를 셀 수 있도록 스파이로 둔다
 */
function makeWat() {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.getLocalizedText = jest.fn((key) => key);
	// 사전 서버가 설정된 환경으로 둔다 — 미설정이면 사전 검색 항목이 패널에 그려지지 않는다
	wat.isDictionaryAvailable = () => true;
	wat._setTimeout = jest.fn();
	wat._notify = jest.fn();
	wat.savePreferences = jest.fn();
	wat._syncIndividualSettingsUI = jest.fn();
	CHANGE_METHODS.forEach(m => { wat[m] = jest.fn(); });
	wat.toggleDataAttribute = jest.fn();
	wat.toggleMediaStop = jest.fn();
	wat.toggleMediaMute = jest.fn();
	wat.toggleDiction = jest.fn();
	return wat;
}

let removeChangeDelegate = null;

/**
 * setEventListeners가 문서에 거는 change 위임(_handleRadioChange)을 연결한다
 * — 스위치의 change는 이 위임을 거쳐 _handleCheckboxChange에서 처리된다
 * @param {WAT} wat
 */
function wireChangeDelegate(wat) {
	const handler = (e) => wat._handleRadioChange(e);
	document.addEventListener('change', handler);
	removeChangeDelegate = () => document.removeEventListener('change', handler);
}

/**
 * 스위치의 실제 상태와 표시를 함께 읽는다
 * @param {HTMLInputElement} checkbox - input[role=switch]
 */
function readSwitch(checkbox) {
	return {
		checked: checkbox.checked,
		ariaChecked: checkbox.getAttribute('aria-checked'),
		stateText: checkbox.parentElement.querySelector('.switch-state').textContent
	};
}

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '';
});

afterEach(() => {
	if (removeChangeDelegate) {
		removeChangeDelegate();
		removeChangeDelegate = null;
	}
	localStorage.clear();
	// 프로필 해제가 html에 남기는 흔적 정리
	delete document.documentElement.dataset.imgDisplayMode;
});

describe('처음 그린 스위치', () => {
	test.each([
		['createMediaStopSettings', MEDIA_STOP.off],
		['createMediaMuteSettings', MEDIA_MUTE.off],
		['createStopAniSettings', STOP_ANI.off],
		['createDictionSettings', DICTION.off]
	])('%s: 꺼진 스위치는 꺼짐 문구를 보인다', (method, offText) => {
		const li = makeWat()[method]();

		expect(readSwitch(li.querySelector('input[role="switch"]'))).toEqual({
			checked: false, ariaChecked: 'false', stateText: offText
		});
	});

	test.each([
		[true, 'true', 'On'],
		[false, 'false', 'Off']
	])('checked=%s로 그리면 aria-checked=%s, 상태 문구 %s', (checked, ariaChecked, stateText) => {
		const li = makeWat().createSettingsItem('checkbox', 'title', 'demo', [
			{ value: 'on', label: 'On', label_toggle: 'Off', checked }
		]);

		expect(readSwitch(li.querySelector('input[role="switch"]'))).toEqual({ checked, ariaChecked, stateText });
	});
});

describe('사용자가 스위치를 켜고 끌 때', () => {
	test('트랙을 누를 때마다 aria-checked와 상태 문구가 따라간다', () => {
		const wat = makeWat();
		wireChangeDelegate(wat);
		const li = wat.createMediaStopSettings();
		document.body.appendChild(li);
		const checkbox = li.querySelector('input[role="switch"]');
		const track = li.querySelector('label.switch-label');

		track.click();
		expect(readSwitch(checkbox)).toEqual({ checked: true, ariaChecked: 'true', stateText: MEDIA_STOP.on });
		expect(wat.toggleMediaStop).toHaveBeenLastCalledWith(true);

		track.click();
		expect(readSwitch(checkbox)).toEqual({ checked: false, ariaChecked: 'false', stateText: MEDIA_STOP.off });
		expect(wat.toggleMediaStop).toHaveBeenLastCalledWith(false);
	});
});

describe('프로필로 스위치를 켜고 끌 때', () => {
	/**
	 * 토글형 개인 옵션 스위치 3종과 실제 프로필 UI를 문서에 붙인다
	 * @param {WAT} wat
	 */
	function mountPanel(wat) {
		document.body.append(wat.createStopAniSettings(), wat.createMediaStopSettings(), wat.createMediaMuteSettings());
		const container = document.createElement('div');
		document.body.appendChild(container);
		wat.createProfileSettings(container);
		return {
			stopAni: document.getElementById('wat-checkbox-stopAni'),
			mediaStop: document.getElementById('wat-checkbox-mediaStop'),
			mediaMute: document.getElementById('wat-checkbox-mediaMute'),
			// 애니메이션 정지·미디어 정지를 켜는 기본 프로필
			profileToggle: document.getElementById('watSet_profile_button_toggle_motionSensitivity')
		};
	}

	test('움직임 민감 프로필을 켜면 애니메이션·미디어 제어 스위치가 켜짐으로, 끄면 꺼짐으로 표시된다', () => {
		const wat = makeWat();
		const { stopAni, mediaStop, profileToggle } = mountPanel(wat);

		profileToggle.click();
		expect(readSwitch(stopAni)).toEqual({ checked: true, ariaChecked: 'true', stateText: STOP_ANI.on });
		expect(readSwitch(mediaStop)).toEqual({ checked: true, ariaChecked: 'true', stateText: MEDIA_STOP.on });

		profileToggle.click();
		expect(readSwitch(stopAni)).toEqual({ checked: false, ariaChecked: 'false', stateText: STOP_ANI.off });
		expect(readSwitch(mediaStop)).toEqual({ checked: false, ariaChecked: 'false', stateText: MEDIA_STOP.off });
	});

	test('직접 켠 음소거가 프로필 해제로 풀리면 미디어 볼륨 제어 스위치도 꺼짐으로 표시된다', () => {
		const wat = makeWat();
		wireChangeDelegate(wat);
		const { mediaMute, profileToggle } = mountPanel(wat);

		mediaMute.parentElement.querySelector('label.switch-label').click();
		expect(readSwitch(mediaMute)).toEqual({ checked: true, ariaChecked: 'true', stateText: MEDIA_MUTE.on });

		profileToggle.click();
		// 프로필을 끄면 토글형 항목을 대칭으로 해제하면서 음소거도 푼다
		profileToggle.click();
		expect(wat.toggleMediaMute).toHaveBeenLastCalledWith(false);
		expect(readSwitch(mediaMute)).toEqual({ checked: false, ariaChecked: 'false', stateText: MEDIA_MUTE.off });
	});

	test('표시만 맞추고 change를 보내지 않아 부수 효과가 다시 실행되지 않는다', () => {
		const wat = makeWat();
		wireChangeDelegate(wat);
		const { profileToggle } = mountPanel(wat);

		profileToggle.click();
		profileToggle.click();

		// 프로필 적용·해제가 직접 부른 한 번씩뿐이다 — change가 나가면 스위치 핸들러가 한 번 더 부른다
		expect(wat.toggleMediaStop.mock.calls).toEqual([[true], [false]]);
		expect(wat.toggleDataAttribute.mock.calls).toEqual([['stopAni', true], ['stopAni', false]]);
	});
});

describe('updatePersonalSettingsUI로 스위치 값을 맞출 때', () => {
	/**
	 * 미디어 제어 스위치를 개인 옵션 목록에 붙인 모양으로 문서에 붙인다
	 * (_createPersonalOptions가 항목마다 붙이는 personalOpt_item·wat-item-wrap·옵션명 클래스로
	 * updatePersonalSettingsUI가 대상 input을 찾는다)
	 * @param {WAT} wat
	 */
	function mountMediaStop(wat) {
		const li = wat.createMediaStopSettings();
		li.classList.add('personalOpt_item', 'wat-item-wrap', 'mediaStop');
		document.body.appendChild(li);
		return li.querySelector('input[role="switch"]');
	}

	test('켜고 끄면 aria-checked와 상태 문구가 값을 따라간다', () => {
		const wat = makeWat();
		const mediaStop = mountMediaStop(wat);

		wat.updatePersonalSettingsUI('checkbox', 'mediaStop', true);
		expect(readSwitch(mediaStop)).toEqual({ checked: true, ariaChecked: 'true', stateText: MEDIA_STOP.on });

		wat.updatePersonalSettingsUI('checkbox', 'mediaStop', false);
		expect(readSwitch(mediaStop)).toEqual({ checked: false, ariaChecked: 'false', stateText: MEDIA_STOP.off });
	});

	test('표시만 맞추고 change를 보내지 않아 스위치 부수 효과가 실행되지 않는다', () => {
		const wat = makeWat();
		wireChangeDelegate(wat);
		mountMediaStop(wat);

		wat.updatePersonalSettingsUI('checkbox', 'mediaStop', true);

		// change가 나가면 스위치 핸들러가 data 속성을 바꾸고 미디어를 정지한다
		expect(wat.toggleDataAttribute).not.toHaveBeenCalled();
		expect(wat.toggleMediaStop).not.toHaveBeenCalled();
	});
});
