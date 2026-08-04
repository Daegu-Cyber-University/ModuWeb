/**
 * @fileoverview WAT (Web Accessibility Tool) - ModuWeb
 * @version 2.1.0
 * @license Apache-2.0
 * @see https://github.com/Daegu-Cyber-University/ModuWeb
 */
var WATPlugin = (function (exports) {
	'use strict';

	/**
	 * @fileoverview WAT 전역 상수 정의
	 * @module src/core/constants
	 */

	/**
	 * Plugin-wide constants and identifiers
	 */
	class Constants {
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
			CSS_FILE: 'assets/css/webAccTools.css'
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
	const FONT_FAMILY_OPTIONS = {
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

	/**
	 * @fileoverview WAT 기본값 정의
	 * @module src/core/defaults
	 */

	class Defaults {
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

	/**
	 * @fileoverview WAT 다국어 상수 정의
	 * @module src/core/localization
	 */

	class Localization {
		static SUPPORTED_LANGUAGES = ['ko', 'en-US', 'en-GB', 'ja', 'zh', 'de'];

		static DEFAULT_LANGUAGE = 'ko';

		static LANGUAGE_FILES = {
			'ko': 'ko.json',
			'en-US': 'en-US.json',
			'en-GB': 'en-GB.json',
			'ja': 'ja.json',
			'zh': 'zh.json',
			'de': 'de.json'
		};
	}

	/**
	 * @fileoverview WAT 중앙집중식 에러 처리 시스템
	 * @module src/core/ErrorHandler
	 */

	class ErrorHandler {
		// Error severity levels
		static SEVERITY = {
			CRITICAL: 'critical',
			ERROR: 'error',
			WARNING: 'warning',
			INFO: 'info',
			DEBUG: 'debug'
		};

		// Error categories
		static CATEGORIES = {
			INITIALIZATION: 'initialization',
			DOM_OPERATION: 'dom_operation',
			STATE_MANAGEMENT: 'state_management',
			STYLE_APPLICATION: 'style_application',
			EVENT_HANDLING: 'event_handling',
			CACHE_OPERATION: 'cache_operation',
			LOCALIZATION: 'localization',
			PERFORMANCE: 'performance',
			MEMORY_MANAGEMENT: 'memory_management',
			VALIDATION: 'validation',
			NETWORK: 'network',
			USER_INPUT: 'user_input',
			UNKNOWN: 'unknown'
		};

		// Error recovery strategies
		static RECOVERY_STRATEGIES = {
			RETRY: 'retry',
			FALLBACK: 'fallback',
			IGNORE: 'ignore',
			ABORT: 'abort',
			RESET: 'reset'
		};

		/**
		 * Handles errors with standardized processing
		 * @param {Error|string} error - Error object or error message
		 * @param {Object} context - Error context information
		 * @returns {Object} Error handling result
		 */
		static handle(error, context = {}) {
			const errorInfo = this._createErrorInfo(error, context);
			this._logError(errorInfo);
			this._collectErrorMetrics(errorInfo);
			const recoveryResult = this._executeRecovery(errorInfo);
			this._notifyErrorMonitoring(errorInfo);
			return {
				handled: true,
				errorInfo,
				recoveryResult,
				timestamp: Date.now()
			};
		}

		/**
		 * handle()의 별칭 - 자유형 category/severity 문자열을 내부 enum으로 정규화하여 위임
		 * @param {Error|string} error - Error object or error message
		 * @param {Object} context - Error context information (자유형 문자열 허용)
		 * @returns {Object} Error handling result
		 */
		static handleError(error, context = {}) {
			return this.handle(error, {
				...context,
				category: this._normalizeCategory(context.category),
				severity: this._normalizeSeverity(context.severity)
			});
		}

		/**
		 * 자유형 category 문자열을 CATEGORIES enum 값으로 정규화
		 * @private
		 */
		static _normalizeCategory(category) {
			if (typeof category !== 'string' || !category) return this.CATEGORIES.UNKNOWN;
			const normalized = category.toLowerCase().replace(/[\s-]+/g, '_');
			if (Object.values(this.CATEGORIES).includes(normalized)) return normalized;
			// 자주 쓰이는 자유형 표현 매핑
			const aliases = {
				'configuration': this.CATEGORIES.INITIALIZATION,
				'config': this.CATEGORIES.INITIALIZATION,
				'init': this.CATEGORIES.INITIALIZATION,
				'dom': this.CATEGORIES.DOM_OPERATION,
				'style': this.CATEGORIES.STYLE_APPLICATION,
				'cache': this.CATEGORIES.CACHE_OPERATION,
				'event': this.CATEGORIES.EVENT_HANDLING,
				'state': this.CATEGORIES.STATE_MANAGEMENT
			};
			return aliases[normalized] || this.CATEGORIES.UNKNOWN;
		}

		/**
		 * 자유형 severity 문자열을 SEVERITY enum 값으로 정규화
		 * @private
		 */
		static _normalizeSeverity(severity) {
			if (typeof severity !== 'string' || !severity) return this.SEVERITY.ERROR;
			const normalized = severity.toLowerCase();
			if (Object.values(this.SEVERITY).includes(normalized)) return normalized;
			// 자주 쓰이는 자유형 표현 매핑
			const aliases = {
				'fatal': this.SEVERITY.CRITICAL,
				'high': this.SEVERITY.ERROR,
				'medium': this.SEVERITY.WARNING,
				'low': this.SEVERITY.INFO,
				'notice': this.SEVERITY.INFO
			};
			return aliases[normalized] || this.SEVERITY.ERROR;
		}

		static _createErrorInfo(error, context) {
			const isErrorObject = error instanceof Error;
			return {
				message: isErrorObject ? error.message : String(error),
				stack: isErrorObject ? error.stack : new Error().stack,
				name: isErrorObject ? error.name : 'WAT_Error',
				category: context.category || this.CATEGORIES.UNKNOWN,
				severity: context.severity || this.SEVERITY.ERROR,
				method: context.method || 'unknown',
				component: context.component || 'WAT',
				data: context.data || {},
				userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
				url: typeof window !== 'undefined' ? window.location.href : '',
				timestamp: new Date().toISOString(),
				recovery: context.recovery || null,
				strategy: context.strategy || this.RECOVERY_STRATEGIES.IGNORE,
				id: this._generateErrorId()
			};
		}

		static _logError(errorInfo) {
			const prefix = `[WAT:${errorInfo.component}:${errorInfo.category}]`;
			const message = `${errorInfo.method}: ${errorInfo.message}`;
			switch (errorInfo.severity) {
				case this.SEVERITY.CRITICAL:
					console.error(`${prefix} CRITICAL:`, message, errorInfo);
					break;
				case this.SEVERITY.ERROR:
					console.error(`${prefix} ERROR:`, message, errorInfo.data);
					break;
				case this.SEVERITY.WARNING:
					console.warn(`${prefix} WARNING:`, message, errorInfo.data);
					break;
				case this.SEVERITY.INFO:
					console.info(`${prefix} INFO:`, message, errorInfo.data);
					break;
				case this.SEVERITY.DEBUG:
					break;
				default:
					console.log(`${prefix}`, message, errorInfo.data);
			}
		}

		static _executeRecovery(errorInfo) {
			try {
				if (typeof errorInfo.recovery === 'function') {
					const result = errorInfo.recovery(errorInfo);
					return { success: true, strategy: 'custom', result };
				}
				switch (errorInfo.strategy) {
					case this.RECOVERY_STRATEGIES.ABORT:
						return { success: false, strategy: 'abort' };
					case this.RECOVERY_STRATEGIES.IGNORE:
					case this.RECOVERY_STRATEGIES.FALLBACK:
					case this.RECOVERY_STRATEGIES.RESET:
					case this.RECOVERY_STRATEGIES.RETRY:
					default:
						return { success: true, strategy: errorInfo.strategy || 'default' };
				}
			} catch (recoveryError) {
				console.error('[WAT] Recovery failed:', recoveryError);
				return { success: false, strategy: errorInfo.strategy, error: recoveryError };
			}
		}

		static _collectErrorMetrics(errorInfo) {
			if (typeof window === 'undefined') return;
			if (!window.WAT_ERROR_METRICS) {
				window.WAT_ERROR_METRICS = { total: 0, byCategory: {}, bySeverity: {}, recent: [] };
			}
			const metrics = window.WAT_ERROR_METRICS;
			metrics.total++;
			metrics.byCategory[errorInfo.category] = (metrics.byCategory[errorInfo.category] || 0) + 1;
			metrics.bySeverity[errorInfo.severity] = (metrics.bySeverity[errorInfo.severity] || 0) + 1;
			metrics.recent.push({
				id: errorInfo.id,
				category: errorInfo.category,
				severity: errorInfo.severity,
				message: errorInfo.message,
				timestamp: errorInfo.timestamp
			});
			if (metrics.recent.length > 50) {
				metrics.recent.shift();
			}
		}

		static _notifyErrorMonitoring(errorInfo) {
			if (typeof window !== 'undefined' && window.WAT_ERROR_CALLBACK && typeof window.WAT_ERROR_CALLBACK === 'function') {
				try {
					window.WAT_ERROR_CALLBACK(errorInfo);
				} catch (callbackError) {
					console.warn('[WAT] Error callback failed:', callbackError);
				}
			}
		}

		static _generateErrorId() {
			return `wat_error_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
		}

		static getMetrics() {
			if (typeof window === 'undefined') return { total: 0, byCategory: {}, bySeverity: {}, recent: [] };
			return window.WAT_ERROR_METRICS || { total: 0, byCategory: {}, bySeverity: {}, recent: [] };
		}

		static clearMetrics() {
			if (typeof window !== 'undefined') {
				window.WAT_ERROR_METRICS = { total: 0, byCategory: {}, bySeverity: {}, recent: [] };
			}
		}

		/**
		 * Safe execution wrapper with error handling
		 */
		static safeExecute(fn, context = {}, defaultReturn = null) {
			try {
				return fn();
			} catch (error) {
				this.handle(error, { ...context, severity: context.severity || this.SEVERITY.WARNING });
				return defaultReturn;
			}
		}

		/**
		 * Async safe execution wrapper with error handling
		 */
		static async safeExecuteAsync(fn, context = {}, defaultReturn = null) {
			try {
				return await fn();
			} catch (error) {
				this.handle(error, { ...context, severity: context.severity || this.SEVERITY.WARNING });
				return defaultReturn;
			}
		}

		// sessionStorage 기반 디버그 플래그 캐시 (null = 아직 미확인)
		static _sessionDebugFlag = null;

		/**
		 * sessionStorage의 WAT_DEBUG 플래그 확인 (1회 캐시)
		 * 쿠키 차단/샌드박스 iframe에서는 sessionStorage 접근 자체가 throw 하므로 try/catch로 보호
		 * @private
		 */
		static _checkSessionDebugFlag() {
			if (this._sessionDebugFlag === null) {
				try {
					this._sessionDebugFlag = sessionStorage.getItem('WAT_DEBUG') === 'true';
				} catch (storageError) {
					this._sessionDebugFlag = false;
				}
			}
			return this._sessionDebugFlag;
		}

		/**
		 * Debug logging utility
		 */
		static debugLog(message, data = null, level = 'log') {
			if (typeof window !== 'undefined' && (window.WAT_DEBUG_MODE || this._checkSessionDebugFlag())) {
				const timestamp = new Date().toISOString();
				const logMessage = `[WAT Debug ${timestamp}] ${message}`;
				if (data !== null) {
					console[level](logMessage, data);
				} else {
					console[level](logMessage);
				}
			}
		}
	}

	/**
	 * @fileoverview ContainerManager - DOM 컨테이너 생성 및 선택자 적용
	 * @module src/core/ContainerManager
	 */

	class ContainerManager {
		/**
		 * Creates or finds an existing container element
		 * @param {Object} config - Container configuration
		 * @param {string} config.id - Container ID
		 * @param {string} config.targetSelector - Target selector for container placement
		 * @param {string} config.position - Position relative to target ('before' or 'after')
		 * @returns {HTMLElement|null} Container element (실패 시 null)
		 */
		static createOrFindContainer(config) {
			return ErrorHandler.safeExecute(() => {
				let container = document.getElementById(config.id);

				if (!container) {
					// 삽입 대상 확인 - document.body가 아직 없는 시점(head 실행 등)이면 명확한 에러로 처리
					const target = document.querySelector(config.targetSelector) || document.body;
					if (!target) {
						throw new Error(`컨테이너 삽입 대상이 없습니다 (targetSelector: "${config.targetSelector}", document.body 미존재)`);
					}

					container = document.createElement('div');
					container.id = config.id;

					if (config.position === 'after') {
						target.appendChild(container);
					} else {
						target.insertBefore(container, target.firstChild);
					}
				}

				return container;
			}, {
				category: ErrorHandler.CATEGORIES.DOM_OPERATION,
				severity: ErrorHandler.SEVERITY.ERROR,
				method: 'createOrFindContainer',
				component: 'ContainerManager',
				data: { config },
				strategy: ErrorHandler.RECOVERY_STRATEGIES.FALLBACK,
				// document.body를 반환하면 호출측이 호스트 페이지 전체를 덮어쓸 수 있으므로 실패는 null로 전파
				recovery: () => null
			}, null);
		}

		/**
		 * Applies CSS selectors to DOM elements
		 * @param {string} applySelector - Selector for elements to apply WAT classes
		 * @param {string} excludeSelector - Selector for elements to exclude
		 * @param {Object} cssClasses - CSS class constants
		 */
		static applySelectorClasses(applySelector, excludeSelector, cssClasses) {
			if (applySelector) {
				ErrorHandler.safeExecute(() => {
					document.querySelectorAll(applySelector).forEach(el => {
						el.classList.add(cssClasses.APPLY);
					});
				}, {
					category: ErrorHandler.CATEGORIES.DOM_OPERATION,
					severity: ErrorHandler.SEVERITY.WARNING,
					method: 'applySelectorClasses',
					component: 'ContainerManager',
					data: { applySelector, cssClasses },
					strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
				});
			}

			if (excludeSelector) {
				ErrorHandler.safeExecute(() => {
					document.querySelectorAll(excludeSelector).forEach(el => {
						el.classList.add('wat-exclude');
					});
				}, {
					category: ErrorHandler.CATEGORIES.DOM_OPERATION,
					severity: ErrorHandler.SEVERITY.WARNING,
					method: 'applySelectorClasses',
					component: 'ContainerManager',
					data: { excludeSelector },
					strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
				});
			}
		}
	}

	/**
	 * @fileoverview StyleBatchProcessor - 스타일 업데이트 배치 최적화
	 * @module src/core/StyleBatchProcessor
	 */

	class StyleBatchProcessor {
		constructor(plugin) {
			this.plugin = plugin;
			this.pendingUpdates = new Map();
			this.isScheduled = false;
			this.batchSize = Constants.PERFORMANCE.BATCH_SIZE;
			this.frameId = null;
		}

		queueStyleUpdate(element, property, value) {
			if (!this.pendingUpdates.has(element)) {
				this.pendingUpdates.set(element, new Map());
			}
			this.pendingUpdates.get(element).set(property, value);
			this.scheduleUpdate();
		}

		queueMultipleStyles(element, styleMap) {
			if (!this.pendingUpdates.has(element)) {
				this.pendingUpdates.set(element, new Map());
			}
			const elementStyles = this.pendingUpdates.get(element);
			for (const [property, value] of Object.entries(styleMap)) {
				elementStyles.set(property, value);
			}
			this.scheduleUpdate();
		}

		scheduleUpdate() {
			if (!this.isScheduled) {
				this.isScheduled = true;
				if (this.plugin && this.plugin._requestAnimationFrame) {
					this.frameId = this.plugin._requestAnimationFrame(() => this.processBatch());
				} else if (typeof requestAnimationFrame !== 'undefined') {
					this.frameId = requestAnimationFrame(() => this.processBatch());
				} else {
					// Node.js 환경 폴백 (테스트용)
					this.frameId = setTimeout(() => this.processBatch(), 0);
				}
			}
		}

		processBatch() {
			let processedCount = 0;
			const iterator = this.pendingUpdates.entries();

			for (const [element, styles] of iterator) {
				if (processedCount >= this.batchSize) {
					if (this.plugin && this.plugin._requestAnimationFrame) {
						this.frameId = this.plugin._requestAnimationFrame(() => this.processBatch());
					} else if (typeof requestAnimationFrame !== 'undefined') {
						this.frameId = requestAnimationFrame(() => this.processBatch());
					} else {
						this.frameId = setTimeout(() => this.processBatch(), 0);
					}
					return;
				}

				this.applyStylesToElement(element, styles);
				this.pendingUpdates.delete(element);
				processedCount++;
			}

			this.isScheduled = false;
			this.frameId = null;
		}

		applyStylesToElement(element, styles) {
			try {
				for (const [property, value] of styles) {
					if (value === null || value === '') {
						element.style.removeProperty(property);
					} else {
						element.style.setProperty(property, value, 'important');
					}
				}
			} catch (error) {
				ErrorHandler.handle(error, {
					category: ErrorHandler.CATEGORIES.STYLE_APPLICATION,
					severity: ErrorHandler.SEVERITY.WARNING,
					method: 'applyStylesToElement',
					component: 'StyleBatchProcessor',
					data: {
						element: element.tagName,
						elementId: element.id,
						styles: Array.from(styles.keys())
					},
					strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
				});
			}
		}

		cancelPendingUpdates() {
			if (this.frameId) {
				// scheduleUpdate()와 동일한 분기 순서 - plugin의 rAF로 만든 frameId는 plugin의 cancel로 취소
				if (this.plugin && this.plugin._requestAnimationFrame && typeof this.plugin._cancelAnimationFrame === 'function') {
					this.plugin._cancelAnimationFrame(this.frameId);
				} else if (typeof cancelAnimationFrame !== 'undefined') {
					cancelAnimationFrame(this.frameId);
				} else {
					clearTimeout(this.frameId);
				}
				this.frameId = null;
			}
			this.pendingUpdates.clear();
			this.isScheduled = false;
		}

		removePendingUpdatesForElement(element) {
			this.pendingUpdates.delete(element);
		}

		getPendingCount() {
			return this.pendingUpdates.size;
		}
	}

	/**
	 * @fileoverview OptionsProcessor - 다양한 옵션 설정 처리 유틸리티
	 * @module src/core/OptionsProcessor
	 */

	class OptionsProcessor {
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

	/**
	 * @fileoverview ConfigurationManager - 플러그인 전체 설정 중앙 관리
	 * @module src/core/ConfigurationManager
	 */

	class ConfigurationManager {
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

	/**
	 * @fileoverview StateManager - WAT 플러그인 중앙집중식 상태 관리
	 * @module src/wat/StateManager
	 */

	/**
	 * 프로토타입 오염 방지를 위해 경로에서 금지되는 키 목록
	 * @type {string[]}
	 */
	const FORBIDDEN_PATH_KEYS = ['__proto__', 'constructor', 'prototype'];

	/**
	 * Centralized state management system for WAT plugin
	 * @class StateManager
	 */
	class StateManager {
		/**
		 * @param {Object} initialState - Initial state object
		 */
		constructor(initialState = {}) {
			this._state = this._deepMerge({}, initialState);
			this._observers = new Map();
			this._history = [];
			this._maxHistorySize = 50;
		}

		/**
		 * Deep merge utility for nested objects
		 * @private
		 */
		_deepMerge(target, source) {
			const result = { ...target };
			for (const key of Object.keys(source)) {
				if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
					result[key] = this._deepMerge(target[key] || {}, source[key]);
				} else {
					result[key] = source[key];
				}
			}
			return result;
		}

		/**
		 * Gets a value from state using dot notation path
		 * @param {string} path - Dot notation path (e.g., 'plugin.isTTSActive')
		 * @param {*} [defaultValue] - Value to return when the path resolves to undefined
		 * @returns {*} The value at the path, or defaultValue if undefined
		 */
		get(path, defaultValue) {
			const value = path.split('.').reduce((obj, key) => obj && obj[key], this._state);
			return value === undefined ? defaultValue : value;
		}

		/**
		 * Sets a value in state using dot notation path
		 * @param {string} path - Dot notation path
		 * @param {*} value - Value to set
		 * @param {boolean} skipNotify - Whether to skip observer notifications
		 */
		set(path, value, skipNotify = false) {
			const keys = path.split('.');
			if (keys.some(key => FORBIDDEN_PATH_KEYS.includes(key))) {
				console.warn(`[StateManager] Forbidden key in path "${path}" - ignored to prevent prototype pollution`);
				return;
			}
			const oldValue = this.get(path);
			const lastKey = keys.pop();
			const target = keys.reduce((obj, key) => {
				if (!Object.prototype.hasOwnProperty.call(obj, key)) {
					obj[key] = {};
				} else if (obj[key] === null || typeof obj[key] !== 'object') {
					console.warn(`[StateManager] Overwriting non-object value at "${key}" while setting "${path}"`);
					obj[key] = {};
				}
				return obj[key];
			}, this._state);

			target[lastKey] = value;
			this._addToHistory(path, oldValue, value);

			if (!skipNotify) {
				this._notifyObservers(path, value, oldValue);
			}
		}

		/**
		 * Updates state by merging with existing state
		 * @param {string} path - Dot notation path
		 * @param {Object} updates - Object to merge
		 */
		update(path, updates) {
			const currentValue = this.get(path) || {};
			const newValue = this._deepMerge(currentValue, updates);
			this.set(path, newValue);
		}

		/**
		 * Subscribes to state changes
		 * @param {string} path - Path to observe
		 * @param {Function} callback - Callback function (newValue, oldValue, path) => void
		 * @returns {Function} Unsubscribe function
		 */
		subscribe(path, callback) {
			if (!this._observers.has(path)) {
				this._observers.set(path, new Set());
			}
			this._observers.get(path).add(callback);

			return () => {
				const observers = this._observers.get(path);
				if (observers) {
					observers.delete(callback);
					if (observers.size === 0) {
						this._observers.delete(path);
					}
				}
			};
		}

		/**
		 * Notifies observers of state changes
		 * @private
		 */
		_notifyObservers(path, newValue, oldValue) {
			const observers = this._observers.get(path);
			if (observers) {
				this._dispatchToObservers(observers, newValue, oldValue, path);
			}

			// 부모 경로 변경 시 하위 경로 구독자에게도 각자의 값으로 알림
			const prefix = path + '.';
			this._observers.forEach((childObservers, childPath) => {
				if (!childPath.startsWith(prefix)) {
					return;
				}
				const childKeys = childPath.slice(prefix.length).split('.');
				const childNewValue = childKeys.reduce((obj, key) => obj && obj[key], newValue);
				const childOldValue = childKeys.reduce((obj, key) => obj && obj[key], oldValue);
				this._dispatchToObservers(childObservers, childNewValue, childOldValue, childPath);
			});
		}

		/**
		 * Invokes a set of observer callbacks safely
		 * @private
		 */
		_dispatchToObservers(observers, newValue, oldValue, path) {
			observers.forEach(callback => {
				try {
					callback(newValue, oldValue, path);
				} catch (error) {
					ErrorHandler.handle(error, {
						category: ErrorHandler.CATEGORIES.STATE_MANAGEMENT,
						severity: ErrorHandler.SEVERITY.WARNING,
						method: '_notifyObservers',
						component: 'StateManager',
						data: { path, newValue, oldValue },
						strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
					});
				}
			});
		}

		/**
		 * Adds state change to history
		 * @private
		 */
		_addToHistory(path, oldValue, newValue) {
			this._history.push({
				timestamp: Date.now(),
				path,
				oldValue,
				newValue
			});
			if (this._history.length > this._maxHistorySize) {
				this._history.shift();
			}
		}

		/**
		 * Gets state change history
		 * @returns {Array} Array of state changes
		 */
		getHistory() {
			return [...this._history];
		}

		/**
		 * Gets current complete state (for debugging)
		 * @returns {Object} Current state object
		 */
		getState() {
			return JSON.parse(JSON.stringify(this._state));
		}

		/**
		 * Resets state to initial values
		 * @param {Object} newInitialState - New initial state
		 */
		reset(newInitialState = {}) {
			this._state = this._deepMerge({}, newInitialState);
			this._history = [];
			this._observers.forEach((observers, path) => {
				const newValue = this.get(path);
				observers.forEach(callback => {
					try {
						callback(newValue, undefined, path);
					} catch (error) {
						ErrorHandler.handle(error, {
							category: ErrorHandler.CATEGORIES.STATE_MANAGEMENT,
							severity: ErrorHandler.SEVERITY.WARNING,
							method: 'reset',
							component: 'StateManager',
							data: { path },
							strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
						});
					}
				});
			});
		}
	}

	/**
	 * @fileoverview IframeStyler - 동일 출처 iframe에 대한 접근성 스타일 적용/동기화 담당
	 * @module src/wat/IframeStyler
	 * @description WAT.js에서 추출된 iframe 스타일링 클러스터 (Phase 6-1).
	 *              iframe 탐지·제외 판정·CSS 주입·동적 스타일 마킹/적용·신규 iframe 감시를 담당한다.
	 *              WAT 인스턴스(plugin)의 서비스(제외 셀렉터, 비율 테이블, 원본 스타일 맵,
	 *              추적형 타이머, 옵저버 레지스트리)를 위임받아 사용한다.
	 */

	const WAT_DEBUG_ENABLED$1 = false;

	class IframeStyler {
		/**
		 * @param {Object} plugin - WAT 인스턴스 (container, excludeSelector, styleMode,
		 *                          fontSizeRatios 등 서비스 제공자)
		 */
		constructor(plugin) {
			this.plugin = plugin;
		}

		/**
		 * 페이지의 모든 유효한 iframe에 접근성 스타일을 적용합니다
		 * @returns {void}
		 */
		applyStylesToIframes() {
			const iframes = document.querySelectorAll('iframe');

			// excludeSelector에 해당하지 않는 iframe만 필터링
			const validIframes = Array.from(iframes).filter(iframe => {
				return !this.isIframeInExcludeZone(iframe);
			});

			validIframes.forEach((iframe, index) => {
				this.processIframe(iframe, index);
			});
		}

		/**
		 * 개별 iframe에 접근성 스타일을 적용합니다 (동일 출처만, 크로스 오리진은 안내 후 스킵)
		 * @param {HTMLIFrameElement} iframe - 처리할 iframe
		 * @param {number} index - 컬렉션 내 인덱스 (id 폴백용)
		 * @returns {void}
		 */
		processIframe(iframe, index) {
			const src = iframe.src || '';
			const iframeId = iframe.id || `iframe-${index}`;

			// iframe이 excludeSelector 내부에 있는지 확인
			if (this.isIframeInExcludeZone(iframe)) {
				return;
			}

			try {
				// 동일 출처 접근 시도
				const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

				if (iframeDoc) {
					if (WAT_DEBUG_ENABLED$1) ;
					this.applyStylesToIframeDocument(iframeDoc, iframeId);
				} else {
					console.warn(`[WAT] iframe document access denied: ${iframeId} (${src})`);
				}
			} catch (error) {
				// 크로스 오리진인 경우
				if (this.isKnownExternalService(src)) ; else {
					console.warn(`[WAT] Cross-origin iframe processing failed: ${iframeId} (${src})`, error.message);
				}
			}
		}

		/**
		 * iframe이 제외 영역(도구 컨테이너·wat-exclude·사용자 excludeSelector) 내에 있는지 판단합니다
		 * @param {HTMLIFrameElement} iframe - 확인할 iframe
		 * @returns {boolean} 제외 대상이면 true
		 */
		isIframeInExcludeZone(iframe) {
			// 1. 컨테이너 내부 iframe 확인
			if (this.plugin.container && this.plugin.container.contains(iframe)) {
				return true;
			}

			// 2. wat-exclude 클래스 확인
			if (iframe.classList.contains('wat-exclude') || iframe.closest('.wat-exclude')) {
				return true;
			}

			// 3. 사용자 설정 excludeSelector 확인
			if (this.plugin.excludeSelector) {
				const userExcludes = this.plugin.excludeSelector.split(',').map(s => s.trim());
				for (const exclude of userExcludes) {
					if (exclude) {
						try {
							// iframe 자체가 선택자에 해당하거나
							if (iframe.matches(exclude)) {
								return true;
							}
							// iframe의 부모 요소가 선택자에 해당하는 경우
							if (iframe.closest(exclude)) {
								return true;
							}
						} catch (error) {
							console.warn(`[WAT] Invalid excludeSelector: ${exclude}`, error);
						}
					}
				}
			}

			return false;
		}

		/**
		 * iframe 소스가 알려진 외부 서비스(YouTube 등)인지 판단합니다 (크로스 오리진 경고 억제용)
		 * @param {string} src - iframe 소스 URL
		 * @returns {boolean}
		 */
		isKnownExternalService(src) {
			const externalServices = [
				'youtube.com', 'youtu.be', 'vimeo.com',
				'google.com', 'maps.google.com', 'googleapis.com',
				'facebook.com', 'twitter.com', 'instagram.com',
				'kakao.com', 'naver.com'
			];

			return externalServices.some(service => src.includes(service));
		}

		/**
		 * iframe 문서에 메인 문서의 접근성 설정을 복사하고 CSS 주입·요소 마킹을 수행합니다
		 * @param {Document} iframeDoc - iframe 문서
		 * @param {string} iframeId - 식별자 (로그용)
		 * @returns {void}
		 */
		applyStylesToIframeDocument(iframeDoc, iframeId) {
			const documentElement = iframeDoc.documentElement;

			// 메인 문서의 data 속성들을 iframe에도 적용
			const styleAttributes = [
				'fontSize', 'fontFamily', 'txtAlign',
				'letterSpacing', 'lineHeight', 'colorTheme',
				'saturation', 'screenScale', 'hideImg', 'stopAni'
			];

			styleAttributes.forEach(attr => {
				const value = document.documentElement.dataset[attr];
				if (value && value !== 'initial') {
					documentElement.dataset[attr] = value;
				}
			});

			// 폰트 패밀리 직접 적용
			if (document.documentElement.style.fontFamily) {
				documentElement.style.fontFamily = document.documentElement.style.fontFamily;
			}

			// CSS 파일 주입
			this.injectCSSToIframe(iframeDoc, iframeId);

			// 동적 스타일 요소 마킹
			this.markDynamicStyledElementsInIframe(iframeDoc, iframeId);
		}

		/**
		 * 메인 문서의 CSS 링크를 iframe 문서에 주입합니다 (data-wat-injected로 추적, 중복 방지)
		 * @param {Document} iframeDoc - iframe 문서
		 * @param {string} iframeId - 식별자 (로그용)
		 * @returns {void}
		 */
		injectCSSToIframe(iframeDoc, iframeId) {
			try {
				const cssLink = document.querySelector(`link[href*="${Constants.PATHS.CSS_FILE}"]`);
				if (cssLink && !iframeDoc.querySelector(`link[href*="${Constants.PATHS.CSS_FILE}"]`)) {
					const iframeCssLink = iframeDoc.createElement('link');
					iframeCssLink.rel = 'stylesheet';
					iframeCssLink.href = cssLink.href;
					iframeCssLink.setAttribute('data-wat-injected', 'true');
					iframeDoc.head.appendChild(iframeCssLink);
					if (WAT_DEBUG_ENABLED$1) ;
				}
			} catch (error) {
				console.warn(`[WAT] CSS injection failed: ${iframeId}`, error.message);
			}
		}

		/**
		 * iframe 내부 텍스트 요소를 동적 스타일링 대상으로 마킹하고 원본 스타일을 기록합니다
		 * @param {Document} iframeDoc - iframe 문서
		 * @param {string} iframeId - 식별자 (로그용)
		 * @returns {void}
		 */
		markDynamicStyledElementsInIframe(iframeDoc, iframeId) {
			try {
				const styleProps = [
					{ css: 'font-size', className: 'wat-dyn-fontsize', px: true },
					{ css: 'letter-spacing', className: 'wat-dyn-letterspacing', px: true },
					{ css: 'line-height', className: 'wat-dyn-lineheight', px: true },
					{ css: 'text-align', className: 'wat-dyn-textalign', px: false }
				];

				// iframe 내부에서도 excludeSelector 적용
				const excludeSelectors = ['.wat-container', '.wat-container *'];

				// 사용자 설정 excludeSelector 추가
				if (this.plugin.excludeSelector) {
					const userExcludes = this.plugin.excludeSelector.split(',').map(s => s.trim());
					userExcludes.forEach(exclude => {
						if (exclude) {
							excludeSelectors.push(exclude, `${exclude} *`);
						}
					});
				}

				excludeSelectors.push('.wat-exclude', '.wat-exclude *');

				const notSelector = excludeSelectors.length > 0 ? `:not(${excludeSelectors.join('):not(')})` : '';

				const selector = `*${notSelector}`;
				// 사용자 excludeSelector가 잘못된 CSS면 전체가 죽지 않도록 방어 (메인 문서 버전과 동일)
				let elements;
				try {
					elements = iframeDoc.querySelectorAll(selector);
				} catch (e) {
					console.warn(`[WAT] iframe excludeSelector가 유효하지 않아 제외 없이 진행합니다: ${iframeId}`, e.message);
					elements = iframeDoc.querySelectorAll('*');
				}

				elements.forEach(el => {
					// iframe 내부에서도 제외 검증
					if (this.shouldExcludeElementInIframe(el, iframeDoc)) {
						return;
					}

					if (!el.textContent.trim()) return;

					let hasDynamic = false;
					const origStyles = {};
					// 요소당 getComputedStyle 1회로 축소 (성능 — 대형 iframe 프리즈 방지)
					const computed = el.ownerDocument.defaultView.getComputedStyle(el);

					styleProps.forEach(({ css, className, px }) => {
						const elVal = computed.getPropertyValue(css);

						let value = elVal;
						if (px && value) {
							const pxValue = this.getPxValueFromIframe(el, css, computed);
							if (pxValue) value = pxValue;
						}
						origStyles[css] = value;
						el.classList.add('wat-dyn-el', className);
						hasDynamic = true;
					});

					if (hasDynamic) {
						this.plugin._originalStyleMap.set(el, origStyles);
					}
				});

				if (WAT_DEBUG_ENABLED$1) ;
			} catch (error) {
				console.warn(`[WAT] iframe element marking failed: ${iframeId}`, error.message);
			}
		}

		/**
		 * iframe 내부 요소가 스타일링 제외 대상인지 판단합니다
		 * @param {Element} element - iframe 내부 요소
		 * @param {Document} iframeDoc - iframe 문서 컨텍스트
		 * @returns {boolean} 제외 대상이면 true
		 */
		shouldExcludeElementInIframe(element, iframeDoc) {
			// wat-exclude 클래스 확인
			if (element.classList.contains('wat-exclude') || element.closest('.wat-exclude')) {
				return true;
			}

			// 사용자 설정 excludeSelector 확인
			if (this.plugin.excludeSelector) {
				const userExcludes = this.plugin.excludeSelector.split(',').map(s => s.trim());
				for (const exclude of userExcludes) {
					if (exclude) {
						try {
							if (element.matches(exclude) || element.closest(exclude)) {
								return true;
							}
						} catch (error) {
							// 선택자 오류 시 무시
						}
					}
				}
			}

			return false;
		}

		/**
		 * iframe 컨텍스트에서 CSS 속성 값을 px로 환산합니다 (em/rem 지원)
		 * @param {Element} el - 대상 요소
		 * @param {string} prop - CSS 속성명
		 * @param {CSSStyleDeclaration} [computed] - 호출자가 이미 계산한 computed 스타일 (재사용으로 리플로우 절감)
		 * @returns {number|string} px 값 또는 빈 문자열
		 */
		getPxValueFromIframe(el, prop, computed) {
			try {
				const cs = computed || el.ownerDocument.defaultView.getComputedStyle(el);
				const val = cs.getPropertyValue(prop);
				if (!val) return '';
				if (prop === 'line-height' && val === 'normal') return '';
				if (val.endsWith('px')) return parseFloat(val);
				if (val.endsWith('em') || val.endsWith('rem')) {
					const base = parseFloat(cs.fontSize);
					return parseFloat(val) * base;
				}
				return parseFloat(val) || '';
			} catch (error) {
				return '';
			}
		}

		// ========== iframe Sync ==========

		/**
		 * 스타일 변경을 모든 접근 가능한 iframe에 동기화합니다
		 * @param {string} styleType - 스타일 타입 ('fontSize', 'lineHeight' 등)
		 * @param {string} value - 적용할 값
		 * @returns {void}
		 */
		syncStyleToIframes(styleType, value) {
			const iframes = document.querySelectorAll('iframe');
			let processedCount = 0;

			iframes.forEach((iframe) => {
				// iframe이 제외 영역에 있는지 확인
				if (this.isIframeInExcludeZone(iframe)) {
					return;
				}

				try {
					const iframeDoc = iframe.contentDocument;
					if (iframeDoc) {
						this.applyStyleToIframeDocument(iframeDoc, styleType, value);
						processedCount++;
					}
				} catch (error) {
					// 크로스 오리진은 조용히 스킵
				}
			});
		}

		/**
		 * 개별 iframe 문서에 특정 스타일을 적용합니다 (data 속성 + 동적 모드 시 인라인 스타일)
		 * @param {Document} iframeDoc - iframe 문서
		 * @param {string} styleType - 스타일 타입
		 * @param {string} value - 값
		 * @returns {void}
		 */
		applyStyleToIframeDocument(iframeDoc, styleType, value) {
			const documentElement = iframeDoc.documentElement;

			// data 속성 설정
			documentElement.dataset[styleType] = value;

			// 폰트 패밀리는 직접 스타일도 적용
			if (styleType === 'fontFamily') {
				if (value === 'initial') {
					documentElement.style.fontFamily = '';
				} else {
					documentElement.style.fontFamily = this.plugin.getFontFamily(value);
				}
			}

			// 동적 스타일 적용
			if (this.plugin.styleMode === 'dynamic') {
				this.applyDynamicStyleToIframe(iframeDoc, styleType, value);
			}
		}

		/**
		 * 스타일 타입에 따라 적절한 동적 적용 메서드로 라우팅합니다
		 * @param {Document} iframeDoc - iframe 문서
		 * @param {string} styleType - 스타일 타입
		 * @param {string} value - 값
		 * @returns {void}
		 */
		applyDynamicStyleToIframe(iframeDoc, styleType, value) {
			if (styleType === 'fontSize') {
				this.applyDynamicFontSizeToIframe(iframeDoc, value);
			} else if (styleType === 'lineHeight') {
				this.applyDynamicLineHeightToIframe(iframeDoc, value);
			} else if (styleType === 'letterSpacing') {
				this.applyDynamicLetterSpacingToIframe(iframeDoc, value);
			}
		}

		/**
		 * iframe 내 마킹된 요소들에 동적 폰트 크기를 적용합니다
		 * @param {Document} iframeDoc - iframe 문서
		 * @param {string} size - 폰트 크기 키
		 * @returns {void}
		 */
		applyDynamicFontSizeToIframe(iframeDoc, size) {
			const elements = iframeDoc.querySelectorAll('.wat-dyn-fontsize');

			if (size === 'initial' || size === 'unset') {
				elements.forEach(el => {
					el.style.removeProperty('font-size');
				});
				return;
			}

			const ratio = this.plugin.fontSizeRatios[size] || 1;

			elements.forEach(el => {
				const orig = this.plugin._originalStyleMap.get(el);
				const origPx = orig && parseFloat(orig['font-size']);
				if (origPx) {
					el.style.setProperty('font-size', (origPx * ratio) + 'px', 'important');
				}
			});
		}

		/**
		 * iframe 내 마킹된 요소들에 동적 줄간격을 적용합니다
		 * @param {Document} iframeDoc - iframe 문서
		 * @param {string} height - 줄간격 키
		 * @returns {void}
		 */
		applyDynamicLineHeightToIframe(iframeDoc, height) {
			const elements = iframeDoc.querySelectorAll('.wat-dyn-lineheight');

			if (height === 'initial' || height === 'unset') {
				elements.forEach(el => {
					el.style.removeProperty('line-height');
				});
				return;
			}

			const ratio = this.plugin.lineHeightRatios[height] || 1;

			elements.forEach(el => {
				// fontSize 버전과 동일하게 null 가드 — 원본 맵 미등록 요소에서 TypeError로 전체 중단 방지
				const orig = this.plugin._originalStyleMap.get(el);
				const origPx = orig && parseFloat(orig['line-height']);
				if (origPx) {
					el.style.setProperty('line-height', (origPx * ratio) + 'px', 'important');
				}
			});
		}

		/**
		 * iframe 내 마킹된 요소들에 동적 자간을 적용합니다 (원본 미기록 시 폰트 크기 기반 폴백)
		 * @param {Document} iframeDoc - iframe 문서
		 * @param {string} spacing - 자간 키
		 * @returns {void}
		 */
		applyDynamicLetterSpacingToIframe(iframeDoc, spacing) {
			const elements = iframeDoc.querySelectorAll('.wat-dyn-letterspacing');

			if (spacing === 'initial' || spacing === 'unset') {
				elements.forEach(el => {
					el.style.removeProperty('letter-spacing');
				});
				return;
			}

			const ratio = this.plugin.letterSpacingRatios[spacing] || 1;

			elements.forEach(el => {
				const orig = this.plugin._originalStyleMap.get(el);
				const rawLs = orig && orig['letter-spacing'];
				const origPx = rawLs != null && rawLs !== '' ? parseFloat(String(rawLs)) : NaN;
				let valuePx;
				if (Number.isFinite(origPx)) {
					valuePx = origPx * ratio;
				} else {
					const fontSize = parseFloat(el.ownerDocument.defaultView.getComputedStyle(el).fontSize);
					const baseSpacing = fontSize * 0.05;
					valuePx = baseSpacing * ratio;
				}
				el.style.setProperty('letter-spacing', valuePx + 'px', 'important');
			});
		}

		// ========== iframe Management ==========

		/**
		 * 기존 iframe 처리 + 신규 iframe 감시를 시작합니다 (init 시 1회)
		 * @returns {void}
		 */
		setupIframeHandling() {

			// 기존 iframe들 처리
			this.applyStylesToIframes();

			// 새로 추가되는 iframe 감지
			this.setupIframeMutationObserver();
		}

		/**
		 * 새로 추가되는 iframe을 감지하는 MutationObserver를 설정합니다
		 * @returns {void}
		 */
		setupIframeMutationObserver() {
			const observer = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							if (node.tagName === 'IFRAME') {
								this.handleNewIframe(node);
							} else {
								// 새로 추가된 요소 내부의 iframe들도 확인
								const iframes = node.querySelectorAll && node.querySelectorAll('iframe');
								if (iframes) {
									iframes.forEach(iframe => {
										this.handleNewIframe(iframe);
									});
								}
							}
						}
					});
				});
			});

			observer.observe(document.body, {
				childList: true,
				subtree: true
			});

			this.plugin._observers.set('iframe', observer);
		}

		/**
		 * 새로 감지된 iframe을 로드 완료 후 처리 예약합니다
		 * @param {HTMLIFrameElement} iframe - 새 iframe
		 * @returns {void}
		 */
		handleNewIframe(iframe) {
			const iframeId = iframe.id || `new-iframe-${Date.now()}`;

			// 새 iframe도 제외 영역 확인
			if (this.isIframeInExcludeZone(iframe)) {
				console.log(`🚫 새 iframe이 excludeSelector 내부에 있어 제외: ${iframeId}`);
				return;
			}

			// iframe 로드 완료 대기 — HTMLIFrameElement에는 complete/readyState가 없으므로 contentDocument로 판정
			let alreadyLoaded = false;
			try {
				alreadyLoaded = !!(iframe.contentDocument && iframe.contentDocument.readyState === 'complete');
			} catch (e) {
				// cross-origin — load 이벤트 대기로 폴백
			}
			if (alreadyLoaded) {
				// 이미 로드된 경우 바로 처리 (추적형 타이머 — destroy 후 재주입 방지)
				this.plugin._setTimeout(() => this.processNewIframe(iframe), 100);
			} else {
				// 로드 완료 대기 (cleanup 이후 발화 시 재주입 방지 가드 포함)
				iframe.addEventListener('load', () => {
					if (this.plugin._destroyed) return;
					this.plugin._setTimeout(() => this.processNewIframe(iframe), 100);
				}, { once: true });
			}
		}

		/**
		 * 새 iframe에 접근성 스타일을 적용합니다
		 * @param {HTMLIFrameElement} iframe - 새 iframe
		 * @returns {void}
		 */
		processNewIframe(iframe) {
			const iframeId = iframe.id || `new-iframe-${Date.now()}`;

			try {
				const iframeDoc = iframe.contentDocument;
				if (iframeDoc) {
					this.applyStylesToIframeDocument(iframeDoc, iframeId);
				}
			} catch (error) {
				const src = iframe.src || '';
				if (this.isKnownExternalService(src)) {
					console.log(`ℹ️ 새 외부 서비스 iframe 스킵: ${iframeId} (${src})`);
				} else {
					console.warn(`⚠️ 새 크로스 오리진 iframe 처리 불가: ${iframeId} (${src})`);
				}
			}
		}

		/**
		 * 플러그인이 iframe들에 주입한 CSS를 모두 제거합니다 (cleanup 시)
		 * @returns {void}
		 */
		removeInjectedCSS() {
			const iframes = document.querySelectorAll('iframe');
			let removedCount = 0;
			let excludedCount = 0;

			iframes.forEach(iframe => {
				// 제외 영역에 있는 iframe은 처리하지 않음
				if (this.isIframeInExcludeZone(iframe)) {
					excludedCount++;
					return;
				}

				try {
					const iframeDoc = iframe.contentDocument;
					if (iframeDoc) {
						const injectedCSS = iframeDoc.querySelectorAll('link[data-wat-injected="true"]');
						injectedCSS.forEach(link => {
							link.remove();
							removedCount++;
						});
					}
				} catch (error) {
					// 크로스 오리진은 조용히 스킵
				}
			});

			if (removedCount > 0) {
				console.log(`✅ ${removedCount}개 iframe에서 주입된 CSS 제거 완료 (제외: ${excludedCount}개)`);
			}
		}
	}

	/**
	 * @fileoverview 외부 유래 URL의 안전성 검증 유틸 (WAT.js/Dictionary.js 공용)
	 * @module src/core/safeUrl
	 */

	/**
	 * config 등 외부 유래 URL의 스킴을 검증합니다 — javascript: 등 위험 스킴 차단
	 * @param {string} url - 검증할 URL
	 * @returns {boolean} http(s) URL이면 true
	 */
	function isSafeHttpUrl(url) {
		if (typeof url !== 'string' || !url) return false;
		try {
			const parsed = new URL(url, typeof document !== 'undefined' ? document.baseURI : undefined);
			return parsed.protocol === 'https:' || parsed.protocol === 'http:';
		} catch (e) {
			return false;
		}
	}

	/**
	 * @fileoverview Dictionary - 선택 텍스트 사전 검색 기능 담당
	 * @module src/wat/Dictionary
	 * @description WAT.js에서 추출된 사전 클러스터 (Phase 6-2).
	 *              검색어 정제(조사 제거)·서버 요청·결과 모달·알림을 담당한다.
	 *              보안(S-1): fetch+JSON(CORS)을 우선 사용하고, 서버가 지원하지 않을 때만
	 *              JSONP로 폴백한다 (JSONP는 응답을 스크립트로 실행하므로 deprecated).
	 */

	class Dictionary {
		/**
		 * @param {Object} plugin - WAT 인스턴스 (config·로케일·상태·알림·포커스트랩 서비스 제공자)
		 */
		constructor(plugin) {
			this.plugin = plugin;
			// 세션 내 전송 방식 캐시 — 'json' | 'jsonp' | null(미확정)
			this._transport = null;
		}

		/**
		 * 선택된 단어를 정제(조사 제거)하고 사전 검색을 수행합니다
		 * @param {string} word - 검색할 단어
		 * @returns {Promise<void>}
		 */
		async performDiction(word) {
			word = word.trim();
			if (!word) return;

			// Dispatch dictionary search start event
			this.plugin._dispatchStateEvent('dictionary:searchStarted', {
				searchTerm: word,
				timestamp: Date.now()
			});

			// Wait for configuration to be loaded
			await this.plugin._waitForConfig();

			// 고유명사 예외 패턴 (예: "경상북도", "경상남도" 등)
			const properNounPatternStr = this.plugin.getLocalizedText('patterns.properNoun.list');
			const properNounPattern = new RegExp(properNounPatternStr + '$');

			// 조사 제거를 위한 정규식 패턴
			const particlesPatternStr = this.plugin.getLocalizedText('patterns.particles.list');
			const particlesPattern = new RegExp(particlesPatternStr + '$');

			// 고유명사 예외 처리
			let cleanedWord = word;
			if (!properNounPattern.test(word)) {
				// 단어에서 조사 제거
				cleanedWord = word.replace(particlesPattern, '');
			}

			// Get configuration-based endpoint and settings
			const serverEndpoint = this.plugin.getConfigValue('api.dictionary.serverEndpoint', null);

			// Check if dictionary endpoint is configured
			if (!serverEndpoint) {
				this._showDictionaryError(cleanedWord, this.plugin.getLocalizedText('msg.error.dictionaryServerNotConfigured') || '사전 검색 서버가 설정되지 않았습니다.');
				return;
			}

			// JSONP 폴백은 응답을 <script>로 실행하므로 endpoint를 https로 제한 (임의 코드 실행/MITM 방지)
			if (!isSafeHttpUrl(serverEndpoint) || !/^https:/i.test(serverEndpoint)) {
				console.error('[WAT] 사전 serverEndpoint는 https URL이어야 합니다:', serverEndpoint);
				this._showDictionaryError(cleanedWord, this.plugin.getLocalizedText('msg.error.dictionaryServerInvalid') || '사전 검색 서버 주소가 올바르지 않습니다. (https 필요)');
				return;
			}

			const timeout = this.plugin.getConfigValue('api.dictionary.timeout', 10000);

			try {
				const data = await this._fetchDictionaryData(serverEndpoint, {
					word: cleanedWord
				}, timeout);

				// 데이터 처리
				if (data && data.items && data.items.length > 0) {
					this.displayDictionResult(data.items[0]);

					// Dispatch dictionary search success event
					this.plugin._dispatchStateEvent('dictionary:searchSuccess', {
						searchTerm: cleanedWord,
						originalTerm: word,
						result: data.items[0],
						timestamp: Date.now()
					});
				} else {
					this._showDictionaryNotFound(cleanedWord);

					// Dispatch dictionary search not found event
					this.plugin._dispatchStateEvent('dictionary:searchNotFound', {
						searchTerm: cleanedWord,
						originalTerm: word,
						timestamp: Date.now()
					});
				}

			} catch (error) {
				ErrorHandler.handle(error, {
					category: ErrorHandler.CATEGORIES.NETWORK,
					severity: ErrorHandler.SEVERITY.ERROR,
					method: 'performDiction',
					component: 'Dictionary',
					data: {
						word: cleanedWord,
						serverEndpoint: serverEndpoint
					}
				});

				// Show error message to user
				this._showDictionaryError(cleanedWord, error.message);

				// Dispatch dictionary search error event
				this.plugin._dispatchStateEvent('dictionary:searchError', {
					searchTerm: cleanedWord,
					originalTerm: word,
					error: error.message,
					timestamp: Date.now()
				});
			}
		}

		/**
		 * 사전 데이터를 요청합니다 — fetch+JSON(CORS) 우선, 실패 시 JSONP 폴백 (S-1 보안 개선)
		 * @private
		 * @param {string} url - 서버 엔드포인트 (https)
		 * @param {Object} params - 요청 파라미터
		 * @param {number} timeout - 타임아웃(ms)
		 * @returns {Promise<Object>} 응답 데이터
		 * @description JSON+CORS 응답은 스크립트로 실행되지 않아 서버 침해·MITM 시에도
		 *              호스트 페이지 코드 실행으로 이어지지 않는다. 서버가 JSON을 지원하지
		 *              않으면 기존 JSONP 계약으로 폴백하되 deprecated 경고를 남긴다.
		 *              세션 내 성공한 전송 방식을 캐시해 이중 요청을 반복하지 않는다.
		 */
		async _fetchDictionaryData(url, params, timeout) {
			if (this._transport !== 'jsonp') {
				try {
					const queryParams = new URLSearchParams(params);
					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), timeout);
					try {
						const response = await fetch(`${url}?${queryParams.toString()}`, {
							signal: controller.signal,
							headers: { 'Accept': 'application/json' }
						});
						if (response.ok) {
							const contentType = response.headers.get('content-type') || '';
							if (contentType.includes('json')) {
								const data = await response.json();
								this._transport = 'json';
								return data;
							}
						}
					} finally {
						clearTimeout(timeoutId);
					}
				} catch (e) {
					// CORS 미지원/네트워크 오류 — JSONP 폴백 시도
				}
				console.warn('[WAT] 사전 서버가 JSON+CORS로 응답하지 않아 JSONP로 폴백합니다. JSONP는 보안상 deprecated이며 서버를 JSON+CORS로 전환해주세요.');
				this._transport = 'jsonp';
			}
			return this._fetchJSONP(url, params, timeout);
		}

		/**
		 * JSONP 요청 구현 — 레거시 서버 계약용 폴백 (deprecated)
		 * @private
		 * @param {string} url - 요청할 URL
		 * @param {Object} params - 요청 파라미터
		 * @param {number} timeout - 타임아웃(ms)
		 * @returns {Promise<Object>} 응답 데이터
		 */
		_fetchJSONP(url, params = {}, timeout = 10000) {
			return new Promise((resolve, reject) => {
				// 고유한 콜백 함수명 생성
				const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

				// 타임아웃 타이머
				const timeoutId = setTimeout(() => {
					cleanup();
					reject(new Error('Dictionary request timeout'));
				}, timeout);

				// 정리 함수
				const cleanup = () => {
					clearTimeout(timeoutId);
					if (window[callbackName]) {
						try {
							delete window[callbackName];
						} catch (e) {
							window[callbackName] = undefined;
						}
					}
					if (script && script.parentNode) {
						script.parentNode.removeChild(script);
					}
				};

				// 전역 콜백 함수 등록
				window[callbackName] = (data) => {
					cleanup();

					// 데이터 검증
					if (data) {
						resolve(data);
					} else {
						reject(new Error('No data returned from dictionary API'));
					}
				};

				// URL 파라미터 구성 (콜백 함수명 포함)
				const queryParams = new URLSearchParams(params);
				queryParams.append('callback', callbackName);  // 서버가 이 콜백 함수명으로 응답해야 함
				const fullUrl = `${url}?${queryParams.toString()}`;

				// Script 태그 생성 및 추가
				const script = document.createElement('script');
				script.type = 'text/javascript';
				script.src = fullUrl;
				script.async = true;

				script.onerror = () => {
					cleanup();
					reject(new Error('Failed to load dictionary data. Network error or invalid response.'));
				};

				// 스크립트를 DOM에 추가하여 요청 시작
				document.head.appendChild(script);
			});
		}

		/**
		 * 사전 검색 결과를 접근성 모달(포커스 트랩·오버레이·aria-modal)로 표시합니다
		 * @param {Object} item - 검색 결과 항목 {title, description, [pronunciation], [link]}
		 * @returns {void}
		 */
		displayDictionResult(item) {
			// 현재 포커스를 가진 요소를 저장
			const previousFocusedElement = document.activeElement;

			// 기존 레이어 제거
			this.removeAllDictionLayers();

			// Get UI settings from configuration
			// config 실제 구조는 settings.ui.* — 잘못된 경로면 config 값이 항상 무시됨
			const modalWidth = this.plugin.getConfigValue('settings.ui.modalWidth', 600);
			const showPronunciation = this.plugin.getConfigValue('settings.ui.showPronunciation', true);

			// 배경 오버레이 생성 — 모달 뒤 콘텐츠와의 시각적 분리 (WCAG 4.1.2 배경 격리 보강).
			// 주의: body.overlay-active(position:fixed 스크롤 잠금)는 페이지를 최상단으로 점프시키므로
			// 본문 중간(선택 텍스트 위치)에서 열리는 사전 모달에는 사용하지 않는다 — CSS의
			// .wat-diction-overlay 규칙이 body 클래스 없이도 오버레이를 표시한다
			const overlay = document.createElement('div');
			overlay.classList.add('overlay', 'wat-overlay', 'wat-diction-overlay', 'wat-exclude');
			document.body.appendChild(overlay);

			// 새로운 레이어 생성
			const layer = document.createElement('div');
			layer.classList.add('wat-diction-result-layer', 'wat-exclude');
			layer.setAttribute('role', 'dialog');
			layer.setAttribute('aria-modal', 'true'); // 모달임을 명시 (배경과 분리, WCAG 4.1.2)
			layer.setAttribute('aria-labelledby', 'diction-result-title');
			layer.setAttribute('tabindex', '-1');

			// Apply configured width
			layer.style.maxWidth = `${modalWidth}px`;

			// 레이어 내용 구성 — 외부 API 응답은 textContent로만 삽입 (XSS 방지)
			const titleElement = document.createElement('h3');
			titleElement.id = 'diction-result-title';
			titleElement.textContent = item.title;
			layer.appendChild(titleElement);

			const descriptionElement = document.createElement('p');
			descriptionElement.textContent = item.description;
			layer.appendChild(descriptionElement);

			// Show pronunciation if enabled and available
			if (showPronunciation && item.pronunciation) {
				const pronunciationElement = document.createElement('div');
				pronunciationElement.className = 'wat-diction-pronunciation';
				const pronunciationLabel = document.createElement('strong');
				pronunciationLabel.textContent = `${this.plugin.getLocalizedText('dictionary.pronunciation')}:`;
				pronunciationElement.appendChild(pronunciationLabel);
				pronunciationElement.appendChild(document.createTextNode(` ${item.pronunciation}`));
				layer.appendChild(pronunciationElement);
			}

			// 링크는 http(s) 스킴만 허용 (javascript: URL 차단)
			if (item.link && isSafeHttpUrl(item.link)) {
				const linkIcon = document.createElement('span');
				linkIcon.textContent = '🔗';
				const linkElement = document.createElement('a');
				linkElement.href = item.link;
				linkElement.target = '_blank';
				linkElement.rel = 'noopener noreferrer';
				linkElement.appendChild(linkIcon);
				titleElement.appendChild(linkElement);
			}

			const closeButton = document.createElement('button');
			closeButton.textContent = this.plugin.getLocalizedText('tags.button.text.close');
			closeButton.addEventListener('click', () => {
				// 레이어·오버레이 제거 + 스크롤 잠금 정리(교차 모달 안전) + 포커스 복원 — OverlayManager로 통합
				this.plugin.overlayManager.teardown(layer, overlay);
				this.plugin.overlayManager.restoreFocus(previousFocusedElement);
			});
			layer.appendChild(closeButton);

			// 레이어를 문서에 추가하기 전, 레이어의 위치를 결정하기 위해 DOM에 추가
			document.body.appendChild(layer);

			// 모달 위치를 계산하고 조정하는 함수
			this._adjustModalPosition(layer, modalWidth);

			// 레이어가 열리면 포커스를 이동
			layer.focus();

			// 포커스 트래핑 — 공용 trapFocus 재사용 (Tab 순환 + Escape 닫기 + 오버레이 정리)
			this.plugin.trapFocus(layer, previousFocusedElement, overlay);
		}

		/**
		 * 사전 검색 기능을 켜거나 끕니다 (끌 때 열린 결과 레이어 정리)
		 * @returns {void}
		 */
		toggleDiction() {
			const currentState = this.plugin.state.get('plugin.isDictionEnabled');
			this.plugin.state.set('plugin.isDictionEnabled', !currentState);

			if (!this.plugin.state.get('plugin.isDictionEnabled')) {
				// 열려 있는 모든 검색 결과 레이어 제거
				this.removeAllDictionLayers();
			}
		}

		/**
		 * 모든 사전 결과 레이어와 오버레이를 제거합니다
		 * @returns {void}
		 */
		removeAllDictionLayers() {
			const layers = document.querySelectorAll('.wat-diction-result-layer');
			layers.forEach(layer => layer.remove());
			// 사전 모달의 배경 오버레이도 함께 정리 — 다른 모달(페이지 구조)의 오버레이가 남아 있으면 잠금 유지
			document.querySelectorAll('.wat-diction-overlay').forEach(el => el.remove());
			if (!document.querySelector('.wat-overlay')) {
				document.body.classList.remove('overlay-active');
			}
		}

		/**
		 * 사전 검색 오류를 사용자에게 알립니다
		 * @param {string} word - 검색했던 단어
		 * @param {string} errorMessage - 오류 메시지
		 * @private
		 */
		_showDictionaryError(word, errorMessage) {
			const prefix = this.plugin.getLocalizedText('msg.error.dictionarySearch') || '사전 검색 오류';
			this._showDictionaryMessage(`${prefix}: ${errorMessage}`, 'error');
		}

		/**
		 * 검색 결과 없음을 사용자에게 알립니다
		 * @param {string} word - 검색했던 단어
		 * @private
		 */
		_showDictionaryNotFound(word) {
			const message = this.plugin.getLocalizedText('msg.info.dictionaryNotFound', { word });
			this._showDictionaryMessage(message, 'info');
		}

		/**
		 * 사전 알림을 표시합니다 — plugin._notify 위임 (사전 전용 클래스는 CSS 호환용)
		 * @param {string} message - 메시지
		 * @param {string} type - 타입 ('error', 'info', 'success')
		 * @private
		 */
		_showDictionaryMessage(message, type = 'info') {
			this.plugin._notify(message, {
				type,
				duration: 5000,
				dismissible: true,
				extraClass: `wat-dictionary-notification wat-dictionary-notification--${type}`
			});
		}

		/**
		 * 모달이 뷰포트를 벗어나지 않도록 위치를 조정합니다 (선택 텍스트 위치 기준)
		 * @param {HTMLElement} modal - 모달 요소
		 * @param {number} modalWidth - 설정된 모달 너비
		 * @private
		 */
		_adjustModalPosition(modal, modalWidth) {
			try {
				// Get viewport dimensions
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				// Set initial modal styles
				modal.style.position = 'fixed';
				modal.style.width = `${Math.min(modalWidth, viewportWidth * 0.9)}px`;
				modal.style.maxHeight = '80vh';
				modal.style.overflow = 'auto';
				modal.style.zIndex = '9999';

				// Try to get selection position if available
				let targetRect = null;
				try {
					const selection = window.getSelection();
					if (selection.rangeCount > 0) {
						const range = selection.getRangeAt(0);
						targetRect = range.getBoundingClientRect();
					}
				} catch (e) {
					// Selection not available, use center positioning
					ErrorHandler.debugLog('Selection not available for modal positioning', e);
				}

				// Get modal dimensions after setting width
				const modalRect = modal.getBoundingClientRect();
				const modalWidth_actual = modalRect.width;
				const modalHeight_actual = modalRect.height;

				let left, top;

				if (targetRect && targetRect.width > 0) {
					// Position relative to selected text
					// Center horizontally relative to selection
					left = targetRect.left + (targetRect.width / 2) - (modalWidth_actual / 2);

					// Position below the selection with some spacing
					top = targetRect.bottom + 10;

					// If modal would go below viewport, position above selection
					if (top + modalHeight_actual > viewportHeight) {
						top = targetRect.top - modalHeight_actual - 10;
					}
				} else {
					// Center in viewport as fallback
					left = (viewportWidth - modalWidth_actual) / 2;
					top = (viewportHeight - modalHeight_actual) / 2;
				}

				// Ensure modal stays within horizontal bounds
				const margin = 20; // Minimum margin from edge
				if (left < margin) {
					left = margin;
				} else if (left + modalWidth_actual > viewportWidth - margin) {
					left = viewportWidth - modalWidth_actual - margin;
				}

				// Ensure modal stays within vertical bounds
				if (top < margin) {
					top = margin;
				} else if (top + modalHeight_actual > viewportHeight - margin) {
					top = viewportHeight - modalHeight_actual - margin;
				}

				// Apply final position
				modal.style.left = `${left}px`;
				modal.style.top = `${top}px`;
				modal.style.transform = 'none'; // Remove any transform that might interfere

				ErrorHandler.debugLog('Modal positioned', {
					modalWidth: modalWidth_actual,
					modalHeight: modalHeight_actual,
					finalPosition: { left, top },
					viewport: { width: viewportWidth, height: viewportHeight },
					targetRect: targetRect
				});

			} catch (error) {
				ErrorHandler.handle(error, {
					category: ErrorHandler.CATEGORIES.DOM_OPERATION,
					severity: ErrorHandler.SEVERITY.WARNING,
					method: '_adjustModalPosition',
					component: 'Dictionary'
				});

				// Fallback to center positioning
				modal.style.position = 'fixed';
				modal.style.top = '50%';
				modal.style.left = '50%';
				modal.style.transform = 'translate(-50%, -50%)';
				modal.style.maxWidth = '90vw';
				modal.style.maxHeight = '80vh';
			}
		}
	}

	/**
	 * @fileoverview PageStructure - 페이지 구조(제목/링크) 분석 다이얼로그 담당
	 * @module src/wat/PageStructure
	 * @description WAT.js에서 추출된 페이지 구조 클러스터 (Phase 6-3).
	 *              페이지의 제목 계층·링크 목록을 수집해 접근성 모달(role=dialog,
	 *              aria-modal, 포커스 트랩)로 표시한다. 메서드명의 structure_ 접두는
	 *              추출 과정에서 정규화됨 (createTabButton/createTabPanel).
	 */

	class PageStructure {
		/**
		 * @param {Object} plugin - WAT 인스턴스 (로케일·포커스트랩·자산 경로·셀렉터 서비스 제공자)
		 */
		constructor(plugin) {
			this.plugin = plugin;
		}

		/**
		 * 페이지 구조 분석 다이얼로그(제목/링크 탭)를 엽니다
		 * @returns {void}
		 */
		openPageStructure() {
			// 현재 포커스된 요소를 저장하여 다이얼로그 종료 후 복원
			const previousFocusedElement = document.activeElement;

			// DocumentFragment를 사용해 DOM 조작을 최소화
			const fragment = document.createDocumentFragment();
			const body = document.body;
			body.classList.add('overlay-active');

			// 오버레이 생성 및 추가 — 호스트 페이지의 .overlay와 구분되도록 플러그인 클래스 병기
			const overlay = document.createElement('div');
			overlay.classList.add('overlay', 'wat-overlay', 'wat-exclude');
			fragment.appendChild(overlay);

			// 모달 레이어 생성
			const layer = document.createElement('div');
			layer.id = 'pgStructure_layer';
			layer.classList.add('page-structure-layer', 'wat-exclude');
			layer.setAttribute('role', 'dialog');
			layer.setAttribute('aria-modal', 'true');
			layer.setAttribute('aria-labelledby', 'page-structure-title');
			layer.setAttribute('tabindex', '-1');

			// 타이틀 생성
			const layerTitle = document.createElement('h3');
			layerTitle.id = 'page-structure-title';
			layerTitle.textContent = this.plugin.getLocalizedText('panel.personal.options.pageStructure.title');
			layer.appendChild(layerTitle);

			// 탭 목록과 콘텐츠 컨테이너 생성
			const layerTabWrap = document.createElement('div');
			layerTabWrap.classList.add('tab-wrap');
			layerTabWrap.setAttribute('role', 'tablist');

			const layerContentWrap = document.createElement('div');
			layerContentWrap.classList.add('tab-content-wrap');

			// 탭 데이터 배열 (필요시 탭 추가 가능)
			const tabListData = [
				{ id: 'pgStruct_heading', text: this.plugin.getLocalizedText('panel.personal.options.pageStructure.text.tabList-heading') },
				{ id: 'pgStruct_link', text: this.plugin.getLocalizedText('panel.personal.options.pageStructure.text.tabList-link') }
			];

			// 탭 버튼과 탭 패널 생성
			tabListData.forEach((tab, index) => {
				const tabButton = this.createTabButton(tab, index);
				layerTabWrap.appendChild(tabButton);

				const tabPanel = this.createTabPanel(tab, index);
				layerContentWrap.appendChild(tabPanel);
			});

			layer.appendChild(layerTabWrap);
			layer.appendChild(layerContentWrap);

			// 닫기 버튼 생성
			const closeButton = document.createElement('button');
			closeButton.textContent = this.plugin.getLocalizedText('tags.button.text.close');
			closeButton.classList.add('btnClose');
			closeButton.addEventListener('click', () => {
				this.closePageStructure();
				this.plugin.overlayManager.restoreFocus(previousFocusedElement);
			});
			layer.appendChild(closeButton);

			fragment.appendChild(layer);
			body.appendChild(fragment);
			layer.focus();

			// 포커스 트랩 설정 (공용 프리미티브 재사용)
			this.plugin.trapFocus(layer, previousFocusedElement, overlay);
		}

		/**
		 * 다이얼로그용 탭 버튼을 생성합니다 (ARIA + 좌우 화살표 키 탐색)
		 * @param {Object} tab - {id, text}
		 * @param {number} index - 탭 인덱스 (0이 초기 선택)
		 * @returns {HTMLButtonElement}
		 */
		createTabButton(tab, index) {
			const tabButton = document.createElement('button');
			tabButton.classList.add('tab-title');
			tabButton.id = `${tab.id}_tab`;
			tabButton.setAttribute('role', 'tab');
			tabButton.textContent = tab.text;
			tabButton.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
			tabButton.setAttribute('tabindex', index === 0 ? '0' : '-1');
			tabButton.setAttribute('data-target-panel', `${tab.id}_panel`);

			tabButton.addEventListener('click', () => {
				// 모든 탭 버튼 업데이트
				const allTabs = tabButton.parentElement.querySelectorAll('.tab-title');
				allTabs.forEach(btn => {
					btn.setAttribute('aria-selected', 'false');
					btn.setAttribute('tabindex', '-1');
				});
				tabButton.setAttribute('aria-selected', 'true');
				tabButton.setAttribute('tabindex', '0');

				// 모든 탭 패널 업데이트
				const allPanels = tabButton.closest('.page-structure-layer').querySelectorAll('.tab-content');
				allPanels.forEach(panel => {
					panel.setAttribute('aria-hidden', 'true');
					panel.style.display = 'none';
				});
				const targetPanel = document.getElementById(`${tab.id}_panel`);
				targetPanel.setAttribute('aria-hidden', 'false');
				targetPanel.style.display = 'block';
				targetPanel.focus();
			});

			tabButton.addEventListener('keydown', (e) => {
				if (e.key === 'ArrowRight') {
					const nextTab = tabButton.nextElementSibling || tabButton.parentElement.firstElementChild;
					nextTab.focus();
				} else if (e.key === 'ArrowLeft') {
					const prevTab = tabButton.previousElementSibling || tabButton.parentElement.lastElementChild;
					prevTab.focus();
				}
			});

			return tabButton;
		}

		/**
		 * 페이지 구조 콘텐츠(제목 계층 또는 링크 목록) 탭 패널을 생성합니다
		 * @param {Object} tab - {id}
		 * @param {number} index - 패널 인덱스 (0이 초기 표시)
		 * @returns {HTMLDivElement}
		 * @description 도구 자신(this.plugin.selector 내부)과 숨김 요소(.blind 조상,
		 *              aria-hidden, hidden, display:none, visibility:hidden)는 제외한다
		 */
		createTabPanel(tab, index) {
			const tabPanel = document.createElement('div');
			tabPanel.classList.add('tab-content');
			tabPanel.id = `${tab.id}_panel`;
			tabPanel.setAttribute('role', 'tabpanel');
			tabPanel.setAttribute('aria-labelledby', `${tab.id}_tab`);
			tabPanel.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
			tabPanel.style.display = index === 0 ? 'block' : 'none';

			// 패널 내 목록 생성
			const panelList = document.createElement('ul');
			const selector = this.plugin.selector;

			if (tab.id === 'pgStruct_heading') {
				// 도구 컨테이너 내부에 있는 heading 태그 제외
				const allHeadings = document.querySelectorAll(
					`h1:not(${selector} h1), h2:not(${selector} h2), h3:not(${selector} h3), h4:not(${selector} h4), h5:not(${selector} h5), h6:not(${selector} h6)`
				);
				// heading 태그의 조상 중에 (해당 태그 자체를 제외하고) .blind, aria-hidden="true", hidden, display:none, visibility:hidden이 있는 경우 제외
				const headings = Array.from(allHeadings).filter(heading => this._isVisibleForListing(heading));

				headings.forEach(heading => {
					const li = document.createElement('li');
					// 개행, 탭 문자를 제거한 텍스트 추출
					let text = heading.textContent.replace(/[\r\n\t]/g, '');
					// 텍스트가 없으면 내부 img의 alt 속성 사용
					if (!text.trim()) {
						const img = heading.querySelector('img[alt]');
						if (img) {
							text = img.alt;
						}
					}
					li.textContent = text;
					li.classList.add('pgStruct_item', 'heading', heading.tagName.toLowerCase());
					li.appendChild(this._createMarkerButton());

					li.addEventListener('click', () => {
						this.closePageStructure();
						heading.scrollIntoView({ behavior: 'smooth' });
					});
					panelList.appendChild(li);
				});
			} else if (tab.id === 'pgStruct_link') {
				// 링크 모아보기: 도구 컨테이너 내부의 링크 제외
				const allLinks = document.querySelectorAll(`a:not(${selector} a)`);
				// 링크의 조상 중에 조건에 해당하는 요소가 있으면 제외
				const links = Array.from(allLinks).filter(link => this._isVisibleForListing(link));

				links.forEach(link => {
					const li = document.createElement('li');
					li.classList.add('pgStruct_item', 'link');

					const tag_a = document.createElement('a');
					// decodeURI는 '%' 포함 일반 텍스트에서 URIError를 던지므로 href에만 시도하고 실패 시 원문 사용
					let linkLabel = (link.textContent || '').trim();
					if (!linkLabel) {
						try {
							linkLabel = decodeURI(link.href);
						} catch (e) {
							linkLabel = link.href;
						}
					}
					tag_a.textContent = linkLabel;
					tag_a.href = link.href;
					tag_a.target = '_blank';
					tag_a.title = link.title || this.plugin.getLocalizedText('text.newWindow');
					tag_a.classList.add('pgStruct_link');

					const img_link = document.createElement('img');
					img_link.classList.add('img_icon', 'link');
					img_link.src = this.plugin._assetUrl('assets/images/icon_pgStructure_link.svg');
					img_link.alt = this.plugin.getLocalizedText('panel.personal.options.pageStructure.options.link');
					tag_a.appendChild(img_link);
					li.appendChild(tag_a);

					const btn_marker = this._createMarkerButton();
					btn_marker.addEventListener('click', () => {
						this.closePageStructure();
						link.scrollIntoView({ behavior: 'smooth' });
					});
					li.appendChild(btn_marker);
					panelList.appendChild(li);
				});
			}

			tabPanel.appendChild(panelList);
			return tabPanel;
		}

		/**
		 * 목록 대상 요소가 사용자에게 보이는지 판단합니다 (숨김 조상 검사)
		 * @param {Element} element - 검사할 요소
		 * @returns {boolean} 목록에 포함해도 되면 true
		 * @private
		 */
		_isVisibleForListing(element) {
			// 조상에 blind 클래스가 있는지 검사 (요소 자체에 blind 클래스가 있는 경우는 허용)
			const blindAncestor = element.closest('.blind');
			if (blindAncestor && blindAncestor !== element) {
				return false;
			}
			// 부모 요소부터 최상위까지 순회하며 검사
			let current = element.parentElement;
			while (current) {
				if (
					current.getAttribute('aria-hidden') === 'true' ||
					current.hasAttribute('hidden')
				) {
					return false;
				}
				const computedStyle = window.getComputedStyle(current);
				if (
					computedStyle.display === 'none' ||
					computedStyle.visibility === 'hidden'
				) {
					return false;
				}
				current = current.parentElement;
			}
			return true;
		}

		/**
		 * 항목 위치로 이동하는 마커 버튼(위치 표시 아이콘)을 생성합니다
		 * @returns {HTMLButtonElement}
		 * @private
		 */
		_createMarkerButton() {
			const btn_marker = document.createElement('button');
			btn_marker.classList.add('btn_marker');
			const markerLabel = this.plugin.getLocalizedText('panel.personal.options.pageStructure.options.marker');
			const img = document.createElement('img');
			img.classList.add('img_icon', 'marker');
			img.src = this.plugin._assetUrl('assets/images/icon_pgStructure_marker.svg');
			img.alt = markerLabel;
			btn_marker.appendChild(img);
			btn_marker.title = markerLabel;
			return btn_marker;
		}

		/**
		 * 페이지 구조 다이얼로그를 닫고 오버레이·스크롤 잠금을 정리합니다
		 * @returns {void}
		 */
		closePageStructure() {
			const layer = document.getElementById('pgStructure_layer');
			// 플러그인이 만든 오버레이만 제거 (호스트 페이지의 .overlay 오삭제 방지)
			const overlay = document.querySelector('.overlay.wat-overlay');
			// 레이어·오버레이 제거 + 스크롤 잠금 정리(교차 모달 안전) — OverlayManager로 통합.
			// (기존 무조건 해제 → 남은 .wat-overlay가 없을 때만 해제로 수렴)
			this.plugin.overlayManager.teardown(layer, overlay);
		}
	}

	/**
	 * @fileoverview HTML 이스케이프 유틸리티
	 * @module src/core/escapeHTML
	 */

	/**
	 * HTML 템플릿 문자열에 삽입되는 외부 유래 값(config 라벨 등)의 이스케이프 — XSS 방지
	 * @param {*} value - 이스케이프할 값 (null/undefined는 빈 문자열로)
	 * @returns {string} 이스케이프된 문자열
	 */
	function escapeHTML(value) {
		if (value === null || value === undefined) return '';
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/**
	 * @fileoverview PanelBuilder - 설정 패널 UI 항목 생성 담당
	 * @module src/wat/PanelBuilder
	 * @description WAT.js에서 추출된 패널 생성 클러스터 (Phase 6-6).
	 *              개인 옵션 18종은 개별 createXXXSettings 함수 대신
	 *              OPTION_DEFS 데이터 테이블 + buildOption 팩토리로 생성한다.
	 *              메서드명의 snake_case 지역 변수는 추출 과정에서 정규화됨.
	 */

	/**
	 * 개인 옵션 로케일 키 헬퍼 — panel.personal.options.<group>.options.<key>
	 * @param {string} group - 로케일 그룹명 (옵션명과 다를 수 있음: colorTheme→colorMode 등)
	 * @param {string} key - 옵션 값 키
	 * @returns {string} 로케일 키
	 */
	const optionLocaleKey = (group, key) => `panel.personal.options.${group}.options.${key}`;

	/**
	 * 개인 옵션 18종 정의 테이블.
	 * - type: createSettingsItem에 전달되는 입력 타입 (radio | checkbox | button)
	 * - group: 로케일 그룹명 (생략 시 옵션명과 동일)
	 * - items: 정적 옵션 목록. labelKey 생략 시 value를 로케일 키로 사용,
	 *          toggleKey가 있으면 label_toggle(상태 반전 라벨)을 생성
	 * - ratios: true면 플러그인의 <name>Ratios/<name>Options 설정 기반 동적 목록
	 *   (ratio가 false인 키 제외, 커스텀 label/checked/disabled 지원, initial 기본 선택)
	 * fontFamily는 FONT_FAMILY_OPTIONS 병합·웹폰트 로드가 필요해 별도 빌더를 사용한다.
	 */
	const OPTION_DEFS = {
		fontSize: { type: 'radio', ratios: true },
		fontFamily: { type: 'radio', fontFamily: true },
		screenScale: { type: 'radio', items: [
			{ value: 'initial' }, { value: 'scale-1p2x' }, { value: 'scale-1p5x' }, { value: 'scale-2x' }
		] },
		txtAlign: { type: 'radio', items: [
			{ value: 'initial' }, { value: 'left' }, { value: 'center' }, { value: 'right' }
		] },
		letterSpacing: { type: 'radio', ratios: true },
		lineHeight: { type: 'radio', ratios: true },
		colorTheme: { type: 'radio', group: 'colorMode', items: [
			{ value: 'initial' }, { value: 'light' }, { value: 'dark' }, { value: 'reverse' }
		] },
		saturation: { type: 'radio', items: [
			{ value: 'initial' }, { value: 'low' }, { value: 'high' }, { value: 'monochrome' }
		] },
		readGuide: { type: 'radio', items: [
			{ value: 'unset' }, { value: 'mask' }, { value: 'underline' }, { value: 'bigCursor' }
		] },
		imgDisplayMode: { type: 'radio', items: [
			{ value: 'initial' }, { value: 'hide' }, { value: 'convert' }
		] },
		mediaStop: { type: 'checkbox', group: 'mediaControl', items: [
			{ value: 'stop', toggleKey: 'play' }
		] },
		mediaMute: { type: 'checkbox', group: 'soundControl', items: [
			{ value: 'mute', toggleKey: 'unmute' }
		] },
		stopAni: { type: 'checkbox', group: 'animationControl', items: [
			{ value: 'stop', toggleKey: 'play' }
		] },
		pageScroll: { type: 'button', items: [
			{ value: 'toggle', labelKey: 'start', toggleKey: 'stop', addClass: 'btn_iconSet btn_toggle' },
			{ value: 'up', addClass: 'btn_iconSet btn_up' },
			{ value: 'down', addClass: 'btn_iconSet btn_down' }
		] },
		tts: { type: 'button', items: [
			{ value: 'toggle', labelKey: 'start', toggleKey: 'stop', addClass: 'btn_iconSet btn_toggle' },
			{ value: 'prev', disabled: true, addClass: 'btn_iconSet btn_prev' },
			{ value: 'next', disabled: true, addClass: 'btn_iconSet btn_next' },
			{ value: 'focus_toggle', labelKey: 'focus-start', addClass: 'btn_iconSet btn_toggle btn_focus' }
		] },
		stt: { type: 'button', items: [
			{ value: 'start' }
		] },
		diction: { type: 'checkbox', items: [
			{ value: 'on', toggleKey: 'off' }
		] },
		pageStructure: { type: 'button', items: [
			{ value: 'show', toggleKey: 'hide' }
		] }
	};

	class PanelBuilder {
		/**
		 * @param {Object} plugin - WAT 인스턴스 (로케일·요소 생성·설정 저장 등 서비스 제공자)
		 */
		constructor(plugin) {
			this.plugin = plugin;
		}

		/**
		 * 개인 옵션명으로 설정 항목 요소를 생성합니다 (OPTION_DEFS 테이블 기반)
		 * @param {string} optionName - 옵션명 ('fontSize', 'colorTheme' 등)
		 * @returns {HTMLLIElement} 설정 항목 리스트 요소
		 */
		buildOption(optionName) {
			const def = OPTION_DEFS[optionName];
			if (!def) {
				throw new Error(`[WAT] Unknown personal option: ${optionName}`);
			}
			const group = def.group || optionName;
			const title = this.plugin.getLocalizedText(`panel.personal.options.${group}.title`);

			let optionItems;
			if (def.ratios) {
				optionItems = this._buildRatioItems(optionName);
			} else if (def.fontFamily) {
				optionItems = this._buildFontFamilyItems();
			} else {
				optionItems = def.items.map(item => {
					const built = {
						value: item.value,
						label: this.plugin.getLocalizedText(optionLocaleKey(group, item.labelKey || item.value))
					};
					if (item.toggleKey) built.label_toggle = this.plugin.getLocalizedText(optionLocaleKey(group, item.toggleKey));
					if (item.disabled) built.disabled = true;
					if (item.addClass) built.addClass = item.addClass;
					return built;
				});
			}

			return this.createSettingsItem(def.type, title, optionName, optionItems);
		}

		/**
		 * 비율 설정 기반 옵션 목록 생성 (fontSize/letterSpacing/lineHeight 공통)
		 * @private
		 * @param {string} optionName - 옵션명
		 * @returns {Array<Object>} 옵션 목록
		 */
		_buildRatioItems(optionName) {
			const plugin = this.plugin;
			const ratios = plugin[`${optionName}Ratios`];
			const customOptions = plugin.options[`${optionName}Options`];
			const generateLabel = plugin[`generate${optionName.charAt(0).toUpperCase()}${optionName.slice(1)}Label`].bind(plugin);
			const optionItems = [];

			for (const [key, ratio] of Object.entries(ratios)) {
				if (ratio === false) continue;

				const customConfig = customOptions?.[key];
				let label = plugin.getLocalizedText(optionLocaleKey(optionName, key));
				let checked = false;
				let disabled = false;

				if (typeof customConfig === 'object') {
					label = customConfig.label || label || generateLabel(key, ratio);
					checked = customConfig.checked === true;
					disabled = customConfig.disabled === true;
				} else {
					label = label || generateLabel(key, ratio);
				}

				optionItems.push({
					value: key,
					label,
					checked: key === 'initial' ? true : checked,
					disabled
				});
			}

			return optionItems;
		}

		/**
		 * 폰트 패밀리 옵션 목록 생성 — 기본 FONT_FAMILY_OPTIONS와 사용자 옵션 병합,
		 * URL이 있는 웹폰트는 동적 로드
		 * @private
		 * @returns {Array<Object>} 옵션 목록
		 */
		_buildFontFamilyItems() {
			const plugin = this.plugin;
			const mergedFontOptions = {
				...FONT_FAMILY_OPTIONS,
				...plugin.options.fontFamily
			};
			const optionItems = [];

			for (const [fontName, fontConfig] of Object.entries(mergedFontOptions)) {
				// 명시적으로 비활성화(false)된 폰트만 제외 — enabled 생략은 활성으로 취급
				if (fontConfig === false || (typeof fontConfig === 'object' && fontConfig.enabled === false)) continue;

				// 웹폰트 URL이 있는 경우 동적으로 로드
				if (typeof fontConfig === 'object' && fontConfig.url) {
					plugin.loadWebFont(fontConfig.url);
				}

				optionItems.push({
					value: fontName,
					label: plugin.getLocalizedText(optionLocaleKey('fontFamily', fontName)) || fontConfig.label || fontName,
					// enabled(표시 여부)와 checked(선택 여부)는 별개 — 기본 선택은 'initial'만
					checked: fontName === 'initial'
				});
			}

			return optionItems;
		}

		/**
		 * 지정된 타입과 옵션으로 일반적인 설정 항목을 생성합니다
		 * @param {string} itemType - 입력 요소의 타입 ('radio', 'checkbox', 'button' 등)
		 * @param {string} titleText - 설정 항목의 제목 텍스트
		 * @param {string} optionName - 폼 요소의 name 속성
		 * @param {Array<Object>} optionItems - 옵션 설정 배열
		 * @returns {HTMLLIElement} 설정 UI가 포함된 리스트 아이템 요소
		 */
		createSettingsItem(itemType, titleText, optionName, optionItems) {
			const plugin = this.plugin;
			// config/로케일 유래 값이 innerHTML 템플릿에 삽입되므로 전부 이스케이프 (XSS 방지)
			titleText = escapeHTML(titleText);
			const itemsHtml = optionItems.map(item => {
				const elementId = escapeHTML(`${optionName}_${item.value}`);
				const itemLabel = escapeHTML(item.label);
				const toggleLabel = escapeHTML(item.label_toggle || '');
				const additionalClass = escapeHTML(item.addClass || '');
				const checkedAttr = item.checked ? 'checked' : '';
				const selectedClass = item.selected ? Constants.CSS_CLASSES.SELECTED : '';
				const disabledAttr = item.disabled ? 'disabled' : '';
				const itemStyle = escapeHTML(item.style || '');
				const itemValue = escapeHTML(item.value);
				const itemSrc = escapeHTML(item.src || '');
				const labelTitleAttr = itemLabel ? ` title="${itemLabel}"` : '';
				let htmlString = `
				<li class='opt_item wat-item-li'>
					<input type="${itemType}" class="wat-items wat-item-type-radio" id="wat-${itemType}-${elementId}" name="${optionName}" title="${titleText} ${itemLabel}" value="${itemValue}" ${checkedAttr} ${disabledAttr}><label for="wat-${itemType}-${elementId}"${labelTitleAttr}>${itemLabel}</label>
				</li>
				`;
				if (itemType === 'select') {
					htmlString = `
					<li class='opt_item'>
						<option class="wat-items wat-item-type-option" value="${itemValue}" ${selectedClass} ${disabledAttr}>${itemLabel}</option>
					</li>
					`;
				} else if (itemType === 'button') {
					let toggleAttr = '';
					if (toggleLabel) {
						toggleAttr = `data-stateText-on="${itemLabel}" data-stateText-off="${toggleLabel}"`;
					}
					htmlString = `
					<li class='opt_item' style="${itemStyle}">
						<button type="button" class="wat-items wat-item-type-button btn_basic ${additionalClass}" id="wat-${itemType}-${elementId}" name="${optionName}" value="${itemValue}" ${disabledAttr} ${toggleAttr} title="${titleText} ${itemLabel}">${itemLabel}</button>
					</li>
					`;
				} else if (itemType === 'buttonMix') {
					htmlString = `
					<li class='opt_item'>
						<button type="button" class="wat-items wat-item-type-button" id="wat-${itemType}-${elementId}" name="${optionName}" value="${itemValue}" ${disabledAttr}>${itemLabel}</button>
					</li>
					`;
				} else if (itemType === 'buttonImg') {
					htmlString = `
					<li class='opt_item'>
						<button type="button" class="wat-items wat-item-type-button btn_buttonImg ${additionalClass}" id="wat-${itemType}-${elementId}" name="${optionName}" value="${itemValue}" ${disabledAttr}><img src="${itemSrc}" alt="${itemLabel}"></button>
					</li>
					`;
				} else if (itemType === 'buttonImgSVG') {
					htmlString = `
					<li class='opt_item'>
						<button type="button" class="wat-items wat-item-type-button btn_buttonImgSVG ${additionalClass}" id="wat-${itemType}-${elementId}" name="${optionName}" value="${itemValue}" ${disabledAttr} title="${titleText} ${itemLabel}"><span class="icon-svg"></span></button>
					</li>
					`;
				} else if (itemType === 'checkbox') {
					htmlString = `
					<li class='opt_item'>
						<input type="${itemType}" class="wat-items wat-item-type-checkbox switch" id="wat-${itemType}-${optionName}" name="${optionName}" value="${itemValue}" title="${titleText} ${itemLabel}" role="switch" aria-checked="${item.checked ? 'true' : 'false'}" ${checkedAttr} ${disabledAttr}><label for="wat-${itemType}-${optionName}" class="switch-label">${itemLabel}</label>
						<span class="switch-state" data-stateText-on="${itemLabel}" data-stateText-off="${toggleLabel}">${itemLabel}</span>
					</li>
					`;
				}
				return htmlString;
			}).join('');
			const listItemElement = document.createElement('li');
			// .setTitle은 클릭 시 옵션을 순환/토글하는 버튼이므로 키보드 포커스 가능하게 tabindex 부여 (WCAG 2.1.1)
			let listItemInnerHTML = `
			<div class='setWrap'>
				<div class='setTitle' role='button' tabindex='0'>${titleText}</div>
				<div class='setCont'>
				`;
					if (itemType === 'radio') {
						listItemInnerHTML += `<button class='hidden btn_chgOpt prev' type='button' title="${titleText} ${plugin.getLocalizedText('tags.button.text.prevOpt')}" aria-label="${titleText} ${plugin.getLocalizedText('tags.button.text.prevOpt')}">${plugin.getLocalizedText('tags.button.text.prevOpt')}</button>`;
					}
					// 라디오 묶음에 그룹 시맨틱 부여 — 스크린리더가 그룹명·위치를 안내 (WCAG 1.3.1)
					const listGroupAttr = itemType === 'radio' ? ` role="radiogroup" aria-label="${titleText}"` : '';
					listItemInnerHTML += `<ul class='opt_lists'${listGroupAttr}>${itemsHtml}</ul>`;
					if (itemType === 'radio') {
						listItemInnerHTML += `<button class='hidden btn_chgOpt next' type='button' title="${titleText} ${plugin.getLocalizedText('tags.button.text.nextOpt')}" aria-label="${titleText} ${plugin.getLocalizedText('tags.button.text.nextOpt')}">${plugin.getLocalizedText('tags.button.text.nextOpt')}</button>`;
					}
					listItemInnerHTML += `</div>
			</div>
			`;
			listItemElement.innerHTML = listItemInnerHTML;

			// .setTitle 클릭 시 라디오 버튼 순차 선택 및 change 이벤트 트리거
			const setWrapElement = listItemElement.querySelector('.setWrap');
			const titleElement = setWrapElement.querySelector('.setTitle');
			const labelElement = setWrapElement.querySelector('.switch-label');

			// role="button"인 .setTitle을 키보드로도 활성화 (Enter/Space → 클릭) (WCAG 2.1.1)
			titleElement.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					titleElement.click();
				}
			});

			// 라디오 순환 선택 공통 처리 (제목 클릭/이전·다음 버튼)
			const cycleRadio = (direction) => {
				const radioElements = setWrapElement.querySelectorAll('.setCont input[type="radio"]');
				const targetIndex = plugin.getRadioTargetIndex(setWrapElement, direction);
				if (radioElements[targetIndex]) {
					radioElements[targetIndex].checked = true;
					// change 이벤트를 수동으로 트리거
					radioElements[targetIndex].dispatchEvent(new Event('change', { bubbles: true }));
				}
			};

			if (itemType === 'radio') {
				setWrapElement.classList.add('radio');
				titleElement.addEventListener('click', () => cycleRadio('next'));
				setWrapElement.querySelector('.btn_chgOpt.prev').addEventListener('click', () => cycleRadio('prev'));
				setWrapElement.querySelector('.btn_chgOpt.next').addEventListener('click', () => cycleRadio('next'));
			} else if (itemType === 'checkbox') {
				setWrapElement.classList.add('checkbox');
				const toggleCheckbox = () => {
					const checkboxElement = setWrapElement.querySelector('.setCont input[type="checkbox"]');
					checkboxElement.checked = !checkboxElement.checked;
					// change 이벤트를 수동으로 트리거
					checkboxElement.dispatchEvent(new Event('change', { bubbles: true }));
				};
				titleElement.addEventListener('click', toggleCheckbox);
				labelElement.addEventListener('click', toggleCheckbox);
			} else if (itemType === 'button') {
				setWrapElement.classList.add('button');
				titleElement.addEventListener('click', () => {
					const buttonElements = setWrapElement.querySelectorAll('.setCont button');
					const inputElements = setWrapElement.querySelectorAll('.setCont input[type="button"], .setCont input[type="image"], .setCont input[type="submit"]');

					// 첫 번째 button이 있으면 선택, 없으면 input[type="button" | "image" | "submit"] 중 첫 번째 요소 선택
					let targetButtonElement = buttonElements.length > 0 ? buttonElements[0] : (inputElements.length > 0 ? inputElements[0] : null);
					if (targetButtonElement.disabled || targetButtonElement.classList.contains('disabled') || targetButtonElement.style.display === 'none') {
						targetButtonElement = buttonElements.length > 1 ? buttonElements[1] : (inputElements.length > 1 ? inputElements[1] : null);
					}
					if (targetButtonElement) targetButtonElement.click();
				});
			} else if (itemType === 'buttonMix') {
				setWrapElement.classList.add('button', 'mixCont');
				titleElement.addEventListener('click', () => {
					const buttonElements = setWrapElement.querySelectorAll('.setCont button');
					const inputElements = setWrapElement.querySelectorAll('.setCont input[type="button"], .setCont input[type="image"], .setCont input[type="submit"]');

					// 첫 번째 button이 있으면 선택, 없으면 input[type="button" | "image" | "submit"] 중 첫 번째 요소 선택
					const targetButtonElement = buttonElements.length > 0 ? buttonElements[0] : (inputElements.length > 0 ? inputElements[0] : null);
					targetButtonElement.click();
				});
			}

			return listItemElement;
		}

		/**
		 * 설정 패널에 프로필 설정 섹션을 생성합니다
		 * @param {HTMLElement} container - 프로필 설정을 추가할 컨테이너 요소
		 * @returns {void}
		 * @description 각 접근성 프로필에 대한 토글과 개별 설정 옵션이 있는 프로필 선택 UI를 생성합니다
		 */
		createProfileSettings(container) {
			const plugin = this.plugin;
			const profileSettingTitleElement = plugin.createElementWithAttrs('h4', { class: 'watSet-group-title' });
			profileSettingTitleElement.textContent = plugin.getLocalizedText('panel.settings.profile.title');
			container.appendChild(profileSettingTitleElement);

			// ************************* Profile Lists .Start *************************
			const profileValues = Defaults.PROFILES;
			const profileContainerElement = plugin.createElementWithAttrs('div', { id: 'watSetWrap_profile', class: ['watSet-item-container', 'profile-container'] });
			const profileListElement = plugin.createElementWithAttrs('ul', { class: 'profileLists' });

			for (const profile in profileValues) {
				const profileItemElement = plugin.createElementWithAttrs('li', { class: 'profileItem' });
				const profileItemContainerElement = plugin.createElementWithAttrs('fieldset', { class: 'watSet-profile-item-container', 'data-profile': profile });
				const profileItemTitleElement = plugin.createElementWithAttrs('legend', { class: ['watSet-profile-title', 'profileItemTitle'] });
				const profileItemTitleLabelElement = plugin.createElementWithAttrs('label', { id: `watSet_profile_title_label_${profile}`, class: ['watSet-label', 'watSet-profile-title-label', `${profile}`], for: `watSet_profile_button_toggle_${profile}` });
				const profileTitleText = plugin.getLocalizedText(`panel.settings.profile.options.${profile}.title`);
				profileItemTitleLabelElement.textContent = profileTitleText;
				profileItemTitleElement.appendChild(profileItemTitleLabelElement);

				// ***** Button - Profile Options .Start *****
				// 옵션 열기/닫기는 disclosure 패턴 — aria-expanded + aria-controls,
				// 접근명은 "프로필명 + 옵션 열기"가 되도록 제목 라벨을 함께 참조
				const profileOptionsToggleButtonElement = plugin.createElementWithAttrs('button', { class: ['watSet-button', 'watSet-profile-button-accordion', 'btnType_1'], 'aria-expanded': 'false', 'aria-controls': `watSet_profile_items_wrap_${profile}`, title: `${profileTitleText} ${plugin.getLocalizedText('tags.button.attr.type.option')}`, 'aria-labelledby': `watSet_profile_title_label_${profile} watSet_profile_Opts_Label_${profile}` });
				const profileOptionsToggleLabelElement = plugin.createElementWithAttrs('span', { id: `watSet_profile_Opts_Label_${profile}`, class: 'watSet-button-label' });
				profileOptionsToggleLabelElement.textContent = plugin.getLocalizedText('tags.button.text.optionsOpen');
				profileOptionsToggleButtonElement.appendChild(profileOptionsToggleLabelElement);
				profileOptionsToggleButtonElement.addEventListener('click', (evt) => {
					const targetToggleElement = evt.target.closest('.watSet-profile-button-accordion');
					const profile = targetToggleElement.closest('.watSet-profile-item-container').getAttribute('data-profile');
					const isOn = targetToggleElement.getAttribute('aria-expanded') === 'true';
					const targetLabelElement = targetToggleElement.querySelector('.watSet-button-label');
					targetLabelElement.textContent = isOn ? plugin.getLocalizedText('tags.button.text.optionsOpen') : plugin.getLocalizedText('tags.button.text.optionsClose');
					targetToggleElement.setAttribute('aria-expanded', isOn ? 'false' : 'true');
					const profileInner = document.getElementById(`watSet_profile_items_wrap_${profile}`);
					if (isOn) {
						profileInner.classList.remove(Constants.CSS_CLASSES.ACTIVE);
						profileInner.setAttribute('aria-hidden', 'true');
						plugin._setTimeout(() => {
							targetToggleElement.closest('.watSet-profile-item-container').querySelector('.watSet-profile-button-accordion').focus();
						}, 100);
					} else {
						profileInner.classList.add(Constants.CSS_CLASSES.ACTIVE);
						profileInner.setAttribute('aria-hidden', 'false');
						plugin._setTimeout(() => {
							const focusableElements = profileInner.querySelectorAll('a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])');
							if (focusableElements.length > 0) {
								focusableElements[0].focus();
							} else {
								console.error('No focusable elements found inside profileInner');
							}
						}, 100);
					}
					targetToggleElement.classList.toggle(Constants.CSS_CLASSES.ACTIVE, !isOn);
				});
				profileItemTitleElement.appendChild(profileOptionsToggleButtonElement);
				// ***** Button - Profile Options .End   *****

				profileItemContainerElement.appendChild(profileItemTitleElement);

				// ***** Button - Profile Toggle Switch .Start *****
				// switch 역할의 상태는 aria-checked로 전달하고, 접근명은 프로필 제목 라벨을 참조
				// (상태 라벨 "꺼짐/켜짐"을 이름으로 쓰면 모든 토글의 접근명이 동일해진다)
				const profileToggle = plugin.createElementWithAttrs('button', {
					id: `watSet_profile_button_toggle_${profile}`,
					class: ['watSet-button', 'btn-toggleSwitch', 'profileToggle'],
					role: 'switch',
					'aria-checked': 'false',
					'data-profile': profile,
					title: `${profileTitleText} ${plugin.getLocalizedText('tags.button.attr.type.toggle')}`,
					'aria-labelledby': `watSet_profile_title_label_${profile}`
				});
				const profileToggleLabel = plugin.createElementWithAttrs('span', {
					id: `watSet_profileToggleLabel_${profile}`,
					class: 'watSet-button-label'
				});
				profileToggleLabel.textContent = plugin.getLocalizedText('tags.button.text.stateOff');
				profileToggle.appendChild(profileToggleLabel);
				profileToggle.addEventListener('click', (evt) => {
					const targetToggle = evt.target.closest('.profileToggle');
					const profile = targetToggle.getAttribute('data-profile');
					plugin.toggleProfile(profile, targetToggle);
				});
				// 토글은 제목바(legend) 안에 배치 — fieldset 직속 절대배치는 legend 아래 익명 콘텐츠
				// 박스를 기준으로 잡혀 제목바 밖(overflow:hidden 영역)으로 밀려 잘리기 때문 (CSS와 짝)
				profileItemTitleElement.appendChild(profileToggle);
				// ***** Button - Profile Toggle Switch .End   *****

				// ***** Container - Profile Options .Start *****
				const profileInner = plugin.createElementWithAttrs('div', { id: `watSet_profile_items_wrap_${profile}`, class: 'watSet-profile-items-wrap' });
				const profileListInner = plugin.createElementWithAttrs('ul', { class: 'watSet-profile-items-ul' });

				const profileItems = profileValues[profile].settings;
				for (const item in profileItems) {
					if (plugin.options[item] === false) continue;

					const profileListItem = plugin.createElementWithAttrs('li', { class: 'watSet-profile-item-li' });
					const input = plugin.createElementWithAttrs('input', { type: 'checkbox', class: ['watSet-checkbox', 'profileListItemInput'], id: `watSet_checkbox_${profile}_${item}`, name: `${profile}_${item}`, value: profileItems[item], 'data-key': item });
					input.checked = profileValues[profile].enabled[item];
					const label = plugin.createElementWithAttrs('label', { class: ['watSet_label', 'watSet-profile-item-label'], for: `watSet_checkbox_${profile}_${item}` });
					label.textContent = plugin.getLocalizedText(`panel.personal.options.${item}.title`);
					profileListItem.appendChild(input);
					profileListItem.appendChild(label);
					profileListInner.appendChild(profileListItem);
				}
				profileInner.appendChild(profileListInner);
				profileItemContainerElement.appendChild(profileInner);
				// ***** Container - Profile Options .End   *****

				profileItemElement.appendChild(profileItemContainerElement);
				profileListElement.appendChild(profileItemElement);
			}
			profileContainerElement.appendChild(profileListElement);
			container.appendChild(profileContainerElement);
			// ************************* Profile Lists .End   *************************
		}

		/**
		 * 위치, 뷰 모드, 언어, 저장 옵션을 포함한 도구 설정 섹션을 생성합니다
		 * @param {HTMLElement} container - 도구 설정을 추가할 컨테이너 요소
		 * @returns {void}
		 */
		createToolsSettings(container) {
			const plugin = this.plugin;
			const manageSettingTitle = plugin.createElementWithAttrs('h4', { class: 'watSet-group-title' });
			manageSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.title');
			container.appendChild(manageSettingTitle);

			// ************************* Tool Position Setting .Start *************************
			const toolPositionContainer = plugin.createElementWithAttrs('fieldset', { id: 'watSetWrap_position', class: ['watSet-item-container', 'tool-position-container'] });

			const toolPositionSettingTitle = plugin.createElementWithAttrs('legend', { class: 'watSet-title' });
			toolPositionSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.options.position.title');
			toolPositionContainer.appendChild(toolPositionSettingTitle);

			const toolPositionInner = plugin.createElementWithAttrs('div', { class: 'watSet-inner' });
			const toolPositionList = plugin.createElementWithAttrs('ul', { class: 'watSet-list' });
			const toolPositionItems = [
				{ id: 'watSet_postion_left', label: plugin.getLocalizedText('panel.settings.manage.options.position.options.left'), value: 'left', checked: false },
				{ id: 'watSet_postion_right', label: plugin.getLocalizedText('panel.settings.manage.options.position.options.right'), value: 'right', checked: true }
			];
			toolPositionItems.forEach(item => {
				const toolPositionItem = plugin.createElementWithAttrs('li', { class: 'watSet-item' });
				const input = plugin.createElementWithAttrs('input', { type: 'radio', id: item.id, class: ['wat-set-items', 'wat-set-item-type-radio'], name: 'toolPosition', value: item.value });
				input.checked = item.checked;
				input.onchange = () => {
					document.documentElement.dataset['watPosition'] = item.value;
					plugin.savePreferences();
				};
				const label = plugin.createElementWithAttrs('label', { for: item.id, class: 'wat-set-label' });
				label.textContent = item.label;
				toolPositionItem.appendChild(input);
				toolPositionItem.appendChild(label);
				toolPositionList.appendChild(toolPositionItem);
			});
			toolPositionInner.appendChild(toolPositionList);
			toolPositionContainer.appendChild(toolPositionInner);

			container.appendChild(toolPositionContainer);
			// ************************* Tool Position Setting .End   *************************

			// ************************* View Mode Setting .Start *************************
			const viewModeContainer = plugin.createElementWithAttrs('fieldset', { id: 'watSetWrap_viewMode', class: ['watSet-item-container', 'tool-viewMode-container'] });

			const viewModeSettingTitle = plugin.createElementWithAttrs('legend', { class: 'watSet-title' });
			viewModeSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.options.viewMode.title');
			viewModeContainer.appendChild(viewModeSettingTitle);

			const viewModeSettingInner = plugin.createElementWithAttrs('div', { class: 'watSet-inner' });
			const viewModeSettingList = plugin.createElementWithAttrs('ul', { class: 'watSet-list' });
			const viewModeSettingItems = [
				{ id: 'watSet_viewMode_icon', label: plugin.getLocalizedText('panel.settings.manage.options.viewMode.iconMode.title'), setMode: 'icon', checked: true },
				{ id: 'watSet_viewMode_list', label: plugin.getLocalizedText('panel.settings.manage.options.viewMode.listMode.title'), setMode: 'list', checked: false }
			];
			const storedSettings = localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS);
			let viewModeStoredValue = null;
			if (storedSettings) {
				try {
					const settings = JSON.parse(storedSettings);
					if (settings.viewMode) {
						viewModeStoredValue = settings.viewMode.toLowerCase();
					}
				} catch (e) {
					// JSON 파싱 에러 처리
					viewModeStoredValue = null;
				}
			}
			// "icon"과 "list" 외의 값은 무시
			if (viewModeStoredValue !== 'icon' && viewModeStoredValue !== 'list') {
				viewModeStoredValue = null;
			}
			viewModeSettingItems.forEach(item => {
				const viewModeSettingItem = plugin.createElementWithAttrs('li', { class: 'watSet-item' });
				const input = plugin.createElementWithAttrs('input', { type: 'radio', id: item.id, class: ['wat-set-items', 'wat-set-item-type-radio'], name: 'viewMode', value: item.setMode });
				input.checked = viewModeStoredValue ? (item.setMode === viewModeStoredValue) : item.checked;
				input.onchange = () => {
					plugin.updateViewMode(item.setMode);
				};
				const label = plugin.createElementWithAttrs('label', { for: item.id, class: 'wat-set-label' });
				label.textContent = item.label;
				viewModeSettingItem.appendChild(input);
				viewModeSettingItem.appendChild(label);
				viewModeSettingList.appendChild(viewModeSettingItem);
			});
			viewModeSettingInner.appendChild(viewModeSettingList);
			viewModeContainer.appendChild(viewModeSettingInner);

			container.appendChild(viewModeContainer);
			// ************************* View Mode Setting .End   *************************

			// ************************* Language Setting .Start *************************
			if (plugin.languageOptions && plugin.languageOptions.length > 1 && plugin.languageConfig?.showSelector !== false) {
				const languageContainer = plugin.createElementWithAttrs('fieldset', { id: 'watSetWrap_language', class: ['watSet-item-container', 'tool-language-container'] });

				const languageSettingTitle = plugin.createElementWithAttrs('legend', { class: 'watSet-title' });
				languageSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.options.language.title');
				languageContainer.appendChild(languageSettingTitle);

				const languageSettingInner = plugin.createElementWithAttrs('div', { class: 'watSet-inner' });
				const languageSettingList = plugin.createElementWithAttrs('ul', { class: 'watSet-list' });
				const languageSettingItems = plugin.languageOptions.map(lang => {
					return { id: `watSet_language_${lang}`, label: plugin.getLocalizedText(`panel.settings.manage.options.language.options.${lang}`), lang: lang, checked: plugin.language === lang };
				});
				languageSettingItems.forEach(item => {
					const languageSettingItem = plugin.createElementWithAttrs('li', { class: 'watSet-item' });
					const input = plugin.createElementWithAttrs('input', { type: 'radio', id: item.id, class: ['wat-set-items', 'wat-set-item-type-radio'], name: 'watSet_language', value: item.lang });
					input.checked = item.checked;
					input.onchange = () => {
						plugin.language = item.lang;
						document.documentElement.dataset['watLanguage'] = item.lang;
						// 스크린리더가 올바른 언어 엔진으로 UI를 읽도록 문서 lang 갱신 (WCAG 3.1.2)
						document.documentElement.setAttribute('lang', item.lang);
						plugin.updateLanguageSetting();

						plugin.loadLocale(item.lang).then(() => {
							plugin.generateHTMLElements();
							plugin.setInitialPreferences();

							plugin.setupTabs();
							plugin.activateInitialTab();
							plugin.setEventListeners();
							plugin.extractFocusableElements(document.body);
							plugin.updateTextLocalization();
							plugin.savePreferences();
						});
					};
					const label = plugin.createElementWithAttrs('label', { for: item.id, class: 'wat-set-label' });
					label.textContent = item.label;
					languageSettingItem.appendChild(input);
					languageSettingItem.appendChild(label);
					languageSettingList.appendChild(languageSettingItem);
				});
				languageSettingInner.appendChild(languageSettingList);
				languageContainer.appendChild(languageSettingInner);

				container.appendChild(languageContainer);
			}
			// ************************* Language Setting .End   *************************

			// ************************* Setting value Storage .Start *************************
			const storageSettingContainer = plugin.createElementWithAttrs('fieldset', { id: 'watSetWrap_storage', class: ['watSet-item-container', 'storage-container'] });

			const storageSettingTitle = plugin.createElementWithAttrs('legend', { class: 'watSet-title' });
			storageSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.options.storage.title');

			const storageSettingInner = plugin.createElementWithAttrs('div', { class: 'watSet-inner' });
			const storageSettingList = plugin.createElementWithAttrs('ul', { class: ['watSet-list', 'watSet-list-type-button'] });
			const storageSettingItems = [
				{ id: 'watSet_storage_save', class: 'watSet_storage_save', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.save'), type: 'button' },
				{ id: 'watSet_storage_reset', class: 'watSet_storage_reset', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.delete'), type: 'button' },
				{ id: 'watSet_storage_check', class: 'watSet_storage_check', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.check'), type: 'button' },
				{ id: 'watSet_storage_export', class: 'watSet_storage_export', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.export') || '설정 내보내기', type: 'button' },
				{ id: 'watSet_storage_import', class: 'watSet_storage_import', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.import') || '설정 가져오기', type: 'button' }
			];
			storageSettingItems.forEach(item => {
				const storageSettingItem = plugin.createElementWithAttrs('li', { class: 'watSet-item' });

				const input = plugin.createElementWithAttrs('input', { type: item.type, id: item.id, class: ['wat-set-items', 'wat-set-item-type-button'], name: 'watSet_storage', value: item.label });
				input.addEventListener('click', () => {
					if (item.id === 'watSet_storage_save') {
						plugin.savePreferences();
						// 저장 성공 피드백 (기존엔 무피드백이라 저장 여부 불확실)
						plugin.showNotification(plugin.getLocalizedText('msg.success.save') || '저장되었습니다.');
					} else if (item.id === 'watSet_storage_reset') {
						// 파괴적 동작이므로 확인 절차 추가
						const confirmMsg = plugin.getLocalizedText('msg.confirm.reset') || '접근성 설정을 모두 초기화하시겠습니까?';
						if (!window.confirm(confirmMsg)) {
							return;
						}
						// localStorage.clear()는 호스트 사이트의 전체 데이터를 삭제하므로 WAT 키만 개별 삭제
						Object.values(Constants.STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
						// 화면에 즉시 반영되도록 새로고침 (삭제 후 다른 설정 변경 시 savePreferences가 되쓰는 문제도 방지)
						window.location.reload();
					} else if (item.id === 'watSet_storage_export') {
						plugin.exportSettings();
					} else if (item.id === 'watSet_storage_import') {
						plugin._promptImportSettings();
					} else if (item.id === 'watSet_storage_check') {
						// WAT 소유 키만 확인 — 호스트 사이트의 전체 localStorage를 덤프하지 않음 (정보 노출 방지)
						const settings = localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS);
						const containerValue = localStorage.getItem(Constants.STORAGE_KEYS.CONTAINER);
						const found = plugin.getLocalizedText('msg.state.saved') || '있음';
						const notFound = plugin.getLocalizedText('msg.state.notSaved') || '없음';
						const summary = plugin.getLocalizedText('msg.info.storageCheck', {
							settings: settings ? found : notFound,
							container: containerValue ? found : notFound
						}) || `저장된 설정: ${settings ? found : notFound}, 컨테이너: ${containerValue ? found : notFound}`;
						plugin.showNotification(summary);
					}
				});
				storageSettingItem.appendChild(input);
				storageSettingList.appendChild(storageSettingItem);
			});
			storageSettingInner.appendChild(storageSettingList);
			storageSettingContainer.appendChild(storageSettingTitle);
			storageSettingContainer.appendChild(storageSettingInner);

			container.appendChild(storageSettingContainer);
			// ************************* Setting value Storage .End   *************************
		}
	}

	/**
	 * @fileoverview 안전한 JSON 파싱 유틸리티
	 * @module src/core/safeParseJSON
	 */

	/**
	 * localStorage 등 외부 유래 문자열의 안전한 JSON 파싱 — 손상된 값이 초기화 전체를 중단시키지 않도록
	 * @param {string|null} raw - 파싱할 원본 문자열
	 * @param {*} [fallback={}] - 파싱 실패/빈 값일 때 반환할 기본값
	 * @returns {*} 파싱 결과 또는 기본값
	 */
	function safeParseJSON(raw, fallback = {}) {
		if (raw === null || raw === undefined) return fallback;
		try {
			return JSON.parse(raw);
		} catch (e) {
			console.warn('[WAT] 저장된 설정 값이 손상되어 기본값을 사용합니다:', e.message);
			return fallback;
		}
	}

	/**
	 * @fileoverview SettingsApplier - 설정 저장/복원/프로필 적용 담당
	 * @module src/wat/SettingsApplier
	 * @description WAT.js에서 추출된 설정 영속화 클러스터 (Phase 6-7).
	 *              localStorage 기반 설정 저장·로드·내보내기/가져오기와
	 *              접근성 프로필(저시력/색각이상/난독증) 적용·해제·복원을 담당한다.
	 *              형제 메서드 호출은 plugin을 경유해 동적 디스패치를 유지한다
	 *              (인스턴스 단위 오버라이드·테스트 스텁 호환).
	 */

	// 접근성 설정 키 → 적용 메서드 매핑. 프로필 적용/해제/전체 리셋이 공유한다.
	const SETTING_APPLIERS = {
		fontSize: 'changeFontSize',
		fontFamily: 'changeFontFamily',
		screenScale: 'changeScreenScale',
		txtAlign: 'changeTextAlign',
		letterSpacing: 'changeLetterSpacing',
		lineHeight: 'changeLineHeight',
		colorTheme: 'changeColorTheme',
		saturation: 'changeSaturation',
		readGuide: 'changeReadGuide',
		imgDisplayMode: 'changeImgDisplayMode'
	};
	const SETTING_KEYS = Object.keys(SETTING_APPLIERS);
	// 리셋 경로는 이미지 변환 재실행을 피하려고 imgDisplayMode를 dataset으로만 되돌린다
	const RESET_METHOD_KEYS = SETTING_KEYS.filter(key => key !== 'imgDisplayMode');

	class SettingsApplier {
		/**
		 * @param {Object} plugin - WAT 인스턴스 (change 계열 적용 메서드·상태·로케일 서비스 제공자)
		 */
		constructor(plugin) {
			this.plugin = plugin;
		}

		/**
		 * 라디오 선택에 따라 selectOn 표시 클래스를 동기화합니다
		 * (.opt_item 형제에서 제거 후 현재 항목에 부여, 그룹 컨테이너는 initial/unset이면 해제)
		 * @param {HTMLElement} radioElement - 선택된 라디오 입력
		 * @param {string} value - 선택 값
		 */
		static syncRadioSelectionUI(radioElement, value) {
			const parentListItem = radioElement.closest('.opt_item');
			const parentPersonalOptItem = radioElement.closest('.personalOpt_item');

			if (parentListItem) {
				const parentList = parentListItem.closest('.opt_lists');
				if (parentList) {
					Array.from(parentList.children)
						.filter(child => child !== parentListItem)
						.forEach(sibling => sibling.classList.remove('selectOn'));
					parentListItem.classList.add('selectOn');
				}
			}

			if (parentPersonalOptItem) {
				if (value === 'initial' || value === 'unset') {
					parentPersonalOptItem.classList.remove('selectOn');
				} else {
					parentPersonalOptItem.classList.add('selectOn');
				}
			}
		}

		/**
		 * 접근성 설정 객체를 대응 change 메서드로 일괄 적용합니다 (falsy 값은 건너뜀)
		 * @private
		 * @param {Object} settings - 키별 설정 값
		 * @param {Array<string>} [keys=SETTING_KEYS] - 적용할 키 목록
		 */
		_applySettings(settings, keys = SETTING_KEYS) {
			keys.forEach(key => {
				const value = settings[key];
				if (value) { this.plugin[SETTING_APPLIERS[key]](value); }
			});
		}

		/**
		 * 접근성 설정은 기본값, 도구 설정(viewMode/toolPosition)은 현재값을 유지한
		 * 설정 객체를 만듭니다 — 프로필 적용/해제·전체 리셋의 공통 기준 상태
		 * @private
		 * @returns {Object}
		 */
		_buildResetSettings() {
			const settings = {};
			SETTING_KEYS.forEach(key => { settings[key] = Defaults.SETTINGS[key]; });
			settings.viewMode = document.documentElement.dataset.watViewmode || Defaults.SETTINGS.viewMode;
			settings.toolPosition = document.documentElement.dataset.watPosition || Defaults.SETTINGS.toolPosition;
			return settings;
		}

		/**
		 * 현재 선택된 접근성 프로필의 이름을 가져옵니다
		 * @returns {string|null} 선택된 프로필명 또는 선택된 것이 없으면 null
		 */
		getSelectedProfileName() {
			const activeButton = document.querySelector('.watSet-item-container.profile-container .profileToggle[aria-checked="true"]');
			if (activeButton) {
				return activeButton.getAttribute('data-profile') || activeButton.textContent.trim();
			}
			return null;
		}

		/**
		 * 지정된 접근성 프로필의 설정을 적용합니다
		 * @param {string} profileName - 적용할 프로필명 ('lowVision', 'colorBlindness', 'dyslexia')
		 * @returns {void}
		 * @description 체크된 옵션을 기반으로 프로필 설정을 적용하며 최소 하나의 옵션이 선택되었는지 검증합니다
		 */
		applyProfileSettings(profileName) {
			const plugin = this.plugin;
			const profileDefault = Defaults.PROFILES[profileName];
			if (!profileDefault) {
				console.warn(plugin.getLocalizedText('msg.warning.profileNotFound', { profileName: profileName }));
				return;
			}
			// 정적 기본값(Defaults.PROFILES)을 UI 상태로 직접 변이하면 세션 내내 기본값이 오염되므로 복사본 사용
			const profileData = {
				settings: { ...profileDefault.settings },
				enabled: { ...profileDefault.enabled }
			};

			// 프로필 전환 시 접근성 설정들을 기본값으로 초기화하고 보기모드/위치는 유지
			const effectiveSettings = this._buildResetSettings();

			const profileCheckboxs = document.querySelectorAll(`.watSet-profile-item-container[data-profile="${profileName}"] .profileListItemInput[type="checkbox"]`);
			// ************************* Checkboxes Validation .Start *************************
			const checkedCheckbox = document.querySelectorAll(`.watSet-profile-item-container[data-profile="${profileName}"] .profileListItemInput[type="checkbox"]:checked`);
			if (checkedCheckbox.length === 0) {
				const profileToggle = document.querySelector(`.watSet-profile-item-container[data-profile="${profileName}"] .profileToggle`);
				plugin._notify(plugin.getLocalizedText('msg.warning.noSettingsChecked'), { type: 'warning' });
				// 체크박스가 하나도 렌더링되지 않은 경우(옵션 전체 비활성화) 크래시 방지
				if (profileCheckboxs.length > 0) {
					profileCheckboxs[0].focus();
					profileCheckboxs[0].classList.add('force-focus');

					const handleFocusOut = () => {
						plugin._setTimeout(() => {
							if (document.activeElement !== profileCheckboxs[0]) {
								profileCheckboxs[0].classList.remove('force-focus');
								profileCheckboxs[0].removeEventListener('focusout', handleFocusOut);
							}
						}, 100);
					};

					profileCheckboxs[0].addEventListener('focusout', handleFocusOut);
				}
				if (profileToggle) {
					// textContent 직접 설정 시 내부 .watSet-button-label span이 파괴되어 이후 토글이 고장남
					const toggleLabel = profileToggle.querySelector('.watSet-button-label');
					if (toggleLabel) {
						toggleLabel.textContent = plugin.getLocalizedText('tags.button.text.on');
					} else {
						profileToggle.textContent = plugin.getLocalizedText('tags.button.text.on');
					}
					profileToggle.setAttribute('aria-checked', 'false');
				}
				return;
			}
			// ************************* Checkboxes Validation .End   *************************

			// 프로필 설정 적용: 각 항목에 대해 UI에 있는 체크박스 상태를 반영해서 병합
			for (const key in profileData.settings) {
				// 사용자 옵션에 해당 기능이 비활성화된 경우 => 건너뜀
				if (plugin.options[key] === false) continue;

				// UI에 체크박스가 있다면 이를 통해 최신 상태를 반영 (data-key 속성 기준)
				const checkbox = document.querySelector(`.watSet-profile-item-container[data-profile="${profileName}"] .profileListItemInput[type="checkbox"][data-key="${key}"]`);
				if (checkbox) {
					profileData.enabled[key] = checkbox.checked;
				}
				// 체크된 항목만 baseSettings에 덮어쓰도록 함
				if (profileData.enabled[key]) {
					effectiveSettings[key] = profileData.settings[key];
				}
			}

			// 프로필 적용 중 저장 비활성화
			const originalSkipFlag = plugin._skipSavePreferences;
			plugin._skipSavePreferences = true;
			this._applySettings(effectiveSettings);

			// 토글형(체크박스) 설정 — 체크된 경우에만 켠다. 해제 대칭은 toggleProfile off/resetProfileSettings 담당
			if (profileData.settings.stopAni !== undefined && profileData.enabled.stopAni) {
				plugin.toggleDataAttribute('stopAni', true);
				this._syncToggleCheckbox('stopAni', true);
			}
			if (profileData.settings.mediaStop !== undefined && profileData.enabled.mediaStop) {
				plugin.toggleMediaStop(true);
				this._syncToggleCheckbox('mediaStop', true);
			}
			if (profileData.settings.mediaMute !== undefined && profileData.enabled.mediaMute) {
				plugin.toggleMediaMute(true);
				this._syncToggleCheckbox('mediaMute', true);
			}

			// 동작형 항목 — 설정 저장이 아니라 즉시 실행되는 기능
			// tts: 'focus' → 포커스 낭독 시작 (프로필 클릭이 사용자 제스처이므로 speechSynthesis 허용)
			if (profileData.settings.tts === 'focus' && profileData.enabled.tts) {
				this._setFocusTTS(true);
			}
			// stt: 'notice' → 마이크 권한 팝업이 갑자기 뜨지 않도록 자동 시작 대신 사용 안내
			if (profileData.settings.stt === 'notice' && profileData.enabled.stt) {
				plugin.showNotification(plugin.getLocalizedText('panel.settings.profile.notice.stt'));
			}

			// 저장 플래그 복원
			plugin._skipSavePreferences = originalSkipFlag;

			// 프로필 적용 후 개별 설정 UI 동기화
			plugin._syncIndividualSettingsUI(effectiveSettings);

			// 프로필 적용 완료 후 저장
			plugin.savePreferences();
			// UI 동기화를 확실하게 하기 위해 약간의 지연 후 한 번 더 실행
			plugin._setTimeout(() => {
				plugin._syncIndividualSettingsUI(effectiveSettings);
			}, 50);

			localStorage.setItem(Constants.STORAGE_KEYS.SELECTED_PROFILE, JSON.stringify({
				profileName: profileName,
				enabledSettings: profileData.enabled
			}));
		}

		/**
		 * 개별 설정 패널의 토글형 체크박스 UI를 프로필 적용 상태와 동기화합니다
		 * @private
		 * @param {string} key - 토글 키 ('stopAni' | 'mediaStop' | 'mediaMute')
		 * @param {boolean} checked - 체크 상태
		 */
		_syncToggleCheckbox(key, checked) {
			const checkbox = document.getElementById(`wat-checkbox-${key}`);
			if (checkbox) { checkbox.checked = checked; }
		}

		/**
		 * 포커스 낭독(TTS)을 원하는 상태로 맞춥니다.
		 * 상태 판단은 TTSManager의 실제 상태를 기준으로 하고(버튼은 aria-pressed를 쓰지 않음),
		 * 전환은 버튼 클릭을 재사용해 라벨 등 UI 갱신까지 함께 일어나게 합니다.
		 * @private
		 * @param {boolean} on - true면 켜고, false면 끕니다 (이미 그 상태면 아무것도 안 함)
		 */
		_setFocusTTS(on) {
			const ttsManager = this.plugin.ttsManager;
			if (!ttsManager) return;
			const isActive = ttsManager.currentState === ttsManager.states.FOCUS_TTS;
			if (isActive === on) return;
			const focusBtn = document.getElementById('wat-button-tts_focus_toggle');
			if (focusBtn) {
				focusBtn.click();
			} else {
				ttsManager.toggleFocusTTS();
			}
		}

		/**
		 * 지정된 프로필을 켜거나 끕니다
		 * @param {string} profile - 토글할 프로필명
		 * @param {HTMLElement} targetToggle - 클릭된 토글 버튼 요소
		 * @returns {void}
		 * @description 프로필 활성화를 토글하고, 설정을 적용/리셋하며, UI 상태를 업데이트합니다
		 */
		toggleProfile(profile, targetToggle) {
			const plugin = this.plugin;
			const isOn = targetToggle.getAttribute('aria-checked') === 'true';
			const siblingToggles = Array.from(targetToggle.closest('.watSet-item-container.profile-container').querySelectorAll('.profileToggle')).filter(toggle => toggle !== targetToggle);
			const targetLabel = targetToggle.querySelector('.watSet-button-label');
			targetLabel.textContent = isOn ? plugin.getLocalizedText('tags.button.text.stateOff') : plugin.getLocalizedText('tags.button.text.stateOn');
			targetToggle.setAttribute('aria-checked', isOn ? 'false' : 'true');

			if (isOn) {
				// 프로필을 끌 때: 접근성 설정만 기본값으로 리셋, 도구 설정은 유지
				const resetSettings = this._buildResetSettings();
				this._applySettings(resetSettings, RESET_METHOD_KEYS);
				document.documentElement.dataset.imgDisplayMode = resetSettings.imgDisplayMode;

				// 토글형·동작형 항목도 대칭으로 해제 (프로필이 켰을 수 있는 것들)
				plugin.toggleDataAttribute('stopAni', false);
				this._syncToggleCheckbox('stopAni', false);
				plugin.toggleMediaStop(false);
				this._syncToggleCheckbox('mediaStop', false);
				plugin.toggleMediaMute(false);
				this._syncToggleCheckbox('mediaMute', false);
				this._setFocusTTS(false);

				// UI 동기화
				plugin._syncIndividualSettingsUI(resetSettings);

				// 현재 토글 버튼에서 active 클래스 제거
				targetToggle.classList.remove(Constants.CSS_CLASSES.ACTIVE);

				// 프로필 해제 시 저장된 선택 상태도 제거 (재방문 시 잘못 복원 방지)
				localStorage.removeItem(Constants.STORAGE_KEYS.SELECTED_PROFILE);

				// 설정 저장
				plugin.savePreferences();
			} else {
				// 프로필을 켤 때
				plugin.applyProfileSettings(profile);

				// 현재 토글 버튼에 active 클래스 추가
				targetToggle.classList.add(Constants.CSS_CLASSES.ACTIVE);
			}

			// 다른 프로필 토글들은 모두 비활성화
			siblingToggles.forEach(toggle => {
				const siblingLabel = toggle.querySelector('.watSet-button-label');
				siblingLabel.textContent = plugin.getLocalizedText('tags.button.text.stateOff');
				toggle.setAttribute('aria-checked', 'false');
				toggle.classList.remove(Constants.CSS_CLASSES.ACTIVE);
			});
		}

		/**
		 * 모든 접근성 설정을 기본값으로 리셋합니다
		 * @returns {void}
		 * @description 모든 접근성 기능을 초기/기본 상태로 복원합니다 (도구 설정은 유지)
		 */
		resetWatSettings() {
			const plugin = this.plugin;

			// 접근성 설정들만 기본값으로 리셋 (도구 설정 viewMode/toolPosition은 현재 사용자 설정 유지)
			const resetSettings = this._buildResetSettings();
			this._applySettings(resetSettings, RESET_METHOD_KEYS);
			// 이미지 표시 모드도 접근성 설정으로 포함
			document.documentElement.dataset.imgDisplayMode = resetSettings.imgDisplayMode;

			// 전체 리셋 후 개별 설정 UI 동기화
			plugin._syncIndividualSettingsUI(resetSettings);

			// UI 동기화를 확실하게 하기 위해 약간의 지연 후 한 번 더 실행
			plugin._setTimeout(() => {
				plugin._syncIndividualSettingsUI(Defaults.SETTINGS);
			}, 50);
		}

		/**
		 * 특정 접근성 프로필의 설정을 리셋합니다
		 * @param {string} profileId - 프로필 식별자 ('lowVision', 'colorBlindness', 'dyslexia')
		 * @returns {void}
		 */
		resetProfileSettings(profileId) {
			const plugin = this.plugin;
			const resetSettings = {};

			switch (profileId) {
				case 'lowVision': // 실제 프로필 키(Defaults.PROFILES)와 일치시킴 — 구 명칭 'visualImpairment'
					plugin.changeFontSize('initial');
					plugin.changeFontFamily('initial');
					plugin.changeLetterSpacing('initial');
					resetSettings.fontSize = 'initial';
					resetSettings.fontFamily = 'initial';
					resetSettings.letterSpacing = 'initial';
					break;
				case 'colorBlindness':
					plugin.changeSaturation('initial');
					resetSettings.saturation = 'initial';
					break;
				case 'dyslexia':
					plugin.changeFontFamily('initial');
					plugin.changeLineHeight('initial');
					plugin.changeReadGuide('');
					resetSettings.fontFamily = 'initial';
					resetSettings.lineHeight = 'initial';
					resetSettings.readGuide = 'unset';
					break;
				case 'visualImpairment':
					plugin.changeImgDisplayMode('initial');
					this._setFocusTTS(false);
					resetSettings.imgDisplayMode = 'initial';
					break;
				case 'senior':
					plugin.changeFontSize('initial');
					plugin.changeLineHeight('initial');
					plugin.changeLetterSpacing('initial');
					plugin.changeReadGuide('');
					resetSettings.fontSize = 'initial';
					resetSettings.lineHeight = 'initial';
					resetSettings.letterSpacing = 'initial';
					resetSettings.readGuide = 'unset';
					break;
				case 'motionSensitivity':
					plugin.toggleDataAttribute('stopAni', false);
					this._syncToggleCheckbox('stopAni', false);
					plugin.toggleMediaStop(false);
					this._syncToggleCheckbox('mediaStop', false);
					plugin.changeSaturation('initial');
					resetSettings.saturation = 'initial';
					break;
				case 'physicalDisability':
					plugin.changeScreenScale('initial');
					plugin.changeReadGuide('');
					resetSettings.screenScale = 'initial';
					resetSettings.readGuide = 'unset';
					break;
			}

			// 프로필 리셋 후 개별 설정 UI 동기화
			plugin._syncIndividualSettingsUI(resetSettings);

			// UI 동기화를 확실하게 하기 위해 약간의 지연 후 한 번 더 실행
			plugin._setTimeout(() => {
				plugin._syncIndividualSettingsUI(resetSettings);
			}, 50);
		}

		/**
		 * 현재 접근성 설정을 localStorage에 저장합니다
		 * @returns {void}
		 * @description HTML 데이터 속성에서 현재 설정을 수집하고 JSON으로 localStorage에 저장합니다
		 */
		savePreferences() {
			const plugin = this.plugin;
			// 초기화 중에는 저장하지 않음
			if (plugin._skipSavePreferences) {
				return;
			}

			const defaultSettings = Defaults.SETTINGS;

			const settings = {
				fontSize: document.documentElement.dataset.fontSize || defaultSettings.fontSize,
				fontFamily: document.documentElement.dataset.fontFamily || defaultSettings.fontFamily,
				screenScale: document.documentElement.dataset.screenScale || defaultSettings.screenScale,
				txtAlign: document.documentElement.getAttribute('data-txt-align') || defaultSettings.txtAlign,
				letterSpacing: document.documentElement.getAttribute('data-letter-spacing') || defaultSettings.letterSpacing,
				lineHeight: document.documentElement.getAttribute('data-line-height') || defaultSettings.lineHeight,
				colorTheme: document.documentElement.dataset.colorTheme || defaultSettings.colorTheme,
				saturation: document.documentElement.dataset.saturation || defaultSettings.saturation,
				readGuide: document.documentElement.getAttribute('data-read-guide') || defaultSettings.readGuide,
				imgDisplayMode: document.documentElement.dataset.imgDisplayMode || defaultSettings.imgDisplayMode,
				viewMode: document.documentElement.dataset.watViewmode || defaultSettings.viewMode,
				toolPosition: document.documentElement.dataset.watPosition || defaultSettings.toolPosition,
				language: document.documentElement.dataset.watLanguage || defaultSettings.language
			};

			localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

			// StateManager 설정도 함께 갱신
			plugin.state.set('settings', settings);

			// 설정 저장 이벤트 디스패치
			plugin._dispatchStateEvent('settings:saved', {
				settings: { ...settings },
				timestamp: Date.now()
			});
		}

		/**
		 * 저장된 접근성 설정을 JSON 파일로 내보냅니다 (브라우저·기기 간 설정 이전 지원)
		 * @returns {void}
		 */
		exportSettings() {
			const plugin = this.plugin;
			try {
				const data = {};
				Object.values(Constants.STORAGE_KEYS).forEach(key => {
					const value = localStorage.getItem(key);
					if (value !== null) data[key] = value;
				});

				const payload = {
					format: 'moduweb-settings',
					version: 1,
					data
				};

				const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = 'moduweb-settings.json';
				document.body.appendChild(link);
				link.click();
				link.remove();
				URL.revokeObjectURL(url);

				plugin._notify(plugin.getLocalizedText('msg.success.export') || '설정을 파일로 내보냈습니다.', { type: 'success' });
			} catch (error) {
				console.error('[WAT] 설정 내보내기 실패:', error);
				plugin._notify(plugin.getLocalizedText('msg.error.general') || '오류가 발생했습니다.', { type: 'error' });
			}
		}

		/**
		 * 파일 선택 대화상자를 열어 설정 JSON을 가져옵니다
		 * @returns {void}
		 */
		promptImportSettings() {
			const plugin = this.plugin;
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'application/json,.json';
			input.addEventListener('change', () => {
				const file = input.files && input.files[0];
				if (!file) return;
				const reader = new FileReader();
				reader.onload = () => plugin.importSettings(String(reader.result));
				reader.readAsText(file);
			});
			input.click();
		}

		/**
		 * 내보낸 설정 JSON을 검증 후 적용합니다 (적용 후 페이지 새로고침)
		 * @param {string} jsonText - exportSettings()가 생성한 JSON 문자열
		 * @returns {boolean} 적용 성공 여부
		 */
		importSettings(jsonText) {
			const plugin = this.plugin;
			const invalidMsg = plugin.getLocalizedText('msg.error.importInvalid') || '올바른 ModuWeb 설정 파일이 아닙니다.';
			const payload = safeParseJSON(jsonText, null);

			// 형식 검증 — WAT가 만든 파일만 수용
			if (!payload || payload.format !== 'moduweb-settings' || typeof payload.data !== 'object' || payload.data === null) {
				plugin._notify(invalidMsg, { type: 'error' });
				return false;
			}

			// 알려진 WAT 키만 반영 (임의 키로 호스트 localStorage를 오염시키지 않음)
			const knownKeys = new Set(Object.values(Constants.STORAGE_KEYS));
			let applied = 0;
			for (const [key, value] of Object.entries(payload.data)) {
				if (knownKeys.has(key) && typeof value === 'string') {
					localStorage.setItem(key, value);
					applied++;
				}
			}

			if (applied === 0) {
				plugin._notify(invalidMsg, { type: 'error' });
				return false;
			}

			plugin._notify(plugin.getLocalizedText('msg.success.import') || '설정을 가져왔습니다. 페이지를 새로고침합니다.', { type: 'success' });
			// 새 설정이 전체 UI·스타일에 반영되도록 새로고침 (reset 버튼과 동일 패턴)
			plugin._setTimeout(() => window.location.reload(), 800);
			return true;
		}

		/**
		 * localStorage에서 접근성 설정을 로드합니다
		 * @returns {Object} 기본값으로 대체된 로드된 설정 객체
		 * @description localStorage에서 저장된 설정을 가져와 기본 설정과 병합하고 라디오 UI를 동기화합니다
		 */
		loadPreferences() {
			const plugin = this.plugin;
			const savedSettings = localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS);
			const loadedSettings = safeParseJSON(savedSettings, {});
			const defaultSettings = Defaults.SETTINGS;

			// 초기값 설정 — 저장값이 없는 키는 기본값으로 채운다
			const pluginSettings = {};
			[...SETTING_KEYS, 'viewMode', 'toolPosition'].forEach(key => {
				pluginSettings[key] = loadedSettings[key] || defaultSettings[key];
			});

			const controlItems = ['viewMode', 'toolPosition'];

			// 설정 적용
			Object.entries(pluginSettings).forEach(([key, value]) => {
				// UI 컨트롤 설정 - 라디오 버튼 체크 및 UI 상태 업데이트
				const classSelector = controlItems.includes(key) ? '.wat-set-item-type-radio' : '.wat-item-type-radio';
				const selector = `${classSelector}[name="${key}"][value="${value}"]`;
				const radioElement = document.querySelector(selector);

				if (radioElement) {
					radioElement.checked = true;
					SettingsApplier.syncRadioSelectionUI(radioElement, value);
				} else {
					console.warn(`Radio element not found for ${key}=${value}: ${selector}`);
				}

				// 화면 확대 설정에 대한 현재 비율 초기화
				if (key === 'screenScale') {
					const ratio = plugin.screenScaleRatios[value] || 1;
					plugin.state.set('plugin.currentScreenScale', ratio);
				}
			});

			// 저장된 언어 복원 — dataset에 반영하지 않으면 이후 savePreferences가
			// 언어를 기본값으로 덮어쓴다 (언어는 라디오 동기화 루프 대상이 아님)
			pluginSettings.language = plugin.language || loadedSettings.language || defaultSettings.language;
			document.documentElement.dataset.watLanguage = pluginSettings.language;

			// 설정 로드 이벤트 디스패치
			plugin._dispatchStateEvent('settings:loaded', {
				settings: { ...pluginSettings },
				wasEmpty: !savedSettings,
				timestamp: Date.now()
			});

			return pluginSettings;
		}

		/**
		 * 특정 설정을 실제 페이지 콘텐츠에 적용합니다
		 * @param {string} settingKey - 설정 키 (예: 'fontSize', 'screenScale')
		 * @param {string} settingValue - 설정 값 (예: 'size-1p5x', 'scale-1p2x')
		 * @returns {void}
		 */
		applySettingToPage(settingKey, settingValue) {
			const plugin = this.plugin;
			switch (settingKey) {
				case 'fontSize':
					plugin.changeFontSize(settingValue);
					break;
				case 'fontFamily':
					plugin.changeFontFamily(settingValue);
					break;
				case 'screenScale':
					plugin.changeScreenScale(settingValue);
					break;
				case 'txtAlign':
					plugin.changeTextAlign(settingValue);
					break;
				case 'letterSpacing':
					plugin.changeLetterSpacing(settingValue);
					break;
				case 'lineHeight':
					plugin.changeLineHeight(settingValue);
					break;
				case 'colorTheme':
					plugin.changeColorTheme(settingValue);
					break;
				case 'saturation':
					plugin.changeSaturation(settingValue);
					break;
				case 'readGuide':
					plugin.changeReadGuide(settingValue);
					break;
				case 'imgDisplayMode':
					plugin.changeImgDisplayMode(settingValue);
					break;
				case 'viewMode':
					// UI 스타일링을 위해 documentElement dataset에 적용
					document.documentElement.dataset.watViewmode = settingValue;
					break;
				case 'toolPosition':
					// UI 위치 지정을 위해 documentElement dataset에 적용
					document.documentElement.dataset.watPosition = settingValue;
					break;
				default:
					console.warn(`Unknown setting key: ${settingKey}`);
			}
		}

		/**
		 * 플러그인 시작 시 초기 환경설정을 적용합니다
		 * @returns {void}
		 * @description 저장된 환경설정을 로드하고 적용하며, 저장된 상태와 일치하도록 UI 컨트롤을 설정합니다
		 */
		setInitialPreferences() {
			const plugin = this.plugin;
			const loadedSettings = plugin.loadPreferences();

			// 초기 설정 로드 후 UI 동기화
			if (loadedSettings) {
				plugin._setTimeout(() => {
					plugin._syncIndividualSettingsUI(loadedSettings);
				}, 100);
			}

			// 저장된 프로필 선택 상태 복원 (사용성 U-1) —
			// 설정값 자체는 loadPreferences가 복원하므로 토글·체크박스 UI만 동기화
			plugin._restoreSelectedProfileUI();
		}

		/**
		 * 저장된 프로필 선택 상태를 토글 UI에 복원합니다
		 * @returns {void}
		 * @description 이전 방문에서 켠 프로필이 재방문 시 "꺼짐"으로 보이고, 다시 켜면
		 *              설정이 리셋되던 문제(U-1)를 해결한다. localStorage의 selectedProfile을
		 *              읽어 해당 프로필 토글을 켜짐 상태로 표시하고 체크박스 선택을 복원한다.
		 */
		restoreSelectedProfileUI() {
			const plugin = this.plugin;
			const saved = safeParseJSON(localStorage.getItem(Constants.STORAGE_KEYS.SELECTED_PROFILE), null);
			if (!saved || !saved.profileName) return;

			const container = document.querySelector(`.watSet-profile-item-container[data-profile="${saved.profileName}"]`);
			if (!container) {
				// 프로필 구성이 바뀌어 더 이상 존재하지 않으면 저장값 정리
				localStorage.removeItem(Constants.STORAGE_KEYS.SELECTED_PROFILE);
				return;
			}

			const toggle = container.querySelector('.profileToggle');
			if (toggle) {
				toggle.setAttribute('aria-checked', 'true');
				toggle.classList.add(Constants.CSS_CLASSES.ACTIVE);
				const label = toggle.querySelector('.watSet-button-label');
				if (label) label.textContent = plugin.getLocalizedText('tags.button.text.stateOn');
			}

			// 프로필 내 개별 항목 체크박스 선택 상태 복원
			if (saved.enabledSettings && typeof saved.enabledSettings === 'object') {
				for (const [key, enabled] of Object.entries(saved.enabledSettings)) {
					const checkbox = container.querySelector(`.profileListItemInput[type="checkbox"][data-key="${key}"]`);
					if (checkbox) checkbox.checked = !!enabled;
				}
			}
		}

		/**
		 * 개별 UI 컨트롤을 현재 설정값과 동기화합니다
		 * @param {Object} settings - UI 컨트롤과 동기화할 설정 객체
		 * @returns {void}
		 * @description 제공된 설정을 시각적으로 반영하도록 UI 컨트롤(라디오 버튼, 체크박스)을 업데이트합니다
		 */
		syncIndividualSettingsUI(settings) {
			if (!settings || typeof settings !== 'object') {
				return;
			}

			const controlItems = ['viewMode', 'toolPosition', 'readGuideMode'];

			Object.entries(settings).forEach(([key, value]) => {
				// UI 컨트롤 설정 - 라디오 버튼 체크 및 UI 상태 업데이트
				const classSelector = controlItems.includes(key) ? '.wat-set-item-type-radio' : '.wat-item-type-radio';
				const selector = `${classSelector}[name="${key}"][value="${value}"]`;
				const radioElement = document.querySelector(selector);

				if (radioElement) {
					// 강제로 라디오 버튼 체크 상태 업데이트
					radioElement.checked = true;

					// 변경 이벤트 발생시켜서 UI 업데이트 강제 실행
					const changeEvent = new Event('change', { bubbles: true, cancelable: true });
					radioElement.dispatchEvent(changeEvent);

					SettingsApplier.syncRadioSelectionUI(radioElement, value);
				}
			});

			// 읽기 가이드 관련 버튼 상태 동기화
			if (settings.readGuide !== undefined) {
				const modeButtons = document.querySelectorAll('[data-read-guide-mode]');
				modeButtons.forEach(button => {
					const buttonMode = button.getAttribute('data-read-guide-mode');
					if (buttonMode === settings.readGuide) {
						button.classList.add(Constants.CSS_CLASSES.ACTIVE);
						button.setAttribute('aria-pressed', 'true');
					} else {
						button.classList.remove(Constants.CSS_CLASSES.ACTIVE);
						button.setAttribute('aria-pressed', 'false');
					}
				});
			}
		}
	}

	/**
	 * @fileoverview OverlayManager - 모달 오버레이 공통 프리미티브
	 * @module src/wat/OverlayManager
	 * @description WAT.js에서 추출·통합된 모달 오버레이 접근성 프리미티브 (Phase 6-8).
	 *              사전(Dictionary)·페이지구조(PageStructure) 모달이 공유하는
	 *              포커스 트랩(Tab 순환)·Escape 닫기·오버레이 정리·포커스 복원을 한곳에서 담당한다.
	 *
	 *              설계 노트:
	 *              - aria-modal / 배경 오버레이 / 포커스 트랩이 이미 모달 격리를 제공하므로
	 *                `inert`는 도입하지 않았다(오적용 시 페이지 전역 조작 불능이라는 심각한 실패 모드
	 *                대비 한계 이득이 작고, 이 저장소 환경에서 브라우저 회귀 검증이 불가). — 향후 과제.
	 *              - 대상 오버레이가 애니메이션을 사용하지 않아 reduced-motion 처리는 no-op.
	 *              - overlay-active(스크롤 잠금) 해제는 '남은 .wat-overlay가 없을 때만'으로 통일한다
	 *                (기존에 Escape·PageStructure 경로가 무조건 해제하던 불일치를 교차 모달 안전 규칙으로 수렴).
	 */
	class OverlayManager {
		/**
		 * @param {Object} [plugin] - WAT 인스턴스 (현재 트랩/정리 로직은 plugin에 의존하지 않음)
		 */
		constructor(plugin) {
			this.plugin = plugin;
		}

		/**
		 * 모달 레이어에 포커스 트랩(Tab 순환)과 Escape 닫기를 설정합니다.
		 * @param {HTMLElement} layer - 모달 레이어 (role=dialog)
		 * @param {HTMLElement|null} previousFocusedElement - 닫을 때 포커스를 복원할 요소
		 * @param {HTMLElement} overlay - 배경 오버레이 요소
		 * @returns {void}
		 */
		trap(layer, previousFocusedElement, overlay) {
			const self = this;

			// 탭 전환 등으로 모달 내용이 바뀌므로 keydown 시점에 재조회하고,
			// disabled/hidden 요소는 순환 경계에서 제외한다
			function getFocusable() {
				return Array.from(layer.querySelectorAll(
					'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
				)).filter(el => !el.disabled && !el.hidden && !el.closest('[hidden]'));
			}

			function handleTab(e) {
				if (e.key === 'Tab') {
					const focusableElements = getFocusable();
					// 포커스 가능 요소가 없으면 Tab을 차단해 포커스가 모달 밖으로 새지 않도록 고정
					if (focusableElements.length === 0) {
						e.preventDefault();
						return;
					}
					const firstFocusableElement = focusableElements[0];
					const lastFocusableElement = focusableElements[focusableElements.length - 1];
					if (e.shiftKey) { // Shift + Tab
						if (document.activeElement === firstFocusableElement) {
							e.preventDefault();
							lastFocusableElement.focus();
						}
					} else { // Tab
						if (document.activeElement === lastFocusableElement) {
							e.preventDefault();
							firstFocusableElement.focus();
						}
					}
				} else if (e.key === 'Escape') {
					self.teardown(layer, overlay);
					self.restoreFocus(previousFocusedElement);
				}
			}

			layer.addEventListener('keydown', handleTab);
		}

		/**
		 * 모달 레이어·오버레이를 제거하고 스크롤 잠금을 정리합니다 (포커스는 건드리지 않음).
		 * @param {HTMLElement|null} layer - 제거할 모달 레이어
		 * @param {HTMLElement|null} overlay - 제거할 배경 오버레이
		 * @returns {void}
		 */
		teardown(layer, overlay) {
			if (layer) layer.remove();
			if (overlay) overlay.remove();
			// 다른 모달의 오버레이가 남아 있지 않을 때만 스크롤 잠금 해제 (교차 모달 안전)
			if (!document.querySelector('.wat-overlay')) {
				document.body.classList.remove('overlay-active');
			}
		}

		/**
		 * 모달을 닫은 뒤 이전 포커스 요소로 포커스를 복원합니다 (없거나 소실됐으면 body).
		 * @param {HTMLElement|null} previousFocusedElement - 복원할 포커스 대상
		 * @returns {void}
		 */
		restoreFocus(previousFocusedElement) {
			if (previousFocusedElement && document.contains(previousFocusedElement)) {
				previousFocusedElement.focus();
			} else {
				// body는 기본적으로 포커스 불가 — 일시적으로 tabindex를 부여해 확실히 이동시킨다
				const body = document.body;
				const hadTabindex = body.hasAttribute('tabindex');
				if (!hadTabindex) body.setAttribute('tabindex', '-1');
				body.focus();
				if (!hadTabindex) body.removeAttribute('tabindex');
			}
		}
	}

	/**
	 * @fileoverview AutoTTS - 자동 순차 TTS 기능
	 * @module src/tts/AutoTTS
	 */
	class AutoTTS {
		constructor(ttsManager) {
			this.ttsManager = ttsManager;
			this.plugin = ttsManager.plugin;

			this.elements = [];
			this.currentIndex = -1;
			this.autoAdvanceTimer = null;
			this.currentUtterance = null;
			this.keepAliveTimer = null;
		}

		start() {
			this._extractReadableElements();

			if (this.elements.length === 0) {
				this.plugin.showNotification(this.plugin.getLocalizedText('msg.error.noElementsFound'));
				return;
			}

			this.currentIndex = 0;
			this._readCurrentElement();
		}

		stop() {
			this._stopCurrentSpeech();
			this._clearAutoAdvanceTimer();
			this._removeAllHighlights();
			this.currentIndex = -1;
			this.elements = [];
		}

		/**
		 * 자동 읽기를 완전히 정리합니다. (발화, 타이머, 하이라이트, 요소 목록)
		 */
		destroy() {
			this.stop();
		}

		moveToPrevious() {
			if (this.currentIndex > 0) {
				this.currentIndex--;
				this._readCurrentElement();
			} else {
				this.plugin.showNotification(this.plugin.getLocalizedText('tts.auto.firstElement'));
			}
		}

		moveToNext() {
			if (this.currentIndex < this.elements.length - 1) {
				this.currentIndex++;
				this._readCurrentElement();
			} else {
				this.plugin.showNotification(this.plugin.getLocalizedText('tts.auto.lastElement'));
				this.ttsManager.toggleAutoTTS();
			}
		}

		_extractReadableElements() {
			const focusableSelectors = [
				'a[href]:not([tabindex="-1"]):not(.no-speech *):not(.blind *)',
				'area[href]:not(.no-speech *):not(.blind *)',
				'button:not([disabled]):not(.no-speech *):not(.blind *)',
				'input:not([disabled]):not([type="hidden"]):not(.no-speech *):not(.blind *)',
				'select:not([disabled]):not(.no-speech *):not(.blind *)',
				'textarea:not([disabled]):not(.no-speech *):not(.blind *)',
				'iframe:not(.no-speech *):not(.blind *)',
				'object:not(.no-speech *):not(.blind *)',
				'embed:not(.no-speech *):not(.blind *)',
				'[contenteditable]:not([tabindex="-1"]):not(.no-speech *):not(.blind *)',
				'[tabindex]:not([tabindex="-1"]):not(.no-speech *):not(.blind *)',
				'.ttsElm:not(.no-speech *):not(.blind *)'
			];

			const combinedSelector = focusableSelectors.join(', ');
			const allElements = document.querySelectorAll(combinedSelector);

			this.elements = Array.from(allElements).filter(element => {
				return element.offsetWidth > 0 &&
					element.offsetHeight > 0 &&
					this._isElementReadable(element);
			});

			this.elements.sort((a, b) => {
				const position = a.compareDocumentPosition(b);
				return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
			});
		}

		_isElementReadable(element) {
			if (element.closest('#wat-container') ||
				element.closest('.wat-exclude') ||
				(element.id && element.id.startsWith('wat-')) ||
				element.closest('[id^="wat-"]')) {
				return false;
			}

			const watUIClasses = ['wat-notification', 'wat-panel', 'wat-button', 'wat-overlay',
				'wat-modal', 'wat-tooltip', 'wat-popup', 'wat-menu', 'wat-toolbar'];
			if (watUIClasses.some(cls => element.classList.contains(cls) || element.closest('.' + cls))) {
				return false;
			}

			if (element.closest('.no-speech') || element.hasAttribute('data-no-speech')) {
				return false;
			}

			if (element.getAttribute('aria-hidden') === 'true') {
				return false;
			}

			const style = getComputedStyle(element);
			if (style.display === 'none' || style.visibility === 'hidden') {
				return false;
			}

			const isAccessibilityElement = this._isAccessibilityElement(element);

			if (!isAccessibilityElement) {
				if (style.opacity === '0') {
					return false;
				}
				if (element.offsetWidth === 0 && element.offsetHeight === 0) {
					return false;
				}
			}

			if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
				return false;
			}

			const text = this._extractTextFromElement(element);
			return text.trim().length > 0;
		}

		_isAccessibilityElement(element) {
			const accessibilityClasses = [
				'blind', 'sr-only', 'screen-reader-only', 'visually-hidden',
				'displayNone', 'ir_pm', 'ir_wa', 'hide', 'a11y-hidden'
			];
			return accessibilityClasses.some(className =>
				element.classList.contains(className) ||
				element.closest('.' + className)
			);
		}

		_readCurrentElement() {
			this._stopCurrentSpeech();
			this._clearAutoAdvanceTimer();

			const element = this.elements[this.currentIndex];
			if (!element) return;

			this._updateHighlight(element);

			const text = this._extractTextFromElement(element);
			this._speakText(text, () => {
				this._scheduleAutoAdvance();
			});
		}

		_extractTextFromElement(element) {
			const tagName = element.tagName.toLowerCase();
			const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];
			if (focusableTags.includes(tagName) ||
				(element.hasAttribute('role') && ['button', 'link'].includes(element.getAttribute('role'))) ||
				(element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1')) {
				// TextExtractor 직접 사용 — WAT 메서드 역참조 해소 (Phase 6-4)
				return this.plugin.textExtractor.generateTextToRead(element, tagName);
			}
			return this._extractTextWithImages(element);
		}

		_extractTextWithImages(element) {
			let text = '';
			const walker = document.createTreeWalker(
				element,
				NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
				{
					acceptNode: function(node) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							const style = getComputedStyle(node);
							if (style.display === 'none' || style.visibility === 'hidden') {
								return NodeFilter.FILTER_REJECT;
							}
						}
						if (node.nodeType === Node.TEXT_NODE) {
							return NodeFilter.FILTER_ACCEPT;
						}
						if (node.tagName && node.tagName.toLowerCase() === 'img') {
							return NodeFilter.FILTER_ACCEPT;
						}
						return NodeFilter.FILTER_SKIP;
					}
				}
			);

			let node;
			while ((node = walker.nextNode())) {
				if (node.nodeType === Node.TEXT_NODE) {
					const textContent = node.textContent.trim();
					if (textContent) {
						text += textContent + ' ';
					}
				} else if (node.tagName && node.tagName.toLowerCase() === 'img') {
					const altText = node.getAttribute('alt') ||
						node.getAttribute('title') ||
						this.plugin.getLocalizedText('panel.personal.options.imgTextConvert.msg.noAlt');
					text += `[${altText}] `;
				}
			}

			return text.trim();
		}

		_speakText(text, onEnd) {
			if (!window.speechSynthesis) {
				this.plugin.showNotification(this.plugin.getLocalizedText('panel.personal.options.tts.msg.noSupport'));
				return;
			}

			this.currentUtterance = new SpeechSynthesisUtterance(text);
			this.currentUtterance.rate = this.ttsManager.config.speechRate;

			const speechLang = this._getSpeechLang();
			if (speechLang) {
				this.currentUtterance.lang = speechLang;
			}

			this.currentUtterance.onend = () => {
				this._stopKeepAlive();
				this.currentUtterance = null;
				if (typeof onEnd === 'function') onEnd();
			};

			this.currentUtterance.onerror = (event) => {
				this._stopKeepAlive();
				this.currentUtterance = null;
				// 사용자 조작에 의한 중단/취소는 조용히 무시합니다.
				if (event && (event.error === 'interrupted' || event.error === 'canceled')) {
					return;
				}
				// 그 외 에러는 다음 요소로 진행해 자동 진행 체인을 유지합니다.
				if (typeof onEnd === 'function') onEnd();
			};

			window.speechSynthesis.speak(this.currentUtterance);
			this._startKeepAlive();
		}

		/**
		 * 플러그인 언어 설정을 음성 합성용 BCP-47 언어 코드로 변환합니다.
		 * @returns {string} 언어 코드 (설정이 없으면 빈 문자열)
		 */
		_getSpeechLang() {
			const lang = this.plugin && this.plugin.language;
			if (!lang) return '';
			const langMap = { ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', de: 'de-DE' };
			return langMap[lang] || lang;
		}

		/**
		 * Chrome 의 장문 발화 시 약 15초 후 무음 정지되는 버그를 우회하기 위해
		 * 발화 중 주기적으로 pause/resume 을 호출하는 킵얼라이브 타이머를 시작합니다.
		 */
		_startKeepAlive() {
			this._stopKeepAlive();
			this.keepAliveTimer = setInterval(() => {
				if (window.speechSynthesis && window.speechSynthesis.speaking) {
					window.speechSynthesis.pause();
					window.speechSynthesis.resume();
				}
			}, 10000);
		}

		/**
		 * 킵얼라이브 타이머를 해제합니다.
		 */
		_stopKeepAlive() {
			if (this.keepAliveTimer) {
				clearInterval(this.keepAliveTimer);
				this.keepAliveTimer = null;
			}
		}

		_scheduleAutoAdvance() {
			this.autoAdvanceTimer = setTimeout(() => {
				this.moveToNext();
			}, this.ttsManager.config.autoAdvanceDelay);
		}

		_updateHighlight(element) {
			this._removeAllHighlights();
			element.classList.add('wat-tts_highlight');
			this._addParentHighlightClasses(element);
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}

		_addParentHighlightClasses(element) {
			const irClasses = ['displayNone', 'blind', 'sr-only', 'visually-hidden', 'hide'];
			let parent = element.parentElement;
			while (parent && parent !== document.body) {
				if (irClasses.some(cls => parent.classList.contains(cls))) {
					parent.classList.add('wat-tts_highlight-parent');
				}
				parent = parent.parentElement;
			}
		}

		_removeAllHighlights() {
			document.querySelectorAll('.wat-tts_highlight').forEach(el => {
				el.classList.remove('wat-tts_highlight');
			});
			document.querySelectorAll('.wat-tts_highlight-parent').forEach(el => {
				el.classList.remove('wat-tts_highlight-parent');
			});
		}

		_stopCurrentSpeech() {
			this._stopKeepAlive();
			// cancel() 호출 전에 핸들러를 해제해 정지한 자동 읽기가 저절로 재시작되는 것을 방지합니다.
			if (this.currentUtterance) {
				this.currentUtterance.onend = null;
				this.currentUtterance.onerror = null;
				this.currentUtterance = null;
			}
			if (window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}
		}

		_clearAutoAdvanceTimer() {
			if (this.autoAdvanceTimer) {
				clearTimeout(this.autoAdvanceTimer);
				this.autoAdvanceTimer = null;
			}
		}
	}

	/**
	 * @fileoverview BaseTTS - FocusTTS와 KeyboardTTS의 공통 기능 베이스 클래스
	 * @module src/tts/BaseTTS
	 */
	class BaseTTS {
		constructor(ttsManager) {
			this.ttsManager = ttsManager;
			this.plugin = ttsManager.plugin;

			this.currentUtterance = null;
			this.highlightWrapper = null;
			this.originalSelection = null;
			this.keepAliveTimer = null;
			this.highlightRemoveTimer = null;
		}

		/**
		 * 주어진 DOM 요소가 WAT 자체 UI 요소인지 확인합니다.
		 * @param {Element} target - 검사할 요소
		 * @returns {boolean}
		 */
		_isWatUIElement(target) {
			if (!target) return false;
			return (
				target.closest('#wat-container') !== null ||
				target.closest('.wat-exclude') !== null ||
				target.closest('[id^="wat-"]') !== null ||
				target.closest('[class*="wat-"]') !== null ||
				(target.id && target.id.startsWith('wat-')) ||
				Array.from(target.classList || []).some(cls => cls.startsWith('wat-'))
			);
		}

		/**
		 * 선택 범위(range)를 하이라이트 래퍼로 감쌉니다.
		 * @param {Range} range - 감쌀 선택 범위
		 * @param {string} [extraClasses=''] - 추가 CSS 클래스
		 * @param {string} [extraStyles=''] - 추가 인라인 스타일
		 */
		_createHighlightWrapper(range, extraClasses = '', extraStyles = '') {
			try {
				this._removeHighlight();

				this.highlightWrapper = document.createElement('span');
				this.highlightWrapper.className = `wat-focus-tts-highlight${extraClasses ? ' ' + extraClasses : ''}`;
				this.highlightWrapper.style.cssText = `display: inline !important; position: relative !important;${extraStyles ? ' ' + extraStyles : ''}`;

				try {
					range.surroundContents(this.highlightWrapper);
				} catch (e) {
					// surroundContents 실패 시(요소 경계를 가로지르는 선택 등)
					// 호스트 페이지의 DOM을 분할/훼손하지 않도록 하이라이트를 포기하고 발화만 진행합니다.
					this.highlightWrapper = null;
					return;
				}

				const newRange = document.createRange();
				newRange.selectNodeContents(this.highlightWrapper);

				const selection = window.getSelection();
				selection.removeAllRanges();
				selection.addRange(newRange);

				this.highlightWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
			} catch (error) {
				console.warn('Failed to create highlight wrapper:', error);
			}
		}

		/**
		 * 하이라이트 래퍼를 제거하고 원래 DOM 구조를 복원합니다.
		 */
		_removeHighlight() {
			this._clearHighlightRemoveTimer();
			if (this.highlightWrapper && this.highlightWrapper.parentNode) {
				try {
					const parent = this.highlightWrapper.parentNode;
					const fragment = document.createDocumentFragment();

					while (this.highlightWrapper.firstChild) {
						fragment.appendChild(this.highlightWrapper.firstChild);
					}

					parent.insertBefore(fragment, this.highlightWrapper);
					parent.removeChild(this.highlightWrapper);

					this.highlightWrapper = null;
					this.originalSelection = null;
					parent.normalize();
				} catch (error) {
					console.warn('Failed to remove highlight wrapper:', error);
				}
			}
		}

		/**
		 * 텍스트를 음성으로 읽습니다.
		 * @param {string} text - 읽을 텍스트
		 * @param {Object} [callbacks={}] - onEnd / onError 콜백
		 */
		_speakText(text, { onEnd, onError } = {}) {
			if (!window.speechSynthesis) {
				this.plugin.showNotification('Browser does not support speech synthesis. (음성 합성을 지원하지 않는 브라우저입니다.)');
				return;
			}

			this._stopCurrentSpeech();

			this.currentUtterance = new SpeechSynthesisUtterance(text);
			this.currentUtterance.rate = this.ttsManager.config.speechRate;

			const speechLang = this._getSpeechLang();
			if (speechLang) {
				this.currentUtterance.lang = speechLang;
			}

			this.currentUtterance.onend = () => {
				this._stopKeepAlive();
				this.currentUtterance = null;
				if (typeof onEnd === 'function') onEnd();
			};

			this.currentUtterance.onerror = () => {
				this._stopKeepAlive();
				this.currentUtterance = null;
				if (typeof onError === 'function') onError();
			};

			window.speechSynthesis.speak(this.currentUtterance);
			this._startKeepAlive();
		}

		/**
		 * 플러그인 언어 설정을 음성 합성용 BCP-47 언어 코드로 변환합니다.
		 * @returns {string} 언어 코드 (설정이 없으면 빈 문자열)
		 */
		_getSpeechLang() {
			const lang = this.plugin && this.plugin.language;
			if (!lang) return '';
			const langMap = { ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', de: 'de-DE' };
			return langMap[lang] || lang;
		}

		/**
		 * Chrome 의 장문 발화 시 약 15초 후 무음 정지되는 버그를 우회하기 위해
		 * 발화 중 주기적으로 pause/resume 을 호출하는 킵얼라이브 타이머를 시작합니다.
		 */
		_startKeepAlive() {
			this._stopKeepAlive();
			this.keepAliveTimer = setInterval(() => {
				if (window.speechSynthesis && window.speechSynthesis.speaking) {
					window.speechSynthesis.pause();
					window.speechSynthesis.resume();
				}
			}, 10000);
		}

		/**
		 * 킵얼라이브 타이머를 해제합니다.
		 */
		_stopKeepAlive() {
			if (this.keepAliveTimer) {
				clearInterval(this.keepAliveTimer);
				this.keepAliveTimer = null;
			}
		}

		/**
		 * 하이라이트 제거를 지연 예약합니다. (핸들을 보관해 취소 가능)
		 * @param {number} [delay=500] - 지연 시간(ms)
		 */
		_scheduleHighlightRemoval(delay = 500) {
			this._clearHighlightRemoveTimer();
			this.highlightRemoveTimer = setTimeout(() => {
				this.highlightRemoveTimer = null;
				this._removeHighlight();
			}, delay);
		}

		/**
		 * 예약된 하이라이트 제거 타이머를 취소합니다.
		 */
		_clearHighlightRemoveTimer() {
			if (this.highlightRemoveTimer) {
				clearTimeout(this.highlightRemoveTimer);
				this.highlightRemoveTimer = null;
			}
		}

		/**
		 * 현재 진행 중인 음성 합성을 중지합니다.
		 */
		_stopCurrentSpeech() {
			this._stopKeepAlive();
			if (this.currentUtterance) {
				this.currentUtterance.onend = null;
				this.currentUtterance.onerror = null;
				this.currentUtterance = null;
			}
			if (window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}
		}

		/**
		 * 진행 중인 발화, 타이머, 하이라이트를 모두 정리합니다.
		 */
		destroy() {
			this._stopCurrentSpeech();
			this._clearHighlightRemoveTimer();
			this._removeHighlight();
		}
	}

	/**
	 * @fileoverview FocusTTS - 마우스 선택/드래그로 텍스트를 읽어주는 기능
	 * @module src/tts/FocusTTS
	 */

	class FocusTTS extends BaseTTS {
		constructor(ttsManager) {
			super(ttsManager);

			this.isEnabled = false;
			this.lastEventTime = 0;
			this.eventDebounceDelay = 150;
			this.selectionTimer = null;

			this.boundHandlers = {
				doubleClick: this._handleDoubleClick.bind(this),
				mouseUp: this._handleMouseUp.bind(this)
			};
		}

		enable() {
			if (this.isEnabled) return;

			this.isEnabled = true;
			document.addEventListener('dblclick', this.boundHandlers.doubleClick, { passive: true });
			document.addEventListener('mouseup', this.boundHandlers.mouseUp, { passive: true });
		}

		disable() {
			if (!this.isEnabled) return;

			this.isEnabled = false;
			document.removeEventListener('dblclick', this.boundHandlers.doubleClick, { passive: true });
			document.removeEventListener('mouseup', this.boundHandlers.mouseUp, { passive: true });

			this._clearSelectionTimer();
			this._stopCurrentSpeech();
			this._removeHighlight();
			this.lastEventTime = 0;
		}

		/**
		 * 포커스 읽기를 완전히 정리합니다. (리스너, 발화, 타이머, 하이라이트)
		 */
		destroy() {
			this.disable();
			super.destroy();
		}

		/**
		 * 예약된 선택 텍스트 처리 타이머를 취소합니다.
		 */
		_clearSelectionTimer() {
			if (this.selectionTimer) {
				clearTimeout(this.selectionTimer);
				this.selectionTimer = null;
			}
		}

		_handleDoubleClick(event) {
			if (!this.isEnabled) return;
			if (this._isWatUIElement(event.target)) return;

			const currentTime = Date.now();
			this.lastEventTime = currentTime;
			this._handleTextSelection('doubleclick', event);
		}

		_handleMouseUp(event) {
			if (!this.isEnabled) return;
			if (this._isWatUIElement(event.target)) return;

			const currentTime = Date.now();
			if (currentTime - this.lastEventTime < this.eventDebounceDelay) {
				return;
			}

			this._clearSelectionTimer();
			this.selectionTimer = setTimeout(() => {
				this.selectionTimer = null;
				// 지연 사이에 disable() 된 경우 발화하지 않도록 재확인합니다.
				if (!this.isEnabled) {
					return;
				}
				if (Date.now() - this.lastEventTime < this.eventDebounceDelay) {
					return;
				}
				this._handleTextSelection('mouseup', event);
			}, 100);
		}

		_handleTextSelection(eventType = 'unknown', event = null) {
			const selection = window.getSelection();
			const selectedText = selection.toString().trim();

			if (selectedText && selectedText.length >= 2) {
				// 발화 종료 시 currentUtterance 가 null 로 초기화되므로 null 여부로 진행 중인지 판단합니다.
				if (this.currentUtterance !== null &&
					this.highlightWrapper && this.highlightWrapper.textContent.trim() === selectedText) {
					return;
				}

				if (selection.rangeCount > 0) {
					this.originalSelection = selection.getRangeAt(0).cloneRange();
					this._createHighlightWrapper(this.originalSelection);
					this._speakText(selectedText, {
						onEnd: () => this._scheduleHighlightRemoval(500),
						onError: () => this._removeHighlight()
					});
				}
			} else if (event && event.target) {
				const element = event.target;
				const textToRead = this._extractElementText(element);

				if (textToRead && textToRead.trim().length > 0) {
					this._stopCurrentSpeech();
					this._speakText(textToRead.trim(), {
						onError: () => this._removeHighlight()
					});
				}
			}
		}

		_extractElementText(element) {
			if (!element) return '';

			const tagName = element.tagName ? element.tagName.toLowerCase() : '';
			const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];

			if (focusableTags.includes(tagName) ||
				(element.hasAttribute('role') && ['button', 'link'].includes(element.getAttribute('role'))) ||
				(element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1')) {
				try {
					// TextExtractor 직접 사용 — WAT 메서드 역참조 해소 (Phase 6-4)
					return this.plugin.textExtractor.generateTextToRead(element, tagName);
				} catch (error) {
					console.warn('Error using generateTextToRead, falling back to simple text extraction:', error);
				}
			}

			return this._getSimpleElementText(element);
		}

		_getSimpleElementText(element) {
			if (element.getAttribute('aria-label')) {
				return element.getAttribute('aria-label');
			}
			if (element.title) {
				return element.title;
			}
			let text = element.textContent ? element.textContent.trim() : '';
			if (!text && element.tagName && element.tagName.toLowerCase() === 'img') {
				text = element.getAttribute('alt') || '';
			}
			if (!text && element.value) {
				text = element.value;
			}
			return text.trim();
		}
	}

	/**
	 * @fileoverview KeyboardTTS - 키보드 단축키로 선택된 텍스트를 읽어주는 기능
	 * @module src/tts/KeyboardTTS
	 */

	class KeyboardTTS extends BaseTTS {
		constructor(ttsManager) {
			super(ttsManager);
		}

		execute() {
			const selection = window.getSelection();
			const selectedText = selection.toString().trim();

			if (!selectedText) {
				this.plugin.showNotification('No text selected. (선택된 텍스트가 없습니다.)');
				return;
			}

			if (selection.rangeCount > 0) {
				this.originalSelection = selection.getRangeAt(0).cloneRange();
				this._createHighlightWrapper(
					this.originalSelection,
					'wat-keyboard-tts',
					'box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.4) !important;'
				);
				this._speakText(selectedText, {
					onEnd: () => this._scheduleHighlightRemoval(500),
					onError: () => this._removeHighlight()
				});
			}
		}
	}

	/**
	 * @fileoverview TTSManager - TTS 기능 통합 관리자
	 * @module src/tts/TTSManager
	 */

	/**
	 * TTS Manager - Integrated TTS functionality manager
	 * @class TTSManager
	 */
	class TTSManager {
		constructor(plugin) {
			this.plugin = plugin;

			this.states = {
				AUTO_TTS: 'autoTTS',
				FOCUS_TTS: 'focusTTS',
				KEYBOARD_TTS: 'keyboardTTS',
				INACTIVE: 'inactive'
			};

			this.currentState = this.states.INACTIVE;

			this.autoTTS = null;
			this.focusTTS = null;
			this.keyboardTTS = null;

			this.config = {
				autoAdvanceDelay: plugin.options?.ttsAutoAdvanceDelay || 1000,
				speechRate: plugin.options?.ttsSpeechRate || 1.6
			};

			this._initializeModules();
		}

		_initializeModules() {
			this.autoTTS = new AutoTTS(this);
			this.focusTTS = new FocusTTS(this);
			this.keyboardTTS = new KeyboardTTS(this);
		}

		setSpeechRate(rate) {
			if (rate >= 0.1 && rate <= 10) {
				this.config.speechRate = rate;
			} else {
				console.warn('TTS speed must be between 0.1 and 10 (TTS 속도는 0.1 ~ 10 사이의 값이어야 합니다):', rate);
			}
		}

		getSpeechRate() {
			return this.config.speechRate;
		}

		toggleAutoTTS() {
			if (this.currentState === this.states.AUTO_TTS) {
				this._stopAllTTS();
				this._setState(this.states.INACTIVE);
			} else {
				this._stopOtherTTS(this.states.AUTO_TTS);
				this._setState(this.states.AUTO_TTS);
				this.autoTTS.start();
			}
			this._updateUI();
		}

		toggleFocusTTS() {
			if (this.currentState === this.states.FOCUS_TTS) {
				this._stopAllTTS();
				this._setState(this.states.INACTIVE);
			} else {
				this._stopOtherTTS(this.states.FOCUS_TTS);
				this._setState(this.states.FOCUS_TTS);
				this.focusTTS.enable();
			}
			this._updateUI();
		}

		executeKeyboardTTS() {
			if (this.currentState !== this.states.INACTIVE) {
				this._stopAllTTS();
				this._setState(this.states.INACTIVE);
				this._updateUI();
			}
			this.keyboardTTS.execute();
		}

		navigatePrevious() {
			if (this.currentState === this.states.AUTO_TTS && this.autoTTS) {
				this.autoTTS.moveToPrevious();
			}
		}

		navigateNext() {
			if (this.currentState === this.states.AUTO_TTS && this.autoTTS) {
				this.autoTTS.moveToNext();
			}
		}

		_setState(newState) {
			this.currentState = newState;
			this.plugin.state.set('tts.currentState', newState);
		}

		_stopOtherTTS(exceptState) {
			if (exceptState !== this.states.AUTO_TTS && this.autoTTS) {
				this.autoTTS.stop();
			}
			if (exceptState !== this.states.FOCUS_TTS && this.focusTTS) {
				this.focusTTS.disable();
			}
		}

		_stopAllTTS() {
			if (this.autoTTS) this.autoTTS.stop();
			if (this.focusTTS) this.focusTTS.disable();
			if (window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}
		}

		/**
		 * TTS 매니저를 완전히 정리합니다.
		 * 플러그인 cleanup(destroy) 시 호출해 리스너, 타이머, 진행 중인 발화를 모두 해제합니다.
		 */
		destroy() {
			try {
				if (this.autoTTS) this.autoTTS.destroy();
			} catch (error) {
				console.warn('Failed to destroy AutoTTS:', error);
			}
			try {
				if (this.focusTTS) this.focusTTS.destroy();
			} catch (error) {
				console.warn('Failed to destroy FocusTTS:', error);
			}
			try {
				if (this.keyboardTTS) this.keyboardTTS.destroy();
			} catch (error) {
				console.warn('Failed to destroy KeyboardTTS:', error);
			}
			if (window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}
			this.currentState = this.states.INACTIVE;
		}

		_updateUI() {
			this._updateAutoTTSButton();
			this._updateFocusTTSButton();
			this._updateNavigationButtons();
		}

		_updateAutoTTSButton() {
			const btn = document.getElementById('wat-button-tts_toggle');
			if (btn) {
				if (this.currentState === this.states.AUTO_TTS) {
					btn.textContent = this.plugin.getLocalizedText('panel.tts.stop') || '자동 읽기 중지';
					btn.classList.add('active');
				} else {
					btn.textContent = this.plugin.getLocalizedText('panel.tts.start') || '자동 읽기';
					btn.classList.remove('active');
				}
			}
		}

		_updateFocusTTSButton() {
			const btn = document.getElementById('wat-button-tts_focus_toggle');
			if (btn) {
				if (this.currentState === this.states.FOCUS_TTS) {
					btn.textContent = this.plugin.getLocalizedText('panel.tts.focusStop') || '포커스 읽기 중지';
					btn.classList.add('active');
				} else {
					btn.textContent = this.plugin.getLocalizedText('panel.tts.focusStart') || '포커스 읽기';
					btn.classList.remove('active');
				}
			}
		}

		_updateNavigationButtons() {
			const isAutoTTSActive = this.currentState === this.states.AUTO_TTS;
			const prevBtn = document.getElementById('wat-button-tts_prev');
			const nextBtn = document.getElementById('wat-button-tts_next');

			if (prevBtn) prevBtn.disabled = !isAutoTTSActive;
			if (nextBtn) nextBtn.disabled = !isAutoTTSActive;
		}
	}

	/**
	 * @fileoverview TextExtractor - TTS 낭독용 텍스트 추출 담당
	 * @module src/tts/TextExtractor
	 * @description WAT.js에서 추출된 텍스트 추출 클러스터 (Phase 6-4).
	 *              요소 유형별(입력·링크·버튼·이미지·표 등) 낭독 텍스트 생성과
	 *              이미지 alt 포함 텍스트 추출을 담당한다. AutoTTS/FocusTTS가
	 *              WAT 메서드를 역참조하던 구조를 해소한다.
	 */

	class TextExtractor {
		/**
		 * @param {Object} plugin - WAT 인스턴스 (로케일·언어 서비스 제공자)
		 */
		constructor(plugin) {
			this.plugin = plugin;
		}

		/**
		 * Extracts text content including image descriptions from an element (요소에서 이미지 설명을 포함한 텍스트 내용을 추출합니다)
		 * @param {HTMLElement} element - Element to extract text from (텍스트를 추출할 요소)
		 * @returns {string} Extracted text with image descriptions (이미지 설명이 포함된 추출된 텍스트)
		 * @description Walks through element nodes and extracts text and image alt text for comprehensive TTS reading
		 *              (요소 노드를 순회하며 포괄적인 TTS 읽기를 위해 텍스트와 이미지 alt 텍스트를 추출합니다)
		 * @example
		 * // Extract text with images from a container (컨테이너에서 이미지와 함께 텍스트 추출)
		 * const text = this.extractTextWithImages(containerElement);
		 */
		extractTextWithImages(element) {
			let text = '';
			
			// 텍스트 노드와 이미지를 순회하며 텍스트 추출
			const walker = document.createTreeWalker(
				element,
				NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
				{
					acceptNode: function(node) {
						// 텍스트 노드이거나 img 태그인 경우만 허용
						if (node.nodeType === Node.TEXT_NODE) {
							return NodeFilter.FILTER_ACCEPT;
						}
						if (node.tagName && node.tagName.toLowerCase() === 'img') {
							return NodeFilter.FILTER_ACCEPT;
						}
						return NodeFilter.FILTER_SKIP;
					}
				}
			);

			let node;
			while ((node = walker.nextNode())) {
				if (node.nodeType === Node.TEXT_NODE) {
					// 텍스트 노드의 경우 내용 추가
					const textContent = node.textContent.trim();
					if (textContent) {
						text += textContent + ' ';
					}
				} else if (node.tagName && node.tagName.toLowerCase() === 'img') {
					// 이미지의 경우 alt 속성 또는 title 속성 사용
					const altText = node.getAttribute('alt') || node.getAttribute('title') || this.plugin.getLocalizedText('panel.personal.options.imgTextConvert.msg.noAlt');
					text += `[${altText}] `;
				}
			}

			return text.trim();
		}

		/**
		 * Generates appropriate TTS text based on element type (요소 타입에 따라 적절한 TTS 텍스트를 생성합니다)
		 * @param {HTMLElement} element - Element to generate text for (텍스트를 생성할 요소)
		 * @param {string} tagName - Tag name of the element (요소의 태그명)
		 * @returns {string} Generated TTS text (생성된 TTS 텍스트)
		 * @description Creates contextual TTS text based on element type (input, button, link, etc.)
		 *              (요소 타입(input, button, link 등)에 따라 맥락적 TTS 텍스트를 생성합니다)
		 * @example
		 * // Generate text for a button element (버튼 요소에 대한 텍스트 생성)
		 * const text = this.generateTextToRead(buttonElement, 'button');
		 */
		generateTextToRead(element, tagName) {
			let textToRead = '';
			const lang = this.plugin.language || Localization.DEFAULT_LANGUAGE;

			switch (tagName) {
				case 'input':
					textToRead = this.generateInputText(element, lang);
					break;
				case 'textarea':
					textToRead = this.generateTextareaText(element, lang);
					break;
				case 'select':
					textToRead = this.generateSelectText(element, lang);
					break;
				case 'a':
					textToRead = this.generateLinkText(element, lang);
					break;
				case 'button':
					textToRead = this.generateButtonText(element, lang);
					break;
				case 'img':
					textToRead = this.generateImageText(element, lang);
					break;
				case 'progress':
					textToRead = this.generateProgressText(element, lang);
					break;
				case 'table':
					textToRead = this.generateTableText(element, lang);
					break;
				default:
					textToRead = this.extractTextWithImages(element);
					break;
			}

			return textToRead;
		}

		/**
		 * Generates TTS text for input elements (입력 요소에 대한 TTS 텍스트를 생성합니다)
		 * @param {HTMLInputElement} element - Input element (입력 요소)
		 * @param {string} lang - Language code (언어 코드)
		 * @returns {string} Generated input text description (생성된 입력 텍스트 설명)
		 * @description Creates descriptive text for various input types including current values and states
		 *              (현재 값과 상태를 포함하여 다양한 입력 타입에 대한 설명 텍스트를 생성합니다)
		 * @example
		 * // Generate text for a text input (텍스트 입력에 대한 텍스트 생성)
		 * const text = this.generateInputText(inputElement, 'ko');
		 */
		generateInputText(element, lang) {
			const type = element.type || 'text';
			const label = this.findLabelForElement(element);
			const value = element.value || '';
			const placeholder = element.placeholder || '';
			
			let text = '';
			
			if (label) {
				text += label + ' ';
			}
			
			// 입력 타입별 처리
			switch (type) {
				case 'text':
				case 'email':
				case 'password':
				case 'search':
				case 'url':
					if (value) {
						text += value;
					} else if (placeholder) {
						text += placeholder;
					}
					//text += ' ' + this.plugin.getLocalizedText('tts.input.types.textFieldSuffix');
					break;
				case 'checkbox':
					text += element.checked ? this.plugin.getLocalizedText('tts.input.states.checked') : this.plugin.getLocalizedText('tts.input.states.unchecked');
					//text += ' ' + this.plugin.getLocalizedText('tts.input.types.checkboxSuffix');
					break;
				case 'radio':
					text += element.checked ? this.plugin.getLocalizedText('tts.input.states.selected') : this.plugin.getLocalizedText('tts.input.states.unselected');
					//text += ' ' + this.plugin.getLocalizedText('tts.input.types.radioSuffix');
					break;
				case 'button':
				case 'submit':
				case 'reset':
					text += value || element.textContent || this.plugin.getLocalizedText('tts.input.types.button');
					//text += ' ' + this.plugin.getLocalizedText('tts.input.types.buttonSuffix');
					break;
				default:
					if (value) {
						text += value;
					}
					//text += ' ' + type + ' ' + this.plugin.getLocalizedText('tts.input.types.fieldSuffix');
					break;
			}
			
			return text.trim();
		}

		/**
		 * Generates TTS text for textarea elements (textarea 요소에 대한 TTS 텍스트를 생성합니다)
		 * @param {HTMLTextAreaElement} element - Textarea element (textarea 요소)
		 * @param {string} lang - Language code (언어 코드)
		 * @returns {string} Generated textarea text description (생성된 textarea 텍스트 설명)
		 * @description Creates descriptive text for textarea including labels, values, and placeholders
		 *              (라벨, 값, 플레이스홀더를 포함하여 textarea에 대한 설명 텍스트를 생성합니다)
		 * @example
		 * // Generate text for a textarea (textarea에 대한 텍스트 생성)
		 * const text = this.generateTextareaText(textareaElement, 'ko');
		 */
		generateTextareaText(element, lang) {
			const label = this.findLabelForElement(element);
			const value = element.value || '';
			const placeholder = element.placeholder || '';
			
			let text = '';
			
			if (label) {
				text += label + ' ';
			}
			
			//text += this.plugin.getLocalizedText('tts.textarea.label') + ' ';
			
			if (value) {
				//text += this.plugin.getLocalizedText('tts.textarea.currentValue') + ' ' + value;
				text += value;
			} else if (placeholder) {
				//text += this.plugin.getLocalizedText('tts.textarea.placeholder') + ' ' + placeholder;
				text += placeholder;
			}
			
			return text.trim();
		}

		/**
		 * Generates TTS text for select elements (select 요소에 대한 TTS 텍스트를 생성합니다)
		 * @param {HTMLSelectElement} element - Select element (select 요소)
		 * @param {string} lang - Language code (언어 코드)
		 * @returns {string} Generated select text description (생성된 select 텍스트 설명)
		 * @description Creates descriptive text for select elements including labels and selected options
		 *              (라벨과 선택된 옵션을 포함하여 select 요소에 대한 설명 텍스트를 생성합니다)
		 * @example
		 * // Generate text for a select dropdown (select 드롭다운에 대한 텍스트 생성)
		 * const text = this.generateSelectText(selectElement, 'ko');
		 */
		generateSelectText(element, lang) {
			const label = this.findLabelForElement(element);
			const selectedOption = element.selectedOptions[0];
			
			let text = '';
			
			if (label) {
				text += label;
			}
			
			if (selectedOption) {
				if (label) text += ' ';
				text += selectedOption.textContent;
				//text += ' ' + this.plugin.getLocalizedText('tts.select.suffix'); // 콤보박스, 드롭다운 등
			} else {
				if (label) text += ' ';
				//text += this.plugin.getLocalizedText('tts.select.noSelection');
			}
			
			return text.trim();
		}

		/**
		 * Generates TTS text for link elements (링크 요소에 대한 TTS 텍스트를 생성합니다)
		 * @param {HTMLAnchorElement} element - Link element (링크 요소)
		 * @param {string} lang - Language code (언어 코드)
		 * @returns {string} Generated link text description (생성된 링크 텍스트 설명)
		 * @description Creates descriptive text for links including link text, titles, and new window indicators
		 *              (링크 텍스트, 제목, 새 창 표시기를 포함하여 링크에 대한 설명 텍스트를 생성합니다)
		 * @example
		 * // Generate text for a link (링크에 대한 텍스트 생성)
		 * const text = this.generateLinkText(linkElement, 'ko');
		 */
		generateLinkText(element, lang) {
			const linkText = element.textContent.trim() || element.href;
			const title = element.title || '';
			
			let text = linkText;
			
			if (title && title !== linkText) {
				text += ' ' + title;
			}
			
			// 새 창에서 열리는 링크인지 확인
			if (element.target === '_blank') {
				text += ' ' + this.plugin.getLocalizedText('tts.link.newWindow');
			}
			
			// 링크임을 나타내는 접미사 추가
			//text += ' ' + this.plugin.getLocalizedText('tts.link.suffix');
			
			return text.trim();
		}

		/**
		 * Generates TTS text for button elements (버튼 요소에 대한 TTS 텍스트를 생성합니다)
		 * @param {HTMLButtonElement} element - Button element (버튼 요소)
		 * @param {string} lang - Language code (언어 코드)
		 * @returns {string} Generated button text description (생성된 버튼 텍스트 설명)
		 * @description Creates descriptive text for buttons using aria-labels, text content, or titles
		 *              (aria-label, 텍스트 내용, 또는 제목을 사용하여 버튼에 대한 설명 텍스트를 생성합니다)
		 * @example
		 * // Generate text for a button (버튼에 대한 텍스트 생성)
		 * const text = this.generateButtonText(buttonElement, 'ko');
		 */
		generateButtonText(element, lang) {
			const buttonText = element.textContent.trim() || element.value || '';
			const title = element.title || '';
			const ariaLabel = element.getAttribute('aria-label') || '';
			
			let text = '';
			
			if (ariaLabel) {
				text = ariaLabel;
			} else if (buttonText) {
				text = buttonText;
			} else if (title) {
				text = title;
			} else {
				text = this.plugin.getLocalizedText('tts.button.unlabeled');
			}
			
			// 버튼임을 나타내는 접미사 추가 (레이블이 아닌 접미사로)
			if (text && text !== this.plugin.getLocalizedText('tts.button.unlabeled')) ;
			
			return text.trim();
		}

		/**
		 * Generates TTS text for image elements (이미지 요소에 대한 TTS 텍스트를 생성합니다)
		 * @param {HTMLImageElement} element - Image element (이미지 요소)
		 * @param {string} lang - Language code (언어 코드)
		 * @returns {string} Generated image text description (생성된 이미지 텍스트 설명)
		 * @description Creates descriptive text for images using alt text, title, or default descriptions
		 *              (alt 텍스트, 제목, 또는 기본 설명을 사용하여 이미지에 대한 설명 텍스트를 생성합니다)
		 * @example
		 * // Generate text for an image (이미지에 대한 텍스트 생성)
		 * const text = this.generateImageText(imageElement, 'ko');
		 */
		generateImageText(element, lang) {
			const alt = element.alt || '';
			const title = element.title || '';

			let text = this.plugin.getLocalizedText('tts.image.label') + ' ';
			
			if (alt) {
				text += alt;
			} else if (title) {
				text += title;
			} else {
				text += this.plugin.getLocalizedText('tts.image.noDescription');
			}
			
			return text.trim();
		}

		/**
		 * Generates TTS text for progress elements (progress 요소에 대한 TTS 텍스트를 생성합니다)
		 * @param {HTMLProgressElement} element - Progress element (progress 요소)
		 * @param {string} lang - Language code (언어 코드)
		 * @returns {string} Generated progress text description (생성된 progress 텍스트 설명)
		 * @description Creates descriptive text for progress bars including percentage completion
		 *              (완료 백분율을 포함하여 진행률 표시줄에 대한 설명 텍스트를 생성합니다)
		 * @example
		 * // Generate text for a progress bar (진행률 표시줄에 대한 텍스트 생성)
		 * const text = this.generateProgressText(progressElement, 'ko');
		 */
		generateProgressText(element, lang) {
			const value = element.value || 0;
			const max = element.max || 100;
			const percentage = Math.round((value / max) * 100);
			
			let text = this.plugin.getLocalizedText('tts.progress.label') + ' ';
			text += percentage + this.plugin.getLocalizedText('tts.progress.percent');
			
			return text.trim();
		}

		/**
		 * Generates TTS text for table elements (table 요소에 대한 TTS 텍스트를 생성합니다)
		 * @param {HTMLTableElement} element - Table element (table 요소)
		 * @param {string} lang - Language code (언어 코드)
		 * @returns {string} Generated table text description (생성된 table 텍스트 설명)
		 * @description Creates descriptive text for tables including captions and dimensions
		 *              (캡션과 크기를 포함하여 테이블에 대한 설명 텍스트를 생성합니다)
		 * @example
		 * // Generate text for a table (테이블에 대한 텍스트 생성)
		 * const text = this.generateTableText(tableElement, 'ko');
		 */
		generateTableText(element, lang) {
			const caption = element.querySelector('caption');
			const rows = element.querySelectorAll('tr').length;
			// 행이 0개인 빈 테이블에서 0으로 나눠 NaN이 발화되는 것을 방지
			const cols = rows > 0 ? element.querySelectorAll('th, td').length / rows : 0;

			let text = this.plugin.getLocalizedText('tts.table.label') + ' ';

			if (caption) {
				text += caption.textContent + ' ';
			}

			if (rows > 0) {
				text += this.plugin.getLocalizedText('tts.table.size', { rows: rows, cols: Math.round(cols) });
			}

			return text.trim();
		}

		/**
		 * Finds the label associated with a form element (폼 요소와 연관된 라벨을 찾습니다)
		 * @param {HTMLElement} element - Form element to find label for (라벨을 찾을 폼 요소)
		 * @returns {string} Label text or empty string if not found (라벨 텍스트 또는 찾을 수 없으면 빈 문자열)
		 * @description Searches for labels using various methods: for attribute, parent label, aria-label, aria-labelledby, title
		 *              (다양한 방법으로 라벨을 검색: for 속성, 부모 라벨, aria-label, aria-labelledby, title)
		 * @example
		 * // Find label for an input element (입력 요소의 라벨 찾기)
		 * const label = this.findLabelForElement(inputElement);
		 */
		findLabelForElement(element) {
			// 1. label[for] 속성으로 연결된 경우 — 호스트 페이지 id에 특수문자가 있어도 안전하도록 이스케이프
			if (element.id) {
				try {
					const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(element.id) : element.id;
					const label = document.querySelector(`label[for="${escapedId}"]`);
					if (label) {
						return label.textContent.trim();
					}
				} catch (e) {
					// 셀렉터 오류 시 다음 탐색 방법으로 진행
				}
			}
			
			// 2. label로 감싸진 경우
			const parentLabel = element.closest('label');
			if (parentLabel) {
				return parentLabel.textContent.replace(element.textContent, '').trim();
			}
			
			// 3. aria-label 또는 aria-labelledby
			const ariaLabel = element.getAttribute('aria-label');
			if (ariaLabel) {
				return ariaLabel;
			}
			
			const ariaLabelledBy = element.getAttribute('aria-labelledby');
			if (ariaLabelledBy) {
				// aria-labelledby는 공백으로 구분된 여러 ID를 가질 수 있음
				const labelText = ariaLabelledBy.split(/\s+/)
					.map(id => {
						const labelElement = document.getElementById(id);
						return labelElement ? labelElement.textContent.trim() : '';
					})
					.filter(Boolean)
					.join(' ');
				if (labelText) {
					return labelText;
				}
			}
			
			// 4. title 속성
			const title = element.getAttribute('title');
			if (title) {
				return title;
			}
			
			return '';
		}
	}

	/**
	 * @fileoverview VoiceCommand - 음성으로 웹페이지를 제어하는 기능
	 * @module src/stt/VoiceCommand
	 */
	class VoiceCommand {
		constructor(sttManager) {
			this.sttManager = sttManager;
			this.plugin = sttManager.plugin;

			this.recognition = null;
			this.isActive = false;

			this.states = {
				INACTIVE: 'inactive',
				WAITING: 'waiting',
				LISTENING: 'listening',
				PROCESSING: 'processing',
				EXECUTING: 'executing',
				COOLDOWN: 'cooldown'
			};
			this.currentState = this.states.INACTIVE;

			this.timers = {
				cooldown: null,
				silenceDetection: null,
				commandTimeout: null,
				postCommand: null,
				restart: null
			};

			this.config = {
				silenceThreshold: 1500,
				minRecordingTime: 1000,
				commandTimeout: 8000,
				cooldownTime: 2000,
				maxRetries: 3
			};

			this.commands = this._loadLocalizedCommands();

			this.statusDisplay = null;
			this.lastCommandTime = 0;
			this.commandHistory = [];
			this.retryCount = 0;

			this.audioContext = null;
			this.analyser = null;
			this.silenceTimer = null;
			this.isSpeaking = false;
			this.lastSpeechTime = 0;
		}

		/**
		 * 음성 명령을 시작합니다.
		 * @returns {boolean} 시작 성공 여부 (미지원 브라우저면 false)
		 */
		start() {
			if (!this._checkSupport()) {
				this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.noSupport'));
				return false;
			}

			this.retryCount = 0;
			this._createStatusDisplay();
			this._setState(this.states.WAITING);
			this._startContinuousRecognition();
			return true;
		}

		stop() {
			this._setState(this.states.INACTIVE);
			this._clearAllTimers();

			// stop() 대신 abort() 사용: 보류 중인 인식 결과로 명령이 실행되는 것을 방지
			if (this.recognition) {
				this.recognition.abort();
				this.isActive = false;
			}

			this._removeStatusDisplay();
		}

		/**
		 * 복구 불가능한 오류로 음성 명령을 완전히 정지하고 매니저에 통지합니다.
		 * (권한 거부, 재시도 횟수 초과 등)
		 */
		_deactivate() {
			this.stop();

			if (this.sttManager && typeof this.sttManager.handleVoiceCommandStopped === 'function') {
				this.sttManager.handleVoiceCommandStopped();
			}
		}

		_createStatusDisplay() {
			this._removeStatusDisplay();

			this.statusDisplay = document.createElement('div');
			this.statusDisplay.id = 'wat-voice-status';
			this.statusDisplay.className = 'wat-voice-status wat-exclude';
			// 스크린 리더가 상태 변화를 자동으로 읽을 수 있도록 라이브 영역으로 지정
			this.statusDisplay.setAttribute('role', 'status');
			this.statusDisplay.setAttribute('aria-live', 'polite');
			this.statusDisplay.innerHTML = `
			<div class="status-icon">🎤</div>
			<div class="status-text">${this.plugin.getLocalizedText('command.voice.status.preparing')}</div>
			<div class="status-detail"></div>
			<div class="status-progress"></div>
		`;

			this.statusDisplay.style.cssText = `
			position: fixed;
			top: 20px;
			left: 50%;
			transform: translateX(-50%);
			background: rgba(0, 0, 0, 0.9);
			color: white;
			padding: 15px 25px;
			border-radius: 25px;
			z-index: 10000;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 14px;
			text-align: center;
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
			backdrop-filter: blur(10px);
			transition: all 0.3s ease;
			min-width: 200px;
		`;

			document.body.appendChild(this.statusDisplay);
		}

		_removeStatusDisplay() {
			if (this.statusDisplay && this.statusDisplay.parentNode) {
				this.statusDisplay.parentNode.removeChild(this.statusDisplay);
				this.statusDisplay = null;
			}
		}

		_setState(newState) {
			this.currentState = newState;
			this._updateStatusDisplay();
		}

		_updateStatusDisplay() {
			if (!this.statusDisplay) return;

			const icon = this.statusDisplay.querySelector('.status-icon');
			const text = this.statusDisplay.querySelector('.status-text');
			const detail = this.statusDisplay.querySelector('.status-detail');
			const progress = this.statusDisplay.querySelector('.status-progress');

			switch (this.currentState) {
				case this.states.INACTIVE:
					icon.textContent = '🔇';
					text.textContent = this.plugin.getLocalizedText('command.voice.status.inactive');
					detail.textContent = '';
					this.statusDisplay.style.background = 'rgba(128, 128, 128, 0.9)';
					progress.style.display = 'none';
					break;
				case this.states.WAITING:
					icon.textContent = '🎤';
					text.textContent = this.plugin.getLocalizedText('command.voice.status.waiting');
					detail.textContent = this.plugin.getLocalizedText('command.voice.status.waitingDetail');
					this.statusDisplay.style.background = 'rgba(33, 150, 243, 0.9)';
					progress.style.display = 'none';
					break;
				case this.states.LISTENING:
					icon.textContent = '🎧';
					text.textContent = this.plugin.getLocalizedText('command.voice.status.listening');
					detail.textContent = this.plugin.getLocalizedText('command.voice.status.listeningDetail');
					this.statusDisplay.style.background = 'rgba(76, 175, 80, 0.9)';
					progress.style.display = 'block';
					progress.innerHTML = '<div style="width: 100%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;"><div class="progress-bar" style="width: 0%; height: 100%; background: white; border-radius: 2px; animation: pulse 1s infinite;"></div></div>';
					break;
				case this.states.PROCESSING:
					icon.textContent = '⚙️';
					text.textContent = this.plugin.getLocalizedText('command.voice.status.processing');
					detail.textContent = this.plugin.getLocalizedText('command.voice.status.processingDetail');
					this.statusDisplay.style.background = 'rgba(255, 193, 7, 0.9)';
					progress.style.display = 'none';
					break;
				case this.states.EXECUTING:
					icon.textContent = '🚀';
					text.textContent = this.plugin.getLocalizedText('command.voice.status.executing');
					this.statusDisplay.style.background = 'rgba(139, 195, 74, 0.9)';
					progress.style.display = 'none';
					break;
				case this.states.COOLDOWN:
					icon.textContent = '⏱️';
					text.textContent = this.plugin.getLocalizedText('command.voice.status.cooldown');
					detail.textContent = this.plugin.getLocalizedText('command.voice.status.cooldownDetail');
					this.statusDisplay.style.background = 'rgba(158, 158, 158, 0.9)';
					progress.style.display = 'none';
					break;
			}
		}

		_updateExecutingStatus(commandText) {
			if (!this.statusDisplay) return;
			const detail = this.statusDisplay.querySelector('.status-detail');
			detail.textContent = this.plugin.getLocalizedText('command.voice.status.executingDetail', { command: commandText });
		}

		_startContinuousRecognition() {
			// 이전 사이클의 commandTimeout이 남아 있으면 해제 (타이머 누수 방지)
			if (this.timers.commandTimeout) {
				clearTimeout(this.timers.commandTimeout);
				this.timers.commandTimeout = null;
			}

			this._initializeRecognition();

			this.timers.commandTimeout = setTimeout(() => {
				if (this.currentState === this.states.WAITING ||
					this.currentState === this.states.LISTENING) {
					this._setState(this.states.COOLDOWN);
					// 타임아웃 시 진행 중인 인식도 실제로 중단
					if (this.recognition) {
						this.recognition.abort();
					}
					this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.timeout'));
					this._startCooldown();
				}
			}, this.config.commandTimeout);

			this._startRecognition();
		}

		_startCooldown() {
			// stop() 이후에는 쿨다운을 통한 재시작을 하지 않음 (좀비 재시작 방지)
			if (this.currentState === this.states.INACTIVE) return;

			this._clearAllTimers();
			this._setState(this.states.COOLDOWN);

			this.timers.cooldown = setTimeout(() => {
				if (this.currentState === this.states.COOLDOWN) {
					this._setState(this.states.WAITING);
					this._startContinuousRecognition();
				}
			}, this.config.cooldownTime);
		}

		/**
		 * 로케일에서 음성 명령어 키워드를 로드합니다.
		 * 로케일 데이터가 없으면 한국어 기본값을 사용합니다.
		 * @returns {{navigation: string[], action: string[], settings: string[]}}
		 */
		_loadLocalizedCommands() {
			const defaults = {
				navigation: ['이동', '링크', '클릭'],
				action: ['실행', '켜기', '끄기', '종료'],
				settings: ['설정', '옵션', '메뉴']
			};

			if (!this.plugin || typeof this.plugin.getLocalizedText !== 'function') {
				return defaults;
			}

			const parseKeywords = (key, fallback) => {
				const text = this.plugin.getLocalizedText(key);
				if (typeof text === 'string' && text.trim()) {
					return text.split(',').map(s => s.trim()).filter(Boolean);
				}
				return fallback;
			};

			return {
				navigation: parseKeywords('command.voiceCommands.navigation', defaults.navigation),
				action: parseKeywords('command.voiceCommands.action', defaults.action),
				settings: parseKeywords('command.voiceCommands.settings', defaults.settings)
			};
		}

		/**
		 * 언어 변경 시 명령어 키워드를 다시 로드합니다.
		 */
		refreshCommands() {
			this.commands = this._loadLocalizedCommands();
		}

		_checkSupport() {
			return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
		}

		_initializeRecognition() {
			const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
			const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;

			// 기존 인스턴스가 있으면 핸들러 해제 + 중단 후 교체 (이벤트 중복/유령 인식 방지)
			if (this.recognition) {
				this.recognition.onstart = null;
				this.recognition.onend = null;
				this.recognition.onresult = null;
				this.recognition.onerror = null;
				this.recognition.onnomatch = null;
				this.recognition.onspeechstart = null;
				this.recognition.onspeechend = null;
				this.recognition.onsoundstart = null;
				this.recognition.onsoundend = null;
				try {
					this.recognition.abort();
				} catch (error) {
					// 이미 종료된 인스턴스면 무시
				}
				this.isActive = false;
			}

			this.recognition = new SpeechRecognition();

			if (SpeechGrammarList) {
				const speechRecognitionList = new SpeechGrammarList();
				this.recognition.grammars = speechRecognitionList;
			}

			this.recognition.lang = this.sttManager.config.language;
			this.recognition.interimResults = this.sttManager.config.interimResults;
			// 상태 머신(WAITING→LISTENING→…→COOLDOWN)이 단발 인식을 전제로 설계되어
			// 설정값과 무관하게 continuous는 항상 false를 유지합니다.
			this.recognition.continuous = false;
			this.recognition.maxAlternatives = this.sttManager.config.maxAlternatives;

			this._setupEventHandlers();
		}

		_setupEventHandlers() {
			this.recognition.onstart = () => {
				// stop()이 이미 호출된 상태라면 뒤늦게 시작된 인식을 즉시 중단
				if (this.currentState === this.states.INACTIVE) {
					this.recognition.abort();
					return;
				}

				this.isActive = true;
				this._setState(this.states.LISTENING);
				this.lastSpeechTime = Date.now();
			};

			this.recognition.onend = () => {
				this.isActive = false;

				if (this.currentState === this.states.LISTENING ||
					this.currentState === this.states.PROCESSING) {
					this._setState(this.states.WAITING);

					// 재시작 전 기존 타이머를 정리하고, 재시작 타이머도 등록해 stop() 시 취소되도록 함
					this._clearAllTimers();
					this.timers.restart = setTimeout(() => {
						if (this.currentState === this.states.WAITING) {
							this._startContinuousRecognition();
						}
					}, 500);
				}
			};

			this.recognition.onresult = (event) => {
				// stop() 이후 도착한 보류 결과는 무시
				if (this.currentState === this.states.INACTIVE) return;

				this._setState(this.states.PROCESSING);
				// 인식 성공 시 재시도 카운터 초기화
				this.retryCount = 0;

				const result = event.results[0][0];
				const transcript = result.transcript.toLowerCase().trim();
				const confidence = result.confidence;

				if (confidence < 0.6) {
					this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.lowConfidence'));
					this._startCooldown();
					return;
				}

				if (transcript.length < 2) {
					this._startCooldown();
					return;
				}

				this._processVoiceCommand(transcript);
			};

			this.recognition.onerror = (event) => {
				console.error('음성 인식 오류:', event.error);
				this.isActive = false;

				// stop() 이후 발생한 오류나 내부에서 호출한 abort()로 인한 오류는 무시
				if (this.currentState === this.states.INACTIVE || event.error === 'aborted') {
					return;
				}

				// 권한/장치 오류는 재시도해도 해결되지 않으므로 재시도 없이 완전 정지
				if (event.error === 'not-allowed' || event.error === 'audio-capture') {
					const fatalMessage = event.error === 'not-allowed'
						? this.plugin.getLocalizedText('command.voice.msg.notAllowed')
						: this.plugin.getLocalizedText('command.voice.msg.audioCapture');
					this.plugin.showNotification(fatalMessage);
					this._deactivate();
					return;
				}

				// 일시적인 오류는 최대 재시도 횟수까지만 재시도
				this.retryCount++;
				if (this.retryCount > this.config.maxRetries) {
					this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.retryExceeded'));
					this._deactivate();
					return;
				}

				let errorMessage = this.plugin.getLocalizedText('command.voice.msg.error');
				switch (event.error) {
					case 'no-speech':
						errorMessage = this.plugin.getLocalizedText('command.voice.msg.noSpeech');
						break;
					case 'network':
						errorMessage = this.plugin.getLocalizedText('command.voice.msg.network');
						break;
				}

				this.plugin.showNotification(errorMessage);
				this._startCooldown();
			};

			this.recognition.onnomatch = () => {
				this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.noMatch'));
				this._startCooldown();
			};

			this.recognition.onspeechstart = () => {
				this.isSpeaking = true;
				this.lastSpeechTime = Date.now();
			};

			this.recognition.onspeechend = () => {
				this.isSpeaking = false;
			};

			this.recognition.onsoundstart = () => {};
			this.recognition.onsoundend = () => {};
		}

		_startRecognition() {
			try {
				if (!this.isActive && this.currentState !== this.states.INACTIVE) {
					this.recognition.start();
				}
			} catch (error) {
				console.error('음성 인식 시작 오류:', error);
				this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.startFailed'));
				this._startCooldown();
			}
		}

		_clearAllTimers() {
			Object.values(this.timers).forEach(timer => {
				if (timer) clearTimeout(timer);
			});
			this.timers = {
				cooldown: null,
				silenceDetection: null,
				commandTimeout: null,
				postCommand: null,
				restart: null
			};
		}

		_processVoiceCommand(transcript) {
			if (!transcript || transcript.trim() === '') {
				this._startCooldown();
				return;
			}

			const now = Date.now();
			if (now - this.lastCommandTime < this.config.cooldownTime) {
				this._startCooldown();
				return;
			}

			const commandInfo = this._analyzeCommand(transcript);

			if (commandInfo.command && commandInfo.target) {
				this._setState(this.states.EXECUTING);
				this._updateExecutingStatus(`${commandInfo.command} ${commandInfo.target}`);

				const elements = this._findTargetElements(commandInfo.target);
				if (elements.length > 0) {
					this._executeCommand(commandInfo.command, elements[0]);
					this.lastCommandTime = now;

					this.commandHistory.unshift({
						command: commandInfo.command,
						target: commandInfo.target,
						timestamp: now,
						success: true
					});

					if (this.commandHistory.length > 10) {
						this.commandHistory.pop();
					}

					// 타이머로 등록해 stop() 시 _clearAllTimers()로 취소되도록 함 (좀비 재시작 방지)
					this.timers.postCommand = setTimeout(() => {
						this._startCooldown();
					}, 1000);
				} else {
					this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.targetNotFound', { target: commandInfo.target }));
					this._startCooldown();
				}
			} else {
				this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.notUnderstood'));
				this._startCooldown();
			}
		}

		_analyzeCommand(transcript) {
			const allCommands = [
				...this.commands.navigation,
				...this.commands.action,
				...this.commands.settings
			];

			// 최장 일치 우선: 긴 명령어부터 검사해 부분 문자열 오매칭을 완화
			allCommands.sort((a, b) => b.length - a.length);

			const command = allCommands.find(cmd => transcript.includes(cmd));
			if (command) {
				const target = transcript.replace(command, '').trim();
				return { command, target };
			}

			return { command: null, target: null };
		}

		_findTargetElements(searchText) {
			const lowerCaseSearchText = searchText.toLowerCase();
			const lowerCaseSearchTextNoSpaces = lowerCaseSearchText.replace(/\s+/g, '');

			const selectors = [
				'a', 'button', '[role="button"]',
				'input[type="radio"]', 'input[type="checkbox"]',
				'input[type="submit"]', 'input[type="button"]'
			];

			const elements = document.querySelectorAll(selectors.join(', '));
			const matchingElements = [];

			elements.forEach(element => {
				const texts = this._collectElementTexts(element);
				if (this._isTextMatching(texts, lowerCaseSearchText, lowerCaseSearchTextNoSpaces)) {
					matchingElements.push(element);
				}
			});

			return matchingElements;
		}

		_collectElementTexts(element) {
			const texts = [];
			if (element.textContent) texts.push(element.textContent.trim());
			// input[type=submit|button] 등은 value가 표시 텍스트이므로 함께 수집
			if (element.tagName.toLowerCase() === 'input' && element.value) {
				texts.push(element.value.trim());
			}
			const img = element.querySelector('img');
			if (img && img.alt) texts.push(img.alt);
			if (element.title) texts.push(element.title);
			if (element.getAttribute('aria-label')) texts.push(element.getAttribute('aria-label'));
			return texts;
		}

		_isTextMatching(texts, searchText, searchTextNoSpaces) {
			return texts.some(text => {
				const lowerText = text.toLowerCase();
				const lowerTextNoSpaces = lowerText.replace(/\s+/g, '');
				return lowerText.includes(searchText) ||
					lowerTextNoSpaces.includes(searchTextNoSpaces);
			});
		}

		_executeCommand(command, element) {
			try {
				if (this.commands.navigation.includes(command) ||
					this.commands.action.includes(command)) {

					if (element.tagName.toLowerCase() === 'a' ||
						element.tagName.toLowerCase() === 'button' ||
						element.getAttribute('role') === 'button') {
						element.click();
						this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.clicked', { target: element.textContent?.trim() || this.plugin.getLocalizedText('command.voice.label.element') }));
					} else if (element.tagName.toLowerCase() === 'input' &&
						(element.type === 'submit' || element.type === 'button')) {
						element.click();
						this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.clicked', { target: element.value || this.plugin.getLocalizedText('command.voice.label.button') }));
					} else if (element.tagName.toLowerCase() === 'input' &&
						(element.type === 'radio' || element.type === 'checkbox')) {
						element.checked = !element.checked;
						element.dispatchEvent(new Event('change', { bubbles: true }));
						this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.toggled', { target: element.getAttribute('name') || this.plugin.getLocalizedText('command.voice.label.input') }));
					}
				}

				element.scrollIntoView({ behavior: 'smooth', block: 'center' });
			} catch (error) {
				console.error('명령 실행 오류:', error);
				this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.executeFailed'));
			}
		}
	}

	/**
	 * @fileoverview STTManager - 음성 인식 기능 통합 관리자
	 * @module src/stt/STTManager
	 */

	/**
	 * STT Manager - Speech Recognition Integration Manager
	 * @class STTManager
	 */
	class STTManager {
		constructor(plugin) {
			this.plugin = plugin;

			this.states = {
				VOICE_COMMAND: 'voiceCommand',
				CONTINUOUS: 'continuous',
				INACTIVE: 'inactive'
			};

			this.currentState = this.states.INACTIVE;

			this.voiceCommand = null;

			this.config = {
				language: plugin.options?.sttLanguage || plugin.language || 'ko-KR',
				interimResults: plugin.options?.sttInterimResults || false,
				continuous: plugin.options?.sttContinuous || false,
				maxAlternatives: plugin.options?.sttMaxAlternatives || 1
			};

			this._initializeModules();
		}

		_initializeModules() {
			this.voiceCommand = new VoiceCommand(this);
		}

		setLanguage(language) {
			if (typeof language === 'string' && language.length > 0) {
				this.config.language = language;
			}
		}

		getLanguage() {
			return this.config.language;
		}

		toggleVoiceCommand() {
			const previousState = this.currentState;

			if (this.currentState === this.states.VOICE_COMMAND) {
				this.voiceCommand.stop();
				this._setState(this.states.INACTIVE);
			} else {
				this._stopOtherSTT(this.states.VOICE_COMMAND);
				// 시작 실패(미지원 브라우저 등) 시 상태 전이/UI 갱신/이벤트 디스패치를 건너뜀
				if (!this.voiceCommand.start()) {
					return;
				}
				this._setState(this.states.VOICE_COMMAND);
			}

			this._updateUI();

			if (this.plugin && this.plugin._dispatchStateEvent) {
				this.plugin._dispatchStateEvent('stt:stateChanged', {
					isActive: this.currentState === this.states.VOICE_COMMAND,
					state: this.currentState,
					previousState: previousState,
					mode: 'voice_command'
				});
			}
		}

		_setState(newState) {
			this.currentState = newState;
		}

		_stopOtherSTT(exceptState) {
			if (exceptState !== this.states.VOICE_COMMAND && this.voiceCommand) {
				this.voiceCommand.stop();
			}
		}

		_stopAllSTT() {
			if (this.voiceCommand) this.voiceCommand.stop();

			// 정지 후 매니저 상태/UI/이벤트를 동기화
			this.handleVoiceCommandStopped();
		}

		/**
		 * VoiceCommand가 내부 오류(권한 거부, 재시도 초과 등)로 스스로 정지했을 때 호출됩니다.
		 * 매니저 상태를 INACTIVE로 전환하고 UI 갱신 및 상태 변경 이벤트를 디스패치합니다.
		 */
		handleVoiceCommandStopped() {
			if (this.currentState === this.states.INACTIVE) return;

			const previousState = this.currentState;
			this._setState(this.states.INACTIVE);
			this._updateUI();

			if (this.plugin && this.plugin._dispatchStateEvent) {
				this.plugin._dispatchStateEvent('stt:stateChanged', {
					isActive: false,
					state: this.currentState,
					previousState: previousState,
					mode: 'voice_command'
				});
			}
		}

		_updateUI() {
			this._updateVoiceCommandButton();
		}

		_updateVoiceCommandButton() {
			const button = document.getElementById('wat-button-stt_start');
			if (button) {
				if (this.currentState === this.states.VOICE_COMMAND) {
					button.textContent = this.plugin.getLocalizedText('panel.personal.options.stt.options.stop')
						|| '음성 명령 중지';
					button.classList.add('active');
				} else {
					button.textContent = this.plugin.getLocalizedText('panel.personal.options.stt.options.start')
						|| '음성 명령 시작';
					button.classList.remove('active');
				}
			}
		}

		getStatus() {
			return {
				currentState: this.currentState,
				isActive: this.currentState !== this.states.INACTIVE,
				config: { ...this.config }
			};
		}
	}

	/**
	 * @fileoverview WAT - Web Accessibility Tool 메인 클래스
	 * @module src/wat/WAT
	 */

	// 디버그 플래그 — ErrorHandler.debugLog 와 동일한 신호를 사용
	// (window.WAT_DEBUG_MODE 전역 또는 sessionStorage 'WAT_DEBUG'='true' 설정 후 새로고침)
	const WAT_DEBUG_ENABLED = (() => {
		try {
			return (typeof window !== 'undefined' && window.WAT_DEBUG_MODE === true) ||
				(typeof sessionStorage !== 'undefined' && sessionStorage.getItem('WAT_DEBUG') === 'true');
		} catch (e) {
			return false;
		}
	})();

	// 현재 스크립트의 기본 경로를 계산 (브라우저 환경에서만 유효)
	const _currentScriptSrc = (typeof document !== 'undefined' && document.currentScript)
		? document.currentScript.src
		: '';
	const basePath = (() => {
		try {
			if (!_currentScriptSrc) return '';
			const scriptUrl = new URL(_currentScriptSrc);
			return scriptUrl.origin + scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/') + 1);
		} catch (e) {
			return '';
		}
	})();

	// safeParseJSON은 core/safeParseJSON.js로 이동 (SettingsApplier.js와 공용)

	// escapeHTML은 core/escapeHTML.js로 이동 (PanelBuilder.js에서 사용)

	// isSafeHttpUrl은 core/safeUrl.js로 이동 (Dictionary.js와 공용)

	class WAT {
		// Static property assignments - 이미 추출된 모듈들을 WAT의 정적 속성으로 참조
		static Constants = Constants;
		static Defaults = Defaults;
		static Localization = Localization;
		static ErrorHandler = ErrorHandler;
		static ContainerManager = ContainerManager;
		static StyleBatchProcessor = StyleBatchProcessor;
		static OptionsProcessor = OptionsProcessor;
		static ConfigurationManager = ConfigurationManager;
		static FONT_FAMILY_OPTIONS = FONT_FAMILY_OPTIONS;

		/**
		 * 빌드 시 임베드된 로케일 레지스트리 — standalone 번들이 채운다.
		 * 키가 있으면 loadLocale이 fetch 없이 사용 (오프라인/단일 파일 배포 지원)
		 * @type {Object.<string, Object>}
		 */
		static embeddedLocales = {};

		/**
		 * 빌드 시 임베드된 자산(data URI) 레지스트리 — standalone 번들이 채운다.
		 * 키는 'assets/images/...' 상대 경로, 값은 data URI. _assetUrl()이 우선 조회
		 * @type {Object.<string, string>}
		 */
		static embeddedAssets = {};

		/**
		 * Creates a new WAT instance with optional configuration
			 * @constructor
			 * @param {Object} [options={}] - Configuration options for the plugin (플러그인 설정 옵션)
			 * @param {string} [options.containerSelector='body'] - CSS selector for the container element (컨테이너 요소의 CSS 선택자)
			 * @param {string} [options.language='ko'] - Default language for the plugin ('ko' or 'en') (플러그인의 기본 언어)
			 * @param {string} [options.styleCssPath] - Custom path for the style CSS file (스타일 CSS 파일의 커스텀 경로)
			 * @param {Object} [options.config] - Inline configuration object, takes precedence over configPath (인라인 설정 객체 — configPath보다 우선, fetch 없이 동기 확정)
			 * @param {string} [options.configPath] - Path to config.json to fetch (config.json 경로)
			 * @param {boolean} [options.injectCss=true] - Auto-inject stylesheet when no manual link exists (수동 link 부재 시 CSS 자동 주입 여부)
			 * @param {boolean} [options.enableCache=true] - Whether to enable element caching (요소 캐싱 사용 여부)
			 * @param {number} [options.cacheMaxAge=30000] - Maximum age for cached elements in milliseconds (캐시된 요소의 최대 유지 시간, 밀리초)
			 * @param {string} [options.styleMode='dynamic'] - Style application mode ('dynamic' or 'static') (스타일 적용 모드)
			 * @example
			 * // Default initialization
			 * const plugin = new WAT();
			 * 
			 * // Custom initialization
			 * const plugin = new WAT({
			 *   containerSelector: '#main-content',
			 *   language: 'en',
			 *   enableCache: false
			 * });
			 */
			constructor(options = {}) {
				this.options = options;
				const savedPrefs = safeParseJSON(localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS), {});
				this._configManager = new ConfigurationManager(options, savedPrefs, basePath);

				this._config = null;
				this._configLoaded = false;
				this._configPath = options.configPath; // configPath가 제공되지 않으면 undefined로 유지

				this._initializeBasicProperties();
				this._initializeContainer();
				this._initializeStyleSystem();
				this._initializeRatioSystems();
				this._initializeStateManager();
				this._initializeCoreSystem();
				
				// Load configuration file asynchronously - 오류 처리와 함께
				this._loadConfiguration().catch(error => {
					console.warn('⚠️ Configuration loading failed, using defaults:', error.message);
					// 기본 설정으로 fallback
					this._config = this._getFallbackConfig();
					this._configLoaded = true;
					this._validateDictionaryConfiguration();
				});
			}

			/**
			 * Initializes the centralized state management system
			 * @private
			 */
			_initializeStateManager() {
				const savedSettings = safeParseJSON(localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS), {});
				const defaultSettings = Defaults.SETTINGS;
				
				this.state = new StateManager({
					plugin: {
						isDictionEnabled: false,
						isTTSActive: false,
						isSTTActive: false,
						readingSpeed: 1,
						readGuideMode: savedSettings.readGuide || defaultSettings.readGuide,
						currentScreenScale: this.screenScaleRatios[savedSettings.screenScale || defaultSettings.screenScale] || 1,
						currentUtterance: null,
						scrollInterval: null
					},
					tts: {
						elements: [],
						currentIndex: 0,
						focusDetectFlag: false
					},
					ui: {
						isOpen: false,
						isDragging: false,
						currentZoom: 1,
						currentContrast: 'normal'
					},
					settings: {
						fontSize: savedSettings.fontSize || defaultSettings.fontSize,
						fontFamily: savedSettings.fontFamily || defaultSettings.fontFamily,
						screenScale: savedSettings.screenScale || defaultSettings.screenScale,
						txtAlign: savedSettings.txtAlign || defaultSettings.txtAlign,
						letterSpacing: savedSettings.letterSpacing || defaultSettings.letterSpacing,
						lineHeight: savedSettings.lineHeight || defaultSettings.lineHeight,
						colorTheme: savedSettings.colorTheme || defaultSettings.colorTheme,
						saturation: savedSettings.saturation || defaultSettings.saturation,
						readGuide: savedSettings.readGuide || defaultSettings.readGuide,
						imgDisplayMode: savedSettings.imgDisplayMode || defaultSettings.imgDisplayMode,
						viewMode: savedSettings.viewMode || defaultSettings.viewMode,
						toolPosition: savedSettings.toolPosition || defaultSettings.toolPosition
					},
					locale: {}
				});

				this._setupStateObservers();

				this.speechSynthesis = window.speechSynthesis;
			}

			/**
			 * Applies saved settings to the page content on initialization
			 * @private
			 */
			_applySavedSettingsToPage() {
				const settings = this.state.get('settings');
				
				// Temporarily disable save preferences flag (임시로 저장 비활성화 플래그 설정)
				this._skipSavePreferences = true;
				
				// Apply each setting to the page
				Object.entries(settings).forEach(([key, value]) => {
					this._applySettingToPage(key, value);
				});
				
				// For dynamic mode, force reapply all dynamic styles (동적 모드인 경우, 모든 동적 스타일을 강제로 다시 적용)
				if (this.styleMode === 'dynamic') {
					this._forceApplyAllDynamicStyles(settings);
				}
				
				// Clear save flag (저장 플래그 해제)
				this._skipSavePreferences = false;
			}

			/**
			 * Forces application of all dynamic styles (모든 동적 스타일을 강제로 적용합니다)
			 * @param {Object} settings - Settings object containing all style values
			 * @private
			 */
			_forceApplyAllDynamicStyles(settings) {
				// Check if elements are properly marked before applying dynamic styles (동적 스타일 적용 전에 요소들이 제대로 마킹되었는지 확인)
				this._ensureDynamicElementsMarked();
				
				// Force apply each dynamic style (각 동적 스타일을 강제로 적용)
				if (settings.fontSize && settings.fontSize !== 'initial') {
					this.applyDynamicFontSize(settings.fontSize);
				}
				if (settings.screenScale && settings.screenScale !== 'initial') {
					this.applyDynamicScreenScale(settings.screenScale);
				}
				if (settings.txtAlign && settings.txtAlign !== 'initial') {
					this.applyDynamicTextAlign(settings.txtAlign);
				}
				if (settings.letterSpacing && settings.letterSpacing !== 'initial') {
					this.applyDynamicLetterSpacing(settings.letterSpacing);
				}
				if (settings.lineHeight && settings.lineHeight !== 'initial') {
					this.applyDynamicLineHeight(settings.lineHeight);
				}
			}

			/**
			 * Ensures that dynamic elements are properly marked for styling
			 * @private
			 */
			_ensureDynamicElementsMarked() {
				// Mark dynamic elements if not already marked (동적 요소들이 아직 마킹되지 않았다면 마킹)
				if (this.markDynamicStyledElements && typeof this.markDynamicStyledElements === 'function') {
					this.markDynamicStyledElements();
				}
			}

			/**
			 * Initializes basic properties required for the plugin
			 * @private
			 */
			_initializeBasicProperties() {
				const config = this._configManager;
				
				// Language settings
				this.language = config.getLanguage();
				this.supportedLanguages = config.getSupportedLanguages();
				this.languageOptions = config.getLanguageOptions();
				this.languageConfig = config.getLanguageConfig();
			}

			/**
			 * Sets up state observers for automatic UI synchronization
			 * @private
			 */
			_setupStateObservers() {
				// Observe TTS state changes
				this.state.subscribe('plugin.isTTSActive', (newValue, oldValue) => {
					this._updateTTSButtonStates(newValue);
				});

				// Observe reading guide mode changes
				this.state.subscribe('plugin.readGuideMode', (newValue, oldValue) => {
					this._updateReadingGuideUI(newValue, oldValue);
				});

				// Observe TTS current index changes
				this.state.subscribe('tts.currentIndex', (newValue, oldValue) => {
					this._updateTTSNavigation(newValue);
				});

				// Observe dictionary state changes
				this.state.subscribe('plugin.isDictionEnabled', (newValue, oldValue) => {
					this._updateDictionaryUI(newValue);
				});

				// Observe focus detection changes
				this.state.subscribe('tts.focusDetectFlag', (newValue, oldValue) => {
					this._updateFocusDetectionUI(newValue);
				});
			}

			/**
			 * Updates TTS button states based on active state
			 * @param {boolean} isActive - Whether TTS is active
			 * @private
			 */
			_updateTTSButtonStates(isActive) {
				const toggleButton = document.getElementById('wat-button-tts_toggle');
				if (toggleButton) {
					toggleButton.setAttribute('aria-pressed', isActive.toString());
					toggleButton.classList.toggle('active', isActive);
				}
			}

			/**
			 * Updates reading guide UI based on mode changes
			 * @param {string} newMode - New reading guide mode
			 * @param {string} oldMode - Previous reading guide mode
			 * @private
			 */
			_updateReadingGuideUI(newMode, oldMode) {
				// Remove old mode UI elements if needed
				if (oldMode && oldMode !== 'unset') {
					this.removeReadingGuide();
				}

				// Update UI to reflect new mode
				const modeButtons = document.querySelectorAll('[data-read-guide-mode]');
				modeButtons.forEach(button => {
					const buttonMode = button.getAttribute('data-read-guide-mode');
					button.classList.toggle('active', buttonMode === newMode);
					button.setAttribute('aria-pressed', (buttonMode === newMode).toString());
				});
			}

			/**
			 * Updates TTS navigation UI based on current index
			 * @param {number} currentIndex - Current TTS element index
			 * @private
			 */
			_updateTTSNavigation(currentIndex) {
				const ttsElements = this.state.get('tts.elements');
				const prevButton = document.getElementById('wat-button-tts_prev');
				const nextButton = document.getElementById('wat-button-tts_next');

				if (prevButton) {
					prevButton.disabled = currentIndex <= 0;
				}
				if (nextButton) {
					nextButton.disabled = currentIndex >= ttsElements.length - 1;
				}
			}

			/**
			 * Updates dictionary UI based on enabled state
			 * @param {boolean} isEnabled - Whether dictionary is enabled
			 * @private
			 */
			_updateDictionaryUI(isEnabled) {
				const dictionButton = document.getElementById('wat-button-dictionary');
				if (dictionButton) {
					// 사전 기능이 설정에서 완전히 비활성화된 경우 버튼 숨김
					if (this._configManager && !this._configManager.getConfigValue('api.dictionary.enabled', false)) {
						dictionButton.style.display = 'none';
						dictionButton.setAttribute('aria-hidden', 'true');
						return;
					}
					
					// 사전 기능이 활성화되어 있다면 버튼 표시
					dictionButton.style.display = '';
					dictionButton.removeAttribute('aria-hidden');
					dictionButton.classList.toggle('active', isEnabled);
					dictionButton.setAttribute('aria-pressed', isEnabled.toString());
				}
			}

			/**
			 * Updates focus detection UI based on enabled state
			 * @param {boolean} isEnabled - Whether focus detection is enabled
			 * @private
			 */
			_updateFocusDetectionUI(isEnabled) {
				const focusButton = document.getElementById('wat-button-tts_focus_toggle');
				if (focusButton) {
					focusButton.classList.toggle('active', isEnabled);
					focusButton.setAttribute('aria-pressed', isEnabled.toString());
				}
			}

			/**
			 * Initializes container and selector systems
			 * @private
			 */
			_initializeContainer() {
				const containerConfig = this._configManager.getContainerConfig();
				
				// Create or find container
				this.container = ContainerManager.createOrFindContainer(containerConfig);
				// 컨테이너 생성 실패 또는 body 폴백 시 초기화 중단 — 이후 innerHTML 초기화가 호스트 페이지를 파괴하는 것을 방지
				if (!this.container || this.container === document.body || this.container === document.documentElement) {
					throw new Error('[WAT] 컨테이너를 생성하지 못했습니다. containerTargetSelector 설정을 확인하세요.');
				}
				this.selector = `#${this.container.id}`;
				this.containerID = containerConfig.id;
				this.containerTargetSelector = containerConfig.targetSelector;
				this.containerTargetPosition = containerConfig.position;
				
				// Apply selector classes
				const selectorConfig = this._configManager.getSelectorConfig();
				this.applySelector = selectorConfig.apply;
				this.excludeSelector = selectorConfig.exclude;
				
				ContainerManager.applySelectorClasses(
					selectorConfig.apply,
					selectorConfig.exclude,
					Constants.CSS_CLASSES
				);
			}

			/**
			 * Initializes style system and CSS loading
			 * @private
			 */
			_initializeStyleSystem() {
				const styleConfig = this._configManager.getStyleConfig();
				
				this.styleMode = styleConfig.mode;
				this.styleCssPath = styleConfig.cssPath;
				
				if (styleConfig.mode === 'manual') {
					this.loadStyleCss(styleConfig.cssPath);
				}
			}

			/**
			 * Initializes all ratio-based systems (fontSize, lineHeight, etc.)
			 * @private
			 */
			_initializeRatioSystems() {
				const ratioConfigs = this._configManager.getRatioConfigs();
				
				this.fontSizeRatios = ratioConfigs.fontSize;
				this.lineHeightRatios = ratioConfigs.lineHeight;
				this.letterSpacingRatios = ratioConfigs.letterSpacing;
				this.screenScaleRatios = ratioConfigs.screenScale;
			}

			/**
			 * Initializes cache system for performance optimization
			 * @private
			 */
			_initializeCacheSystem() {
				// Map to store cached elements
				this._cachedElements = new Map();
				this._cacheValid = false;
				this._cacheTimestamps = new Map();
				this._cacheMaxAge = Constants.PERFORMANCE.CACHE_MAX_AGE; // Cache expires after 5 seconds

				// Performance metrics
				this._performanceMetrics = {
					domQueries: 0,
					cacheHits: 0,
					cacheMisses: 0,
					lastCacheCheck: Date.now()
				};
			}

			/**
			 * Initializes event management system
			 * @private
			 */
			_initializeEventSystem() {
				// Initialize event management system
				this._eventListeners = new Map(); // Track event listeners by element
				this._globalEventHandlers = new Map(); // Track global event handlers
				this._boundHandlers = new Map(); // Cache bound handlers
				this._observers = new Map(); // Track observer objects

				// Initialize timer and animation frame tracking
				this._timers = new Set(); // Track setTimeout IDs
				this._intervals = new Set(); // Track setInterval IDs
				this._animationFrames = new Set(); // Track requestAnimationFrame IDs

				// Create and cache bound handlers
				this._createBoundHandlers();
			}

			/**
			 * Initializes core systems (event, cache, style processor)
			 * @private
			 */
			_initializeCoreSystem() {
				this._initializeCacheSystem();
				this._initializeEventSystem();
				
				// Create StyleBatchProcessor instance
				this.styleBatchProcessor = new StyleBatchProcessor(this);
				
				// Initialize Text Extractor (TTS 낭독 텍스트 생성 — TTS 클래스들이 사용)
				this.textExtractor = new TextExtractor(this);

				// Initialize TTS Manager
				this.ttsManager = new TTSManager(this);

				// Initialize STT Manager
				this.sttManager = new STTManager(this);

				// Initialize Iframe Styler (iframe 접근성 스타일 적용/동기화 담당)
				this.iframeStyler = new IframeStyler(this);

				// Initialize Dictionary (사전 검색 담당)
				this.dictionary = new Dictionary(this);

				// Initialize Page Structure (페이지 구조 분석 다이얼로그 담당)
				this.pageStructure = new PageStructure(this);

				// Initialize Panel Builder (설정 패널 UI 항목 생성 담당)
				this.panelBuilder = new PanelBuilder(this);

				// Initialize Settings Applier (설정 저장/복원/프로필 적용 담당)
				this.settingsApplier = new SettingsApplier(this);

				// Initialize Overlay Manager (모달 오버레이 포커스 트랩·Escape·정리 공통 담당)
				this.overlayManager = new OverlayManager(this);
			}

			/**
			 * Initializes the plugin with all necessary components (필요한 모든 구성 요소로 플러그인을 초기화합니다)
			 * @async
			 * @returns {Promise<void>} Promise that resolves when initialization is complete (초기화 완료 시 resolve되는 Promise)
			 * @throws {Error} Throws an error if initialization fails (초기화 실패 시 에러를 발생시킴)
			 * @example
			 * // Initialize the plugin
			 * const plugin = new WAT();
			 * try {
			 *   await plugin.init();
			 *   console.log('Plugin initialized successfully');
			 * } catch (error) {
			 *   console.error('Failed to initialize plugin:', error);
			 * }
			 */
			async init() {
				try {
					// CSS 자동 주입 — 호스트가 <link>를 직접 추가하지 않았으면 스크립트 위치 기준으로 로드 ("1줄 설치" 지원)
					this._ensureStylesheet();

					// 설정 로딩이 완료될 때까지 대기
					await this._waitForConfigurationLoad();
					
					await this.loadLocale(this.language);
					this.generateHTMLElements();
					
					// Apply saved settings to the page and UI after HTML elements are created
					this._applySavedSettingsToPage();
					
					this.setInitialPreferences();
					this.setupTabs();
					this.activateInitialTab();
					this.setEventListeners();
					this.extractFocusableElements(document.body);
					this.markDynamicStyledElements('body');

					// Set plugin UI font size protection
					this.setupFontSizeProtection();

					// Configure iframe processing
					this.setupIframeHandling();

					// Set cache invalidation detection
					this._setupCacheInvalidationObserver();

					// Setup memory monitoring in development
					if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
						this._setupMemoryMonitoring();
					}

					// Auto cleanup on page unload
					this._addGlobalEventListener('beforeunload', 'cleanup');
					
					// Cleanup on page hide (mobile support)
					this._addGlobalEventListener('pagehide', 'cleanup');

					// Log initial memory state
					this._logMemoryUsage('initialization complete');
					
					// Dispatch initialization complete event
					this._dispatchInitializedEvent();
					
				} catch (e) {
					ErrorHandler.handle(e, {
						category: ErrorHandler.CATEGORIES.INITIALIZATION,
						severity: ErrorHandler.SEVERITY.CRITICAL,
						method: 'init',
						component: 'WAT',
						data: { options: this.options },
						strategy: ErrorHandler.RECOVERY_STRATEGIES.ABORT
					});
					throw e; // Re-throw critical initialization errors
				}
			}

			/**
			 * Dispatches initialization complete event (초기화 완료 이벤트를 발생시킵니다)
			 * @returns {void}
			 * @private
			 * @example
			 * // Automatically called after successful initialization
			 * this._dispatchInitializedEvent();
			 */
			_dispatchInitializedEvent() {
				try {
					// Create custom event with detailed plugin information
					const initEvent = new CustomEvent('wat:initialized', {
						detail: {
							plugin: this,
							timestamp: Date.now(),
							// 번들러 치환이 없는 환경(테스트 등)에서 ReferenceError로 초기화 이벤트가 사라지지 않도록 가드
						version: (typeof "2.1.0" !== 'undefined') ? "2.1.0" : 'dev',
							language: this.language,
							features: {
								tts: !!this.ttsManager,
								stt: !!this.sttManager,
								dictionary: this.getConfigValue('api.dictionary.enabled', false),
								focusDetection: this.state.get('tts.focusDetectFlag', false)
							},
							state: {
								isInitialized: true,
								containerId: this.containerID, // containerSelector는 미할당 프로퍼티였음 (항상 undefined)
								options: { ...this.options }
							}
						},
						bubbles: true,
						cancelable: false
					});
					
					// Dispatch the event
					document.dispatchEvent(initEvent);
					
					// Update state to mark as initialized
					this.state.set('plugin.isInitialized', true);
					
					// Log successful initialization
					if (WAT_DEBUG_ENABLED) {
						console.log('WAT plugin initialized successfully');
					}
					
				} catch (error) {
					console.error('Failed to dispatch wat:initialized event:', error);
				}
			}

			/**
			 * Dispatches plugin state change events (플러그인 상태 변경 이벤트를 발생시킵니다)
			 * @param {string} eventType - Type of event to dispatch (발생시킬 이벤트 타입)
			 * @param {Object} detail - Event detail data (이벤트 상세 데이터)
			 * @returns {void}
			 * @private
			 * @example
			 * // Dispatch TTS state change event
			 * this._dispatchStateEvent('tts:stateChanged', { isActive: true });
			 * 
			 * // Dispatch settings save event
			 * this._dispatchStateEvent('settings:saved', { settings: {...} });
			 */
			_dispatchStateEvent(eventType, detail) {
				try {
					const stateEvent = new CustomEvent(`wat:${eventType}`, {
						detail: {
							...detail,
							timestamp: Date.now(),
							plugin: this
						},
						bubbles: true,
						cancelable: false
					});
					
					document.dispatchEvent(stateEvent);
					
					// Log event dispatch in debug mode
					if (WAT_DEBUG_ENABLED) {
						console.log(`WAT event dispatched: wat:${eventType}`, detail);
					}
					
				} catch (error) {
					console.error(`Failed to dispatch wat:${eventType} event:`, error);
				}
			}

			/**
			 * Cleans up all plugin resources and event listeners (모든 플러그인 리소스와 이벤트 리스너를 정리합니다)
			 * @returns {void}
			 * @example
			 * // Cleanup when plugin is no longer needed
			 * plugin.cleanup();
			 */
			cleanup() {
				ErrorHandler.safeExecute(() => {
					// 정리 이후 지연 콜백(iframe load 등)이 파괴된 인스턴스를 조작하지 않도록 플래그 설정
					this._destroyed = true;

					// Log memory stats before cleanup
					this._logMemoryUsage('before cleanup');

					// Clean up StyleBatchProcessor
					if (this.styleBatchProcessor) {
						this.styleBatchProcessor.cancelPendingUpdates();
					}

					// Disconnect iframe MutationObserver
					this._disconnectObserver('iframe');
					
					// Remove injected CSS from iframes
				this.removeInjectedCSS();

				// Clean up memory tracking
				if (this._memoryCheckInterval) {
					this._clearInterval(this._memoryCheckInterval);
					this._memoryCheckInterval = null;
				}

				// 1. Clean up all tracked timers and animation frames
				this._cleanupTimersAndFrames();
				
				// 2. Remove global event listeners (등록 대상(window/document)과 동일한 곳에서 제거)
				this._globalEventHandlers.forEach((listenerInfo, eventType) => {
					(listenerInfo.target || document).removeEventListener(eventType, listenerInfo.handler, listenerInfo.options);
				});
				this._globalEventHandlers.clear();
				
				// 3. Remove individual element event listeners
				this._eventListeners.forEach((listeners, element) => {
					listeners.forEach(({ eventType, handler, options }) => {
						this._safeExecute(() => {
							element.removeEventListener(eventType, handler, options);
						}, [], `removing ${eventType} event listener`);
					});
				});
				this._eventListeners.clear();
				
				// 4. Disconnect observers
				this._disconnectAllObservers();
				
				// Disconnect font size protection observers
				if (this._fontSizeObservers) {
					this._fontSizeObservers.forEach(observer => {
						this._safeExecute(() => {
							observer.disconnect();
						}, [], 'disconnecting font size protection observer');
					});
					this._fontSizeObservers = [];
				}
				
				// 5. Clean up legacy timers/animations (for backward compatibility)
				const scrollInterval = this.state.get('plugin.scrollInterval') || this.scrollInterval;
				if (scrollInterval) {
					cancelAnimationFrame(scrollInterval);
					this.state.set('plugin.scrollInterval', null);
					this.scrollInterval = null;
				}

				// 6. Clean up TTS (매니저의 리스너·타이머·발화 일괄 정리)
				if (this.ttsManager && typeof this.ttsManager.destroy === 'function') {
					this.ttsManager.destroy();
				}
				if (this.speechSynthesis) {
					this.speechSynthesis.cancel();
					this.state.set('plugin.currentUtterance', null);
				}
				
				// 7. Clean up WeakMap and cache
				this._originalStyleMap = new WeakMap();
				this._invalidateCache();
				
				// 8. Clean up bound handlers
				this._boundHandlers.clear();
				
				// 9. Clean up DOM elements
				this._cleanupDOMElements();

					// Final memory check — 정리 완료 상태를 다시 오염시키지 않도록 추적 타이머를 쓰지 않고 즉시 기록
					this._logMemoryUsage('after cleanup');
				}, {
					category: ErrorHandler.CATEGORIES.MEMORY_MANAGEMENT,
					severity: ErrorHandler.SEVERITY.WARNING,
					method: 'cleanup',
					component: 'WAT',
					strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
				});
			}

			/**
			 * Cleans up all tracked timers and animation frames (추적된 모든 타이머와 애니메이션 프레임을 정리)
			 * @returns {void}
			 * @description Called during plugin cleanup to prevent memory leaks from timers
			 * @private
			 */
			_cleanupTimersAndFrames() {
				// Clear all tracked timeouts
				this._timers.forEach(timerId => {
					this._safeExecute(() => {
						clearTimeout(timerId);
					}, [], 'clearing timeout');
				});
				this._timers.clear();

				// Clear all tracked intervals
				this._intervals.forEach(intervalId => {
					this._safeExecute(() => {
						clearInterval(intervalId);
					}, [], 'clearing interval');
				});
				this._intervals.clear();

				// Cancel all tracked animation frames
				this._animationFrames.forEach(frameId => {
					this._safeExecute(() => {
						cancelAnimationFrame(frameId);
					}, [], 'canceling animation frame');
				});
				this._animationFrames.clear();
			}

			/**
			 * Gets detailed memory usage statistics (자세한 메모리 사용량 통계를 가져옵니다)
			 * @returns {Object} Memory usage statistics (메모리 사용량 통계)
			 * @description Returns detailed information about tracked resources and memory usage
			 * @private
			 */
			_getMemoryUsageStats() {
				const stats = {
					eventListeners: {
						global: this._globalEventHandlers.size,
						elements: this._eventListeners.size,
						total: this._globalEventHandlers.size + this._eventListeners.size
					},
					observers: {
						count: this._observers.size,
						types: Array.from(this._observers.keys())
					},
					timers: {
						timeouts: this._timers.size,
						intervals: this._intervals.size,
						animationFrames: this._animationFrames.size,
						total: this._timers.size + this._intervals.size + this._animationFrames.size
					},
					cache: {
						entries: this._cache ? this._cache.size : (this._cachedElements ? this._cachedElements.size : 0),
						sizeBytes: this._estimateCacheSize()
					},
					boundHandlers: this._boundHandlers.size,
					timestamp: Date.now()
				};

				// Add performance memory if available
				if (performance.memory) {
					stats.browserMemory = {
						usedJSHeapSize: performance.memory.usedJSHeapSize,
						totalJSHeapSize: performance.memory.totalJSHeapSize,
						jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
					};
				}

				return stats;
			}

			/**
			 * Estimates cache size in bytes (캐시 크기를 바이트 단위로 추정합니다)
			 * @returns {number} Estimated cache size in bytes (바이트 단위 추정 캐시 크기)
			 * @private
			 */
			_estimateCacheSize() {
				let totalSize = 0;
				const cache = this._cache || this._cachedElements;
				if (cache && typeof cache.forEach === 'function') {
					cache.forEach((entry, key) => {
						// Rough estimation of memory usage
						if (typeof key === 'string') {
							totalSize += key.length * 2; // String key (2 bytes per character)
						}
						try {
							totalSize += JSON.stringify(entry).length * 2; // Entry data estimation
						} catch (e) {
							// fallback if entry cannot be stringified
							totalSize += 100;
						}
					});
				}
				return totalSize;
			}

			/**
			 * Logs memory usage statistics (메모리 사용량 통계를 로깅합니다)
			 * @param {string} [context=''] - Context for the memory check (메모리 체크 컨텍스트)
			 * @returns {void}
			 * @description Outputs detailed memory usage information to console
			 * @private
			 */
			_logMemoryUsage(context = '') {
				const stats = this._getMemoryUsageStats();
				const contextStr = context ? ` [${context}]` : '';
				
				// Memory usage logging (development mode)
				if (WAT_DEBUG_ENABLED) {
					console.group(`[WAT] Memory Usage${contextStr}`);
					console.log('Event Listeners:', stats.eventListeners);
					console.log('Observers:', stats.observers);
					console.log('Timers:', stats.timers);
					console.log('Cache:', stats.cache);
					console.log('Bound Handlers:', stats.boundHandlers);
					
					if (stats.browserMemory) {
						console.log('Browser Memory:', {
							used: `${(stats.browserMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
							total: `${(stats.browserMemory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
							limit: `${(stats.browserMemory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
						});
					}
					console.groupEnd();
				}

				return stats;
			}

			/**
			 * Gets cached elements by class name with optional cache control
			 * @param {string} className - CSS class name to search for
			 * @param {boolean} [useCache=true] - Whether to use cached results
			 * @param {number} [maxAge=this._cacheMaxAge] - Maximum age for cache validity in milliseconds
			 * @returns {NodeList} List of elements with the specified class
			 * @example
			 * // Get cached elements
			 * const buttons = this._getCachedElements('wat-button');
			 * 
			 * // Force fresh query without cache
			 * const freshButtons = this._getCachedElements('wat-button', false);
			 */
			_getCachedElements(className, useCache = true, maxAge = this._cacheMaxAge) {
				//this._performanceMetrics.domQueries++;

				// Don't use cache
				if (!useCache) {
					this._performanceMetrics.cacheMisses++;
					const elements = document.querySelectorAll(`.${className}`);
					this._updateCache(className, elements);
					return elements;
				}

				// Cache validity check
				if (this._isCacheValid(className, maxAge)) {
					this._performanceMetrics.cacheHits++;
					return this._cachedElements.get(className);
				}

				// Cache miss - new query
				this._performanceMetrics.cacheMisses++;
				const elements = document.querySelectorAll(`.${className}`);
				this._updateCache(className, elements);
				
				return elements;
			}

			/**
			 * Checks if cached data is still valid based on timestamp (타임스탬프를 기반으로 캐시된 데이터가 여전히 유효한지 확인)
			 * @param {string} key - Cache key to check (확인할 캐시 키)
			 * @param {number} maxAge - Maximum age in milliseconds (최대 유지 시간, 밀리초)
			 * @returns {boolean} True if cache is valid, false otherwise (캐시가 유효하면 true, 그렇지 않으면 false)
			 * @private
			 */
			_isCacheValid(key, maxAge) {
				if (!this._cacheValid || !this._cachedElements.has(key)) {
					return false;
				}

				const timestamp = this._cacheTimestamps.get(key);
				if (!timestamp) {
					return false;
				}

				const age = Date.now() - timestamp;
				return age < maxAge;
			}

			/**
			 * Updates cache with new elements and timestamp (새로운 요소와 타임스탬프로 캐시를 업데이트)
			 * @param {string} key - Cache key (캐시 키)
			 * @param {NodeList|Array} elements - Elements to cache (캐시할 요소들)
			 * @returns {void}
			 * @private
			 */
			_updateCache(key, elements) {
				this._cachedElements.set(key, elements);
				this._cacheTimestamps.set(key, Date.now());
				this._cacheValid = true;
			}

			/**
			 * Invalidates specific cache entries by keys (키로 특정 캐시 항목들을 무효화)
			 * @param {string[]} keys - Array of cache keys to invalidate (무효화할 캐시 키 배열)
			 * @returns {void}
			 * @example
			 * // Invalidate specific caches
			 * this._invalidateSpecificCache(['wat-button', 'wat-input']);
			 */
			_invalidateSpecificCache(keys) {
				if (Array.isArray(keys)) {
					keys.forEach(key => {
						this._cachedElements.delete(key);
						this._cacheTimestamps.delete(key);
					});
				} else {
					this._cachedElements.delete(keys);
					this._cacheTimestamps.delete(keys);
				}
			}

			/**
			 * Invalidates all cached elements with optional reason logging (선택적 이유 로깅과 함께 모든 캐시된 요소를 무효화)
			 * @param {string} [reason='unknown'] - Reason for cache invalidation (캐시 무효화 이유)
			 * @returns {void}
			 * @example
			 * // Clear all cache
			 * this._invalidateCache('DOM structure changed');
			 */
			_invalidateCache(reason = 'unknown') {
				this._cacheValid = false;
				this._cachedElements.clear();
				this._cacheTimestamps.clear();
				
				// Update performance metrics
				this._performanceMetrics.lastCacheCheck = Date.now();
			}

			/**
			 * Gets multiple cached element collections in batch for better performance (더 나은 성능을 위해 여러 캐시된 요소 컬렉션을 일괄 가져오기)
			 * @param {string[]} classNames - Array of class names to retrieve (가져올 클래스명 배열)
			 * @param {boolean} [useCache=true] - Whether to use cached results (캐시된 결과 사용 여부)
			 * @returns {Object} Object with class names as keys and NodeLists as values (클래스명을 키로, NodeList를 값으로 하는 객체)
			 * @example
			 * // Get multiple element types at once
			 * const elements = this._getCachedElementsBatch(['wat-button', 'wat-input', 'wat-select']);
			 * console.log(elements['wat-button']); // NodeList of buttons
			 */
			_getCachedElementsBatch(classNames, useCache = true) {
				const results = new Map();
				const uncachedQueries = [];
				
				// Separate cached and uncached items (캐시된 항목과 미캐시 항목 분리)
				classNames.forEach(className => {
					if (useCache && this._isCacheValid(className, this._cacheMaxAge)) {
						results.set(className, this._cachedElements.get(className));
						this._performanceMetrics.cacheHits++;
					} else {
						uncachedQueries.push(className);
					}
				});
				
				// Query uncached items at once (미캐시 항목들을 한 번에 조회)
				if (uncachedQueries.length > 0) {
					const combinedSelector = uncachedQueries.map(name => `.${name}`).join(', ');
					const allElements = document.querySelectorAll(combinedSelector);
					
					// Separate results by class (결과를 클래스별로 분리)
					uncachedQueries.forEach(className => {
						const filteredElements = Array.from(allElements).filter(el => 
							el.classList.contains(className)
						);
						results.set(className, filteredElements);
						this._updateCache(className, filteredElements);
						this._performanceMetrics.cacheMisses++;
					});
					
					this._performanceMetrics.domQueries++;
				}
				
				return results;
			}

			/**
			 * Gets cached elements by CSS selector with custom cache key (커스텀 캐시 키로 CSS 선택자에 의한 캐시된 요소 가져오기)
			 * @param {string} selector - CSS selector string (CSS 선택자 문자열)
			 * @param {string|null} [cacheKey=null] - Custom cache key, uses selector if null (커스텀 캐시 키, null이면 선택자 사용)
			 * @param {boolean} [useCache=true] - Whether to use cached results (캐시된 결과 사용 여부)
			 * @returns {NodeList} List of elements matching the selector (선택자와 일치하는 요소들의 목록)
			 * @example
			 * // Get elements by selector (선택자로 요소 가져오기)
			 * const inputs = this._getCachedElementsBySelector('input[type="text"]');
			 * 
			 * // Use custom cache key (커스텀 캐시 키 사용)
			 * const buttons = this._getCachedElementsBySelector('.btn', 'custom-buttons');
			 */
			_getCachedElementsBySelector(selector, cacheKey = null, useCache = true) {
				// 선택자 원문을 키로 사용 — 특수문자 치환 시 서로 다른 선택자('.a .b' vs '.a>.b')가 같은 키로 충돌함
				const key = cacheKey || selector;
				
				this._performanceMetrics.domQueries++;
				
				if (useCache && this._isCacheValid(key, this._cacheMaxAge)) {
					this._performanceMetrics.cacheHits++;
					return this._cachedElements.get(key);
				}
				
				this._performanceMetrics.cacheMisses++;
				const elements = document.querySelectorAll(selector);
				this._updateCache(key, elements);
				
				return elements;
			}

			/**
			 * Gets a single cached element by CSS selector (CSS 선택자로 단일 캐시된 요소 가져오기)
			 * @param {string} selector - CSS selector string (CSS 선택자 문자열)
			 * @param {string|null} [cacheKey=null] - Custom cache key, uses selector if null (커스텀 캐시 키, null이면 선택자 사용)
			 * @param {boolean} [useCache=true] - Whether to use cached results (캐시된 결과 사용 여부)
			 * @returns {Element|null} First element matching the selector or null (선택자와 일치하는 첫 번째 요소 또는 null)
			 * @example
			 * // Get single element (단일 요소 가져오기)
			 * const container = this._getCachedElement('#main-container');
			 */
			_getCachedElement(selector, cacheKey = null, useCache = true) {
				const elements = this._getCachedElementsBySelector(selector, cacheKey, useCache);
				return elements.length > 0 ? elements[0] : null;
			}

			/**
			 * Sets up mutation observer to automatically invalidate cache when DOM changes (DOM 변경 시 자동으로 캐시를 무효화하는 뮤테이션 옵저버 설정)
			 * @returns {void}
			 * @private
			 */
			_setupCacheInvalidationObserver() {
				const observer = new MutationObserver((mutations) => {
					let shouldInvalidate = false;
					const affectedClasses = new Set();
					
					mutations.forEach((mutation) => {
						if (mutation.type === 'childList') {
							// When nodes are added/removed (노드가 추가/제거된 경우)
							mutation.addedNodes.forEach(node => {
								if (node.nodeType === Node.ELEMENT_NODE) {
									this._extractClassesFromElement(node, affectedClasses);
									shouldInvalidate = true;
								}
							});
							
							mutation.removedNodes.forEach(node => {
								if (node.nodeType === Node.ELEMENT_NODE) {
									this._extractClassesFromElement(node, affectedClasses);
									shouldInvalidate = true;
								}
							});
						} else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
							// When class attributes are changed (클래스 속성이 변경된 경우)
							if (mutation.target.nodeType === Node.ELEMENT_NODE) {
								this._extractClassesFromElement(mutation.target, affectedClasses);
								shouldInvalidate = true;
							}
						}
					});
					
					if (shouldInvalidate) {
						if (affectedClasses.size > 0) {
							// Selective invalidation for affected classes only (영향받은 클래스만 선택적 무효화)
							this._invalidateSpecificCache(Array.from(affectedClasses));
						} else {
							// Invalidate entire cache (전체 캐시 무효화)
							this._invalidateCache('DOM 변경 감지');
						}
						
						// Check event listener status after DOM changes (temporarily disabled) (DOM 변경 후 이벤트 리스너 상태 확인 (임시 비활성화))
						// this._checkEventListenersAfterDOMChange();
					}
				});
				
				observer.observe(document.body, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ['class']
				});
				
				this._observers.set('cacheInvalidation', observer);
			}

			/**
			 * Extracts class names from an element and adds them to a Set (요소에서 클래스명을 추출하여 Set에 추가)
			 * @param {Element} element - DOM element to extract classes from (클래스를 추출할 DOM 요소)
			 * @param {Set} classSet - Set to add classes to (클래스를 추가할 Set)
			 * @returns {void}
			 * @private
			 */
			_extractClassesFromElement(element, classSet) {
				const dynamicClasses = ['wat-dyn-fontsize', 'wat-dyn-lineheight', 'wat-dyn-letterspacing', 'wat-dyn-textalign'];
				
				dynamicClasses.forEach(className => {
					if (element.classList && element.classList.contains(className)) {
						classSet.add(className);
					}
					
					// Also check child elements (하위 요소들도 확인)
					const childElements = element.querySelectorAll && element.querySelectorAll(`.${className}`);
					if (childElements && childElements.length > 0) {
						classSet.add(className);
					}
				});
			}


			/**
			 * Creates bound event handlers for reuse to prevent memory leaks (메모리 누수를 방지하기 위해 재사용할 바인딩된 이벤트 핸들러를 생성)
			 * @returns {void}
			 * @private
			 */
			_createBoundHandlers() {
				const handlers = {
					radioChange: this._handleRadioChange.bind(this),
					checkboxChange: this._handleCheckboxChange.bind(this),
					buttonClick: this._handleButtonClick.bind(this),
					focusIn: this._handleFocusIn.bind(this),
					keyDown: this._handleKeyDown.bind(this),
					mouseMove: this._handleMouseMove.bind(this),
					doubleClick: this._handleDoubleClick.bind(this),
					mouseUp: this._handleMouseUp.bind(this),
					cleanup: this.cleanup.bind(this)
				};
				
				// Store bound handlers in Map (바인딩된 핸들러를 Map에 저장)
				Object.entries(handlers).forEach(([key, handler]) => {
					this._boundHandlers.set(key, handler);
				});
			}

			/**
			 * Adds an event listener to an element with tracking for cleanup (정리를 위한 추적과 함께 요소에 이벤트 리스너를 추가)
			 * @param {Element} element - Target DOM element (대상 DOM 요소)
			 * @param {string} eventType - Event type (e.g., 'click', 'change') (이벤트 타입, 예: 'click', 'change')
			 * @param {string} handlerKey - Key to identify the handler in bound handlers map (바인딩된 핸들러 맵에서 핸들러를 식별하는 키)
			 * @param {Object} [options={}] - Event listener options (이벤트 리스너 옵션)
			 * @param {boolean} [options.once=false] - Execute handler only once (핸들러를 한 번만 실행)
			 * @param {boolean} [options.passive=false] - Passive event listener (패시브 이벤트 리스너)
			 * @param {boolean} [options.capture=false] - Capture phase listener (캡처 단계 리스너)
			 * @returns {void}
			 * @example
			 * // Add click event listener (클릭 이벤트 리스너 추가)
			 * this._addEventListener(button, 'click', 'handleButtonClick');
			 * 
			 * // Add with options (옵션과 함께 추가)
			 * this._addEventListener(element, 'scroll', 'handleScroll', { passive: true });
			 */
			_addEventListener(element, eventType, handlerKey, options = {}) {
				const handler = this._boundHandlers.get(handlerKey);
				if (!handler) {
					console.warn(`Handler '${handlerKey}' not found`);
					return;
				}
			
				// Prevent duplicate registration (중복 등록 방지)
				if (this._hasEventListener(element, eventType, handlerKey)) {
					console.warn(`Event listener already exists: ${eventType} on`, element);
					return;
				}
				
				// Automatically apply passive option to scroll blocking events (스크롤 차단 이벤트에 자동으로 passive 옵션 적용)
				const scrollBlockingEvents = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];
				if (scrollBlockingEvents.includes(eventType) && !Object.hasOwn(options, 'passive')) {
					options = { ...options, passive: true };
				}
				
				element.addEventListener(eventType, handler, options);
				
				// Track registered listeners (등록된 리스너 추적)
				this._trackEventListener(element, eventType, handlerKey, options);
			}

			/**
			 * Tracks event listener for later cleanup (나중에 정리하기 위해 이벤트 리스너를 추적)
			 * @param {Element} element - Target DOM element (대상 DOM 요소)
			 * @param {string} eventType - Event type (이벤트 타입)
			 * @param {string} handlerKey - Handler key (핸들러 키)
			 * @param {Object} options - Event listener options (이벤트 리스너 옵션)
			 * @returns {void}
			 * @private
			 */
			_trackEventListener(element, eventType, handlerKey, options) {
				if (!this._eventListeners.has(element)) {
					this._eventListeners.set(element, []);
				}
				
				this._eventListeners.get(element).push({
					eventType,
					handlerKey,
					options,
					handler: this._boundHandlers.get(handlerKey)
				});
			}

			/**
			 * Checks if an element has a specific event listener attached (요소에 특정 이벤트 리스너가 연결되어 있는지 확인)
			 * @param {Element} element - Target DOM element (대상 DOM 요소)
			 * @param {string} eventType - Event type to check (확인할 이벤트 타입)
			 * @param {string} handlerKey - Handler key to check (확인할 핸들러 키)
			 * @returns {boolean} True if listener exists, false otherwise (리스너가 존재하면 true, 그렇지 않으면 false)
			 */
			_hasEventListener(element, eventType, handlerKey) {
				const listeners = this._eventListeners.get(element);
				if (!listeners) return false;
				
				return listeners.some(listener => 
					listener.eventType === eventType && 
					listener.handlerKey === handlerKey
				);
			}

			/**
			 * Adds a global event listener (document level) with tracking (추적과 함께 전역 이벤트 리스너(document 레벨)를 추가)
			 * @param {string} eventType - Event type (이벤트 타입)
			 * @param {string} handlerKey - Key to identify the handler (핸들러를 식별하는 키)
			 * @param {Object} [options={}] - Event listener options (이벤트 리스너 옵션)
			 * @returns {void}
			 * @example
			 * // Add global keydown listener (전역 키다운 리스너 추가)
			 * this._addGlobalEventListener('keydown', 'handleKeyDown');
			 */
			_addGlobalEventListener(eventType, handlerKey, options = {}) {
				const handler = this._boundHandlers.get(handlerKey);
				if (!handler) {
					console.error('[Event] No handler found for key:', handlerKey);
					return;
				}
				
				// Prevent duplicates (focusin is exception - for focus TTS toggle) (중복 방지 (focusin은 예외 - 포커스 TTS 토글을 위해))
				if (this._globalEventHandlers.has(eventType) && eventType !== 'focusin') {
					console.warn(`Global event listener already exists: ${eventType}`);
					return;
				}
				
				// focusin 이벤트의 경우 기존 것이 있으면 먼저 제거
				if (eventType === 'focusin' && this._globalEventHandlers.has(eventType)) {
					this._removeGlobalEventListener(eventType);
				}

				// beforeunload/pagehide 등은 window에서만 발생하므로 대상 분기 — document에 걸면 영원히 발화하지 않음
				const target = ['beforeunload', 'pagehide', 'unload', 'resize'].includes(eventType) ? window : document;
				target.addEventListener(eventType, handler, options);

				this._globalEventHandlers.set(eventType, {
					handlerKey,
					handler,
					options,
					target
				});
			}

			/**
			 * Removes a global event listener (전역 이벤트 리스너를 제거)
			 * @param {string} eventType - Event type to remove (제거할 이벤트 타입)
			 * @returns {void}
			 */
			_removeGlobalEventListener(eventType) {
				const listenerInfo = this._globalEventHandlers.get(eventType);
				if (!listenerInfo) return;

				(listenerInfo.target || document).removeEventListener(eventType, listenerInfo.handler, listenerInfo.options);
				this._globalEventHandlers.delete(eventType);
			}

			/**
			 * Tracked version of setTimeout (추적 가능한 setTimeout 래퍼)
			 * @param {Function} callback - Function to execute (실행할 함수)
			 * @param {number} delay - Delay in milliseconds (밀리초 단위 지연)
			 * @param {...*} args - Arguments to pass to callback (콜백에 전달할 인수)
			 * @returns {number} Timer ID (타이머 ID)
			 * @description Tracks setTimeout IDs for proper cleanup during plugin destruction
			 */
			_setTimeout(callback, delay, ...args) {
				// Ensure tracking collections are initialized
				if (!this._timers) {
					console.warn('[WAT] Timer tracking not initialized, using fallback');
					return setTimeout(callback, delay, ...args);
				}

				const timerId = setTimeout((...callbackArgs) => {
					this._timers.delete(timerId); // Auto-remove on completion
					callback.apply(this, callbackArgs);
				}, delay, ...args);
				
				this._timers.add(timerId);
				return timerId;
			}

			/**
			 * Tracked version of setInterval (추적 가능한 setInterval 래퍼)
			 * @param {Function} callback - Function to execute (실행할 함수)
			 * @param {number} delay - Delay in milliseconds (밀리초 단위 지연)
			 * @param {...*} args - Arguments to pass to callback (콜백에 전달할 인수)
			 * @returns {number} Interval ID (인터벌 ID)
			 * @description Tracks setInterval IDs for proper cleanup during plugin destruction
			 */
			_setInterval(callback, delay, ...args) {
				// Ensure tracking collections are initialized
				if (!this._intervals) {
					console.warn('[WAT] Interval tracking not initialized, using fallback');
					return setInterval(callback, delay, ...args);
				}

				const intervalId = setInterval(callback, delay, ...args);
				this._intervals.add(intervalId);
				return intervalId;
			}

			/**
			 * Tracked version of requestAnimationFrame (추적 가능한 requestAnimationFrame 래퍼)
			 * @param {Function} callback - Function to execute (실행할 함수)
			 * @returns {number} Animation frame ID (애니메이션 프레임 ID)
			 * @description Tracks requestAnimationFrame IDs for proper cleanup during plugin destruction
			 */
			_requestAnimationFrame(callback) {
				// Ensure tracking collections are initialized
				if (!this._animationFrames) {
					console.warn('[WAT] Animation frame tracking not initialized, initializing now');
					this._animationFrames = new Set();
				}

				// Validate callback
				if (typeof callback !== 'function') {
					console.error('[WAT] _requestAnimationFrame requires a function callback');
					return;
				}

				const frameId = requestAnimationFrame((...args) => {
					if (this._animationFrames) {
						this._animationFrames.delete(frameId); // Auto-remove on completion
					}
					callback.apply(this, args);
				});
				
				this._animationFrames.add(frameId);
				return frameId;
			}

			/**
			 * Clears a tracked timeout (추적된 타임아웃을 제거)
			 * @param {number} timerId - Timer ID to clear (제거할 타이머 ID)
			 * @returns {void}
			 */
			_clearTimeout(timerId) {
				if (this._timers && this._timers.has(timerId)) {
					clearTimeout(timerId);
					this._timers.delete(timerId);
				} else {
					clearTimeout(timerId);
				}
			}

			/**
			 * Clears a tracked interval (추적된 인터벌을 제거)
			 * @param {number} intervalId - Interval ID to clear (제거할 인터벌 ID)
			 * @returns {void}
			 */
			_clearInterval(intervalId) {
				if (this._intervals && this._intervals.has(intervalId)) {
					clearInterval(intervalId);
					this._intervals.delete(intervalId);
				} else {
					clearInterval(intervalId);
				}
			}

			/**
			 * Cancels a tracked animation frame (추적된 애니메이션 프레임을 취소)
			 * @param {number} frameId - Animation frame ID to cancel (취소할 애니메이션 프레임 ID)
			 * @returns {void}
			 */
			_cancelAnimationFrame(frameId) {
				if (this._animationFrames && this._animationFrames.has(frameId)) {
					cancelAnimationFrame(frameId);
					this._animationFrames.delete(frameId);
				} else {
					cancelAnimationFrame(frameId);
				}
			}

			/**
			 * Handles radio button change events (라디오 버튼 변경 이벤트를 처리)
			 * @param {Event} e - Change event object (변경 이벤트 객체)
			 * @returns {void}
			 * @private
			 */
			_handleRadioChange(e) {
				const target = e.target;
				
				if (WAT_DEBUG_ENABLED) {
					console.log('=== Radio Change Event ===');
					console.log('Target:', target);
					console.log('Name:', target.name);
					console.log('Value:', target.value);
					console.log('Checked:', target.checked);
					console.log('Matches wat-item-type-radio:', target.matches('.wat-item-type-radio[type="radio"]'));
					console.log('==========================');
				}
				
				if (target.matches('.wat-item-type-radio[type="radio"]')) {
					this.setRadioListeners(target);
				} else if (target.matches('.wat-item-type-checkbox[type="checkbox"]')) {
					this._handleCheckboxChange(e);
				}
			}

			/**
			 * Handles checkbox change events (체크박스 변경 이벤트를 처리)
			 * @param {Event} e - Change event object (변경 이벤트 객체)
			 * @returns {void}
			 * @private
			 */
			_handleCheckboxChange(e) {
				const target = e.target;
				const dataAttr = target.getAttribute('name') || target.getAttribute('data-attr');
				
				if (!dataAttr) {
					console.warn('[WAT] Checkbox missing data-attr or name attribute');
					return;
				}
				
				this.toggleDataAttribute(dataAttr, target.checked);

				const isActive = target.checked;
				// role="switch" 요소의 aria-checked를 상태와 동기화 — 미갱신 시 스크린리더가 항상 "off"로 읽음
				if (target.getAttribute('role') === 'switch') {
					target.setAttribute('aria-checked', isActive ? 'true' : 'false');
				}
				const elm_state = target.parentElement.querySelector('.switch-state');
				if (elm_state) {
					const label = elm_state.getAttribute('data-stateText-' + (isActive ? 'on' : 'off'));
					elm_state.textContent = label;
				}
				
				// Checkboxes that require special handling (특별한 처리가 필요한 체크박스들)
				if (dataAttr === 'imgTextConvert') {
					this.toggleImgTextConversion(isActive);
				} else if (dataAttr === 'mediaStop') {
					this.toggleMediaStop(target.checked);
				} else if (dataAttr === 'mediaMute') {
					this.toggleMediaMute(target.checked);
				} else if (dataAttr === 'diction') {
					this.toggleDiction();
				}
			}

			/**
			 * Handles button click events (버튼 클릭 이벤트를 처리)
			 * @param {Event} e - Click event object (클릭 이벤트 객체)
			 * @returns {void}
			 * @private
			 */
			_handleButtonClick(e) {
				const target = e.target.closest('button');
				if (!target) {
					// If non-button element is clicked and focus TTS is active, execute focus TTS (버튼이 아닌 요소에 클릭된 경우, 포커스 TTS가 활성화되어 있다면 포커스 TTS 실행)
					if (this.state.get('tts.focusDetectFlag')) {
						// Focus on clicked element and simulate focus event (클릭된 요소에 포커스를 주고 포커스 이벤트 시뮬레이션)
						if (e.target.tabIndex === -1) {
							e.target.tabIndex = 0; // 포커스 가능하게 만들기
							// 나중에 원복할 수 있도록 플러그인이 부여한 tabindex임을 표시 (호스트 탭 순서 영구 변형 방지)
							e.target.dataset.watTabindexAdded = 'true';
						}
						const clickedTarget = e.target;
						const hadFocus = document.activeElement === clickedTarget;
						clickedTarget.focus();

						// 포커스 이벤트가 자동으로 발생하지 않는 경우에만 수동 처리 (중복 발화 방지, 추적형 타이머)
						this._setTimeout(() => {
							if (hadFocus || document.activeElement !== clickedTarget) {
								return; // 실제 focusin이 이미 처리됐거나 포커스가 이동함
							}
							const focusEvent = new FocusEvent('focusin', {
								view: window,
								bubbles: true,
								cancelable: true,
								relatedTarget: null
							});
							Object.defineProperty(focusEvent, 'target', {
								value: clickedTarget,
								enumerable: true
							});
							this._handleFocusIn(focusEvent);
						}, 10);
					}
					return;
				}
				
				const buttonId = target.id;
				
				// Button-specific processing logic (버튼별 처리 로직)
				if (buttonId === 'wat-button-pageStructure_show') {
					this.openPageStructure();
				} else if (buttonId === 'wat-button-stt_start') {
					this.stt_start();
				} else if (buttonId.includes('tts_')) {
					this._handleTTSButtons(target);
				} else if (buttonId.includes('pageScroll_')) {
					this._handlePageScrollButtons(target);
				}
			}

			/**
			 * Handles focus in events for accessibility features (접근성 기능을 위한 포커스 인 이벤트를 처리)
			 * @param {Event} e - Focus event object (포커스 이벤트 객체)
			 * @returns {void}
			 * @private
			 */
			_handleFocusIn(e) {
				// Check if focus TTS is activated (포커스 TTS가 활성화되어 있는지 확인)
				const isFocusDetectionActive = this.state.get('tts.focusDetectFlag');
				
				// Return immediately if focus detection is disabled (포커스 감지가 비활성화되어 있으면 즉시 반환)
				if (!isFocusDetectionActive) {
					return;
				}
				
				// Exclude elements with TTS highlight when regular TTS is active (automatic focus movement of regular TTS) (일반 TTS가 활성화되어 있고 TTS 하이라이트가 있는 요소는 제외 (일반 TTS의 자동 포커스 이동))
				if (this.state.get('plugin.isTTSActive') && e.target.classList.contains('wat-tts_highlight')) {
					return;
				}
				
				// WAT 도구 자체의 버튼들은 제외
				// (SVG 요소의 className은 SVGAnimatedString이라 includes가 없으므로 getAttribute로 안전하게 확인)
				const targetClassAttr = (typeof e.target.getAttribute === 'function' && e.target.getAttribute('class')) || '';
				if (e.target.closest('#wat-container') ||
					(typeof e.target.id === 'string' && e.target.id.startsWith('wat-')) ||
					targetClassAttr.includes('wat-')) {
					return;
				}
				
				// 레거시 focusin TTS(tts_handleFocus)는 제거됨 — 포커스 낭독은 FocusTTS(ttsManager)가 담당.
				// focusDetectFlag를 true로 만드는 경로도 없어 이 지점은 도달 불가 (가드들은 안전을 위해 유지)
			}

			/**
			 * Handles keyboard events for accessibility navigation (접근성 내비게이션을 위한 키보드 이벤트를 처리)
			 * @param {Event} e - Keyboard event object (키보드 이벤트 객체)
			 * @returns {void}
			 * @private
			 */
			_handleKeyDown(e) {
				// Escape: 열려 있는 메인 패널을 닫고 포커스를 열기 버튼으로 복원
				// (사전·페이지구조 모달은 자체 keydown 핸들러가 먼저 처리하므로 여기 도달하지 않음)
				if (e.key === 'Escape' && this.container && !this.container.classList.contains('hide')) {
					const closeBtn = document.getElementById('wat_btnClose');
					if (closeBtn) {
						e.preventDefault();
						closeBtn.click();
						return;
					}
				}

				// 입력 요소에서는 단축키를 가로채지 않음
				const target = e.target;
				if (target && (target.isContentEditable ||
					(typeof target.matches === 'function' && target.matches('input, textarea, select')))) {
					return;
				}

				// 문자 키 단축키는 config로 끌 수 있어야 함 (WCAG 2.1.4)
				if (this.getConfigValue && this.getConfigValue('settings.ui.keyboardShortcuts', true) === false) {
					return;
				}

				// Alt+Shift 조합 — Shift 단독은 대문자 입력·AT 단축키와 충돌해 WCAG 2.1.4 위반이었음
				if (!e.altKey || !e.shiftKey) {
					return;
				}
				// Alt + Shift + T: 키보드 단축어 TTS
				if (e.key.toLowerCase() === 't') {
					e.preventDefault();
					this.ttsManager.executeKeyboardTTS();
				}
				// Alt + Shift + D: 사전 검색
				else if (e.key.toLowerCase() === 'd') {
					e.preventDefault();
					const selectedText = window.getSelection().toString().trim();
					if (selectedText) {
						this.performDiction(selectedText);
					}
				}
				// Alt + Shift + S: STT
				else if (e.key.toLowerCase() === 's') {
					e.preventDefault();
					this.stt_start();
				}
			}

			/**
			 * Handles mouse move events for reading guides and interactive features (읽기 가이드와 인터랙티브 기능을 위한 마우스 이동 이벤트를 처리)
			 * @param {Event} e - Mouse move event object (마우스 이동 이벤트 객체)
			 * @returns {void}
			 * @private
			 */
			_handleMouseMove(e) {
				// Process according to reading guide mode (읽기 가이드 모드에 따른 처리)
				const readGuideMode = this.state.get('plugin.readGuideMode');
				if (readGuideMode === 'mask') {
					this.handleMaskMode(e);
				} else if (readGuideMode === 'underline') {
					this.handleLineMode(e);
				}
			}

			/**
			 * Handles double click events for special accessibility actions (특별한 접근성 동작을 위한 더블클릭 이벤트를 처리)
			 * @param {Event} e - Double click event object (더블클릭 이벤트 객체)
			 * @returns {void}
			 * @private
			 */
			_handleDoubleClick(e) {
				const selectedText = window.getSelection().toString().trim();

				if (selectedText) {
					if (this.state.get('plugin.isDictionEnabled')) {
						// 사전 기능이 활성화되어 있으면 사전 검색을 우선 처리
						this.performDiction(selectedText);
					}
					// 포커스 TTS의 선택 텍스트 읽기는 FocusTTS 모듈이 자체 리스너로 처리
					// (여기서 tts_draggableText()를 중복 호출하면 이중 발화·하이라이트 중첩 발생)
				}
			}

			/**
			 * Handles mouse up events for drag and selection operations (드래그 및 선택 작업을 위한 마우스 업 이벤트를 처리)
			 * @param {Event} e - Mouse up event object (마우스 업 이벤트 객체)
			 * @returns {void}
			 * @private
			 */
			_handleMouseUp(e) {
				// 포커스 TTS의 선택 텍스트 읽기는 FocusTTS 모듈이 자체 mouseup 리스너로 처리
				// (레거시 경로와 중복 실행 시 이중 발화·상호 취소 경합이 발생하므로 여기서는 처리하지 않음)
			}


			/**
			 * Loads locale data from JSON file for the specified language (지정된 언어의 JSON 파일에서 지역화 데이터를 로드합니다)
			 * @async
			 * @param {string} language - Language code (e.g., 'ko', 'en', 'ja') (언어 코드, 예: 'ko', 'en', 'ja')
			 * @returns {Promise<void>} Promise that resolves when locale data is loaded (지역화 데이터 로드 완료 시 resolve되는 Promise)
			 * @throws {Error} Throws an error if locale file loading fails (지역화 파일 로드 실패 시 에러 발생)
			 * @example
			 * // Load Korean locale (한국어 지역화 로드)
			 * await plugin.loadLocale('ko');
			 * 
			 * // Load English locale (영어 지역화 로드)
			 * await plugin.loadLocale('en');
			 */
			async loadLocale(language) {
				// standalone 번들 등이 임베드한 로케일이 있으면 fetch 없이 즉시 사용 (오프라인 지원)
				const embedded = WAT.embeddedLocales && WAT.embeddedLocales[language];
				if (embedded) {
					this.state.set('locale', embedded);
					return;
				}
				try {
					// basePath는 '/'로 끝나므로 이중 슬래시가 생기지 않도록 결합, 없으면 상대 경로
					const localeUrl = `${basePath || './'}${Constants.PATHS.LOCALES}${language}.json`;
					const response = await fetch(localeUrl);
					if (!response.ok) {
						throw new Error(`HTTP ${response.status} - ${localeUrl}`);
					}
					const localeData = await response.json();
					this.state.set('locale', localeData);
				} catch (error) {
					console.error(`Error loading locale file for language: ${language}`, error);
				}
			}

			/**
			 * 자산(이미지 등)의 URL을 해석합니다 — 임베드 자산(data URI) 우선, 없으면 스크립트 위치 기준
			 * @param {string} relPath - 'assets/images/...' 형태의 상대 경로
			 * @returns {string} data URI 또는 basePath 기준 URL
			 * @private
			 */
			_assetUrl(relPath) {
				const embedded = WAT.embeddedAssets && WAT.embeddedAssets[relPath];
				if (embedded) return embedded;
				return basePath ? `${basePath}${relPath}` : `./${relPath}`;
			}

			/**
			 * Gets localized text for the specified key with parameter substitution (지정된 키의 지역화된 텍스트를 매개변수 치환과 함께 가져옵니다)
			 * @param {string} key - Dot-separated key path for the localized text (지역화된 텍스트의 점으로 구분된 키 경로)
			 * @param {Object} [params={}] - Parameters for text substitution (텍스트 치환을 위한 매개변수)
			 * @returns {string} Localized text with parameters substituted (매개변수가 치환된 지역화된 텍스트)
			 * @example
			 * // Get simple localized text (단순 지역화 텍스트 가져오기)
			 * const title = this.getLocalizedText('panel.settings.title');
			 * 
			 * // Get text with parameter substitution (매개변수 치환과 함께 텍스트 가져오기)
			 * const message = this.getLocalizedText('msg.error.fileNotFound', { filename: 'config.json' });
			 */
			getLocalizedText(key, params = {}) {
				const locale = this.state.get('locale');
				let translation = key.split('.').reduce((o, i) => (o ? o[i] : null), locale);

				// 키 미존재 시 빈 문자열 반환 — null 반환 시 aria-label="null", TTS "null" 발화 등이 발생함
				// (호출부의 `|| 폴백` 패턴은 빈 문자열에서도 동일하게 동작)
				if (!translation) {
					if (WAT_DEBUG_ENABLED) console.warn(`[WAT] 로케일 키 누락: ${key}`);
					return '';
				}

				// params에 포함된 값을 {key} 형태로 치환
				for (const param in params) {
					translation = translation.replace(`{${param}}`, params[param]);
				}

				return translation;
			}

			/**
			 * Updates localized text in the UI elements (UI 요소의 지역화된 텍스트를 업데이트합니다)
			 * @returns {void}
			 * @example
			 * // Update UI text after language change (언어 변경 후 UI 텍스트 업데이트)
			 * this.updateTextLocalization();
			 */
			updateTextLocalization() {
				const localizedText = this.getLocalizedText('panel.settings.profile.options.visualImpairment.title');
				const profileTitleLabel = document.querySelector('.watSet-profile-title-label');
				if (profileTitleLabel) {
					profileTitleLabel.textContent = localizedText;
				}
			}

			/**
			 * Updates language setting display in the UI (UI에서 언어 설정 표시를 업데이트합니다)
			 * @returns {void}
			 * @example
			 * // Update language setting display (언어 설정 표시 업데이트)
			 * this.updateLanguageSetting();
			 */
			updateLanguageSetting() {
				const languageSettingTitle = this.getLocalizedText('panel.settings.manage.options.language.title');
				const languageSettingContainer = document.getElementById(Constants.ELEMENT_IDS.LANGUAGE_SETTING_WRAP);
				if (languageSettingContainer) {
					const legend = languageSettingContainer.querySelector('.watSet-title');
					if (legend) {
						legend.textContent = languageSettingTitle;
					}
					const labels = languageSettingContainer.querySelectorAll('.watSet-label');
					labels.forEach(label => {
						const lang = label.getAttribute('for').split('_')[2];
						label.textContent = this.getLocalizedText('panel.settings.manage.options.language.options.' + lang);
					});
				}
				
				// TTS 포커스 버튼 텍스트 업데이트
				const focusBtn = document.getElementById('wat-button-tts_focus_toggle');
				if (focusBtn) {
					const isActive = focusBtn.getAttribute('aria-pressed') === 'true';
					const textKey = isActive ? 'panel.personal.options.tts.options.focus-stop' : 'panel.personal.options.tts.options.focus-start';
					const text = this.getLocalizedText(textKey);
					focusBtn.setAttribute('title', text);
					focusBtn.textContent = text;
				}
			}


			// ========== Create Dom Element ==========
			/**
			 * Creates an HTML element with specified attributes (지정된 속성으로 HTML 요소를 생성합니다)
			 * @param {string} tag - HTML tag name (HTML 태그명)
			 * @param {Object} [attrs={}] - Object containing attributes to apply (적용할 속성들을 포함한 객체)
			 * @param {string|string[]} [attrs.class] - CSS class names as string or array (CSS 클래스명, 문자열 또는 배열)
			 * @param {string} [attrs.id] - Element ID (요소 ID)
			 * @param {string} [attrs.role] - ARIA role (ARIA 역할)
			 * @param {string} [attrs.tabindex] - Tab index value (탭 인덱스 값)
			 * @param {string} [attrs.aria-label] - ARIA label (ARIA 라벨)
			 * @param {string} [attrs.aria-hidden] - ARIA hidden state (ARIA 숨김 상태)
			 * @returns {HTMLElement} Created HTML element (생성된 HTML 요소)
			 * @example
			 * // Create a div with class and id (클래스와 ID를 가진 div 생성)
			 * const div = this.createElementWithAttrs('div', { 
			 *   class: 'container', 
			 *   id: 'main-container' 
			 * });
			 * 
			 * // Create button with multiple classes (여러 클래스를 가진 버튼 생성)
			 * const button = this.createElementWithAttrs('button', {
			 *   class: ['btn', 'btn-primary'],
			 *   'aria-label': 'Submit form'
			 * });
			 */
			createElementWithAttrs(tag, attrs = {}) {
				const elem = document.createElement(tag);
				Object.entries(attrs).forEach(([key, value]) => {
					if (key === "class") {
					// Support both array and string (배열 또는 문자열 모두 지원)
					if (Array.isArray(value)) {
						value.forEach(cls => elem.classList.add(cls));
					} else if (typeof value === 'string') {
						elem.classList.add(...value.split(' ').filter(Boolean));
					}
					} else {
						elem.setAttribute(key, value);
					}
				});
				return elem;
			}

			/**
			 * Creates an HTML element with specified CSS class names (지정된 CSS 클래스명으로 HTML 요소를 생성합니다)
			 * @param {string} tag - HTML tag name (HTML 태그명)
			 * @param {string|string[]} classNames - CSS class names as string or array (CSS 클래스명, 문자열 또는 배열)
			 * @returns {HTMLElement} Created HTML element with applied classes (클래스가 적용된 생성된 HTML 요소)
			 * @example
			 * // Create div with single class (단일 클래스로 div 생성)
			 * const div = this.createElementWithClass('div', 'container');
			 * 
			 * // Create span with multiple classes (여러 클래스로 span 생성)
			 * const span = this.createElementWithClass('span', ['icon', 'icon-large']);
			 * 
			 * // Create button with space-separated classes (공백으로 구분된 클래스로 버튼 생성)
			 * const button = this.createElementWithClass('button', 'btn btn-primary btn-large');
			 */
			createElementWithClass(tag, classNames) {
				return this.createElementWithAttrs(tag, { class: classNames });
			}

			// ========== Create MAIN HTML   ==========

			/**
			 * Validates container and initializes the HTML generation process
			 * @private
			 * @returns {HTMLElement} The validated container element
			 * @throws {Error} If container is not found
			 */
			_validateAndInitialize() {
				const container = this.container;
				if (!container) {
					console.error(this.getLocalizedText('msg.error.selectorNotFound', { selector: this.selector }));
					throw new Error('Container not found');
				}

				// Material Icons CDN 주입 제거 — 프로필 아이콘은 번들 SVG(css mask)로 대체됨 (오프라인/폐쇄망 동작).
				// 기존 config와의 호환: 키가 남아 있으면 안내만 하고 무시한다 (deprecated)
				const deprecatedMaterialIcons = this.getConfigValue('resources.fonts.materialIcons', null);
				if (deprecatedMaterialIcons) {
					console.warn('[WAT] resources.fonts.materialIcons 설정은 더 이상 사용되지 않습니다. 아이콘이 번들에 포함되어 CDN 로드가 필요 없습니다.');
				}

				// Initialize container — body/documentElement이면 호스트 페이지가 삭제되므로 차단
				if (!container || container === document.body || container === document.documentElement) {
					throw new Error('[WAT] 유효하지 않은 컨테이너입니다. 초기화를 중단합니다.');
				}
				container.innerHTML = "";
				container.classList.add('wat-container', 'no-speech', 'wat-exclude');
				
				return container;
			}

			/**
			 * Creates the main structure elements (wrapper and main panel)
			 * @private
			 * @returns {Object} Object containing mainWrapper and mainPanel elements
			 */
			_createMainStructure() {
				// Base Wrap 생성
				// complementary 랜드마크에 이름 부여 — 호스트 페이지의 다른 aside와 구분 (WCAG 1.3.6)
				const mainWrapperElement = this.createElementWithAttrs('aside', { id: 'watWrap', 'aria-labelledby': 'wat_title' });
				mainWrapperElement.classList.add('wat-exclude');
				
				// Create main tool panel (메인 도구 패널 생성)
				const mainPanelElement = this.createElementWithAttrs('div', { id: 'wat' });
				mainPanelElement.classList.add('wat-exclude');
				mainWrapperElement.appendChild(mainPanelElement);

				return {
					mainWrapper: mainWrapperElement,
					mainPanel: mainPanelElement
				};
			}

			/**
			 * Creates the header section with title and close button
			 * @private
			 * @param {HTMLElement} mainPanel - The main panel element
			 */
			_createHeader(mainPanel) {
				// Create header area (헤더 영역 생성)
				const headerPanelElement = this.createElementWithAttrs('div', { id: 'wat_header' });
				mainPanel.appendChild(headerPanelElement);

				// Create title (타이틀 생성)
				const titleElement = this.createElementWithAttrs('h2', { id: 'wat_title' });
				titleElement.textContent = this.getLocalizedText('toolTitle');
				headerPanelElement.appendChild(titleElement);
				
				// Create settings header area (설정 헤더 영역 생성)
				const settingWrapElement = this.createElementWithAttrs('div', { id: 'wat_settingWrap' });
				headerPanelElement.appendChild(settingWrapElement);

				// 축소 버튼 생성
				const minimizeButtonElement = this.createElementWithAttrs('button', { 
					id: 'wat_btnMinimize', 
					class: 'btn_minimize',
					'aria-label': this.getLocalizedText('command.minimize'),
					title: this.getLocalizedText('command.minimize')
				});
				minimizeButtonElement.addEventListener('click', () => {
					//console.log('Minimize button clicked');
					this.toggleMinimize();
				});
				settingWrapElement.appendChild(minimizeButtonElement);

				// 닫기 버튼 생성
				const closeButtonElement = this.createElementWithAttrs('button', { 
					id: 'wat_btnClose', 
					class: 'btn_close',
					'aria-label': this.getLocalizedText('command.close'),
					title: this.getLocalizedText('command.close')
				});
				closeButtonElement.addEventListener('click', () => {
					this.container.classList.add('hide');
					document.documentElement.dataset.watPanel = 'closed';
					// Save closed state to localStorage
					localStorage.setItem(Constants.STORAGE_KEYS.PANEL_STATE, 'closed');
					// 포커스를 열기 버튼으로 이동 — 숨겨진 패널에 포커스가 남아 실종되는 것 방지 (WCAG 2.4.3)
					const openBtn = document.getElementById('wat_btnOpen');
					if (openBtn) openBtn.focus();
				});
				settingWrapElement.appendChild(closeButtonElement);
			}

			
			/**
			 * Creates the footer section with copyright information
			 * @private
			 * @param {HTMLElement} mainPanel - The main panel element
			 */
			_createFooter(mainPanel) {
				const footer = this.createElementWithAttrs('div', {
					id: 'wat_footer',
					class: 'wat-footer'
				});

				// 저작권 텍스트 생성
				const copyrightEmoji = this.createElementWithAttrs('span', {
					class: 'copy-emoji'
				});
				copyrightEmoji.textContent = '© ';

				const copyrightSince = this.createElementWithAttrs('span', {
					class: 'copy-since'
				});
				copyrightSince.textContent = '2025';
				
				// 대구사이버대학교 링크 생성 (config 유래 URL은 http(s) 스킴만 허용)
				const configCopyrightUrl = this.getConfigValue('branding.copyrightUrl', 'https://www.dcu.ac.kr');
				const dcuLink = this.createElementWithAttrs('a', {
					href: isSafeHttpUrl(configCopyrightUrl) ? configCopyrightUrl : 'https://www.dcu.ac.kr',
					target: '_blank',
					rel: 'noopener noreferrer',
					class: 'dcu-link'
				});
				dcuLink.textContent = 'DAEGU CYBER UNIVERSITY';

				// 나머지 텍스트
				const remainingText = this.createElementWithAttrs('span', {
					class: 'copy-remaining'
				});
				remainingText.textContent = '. All Rights Reserved.';

				// 푸터에 요소들 추가
				footer.appendChild(copyrightEmoji);
				footer.appendChild(copyrightSince);
				footer.appendChild(dcuLink);
				footer.appendChild(remainingText);

				// 메인 패널에 푸터 추가
				mainPanel.appendChild(footer);
			}

			/**
			 * Creates the tab navigation structure
			 * @private
			 * @param {HTMLElement} mainPanel - The main panel element
			 * @returns {Object} Object containing tab-related elements
			 */
			_createTabNavigation(mainPanel) {
				// Create option panel (change options) (옵션 패널 (변경 옵션) 생성)
				const optionsPanelElement = this.createElementWithAttrs('div', { id: 'wat_panel_Opt' });
				optionsPanelElement.classList.add('wat_panel');
				optionsPanelElement.setAttribute('aria-hidden', 'false');
				optionsPanelElement.hidden = false;
				mainPanel.appendChild(optionsPanelElement);

				// Create tab area (탭 영역 생성)
				const optionTabContainerElement = this.createElementWithAttrs('div', { id: 'wat_panel_Opt_tab' });
				optionsPanelElement.appendChild(optionTabContainerElement);

				const tabListContainerElement = this.createElementWithAttrs('ul', { 
					role: 'tablist', 
					class: 'tabSize_2' 
				});
				optionTabContainerElement.appendChild(tabListContainerElement);

				// Define tab data (탭 데이터 정의)
				const tabsData = [
					{ id: 'wat_personal', label: this.getLocalizedText('panel.personal.title'), panelId: 'wat_Panel_Opt_personal' },
					{ id: 'wat_settings', label: this.getLocalizedText('panel.settings.title'), panelId: 'wat_Panel_Opt_settings' }
				];

				// Create tab buttons (탭 버튼들 생성)
				tabsData.forEach((tab, index) => {
					const tabItemElement = document.createElement('li');
					const tabButtonElement = this.createElementWithAttrs('button', {
						role: 'tab',
						'aria-selected': index === 0 ? 'true' : 'false',
						'aria-controls': tab.panelId,
						id: tab.id,
						tabindex: index === 0 ? '0' : '-1'
					});
					tabButtonElement.textContent = tab.label;
					tabItemElement.appendChild(tabButtonElement);
					tabListContainerElement.appendChild(tabItemElement);
				});

				// Create content area (컨텐츠 영역 생성)
				const contentContainerElement = this.createElementWithAttrs('div', { id: 'wat_panel_Opt_cont' });
				optionsPanelElement.appendChild(contentContainerElement);

				return {
					optionsPanel: optionsPanelElement,
					tabListContainer: tabListContainerElement,
					contentContainer: contentContainerElement
				};
			}

			/**
			 * Creates the personal settings panel with all options
			 * @private
			 * @param {HTMLElement} contentContainer - The content container element
			 */
			_createPersonalPanel(contentContainer) {
				// [탭 패널] 개인 설정 영역 생성
				const personalPanelElement = this.createElementWithAttrs('div', { 
					id: 'wat_Panel_Opt_personal', 
					role: 'tabpanel', 
					'aria-labelledby': 'wat_personal' 
				});
				personalPanelElement.hidden = false;
				personalPanelElement.style.display = 'block';
				contentContainer.appendChild(personalPanelElement);

				const personalContentTitleElement = this.createElementWithAttrs('h3', { class: 'panelTitle blind' });
				personalContentTitleElement.textContent = this.getLocalizedText('panel.personal.title');
				personalPanelElement.appendChild(personalContentTitleElement);

				const personalListElement = this.createElementWithAttrs('ul', { class: 'personalList' });
				personalPanelElement.appendChild(personalListElement);

				// Create and add option list (옵션 리스트 생성 및 추가)
				this._createPersonalOptions(personalListElement);
				
				// Set tool width (툴 너비 설정)
				this._setToolWidth();
			}

			/**
			 * Creates and adds personal options to the personal panel
			 * @private
			 * @param {HTMLElement} personalListElement - The personal list container
			 */
			_createPersonalOptions(personalListElement) {
				// Create option list (옵션 리스트 생성)
				this.optionsList = {
					fontSize: this.createFontSizeSettings(),
					fontFamily: this.createFontFamilySettings(),
					screenScale: this.createScreenScaleSettings(),
					txtAlign: this.createTxtAlignSettings(),
					letterSpacing: this.createLetterSpacingSettings(),
					lineHeight: this.createLineHeightSettings(),
					colorTheme: this.createColorThemeSettings(),
					saturation: this.createSaturationSettings(),
					readGuide: this.createReadGuideSettings(),
					imgDisplayMode: this.createImgDisplayModeSettings(),
					mediaStop: this.createMediaStopSettings(),
					mediaMute: this.createMediaMuteSettings(),
					stopAni: this.createStopAniSettings(),
					pageScroll: this.createPageScrollSettings(),
					tts: this.createTTSSettings(),
					stt: this.createSTTSettings(),
					diction: this.createDictionSettings(),
					pageStructure: this.createPageStructureSettings()
				};

				// Add options to DOM (옵션들을 DOM에 추가)
				for (const option in this.optionsList) {
					if (this.options[option] !== false) {
						const node = this.optionsList[option];
						if (node instanceof Node) {
							node.classList.add('personalOpt_item', 'wat-item-wrap', option);
							personalListElement.appendChild(node);
						} else {
							console.warn(this.getLocalizedText('msg.warning.optionNotNode', { option: option }));
						}
					}
				}
			}

			/**
			 * Sets the tool width if specified in options
			 * @private
			 */
			_setToolWidth() {
				if (this.options.toolWidth) {
					let toolWidthValue = this.options.toolWidth;
					if (typeof toolWidthValue === 'string' && !/^\d+(\.\d+)?(px|em|rem|%)$/.test(toolWidthValue)) {
						toolWidthValue = parseFloat(toolWidthValue) || 0;
						toolWidthValue += 'px';
					}
					if (typeof toolWidthValue === 'number') {
						toolWidthValue += 'px';
					}
					document.documentElement.style.setProperty('--wat-tool-width', toolWidthValue);
				}
			}

			/**
			 * Creates the settings panel
			 * @private
			 * @param {HTMLElement} contentContainer - The content container element
			 */
			_createSettingsPanel(contentContainer) {
				// [탭 패널] 환경 설정 영역 생성
				const settingsPanelElement = this.createElementWithAttrs('div', { 
					id: 'wat_Panel_Opt_settings', 
					role: 'tabpanel', 
					'aria-labelledby': 'wat_settings' 
				});
				settingsPanelElement.hidden = true;
				contentContainer.appendChild(settingsPanelElement);

				const settingsContentTitleElement = this.createElementWithAttrs('h3', { class: 'panelTitle blind' });
				settingsContentTitleElement.textContent = this.getLocalizedText('panel.settings.title');
				settingsPanelElement.appendChild(settingsContentTitleElement);

				// 환경설정 컨테이너 생성
				this.createProfileSettings(settingsPanelElement);
				this.createToolsSettings(settingsPanelElement);
			}

			/**
			 * Creates the open button
			 * @private
			 * @returns {HTMLElement} The open button wrapper element
			 */
			_createOpenButton() {
				// 열기 버튼 생성
				const openButtonWrapElement = this.createElementWithAttrs('div', { id: 'wat_btnOpenWrap', class: 'wat-exclude' });
				const openButtonElement = this.createElementWithAttrs('button', { 
					id: 'wat_btnOpen', 
					class: 'btn_open', 
					'aria-label': this.getLocalizedText('command.open'), 
					title: this.getLocalizedText('command.open') 
				});
				
				openButtonElement.addEventListener('click', () => {
					this.container.classList.remove('hide');
					document.documentElement.dataset.watPanel = 'opened';
					try { localStorage.setItem(Constants.STORAGE_KEYS.PANEL_STATE, 'opened'); } catch (e) {}
					// 패널을 열면 내부 첫 포커스 대상(닫기 버튼)으로 포커스 이동 (WCAG 2.4.3)
					const closeBtn = document.getElementById('wat_btnClose');
					if (closeBtn) closeBtn.focus();
				});
				openButtonWrapElement.appendChild(openButtonElement);
				
				return openButtonWrapElement;
			}

			/**
			 * Sets up event handlers and initial state
			 * @private
			 * @param {HTMLElement} tabListContainer - The tab list container element
			 */
			_finalizeSetup() {
				// 탭 이벤트/초기 탭은 setupTabs()/activateInitialTab()가 담당 (hidden + aria-selected 정합).
				// 이전의 showTabContent(display 기반, ARIA 미갱신) 이중 바인딩은 제거됨
				document.documentElement.dataset.watPanel = 'opened';
			}

			/**
			 * Restores panel state from localStorage (localStorage에서 패널 상태를 복원합니다)
			 * @private
			 * @returns {void}
			 * @description Checks watPanelState in localStorage and applies 'hide' class if closed
			 *              (localStorage의 watPanelState를 확인하고 closed 상태면 hide 클래스 적용)
			 */
			_restorePanelState() {
				let panelState = localStorage.getItem(Constants.STORAGE_KEYS.PANEL_STATE);
				const watContainer = document.getElementById('watContainer');
				
				// Default to 'closed' for first-time visitors (no stored state)
				if (!panelState) {
					panelState = 'closed';
					try { localStorage.setItem(Constants.STORAGE_KEYS.PANEL_STATE, 'closed'); } catch (e) {}
				}
				
				if (panelState === 'closed') {
					if (watContainer) {
						watContainer.classList.add('hide');
						document.documentElement.dataset.watPanel = 'closed';
					}
				} else if (panelState === 'opened' || panelState === 'open') {
					// Ensure it's visible if user previously opened it
					if (watContainer) {
						watContainer.classList.remove('hide');
						document.documentElement.dataset.watPanel = 'opened';
					}
				}
			}

			/**
			 * Generates the main HTML elements for the accessibility tool interface (접근성 도구 인터페이스의 메인 HTML 요소들을 생성합니다)
			 * @returns {void}
			 * @throws {Error} Throws an error if container selector is not found (컨테이너 선택자를 찾을 수 없으면 에러를 발생시킵니다)
			 * @description Creates the complete UI structure including header, tabs, panels, and all accessibility options
			 *              (헤더, 탭, 패널 및 모든 접근성 옵션을 포함한 완전한 UI 구조를 생성합니다)
			 * @example
			 * // Generate HTML elements after plugin initialization (플러그인 초기화 후 HTML 요소 생성)
			 * this.generateHTMLElements();
			 */
			generateHTMLElements() {
				try {
					// 1. 검증 및 초기화
					const container = this._validateAndInitialize();
					
					// 2. 메인 구조 생성
					const mainStructure = this._createMainStructure();
					
					// 3. 헤더 생성
					this._createHeader(mainStructure.mainPanel);
					
					// 4. 탭 네비게이션 생성
					const tabStructure = this._createTabNavigation(mainStructure.mainPanel);
					
					// 5. 개인설정 패널 생성
					this._createPersonalPanel(tabStructure.contentContainer);
					
					// 6. 환경설정 패널 생성
					this._createSettingsPanel(tabStructure.contentContainer);

					// 7. 푸터 생성
					this._createFooter(mainStructure.mainPanel);
					
					// 8. 열기 버튼 생성
					const openButtonWrap = this._createOpenButton();
					
					// 9. DOM에 추가
					container.appendChild(mainStructure.mainWrapper);
					container.appendChild(openButtonWrap);
					
					// 10. 최종 설정
					this._finalizeSetup(tabStructure.tabListContainer);
					
					// 11. localStorage에서 패널 상태 확인 및 복원
					this._restorePanelState();
				} catch (e) {
					this._log('error', 'generateHTMLElements error', e);
				}
			}

			// ========== TAB CONTENT        ==========
			/**
			 * Sets up tab navigation and selection functionality (탭 탐색 및 선택 기능을 설정합니다)
			 * @returns {void}
			 * @description Configures click events, keyboard navigation (arrow keys), and activation events for tabs
			 *              (탭의 클릭 이벤트, 키보드 탐색(화살표 키) 및 활성화 이벤트를 구성합니다)
			 * @example
			 * // Setup tabs after HTML generation (HTML 생성 후 탭 설정)
			 * this.setupTabs();
			 */
			setupTabs() {
				// 호스트 페이지의 ARIA 탭을 하이재킹하지 않도록 플러그인 컨테이너 내부로 검색 범위 제한
				const root = this.container || document.getElementById(Constants.ELEMENT_IDS.MAIN_WRAP);
				if (!root) return;
				const tabs = root.querySelectorAll('[role="tab"]');
				const panels = root.querySelectorAll('[role="tabpanel"]');

				// Tab click events (탭 클릭 이벤트)
				tabs.forEach((tab, index) => {
					// 언어 변경 등으로 재호출될 때 리스너 중복 등록 방지
					if (tab.dataset.watTabBound === 'true') return;
					tab.dataset.watTabBound = 'true';

					tab.addEventListener('click', () => {
						this.activateTab(tabs, panels, tab);
					});

					// 키보드 탐색(화살표) 및 선택(Enter/Space) — 단일 리스너로 통합
					tab.addEventListener('keydown', (e) => {
						if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
							const newIndex = e.key === 'ArrowRight'
								? (index + 1) % tabs.length
								: (index - 1 + tabs.length) % tabs.length;
							tabs[newIndex].focus();
						} else if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault(); // Space로 인한 페이지 스크롤 방지
							this.activateTab(tabs, panels, tab);
						}
					});
				});
			}

			/**
			 * Activates the initial tab when the plugin loads (플러그인 로드 시 초기 탭을 활성화합니다)
			 * @returns {void}
			 * @description Sets the first tab as active by default, with support for URL hash-based activation
			 *              (기본적으로 첫 번째 탭을 활성화하며, URL 해시 기반 활성화를 지원합니다)
			 * @example
			 * // Activate initial tab (초기 탭 활성화)
			 * this.activateInitialTab();
			 */
			activateInitialTab() {
				const root = this.container || document.getElementById(Constants.ELEMENT_IDS.MAIN_WRAP);
				if (!root) return;
				const tabs = root.querySelectorAll('[role="tab"]');
				const panels = root.querySelectorAll('[role="tabpanel"]');

				// URL에 해시가 있으면 해당 탭을 활성화
				//const hash = window.location.hash.substring(1);
				//const initialTab = hash ? document.getElementById(hash) : tabs[0];
				const initialTab = tabs[0];

				if (initialTab) {
					this.activateTab(tabs, panels, initialTab);
				}
			}

			/**
			 * Activates a specific tab and deactivates others (특정 탭을 활성화하고 다른 탭들을 비활성화합니다)
			 * @param {NodeList} tabs - Collection of all tab elements (모든 탭 요소들의 컬렉션)
			 * @param {NodeList} panels - Collection of all tab panel elements (모든 탭 패널 요소들의 컬렉션)
			 * @param {HTMLElement} selectedTab - The tab element to activate (활성화할 탭 요소)
			 * @returns {void}
			 * @description Updates ARIA attributes and visibility states for accessibility compliance
			 *              (접근성 준수를 위해 ARIA 속성과 가시성 상태를 업데이트합니다)
			 * @example
			 * // Activate a specific tab (특정 탭 활성화)
			 * this.activateTab(tabs, panels, selectedTab);
			 */
			activateTab(tabs, panels, selectedTab) {
				tabs.forEach(tab => {
					const isSelected = tab === selectedTab;
					tab.setAttribute('aria-selected', isSelected);
					tab.setAttribute('tabindex', isSelected ? '0' : '-1');
				});

				panels.forEach(panel => {
					panel.hidden = panel.getAttribute('aria-labelledby') !== selectedTab.id;
					if (panel.hidden) {
						panel.style.display = 'none';
					} else {
						panel.style.display = 'block';
					}
				});
			}


			/**
			 * Toggles panel visibility between settings and options (설정과 옵션 패널 간의 가시성을 토글합니다)
			 * @param {boolean} [action_hidden] - Whether to hide the panel, auto-toggle if undefined (패널을 숨길지 여부, undefined면 자동 토글)
			 * @returns {void}
			 * @description Switches between settings panel and options panel with proper ARIA states
			 *              (적절한 ARIA 상태로 설정 패널과 옵션 패널 간을 전환합니다)
			 * @example
			 * // Toggle panel visibility (패널 가시성 토글)
			 * this.togglePanel();
			 * 
			 * // Force hide panel (패널 강제 숨김)
			 * this.togglePanel(true);
			 */
			togglePanel(action_hidden) {
				const settingsPanel = document.getElementById(Constants.ELEMENT_IDS.PANEL_SET);
				const optionsPanel = document.getElementById(Constants.ELEMENT_IDS.PANEL_OPT);
				const settingsButton = document.getElementById(Constants.ELEMENT_IDS.BTN_SET);
				if (!settingsPanel || !optionsPanel || !settingsButton) {
					console.warn('[WAT] togglePanel: 패널 요소를 찾을 수 없습니다.');
					return;
				}
				const isHidden = settingsPanel.hidden;
				action_hidden = action_hidden === undefined ? !isHidden : action_hidden;
				settingsPanel.hidden = action_hidden;
				optionsPanel.hidden = !action_hidden;
				settingsButton.setAttribute('aria-expanded', !action_hidden ? 'true' : 'false');
				settingsButton.setAttribute('aria-label', !action_hidden ? this.getLocalizedText('command.close') : this.getLocalizedText('command.open'));
				settingsButton.setAttribute('aria-pressed', !action_hidden ? 'true' : 'false');
			}

			/**
			 * Updates the view mode of the accessibility tool (접근성 도구의 뷰 모드를 업데이트합니다)
			 * @param {string|boolean} req_viewMode - Requested view mode ('icon' or 'list') (요청된 뷰 모드)
			 * @returns {void}
			 * @description Changes between icon mode and list mode, updates data attributes and saves preferences
			 *              (아이콘 모드와 리스트 모드 간을 변경하고, 데이터 속성을 업데이트하며 환경설정을 저장합니다)
			 * @example
			 * // Switch to icon mode (아이콘 모드로 전환)
			 * this.updateViewMode('icon');
			 * 
			 * // Switch to list mode (리스트 모드로 전환)
			 * this.updateViewMode('list');
			 */
			updateViewMode(req_viewMode) {
				const viewModeStr = req_viewMode.toString().toLowerCase();
				document.documentElement.dataset['watViewmode'] = viewModeStr;
				//localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, {viewMode: viewModeStr});
				this.savePreferences();
			}

			// ========== UI SETTINGS PANEL (PanelBuilder 위임) ==========
			// 패널 UI 항목 생성 클러스터는 src/wat/PanelBuilder.js로 추출됨 (Phase 6-6).
			// 개인 옵션 18종의 개별 createXXXSettings는 PanelBuilder.OPTION_DEFS
			// 데이터 테이블 + buildOption 팩토리로 축약되었고, 아래 래퍼는 공개 API 호환용.

			/**
			 * PanelBuilder 지연 접근자 — 인스턴스에 아직 없으면 즉석 생성
			 * (prototype 단독 호출 테스트 패턴에서도 동작)
			 * @private
			 * @returns {PanelBuilder} PanelBuilder 인스턴스
			 */
			_getPanelBuilder() {
				if (!this.panelBuilder) {
					this.panelBuilder = new PanelBuilder(this);
				}
				return this.panelBuilder;
			}

			/**
			 * 설정 패널에 프로필 설정 섹션을 생성합니다 (PanelBuilder 위임)
			 * @param {HTMLElement} container - 프로필 설정을 추가할 컨테이너 요소
			 * @returns {void}
			 */
			createProfileSettings(container) {
				return this._getPanelBuilder().createProfileSettings(container);
			}

			/**
			 * 위치·뷰 모드·언어·저장 옵션을 포함한 도구 설정 섹션을 생성합니다 (PanelBuilder 위임)
			 * @param {HTMLElement} container - 도구 설정을 추가할 컨테이너 요소
			 * @returns {void}
			 */
			createToolsSettings(container) {
				return this._getPanelBuilder().createToolsSettings(container);
			}

			/**
			 * 지정된 타입과 옵션으로 일반적인 설정 항목을 생성합니다 (PanelBuilder 위임)
			 * @param {string} itemType - 입력 요소의 타입 ('radio', 'checkbox', 'button' 등)
			 * @param {string} titleText - 설정 항목의 제목 텍스트
			 * @param {string} optionName - 폼 요소의 name 속성
			 * @param {Array<Object>} optionItems - 옵션 설정 배열
			 * @returns {HTMLLIElement} 설정 UI가 포함된 리스트 아이템 요소
			 */
			createSettingsItem(itemType, titleText, optionName, optionItems) {
				return this._getPanelBuilder().createSettingsItem(itemType, titleText, optionName, optionItems);
			}

			// 개인 옵션 팩토리 18종 — PanelBuilder 데이터 테이블 기반 생성으로 위임
			createFontSizeSettings() { return this._getPanelBuilder().buildOption('fontSize'); }
			createFontFamilySettings() { return this._getPanelBuilder().buildOption('fontFamily'); }
			createScreenScaleSettings() { return this._getPanelBuilder().buildOption('screenScale'); }
			createTxtAlignSettings() { return this._getPanelBuilder().buildOption('txtAlign'); }
			createLetterSpacingSettings() { return this._getPanelBuilder().buildOption('letterSpacing'); }
			createLineHeightSettings() { return this._getPanelBuilder().buildOption('lineHeight'); }
			createColorThemeSettings() { return this._getPanelBuilder().buildOption('colorTheme'); }
			createSaturationSettings() { return this._getPanelBuilder().buildOption('saturation'); }
			createReadGuideSettings() { return this._getPanelBuilder().buildOption('readGuide'); }
			createImgDisplayModeSettings() { return this._getPanelBuilder().buildOption('imgDisplayMode'); }
			createMediaStopSettings() { return this._getPanelBuilder().buildOption('mediaStop'); }
			createMediaMuteSettings() { return this._getPanelBuilder().buildOption('mediaMute'); }
			createStopAniSettings() { return this._getPanelBuilder().buildOption('stopAni'); }
			createPageScrollSettings() { return this._getPanelBuilder().buildOption('pageScroll'); }
			createTTSSettings() { return this._getPanelBuilder().buildOption('tts'); }
			createSTTSettings() { return this._getPanelBuilder().buildOption('stt'); }
			createDictionSettings() { return this._getPanelBuilder().buildOption('diction'); }
			createPageStructureSettings() { return this._getPanelBuilder().buildOption('pageStructure'); }

			// ========== SETTINGS PERSISTENCE (SettingsApplier 위임) ==========
			// 설정 저장/복원/내보내기·가져오기/프로필 적용 클러스터는
			// src/wat/SettingsApplier.js로 추출됨 (Phase 6-7). 아래 래퍼는 공개 API
			// 호환용이며, 인스턴스에 SettingsApplier가 없으면 즉석 생성한다
			// (플레인 객체 스텁으로 prototype 메서드를 직접 호출하는 테스트 패턴 호환).

			/**
			 * 현재 선택된 접근성 프로필의 이름을 가져옵니다 (SettingsApplier 위임)
			 * @returns {string|null} 선택된 프로필명 또는 null
			 */
			getSelectedProfileName() {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.getSelectedProfileName();
			}

			/**
			 * 지정된 접근성 프로필의 설정을 적용합니다 (SettingsApplier 위임)
			 * @param {string} profileName - 적용할 프로필명 ('lowVision', 'colorBlindness', 'dyslexia')
			 * @returns {void}
			 */
			applyProfileSettings(profileName) {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.applyProfileSettings(profileName);
			}

			/**
			 * 지정된 프로필을 켜거나 끕니다 (SettingsApplier 위임)
			 * @param {string} profile - 토글할 프로필명
			 * @param {HTMLElement} targetToggle - 클릭된 토글 버튼 요소
			 * @returns {void}
			 */
			toggleProfile(profile, targetToggle) {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.toggleProfile(profile, targetToggle);
			}

			/**
			 * 모든 접근성 설정을 기본값으로 리셋합니다 (SettingsApplier 위임)
			 * @returns {void}
			 */
			resetWatSettings() {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.resetWatSettings();
			}

			/**
			 * 특정 접근성 프로필의 설정을 리셋합니다 (SettingsApplier 위임)
			 * @param {string} profileId - 프로필 식별자
			 * @returns {void}
			 */
			resetProfileSettings(profileId) {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.resetProfileSettings(profileId);
			}

			/**
			 * 현재 접근성 설정을 localStorage에 저장합니다 (SettingsApplier 위임)
			 * @returns {void}
			 */
			savePreferences() {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.savePreferences();
			}

			/**
			 * 저장된 접근성 설정을 JSON 파일로 내보냅니다 (SettingsApplier 위임)
			 * @returns {void}
			 */
			exportSettings() {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.exportSettings();
			}

			/**
			 * 파일 선택 대화상자를 열어 설정 JSON을 가져옵니다 (SettingsApplier 위임)
			 * @private
			 */
			_promptImportSettings() {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.promptImportSettings();
			}

			/**
			 * 내보낸 설정 JSON을 검증 후 적용합니다 (SettingsApplier 위임)
			 * @param {string} jsonText - exportSettings()가 생성한 JSON 문자열
			 * @returns {boolean} 적용 성공 여부
			 */
			importSettings(jsonText) {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.importSettings(jsonText);
			}

			/**
			 * localStorage에서 접근성 설정을 로드합니다 (SettingsApplier 위임)
			 * @returns {Object} 기본값으로 대체된 로드된 설정 객체
			 */
			loadPreferences() {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.loadPreferences();
			}

			/**
			 * 특정 설정을 실제 페이지 콘텐츠에 적용합니다 (SettingsApplier 위임)
			 * @param {string} settingKey - 설정 키
			 * @param {string} settingValue - 설정 값
			 * @private
			 */
			_applySettingToPage(settingKey, settingValue) {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.applySettingToPage(settingKey, settingValue);
			}

			/**
			 * 플러그인 시작 시 초기 환경설정을 적용합니다 (SettingsApplier 위임)
			 * @returns {void}
			 */
			setInitialPreferences() {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.setInitialPreferences();
			}

			/**
			 * 저장된 프로필 선택 상태를 토글 UI에 복원합니다 (SettingsApplier 위임)
			 * @private
			 */
			_restoreSelectedProfileUI() {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.restoreSelectedProfileUI();
			}

			/**
			 * 개별 UI 컨트롤을 현재 설정값과 동기화합니다 (SettingsApplier 위임)
			 * @param {Object} settings - UI 컨트롤과 동기화할 설정 객체
			 * @private
			 */
			_syncIndividualSettingsUI(settings) {
				if (!this.settingsApplier) this.settingsApplier = new SettingsApplier(this);
				return this.settingsApplier.syncIndividualSettingsUI(settings);
			}

			/**
			 * Sets up global event listeners using event delegation (이벤트 위임을 사용하여 전역 이벤트 리스너를 설정합니다)
			 * @returns {void}
			 * @description Configures global event listeners for radio changes, keyboard shortcuts, and mouse interactions
			 *              (라디오 변경, 키보드 단축키, 마우스 상호작용을 위한 전역 이벤트 리스너를 구성합니다)
			 * @example
			 * // Setup event listeners after plugin initialization (플러그인 초기화 후 이벤트 리스너 설정)
			 * this.setEventListeners();
			 */
			setEventListeners() {
				// 전역 이벤트 리스너들 (이벤트 위임 활용)
				this._addGlobalEventListener('change', 'radioChange');
				this._addGlobalEventListener('click', 'buttonClick');
				this._addGlobalEventListener('keydown', 'keyDown');
				this._addGlobalEventListener('dblclick', 'doubleClick');
				this._addGlobalEventListener('mouseup', 'mouseUp');
				
				// 특정 요소에 대한 이벤트 리스너
				this._setupSpecificEventListeners();
			}

			/**
			 * Sets up specific event listeners for individual elements (개별 요소에 대한 특정 이벤트 리스너를 설정합니다)
			 * @returns {void}
			 * @description Attaches event listeners to specific buttons and controls that require direct handling
			 *              (직접 처리가 필요한 특정 버튼과 컨트롤에 이벤트 리스너를 연결합니다)
			 * @private
			 */
			_setupSpecificEventListeners() {
				// 글로벌 클릭 이벤트 리스너가 있으므로 개별 버튼 리스너는 제거
				// 체크박스 리스너들만 유지
				this._setupCheckboxListeners();
			}

			/**
			 * Sets up event listeners for checkbox elements (체크박스 요소의 이벤트 리스너를 설정합니다)
			 * @returns {void}
			 * @description Configures change and keydown event listeners for checkbox controls with data attributes
			 *              (데이터 속성을 가진 체크박스 컨트롤의 변경 및 키다운 이벤트 리스너를 구성합니다)
			 * @private
			 */
			_setupCheckboxListeners() {
				const checkboxes = [
					{ selector: '#wat-checkbox-stopAni', dataAttr: 'stopAni' },
					{ selector: '#wat-checkbox-mediaStop', dataAttr: 'mediaStop' },
					{ selector: '#wat-checkbox-mediaMute', dataAttr: 'mediaMute' },
					{ selector: '#wat-checkbox-diction', dataAttr: 'diction' }
				];
				
				checkboxes.forEach(({ selector, dataAttr }) => {
					const element = document.querySelector(selector);
					if (element) {
						// 체크박스에 data-attr 속성 추가 (핸들러에서 참조하기 위해)
						element.setAttribute('data-attr', dataAttr);
						
						// 이벤트 리스너는 전역 핸들러에서 처리되므로 여기서는 속성만 설정
					}
				});
			}

			/**
			 * Handles radio button selection and applies corresponding settings (라디오 버튼 선택을 처리하고 해당 설정을 적용합니다)
			 * @param {Object|HTMLElement} targetData - Radio button data object or DOM element (라디오 버튼 데이터 객체 또는 DOM 요소)
			 * @param {string} targetData.name - Name attribute of the radio button (라디오 버튼의 name 속성)
			 * @param {string} targetData.value - Value of the selected radio button (선택된 라디오 버튼의 값)
			 * @returns {void}
			 * @throws {Error} Throws error if target data is invalid (대상 데이터가 유효하지 않으면 에러 발생)
			 * @description Updates UI state, applies settings based on radio selection, and saves preferences
			 *              (UI 상태를 업데이트하고, 라디오 선택에 따라 설정을 적용하며, 환경설정을 저장합니다)
			 * @example
			 * // Handle radio selection programmatically (프로그래밍 방식으로 라디오 선택 처리)
			 * this.setRadioListeners({ name: 'fontSize', value: 'size-1p5x' });
			 * 
			 * // Handle radio element directly (라디오 요소 직접 처리)
			 * this.setRadioListeners(radioElement);
			 */
			setRadioListeners(targetData) {
				// ****************** Check target data .Start ******************
				try {
					// 입력 검증 강화
					if (!this._validateRadioTarget(targetData)) {
						this._handleError('setRadioListeners', new Error('Invalid target data provided'), { targetData });
						return;
					}
					
					// DOM 요소인 경우 name과 value 추출
					let attribute, value;
					if (targetData instanceof Element) {
						attribute = targetData.name;
						value = targetData.value;
					} else if (typeof targetData === 'object' && targetData !== null) {
						attribute = targetData.name;
						value = targetData.value;
					} else {
						this._handleError('setRadioListeners', new Error('Invalid targetData format'), { targetData });
						return;
					}
					
					// 환경설정용 radio는 wat-set-item-type-radio, 개인설정용은 wat-item-type-radio
					const controlAttrs = ['viewMode', 'toolPosition'];
					const classSelector = controlAttrs.includes(attribute) ? '.wat-set-item-type-radio' : '.wat-item-type-radio';

					// 제어 속성들은 데이터셋만 설정하고 UI 업데이트는 별도 처리
					if (controlAttrs.includes(attribute)) {
						if (attribute === 'viewMode') {
							document.documentElement.dataset.watViewmode = value;
						} else if (attribute === 'toolPosition') {
							document.documentElement.dataset.watPosition = value;
						}
						// viewMode와 toolPosition에 대한 라디오 버튼 체크 설정
						const radioElement = document.querySelector(`${classSelector}[name="${attribute}"][value="${value}"]`);
						if (radioElement) {
							radioElement.checked = true;
						}
						return;
					}
					
					let elm_target = targetData;
					// ****************** Check target data .End   ******************

					// ******************** Set target element .Start ********************
					if (targetData instanceof Element) {
						// DOM Element // Nothing to do
					} else if (typeof targetData === 'object' && targetData !== null) {
						elm_target = document.querySelector(`${classSelector}[name="${attribute}"][value="${value}"]`);
						if (elm_target === null) {
							console.warn(`Element not found: ${classSelector}[name="${attribute}"][value="${value}"]`);
							return;
						}
					} else {
						// Invalid target
						return;
					}
					
					// null 체크 추가
					if (!elm_target) {
						console.warn(`Target element is null for attribute: ${attribute}, value: ${value}`);
						return;
					}
					
					// elm_parent_li가 null인 경우 처리
					if (!elm_target.closest('.opt_item')) {
						console.warn(`Parent .opt_item not found for element with attribute: ${attribute}, value: ${value}`);
						// 일단 데이터셋만 설정하고 UI 업데이트는 스킵
						document.documentElement.dataset[attribute] = value;
						return;
					}

					SettingsApplier.syncRadioSelectionUI(elm_target, value);
					// ******************** Set target element .End   ********************

					// ******************** Set data attribute .Start ********************
					if (attribute === 'fontFamily') {
						this.changeFontFamily(value);
					} else if (attribute === 'screenScale') {
						this.changeScreenScale(value);
					} else if (attribute === 'fontSize') {
						this.changeFontSize(value);
					} else if (attribute === 'lineHeight') {
						this.changeLineHeight(value);
					} else if (attribute === 'txtAlign') {
						this.changeTextAlign(value);
					} else if (attribute === 'letterSpacing') {
						this.changeLetterSpacing(value);
					} else if (attribute === 'colorTheme') {
						this.changeColorTheme(value);
					} else if (attribute === 'saturation') {
						this.changeSaturation(value);
					} else if (attribute === 'changeTTSSpeed') {
						this.state.set('plugin.readingSpeed', parseFloat(value));
						this.savePreferences(); // TTS Speed는 별도 저장 필요
					} else if (attribute === 'readGuide') {
						this.changeReadGuide(value);
					} else if (attribute === 'imgDisplayMode') {
						this.changeImgDisplayMode(value);
					}
					// ******************** Set data attribute .End   ********************

					// 성공적으로 완료된 경우 디버그 로그
					if (WAT_DEBUG_ENABLED) {
						console.log(`Radio setting applied successfully: ${attribute} = ${value}`);
					}
					
				} catch (error) {
					this._handleError('setRadioListeners', error, { targetData });
				}
			}

			/**
			 * Sets up change and keyboard event listeners for checkbox elements (체크박스 요소의 변경 및 키보드 이벤트 리스너를 설정합니다)
			 * @param {Array<Object>} checkboxes - Array of checkbox configuration objects (체크박스 설정 객체 배열)
			 * @param {string} checkboxes[].selector - CSS selector for the checkbox element (체크박스 요소의 CSS 선택자)
			 * @param {string} checkboxes[].dataAttr - Data attribute name to toggle (토글할 데이터 속성명)
			 * @returns {void}
			 * @description Configures change events for checkbox state management and Enter key support
			 *              (체크박스 상태 관리를 위한 변경 이벤트와 Enter 키 지원을 구성합니다)
			 * @example
			 * // Setup checkbox listeners (체크박스 리스너 설정)
			 * this.setCheckboxListeners([
			 *   { selector: '#mediaStop', dataAttr: 'mediaStop' },
			 *   { selector: '#mediaMute', dataAttr: 'mediaMute' }
			 * ]);
			 */
			setCheckboxListeners(checkboxes) {
				checkboxes.forEach(({ selector, dataAttr }) => {
					const element = document.querySelector(selector);
					if (element) {
						// change 이벤트로 기본적인 상태 변경 감지
						element.addEventListener('change', (e) => {
							this.toggleDataAttribute(dataAttr, e.target.checked);

							const isActive = e.target.checked;
							//const label = e.target.nextElementSibling;
							const elm_state = e.target.parentElement.querySelector('.switch-state');
							const label = elm_state.getAttribute('data-stateText-' + (isActive ? 'on' : 'off'));
							elm_state.textContent = label;

							if (dataAttr === 'imgTextConvert') {
								this.toggleImgTextConversion(isActive);
							}

							if (dataAttr === 'mediaStop') {
								this.toggleMediaStop(e.target.checked);
							} else if (dataAttr === 'mediaMute') {
								this.toggleMediaMute(e.target.checked);
							}

							if (dataAttr === 'diction') {
								//this.toggleMediaStop(e.target.checked);
								this.toggleDiction();
							}
						});
			
						// keydown 이벤트로 Enter 키도 반응하게 설정
						element.addEventListener('keydown', (e) => {
							if (e.key === 'Enter') {
								e.preventDefault(); // 기본 동작을 방지
								// 체크 상태를 반전시킴
								element.checked = !element.checked;
			
								// change 이벤트 트리거 (상태 반영)
								element.dispatchEvent(new Event('change', { bubbles: true }));
							}
						});
					}
				});
			}

			/**
			 * Gets the target index for radio button navigation (라디오 버튼 탐색을 위한 대상 인덱스를 가져옵니다)
			 * @param {HTMLElement} targetWrap - Container element wrapping the radio buttons (라디오 버튼을 감싸는 컨테이너 요소)
			 * @param {string} direction - Navigation direction ('prev' or 'next') (탐색 방향)
			 * @returns {number} Index of the target radio button (대상 라디오 버튼의 인덱스)
			 * @description Calculates the next/previous radio button index, skipping disabled buttons
			 *              (비활성화된 버튼을 건너뛰며 다음/이전 라디오 버튼 인덱스를 계산합니다)
			 * @example
			 * // Get next radio button index (다음 라디오 버튼 인덱스 가져오기)
			 * const nextIndex = this.getRadioTargetIndex(containerElement, 'next');
			 */
			getRadioTargetIndex(targetWrap, direction) {
				const radios = targetWrap.querySelectorAll('.setCont input[type="radio"]');
				// 라디오가 없으면 % 0 연산으로 NaN이 반환되므로 조기 반환
				if (radios.length === 0) {
					return 0;
				}
				let currentIndex = -1;

				if (WAT_DEBUG_ENABLED) {
					console.log(`\n=== getRadioTargetIndex ===`);
					console.log(`Direction: ${direction}`);
					console.log(`Total radios: ${radios.length}`);
				}

				// Get Current Index
				radios.forEach((radio, index) => {
					if (radio.checked) {
						currentIndex = index;
						if (WAT_DEBUG_ENABLED) {
							console.log(`Current checked radio: ${index} (value: ${radio.value})`);
						}
					}
				});

				// 현재 선택된 라디오가 없는 경우 첫 번째로 설정
				if (currentIndex === -1) {
					currentIndex = 0;
					if (WAT_DEBUG_ENABLED) {
						console.log(`No radio checked, defaulting to index 0`);
					}
				}

				let targetIndex = currentIndex;
				const totalRadios = radios.length;

				if (direction === 'prev') {
					// 이전 버튼: 현재 인덱스에서 1 감소, 0보다 작으면 마지막으로
					targetIndex = (currentIndex - 1 + totalRadios) % totalRadios;
					
					// 비활성화된 버튼 건너뛰기 (최대 전체 개수만큼 시도)
					let attempts = 0;
					while (radios[targetIndex] && radios[targetIndex].disabled && attempts < totalRadios) {
						targetIndex = (targetIndex - 1 + totalRadios) % totalRadios;
						attempts++;
					}
					
				} else if (direction === 'next') {
					// 다음 버튼: 현재 인덱스에서 1 증가, 마지막보다 크면 첫 번째로
					targetIndex = (currentIndex + 1) % totalRadios;
					
					if (WAT_DEBUG_ENABLED) {
						console.log(`Next calculation: (${currentIndex} + 1) % ${totalRadios} = ${targetIndex}`);
					}
					
					// 비활성화된 버튼 건너뛰기 (최대 전체 개수만큼 시도)
					let attempts = 0;
					while (radios[targetIndex] && radios[targetIndex].disabled && attempts < totalRadios) {
						targetIndex = (targetIndex + 1) % totalRadios;
						attempts++;
					}
				}

				// 유효성 검사: 인덱스가 범위를 벗어나면 보정
				if (targetIndex < 0 || targetIndex >= totalRadios) {
					targetIndex = 0;
					if (WAT_DEBUG_ENABLED) {
						console.log(`Index out of bounds, corrected to 0`);
					}
				}

				if (WAT_DEBUG_ENABLED) {
					console.log(`Final result: current=${currentIndex}, target=${targetIndex}`);
					if (radios[targetIndex]) {
						console.log(`Target radio value: ${radios[targetIndex].value}`);
					}
				}

				return targetIndex;
			}

			/**
			 * Handles Text-to-Speech button interactions (텍스트 음성 변환 버튼 상호작용을 처리합니다)
			 * @param {HTMLElement} button - TTS button element that was clicked (클릭된 TTS 버튼 요소)
			 * @returns {void}
			 * @description Processes different TTS button actions like toggle, navigation, and focus detection
			 *              (토글, 탐색, 포커스 감지와 같은 다양한 TTS 버튼 동작을 처리합니다)
			 * @private
			 */
			_handleTTSButtons(button) {
				const buttonId = button.id;
				
				if (buttonId === 'wat-button-tts_toggle') {
					// 자동 TTS 토글
					this.ttsManager.toggleAutoTTS();
				} else if (buttonId === 'wat-button-tts_next') {
					// 자동 TTS 다음 요소
					this.ttsManager.navigateNext();
				} else if (buttonId === 'wat-button-tts_prev') {
					// 자동 TTS 이전 요소
					this.ttsManager.navigatePrevious();
				} else if (buttonId === 'wat-button-tts_focus_toggle') {
					// 포커스 TTS 토글
					this.ttsManager.toggleFocusTTS();
				}
			}

			/**
			 * Handles page scroll button interactions (페이지 스크롤 버튼 상호작용을 처리합니다)
			 * @param {HTMLElement} button - Page scroll button element that was clicked (클릭된 페이지 스크롤 버튼 요소)
			 * @returns {void}
			 * @description Processes different scroll button actions like toggle and directional scrolling
			 *              (토글과 방향 스크롤링과 같은 다양한 스크롤 버튼 동작을 처리합니다)
			 * @private
			 */
			_handlePageScrollButtons(button) {
				const buttonId = button.id;
				
				if (buttonId === 'wat-button-pageScroll_toggle') {
					this.togglePageScroll();
				} else if (buttonId === 'wat-button-pageScroll_up') {
					this.scrollPageUp();
				} else if (buttonId === 'wat-button-pageScroll_down') {
					this.scrollPageDown();
				}
			}


			/**
			 * Creates and tracks various types of observers (다양한 타입의 옵저버를 생성하고 추적합니다)
			 * @param {string} type - Type of observer to create ('intersection', 'mutation', 'resize') (생성할 옵저버 타입)
			 * @param {Function} callback - Callback function to execute when observer triggers (옵저버 트리거 시 실행할 콜백 함수)
			 * @param {Object} [options={}] - Observer-specific options (옵저버별 특정 옵션)
			 * @returns {Observer|null} Created observer instance or null if type is unknown (생성된 옵저버 인스턴스 또는 알 수 없는 타입인 경우 null)
			 * @description Creates the appropriate observer type and stores it for later cleanup
			 *              (적절한 옵저버 타입을 생성하고 나중에 정리하기 위해 저장합니다)
			 * @example
			 * // Create intersection observer (교차 옵저버 생성)
			 * const observer = this._createObserver('intersection', (entries) => {
			 *   console.log('Intersection detected');
			 * }, { threshold: 0.5 });
			 * 
			 * // Create mutation observer (뮤테이션 옵저버 생성)
			 * const mutationObserver = this._createObserver('mutation', (mutations) => {
			 *   console.log('DOM mutations detected');
			 * });
			 * @private
			 */
			_createObserver(type, callback, options = {}) {
				try {
					// 입력 검증
					if (!type || typeof type !== 'string') {
						throw new Error('Observer type must be a non-empty string');
					}
					
					if (!callback || typeof callback !== 'function') {
						throw new Error('Callback must be a function');
					}
					
					let observer;
					
					switch (type) {
						case 'intersection':
							if (!window.IntersectionObserver) {
								throw new Error('IntersectionObserver is not supported in this browser');
							}
							observer = new IntersectionObserver(callback, options);
							break;
						case 'mutation':
							if (!window.MutationObserver) {
								throw new Error('MutationObserver is not supported in this browser');
							}
							observer = new MutationObserver(callback);
							break;
						case 'resize':
							if (!window.ResizeObserver) {
								throw new Error('ResizeObserver is not supported in this browser');
							}
							observer = new ResizeObserver(callback);
							break;
						default:
							throw new Error(`Unknown observer type: ${type}`);
					}
					
					// Observer Map 초기화
					if (!this._observers) {
						this._observers = new Map();
					}

					// 같은 타입을 재생성할 때 이전 옵저버가 disconnect 없이 유실되어 계속 동작하는 누수 방지
					const existingObserver = this._observers.get(type);
					if (existingObserver) {
						try {
							existingObserver.disconnect();
						} catch (e) {
							// disconnect 실패는 무시
						}
					}

					this._observers.set(type, observer);
					
					if (WAT_DEBUG_ENABLED) {
						console.log(`Observer created successfully: ${type}`);
					}
					
					return observer;
					
				} catch (error) {
					console.error('Failed to create observer:', error);
					return null;
				}
			}

			/**
			 * Disconnects and removes a specific observer by type (타입별로 특정 옵저버를 연결 해제하고 제거합니다)
			 * @param {string} type - Type of observer to disconnect (연결 해제할 옵저버 타입)
			 * @returns {boolean} True if observer was successfully disconnected, false otherwise (옵저버가 성공적으로 연결 해제되었으면 true, 그렇지 않으면 false)
			 * @description Safely disconnects the observer and removes it from the tracking map
			 *              (옵저버를 안전하게 연결 해제하고 추적 맵에서 제거합니다)
			 * @example
			 * // Disconnect intersection observer (교차 옵저버 연결 해제)
			 * const success = this._disconnectObserver('intersection');
			 * 
			 * // Disconnect mutation observer (뮤테이션 옵저버 연결 해제)
			 * this._disconnectObserver('mutation');
			 * @private
			 */
			_disconnectObserver(type) {
				try {
					if (!type || typeof type !== 'string') {
						throw new Error('Observer type must be a non-empty string');
					}
					
					if (!this._observers) {
						if (WAT_DEBUG_ENABLED) {
							console.warn('No observers map found');
						}
						return false;
					}
					
					const observer = this._observers.get(type);
					if (observer) {
						if (typeof observer.disconnect === 'function') {
							observer.disconnect();
							this._observers.delete(type);
							
							if (WAT_DEBUG_ENABLED) {
								console.log(`Observer disconnected successfully: ${type}`);
							}
							
							return true;
						} else {
							throw new Error(`Observer ${type} does not have a disconnect method`);
						}
					} else {
						if (WAT_DEBUG_ENABLED) {
							console.warn(`Observer not found: ${type}`);
						}
						return false;
					}
				} catch (error) {
					console.error(`Failed to disconnect observer ${type}:`, error);
					return false;
				}
			}

			/**
			 * Disconnects and removes all tracked observers (추적된 모든 옵저버를 연결 해제하고 제거합니다)
			 * @returns {number} Number of observers successfully disconnected (성공적으로 연결 해제된 옵저버 수)
			 * @description Cleans up all observers at once, typically called during plugin cleanup
			 *              (일반적으로 플러그인 정리 시 호출되어 모든 옵저버를 한 번에 정리합니다)
			 * @example
			 * // Cleanup all observers during plugin shutdown (플러그인 종료 시 모든 옵저버 정리)
			 * const disconnectedCount = this._disconnectAllObservers();
			 * console.log(`Disconnected ${disconnectedCount} observers`);
			 * @private
			 */
			_disconnectAllObservers() {
				let disconnectedCount = 0;
				
				try {
					if (!this._observers) {
						if (WAT_DEBUG_ENABLED) {
							console.warn('No observers map found for cleanup');
						}
						return 0;
					}
					
					this._observers.forEach((observer, type) => {
						try {
							if (observer && typeof observer.disconnect === 'function') {
								observer.disconnect();
								disconnectedCount++;
								
								if (WAT_DEBUG_ENABLED) {
									console.log(`Observer disconnected: ${type}`);
								}
							} else {
								console.warn(`Invalid observer found for type: ${type}`);
							}
						} catch (error) {
							console.error(`Failed to disconnect observer ${type}:`, error);
						}
					});
					
					this._observers.clear();
					
					if (WAT_DEBUG_ENABLED) {
						console.log(`Successfully disconnected ${disconnectedCount} observers`);
					}
					
				} catch (error) {
					console.error('Failed to disconnect all observers:', error);
				}
				
				return disconnectedCount;
			}


			/**
			 * Marks elements with dynamic styling classes for performance optimization (성능 최적화를 위해 동적 스타일링 클래스로 요소들을 마킹합니다)
			 * @param {string} [rootSelector='body'] - Root selector for element search (요소 검색을 위한 루트 선택자)
			 * @returns {void}
			 * @description Analyzes DOM elements and marks them with specific classes for font size, letter spacing, line height, and text alignment styling
			 *              (DOM 요소들을 분석하고 폰트 크기, 자간, 줄간격, 텍스트 정렬 스타일링을 위한 특정 클래스로 마킹합니다)
			 * @example
			 * // Mark all body elements for dynamic styling (모든 body 요소를 동적 스타일링으로 마킹)
			 * this.markDynamicStyledElements('body');
			 * 
			 * // Mark specific container elements (특정 컨테이너 요소들 마킹)
			 * this.markDynamicStyledElements('#main-content');
			 */
			markDynamicStyledElements(rootSelector = 'body') {
				if (!this._originalStyleMap) {
					this._originalStyleMap = new WeakMap();
				}
				const styleProps = [
					{ css: 'font-size', className: 'wat-dyn-fontsize', px: true },
					{ css: 'letter-spacing', className: 'wat-dyn-letterspacing', px: true },
					{ css: 'line-height', className: 'wat-dyn-lineheight', px: true },
					{ css: 'text-align', className: 'wat-dyn-textalign', px: false }
				];

				// 제외할 선택자들을 배열로 구성
				const excludeSelectors = [];
				
				// 컨테이너 제외
				if (this.container) {
					excludeSelectors.push(`#${this.container.id}`, `#${this.container.id} *`);
				}
	    
				// 사용자 설정 excludeSelector 추가
				if (this.excludeSelector) {
					// 여러 선택자가 콤마로 구분되어 있을 수 있음
					const userExcludes = this.excludeSelector.split(',').map(s => s.trim());
					userExcludes.forEach(exclude => {
					if (exclude) {
						excludeSelectors.push(exclude, `${exclude} *`);
					}
					});
				}
				
				// wat-exclude 클래스도 제외
				excludeSelectors.push('.wat-exclude', '.wat-exclude *');
				
				// :not() 선택자 구성
				const notSelector = excludeSelectors.length > 0 ? `:not(${excludeSelectors.join('):not(')})` : '';
				
				const selector = `${rootSelector} *${notSelector}`;
				
				if (WAT_DEBUG_ENABLED) console.log('Dynamic styling selector:', selector);

				// computed 스타일 객체를 재사용해 요소당 getComputedStyle 호출을 1회로 축소 (성능)
				function getPxValue(el, prop, computed) {
					const val = computed.getPropertyValue(prop);
					if (!val) return '';
					if (prop === 'line-height' && val === 'normal') return '';
					if (val.endsWith('px')) return parseFloat(val);
					if (val.endsWith('rem')) {
						// rem은 요소가 아닌 문서 루트 폰트 크기 기준
						const rootBase = parseFloat(window.getComputedStyle(el.ownerDocument.documentElement).fontSize) || 16;
						return parseFloat(val) * rootBase;
					}
					if (val.endsWith('em')) {
						const base = parseFloat(computed.fontSize);
						return parseFloat(val) * base;
					}
					return parseFloat(val) || '';
				}

				// 사용자 config 유래 excludeSelector가 유효하지 않은 CSS면 SyntaxError로
				// 동적 스타일링 전체가 죽으므로 try/catch로 방어
				let targetElements;
				try {
					targetElements = document.querySelectorAll(selector);
				} catch (e) {
					console.error('[WAT] excludeSelector 설정이 유효한 CSS 선택자가 아닙니다. 제외 없이 진행합니다:', e.message);
					try {
						targetElements = document.querySelectorAll(`${rootSelector} *`);
					} catch (e2) {
						console.error('[WAT] rootSelector도 유효하지 않아 동적 스타일 마킹을 건너뜁니다:', e2.message);
						return;
					}
				}

				targetElements.forEach(el => {
					// 값싼 검사(빈 텍스트) 먼저 — computed 계산 없이 조기 반환
					if (!el.textContent.trim()) return;

					// computed를 1회만 계산해 제외 판정과 스타일 수집에 재사용 (요소당 getComputedStyle 2회→1회)
					const computed = window.getComputedStyle(el);
					if (this.shouldExcludeElement(el, computed)) {
						return;
					}

					let hasDynamic = false;
					const origStyles = {};

					styleProps.forEach(({ css, className, px }) => {
						const elVal = computed.getPropertyValue(css);

						let value = elVal;
						if (px && value) {
							const pxValue = getPxValue(el, css, computed);
							if (pxValue) value = pxValue;
						}
						origStyles[css] = value;
						el.classList.add('wat-dyn-el', className);
						hasDynamic = true;
					});

					if (hasDynamic) {
						this._originalStyleMap.set(el, origStyles);
					}
				});

				// 마킹 완료 후 캐시 무효화
				this._invalidateCache();
			}

			/**
			 * Determines whether an element should be excluded from dynamic styling (요소가 동적 스타일링에서 제외되어야 하는지 결정합니다)
			 * @param {Element} element - DOM element to check for exclusion (제외 여부를 확인할 DOM 요소)
			 * @returns {boolean} True if element should be excluded, false otherwise (요소가 제외되어야 하면 true, 그렇지 않으면 false)
			 * @description Checks if element is within container, has wat-exclude class, or matches user-defined exclude selectors
			 *              (요소가 컨테이너 내부에 있는지, wat-exclude 클래스를 가지는지, 또는 사용자 정의 제외 선택자와 일치하는지 확인합니다)
			 * @example
			 * // Check if element should be excluded (요소가 제외되어야 하는지 확인)
			 * const shouldExclude = this.shouldExcludeElement(element);
			 * if (!shouldExclude) {
			 *   // Apply styling to element (요소에 스타일링 적용)
			 * }
			 */
			shouldExcludeElement(element, computedStyle = null) {
				try {
					// 입력 검증
					if (!element || !(element instanceof Element)) {
						if (WAT_DEBUG_ENABLED) {
							console.warn('Invalid element provided to shouldExcludeElement');
						}
						return true; // 유효하지 않은 요소는 제외
					}
					
					// 1. 컨테이너 내부 요소 확인
					if (this.container && this.container.contains(element)) {
						return true;
					}
					
					// 2. wat-exclude 클래스 확인
					if (element.classList.contains('wat-exclude') || element.closest('.wat-exclude')) {
						return true;
					}
					
					// 3. 사용자 설정 excludeSelector 확인
					if (this.excludeSelector) {
						try {
							const userExcludes = this.excludeSelector.split(',').map(s => s.trim());
							for (const exclude of userExcludes) {
								if (exclude && (element.matches(exclude) || element.closest(exclude))) {
									return true;
								}
							}
						} catch (error) {
							console.warn('Invalid excludeSelector format:', this.excludeSelector, error);
						}
					}
					
					// 4. 특정 태그나 속성 기반 제외 (추가 안전장치)
					const excludeTags = ['script', 'style', 'link', 'meta', 'title'];
					if (excludeTags.includes(element.tagName.toLowerCase())) {
						return true;
					}
					
					// 5. 숨겨진 요소 제외 (호출자가 계산한 computed 재사용, 없으면 계산)
					const cs = computedStyle || window.getComputedStyle(element);
					if (cs.display === 'none' || cs.visibility === 'hidden') {
						return true;
					}
					
					return false;
					
				} catch (error) {
					console.error('Error in shouldExcludeElement:', error);
					return true; // 에러 발생 시 안전하게 제외
				}
			}

			/**
			 * Loads CSS stylesheet from specified path if not already loaded (지정된 경로에서 CSS 스타일시트를 로드합니다, 이미 로드되지 않은 경우)
			 * @param {string} [path=this.styleCssPath] - Path to CSS file (CSS 파일 경로)
			 * @returns {Promise<boolean>} Promise that resolves to true if loaded successfully, false otherwise (성공적으로 로드되면 true, 그렇지 않으면 false로 resolve되는 Promise)
			 * @description Dynamically injects CSS link element into document head for styling support
			 *              (스타일링 지원을 위해 CSS 링크 요소를 문서 헤드에 동적으로 주입합니다)
			 * @example
			 * // Load default CSS file (기본 CSS 파일 로드)
			 * const success = await this.loadStyleCss();
			 * 
			 * // Load custom CSS file (커스텀 CSS 파일 로드)
			 * await this.loadStyleCss('/path/to/custom.css');
			 */
			async loadStyleCss(path = this.styleCssPath) {
				return new Promise((resolve, reject) => {
					try {
						// 입력 검증
						if (!path || typeof path !== 'string') {
							throw new Error('CSS path must be a non-empty string');
						}
						
						// 이미 로드된 스타일시트 확인
						const existingLink = document.querySelector(`link[href="${path}"]`);
						if (existingLink) {
							if (WAT_DEBUG_ENABLED) {
								console.log(`CSS already loaded: ${path}`);
							}
							// 링크가 존재해도 아직 로딩 중일 수 있음 — sheet가 준비된 경우에만 즉시 성공 처리
							if (existingLink.sheet) {
								resolve(true);
							} else {
								existingLink.addEventListener('load', () => resolve(true), { once: true });
								existingLink.addEventListener('error', () => resolve(false), { once: true });
							}
							return;
						}
						
						// 새 링크 요소 생성
						const link = document.createElement('link');
						link.rel = 'stylesheet';
						link.type = 'text/css';
						link.href = path;
						
						// 로드 완료 이벤트 리스너
						link.onload = () => {
							if (WAT_DEBUG_ENABLED) {
								console.log(`CSS loaded successfully: ${path}`);
							}
							resolve(true);
						};
						
						// 에러 이벤트 리스너
						link.onerror = () => {
							console.error(`Failed to load CSS: ${path}`);
							// 실패한 링크 요소 제거
							if (link.parentNode) {
								link.parentNode.removeChild(link);
							}
							resolve(false);
						};
						
						// 타임아웃 설정 (30초)
						const timeout = setTimeout(() => {
							console.warn(`CSS load timeout: ${path}`);
							if (link.parentNode) {
								link.parentNode.removeChild(link);
							}
							resolve(false);
						}, 30000);
						
						// 로드 완료 또는 에러 시 타임아웃 클리어
						const originalOnload = link.onload;
						const originalOnerror = link.onerror;
						
						link.onload = (...args) => {
							clearTimeout(timeout);
							originalOnload(...args);
						};
						
						link.onerror = (...args) => {
							clearTimeout(timeout);
							originalOnerror(...args);
						};
						
						// 문서 헤드에 추가
						document.head.appendChild(link);
						
					} catch (error) {
						console.error('Error in loadStyleCss:', error);
						reject(error);
					}
				});
			}

			/**
			 * Validates radio target data for consistency and type safety (일관성과 타입 안정성을 위해 라디오 대상 데이터를 검증합니다)
			 * @param {Object|HTMLElement} targetData - Radio button data object or DOM element (라디오 버튼 데이터 객체 또는 DOM 요소)
			 * @returns {boolean} True if target data is valid, false otherwise (대상 데이터가 유효하면 true, 그렇지 않으면 false)
			 * @description Performs comprehensive validation of radio button target data
			 *              (라디오 버튼 대상 데이터의 포괄적 검증을 수행합니다)
			 * @example
			 * // Validate radio element (라디오 요소 검증)
			 * const isValid = this._validateRadioTarget(radioElement);
			 * 
			 * // Validate radio data object (라디오 데이터 객체 검증)
			 * const isValid = this._validateRadioTarget({ name: 'fontSize', value: 'size-1p5x' });
			 * @private
			 */
			_validateRadioTarget(targetData) {
				try {
					// null/undefined 체크
					if (!targetData) {
						return false;
					}
					
					// DOM 요소인 경우
					if (targetData instanceof Element) {
						// input 타입이 radio인지 확인
						if (targetData.tagName.toLowerCase() !== 'input' || targetData.type !== 'radio') {
							if (WAT_DEBUG_ENABLED) {
								console.warn('Target element is not a radio input');
							}
							return false;
						}
						
						// name과 value 속성 확인
						if (!targetData.name || !targetData.value) {
							if (WAT_DEBUG_ENABLED) {
								console.warn('Radio element missing name or value attribute');
							}
							return false;
						}
						
						return true;
					}
					
					// 객체인 경우
					if (typeof targetData === 'object') {
						// name과 value 속성 확인
						if (!targetData.name || !targetData.value) {
							if (WAT_DEBUG_ENABLED) {
								console.warn('Radio data object missing name or value property');
							}
							return false;
						}
						
						// 문자열 타입 확인
						if (typeof targetData.name !== 'string' || typeof targetData.value !== 'string') {
							if (WAT_DEBUG_ENABLED) {
								console.warn('Radio data object name and value must be strings');
							}
							return false;
						}
						
						return true;
					}
					
					// 기타 타입은 유효하지 않음
					if (WAT_DEBUG_ENABLED) {
						console.warn('Invalid target data type:', typeof targetData);
					}
					return false;
					
				} catch (error) {
					console.error('Error validating radio target:', error);
					return false;
				}
			}

			/**
			 * Handles errors consistently throughout the plugin (플러그인 전반에 걸쳐 일관되게 에러를 처리합니다)
			 * @param {string} methodName - Name of the method where error occurred (에러가 발생한 메서드명)
			 * @param {Error} error - Error object (에러 객체)
			 * @param {Object} [context={}] - Additional context information (추가 컨텍스트 정보)
			 * @returns {void}
			 * @description Provides centralized error handling with consistent logging and user feedback
			 *              (일관된 로깅과 사용자 피드백으로 중앙집중식 에러 처리를 제공합니다)
			 * @example
			 * // Handle error in a method (메서드에서 에러 처리)
			 * this._handleError('changeFontSize', error, { fontSize: 'invalid-value' });
			 * @private
			 */
			_handleError(methodName, error, context = {}) {
				try {
					// 에러 정보 구성
					const errorInfo = {
						method: methodName,
						message: error.message || 'Unknown error',
						stack: error.stack,
						context: context,
						timestamp: new Date().toISOString(),
						userAgent: navigator.userAgent,
						url: window.location.href
					};
					
					// 콘솔에 상세 에러 로그
					console.group(`🚨 WAT Error in ${methodName}`);
					console.error('Error message:', error.message);
					console.error('Stack trace:', error.stack);
					console.error('Context:', context);
					console.groupEnd();
					
					// 디버그 모드에서 추가 정보
					if (WAT_DEBUG_ENABLED) {
						console.table(errorInfo);
					}
					
					// 사용자에게 친화적인 피드백 (심각한 에러가 아닌 경우에만)
					const isCriticalError = error.name === 'TypeError' || error.name === 'ReferenceError';
					if (!isCriticalError && typeof this.showUserFeedback === 'function') {
						const message = this.getLocalizedText ? 
							this.getLocalizedText('msg.error.general') : 
							'An error occurred. Please try again.';
						
						this.showUserFeedback('error', message);
					}
					
					// 에러 통계 업데이트 (있는 경우)
					if (this._errorStats) {
						this._errorStats.total = (this._errorStats.total || 0) + 1;
						this._errorStats[methodName] = (this._errorStats[methodName] || 0) + 1;
					}
					
				} catch (handlingError) {
					// 에러 처리 중 에러가 발생한 경우
					console.error('Error in error handler:', handlingError);
					console.error('Original error:', error);
				}
			}

			/**
			 * 단일 알림 디스패처 — 모든 사용자 알림(피드백·상태·사전)의 공통 구현
			 * @param {string} message - 표시할 메시지
			 * @param {Object} [options={}] - 알림 옵션
			 * @param {string} [options.type='info'] - 타입 ('success'|'error'|'warning'|'info')
			 * @param {number} [options.duration=3000] - 표시 시간(ms)
			 * @param {boolean} [options.dismissible=false] - 닫기 버튼 표시 여부
			 * @param {string} [options.extraClass=''] - 채널 호환용 추가 클래스 (공백 구분)
			 * @returns {void}
			 * @description showNotification / showUserFeedback / _showDictionaryMessage 3중 구현을
			 *              수렴한 공통 프리미티브. 타입별 아이콘(WCAG 1.4.1)·role 분리(error=alert,
			 *              그 외=status)·로케일 닫기 버튼·추적형 타이머를 일관 적용한다.
			 */
			/**
			 * 상주 라이브 리전에 메시지를 실어 스크린리더에 전달합니다.
			 * 리전은 첫 사용 시 한 번 생성해 DOM에 유지 — 텍스트만 갱신해야 낭독이 안정적이다.
			 * @private
			 * @param {string} message - 낭독할 메시지
			 * @param {string} [politeness='polite'] - 'polite'(status) 또는 'assertive'(alert)
			 */
			_announceToLiveRegion(message, politeness = 'polite') {
				const id = politeness === 'assertive' ? 'wat-live-assertive' : 'wat-live-polite';
				let region = document.getElementById(id);
				if (!region) {
					region = document.createElement('div');
					region.id = id;
					region.className = 'wat-live-region wat-exclude';
					region.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
					region.setAttribute('aria-live', politeness);
					document.body.appendChild(region);
				}
				// 같은 메시지 연속 전달도 낭독되도록 비운 뒤 다음 프레임에 채운다
				region.textContent = '';
				this._requestAnimationFrame(() => {
					region.textContent = message;
				});
			}

			_notify(message, options = {}) {
				const { type = 'info', duration = 3000, dismissible = false, extraClass = '' } = options;
				try {
					if (!message) {
						console.warn('Invalid notify parameters');
						return;
					}

					// 기존 알림 제거 — 채널 무관하게 동시 1개만 유지
					const existing = document.querySelector('.wat-user-feedback');
					if (existing) {
						existing.remove();
					}

					const feedback = document.createElement('div');
					// 알 수 없는 타입은 info로 정규화 (CSS 클래스·아이콘 모두 4종만 존재)
					const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
					feedback.className = `wat-user-feedback wat-feedback-${safeType} wat-exclude`;
					if (extraClass) {
						feedback.classList.add(...extraClass.split(' ').filter(Boolean));
					}
					// 낭독은 상주 라이브 리전이 담당 — 리전을 텍스트와 함께 삽입하면
					// 일부 스크린리더가 첫 알림을 놓치므로, 시각 요소에는 live 시맨틱을 두지 않는다
					this._announceToLiveRegion(message, type === 'error' ? 'assertive' : 'polite');

					// 타입별 아이콘 — 색상만으로 의미를 전달하지 않도록 형태로도 구분 (WCAG 1.4.1)
					// 장식용이므로 스크린리더에는 숨김 (메시지 텍스트가 이미 낭독됨)
					const iconPaths = {
						success: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z',
						error: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z',
						warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
						info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'
					};
					const svgNS = 'http://www.w3.org/2000/svg';
					const icon = document.createElementNS(svgNS, 'svg');
					icon.setAttribute('viewBox', '0 0 24 24');
					icon.setAttribute('aria-hidden', 'true');
					icon.setAttribute('data-icon', iconPaths[type] ? type : 'info');
					Object.assign(icon.style, { width: '20px', height: '20px', flexShrink: '0' });
					const iconPath = document.createElementNS(svgNS, 'path');
					iconPath.setAttribute('d', iconPaths[type] || iconPaths.info);
					iconPath.setAttribute('fill', 'currentColor');
					icon.appendChild(iconPath);

					const messageSpan = document.createElement('span');
					messageSpan.textContent = message;

					feedback.appendChild(icon);
					feedback.appendChild(messageSpan);

					// 닫기 버튼 (사전 알림 등 수동 해제가 필요한 채널)
					if (dismissible) {
						const closeButton = document.createElement('button');
						closeButton.className = 'wat-notify-close';
						closeButton.textContent = '×';
						closeButton.setAttribute('aria-label', this.getLocalizedText('tags.button.text.close'));
						closeButton.addEventListener('click', () => feedback.remove());
						feedback.appendChild(closeButton);
					}

					// 스타일은 CSS(.wat-user-feedback / .wat-feedback-*)가 단일 출처

					// DOM에 추가
					document.body.appendChild(feedback);

					// 등장 애니메이션 (transition 기반 — 표시 상태 클래스 토글)
					requestAnimationFrame(() => {
						feedback.classList.add('wat-feedback-visible');
					});

					// 자동 제거 — 추적형 타이머 사용 (타이머 누수 방지)
					this._setTimeout(() => {
						if (feedback.parentNode) {
							feedback.classList.remove('wat-feedback-visible');

							this._setTimeout(() => {
								if (feedback.parentNode) {
									feedback.remove();
								}
							}, 300);
						}
					}, duration);

				} catch (error) {
					// 알림 시스템 자체가 실패한 경우 — 블로킹 alert 대신 콘솔로만 남긴다
					console.error('Error showing notification:', error, `[${type}] ${message}`);
				}
			}

			/**
			 * Shows user-friendly feedback messages (사용자 친화적인 피드백 메시지를 표시합니다)
			 * @param {string} type - Message type ('success', 'error', 'warning', 'info') (메시지 타입)
			 * @param {string} message - Message to display (표시할 메시지)
			 * @param {number} [duration=3000] - Display duration in milliseconds (표시 지속 시간, 밀리초)
			 * @returns {void}
			 * @description _notify 위임 래퍼 (하위 호환 유지)
			 */
			showUserFeedback(type, message, duration = 3000) {
				if (!type || !message) {
					console.warn('Invalid feedback parameters');
					return;
				}
				this._notify(message, { type, duration });
			}

			// ========== Font Style          ==========

			/**
			 * Changes the font size of all elements based on the specified size setting (지정된 크기 설정을 기반으로 모든 요소의 폰트 크기를 변경합니다)
			 * @param {string} size - Font size setting key ('initial', 'size-1p2x', 'size-1p5x', etc.) (폰트 크기 설정 키)
			 * @returns {void}
			 * @description Applies font size changes through either manual CSS data attributes or dynamic styling based on the current style mode
			 *              (현재 스타일 모드에 따라 수동 CSS 데이터 속성 또는 동적 스타일링을 통해 폰트 크기 변경을 적용합니다)
			 * @example
			 * // Apply large font size (큰 폰트 크기 적용)
			 * this.changeFontSize('size-1p5x');
			 * 
			 * // Reset to initial size (초기 크기로 재설정)
			 * this.changeFontSize('initial');
			 */
			changeFontSize(size) {
				if (this.styleMode === 'manual') {
					document.documentElement.dataset.fontSize = size;
					//localStorage.setItem('fontSize', size);
					this.updatePersonalSettingsUI('radio', 'fontSize', size);
					this.savePreferences();
				} else {
					// 동적 모드: markDynamicStyledElements의 WeakMap을 활용
					document.documentElement.dataset.fontSize = size; // 데이터셋도 설정
					this.applyDynamicFontSize(size);
					this.updatePersonalSettingsUI('radio', 'fontSize', size);
					this.savePreferences();
				}

				// Sync Iframes
				this.syncStyleToIframes('fontSize', size);
			}

			/**
			 * Applies dynamic font size changes to all marked elements (마킹된 모든 요소에 동적 폰트 크기 변경을 적용합니다)
			 * @param {string} [size='initial'] - Font size setting key (폰트 크기 설정 키)
			 * @returns {void}
			 * @description Uses cached elements and batch processing for optimal performance when applying font size changes
			 *              (폰트 크기 변경 적용 시 최적의 성능을 위해 캐시된 요소와 배치 처리를 사용합니다)
			 * @example
			 * // Apply dynamic font size scaling (동적 폰트 크기 스케일링 적용)
			 * this.applyDynamicFontSize('size-2x');
			 */
			applyDynamicFontSize(size = 'initial') {
				const ratio = this.fontSizeRatios[size] || 1;
				this._applyDynamicStyle('wat-dyn-fontsize', 'font-size', size, (el, orig) => {
					if (!orig || !orig['font-size']) return null;
					return `${parseFloat(orig['font-size']) * ratio}px`;
				});
			}

			/**
			 * 동적 스타일 4종(font-size/line-height/text-align/letter-spacing)의 공통 적용 루틴
			 * @private
			 * @param {string} cacheClass - 대상 요소 캐시 클래스 (예: 'wat-dyn-fontsize')
			 * @param {string} cssProp - 적용할 CSS 속성명
			 * @param {string} value - 설정 값 ('initial'/'unset'이면 스타일 제거)
			 * @param {Function} computeValue - (el, originalStyles) => 적용할 값 (null이면 건너뜀)
			 */
			_applyDynamicStyle(cacheClass, cssProp, value, computeValue) {
				if (WAT_DEBUG_ENABLED) console.time(`applyDynamic:${cssProp}`);

				const elements = this._getCachedElements(cacheClass);

				if (value === 'initial' || value === 'unset') {
					elements.forEach(el => {
						this.styleBatchProcessor.queueStyleUpdate(el, cssProp, null);
					});
				} else {
					elements.forEach(el => {
						const newValue = computeValue(el, this._originalStyleMap.get(el));
						if (newValue != null) {
							this.styleBatchProcessor.queueStyleUpdate(el, cssProp, newValue);
						}
					});
				}

				if (WAT_DEBUG_ENABLED) console.timeEnd(`applyDynamic:${cssProp}`);
			}

			/**
			 * Changes the font family for all text elements (모든 텍스트 요소의 폰트 패밀리를 변경합니다)
			 * @param {string} font - Font family key from FONT_FAMILY_OPTIONS (FONT_FAMILY_OPTIONS에서 폰트 패밀리 키)
			 * @returns {void}
			 * @description Applies font family changes and loads web fonts if necessary, with support for both manual and dynamic modes
			 *              (필요시 웹폰트를 로드하며 폰트 패밀리 변경을 적용하고, 수동 및 동적 모드를 모두 지원합니다)
			 * @example
			 * // Apply specific font family (특정 폰트 패밀리 적용)
			 * this.changeFontFamily('koddi-udon-gothic');
			 * 
			 * // Reset to system default (시스템 기본값으로 재설정)
			 * this.changeFontFamily('initial');
			 */
			changeFontFamily(font) {
				try {
					if (WAT_DEBUG_ENABLED) {
						console.log(`changeFontFamily called with font: ${font}`);
					}
					
					if (font === 'initial') {
						if (WAT_DEBUG_ENABLED) {
							console.log('=== INITIAL FONT PROCESSING START ===');
							console.log('Current document.documentElement.style.fontFamily:', document.documentElement.style.fontFamily);
							console.log('Current document.documentElement.dataset.fontFamily:', document.documentElement.dataset.fontFamily);
						}
						
						// 기본 폰트로 리셋
						document.documentElement.dataset.fontFamily = 'initial';
						document.documentElement.style.fontFamily = '';
						
						// 강제로 모든 상속을 제거하기 위해 CSS 변수도 초기화
						document.documentElement.style.setProperty('--wat-font-family', '');
						
						if (WAT_DEBUG_ENABLED) {
							console.log('After reset - document.documentElement.style.fontFamily:', document.documentElement.style.fontFamily);
							console.log('After reset - document.documentElement.dataset.fontFamily:', document.documentElement.dataset.fontFamily);
						}
						
						// 동적 스타일링이 적용된 요소들도 초기화
						if (this.styleMode === 'dynamic') {
							const styledElements = document.querySelectorAll('.wat-dyn-fontfamily');
							if (WAT_DEBUG_ENABLED) {
								console.log(`Found ${styledElements.length} dynamic font elements to reset`);
							}
							
							styledElements.forEach((el, index) => {
								// !important가 적용된 인라인 스타일도 완전히 제거
								el.style.removeProperty('font-family');
								
								if (this._originalStyleMap && this._originalStyleMap.has(el)) {
									const originalStyles = this._originalStyleMap.get(el);
									if (originalStyles['font-family']) {
										el.style.fontFamily = originalStyles['font-family'];
										if (WAT_DEBUG_ENABLED) {
											console.log(`Element ${index}: restored to original font: ${originalStyles['font-family']}`);
										}
									} else {
										if (WAT_DEBUG_ENABLED) {
											console.log(`Element ${index}: cleared font-family (had original but was empty)`);
										}
									}
								} else {
									if (WAT_DEBUG_ENABLED) {
										console.log(`Element ${index}: no original style found, cleared font-family with removeProperty`);
									}
								}
								
								// 동적 폰트 클래스도 제거
								el.classList.remove('wat-dyn-fontfamily');
							});
							
							// 모든 wat-apply 요소에서도 인라인 font-family 스타일 제거
							const allApplyElements = document.querySelectorAll('.wat-apply');
							allApplyElements.forEach((el, index) => {
								if (el.style.fontFamily) {
									if (WAT_DEBUG_ENABLED) {
										console.log(`Clearing font-family from wat-apply element ${index}: ${el.style.fontFamily}`);
									}
									// !important가 적용된 스타일도 완전히 제거
									el.style.removeProperty('font-family');
								}
							});
							
							// (제거됨) el.style.fontFamily는 priority(!important)를 포함하지 않으므로
							// includes('!important')가 항상 false인 죽은 코드였음 — 전체 DOM 풀스캔 비용만 유발.
							// 실제 !important 인라인 제거는 위의 removeProperty 루프가 담당함.
						}
						
						if (WAT_DEBUG_ENABLED) {
							console.log('About to call updatePersonalSettingsUI for initial font');
						}
						
						this.updatePersonalSettingsUI('radio', 'fontFamily', font);
						this.savePreferences();
						
						// Sync Iframes
						this.syncStyleToIframes('fontFamily', font);
						
						if (WAT_DEBUG_ENABLED) {
							console.log('Font family reset to initial (system default) - COMPLETE');
							console.log('=== INITIAL FONT PROCESSING END ===');
						}
						
						return;
					}
					
					const mergedFontOptions = {
						...WAT.FONT_FAMILY_OPTIONS,
						...(this.options.fontFamily || {})
					};
					const fontConfig = mergedFontOptions[font];

					if (!fontConfig || (typeof fontConfig === 'object' && !fontConfig.enabled)) {
						console.warn(`Font "${font}" is not enabled.`);
						return;
					}

					// 동적 모드에서 배치 처리 적용
					if (this.styleMode === 'dynamic') {
						this.applyDynamicFontFamily(font);
					} else {
						// 수동 모드는 기존 방식
						document.documentElement.dataset.fontFamily = font;
						document.documentElement.style.fontFamily = this.getFontFamily(font);
					}
					
					this.updatePersonalSettingsUI('radio', 'fontFamily', font);
					this.savePreferences();

					// Sync Iframes
					this.syncStyleToIframes('fontFamily', font);
					
					if (WAT_DEBUG_ENABLED) {
						console.log(`Font family changed to: ${font} (${fontConfig.label})`);
					}
					
				} catch (error) {
					this._handleError('changeFontFamily', error, { font });
				}
			}

			/**
			 * Applies dynamic font family changes to all text elements (모든 텍스트 요소에 동적 폰트 패밀리 변경을 적용합니다)
			 * @param {string} [font='initial'] - Font family key (폰트 패밀리 키)
			 * @returns {void}
			 * @description Uses batch processing to efficiently apply font family changes to all text elements
			 *              (모든 텍스트 요소에 효율적으로 폰트 패밀리 변경을 적용하기 위해 배치 처리를 사용합니다)
			 */
			applyDynamicFontFamily(font = 'initial') {
				if (WAT_DEBUG_ENABLED) console.time('applyDynamicFontFamily');
				
				// 폰트 패밀리가 적용될 수 있는 모든 텍스트 요소 조회
				const elements = this._getCachedElementsBySelector(
					'.wat-dyn-fontsize, .wat-dyn-lineheight, .wat-dyn-letterspacing, .wat-dyn-textalign',
					'all-text-elements'
				);
				
				if (font === 'initial') {
					elements.forEach(el => {
						// initial도 배치 큐를 경유해 제거 — 즉시 제거하면 큐에 남은 이전 폰트 적용 배치가
						// 다음 프레임에 리셋을 되돌리는 경합이 발생함 (null 값은 removeProperty로 처리됨)
						this.styleBatchProcessor.queueStyleUpdate(el, 'font-family', null);
						el.classList.remove('wat-dyn-fontfamily');
					});
				} else {
					const fontFamily = this.getFontFamily(font);
					elements.forEach(el => {
						this.styleBatchProcessor.queueStyleUpdate(el, 'font-family', fontFamily);
						el.classList.add('wat-dyn-fontfamily');
					});
				}

				// 문서 전체에도 적용
				document.documentElement.dataset.fontFamily = font;
				document.documentElement.style.fontFamily = font === 'initial' ? '' : this.getFontFamily(font);

				if (WAT_DEBUG_ENABLED) console.timeEnd('applyDynamicFontFamily');
			}

			/**
			 * Gets the CSS font-family value for the specified font key (지정된 폰트 키에 대한 CSS font-family 값을 가져옵니다)
			 * @param {string} font - Font family key (폰트 패밀리 키)
			 * @returns {string} CSS font-family value (CSS font-family 값)
			 * @description Retrieves font-family string from merged font options configuration
			 *              (병합된 폰트 옵션 설정에서 font-family 문자열을 가져옵니다)
			 * @example
			 * // Get font family CSS value (폰트 패밀리 CSS 값 가져오기)
			 * const fontFamily = this.getFontFamily('nanum-gothic');
			 * console.log(fontFamily); // 'Nanum Gothic, sans-serif'
			 */
			getFontFamily(font) {
				const mergedFontOptions = {
					...WAT.FONT_FAMILY_OPTIONS,
					...(this.options.fontFamily || {})
				};
				const fontConfig = mergedFontOptions[font];
				return fontConfig && fontConfig.fontFamily ? fontConfig.fontFamily : font;
			}

			/**
			 * Loads a web font by injecting a CSS link element (CSS 링크 요소를 주입하여 웹폰트를 로드합니다)
			 * @param {string} url - URL of the web font CSS file (웹폰트 CSS 파일의 URL)
			 * @returns {void}
			 * @description Dynamically loads web fonts to ensure they are available for use, with duplicate prevention
			 *              (중복 방지와 함께 웹폰트를 동적으로 로드하여 사용 가능하도록 합니다)
			 * @example
			 * // Load Google Fonts (Google Fonts 로드)
			 * this.loadWebFont('https://fonts.googleapis.com/css2?family=Noto+Sans+KR&display=swap');
			 */
			loadWebFont(url) {
				// config 유래 URL — 스킴 검증(https/http만) 및 셀렉터 보간 시 이스케이프 (따옴표 포함 URL로 인한 SyntaxError 방지)
				if (!isSafeHttpUrl(url)) {
					console.warn('[WAT] 유효하지 않은 웹폰트 URL을 건너뜁니다:', url);
					return;
				}
				try {
					const escapedUrl = typeof CSS !== 'undefined' && CSS.escape ? url.replace(/"/g, '\\"') : url;
					if (!document.querySelector(`link[href="${escapedUrl}"]`)) {
						const link = document.createElement('link');
						link.rel = 'stylesheet';
						link.href = url;
						document.head.appendChild(link);
					}
				} catch (e) {
					console.warn('[WAT] 웹폰트 로드 실패:', e.message);
				}
			}

			/**
			 * Generates a human-readable label for font size options (폰트 크기 옵션을 위한 사람이 읽기 쉬운 라벨을 생성합니다)
			 * @param {string} key - Font size key (폰트 크기 키)
			 * @param {number} ratio - Font size ratio multiplier (폰트 크기 비율 배수)
			 * @returns {string} Generated label text (생성된 라벨 텍스트)
			 * @description Creates descriptive labels for font size options based on ratio values
			 *              (비율 값을 기반으로 폰트 크기 옵션에 대한 설명적 라벨을 생성합니다)
			 * @example
			 * // Generate font size label (폰트 크기 라벨 생성)
			 * const label = this.generateFontSizeLabel('size-1p5x', 1.5);
			 * console.log(label); // '150% (1.5배)'
			 */
			generateFontSizeLabel(key, ratio) {
				// 로케일에 정의된 라벨 우선 — 미정의 커스텀 비율만 자동 생성 (하드코딩 한국어 노출 방지)
				const localized = this.getLocalizedText(`panel.personal.options.fontSize.options.${key}`);
				if (localized) return localized;

				const percentage = Math.round(ratio * 100);
				return `${percentage}%`;
			}

			// ========== Layout Style        ==========

			/**
			 * Changes the screen scale/zoom level for accessibility (접근성을 위한 화면 배율/줌 레벨을 변경합니다)
			 * @param {string} scale - Scale setting key ('initial', 'scale-1p2x', 'scale-1p5x', etc.) (배율 설정 키)
			 * @returns {void}
			 * @description Applies screen scaling through either manual CSS data attributes or dynamic zoom properties
			 *              (수동 CSS 데이터 속성 또는 동적 줌 속성을 통해 화면 배율을 적용합니다)
			 * @example
			 * // Apply 150% screen scale (150% 화면 배율 적용)
			 * this.changeScreenScale('scale-1p5x');
			 * 
			 * // Reset to initial scale (초기 배율로 재설정)
			 * this.changeScreenScale('initial');
			 */
			changeScreenScale(scale) {
				const ratio = this.screenScaleRatios[scale] || 1;
				// 확대 비율의 단일 저장소는 state — 인스턴스 프로퍼티 dual-write 제거
				this.state.set('plugin.currentScreenScale', ratio);
				
				if (this.styleMode === 'manual') {
					document.documentElement.dataset.screenScale = scale;
					this.updatePersonalSettingsUI('radio', 'screenScale', scale);
					this.savePreferences();
				} else {
					// 동적 모드: zoom 속성 사용
					document.documentElement.dataset.screenScale = scale; // 데이터셋도 설정
					this.applyDynamicScreenScale(scale);
					this.updatePersonalSettingsUI('radio', 'screenScale', scale);
					this.savePreferences();
				}
			}

			/**
			 * Applies dynamic screen scaling using CSS zoom and transform properties (CSS zoom과 transform 속성을 사용하여 동적 화면 배율을 적용합니다)
			 * @param {string} scale - Scale setting key (배율 설정 키)
			 * @returns {void}
			 * @description Uses browser-specific zoom properties and applies reverse scaling to the container
			 *              (브라우저별 줌 속성을 사용하고 컨테이너에 역방향 배율을 적용합니다)
			 * @example
			 * // Apply dynamic screen scaling (동적 화면 배율 적용)
			 * this.applyDynamicScreenScale('scale-2x');
			 */
			applyDynamicScreenScale(scale) {
				const ratio = this.screenScaleRatios[scale] || 1;
				this.state.set('plugin.currentScreenScale', ratio); // 단일 저장소(state)에만 기록
				
				if (scale === 'initial') {
					document.documentElement.style.removeProperty('zoom');
					document.documentElement.style.removeProperty('-moz-transform');
					this.resetContainerScale();
					document.documentElement.dataset.screenScale = 'initial';
				} else {
					// Chrome, Safari, Edge
					document.documentElement.style.setProperty('zoom', ratio, 'important');
					// Firefox
					document.documentElement.style.setProperty('-moz-transform', `scale(${ratio})`, 'important');
					this.applyContainerReverseScale(ratio);
					document.documentElement.dataset.screenScale = scale;
				}
				
				// 읽기 가이드가 활성화되어 있으면 마스크 요소들을 업데이트 (함수가 정의된 경우에만)
				if (typeof this.updateReadingGuideForScale === 'function') {
					this.updateReadingGuideForScale();
				}
			}

			/**
			 * Applies reverse scaling to the container to maintain tool size (도구 크기 유지를 위해 컨테이너에 역방향 배율을 적용합니다)
			 * @param {number} ratio - Scale ratio multiplier (배율 비율 배수)
			 * @returns {void}
			 * @description Applies inverse zoom to the accessibility tool container so it maintains original size
			 *              (접근성 도구 컨테이너에 역방향 줌을 적용하여 원래 크기를 유지합니다)
			 * @example
			 * // Apply reverse scale to container (컨테이너에 역방향 배율 적용)
			 * this.applyContainerReverseScale(1.5);
			 */
			applyContainerReverseScale(ratio) {
				if (this.container) {
					const reverseRatio = 1 / ratio;
					this.container.style.setProperty('zoom', reverseRatio, 'important');
					//this.container.style.setProperty('transform', `scale(${reverseRatio})`, 'important');
					//this.container.style.setProperty('transform-origin', 'top left', 'important');
				}
			}

			/**
			 * Resets container scaling to default values (컨테이너 배율을 기본값으로 재설정합니다)
			 * @returns {void}
			 * @description Removes all zoom and transform properties from the container
			 *              (컨테이너에서 모든 줌과 변형 속성을 제거합니다)
			 * @example
			 * // Reset container to original scale (컨테이너를 원래 배율로 재설정)
			 * this.resetContainerScale();
			 */
			resetContainerScale() {
				if (this.container) {
					this.container.style.removeProperty('zoom');
					//this.container.style.removeProperty('transform');
					//this.container.style.removeProperty('transform-origin');
				}
				// 확대 비율도 초기값으로 재설정
				this.state.set('plugin.currentScreenScale', 1);
			}

			/**
			 * Converts mouse coordinates from scaled viewport to original viewport (확대된 뷰포트에서 원본 뷰포트로 마우스 좌표를 변환합니다)
			 * @param {number} scaledX - X coordinate in scaled viewport (확대된 뷰포트의 X 좌표)
			 * @param {number} scaledY - Y coordinate in scaled viewport (확대된 뷰포트의 Y 좌표)
			 * @returns {Object} Object with original coordinates (원본 좌표를 가진 객체)
			 * @description Adjusts mouse coordinates based on current screen scale ratio for accurate positioning
			 *              (정확한 위치 지정을 위해 현재 화면 확대 비율을 기반으로 마우스 좌표를 조정합니다)
			 * @example
			 * // Convert scaled coordinates (확대된 좌표 변환)
			 * const originalCoords = this.convertScaledCoordinates(300, 200);
			 * console.log(originalCoords); // { x: 200, y: 133 } (1.5x scale)
			 */
			convertScaledCoordinates(scaledX, scaledY) {
				const scale = this.state.get('plugin.currentScreenScale') || 1;
				return {
					x: scaledX / scale,
					y: scaledY / scale
				};
			}

			/**
			 * Gets the original viewport dimensions accounting for screen scaling (화면 확대를 고려한 원본 뷰포트 크기를 가져옵니다)
			 * @returns {Object} Object with original viewport dimensions (원본 뷰포트 크기를 가진 객체)
			 * @description Calculates the original viewport size before scaling was applied
			 *              (확대가 적용되기 전의 원본 뷰포트 크기를 계산합니다)
			 * @example
			 * // Get original viewport size (원본 뷰포트 크기 가져오기)
			 * const originalViewport = this.getOriginalViewportSize();
			 * console.log(originalViewport); // { width: 1280, height: 720 }
			 */
			getOriginalViewportSize() {
				const scale = this.state.get('plugin.currentScreenScale') || 1;
				return {
					width: window.innerWidth / scale,
					height: window.innerHeight / scale
				};
			}

			/**
			 * Updates reading guide elements when screen scale changes (화면 확대 변경 시 읽기 가이드 요소들을 업데이트합니다)
			 * @returns {void}
			 * @description Adjusts reading guide mask and line elements to work correctly with screen scaling
			 *              (화면 확대와 함께 올바르게 작동하도록 읽기 가이드 마스크와 라인 요소들을 조정합니다)
			 * @example
			 * // Update reading guides for current scale (현재 확대 비율에 맞게 읽기 가이드 업데이트)
			 * this.updateReadingGuideForScale();
			 */
			updateReadingGuideForScale() {
				const readGuideMode = this.state.get('plugin.readGuideMode');
				if (readGuideMode === 'mask') {
					// 마스크 모드가 활성화되어 있으면 마스크 요소들의 스케일 조정
					this.adjustMaskElementsForScale();
				} else if (readGuideMode === 'underline') {
					// 언더라인 모드가 활성화되어 있으면 라인 요소의 스케일 조정
					this.adjustLineElementForScale();
				}
			}

			/**
			 * Adjusts reading mask elements to work correctly with screen scaling (화면 확대와 함께 올바르게 작동하도록 읽기 마스크 요소들을 조정합니다)
			 * @returns {void}
			 * @description Applies CSS transforms to mask elements to compensate for screen scaling
			 *              (화면 확대를 보정하기 위해 마스크 요소들에 CSS 변형을 적용합니다)
			 * @example
			 * // Adjust mask elements for current scale (현재 확대 비율에 맞게 마스크 요소 조정)
			 * this.adjustMaskElementsForScale();
			 */
			adjustMaskElementsForScale() {
				const scale = this.state.get('plugin.currentScreenScale') || 1;
				const masks = document.querySelectorAll('.wat-reading-guide.reading-mask-top, .wat-reading-guide.reading-mask-bottom');
				
				masks.forEach(mask => {
					if (scale !== 1) {
						// 확대된 경우 마스크 요소에 역방향(1/scale) 스케일 적용
						// (정방향이면 documentElement zoom과 중첩되어 이중 확대됨)
						mask.style.transform = `scale(${1 / scale})`;
						mask.style.transformOrigin = 'top left';
					} else {
						// 기본 배율일 때는 변형 제거
						mask.style.removeProperty('transform');
						mask.style.removeProperty('transform-origin');
					}
				});
			}

			/**
			 * Adjusts reading line element to work correctly with screen scaling (화면 확대와 함께 올바르게 작동하도록 읽기 라인 요소를 조정합니다)
			 * @returns {void}
			 * @description Applies optimal width to line element based on screen scaling
			 *              (화면 확대를 기반으로 라인 요소에 최적의 너비를 적용합니다)
			 * @example
			 * // Adjust line element for current scale (현재 확대 비율에 맞게 라인 요소 조정)
			 * this.adjustLineElementForScale();
			 */
			adjustLineElementForScale() {
				const scale = this.state.get('plugin.currentScreenScale') || 1;
				const line = document.querySelector('.wat-reading-guide.reading-line');
				
				if (line) {
					if (scale !== 1) {
						// 확대된 경우: 라인 요소 자체는 스케일하지 않고, 위치만 보정
						// 라인은 원본 크기를 유지하되, transform 기준점을 조정
						line.style.transformOrigin = 'center center';
						
						// 라인 너비를 스마트하게 조정
						this.adjustLineWidth(line, scale);
					} else {
						// 기본 배율일 때는 기본 transform만 유지 (translateX(-50%))
						line.style.removeProperty('transform-origin');
						// 기본 크기로 복원
						line.style.width = '500px';
					}
				}
			}

			/**
			 * Changes the line height of text elements (텍스트 요소의 줄 간격을 변경합니다)
			 * @param {string} height - Line height setting key ('initial', 'size-1p2x', 'size-1p5x', etc.) (줄 간격 설정 키)
			 * @returns {void}
			 * @description Applies line height changes through either manual CSS data attributes or dynamic styling
			 *              (수동 CSS 데이터 속성 또는 동적 스타일링을 통해 줄 간격 변경을 적용합니다)
			 * @example
			 * // Apply wider line height (더 넓은 줄 간격 적용)
			 * this.changeLineHeight('size-1p5x');
			 * 
			 * // Reset to initial line height (초기 줄 간격으로 재설정)
			 * this.changeLineHeight('initial');
			 */
			changeLineHeight(height) {
				if (this.styleMode === 'manual') {
					document.documentElement.setAttribute('data-line-height', height);
					//localStorage.setItem('lineHeight', height);
					console.log('changeLineHeight ==>> ' + height);
					this.updatePersonalSettingsUI('radio', 'lineHeight', height);
					this.savePreferences();
				} else {
					// 동적 모드: markDynamicStyledElements의 WeakMap을 활용
					document.documentElement.setAttribute('data-line-height', height);
					this.applyDynamicLineHeight(height);
					this.updatePersonalSettingsUI('radio', 'lineHeight', height);
					this.savePreferences();
				}

				// Sync Iframes
				this.syncStyleToIframes('lineHeight', height);
			}

			/**
			 * Applies dynamic line height changes to all marked elements (마킹된 모든 요소에 동적 줄 간격 변경을 적용합니다)
			 * @param {string} [height='initial'] - Line height setting key (줄 간격 설정 키)
			 * @returns {void}
			 * @description Uses cached elements and batch processing for optimal performance when applying line height changes
			 *              (줄 간격 변경 적용 시 최적의 성능을 위해 캐시된 요소와 배치 처리를 사용합니다)
			 * @example
			 * // Apply dynamic line height scaling (동적 줄 간격 배율 적용)
			 * this.applyDynamicLineHeight('size-2x');
			 */
			applyDynamicLineHeight(height = 'initial') {
				const ratio = this.lineHeightRatios[height] || 1;
				this._applyDynamicStyle('wat-dyn-lineheight', 'line-height', height, (el, orig) => {
					if (!orig || !orig['line-height']) return null;
					return `${parseFloat(orig['line-height']) * ratio}px`;
				});
			}

			/**
			 * Generates a human-readable label for line height options (줄 간격 옵션을 위한 사람이 읽기 쉬운 라벨을 생성합니다)
			 * @param {string} key - Line height key (줄 간격 키)
			 * @param {number} ratio - Line height ratio multiplier (줄 간격 비율 배수)
			 * @returns {string} Generated label text (생성된 라벨 텍스트)
			 * @description Creates descriptive labels for line height options based on ratio values
			 *              (비율 값을 기반으로 줄 간격 옵션에 대한 설명적 라벨을 생성합니다)
			 * @example
			 * // Generate line height label (줄 간격 라벨 생성)
			 * const label = this.generateLineHeightLabel('size-1p5x', 1.5);
			 * console.log(label); // '150% (1.5배)'
			 */
			generateLineHeightLabel(key, ratio) {
				// 로케일에 정의된 라벨 우선 — 미정의 커스텀 비율만 자동 생성
				const localized = this.getLocalizedText(`panel.personal.options.lineHeight.options.${key}`);
				if (localized) return localized;

				const percentage = Math.round(ratio * 100);
				return `${percentage}%`;
			}

			/**
			 * Changes the text alignment for text elements (텍스트 요소의 텍스트 정렬을 변경합니다)
			 * @param {string} align - Text alignment value ('initial', 'left', 'center', 'right', 'justify') (텍스트 정렬 값)
			 * @returns {void}
			 * @description Applies text alignment changes through either manual CSS data attributes or dynamic styling
			 *              (수동 CSS 데이터 속성 또는 동적 스타일링을 통해 텍스트 정렬 변경을 적용합니다)
			 * @example
			 * // Center align text (텍스트 중앙 정렬)
			 * this.changeTextAlign('center');
			 * 
			 * // Reset to initial alignment (초기 정렬로 재설정)
			 * this.changeTextAlign('initial');
			 */
			changeTextAlign(align) {
				if (this.styleMode === 'manual') {
					document.documentElement.setAttribute('data-txt-align', align);
					//localStorage.setItem('txtAlign', align);
					this.updatePersonalSettingsUI('radio', 'txtAlign', align);
					this.savePreferences();
				} else {
					// 동적 모드: markDynamicStyledElements의 WeakMap을 활용
					document.documentElement.setAttribute('data-txt-align', align);
					this.applyDynamicTextAlign(align);
					this.updatePersonalSettingsUI('radio', 'txtAlign', align);
					this.savePreferences();
				}

				// Sync Iframes
				this.syncStyleToIframes('txtAlign', align);
			}

			/**
			 * Applies dynamic text alignment changes to all marked elements (마킹된 모든 요소에 동적 텍스트 정렬 변경을 적용합니다)
			 * @param {string} [align='initial'] - Text alignment value (텍스트 정렬 값)
			 * @returns {void}
			 * @description Uses cached elements and batch processing for optimal performance when applying text alignment
			 *              (텍스트 정렬 적용 시 최적의 성능을 위해 캐시된 요소와 배치 처리를 사용합니다)
			 * @example
			 * // Apply dynamic text alignment (동적 텍스트 정렬 적용)
			 * this.applyDynamicTextAlign('center');
			 */
			applyDynamicTextAlign(align = 'initial') {
				this._applyDynamicStyle('wat-dyn-textalign', 'text-align', align, () => align);
			}

			/**
			 * Changes the letter spacing for text elements (텍스트 요소의 자간을 변경합니다)
			 * @param {string} spacing - Letter spacing setting key ('initial', 'wide_little', 'wide_normal', etc.) (자간 설정 키)
			 * @returns {void}
			 * @description Applies letter spacing changes through either manual CSS data attributes or dynamic styling
			 *              (수동 CSS 데이터 속성 또는 동적 스타일링을 통해 자간 변경을 적용합니다)
			 * @example
			 * // Apply wider letter spacing (더 넓은 자간 적용)
			 * this.changeLetterSpacing('wide_normal');
			 * 
			 * // Reset to initial spacing (초기 자간으로 재설정)
			 * this.changeLetterSpacing('initial');
			 */
			changeLetterSpacing(spacing) {
				if (this.styleMode === 'manual') {
					document.documentElement.setAttribute('data-letter-spacing', spacing);
					//localStorage.setItem('letterSpacing', spacing);
					this.updatePersonalSettingsUI('radio', 'letterSpacing', spacing);
					this.savePreferences();
				} else {
					// 동적 모드: markDynamicStyledElements의 WeakMap을 활용
					document.documentElement.setAttribute('data-letter-spacing', spacing);
					this.applyDynamicLetterSpacing(spacing);
					this.updatePersonalSettingsUI('radio', 'letterSpacing', spacing);
					this.savePreferences();
				}

				// Sync Iframes
				this.syncStyleToIframes('letterSpacing', spacing);
			}

			/**
			 * Applies dynamic letter spacing changes to all marked elements (마킹된 모든 요소에 동적 자간 변경을 적용합니다)
			 * @param {string} [spacing='initial'] - Letter spacing setting key (자간 설정 키)
			 * @returns {void}
			 * @description Uses cached elements and batch processing for optimal performance when applying letter spacing changes
			 *              (자간 변경 적용 시 최적의 성능을 위해 캐시된 요소와 배치 처리를 사용합니다)
			 * @example
			 * // Apply dynamic letter spacing (동적 자간 적용)
			 * this.applyDynamicLetterSpacing('wide_normal');
			 */
			applyDynamicLetterSpacing(spacing = 'initial') {
				const ratio = this.letterSpacingRatios[spacing] || 1;
				this._applyDynamicStyle('wat-dyn-letterspacing', 'letter-spacing', spacing, (el, orig) => {
					const rawLs = orig && orig['letter-spacing'];
					const origPx = rawLs != null && rawLs !== '' ? parseFloat(String(rawLs)) : NaN;
					if (Number.isFinite(origPx)) {
						return `${origPx * ratio}px`;
					}
					// 원본 자간이 없으면 글자 크기의 5%를 기준으로 계산
					const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
					return `${fontSize * 0.05 * ratio}px`;
				});
			}

			/**
			 * Generates a human-readable label for letter spacing options (자간 옵션을 위한 사람이 읽기 쉬운 라벨을 생성합니다)
			 * @param {string} key - Letter spacing key (자간 키)
			 * @param {number} ratio - Letter spacing ratio multiplier (자간 비율 배수)
			 * @returns {string} Generated label text (생성된 라벨 텍스트)
			 * @description Creates descriptive labels for letter spacing options based on ratio values
			 *              (비율 값을 기반으로 자간 옵션에 대한 설명적 라벨을 생성합니다)
			 * @example
			 * // Generate letter spacing label (자간 라벨 생성)
			 * const label = this.generateLetterSpacingLabel('wide_normal', 1.5);
			 * console.log(label); // '150% (1.5배)'
			 */
			generateLetterSpacingLabel(key, ratio) {
				// 로케일에 정의된 라벨 우선 — 미정의 커스텀 비율만 자동 생성
				const localized = this.getLocalizedText(`panel.personal.options.letterSpacing.options.${key}`);
				if (localized) return localized;

				const percentage = Math.round(ratio * 100);
				return `${percentage}%`;
			}

			// ========== Color & Visual      ==========

			/**
			 * Changes the color theme of the interface (인터페이스의 색상 테마를 변경합니다)
			 * @param {string} theme - Color theme setting ('initial', 'light', 'dark', 'reverse') (색상 테마 설정)
			 * @returns {void}
			 * @description Applies color theme changes through CSS data attributes and updates UI state
			 *              (CSS 데이터 속성을 통해 색상 테마 변경을 적용하고 UI 상태를 업데이트합니다)
			 * @example
			 * // Apply dark theme (다크 테마 적용)
			 * this.changeColorTheme('dark');
			 * 
			 * // Reset to initial theme (초기 테마로 재설정)
			 * this.changeColorTheme('initial');
			 */
			changeColorTheme(theme) {
				document.documentElement.dataset.colorTheme = theme;
				this.updatePersonalSettingsUI('radio', 'colorTheme', theme);
				this.savePreferences();
				// 다른 change* 계열과 동일하게 iframe에도 동기화 (누락 시 iframe만 원래 색 유지)
				this.syncStyleToIframes('colorTheme', theme);
			}

			/**
			 * Changes the color saturation level for accessibility (접근성을 위한 색상 채도 레벨을 변경합니다)
			 * @param {string} level - Saturation level setting ('initial', 'low', 'high', 'monochrome') (채도 레벨 설정)
			 * @returns {void}
			 * @description Applies saturation changes to help users with color vision deficiencies
			 *              (색각 이상자를 돕기 위해 채도 변경을 적용합니다)
			 * @example
			 * // Apply high saturation (높은 채도 적용)
			 * this.changeSaturation('high');
			 * 
			 * // Apply monochrome mode (단색 모드 적용)
			 * this.changeSaturation('monochrome');
			 * 
			 * // Reset to initial saturation (초기 채도로 재설정)
			 * this.changeSaturation('initial');
			 */
			changeSaturation(level) {
				document.documentElement.dataset.saturation = level;
				this.updatePersonalSettingsUI('radio', 'saturation', level);
				this.savePreferences();
				// 다른 change* 계열과 동일하게 iframe에도 동기화
				this.syncStyleToIframes('saturation', level);
			}

			// ========== UI Update           ==========

			/**
			 * Updates the personal settings UI elements to reflect current values (현재 값을 반영하도록 개인 설정 UI 요소를 업데이트합니다)
			 * @param {string} type - Type of UI element ('radio', 'checkbox', 'button') (UI 요소 타입)
			 * @param {string} key - Setting key name (설정 키 이름)
			 * @param {string|boolean} value - Current value to set (설정할 현재 값)
			 * @returns {void}
			 * @description Updates form controls and visual states based on the setting type and value, with option filtering support
			 *              (설정 타입과 값에 따라 폼 컨트롤과 시각적 상태를 업데이트하며, 옵션 필터링을 지원합니다)
			 * @example
			 * // Update radio button selection (라디오 버튼 선택 업데이트)
			 * this.updatePersonalSettingsUI('radio', 'fontSize', 'size-1p5x');
			 * 
			 * // Update checkbox state (체크박스 상태 업데이트)
			 * this.updatePersonalSettingsUI('checkbox', 'mediaStop', true);
			 * 
			 * // Update button selection (버튼 선택 업데이트)
			 * this.updatePersonalSettingsUI('button', 'tts', 'toggle');
			 */
			updatePersonalSettingsUI(type, key, value) {
				try {
					if (WAT_DEBUG_ENABLED) {
						console.log(`updatePersonalSettingsUI called: type=${type}, key=${key}, value=${value}`);
					}
					
					// 옵션에서 해당 key가 꺼져 있으면 무시
					if (!this.options || this.options[key] === false) return;
				
					const inputs = document.querySelectorAll(`.personalOpt_item.${key} input`);
					if (!inputs.length) {
						if (WAT_DEBUG_ENABLED) {
							console.warn(`No inputs found for key: ${key}`);
						}
						return;
					}
				
					if (type === 'radio') {
						let foundMatch = false;
						inputs.forEach((input, index) => {
							const isChecked = input.value === value;
							input.checked = isChecked;
							if (isChecked) foundMatch = true;
							
							if (WAT_DEBUG_ENABLED) {
								console.log(`Radio ${index}: value=${input.value}, checked=${isChecked}, target=${value}`);
							}
							
							// 라디오 버튼의 부모 요소들 상태도 업데이트
							const parentLi = input.closest('.opt_item');
							if (parentLi) {
								if (isChecked) {
									parentLi.classList.add('selectOn');
								} else {
									parentLi.classList.remove('selectOn');
								}
							}
							
							const personalOptItem = input.closest('.personalOpt_item');
							if (personalOptItem) {
								if (value === 'initial' || value === 'unset') {
									personalOptItem.classList.remove('selectOn');
								} else if (isChecked) {
									personalOptItem.classList.add('selectOn');
								}
							}
						});
						
						if (WAT_DEBUG_ENABLED) {
							console.log(`Updated radio UI for ${key}=${value}, found match: ${foundMatch}, inputs count: ${inputs.length}`);
						}
						
					} else if (type === 'checkbox') {
						inputs.forEach(input => {
							input.checked = !!value;
						});
					} else if (type === 'button') {
						inputs.forEach(input => {
							const label = input.closest('label');
							if (label) {
								if (input.value === value) {
									label.classList.add(Constants.CSS_CLASSES.SELECTED);
								} else {
									label.classList.remove(Constants.CSS_CLASSES.SELECTED);
								}
							}
						});
					}
				
					// UI 클래스 토글 (선택된 상태 표시 등)
					const itemWrap = inputs[0].closest('.wat-item-wrap');
					if (itemWrap) {
						const isActive = type === 'checkbox' ? !!value : true;
						itemWrap.classList.toggle(Constants.CSS_CLASSES.ACTIVE, isActive);
					}
					
				} catch (error) {
					this._handleError('updatePersonalSettingsUI', error, { type, key, value });
				}
			}

			/**
			 * Toggles the minimized state of the accessibility tool panel
			 * @returns {void}
			 * @description Toggles between normal and minimized view states
			 */
			toggleMinimize() {
				const watContainer = document.getElementById('watContainer');
				const minimizeButton = document.getElementById('wat_btnMinimize');
				
				if (!watContainer || !minimizeButton) {
					console.warn('WAT container or minimize button not found');
					return;
				}
				
				const isMinimized = watContainer.classList.contains('wat-minimized');
				
				if (isMinimized) {
					// 축소 해제
					watContainer.classList.remove('wat-minimized');
					document.documentElement.dataset.watMinimized = 'false';
					minimizeButton.setAttribute('aria-label', this.getLocalizedText('command.minimize'));
					minimizeButton.setAttribute('title', this.getLocalizedText('command.minimize'));
					minimizeButton.classList.remove('minimized');
				} else {
					// 축소
					watContainer.classList.add('wat-minimized');
					document.documentElement.dataset.watMinimized = 'true';
					minimizeButton.setAttribute('aria-label', this.getLocalizedText('command.restore'));
					minimizeButton.setAttribute('title', this.getLocalizedText('command.restore'));
					minimizeButton.classList.add('minimized');
				}
				
				// 설정 저장
				this.saveMinimizeState(isMinimized);
			}

			/**
			 * Saves the minimize state to localStorage
			 * @param {boolean} wasMinimized - Previous minimized state
			 * @private
			 */
			saveMinimizeState(wasMinimized) {
				const settings = safeParseJSON(localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS), {});
				settings.isMinimized = !wasMinimized;
				localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
			}

			/**
			 * Restores minimize state from localStorage
			 * @private
			 */
			restoreMinimizeState() {
				const settings = safeParseJSON(localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS), {});
				if (settings.isMinimized) {
					// DOM이 준비된 후 실행 (추적형 타이머 사용 — destroy 후 발화 방지)
					this._setTimeout(() => {
					this.toggleMinimize();
					}, 100);
				}
			}

			// ========== Read Guide          ==========

			/**
			 * Changes the reading guide mode to assist users with reading difficulties (읽기 어려움을 가진 사용자를 돕기 위해 읽기 가이드 모드를 변경합니다)
			 * @param {string} mode - Reading guide mode ('unset', 'mask', 'underline', 'bigCursor') (읽기 가이드 모드)
			 * @returns {void}
			 * @description Activates different reading assistance tools like focus masks, underlines, or cursor enhancements
			 *              (포커스 마스크, 밑줄, 커서 강화 등 다양한 읽기 보조 도구를 활성화합니다)
			 * @example
			 * // Enable mask mode (마스크 모드 활성화)
			 * this.changeReadGuide('mask');
			 * 
			 * // Disable reading guide (읽기 가이드 비활성화)
			 * this.changeReadGuide('unset');
			 */
			changeReadGuide(mode) {
				const currentMode = this.state.get('plugin.readGuideMode');
				// 초기화 중이 아닐 때만 중복 체크 (이미 같은 모드라면 처리하지 않음)
				if (!this._skipSavePreferences && currentMode === mode) return;

				this.state.set('plugin.readGuideMode', mode);
				document.documentElement.setAttribute('data-read-guide', mode); // 데이터셋에 저장
				this.removeReadingGuide();

				if (mode === 'mask') {
					this.createReadingMask();
					// 마스크 요소들의 스케일 조정 (함수가 정의된 경우에만)
					if (typeof this.adjustMaskElementsForScale === 'function') {
						this.adjustMaskElementsForScale();
					}
					// 전역 이벤트 리스너 사용
					this._addGlobalEventListener('mousemove', 'mouseMove');
				} else if (mode === 'underline') {
					this.createReadingLine();
					// 라인 요소의 스케일 조정 (함수가 정의된 경우에만)
					if (typeof this.adjustLineElementForScale === 'function') {
						this.adjustLineElementForScale();
					}
					// 전역 이벤트 리스너 사용
					this._addGlobalEventListener('mousemove', 'mouseMove');
				} else if (mode === 'bigCursor') {
					// bigCursor는 CSS만으로 처리되므로 별도 작업 불필요
					// 마우스 이동 이벤트 리스너 제거
					this._removeGlobalEventListener('mousemove');
				} else {
					// 마우스 이동 이벤트 리스너 제거
					this._removeGlobalEventListener('mousemove');
				}
				this.updatePersonalSettingsUI('radio', 'readGuide', mode);
				this.savePreferences();
			}

			/**
			 * Creates a reading mask overlay to focus attention on specific text areas (특정 텍스트 영역에 주의를 집중시키기 위한 읽기 마스크 오버레이를 생성합니다)
			 * @returns {void}
			 * @description Creates top and bottom mask elements that follow mouse movement to highlight reading area
			 *              (읽기 영역을 강조하기 위해 마우스 움직임을 따라가는 상단 및 하단 마스크 요소를 생성합니다)
			 * @example
			 * // Create reading mask (읽기 마스크 생성)
			 * this.createReadingMask();
			 */
			createReadingMask() {
					const topMask = this.createElementWithClass('div', ['wat-reading-guide', 'reading-mask-top', 'wat-exclude']);
					const bottomMask = this.createElementWithClass('div', ['wat-reading-guide', 'reading-mask-bottom', 'wat-exclude']);
					document.body.appendChild(topMask);
					document.body.appendChild(bottomMask);
			}

			/**
			 * Creates a reading line that follows the cursor to help track text lines (텍스트 라인을 추적하는데 도움이 되도록 커서를 따라가는 읽기 라인을 생성합니다)
			 * @returns {void}
			 * @description Creates a horizontal line element that moves with mouse cursor for line tracking
			 *              (라인 추적을 위해 마우스 커서와 함께 움직이는 수평선 요소를 생성합니다)
			 * @example
			 * // Create reading line (읽기 라인 생성)
			 * this.createReadingLine();
			 */
			createReadingLine() {
					const line = this.createElementWithClass('div', ['wat-reading-guide', 'reading-line', 'wat-exclude']);
					document.body.appendChild(line);
			}

			/**
			 * Handles mask mode mouse movement to adjust mask positioning (마스크 위치 조정을 위한 마스크 모드 마우스 움직임을 처리합니다)
			 * @param {Event} e - Mouse move event object (마우스 이동 이벤트 객체)
			 * @returns {void}
			 * @description Updates mask height and position based on mouse Y coordinate to create reading window
			 *              (읽기 창을 만들기 위해 마우스 Y 좌표를 기반으로 마스크 높이와 위치를 업데이트합니다)
			 * @example
			 * // Handle mask mode (마스크 모드 처리)
			 * this.handleMaskMode(mouseEvent);
			 */
			handleMaskMode(e) {
				// 화면 확대 비율을 고려한 좌표 변환 (함수가 정의된 경우에만)
				let mouseY, viewportHeight;
				
				if (typeof this.convertScaledCoordinates === 'function' && typeof this.getOriginalViewportSize === 'function') {
					const originalCoords = this.convertScaledCoordinates(e.clientX, e.clientY);
					const originalViewport = this.getOriginalViewportSize();
					mouseY = originalCoords.y;
					viewportHeight = originalViewport.height;
				} else {
					// 폴백: 기본 좌표 사용
					mouseY = e.clientY;
					viewportHeight = window.innerHeight;
				}
				
				// 호스트 페이지의 동명 클래스와 충돌하지 않도록 플러그인 클래스로 스코프 제한
				const topMask = document.querySelector('.wat-reading-guide.reading-mask-top');
				const bottomMask = document.querySelector('.wat-reading-guide.reading-mask-bottom');

				if (topMask && bottomMask) {
					// 원본 좌표계 기준으로 마스크 높이 계산
					const maskGap = 150; // 읽기 창 높이의 절반
					const topHeight = Math.max(0, mouseY - maskGap);
					const bottomHeight = Math.max(0, viewportHeight - mouseY - maskGap);
					
					topMask.style.height = `${topHeight}px`;
					bottomMask.style.height = `${bottomHeight}px`;
				}
			}

			/**
			 * Handles line mode mouse movement to position the reading line (읽기 라인 위치 설정을 위한 라인 모드 마우스 움직임을 처리합니다)
			 * @param {Event} e - Mouse move event object (마우스 이동 이벤트 객체)
			 * @returns {void}
			 * @description Updates reading line position to follow mouse cursor for text line tracking
			 *              (텍스트 라인 추적을 위해 마우스 커서를 따라 읽기 라인 위치를 업데이트합니다)
			 * @example
			 * // Handle line mode (라인 모드 처리)
			 * this.handleLineMode(mouseEvent);
			 */
			handleLineMode(e) {
				const line = document.querySelector('.reading-line');
				if (!line) return;
				
				// 화면 확대 비율 가져오기
				const scale = this.state.get('plugin.currentScreenScale') || 1;
				
				// 좌표 변환: 화면 확대 시 실제 마우스 위치 계산
				let mouseX, mouseY;
				
				if (scale !== 1) {
					// 화면이 확대된 경우: 마우스 좌표를 확대 비율로 나누어 실제 위치 계산
					mouseX = e.clientX / scale;
					mouseY = e.clientY / scale;
				} else {
					// 기본 배율인 경우: 원본 좌표 사용
					mouseX = e.clientX;
					mouseY = e.clientY;
				}
				
				// 라인 위치 설정 (10px 위쪽에 표시)
				line.style.top = `${mouseY - 10}px`;
				line.style.left = `${mouseX}px`;
				
				// 화면 확대에 따른 라인 크기 스마트 조정
				this.adjustLineWidth(line, scale);
			}

			/**
			 * Adjusts the reading line width based on screen scale and viewport size (화면 확대와 뷰포트 크기에 따라 읽기 라인 너비를 조정합니다)
			 * @param {HTMLElement} line - Reading line element (읽기 라인 요소)
			 * @param {number} scale - Current screen scale ratio (현재 화면 확대 비율)
			 * @returns {void}
			 * @description Calculates optimal line width considering scale factor and viewport constraints
			 *              (확대 비율과 뷰포트 제약을 고려하여 최적의 라인 너비를 계산합니다)
			 * @example
			 * // Adjust line width for current scale (현재 확대 비율에 맞게 라인 너비 조정)
			 * this.adjustLineWidth(lineElement, 1.5);
			 */
			adjustLineWidth(line, scale) {
				// 기본 라인 너비 (500px)
				const baseWidth = Constants.PERFORMANCE.BASE_WIDTH;
				
				// 현재 뷰포트 너비 (확대 고려)
				const viewportWidth = window.innerWidth / scale;
				
				// 최대 너비: 뷰포트의 90% 또는 기본 크기의 1.5배 중 작은 값
				const maxWidth = Math.min(viewportWidth * 0.9, baseWidth * 1.5);
				
				// 확대 비율에 따른 계산된 너비
				let calculatedWidth;
				
				if (scale <= 1) {
					// 기본 배율 또는 축소: 기본 크기 사용
					calculatedWidth = baseWidth;
				} else if (scale <= 1.5) {
					// 1배~1.5배: 선형 증가 (너무 급격하지 않게)
					calculatedWidth = baseWidth * (1 + (scale - 1) * 0.3);
				} else {
					// 1.5배 초과: 완만한 증가 (로그 스케일)
					calculatedWidth = baseWidth * (1.15 + Math.log(scale) * 0.2);
				}
				
				// 최대 너비 제한 적용
				const finalWidth = Math.min(calculatedWidth, maxWidth);
				
				// 최소 너비 보장 (200px)
				const constrainedWidth = Math.max(finalWidth, 200);
				
				// 라인 너비 적용
				line.style.width = `${constrainedWidth}px`;
				
				// 디버깅용 로그 (필요시 제거 가능)
				if (scale !== 1) {
					console.log(`Reading line width adjusted: scale=${scale.toFixed(2)}, width=${constrainedWidth.toFixed(0)}px`);
				}
			}

			/**
			 * Removes all reading guide elements from the page (페이지에서 모든 읽기 가이드 요소를 제거합니다)
			 * @returns {void}
			 * @description Cleans up all reading guide overlays, masks, and lines from the DOM
			 *              (DOM에서 모든 읽기 가이드 오버레이, 마스크, 라인을 정리합니다)
			 * @example
			 * // Remove all reading guides (모든 읽기 가이드 제거)
			 * this.removeReadingGuide();
			 */
			removeReadingGuide() {
				document.querySelectorAll('.wat-reading-guide').forEach(element => element.remove());
			}

			// ========== Image Processing    ==========

			/**
			 * Toggles hiding/showing of images on the page (페이지의 이미지 숨김/표시를 토글합니다)
			 * @param {boolean} isEnabled - Whether to hide images (이미지를 숨길지 여부)
			 * @returns {void}
			 * @description Controls image visibility by setting data attributes for CSS styling
			 *              (CSS 스타일링을 위한 데이터 속성을 설정하여 이미지 가시성을 제어합니다)
			 * @example
			 * // Hide all images (모든 이미지 숨기기)
			 * this.toggleHideImages(true);
			 * 
			 * // Show all images (모든 이미지 표시하기)
			 * this.toggleHideImages(false);
			 */
			toggleHideImages(isEnabled) {
				if (isEnabled) {
					//img.style.visibility = 'hidden'; // 이미지를 숨김
					this.toggleDataAttribute('hideImg', true);
				} else {
					//img.style.visibility = 'visible'; // 이미지를 다시 표시
					this.toggleDataAttribute('hideImg', false);
				}
			}

			/**
			 * Toggles conversion of images to text descriptions (이미지를 텍스트 설명으로 변환하는 기능을 토글합니다)
			 * @param {boolean} isEnabled - Whether to convert images to text (이미지를 텍스트로 변환할지 여부)
			 * @returns {void}
			 * @description Replaces images with their alt text, title text, or default placeholder text with visual indicators
			 *              (이미지를 alt 텍스트, title 텍스트, 또는 기본 플레이스홀더 텍스트로 시각적 표시기와 함께 대체합니다)
			 * @example
			 * // Convert images to text (이미지를 텍스트로 변환)
			 * this.toggleImgTextConversion(true);
			 * 
			 * // Restore images from text (텍스트에서 이미지로 복원)
			 * this.toggleImgTextConversion(false);
			 */
			toggleImgTextConversion(isEnabled) {
				const images = document.querySelectorAll('img');
				images.forEach(img => {
					// 플러그인이 생성한 placeholder 아이콘 이미지는 변환 대상에서 제외
					if (img.classList.contains('wat-image-placeholder-dsp')) return;
					if (isEnabled) {
						// 중복 호출 시 placeholder가 누적되지 않도록 기존 것이 있으면 건너뜀
						if (img.nextElementSibling && img.nextElementSibling.classList.contains('wat-image-placeholder')) {
							return;
						}
						const altText = img.getAttribute('alt');
						const titleText = img.getAttribute('title');
						let replacementText;

						if (altText) {
							replacementText = altText;
						} else if (titleText) {
							replacementText = titleText;
						} else {
							replacementText = this.getLocalizedText('panel.personal.options.imgTextConvert.msg.noAlt');
							img.style.color = 'red'; // 설명 없음 텍스트를 빨간색으로 표시
						}

						// img 태그 바로 뒤에 인접한 .blind 엘리먼트가 있는지 확인
						const blindElement = img.nextElementSibling;
						if (blindElement && blindElement.classList.contains('blind') && !blindElement.classList.contains('skipConversion') ) {
							replacementText = '[' + replacementText + ' - 상세설명' + ']';
							// textContent 사용 — innerHTML을 이어붙이면 페이지 콘텐츠 유래 마크업이 활성화됨(주입 위험)
							const blindText = blindElement.textContent.trim();
							replacementText += ' ' + blindText;
						}

						// 이미지를 텍스트로 교체 — alt 속성 문자열이 HTML로 파싱되지 않도록 textContent 사용
						const placeholder = document.createElement('div');
						placeholder.textContent = replacementText;
						placeholder.classList.add('wat-image-placeholder');

						const imgDsp = document.createElement('img');
						// 호스트 페이지 상대경로가 아닌 플러그인 배포 경로 기준으로 아이콘 로드
						imgDsp.src = this._assetUrl('assets/images/icon_image.png');
						imgDsp.alt = this.getLocalizedText('panel.personal.options.imgTextConvert.title') || '텍스트로 변환된 이미지';
						imgDsp.classList.add('wat-image-placeholder-dsp');
						placeholder.prepend(imgDsp);

						img.style.display = 'none';
						img.insertAdjacentElement('afterend', placeholder);
					} else {
						const placeholder = img.nextElementSibling;
						if (placeholder && placeholder.classList.contains('wat-image-placeholder')) {
							placeholder.remove();
							img.style.display = 'inline';
						}
					}
				});
				// 저장은 이미지 개수만큼 반복하지 않고 루프 밖에서 1회만 수행
				// (또한 별개 기능인 hideImg 속성을 여기서 토글하지 않음 — 기능 간 상태 얽힘 방지)
				this.savePreferences();
			}

			/**
			 * Toggles display of hidden content elements like .blind and .displayNone (숨겨진 콘텐츠 요소들(.blind, .displayNone)의 표시를 토글합니다)
			 * @param {boolean} isEnabled - Whether to display hidden content (숨겨진 콘텐츠를 표시할지 여부)
			 * @returns {void}
			 * @description Makes visually hidden content visible for accessibility analysis or restores original hidden state
			 *              (접근성 분석을 위해 시각적으로 숨겨진 콘텐츠를 보이게 하거나 원래 숨김 상태로 복원합니다)
			 * @example
			 * // Show hidden content (숨겨진 콘텐츠 표시)
			 * this.toggleDisplayContents(true);
			 * 
			 * // Hide content again (콘텐츠 다시 숨김)
			 * this.toggleDisplayContents(false);
			 */
			toggleDisplayContents(isEnabled) {
				if (isEnabled) {
					const contents = document.querySelectorAll('.blind, .displayNone');
					contents.forEach(content => {
						// 원래 어떤 클래스였는지 기록해 복원 시 정확히 되돌림 (.displayNone → .blind 오염 방지)
						content.dataset.watHiddenClass = content.classList.contains('displayNone') ? 'displayNone' : 'blind';
						content.classList.remove('blind', 'displayNone');
						content.classList.add('wat-wasBlind');
					});
				} else {
					const contents = document.querySelectorAll('.wat-wasBlind');
					contents.forEach(content => {
						content.classList.remove('wat-wasBlind');
						content.classList.add(content.dataset.watHiddenClass || 'blind');
						delete content.dataset.watHiddenClass;
					});
				}
			}

			/**
			 * Changes the image display mode with multiple options (여러 옵션으로 이미지 표시 모드를 변경합니다)
			 * @param {string} mode - Display mode ('initial', 'hide', 'convert') (표시 모드)
			 * @returns {void}
			 * @description Provides comprehensive image display control including normal view, hiding, and text conversion
			 *              (일반 보기, 숨김, 텍스트 변환을 포함한 포괄적인 이미지 표시 제어를 제공합니다)
			 * @example
			 * // Hide all images (모든 이미지 숨기기)
			 * this.changeImgDisplayMode('hide');
			 * 
			 * // Convert images to text descriptions (이미지를 텍스트 설명으로 변환)
			 * this.changeImgDisplayMode('convert');
			 * 
			 * // Reset to normal display (일반 표시로 재설정)
			 * this.changeImgDisplayMode('initial');
			 */
			changeImgDisplayMode(mode) {
				const images = document.querySelectorAll('img');

				images.forEach(img => {
					const placeholder = img.nextElementSibling;

					// 기존 상태 초기화
					if (placeholder && placeholder.classList.contains('wat-image-placeholder')) {
						placeholder.remove();
						img.style.display = 'inline';
					}

					if (mode === 'hide') {
						img.style.display = 'none'; // 이미지를 숨김
					} else if (mode === 'convert') {
						// alt → title → "설명 없음" 순서로 폴백 (기존 || 결합은 title 분기를 데드 코드로 만들었음)
						const altText = img.getAttribute('alt');
						const titleText = img.getAttribute('title') || '';
						let replacementText;
						if (altText) {
							replacementText = altText;
						} else if (titleText) {
							replacementText = titleText;
						} else {
							replacementText = this.getLocalizedText('panel.personal.options.imgTextConvert.msg.noAlt');
						}

						// `.blind` 클래스의 텍스트를 추가적으로 처리
						const blindElement = img.nextElementSibling;
						if (blindElement && blindElement.classList.contains('blind') && !blindElement.classList.contains('skipConversion')) {
							const blindText = blindElement.innerHTML
								.replace(/<[^>]*>/g, '') // 모든 HTML 태그 제거
								.replace(/\n/g, '.') // 줄바꿈을 '.'로 대체
								.replace(/^\./, '') // 제일 앞에 붙는 '.' 제거
								.replace(/\.(\s*\.)+/g, '.') // '.'과 '.' 사이의 공백 제거 및 여러 '.'을 하나로 대체
								.replace(/\.{2,}/g, '.') // '..' 이상을 '.'로 대체
								.trim();

							replacementText += ` [${blindText}]`;
						}

						// 이미지를 텍스트로 교체 — alt 문자열이 HTML로 파싱되지 않도록 DOM API로 구성
						const newPlaceholder = document.createElement('div');
						newPlaceholder.classList.add('wat-image-placeholder');
						const placeholderIcon = document.createElement('img');
						placeholderIcon.classList.add('wat-image-placeholder-dsp');
						placeholderIcon.src = this._assetUrl('assets/images/icon_image.png');
						placeholderIcon.alt = '';
						newPlaceholder.appendChild(placeholderIcon);
						newPlaceholder.appendChild(document.createTextNode(replacementText));
						img.style.display = 'none';
						img.insertAdjacentElement('afterend', newPlaceholder);
					} else {
						img.style.display = 'inline'; // 기본 상태
					}
				});

				document.documentElement.dataset.imgDisplayMode = mode;
				this.updatePersonalSettingsUI('radio', 'imgDisplayMode', mode);
				this.savePreferences();
			}

			// ========== Media Control       ==========

			/**
			 * Toggles data attributes on the document element for various accessibility features (다양한 접근성 기능을 위해 문서 요소의 데이터 속성을 토글합니다)
			 * @param {string} attr - Data attribute name to toggle (토글할 데이터 속성명)
			 * @param {boolean} isEnabled - Whether to enable the feature (기능을 활성화할지 여부)
			 * @returns {void}
			 * @description Sets data attributes on the document element and saves preferences for persistence
			 *              (문서 요소에 데이터 속성을 설정하고 지속성을 위해 환경설정을 저장합니다)
			 * @example
			 * // Enable media stop feature (미디어 정지 기능 활성화)
			 * this.toggleDataAttribute('mediaStop', true);
			 * 
			 * // Disable animation feature (애니메이션 기능 비활성화)
			 * this.toggleDataAttribute('stopAni', false);
			 */
			toggleDataAttribute(attr, isEnabled) {
				document.documentElement.dataset[attr] = isEnabled ? 'true' : 'false';
				//localStorage.setItem(attr, isEnabled ? 'true' : 'false');
				this.savePreferences();
			}

			/**
			 * Toggles media playback stop functionality for all media elements (모든 미디어 요소의 미디어 재생 정지 기능을 토글합니다)
			 * @param {boolean} isStopped - Whether to stop media playback (미디어 재생을 정지할지 여부)
			 * @returns {void}
			 * @description Pauses all video and audio elements on the page when enabled
			 *              (활성화되면 페이지의 모든 비디오와 오디오 요소를 일시정지합니다)
			 * @example
			 * // Stop all media playback (모든 미디어 재생 정지)
			 * this.toggleMediaStop(true);
			 * 
			 * // Allow media playback (미디어 재생 허용)
			 * this.toggleMediaStop(false);
			 */
			toggleMediaStop(isStopped) {
				if (isStopped) {
					const mediaElements = document.querySelectorAll('video, audio');
					mediaElements.forEach(elm => elm.pause());
				}
				
				// Dispatch media control state change event
				this._dispatchStateEvent('media:stopStateChanged', {
					isStopped: isStopped,
					state: isStopped ? 'stopped' : 'allowed',
					affectedElementsCount: document.querySelectorAll('video, audio').length
				});
			}

			/**
			 * Toggles media mute functionality for all media elements (모든 미디어 요소의 미디어 음소거 기능을 토글합니다)
			 * @param {boolean} isMuted - Whether to mute media audio (미디어 오디오를 음소거할지 여부)
			 * @returns {void}
			 * @description Mutes or unmutes all video and audio elements on the page
			 *              (페이지의 모든 비디오와 오디오 요소를 음소거하거나 음소거를 해제합니다)
			 * @example
			 * // Mute all media (모든 미디어 음소거)
			 * this.toggleMediaMute(true);
			 * 
			 * // Unmute all media (모든 미디어 음소거 해제)
			 * this.toggleMediaMute(false);
			 */
			toggleMediaMute(isMuted) {
				const mediaElements = document.querySelectorAll('video, audio');
				mediaElements.forEach(elm => elm.muted = isMuted);
				
				// Dispatch media mute state change event
				this._dispatchStateEvent('media:muteStateChanged', {
					isMuted: isMuted,
					state: isMuted ? 'muted' : 'unmuted',
					affectedElementsCount: mediaElements.length
				});
			}

			// ========== Page Scroll         ==========

			/**
			 * Toggles automatic page scrolling functionality (자동 페이지 스크롤 기능을 토글합니다)
			 * @returns {void}
			 * @description Starts or stops automatic page scrolling with smooth animation and controls the UI state
			 *              (부드러운 애니메이션으로 자동 페이지 스크롤을 시작하거나 정지하고 UI 상태를 제어합니다)
			 * @example
			 * // Toggle page scroll (페이지 스크롤 토글)
			 * this.togglePageScroll();
			 */
			togglePageScroll() {
				const elm_toggle_btn = document.getElementById('wat-button-pageScroll_toggle');
				let isScrolling = false;

				/*
				if ( elm_toggle_btn.classList.contains('playing') ) {
					isScrolling = false;
				} else {
					isScrolling = true;
				}
				*/
				isScrolling = elm_toggle_btn.getAttribute('aria-pressed') === 'true';
				console.log('isScrolling ==>> ' + isScrolling);

				elm_toggle_btn.textContent = this.getLocalizedText(isScrolling ? 'panel.personal.options.pageScroll.options.stop' : 'panel.personal.options.pageScroll.options.start');
				elm_toggle_btn.setAttribute('aria-pressed', isScrolling ? 'false' : 'true');
				isScrolling = !isScrolling;
				console.log(' ///// proc ====> isScrolling ==>> ' + elm_toggle_btn.getAttribute('aria-pressed'));
				
				const scroll = () => {
					if ( !isScrolling ) {
						this._cancelAnimationFrame(this.scrollInterval);
						//elm_toggle_btn.classList.remove('playing');
						//elm_toggle_btn.setAttribute('aria-pressed', 'false');
						console.log('scroll ==>> false ' + isScrolling);
						return;
					} else {
						console.log('scroll ==>> true ' + isScrolling);
						if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
							this._cancelAnimationFrame(this.scrollInterval);
							this.scrollInterval = null;
							// 자연 종료 시 버튼 상태(aria-pressed)도 복원 — 라벨과 상태 불일치 방지
							elm_toggle_btn.setAttribute('aria-pressed', 'false');
							elm_toggle_btn.textContent = this.getLocalizedText('panel.personal.options.pageScroll.options.start');
							elm_toggle_btn.focus();
						} else {
							//window.scrollBy(0, scrollStep);
							window.scrollBy({top: Constants.TIMING.SCROLL_STEP, behavior: 'smooth'});
							//elm_toggle_btn.classList.add('playing');
							//elm_toggle_btn.setAttribute('aria-pressed', 'true');
							this.scrollInterval = this._requestAnimationFrame(scroll);
						}
					}
				};
				this.scrollInterval = this._requestAnimationFrame(scroll);

			}

			/**
			 * Starts automatic page scrolling (자동 페이지 스크롤을 시작합니다)
			 * @returns {void}
			 * @description Initiates smooth automatic scrolling to the bottom of the page with proper UI feedback
			 *              (적절한 UI 피드백과 함께 페이지 하단까지 부드러운 자동 스크롤을 시작합니다)
			 * @example
			 * // Start page scrolling (페이지 스크롤 시작)
			 * this.startPageScroll();
			 */
			startPageScroll() {
				this.stopPageScroll(); // Ensure no multiple intervals are running
				//document.getElementById('wat-button-pageScroll_start').style.display = 'none';
				//document.getElementById('wat-button-pageScroll_stop').style.display = 'inline';
				const elm_start_btn = document.getElementById('wat-button-pageScroll_start');

				console.log('startPageScroll ==>> ');

				//data-stateText-on

				//elm_start_btn.classList.add('playing');
				elm_start_btn.setAttribute('aria-pressed', 'true');
				//document.getElementById('wat-button-pageScroll_start').disabled = true;
				//document.getElementById('wat-button-pageScroll_stop').disabled = false;
				//document.getElementById('wat-button-pageScroll_stop').focus();

				const scroll = () => {
					if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
						this.stopPageScroll(); // Stop scrolling if the bottom of the page is reached
						//document.getElementById('wat-button-pageScroll_start').disabled = false;
						//document.getElementById('wat-button-pageScroll_stop').disabled = true;
						//elm_start_btn.classList.add('playing');
						elm_start_btn.setAttribute('aria-pressed', 'true');
						elm_start_btn.textContent = elm_start_btn.getAttribute('data-stateText-on');
						
						//document.getElementById('wat-button-pageScroll_start').style.display = 'inline';
						//document.getElementById('wat-button-pageScroll_stop').style.display = 'none';
						document.getElementById('wat-button-pageScroll_start').focus();
					} else {
						//window.scrollBy(0, scrollStep);
						window.scrollBy({top: Constants.TIMING.SCROLL_STEP, behavior: 'smooth'});

						//elm_start_btn.classList.add('playing');
						elm_start_btn.setAttribute('aria-pressed', 'true');
						elm_start_btn.textContent = elm_start_btn.getAttribute('data-stateText-off');
						
						this.scrollInterval = this._requestAnimationFrame(scroll);
					}
				};
				this.scrollInterval = this._requestAnimationFrame(scroll);
			}

			/**
			 * Stops automatic page scrolling (자동 페이지 스크롤을 정지합니다)
			 * @returns {void}
			 * @description Cancels the scrolling animation and resets button states
			 *              (스크롤 애니메이션을 취소하고 버튼 상태를 재설정합니다)
			 * @example
			 * // Stop page scrolling (페이지 스크롤 정지)
			 * this.stopPageScroll();
			 */
			stopPageScroll() {
				const toggleBtn = document.getElementById('wat-button-pageScroll_toggle');
				if (toggleBtn) toggleBtn.setAttribute('aria-pressed', 'false');
				// 시작 측이 this.scrollInterval에 저장하므로 동일한 위치에서 읽어야 정지가 동작함
				const scrollInterval = this.scrollInterval || this.state.get('plugin.scrollInterval');
				if (scrollInterval) {
					this._cancelAnimationFrame(scrollInterval);
					this.scrollInterval = null;
					this.state.set('plugin.scrollInterval', null);
					const startBtn = document.getElementById('wat-button-pageScroll_start');
					const stopBtn = document.getElementById('wat-button-pageScroll_stop');
					if (startBtn) {
						startBtn.disabled = false;
						startBtn.focus();
					}
					if (stopBtn) stopBtn.disabled = true;
				}
			}

			/**
			 * Scrolls the page upward by a fixed amount (고정된 양만큼 페이지를 위로 스크롤합니다)
			 * @returns {void}
			 * @description Scrolls the page up by scroll step pixels instantly
			 *              (페이지를 즉시 스크롤 단위만큼 위로 스크롤합니다)
			 * @example
			 * // Scroll page up (페이지 위로 스크롤)
			 * this.scrollPageUp();
			 */
			scrollPageUp() {
				window.scrollBy(0, -Constants.TIMING.SCROLL_STEP);
			}

			/**
			 * Scrolls the page downward by a fixed amount (고정된 양만큼 페이지를 아래로 스크롤합니다)
			 * @returns {void}
			 * @description Scrolls the page down by scroll step pixels instantly
			 *              (페이지를 즉시 스크롤 단위만큼 아래로 스크롤합니다)
			 * @example
			 * // Scroll page down (페이지 아래로 스크롤)
			 * this.scrollPageDown();
			 */
			scrollPageDown() {
				window.scrollBy(0, Constants.TIMING.SCROLL_STEP);
			}

			// ========== Dictionary          ==========


			/**
			 * Loads configuration from config file asynchronously
			 * @private
			 */
			async _loadConfiguration() {
				// 인라인 config 객체 지원 — fetch 없이 동기 확정 (서버/설정 파일 없이 사용 가능).
				// options.config가 있으면 configPath보다 우선한다
				if (this.options && this.options.config && typeof this.options.config === 'object') {
					this._config = this._mergeConfigurations(this._getFallbackConfig(), this.options.config);
					this._configLoaded = true;
					this._validateDictionaryConfiguration();
					this._applyConfigResources();
					return;
				}

				// config.json 파일이 없거나 configPath가 없을 때 기본 설정으로 실행
				if (!this._configPath) {
					console.log('ℹ️ No config path provided, using default configuration');
					this._config = this._getFallbackConfig();
					this._configLoaded = true;
					this._validateDictionaryConfiguration();
					this._applyConfigResources();
					return;
				}

				try {
					const response = await fetch(this._configPath);
					if (!response.ok) {
						throw new Error(`Failed to load config file: ${response.status}`);
					}
					
					const loadedConfig = await response.json();

					// 타임아웃 폴백이 이미 발동한 뒤 늦게 도착한 응답이 사용 중인 config를
					// 도중에 교체하지 않도록 무시 (비결정적 동작 방지)
					if (this._configLoaded) {
						console.warn('⚠️ 타임아웃 이후 도착한 config 응답을 무시합니다:', this._configPath);
						return;
					}

					// Merge with fallback configuration
					this._config = this._mergeConfigurations(this._getFallbackConfig(), loadedConfig);
					this._configLoaded = true;
					
					// 사전 기능 활성화 검사
					this._validateDictionaryConfiguration();
					
					// config에서 외부 리소스 URL 적용
					this._applyConfigResources();
					
					// ErrorHandler가 초기화되었는지 확인 후 로그
					if (ErrorHandler && typeof ErrorHandler.debugLog === 'function') {
						ErrorHandler.debugLog('Configuration loaded successfully', this._config);
					} else {
						console.log('✓ Configuration loaded successfully');
					}
				} catch (error) {
					// ErrorHandler가 초기화되었는지 확인 후 에러 처리
					if (ErrorHandler && typeof ErrorHandler.handleError === 'function') {
						ErrorHandler.handleError(error, {
							category: 'Configuration',
							severity: 'medium',
							context: 'Config file loading',
							details: {
								configPath: this._configPath,
								error: error.message
							}
						});
					} else {
						console.warn('⚠️ Config file not found or invalid, using default configuration:', error.message);
					}
					
					// Set fallback configuration
					this._config = this._getFallbackConfig();
					this._configLoaded = true;
					
					// 사전 기능은 기본적으로 비활성화
					this._validateDictionaryConfiguration();
					
					// fallback config 리소스 적용
					this._applyConfigResources();
				}
			}

			/**
			 * 스타일시트가 없으면 자동 주입합니다 ("1줄 설치" 지원)
			 * @private
			 * @description 호스트가 직접 추가한 <link>(webAccTools*.css)나 standalone 인라인
			 *              스타일(#wat-inline-style)이 있으면 중복 주입하지 않는다.
			 *              스크립트 위치(basePath) 기준으로 dist/assets 구조를 가정한다.
			 *              options.injectCss === false 로 완전히 끌 수 있다 (커스텀 CSS 사용자용).
			 *              (styleCssPath 옵션은 manual 모드의 사이트 커스텀 CSS 용도라 여기서 사용하지 않음)
			 */
			_ensureStylesheet() {
				if (this.options && this.options.injectCss === false) return;
				if (document.querySelector('link[href*="webAccTools.css"], link[href*="webAccTools.min.css"], #wat-inline-style')) {
					return; // 이미 로드됨 — 기존 수동 <link> 사용자와의 충돌 방지
				}
				if (!basePath) return; // 스크립트 출처를 알 수 없으면 주입하지 않음 (기존 동작 유지)
				const href = `${basePath}assets/css/webAccTools.css`;

				const link = document.createElement('link');
				link.id = 'wat-style-link';
				link.rel = 'stylesheet';
				link.href = href;
				document.head.appendChild(link);
			}

			/**
			 * 설정 로딩이 완료될 때까지 대기
			 * @private
			 */
			async _waitForConfigurationLoad() {
				// 이미 로드되었다면 즉시 반환
				if (this._configLoaded) {
					return;
				}

				// 최대 5초까지 기다림
				const maxWaitTime = 5000;
				const checkInterval = 100;
				let elapsed = 0;

				return new Promise((resolve) => {
					const checkConfig = () => {
						if (this._configLoaded || elapsed >= maxWaitTime) {
							if (!this._configLoaded) {
								console.warn('⚠️ Configuration loading timeout, using default configuration');
								this._config = this._getFallbackConfig();
								this._configLoaded = true;
								this._validateDictionaryConfiguration();
							}
							resolve();
						} else {
							elapsed += checkInterval;
							setTimeout(checkConfig, checkInterval);
						}
					};
					checkConfig();
				});
			}

			/**
			 * Merges two configuration objects deeply
			 * @private
			 * @param {Object} fallback - Fallback configuration
			 * @param {Object} loaded - Loaded configuration
			 * @returns {Object} Merged configuration
			 */
			_mergeConfigurations(fallback, loaded) {
				const merge = (target, source) => {
					const result = { ...target };
					
				for (const key of Object.keys(source)) {
					// 프로토타입 오염 방지 — 외부 config의 위험 키는 병합하지 않음
					if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
						continue;
					}
					if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
						result[key] = merge(target[key] || {}, source[key]);
					} else {
						result[key] = source[key];
					}
				}
					
					return result;
				};
				
				return merge(fallback, loaded);
			}

			/**
			 * Validates dictionary configuration and enables/disables dictionary feature
			 * @private
			 */
			_validateDictionaryConfiguration() {
				if (!this._config.api) {
					this._config.api = {};
				}
				if (!this._config.api.dictionary) {
					this._config.api.dictionary = this._getFallbackConfig().api.dictionary;
					return;
				}
				
				const hasServerEndpoint = this._config.api.dictionary.serverEndpoint &&
					this._config.api.dictionary.serverEndpoint.trim() !== '';
				
				if (hasServerEndpoint) {
					// 서버 엔드포인트가 설정되어 있으면 사전 기능 활성화
					this._config.api.dictionary.enabled = true;
					
					// 기본 프로바이더 활성화
					if (this._config.api.dictionary.providers && this._config.api.dictionary.providers.naver) {
						this._config.api.dictionary.providers.naver.enabled = true;
					}
					
					// 활성화된 프로바이더 목록 업데이트
					this._config.api.dictionary.enabledProviders = ["naver"];
					
					ErrorHandler.debugLog('Dictionary feature enabled', {
						serverEndpoint: this._config.api.dictionary.serverEndpoint
					});
				} else {
					// 서버 엔드포인트가 없으면 사전 기능 비활성화
					this._config.api.dictionary.enabled = false;
					this._config.api.dictionary.enabledProviders = [];
					
					if (this._config.api.dictionary.providers) {
						Object.keys(this._config.api.dictionary.providers).forEach(provider => {
							this._config.api.dictionary.providers[provider].enabled = false;
						});
					}
					
					ErrorHandler.debugLog('Dictionary feature disabled - no server endpoint configured');
				}
			}

			/**
			 * Gets configuration value by dot notation path
			 * @param {string} path - Configuration path (e.g., 'dictionary.providers.naver.endpoint')
			 * @param {*} defaultValue - Default value if not found
			 * @returns {*} Configuration value
			 * @example
			 * const endpoint = this.getConfigValue('dictionary.providers.naver.endpoint');
			 * const cacheEnabled = this.getConfigValue('dictionary.behavior.cacheResults', true);
			 */
			getConfigValue(path, defaultValue = null) {
				if (!this._config) {
					return defaultValue;
				}
				
				const keys = path.split('.');
				let value = this._config;
				
				for (const key of keys) {
					if (value && typeof value === 'object' && key in value) {
						value = value[key];
					} else {
						return defaultValue;
					}
				}
				
				return value;
			}

			/**
			 * config에서 외부 리소스 URL을 읽어 FONT_FAMILY_OPTIONS 등 정적 데이터에 반영합니다.
			 * _loadConfiguration() 완료 직후 호출됩니다.
			 * @private
			 */
			_applyConfigResources() {
				// 폰트 URL 오버라이드 — config 유래 URL은 https/http 스킴만 허용
				const applyFontUrl = (configKey, fontKey) => {
					const url = this.getConfigValue(configKey, null);
					if (!url || !WAT.FONT_FAMILY_OPTIONS[fontKey]) return;
					if (!isSafeHttpUrl(url)) {
						console.warn(`[WAT] ${configKey}의 폰트 URL 스킴이 유효하지 않아 무시합니다:`, url);
						return;
					}
					WAT.FONT_FAMILY_OPTIONS[fontKey].url = url;
				};
				applyFontUrl('resources.fonts.nanumMyeongjo', 'nanum-myeongjo');
				applyFontUrl('resources.fonts.notoSerifKR', 'noto-serif-kr');
				applyFontUrl('resources.fonts.koddiUdonGothic', 'koddi-udon-gothic');
			}

			/**
			 * Returns fallback configuration when config file fails to load
			 * @private
			 * @returns {Object} Fallback configuration
			 */
			_getFallbackConfig() {
				return {
					// API 설정
					api: {
						dictionary: {
							enabled: false, // 기본적으로 비활성화
							defaultProvider: "naver",
							enabledProviders: [],
							serverEndpoint: null, // config.json에서 설정되어야 함
							timeout: 5000,
							providers: {
								naver: {
									enabled: false,
									displayName: "네이버 사전",
									description: "네이버 백과사전 검색"
								}
							}
						}
					},
				// 외부 리소스 URL 설정
				resources: {
					fonts: {
						nanumMyeongjo: "https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&display=swap",
						notoSerifKR: "https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap",
						// materialIcons는 v2.0.2부터 deprecated — 아이콘이 번들 SVG로 포함됨
						koddiUdonGothic: null
					}
				},
				// 브랜딩 설정
				branding: {
					copyrightUrl: "https://www.dcu.ac.kr"
				},
				// Settings 설정
				settings: {
					ui: {
						modalWidth: 600,
						showPronunciation: true,
						autoClose: false
					},
					behavior: {
						autoSearch: false,
						cacheResults: true,
						maxCacheSize: 100
					},
					language: {
						defaultLanguage: "ko",
						supportedLanguages: ["ko", "en"]
					},
					accessibility: {
						highContrast: false,
						largeText: false,
						screenReader: true
					}
				}
			};
		}

			/**
			 * Waits for configuration to be loaded
			 * @private
			 * @returns {Promise<void>}
			 */
			async _waitForConfig() {
				if (this._configLoaded) {
					return;
				}
				
				// Wait for config to load with timeout
				const timeout = 3000; // 3 seconds
				const start = Date.now();
				
				while (!this._configLoaded && (Date.now() - start) < timeout) {
					await new Promise(resolve => setTimeout(resolve, 50));
				}
				
				if (!this._configLoaded) {
					ErrorHandler.debugLog('Configuration loading timeout, using fallback');
					this._config = this._getFallbackConfig();
					this._configLoaded = true;
				}
			}

			// ========== Dictionary (Dictionary 모듈 위임) ==========

			/**
			 * 사전 검색을 수행합니다 — Dictionary 위임 래퍼 (하위 호환)
			 * @param {string} word - 검색할 단어
			 * @returns {Promise<void>}
			 */
			async performDiction(word) {
				return this.dictionary.performDiction(word);
			}

			/**
			 * 사전 결과 모달을 표시합니다 — Dictionary 위임 래퍼
			 * @param {Object} item - 검색 결과 항목
			 * @returns {void}
			 */
			displayDictionResult(item) {
				this.dictionary.displayDictionResult(item);
			}

			/**
			 * 사전 기능을 켜거나 끕니다 — Dictionary 위임 래퍼
			 * @returns {void}
			 */
			toggleDiction() {
				this.dictionary.toggleDiction();
			}

			/**
			 * 모든 사전 결과 레이어를 제거합니다 — Dictionary 위임 래퍼 (cleanup 경로)
			 * @returns {void}
			 */
			removeAllDictionLayers() {
				this.dictionary.removeAllDictionLayers();
			}

			// ========== Page Structure      ==========

		/**
		 * 페이지 구조 다이얼로그를 엽니다 — PageStructure 위임 래퍼 (하위 호환)
		 * @returns {void}
		 */
		openPageStructure() {
			this.pageStructure.openPageStructure();
		}

		/**
		 * 페이지 구조 다이얼로그를 닫습니다 — PageStructure 위임 래퍼 (cleanup 경로)
		 * @returns {void}
		 */
		closePageStructure() {
			this.pageStructure.closePageStructure();
		}


			/**
			 * Sets up focus trapping for modal dialogs with keyboard navigation (키보드 탐색이 있는 모달 다이얼로그를 위한 포커스 트래핑을 설정합니다)
			 * @param {HTMLElement} layer - Modal dialog container element (모달 다이얼로그 컨테이너 요소)
			 * @param {HTMLElement} previousFocusedElement - Element that had focus before modal opened (모달 열기 전 포커스를 가진 요소)
			 * @param {HTMLElement} overlay - Modal overlay background element (모달 오버레이 배경 요소)
			 * @returns {void}
			 * @description Implements focus trapping with Tab/Shift+Tab cycling and Escape key support for modal accessibility
			 *              (모달 접근성을 위해 Tab/Shift+Tab 순환과 Escape 키 지원으로 포커스 트래핑을 구현합니다)
			 * @example
			 * // Setup focus trap for modal (모달용 포커스 트랩 설정)
			 * this.trapFocus(modalElement, previousElement, overlayElement);
			 */
			trapFocus(layer, previousFocusedElement, overlay) {
				// 포커스 트랩·Escape 닫기·오버레이 정리는 OverlayManager로 통합됨 (Phase 6-8).
				// prototype 단독 호출(.call({}, …)) 테스트에서도 동작하도록 지연 생성.
				if (!this.overlayManager) this.overlayManager = new OverlayManager(this);
				return this.overlayManager.trap(layer, previousFocusedElement, overlay);
			}


			// ========== Text-to-Speech(TTS) ==========

			/**
			 * Extracts focusable elements from the specified element for TTS processing (TTS 처리를 위해 지정된 요소에서 포커스 가능한 요소들을 추출합니다)
			 * @param {HTMLElement} element - Element to extract focusable elements from (포커스 가능한 요소를 추출할 요소)
			 * @returns {void}
			 * @description Finds and stores all focusable elements that can be read by TTS, excluding hidden and disabled elements
			 *              (TTS로 읽을 수 있는 모든 포커스 가능한 요소를 찾아 저장하며, 숨겨진 요소와 비활성화된 요소는 제외합니다)
			 * @example
			 * // Extract focusable elements from document body (문서 본문에서 포커스 가능한 요소 추출)
			 * this.extractFocusableElements(document.body);
			 */
			extractFocusableElements(element) {
				const focusableElements = [
					'a[href]:not([tabindex="-1"]):not(.no-speech *):not(.blind *)',
					'area[href]:not(.no-speech *):not(.blind *)',
					'button:not([disabled]):not(.no-speech *):not(.blind *)',
					'input:not([disabled]):not([type="hidden"]):not(.no-speech *):not(.blind *)',
					'select:not([disabled]):not(.no-speech *):not(.blind *)',
					'textarea:not([disabled]):not(.no-speech *):not(.blind *)',
					'iframe:not(.no-speech *):not(.blind *)',
					'object:not(.no-speech *):not(.blind *)',
					'embed:not(.no-speech *):not(.blind *)',
					'[contenteditable]:not([tabindex="-1"]):not(.no-speech *):not(.blind *)',
					'[tabindex]:not([tabindex="-1"]):not(.no-speech *):not(.blind *)',
					'.ttsElm:not(.no-speech *):not(.blind *)'
				];

				// 모든 포커스 가능한 요소들을 검색하고 배열로 변환
				// 전달받은 element를 검색 루트로 사용 (기존에는 인자를 무시하고 항상 document 전체를 검색했음)
				const searchRoot = element || document;
				const combinedSelector = focusableElements.join(', ');
				const focusableNodes = Array.from(searchRoot.querySelectorAll(combinedSelector)).filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);

				// Clear existing TTS elements and add new ones
				this.state.set('tts.elements', []);

				// 반환된 요소들 중 실제로 포커스 가능한지 추가 검증
				focusableNodes.forEach(el => {
					const currentElements = this.state.get('tts.elements');
					this.state.set('tts.elements', [...currentElements, el]);
				});
			}


		/**
		 * 요소의 낭독용 텍스트를 생성합니다 — TextExtractor 위임 래퍼 (하위 호환)
		 * @param {HTMLElement} element - 대상 요소
		 * @param {string} tagName - 요소 태그명 (소문자)
		 * @returns {string} 낭독용 텍스트
		 */
		generateTextToRead(element, tagName) {
			return this.textExtractor.generateTextToRead(element, tagName);
		}


			// ========== Speech-to-Text(STT) ==========

			/**
			 * Starts speech-to-text recognition and processes voice commands (음성 텍스트 변환 인식을 시작하고 음성 명령을 처리합니다)
			 * @returns {void}
			 * @description Initializes speech recognition, sets up event handlers, and processes recognized speech commands for accessibility control
			 *              (음성 인식을 초기화하고, 이벤트 핸들러를 설정하며, 접근성 제어를 위한 인식된 음성 명령을 처리합니다)
			 * @example
			 * // Start speech recognition (음성 인식 시작)
			 * this.stt_start();
			 * 
			 * // Voice commands examples (음성 명령 예제)
			 * // "이동 메뉴" - Navigate to menu element (메뉴 요소로 이동)
			 * // "링크 홈페이지" - Click homepage link (홈페이지 링크 클릭)
			 * // "설정 켜기" - Enable settings (설정 활성화)
			 */
			/**
			 * Starts speech-to-text recognition using the new STT Manager (새로운 STT Manager를 사용하여 음성 텍스트 변환 인식을 시작합니다)
			 * @method stt_start
			 * @memberof WAT
			 * @description Delegates speech recognition to the STT Manager for better organization and reusability
			 * @example
			 * // Start speech recognition (음성 인식 시작)
			 * this.stt_start();
			 * 
			 * @since 2.0.0 - Refactored to use STT Manager
			 */
			stt_start() {
				this.sttManager.toggleVoiceCommand();
			}

			// ========== iframe (IframeStyler 위임) ==========

			/**
			 * 스타일 변경을 iframe들에 동기화합니다 — IframeStyler 위임 래퍼 (하위 호환)
			 * @param {string} styleType - 스타일 타입
			 * @param {string} value - 값
			 * @returns {void}
			 */
			syncStyleToIframes(styleType, value) {
				this.iframeStyler.syncStyleToIframes(styleType, value);
			}

			/**
			 * iframe 처리(기존 적용 + 신규 감시)를 시작합니다 — IframeStyler 위임 래퍼
			 * @returns {void}
			 */
			setupIframeHandling() {
				this.iframeStyler.setupIframeHandling();
			}

			/**
			 * iframe들에 주입된 CSS를 제거합니다 — IframeStyler 위임 래퍼 (cleanup 경로)
			 * @returns {void}
			 */
			removeInjectedCSS() {
				this.iframeStyler.removeInjectedCSS();
			}

			/**
			 * Sets up font size protection for plugin UI elements (플러그인 UI 요소의 폰트 크기 보호를 설정합니다)
			 * @returns {void}
			 * @description Ensures plugin UI elements maintain their font size regardless of global font size changes
			 *              (전역 폰트 크기 변경에 관계없이 플러그인 UI 요소가 폰트 크기를 유지하도록 보장합니다)
			 * @example
			 * // Setup font size protection on plugin initialization
			 * this.setupFontSizeProtection();
			 */
			setupFontSizeProtection() {
				// 단순히 CSS 변수만 고정하여 플러그인 UI가 전역 폰트 크기 변경에 영향받지 않도록 함
				try {
					const containers = [
						document.getElementById('watContainer'),
						document.getElementById('watWrap'),
						document.getElementById('wat')
					].filter(el => el);

					containers.forEach(container => {
						// CSS 변수만 고정 - 기존 CSS에서 var(--wat-font-size) 사용하는 구조 유지
						container.style.setProperty('--wat-font-size', '16px', 'important');
						container.style.setProperty('--wat-line-height', '1.5', 'important');
					});
				} catch (error) {
					console.warn('[WAT] Font size protection setup warning:', error);
				}
			}


			/**
			 * Shows a notification message to the user (사용자에게 알림 메시지를 표시합니다)
			 * @param {string} message - Message text to display (표시할 메시지 텍스트)
			 * @param {number} [duration=3000] - Duration to show notification in milliseconds (알림을 표시할 시간(밀리초))
			 * @returns {void}
			 * @description Creates a temporary notification element that automatically disappears after the specified duration
			 *              (지정된 시간 후 자동으로 사라지는 임시 알림 요소를 생성합니다)
			 * @example
			 * // Show notification with default duration (기본 시간으로 알림 표시)
			 * this.showNotification('Settings saved successfully');
			 * 
			 * // Show notification with custom duration (커스텀 시간으로 알림 표시)
			 * this.showNotification('Error occurred', 5000);
			 */
			showNotification(message, duration = Constants.TIMING.NOTIFICATION_DURATION) {
				// _notify 위임 래퍼 — wat-notification 클래스는 기존 CSS/정리 로직 호환용으로 유지
				this._notify(message, { type: 'info', duration, extraClass: 'wat-notification' });
			}

			/**
			 * Cleans up DOM elements created by the plugin (플러그인에 의해 생성된 DOM 요소들을 정리합니다)
			 * @returns {void}
			 * @description Removes all dynamically created elements like notifications, layers, guides, and temporary styling elements
			 *              (알림, 레이어, 가이드, 임시 스타일링 요소 등 동적으로 생성된 모든 요소를 제거합니다)
			 * @example
			 * // Clean up DOM elements during plugin shutdown (플러그인 종료 시 DOM 요소 정리)
			 * this._cleanupDOMElements();
			 * @private
			 */
			_cleanupDOMElements() {
				// 생성된 레이어들 제거
				this.removeAllDictionLayers();
				this.closePageStructure();
				this.removeReadingGuide();
				
				// 포커스 TTS가 부여한 tabindex 원복
				document.querySelectorAll('[data-wat-tabindex-added]').forEach(el => {
					el.removeAttribute('tabindex');
					delete el.dataset.watTabindexAdded;
				});

				// 생성된 스타일 요소들 제거 — TTS 래퍼는 호스트 페이지의 원본 텍스트를 감싸고 있으므로
				// 통째로 제거하지 않고 unwrap(자식을 부모로 이동 후 래퍼만 제거)해야 함
				document.querySelectorAll(Constants.DOM_SELECTORS.NOTIFICATION_AND_TTS).forEach(el => {
					if (el.classList.contains('wat-tts_wrapper')) {
						const parent = el.parentNode;
						if (parent) {
							while (el.firstChild) {
								parent.insertBefore(el.firstChild, el);
							}
							parent.normalize();
						}
					}
					el.remove();
				});
			}


			/**
			 * Safe method execution with error handling
			 * @param {Function} method - Method to execute
			 * @param {Array} args - Arguments to pass to the method
			 * @param {string} context - Context description for error messages
			 * @returns {*} Method result or null if error occurred
			 * @private
			 */
			_safeExecute(method, args = [], context = 'method execution') {
				try {
					return method.apply(this, args);
				} catch (error) {
					this._log('error', `Error in ${context}`, error);
					return null;
				}
			}

			/**
			 * Centralized logging utility
			 * @param {string} level - Log level ('error', 'warn', 'info', 'debug')
			 * @param {string} message - Log message
			 * @param {*} data - Additional data to log
			 * @private
			 */
			_log(level, message, data = null) {
				const prefix = Constants.LOG_PREFIXES[level.toUpperCase()] || '[WAT]';
				const logMethod = console[level] || console.log;
				
				if (data !== null) {
					logMethod(`${prefix} ${message}`, data);
				} else {
					logMethod(`${prefix} ${message}`);
				}
			}

			/**
			 * TTS 속도 설정
			 * [Eng] Set TTS Speech Rate
			 * @param {number} rate - 속도 값 (0.1-10 범위)
			 */
			setTTSSpeechRate(rate) {
				if (this.ttsManager) {
					this.ttsManager.setSpeechRate(rate);
				}
			}

			/**
			 * TTS 속도 가져오기
			 * [Eng] Get TTS Speech Rate
			 * @returns {number} 현재 TTS 속도 값
			 */
			getTTSSpeechRate() {
				return this.ttsManager ? this.ttsManager.getSpeechRate() : 1.6;
			}


			/**
			 * STT 언어 설정
			 * [Eng] Set STT Language
			 * @param {string} language - 언어 코드 (예: 'ko-KR', 'en-US')
			 */
			setSTTLanguage(language) {
				if (this.sttManager) {
					this.sttManager.setLanguage(language);
				}
			}

			/**
			 * STT 언어 가져오기
			 * [Eng] Get STT Language
			 * @returns {string} 현재 STT 언어 코드
			 */
			getSTTLanguage() {
				return this.sttManager ? this.sttManager.getLanguage() : 'ko-KR';
			}

			/**
			 * Toggle Voice Command (음성 명령 토글)
			 */
			toggleVoiceCommand() {
				if (this.sttManager) {
					this.sttManager.toggleVoiceCommand();
				}
			}

			/**
			 * STT 상태 정보 가져오기
			 * [Eng] Get STT Status Information
			 * @returns {Object} STT 상태 정보
			 */
			getSTTStatus() {
				return this.sttManager ? this.sttManager.getStatus() : {
					currentState: 'inactive',
					isActive: false,
					config: {}
				};
			}

			/**
			 * Stop All STT Functions (모든 STT 기능 중지)
			 */
			stopAllSTT() {
				if (this.sttManager) {
					this.sttManager._stopAllSTT();
				}
			}

	}

	/**
	 * @fileoverview script 태그 data-속성 기반 자동 초기화 — "1줄 설치" 지원
	 * @module src/core/autoInit
	 * @description
	 *   <script src=".../webAccTools.js" data-wat-auto></script> 한 줄만으로
	 *   초기화 코드 없이 도구를 삽입할 수 있게 한다. 속성이 없으면 아무 동작도 하지
	 *   않으므로 기존 수동 초기화(new WAT(...)) 사용자는 영향받지 않는다 (opt-in).
	 *
	 *   지원 속성:
	 *   - data-wat-auto              자동 초기화 활성화 (필수 스위치)
	 *   - data-wat-config="..."      config.json 경로(스크립트 위치 기준) 또는 인라인 JSON('{'로 시작)
	 *   - data-wat-language="ko"     기본 언어
	 *   - data-wat-container="#id"   컨테이너 셀렉터
	 *   - data-wat-inject-css="false" CSS 자동 주입 끄기
	 */

	/**
	 * script 태그의 data-wat-* 속성을 WAT 생성자 옵션으로 변환합니다
	 * @param {HTMLScriptElement} script - 속성을 읽을 script 요소
	 * @returns {Object} WAT 생성자 옵션 객체
	 */
	function parseAutoInitOptions(script) {
		const options = {};

		const rawConfig = script.getAttribute('data-wat-config');
		if (rawConfig) {
			const trimmed = rawConfig.trim();
			if (trimmed.startsWith('{')) {
				// 인라인 JSON — 서버에 config.json을 두지 않고도 설정 가능
				try {
					options.config = JSON.parse(trimmed);
				} catch (error) {
					console.warn('[WAT] data-wat-config 인라인 JSON 파싱 실패 — 기본 설정으로 진행합니다:', error.message);
				}
			} else {
				// 경로는 스크립트 위치 기준으로 해석 — 하위 페이지에서의 상대 경로 404 방지 (watInit.js와 동일)
				try {
					options.configPath = new URL(trimmed, script.src || document.baseURI).href;
				} catch (error) {
					options.configPath = trimmed;
				}
			}
		}

		const language = script.getAttribute('data-wat-language');
		if (language) {
			options.language = language;
		}

		const container = script.getAttribute('data-wat-container');
		if (container) {
			options.containerSelector = container;
		}

		if (script.getAttribute('data-wat-inject-css') === 'false') {
			options.injectCss = false;
		}

		return options;
	}

	/**
	 * script에 data-wat-auto 속성이 있으면 DOM 준비 후 WAT를 자동 초기화합니다
	 * @param {HTMLScriptElement|null} script - document.currentScript (모듈 로드 시점에 캡처)
	 * @param {Function} WATClass - WAT 생성자
	 * @returns {boolean} 자동 초기화가 예약/실행되었으면 true
	 */
	function maybeAutoInit(script, WATClass) {
		if (typeof window === 'undefined' || typeof document === 'undefined') return false;
		if (!script || typeof script.hasAttribute !== 'function' || !script.hasAttribute('data-wat-auto')) {
			return false;
		}

		const start = () => {
			// watInit.js 등 다른 경로로 이미 초기화됐으면 중복 인스턴스를 만들지 않음
			if (window.watPlugin) {
				console.warn('[WAT] 이미 초기화된 인스턴스(window.watPlugin)가 있어 자동 초기화를 건너뜁니다.');
				return;
			}
			try {
				const instance = new WATClass(parseAutoInitOptions(script));
				window.watPlugin = instance; // watInit.js와 동일한 전역 핸들
				instance.init();
			} catch (error) {
				console.error('[WAT] 자동 초기화에 실패했습니다:', error);
			}
		};

		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', start, { once: true });
		} else {
			start();
		}
		return true;
	}

	/**
	 * @fileoverview WAT (Web Accessibility Tool) 진입점
	 * @version 2.1.0
	 */

	// 전역에 등록 (기존 동작 유지)
	if (typeof window !== 'undefined') {
		if (window.WAT) {
			console.warn('WAT is already defined. Duplicate script include detected.');
		} else {
			try {
				window.WAT = WAT;
			} catch (error) {
				console.error('Failed to register WAT globally:', error);
			}
		}
	}

	// "1줄 설치" — <script src=".../webAccTools.js" data-wat-auto></script>
	// IIFE 번들은 동기 실행되므로 이 시점의 document.currentScript가 로드한 script 태그다
	if (typeof document !== 'undefined') {
		maybeAutoInit(document.currentScript, WAT);
	}

	exports.ErrorHandler = ErrorHandler;
	exports.STTManager = STTManager;
	exports.StateManager = StateManager;
	exports.TTSManager = TTSManager;
	exports.WAT = WAT;

	return exports;

})({});
//# sourceMappingURL=webAccTools.js.map
