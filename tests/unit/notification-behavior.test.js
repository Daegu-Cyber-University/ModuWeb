/**
 * @fileoverview 알림 3계열(showNotification / showUserFeedback / _showDictionaryMessage)의
 *               현재 동작 특성화(characterization) 테스트.
 *               Phase 1(아이콘·role 정비)과 Phase 5(_notify 통합) 리팩터링의 회귀 안전망.
 *               WAT 전체 인스턴스화 대신 prototype 메서드를 스텁 this로 직접 호출한다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Dictionary } from '../../src/wat/Dictionary.js';
import { Constants } from '../../src/core/constants.js';

/** WAT 인스턴스 없이 알림 메서드를 호출하기 위한 최소 스텁 */
function makeStub() {
	return {
		_setTimeout: jest.fn((callback, delay) => setTimeout(callback, delay)),
		// 라이브 리전 갱신을 동기 실행해 단언을 단순화
		_requestAnimationFrame: jest.fn((callback) => callback()),
		getLocalizedText: jest.fn((key) => `[${key}]`),
		// 래퍼들이 단일 디스패처로 위임하므로 스텁 this에도 연결
		_notify: WAT.prototype._notify,
		_announceToLiveRegion: WAT.prototype._announceToLiveRegion
	};
}

/** _notify는 페이드아웃(300ms) 후 제거하므로 duration + 300ms 이후에 사라진다 */
const FADE_MS = 300;

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
	test('메시지를 표시하고 상주 라이브 리전(status)으로 낭독을 전달한다', () => {
		const stub = makeStub();
		WAT.prototype.showNotification.call(stub, '저장되었습니다');

		const el = document.querySelector('.wat-notification');
		expect(el).not.toBeNull();
		expect(el.textContent).toBe('저장되었습니다');
		// 시각 요소에는 live 시맨틱이 없고, 상주 리전이 낭독을 담당한다
		expect(el.getAttribute('role')).toBeNull();
		const region = document.getElementById('wat-live-polite');
		expect(region.getAttribute('role')).toBe('status');
		expect(region.getAttribute('aria-live')).toBe('polite');
		expect(region.textContent).toBe('저장되었습니다');
	});

	test('추적형 타이머(_setTimeout)를 기본 지속시간으로 사용한다', () => {
		const stub = makeStub();
		WAT.prototype.showNotification.call(stub, 'msg');

		expect(stub._setTimeout).toHaveBeenCalledTimes(1);
		expect(stub._setTimeout.mock.calls[0][1]).toBe(Constants.TIMING.NOTIFICATION_DURATION);
	});

	test('지속시간(+페이드) 경과 후 요소가 제거된다', () => {
		const stub = makeStub();
		WAT.prototype.showNotification.call(stub, 'msg', 1000);

		expect(document.querySelector('.wat-notification')).not.toBeNull();
		jest.advanceTimersByTime(1000 + FADE_MS + 1);
		expect(document.querySelector('.wat-notification')).toBeNull();
	});

	test('다른 경로가 먼저 제거해도 예외 없이 멱등 처리된다', () => {
		const stub = makeStub();
		WAT.prototype.showNotification.call(stub, 'msg', 1000);

		document.querySelector('.wat-notification').remove();
		expect(() => jest.advanceTimersByTime(1000 + FADE_MS + 1)).not.toThrow();
	});
});

// ──────────────────────────────────────────────────
// showUserFeedback — 타입별 피드백 토스트 (.wat-user-feedback)
// ──────────────────────────────────────────────────
describe('showUserFeedback', () => {
	test.each(['success', 'warning', 'info'])(
		'%s 타입은 status 상주 리전으로 낭독된다',
		(type) => {
			const stub = makeStub();
			WAT.prototype.showUserFeedback.call(stub, type, '메시지');

			const el = document.querySelector('.wat-user-feedback');
			expect(el).not.toBeNull();
			expect(el.classList.contains(`wat-feedback-${type}`)).toBe(true);
			expect(document.getElementById('wat-live-polite').textContent).toBe('메시지');
		}
	);

	test('error 타입은 즉시 전달되도록 assertive(alert) 상주 리전을 사용한다', () => {
		const stub = makeStub();
		WAT.prototype.showUserFeedback.call(stub, 'error', '실패');

		const region = document.getElementById('wat-live-assertive');
		expect(region.getAttribute('role')).toBe('alert');
		expect(region.textContent).toBe('실패');
	});

	test('타입별 배경색 클래스가 부여된다 (알 수 없는 타입은 info로 정규화)', () => {
		const stub = makeStub();
		WAT.prototype.showUserFeedback.call(stub, 'success', 'ok');
		const success = document.querySelector('.wat-user-feedback');
		expect(success.classList.contains('wat-feedback-success')).toBe(true);

		WAT.prototype.showUserFeedback.call(stub, 'unknown-type', 'x');
		const fallback = document.querySelector('.wat-user-feedback');
		expect(fallback.classList.contains('wat-feedback-info')).toBe(true);
	});

	test('타입별 아이콘으로 형태 구분을 제공한다 (WCAG 1.4.1 — 색상 단독 의존 금지)', () => {
		const stub = makeStub();
		WAT.prototype.showUserFeedback.call(stub, 'error', '실패했습니다');
		const el = document.querySelector('.wat-user-feedback');

		const icon = el.querySelector('svg[data-icon="error"]');
		expect(icon).not.toBeNull();
		expect(icon.getAttribute('aria-hidden')).toBe('true'); // 장식용 — 메시지가 이미 낭독됨
		expect(el.textContent).toBe('실패했습니다'); // 아이콘은 텍스트를 오염시키지 않음

		// 타입별로 서로 다른 아이콘 형태가 부여된다
		WAT.prototype.showUserFeedback.call(stub, 'success', '성공');
		const successIcon = document.querySelector('.wat-user-feedback svg[data-icon="success"]');
		expect(successIcon).not.toBeNull();
		expect(successIcon.querySelector('path').getAttribute('d'))
			.not.toBe(icon.querySelector('path').getAttribute('d'));
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
// Dictionary._showDictionaryMessage — 사전 알림 (.wat-dictionary-notification)
// Phase 6-2에서 Dictionary 모듈로 추출됨 — plugin._notify로 위임
// ──────────────────────────────────────────────────
describe('_showDictionaryMessage', () => {
	/** Dictionary 메서드 호출용 스텁 — plugin 서비스에 알림 스텁을 연결 */
	function makeDictStub() {
		return { plugin: makeStub() };
	}

	test('타입별 modifier 클래스와 메시지를 표시한다', () => {
		const stub = makeDictStub();
		Dictionary.prototype._showDictionaryMessage.call(stub, '단어를 찾을 수 없습니다', 'info');

		const el = document.querySelector('.wat-dictionary-notification');
		expect(el).not.toBeNull();
		expect(el.classList.contains('wat-dictionary-notification--info')).toBe(true);
		expect(el.textContent).toContain('단어를 찾을 수 없습니다');
	});

	test('상주 리전 semantics가 타입별로 분리된다 (error=assertive, 그 외=polite)', () => {
		const stub = makeDictStub();
		Dictionary.prototype._showDictionaryMessage.call(stub, '오류', 'error');
		expect(document.getElementById('wat-live-assertive').textContent).toBe('오류');

		Dictionary.prototype._showDictionaryMessage.call(stub, '안내', 'info');
		expect(document.getElementById('wat-live-polite').textContent).toBe('안내');
	});

	test('닫기 버튼이 로컬라이즈된 aria-label을 갖고 클릭 시 알림이 제거된다', () => {
		const stub = makeDictStub();
		Dictionary.prototype._showDictionaryMessage.call(stub, 'msg', 'info');

		const closeBtn = document.querySelector('.wat-notify-close');
		expect(closeBtn).not.toBeNull();
		expect(stub.plugin.getLocalizedText).toHaveBeenCalledWith('tags.button.text.close');
		expect(closeBtn.getAttribute('aria-label')).toBe('[tags.button.text.close]');

		closeBtn.click();
		expect(document.querySelector('.wat-dictionary-notification')).toBeNull();
	});

	test('새 알림 표시 시 기존 사전 알림은 제거된다', () => {
		const stub = makeDictStub();
		Dictionary.prototype._showDictionaryMessage.call(stub, '첫 번째', 'info');
		Dictionary.prototype._showDictionaryMessage.call(stub, '두 번째', 'error');

		const all = document.querySelectorAll('.wat-dictionary-notification');
		expect(all.length).toBe(1);
		expect(all[0].textContent).toContain('두 번째');
	});

	test('5초(+페이드) 후 자동 제거된다', () => {
		const stub = makeDictStub();
		Dictionary.prototype._showDictionaryMessage.call(stub, 'msg', 'info');

		jest.advanceTimersByTime(5000 + FADE_MS + 1);
		expect(document.querySelector('.wat-dictionary-notification')).toBeNull();
	});
});
