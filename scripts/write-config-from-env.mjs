/**
 * config.example.json을 베이스로 환경 변수(또는 프로젝트 루트 .env)의 값을 반영해 config.json을 생성합니다.
 * 브라우저용 시크릿 주입이 아니라, 배포·로컬 작업용으로 루트 config.json만 갱신합니다.
 *
 * ⚠️ config.json은 운영 사이트에서 브라우저가 fetch하는 **공개 파일**입니다.
 *    비밀키·토큰은 절대 넣을 수 없으며(아래 비밀키 가드가 거부), 외부 API 키는
 *    서버 프록시(serverEndpoint 패턴) 뒤에만 두세요 — README '사전 API 계약' 참고.
 *
 * 사용법:
 *   node scripts/write-config-from-env.mjs               # 수동(엄격): 변수 없으면 실패
 *   node scripts/write-config-from-env.mjs --if-present  # 빌드 훅(soft): 변수 없으면 건너뜀
 *
 * 새 설정 항목 추가 방법: 아래 MAPPINGS 테이블에 한 줄만 추가하면 됩니다.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, isAbsolute, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/**
 * env 변수 → config 경로 선언적 매핑 테이블.
 * type: 'string' | 'number'(양수) | 'boolean'(true/false/1/0) | 'url'(http/https만)
 */
export const MAPPINGS = [
	{ env: 'WAT_DICTIONARY_ENABLED', path: 'api.dictionary.enabled', type: 'boolean', note: '사전 기능 켬/끔' },
	{ env: 'WAT_DICTIONARY_ENDPOINT', path: 'api.dictionary.serverEndpoint', type: 'url', note: '사전 서버 프록시 URL (런타임은 https만 허용)' },
	{ env: 'WAT_DICTIONARY_TIMEOUT', path: 'api.dictionary.timeout', type: 'number', note: '사전 요청 타임아웃(ms)' },
	{ env: 'WAT_FONT_NANUM_MYEONGJO', path: 'resources.fonts.nanumMyeongjo', type: 'url', note: '나눔명조 웹폰트 URL' },
	{ env: 'WAT_FONT_NOTO_SERIF_KR', path: 'resources.fonts.notoSerifKR', type: 'url', note: 'Noto Serif KR 웹폰트 URL' },
	{ env: 'WAT_FONT_KODDI_UD_GOTHIC', path: 'resources.fonts.koddiUdonGothic', type: 'url', note: 'Koddi UD 고딕 웹폰트 URL' },
	{ env: 'WAT_COPYRIGHT_URL', path: 'branding.copyrightUrl', type: 'url', note: '저작권 표기 링크' },
	{ env: 'WAT_MODAL_WIDTH', path: 'settings.ui.modalWidth', type: 'number', note: '사전 모달 최대 폭(px)' },
	{ env: 'WAT_SHOW_PRONUNCIATION', path: 'settings.ui.showPronunciation', type: 'boolean', note: '사전 발음 표기 여부' }
];

/** 매핑 외 허용되는 메타 변수 (config 값이 아님) */
export const META_VARS = new Set(['WAT_CONFIG_OUTPUT']);

/**
 * .env 파일 텍스트를 파싱합니다 (dotenv 미사용 — 직접 파싱).
 * 따옴표 값·인라인 주석(공백+#)·CRLF·빈 줄/주석 줄을 처리합니다.
 * @param {string} text - .env 파일 내용
 * @returns {Object.<string,string>} 키-값 맵
 */
export function parseDotEnvText(text) {
	const out = {};
	for (const line of String(text).split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const eq = trimmed.indexOf('=');
		if (eq === -1) {
			continue;
		}
		const key = trimmed.slice(0, eq).trim();
		let val = trimmed.slice(eq + 1).trim();
		if (val.startsWith('"') || val.startsWith("'")) {
			// 따옴표로 감싼 값: 닫는 따옴표까지가 값, 그 뒤 인라인 주석은 무시
			const quote = val[0];
			const end = val.indexOf(quote, 1);
			if (end !== -1) {
				val = val.slice(1, end);
			}
		} else {
			// 인라인 주석 제거 (공백 + # 이후 절삭)
			const hash = val.search(/\s#/);
			if (hash !== -1) {
				val = val.slice(0, hash).trim();
			}
		}
		out[key] = val;
	}
	return out;
}

/**
 * 변수 값을 조회합니다. process.env 우선, 다음 .env — 빈 문자열은 미설정으로 취급.
 * @param {Object} processEnv - process.env
 * @param {Object} dotenv - parseDotEnvText 결과
 * @param {string} name - 변수명
 * @returns {string} 값 (미설정이면 '')
 */
export function resolveVar(processEnv, dotenv, name) {
	const v = processEnv[name];
	if (v !== undefined && v !== '') {
		return v;
	}
	const d = dotenv[name];
	return d !== undefined && d !== '' ? d : '';
}

/**
 * 문자열 값을 매핑 타입으로 변환·검증합니다.
 * @param {string} type - 'string' | 'number' | 'boolean' | 'url'
 * @param {string} raw - 원본 문자열
 * @returns {{ok: boolean, value?: *, error?: string}}
 */
export function coerceValue(type, raw) {
	switch (type) {
		case 'number': {
			const n = Number(raw);
			if (Number.isNaN(n) || n <= 0) {
				return { ok: false, error: `양수가 아닙니다: "${raw}"` };
			}
			return { ok: true, value: n };
		}
		case 'boolean': {
			const s = String(raw).trim().toLowerCase();
			if (s === 'true' || s === '1') return { ok: true, value: true };
			if (s === 'false' || s === '0') return { ok: true, value: false };
			return { ok: false, error: `true/false/1/0 이 아닙니다: "${raw}"` };
		}
		case 'url': {
			// 런타임 isSafeHttpUrl과 동일 기준: http/https 스킴만 허용
			try {
				const u = new URL(raw);
				if (u.protocol !== 'http:' && u.protocol !== 'https:') {
					return { ok: false, error: `http/https URL이 아닙니다: "${raw}"` };
				}
				return { ok: true, value: raw };
			} catch (e) {
				return { ok: false, error: `URL 형식이 아닙니다: "${raw}"` };
			}
		}
		default:
			return { ok: true, value: raw };
	}
}

/**
 * dot-notation 경로로 객체에 값을 설정합니다. 프로토타입 오염 세그먼트는 거부합니다.
 * @param {Object} obj - 대상 객체 (제자리 수정)
 * @param {string} path - 'a.b.c' 형식 경로
 * @param {*} value - 설정할 값
 * @returns {boolean} 성공 여부 (오염 세그먼트 포함 시 false)
 */
export function setByPath(obj, path, value) {
	const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
	const segs = path.split('.');
	if (segs.some(s => FORBIDDEN.has(s))) {
		return false;
	}
	let cur = obj;
	for (let i = 0; i < segs.length - 1; i++) {
		if (typeof cur[segs[i]] !== 'object' || cur[segs[i]] === null) {
			cur[segs[i]] = {};
		}
		cur = cur[segs[i]];
	}
	cur[segs[segs.length - 1]] = value;
	return true;
}

/**
 * 베이스 config에 MAPPINGS의 해석된 env 값을 적용해 새 config를 만듭니다.
 * @param {Object} base - config.example.json 파싱 결과 (변형하지 않음 — 딥카피 사용)
 * @param {function(string): string} resolver - 변수명 → 값('' = 미설정)
 * @returns {{config: Object, appliedCount: number, warnings: string[]}}
 */
export function buildConfig(base, resolver) {
	const config = JSON.parse(JSON.stringify(base));
	const warnings = [];
	let appliedCount = 0;

	for (const m of MAPPINGS) {
		const raw = resolver(m.env);
		if (!raw) continue;

		const coerced = coerceValue(m.type, raw);
		if (!coerced.ok) {
			warnings.push(`${m.env} 무시됨 — ${coerced.error}`);
			continue;
		}
		// 사전 엔드포인트는 런타임(Dictionary.js)이 https만 수용하므로 http면 경고
		if (m.env === 'WAT_DICTIONARY_ENDPOINT' && /^http:/i.test(raw)) {
			warnings.push(`${m.env}: http URL은 런타임에서 거부됩니다(https 전용) — 값은 기록하지만 동작하지 않습니다`);
		}
		if (setByPath(config, m.path, coerced.value)) {
			appliedCount++;
		} else {
			warnings.push(`${m.env} 무시됨 — 잘못된 config 경로: ${m.path}`);
		}
	}

	return { config, appliedCount, warnings };
}

/**
 * 비밀키처럼 보이는 변수명을 찾습니다 — config.json은 공개 파일이므로 거부 대상.
 * @param {string[]} keys - 검사할 변수명 목록
 * @returns {string[]} 비밀키형 변수명 목록
 */
export function findSecretLikeKeys(keys) {
	const SECRET_RE = /(API_?KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL)/i;
	return keys.filter(k => SECRET_RE.test(k));
}

/**
 * WAT_ 접두인데 매핑에도 메타에도 없는 변수(오타 후보)를 찾습니다.
 * @param {string[]} keys - 검사할 변수명 목록
 * @returns {string[]} 미매핑 WAT_ 변수 목록
 */
export function findUnmappedWatKeys(keys) {
	const known = new Set(MAPPINGS.map(m => m.env));
	return keys.filter(k => k.startsWith('WAT_') && !known.has(k) && !META_VARS.has(k));
}

// ─────────────────────────────────────────────────────────────
// main — 파일 I/O·exit 담당 (jest에서 import 시 실행되지 않음)
// ─────────────────────────────────────────────────────────────
function main() {
	const ifPresent = process.argv.includes('--if-present');

	const dotenvPath = join(root, '.env');
	const dotenv = existsSync(dotenvPath) ? parseDotEnvText(readFileSync(dotenvPath, 'utf8')) : {};
	const resolver = (name) => resolveVar(process.env, dotenv, name);

	// 1) 비밀키 가드 — 모드 무관 거부.
	//    검사 범위: .env의 모든 키 + process.env 중 WAT_ 접두 키 (CI의 GITHUB_TOKEN 등 오탐 방지)
	const candidateKeys = [
		...Object.keys(dotenv),
		...Object.keys(process.env).filter(k => k.startsWith('WAT_'))
	];
	const secretLike = findSecretLikeKeys(candidateKeys);
	if (secretLike.length > 0) {
		console.error(
			`🚫 비밀키로 보이는 변수 발견: ${[...new Set(secretLike)].join(', ')}\n` +
			'   config.json은 브라우저에 그대로 배포되는 공개 파일입니다 — 비밀키·토큰을 넣을 수 없습니다.\n' +
			'   외부 API 키는 서버 프록시(serverEndpoint 패턴) 안에서만 사용하세요. (README "사전 API 계약" 참고)'
		);
		process.exit(1);
	}

	// 2) 오타 후보 경고
	for (const k of new Set(findUnmappedWatKeys(Object.keys(dotenv)))) {
		console.warn(`⚠️ 매핑되지 않은 변수 ${k} — 무시됩니다 (.env.example의 변수 목록 참고)`);
	}

	// 3) 베이스 로드
	const examplePath = join(root, 'config.example.json');
	if (!existsSync(examplePath)) {
		console.error('Missing config.example.json at', examplePath);
		process.exit(1);
	}
	const base = JSON.parse(readFileSync(examplePath, 'utf8'));

	// 4) 적용
	const { config, appliedCount, warnings } = buildConfig(base, resolver);
	for (const w of warnings) {
		console.warn(`⚠️ ${w}`);
	}

	// 5) 해석된 변수가 하나도 없을 때 — 모드에 따라 분기
	if (appliedCount === 0) {
		if (ifPresent) {
			// 빌드 훅(soft): 기존 config.json을 건드리지 않고 조용히 통과
			console.log('ℹ️ WAT_* 설정 변수 없음 — config.json 생성 건너뜀 (기존 파일 유지)');
			return;
		}
		console.error(
			'다음 중 하나 이상을 .env 또는 환경 변수로 설정하세요:\n' +
			`  ${MAPPINGS.map(m => m.env).join(', ')}\n` +
			'env 없이 샘플을 그대로 쓰려면: cp config.example.json config.json (Windows는 copy)'
		);
		process.exit(1);
	}

	// 6) 출력
	let outPath = resolver('WAT_CONFIG_OUTPUT');
	if (!outPath) {
		outPath = join(root, 'config.json');
	} else if (!isAbsolute(outPath)) {
		outPath = join(root, outPath);
	}
	writeFileSync(outPath, JSON.stringify(config, null, '\t') + '\n', 'utf8');
	console.log(`Wrote ${outPath} (.env 반영 변수 ${appliedCount}개)`);
}

// node로 직접 실행됐을 때만 main 수행 (jest import 시 부작용 없음)
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	main();
}
