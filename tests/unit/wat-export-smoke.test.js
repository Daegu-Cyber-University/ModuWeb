import { describe, it, expect } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { fetchJSONP } from '../../src/core/jsonpFetch.js';
import { escapeHtml } from '../../src/core/htmlEscape.js';

describe('WAT 및 코어 모듈 스모크', () => {
	it('WAT 클래스 로드', () => {
		expect(typeof WAT).toBe('function');
		expect(WAT.name).toBe('WAT');
	});

	it('fetchJSONP·escapeHtml 진입점 존재', () => {
		expect(typeof fetchJSONP).toBe('function');
		expect(typeof escapeHtml).toBe('function');
	});
});
