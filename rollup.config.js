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

const pluginsDev = [resolve(), injectModuwebVersion(version)];

export default [
	// 개발·디버깅용 (소스맵 포함, 비압축)
	{
		input: 'src/index.js',
		plugins: pluginsDev,
		output: {
			file: 'dist/webAccTools.js',
			format: 'iife',
			name: 'WATPlugin',
			sourcemap: true,
			banner,
		},
	},
	// 배포용 (Terser 압축·맹글) — 파일명 .min.js와 실제 minify 일치
	{
		input: 'src/index.js',
		plugins: [
			...pluginsDev,
			terser({
				compress: true,
				mangle: true,
				format: {
					comments: false,
				},
			}),
		],
		output: {
			file: 'dist/webAccTools.min.js',
			format: 'iife',
			name: 'WATPlugin',
			sourcemap: false,
			banner,
		},
	},
];
