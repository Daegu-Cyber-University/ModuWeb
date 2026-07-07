/** @type {import('jest').Config} */
export default {
	// ES 모듈 지원 (package.json "type": "module" 사용 시 .js는 자동으로 ESM)
	testEnvironment: 'jest-environment-jsdom',
	transform: {},

	// 테스트 파일 위치 (네트워크 경로 호환을 위해 testRegex 사용)
	testRegex: 'tests[\\\\/].+\\.test\\.js$',

	// 커버리지 설정
	collectCoverageFrom: [
		'src/**/*.js',
		'!src/index.js',
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],

	// 모듈 경로 매핑
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},

	// 테스트 타임아웃 (5초)
	testTimeout: 5000,

	// 각 테스트 파일 격리 실행
	clearMocks: true,
	restoreMocks: true,
};
