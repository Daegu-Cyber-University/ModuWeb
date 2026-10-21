/**
 * @fileoverview Esc 키의 범위 — 패널 닫기는 위젯 안에서 누른 Esc에만 반응한다 (WCAG 2.4.3)
 * @description
 *   - 모달(페이지 구조·사전)에서 누른 Esc가 document까지 전파되어 모달과 함께 패널까지 닫히던 문제
 *   - 호스트 페이지의 입력칸 등 위젯 밖에서 누른 Esc에도 패널이 닫히던 문제
 *   패널 헤더·열기 버튼은 실제 생성 메서드로 만들고, setEventListeners처럼 document keydown에
 *   _handleKeyDown을 연결해 실제 전파 경로를 따른다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';

let removeKeydown = null;

/** 열린 패널(헤더의 닫기 버튼 + 열기 버튼)과 document keydown 위임을 갖춘 WAT 인스턴스 */
function mountOpenPanel() {
	const container = document.createElement('div');
	container.id = 'watContainer';
	document.body.appendChild(container);

	const wat = Object.create(WAT.prototype);
	wat.container = container;
	wat.getLocalizedText = jest.fn((key) => key);
	wat.getConfigValue = jest.fn((path, defaultValue) => defaultValue);

	const mainPanel = document.createElement('div');
	container.appendChild(mainPanel);
	wat._createHeader(mainPanel);
	container.appendChild(wat._createOpenButton());

	const handler = (e) => wat._handleKeyDown(e);
	document.addEventListener('keydown', handler);
	removeKeydown = () => document.removeEventListener('keydown', handler);
	return wat;
}

function pressEscape(target) {
	const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

const isPanelOpen = (wat) => !wat.container.classList.contains('hide');

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '';
	document.body.className = '';
});

afterEach(() => {
	if (removeKeydown) {
		removeKeydown();
		removeKeydown = null;
	}
	document.body.innerHTML = '';
	document.body.className = '';
	delete document.documentElement.dataset.watPanel;
	localStorage.clear();
});

describe('패널 안에서 누른 Esc', () => {
	test('패널을 닫고 포커스를 열기 버튼으로 돌린다', () => {
		const wat = mountOpenPanel();
		const minimize = document.getElementById('wat_btnMinimize');
		minimize.focus();

		pressEscape(minimize);

		expect(isPanelOpen(wat)).toBe(false);
		expect(document.activeElement).toBe(document.getElementById('wat_btnOpen'));
	});

	test('패널 안의 컨트롤이 이미 처리한 Esc(기본 동작 취소)로는 닫지 않는다', () => {
		const wat = mountOpenPanel();
		const minimize = document.getElementById('wat_btnMinimize');
		// 펼친 목록을 Esc로 접는 컨트롤처럼 자기 몫으로 처리하고 기본 동작을 취소한다
		minimize.addEventListener('keydown', (e) => e.preventDefault());
		minimize.focus();

		pressEscape(minimize);

		expect(isPanelOpen(wat)).toBe(true);
	});
});

describe('위젯 밖에서 누른 Esc', () => {
	test('호스트 페이지 입력칸의 Esc로는 패널이 닫히지 않는다', () => {
		const wat = mountOpenPanel();
		const hostInput = document.createElement('input');
		document.body.appendChild(hostInput);
		hostInput.focus();

		pressEscape(hostInput);

		expect(isPanelOpen(wat)).toBe(true);
		expect(document.activeElement).toBe(hostInput);
	});
});

describe('모달에서 누른 Esc', () => {
	/** body에 붙는 모달(페이지 구조·사전과 같은 구조)을 패널의 버튼에서 연다 */
	function openModalFrom(wat, opener) {
		const overlay = document.createElement('div');
		overlay.className = 'overlay wat-overlay';
		document.body.appendChild(overlay);
		const layer = document.createElement('div');
		layer.setAttribute('role', 'dialog');
		layer.setAttribute('tabindex', '-1');
		const closeButton = document.createElement('button');
		layer.appendChild(closeButton);
		document.body.appendChild(layer);
		wat.trapFocus(layer, opener, overlay);
		closeButton.focus();
		return { layer, closeButton };
	}

	test('모달만 닫고 패널은 열어 둔 채 모달을 연 버튼으로 포커스를 돌린다', () => {
		const wat = mountOpenPanel();
		const opener = document.getElementById('wat_btnMinimize');
		opener.focus();
		const { layer, closeButton } = openModalFrom(wat, opener);

		pressEscape(closeButton);

		expect(layer.isConnected).toBe(false);
		expect(isPanelOpen(wat)).toBe(true);
		expect(document.activeElement).toBe(opener);
	});

	test('모달이 처리한 Esc는 document의 다른 리스너로 전파되지 않는다', () => {
		const wat = mountOpenPanel();
		const { closeButton } = openModalFrom(wat, document.getElementById('wat_btnMinimize'));
		const documentListener = jest.fn();
		document.addEventListener('keydown', documentListener);

		pressEscape(closeButton);
		document.removeEventListener('keydown', documentListener);

		expect(documentListener).not.toHaveBeenCalled();
	});
});
