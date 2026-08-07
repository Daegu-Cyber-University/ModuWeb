/**
 * @fileoverview TTS 목소리 선택 — TTSManager 음성 관리·PanelBuilder 목록 구성 테스트
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TTSManager } from '../../src/tts/TTSManager.js';
import { PanelBuilder } from '../../src/wat/PanelBuilder.js';

/** SpeechSynthesisVoice 유사 객체 */
function voice(name, lang, uri) {
	return { name, lang, voiceURI: uri || `${name}-uri`, default: false, localService: true };
}

const VOICES = [
	voice('Google 한국의', 'ko-KR'),
	voice('Microsoft Heami', 'ko-KR'),
	voice('Google US English', 'en-US'),
	voice('Microsoft Katja', 'de-DE')
];

/** window.speechSynthesis 스텁 설치 — 반환된 핸들로 voiceschanged 발화 */
function mockSpeechSynthesis(voices = VOICES) {
	const listeners = {};
	window.speechSynthesis = {
		getVoices: jest.fn(() => voices),
		cancel: jest.fn(),
		addEventListener: jest.fn((type, cb) => { listeners[type] = cb; }),
		removeEventListener: jest.fn((type) => { delete listeners[type]; })
	};
	return { listeners };
}

function makePlugin(overrides = {}) {
	return Object.assign({
		options: {},
		language: 'ko',
		state: { set: jest.fn(), get: jest.fn() },
		getLocalizedText: jest.fn((key) => key.split('.').pop()),
		createElementWithAttrs: jest.fn(),
		savePreferences: jest.fn()
	}, overrides);
}

beforeEach(() => {
	document.body.innerHTML = '';
});

afterEach(() => {
	delete window.speechSynthesis;
});

describe('TTSManager 음성 관리', () => {
	test('사용 가능한 음성 목록을 읽어 캐시한다', () => {
		mockSpeechSynthesis();
		const mgr = new TTSManager(makePlugin());
		expect(mgr.getAvailableVoices()).toHaveLength(4);
	});

	test('speechSynthesis 미지원 환경에서도 생성되고 빈 목록을 반환한다', () => {
		delete window.speechSynthesis;
		const mgr = new TTSManager(makePlugin());
		expect(mgr.getAvailableVoices()).toEqual([]);
		expect(mgr.getVoice()).toBe('');
	});

	test('voiceschanged 이벤트로 목록이 갱신되고 패널 갱신을 요청한다', () => {
		const { listeners } = mockSpeechSynthesis([]);
		const plugin = makePlugin({ updateTTSVoiceOptions: jest.fn() });
		const mgr = new TTSManager(plugin);
		expect(mgr.getAvailableVoices()).toEqual([]);

		// 브라우저가 뒤늦게 음성을 채운 상황
		window.speechSynthesis.getVoices = jest.fn(() => VOICES);
		listeners.voiceschanged();

		expect(mgr.getAvailableVoices()).toHaveLength(4);
		expect(plugin.updateTTSVoiceOptions).toHaveBeenCalled();
	});

	test('선택한 음성을 발화 객체에 적용하고 lang도 함께 맞춘다', () => {
		mockSpeechSynthesis();
		const mgr = new TTSManager(makePlugin());
		mgr.setVoice('Microsoft Katja-uri');

		const utterance = { lang: 'ko-KR' };
		mgr.applyVoice(utterance);

		expect(utterance.voice.name).toBe('Microsoft Katja');
		expect(utterance.lang).toBe('de-DE');
	});

	test('목록에 없는 음성이면 기본 음성으로 조용히 폴백한다', () => {
		mockSpeechSynthesis();
		const mgr = new TTSManager(makePlugin());
		mgr.setVoice('없는-기기의-음성');

		const utterance = { lang: 'ko-KR' };
		mgr.applyVoice(utterance);

		expect(utterance.voice).toBeUndefined();
		expect(utterance.lang).toBe('ko-KR'); // 언어 설정은 유지
	});

	test('음성 미선택(기본)이면 발화 객체를 건드리지 않는다', () => {
		mockSpeechSynthesis();
		const mgr = new TTSManager(makePlugin());
		const utterance = { lang: 'ko-KR' };
		mgr.applyVoice(utterance);
		expect(utterance.voice).toBeUndefined();
	});

	test('destroy가 voiceschanged 리스너를 해제한다', () => {
		mockSpeechSynthesis();
		const mgr = new TTSManager(makePlugin());
		mgr.destroy();
		expect(window.speechSynthesis.removeEventListener).toHaveBeenCalledWith('voiceschanged', expect.any(Function));
	});

	test('플러그인 언어를 BCP-47 코드로 변환한다', () => {
		mockSpeechSynthesis();
		expect(new TTSManager(makePlugin({ language: 'ko' })).getSpeechLang()).toBe('ko-KR');
		expect(new TTSManager(makePlugin({ language: 'ja' })).getSpeechLang()).toBe('ja-JP');
		expect(new TTSManager(makePlugin({ language: 'en-US' })).getSpeechLang()).toBe('en-US');
		expect(new TTSManager(makePlugin({ language: null })).getSpeechLang()).toBe('');
	});
});

describe('PanelBuilder.populateVoiceOptions', () => {
	/** 음성 선택 UI 골격 */
	function buildDom() {
		document.body.innerHTML = `
			<fieldset id="watSetWrap_ttsVoice">
				<div class="watSet-inner"><select id="watSet_ttsVoice_select"></select></div>
			</fieldset>`;
		return document.getElementById('watSet_ttsVoice_select');
	}

	function makeBuilder(ttsManager) {
		const builder = Object.create(PanelBuilder.prototype);
		builder.plugin = makePlugin({ ttsManager });
		return builder;
	}

	test('현재 언어 음성을 먼저 묶고 기본 음성 항목을 앞에 둔다', () => {
		mockSpeechSynthesis();
		const select = buildDom();
		const mgr = new TTSManager(makePlugin());
		makeBuilder(mgr).populateVoiceOptions();

		// 첫 항목은 항상 브라우저 기본 음성
		expect(select.options[0].value).toBe('');

		const groups = select.querySelectorAll('optgroup');
		expect(groups).toHaveLength(2);
		// ko 음성 2개가 현재 언어 그룹에 묶인다
		expect(groups[0].querySelectorAll('option')).toHaveLength(2);
		expect(groups[1].querySelectorAll('option')).toHaveLength(2);
		expect(groups[0].querySelector('option').textContent).toBe('Google 한국의 (ko-KR)');
	});

	test('음성이 없으면 컨트롤을 숨긴다', () => {
		mockSpeechSynthesis([]);
		const select = buildDom();
		const mgr = new TTSManager(makePlugin());
		makeBuilder(mgr).populateVoiceOptions();

		expect(document.getElementById('watSetWrap_ttsVoice').hidden).toBe(true);
		expect(select.options).toHaveLength(0);
	});

	test('저장된 음성이 목록에 있으면 선택 상태로 복원한다', () => {
		mockSpeechSynthesis();
		const select = buildDom();
		const mgr = new TTSManager(makePlugin());
		mgr.setVoice('Microsoft Heami-uri');
		makeBuilder(mgr).populateVoiceOptions();

		expect(select.value).toBe('Microsoft Heami-uri');
	});

	test('저장된 음성이 이 기기에 없으면 기본 음성으로 표시한다', () => {
		mockSpeechSynthesis();
		const select = buildDom();
		const mgr = new TTSManager(makePlugin());
		mgr.setVoice('다른-기기-음성');
		makeBuilder(mgr).populateVoiceOptions();

		expect(select.value).toBe('');
	});

	test('select가 없으면(패널 미생성) 예외 없이 무시한다', () => {
		mockSpeechSynthesis();
		const mgr = new TTSManager(makePlugin());
		expect(() => makeBuilder(mgr).populateVoiceOptions()).not.toThrow();
	});

	test('문서에 붙기 전(패널 조립 중) 요소를 직접 받아도 채운다', () => {
		mockSpeechSynthesis();
		// 문서에 삽입하지 않은 분리 상태 — 조립 중 호출 경로
		const detached = document.createElement('select');
		const mgr = new TTSManager(makePlugin());

		makeBuilder(mgr).populateVoiceOptions(detached);

		expect(detached.options.length).toBeGreaterThan(1);
		expect(detached.options[0].value).toBe('');
	});
});
