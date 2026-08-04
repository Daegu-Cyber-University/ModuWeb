/**
 * @fileoverview WAT 전역 상수 정의
 * @module src/core/constants
 */

/**
 * Plugin-wide constants and identifiers
 */
export class Constants {
	static STORAGE_KEYS = {
		SETTINGS: 'watSettings',
		CONTAINER: 'watContainer',
		SELECTED_PROFILE: 'selectedProfile',
		PANEL_STATE: 'watPanelState'
	};

	static ELEMENT_IDS = {
		LANGUAGE_SETTING_WRAP: 'watSetWrap_language',
		PANEL_SET: 'wat_panel_Set',
		PANEL_OPT: 'wat_panel_Opt',
		BTN_SET: 'wat_settingLink',
		MAIN_WRAP: 'wat',
		TTS_SPEED_CTRL: 'ctrl_ttsSpeed',
		TTS_SPEED_DISPLAY: 'ttsSpeed_display',
		TTS_TOGGLE_BTN: 'wat-button-tts_toggle',
		TTS_NEXT_BTN: 'wat-button-tts_next',
		TTS_PREV_BTN: 'wat-button-tts_prev',
		TTS_FOCUS_TOGGLE_BTN: 'wat-button-tts_focus_toggle'
	};

	static CSS_CLASSES = {
		ACTIVE: 'active',
		SELECTED: 'selected'
	};

	static TIMING = {
		SCROLL_STEP: 300,
		NOTIFICATION_DURATION: 3000
	};

	static PERFORMANCE = {
		BATCH_SIZE: 50,
		CACHE_MAX_AGE: 5000,
		BASE_WIDTH: 500
	};

	static PATHS = {
		LOCALES: 'assets/locales/',
		IMAGES: 'assets/images/',
		CSS_FILE: 'assets/webAccTools.css'
	};

	static DOM_SELECTORS = {
		NOTIFICATION_AND_TTS: '.wat-notification, .wat-tts_wrapper',
		TAB_BUTTONS: 'li button',
		WAT_APPLY_ELEMENTS: '.wat-apply',
		EXCLUDE_ELEMENTS: '.wat-exclude'
	};

	static LOG_PREFIXES = {
		ERROR: '[WAT] Error:',
		WARN: '[WAT] Warning:',
		INFO: '[WAT] Info:',
		DEBUG: '[WAT] Debug:'
	};
}

/**
 * Available font family options
 * config.json의 resources.fonts 값으로 url이 런타임에 덮어써집니다.
 */
export const FONT_FAMILY_OPTIONS = {
	initial: {
		label: '기본 폰트',
		fontFamily: '',
		enabled: true
	},
	'nanum-myeongjo': {
		label: 'Nanum Myeongjo',
		fontFamily: 'Nanum Myeongjo, serif',
		url: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap',
		enabled: true
	},
	'noto-serif-kr': {
		label: 'Noto Serif KR',
		fontFamily: 'Noto Serif KR, serif',
		url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@200..900&display=swap',
		enabled: true
	},
	'koddi-udon-gothic': {
		label: 'Koddi Udon Gothic',
		fontFamily: '"Koddi Udon Gothic", sans-serif',
		url: null,
		enabled: true
	}
};
