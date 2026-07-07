/**
 * @fileoverview CSS 셀렉터 감사 — 도구 CSS가 호스트 페이지로 새는(wat 비접두) 셀렉터 검출
 * @description webAccTools.css의 최상위 셀렉터를 검사해 wat 접두/식별자가 없는
 *              셀렉터를 보고한다. 의도적 전역 규칙(고대비 테마, 오버레이 등)은
 *              allowlist(css-selector-allowlist.json)로 관리 — 새 누수만 실패 처리.
 * 사용: node scripts/check-css-selectors.mjs [--update-allowlist]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_FILE = path.join(__dirname, '../dist/assets/css/webAccTools.css');
const ALLOWLIST_FILE = path.join(__dirname, 'css-selector-allowlist.json');

let css = fs.readFileSync(CSS_FILE, 'utf8');

// 주석 제거
css = css.replace(/\/\*[\s\S]*?\*\//g, '');
// @media 등 at-rule 껍데기 제거 (내부 규칙은 유지)
css = css.replace(/@[a-z-]+[^{]*\{/g, '');

// 규칙 셀렉터 추출: '{' 앞의 텍스트 (선언 블록/닫는 중괄호 제외)
const selectors = [];
for (const match of css.matchAll(/(^|\})\s*([^{}]+?)\s*\{/g)) {
	const group = match[2].trim();
	if (!group) continue;
	for (const sel of group.split(',')) {
		const s = sel.trim();
		if (s) selectors.push(s);
	}
}

/** 도구 스코프로 볼 수 있는 셀렉터인지 — wat 식별자·데이터 속성 포함 여부 */
function isScoped(selector) {
	const lower = selector.toLowerCase();
	return lower.includes('wat') ||            // #watWrap, .wat-*, [data-wat-*] 등
		lower.includes('pgstruct') ||          // 페이지 구조 다이얼로그
		lower.includes('data-');               // html[data-color-theme] 등 도구 상태 속성
}

const allowlist = fs.existsSync(ALLOWLIST_FILE)
	? JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8'))
	: [];

const leaking = [...new Set(selectors.filter(s => !isScoped(s)))];
const newLeaks = leaking.filter(s => !allowlist.includes(s));
const resolved = allowlist.filter(s => !leaking.includes(s));

if (process.argv.includes('--update-allowlist')) {
	fs.writeFileSync(ALLOWLIST_FILE, JSON.stringify(leaking.sort(), null, '\t') + '\n');
	console.log(`allowlist 갱신: ${leaking.length}개 셀렉터 기록`);
	process.exit(0);
}

console.log(`검사한 셀렉터: ${selectors.length}개, wat 비접두: ${leaking.length}개 (allowlist ${allowlist.length}개)`);
if (resolved.length > 0) {
	console.log(`ℹ️ allowlist에 있으나 더 이상 존재하지 않는 셀렉터 ${resolved.length}개 — --update-allowlist로 정리 가능`);
}
if (newLeaks.length > 0) {
	console.error('❌ 새로운 wat 비접두 셀렉터 발견 — 호스트 페이지 스타일 오염 위험:');
	newLeaks.forEach(s => console.error(`   ${s}`));
	console.error('의도적 전역 규칙이면 --update-allowlist로 승인하세요.');
	process.exit(1);
}
console.log('✅ 새로운 누수 셀렉터 없음');
