/**
 * @fileoverview 오버레이 모달(사전·페이지구조) 열기/닫기/Escape/포커스 관리 특성화 테스트.
 * @description Phase 6-8(OverlayManager 프리미티브 추출) 대비 — 추출 전후 동일 통과 요구.
 *              trapFocus 자체의 Tab 순환·빈배열 가드는 기존 trapfocus-behavior.test.js가 커버하므로
 *              여기서는 두 모달 소비자의 통합 동작과 overlay-active 정리 규칙에 집중한다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Dictionary } from '../../src/wat/Dictionary.js';
import { PageStructure } from '../../src/wat/PageStructure.js';
import { OverlayManager } from '../../src/wat/OverlayManager.js';

function pressKey(target, key, options = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
	target.dispatchEvent(event);
	return event;
}

/** WAT 실인스턴스 없이 두 모달 소비자에 필요한 최소 plugin 서비스 스텁 */
function makePlugin() {
	const plugin = {
		trapFocus: WAT.prototype.trapFocus,
		getConfigValue: jest.fn((path, fallback) => fallback),
		getLocalizedText: jest.fn((key) => `[${key}]`),
		selector: '#wat',
		_assetUrl: jest.fn((rel) => rel)
	};
	// 실제 WAT._initializeCoreSystem이 배선하는 것과 동일하게 오버레이 프리미티브 주입
	plugin.overlayManager = new OverlayManager(plugin);
	return plugin;
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
// PageStructure 모달 — 스크롤 잠금(overlay-active) 사용
// ──────────────────────────────────────────────────
describe('PageStructure 모달', () => {
	function open() {
		const plugin = makePlugin();
		const ps = new PageStructure(plugin);
		ps.openPageStructure();
		return { plugin, ps };
	}

	test('role=dialog·aria-modal·aria-labelledby·tabindex=-1 모달과 wat-overlay를 생성한다', () => {
		open();
		const layer = document.getElementById('pgStructure_layer');
		expect(layer).not.toBeNull();
		expect(layer.getAttribute('role')).toBe('dialog');
		expect(layer.getAttribute('aria-modal')).toBe('true');
		expect(layer.getAttribute('aria-labelledby')).toBe('page-structure-title');
		expect(layer.getAttribute('tabindex')).toBe('-1');
		expect(document.querySelector('.overlay.wat-overlay')).not.toBeNull();
	});

	test('열 때 body 스크롤 잠금(overlay-active)을 건다', () => {
		open();
		expect(document.body.classList.contains('overlay-active')).toBe(true);
	});

	test('제목/링크 두 개의 탭(role=tab)과 탭 패널을 만든다', () => {
		open();
		const tabs = document.querySelectorAll('#pgStructure_layer [role="tab"]');
		expect(tabs.length).toBe(2);
		expect(document.getElementById('pgStruct_heading_panel')).not.toBeNull();
		expect(document.getElementById('pgStruct_link_panel')).not.toBeNull();
	});

	test('닫기 버튼 클릭 시 레이어·오버레이 제거, 스크롤 잠금 해제, 포커스 복원', () => {
		const previous = document.createElement('button');
		document.body.appendChild(previous);
		previous.focus();

		open();
		// 닫기 버튼은 레이어 내 .btnClose
		document.querySelector('#pgStructure_layer .btnClose').click();

		expect(document.getElementById('pgStructure_layer')).toBeNull();
		expect(document.querySelector('.overlay.wat-overlay')).toBeNull();
		expect(document.body.classList.contains('overlay-active')).toBe(false);
		expect(document.activeElement).toBe(previous);
	});

	test('Escape 키로 닫히고 스크롤 잠금이 해제된다', () => {
		const previous = document.createElement('button');
		document.body.appendChild(previous);
		previous.focus();

		open();
		pressKey(document.getElementById('pgStructure_layer'), 'Escape');

		expect(document.getElementById('pgStructure_layer')).toBeNull();
		expect(document.body.classList.contains('overlay-active')).toBe(false);
		expect(document.activeElement).toBe(previous);
	});

	test('closePageStructure()는 직접 호출로도 정리된다 (공개 API 유지)', () => {
		const { ps } = open();
		ps.closePageStructure();
		expect(document.getElementById('pgStructure_layer')).toBeNull();
		expect(document.querySelector('.overlay.wat-overlay')).toBeNull();
		expect(document.body.classList.contains('overlay-active')).toBe(false);
	});
});

// ──────────────────────────────────────────────────
// Dictionary 모달 — 스크롤 잠금 미사용(페이지 중간에서 열림)
// ──────────────────────────────────────────────────
describe('Dictionary 모달', () => {
	function makeDict() {
		const plugin = makePlugin();
		const dict = Object.create(Dictionary.prototype);
		dict.plugin = plugin;
		dict._adjustModalPosition = jest.fn();
		return dict;
	}

	test('사전 모달은 overlay-active 스크롤 잠금을 걸지 않는다', () => {
		const dict = makeDict();
		dict.displayDictionResult({ title: 't', description: 'd' });
		expect(document.querySelector('.wat-diction-overlay')).not.toBeNull();
		expect(document.body.classList.contains('overlay-active')).toBe(false);
	});
});

// ──────────────────────────────────────────────────
// 교차 모달 — overlay-active 정리 규칙 (다른 wat-overlay가 남아 있으면 유지)
// ──────────────────────────────────────────────────
describe('overlay-active 교차 정리 규칙', () => {
	test('페이지구조(잠금)와 사전이 동시에 열린 상태에서 사전만 닫아도 잠금은 유지된다', () => {
		// 1) 페이지 구조 모달 — overlay-active 설정
		const ps = new PageStructure(makePlugin());
		ps.openPageStructure();
		expect(document.body.classList.contains('overlay-active')).toBe(true);

		// 2) 사전 모달 추가
		const dict = Object.create(Dictionary.prototype);
		dict.plugin = makePlugin();
		dict._adjustModalPosition = jest.fn();
		dict.displayDictionResult({ title: 't', description: 'd' });

		// 3) 사전 모달만 닫기 → 페이지구조 wat-overlay가 남아 있으므로 잠금 유지
		document.querySelector('.wat-diction-result-layer button').click();
		expect(document.querySelector('.wat-diction-result-layer')).toBeNull();
		expect(document.body.classList.contains('overlay-active')).toBe(true);

		// 4) 페이지구조까지 닫으면 잠금 해제
		document.querySelector('#pgStructure_layer .btnClose').click();
		expect(document.body.classList.contains('overlay-active')).toBe(false);
	});
});
