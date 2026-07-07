/**
 * @fileoverview ConfigurationManager - 플러그인 전체 설정 중앙 관리
 * @module src/core/ConfigurationManager
 */
import { ErrorHandler } from './ErrorHandler.js';
import { Constants } from './constants.js';
import { Defaults } from './defaults.js';
import { OptionsProcessor } from './OptionsProcessor.js';

export class ConfigurationManager {
	constructor(options = {}, savedPreferences = {}, basePath = '') {
		this.options = options;
		this.savedPrefs = savedPreferences;
		this.basePath = basePath;
		this.supportedLanguages = ['ko', 'en-US', 'en-GB', 'de', 'ja', 'zh'];

		this._processConfigurations();
	}

	/**
	 * Processes all configuration options
	 * @private
	 */
	_processConfigurations() {
		ErrorHandler.safeExecute(() => {
			this.containerConfig = OptionsProcessor.processContainerOptions(
				this.options,
				Constants,
				Defaults
			);

			this.styleConfig = OptionsProcessor.processStyleOptions(
				this.options,
				this.basePath
			);

			this.selectorConfig = OptionsProcessor.processSelectorOptions(this.options);

			const savedLang = this.savedPrefs.language;
			const inputLang = this.options.language;
			const langResult = OptionsProcessor.processLanguageOptions(
				inputLang,
				this.supportedLanguages,
				savedLang
			);

			const isForcedLanguageMode = (
				inputLang &&
				typeof inputLang === 'object' &&
				!Array.isArray(inputLang) &&
				Array.isArray(inputLang.languages) &&
				inputLang.languages.length === 1 &&
				inputLang.showSelector === false
			);

			if (!isForcedLanguageMode) {
				if (this.savedPrefs.language && langResult.options.includes(this.savedPrefs.language)) {
					langResult.language = this.savedPrefs.language;
				} else if (langResult.defaultLanguage && langResult.options.includes(langResult.defaultLanguage)) {
					langResult.language = langResult.defaultLanguage;
				}
			}

			this.languageConfig = langResult;
			this.ratioConfigs = this._processRatioConfigurations();
		}, {
			category: ErrorHandler.CATEGORIES.INITIALIZATION,
			severity: ErrorHandler.SEVERITY.ERROR,
			method: '_processConfigurations',
			component: 'ConfigurationManager',
			data: { options: this.options, savedPrefs: this.savedPrefs },
			strategy: ErrorHandler.RECOVERY_STRATEGIES.FALLBACK,
			recovery: () => {
				// 설정 처리 실패 시 사용자 옵션이 전부 무시되므로 명확한 에러 로그로 알림
				console.error('[WAT:ConfigurationManager] 설정 처리에 실패하여 모든 사용자 옵션을 무시하고 기본 설정으로 폴백합니다.');
				this.containerConfig = { id: 'watContainer', targetSelector: 'body', position: 'before' };
				this.styleConfig = { mode: 'dynamic', cssPath: '' };
				this.selectorConfig = { apply: 'body', exclude: '' };
				this.languageConfig = { language: 'ko', options: ['ko'], showSelector: false, defaultLanguage: 'ko' };
				this.ratioConfigs = { fontSize: {}, lineHeight: {}, letterSpacing: {}, screenScale: {} };
			}
		});
	}

	/**
	 * Processes all ratio-based configurations
	 * @private
	 * @returns {Object} All ratio configurations
	 */
	_processRatioConfigurations() {
		const defaultRatios = {
			fontSize: {
				'initial': 1,
				'size-1p2x': 1.2,
				'size-1p5x': 1.5,
				'size-2x': 2
			},
			lineHeight: {
				'initial': 1,
				'size-1p2x': 1.2,
				'size-1p5x': 1.5,
				'size-1p75x': 1.75,
				'size-2x': 2
			},
			letterSpacing: {
				'initial': 1,
				'wide_little': 1.2,
				'wide_normal': 1.5,
				'wide_more': 2
			},
			screenScale: {
				'initial': 1,
				'scale-1p2x': 1.2,
				'scale-1p5x': 1.5,
				'scale-2x': 2
			}
		};

		return {
			fontSize: OptionsProcessor.processRatioOptions(
				this.options.fontSizeRatios || defaultRatios.fontSize,
				this.options.fontSizeOptions
			),
			lineHeight: OptionsProcessor.processRatioOptions(
				this.options.lineHeightRatios || defaultRatios.lineHeight,
				this.options.lineHeightOptions
			),
			letterSpacing: OptionsProcessor.processRatioOptions(
				this.options.letterSpacingRatios || defaultRatios.letterSpacing,
				this.options.letterSpacingOptions
			),
			screenScale: OptionsProcessor.processRatioOptions(
				this.options.screenScaleRatios || defaultRatios.screenScale,
				this.options.screenScaleOptions
			)
		};
	}

	getContainerConfig() { return this.containerConfig; }
	getStyleConfig() { return this.styleConfig; }
	getSelectorConfig() { return this.selectorConfig; }
	getLanguageConfig() { return this.languageConfig; }
	getRatioConfigs() { return this.ratioConfigs; }
	getLanguage() { return this.languageConfig.language; }
	getSupportedLanguages() { return this.supportedLanguages; }
	getLanguageOptions() { return this.languageConfig.options; }
}
