/**
 * @fileoverview 열기 버튼의 접근 이름 — 무엇을 여는지 드러나야 한다 (WCAG 2.4.6)
 * @description 페이지 어디서든 탭으로 만나는 열기 버튼의 이름이 '열기'뿐이라, 스크린리더 사용자는
 *              무엇을 여는 버튼인지 알 수 없었다. 실제 로케일 파일 6종으로 버튼을 만들어 확인한다.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WAT } from '../../src/wat/WAT.js';
import { StateManager } from '../../src/wat/StateManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', '..', 'dist', 'assets', 'locales');
const readLocale = (lang) => JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8'));
const LANGS = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

/** 해당 로케일로 열기 버튼을 만든다 */
function createOpenButton(lang) {
	const wat = Object.create(WAT.prototype);
	wat.state = new StateManager({ locale: readLocale(lang) });
	wat.container = document.createElement('div');
	return wat._createOpenButton().querySelector('#wat_btnOpen');
}

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('열기 버튼 이름', () => {
	test('한국어: "웹 접근성 지원 도구 열기"', () => {
		const button = createOpenButton('ko');

		expect(button.getAttribute('aria-label')).toBe('웹 접근성 지원 도구 열기');
		expect(button.getAttribute('title')).toBe('웹 접근성 지원 도구 열기');
	});

	test.each(LANGS)('%s: 이름에 도구 이름이 들어가고 "열기" 한 단어로 끝나지 않는다', (lang) => {
		const locale = readLocale(lang);
		const name = createOpenButton(lang).getAttribute('aria-label');

		expect(name).toContain(locale.toolTitle);
		expect(name).not.toBe(locale.command.open);
	});
});
