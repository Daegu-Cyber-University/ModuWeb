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
];
