/**
 * @fileoverview 개별 설정 항목 제목(.setTitle, role=button)·이전/다음 버튼으로 값을 바꾸면 바뀐 값을 알린다 (WCAG 4.1.3)
 * @description
 *   제목을 누르면 라디오 값이 순환하고 스위치가 토글되지만, 포커스는 제목에 머물고 제목 이름은 그대로라
 *   스크린리더 사용자는 무엇으로 바뀌었는지 알 수 없었다. 바뀐 결과("제목: 값")를 상주 라이브 리전으로 알린다.
 *   항목은 실제 PanelBuilder로 만들고, 라이브 리전도 실제 _announceToLiveRegion을 쓴다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';

function makeWat() {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.getLocalizedText = jest.fn((key) => key);
	// 라이브 리전 갱신을 동기로 실행해 단언을 단순화
	wat._requestAnimationFrame = (callback) => callback();
	return wat;
}

const liveText = () => document.getElementById('wat-live-polite')?.textContent ?? null;

function mountRadio(title = '글자 크기') {
	const li = makeWat().createSettingsItem('radio', title, 'demo', [
		{ value: 'a', label: '기본', checked: true },
		{ value: 'b', label: '1.5배' },
		{ value: 'c', label: '2배' }
	]);
	document.body.appendChild(li);
	return li;
}

function mountCheckbox({ disabled = false } = {}) {
	const li = makeWat().createSettingsItem('checkbox', '애니메이션', 'demo', [
		{ value: 'stop', label: '정지', label_toggle: '재생', disabled }
	]);
	document.body.appendChild(li);
	return li;
}

beforeEach(() => {
	document.body.innerHTML = '';
});

afterEach(() => {
	document.body.innerHTML = '';
});

describe('라디오 항목', () => {
	test('제목을 누르면 다음 값으로 바뀐 결과를 알린다', () => {
		const li = mountRadio();

		li.querySelector('.setTitle').click();
		expect(liveText()).toBe('글자 크기: 1.5배');

		li.querySelector('.setTitle').click();
		expect(liveText()).toBe('글자 크기: 2배');
	});

	test('이전·다음 버튼으로 바꿔도 바뀐 값을 알린다', () => {
		const li = mountRadio();

		li.querySelector('.btn_chgOpt.prev').click();
		expect(liveText()).toBe('글자 크기: 2배');

		li.querySelector('.btn_chgOpt.next').click();
		expect(liveText()).toBe('글자 크기: 기본');
	});

	test('제목의 HTML 특수문자는 이스케이프된 형태가 아니라 원래 글자로 알린다', () => {
		const li = mountRadio('A & B');

		li.querySelector('.setTitle').click();

		expect(liveText()).toBe('A & B: 1.5배');
	});

	test('라디오를 직접 고를 때는 스크린리더가 이미 읽으므로 따로 알리지 않는다', () => {
		const li = mountRadio();
		const radio = li.querySelectorAll('input[type="radio"]')[1];

		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));

		expect(liveText()).toBeNull();
	});
});

describe('스위치 항목', () => {
	test('제목을 누르면 켜짐·꺼짐 상태 문구를 알린다', () => {
		const li = mountCheckbox();

		li.querySelector('.setTitle').click();
		expect(liveText()).toBe('애니메이션: 정지');

		li.querySelector('.setTitle').click();
		expect(liveText()).toBe('애니메이션: 재생');
	});

	test('비활성 스위치는 제목을 눌러도 바뀌지 않으므로 알리지 않는다', () => {
		const li = mountCheckbox({ disabled: true });

		li.querySelector('.setTitle').click();

		expect(liveText()).toBeNull();
	});
});
