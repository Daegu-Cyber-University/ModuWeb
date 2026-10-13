/**
 * @fileoverview 화면 낭독이 비밀번호 칸의 값을 소리 내 읽지 않는지 확인
 * @description 웹 음성(speechSynthesis)은 스피커로 나와 옆 사람도 듣는다. 포커스 탐지(Tab·클릭)와
 *              자동 읽기는 TextExtractor로 입력란을 읽으므로, 비밀번호 칸은 값 대신 라벨·안내문만
 *              읽어야 한다. 비밀번호 칸: type=password, 또는 autocomplete가 비밀번호·일회용 비밀번호를
 *              가리키는 칸(비밀번호 보기 단추로 type이 text로 바뀐 칸 포함).
 *              실제 TextExtractor와 한국어 로케일로 검증한다 (낭독 문구를 스텁으로 바꾸면 값 노출을 못 잡는다).
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TextExtractor } from '../../src/tts/TextExtractor.js';
import { FocusTTS } from '../../src/tts/FocusTTS.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ko = JSON.parse(readFileSync(join(__dirname, '..', '..', 'dist', 'assets', 'locales', 'ko.json'), 'utf8'));
const SECRET = 'Secret!23';

/**
 * 실제 한국어 로케일로 문구를 찾는 WAT 스텁 (키가 없으면 빈 문자열 — WAT.getLocalizedText와 같음)
 * @returns {Object} textExtractor를 가진 플러그인
 */
function makePlugin() {
	const plugin = {
		language: 'ko',
		getLocalizedText: (key) => key.split('.').reduce((node, part) => (node ? node[part] : undefined), ko) || '',
		showNotification: jest.fn()
	};
	plugin.textExtractor = new TextExtractor(plugin);
	return plugin;
}

/**
 * 마크업을 문서에 넣고 첫 input을 돌려준다
 * @param {string} html - 입력란 마크업
 * @returns {HTMLInputElement}
 */
function mountInput(html) {
	document.body.innerHTML = html;
	return document.querySelector('input');
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('TextExtractor — 비밀번호 칸은 값을 읽지 않는다', () => {
	let extractor;

	beforeEach(() => {
		extractor = makePlugin().textExtractor;
	});

	test('type=password는 라벨만 읽는다', () => {
		const field = mountInput(`<label for="pw">비밀번호</label><input id="pw" type="password" value="${SECRET}">`);

		expect(extractor.generateTextToRead(field, 'input')).toBe('비밀번호');
	});

	test('라벨이 없으면 안내문을, 안내문도 없으면 "비밀번호 입력란"을 읽는다', () => {
		const withPlaceholder = mountInput(`<input type="password" placeholder="비밀번호를 입력하세요" value="${SECRET}">`);
		expect(extractor.generateTextToRead(withPlaceholder, 'input')).toBe('비밀번호를 입력하세요');

		const bare = mountInput(`<input type="password" value="${SECRET}">`);
		expect(extractor.generateTextToRead(bare, 'input')).toBe('비밀번호 입력란');
	});

	test.each([
		['current-password'],
		['new-password'],
		['one-time-code'],
		['section-login current-password']
	])('autocomplete="%s"인 칸은 type=text여도 값을 읽지 않는다 (비밀번호 보기·일회용 비밀번호)', (autocomplete) => {
		const field = mountInput(`<label for="f">비밀번호</label><input id="f" type="text" autocomplete="${autocomplete}" value="${SECRET}">`);

		expect(extractor.generateTextToRead(field, 'input')).toBe('비밀번호');
	});

	test('일반 입력란은 지금처럼 라벨과 값을 읽는다', () => {
		const field = mountInput('<label for="uid">아이디</label><input id="uid" type="text" autocomplete="username" value="20231234">');

		expect(extractor.generateTextToRead(field, 'input')).toBe('아이디 20231234');
	});
});

describe('FocusTTS — 비밀번호 칸에 Tab·클릭으로 들어가도 값이 들리지 않는다', () => {
	let spoken;
	let focusTTS;
	let field;

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
		field = mountInput(`<label for="pw">비밀번호</label><input id="pw" type="password" value="${SECRET}">`);
		focusTTS = new FocusTTS({
			plugin: makePlugin(),
			config: { speechRate: 1 },
			getSpeechLang: () => 'ko-KR',
			applyVoice: () => {}
		});
		focusTTS.enable();
	});

	afterEach(() => {
		focusTTS.destroy();
		jest.useRealTimers();
		delete window.speechSynthesis;
		delete global.SpeechSynthesisUtterance;
	});

	test('Tab으로 포커스가 들어오면 라벨만 읽는다', () => {
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

		expect(spoken).toEqual(['비밀번호']);
	});

	test('클릭하면 라벨만 읽는다', () => {
		field.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		jest.advanceTimersByTime(150);

		expect(spoken).toEqual(['비밀번호']);
	});

	test('요소 낭독이 실패해 단순 추출로 넘어가도 값을 읽지 않는다', () => {
		expect(focusTTS._getSimpleElementText(field)).not.toContain(SECRET);
	});
});
