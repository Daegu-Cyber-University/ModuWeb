/**
 * @fileoverview FocusTTS(포커스 탐지 낭독) 동작 테스트
 * @description 위젯이 호스트 요소에 붙이는 wat- 마킹 클래스(body.wat-apply, wat-dyn-*)를
 *              위젯 UI로 오인해 페이지의 어떤 요소도 읽지 않던 회귀와,
 *              키보드(Tab) 포커스 이동 낭독을 고정한다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { FocusTTS } from '../../src/tts/FocusTTS.js';

let spoken;
let focusTTS;

/**
 * FocusTTS가 쓰는 TTSManager 표면만 갖춘 스텁
 */
function makeTTSManager() {
	return {
		plugin: {
			textExtractor: { generateTextToRead: (element) => element.textContent.trim() },
			showNotification: jest.fn()
		},
		config: { speechRate: 1 },
		getSpeechLang: () => 'ko-KR',
		applyVoice: () => {}
	};
}

/**
 * 키보드로 포커스를 옮긴 것과 같은 이벤트 순서(keydown → focusin)를 재현
 * @param {Element} element - 포커스를 받는 요소
 */
function keyboardFocus(element) {
	document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
	element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}

beforeEach(() => {
	jest.useFakeTimers();
	spoken = [];
	window.speechSynthesis = {
		speak: jest.fn((utterance) => spoken.push(utterance.text)),
		cancel: jest.fn(),
		pause: jest.fn(),
		resume: jest.fn(),
		speaking: false
	};
	global.SpeechSynthesisUtterance = class {
		constructor(text) {
			this.text = text;
		}
	};
	// 기본 설정(applySelector: 'body')으로 초기화된 호스트 페이지 — 동적 스타일 마킹 클래스 포함
	document.body.className = 'wat-apply';
	document.body.innerHTML = `
		<div class="header wat-dyn-el wat-dyn-fontsize">
			<a href="#support" id="hostLink" class="wat-dyn-el wat-dyn-fontsize">보조공학지원</a>
		</div>
		<p id="hostPara" class="wat-dyn-el wat-dyn-lineheight">본문 텍스트입니다</p>
		<div id="watContainer" class="wat-container no-speech wat-exclude">
			<button type="button" id="wat-button-tts_focus_toggle">포커스탐지 시작</button>
		</div>
		<div class="wat-user-feedback wat-feedback-info wat-exclude"><span id="feedbackMsg">알림</span></div>
	`;
	focusTTS = new FocusTTS(makeTTSManager());
});

afterEach(() => {
	focusTTS.destroy();
	jest.useRealTimers();
	document.body.className = '';
	document.body.innerHTML = '';
	delete window.speechSynthesis;
	delete global.SpeechSynthesisUtterance;
});

describe('위젯 UI 판정 (_isWatUIElement)', () => {
	test('호스트 요소는 wat- 마킹 클래스(body.wat-apply, wat-dyn-*)가 있어도 위젯 UI가 아니다', () => {
		expect(focusTTS._isWatUIElement(document.getElementById('hostLink'))).toBe(false);
		expect(focusTTS._isWatUIElement(document.getElementById('hostPara'))).toBe(false);
	});

	test('위젯 패널과 위젯이 띄운 UI(.wat-exclude)는 위젯 UI로 판정한다', () => {
		expect(focusTTS._isWatUIElement(document.getElementById('wat-button-tts_focus_toggle'))).toBe(true);
		expect(focusTTS._isWatUIElement(document.getElementById('feedbackMsg'))).toBe(true);
	});
});

describe('마우스 클릭·선택 낭독', () => {
	test('켜진 상태에서 호스트 링크를 클릭하면 링크를 읽는다', () => {
		focusTTS.enable();
		document.getElementById('hostLink').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		jest.advanceTimersByTime(150);
		expect(spoken).toEqual(['보조공학지원']);
	});

	test('위젯 패널 안의 클릭은 읽지 않는다', () => {
		focusTTS.enable();
		document.getElementById('wat-button-tts_focus_toggle').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		jest.advanceTimersByTime(150);
		expect(spoken).toEqual([]);
	});
});

describe('키보드 포커스 낭독', () => {
	test('켜진 상태에서 Tab으로 포커스가 이동하면 포커스된 요소를 읽는다', () => {
		focusTTS.enable();
		keyboardFocus(document.getElementById('hostLink'));
		expect(spoken).toEqual(['보조공학지원']);
	});

	test('마우스로 생긴 포커스는 focusin에서 읽지 않는다 (mouseup 낭독과 중복 방지)', () => {
		focusTTS.enable();
		const link = document.getElementById('hostLink');
		link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(spoken).toEqual([]);
	});

	test('마우스를 쓴 뒤에도 다시 키보드로 이동하면 읽는다', () => {
		focusTTS.enable();
		const link = document.getElementById('hostLink');
		link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		keyboardFocus(link);
		expect(spoken).toEqual(['보조공학지원']);
	});

	test('위젯 패널 안의 포커스 이동은 읽지 않는다', () => {
		focusTTS.enable();
		keyboardFocus(document.getElementById('wat-button-tts_focus_toggle'));
		expect(spoken).toEqual([]);
	});

	test('body로 포커스가 돌아가도 페이지 전체를 읽지 않는다', () => {
		focusTTS.enable();
		keyboardFocus(document.body);
		expect(spoken).toEqual([]);
	});

	test('끄면 포커스 이동을 더 이상 읽지 않는다', () => {
		focusTTS.enable();
		focusTTS.disable();
		keyboardFocus(document.getElementById('hostLink'));
		expect(spoken).toEqual([]);
	});
});
