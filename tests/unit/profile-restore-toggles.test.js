/**
 * @fileoverview 재방문 시 저장된 프로필의 토글형 설정(애니메이션 정지·미디어 정지·음소거) 복원 테스트
 * @description 토글형 값은 watSettings에 저장되지 않아 loadPreferences가 되살리지 못한다.
 *              저장된 프로필(selectedProfile)을 복원할 때 프로필이 켰던 토글형 항목을 다시 켜고
 *              개별 설정 스위치도 켜짐(aria-checked·상태 문구)으로 보여야 한다. 표시는 change 없이
 *              맞춰, 부수 효과(미디어 정지 등)가 스위치 핸들러에서 한 번 더 실행되지 않아야 한다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Constants } from '../../src/core/constants.js';

// 로케일은 키 그대로 반환하므로 상태 문구는 로케일 키로 비교한다 (on: 켜짐 문구, off: 꺼짐 문구)
const MEDIA_STOP = { on: 'panel.personal.options.mediaControl.options.stop', off: 'panel.personal.options.mediaControl.options.play' };
const MEDIA_MUTE = { on: 'panel.personal.options.soundControl.options.mute', off: 'panel.personal.options.soundControl.options.unmute' };
const STOP_ANI = { on: 'panel.personal.options.animationControl.options.stop', off: 'panel.personal.options.animationControl.options.play' };

const CHANGE_METHODS = [
	'changeFontSize', 'changeFontFamily', 'changeScreenScale', 'changeTextAlign',
	'changeLetterSpacing', 'changeLineHeight', 'changeColorTheme', 'changeSaturation',
	'changeReadGuide', 'changeImgDisplayMode'
];

// 페이지가 html 요소에 남기는 흔적 — 새로고침하면 사라진다
const HTML_DATASET_KEYS = ['stopAni', 'mediaStop', 'mediaMute', 'imgDisplayMode', 'watLanguage', 'watTtsVoice'];

/**
 * 패널 생성·프로필 적용·설정 저장과 복원에 필요한 서비스만 갖춘 최소 WAT 인스턴스
 * (생성자는 ConfigurationManager 등 무거운 의존을 가지므로 우회).
 * 토글형 부수 효과(toggleDataAttribute·toggleMediaStop·toggleMediaMute)와 저장·복원은 실제 메서드를 쓰고,
 * 라디오형 설정을 페이지에 적용하는 change 계열만 스텁으로 둔다
 */
function makeWat() {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.getLocalizedText = jest.fn((key) => key);
	wat.screenScaleRatios = { initial: 1, 'scale-1p2x': 1.2, 'scale-1p5x': 1.5, 'scale-2x': 2 };
	wat.state = { set: jest.fn(), get: jest.fn() };
	// 지연 UI 재동기화(라디오 대상)는 이 테스트의 관심사가 아니므로 실행하지 않는다
	wat._setTimeout = jest.fn();
	wat._notify = jest.fn();
	CHANGE_METHODS.forEach(m => { wat[m] = jest.fn(); });
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
 * 토글형 개인 옵션 스위치 3종, 실제 프로필 UI, 미디어 정지 확인용 영상을 문서에 붙인다
 * @param {WAT} wat
 */
function mountPanel(wat) {
	document.body.append(wat.createStopAniSettings(), wat.createMediaStopSettings(), wat.createMediaMuteSettings());
	const container = document.createElement('div');
	document.body.appendChild(container);
	wat.createProfileSettings(container);
	const video = document.createElement('video');
	document.body.appendChild(video);
	return {
		stopAni: document.getElementById('wat-checkbox-stopAni'),
		mediaStop: document.getElementById('wat-checkbox-mediaStop'),
		mediaMute: document.getElementById('wat-checkbox-mediaMute'),
		// 애니메이션 정지·미디어 정지를 켜는 기본 프로필
		profileToggle: document.getElementById('watSet_profile_button_toggle_motionSensitivity'),
		video
	};
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

/**
 * 첫 방문 — 패널을 그리고 움직임 민감 프로필을 켠다 (선택 상태가 localStorage에 저장된다)
 * @param {Function} [beforeApply] - 프로필을 켜기 전에 프로필 항목 체크를 바꿀 때 사용
 */
function firstVisitWithProfile(beforeApply) {
	const panel = mountPanel(makeWat());
	if (beforeApply) beforeApply();
	panel.profileToggle.click();
}

/**
 * 새로고침 후 재방문 — 문서와 html의 흔적은 사라지고 localStorage만 남은 상태에서
 * 새 인스턴스가 패널을 다시 그리고 초기 설정을 복원한다 (init: generateHTMLElements → setInitialPreferences)
 * @param {Object} [options]
 * @param {boolean} [options.withChangeDelegate=false] - change 위임이 이미 걸린 상태에서 복원할지
 *   (언어를 바꿔 패널을 다시 그릴 때처럼 setEventListeners 뒤에 복원이 다시 실행되는 경우)
 */
function revisit({ withChangeDelegate = false } = {}) {
	document.body.innerHTML = '';
	HTML_DATASET_KEYS.forEach(key => { delete document.documentElement.dataset[key]; });
	const wat = makeWat();
	if (withChangeDelegate) wireChangeDelegate(wat);
	const panel = mountPanel(wat);
	wat.setInitialPreferences();
	return panel;
}

let pausedMedia;

/**
 * 해당 미디어 요소에 pause가 호출된 횟수
 * @param {HTMLMediaElement} media
 */
function pauseCount(media) {
	return pausedMedia.filter(paused => paused === media).length;
}

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '';
	// jsdom은 미디어 재생을 구현하지 않으므로 pause 호출 대상만 기록한다
	pausedMedia = [];
	jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () { pausedMedia.push(this); });
	// 패널 라디오 없이 loadPreferences를 실행하므로 '라디오를 찾지 못함' 경고는 숨긴다
	jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	if (removeChangeDelegate) {
		removeChangeDelegate();
		removeChangeDelegate = null;
	}
	localStorage.clear();
	document.body.innerHTML = '';
	HTML_DATASET_KEYS.forEach(key => { delete document.documentElement.dataset[key]; });
});

describe('재방문 시 저장된 프로필의 토글형 설정 복원', () => {
	test('움직임 민감 프로필을 켜고 새로고침하면 애니메이션·미디어 정지가 다시 켜지고 스위치도 켜짐으로 보인다', () => {
		firstVisitWithProfile();

		const panel = revisit();

		expect(panel.profileToggle.getAttribute('aria-checked')).toBe('true');
		expect(document.documentElement.dataset.stopAni).toBe('true');
		expect(pauseCount(panel.video)).toBe(1);
		expect(readSwitch(panel.stopAni)).toEqual({ checked: true, ariaChecked: 'true', stateText: STOP_ANI.on });
		expect(readSwitch(panel.mediaStop)).toEqual({ checked: true, ariaChecked: 'true', stateText: MEDIA_STOP.on });
		// 이 프로필에 없는 음소거는 그대로 꺼짐
		expect(readSwitch(panel.mediaMute)).toEqual({ checked: false, ariaChecked: 'false', stateText: MEDIA_MUTE.off });
	});

	test('프로필에서 체크를 뺀 항목은 새로고침해도 켜지 않는다', () => {
		firstVisitWithProfile(() => {
			document.getElementById('watSet_checkbox_motionSensitivity_stopAni').checked = false;
		});

		const panel = revisit();

		expect(document.documentElement.dataset.stopAni).toBeUndefined();
		expect(readSwitch(panel.stopAni)).toEqual({ checked: false, ariaChecked: 'false', stateText: STOP_ANI.off });
		expect(readSwitch(panel.mediaStop)).toEqual({ checked: true, ariaChecked: 'true', stateText: MEDIA_STOP.on });
	});

	test('지금 프로필 정의에 없는 토글은 저장값에 켜짐으로 남아 있어도 켜지 않는다', () => {
		// 프로필 구성이 지금과 달랐던 버전이 저장한 값 — 움직임 민감 프로필에는 음소거가 없다
		localStorage.setItem(Constants.STORAGE_KEYS.SELECTED_PROFILE, JSON.stringify({
			profileName: 'motionSensitivity',
			enabledSettings: { stopAni: true, mediaStop: true, saturation: true, mediaMute: true }
		}));

		const panel = revisit();

		expect(panel.video.muted).toBe(false);
		expect(readSwitch(panel.mediaMute)).toEqual({ checked: false, ariaChecked: 'false', stateText: MEDIA_MUTE.off });
	});

	test('change 없이 표시만 맞춰, change 위임이 걸린 뒤 복원해도 미디어 정지는 한 번만 실행된다', () => {
		firstVisitWithProfile();

		const panel = revisit({ withChangeDelegate: true });

		// change가 나가면 스위치 핸들러가 toggleMediaStop을 한 번 더 불러 두 번 멈춘다
		expect(pauseCount(panel.video)).toBe(1);
		expect(readSwitch(panel.mediaStop)).toEqual({ checked: true, ariaChecked: 'true', stateText: MEDIA_STOP.on });
	});
});
