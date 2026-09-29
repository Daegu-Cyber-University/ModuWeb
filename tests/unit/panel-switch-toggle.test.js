/**
 * @fileoverview 개인 옵션 스위치(체크박스) 클릭 동작 테스트
 * @description 스위치 트랙(label.switch-label)은 for 속성으로 시각적으로 숨긴 input[role=switch]와
 *              연결되어 있어 브라우저 기본 동작만으로 토글·change가 일어난다.
 *              라벨에 토글 리스너를 또 달면 한 번 클릭에 두 번 바뀌어(change: true → false)
 *              상태는 그대로 남고 부수 효과(미디어 정지·음소거·애니메이션 정지·사전)만 두 번 실행된다.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';

/**
 * 스위치 생성에 필요한 서비스만 갖춘 최소 WAT 인스턴스 생성
 * (생성자는 ConfigurationManager 등 무거운 의존을 가지므로 우회)
 */
function makeWat() {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	// 로케일은 키 그대로 반환 — 동작 검증에 집중
	wat.getLocalizedText = jest.fn((key) => key);
	// 사전 서버가 설정된 환경으로 둔다 — 미설정이면 사전 검색 스위치가 비활성으로 그려진다
	wat.isDictionaryAvailable = () => true;
	return wat;
}

/**
 * 스위치 항목을 문서에 붙이고 change가 올 때마다 그 시점의 checked 값을 기록한다
 * (input의 기본 동작은 문서에 연결된 요소에서만 change를 발생시키므로 반드시 붙인다)
 * @param {HTMLLIElement} li - 스위치 설정 항목
 * @returns {{li: HTMLLIElement, checkbox: HTMLInputElement, changes: boolean[]}}
 */
function mountSwitch(li) {
	document.body.appendChild(li);
	const checkbox = li.querySelector('input[type="checkbox"][role="switch"]');
	const changes = [];
	checkbox.addEventListener('change', () => changes.push(checkbox.checked));
	return { li, checkbox, changes };
}

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('스위치 트랙(라벨) 클릭', () => {
	test.each([
		'createMediaStopSettings',
		'createMediaMuteSettings',
		'createStopAniSettings',
		'createDictionSettings'
	])('%s: 트랙을 한 번 클릭하면 한 번만 토글되고 change도 한 번만 발생한다', (method) => {
		const { li, checkbox, changes } = mountSwitch(makeWat()[method]());
		const track = li.querySelector('label.switch-label');

		track.click();
		expect(changes).toEqual([true]);
		expect(checkbox.checked).toBe(true);

		track.click();
		expect(changes).toEqual([true, false]);
		expect(checkbox.checked).toBe(false);
	});
});

describe('스위치 제목(role=button) 클릭', () => {
	test('제목을 클릭하면 한 번에 한 번씩 토글된다', () => {
		const { li, checkbox, changes } = mountSwitch(makeWat().createMediaStopSettings());
		const title = li.querySelector('.setTitle');

		title.click();
		expect(changes).toEqual([true]);
		expect(checkbox.checked).toBe(true);

		title.click();
		expect(changes).toEqual([true, false]);
		expect(checkbox.checked).toBe(false);
	});
});

describe('비활성 스위치', () => {
	test.each([
		['트랙(라벨)', 'label.switch-label'],
		['제목', '.setTitle']
	])('%s을 클릭해도 토글되지 않고 change도 발생하지 않는다', (_target, selector) => {
		const { li, checkbox, changes } = mountSwitch(makeWat().createSettingsItem('checkbox', 'title', 'demo', [
			{ value: 'on', label: 'On', label_toggle: 'Off', disabled: true }
		]));
		expect(checkbox.disabled).toBe(true);

		li.querySelector(selector).click();
		expect(changes).toEqual([]);
		expect(checkbox.checked).toBe(false);
	});
});
