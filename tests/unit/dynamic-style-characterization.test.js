/**
 * @fileoverview applyDynamic* 4종·resetWatSettings·setRadioListeners 특성화 테스트.
 * @description 리팩터링(중복 통합) 전후로 동일하게 통과해야 하는 현재 동작 고정 테스트.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { WAT } from '../../src/wat/WAT.js';
import { Defaults } from '../../src/core/defaults.js';

const CHANGE_METHODS = [
	'changeFontSize', 'changeFontFamily', 'changeScreenScale', 'changeTextAlign',
	'changeLetterSpacing', 'changeLineHeight', 'changeColorTheme', 'changeSaturation',
	'changeReadGuide', 'changeImgDisplayMode'
];

function makeWat(overrides = {}) {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.getLocalizedText = jest.fn((key) => key);
	wat.state = { set: jest.fn(), get: jest.fn() };
	wat._dispatchStateEvent = jest.fn();
	wat._notify = jest.fn();
	wat._setTimeout = jest.fn();
	wat._skipSavePreferences = false;
	wat._syncIndividualSettingsUI = jest.fn();
	wat._handleError = jest.fn();
	wat.savePreferences = jest.fn();
	CHANGE_METHODS.forEach(m => { wat[m] = jest.fn(); });
	return Object.assign(wat, overrides);
}

/** applyDynamic* 계열용 스텁: 캐시 요소·원본 스타일 맵·배치 프로세서 */
function makeDynamicWat(elements, originals = new Map()) {
	return makeWat({
		_getCachedElements: jest.fn(() => elements),
		_originalStyleMap: originals,
		styleBatchProcessor: { queueStyleUpdate: jest.fn() },
		fontSizeRatios: { initial: 1, 'size-1p2x': 1.2, 'size-1p5x': 1.5, 'size-2x': 2 },
		lineHeightRatios: { initial: 1, 'size-1p5x': 1.5, 'size-1p75x': 1.75, 'size-2x': 2 },
		letterSpacingRatios: { initial: 1, wide_little: 1.5, wide_normal: 2, wide_lot: 3 }
	});
}

function resetDocumentElement() {
	const html = document.documentElement;
	['fontSize', 'fontFamily', 'screenScale', 'colorTheme', 'saturation',
		'imgDisplayMode', 'watViewmode', 'watPosition'].forEach(k => { delete html.dataset[k]; });
	['data-txt-align', 'data-letter-spacing', 'data-line-height', 'data-read-guide'].forEach(a => html.removeAttribute(a));
}

beforeEach(() => {
	jest.useFakeTimers();
	localStorage.clear();
	document.body.innerHTML = '';
	resetDocumentElement();
});

afterEach(() => {
	jest.runOnlyPendingTimers();
	jest.useRealTimers();
	localStorage.clear();
	resetDocumentElement();
});

describe('applyDynamicFontSize', () => {
	test('initial/unset이면 캐시 요소 전체의 font-size를 null로 큐잉한다', () => {
		const els = [document.createElement('p'), document.createElement('p')];
		const wat = makeDynamicWat(els);

		wat.applyDynamicFontSize('initial');
		expect(wat._getCachedElements).toHaveBeenCalledWith('wat-dyn-fontsize');
		els.forEach(el => {
			expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(el, 'font-size', null);
		});

		wat.styleBatchProcessor.queueStyleUpdate.mockClear();
		wat.applyDynamicFontSize('unset');
		expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledTimes(els.length);
	});

	test('원본 스타일이 있는 요소만 비율을 곱해 큐잉하고, 없는 요소는 건너뛴다', () => {
		const withOrig = document.createElement('p');
		const withoutOrig = document.createElement('p');
		const originals = new Map([[withOrig, { 'font-size': '20px' }]]);
		const wat = makeDynamicWat([withOrig, withoutOrig], originals);

		wat.applyDynamicFontSize('size-1p5x');

		expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledTimes(1);
		expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(withOrig, 'font-size', '30px');
	});

	test('알 수 없는 크기 키는 비율 1로 처리한다', () => {
		const el = document.createElement('p');
		const wat = makeDynamicWat([el], new Map([[el, { 'font-size': '16px' }]]));

		wat.applyDynamicFontSize('no-such-key');
		expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(el, 'font-size', '16px');
	});
});

describe('applyDynamicLineHeight', () => {
	test('initial이면 null 큐잉, 비율 키면 원본 px에 비율을 곱한다', () => {
		const el = document.createElement('p');
		const wat = makeDynamicWat([el], new Map([[el, { 'line-height': '24px' }]]));

		wat.applyDynamicLineHeight('initial');
		expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(el, 'line-height', null);

		wat.styleBatchProcessor.queueStyleUpdate.mockClear();
		wat.applyDynamicLineHeight('size-2x');
		expect(wat._getCachedElements).toHaveBeenCalledWith('wat-dyn-lineheight');
		expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(el, 'line-height', '48px');
	});
});

describe('applyDynamicTextAlign', () => {
	test('initial이면 null, 그 외에는 정렬 값을 원본 유무와 무관하게 전체에 큐잉한다', () => {
		const els = [document.createElement('p'), document.createElement('p')];
		const wat = makeDynamicWat(els); // 원본 스타일 맵 비어 있음

		wat.applyDynamicTextAlign('center');
		expect(wat._getCachedElements).toHaveBeenCalledWith('wat-dyn-textalign');
		els.forEach(el => {
			expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(el, 'text-align', 'center');
		});

		wat.styleBatchProcessor.queueStyleUpdate.mockClear();
		wat.applyDynamicTextAlign('initial');
		els.forEach(el => {
			expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(el, 'text-align', null);
		});
	});
});

describe('applyDynamicLetterSpacing', () => {
	test('원본 letter-spacing이 있으면 비율을 곱한다', () => {
		const el = document.createElement('p');
		const wat = makeDynamicWat([el], new Map([[el, { 'letter-spacing': '2px' }]]));

		wat.applyDynamicLetterSpacing('wide_normal');
		expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(el, 'letter-spacing', '4px');
	});

	test('원본이 없으면 computed font-size의 5%를 기준으로 계산한다', () => {
		const el = document.createElement('p');
		el.style.fontSize = '20px';
		document.body.appendChild(el);
		const wat = makeDynamicWat([el]);

		wat.applyDynamicLetterSpacing('wide_normal'); // 20 * 0.05 * 2 = 2px
		expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(el, 'letter-spacing', '2px');
	});

	test('initial이면 null을 큐잉한다', () => {
		const el = document.createElement('p');
		const wat = makeDynamicWat([el]);

		wat.applyDynamicLetterSpacing('initial');
		expect(wat.styleBatchProcessor.queueStyleUpdate).toHaveBeenCalledWith(el, 'letter-spacing', null);
	});
});

describe('resetWatSettings', () => {
	test('접근성 설정 전체를 기본값으로 되돌리고 도구 설정(viewMode/toolPosition)은 유지한다', () => {
		const wat = makeWat();
		const defaults = Defaults.SETTINGS;
		document.documentElement.dataset.watViewmode = 'list';
		document.documentElement.dataset.watPosition = 'left';

		wat.resetWatSettings();

		expect(wat.changeFontSize).toHaveBeenCalledWith(defaults.fontSize);
		expect(wat.changeFontFamily).toHaveBeenCalledWith(defaults.fontFamily);
		expect(wat.changeScreenScale).toHaveBeenCalledWith(defaults.screenScale);
		expect(wat.changeTextAlign).toHaveBeenCalledWith(defaults.txtAlign);
		expect(wat.changeLetterSpacing).toHaveBeenCalledWith(defaults.letterSpacing);
		expect(wat.changeLineHeight).toHaveBeenCalledWith(defaults.lineHeight);
		expect(wat.changeColorTheme).toHaveBeenCalledWith(defaults.colorTheme);
		expect(wat.changeSaturation).toHaveBeenCalledWith(defaults.saturation);
		expect(wat.changeReadGuide).toHaveBeenCalledWith(defaults.readGuide);
		expect(document.documentElement.dataset.imgDisplayMode).toBe(defaults.imgDisplayMode);

		expect(wat._syncIndividualSettingsUI).toHaveBeenCalledWith(
			expect.objectContaining({
				fontSize: defaults.fontSize,
				viewMode: 'list',
				toolPosition: 'left'
			})
		);

		// 지연 재동기화 1회
		jest.advanceTimersByTime(60);
		expect(wat._syncIndividualSettingsUI).toHaveBeenCalledTimes(2);
	});
});

describe('setRadioListeners', () => {
	/** 개인 옵션 라디오 골격: personalOpt_item > opt_lists > opt_item > input */
	function buildRadioDom(name, values, selectedIndex = 0) {
		const item = document.createElement('div');
		item.className = 'personalOpt_item';
		const ul = document.createElement('ul');
		ul.className = 'opt_lists';
		values.forEach((v, i) => {
			const li = document.createElement('li');
			li.className = 'opt_item' + (i === selectedIndex ? ' selectOn' : '');
			const input = document.createElement('input');
			input.type = 'radio';
			input.className = 'wat-item-type-radio';
			input.name = name;
			input.value = v;
			li.appendChild(input);
			ul.appendChild(li);
		});
		item.appendChild(ul);
		document.body.appendChild(item);
		return item;
	}

	test('{name, value} 객체로 호출하면 selectOn을 옮기고 대응 change 메서드를 호출한다', () => {
		const item = buildRadioDom('fontSize', ['initial', 'size-1p5x', 'size-2x'], 0);
		const wat = makeWat();

		wat.setRadioListeners({ name: 'fontSize', value: 'size-1p5x' });

		const lis = item.querySelectorAll('.opt_item');
		expect(lis[0].classList.contains('selectOn')).toBe(false);
		expect(lis[1].classList.contains('selectOn')).toBe(true);
		expect(item.classList.contains('selectOn')).toBe(true);
		expect(wat.changeFontSize).toHaveBeenCalledWith('size-1p5x');
	});

	test('initial 값이면 personalOpt_item의 selectOn을 제거한다', () => {
		const item = buildRadioDom('saturation', ['initial', 'gray'], 1);
		item.classList.add('selectOn');
		const wat = makeWat();

		wat.setRadioListeners({ name: 'saturation', value: 'initial' });

		expect(item.classList.contains('selectOn')).toBe(false);
		expect(wat.changeSaturation).toHaveBeenCalledWith('initial');
	});

	test('viewMode는 데이터셋만 설정하고 change 메서드를 타지 않는다', () => {
		const input = document.createElement('input');
		input.type = 'radio';
		input.className = 'wat-set-item-type-radio';
		input.name = 'viewMode';
		input.value = 'list';
		document.body.appendChild(input);
		const wat = makeWat();

		wat.setRadioListeners({ name: 'viewMode', value: 'list' });

		expect(document.documentElement.dataset.watViewmode).toBe('list');
		expect(input.checked).toBe(true);
		CHANGE_METHODS.forEach(m => expect(wat[m]).not.toHaveBeenCalled());
	});

	test('대응 DOM이 없으면 경고 후 아무 change 메서드도 호출하지 않는다', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		const wat = makeWat();

		wat.setRadioListeners({ name: 'fontSize', value: 'size-2x' });

		expect(warn).toHaveBeenCalled();
		expect(wat.changeFontSize).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
