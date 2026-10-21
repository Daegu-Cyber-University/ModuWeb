/**
 * @fileoverview 위젯이 body에 붙이는 대화상자·상태창의 언어 — 위젯 문구는 위젯 언어로, 페이지·사전에서 온 글은 원래 언어로 읽힌다
 * @description
 *   위젯 언어를 바꿔도 호스트 <html lang>은 건드리지 않으므로, body에 붙는 위젯 UI는 lang이 없으면 호스트 언어로
 *   읽힌다 (WCAG 3.1.2). 다만 페이지 구조 목록에는 호스트 제목·링크가, 사전 결과에는 사전 응답이 섞여 있어
 *   대화상자 전체에 위젯 언어를 달면 그 부분이 잘못 읽힌다.
 *   - 페이지 구조: 대화상자에 위젯 언어, 목록의 호스트 글자에는 그 글이 페이지에서 쓰인 언어
 *   - 사전 결과: 대화상자는 페이지 언어 그대로, 닫기 버튼·발음 라벨에만 위젯 언어
 *   - 음성 명령 상태창: 위젯 문구뿐이므로 위젯 언어 (켜 둔 채 언어를 바꿔도 다음 갱신 때 따라감)
 *   대화상자는 실제 openPageStructure·displayDictionResult로 열고, 로케일은 실제 로케일 파일을 쓴다.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WAT } from '../../src/wat/WAT.js';
import { PageStructure } from '../../src/wat/PageStructure.js';
import { Dictionary } from '../../src/wat/Dictionary.js';
import { VoiceCommand } from '../../src/stt/VoiceCommand.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', '..', 'dist', 'assets', 'locales');
const readLocale = (lang) => JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8'));
const LOCALES = { ko: readLocale('ko'), 'en-US': readLocale('en-US'), ja: readLocale('ja') };
const EN = LOCALES['en-US'];

/**
 * 대화상자·상태창이 쓰는 서비스만 갖춘 WAT 인스턴스 (생성자는 ConfigurationManager 등 무거운 의존을 가지므로 우회).
 * 로케일은 위젯 언어를 따라가고, 포커스 트랩·정리는 실제 trapFocus가 만드는 OverlayManager를 쓴다
 */
function makePlugin(language) {
	const plugin = Object.create(WAT.prototype);
	plugin.language = language;
	plugin.selector = '#watContainer';
	plugin.state = { get: (key) => (key === 'locale' ? LOCALES[plugin.language] : undefined), set: jest.fn() };
	plugin._assetUrl = (path) => `/${path}`;
	plugin.getConfigValue = (path, defaultValue) => defaultValue;
	plugin.showNotification = jest.fn();
	return plugin;
}

/** 요소나 텍스트 노드가 읽힐 언어 — 가장 가까운 lang 조상의 값 (없으면 null) */
function langOf(node) {
	const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
	const owner = element.closest('[lang]');
	return owner ? owner.getAttribute('lang') : null;
}

/** root 안에서 text를 담은 텍스트 노드를 찾는다 */
function textNode(root, text) {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	while (walker.nextNode()) {
		if (walker.currentNode.data.includes(text)) return walker.currentNode;
	}
	throw new Error(`텍스트를 찾지 못함: ${text}`);
}

const byId = (id) => document.getElementById(id);

beforeEach(() => {
	document.documentElement.setAttribute('lang', 'ko');
	document.body.innerHTML = `
		<div id="watContainer"><button id="opener">열기</button></div>
		<header><h1 id="h-site">사이트 이름</h1></header>
		<main id="main-area" aria-label="본문 영역">
			<h2 id="h-news">새 소식</h2>
			<p><a id="link-guide" href="/guide">이용 안내</a></p>
			<section lang="ja" aria-label="日本語のお知らせ">
				<h2 id="h-ja">お知らせ</h2>
				<a id="link-ja" href="/ja">案内</a>
			</section>
		</main>`;
	// jsdom은 scrollIntoView를 구현하지 않는다
	Element.prototype.scrollIntoView = jest.fn();
	byId('opener').focus();
});

afterEach(() => {
	delete Element.prototype.scrollIntoView;
	document.body.innerHTML = '';
	document.body.className = '';
	document.documentElement.setAttribute('lang', 'en');
});

describe('페이지 구조 대화상자 — 위젯 문구는 위젯 언어로 읽힌다 (WCAG 3.1.2)', () => {
	test('제목·탭·닫기 버튼은 위젯 언어로 읽힌다', () => {
		new PageStructure(makePlugin('en-US')).openPageStructure();
		const layer = byId('pgStructure_layer');

		expect(langOf(byId('page-structure-title'))).toBe('en-US');
		layer.querySelectorAll('[role="tab"]').forEach((tab) => expect(langOf(tab)).toBe('en-US'));
		expect(langOf(layer.querySelector('.btnClose'))).toBe('en-US');
	});

	test('랜드마크 역할명·이동 버튼·링크 아이콘도 위젯 언어로 읽힌다', () => {
		new PageStructure(makePlugin('en-US')).openPageStructure();
		const landmarks = byId('pgStruct_landmark_panel');
		const roleNames = EN.panel.personal.options.pageStructure.landmarks;

		expect(langOf(textNode(landmarks, roleNames.main))).toBe('en-US');
		document.querySelectorAll('#pgStructure_layer .btn_marker').forEach((marker) => expect(langOf(marker)).toBe('en-US'));
		document.querySelectorAll('#pgStructure_layer .img_icon.link').forEach((icon) => expect(langOf(icon)).toBe('en-US'));
	});

	test('언어를 바꾼 뒤 다시 열면 새 위젯 언어를 따른다', () => {
		const plugin = makePlugin('en-US');
		const pageStructure = new PageStructure(plugin);
		pageStructure.openPageStructure();
		pageStructure.closePageStructure();

		plugin.language = 'ja';
		pageStructure.openPageStructure();

		expect(byId('page-structure-title').textContent).toBe(LOCALES.ja.panel.personal.options.pageStructure.title);
		expect(langOf(byId('page-structure-title'))).toBe('ja');
	});
});

describe('페이지 구조 대화상자 — 목록의 페이지 글은 페이지에서 쓰인 언어로 읽힌다', () => {
	test('제목 목록의 글자는 그 제목이 쓰인 언어로 읽힌다', () => {
		new PageStructure(makePlugin('en-US')).openPageStructure();
		const headings = byId('pgStruct_heading_panel');

		expect(langOf(textNode(headings, '새 소식'))).toBe('ko');
		expect(langOf(textNode(headings, 'お知らせ'))).toBe('ja');
	});

	test('랜드마크 이름은 그 영역이 쓰인 언어로 읽힌다', () => {
		new PageStructure(makePlugin('en-US')).openPageStructure();
		const landmarks = byId('pgStruct_landmark_panel');

		expect(langOf(textNode(landmarks, '본문 영역'))).toBe('ko');
		expect(langOf(textNode(landmarks, '日本語のお知らせ'))).toBe('ja');
	});

	test('링크 목록의 글자는 그 링크가 쓰인 언어로 읽힌다', () => {
		new PageStructure(makePlugin('en-US')).openPageStructure();
		const links = byId('pgStruct_link_panel');

		expect(langOf(textNode(links, '이용 안내'))).toBe('ko');
		expect(langOf(textNode(links, '案内'))).toBe('ja');
	});

	test('페이지에 언어 지정이 없으면 목록 글자를 언어 미상(lang="")으로 두어 위젯 언어로 읽히지 않게 한다', () => {
		document.documentElement.removeAttribute('lang');
		new PageStructure(makePlugin('en-US')).openPageStructure();

		expect(langOf(textNode(byId('pgStruct_heading_panel'), '새 소식'))).toBe('');
	});
});

describe('사전 결과 대화상자 — 닫기·발음 라벨은 위젯 언어, 사전 결과는 페이지 언어', () => {
	const item = { title: '사과', description: '사과나무의 열매', pronunciation: '사ː과' };

	function openDictionary(plugin) {
		new Dictionary(plugin).displayDictionResult(item);
		return document.querySelector('.wat-diction-result-layer');
	}

	test('닫기 버튼과 발음 라벨은 위젯 언어로 읽힌다', () => {
		const layer = openDictionary(makePlugin('en-US'));

		expect(langOf(layer.querySelector('button'))).toBe('en-US');
		expect(langOf(layer.querySelector('.wat-diction-pronunciation strong'))).toBe('en-US');
	});

	test('표제어·뜻풀이·발음은 위젯 언어로 바꿔 읽지 않는다', () => {
		const layer = openDictionary(makePlugin('en-US'));

		expect(langOf(textNode(layer, item.title))).toBe('ko');
		expect(langOf(textNode(layer, item.description))).toBe('ko');
		expect(langOf(textNode(layer, item.pronunciation))).toBe('ko');
	});

	test('언어를 바꾼 뒤 다시 열면 새 위젯 언어를 따른다', () => {
		const plugin = makePlugin('en-US');
		openDictionary(plugin);
		plugin.language = 'ja';
		const layer = openDictionary(plugin);

		expect(langOf(layer.querySelector('button'))).toBe('ja');
	});
});

describe('음성 명령 상태창 — 위젯 문구뿐이므로 위젯 언어로 읽힌다', () => {
	function startStatus(plugin) {
		const voiceCommand = new VoiceCommand({ plugin });
		voiceCommand._createStatusDisplay();
		voiceCommand._setState(voiceCommand.states.WAITING);
		return voiceCommand;
	}

	test('상태창을 띄우면 위젯 언어로 읽힌다', () => {
		startStatus(makePlugin('en-US'));

		expect(langOf(byId('wat-voice-status'))).toBe('en-US');
	});

	test('켜 둔 채 위젯 언어를 바꾸면 다음 상태 갱신 때 새 언어로 읽힌다', () => {
		const plugin = makePlugin('en-US');
		const voiceCommand = startStatus(plugin);

		plugin.language = 'ja';
		voiceCommand._setState(voiceCommand.states.LISTENING);

		const status = byId('wat-voice-status');
		expect(status.querySelector('.status-text').textContent).toBe(LOCALES.ja.command.voice.status.listening);
		expect(langOf(status)).toBe('ja');
	});
});
