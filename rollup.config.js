import resolve from '@rollup/plugin-node-resolve';

const banner = `/**
 * @fileoverview WAT (Web Accessibility Tool) - ModuWeb
 * @version 2.0.0
 * @license Apache-2.0
 * @see https://github.com/Daegu-Cyber-University/ModuWeb
 */`;

export default [
	// 개발용 빌드 (소스맵 포함)
	{
		input: 'src/index.js',
		plugins: [resolve()],
		output: {
			file: 'dist/webAccTools.js',
			format: 'iife',
			name: 'WATPlugin',
			sourcemap: true,
			banner,
		},
	},
	// 프로덕션 빌드 (minify 없이, 가독성 유지)
	{
		input: 'src/index.js',
		plugins: [resolve()],
		output: {
			file: 'dist/webAccTools.min.js',
			format: 'iife',
			name: 'WATPlugin',
			sourcemap: false,
			banner,
		},
	},
];
