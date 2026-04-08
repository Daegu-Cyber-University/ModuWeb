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
				result[key] = config;
			} else if (typeof config === 'object' && config.ratio) {
				result[key] = config.ratio;
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
	static processLanguageOptions(inputLang, supportedLanguages, selectedLang = 'ko') {
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
