import { describe, test, expect } from '@jest/globals';
import { Constants, FONT_FAMILY_OPTIONS } from '../../src/core/constants.js';
import { Defaults } from '../../src/core/defaults.js';
import { Localization } from '../../src/core/localization.js';
import { Validation } from '../../src/core/validation.js';

describe('Constants', () => {
	test('STORAGE_KEYS 에 SETTINGS, CONTAINER 키가 존재', () => {
		expect(Constants.STORAGE_KEYS).toHaveProperty('SETTINGS');
		expect(Constants.STORAGE_KEYS).toHaveProperty('CONTAINER');
	});

	test('TIMING 값이 모두 양수', () => {
		for (const val of Object.values(Constants.TIMING)) {
			expect(val).toBeGreaterThan(0);
		}
	});

	test('PERFORMANCE.BATCH_SIZE 는 양수', () => {
		expect(Constants.PERFORMANCE.BATCH_SIZE).toBeGreaterThan(0);
	});

	test('LOG_PREFIXES 에 ERROR/WARN/INFO/DEBUG 가 존재', () => {
		expect(Constants.LOG_PREFIXES).toHaveProperty('ERROR');
		expect(Constants.LOG_PREFIXES).toHaveProperty('WARN');
		expect(Constants.LOG_PREFIXES).toHaveProperty('INFO');
		expect(Constants.LOG_PREFIXES).toHaveProperty('DEBUG');
	});
});

describe('FONT_FAMILY_OPTIONS', () => {
	test("'initial' 키 존재", () => {
		expect(FONT_FAMILY_OPTIONS).toHaveProperty('initial');
	});

	test('각 폰트 항목에 url과 enabled 속성 존재', () => {
		for (const [key, val] of Object.entries(FONT_FAMILY_OPTIONS)) {
			if (key === 'initial') continue;
			expect(val).toHaveProperty('url');
			expect(val).toHaveProperty('enabled');
		}
	});
});

describe('Defaults', () => {
	test('SETTINGS 에 language, viewMode 키 존재', () => {
		expect(Defaults.SETTINGS).toHaveProperty('language');
		expect(Defaults.SETTINGS).toHaveProperty('viewMode');
	});

	test('PROFILES 에 lowVision, colorBlindness, dyslexia 존재', () => {
		expect(Defaults.PROFILES).toHaveProperty('lowVision');
		expect(Defaults.PROFILES).toHaveProperty('colorBlindness');
		expect(Defaults.PROFILES).toHaveProperty('dyslexia');
	});

	test('PROFILES 에 visualImpairment, senior, motionSensitivity, physicalDisability 존재', () => {
		expect(Defaults.PROFILES).toHaveProperty('visualImpairment');
		expect(Defaults.PROFILES).toHaveProperty('senior');
		expect(Defaults.PROFILES).toHaveProperty('motionSensitivity');
		expect(Defaults.PROFILES).toHaveProperty('physicalDisability');
	});

	test('각 프로필에 settings 객체가 존재', () => {
		for (const profile of Object.values(Defaults.PROFILES)) {
			expect(profile).toHaveProperty('settings');
			expect(typeof profile.settings).toBe('object');
		}
	});

	test('각 프로필의 settings 키마다 enabled 기본값이 존재', () => {
		for (const profile of Object.values(Defaults.PROFILES)) {
			for (const key of Object.keys(profile.settings)) {
				expect(profile.enabled).toHaveProperty(key);
			}
		}
	});
});

describe('Localization', () => {
	test('SUPPORTED_LANGUAGES 가 비어있지 않음', () => {
		expect(Localization.SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
	});

	test('LANGUAGE_FILES 에 모든 지원 언어 파일 매핑 존재', () => {
		for (const lang of Localization.SUPPORTED_LANGUAGES) {
			expect(Localization.LANGUAGE_FILES).toHaveProperty(lang);
		}
	});

	test('DEFAULT_LANGUAGE 가 SUPPORTED_LANGUAGES 에 포함됨', () => {
		expect(Localization.SUPPORTED_LANGUAGES).toContain(Localization.DEFAULT_LANGUAGE);
	});
});

describe('Validation', () => {
	test('FONT_SIZE_RANGE.min < max', () => {
		expect(Validation.FONT_SIZE_RANGE.min).toBeLessThan(Validation.FONT_SIZE_RANGE.max);
	});

	test('SCALE_RANGE.min < max', () => {
		expect(Validation.SCALE_RANGE.min).toBeLessThan(Validation.SCALE_RANGE.max);
	});

	test('REQUIRED_ELEMENTS 배열이 비어있지 않음', () => {
		expect(Validation.REQUIRED_ELEMENTS.length).toBeGreaterThan(0);
	});

	test('VALID_THEMES 에 initial 이 포함됨', () => {
		expect(Validation.VALID_THEMES).toContain('initial');
	});
});
