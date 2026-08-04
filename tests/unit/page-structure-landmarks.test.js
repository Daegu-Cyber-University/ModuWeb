/**
 * @fileoverview PageStructure 랜드마크 수집·탭 패널 동작 테스트
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { PageStructure } from '../../src/wat/PageStructure.js';

function makeStub() {
	const ps = Object.create(PageStructure.prototype);
	ps.plugin = {
		selector: '#watContainer',
		getLocalizedText: jest.fn((key) => `[${key}]`),
		_assetUrl: jest.fn((path) => `/${path}`)
	};
	return ps;
}

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('PageStructure._collectLandmarks', () => {
	test('시맨틱 태그와 role 속성을 랜드마크로 수집한다 (문서 순서)', () => {
		document.body.innerHTML = `
			<header><h1>사이트</h1></header>
			<nav aria-label="주 메뉴"></nav>
			<main><p>본문</p></main>
			<div role="search"></div>
			<aside></aside>
			<footer></footer>`;
		const stub = makeStub();
		const landmarks = stub._collectLandmarks();

		expect(landmarks.map(l => l.role)).toEqual(
			['banner', 'navigation', 'main', 'search', 'complementary', 'contentinfo']);
		expect(landmarks[1].label).toBe('주 메뉴');
	});

	test('섹셔닝 내부의 header/footer는 랜드마크가 아니다', () => {
		document.body.innerHTML = `
			<header id="page-header"></header>
			<article><header id="article-header"></header></article>`;
		const stub = makeStub();
		const landmarks = stub._collectLandmarks();

		expect(landmarks).toHaveLength(1);
		expect(landmarks[0].element.id).toBe('page-header');
	});

	test('이름 없는 section/form은 제외하고, 이름이 있으면 포함한다', () => {
		document.body.innerHTML = `
			<section></section>
			<section aria-label="공지"></section>
			<form></form>
			<h2 id="form-title">검색</h2>
			<form aria-labelledby="form-title"></form>`;
		const stub = makeStub();
		const landmarks = stub._collectLandmarks();

		expect(landmarks.map(l => `${l.role}:${l.label}`)).toEqual(['region:공지', 'form:검색']);
	});

	test('도구 자신(.wat-exclude/컨테이너)과 숨김 요소는 제외한다', () => {
		document.body.innerHTML = `
			<div id="watContainer"><aside id="widget-aside"></aside></div>
			<nav class="wat-exclude" id="widget-nav"></nav>
			<div hidden><nav id="hidden-nav"></nav></div>
			<main id="visible-main"></main>`;
		const stub = makeStub();
		const landmarks = stub._collectLandmarks();

		expect(landmarks.map(l => l.element.id)).toEqual(['visible-main']);
	});
});

describe('PageStructure.createTabPanel (landmark)', () => {
	test('랜드마크 탭 패널에 역할명·라벨 목록이 만들어진다', () => {
		document.body.innerHTML = '<nav aria-label="주 메뉴"></nav><main></main>';
		const stub = makeStub();
		const panel = stub.createTabPanel({ id: 'pgStruct_landmark' }, 0);

		const items = panel.querySelectorAll('.pgStruct_item.landmark');
		expect(items).toHaveLength(2);
		expect(items[0].textContent).toContain('navigation — 주 메뉴');
		expect(items[1].textContent).toContain('main');
		// 위치 이동 마커 버튼 포함
		expect(items[0].querySelector('.btn_marker')).not.toBeNull();
	});
});
