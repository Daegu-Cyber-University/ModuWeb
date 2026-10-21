/**
 * @fileoverview 위젯 자체 컨트롤의 포커스 표시 계약 (WCAG 2.4.7)
 * @description
 *   아이콘 보기(기본값)·축소 상태의 라디오는 opacity 0·1px로 숨기고 포커스를 짝 label의 outline으로 그린다.
 *   label을 감싼 li.opt_item.selectOn·ul.opt_lists는 label과 같은 크기에 overflow:hidden이라
 *   label 바깥으로 나가는 outline(양수 outline-offset)은 잘려서 보이지 않는다.
 *   jsdom은 레이아웃·클리핑을 계산하지 않으므로 CSS 규칙 계약으로 검증하고, 실제 렌더링은 브라우저에서 확인한다.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, '..', '..', 'dist', 'assets', 'css', 'webAccTools.css');
const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** 셀렉터 목록을 최상위 쉼표로만 나눈다 (:is(a, b) 안의 쉼표는 구분자가 아님) */
function splitSelectors(group) {
	const out = [];
	let buf = '';
	let depth = 0;
	for (const ch of group) {
		if (ch === '(' || ch === '[') depth++;
		else if (ch === ')' || ch === ']') depth--;
		else if (ch === ',' && depth === 0) {
			out.push(buf);
			buf = '';
			continue;
		}
		buf += ch;
	}
	out.push(buf);
	return out.map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

/** CSS의 모든 규칙을 { selectors, body } 목록으로 반환 (@media 내부 규칙 포함) */
function rules() {
	return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
		selectors: splitSelectors(m[1].replace(/^[\s\S]*@[a-z-]+[^{]*$/, '')),
		body: m[2]
	}));
}

/** 셀렉터 목록에 target이 들어 있는 규칙들의 선언을 이어 붙여 반환 */
function declarationsFor(target) {
	return rules()
		.filter((rule) => rule.selectors.includes(target))
		.map((rule) => rule.body)
		.join(';');
}

const ICON = ':is(html[data-wat-viewmode="icon"], .wat-minimized) #wat .setWrap.radio .setCont';

describe('아이콘 보기·축소 상태 — 라디오 포커스 링이 조상의 overflow에 잘리지 않는다', () => {
	test('포커스를 그리는 label을 감싼 목록과 선택 항목은 넘치는 부분을 잘라 낸다 (전제)', () => {
		// 이 전제가 바뀌면(잘라 내지 않으면) 아래 계약도 다시 따져야 한다
		expect(declarationsFor(`${ICON} .opt_lists`)).toMatch(/overflow:\s*hidden/);
		expect(declarationsFor(`${ICON} .opt_lists .opt_item.selectOn`)).toMatch(/overflow:\s*hidden/);
	});

	test('포커스 표시는 label 안쪽에 그린다 — 음수 outline-offset이나 inset 그림자', () => {
		const focus = declarationsFor(`${ICON} input[type="radio"]:focus-visible + label`);
		const offset = focus.match(/outline-offset:\s*(-?[\d.]+)px/);
		const width = focus.match(/outline:\s*([\d.]+)px/);
		const insetShadow = /box-shadow:\s*inset\s+0\s+0\s+0\s+[1-9]/.test(focus);
		// outline이 label 테두리 안쪽에 완전히 들어오려면 offset ≤ -width 여야 한다
		const outlineInside = offset !== null && width !== null && Number(offset[1]) <= -Number(width[1]);
		expect(outlineInside || insetShadow).toBe(true);
	});
});
