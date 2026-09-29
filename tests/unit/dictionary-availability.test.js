/**
 * @fileoverview 사전 서버 설정 여부에 따른 사전 검색 스위치 상태 테스트
 * @description config에 사전 서버(api.dictionary.serverEndpoint)가 없으면 사전 검색은 동작할 수
 *              없으므로, 스위치를 켤 수 없는 비활성 상태로 표시하고 "사용 불가"로 안내한다.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Dictionary } from '../../src/wat/Dictionary.js';

const ENDPOINT = 'https://dict.example.com/search';

/**
 * 사전 설정만 주입한 최소 WAT 인스턴스 — config 로드 후와 같은 검증 과정을 거친다
 * @param {Object} dictionaryConfig - api.dictionary 설정
 */
function makeWat(dictionaryConfig) {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.getLocalizedText = jest.fn((key) => key);
	wat._config = { api: { dictionary: { ...dictionaryConfig } } };
	wat._validateDictionaryConfiguration();
	return wat;
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

describe('사전 검색 스위치 — 서버 미설정', () => {
	test('스위치가 꺼진 비활성 상태로 그려지고 "사용 불가"로 안내된다', () => {
		const li = makeWat({ serverEndpoint: null }).createDictionSettings();
		const checkbox = li.querySelector('input[type="checkbox"]');

		expect(checkbox.disabled).toBe(true);
		expect(checkbox.checked).toBe(false);
		expect(li.querySelector('.switch-state').textContent).toBe('panel.personal.options.diction.options.unavailable');
		expect(checkbox.getAttribute('title')).toContain('panel.personal.options.diction.options.unavailable');
		// 제목(role=button)도 비활성임을 보조기술에 알린다
		expect(li.querySelector('.setTitle').getAttribute('aria-disabled')).toBe('true');
	});

	test('제목·스위치를 눌러도 켜지지 않고 change 이벤트도 발생하지 않는다', () => {
		const li = makeWat({ serverEndpoint: null }).createDictionSettings();
		document.body.appendChild(li);
		const checkbox = li.querySelector('input[type="checkbox"]');
		const changed = jest.fn();
		li.addEventListener('change', changed);

		li.querySelector('.setTitle').click();
		li.querySelector('.switch-label').click();

		expect(checkbox.checked).toBe(false);
		expect(changed).not.toHaveBeenCalled();
	});
});

describe('사전 검색 스위치 — 서버 설정됨', () => {
	test('스위치가 활성 상태로 그려지고 제목 클릭으로 켜진다', () => {
		const li = makeWat({ serverEndpoint: ENDPOINT }).createDictionSettings();
		document.body.appendChild(li);
		const checkbox = li.querySelector('input[type="checkbox"]');

		expect(checkbox.disabled).toBe(false);
		expect(li.querySelector('.setTitle').hasAttribute('aria-disabled')).toBe(false);

		li.querySelector('.setTitle').click();
		expect(checkbox.checked).toBe(true);
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
