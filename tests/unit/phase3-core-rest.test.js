/**
 * @fileoverview Phase 3 단위 테스트 - ContainerManager, StyleBatchProcessor, OptionsProcessor, ConfigurationManager
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { OptionsProcessor } from '../../src/core/OptionsProcessor.js';
import { ConfigurationManager } from '../../src/core/ConfigurationManager.js';
import { StyleBatchProcessor } from '../../src/core/StyleBatchProcessor.js';
import { ContainerManager } from '../../src/core/ContainerManager.js';
import { Constants } from '../../src/core/constants.js';

// ──────────────────────────────────────────────────
// OptionsProcessor
// ──────────────────────────────────────────────────
describe('OptionsProcessor - processRatioOptions()', () => {
	const defaultRatios = { initial: 1, 'size-1p2x': 1.2, 'size-1p5x': 1.5 };

	test('customOptions 없을 때 defaultRatios 복사 반환', () => {
		const result = OptionsProcessor.processRatioOptions(defaultRatios, null);
		expect(result).toEqual(defaultRatios);
		expect(result).not.toBe(defaultRatios);
	});

	test('false 값 항목 제거', () => {
		const result = OptionsProcessor.processRatioOptions(defaultRatios, { 'size-1p2x': false });
		expect(result['size-1p2x']).toBeUndefined();
		expect(result.initial).toBe(1);
	});

	test('숫자 값으로 직접 교체', () => {
		const result = OptionsProcessor.processRatioOptions(defaultRatios, { initial: 0.9 });
		expect(result.initial).toBe(0.9);
	});

	test('객체.ratio 값 추출', () => {
		const result = OptionsProcessor.processRatioOptions(defaultRatios, { 'size-1p5x': { ratio: 1.6 } });
		expect(result['size-1p5x']).toBe(1.6);
	});
});

describe('OptionsProcessor - detectBrowserLanguage()', () => {
	const supported = ['ko', 'en-US', 'en-GB', 'de', 'ja', 'zh'];
	const originalLanguages = Object.getOwnPropertyDescriptor(Navigator.prototype, 'languages');

	function mockNavigatorLanguages(languages) {
		Object.defineProperty(navigator, 'languages', { value: languages, configurable: true });
	}

	afterEach(() => {
		delete navigator.languages;
		if (originalLanguages) Object.defineProperty(Navigator.prototype, 'languages', originalLanguages);
	});

	test('정확 일치를 우선한다', () => {
		mockNavigatorLanguages(['ja', 'en-US']);
		expect(OptionsProcessor.detectBrowserLanguage(supported)).toBe('ja');
	});

	test('지역 변형은 기본 코드로 매칭한다 (en-CA → en-US, zh-CN → zh)', () => {
		mockNavigatorLanguages(['en-CA']);
		expect(OptionsProcessor.detectBrowserLanguage(supported)).toBe('en-US');
		mockNavigatorLanguages(['zh-CN']);
		expect(OptionsProcessor.detectBrowserLanguage(supported)).toBe('zh');
	});

	test('매칭 실패 시 null을 반환한다', () => {
		mockNavigatorLanguages(['fr-FR', 'es']);
		expect(OptionsProcessor.detectBrowserLanguage(supported)).toBeNull();
	});
});

describe('OptionsProcessor - processLanguageOptions()', () => {
	const supported = ['ko', 'en-US', 'en-GB', 'de', 'ja', 'zh'];

	test('inputLang 없을 때 기본값 반환', () => {
		const result = OptionsProcessor.processLanguageOptions(null, supported, 'ko');
		expect(result.language).toBe('ko');
		expect(result.showSelector).toBe(true);
	});

	test('문자열 inputLang 처리', () => {
		const result = OptionsProcessor.processLanguageOptions('en-US', supported, 'ko');
		expect(result.language).toBe('en-US');
		expect(result.showSelector).toBe(false);
	});

	test('배열 inputLang 처리', () => {
		const result = OptionsProcessor.processLanguageOptions(['ko', 'en-US'], supported, 'ko');
		expect(result.options).toEqual(['ko', 'en-US']);
		expect(result.showSelector).toBe(true);
	});

	test('지원하지 않는 언어 필터링', () => {
		const result = OptionsProcessor.processLanguageOptions(['ko', 'fr'], supported, 'ko');
		expect(result.options).toEqual(['ko']);
	});

	test('객체 형식 autoDetect 처리', () => {
		const result = OptionsProcessor.processLanguageOptions(
			{ autoDetect: true, showSelector: true },
			supported,
			'ko'
		);
		expect(Array.isArray(result.options)).toBe(true);
		expect(result.options.length).toBeGreaterThan(1);
	});

	test('단일 언어 + showSelector: false → 강제 언어 설정', () => {
		const result = OptionsProcessor.processLanguageOptions(
			{ languages: ['en-US'], showSelector: false },
			supported,
			'ko'
		);
		expect(result.language).toBe('en-US');
		expect(result.showSelector).toBe(false);
	});
});

describe('OptionsProcessor - processContainerOptions()', () => {
	test('options 값 우선 반환', () => {
		const result = OptionsProcessor.processContainerOptions(
			{ containerID: 'myContainer', containerTargetSelector: '#main', containerTargetPosition: 'after' },
			{ STORAGE_KEYS: { CONTAINER: 'watContainer' } },
			{ OPTIONS: { containerSelector: 'body' } }
		);
		expect(result.id).toBe('myContainer');
		expect(result.targetSelector).toBe('#main');
		expect(result.position).toBe('after');
	});

	test('options 없을 때 기본값 사용', () => {
		const result = OptionsProcessor.processContainerOptions(
			{},
			{ STORAGE_KEYS: { CONTAINER: 'watContainer' } },
			{ OPTIONS: { containerSelector: 'body' } }
		);
		expect(result.id).toBe('watContainer');
		expect(result.targetSelector).toBe('body');
		expect(result.position).toBe('before');
	});
});

describe('OptionsProcessor - processStyleOptions()', () => {
	test('옵션 지정 시 해당 값 사용', () => {
		const result = OptionsProcessor.processStyleOptions(
			{ styleMode: 'static', styleCssPath: '/custom/style.css' },
			'/base/'
		);
		expect(result.mode).toBe('static');
		expect(result.cssPath).toBe('/custom/style.css');
	});

	test('기본값 동적 생성', () => {
		const result = OptionsProcessor.processStyleOptions({}, '/base/');
		expect(result.mode).toBe('dynamic');
		expect(result.cssPath).toContain('/base/');
	});
});

describe('OptionsProcessor - processSelectorOptions()', () => {
	test('커스텀 선택자 처리', () => {
		const result = OptionsProcessor.processSelectorOptions({
			applySelector: '#content',
			excludeSelector: '.no-wat'
		});
		expect(result.apply).toBe('#content');
		expect(result.exclude).toBe('.no-wat');
	});

	test('기본값 반환', () => {
		const result = OptionsProcessor.processSelectorOptions({});
		expect(result.apply).toBe('body');
		expect(result.exclude).toBe('');
	});
});

// ──────────────────────────────────────────────────
// ConfigurationManager
// ──────────────────────────────────────────────────
describe('ConfigurationManager', () => {
	test('기본 설정으로 인스턴스 생성', () => {
		const cm = new ConfigurationManager({}, {}, '/base/');
		expect(cm.getContainerConfig()).toBeDefined();
		expect(cm.getStyleConfig()).toBeDefined();
		expect(cm.getSelectorConfig()).toBeDefined();
		expect(cm.getLanguageConfig()).toBeDefined();
		expect(cm.getRatioConfigs()).toBeDefined();
	});

	test('언어 설정 반환', () => {
		const cm = new ConfigurationManager({ language: 'en-US' }, {}, '');
		expect(cm.getLanguage()).toBe('en-US');
	});

	test('저장된 언어 설정 우선 적용', () => {
		const cm = new ConfigurationManager({}, { language: 'ja' }, '');
		expect(cm.getLanguage()).toBe('ja');
	});

	test('지원하지 않는 저장 언어 → 기본 언어 사용', () => {
		const cm = new ConfigurationManager({}, { language: 'fr' }, '');
		expect(cm.getLanguage()).toBe('ko');
	});

	test('저장 언어가 없으면 브라우저 언어를 초기 언어로 사용한다', () => {
		Object.defineProperty(navigator, 'languages', { value: ['ja'], configurable: true });
		const cm = new ConfigurationManager({}, {}, '');
		expect(cm.getLanguage()).toBe('ja');
		delete navigator.languages;
	});

	test('저장 언어가 브라우저 언어보다 우선한다', () => {
		Object.defineProperty(navigator, 'languages', { value: ['ja'], configurable: true });
		const cm = new ConfigurationManager({}, { language: 'de' }, '');
		expect(cm.getLanguage()).toBe('de');
		delete navigator.languages;
	});

	test('language.autoDetect: false면 브라우저 언어를 무시한다', () => {
		Object.defineProperty(navigator, 'languages', { value: ['ja'], configurable: true });
		const cm = new ConfigurationManager({ language: { autoDetect: false, defaultLanguage: 'ko' } }, {}, '');
		expect(cm.getLanguage()).toBe('ko');
		delete navigator.languages;
	});

	test('비율 설정 객체 포함', () => {
		const cm = new ConfigurationManager({}, {}, '');
		const ratios = cm.getRatioConfigs();
		expect(ratios.fontSize).toBeDefined();
		expect(ratios.lineHeight).toBeDefined();
		expect(ratios.letterSpacing).toBeDefined();
		expect(ratios.screenScale).toBeDefined();
	});

	test('containerID 옵션 반영', () => {
		const cm = new ConfigurationManager({ containerID: 'customContainer' }, {}, '');
		expect(cm.getContainerConfig().id).toBe('customContainer');
	});
});

// ──────────────────────────────────────────────────
// StyleBatchProcessor
// ──────────────────────────────────────────────────
describe('StyleBatchProcessor', () => {
	let processor;

	beforeEach(() => {
		processor = new StyleBatchProcessor(null);
	});

	afterEach(() => {
		processor.cancelPendingUpdates();
	});

	test('queueStyleUpdate() 후 getPendingCount() 증가', () => {
		const el = document.createElement('div');
		processor.queueStyleUpdate(el, 'color', 'red');
		expect(processor.getPendingCount()).toBe(1);
	});

	test('queueMultipleStyles() 다중 속성 큐잉', () => {
		const el = document.createElement('div');
		processor.queueMultipleStyles(el, { color: 'blue', fontSize: '16px' });
		expect(processor.getPendingCount()).toBe(1);
		expect(processor.pendingUpdates.get(el).size).toBe(2);
	});

	test('removePendingUpdatesForElement() 단일 요소 제거', () => {
		const el = document.createElement('div');
		processor.queueStyleUpdate(el, 'color', 'green');
		processor.removePendingUpdatesForElement(el);
		expect(processor.getPendingCount()).toBe(0);
	});

	test('cancelPendingUpdates() 후 큐 비어있음', () => {
		const el = document.createElement('div');
		processor.queueStyleUpdate(el, 'color', 'pink');
		processor.cancelPendingUpdates();
		expect(processor.getPendingCount()).toBe(0);
		expect(processor.isScheduled).toBe(false);
	});

	test('applyStylesToElement() 스타일 적용', () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		const styleMap = new Map([['color', 'red']]);
		processor.applyStylesToElement(el, styleMap);
		expect(el.style.color).toBe('red');
		document.body.removeChild(el);
	});

	test('applyStylesToElement() null 값은 removeProperty', () => {
		const el = document.createElement('div');
		el.style.setProperty('color', 'blue', 'important');
		const styleMap = new Map([['color', null]]);
		processor.applyStylesToElement(el, styleMap);
		expect(el.style.color).toBe('');
	});
});

// ──────────────────────────────────────────────────
// ContainerManager
// ──────────────────────────────────────────────────
describe('ContainerManager', () => {
	afterEach(() => {
		const el = document.getElementById('testContainer');
		if (el) el.remove();
	});

	test('createOrFindContainer() - 새 컨테이너 생성', () => {
		const container = ContainerManager.createOrFindContainer({
			id: 'testContainer',
			targetSelector: 'body',
			position: 'after'
		});
		expect(container).not.toBeNull();
		expect(container.id).toBe('testContainer');
	});

	test('createOrFindContainer() - 기존 컨테이너 재사용', () => {
		const first = ContainerManager.createOrFindContainer({
			id: 'testContainer',
			targetSelector: 'body',
			position: 'after'
		});
		const second = ContainerManager.createOrFindContainer({
			id: 'testContainer',
			targetSelector: 'body',
			position: 'after'
		});
		expect(first).toBe(second);
	});

	test('applySelectorClasses() - CSS 클래스 적용', () => {
		const el = document.createElement('div');
		el.className = 'target-el';
		document.body.appendChild(el);

		ContainerManager.applySelectorClasses('.target-el', '', Constants.CSS_CLASSES);
		expect(el.classList.contains('wat-apply')).toBe(true);

		el.remove();
	});

	test('applySelectorClasses() - 제외 클래스 적용', () => {
		const el = document.createElement('div');
		el.className = 'exclude-el';
		document.body.appendChild(el);

		ContainerManager.applySelectorClasses('', '.exclude-el', Constants.CSS_CLASSES);
		expect(el.classList.contains('wat-exclude')).toBe(true);

		el.remove();
	});

	test('CSS_CLASSES에 APPLY/EXCLUDE가 정의되어 있다 (누락 시 "undefined" 클래스가 부여되는 회귀 방지)', () => {
		expect(Constants.CSS_CLASSES.APPLY).toBe('wat-apply');
		expect(Constants.CSS_CLASSES.EXCLUDE).toBe('wat-exclude');
	});
});
