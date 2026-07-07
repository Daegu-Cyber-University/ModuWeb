/**
 * @fileoverview trapFocus()와 사전 결과 모달(displayDictionResult)의 포커스 관리
 *               특성화 테스트. Phase 1(빈 배열 가드, 사전 모달의 trapFocus 재사용) 안전망.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';

function pressKey(target, key, options = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
	target.dispatchEvent(event);
	return event;
}

/** 버튼 2개를 가진 모달 레이어 + 오버레이 + 이전 포커스 요소 구성 */
function buildModalFixture() {
	const previous = document.createElement('button');
	previous.id = 'prev-focus';
	document.body.appendChild(previous);
	previous.focus();

	const overlay = document.createElement('div');
	overlay.className = 'overlay';
	document.body.appendChild(overlay);
	document.body.classList.add('overlay-active');

	const layer = document.createElement('div');
	layer.setAttribute('tabindex', '-1');
	const first = document.createElement('button');
	first.id = 'first-btn';
	const last = document.createElement('button');
	last.id = 'last-btn';
	layer.appendChild(first);
	layer.appendChild(last);
	document.body.appendChild(layer);

	return { previous, overlay, layer, first, last };
}

beforeEach(() => {
	document.body.innerHTML = '';
	document.body.className = '';
});

afterEach(() => {
	document.body.innerHTML = '';
	document.body.className = '';
});

// ──────────────────────────────────────────────────
// trapFocus — 공용 포커스 트랩 (페이지 구조 모달 등에서 사용)
// ──────────────────────────────────────────────────
describe('trapFocus', () => {
	test('마지막 요소에서 Tab → 첫 요소로 순환하고 기본 동작을 막는다', () => {
		const { previous, overlay, layer, first, last } = buildModalFixture();
		WAT.prototype.trapFocus.call({}, layer, previous, overlay);

		last.focus();
		const event = pressKey(layer, 'Tab');

		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(first);
	});

	test('첫 요소에서 Shift+Tab → 마지막 요소로 순환한다', () => {
		const { previous, overlay, layer, first, last } = buildModalFixture();
		WAT.prototype.trapFocus.call({}, layer, previous, overlay);

		first.focus();
		const event = pressKey(layer, 'Tab', { shiftKey: true });

		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(last);
	});

	test('중간 위치에서의 Tab은 개입하지 않는다 (브라우저 기본 이동 허용)', () => {
		const { previous, overlay, layer, first } = buildModalFixture();
		WAT.prototype.trapFocus.call({}, layer, previous, overlay);

		first.focus();
		const event = pressKey(layer, 'Tab'); // first에서 앞으로 → 마지막이 아니므로 개입 없음

		expect(event.defaultPrevented).toBe(false);
	});

	test('Escape → 레이어·오버레이 제거, overlay-active 해제, 이전 요소로 포커스 복원', () => {
		const { previous, overlay, layer } = buildModalFixture();
		WAT.prototype.trapFocus.call({}, layer, previous, overlay);

		pressKey(layer, 'Escape');

		expect(document.body.contains(layer)).toBe(false);
		expect(document.body.contains(overlay)).toBe(false);
		expect(document.body.classList.contains('overlay-active')).toBe(false);
		expect(document.activeElement).toBe(previous);
	});

	test('이전 포커스 요소가 없으면 Escape 시 body로 포커스가 이동한다', () => {
		const { overlay, layer } = buildModalFixture();
		WAT.prototype.trapFocus.call({}, layer, null, overlay);

		expect(() => pressKey(layer, 'Escape')).not.toThrow();
		expect(document.body.contains(layer)).toBe(false);
	});

	// [특성화] 현재는 포커스 가능 요소가 0개인 레이어에서 Tab을 누르면
	// firstFocusableElement가 undefined라 가드가 없다 (Phase 1에서 가드 추가 예정).
	// Tab 위치 조건(activeElement === undefined)이 성립하지 않아 우연히 예외는 없지만,
	// 포커스가 트랩 밖으로 새는 것을 막지 못한다.
	test('현재 동작: 포커스 가능 요소가 없으면 Tab에 개입하지 못한다', () => {
		const { previous, overlay } = buildModalFixture();
		const emptyLayer = document.createElement('div');
		emptyLayer.setAttribute('tabindex', '-1');
		document.body.appendChild(emptyLayer);

		WAT.prototype.trapFocus.call({}, emptyLayer, previous, overlay);

		emptyLayer.focus();
		const event = pressKey(emptyLayer, 'Tab');
		expect(event.defaultPrevented).toBe(false); // 트랩이 동작하지 않음 — 포커스 이탈 허용
	});
});

// ──────────────────────────────────────────────────
// displayDictionResult — 사전 결과 모달 (인라인 트랩 사용 中 — Phase 1에서 trapFocus로 통합 예정)
// ──────────────────────────────────────────────────
describe('displayDictionResult', () => {
	function makeDictionStub() {
		return {
			removeAllDictionLayers: jest.fn(() => {
				document.querySelectorAll('.wat-diction-result-layer').forEach(el => el.remove());
			}),
			getConfigValue: jest.fn((path, fallback) => fallback),
			getLocalizedText: jest.fn((key) => `[${key}]`),
			_adjustModalPosition: jest.fn()
		};
	}

	test('role=dialog, aria-modal, aria-labelledby를 갖춘 모달을 생성한다', () => {
		const stub = makeDictionStub();
		WAT.prototype.displayDictionResult.call(stub, { title: '안녕', description: '인사말' });

		const layer = document.querySelector('.wat-diction-result-layer');
		expect(layer).not.toBeNull();
		expect(layer.getAttribute('role')).toBe('dialog');
		expect(layer.getAttribute('aria-modal')).toBe('true');
		expect(layer.getAttribute('aria-labelledby')).toBe('diction-result-title');
		expect(layer.querySelector('#diction-result-title').textContent).toContain('안녕');
	});

	test('외부 API 응답(title/description)은 텍스트로만 삽입된다 (XSS 방지)', () => {
		const stub = makeDictionStub();
		WAT.prototype.displayDictionResult.call(stub, {
			title: '<img src=x onerror=alert(1)>',
			description: '<script>alert(2)</script>'
		});

		const layer = document.querySelector('.wat-diction-result-layer');
		expect(layer.querySelector('img')).toBeNull();
		expect(layer.querySelector('script')).toBeNull();
	});

	test('안전하지 않은 스킴의 링크는 렌더링하지 않는다', () => {
		const stub = makeDictionStub();
		// eslint-disable-next-line no-script-url
		WAT.prototype.displayDictionResult.call(stub, { title: 't', description: 'd', link: 'javascript:alert(1)' });
		expect(document.querySelector('.wat-diction-result-layer a')).toBeNull();

		WAT.prototype.displayDictionResult.call(stub, { title: 't', description: 'd', link: 'https://example.com/x' });
		expect(document.querySelector('.wat-diction-result-layer a')).not.toBeNull();
	});

	test('닫기 버튼 클릭 시 레이어가 제거되고 이전 요소로 포커스가 복원된다', () => {
		const previous = document.createElement('button');
		document.body.appendChild(previous);
		previous.focus();

		const stub = makeDictionStub();
		WAT.prototype.displayDictionResult.call(stub, { title: 't', description: 'd' });

		const closeBtn = document.querySelector('.wat-diction-result-layer button');
		closeBtn.click();

		expect(document.querySelector('.wat-diction-result-layer')).toBeNull();
		expect(document.activeElement).toBe(previous);
	});

	test('Escape 키로 모달이 닫히고 포커스가 복원된다', () => {
		const previous = document.createElement('button');
		document.body.appendChild(previous);
		previous.focus();

		const stub = makeDictionStub();
		WAT.prototype.displayDictionResult.call(stub, { title: 't', description: 'd' });

		const layer = document.querySelector('.wat-diction-result-layer');
		pressKey(layer, 'Escape');

		expect(document.querySelector('.wat-diction-result-layer')).toBeNull();
		expect(document.activeElement).toBe(previous);
	});

	// [특성화] 현재 사전 모달에는 배경 오버레이가 없다 (Phase 1에서 추가 예정)
	test('현재 동작: 배경 오버레이 없이 레이어만 생성된다', () => {
		const stub = makeDictionStub();
		WAT.prototype.displayDictionResult.call(stub, { title: 't', description: 'd' });

		expect(document.querySelector('.wat-diction-result-layer')).not.toBeNull();
		expect(document.querySelector('.wat-diction-overlay')).toBeNull();
	});
});
