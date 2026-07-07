/**
 * @fileoverview "1줄 설치" 자동 초기화(autoInit)와 CSS 자동 주입(_ensureStylesheet)의
 *               단위 테스트 (Phase 2).
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { parseAutoInitOptions, maybeAutoInit } from '../../src/core/autoInit.js';
import { WAT } from '../../src/wat/WAT.js';

function makeScript(attrs = {}) {
	const script = document.createElement('script');
	for (const [name, value] of Object.entries(attrs)) {
		script.setAttribute(name, value);
	}
	return script;
}

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	delete window.watPlugin;
});

afterEach(() => {
	delete window.watPlugin;
	jest.restoreAllMocks();
});

// ──────────────────────────────────────────────────
// parseAutoInitOptions — data-wat-* 속성 → 생성자 옵션
// ──────────────────────────────────────────────────
describe('parseAutoInitOptions', () => {
	test('속성이 없으면 빈 옵션을 반환한다', () => {
		expect(parseAutoInitOptions(makeScript())).toEqual({});
	});

	test('data-wat-config가 "{"로 시작하면 인라인 JSON으로 파싱한다', () => {
		const script = makeScript({
			'data-wat-config': '{"api": {"dictionary": {"enabled": true}}}'
		});
		const options = parseAutoInitOptions(script);
		expect(options.config).toEqual({ api: { dictionary: { enabled: true } } });
		expect(options.configPath).toBeUndefined();
	});

	test('잘못된 인라인 JSON은 경고 후 무시한다 (기본 설정으로 진행)', () => {
		const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
		const script = makeScript({ 'data-wat-config': '{invalid json' });

		const options = parseAutoInitOptions(script);
		expect(options.config).toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
	});

	test('data-wat-config 경로는 스크립트 src 기준 절대 경로로 해석된다 (하위 페이지 404 방지)', () => {
		const script = makeScript({ 'data-wat-config': './config.json' });
		// jsdom에서 script.src를 흉내내기 위해 속성으로 지정
		Object.defineProperty(script, 'src', {
			value: 'https://cdn.example.com/libs/moduweb/dist/webAccTools.js'
		});

		const options = parseAutoInitOptions(script);
		expect(options.configPath).toBe('https://cdn.example.com/libs/moduweb/dist/config.json');
	});

	test('script.src가 없으면 문서 baseURI 기준으로 해석된다', () => {
		const script = makeScript({ 'data-wat-config': './config.json' });
		const options = parseAutoInitOptions(script);
		expect(options.configPath).toBe(new URL('./config.json', document.baseURI).href);
	});

	test('언어·컨테이너·injectCss 속성이 옵션으로 전달된다', () => {
		const script = makeScript({
			'data-wat-language': 'en-US',
			'data-wat-container': '#my-container',
			'data-wat-inject-css': 'false'
		});
		const options = parseAutoInitOptions(script);
		expect(options.language).toBe('en-US');
		expect(options.containerSelector).toBe('#my-container');
		expect(options.injectCss).toBe(false);
	});
});

// ──────────────────────────────────────────────────
// maybeAutoInit — opt-in 스위치와 중복 가드
// ──────────────────────────────────────────────────
describe('maybeAutoInit', () => {
	class FakeWAT {
		constructor(options) {
			this.options = options;
			FakeWAT.instances.push(this);
		}
		init() {
			this.initialized = true;
		}
	}

	beforeEach(() => {
		FakeWAT.instances = [];
	});

	test('script가 null이면 아무것도 하지 않는다 (ESM 임포트 등 currentScript 부재)', () => {
		expect(maybeAutoInit(null, FakeWAT)).toBe(false);
		expect(FakeWAT.instances).toHaveLength(0);
	});

	test('data-wat-auto 속성이 없으면 초기화하지 않는다 (opt-in — 기존 사용자 무영향)', () => {
		expect(maybeAutoInit(makeScript(), FakeWAT)).toBe(false);
		expect(FakeWAT.instances).toHaveLength(0);
	});

	test('data-wat-auto가 있으면 인스턴스를 생성·초기화하고 window.watPlugin에 등록한다', () => {
		const script = makeScript({ 'data-wat-auto': '', 'data-wat-language': 'ja' });

		// jsdom 기본 readyState는 'complete' — 즉시 실행 경로
		expect(maybeAutoInit(script, FakeWAT)).toBe(true);
		expect(FakeWAT.instances).toHaveLength(1);
		expect(FakeWAT.instances[0].options.language).toBe('ja');
		expect(FakeWAT.instances[0].initialized).toBe(true);
		expect(window.watPlugin).toBe(FakeWAT.instances[0]);
	});

	test('이미 window.watPlugin이 있으면 중복 초기화하지 않는다 (watInit.js 병용 가드)', () => {
		const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
		window.watPlugin = { existing: true };

		maybeAutoInit(makeScript({ 'data-wat-auto': '' }), FakeWAT);
		expect(FakeWAT.instances).toHaveLength(0);
		expect(window.watPlugin).toEqual({ existing: true });
		expect(warnSpy).toHaveBeenCalled();
	});

	test('생성자가 던져도 예외가 밖으로 새지 않는다', () => {
		const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		class ThrowingWAT {
			constructor() { throw new Error('boom'); }
		}

		expect(() => maybeAutoInit(makeScript({ 'data-wat-auto': '' }), ThrowingWAT)).not.toThrow();
		expect(errorSpy).toHaveBeenCalled();
	});
});

// ──────────────────────────────────────────────────
// WAT.prototype._ensureStylesheet — CSS 자동 주입
// ──────────────────────────────────────────────────
describe('_ensureStylesheet', () => {
	test('injectCss:false면 주입하지 않는다 (opt-out)', () => {
		WAT.prototype._ensureStylesheet.call({ options: { injectCss: false } });
		expect(document.getElementById('wat-style-link')).toBeNull();
	});

	test('수동 <link>가 이미 있으면 중복 주입하지 않는다', () => {
		const manual = document.createElement('link');
		manual.rel = 'stylesheet';
		manual.href = '/vendor/moduweb/assets/css/webAccTools.css';
		document.head.appendChild(manual);

		WAT.prototype._ensureStylesheet.call({ options: {} });
		expect(document.getElementById('wat-style-link')).toBeNull();
	});

	test('standalone 인라인 스타일(#wat-inline-style)이 있으면 주입하지 않는다', () => {
		const style = document.createElement('style');
		style.id = 'wat-inline-style';
		document.head.appendChild(style);

		WAT.prototype._ensureStylesheet.call({ options: {} });
		expect(document.getElementById('wat-style-link')).toBeNull();
	});

	test('스크립트 출처(basePath)를 알 수 없으면 주입하지 않는다 (jsdom 환경 = 빈 basePath)', () => {
		// jsdom에서는 document.currentScript가 없어 모듈의 basePath가 ''이다
		WAT.prototype._ensureStylesheet.call({ options: {} });
		expect(document.getElementById('wat-style-link')).toBeNull();
	});
});

// ──────────────────────────────────────────────────
// 인라인 config — _loadConfiguration의 options.config 경로
// ──────────────────────────────────────────────────
describe('_loadConfiguration + options.config (인라인 설정)', () => {
	function makeConfigStub(options) {
		return {
			options,
			_configPath: options.configPath,
			_config: null,
			_configLoaded: false,
			_getFallbackConfig: WAT.prototype._getFallbackConfig,
			_mergeConfigurations: WAT.prototype._mergeConfigurations,
			_validateDictionaryConfiguration: jest.fn(),
			_applyConfigResources: jest.fn()
		};
	}

	const originalFetch = global.fetch;
	afterEach(() => {
		global.fetch = originalFetch;
	});

	test('options.config 객체는 fetch 없이 fallback과 동기 병합된다', async () => {
		global.fetch = jest.fn();
		const stub = makeConfigStub({
			config: { api: { dictionary: { enabled: true, serverEndpoint: 'https://dict.example.com' } } }
		});

		await WAT.prototype._loadConfiguration.call(stub);

		expect(global.fetch).not.toHaveBeenCalled();
		expect(stub._configLoaded).toBe(true);
		expect(stub._config.api.dictionary.enabled).toBe(true);
		expect(stub._config.api.dictionary.timeout).toBe(5000); // fallback 키 보존
		expect(stub._validateDictionaryConfiguration).toHaveBeenCalled();
		expect(stub._applyConfigResources).toHaveBeenCalled();
	});

	test('options.config가 configPath보다 우선한다', async () => {
		global.fetch = jest.fn();
		const stub = makeConfigStub({
			config: { branding: { copyrightUrl: 'https://inline.example.com' } },
			configPath: './config.json'
		});

		await WAT.prototype._loadConfiguration.call(stub);

		expect(global.fetch).not.toHaveBeenCalled();
		expect(stub._config.branding.copyrightUrl).toBe('https://inline.example.com');
	});
});
