/**
 * @fileoverview 설정 내보내기/가져오기(exportSettings/importSettings) 단위 테스트 (Phase 5)
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Constants } from '../../src/core/constants.js';

function makeStub() {
	return {
		// reload 예약이 실행되지 않도록 타이머는 기록만
		_setTimeout: jest.fn(),
		getLocalizedText: jest.fn(() => ''),
		_notify: jest.fn()
	};
}

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '';
});

afterEach(() => {
	localStorage.clear();
	jest.restoreAllMocks();
});

describe('exportSettings', () => {
	test('WAT 키만 담은 moduweb-settings 형식 JSON을 다운로드한다', () => {
		localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, '{"fontSize":"size-1p5x"}');
		localStorage.setItem('hostAppToken', 'secret'); // 호스트 데이터 — 포함되면 안 됨

		// jsdom Blob에는 .text()가 없으므로 생성 인자를 가로채 내용 검증
		let capturedText = null;
		const OriginalBlob = global.Blob;
		global.Blob = class extends OriginalBlob {
			constructor(parts, opts) {
				super(parts, opts);
				capturedText = parts.join('');
			}
		};
		global.URL.createObjectURL = jest.fn(() => 'blob:mock');
		global.URL.revokeObjectURL = jest.fn();
		const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		try {
			const stub = makeStub();
			WAT.prototype.exportSettings.call(stub);

			expect(clickSpy).toHaveBeenCalled();
			expect(stub._notify).toHaveBeenCalledWith(expect.any(String), { type: 'success' });

			const payload = JSON.parse(capturedText);
			expect(payload.format).toBe('moduweb-settings');
			expect(payload.data[Constants.STORAGE_KEYS.SETTINGS]).toBe('{"fontSize":"size-1p5x"}');
			expect(payload.data.hostAppToken).toBeUndefined(); // 호스트 키 미포함
		} finally {
			global.Blob = OriginalBlob;
		}
	});
});

describe('importSettings', () => {
	test('올바른 파일이면 WAT 키를 적용하고 새로고침을 예약한다', () => {
		const stub = makeStub();
		const json = JSON.stringify({
			format: 'moduweb-settings',
			version: 1,
			data: { [Constants.STORAGE_KEYS.SETTINGS]: '{"fontSize":"size-2x"}' }
		});

		const result = WAT.prototype.importSettings.call(stub, json);

		expect(result).toBe(true);
		expect(localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS)).toBe('{"fontSize":"size-2x"}');
		expect(stub._notify).toHaveBeenCalledWith(expect.any(String), { type: 'success' });
		expect(stub._setTimeout).toHaveBeenCalled(); // reload 예약
	});

	test('형식이 다른 JSON은 거부한다', () => {
		const stub = makeStub();
		expect(WAT.prototype.importSettings.call(stub, '{"foo": 1}')).toBe(false);
		expect(stub._notify).toHaveBeenCalledWith(expect.any(String), { type: 'error' });
	});

	test('손상된 JSON은 예외 없이 거부한다', () => {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		const stub = makeStub();
		expect(WAT.prototype.importSettings.call(stub, '{invalid')).toBe(false);
	});

	test('알려지지 않은 키는 localStorage에 반영하지 않는다 (호스트 오염 방지)', () => {
		const stub = makeStub();
		const json = JSON.stringify({
			format: 'moduweb-settings',
			version: 1,
			data: {
				[Constants.STORAGE_KEYS.SETTINGS]: '{}',
				maliciousKey: 'evil'
			}
		});

		WAT.prototype.importSettings.call(stub, json);
		expect(localStorage.getItem('maliciousKey')).toBeNull();
	});

	test('적용 가능한 키가 하나도 없으면 실패 처리한다', () => {
		const stub = makeStub();
		const json = JSON.stringify({ format: 'moduweb-settings', version: 1, data: { unknown: 'x' } });
		expect(WAT.prototype.importSettings.call(stub, json)).toBe(false);
	});
});
