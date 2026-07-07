/**
 * @fileoverview 로케일 키 파리티 테스트
 * dist/assets/locales/ 의 모든 로케일 파일이
 *  (a) 유효한 JSON 이며
 *  (b) leaf 키 집합이 서로 완전히 동일한지
 * 를 동적으로 검증한다. (하드코딩된 키 목록 없음)
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', '..', 'dist', 'assets', 'locales');
const LOCALES = ['ko', 'en-US', 'en-GB', 'ja', 'zh', 'de'];

/**
 * 중첩 객체를 순회하며 모든 leaf 키 경로(dot notation)를 수집한다.
 * 배열은 leaf 로 취급한다.
 * @param {Object} obj
 * @param {string} prefix
 * @param {Set<string>} set
 */
function collectLeafKeys(obj, prefix, set) {
	for (const key of Object.keys(obj)) {
		const path = prefix ? `${prefix}.${key}` : key;
		const value = obj[key];
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			collectLeafKeys(value, path, set);
		} else {
			set.add(path);
		}
	}
}

/**
 * 로케일 파일을 읽어 파싱한다.
 * @param {string} locale
 * @returns {Object}
 */
function loadLocale(locale) {
	const raw = readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf8');
	return JSON.parse(raw);
}

describe('로케일 파리티 - JSON 유효성', () => {
	test.each(LOCALES)('%s.json 이 유효한 JSON 으로 파싱됨', (locale) => {
		expect(() => loadLocale(locale)).not.toThrow();
		const data = loadLocale(locale);
		expect(data).toBeTruthy();
		expect(typeof data).toBe('object');
	});
});

describe('로케일 파리티 - leaf 키 집합 일치', () => {
	// 파싱된 데이터와 leaf 키 집합을 미리 계산
	const keySets = {};
	for (const locale of LOCALES) {
		const set = new Set();
		collectLeafKeys(loadLocale(locale), '', set);
		keySets[locale] = set;
	}

	// 기준 파일(첫 번째)로 나머지를 비교
	const [baseLocale, ...others] = LOCALES;
	const baseKeys = keySets[baseLocale];

	test('기준 로케일이 leaf 키를 하나 이상 보유', () => {
		expect(baseKeys.size).toBeGreaterThan(0);
	});

	test.each(others)(`%s 는 ${baseLocale} 대비 누락된 키가 없음`, (locale) => {
		const keys = keySets[locale];
		const missing = [...baseKeys].filter((k) => !keys.has(k));
		expect(missing).toEqual([]);
	});

	test.each(others)(`%s 는 ${baseLocale} 대비 여분의 키가 없음`, (locale) => {
		const keys = keySets[locale];
		const extra = [...keys].filter((k) => !baseKeys.has(k));
		expect(extra).toEqual([]);
	});

	test('모든 로케일의 leaf 키 개수가 동일', () => {
		const sizes = LOCALES.map((l) => keySets[l].size);
		const unique = new Set(sizes);
		expect(unique.size).toBe(1);
	});
});
