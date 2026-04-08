/**
 * @fileoverview Phase 4 단위 테스트 - StateManager
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { StateManager } from '../../src/wat/StateManager.js';

describe('StateManager - 기본 생성', () => {
	test('초기 상태 없이 생성', () => {
		const sm = new StateManager();
		expect(sm.getState()).toEqual({});
	});

	test('초기 상태 전달', () => {
		const sm = new StateManager({ plugin: { active: true } });
		expect(sm.get('plugin.active')).toBe(true);
	});
});

describe('StateManager - get/set', () => {
	let sm;

	beforeEach(() => {
		sm = new StateManager({ a: { b: { c: 'deep' } } });
	});

	test('단순 경로 get', () => {
		sm.set('x', 42);
		expect(sm.get('x')).toBe(42);
	});

	test('중첩 경로 get', () => {
		expect(sm.get('a.b.c')).toBe('deep');
	});

	test('존재하지 않는 경로 → undefined', () => {
		expect(sm.get('no.such.path')).toBeUndefined();
	});

	test('중첩 경로 set', () => {
		sm.set('a.b.c', 'updated');
		expect(sm.get('a.b.c')).toBe('updated');
	});

	test('새 중첩 경로 자동 생성', () => {
		sm.set('x.y.z', 99);
		expect(sm.get('x.y.z')).toBe(99);
	});
});

describe('StateManager - update()', () => {
	test('기존 객체에 병합', () => {
		const sm = new StateManager({ settings: { fontSize: 'initial', theme: 'default' } });
		sm.update('settings', { fontSize: 'size-1p5x' });
		expect(sm.get('settings.fontSize')).toBe('size-1p5x');
		expect(sm.get('settings.theme')).toBe('default');
	});
});

describe('StateManager - subscribe/unsubscribe', () => {
	test('변경 시 콜백 호출', () => {
		const sm = new StateManager();
		const cb = jest.fn();
		sm.subscribe('foo', cb);
		sm.set('foo', 'bar');
		expect(cb).toHaveBeenCalledWith('bar', undefined, 'foo');
	});

	test('unsubscribe 후 콜백 미호출', () => {
		const sm = new StateManager();
		const cb = jest.fn();
		const unsub = sm.subscribe('foo', cb);
		unsub();
		sm.set('foo', 'baz');
		expect(cb).not.toHaveBeenCalled();
	});

	test('skipNotify = true 시 콜백 미호출', () => {
		const sm = new StateManager();
		const cb = jest.fn();
		sm.subscribe('foo', cb);
		sm.set('foo', 'silent', true);
		expect(cb).not.toHaveBeenCalled();
	});

	test('콜백 내 예외 발생해도 상태는 유지', () => {
		const sm = new StateManager();
		sm.subscribe('x', () => { throw new Error('callback error'); });
		sm.set('x', 100);
		expect(sm.get('x')).toBe(100);
	});
});

describe('StateManager - 히스토리', () => {
	test('변경 사항 기록', () => {
		const sm = new StateManager();
		sm.set('key', 'v1');
		sm.set('key', 'v2');
		const history = sm.getHistory();
		expect(history.length).toBe(2);
		expect(history[1].newValue).toBe('v2');
		expect(history[1].oldValue).toBe('v1');
	});

	test('히스토리 최대 50개 유지', () => {
		const sm = new StateManager();
		for (let i = 0; i < 60; i++) {
			sm.set('n', i);
		}
		expect(sm.getHistory().length).toBe(50);
	});

	test('getHistory() 복사본 반환', () => {
		const sm = new StateManager();
		sm.set('k', 1);
		const h1 = sm.getHistory();
		h1.push({ fake: true });
		expect(sm.getHistory().length).toBe(1);
	});
});

describe('StateManager - reset()', () => {
	test('상태 초기화', () => {
		const sm = new StateManager({ a: 1 });
		sm.set('a', 99);
		sm.reset({ a: 1 });
		expect(sm.get('a')).toBe(1);
	});

	test('히스토리 초기화', () => {
		const sm = new StateManager();
		sm.set('x', 1);
		sm.reset();
		expect(sm.getHistory().length).toBe(0);
	});

	test('reset 시 구독자에게 알림', () => {
		const sm = new StateManager({ v: 'old' });
		const cb = jest.fn();
		sm.subscribe('v', cb);
		sm.reset({ v: 'new' });
		expect(cb).toHaveBeenCalled();
	});
});

describe('StateManager - getState()', () => {
	test('깊은 복사본 반환', () => {
		const sm = new StateManager({ obj: { x: 1 } });
		const state = sm.getState();
		state.obj.x = 999;
		expect(sm.get('obj.x')).toBe(1);
	});
});
