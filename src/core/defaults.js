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
		},
		// 중증 시각장애 — 이미지 대체텍스트 표시 + 포커스 낭독(TTS) 자동 시작
		visualImpairment: {
			settings: {
				imgDisplayMode: 'convert',
				tts: 'focus'
			},
			enabled: {
				imgDisplayMode: true,
				tts: true
			}
		},
		// 고령자 — 큰 글자·여유 행간·자간, 커서 강조
		senior: {
			settings: {
				fontSize: 'size-1p5x',
				lineHeight: 'size-1p2x',
				letterSpacing: 'wide_little',
				readGuide: 'bigCursor'
			},
			enabled: {
				fontSize: true,
				lineHeight: true,
				letterSpacing: true,
				readGuide: true
			}
		},
		// 움직임 민감(광과민성 발작·전정 장애) — 애니메이션·미디어 정지, 채도 완화
		motionSensitivity: {
			settings: {
				stopAni: 'stop',
				mediaStop: 'stop',
				saturation: 'low'
			},
			enabled: {
				stopAni: true,
				mediaStop: true,
				saturation: true
			}
		},
		// 지체 장애 — 클릭 대상 확대·커서 강조, 음성 명령(STT) 사용 안내
		physicalDisability: {
			settings: {
				screenScale: 'scale-1p2x',
				readGuide: 'bigCursor',
				stt: 'notice'
			},
			enabled: {
				screenScale: true,
				readGuide: true,
				stt: true
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
