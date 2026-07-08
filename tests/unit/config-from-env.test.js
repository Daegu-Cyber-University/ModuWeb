/**
 * @fileoverview .env → config.json 생성 스크립트의 순수 함수 단위 테스트
 * @description scripts/write-config-from-env.mjs 는 main 가드가 있어 import 시
 *              파일 I/O 부작용 없이 순수 함수만 검증할 수 있다.
 */
import { describe, test, expect } from '@jest/globals';
import {
	MAPPINGS,
	META_VARS,
	parseDotEnvText,
	resolveVar,
	coerceValue,
	setByPath,
	buildConfig,
	findSecretLikeKeys,
	findUnmappedWatKeys
} from '../../scripts/write-config-from-env.mjs';

describe('parseDotEnvText (기존 파서 특성화)', () => {
	test('기본 키=값, 빈 줄, 주석 줄을 처리한다', () => {
		const out = parseDotEnvText('A=1\n\n# comment\nB=hello\n');
		expect(out).toEqual({ A: '1', B: 'hello' });
	});

	test('따옴표 값은 닫는 따옴표까지, 이후 인라인 주석은 무시한다', () => {
		const out = parseDotEnvText(`A="hello world" # note\nB='x # not comment'`);
		expect(out.A).toBe('hello world');
		expect(out.B).toBe('x # not comment');
	});

	test('따옴표 없는 값의 인라인 주석(공백+#)을 절삭한다', () => {
		const out = parseDotEnvText('A=value # comment\nB=no#cut');
		expect(out.A).toBe('value');
		expect(out.B).toBe('no#cut'); // 공백 없는 #은 값의 일부
	});

	test('CRLF 줄바꿈과 = 없는 줄을 처리한다', () => {
		const out = parseDotEnvText('A=1\r\nnotakv\r\nB=2\r\n');
		expect(out).toEqual({ A: '1', B: '2' });
	});
});

describe('resolveVar', () => {
	test('process.env가 .env보다 우선한다', () => {
		expect(resolveVar({ K: 'proc' }, { K: 'file' }, 'K')).toBe('proc');
	});

	test('빈 문자열은 미설정으로 취급해 다음 소스로 넘어간다', () => {
		expect(resolveVar({ K: '' }, { K: 'file' }, 'K')).toBe('file');
		expect(resolveVar({}, { K: '' }, 'K')).toBe('');
	});
});

describe('coerceValue', () => {
	test('number: 양수만 허용, NaN·0·음수 거부', () => {
		expect(coerceValue('number', '5000')).toEqual({ ok: true, value: 5000 });
		expect(coerceValue('number', 'abc').ok).toBe(false);
		expect(coerceValue('number', '-1').ok).toBe(false);
		expect(coerceValue('number', '0').ok).toBe(false);
	});

	test('boolean: true/false/1/0 (대소문자 무관)', () => {
		expect(coerceValue('boolean', 'true')).toEqual({ ok: true, value: true });
		expect(coerceValue('boolean', 'FALSE')).toEqual({ ok: true, value: false });
		expect(coerceValue('boolean', '1')).toEqual({ ok: true, value: true });
		expect(coerceValue('boolean', '0')).toEqual({ ok: true, value: false });
		expect(coerceValue('boolean', 'yes').ok).toBe(false);
	});

	test('url: http/https만 허용 — javascript:/ftp:/비URL 거부', () => {
		expect(coerceValue('url', 'https://example.com/x').ok).toBe(true);
		expect(coerceValue('url', 'http://example.com').ok).toBe(true);
		// eslint-disable-next-line no-script-url
		expect(coerceValue('url', 'javascript:alert(1)').ok).toBe(false);
		expect(coerceValue('url', 'ftp://example.com').ok).toBe(false);
		expect(coerceValue('url', 'not a url').ok).toBe(false);
	});

	test('string: 그대로 통과', () => {
		expect(coerceValue('string', 'x')).toEqual({ ok: true, value: 'x' });
	});
});

describe('setByPath', () => {
	test('중첩 경로를 만들며 값을 설정한다', () => {
		const obj = {};
		expect(setByPath(obj, 'a.b.c', 1)).toBe(true);
		expect(obj.a.b.c).toBe(1);
	});

	test('프로토타입 오염 세그먼트를 거부한다', () => {
		const obj = {};
		expect(setByPath(obj, '__proto__.polluted', 1)).toBe(false);
		expect(setByPath(obj, 'a.constructor.x', 1)).toBe(false);
		expect(setByPath(obj, 'a.prototype.y', 1)).toBe(false);
		expect({}.polluted).toBeUndefined();
	});
});

describe('buildConfig', () => {
	const base = {
		api: { dictionary: { enabled: false, serverEndpoint: 'https://old.example', timeout: 5000 } },
		settings: { ui: { modalWidth: 600 } }
	};

	function resolverOf(map) {
		return (name) => map[name] || '';
	}

	test('해석된 변수를 config 경로에 적용하고 개수를 센다', () => {
		const { config, appliedCount, warnings } = buildConfig(base, resolverOf({
			WAT_DICTIONARY_ENDPOINT: 'https://new.example/api',
			WAT_DICTIONARY_TIMEOUT: '3000',
			WAT_MODAL_WIDTH: '800',
			WAT_SHOW_PRONUNCIATION: 'false'
		}));
		expect(config.api.dictionary.serverEndpoint).toBe('https://new.example/api');
		expect(config.api.dictionary.timeout).toBe(3000);
		expect(config.settings.ui.modalWidth).toBe(800);
		expect(config.settings.ui.showPronunciation).toBe(false);
		expect(appliedCount).toBe(4);
		expect(warnings).toEqual([]);
	});

	test('미설정 변수는 base 값을 유지하고 base 원본은 변형되지 않는다', () => {
		const { config, appliedCount } = buildConfig(base, resolverOf({ WAT_MODAL_WIDTH: '900' }));
		expect(config.api.dictionary.serverEndpoint).toBe('https://old.example'); // 유지
		expect(config.settings.ui.modalWidth).toBe(900);
		expect(base.settings.ui.modalWidth).toBe(600); // 원본 비변형
		expect(appliedCount).toBe(1);
	});

	test('잘못된 값은 warnings에 수집되고 해당 키만 스킵된다', () => {
		const { config, appliedCount, warnings } = buildConfig(base, resolverOf({
			WAT_DICTIONARY_TIMEOUT: 'abc',
			WAT_MODAL_WIDTH: '700'
		}));
		expect(config.api.dictionary.timeout).toBe(5000); // base 유지
		expect(config.settings.ui.modalWidth).toBe(700);
		expect(appliedCount).toBe(1);
		expect(warnings.some(w => w.includes('WAT_DICTIONARY_TIMEOUT'))).toBe(true);
	});

	test('http 사전 엔드포인트는 기록하되 런타임 거부 경고를 남긴다', () => {
		const { config, warnings } = buildConfig(base, resolverOf({
			WAT_DICTIONARY_ENDPOINT: 'http://insecure.example/api'
		}));
		expect(config.api.dictionary.serverEndpoint).toBe('http://insecure.example/api');
		expect(warnings.some(w => w.includes('https 전용'))).toBe(true);
	});

	test('해석된 변수가 없으면 appliedCount 0 (모드 판정의 기준값)', () => {
		const { appliedCount } = buildConfig(base, resolverOf({}));
		expect(appliedCount).toBe(0);
	});
});

describe('findSecretLikeKeys (비밀키 가드)', () => {
	test('API_KEY/SECRET/TOKEN 류 변수명을 감지한다', () => {
		const found = findSecretLikeKeys([
			'WAT_NAVER_API_KEY', 'WAT_TTS_SECRET', 'MY_TOKEN', 'DB_PASSWORD',
			'WAT_PRIVATE_URL', 'SOME_CREDENTIALS', 'WAT_APIKEY'
		]);
		expect(found).toHaveLength(7);
	});

	test('정상 매핑 변수명은 전부 통과한다', () => {
		expect(findSecretLikeKeys(MAPPINGS.map(m => m.env))).toEqual([]);
		expect(findSecretLikeKeys([...META_VARS])).toEqual([]);
	});

	test('미래 슬롯 변수명(ENDPOINT)도 통과한다', () => {
		expect(findSecretLikeKeys(['WAT_TTS_ENDPOINT', 'WAT_TRANSLATION_ENDPOINT'])).toEqual([]);
	});
});

describe('findUnmappedWatKeys (오타 감지)', () => {
	test('WAT_ 접두 미매핑 변수만 골라낸다 (메타 변수·비 WAT_ 제외)', () => {
		const keys = ['WAT_TYPO_VAR', 'WAT_DICTIONARY_ENDPOINT', 'WAT_CONFIG_OUTPUT', 'PATH', 'HOME'];
		expect(findUnmappedWatKeys(keys)).toEqual(['WAT_TYPO_VAR']);
	});
});
