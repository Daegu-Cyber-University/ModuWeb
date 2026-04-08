/**
 * @fileoverview WAT 유효성 검증 규칙 정의
 * @module src/core/validation
 */

export class Validation {
	static FONT_SIZE_RANGE = {
		min: 0.8,
		max: 2.0,
		step: 0.1
	};

	static SCALE_RANGE = {
		min: 0.5,
		max: 2.0,
		step: 0.1
	};

	static REQUIRED_ELEMENTS = [
		'watContainer',
		'watMainPnl',
		'watSubPnl'
	];

	static VALID_THEMES = [
		'initial',
		'dark',
		'high-contrast',
		'blue-light'
	];
}
