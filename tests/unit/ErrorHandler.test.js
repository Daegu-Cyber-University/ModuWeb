/**
 * @fileoverview Phase 2 단위 테스트 - ErrorHandler
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { ErrorHandler } from '../../src/core/ErrorHandler.js';

describe('ErrorHandler - SEVERITY', () => {
	test('SEVERITY 상수 값 확인', () => {
		expect(ErrorHandler.SEVERITY.CRITICAL).toBe('critical');
		expect(ErrorHandler.SEVERITY.ERROR).toBe('error');
		expect(ErrorHandler.SEVERITY.WARNING).toBe('warning');
		expect(ErrorHandler.SEVERITY.INFO).toBe('info');
		expect(ErrorHandler.SEVERITY.DEBUG).toBe('debug');
	});
});

describe('ErrorHandler - CATEGORIES', () => {
	test('주요 카테고리 존재', () => {
		expect(ErrorHandler.CATEGORIES.INITIALIZATION).toBeDefined();
		expect(ErrorHandler.CATEGORIES.DOM_OPERATION).toBeDefined();
		expect(ErrorHandler.CATEGORIES.NETWORK).toBeDefined();
		expect(ErrorHandler.CATEGORIES.VALIDATION).toBeDefined();
	});
});

describe('ErrorHandler - RECOVERY_STRATEGIES', () => {
	test('복구 전략 값 확인', () => {
		expect(ErrorHandler.RECOVERY_STRATEGIES.RETRY).toBe('retry');
		expect(ErrorHandler.RECOVERY_STRATEGIES.FALLBACK).toBe('fallback');
		expect(ErrorHandler.RECOVERY_STRATEGIES.IGNORE).toBe('ignore');
		expect(ErrorHandler.RECOVERY_STRATEGIES.ABORT).toBe('abort');
		expect(ErrorHandler.RECOVERY_STRATEGIES.RESET).toBe('reset');
	});
});

describe('ErrorHandler - handle()', () => {
	beforeEach(() => {
		ErrorHandler.clearMetrics();
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
	});

	test('Error 객체 처리 후 handled: true 반환', () => {
		const result = ErrorHandler.handle(new Error('test error'), {
			category: ErrorHandler.CATEGORIES.INITIALIZATION,
			severity: ErrorHandler.SEVERITY.ERROR
		});
		expect(result.handled).toBe(true);
		expect(result.errorInfo).toBeDefined();
	});

	test('문자열 에러 처리', () => {
		const result = ErrorHandler.handle('string error', {
			severity: ErrorHandler.SEVERITY.WARNING
		});
		expect(result.errorInfo.message).toBe('string error');
		expect(result.errorInfo.name).toBe('WAT_Error');
	});

	test('에러 ID 가 생성됨', () => {
		const result = ErrorHandler.handle(new Error('test'), {});
		expect(result.errorInfo.id).toMatch(/^wat_error_/);
	});

	test('IGNORE 전략은 success: true 반환', () => {
		const result = ErrorHandler.handle(new Error('test'), {
			strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
		});
		expect(result.recoveryResult.success).toBe(true);
	});

	test('ABORT 전략은 success: false 반환', () => {
		const result = ErrorHandler.handle(new Error('test'), {
			strategy: ErrorHandler.RECOVERY_STRATEGIES.ABORT
		});
		expect(result.recoveryResult.success).toBe(false);
	});

	test('커스텀 recovery 함수 실행', () => {
		const recoveryFn = jest.fn().mockReturnValue('recovered');
		const result = ErrorHandler.handle(new Error('test'), {
			recovery: recoveryFn
		});
		expect(recoveryFn).toHaveBeenCalledTimes(1);
		expect(result.recoveryResult.strategy).toBe('custom');
	});
});

describe('ErrorHandler - 메트릭', () => {
	beforeEach(() => {
		ErrorHandler.clearMetrics();
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	test('에러 발생 시 total 카운트 증가', () => {
		ErrorHandler.handle(new Error('t1'));
		ErrorHandler.handle(new Error('t2'));
		expect(ErrorHandler.getMetrics().total).toBe(2);
	});

	test('clearMetrics 후 total = 0', () => {
		ErrorHandler.handle(new Error('test'));
		ErrorHandler.clearMetrics();
		expect(ErrorHandler.getMetrics().total).toBe(0);
	});

	test('recent 배열에 에러 기록', () => {
		ErrorHandler.handle(new Error('recent test'), {
			category: ErrorHandler.CATEGORIES.NETWORK
		});
		const metrics = ErrorHandler.getMetrics();
		expect(metrics.recent.length).toBeGreaterThan(0);
		expect(metrics.recent[0].category).toBe(ErrorHandler.CATEGORIES.NETWORK);
	});
});

describe('ErrorHandler - safeExecute()', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
	});

	test('정상 함수 반환값 그대로 반환', () => {
		const result = ErrorHandler.safeExecute(() => 42);
		expect(result).toBe(42);
	});

	test('예외 발생 시 defaultReturn 반환', () => {
		const result = ErrorHandler.safeExecute(() => { throw new Error('oops'); }, {}, 'default');
		expect(result).toBe('default');
	});

	test('예외 발생 시 null 반환 (기본)', () => {
		const result = ErrorHandler.safeExecute(() => { throw new Error('oops'); });
		expect(result).toBeNull();
	});
});

describe('ErrorHandler - safeExecuteAsync()', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
	});

	test('정상 async 함수 결과 반환', async () => {
		const result = await ErrorHandler.safeExecuteAsync(async () => 'async result');
		expect(result).toBe('async result');
	});

	test('async 예외 시 defaultReturn 반환', async () => {
		const result = await ErrorHandler.safeExecuteAsync(
			async () => { throw new Error('async error'); },
			{},
			'fallback'
		);
		expect(result).toBe('fallback');
	});
});
