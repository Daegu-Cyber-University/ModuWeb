/**
 * @fileoverview _loadConfiguration / _mergeConfigurations / _getFallbackConfig의
 *               특성화 테스트. Phase 2(인라인 options.config 동기 병합) 안전망.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';

/** _loadConfiguration 호출용 최소 스텁 — 실제 병합/폴백 로직은 prototype 것을 재사용 */
function makeConfigStub(configPath) {
	return {
		_configPath: configPath,
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
	jest.restoreAllMocks();
});

// ──────────────────────────────────────────────────
// _mergeConfigurations — 순수 딥 머지
// ──────────────────────────────────────────────────
describe('_mergeConfigurations', () => {
	const merge = (fallback, loaded) =>
		WAT.prototype._mergeConfigurations.call({}, fallback, loaded);

	test('중첩 객체를 깊게 병합하고 fallback의 나머지 키를 보존한다', () => {
		const fallback = { api: { dictionary: { enabled: false, timeout: 5000 } }, branding: { url: 'a' } };
		const loaded = { api: { dictionary: { enabled: true } } };

		const result = merge(fallback, loaded);
		expect(result.api.dictionary.enabled).toBe(true);
		expect(result.api.dictionary.timeout).toBe(5000); // fallback 보존
		expect(result.branding.url).toBe('a');
	});

	test('배열은 병합하지 않고 통째로 교체한다', () => {
		const result = merge({ list: [1, 2, 3] }, { list: [9] });
		expect(result.list).toEqual([9]);
	});

	test('원본 fallback 객체를 변형하지 않는다', () => {
		const fallback = { a: { b: 1 } };
		merge(fallback, { a: { b: 2 } });
		expect(fallback.a.b).toBe(1);
	});

	test('프로토타입 오염 키(__proto__/constructor/prototype)는 병합하지 않는다', () => {
		const malicious = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"x": 1}, "safe": "ok"}');
		const result = merge({}, malicious);

		expect(result.safe).toBe('ok');
		expect({}.polluted).toBeUndefined(); // 전역 오염 없음
		expect(Object.prototype.polluted).toBeUndefined();
	});

	test('null 값은 객체가 아니므로 그대로 대입된다', () => {
		const result = merge({ endpoint: 'https://x' }, { endpoint: null });
		expect(result.endpoint).toBeNull();
	});
});

// ──────────────────────────────────────────────────
// _getFallbackConfig — 기본 설정의 계약
// ──────────────────────────────────────────────────
describe('_getFallbackConfig', () => {
	test('사전 기능은 기본 비활성화이고 endpoint는 null이다', () => {
		const config = WAT.prototype._getFallbackConfig.call({});
		expect(config.api.dictionary.enabled).toBe(false);
		expect(config.api.dictionary.serverEndpoint).toBeNull();
	});

	test('코드가 소비하는 최상위 키(api/resources/branding)가 존재한다', () => {
		const config = WAT.prototype._getFallbackConfig.call({});
		expect(config.api).toBeDefined();
		expect(config.resources.fonts).toBeDefined();
		expect(config.branding).toBeDefined();
	});
});

// ──────────────────────────────────────────────────
// _loadConfiguration — 로드/폴백/늦은 응답 무시
// ──────────────────────────────────────────────────
describe('_loadConfiguration', () => {
	test('configPath가 없으면 fetch 없이 fallback으로 즉시 확정된다', async () => {
		global.fetch = jest.fn();
		const stub = makeConfigStub(undefined);

		await WAT.prototype._loadConfiguration.call(stub);

		expect(global.fetch).not.toHaveBeenCalled();
		expect(stub._configLoaded).toBe(true);
		expect(stub._config.api.dictionary.enabled).toBe(false);
		expect(stub._validateDictionaryConfiguration).toHaveBeenCalled();
		expect(stub._applyConfigResources).toHaveBeenCalled();
	});

	test('정상 응답은 fallback과 딥 머지된다', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ api: { dictionary: { enabled: true, serverEndpoint: 'https://dict.example.com' } } })
		});
		const stub = makeConfigStub('./config.json');

		await WAT.prototype._loadConfiguration.call(stub);

		expect(stub._configLoaded).toBe(true);
		expect(stub._config.api.dictionary.enabled).toBe(true);
		expect(stub._config.api.dictionary.serverEndpoint).toBe('https://dict.example.com');
		expect(stub._config.api.dictionary.timeout).toBe(5000); // fallback 키 보존
	});

	test('HTTP 오류 응답이면 fallback을 사용한다', async () => {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
		global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
		const stub = makeConfigStub('./missing.json');

		await WAT.prototype._loadConfiguration.call(stub);

		expect(stub._configLoaded).toBe(true);
		expect(stub._config.api.dictionary.enabled).toBe(false);
	});

	test('네트워크 실패 시에도 fallback으로 확정된다', async () => {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
		global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
		const stub = makeConfigStub('./config.json');

		await WAT.prototype._loadConfiguration.call(stub);

		expect(stub._configLoaded).toBe(true);
		expect(stub._config.api.dictionary.enabled).toBe(false);
	});

	test('타임아웃 폴백 확정 후 늦게 도착한 응답은 무시된다', async () => {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		let resolveFetch;
		global.fetch = jest.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
		const stub = makeConfigStub('./config.json');

		const pending = WAT.prototype._loadConfiguration.call(stub);

		// 타임아웃 폴백이 먼저 발동한 상황을 재현
		const sentinel = { fromTimeout: true };
		stub._config = sentinel;
		stub._configLoaded = true;

		resolveFetch({ ok: true, json: async () => ({ api: { dictionary: { enabled: true } } }) });
		await pending;

		expect(stub._config).toBe(sentinel); // 늦은 응답이 config를 교체하지 않음
	});
});
