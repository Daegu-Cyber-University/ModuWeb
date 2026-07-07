/**
 * @fileoverview 알림 3계열(showNotification / showUserFeedback / _showDictionaryMessage)의
 *               현재 동작 특성화(characterization) 테스트.
 *               Phase 1(아이콘·role 정비)과 Phase 5(_notify 통합) 리팩터링의 회귀 안전망.
 *               WAT 전체 인스턴스화 대신 prototype 메서드를 스텁 this로 직접 호출한다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Constants } from '../../src/core/constants.js';

/** WAT 인스턴스 없이 알림 메서드를 호출하기 위한 최소 스텁 */
function makeStub() {
	return {
		_setTimeout: jest.fn((callback, delay) => setTimeout(callback, delay)),
		getLocalizedText: jest.fn((key) => `[${key}]`)
	};
}

beforeEach(() => {
	document.body.innerHTML = '';
	jest.useFakeTimers();
});

afterEach(() => {
	jest.runOnlyPendingTimers();
	jest.useRealTimers();
	document.body.innerHTML = '';
});

// ──────────────────────────────────────────────────
// showNotification — 주 알림 채널 (.wat-notification)
// ──────────────────────────────────────────────────
describe('showNotification', () => {
	test('라이브 리전(role=status, aria-live=polite)으로 메시지를 표시한다', () => {
		const stub = makeStub();
		WAT.prototype.showNotification.call(stub, '저장되었습니다');

		const el = document.querySelector('.wat-notification');
		expect(el).not.toBeNull();
		expect(el.textContent).toBe('저장되었습니다');
		expect(el.getAttribute('role')).toBe('status');
		expect(el.getAttribute('aria-live')).toBe('polite');
	});

	test('추적형 타이머(_setTimeout)를 기본 지속시간으로 사용한다', () => {
		const stub = makeStub();
		WAT.prototype.showNotification.call(stub, 'msg');

		expect(stub._setTimeout).toHaveBeenCalledTimes(1);
		expect(stub._setTimeout.mock.calls[0][1]).toBe(Constants.TIMING.NOTIFICATION_DURATION);
	});

	test('지속시간 경과 후 요소가 제거된다', () => {
		const stub = makeStub();
		WAT.prototype.showNotification.call(stub, 'msg', 1000);

		expect(document.querySelector('.wat-notification')).not.toBeNull();
		jest.advanceTimersByTime(1001);
		expect(document.querySelector('.wat-notification')).toBeNull();
	});

	test('다른 경로가 먼저 제거해도 예외 없이 멱등 처리된다', () => {
		const stub = makeStub();
		WAT.prototype.showNotification.call(stub, 'msg', 1000);

		document.querySelector('.wat-notification').remove();
		expect(() => jest.advanceTimersByTime(1001)).not.toThrow();
	});
});

// ──────────────────────────────────────────────────
// showUserFeedback — 타입별 피드백 토스트 (.wat-user-feedback)
// ──────────────────────────────────────────────────
describe('showUserFeedback', () => {
	test.each(['success', 'error', 'warning', 'info'])(
		'%s 타입 클래스와 라이브 리전 속성을 부여한다',
		(type) => {
			const stub = makeStub();
			WAT.prototype.showUserFeedback.call(stub, type, '메시지');

			const el = document.querySelector('.wat-user-feedback');
			expect(el).not.toBeNull();
			expect(el.classList.contains(`wat-feedback-${type}`)).toBe(true);
			expect(el.getAttribute('role')).toBe('status');
			expect(el.getAttribute('aria-live')).toBe('polite');
		}
	);

	test('타입별 배경색이 설정된다 (알 수 없는 타입은 info 색상)', () => {
		const stub = makeStub();
		WAT.prototype.showUserFeedback.call(stub, 'success', 'ok');
		const success = document.querySelector('.wat-user-feedback');
		expect(success.style.backgroundColor).toBe('rgb(16, 185, 129)'); // #10b981

		WAT.prototype.showUserFeedback.call(stub, 'unknown-type', 'x');
		const fallback = document.querySelector('.wat-user-feedback');
		expect(fallback.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3b82f6 (info)
	});

	// [특성화] 현재는 타입이 배경색으로만 구분된다 (WCAG 1.4.1 위반 — Phase 1에서
	// 텍스트 접두/아이콘 추가로 개선 예정. 개선 시 이 테스트의 기대치를 뒤집을 것)
	test('현재 동작: 메시지 본문은 원문 그대로이며 타입 정보는 색상으로만 전달된다', () => {
		const stub = makeStub();
		WAT.prototype.showUserFeedback.call(stub, 'error', '실패했습니다');
		const el = document.querySelector('.wat-user-feedback');
		expect(el.textContent).toBe('실패했습니다');
	});

	test('type 또는 message가 없으면 요소를 생성하지 않는다', () => {
		const stub = makeStub();
		WAT.prototype.showUserFeedback.call(stub, '', '메시지');
		WAT.prototype.showUserFeedback.call(stub, 'info', '');
		expect(document.querySelector('.wat-user-feedback')).toBeNull();
	});

	test('새 피드백 표시 시 기존 피드백은 제거된다 (동시 1개만 유지)', () => {
		const stub = makeStub();
		WAT.prototype.showUserFeedback.call(stub, 'info', '첫 번째');
		WAT.prototype.showUserFeedback.call(stub, 'success', '두 번째');

		const all = document.querySelectorAll('.wat-user-feedback');
		expect(all.length).toBe(1);
		expect(all[0].textContent).toContain('두 번째');
	});

	test('지속시간 경과 후 자동 제거된다 (페이드아웃 300ms 포함)', () => {
		const stub = makeStub();
		WAT.prototype.showUserFeedback.call(stub, 'info', 'msg', 1000);

		jest.advanceTimersByTime(1000 + 300 + 1);
		expect(document.querySelector('.wat-user-feedback')).toBeNull();
	});
});

// ──────────────────────────────────────────────────
// _showDictionaryMessage — 사전 알림 (.wat-dictionary-notification)
// ──────────────────────────────────────────────────
describe('_showDictionaryMessage', () => {
	test('타입별 modifier 클래스와 메시지를 표시한다', () => {
		const stub = makeStub();
		WAT.prototype._showDictionaryMessage.call(stub, '단어를 찾을 수 없습니다', 'info');

		const el = document.querySelector('.wat-dictionary-notification');
		expect(el).not.toBeNull();
		expect(el.classList.contains('wat-dictionary-notification--info')).toBe(true);
		expect(el.textContent).toContain('단어를 찾을 수 없습니다');
	});

	// [특성화] 현재는 role=alert + aria-live=polite가 동시 지정되어 상충한다
	// (alert는 assertive를 함의 — Phase 1에서 타입별 role 분리로 개선 예정)
	test('현재 동작: role=alert와 aria-live=polite가 동시에 지정된다', () => {
		const stub = makeStub();
		WAT.prototype._showDictionaryMessage.call(stub, '오류', 'error');

		const el = document.querySelector('.wat-dictionary-notification');
		expect(el.getAttribute('role')).toBe('alert');
		expect(el.getAttribute('aria-live')).toBe('polite');
	});

	test('닫기 버튼이 로컬라이즈된 aria-label을 갖고 클릭 시 알림이 제거된다', () => {
		const stub = makeStub();
		WAT.prototype._showDictionaryMessage.call(stub, 'msg', 'info');

		const closeBtn = document.querySelector('.wat-dictionary-notification__close');
		expect(closeBtn).not.toBeNull();
		expect(stub.getLocalizedText).toHaveBeenCalledWith('tags.button.text.close');
		expect(closeBtn.getAttribute('aria-label')).toBe('[tags.button.text.close]');

		closeBtn.onclick();
		expect(document.querySelector('.wat-dictionary-notification')).toBeNull();
	});

	test('새 알림 표시 시 기존 사전 알림은 제거된다', () => {
		const stub = makeStub();
		WAT.prototype._showDictionaryMessage.call(stub, '첫 번째', 'info');
		WAT.prototype._showDictionaryMessage.call(stub, '두 번째', 'error');

		const all = document.querySelectorAll('.wat-dictionary-notification');
		expect(all.length).toBe(1);
		expect(all[0].textContent).toContain('두 번째');
	});

	test('5초 후 자동 제거된다', () => {
		const stub = makeStub();
		WAT.prototype._showDictionaryMessage.call(stub, 'msg', 'info');

		jest.advanceTimersByTime(5001);
		expect(document.querySelector('.wat-dictionary-notification')).toBeNull();
	});
});
