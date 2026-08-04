/**
 * @fileoverview CSS ↔ JS 계약 검증
 * JS가 세팅하는 data 속성명과 CSS 셀렉터, 상수 경로와 실제 파일이
 * 어긋나면 스타일이 조용히 죽으므로 회귀를 여기서 잡는다.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Constants } from '../../src/core/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CSS_PATH = join(ROOT, 'dist', 'assets', 'css', 'webAccTools.css');

describe('CSS-JS 계약', () => {
	const css = readFileSync(CSS_PATH, 'utf8');

	test('JS가 쓰지 않는 data-wat-(color-theme|read-guide|screen-scale) 셀렉터가 없어야 한다', () => {
		// JS는 data-color-theme / data-read-guide / data-screen-scale 을 세팅한다
		// (WAT.js dataset.colorTheme, setAttribute('data-read-guide'), dataset.screenScale)
		expect(css).not.toMatch(/data-wat-color-theme/);
		expect(css).not.toMatch(/data-wat-read-guide(?!-mode)/);
		expect(css).not.toMatch(/data-wat-screen-scale/);
	});

	test('Constants.PATHS.CSS_FILE 경로가 실제 CSS 파일과 일치해야 한다', () => {
		expect(existsSync(join(ROOT, 'dist', Constants.PATHS.CSS_FILE))).toBe(true);
	});

	test('CSS_FILE 이 링크 href 부분 문자열 조회(IframeStyler)와 호환되어야 한다', () => {
		// injectCSSToIframe 은 link[href*="<CSS_FILE>"] 로 조회하므로
		// 실제 로드 경로(assets/css/webAccTools.css)가 CSS_FILE 을 포함해야 한다
		const runtimeHref = 'https://example.com/dist/assets/css/webAccTools.css';
		expect(runtimeHref.includes(Constants.PATHS.CSS_FILE)).toBe(true);
	});
});
