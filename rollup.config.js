import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const { version } = pkg;

const banner = `/**
 * @fileoverview WAT (Web Accessibility Tool) - ModuWeb
 * @version ${version}
 * @license Apache-2.0
 * @see https://github.com/Daegu-Cyber-University/ModuWeb
 */`;

/**
 * standalone 번들용 인라인 자산 가상 모듈 (virtual:wat-inline-assets)
 * - CSS: dist/assets/css/webAccTools.css 를 읽고 url(../images/*)를 data URI로 재작성
 * - koLocale: dist/assets/locales/ko.json (기본 언어만 임베드 — 타 언어는 온라인 시 fetch)
 * - imageMap: JS 코드가 basePath로 참조하는 이미지들의 data URI 맵 (WAT._assetUrl이 조회)
 */
function inlineAssets() {
	const VIRTUAL_ID = 'virtual:wat-inline-assets';
	const RESOLVED_ID = '\0' + VIRTUAL_ID;

	// 텍스트 자산은 LF로 정규화해서 읽는다 — CRLF 체크아웃(Windows)과 LF 체크아웃(CI)이
	// 서로 다른 번들을 만들어 dist 드리프트 게이트가 깨지는 것을 막는다.
	// CRLF뿐 아니라 단독 CR(구식 Mac)도 LF로 통일한다.
	const readTextLF = (filePath) => fs.readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n');

	const toDataUri = (filePath) => {
		const ext = path.extname(filePath).slice(1).toLowerCase();
		const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
		// SVG는 텍스트라 Windows에서 CRLF로 체크아웃된다. raw 바이트를 그대로 base64로
		// 인코딩하면 개행 차이가 data URI에 그대로 반영돼 번들이 플랫폼마다 달라진다.
		// (PNG 등 바이너리는 정규화하면 깨지므로 그대로 읽는다.)
		const buf = ext === 'svg'
			? Buffer.from(readTextLF(filePath), 'utf8')
			: fs.readFileSync(filePath);
		return `data:${mime};base64,${buf.toString('base64')}`;
	};

	return {
		name: 'wat-inline-assets',
		resolveId(id) {
			if (id === VIRTUAL_ID) return RESOLVED_ID;
			return null;
		},
		load(id) {
			if (id !== RESOLVED_ID) return null;

			const imagesDir = path.join(__dirname, 'dist/assets/images');

			// CSS의 상대 이미지 참조를 data URI로 재작성 (인라인 <style>은 페이지 URL 기준이라 상대 경로가 깨짐)
			let css = readTextLF(path.join(__dirname, 'dist/assets/css/webAccTools.css'));
			const missing = [];
			css = css.replace(/url\((['"]?)\.\.\/images\/([^'")]+)\1\)/g, (match, _quote, file) => {
				const filePath = path.join(imagesDir, file);
				if (!fs.existsSync(filePath)) {
					missing.push(file);
					return match;
				}
				return `url("${toDataUri(filePath)}")`;
			});
			if (missing.length > 0) {
				this.warn(`wat-inline-assets: CSS가 참조하는 이미지 누락 — ${missing.join(', ')}`);
			}

			const koLocaleJson = readTextLF(path.join(__dirname, 'dist/assets/locales/ko.json'));

			// JS(WAT._assetUrl)가 참조하는 이미지 — 소스에서 사용처가 늘면 여기에 추가
			const jsImageFiles = ['icon_image.png', 'icon_pgStructure_marker.svg', 'icon_pgStructure_link.svg'];
			const imageMap = {};
			for (const file of jsImageFiles) {
				imageMap[`assets/images/${file}`] = toDataUri(path.join(imagesDir, file));
			}

			return [
				`export const inlineCss = ${JSON.stringify(css)};`,
				`export const koLocale = ${koLocaleJson};`,
				`export const imageMap = ${JSON.stringify(imageMap)};`,
			].join('\n');
		},
	};
}

function injectModuwebVersion(ver) {
	const json = JSON.stringify(ver);
	return {
		name: 'inject-moduweb-version',
		transform(code, id) {
			if (!id.endsWith('.js') || id.includes('node_modules')) return null;
			if (!code.includes('__MODUWEB_VERSION')) return null;
			return code.replaceAll('__MODUWEB_VERSION_JSON__', json).replaceAll('__MODUWEB_VERSION__', ver);
		},
	};
}

const plugins = [resolve(), injectModuwebVersion(version)];

export default [
	// 개발용 빌드 (소스맵 포함)
	{
		input: 'src/index.js',
		plugins,
		output: {
			file: 'dist/webAccTools.js',
			format: 'iife',
			name: 'WATPlugin',
			sourcemap: true,
			banner,
		},
	},
	// 프로덕션 빌드 (terser로 실제 minify — 이전에는 이름만 min이었음)
	{
		input: 'src/index.js',
		plugins,
		output: {
			file: 'dist/webAccTools.min.js',
			format: 'iife',
			name: 'WATPlugin',
			sourcemap: false,
			banner,
			plugins: [terser({ format: { comments: /@license|@version/ } })],
		},
	},
	// standalone 빌드 — CSS·ko 로케일·이미지를 인라인한 단일 파일 (폐쇄망/오프라인, 파일 1개 복사 배포)
	{
		input: 'src/standalone.js',
		plugins: [...plugins, inlineAssets()],
		output: {
			file: 'dist/webAccTools.standalone.min.js',
			format: 'iife',
			name: 'WATPlugin',
			sourcemap: false,
			banner,
			plugins: [terser({ format: { comments: /@license|@version/ } })],
		},
	},
];
