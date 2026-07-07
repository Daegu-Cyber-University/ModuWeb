/**
 * @fileoverview WAT 기본값 정의
 * @module src/core/defaults
 */

export class Defaults {
	static SETTINGS = {
		fontSize: 'initial',
		fontFamily: 'initial',
		screenScale: 'initial',
		txtAlign: 'initial',
		letterSpacing: 'initial',
		lineHeight: 'initial',
		colorTheme: 'initial',
		saturation: 'initial',
		readGuide: 'unset',
		imgDisplayMode: 'initial',
		viewMode: 'icon',
		toolPosition: 'right',
		language: 'ko'
	};

	static PROFILES = {
		lowVision: {
			settings: {
				fontSize: 'size-1p5x',
				fontFamily: 'koddi-udon-gothic',
				letterSpacing: 'wide_normal'
			},
			enabled: {
				fontSize: true,
				fontFamily: true,
				letterSpacing: true
			}
		},
		colorBlindness: {
			settings: {
				saturation: 'high'
			},
			enabled: {
				saturation: true
			}
		},
		dyslexia: {
			settings: {
				fontFamily: 'koddi-udon-gothic',
				lineHeight: 'size-2x',
				readGuide: 'mask'
			},
			enabled: {
				fontFamily: true,
				lineHeight: true,
				readGuide: true
			}
		}
	};

	static OPTIONS = {
		containerSelector: 'body',
		language: 'ko',
		autoInit: true,
		enableKeyboardNavigation: true,
		enableTooltips: true
	};
}
