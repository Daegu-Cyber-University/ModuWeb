/**
 * @fileoverview 사전 서버 설정 여부에 따른 사전 검색 기능 노출 테스트
 * @description config에 사전 서버(api.dictionary.serverEndpoint)가 없으면 사전 검색은 동작할 수
 *              없으므로, 패널에 사전 검색 항목을 넣지 않고 단축키(Alt+Shift+D)에도 반응하지 않는다.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Dictionary } from '../../src/wat/Dictionary.js';

const ENDPOINT = 'https://dict.example.com/search';

/**
 * 개인 옵션 패널을 그릴 수 있는 최소 WAT 인스턴스 — 사전 설정은 config 로드 후와 같은 검증을 거친다
 * @param {Object} dictionaryConfig - api.dictionary 설정
 */
function makeWat(dictionaryConfig) {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.fontSizeRatios = { initial: 1, 'size-1p5x': 1.5, 'size-2x': 2 };
	wat.letterSpacingRatios = { initial: 0, wide_normal: 0.05, wide_more: 0.1 };
	wat.lineHeightRatios = { initial: 1, 'size-1p5x': 1.5, 'size-2x': 2 };
	wat.language = 'ko';
	wat.getLocalizedText = jest.fn((key) => key);
	wat.loadWebFont = jest.fn();
	wat._config = { api: { dictionary: { ...dictionaryConfig } } };
	wat._validateDictionaryConfiguration();
	return wat;
}

/**
 * 개인 옵션 목록을 그려 반환합니다
 * @param {WAT} wat - 대상 인스턴스
 * @returns {HTMLUListElement}
 */
function renderPersonalList(wat) {
	const list = document.createElement('ul');
	document.body.appendChild(list);
	wat._createPersonalOptions(list);
	return list;
}

/**
 * 호스트 본문의 텍스트를 선택한 상태를 만듭니다
 * @param {string} text - 선택할 텍스트
 */
function selectText(text) {
	const paragraph = document.createElement('p');
	paragraph.textContent = text;
	document.body.appendChild(paragraph);
	const range = document.createRange();
	range.selectNodeContents(paragraph);
	const selection = window.getSelection();
	selection.removeAllRanges();
	selection.addRange(range);
}

/** Alt+Shift+D keydown 이벤트 (취소 가능) */
function altShiftD() {
	return new KeyboardEvent('keydown', { key: 'D', altKey: true, shiftKey: true, cancelable: true });
}

/**
 * Dictionary가 쓰는 플러그인 표면(상태·사용 가능 여부)만 갖춘 스텁
 * @param {boolean} available - 사전 사용 가능 여부
 */
function makeDictionaryPlugin(available) {
	const store = new Map([['plugin.isDictionEnabled', false]]);
	return {
		state: { get: (key) => store.get(key), set: (key, value) => store.set(key, value) },
		isDictionaryAvailable: () => available
	};
}

beforeEach(() => {
	window.getSelection().removeAllRanges();
	document.body.innerHTML = '';
});

describe('isDictionaryAvailable', () => {
	test('serverEndpoint가 없거나 비어 있으면 사용할 수 없다', () => {
		expect(makeWat({ serverEndpoint: null }).isDictionaryAvailable()).toBe(false);
		expect(makeWat({ serverEndpoint: '   ' }).isDictionaryAvailable()).toBe(false);
	});

	test('serverEndpoint가 있으면 사용할 수 있다', () => {
		expect(makeWat({ serverEndpoint: ENDPOINT }).isDictionaryAvailable()).toBe(true);
	});

	test('config가 아직 없으면 사용할 수 없다', () => {
		expect(Object.create(WAT.prototype).isDictionaryAvailable()).toBe(false);
	});
});

describe('사전 서버가 없는 사이트', () => {
	test('개인 옵션 패널에 사전 검색 항목이 나타나지 않는다', () => {
		const list = renderPersonalList(makeWat({ serverEndpoint: null }));

		expect(list.querySelector('.personalOpt_item.diction')).toBeNull();
		expect(list.querySelector('#wat-checkbox-diction')).toBeNull();
		// 나머지 기능은 그대로 — 18종 중 사전 검색만 빠진다
		expect(list.querySelectorAll(':scope > .personalOpt_item')).toHaveLength(17);
	});

	test('Alt+Shift+D를 눌러도 키를 가로채지 않고 사전 검색을 시도하지 않는다', () => {
		const wat = makeWat({ serverEndpoint: null });
		wat.performDiction = jest.fn();
		selectText('보조공학');

		const event = altShiftD();
		wat._handleKeyDown(event);

		expect(wat.performDiction).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});
});

describe('사전 서버가 설정된 사이트', () => {
	test('개인 옵션 패널에 사전 검색 스위치가 나타나고 켤 수 있다', () => {
		const list = renderPersonalList(makeWat({ serverEndpoint: ENDPOINT }));
		const item = list.querySelector('.personalOpt_item.diction');
		expect(item).not.toBeNull();
		expect(list.querySelectorAll(':scope > .personalOpt_item')).toHaveLength(18);

		const checkbox = item.querySelector('#wat-checkbox-diction');
		expect(checkbox.disabled).toBe(false);
		item.querySelector('.setTitle').click();
		expect(checkbox.checked).toBe(true);
	});

	test('Alt+Shift+D로 선택한 단어를 사전 검색한다', () => {
		const wat = makeWat({ serverEndpoint: ENDPOINT });
		wat.performDiction = jest.fn();
		selectText('보조공학');

		const event = altShiftD();
		wat._handleKeyDown(event);

		expect(wat.performDiction).toHaveBeenCalledWith('보조공학');
		expect(event.defaultPrevented).toBe(true);
	});

	test('options.diction === false로 끈 사이트는 서버가 있어도 숨긴다', () => {
		const wat = makeWat({ serverEndpoint: ENDPOINT });
		wat.options = { diction: false };
		const list = renderPersonalList(wat);
		expect(list.querySelector('.personalOpt_item.diction')).toBeNull();
	});
});

describe('Dictionary.toggleDiction', () => {
	test('사전을 쓸 수 없으면 코드로 켜려 해도 꺼진 상태를 유지한다', () => {
		const plugin = makeDictionaryPlugin(false);
		new Dictionary(plugin).toggleDiction();
		expect(plugin.state.get('plugin.isDictionEnabled')).toBe(false);
	});

	test('사전을 쓸 수 있으면 켜고 끌 수 있다', () => {
		const plugin = makeDictionaryPlugin(true);
		const dictionary = new Dictionary(plugin);
		dictionary.toggleDiction();
		expect(plugin.state.get('plugin.isDictionEnabled')).toBe(true);
		dictionary.toggleDiction();
		expect(plugin.state.get('plugin.isDictionEnabled')).toBe(false);
	});
});
