/**
 * @fileoverview OptionsProcessor - 다양한 옵션 설정 처리 유틸리티
 * @module src/core/OptionsProcessor
 */
import { Localization } from './localization.js';

export class OptionsProcessor {
	/**
	 * Processes ratio-based options (fontSize, lineHeight, letterSpacing, screenScale)
	 * @param {Object} defaultRatios - Default ratio configuration
	 * @param {Object} customOptions - Custom options to merge/override
	 * @returns {Object} Processed ratio configuration
	 */
	static processRatioOptions(defaultRatios, customOptions) {
		if (!customOptions) return { ...defaultRatios };

		const result = { ...defaultRatios };
		for (const [key, config] of Object.entries(customOptions)) {
			if (config === false) {
				delete result[key];
			} else if (typeof config === 'number') {
				// 유한한 양수만 허용 - NaN/Infinity/0 이하 값은 건너뜀
				if (Number.isFinite(config) && config > 0) {
					result[key] = config;
				} else {
					console.warn(`[WAT:OptionsProcessor] 유효하지 않은 ratio 값을 건너뜁니다: ${key} = ${config}`);
				}
			} else if (config !== null && typeof config === 'object') {
				// null 가드 - typeof null === 'object' 이므로 반드시 확인
				if (typeof config.ratio === 'number' && Number.isFinite(config.ratio) && config.ratio > 0) {
					result[key] = config.ratio;
				} else {
					console.warn(`[WAT:OptionsProcessor] 유효하지 않은 ratio 설정을 건너뜁니다: ${key} = ${JSON.stringify(config)}`);
				}
			}
		}
		return result;
	}

	/**
	 * Processes language configuration options
	 * @param {string|Array|Object} inputLang - Input language specification
	 * @param {Array} supportedLanguages - List of supported languages
	 * @param {string} selectedLang - Currently selected/saved language
	 * @returns {Object} Processed language configuration
	 */
	/**
	 * 브라우저 언어를 지원 언어 목록에 매칭합니다 (정확 일치 → 기본 코드 일치)
	 * @param {Array<string>} supportedLanguages - 지원 언어 목록
	 * @returns {string|null} 매칭된 언어 코드, 없으면 null
	 */
	static detectBrowserLanguage(supportedLanguages) {
		if (typeof navigator === 'undefined' || !Array.isArray(supportedLanguages)) return null;
		const candidates = Array.isArray(navigator.languages) && navigator.languages.length
			? navigator.languages
			: (navigator.language ? [navigator.language] : []);

		for (const raw of candidates) {
			if (!raw) continue;
			const lower = String(raw).toLowerCase();
			const exact = supportedLanguages.find(lang => lang.toLowerCase() === lower);
			if (exact) return exact;
			// 지역 변형 매칭: 'en-CA' → 'en-US', 'zh-CN' → 'zh'
			const base = lower.split('-')[0];
			const baseMatch = supportedLanguages.find(lang => lang.toLowerCase() === base) ||
				supportedLanguages.find(lang => lang.toLowerCase().split('-')[0] === base);
			if (baseMatch) return baseMatch;
		}
		return null;
	}

	static processLanguageOptions(inputLang, supportedLanguages, selectedLang = 'ko') {
		// localStorage 유래 selectedLang 검증 - 지원 언어 목록에 없으면 'ko'로 폴백
		if (typeof selectedLang !== 'string' || !Localization.SUPPORTED_LANGUAGES.includes(selectedLang)) {
			selectedLang = 'ko';
		}

		if (inputLang && typeof inputLang === 'object' && !Array.isArray(inputLang)) {
			const { languages, autoDetect = false, showSelector = true, defaultLanguage = 'ko' } = inputLang;

			let options;
			let finalLanguage = selectedLang || defaultLanguage;

			if (autoDetect || !languages) {
				options = Localization.SUPPORTED_LANGUAGES;
			} else if (Array.isArray(languages)) {
				const validOptions = languages.filter(l => supportedLanguages.includes(l));
				options = validOptions.length > 0 ? validOptions : [selectedLang || defaultLanguage];

				if (validOptions.length === 1 && showSelector === false) {
					finalLanguage = validOptions[0];
				}
			} else if (typeof languages === 'string') {
				const validLang = supportedLanguages.includes(languages) ? languages : (selectedLang || defaultLanguage);
				options = [validLang];
				if (showSelector === false) {
					finalLanguage = validLang;
				}
			} else {
				options = Localization.SUPPORTED_LANGUAGES;
			}

			// selectedLang이 유효하지 않을 때만 defaultLanguage로 폴백
			if (!options.includes(finalLanguage) && defaultLanguage && options.includes(defaultLanguage)) {
				finalLanguage = defaultLanguage;
			}

			const validLang = options.includes(finalLanguage) ? finalLanguage : options[0];
			return {
				language: validLang,
				options: options,
				showSelector: showSelector && options.length > 1,
				defaultLanguage: defaultLanguage
			};
		}

		if (!inputLang) {
			return {
				language: selectedLang || 'ko',
				options: Localization.SUPPORTED_LANGUAGES,
				showSelector: true,
				defaultLanguage: 'ko'
			};
		}

		if (Array.isArray(inputLang)) {
			const validOptions = inputLang.filter(l => supportedLanguages.includes(l));
			const finalOptions = validOptions.length > 0 ? validOptions : [selectedLang || 'ko'];
			const validLang = finalOptions.includes(selectedLang) ? selectedLang : finalOptions[0];
			return {
				language: validLang,
				options: finalOptions,
				showSelector: finalOptions.length > 1,
				defaultLanguage: 'ko'
			};
		}

		if (typeof inputLang === 'string') {
			const validLang = supportedLanguages.includes(inputLang) ? inputLang : (selectedLang || 'ko');
			return {
				language: validLang,
				options: [validLang],
				showSelector: false,
				defaultLanguage: 'ko'
			};
		}

		return {
			language: selectedLang || 'ko',
			options: Localization.SUPPORTED_LANGUAGES,
			showSelector: true,
			defaultLanguage: 'ko'
		};
	}

	/**
	 * Processes container configuration options
	 * @param {Object} options - Input options
	 * @param {Object} constants - WAT constants
	 * @param {Object} defaults - Default configuration
	 * @returns {Object} Processed container configuration
	 */
	static processContainerOptions(options, constants, defaults) {
		return {
			id: options.containerID || constants.STORAGE_KEYS.CONTAINER,
			targetSelector: options.containerTargetSelector || defaults.OPTIONS.containerSelector,
			position: options.containerTargetPosition || 'before'
		};
	}

	/**
	 * Processes style configuration options
	 * @param {Object} options - Input options
	 * @param {string} basePath - Base path for CSS files
	 * @returns {Object} Processed style configuration
	 */
	static processStyleOptions(options, basePath) {
		return {
			mode: options.styleMode || 'dynamic',
			cssPath: options.styleCssPath || `${basePath}css/wat-siteCustom.css`
		};
	}

	/**
	 * Processes selector configuration options
	 * @param {Object} options - Input options
	 * @returns {Object} Processed selector configuration
	 */
	static processSelectorOptions(options) {
		return {
			apply: options.applySelector || 'body',
			exclude: options.excludeSelector || ''
		};
	}
}
