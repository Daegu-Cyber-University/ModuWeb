/**
 * config.example.json을 베이스로 환경 변수(또는 프로젝트 루트 .env)의 값을 반영해 config.json을 생성합니다.
 * 브라우저용 시크릿 주입이 아니라, 배포·로컬 작업용으로 루트 config.json만 갱신합니다.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, isAbsolute } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadDotEnv(filePath) {
	const out = {};
	if (!existsSync(filePath)) {
		return out;
	}
	const text = readFileSync(filePath, 'utf8');
	for (const line of text.split(/\r?\n/)) {
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
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		out[key] = val;
	}
	return out;
}

function envGet(dotenv, name) {
	const v = process.env[name];
	if (v !== undefined && v !== '') {
		return v;
	}
	const d = dotenv[name];
	return d !== undefined && d !== '' ? d : '';
}

const dotenv = loadDotEnv(join(root, '.env'));
const examplePath = join(root, 'config.example.json');
if (!existsSync(examplePath)) {
	console.error('Missing config.example.json at', examplePath);
	process.exit(1);
}

const base = JSON.parse(readFileSync(examplePath, 'utf8'));

const endpoint = envGet(dotenv, 'WAT_DICTIONARY_ENDPOINT');
const timeoutStr = envGet(dotenv, 'WAT_DICTIONARY_TIMEOUT');
const copyright = envGet(dotenv, 'WAT_COPYRIGHT_URL');

if (!endpoint && !timeoutStr && !copyright) {
	console.error(
		'Set at least one of WAT_DICTIONARY_ENDPOINT, WAT_DICTIONARY_TIMEOUT, WAT_COPYRIGHT_URL in .env or the environment.\n' +
			'To copy the sample without env, use: cp config.example.json config.json (or copy on Windows).'
	);
	process.exit(1);
}

if (endpoint) {
	base.api = base.api || {};
	base.api.dictionary = base.api.dictionary || {};
	base.api.dictionary.serverEndpoint = endpoint;
}

if (timeoutStr) {
	const n = Number(timeoutStr);
	if (!Number.isNaN(n) && n > 0) {
		base.api = base.api || {};
		base.api.dictionary = base.api.dictionary || {};
		base.api.dictionary.timeout = n;
	}
}

if (copyright) {
	base.branding = base.branding || {};
	base.branding.copyrightUrl = copyright;
}

let outPath = envGet(dotenv, 'WAT_CONFIG_OUTPUT');
if (!outPath) {
	outPath = join(root, 'config.json');
} else if (!isAbsolute(outPath)) {
	outPath = join(root, outPath);
}

writeFileSync(outPath, JSON.stringify(base, null, '\t') + '\n', 'utf8');
console.log('Wrote', outPath);
