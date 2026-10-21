/**
 * @fileoverview 위젯 언어 변경 — 입력만으로 맥락이 바뀌지 않고, 바꾼 뒤 위치·포커스를 잃지 않으며, 호스트 문서 언어를 건드리지 않는다
 * @description
 *   - 언어 라디오에서 화살표로 옮길 때마다 언어가 바뀌고 패널 전체가 다시 만들어져 포커스가 body로 사라지고
 *     개별 설정 탭으로 돌아가던 문제 (WCAG 3.2.2, 2.4.3) — 적용 버튼을 눌렀을 때만 바꾼다.
 *   - 위젯 언어를 바꾸면 호스트 페이지 전체의 <html lang>을 덮어쓰던 문제 (WCAG 3.1.1) — 위젯이 만든
 *     요소(컨테이너·라이브 리전·알림)에만 lang을 지정한다 (WCAG 3.1.2).
 *   패널은 실제 generateHTMLElements로 그리고 로케일은 실제 로케일 파일을 쓴다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WAT } from '../../src/wat/WAT.js';
import { StateManager } from '../../src/wat/StateManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', '..', 'dist', 'assets', 'locales');
const readLocale = (lang) => JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8'));
const LOCALES = { ko: readLocale('ko'), 'en-US': readLocale('en-US') };

/**
 * 패널 생성·탭·언어 변경에 필요한 서비스만 갖춘 WAT 인스턴스 (생성자는 ConfigurationManager 등 무거운 의존을 가지므로 우회).
 * 패널 생성·탭 전환·라이브 리전은 실제 메서드를 쓰고, 이 테스트와 무관한 페이지 설정 복원·전역 리스너·저장만 스텁으로 둔다
 */
async function makeWat() {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.fontSizeRatios = { initial: 1, 'size-1p5x': 1.5 };
	wat.letterSpacingRatios = { initial: 0, wide_normal: 0.05 };
	wat.lineHeightRatios = { initial: 1, 'size-1p5x': 1.5 };
	wat.screenScaleRatios = { initial: 1, 'scale-1p2x': 1.2 };
	wat.language = 'ko';
	wat.languageOptions = ['ko', 'en-US'];
	wat.languageConfig = {};
	wat.selector = '#watContainer';
	wat.container = document.getElementById('watContainer');
	wat.state = new StateManager({});
	wat.loadWebFont = jest.fn();
	wat._setTimeout = jest.fn();
	wat._requestAnimationFrame = (callback) => callback();
	wat._log = jest.fn();
	wat.setInitialPreferences = jest.fn();
	wat.setEventListeners = jest.fn();
	wat._setupSpecificEventListeners = jest.fn();
	wat.extractFocusableElements = jest.fn();
	wat.savePreferences = jest.fn();

	await wat.loadLocale(wat.language);
	wat.generateHTMLElements();
	wat.setupTabs();
	wat.activateInitialTab();
	return wat;
}

/** 대기 중인 프로미스 후속 처리(로케일 로드 → 패널 재생성)를 모두 흘려보낸다 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** 환경설정 탭을 열고 언어 라디오를 고른다 (화살표 이동처럼 change만 발생) */
function selectLanguageRadio(lang) {
	document.getElementById('wat_settings').click();
	const radio = document.getElementById(`watSet_language_${lang}`);
	radio.checked = true;
	radio.dispatchEvent(new Event('change', { bubbles: true }));
	return radio;
}

beforeEach(() => {
	localStorage.clear();
	document.documentElement.setAttribute('lang', 'ko');
	document.body.innerHTML = '<div id="watContainer"></div>';
	WAT.embeddedLocales = LOCALES;
});

afterEach(() => {
	delete WAT.embeddedLocales;
	document.body.innerHTML = '';
	document.documentElement.setAttribute('lang', 'en');
	delete document.documentElement.dataset.watLanguage;
	delete document.documentElement.dataset.watPanel;
	localStorage.clear();
});

describe('언어 라디오 — 고르기만 해서는 맥락이 바뀌지 않는다 (WCAG 3.2.2)', () => {
	test('다른 언어 라디오로 옮겨도 언어가 그대로이고 패널을 다시 만들지 않는다', async () => {
		const wat = await makeWat();
		const radio = selectLanguageRadio('en-US');
		await flush();

		expect(wat.language).toBe('ko');
		// 패널을 다시 만들면 고른 라디오가 문서에서 떨어져 나가 포커스가 body로 사라진다
		expect(radio.isConnected).toBe(true);
		expect(document.getElementById('wat_title').textContent).toBe(LOCALES.ko.toolTitle);
	});

	test('언어 설정에 적용 버튼이 있고, 이름만으로 무엇을 적용하는지 알 수 있다 (WCAG 2.4.6)', async () => {
		await makeWat();
		const apply = document.getElementById('watSet_language_apply');

		expect(apply).not.toBeNull();
		expect(apply.closest('#watSetWrap_language')).not.toBeNull();
		expect(apply.value).toBe(LOCALES.ko.panel.settings.manage.options.language.apply);
	});
});

describe('적용 버튼 — 바꾼 뒤에도 위치와 포커스를 잃지 않는다 (WCAG 2.4.3)', () => {
	test('고른 언어로 패널을 다시 그린다', async () => {
		const wat = await makeWat();
		selectLanguageRadio('en-US');
		document.getElementById('watSet_language_apply').click();
		await flush();

		expect(wat.language).toBe('en-US');
		expect(document.getElementById('wat_title').textContent).toBe(LOCALES['en-US'].toolTitle);
		expect(document.getElementById('watSet_language_en-US').checked).toBe(true);
	});

	test('다시 그린 뒤에도 환경설정 탭이 열려 있다', async () => {
		await makeWat();
		selectLanguageRadio('en-US');
		document.getElementById('watSet_language_apply').click();
		await flush();

		expect(document.getElementById('wat_settings').getAttribute('aria-selected')).toBe('true');
		expect(document.getElementById('wat_Panel_Opt_settings').hidden).toBe(false);
		expect(document.getElementById('wat_Panel_Opt_personal').hidden).toBe(true);
	});

	test('포커스는 새로 그린 적용 버튼으로 돌아온다', async () => {
		await makeWat();
		selectLanguageRadio('en-US');
		const oldApply = document.getElementById('watSet_language_apply');
		oldApply.focus();
		oldApply.click();
		await flush();

		const newApply = document.getElementById('watSet_language_apply');
		expect(newApply).not.toBe(oldApply);
		expect(document.activeElement).toBe(newApply);
	});

	test('바꾼 결과를 새 언어로 라이브 리전에 알린다 (WCAG 4.1.3)', async () => {
		await makeWat();
		selectLanguageRadio('en-US');
		document.getElementById('watSet_language_apply').click();
		await flush();

		const expected = LOCALES['en-US'].msg.success.languageChanged.replace('{language}', LOCALES['en-US'].displayLanguage);
		expect(document.getElementById('wat-live-polite').textContent).toBe(expected);
	});

	test('지금 언어 그대로 적용하면 패널을 다시 만들지 않는다', async () => {
		const wat = await makeWat();
		const radio = selectLanguageRadio('ko');
		document.getElementById('watSet_language_apply').click();
		await flush();

		expect(wat.language).toBe('ko');
		expect(radio.isConnected).toBe(true);
	});
});

describe('문서 언어 — 호스트 페이지의 <html lang>을 건드리지 않고 위젯 요소에만 지정한다 (WCAG 3.1.1, 3.1.2)', () => {
	test('위젯 언어를 바꿔도 <html lang>은 호스트가 정한 값 그대로다', async () => {
		await makeWat();
		selectLanguageRadio('en-US');
		document.getElementById('watSet_language_apply').click();
		await flush();

		expect(document.documentElement.getAttribute('lang')).toBe('ko');
	});

	test('처음 그릴 때 위젯 컨테이너에 위젯 언어를 지정한다 — 호스트 언어와 달라도 열기 버튼·패널이 위젯 언어로 읽힌다', async () => {
		document.documentElement.setAttribute('lang', 'en');
		await makeWat();

		expect(document.getElementById('watWrap').closest('[lang]').getAttribute('lang')).toBe('ko');
		expect(document.getElementById('wat_btnOpen').closest('[lang]').getAttribute('lang')).toBe('ko');
	});

	test('언어를 바꾸면 위젯 컨테이너의 lang도 새 언어가 된다', async () => {
		await makeWat();
		selectLanguageRadio('en-US');
		document.getElementById('watSet_language_apply').click();
		await flush();

		expect(document.getElementById('watWrap').closest('[lang]').getAttribute('lang')).toBe('en-US');
	});

	test('body에 붙는 라이브 리전은 알릴 때마다 지금 위젯 언어를 지정한다', async () => {
		const wat = await makeWat();
		wat._announceToLiveRegion('안내');
		expect(document.getElementById('wat-live-polite').getAttribute('lang')).toBe('ko');

		wat.language = 'en-US';
		wat._announceToLiveRegion('Notice', 'assertive');
		wat._announceToLiveRegion('Notice');
		expect(document.getElementById('wat-live-assertive').getAttribute('lang')).toBe('en-US');
		expect(document.getElementById('wat-live-polite').getAttribute('lang')).toBe('en-US');
	});

	test('body에 붙는 알림 상자에 위젯 언어를 지정한다', async () => {
		const wat = await makeWat();
		wat.language = 'en-US';
		wat._notify('Saved', { type: 'success' });

		expect(document.querySelector('.wat-user-feedback').getAttribute('lang')).toBe('en-US');
	});
});
