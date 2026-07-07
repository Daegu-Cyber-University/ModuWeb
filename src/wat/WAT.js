/**
 * @fileoverview WAT - Web Accessibility Tool 메인 클래스
 * @module src/wat/WAT
 */
import { Constants, FONT_FAMILY_OPTIONS } from '../core/constants.js';
import { Defaults } from '../core/defaults.js';
import { Localization } from '../core/localization.js';
import { Validation } from '../core/validation.js';
import { ErrorHandler } from '../core/ErrorHandler.js';
import { ContainerManager } from '../core/ContainerManager.js';
import { StyleBatchProcessor } from '../core/StyleBatchProcessor.js';
import { OptionsProcessor } from '../core/OptionsProcessor.js';
import { ConfigurationManager } from '../core/ConfigurationManager.js';
import { StateManager } from './StateManager.js';
import { TTSManager } from '../tts/TTSManager.js';
import { STTManager } from '../stt/STTManager.js';

const WAT_DEBUG_ENABLED = false;

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

// localStorage 등 외부 유래 문자열의 안전한 JSON 파싱 — 손상된 값이 초기화 전체를 중단시키지 않도록
function safeParseJSON(raw, fallback = {}) {
	if (raw === null || raw === undefined) return fallback;
	try {
		return JSON.parse(raw);
	} catch (e) {
		console.warn('[WAT] 저장된 설정 값이 손상되어 기본값을 사용합니다:', e.message);
		return fallback;
	}
}

// HTML 템플릿 문자열에 삽입되는 외부 유래 값(config 라벨 등)의 이스케이프 — XSS 방지
function escapeHTML(value) {
	if (value === null || value === undefined) return '';
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// config 등 외부 유래 URL의 스킴 검증 — javascript: 등 위험 스킴 차단
function isSafeHttpUrl(url) {
	if (typeof url !== 'string' || !url) return false;
	try {
		const parsed = new URL(url, typeof document !== 'undefined' ? document.baseURI : undefined);
		return parsed.protocol === 'https:' || parsed.protocol === 'http:';
	} catch (e) {
		return false;
	}
}

export class WAT {
	// Static property assignments - 이미 추출된 모듈들을 WAT의 정적 속성으로 참조
	static Constants = Constants;
	static Defaults = Defaults;
	static Localization = Localization;
	static Validation = Validation;
	static ErrorHandler = ErrorHandler;
	static ContainerManager = ContainerManager;
	static StyleBatchProcessor = StyleBatchProcessor;
	static OptionsProcessor = OptionsProcessor;
	static ConfigurationManager = ConfigurationManager;
	static FONT_FAMILY_OPTIONS = FONT_FAMILY_OPTIONS;

	/**
	 * Creates a new WAT instance with optional configuration
		 * @constructor
		 * @param {Object} [options={}] - Configuration options for the plugin (플러그인 설정 옵션)
		 * @param {string} [options.containerSelector='body'] - CSS selector for the container element (컨테이너 요소의 CSS 선택자)
		 * @param {string} [options.language='ko'] - Default language for the plugin ('ko' or 'en') (플러그인의 기본 언어)
		 * @param {string} [options.styleCssPath] - Custom path for the style CSS file (스타일 CSS 파일의 커스텀 경로)
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
			
			// Initialize TTS Manager
			this.ttsManager = new TTSManager(this);
			
			// Initialize STT Manager
			this.sttManager = new STTManager(this);
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
					version: (typeof __MODUWEB_VERSION_JSON__ !== 'undefined') ? __MODUWEB_VERSION_JSON__ : 'dev',
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
		 * Performs memory leak detection check (메모리 누수 감지 검사를 수행합니다)
		 * @returns {Object} Detection results (감지 결과)
		 * @description Analyzes tracked resources for potential memory leaks
		 * @private
		 */
		_detectMemoryLeaks() {
			const stats = this._getMemoryUsageStats();
			const issues = [];

			// Check for excessive event listeners
			if (stats.eventListeners.total > 100) {
				issues.push({
					type: 'excessive_event_listeners',
					count: stats.eventListeners.total,
					severity: 'medium'
				});
			}

			// Check for unclosed timers
			if (stats.timers.total > 20) {
				issues.push({
					type: 'excessive_timers',
					count: stats.timers.total,
					severity: 'high'
				});
			}

			// Check for large cache
			if (stats.cache.sizeBytes > 1024 * 1024) { // 1MB
				issues.push({
					type: 'large_cache',
					sizeBytes: stats.cache.sizeBytes,
					sizeMB: (stats.cache.sizeBytes / 1024 / 1024).toFixed(2),
					severity: 'medium'
				});
			}

			// Check browser memory if available
			if (stats.browserMemory) {
				const memoryUsagePercent = (stats.browserMemory.usedJSHeapSize / stats.browserMemory.jsHeapSizeLimit) * 100;
				if (memoryUsagePercent > 80) {
					issues.push({
						type: 'high_memory_usage',
						percentage: memoryUsagePercent.toFixed(2),
						severity: 'high'
					});
				}
			}

			if (issues.length > 0) {
				console.warn('[WAT] Potential memory leaks detected:', issues);
			}

			return {
				issues,
				stats,
				hasLeaks: issues.length > 0
			};
		}

		/**
		 * Migrates storage keys from legacy format to new format (레거시 형식에서 새 형식으로 스토리지 키를 마이그레이션합니다)
		 * 
		 * @private
		 * @since 2025-07-01
		 * @author Jo Yongcheol
		 */
		_migrateStorageKeys() {
			const { STORAGE_KEYS } = Constants;
			
			// Migrate settings from legacy key to new key
			const legacySettings = localStorage.getItem(STORAGE_KEYS.LEGACY_SETTINGS);
			if (legacySettings && !localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
				localStorage.setItem(STORAGE_KEYS.SETTINGS, legacySettings);
			}
			
			// Migrate container from legacy key to new key
			const legacyContainer = localStorage.getItem(STORAGE_KEYS.LEGACY_CONTAINER);
			if (legacyContainer && !localStorage.getItem(STORAGE_KEYS.CONTAINER)) {
				localStorage.setItem(STORAGE_KEYS.CONTAINER, legacyContainer);
			}
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
			
			// Double-check focus detection status (state may change during async execution) (다시 한번 포커스 감지 상태 확인 (비동기 실행 중 상태가 변경될 수 있음))
			if (!this.state.get('tts.focusDetectFlag')) {
				return;
			}
			
			this.tts_handleFocus(e);
		}

		/**
		 * Handles keyboard events for accessibility navigation (접근성 내비게이션을 위한 키보드 이벤트를 처리)
		 * @param {Event} e - Keyboard event object (키보드 이벤트 객체)
		 * @returns {void}
		 * @private
		 */
		_handleKeyDown(e) {
			// 입력 요소에서는 단축키를 가로채지 않음 — 폼에 대문자 T/D/S 입력이 불가능해지는 문제 방지
			const target = e.target;
			if (target && (target.isContentEditable ||
				(typeof target.matches === 'function' && target.matches('input, textarea, select')))) {
				return;
			}
			// Shift + T: 키보드 단축어 TTS
			if (e.shiftKey && e.key.toLowerCase() === 't') {
				e.preventDefault();
				this.ttsManager.executeKeyboardTTS();
			}
			// Shift + D: 사전 검색
			else if (e.shiftKey && e.key.toLowerCase() === 'd') {
				e.preventDefault();
				const selectedText = window.getSelection().toString().trim();
				if (selectedText) {
				this.performDiction(selectedText);
				}
			}
			// Shift + S: STT
			else if (e.shiftKey && e.key.toLowerCase() === 's') {
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
			const languageSettingLabel = this.getLocalizedText('panel.settings.manage.options.language.options.' + this.language);
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
			const mainWrapperElement = this.createElementWithAttrs('aside', { id: 'watWrap' });
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
				localStorage.setItem('watPanelState', 'closed');
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
			const openButtonWrapElement = this.createElementWithAttrs('div', { id: 'wat_btnOpenWrap' });
			const openButtonElement = this.createElementWithAttrs('button', { 
				id: 'wat_btnOpen', 
				class: 'btn_open', 
				'aria-label': this.getLocalizedText('command.open'), 
				title: this.getLocalizedText('command.open') 
			});
			
			openButtonElement.addEventListener('click', () => {
				this.container.classList.remove('hide');
				document.documentElement.dataset.watPanel = 'opened';
				try { localStorage.setItem('watPanelState', 'opened'); } catch (e) {}
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
		_finalizeSetup(tabListContainer) {
			// Register tab click events (탭 클릭 이벤트 등록)
			const tabs = tabListContainer.querySelectorAll(Constants.DOM_SELECTORS.TAB_BUTTONS);
			tabs.forEach(tab => {
				tab.addEventListener('click', (e) => {
					e.preventDefault();
					const tabId = tab.getAttribute('aria-controls');
					this.showTabContent(tabId);
					// history.pushState 제거 — 호스트 페이지 히스토리를 오염시키고 popstate 복원 로직도 없음
				});
			});

			// 초기 탭 상태 설정 — 해시는 wat_ 접두 탭 ID일 때만 사용 (호스트 임의 요소 노출 방지)
			const hashId = location.hash ? location.hash.substring(1) : '';
			const initialTabId = /^wat_[A-Za-z0-9_-]+$/.test(hashId) ? hashId : 'wat_personal';
			this.showTabContent(initialTabId);
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
			let panelState = localStorage.getItem('watPanelState');
			const watContainer = document.getElementById('watContainer');
			
			// Default to 'closed' for first-time visitors (no stored state)
			if (!panelState) {
				panelState = 'closed';
				try { localStorage.setItem('watPanelState', 'closed'); } catch (e) {}
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
		 * Shows specific tab content by tab ID (탭 ID로 특정 탭 콘텐츠를 표시합니다)
		 * @param {string} tabId - ID of the tab content to show (표시할 탭 콘텐츠의 ID)
		 * @returns {void}
		 * @description Hides all tab contents and shows only the specified one
		 *              (모든 탭 콘텐츠를 숨기고 지정된 것만 표시합니다)
		 * @example
		 * // Show personal settings tab (개인 설정 탭 표시)
		 * this.showTabContent('wat_personal_panel');
		 */
		showTabContent(tabId) {
			const contents = document.querySelectorAll('.wat_contWrap');
			contents.forEach(content => {
				content.style.display = 'none';
			});

			const activeContent = document.getElementById(tabId);
			if (activeContent) {
				activeContent.style.display = 'block';
			}
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
			//const wat = viewModeWrap.closest('#wat');
			const wat = document.getElementById(Constants.ELEMENT_IDS.MAIN_WRAP);
			//const isIconMode = viewMode === 'icon';
			const viewModeStr = req_viewMode.toString().toLowerCase();
			const isIconMode = viewModeStr === 'icon' ? true : false;
			document.documentElement.dataset['watViewmode'] = viewModeStr;
			//localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, {viewMode: viewModeStr});
			this.savePreferences();
		}

		// ========== UI SETTINGS PANEL  ==========
		/**
		 * Creates profile settings section in the settings panel (설정 패널에 프로필 설정 섹션을 생성합니다)
		 * @param {HTMLElement} container - Container element to append profile settings (프로필 설정을 추가할 컨테이너 요소)
		 * @returns {void}
		 * @description Creates profile selection UI with toggles and individual setting options for each accessibility profile
		 *              (각 접근성 프로필에 대한 토글과 개별 설정 옵션이 있는 프로필 선택 UI를 생성합니다)
		 * @example
		 * // Create profile settings in a container (컨테이너에 프로필 설정 생성)
		 * this.createProfileSettings(settingsContainer);
		 */
		createProfileSettings(container) {
			const profileSettingTitleElement = this.createElementWithAttrs('h4', { class: 'watSet-group-title' });
			profileSettingTitleElement.textContent = this.getLocalizedText('panel.settings.profile.title');
			container.appendChild(profileSettingTitleElement);

			
			// ************************* Profile Lists .Start *************************
			const profileValues = Defaults.PROFILES;
			const profileContainerElement = this.createElementWithAttrs('div', { id: 'watSetWrap_profile', class: ['watSet-item-container', 'profile-container'] });
			const profileListElement = this.createElementWithAttrs('ul', { class: 'profileLists' });

			for (const profile in profileValues) {
				const profileItemElement = this.createElementWithAttrs('li', { class: 'profileItem' });
				const profileItemContainerElement = this.createElementWithAttrs('fieldset', { class: 'watSet-profile-item-container', 'data-profile': profile });
				const profileItemTitleElement = this.createElementWithAttrs('legend', { class: ['watSet-profile-title', 'profileItemTitle'] });
				const profileItemTitleLabelElement = this.createElementWithAttrs('label', { class: ['watSet-label', 'watSet-profile-title-label', `${profile}`], for: `watSet_profile_button_toggle_${profile}` });
				const profileTitleText = this.getLocalizedText(`panel.settings.profile.options.${profile}.title`);
				profileItemTitleLabelElement.textContent = profileTitleText;
				profileItemTitleElement.appendChild(profileItemTitleLabelElement);

				// ***** Button - Profile Options .Start *****
				const profileOptionsToggleButtonElement = this.createElementWithAttrs('button', { class: ['watSet-button', 'watSet-profile-button-accordion', 'btnType_1'], role: 'switch', 'aria-pressed': 'false', title: `${profileTitleText} ${this.getLocalizedText('tags.button.attr.type.option')}`, 'aria-labelledby': `watSet_profile_Opts_Label_${profile}` });
				const profileOptionsToggleLabelElement = this.createElementWithAttrs('span', { id:`watSet_profile_Opts_Label_${profile}`, class: 'watSet-button-label' });
				profileOptionsToggleLabelElement.textContent = this.getLocalizedText('tags.button.text.optionsOpen');
				profileOptionsToggleButtonElement.appendChild(profileOptionsToggleLabelElement);
				profileOptionsToggleButtonElement.addEventListener('click', (evt) => {
					const targetToggleElement = evt.target.closest('.watSet-profile-button-accordion');
					const profile = targetToggleElement.closest('.watSet-profile-item-container').getAttribute('data-profile');
					const isOn = targetToggleElement.getAttribute('aria-pressed') === 'true';
					const targetLabelElement = targetToggleElement.querySelector('.watSet-button-label');
					targetLabelElement.textContent = isOn ? this.getLocalizedText('tags.button.text.optionsOpen') : this.getLocalizedText('tags.button.text.optionsClose');
					targetToggleElement.setAttribute('aria-pressed', isOn ? 'false' : 'true');
					const profileInner = document.getElementById(`watSet_profile_items_wrap_${profile}`);
					if (isOn) {
						profileInner.classList.remove(Constants.CSS_CLASSES.ACTIVE);
						profileInner.setAttribute('aria-hidden', 'true');
						this._setTimeout(() => {
							targetToggleElement.closest('.watSet-profile-item-container').querySelector('.watSet-profile-button-accordion').focus();
						}, 100);
					} else {
						profileInner.classList.add(Constants.CSS_CLASSES.ACTIVE);
						profileInner.setAttribute('aria-hidden', 'false');
						this._setTimeout(() => {
							const focusableElements = profileInner.querySelectorAll('a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])');
							if (focusableElements.length > 0) {
								focusableElements[0].focus();
							} else {
								console.error("No focusable elements found inside profileInner");
							}
						}, 100);
					}
					targetToggleElement.classList.toggle(Constants.CSS_CLASSES.ACTIVE, !isOn);
					targetToggleElement.setAttribute('aria-disabled', isOn ? 'false' : 'true');
				});
				profileItemTitleElement.appendChild(profileOptionsToggleButtonElement);
				// ***** Button - Profile Options .End   *****

				profileItemContainerElement.appendChild(profileItemTitleElement);

				// ***** Button - Profile Toggle Switch .Start *****
				const profileToggle = this.createElementWithAttrs('button', {
					id: `watSet_profile_button_toggle_${profile}`,
					class: ['watSet-button', 'btn-toggleSwitch', 'profileToggle'],
					role: 'switch',
					'aria-pressed': 'false',
					'data-profile': profile,
					title: `${profileTitleText} ${this.getLocalizedText('tags.button.attr.type.toggle')}`,
					'aria-labelledby': `watSet_profileToggleLabel_${profile}`
				});
				const profileToggleLabel = this.createElementWithAttrs('span', {
					id: `watSet_profileToggleLabel_${profile}`,
					class: 'watSet-button-label'
				});
				profileToggleLabel.textContent = this.getLocalizedText('tags.button.text.stateOff');
				profileToggle.appendChild(profileToggleLabel);
				profileToggle.addEventListener('click', (evt) => {
					const targetToggle = evt.target.closest('.profileToggle');
					const profile = targetToggle.getAttribute('data-profile');
					this.toggleProfile(profile, targetToggle);
				});
				profileItemContainerElement.appendChild(profileToggle);
				// ***** Button - Profile Toggle Switch .End   *****

				// ***** Container - Profile Options .Start *****
				const profileInner = this.createElementWithAttrs('div', { id: `watSet_profile_items_wrap_${profile}`, class: 'watSet-profile-items-wrap' });
				const profileListInner = this.createElementWithAttrs('ul', { class: 'watSet-profile-items-ul' });

				const profileItems = profileValues[profile].settings;
				for (const item in profileItems) {
					//if (!this.options[item]) continue;
					if (this.options[item] === false) continue;

					const profileListItem = this.createElementWithAttrs('li', { class: 'watSet-profile-item-li' });
					const input = this.createElementWithAttrs('input', { type: 'checkbox', class: ['watSet-checkbox', 'profileListItemInput'], id: `watSet_checkbox_${profile}_${item}`, name: `${profile}_${item}`, value: profileItems[item], 'data-key': item });
					input.checked = profileValues[profile].enabled[item];
					const label = this.createElementWithAttrs('label', { class: ['watSet_label', 'watSet-profile-item-label'], for: `watSet_checkbox_${profile}_${item}` });
					label.textContent = this.getLocalizedText(`panel.personal.options.${item}.title`);
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
		 * Creates tools settings section including position, view mode and language options (위치, 뷰 모드, 언어 옵션을 포함한 도구 설정 섹션을 생성합니다)
		 * @param {HTMLElement} container - Container element to append tools settings (도구 설정을 추가할 컨테이너 요소)
		 * @returns {void}
		 * @description Creates management settings UI for tool positioning, view modes, language selection, and storage options
		 *              (도구 위치, 뷰 모드, 언어 선택 및 저장 옵션을 위한 관리 설정 UI를 생성합니다)
		 * @example
		 * // Create tools settings in a container (컨테이너에 도구 설정 생성)
		 * this.createToolsSettings(settingsContainer);
		 */
		createToolsSettings(container) {
			const manageSettingTitle = this.createElementWithAttrs('h4', { class: 'watSet-group-title' });
			manageSettingTitle.textContent = this.getLocalizedText('panel.settings.manage.title');
			container.appendChild(manageSettingTitle);


			// ************************* Tool Position Setting .Start *************************
			const toolPositionContainer = this.createElementWithAttrs('fieldset', { id: 'watSetWrap_position', class: ['watSet-item-container', 'tool-position-container'] });

			const toolPositionSettingTitle = this.createElementWithAttrs('legend', { class: 'watSet-title' });
			toolPositionSettingTitle.textContent = this.getLocalizedText('panel.settings.manage.options.position.title');
			toolPositionContainer.appendChild(toolPositionSettingTitle);

			const toolPositionInner = this.createElementWithAttrs('div', { class: 'watSet-inner' });
			const toolPositionList = this.createElementWithAttrs('ul', { class: 'watSet-list' });
			const toolPositionItems = [
				{ id: 'watSet_postion_left', label: this.getLocalizedText('panel.settings.manage.options.position.options.left'), value: 'left', checked: false },
				{ id: 'watSet_postion_right', label: this.getLocalizedText('panel.settings.manage.options.position.options.right'), value: 'right', checked: true }
			];
			toolPositionItems.forEach(item => {
				const toolPositionItem = this.createElementWithAttrs('li', { class: 'watSet-item' });
				const input = this.createElementWithAttrs('input', { type: 'radio', id: item.id, class: ['wat-set-items', 'wat-set-item-type-radio'], name: 'toolPosition', value: item.value });
				input.checked = item.checked;
				input.onchange = () => {
					//const wat = document.getElementById('wat');
					//wat.classList.remove('left', 'right');
					document.documentElement.dataset['watPosition'] = item.value;
					this.savePreferences();
				};
				const label = this.createElementWithAttrs('label', { for: item.id, class: 'wat-set-label' });
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
			const viewModeContainer = this.createElementWithAttrs('fieldset', { id: 'watSetWrap_viewMode', class: ['watSet-item-container', 'tool-viewMode-container'] });

			const viewModeSettingTitle = this.createElementWithAttrs('legend', { class: 'watSet-title' });
			viewModeSettingTitle.textContent = this.getLocalizedText('panel.settings.manage.options.viewMode.title');
			viewModeContainer.appendChild(viewModeSettingTitle);

			const viewModeSettingInner = this.createElementWithAttrs('div', { class: 'watSet-inner' });
			const viewModeSettingList = this.createElementWithAttrs('ul', { class: 'watSet-list' });
			const viewModeSettingItems = [
				{ id: 'watSet_viewMode_icon', label: this.getLocalizedText('panel.settings.manage.options.viewMode.iconMode.title'), setMode: 'icon', checked: true },
				{ id: 'watSet_viewMode_list', label: this.getLocalizedText('panel.settings.manage.options.viewMode.listMode.title'), setMode: 'list', checked: false }
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
				const viewModeSettingItem = this.createElementWithAttrs('li', { class: 'watSet-item' });
				const input = this.createElementWithAttrs('input', { type: 'radio', id: item.id, class: ['wat-set-items', 'wat-set-item-type-radio'], name: 'viewMode', value: item.setMode });
				//input.checked = item.checked;
				input.checked = viewModeStoredValue ? (item.setMode === viewModeStoredValue) : item.checked;
				input.onchange = () => {
					//document.documentElement.dataset['viewMode'] = item.setMode;
					this.updateViewMode(item.setMode);
				};
				const label = this.createElementWithAttrs('label', { for: item.id, class: 'wat-set-label' });
				label.textContent = item.label;
				viewModeSettingItem.appendChild(input);
				viewModeSettingItem.appendChild(label);
				viewModeSettingList.appendChild(viewModeSettingItem);
			});
			viewModeSettingInner.appendChild(viewModeSettingList);
			viewModeContainer.appendChild(viewModeSettingInner);

			container.appendChild(viewModeContainer);
			//this.updateViewMode('icon');
			// ************************* View Mode Setting .End   *************************
			
			// ************************* Language Setting .Start *************************
			if (this.languageOptions && this.languageOptions.length > 1 && this.languageConfig?.showSelector !== false) {
				const languageContainer = this.createElementWithAttrs('fieldset', { id: 'watSetWrap_language', class: ['watSet-item-container', 'tool-language-container'] });

				const languageSettingTitle = this.createElementWithAttrs('legend', { class: 'watSet-title' });
				languageSettingTitle.textContent = this.getLocalizedText('panel.settings.manage.options.language.title');
				languageContainer.appendChild(languageSettingTitle);

				const languageSettingInner = this.createElementWithAttrs('div', { class: 'watSet-inner' });
				const languageSettingList = this.createElementWithAttrs('ul', { class: 'watSet-list' });
				const languageSettingItems = this.languageOptions.map(lang => {
					return { id: `watSet_language_${lang}`, label: this.getLocalizedText(`panel.settings.manage.options.language.options.${lang}`), lang: lang, checked: this.language === lang };
				});
				languageSettingItems.forEach(item => {
					const languageSettingItem = this.createElementWithAttrs('li', { class: 'watSet-item' });
					const input = this.createElementWithAttrs('input', { type: 'radio', id: item.id, class: ['wat-set-items', 'wat-set-item-type-radio'], name: 'watSet_language', value: item.lang });
					input.checked = item.checked;
					// Language change handler implementation needed
					input.onchange = () => {
						this.language = item.lang;
						document.documentElement.dataset['watLanguage'] = item.lang;
						// 스크린리더가 올바른 언어 엔진으로 UI를 읽도록 문서 lang 갱신 (WCAG 3.1.2)
						document.documentElement.setAttribute('lang', item.lang);
						this.updateLanguageSetting();

						this.loadLocale(item.lang).then(() => {
							this.generateHTMLElements();
							this.setInitialPreferences();

							this.setupTabs();
							this.activateInitialTab();
							this.setEventListeners();
							this.extractFocusableElements(document.body);
							this.updateTextLocalization();
							this.savePreferences();
						});
					};
					const label = this.createElementWithAttrs('label', { for: item.id, class: 'wat-set-label' });
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
			const storageSettingContainer = this.createElementWithAttrs('fieldset', { id: 'watSetWrap_storage', class: ['watSet-item-container', 'storage-container'] });

			const storageSettingTitle = this.createElementWithAttrs('legend', { class: 'watSet-title' });
			storageSettingTitle.textContent = this.getLocalizedText('panel.settings.manage.options.storage.title');

			const storageSettingInner = this.createElementWithAttrs('div', { class: 'watSet-inner' });
			const storageSettingList = this.createElementWithAttrs('ul', { class: ['watSet-list', 'watSet-list-type-button'] });
			const storageSettingItems = [
				{ id: 'watSet_storage_save', class: 'watSet_storage_save', label: this.getLocalizedText('panel.settings.manage.options.storage.options.save'), type: 'button' },
				{ id: 'watSet_storage_reset', class: 'watSet_storage_reset', label: this.getLocalizedText('panel.settings.manage.options.storage.options.delete'), type: 'button' },
				{ id: 'watSet_storage_check', class: 'watSet_storage_check', label: this.getLocalizedText('panel.settings.manage.options.storage.options.check'), type: 'button' }
			];
			storageSettingItems.forEach(item => {
				const storageSettingItem = this.createElementWithAttrs('li', { class: 'watSet-item' });

				const input = this.createElementWithAttrs('input', { type: item.type, id: item.id, class: ['wat-set-items', 'wat-set-item-type-button'], name: 'watSet_storage', value: item.label });
				input.addEventListener('click', () => {
					if (item.id === 'watSet_storage_save') {
						this.savePreferences();
						// 저장 성공 피드백 (기존엔 무피드백이라 저장 여부 불확실)
						this.showNotification(this.getLocalizedText('msg.success.save') || '저장되었습니다.');
					} else if (item.id === 'watSet_storage_reset') {
						// 파괴적 동작이므로 확인 절차 추가
						const confirmMsg = this.getLocalizedText('msg.confirm.reset') || '접근성 설정을 모두 초기화하시겠습니까?';
						if (!window.confirm(confirmMsg)) {
							return;
						}
						// localStorage.clear()는 호스트 사이트의 전체 데이터를 삭제하므로 WAT 키만 개별 삭제
						Object.values(Constants.STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
						// 화면에 즉시 반영되도록 새로고침 (삭제 후 다른 설정 변경 시 savePreferences가 되쓰는 문제도 방지)
						window.location.reload();
					} else if (item.id === 'watSet_storage_check') {
						// WAT 소유 키만 확인 — 호스트 사이트의 전체 localStorage를 덤프하지 않음 (정보 노출 방지)
						const settings = localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS);
						const container = localStorage.getItem(Constants.STORAGE_KEYS.CONTAINER);
						const found = this.getLocalizedText('msg.state.saved') || '있음';
						const notFound = this.getLocalizedText('msg.state.notSaved') || '없음';
						const summary = this.getLocalizedText('msg.info.storageCheck', {
							settings: settings ? found : notFound,
							container: container ? found : notFound
						}) || `저장된 설정: ${settings ? found : notFound}, 컨테이너: ${container ? found : notFound}`;
						this.showNotification(summary);
						if (WAT_DEBUG_ENABLED) {
							console.group('[WAT] Storage (WAT keys only)');
							console.log('settings:', settings);
							console.log('container:', container);
							console.groupEnd();
						}
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

		/**
		 * Creates storage settings section for preference management (환경설정 관리를 위한 저장 설정 섹션을 생성합니다)
		 * @param {HTMLElement} container - Container element to append storage settings (저장 설정을 추가할 컨테이너 요소)
		 * @returns {void}
		 * @description Creates storage management UI for saving, loading, and resetting user preferences
		 *              (사용자 환경설정의 저장, 로드, 리셋을 위한 저장 관리 UI를 생성합니다)
		 * @example
		 * // Create storage settings in a container (컨테이너에 저장 설정 생성)
		 * this.createStorageSettings(settingsContainer);
		 */
		createStorageSettings(container) {
			// Generate save settings options
		}

		/**
		 * Creates a generic settings item with specified type and options (지정된 타입과 옵션으로 일반적인 설정 항목을 생성합니다)
		 * @param {string} itemType - Type of input element ('radio', 'checkbox', 'button', etc.) (입력 요소의 타입)
		 * @param {string} titleText - Title text for the settings item (설정 항목의 제목 텍스트)
		 * @param {string} option_name - Name attribute for the form elements (폼 요소의 name 속성)
		 * @param {Array<Object>} option_items - Array of option configurations (옵션 설정 배열)
		 * @param {Array<Object>} [option_controls] - Optional control configurations (선택적 컨트롤 설정)
		 * @returns {HTMLLIElement} Created list item element with settings UI (설정 UI가 포함된 생성된 리스트 아이템 요소)
		 * @description Creates a flexible settings item that can handle various input types with consistent styling and behavior
		 *              (일관된 스타일과 동작으로 다양한 입력 타입을 처리할 수 있는 유연한 설정 항목을 생성합니다)
		 * @example
		 * // Create radio button settings item (라디오 버튼 설정 항목 생성)
		 * const fontSizeItem = this.createSettingsItem('radio', 'Font Size', 'fontSize', [
		 *   { value: 'small', label: 'Small' },
		 *   { value: 'medium', label: 'Medium' }
		 * ]);
		 */
		createSettingsItem(itemType, titleText, optionName, optionItems, optionControls) {
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
			if (optionControls) {
				const controlsHtml = optionControls.map(control => {
					const controlId = `${optionName}_${control.value}`;
					const controlLabel = control.label;
					const controlChecked = control.checked ? 'checked' : '';
					const controlDisabled = control.disabled ? 'disabled' : '';
					const controlHtml = `
						<li class='opt_item'>
							<input type="${itemType}" id="wat-${itemType}-${controlId}" name="${optionName}" value="${control.value}" ${controlChecked} ${controlDisabled}><label for="wat-${itemType}-${controlId}">${controlLabel}</label>
						</li>
						`;
					return controlHtml;
				}).join('');
			}
			const listItemElement = document.createElement('li');
			// .setTitle은 클릭 시 옵션을 순환/토글하는 버튼이므로 키보드 포커스 가능하게 tabindex 부여 (WCAG 2.1.1)
			let listItemInnerHTML = `
				<div class='setWrap'>
					<div class='setTitle' role='button' tabindex='0'>${titleText}</div>
					<div class='setCont'>
					`;
					if (itemType === 'radio') {
						listItemInnerHTML += `<button class='hidden btn_chgOpt prev' type='button' title="${titleText} ${this.getLocalizedText('tags.button.text.prevOpt')}" aria-label="${titleText} ${this.getLocalizedText('tags.button.text.prevOpt')}">${this.getLocalizedText('tags.button.text.prevOpt')}</button>`;
					}
					// 라디오 묶음에 그룹 시맨틱 부여 — 스크린리더가 그룹명·위치를 안내 (WCAG 1.3.1)
					const listGroupAttr = itemType === 'radio' ? ` role="radiogroup" aria-label="${titleText}"` : '';
					listItemInnerHTML += `<ul class='opt_lists'${listGroupAttr}>${itemsHtml}</ul>`;
					if (itemType === 'radio') {
						listItemInnerHTML += `<button class='hidden btn_chgOpt next' type='button' title="${titleText} ${this.getLocalizedText('tags.button.text.nextOpt')}" aria-label="${titleText} ${this.getLocalizedText('tags.button.text.nextOpt')}">${this.getLocalizedText('tags.button.text.nextOpt')}</button>`;
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

			if (itemType === 'radio') {
				setWrapElement.classList.add('radio');
				const prevButtonElement = setWrapElement.querySelector('.btn_chgOpt.prev');
				const nextButtonElement = setWrapElement.querySelector('.btn_chgOpt.next');
				titleElement.addEventListener('click', () => {
					const radioElements = setWrapElement.querySelectorAll('.setCont input[type="radio"]');
					const nextIndex = this.getRadioTargetIndex(setWrapElement, 'next');

					radioElements[nextIndex].checked = true;
		
					// change 이벤트를 수동으로 트리거
					const event = new Event('change', { bubbles: true });
					radioElements[nextIndex].dispatchEvent(event);
				});
				prevButtonElement.addEventListener('click', () => {
					const radioElements = setWrapElement.querySelectorAll('.setCont input[type="radio"]');
					const prevIndex = this.getRadioTargetIndex(setWrapElement, 'prev');

					if (WAT_DEBUG_ENABLED) {
						console.log(`Prev button clicked - target index: ${prevIndex}, radio count: ${radioElements.length}`);
					}

					radioElements[prevIndex].checked = true;
		
					// change 이벤트를 수동으로 트리거
					const event = new Event('change', { bubbles: true });
					radioElements[prevIndex].dispatchEvent(event);
				});
				nextButtonElement.addEventListener('click', () => {
					const radioElements = setWrapElement.querySelectorAll('.setCont input[type="radio"]');
					const nextIndex = this.getRadioTargetIndex(setWrapElement, 'next');

					if (WAT_DEBUG_ENABLED) {
						console.log(`\n=== NEXT BUTTON CLICKED ===`);
						console.log(`Radio count: ${radioElements.length}`);
						console.log(`Target index: ${nextIndex}`);
						
						// 현재 상태 출력
						radioElements.forEach((radio, index) => {
							console.log(`Radio ${index}: value="${radio.value}", checked=${radio.checked}`);
						});
						
						console.log(`About to check radio ${nextIndex} with value: ${radioElements[nextIndex]?.value}`);
					}

					if (radioElements[nextIndex]) {
						radioElements[nextIndex].checked = true;

						// change 이벤트를 수동으로 트리거
						const event = new Event('change', { bubbles: true });
						radioElements[nextIndex].dispatchEvent(event);
						
						if (WAT_DEBUG_ENABLED) {
							console.log(`Dispatched change event for radio ${nextIndex}`);
						}
					}
				});
			} else if (itemType === 'checkbox') {
				setWrapElement.classList.add('checkbox');
				titleElement.addEventListener('click', () => {
					const checkboxElement = setWrapElement.querySelector('.setCont input[type="checkbox"]');
					checkboxElement.checked = !checkboxElement.checked;
		
					// change 이벤트를 수동으로 트리거
					const event = new Event('change', { bubbles: true });
					checkboxElement.dispatchEvent(event);
				});
				labelElement.addEventListener('click', () => {
					const checkboxElement = setWrapElement.querySelector('.setCont input[type="checkbox"]');
					checkboxElement.checked = !checkboxElement.checked;

					// change 이벤트를 수동으로 트리거
					const event = new Event('change', { bubbles: true });
					checkboxElement.dispatchEvent(event);
				});
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
		 * Creates color theme selection settings (색상 테마 선택 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for color theme selection (색상 테마 선택을 위한 설정 요소)
		 * @description Creates radio button interface for selecting color themes including light, dark, and high contrast modes
		 *              (라이트, 다크, 고대비 모드를 포함한 색상 테마 선택을 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createColorThemeSettings() {
			const optionName = 'colorTheme';
			const optionItems = [
				{ value: 'initial', label: this.getLocalizedText('panel.personal.options.colorMode.options.initial') },
				{ value: 'light', label: this.getLocalizedText('panel.personal.options.colorMode.options.light') },
				{ value: 'dark', label: this.getLocalizedText('panel.personal.options.colorMode.options.dark'), disabled: true },
				{ value: 'reverse', label: this.getLocalizedText('panel.personal.options.colorMode.options.reverse') }
			];
			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.colorMode.title'), optionName, optionItems);
		}

		/**
		 * Creates saturation adjustment settings (채도 조정 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for saturation control (채도 제어를 위한 설정 요소)
		 * @description Creates radio button interface for adjusting color saturation levels for users with color vision deficiencies
		 *              (색각 이상자를 위한 색상 채도 레벨 조정을 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createSaturationSettings() {
			const option_name = 'saturation';
			const option_items = [
				{ value: 'initial', label: this.getLocalizedText('panel.personal.options.saturation.options.initial') },
				{ value: 'low', label: this.getLocalizedText('panel.personal.options.saturation.options.low') },
				{ value: 'high', label: this.getLocalizedText('panel.personal.options.saturation.options.high') },
				{ value: 'monochrome', label: this.getLocalizedText('panel.personal.options.saturation.options.monochrome') }
			];
			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.saturation.title'), option_name, option_items);
		}

		/**
		 * Creates font size adjustment settings (폰트 크기 조정 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for font size control (폰트 크기 제어를 위한 설정 요소)
		 * @description Creates radio button interface for font size selection with configurable ratios and labels
		 *              (설정 가능한 비율과 라벨로 폰트 크기 선택을 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createFontSizeSettings() {
			const optionName = 'fontSize';
			const optionItems = [];

			// 이미 생성자에서 병합된 fontSizeRatios 사용
			for (const [key, ratio] of Object.entries(this.fontSizeRatios)) {
				if (ratio === false) continue;

				// fontSizeOptions에서 추가 설정 확인
				const customConfig = this.options.fontSizeOptions?.[key];
				let label = this.getLocalizedText(`panel.personal.options.fontSize.options.${key}`);
				let checked = false;
				let disabled = false;

				if (typeof customConfig === 'object') {
					label = customConfig.label || label || this.generateFontSizeLabel(key, ratio);
					checked = customConfig.checked === true;
					disabled = customConfig.disabled === true;
				} else {
					label = label || this.generateFontSizeLabel(key, ratio);
				}

				optionItems.push({
					value: key,
					label,
					checked: key === 'initial' ? true : checked,
					disabled
				});
			}

			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.fontSize.title'), optionName, optionItems);
		}

		/**
		 * Creates font family selection settings (폰트 패밀리 선택 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for font family selection (폰트 패밀리 선택을 위한 설정 요소)
		 * @description Creates radio button interface for selecting different font families including web fonts and system fonts
		 *              (웹폰트와 시스템 폰트를 포함한 다양한 폰트 패밀리 선택을 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createFontFamilySettings() {
			const option_name = 'fontFamily';
			const option_items = [];

			// 호출 시 전달된 fontFamily 옵션과 기본 FONT_FAMILY_OPTIONS 병합
			const mergedFontOptions = {
				...WAT.FONT_FAMILY_OPTIONS,
				...this.options.fontFamily
			};

			if (WAT_DEBUG_ENABLED) {
				console.log('Creating font family settings with options:', mergedFontOptions);
			}

			// 병합된 폰트 목록을 순회하며 옵션 생성
			for (const [fontName, fontConfig] of Object.entries(mergedFontOptions)) {
				// 명시적으로 비활성화(false)된 폰트만 제외 — enabled 생략은 활성으로 취급
				if (fontConfig === false || (typeof fontConfig === 'object' && fontConfig.enabled === false)) continue;

				// 웹폰트 URL이 있는 경우 동적으로 로드
				if (typeof fontConfig === 'object' && fontConfig.url) {
					this.loadWebFont(fontConfig.url);
				}

				const optionItem = {
					value: fontName,
					label: this.getLocalizedText(`panel.personal.options.fontFamily.options.${fontName}`) || fontConfig.label || fontName,
					// enabled(표시 여부)와 checked(선택 여부)는 별개 — 기본 선택은 'initial'만
					checked: fontName === 'initial'
				};

				option_items.push(optionItem);

				if (WAT_DEBUG_ENABLED) {
					console.log(`Font option added: ${fontName} - ${optionItem.label}`);
				}
			}

			if (WAT_DEBUG_ENABLED) {
				console.log('Final font option items:', option_items);
			}

			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.fontFamily.title'), option_name, option_items);
		}

		/**
		 * Creates screen scale adjustment settings (화면 배율 조정 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for screen scale control (화면 배율 제어를 위한 설정 요소)
		 * @description Creates radio button interface for adjusting overall screen zoom/scale levels
		 *              (전체 화면 줌/배율 레벨 조정을 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createScreenScaleSettings() {
			const option_name = 'screenScale';
			const option_items = [
				{ value: 'initial', label: this.getLocalizedText('panel.personal.options.screenScale.options.initial') },
				{ value: 'scale-1p2x', label: this.getLocalizedText('panel.personal.options.screenScale.options.scale-1p2x') },
				{ value: 'scale-1p5x', label: this.getLocalizedText('panel.personal.options.screenScale.options.scale-1p5x') },
				{ value: 'scale-2x', label: this.getLocalizedText('panel.personal.options.screenScale.options.scale-2x') }
			];
			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.screenScale.title'), option_name, option_items);
		}

		/**
		 * Creates letter spacing adjustment settings (자간 조정 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for letter spacing control (자간 제어를 위한 설정 요소)
		 * @description Creates radio button interface for adjusting letter spacing to improve text readability
		 *              (텍스트 가독성 향상을 위한 자간 조정을 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createLetterSpacingSettings() {
			const option_name = 'letterSpacing';
			const option_items = [];

			for (const [key, ratio] of Object.entries(this.letterSpacingRatios)) {
				if (ratio === false) continue;

				const customConfig = this.options.letterSpacingOptions?.[key];
				let label = this.getLocalizedText(`panel.personal.options.letterSpacing.options.${key}`);
				let checked = false;
				let disabled = false;

				if (typeof customConfig === 'object') {
					label = customConfig.label || label || this.generateLetterSpacingLabel(key, ratio);
					checked = customConfig.checked === true;
					disabled = customConfig.disabled === true;
				} else {
					label = label || this.generateLetterSpacingLabel(key, ratio);
				}

				option_items.push({
					value: key,
					label,
					checked: key === 'initial' ? true : checked,
					disabled
				});
			}

			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.letterSpacing.title'), option_name, option_items);
		}

		/**
		 * Creates text alignment settings (텍스트 정렬 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for text alignment control (텍스트 정렬 제어를 위한 설정 요소)
		 * @description Creates radio button interface for selecting text alignment options (left, center, right, justify)
		 *              (텍스트 정렬 옵션(좌측, 중앙, 우측, 양쪽 정렬) 선택을 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createTxtAlignSettings() {
			const option_name = 'txtAlign';
			const option_items = [
				{ value: 'initial', label: this.getLocalizedText('panel.personal.options.txtAlign.options.initial') },
				{ value: 'left', label: this.getLocalizedText('panel.personal.options.txtAlign.options.left') },
				{ value: 'center', label: this.getLocalizedText('panel.personal.options.txtAlign.options.center') },
				{ value: 'right', label: this.getLocalizedText('panel.personal.options.txtAlign.options.right') }
			];
			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.txtAlign.title'), option_name, option_items);
		}

		/**
		 * Creates line height adjustment settings (줄간격 조정 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for line height control (줄간격 제어를 위한 설정 요소)
		 * @description Creates radio button interface for adjusting line height to improve text readability
		 *              (텍스트 가독성 향상을 위한 줄간격 조정을 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createLineHeightSettings() {
			const option_name = 'lineHeight';
			const option_items = [];

			for (const [key, ratio] of Object.entries(this.lineHeightRatios)) {
				if (ratio === false) continue;

				const customConfig = this.options.lineHeightOptions?.[key];
				let label = this.getLocalizedText(`panel.personal.options.lineHeight.options.${key}`);
				let checked = false;
				let disabled = false;

				if (typeof customConfig === 'object') {
					label = customConfig.label || label || this.generateLineHeightLabel(key, ratio);
					checked = customConfig.checked === true;
					disabled = customConfig.disabled === true;
				} else {
					label = label || this.generateLineHeightLabel(key, ratio);
				}

				option_items.push({
					value: key,
					label,
					checked: key === 'initial' ? true : checked,
					disabled
				});
			}

			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.lineHeight.title'), option_name, option_items);

		}

		/**
		 * Creates reading guide settings (읽기 가이드 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for reading guide control (읽기 가이드 제어를 위한 설정 요소)
		 * @description Creates radio button interface for enabling reading assistance tools like focus masks and reading lines
		 *              (포커스 마스크와 읽기 라인 같은 읽기 보조 도구 활성화를 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createReadGuideSettings() {
			const option_name = 'readGuide';
			const option_items = [
				{ value: 'unset', label: this.getLocalizedText('panel.personal.options.readGuide.options.unset') },
				{ value: 'mask', label: this.getLocalizedText('panel.personal.options.readGuide.options.mask') },
				{ value: 'underline', label: this.getLocalizedText('panel.personal.options.readGuide.options.underline') },
				{ value: 'bigCursor', label: this.getLocalizedText('panel.personal.options.readGuide.options.bigCursor') }
			];
			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.readGuide.title'), option_name, option_items);
		}

		/**
		 * Creates image display mode settings (이미지 표시 모드 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for image display control (이미지 표시 제어를 위한 설정 요소)
		 * @description Creates radio button interface for controlling how images are displayed (normal, hidden, text conversion)
		 *              (이미지 표시 방법 제어(일반, 숨김, 텍스트 변환)를 위한 라디오 버튼 인터페이스를 생성합니다)
		 */
		createImgDisplayModeSettings() {
			const option_name = 'imgDisplayMode';
			const option_items = [
				{ value: 'initial', label: this.getLocalizedText('panel.personal.options.imgDisplayMode.options.initial') },
				{ value: 'hide', label: this.getLocalizedText('panel.personal.options.imgDisplayMode.options.hide') },
				{ value: 'convert', label: this.getLocalizedText('panel.personal.options.imgDisplayMode.options.convert') }
			];
			return this.createSettingsItem('radio', this.getLocalizedText('panel.personal.options.imgDisplayMode.title'), option_name, option_items);
		}

		/**
		 * Creates media playback control settings (미디어 재생 제어 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for media stop control (미디어 정지 제어를 위한 설정 요소)
		 * @description Creates checkbox interface for stopping/starting all media elements on the page
		 *              (페이지의 모든 미디어 요소 정지/시작을 위한 체크박스 인터페이스를 생성합니다)
		 */
		createMediaStopSettings() {
			const option_name = 'mediaStop';
			const option_items = [
				{ value: 'stop', label: this.getLocalizedText('panel.personal.options.mediaControl.options.stop'), label_toggle: this.getLocalizedText('panel.personal.options.mediaControl.options.play') }
			];
			return this.createSettingsItem('checkbox', this.getLocalizedText('panel.personal.options.mediaControl.title'), option_name, option_items);
		}

		/**
		 * Creates media mute control settings (미디어 음소거 제어 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for media mute control (미디어 음소거 제어를 위한 설정 요소)
		 * @description Creates checkbox interface for muting/unmuting all media elements on the page
		 *              (페이지의 모든 미디어 요소 음소거/음소거 해제를 위한 체크박스 인터페이스를 생성합니다)
		 */
		createMediaMuteSettings() {
			const option_name = 'mediaMute';
			const option_items = [
				{ value: 'mute', label: this.getLocalizedText('panel.personal.options.soundControl.options.mute'), label_toggle: this.getLocalizedText('panel.personal.options.soundControl.options.unmute') }
			];
			return this.createSettingsItem('checkbox', this.getLocalizedText('panel.personal.options.soundControl.title'), option_name, option_items);
		}

		/**
		 * Creates animation control settings (애니메이션 제어 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for animation stop control (애니메이션 정지 제어를 위한 설정 요소)
		 * @description Creates checkbox interface for stopping/starting CSS animations and transitions
		 *              (CSS 애니메이션과 전환 효과 정지/시작을 위한 체크박스 인터페이스를 생성합니다)
		 */
		createStopAniSettings() {
			const option_name = 'stopAni';
			const option_items = [
				{ value: 'stop', label: this.getLocalizedText('panel.personal.options.animationControl.options.stop'), label_toggle: this.getLocalizedText('panel.personal.options.animationControl.options.play') }
			];
			return this.createSettingsItem('checkbox', this.getLocalizedText('panel.personal.options.animationControl.title'), option_name, option_items);
		}

		/**
		 * Creates page scroll control settings (페이지 스크롤 제어 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for page scroll control (페이지 스크롤 제어를 위한 설정 요소)
		 * @description Creates button interface for automatic page scrolling with start/stop and directional controls
		 *              (시작/정지 및 방향 제어가 있는 자동 페이지 스크롤을 위한 버튼 인터페이스를 생성합니다)
		 */
		createPageScrollSettings() {
			const option_name = 'pageScroll';
			const option_items = [
				{ value: 'toggle', label: this.getLocalizedText('panel.personal.options.pageScroll.options.start'), label_toggle: this.getLocalizedText('panel.personal.options.pageScroll.options.stop'), addClass: 'btn_iconSet btn_toggle' },
				//{ value: 'start', label: this.getLocalizedText('options.pageScroll.start'), label_toggle: this.getLocalizedText('options.pageScroll.stop') },
				//{ value: 'stop', label: this.getLocalizedText('options.pageScroll.stop'), disabled: true },
				{ value: 'up', label: this.getLocalizedText('panel.personal.options.pageScroll.options.up'), addClass: 'btn_iconSet btn_up' },
				{ value: 'down', label: this.getLocalizedText('panel.personal.options.pageScroll.options.down'), addClass: 'btn_iconSet btn_down' }
			];
			return this.createSettingsItem('button', this.getLocalizedText('panel.personal.options.pageScroll.title'), option_name, option_items);
		}

		/**
		 * Creates text-to-speech control settings (텍스트 음성 변환 제어 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for TTS control (TTS 제어를 위한 설정 요소)
		 * @description Creates button interface for text-to-speech functionality with playback controls and focus detection
		 *              (재생 제어와 포커스 감지가 있는 텍스트 음성 변환 기능을 위한 버튼 인터페이스를 생성합니다)
		 */
		createTTSSettings() {
			const option_name = 'tts';
			const option_items = [
				{ value: 'toggle', label: this.getLocalizedText('panel.personal.options.tts.options.start'), label_toggle: this.getLocalizedText('panel.personal.options.tts.options.stop'), type: 'button', addClass: 'btn_iconSet btn_toggle' },
				//{ value: 'start', label: this.getLocalizedText('options.tts.start'), type: 'button', addClass: 'btn_iconSet btn_play' },
				//{ value: 'stop', label: this.getLocalizedText('options.tts.stop'), type: 'button', disabled: true },
				{ value: 'prev', label: this.getLocalizedText('panel.personal.options.tts.options.prev'), type: 'button', disabled: true, addClass: 'btn_iconSet btn_prev' },
				{ value: 'next', label: this.getLocalizedText('panel.personal.options.tts.options.next'), type: 'button', disabled: true, addClass: 'btn_iconSet btn_next' },
				{ value: 'focus_toggle', label: `${this.getLocalizedText('panel.personal.options.tts.options.focus-start')}`, type: 'button', addClass: 'btn_iconSet btn_toggle btn_focus' }
				//,{ value: 'focus_stop', label: `${this.getLocalizedText('panel.personal.options.tts.title')} ${this.getLocalizedText('panel.personal.options.tts.options.stop')}`, type: 'button', style: 'display:none;', addClass: 'btn_iconSet btn_close' }
			];
			return this.createSettingsItem('button', this.getLocalizedText('panel.personal.options.tts.title'), option_name, option_items);
		}

		/**
		 * Creates speech-to-text control settings (음성 텍스트 변환 제어 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for STT control (STT 제어를 위한 설정 요소)
		 * @description Creates button interface for speech recognition and voice command functionality
		 *              (음성 인식과 음성 명령 기능을 위한 버튼 인터페이스를 생성합니다)
		 */
		createSTTSettings() {
			const option_name = 'stt';
			const option_items = [
				{ value: 'start', label: this.getLocalizedText('panel.personal.options.stt.options.start'), type: 'button' },
			];
			return this.createSettingsItem('button', this.getLocalizedText('panel.personal.options.stt.title'), option_name, option_items);
		}

		/**
		 * Creates dictionary search control settings (사전 검색 제어 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for dictionary control (사전 제어를 위한 설정 요소)
		 * @description Creates checkbox interface for enabling/disabling dictionary lookup on text selection
		 *              (텍스트 선택 시 사전 검색 활성화/비활성화를 위한 체크박스 인터페이스를 생성합니다)
		 */
		createDictionSettings() {
			const option_name = 'diction';
			const option_items = [
				{ value: 'on', label: this.getLocalizedText('panel.personal.options.diction.options.on'), label_toggle: this.getLocalizedText('panel.personal.options.diction.options.off') }
			];
			return this.createSettingsItem('checkbox', this.getLocalizedText('panel.personal.options.diction.title'), option_name, option_items);
		}

		/**
		 * Creates page structure analysis settings (페이지 구조 분석 설정을 생성합니다)
		 * @returns {HTMLElement} Settings element for page structure control (페이지 구조 제어를 위한 설정 요소)
		 * @description Creates button interface for displaying page structure information (headings, links, etc.)
		 *              (페이지 구조 정보(제목, 링크 등) 표시를 위한 버튼 인터페이스를 생성합니다)
		 */
		createPageStructureSettings() {
			const option_name = 'pageStructure';
			const option_items = [
				{ value: 'show', label: this.getLocalizedText('panel.personal.options.pageStructure.options.show'), label_toggle: this.getLocalizedText('panel.personal.options.pageStructure.options.hide') }
			];
			return this.createSettingsItem('button', this.getLocalizedText('panel.personal.options.pageStructure.title'), option_name, option_items);
		}


		/**
		 * Gets the name of the currently selected accessibility profile (현재 선택된 접근성 프로필의 이름을 가져옵니다)
		 * @returns {string|null} Selected profile name or null if none selected (선택된 프로필명 또는 선택된 것이 없으면 null)
		 * @example
		 * // Get currently active profile (현재 활성 프로필 가져오기)
		 * const profileName = this.getSelectedProfileName();
		 * console.log(profileName); // 'lowVision', 'colorBlindness', 'dyslexia', or null
		 */
		getSelectedProfileName() {
			const activeButton = document.querySelector('.watSet-item-container.profile-container .profileToggle[aria-pressed="true"]');
			if (activeButton) {
				return activeButton.getAttribute('data-profile') || activeButton.textContent.trim();
			}
			return null;
		}

		/**
		 * Applies settings for the specified accessibility profile (지정된 접근성 프로필의 설정을 적용합니다)
		 * @param {string} profileName - Name of the profile to apply ('lowVision', 'colorBlindness', 'dyslexia') (적용할 프로필명)
		 * @returns {void}
		 * @throws {Error} Throws error if profile is not found (프로필을 찾을 수 없으면 에러 발생)
		 * @description Applies profile settings based on checked options and validates that at least one option is selected
		 *              (체크된 옵션을 기반으로 프로필 설정을 적용하며 최소 하나의 옵션이 선택되었는지 검증합니다)
		 * @example
		 * // Apply low vision profile settings (저시력자용 프로필 설정 적용)
		 * this.applyProfileSettings('lowVision');
		 */
		applyProfileSettings(profileName) {
			const profileDefault = Defaults.PROFILES[profileName];
			if (!profileDefault) {
				console.warn(this.getLocalizedText('msg.warning.profileNotFound', { profileName: profileName }));
				return;
			}
			// 정적 기본값(Defaults.PROFILES)을 UI 상태로 직접 변이하면 세션 내내 기본값이 오염되므로 복사본 사용
			const profileData = {
				settings: { ...profileDefault.settings },
				enabled: { ...profileDefault.enabled }
			};
			
			// Reset accessibility settings to default when switching profiles, maintain view mode/position (프로필 전환 시 접근성 설정들을 기본값으로 초기화하고 보기모드/위치는 유지)
			const currentSettings = {
				// 접근성 설정들은 기본값으로 초기화
				fontSize: Defaults.SETTINGS.fontSize,
				fontFamily: Defaults.SETTINGS.fontFamily,
				screenScale: Defaults.SETTINGS.screenScale,
				txtAlign: Defaults.SETTINGS.txtAlign,
				letterSpacing: Defaults.SETTINGS.letterSpacing,
				lineHeight: Defaults.SETTINGS.lineHeight,
				colorTheme: Defaults.SETTINGS.colorTheme,
				saturation: Defaults.SETTINGS.saturation,
				readGuide: Defaults.SETTINGS.readGuide,
				imgDisplayMode: Defaults.SETTINGS.imgDisplayMode,
				// 도구 관련 설정들은 현재 사용자 설정 유지
				viewMode: document.documentElement.dataset.watViewmode || Defaults.SETTINGS.viewMode,
				toolPosition: document.documentElement.dataset.watPosition || Defaults.SETTINGS.toolPosition
			};
			
			const effectiveSettings = { ...currentSettings };

			const profileCheckboxs = document.querySelectorAll(`.watSet-profile-item-container[data-profile="${profileName}"] .profileListItemInput[type="checkbox"]`);
			// ************************* Checkboxes Validation .Start *************************
			const checkedCheckbox = document.querySelectorAll(`.watSet-profile-item-container[data-profile="${profileName}"] .profileListItemInput[type="checkbox"]:checked`);
			if (checkedCheckbox.length === 0) {
				const profileToggle = document.querySelector(`.watSet-profile-item-container[data-profile="${profileName}"] .profileToggle`);
				alert(this.getLocalizedText('msg.warning.noSettingsChecked'));
				// 체크박스가 하나도 렌더링되지 않은 경우(옵션 전체 비활성화) 크래시 방지
				if (profileCheckboxs.length > 0) {
					profileCheckboxs[0].focus();
					profileCheckboxs[0].classList.add('force-focus');

					const handleFocusOut = () => {
						this._setTimeout(() => {
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
						toggleLabel.textContent = this.getLocalizedText('tags.button.text.on');
					} else {
						profileToggle.textContent = this.getLocalizedText('tags.button.text.on');
					}
					profileToggle.setAttribute('aria-pressed', 'false');
				}
				return;
			}
			// ************************* Checkboxes Validation .End   *************************

			// Apply profile settings: merge by reflecting checkbox states in UI for each item (프로필 설정 적용: 각 항목에 대해 UI에 있는 체크박스 상태를 반영해서 병합)
			for (const key in profileData.settings) {
				// 사용자 옵션에 해당 기능이 비활성화된 경우 => 건너뜀
				if (this.options[key] === false) continue;

				// 만약 UI에 체크박스가 있다면, 이를 통해 최신 상태를 반영
				// 예를 들어 각 체크박스에 data-key 속성을 부여해두었다고 가정
				const checkbox = document.querySelector(`.watSet-profile-item-container[data-profile="${profileName}"] .profileListItemInput[type="checkbox"][data-key="${key}"]`);
				if (checkbox) {
					profileData.enabled[key] = checkbox.checked;
				}
				// 체크된 항목만 baseSettings에 덮어쓰도록 함
				if (profileData.enabled[key]) {
					effectiveSettings[key] = profileData.settings[key];
				}
			}

		// Disable save during profile application (프로필 적용 중 저장 비활성화)
		const originalSkipFlag = this._skipSavePreferences;
		this._skipSavePreferences = true;			if (effectiveSettings.fontSize)		{ this.changeFontSize(effectiveSettings.fontSize); }
			if (effectiveSettings.fontFamily)	{ this.changeFontFamily(effectiveSettings.fontFamily); }
			if (effectiveSettings.screenScale)	{ this.changeScreenScale(effectiveSettings.screenScale); }
			if (effectiveSettings.txtAlign)		{ this.changeTextAlign(effectiveSettings.txtAlign); }
			if (effectiveSettings.letterSpacing)	{ this.changeLetterSpacing(effectiveSettings.letterSpacing); }
			if (effectiveSettings.lineHeight)	{ this.changeLineHeight(effectiveSettings.lineHeight); }
			if (effectiveSettings.colorTheme)	{ this.changeColorTheme(effectiveSettings.colorTheme); }
			if (effectiveSettings.saturation)	{ this.changeSaturation(effectiveSettings.saturation); }
			if (effectiveSettings.readGuide)	{ this.changeReadGuide(effectiveSettings.readGuide); }
			
		// Restore save flag (저장 플래그 복원)
		this._skipSavePreferences = originalSkipFlag;
		
		// Synchronize individual settings UI after profile application (프로필 적용 후 개별 설정 UI 동기화)
		this._syncIndividualSettingsUI(effectiveSettings);
		
		// Save after profile application (프로필 적용 완료 후 저장)
		this.savePreferences();			// UI 동기화를 확실하게 하기 위해 약간의 지연 후 한 번 더 실행
			setTimeout(() => {
				this._syncIndividualSettingsUI(effectiveSettings);
			}, 50);
			
			localStorage.setItem('selectedProfile', JSON.stringify({
				profileName: profileName,
				enabledSettings: profileData.enabled,
				appliedSesttings: effectiveSettings
			}));
		}

		/**
		 * Toggles the specified profile on or off (지정된 프로필을 켜거나 끕니다)
		 * @param {string} profile - Profile name to toggle (토글할 프로필명)
		 * @param {HTMLElement} targetToggle - Toggle button element that was clicked (클릭된 토글 버튼 요소)
		 * @returns {void}
		 * @description Toggles profile activation, applies/resets settings, and updates UI states
		 *              (프로필 활성화를 토글하고, 설정을 적용/리셋하며, UI 상태를 업데이트합니다)
		 * @example
		 * // Toggle a profile (프로필 토글)
		 * this.toggleProfile('lowVision', toggleButtonElement);
		 */
	toggleProfile(profile, targetToggle) {
		const isOn = targetToggle.getAttribute('aria-pressed') === 'true';
		const siblingToggles = Array.from(targetToggle.closest('.watSet-item-container.profile-container').querySelectorAll('.profileToggle')).filter(toggle => toggle !== targetToggle);
		const targetLabel = targetToggle.querySelector('.watSet-button-label');
		targetLabel.textContent = isOn ? this.getLocalizedText('tags.button.text.stateOff') : this.getLocalizedText('tags.button.text.stateOn');
		targetToggle.setAttribute('aria-pressed', isOn ? 'false' : 'true');

		if (isOn) {
			// 프로필을 끌 때: 접근성 설정만 기본값으로 리셋, 도구 설정은 유지
			const defaults = Defaults.SETTINGS;
			
			// 접근성 설정들만 기본값으로 리셋
			this.changeFontSize(defaults.fontSize);
			this.changeFontFamily(defaults.fontFamily);
			this.changeScreenScale(defaults.screenScale);
			this.changeTextAlign(defaults.txtAlign);
			this.changeLetterSpacing(defaults.letterSpacing);
			this.changeLineHeight(defaults.lineHeight);
			this.changeColorTheme(defaults.colorTheme);
			this.changeSaturation(defaults.saturation);
			this.changeReadGuide(defaults.readGuide);
			document.documentElement.dataset.imgDisplayMode = defaults.imgDisplayMode;
			
			// 도구 설정들은 현재 사용자 설정 유지
			const resetSettings = {
				fontSize: defaults.fontSize,
				fontFamily: defaults.fontFamily,
				screenScale: defaults.screenScale,
				txtAlign: defaults.txtAlign,
				letterSpacing: defaults.letterSpacing,
				lineHeight: defaults.lineHeight,
				colorTheme: defaults.colorTheme,
				saturation: defaults.saturation,
				readGuide: defaults.readGuide,
				imgDisplayMode: defaults.imgDisplayMode,
				// 현재 사용자 설정 유지
				viewMode: document.documentElement.dataset.watViewmode || defaults.viewMode,
				toolPosition: document.documentElement.dataset.watPosition || defaults.toolPosition
			};
			
			// UI 동기화
			this._syncIndividualSettingsUI(resetSettings);
			
			// 현재 토글 버튼에서 active 클래스 제거
			targetToggle.classList.remove(Constants.CSS_CLASSES.ACTIVE);
			
			// Save settings (설정 저장)
			this.savePreferences();
		} else {
			// 프로필을 켤 때
			this.applyProfileSettings(profile);
			
			// 현재 토글 버튼에 active 클래스 추가
			targetToggle.classList.add(Constants.CSS_CLASSES.ACTIVE);
		}

		// 다른 프로필 토글들은 모두 비활성화
		siblingToggles.forEach(toggle => {
			const siblingLabel = toggle.querySelector('.watSet-button-label');
			siblingLabel.textContent = this.getLocalizedText('tags.button.text.stateOff');
			toggle.setAttribute('aria-pressed', 'false');
			toggle.classList.remove(Constants.CSS_CLASSES.ACTIVE);
		});
	}		/**
		 * Resets all accessibility settings to their default values (모든 접근성 설정을 기본값으로 리셋합니다)
		 * @returns {void}
		 * @description Restores all accessibility features to their initial/default state
		 *              (모든 접근성 기능을 초기/기본 상태로 복원합니다)
		 * @example
		 * // Reset all settings to defaults (모든 설정을 기본값으로 리셋)
		 * this.resetWatSettings();
		 */
		resetWatSettings() {
			const defaults = Defaults.SETTINGS;
			
			// 접근성 설정들만 기본값으로 리셋
			this.changeFontSize(defaults.fontSize);
			this.changeFontFamily(defaults.fontFamily);
			this.changeScreenScale(defaults.screenScale);
			this.changeTextAlign(defaults.txtAlign);
			this.changeLetterSpacing(defaults.letterSpacing);
			this.changeLineHeight(defaults.lineHeight);
			this.changeColorTheme(defaults.colorTheme);
			this.changeSaturation(defaults.saturation);
			this.changeReadGuide(defaults.readGuide);
			// 이미지 표시 모드도 접근성 설정으로 포함
			document.documentElement.dataset.imgDisplayMode = defaults.imgDisplayMode;
			
			// 도구 설정들(viewMode, toolPosition)은 현재 사용자 설정 유지
			// document.documentElement.dataset.watViewmode = defaults.viewMode;  // 제거
			// document.documentElement.dataset.watPosition = defaults.toolPosition;  // 제거
			
			// 리셋할 설정들만 포함
			const resetSettings = {
				fontSize: defaults.fontSize,
				fontFamily: defaults.fontFamily,
				screenScale: defaults.screenScale,
				txtAlign: defaults.txtAlign,
				letterSpacing: defaults.letterSpacing,
				lineHeight: defaults.lineHeight,
				colorTheme: defaults.colorTheme,
				saturation: defaults.saturation,
				readGuide: defaults.readGuide,
				imgDisplayMode: defaults.imgDisplayMode,
				// 현재 사용자 설정 유지
				viewMode: document.documentElement.dataset.watViewmode || defaults.viewMode,
				toolPosition: document.documentElement.dataset.watPosition || defaults.toolPosition
			};
			
			// 전체 리셋 후 개별 설정 UI 동기화
			this._syncIndividualSettingsUI(resetSettings);
			
			// UI 동기화를 확실하게 하기 위해 약간의 지연 후 한 번 더 실행
			setTimeout(() => {
				this._syncIndividualSettingsUI(defaults);
			}, 50);
		}

		/**
		 * Resets settings for a specific accessibility profile (특정 접근성 프로필의 설정을 리셋합니다)
		 * @param {string} profileId - Profile identifier ('visualImpairment', 'colorBlindness', 'dyslexia') (프로필 식별자)
		 * @returns {void}
		 * @description Resets profile-specific settings to their default values based on profile type
		 *              (프로필 타입에 따라 프로필별 설정을 기본값으로 리셋합니다)
		 * @example
		 * // Reset color blindness profile settings (색각이상자용 프로필 설정 리셋)
		 * this.resetProfileSettings('colorBlindness');
		 */
		resetProfileSettings(profileId) {
			const resetSettings = {};
			
			switch (profileId) {
				case 'lowVision': // 실제 프로필 키(Defaults.PROFILES)와 일치시킴 — 구 명칭 'visualImpairment'
					this.changeFontSize('initial');
					this.changeFontFamily('initial');
					this.toggleImgTextConversion(false);
					this.toggleDisplayContents(false);
					resetSettings.fontSize = 'initial';
					resetSettings.fontFamily = 'initial';
					break;
				case 'colorBlindness':
					this.changeSaturation('initial');
					this.toggleDataAttribute('stopAni', false);
					this.tts_toggleFocusDetection(false);
					resetSettings.saturation = 'initial';
					break;
				case 'dyslexia':
					this.changeFontFamily('initial');
					this.changeLineHeight('initial');
					this.toggleDataAttribute('stopAni', false);
					this.changeReadGuide('');
					resetSettings.fontFamily = 'initial';
					resetSettings.lineHeight = 'initial';
					resetSettings.readGuide = 'unset';
					break;
			}
			
			// 프로필 리셋 후 개별 설정 UI 동기화
			this._syncIndividualSettingsUI(resetSettings);
			
			// UI 동기화를 확실하게 하기 위해 약간의 지연 후 한 번 더 실행
			setTimeout(() => {
				this._syncIndividualSettingsUI(resetSettings);
			}, 50);
		}


		/**
		 * Saves current accessibility settings to localStorage (현재 접근성 설정을 localStorage에 저장합니다)
		 * @returns {void}
		 * @description Collects current settings from HTML data attributes and stores them in localStorage as JSON
		 *              (HTML 데이터 속성에서 현재 설정을 수집하고 JSON으로 localStorage에 저장합니다)
		 * @example
		 * // Save current settings (현재 설정 저장)
		 * this.savePreferences();
		 */
		savePreferences() {
			// 초기화 중에는 저장하지 않음
			if (this._skipSavePreferences) {
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
		
		// Also update StateManager settings
		this.state.set('settings', settings);
		
		// Dispatch settings saved event
		this._dispatchStateEvent('settings:saved', {
			settings: { ...settings },
			timestamp: Date.now()
		});
		}

		/**
		 * Loads accessibility settings from localStorage (localStorage에서 접근성 설정을 로드합니다)
		 * @returns {Object} Loaded settings object with default fallbacks (기본값으로 대체된 로드된 설정 객체)
		 * @description Retrieves saved settings from localStorage and merges with default settings
		 *              (localStorage에서 저장된 설정을 가져와 기본 설정과 병합합니다)
		 * @example
		 * // Load saved preferences (저장된 환경설정 로드)
		 * const settings = this.loadPreferences();
		 * console.log(settings.fontSize); // Current font size setting
		 */
		loadPreferences() {
			const savedSettings = localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS);
			const loadedSettings = safeParseJSON(savedSettings, {});
			const defaultSettings = Defaults.SETTINGS;
		
			// 초기값 설정
			const pluginSettings = {
				fontSize: loadedSettings.fontSize || defaultSettings.fontSize,
				fontFamily: loadedSettings.fontFamily || defaultSettings.fontFamily,
				screenScale: loadedSettings.screenScale || defaultSettings.screenScale,
				txtAlign: loadedSettings.txtAlign || defaultSettings.txtAlign,
				letterSpacing: loadedSettings.letterSpacing || defaultSettings.letterSpacing,
				lineHeight: loadedSettings.lineHeight || defaultSettings.lineHeight,
				colorTheme: loadedSettings.colorTheme || defaultSettings.colorTheme,
				saturation: loadedSettings.saturation || defaultSettings.saturation,
				readGuide: loadedSettings.readGuide || defaultSettings.readGuide,
				imgDisplayMode: loadedSettings.imgDisplayMode || defaultSettings.imgDisplayMode,
				viewMode: loadedSettings.viewMode || defaultSettings.viewMode,
				toolPosition: loadedSettings.toolPosition || defaultSettings.toolPosition
			};

			const controlItems = ['viewMode', 'toolPosition'];

			// 설정 적용
			Object.entries(pluginSettings).forEach(([key, value]) => {
				const radioDefaultData = {"name": key, "value": value};
				
				// UI 컨트롤 설정 - 라디오 버튼 체크 및 UI 상태 업데이트
				const classSelector = controlItems.includes(key) ? '.wat-set-item-type-radio' : '.wat-item-type-radio';
				const selector = `${classSelector}[name="${key}"][value="${value}"]`;
				const radioElement = document.querySelector(selector);
				
				if (radioElement) {
					radioElement.checked = true;
					
					// UI 상태 업데이트 (setRadioListeners와 동일한 로직)
					const elm_parent_li = radioElement.closest('.opt_item');
					const elm_parent_personalOpt_item = radioElement.closest('.personalOpt_item');
					
					if (elm_parent_li) {
						const elm_parent_ul = elm_parent_li.closest('.opt_lists');
						if (elm_parent_ul) {
							// 모든 형제 요소에서 selectOn 클래스 제거
							const elm_parent_li_siblings = Array.from(elm_parent_ul.children).filter(child => child !== elm_parent_li);
							elm_parent_li_siblings.forEach(sibling => {
								sibling.classList.remove('selectOn');
							});
							// 현재 요소에 selectOn 클래스 추가
							elm_parent_li.classList.add('selectOn');
						}
					}
					
					if (elm_parent_personalOpt_item) {
						if (value === 'initial' || value === 'unset') {
							elm_parent_personalOpt_item.classList.remove('selectOn');
						} else {
							elm_parent_personalOpt_item.classList.add('selectOn');
						}
					}
				} else {
					console.warn(`Radio element not found for ${key}=${value}: ${selector}`);
				}
				
				// 화면 확대 설정에 대한 현재 비율 초기화
				if (key === 'screenScale') {
					const ratio = this.screenScaleRatios[value] || 1;
					this.state.set('plugin.currentScreenScale', ratio);
				}
			});
			
			// Dispatch settings loaded event
			this._dispatchStateEvent('settings:loaded', {
				settings: { ...pluginSettings },
				wasEmpty: !savedSettings,
				timestamp: Date.now()
			});
			
			return pluginSettings;
		}

		/**
		 * Applies a specific setting to the actual page content
		 * @param {string} settingKey - The setting key (e.g., 'fontSize', 'screenScale')
		 * @param {string} settingValue - The setting value (e.g., 'size-1p5x', 'scale-1p2x')
		 * @private
		 */
		_applySettingToPage(settingKey, settingValue) {
			switch (settingKey) {
				case 'fontSize':
					this.changeFontSize(settingValue);
					break;
				case 'fontFamily':
					this.changeFontFamily(settingValue);
					break;
				case 'screenScale':
					this.changeScreenScale(settingValue);
					break;
				case 'txtAlign':
					this.changeTextAlign(settingValue);
					break;
				case 'letterSpacing':
					this.changeLetterSpacing(settingValue);
					break;
				case 'lineHeight':
					this.changeLineHeight(settingValue);
					break;
				case 'colorTheme':
					this.changeColorTheme(settingValue);
					break;
				case 'saturation':
					this.changeSaturation(settingValue);
					break;
				case 'readGuide':
					this.changeReadGuide(settingValue);
					break;
				case 'imgDisplayMode':
					this.changeImgDisplayMode(settingValue);
					break;
				case 'viewMode':
					// Apply viewMode to document dataset for UI styling
					document.documentElement.dataset.watViewmode = settingValue;
					break;
				case 'toolPosition':
					// Apply toolPosition to document dataset for UI positioning
					document.documentElement.dataset.watPosition = settingValue;
					break;
				default:
					console.warn(`Unknown setting key: ${settingKey}`);
			}
		}

		/**
		 * Applies initial preferences when the plugin starts (플러그인 시작 시 초기 환경설정을 적용합니다)
		 * @returns {void}
		 * @description Loads and applies saved preferences, setting UI controls to match saved states
		 *              (저장된 환경설정을 로드하고 적용하며, 저장된 상태와 일치하도록 UI 컨트롤을 설정합니다)
		 * @example
		 * // Apply initial settings on plugin initialization (플러그인 초기화 시 초기 설정 적용)
		 * this.setInitialPreferences();
		 */
		setInitialPreferences() {
			const loadedSettings = this.loadPreferences();
			
			// 초기 설정 로드 후 UI 동기화
			if (loadedSettings) {
				setTimeout(() => {
					this._syncIndividualSettingsUI(loadedSettings);
				}, 100);
			}
		}

		/**
		 * Synchronizes individual UI controls to reflect current setting values (개별 UI 컨트롤을 현재 설정값과 동기화합니다)
		 * @param {Object} settings - Settings object to sync UI controls with (UI 컨트롤과 동기화할 설정 객체)
		 * @returns {void}
		 * @description Updates UI controls (radio buttons, checkboxes) to visually reflect the provided settings
		 *              (제공된 설정을 시각적으로 반영하도록 UI 컨트롤(라디오 버튼, 체크박스)을 업데이트합니다)
		 * @private
		 */
		_syncIndividualSettingsUI(settings) {
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
					
					// UI 상태 업데이트 (setRadioListeners와 동일한 로직)
					const elm_parent_li = radioElement.closest('.opt_item');
					const elm_parent_personalOpt_item = radioElement.closest('.personalOpt_item');
					
					if (elm_parent_li) {
						const elm_parent_ul = elm_parent_li.closest('.opt_lists');
						if (elm_parent_ul) {
							// 모든 형제 요소에서 selectOn 클래스 제거
							const elm_parent_li_siblings = Array.from(elm_parent_ul.children).filter(child => child !== elm_parent_li);
							elm_parent_li_siblings.forEach(sibling => {
								sibling.classList.remove('selectOn');
							});
							// 현재 요소에 selectOn 클래스 추가
							elm_parent_li.classList.add('selectOn');
						}
					}
					
					if (elm_parent_personalOpt_item) {
						if (value === 'initial' || value === 'unset') {
							elm_parent_personalOpt_item.classList.remove('selectOn');
						} else {
							elm_parent_personalOpt_item.classList.add('selectOn');
						}
					}
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
				
				const elm_parent_personalOpt_item = elm_target.closest('.personalOpt_item');
				const elm_parent_li = elm_target.closest('.opt_item');
				
				// elm_parent_li가 null인 경우 처리
				if (!elm_parent_li) {
					console.warn(`Parent .opt_item not found for element with attribute: ${attribute}, value: ${value}`);
					// 일단 데이터셋만 설정하고 UI 업데이트는 스킵
					document.documentElement.dataset[attribute] = value;
					return;
				}
				
				const elm_parent_ul = elm_parent_li.closest('.opt_lists');
				if (elm_parent_ul) {
					const elm_parent_li_siblings = Array.from(elm_parent_ul.children).filter(child => child !== elm_parent_li);
					elm_parent_li_siblings.forEach(sibling => {
						sibling.classList.remove('selectOn');
					});
					elm_parent_li.classList.add('selectOn');
				}
				
				if (elm_parent_personalOpt_item) {
					if (value === 'initial' || value === 'unset') {
						elm_parent_personalOpt_item.classList.remove('selectOn');
					} else {
						elm_parent_personalOpt_item.classList.add('selectOn');
					}
				}
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
		 * Sets up event listeners for Text-to-Speech controls (텍스트 음성 변환 컨트롤의 이벤트 리스너를 설정합니다)
		 * @returns {void}
		 * @description Configures click events for TTS play/pause, navigation, and focus detection buttons
		 *              (TTS 재생/일시정지, 탐색, 포커스 감지 버튼의 클릭 이벤트를 구성합니다)
		 */
		setTTSListeners() {
			// 속도 조절 슬라이더 변경 시
			/*
			document.getElementById(Constants.ELEMENT_IDS.TTS_SPEED_CTRL).addEventListener('input', (event) => {
				document.getElementById('ttsSpeed_display').textContent = event.target.value;
			});
			*/

			// 시작 버튼 클릭 이벤트
			document.getElementById('wat-button-tts_toggle').addEventListener('click', () => {
				//const isActive = document.getElementById('wat-button-tts_toggle').classList.contains('playing');
				const isActive = document.getElementById('wat-button-tts_toggle').getAttribute('aria-pressed') === 'true';
				//isActive ? this.stopReading() : this.toggleStartbtn_ttsStops(true);
				this.state.set('plugin.isTTSActive', !this.state.get('plugin.isTTSActive'));
				if (!isActive) {
					// stop -> start
					this.state.set('tts.currentIndex', 0);
					this.readCurrentText(this.state.get('tts.currentIndex'));
					this.toggleStartbtn_ttsStops(true);
					//document.getElementById('wat-button-tts_toggle').classList.add('playing');
				} else {
					// start -> stop
					this.tts_stopReading();
					this.toggleStartbtn_ttsStops(false); // 정지 상태로 버튼 토글
					//document.getElementById('wat-button-tts_toggle').classList.remove('playing');
				}
			});

			// 다음 버튼 클릭 이벤트
			document.getElementById('wat-button-tts_next').addEventListener('click', () => {
				const currentIndex = this.state.get('tts.currentIndex');
				const ttsElements = this.state.get('tts.elements');
				if (currentIndex < ttsElements.length - 1) {
					const newIndex = currentIndex + 1;
					this.state.set('tts.currentIndex', newIndex);
					this.readCurrentText(newIndex);
				} else {
					this.showNotification(this.getLocalizedText('panel.personal.options.tts.msg.lastArea'));
				}
			});

			// 이전 버튼 클릭 이벤트
			document.getElementById('wat-button-tts_prev').addEventListener('click', () => {
				const currentIndex = this.state.get('tts.currentIndex');
				if (currentIndex > 0) {
					const newIndex = currentIndex - 1;
					this.state.set('tts.currentIndex', newIndex);
					this.readCurrentText(newIndex);
				} else {
					this.showNotification(this.getLocalizedText('panel.personal.options.tts.msg.firstArea'));
				}
			});

			// 포커스 탐지 시작/정지 버튼은 _handleTTSButtons에서 처리됨
			/*
			document.getElementById('wat-button-tts_focus_stop').addEventListener('click', () => {
				this.tts_toggleFocusDetection(false);
				this.isTTSActive = false;
			});
			*/
		}

		/**
		 * Sets up event listeners for page scroll controls (페이지 스크롤 컨트롤의 이벤트 리스너를 설정합니다)
		 * @returns {void}
		 * @description Configures click events for scroll toggle, start/stop, and directional scroll buttons
		 *              (스크롤 토글, 시작/정지, 방향 스크롤 버튼의 클릭 이벤트를 구성합니다)
		 */
		setPageScrollListeners() {
			const scrollToggle = document.getElementById('wat-button-pageScroll_toggle');
			const scrollStart = document.getElementById('wat-button-pageScroll_start');
			const scrollStop = document.getElementById('wat-button-pageScroll_stop');
			const scrollUp = document.getElementById('wat-button-pageScroll_up');
			const scrollDown = document.getElementById('wat-button-pageScroll_down');

			if (scrollToggle) {
				scrollToggle.addEventListener('click', () => {
					this.togglePageScroll();
				});
			}
			if (scrollStart) {
				scrollStart.addEventListener('click', () => {
					this.startPageScroll();
				});
			}

			if (scrollStop) {
				scrollStop.addEventListener('click', () => {
					this.stopPageScroll();
				});
			}

			if (scrollUp) {
				scrollUp.addEventListener('click', () => {
					this.scrollPageUp();
				});
			}

			if (scrollDown) {
				scrollDown.addEventListener('click', () => {
					this.scrollPageDown();
				});
			}
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
		 * Generates CSS refactoring suggestions based on current font styles (현재 폰트 스타일을 기반으로 CSS 리팩토링 제안을 생성합니다)
		 * @returns {string} CSS refactoring suggestions as formatted string (포맷된 문자열로 된 CSS 리팩토링 제안)
		 * @description Analyzes current font styles and generates CSS rules for better maintainability and consistency
		 *              (현재 폰트 스타일을 분석하고 더 나은 유지보수성과 일관성을 위한 CSS 규칙을 생성합니다)
		 * @example
		 * // Get CSS refactoring suggestions (CSS 리팩토링 제안 가져오기)
		 * const suggestions = this.getFontStyleRefactorSuggestions();
		 * console.log(suggestions); // Generated CSS rules
		 */
		getFontStyleRefactorSuggestions() {
			const results = [];
			const seen = new Set();
			const styleProps = ['font-size', 'font-family', 'line-height', 'text-align', 'letter-spacing'];

			function getBaseFontSize(selector) {
				const el = document.querySelector(selector);
				if (!el) return 16;
				const computed = window.getComputedStyle(el);
				return parseFloat(computed.fontSize) || 16;
			}

			const baseApply = getBaseFontSize('.wat-apply');
			const baseExclude = getBaseFontSize('.wat-exclude');

			function getUniqueSelector(el) {
				if (el.id) return `#${el.id}`;
				const path = [];
				while (el && el.nodeType === 1 && el !== document.body) {
					let selector = el.nodeName.toLowerCase();
					if (el.className) selector += '.' + Array.from(el.classList).join('.');
					path.unshift(selector);
					el = el.parentElement;
				}
				return path.join(' ');
			}

			function isRefactorTarget(el) {
				if (el.closest('.wat-exclude')) return false;
				return el.closest('.wat-apply');
			}

			function shouldWriteStyle(el, prop) {
				const parent = el.parentElement;
				if (!parent) return true;
				const parentVal = window.getComputedStyle(parent).getPropertyValue(prop);
				const elVal = window.getComputedStyle(el).getPropertyValue(prop);
				return parentVal !== elVal;
			}

			document.querySelectorAll('.wat-apply *').forEach(el => {
				if (!isRefactorTarget(el)) return;

				const computed = window.getComputedStyle(el);
				const styles = [];

				// 폰트 사이즈 비율 계산
				const fontSize = parseFloat(computed.fontSize);
				if (fontSize && fontSize !== baseApply && shouldWriteStyle(el, 'font-size')) {
					const ratio = +(fontSize / baseApply).toFixed(3);
					styles.push(`font-size: ${ratio}em`);
				}

				// 나머지 상속 속성: 부모와 다를 때만 기록
				styleProps.slice(1).forEach(prop => {
					if (shouldWriteStyle(el, prop)) {
						const val = computed.getPropertyValue(prop);
						if (val && val !== '') styles.push(`${prop}: ${val}`);
					}
				});

				if (styles.length) {
					const selector = getUniqueSelector(el);
					if (!seen.has(selector)) {
						results.push(`${selector} { ${styles.join('; ')} }`);
						seen.add(selector);
					}
				}
			});

			document.querySelectorAll('.wat-exclude, .wat-exclude *').forEach(el => {
				const computed = window.getComputedStyle(el);
				const styles = [];

				const fontSize = parseFloat(computed.fontSize);
				if (fontSize && fontSize !== baseExclude && shouldWriteStyle(el, 'font-size')) {
					const ratio = +(fontSize / baseExclude).toFixed(3);
					styles.push(`font-size: ${ratio}em`);
				}

				styleProps.slice(1).forEach(prop => {
					if (shouldWriteStyle(el, prop)) {
						const val = computed.getPropertyValue(prop);
						if (val && val !== '') styles.push(`${prop}: ${val}`);
					}
				});

				if (styles.length) {
					const selector = getUniqueSelector(el);
					if (!seen.has(selector)) {
						results.push(`${selector} { ${styles.join('; ')} }`);
						seen.add(selector);
					}
				}
			});

			return results.join('\n');
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
		 * Shows user-friendly feedback messages (사용자 친화적인 피드백 메시지를 표시합니다)
		 * @param {string} type - Message type ('success', 'error', 'warning', 'info') (메시지 타입)
		 * @param {string} message - Message to display (표시할 메시지)
		 * @param {number} [duration=3000] - Display duration in milliseconds (표시 지속 시간, 밀리초)
		 * @returns {void}
		 * @description Displays user feedback in a consistent, accessible manner
		 *              (일관되고 접근 가능한 방식으로 사용자 피드백을 표시합니다)
		 * @example
		 * // Show success message (성공 메시지 표시)
		 * this.showUserFeedback('success', 'Settings saved successfully');
		 * 
		 * // Show error message (에러 메시지 표시)
		 * this.showUserFeedback('error', 'Failed to save settings', 5000);
		 */
		showUserFeedback(type, message, duration = 3000) {
			try {
				// 입력 검증
				if (!type || !message) {
					console.warn('Invalid feedback parameters');
					return;
				}
				
				// 기존 피드백 제거
				const existingFeedback = document.querySelector('.wat-user-feedback');
				if (existingFeedback) {
					existingFeedback.remove();
				}
				
				// 피드백 요소 생성
				const feedback = document.createElement('div');
				feedback.className = `wat-user-feedback wat-feedback-${type}`;
				// 타입별 role 분리 — error는 즉시 전달(alert, assertive 함의), 나머지는 status(polite 함의)
				if (type === 'error') {
					feedback.setAttribute('role', 'alert');
				} else {
					feedback.setAttribute('role', 'status');
					feedback.setAttribute('aria-live', 'polite');
				}

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

				// 스타일 적용
				Object.assign(feedback.style, {
					position: 'fixed',
					top: '20px',
					right: '20px',
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					padding: '12px 16px',
					borderRadius: '4px',
					color: '#fff',
					fontFamily: 'system-ui, -apple-system, sans-serif',
					fontSize: '14px',
					fontWeight: '500',
					zIndex: '999999',
					maxWidth: '300px',
					wordWrap: 'break-word',
					boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
					transform: 'translateX(100%)',
					transition: 'transform 0.3s ease-in-out',
					opacity: '0'
				});
				
				// 타입별 색상 설정
				const colors = {
					success: '#10b981',
					error: '#ef4444',
					warning: '#f59e0b',
					info: '#3b82f6'
				};
				
				feedback.style.backgroundColor = colors[type] || colors.info;
				
				// DOM에 추가
				document.body.appendChild(feedback);
				
				// 애니메이션 실행
				requestAnimationFrame(() => {
					feedback.style.opacity = '1';
					feedback.style.transform = 'translateX(0)';
				});
				
				// 자동 제거
				setTimeout(() => {
					if (feedback.parentNode) {
						feedback.style.transform = 'translateX(100%)';
						feedback.style.opacity = '0';
						
						setTimeout(() => {
							if (feedback.parentNode) {
								feedback.remove();
							}
						}, 300);
					}
				}, duration);
				
			} catch (error) {
				console.error('Error showing user feedback:', error);
				// 폴백: 간단한 alert 사용
				alert(`${type.toUpperCase()}: ${message}`);
			}
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
			if (WAT_DEBUG_ENABLED) console.time('applyDynamicFontSize');
			
			// 캐시된 요소 조회
			const elements = this._getCachedElements('wat-dyn-fontsize');
			
			if (size === 'initial' || size === 'unset') {
				// 배치 처리로 스타일 제거
				elements.forEach(el => {
					this.styleBatchProcessor.queueStyleUpdate(el, 'font-size', null);
				});
				if (WAT_DEBUG_ENABLED) console.timeEnd('applyDynamicFontSize');
				return;
			}

			const ratio = this.fontSizeRatios[size] || 1;
			
			// 배치 처리로 스타일 적용
			elements.forEach(el => {
				const orig = this._originalStyleMap.get(el);
				if (orig && orig['font-size']) {
					const origPx = parseFloat(orig['font-size']);
					const newValue = `${origPx * ratio}px`;
					this.styleBatchProcessor.queueStyleUpdate(el, 'font-size', newValue);
				}
			});
			
			if (WAT_DEBUG_ENABLED) console.timeEnd('applyDynamicFontSize');
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
			if (key === 'initial') return '기본 크기';
			
			// ratio를 기반으로 라벨 자동 생성
			const percentage = Math.round(ratio * 100);
			return `${percentage}% (${ratio}배)`;
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
			this.currentScreenScale = ratio; // 현재 확대 비율 저장
			// convertScaledCoordinates 등이 state에서 읽으므로 두 저장소를 동기화 (마스크 좌표 어긋남 방지)
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
			this.currentScreenScale = ratio; // 현재 확대 비율 저장
			this.state.set('plugin.currentScreenScale', ratio); // state 소비처와 동기화
			
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
			this.currentScreenScale = 1;
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
			const scale = this.currentScreenScale || 1;
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
			const scale = this.currentScreenScale || 1;
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
			const scale = this.currentScreenScale || 1;
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
			if (WAT_DEBUG_ENABLED) console.time('applyDynamicLineHeight');
			
			const elements = this._getCachedElements('wat-dyn-lineheight');
			
			if (height === 'initial' || height === 'unset') {
				elements.forEach(el => {
					this.styleBatchProcessor.queueStyleUpdate(el, 'line-height', null);
				});
				if (WAT_DEBUG_ENABLED) console.timeEnd('applyDynamicLineHeight');
				return;
			}

			const ratio = this.lineHeightRatios[height] || 1;
			
			elements.forEach(el => {
				const orig = this._originalStyleMap.get(el);
				if (orig && orig['line-height']) {
					const origPx = parseFloat(orig['line-height']);
					const newValue = `${origPx * ratio}px`;
					this.styleBatchProcessor.queueStyleUpdate(el, 'line-height', newValue);
				}
			});
			
			if (WAT_DEBUG_ENABLED) console.timeEnd('applyDynamicLineHeight');
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
			if (key === 'initial') return '기본 줄간격';
			const percentage = Math.round(ratio * 100);
			return `${percentage}% (${ratio}배)`;
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
			if (WAT_DEBUG_ENABLED) console.time('applyDynamicTextAlign');
			
			const elements = this._getCachedElements('wat-dyn-textalign');

			if (align === 'initial' || align === 'unset') {
				elements.forEach(el => {
					this.styleBatchProcessor.queueStyleUpdate(el, 'text-align', null);
				});
			} else {
				elements.forEach(el => {
					this.styleBatchProcessor.queueStyleUpdate(el, 'text-align', align);
				});
		}

		if (WAT_DEBUG_ENABLED) console.timeEnd('applyDynamicTextAlign');
	}		/**
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
			if (WAT_DEBUG_ENABLED) console.time('applyDynamicLetterSpacing');
			
			const elements = this._getCachedElements('wat-dyn-letterspacing');
			
			if (spacing === 'initial' || spacing === 'unset') {
				elements.forEach(el => {
					this.styleBatchProcessor.queueStyleUpdate(el, 'letter-spacing', null);
				});
				if (WAT_DEBUG_ENABLED) console.timeEnd('applyDynamicLetterSpacing');
				return;
			}

			const ratio = this.letterSpacingRatios[spacing] || 1;
			
			elements.forEach(el => {
				const orig = this._originalStyleMap.get(el);
				const rawLs = orig && orig['letter-spacing'];
				const origPx = rawLs != null && rawLs !== '' ? parseFloat(String(rawLs)) : NaN;
				let newValue;
				if (Number.isFinite(origPx)) {
					newValue = `${origPx * ratio}px`;
				} else {
					const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
					const baseSpacing = fontSize * 0.05;
					newValue = `${baseSpacing * ratio}px`;
				}
				this.styleBatchProcessor.queueStyleUpdate(el, 'letter-spacing', newValue);
			});
			
			if (WAT_DEBUG_ENABLED) console.timeEnd('applyDynamicLetterSpacing');
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
			if (key === 'initial') return '기본 자간';
			const percentage = Math.round(ratio * 100);
			return `${percentage}% (${ratio}배)`;
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
				const topMask = this.createElementWithClass('div', ['wat-reading-guide', 'reading-mask-top']);
				const bottomMask = this.createElementWithClass('div', ['wat-reading-guide', 'reading-mask-bottom']);
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
				const line = this.createElementWithClass('div', ['wat-reading-guide', 'reading-line']);
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
			const scale = this.currentScreenScale || 1;
			
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
					imgDsp.src = basePath ? `${basePath}assets/images/icon_image.png` : './images/icon_image.png';
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
					placeholderIcon.src = basePath ? `${basePath}assets/images/icon_image.png` : './images/icon_image.png';
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
			const scrollStep = 1; // Change this value to make the scroll faster or slower
			const scrollSpeed = Constants.TIMING.SCROLL_STEP; // Change this value to make the scroll faster or slower
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


		/**
		 * Performs dictionary search for the specified word and displays results (지정된 단어에 대한 사전 검색을 수행하고 결과를 표시합니다)
		 * @param {string} word - Word to search in dictionary (사전에서 검색할 단어)
		 * @returns {void}
		 * @description Cleans the word by removing particles and proper noun patterns, then fetches search results from dictionary API
		 *              (조사와 고유명사 패턴을 제거하여 단어를 정리한 후, 사전 API에서 검색 결과를 가져옵니다)
		 * @example
		 * // Search for a word in dictionary (사전에서 단어 검색)
		 * this.performDiction('안녕하세요');
		 * 
		 * // Search with particles (조사가 포함된 단어 검색)
		 * this.performDiction('책이');
		 */
		async performDiction(word) {
			word = word.trim();
			if (!word) return;

			// Dispatch dictionary search start event
			this._dispatchStateEvent('dictionary:searchStarted', {
				searchTerm: word,
				timestamp: Date.now()
			});

			// Wait for configuration to be loaded
			await this._waitForConfig();

			// 고유명사 예외 패턴 (예: "경상북도", "경상남도" 등)
			const properNounPatternStr	= this.getLocalizedText('patterns.properNoun.list');
			const properNounPattern		= new RegExp(properNounPatternStr + '$');
			//const properNounPattern = /(남도|북도|도|군|시|구|읍|면)$/;
		
			// 조사 제거를 위한 정규식 패턴 (업데이트된 리스트)
			const particlesPatternStr	= this.getLocalizedText('patterns.particles.list');
			const particlesPattern		= new RegExp(particlesPatternStr + '$');
			//const particlesPattern = /(이|가|께서|에|에서|에게|에게서|이다|입니다|의|을|를|되다|아니다|로|으로|으로서|으로써|와|과|도|은|는|하여|하는|하신|하기|하고|만|까지|조차|부터|마저|대로|야말로|나마|나기)$/;

		
			// 고유명사 예외 처리
			let cleanedWord = word;
			if (!properNounPattern.test(word)) {
				// 단어에서 조사 제거
				cleanedWord = word.replace(particlesPattern, '');
			}

			// Get configuration-based endpoint and settings
			const serverEndpoint = this.getConfigValue('api.dictionary.serverEndpoint', null);
			
			// Check if dictionary endpoint is configured
			if (!serverEndpoint) {
				this._showDictionaryError(cleanedWord, '사전 검색 서버가 설정되지 않았습니다. 사전 기능을 사용하려면 serverEndpoint를 설정해주세요.');
				return;
			}

			// JSONP는 응답을 <script>로 실행하므로 endpoint를 https로 제한 (임의 코드 실행/MITM 방지)
			if (!isSafeHttpUrl(serverEndpoint) || !/^https:/i.test(serverEndpoint)) {
				console.error('[WAT] 사전 serverEndpoint는 https URL이어야 합니다:', serverEndpoint);
				this._showDictionaryError(cleanedWord, '사전 검색 서버 주소가 올바르지 않습니다. (https 필요)');
				return;
			}
			
			const timeout = this.getConfigValue('api.dictionary.timeout', 10000);

			try {
				// Fetch API를 사용한 JSONP 요청 (jQuery 의존성 제거)
				const data = await this._fetchJSONP(serverEndpoint, {
					word: cleanedWord
				}, timeout);
				
				// 데이터 처리
				if (data && data.items && data.items.length > 0) {
					this.displayDictionResult(data.items[0]);
					
					// Dispatch dictionary search success event
					this._dispatchStateEvent('dictionary:searchSuccess', {
						searchTerm: cleanedWord,
						originalTerm: word,
						result: data.items[0],
						timestamp: Date.now()
					});
				} else {
					this._showDictionaryNotFound(cleanedWord);
					
					// Dispatch dictionary search not found event
					this._dispatchStateEvent('dictionary:searchNotFound', {
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
				this._dispatchStateEvent('dictionary:searchError', {
					searchTerm: cleanedWord,
					originalTerm: word,
					error: error.message,
					timestamp: Date.now()
				});
			}
		}

		/**
		 * Fetch API를 사용한 JSONP 요청 구현 (jQuery 의존성 제거)
		 * @private
		 * @param {string} url - 요청할 URL
		 * @param {Object} params - 요청 파라미터
		 * @param {number} timeout - 타임아웃 시간 (밀리초)
		 * @returns {Promise<Object>} - 응답 데이터
		 * @description JSONP 방식으로 크로스 도메인 요청을 수행합니다 (jQuery 없이)
		 * @example
		 * // JSONP 요청 수행
		 * const data = await this._fetchJSONP('https://api.example.com/search', { word: '안녕' }, 5000);
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
		 * Displays dictionary search results in a modal dialog (사전 검색 결과를 모달 다이얼로그에 표시합니다)
		 * @param {Object} item - Dictionary search result item (사전 검색 결과 항목)
		 * @param {string} item.title - Title of the dictionary entry (사전 항목의 제목)
		 * @param {string} item.description - Description of the dictionary entry (사전 항목의 설명)
		 * @param {string} [item.link] - Optional link to full dictionary entry (전체 사전 항목으로의 선택적 링크)
		 * @returns {void}
		 * @description Creates an accessible modal dialog with focus management and keyboard navigation support
		 *              (포커스 관리와 키보드 탐색 지원이 있는 접근 가능한 모달 다이얼로그를 생성합니다)
		 * @example
		 * // Display dictionary result (사전 결과 표시)
		 * this.displayDictionResult({
		 *   title: '안녕',
		 *   description: '인사말',
		 *   link: 'https://example.com/dict/entry'
		 * });
		 */
		displayDictionResult(item) {
			// 현재 포커스를 가진 요소를 저장
			const previousFocusedElement = document.activeElement;

			// 기존 레이어 제거
			this.removeAllDictionLayers();

			// Get UI settings from configuration
			// config 실제 구조는 settings.ui.* — 잘못된 경로면 config 값이 항상 무시됨
			const modalWidth = this.getConfigValue('settings.ui.modalWidth', 600);
			const showPronunciation = this.getConfigValue('settings.ui.showPronunciation', true);

			// 배경 오버레이 생성 — 모달 뒤 콘텐츠와의 시각적 분리 (WCAG 4.1.2 배경 격리 보강).
			// 주의: body.overlay-active(position:fixed 스크롤 잠금)는 페이지를 최상단으로 점프시키므로
			// 본문 중간(선택 텍스트 위치)에서 열리는 사전 모달에는 사용하지 않는다 — CSS의
			// .wat-diction-overlay 규칙이 body 클래스 없이도 오버레이를 표시한다
			const overlay = document.createElement('div');
			overlay.classList.add('overlay', 'wat-overlay', 'wat-diction-overlay');
			document.body.appendChild(overlay);

			// 새로운 레이어 생성
			const layer = document.createElement('div');
			layer.classList.add('wat-diction-result-layer');
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
				pronunciationLabel.textContent = `${this.getLocalizedText('dictionary.pronunciation')}:`;
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
			closeButton.textContent = this.getLocalizedText('tags.button.text.close');
			closeButton.addEventListener('click', () => {
				layer.remove();
				overlay.remove();
				// 다른 모달의 오버레이가 없을 때만 스크롤 잠금 해제 (사전 모달 자체는 잠금을 걸지 않음)
				if (!document.querySelector('.wat-overlay')) {
					document.body.classList.remove('overlay-active');
				}
				if (previousFocusedElement) {
					previousFocusedElement.focus();
				} else {
					document.body.focus();
				}
			});
			layer.appendChild(closeButton);

			// 레이어를 문서에 추가하기 전, 레이어의 위치를 결정하기 위해 DOM에 추가
			document.body.appendChild(layer);

			// 모달 위치를 계산하고 조정하는 함수
			this._adjustModalPosition(layer, modalWidth);

			// 레이어가 열리면 포커스를 이동
			layer.focus();

			// 포커스 트래핑 — 인라인 복제 대신 공용 trapFocus 재사용 (Tab 순환 + Escape 닫기 + 오버레이 정리)
			this.trapFocus(layer, previousFocusedElement, overlay);
		}

		/**
		 * Toggles the dictionary search functionality on or off (사전 검색 기능을 켜거나 끕니다)
		 * @returns {void}
		 * @description Enables or disables dictionary lookup on text selection and manages UI state
		 *              (텍스트 선택 시 사전 검색을 활성화하거나 비활성화하고 UI 상태를 관리합니다)
		 * @example
		 * // Toggle dictionary feature (사전 기능 토글)
		 * this.toggleDiction();
		 */
		toggleDiction() {
			const currentState = this.state.get('plugin.isDictionEnabled');
			this.state.set('plugin.isDictionEnabled', !currentState);
			//const toggleButton = document.getElementById('dictionToggle');
		
			if (this.state.get('plugin.isDictionEnabled')) {
				//toggleButton.classList.remove('off');
				//toggleButton.classList.add('on');
				//toggleButton.textContent = this.getLocalizedText('button.off');
			} else {
				//toggleButton.classList.remove('on');
				//toggleButton.classList.add('off');
				//toggleButton.textContent = this.getLocalizedText('button.on');
		
				// 열려 있는 모든 검색 결과 레이어 제거
				this.removeAllDictionLayers();
			}
		}

		/**
		 * Removes all dictionary result layers from the page (페이지에서 모든 사전 결과 레이어를 제거합니다)
		 * @returns {void}
		 * @description Cleans up all open dictionary result dialogs from the DOM
		 *              (DOM에서 열려 있는 모든 사전 결과 다이얼로그를 정리합니다)
		 * @example
		 * // Remove all dictionary layers (모든 사전 레이어 제거)
		 * this.removeAllDictionLayers();
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
	 * Shows dictionary search error message to user
	 * @param {string} word - The word that was searched
	 * @param {string} errorMessage - The error message
	 * @private
	 */
	_showDictionaryError(word, errorMessage) {
		// 로컬라이제이션 키가 없을 수 있으므로 직접 메시지 생성
		const message = `사전 검색 오류: ${errorMessage}`;
		this._showDictionaryMessage(message, 'error');
	}		/**
		 * Shows dictionary not found message to user
		 * @param {string} word - The word that was searched
		 * @private
		 */
		_showDictionaryNotFound(word) {
			const message = this.getLocalizedText('msg.info.dictionaryNotFound', { word });
			this._showDictionaryMessage(message, 'info');
		}

		/**
		 * Shows dictionary message in a temporary notification
		 * @param {string} message - The message to show
		 * @param {string} type - Message type ('error', 'info', 'success')
		 * @private
		 */
		_showDictionaryMessage(message, type = 'info') {
			// Remove existing notifications
			const existingNotifications = document.querySelectorAll('.wat-dictionary-notification');
			existingNotifications.forEach(notification => notification.remove());

			// Create notification element
			const notification = document.createElement('div');
			notification.className = `wat-dictionary-notification wat-dictionary-notification--${type}`;
			// role 상충 해소 — alert는 assertive를 함의하므로 polite와 동시 지정하지 않음.
			// error만 즉시 전달(alert), info/success는 status(polite 함의)
			if (type === 'error') {
				notification.setAttribute('role', 'alert');
			} else {
				notification.setAttribute('role', 'status');
				notification.setAttribute('aria-live', 'polite');
			}
			notification.textContent = message;

			// Add close button
			const closeButton = document.createElement('button');
			closeButton.className = 'wat-dictionary-notification__close';
			closeButton.textContent = '×';
			closeButton.setAttribute('aria-label', this.getLocalizedText('tags.button.text.close'));
			closeButton.onclick = () => notification.remove();
			notification.appendChild(closeButton);

			// Add to document
			document.body.appendChild(notification);

			// Auto-remove after 5 seconds
			setTimeout(() => {
				if (notification.parentNode) {
					notification.remove();
				}
			}, 5000);
		}

		/**
		 * Adjusts modal position to ensure it stays within viewport bounds
		 * @param {HTMLElement} modal - The modal element
		 * @param {number} modalWidth - Configured modal width
		 * @private
		 */
		_adjustModalPosition(modal, modalWidth) {
			try {
				// Get viewport dimensions
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;
				const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
				const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

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

		// ========== Page Structure      ==========

		/**
		 * Opens the page structure analysis dialog with headings and links overview (제목과 링크 개요가 포함된 페이지 구조 분석 다이얼로그를 엽니다)
		 * @returns {void}
		 * @description Creates an accessible modal dialog that displays page structure information including headings hierarchy and links
		 *              (제목 계층 구조와 링크를 포함한 페이지 구조 정보를 표시하는 접근 가능한 모달 다이얼로그를 생성합니다)
		 * @example
		 * // Open page structure dialog (페이지 구조 다이얼로그 열기)
		 * this.openPageStructure();
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
			overlay.classList.add('overlay', 'wat-overlay');
			fragment.appendChild(overlay);
		
			// 모달 레이어 생성
			const layer = document.createElement('div');
			layer.id = 'pgStructure_layer';
			layer.classList.add('page-structure-layer');
			layer.setAttribute('role', 'dialog');
			layer.setAttribute('aria-modal', 'true');
			layer.setAttribute('aria-labelledby', 'page-structure-title');
			layer.setAttribute('tabindex', '-1');
		
			// 타이틀 생성
			const layerTitle = document.createElement('h3');
			layerTitle.id = 'page-structure-title';
			layerTitle.textContent = this.getLocalizedText('panel.personal.options.pageStructure.title');
			layer.appendChild(layerTitle);
		
			// 탭 목록과 콘텐츠 컨테이너 생성
			const layerTabWrap = document.createElement('div');
			layerTabWrap.classList.add('tab-wrap');
			layerTabWrap.setAttribute('role', 'tablist');
		
			const layerContentWrap = document.createElement('div');
			layerContentWrap.classList.add('tab-content-wrap');
		
			// 탭 데이터 배열 (필요시 탭 추가 가능)
			const tabListData = [
				{ id: 'pgStruct_heading', text: this.getLocalizedText('panel.personal.options.pageStructure.text.tabList-heading') },
				{ id: 'pgStruct_link', text: this.getLocalizedText('panel.personal.options.pageStructure.text.tabList-link') }
			];
		
			// 탭 버튼과 탭 패널 생성
			tabListData.forEach((tab, index) => {
				const tabButton = this.structure_createTabButton(tab, index);
				layerTabWrap.appendChild(tabButton);
		
				const tabPanel = this.structure_createTabPanel(tab, index, basePath);
				layerContentWrap.appendChild(tabPanel);
			});
		
			layer.appendChild(layerTabWrap);
			layer.appendChild(layerContentWrap);
		
			// 닫기 버튼 생성
			const closeButton = document.createElement('button');
			closeButton.textContent = this.getLocalizedText('tags.button.text.close');
			closeButton.classList.add('btnClose');
			closeButton.addEventListener('click', () => {
				this.closePageStructure();
				if (previousFocusedElement) {
					previousFocusedElement.focus();
				} else {
					body.focus();
				}
			});
			layer.appendChild(closeButton);
		
			fragment.appendChild(layer);
			body.appendChild(fragment);
			layer.focus();
		
			// 포커스 트랩 설정
			this.trapFocus(layer, previousFocusedElement, overlay);
		}

		/**
		 * Creates a tab button for the page structure dialog (페이지 구조 다이얼로그용 탭 버튼을 생성합니다)
		 * @param {Object} tab - Tab configuration object (탭 설정 객체)
		 * @param {string} tab.id - Unique identifier for the tab (탭의 고유 식별자)
		 * @param {string} tab.text - Display text for the tab (탭의 표시 텍스트)
		 * @param {number} index - Index position of the tab (탭의 인덱스 위치)
		 * @returns {HTMLButtonElement} Created tab button element (생성된 탭 버튼 요소)
		 * @description Creates a tab button with proper ARIA attributes and keyboard navigation support
		 *              (적절한 ARIA 속성과 키보드 탐색 지원이 있는 탭 버튼을 생성합니다)
		 * @example
		 * // Create a tab button (탭 버튼 생성)
		 * const tabButton = this.structure_createTabButton(
		 *   { id: 'headings', text: 'Headings' }, 
		 *   0
		 * );
		 */
		structure_createTabButton(tab, index) {
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
		 * Creates a tab panel containing page structure content (페이지 구조 콘텐츠를 포함한 탭 패널을 생성합니다)
		 * @param {Object} tab - Tab configuration object (탭 설정 객체)
		 * @param {string} tab.id - Unique identifier for the tab panel (탭 패널의 고유 식별자)
		 * @param {number} index - Index position of the panel (패널의 인덱스 위치)
		 * @param {string} wat_basePath - Base path for asset resources (자산 리소스의 기본 경로)
		 * @returns {HTMLDivElement} Created tab panel element (생성된 탭 패널 요소)
		 * @description Creates tab panels with headings or links list based on tab type, excluding elements within excludeSelector
		 *              (excludeSelector 내부 요소를 제외하고 탭 타입에 따라 제목 또는 링크 목록이 있는 탭 패널을 생성합니다)
		 * @example
		 * // Create a headings tab panel (제목 탭 패널 생성)
		 * const panel = this.structure_createTabPanel(
		 *   { id: 'pgStruct_heading' }, 
		 *   0, 
		 *   './assets/'
		 * );
		 */
		structure_createTabPanel(tab, index, basePath) {
			const tabPanel = document.createElement('div');
			tabPanel.classList.add('tab-content');
			tabPanel.id = `${tab.id}_panel`;
			tabPanel.setAttribute('role', 'tabpanel');
			tabPanel.setAttribute('aria-labelledby', `${tab.id}_tab`);
			tabPanel.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
			tabPanel.style.display = index === 0 ? 'block' : 'none';
		
			// 패널 내 목록 생성
			const panelList = document.createElement('ul');
		
			if (tab.id === 'pgStruct_heading') {
				// this.selector 내부에 있는 heading 태그 제외
				const allHeadings = document.querySelectorAll(
					`h1:not(${this.selector} h1), h2:not(${this.selector} h2), h3:not(${this.selector} h3), h4:not(${this.selector} h4), h5:not(${this.selector} h5), h6:not(${this.selector} h6)`
				);
				// heading 태그의 조상 중에 (해당 태그 자체를 제외하고) .blind, aria-hidden="true", hidden, display:none, visibility:hidden이 있는 경우 제외
				const headings = Array.from(allHeadings).filter(heading => {
					const blindAncestor = heading.closest('.blind');
					if (blindAncestor && blindAncestor !== heading) {
						return false;
					}
					let current = heading.parentElement;
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
				});
		
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
					const btn_marker = document.createElement('button');
				btn_marker.classList.add('btn_marker');
				btn_marker.innerHTML = `<img class="img_icon marker" src="${basePath}assets/images/icon_pgStructure_marker.svg" alt="${this.getLocalizedText('panel.personal.options.pageStructure.options.marker')}">`;
				btn_marker.title = this.getLocalizedText('panel.personal.options.pageStructure.options.marker');
					li.appendChild(btn_marker);
		
					li.addEventListener('click', () => {
						this.closePageStructure();
						heading.scrollIntoView({ behavior: 'smooth' });
					});
					panelList.appendChild(li);
				});
			} else if (tab.id === 'pgStruct_link') {
				// 링크 모아보기: this.selector 내부의 링크 제외
				const allLinks = document.querySelectorAll(`a:not(${this.selector} a)`);
				// 링크의 조상 중에 조건에 해당하는 요소가 있으면 제외
				const links = Array.from(allLinks).filter(link => {
					// 조상에 blind 클래스가 있는지 검사 (링크 자체에 blind 클래스가 있는 경우는 허용)
					const blindAncestor = link.closest('.blind');
					if (blindAncestor && blindAncestor !== link) {
						return false;
					}
					// 링크의 부모 요소부터 최상위까지 순회하며 검사
					let current = link.parentElement;
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
				});
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
					tag_a.title = link.title || this.getLocalizedText('text.newWindow');
					tag_a.classList.add('pgStruct_link');
							const img_link = document.createElement('img');
				img_link.classList.add('img_icon', 'link');
				img_link.src = `${basePath}assets/images/icon_pgStructure_link.svg`;
				img_link.alt = this.getLocalizedText('panel.personal.options.pageStructure.options.link');
					tag_a.appendChild(img_link);
					li.appendChild(tag_a);
				
					const btn_marker = document.createElement('button');				btn_marker.classList.add('btn_marker');
				btn_marker.innerHTML = `<img class="img_icon marker" src="${basePath}assets/images/icon_pgStructure_marker.svg" alt="${this.getLocalizedText('panel.personal.options.pageStructure.options.marker')}">`;
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
			const focusableElements = layer.querySelectorAll(
				'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
			);
			const firstFocusableElement = focusableElements[0];
			const lastFocusableElement = focusableElements[focusableElements.length - 1];

			function handleTab(e) {
				if (e.key === 'Tab') {
					// 포커스 가능 요소가 없으면 Tab을 차단해 포커스가 모달 밖으로 새지 않도록 고정
					if (focusableElements.length === 0) {
						e.preventDefault();
						return;
					}
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
					layer.remove();
					overlay.remove();
					// 닫기 버튼 경로와 동일하게 body 상태 클래스도 정리 (스크롤 잠금 잔존 방지)
					document.body.classList.remove('overlay-active');
					if (previousFocusedElement) {
						previousFocusedElement.focus();
					} else {
						document.body.focus();
					}
				}
			}

			layer.addEventListener('keydown', handleTab);
		}

		/**
		 * Closes the page structure analysis dialog and cleans up resources (페이지 구조 분석 다이얼로그를 닫고 리소스를 정리합니다)
		 * @returns {void}
		 * @description Removes the modal dialog, overlay, and restores focus to the previously focused element
		 *              (모달 다이얼로그와 오버레이를 제거하고 이전에 포커스된 요소로 포커스를 복원합니다)
		 * @example
		 * // Close page structure dialog (페이지 구조 다이얼로그 닫기)
		 * this.closePageStructure();
		 */
		closePageStructure() {
			const layer = document.getElementById('pgStructure_layer');
			// 플러그인이 만든 오버레이만 제거 (호스트 페이지의 .overlay 오삭제 방지)
			const overlay = document.querySelector('.overlay.wat-overlay');
			const body = document.body;
			if (layer) {
				layer.classList.add('hidden');
				layer.remove();
			}
			if (overlay) {
				overlay.remove();
			}
			body.classList.remove('overlay-active');
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
			const extractClassElements = [
				'.ttsElm:not(.no-speech *):not(.blind *)'
			];
		
			// 모든 포커스 가능한 요소들을 검색하고 배열로 변환
			// 전달받은 element를 검색 루트로 사용 (기존에는 인자를 무시하고 항상 document 전체를 검색했음)
			const searchRoot = element || document;
			const combinedSelector = focusableElements.join(', ');
			const focusableNodes = Array.from(searchRoot.querySelectorAll(combinedSelector)).filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
			//console.log(focusableNodes);
			const extractClassNodes = Array.from(document.querySelectorAll(extractClassElements.join(',')));
		
			// Clear existing TTS elements and add new ones
			this.state.set('tts.elements', []);
			
			// 반환된 요소들 중 실제로 포커스 가능한지 추가 검증
			focusableNodes.forEach(el => {
				//if (!el.closest('.no-speech, .blind') && !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.offsetParent !== null) {
					const currentElements = this.state.get('tts.elements');
					this.state.set('tts.elements', [...currentElements, el]);
				//}
			});
			/*
			extractClassNodes.forEach(el => {
				const currentElements = this.state.get('tts.elements');
				this.state.set('tts.elements', [...currentElements, el]);
			});
			*/

		}

		/**
		 * Reads the text content of the current TTS element (현재 TTS 요소의 텍스트 내용을 읽습니다)
		 * @param {number} index - Index of the element to read (읽을 요소의 인덱스)
		 * @returns {void}
		 * @description Stops previous speech, highlights current element, and speaks its text content with configured settings
		 *              (이전 음성을 정지하고, 현재 요소를 강조하며, 설정된 옵션으로 텍스트 내용을 읽습니다)
		 * @example
		 * // Read the first element (첫 번째 요소 읽기)
		 * this.readCurrentText(0);
		 */
		readCurrentText(index) {
			const ttsElements = this.state.get('tts.elements');
			if (ttsElements.length === 0) return;
		
			// 이전 음성 재생 정지
			this.speechSynthesis.cancel();
		
			// 하이라이트 적용 및 포커스 이동 (수정된 tts_updateHighlight 호출)
			this.tts_updateHighlight(index);
		
			const utterance = new SpeechSynthesisUtterance(ttsElements[index].innerText);
			// 사용자가 설정한 읽기 속도 반영 (하드코딩 시 속도 설정이 무시됨)
			const ttsSpeed = this.state.get('plugin.readingSpeed') || 1;
			const language = this.language;
			utterance.rate = parseFloat(ttsSpeed);
			utterance.lang = language; // 사용자가 선택한 언어 설정
		
			utterance.onend = () => {
				if (index < ttsElements.length - 1) {
					const newIndex = index + 1;
					this.state.set('tts.currentIndex', newIndex);
					this.handleEndOfSectionOrAll(false); // 섹션 종료 알림
					this.readCurrentText(newIndex);
				} else {
					this.handleEndOfSectionOrAll(true); // 모든 섹션 종료 처리
				}
			};
		
			this.speechSynthesis.speak(utterance); // 음성 읽기 시작
		}

		/**
		 * Updates the visual highlight for the current TTS element (현재 TTS 요소의 시각적 강조를 업데이트합니다)
		 * @param {number} index - Index of the element to highlight (강조할 요소의 인덱스)
		 * @returns {void}
		 * @description Removes previous highlights, adds highlight to current element, focuses it, and sets up keyboard interaction
		 *              (이전 강조를 제거하고, 현재 요소에 강조를 추가하며, 포커스를 설정하고 키보드 상호작용을 준비합니다)
		 * @example
		 * // Highlight the third element (세 번째 요소 강조)
		 * this.tts_updateHighlight(2);
		 */
		tts_updateHighlight(index) {
			// 기존 하이라이트 제거
			const ttsElements = this.state.get('tts.elements');
			ttsElements.forEach(el => el.classList.remove('wat-tts_highlight'));
			if (index < ttsElements.length) {
				const currentEl = ttsElements[index];
				currentEl.classList.add('wat-tts_highlight');
				currentEl.focus();

				// 같은 요소가 재하이라이트될 때마다 리스너가 누적되어 Enter 한 번에 click이 다중 실행되는 것을 방지
				if (currentEl._watTtsKeydownHandler) {
					currentEl.removeEventListener('keydown', currentEl._watTtsKeydownHandler);
				}
				// 키다운 이벤트 리스너를 추가하여 스페이스바나 엔터키가 눌리면 TTS를 중지하고, 해당 요소를 실행하도록 함
				const keydownHandler = (e) => {
					if (e.key === ' ' || e.key === 'Enter') {
						e.preventDefault();
						currentEl.removeEventListener('keydown', keydownHandler);
						currentEl._watTtsKeydownHandler = null;
						this.speechSynthesis.cancel();
						// 만약 링크나 버튼과 같이 클릭이 가능한 요소라면 클릭 이벤트를 발생시킴
						const tag = currentEl.tagName.toLowerCase();
						if (tag === 'a' || tag === 'button') {
							currentEl.click();
						}
						this.tts_stopReading();
						this.toggleStartbtn_ttsStops(false); // 정지 상태로 버튼 토글
					}
				};
				currentEl._watTtsKeydownHandler = keydownHandler;
				currentEl.addEventListener('keydown', keydownHandler);
			}
		}

		/**
		 * Handles the end of section or all sections during TTS reading (TTS 읽기 중 섹션 종료 또는 전체 종료를 처리합니다)
		 * @param {boolean} isLastSection - Whether this is the last section (마지막 섹션인지 여부)
		 * @returns {void}
		 * @description Removes highlights and shows appropriate notifications for section or complete reading end
		 *              (강조를 제거하고 섹션 종료 또는 읽기 완료에 대한 적절한 알림을 표시합니다)
		 * @example
		 * // Handle section end (섹션 종료 처리)
		 * this.handleEndOfSectionOrAll(false);
		 * 
		 * // Handle complete reading end (전체 읽기 종료 처리)
		 * this.handleEndOfSectionOrAll(true);
		 */
		handleEndOfSectionOrAll(isLastSection) {
			// 모든 하이라이트 제거
			const ttsElements = this.state.get('tts.elements');
			ttsElements.forEach(el => el.classList.remove('wat-tts_highlight'));

			if (isLastSection) {
				this.toggleStartbtn_ttsStops(false); // 정지 상태로 버튼 토글
				this.showEndNotification(true); // 모든 섹션 종료 알림 표시
			} else {
				this.showEndNotification(false); // 섹션 종료 알림 표시
			}
		}

		/**
		 * Changes the TTS reading speed (TTS 읽기 속도를 변경합니다)
		 * @param {string|number} speed - Reading speed value (읽기 속도 값)
		 * @returns {void}
		 * @description Updates the speech synthesis rate for TTS playback
		 *              (TTS 재생을 위한 음성 합성 속도를 업데이트합니다)
		 * @example
		 * // Set reading speed to 1.5x (읽기 속도를 1.5배로 설정)
		 * this.changeTTSSpeed('1.5');
		 */
		changeTTSSpeed(speed) {
			this.state.set('plugin.readingSpeed', parseFloat(speed));
		}

		/**
		 * Shows a notification message for TTS events (TTS 이벤트에 대한 알림 메시지를 표시합니다)
		 * @param {boolean} isLastSection - Whether this notification is for the last section (마지막 섹션에 대한 알림인지 여부)
		 * @returns {void}
		 * @description Displays a temporary notification indicating end of reading area or complete page reading
		 *              (읽기 영역 종료 또는 전체 페이지 읽기 완료를 나타내는 임시 알림을 표시합니다)
		 * @example
		 * // Show end of section notification (섹션 종료 알림 표시)
		 * this.showEndNotification(false);
		 * 
		 * // Show end of page notification (페이지 종료 알림 표시)
		 * this.showEndNotification(true);
		 */
		showEndNotification(isLastSection) {
			const notification = document.createElement('div');
			notification.textContent = isLastSection ? this.getLocalizedText('panel.personal.options.tts.msg.endOfReadPage') : this.getLocalizedText('panel.personal.options.tts.msg.endOfReadArea');
			notification.classList.add('wat-notification'); // 스타일 적용을 위해 클래스 추가
			// 스크린리더가 읽기 완료 안내를 받도록 라이브 리전 지정 (WCAG 4.1.3)
			notification.setAttribute('role', 'status');
			notification.setAttribute('aria-live', 'polite');
			document.body.appendChild(notification);

			// 추적형 타이머 + remove() — 선제거 시 NotFoundError 방지, destroy 시 해제
			this._setTimeout(() => {
				notification.remove();
			}, 3000);
		}

		/**
		 * Handles focus events for TTS functionality (TTS 기능을 위한 포커스 이벤트를 처리합니다)
		 * @param {Event} event - Focus event object (포커스 이벤트 객체)
		 * @returns {void}
		 * @description Generates appropriate TTS text based on focused element type and speaks it
		 *              (포커스된 요소 타입에 따라 적절한 TTS 텍스트를 생성하고 읽습니다)
		 * @example
		 * // Handle focus on an input element (입력 요소의 포커스 처리)
		 * this.tts_handleFocus(focusEvent);
		 */
		tts_handleFocus(event) {
			ErrorHandler.safeExecute(() => {
				// 포커스 기반 TTS가 활성화되어 있는지 확인
				if (!this.state.get('tts.focusDetectFlag')) {
					return;
				}

				const element = event.target;
				const tagName = element.tagName.toLowerCase();
				let textToRead = '';

				// 현재 진행 중인 TTS가 있다면 부드럽게 전환
				if (this.speechSynthesis.speaking) {
					if (WAT_DEBUG_ENABLED) console.debug('[TTS] Canceling existing TTS for focus-based reading');
					this.speechSynthesis.cancel();
				}

				// #1 선택된 태그의 내부 내용을 모두 텍스트로 변환
				textToRead = this.extractTextWithImages(element);
				if (WAT_DEBUG_ENABLED) console.debug('[TTS Focus] Text extracted from element:', textToRead ? textToRead.substring(0, 100) : 'No text');
			
				if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || 
					tagName === 'a' || tagName === 'button' || tagName === 'img' || 
					tagName === 'progress' || tagName === 'table') {
					console.debug('[TTS Focus] Using generateTextToRead for tag:', tagName);
					textToRead = this.generateTextToRead(element, tagName);
				} else {
					// 지원되지 않는 태그의 경우, 요소의 텍스트 내용만 읽기
					console.debug('[TTS Focus] Using textContent for unsupported tag:', tagName);
					textToRead = textToRead || element.textContent?.trim() || '';
				}
				
				console.debug('[TTS Focus] Final text to read:', textToRead ? textToRead.substring(0, 100) : 'No text');
			
				if (textToRead && textToRead.trim()) {
					console.debug('[TTS Focus] Preparing TTS utterance');
					try {
						// 다시 한번 포커스 감지가 활성화되어 있는지 확인
						if (!this.state.get('tts.focusDetectFlag')) {
							console.debug('[TTS Focus] Focus detection disabled during text processing');
							return;
						}

						const utterance = new SpeechSynthesisUtterance(textToRead);
						utterance.rate = this.state.get('plugin.readingSpeed') || 1;
						utterance.lang = this.language;

						// TTS 시작 시 포커스 감지 상태 확인
						utterance.onstart = () => {
							if (!this.state.get('tts.focusDetectFlag')) {
								console.debug('[TTS Focus] Focus detection disabled during TTS start, canceling');
								this.speechSynthesis.cancel();
								return;
							}
							console.debug('[TTS Focus] Starting focus-based TTS for:', tagName);
						};

						// TTS 실행 중 주기적으로 상태 확인
						utterance.onboundary = () => {
							if (!this.state.get('tts.focusDetectFlag')) {
								console.debug('[TTS Focus] Focus detection disabled during TTS execution, canceling');
								this.speechSynthesis.cancel();
								return;
							}
						};

						// 포커스 기반 TTS의 경우 상태 관리는 단순화
						// (하이라이트 없이 음성만 출력)
						utterance.onend = () => {
							console.debug('[TTS] Focus-based TTS completed for element:', tagName);
						};

						utterance.onerror = (errorEvent) => {
							const isNormalStop = ['interrupted', 'canceled', 'aborted'].includes(errorEvent.error);
							
							if (isNormalStop) {
								console.debug(`[TTS] Focus-based TTS stopped: ${errorEvent.error}`);
							} else {
								ErrorHandler.handle(new Error(`Focus TTS Error: ${errorEvent.error}`), {
									category: ErrorHandler.CATEGORIES.USER_INPUT,
									severity: ErrorHandler.SEVERITY.WARNING,
									method: 'tts_handleFocus',
									component: 'TTS',
									data: { 
										error: errorEvent.error, 
										textToRead: textToRead.substring(0, 100),
										tagName,
										elementId: element.id || 'no-id'
									},
									strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
								});
							}
						};

						// 안전한 TTS 시작
						setTimeout(() => {
							// 포커스 감지가 활성화되어 있는지만 확인 (활성 요소 확인 제거)
							if (this.state.get('tts.focusDetectFlag')) {
								console.debug('[TTS Focus] Starting TTS for element:', tagName, textToRead.substring(0, 50));
								this.speechSynthesis.speak(utterance);
							} else {
								console.debug('[TTS Focus] Skipping TTS - focus detection disabled');
							}
						}, 50);

					} catch (error) {
						ErrorHandler.handle(error, {
							category: ErrorHandler.CATEGORIES.USER_INPUT,
							severity: ErrorHandler.SEVERITY.ERROR,
							method: 'tts_handleFocus',
							component: 'TTS',
							data: { textToRead, tagName, elementId: element.id || 'no-id' },
							strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
						});
					}
				} else {
					console.debug('[TTS Focus] No text content found for element:', tagName);
				}
			}, {
				category: ErrorHandler.CATEGORIES.EVENT_HANDLING,
				severity: ErrorHandler.SEVERITY.ERROR,
				method: 'tts_handleFocus',
				component: 'TTS',
				strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
			});
		}

		/**
		 * Reads the selected text with TTS highlighting (선택된 텍스트를 TTS 강조와 함께 읽습니다)
		 * @returns {void}
		 * @description Wraps selected text in highlight span, reads it aloud, and removes highlight when finished
		 *              (선택된 텍스트를 강조 span으로 감싸고, 소리내어 읽으며, 완료 시 강조를 제거합니다)
		 * @example
		 * // Read selected text (선택된 텍스트 읽기)
		 * this.tts_draggableText();
		 */
		tts_draggableText() {
			ErrorHandler.safeExecute(() => {
				// 현재 진행 중인 음성 합성만 정리 (상태는 변경하지 않음)
				if (this.speechSynthesis.speaking) {
					console.debug('[TTS] Canceling existing speech synthesis for selected text TTS');
					this.speechSynthesis.cancel();
				}

				// 기존에 wat-tts_wrapper 클래스를 가진 span 요소들을 찾아 "unwrap" 처리
				const existingWrappers = document.querySelectorAll('.wat-tts_wrapper');
				if (existingWrappers.length > 0) {
					console.debug(`[TTS] Cleaning up ${existingWrappers.length} existing highlight wrappers`);
					existingWrappers.forEach(wrapper => {
						this._cleanupTTSHighlight(wrapper);
					});
				}

				const selection = window.getSelection();
				const selectedText = selection.toString().trim();

				if (selectedText) {
					if (selection.rangeCount > 0) {
						const range = selection.getRangeAt(0);

						// 현재 진행 중인 모든 TTS를 정지하고 새로운 선택된 텍스트 TTS 시작
						if (this.speechSynthesis.speaking) {
							console.debug('[TTS] Stopping existing TTS for selected text reading');
							this.speechSynthesis.cancel();
						}
						
						// 새로 감쌀 span 생성 및 두 개의 클래스 추가
						const highlightSpan = document.createElement('span');
						highlightSpan.classList.add('wat-tts_highlight', 'wat-tts_wrapper');

						// Range.surroundContents() 대신 더 안전한 방법 사용
						try {
							// 선택된 범위가 단일 텍스트 노드인지 확인
							if (this._canSurroundContents(range)) {
								range.surroundContents(highlightSpan);
							} else {
								// 복잡한 선택 범위의 경우 대체 방법 사용
								this._safeHighlightRange(range, highlightSpan);
							}
						} catch (error) {
							ErrorHandler.handle(error, {
								category: ErrorHandler.CATEGORIES.DOM_OPERATION,
								severity: ErrorHandler.SEVERITY.WARNING,
								method: 'tts_draggableText',
								component: 'TTS',
								data: { selectedText, rangeDetails: this._getRangeDetails(range) },
								strategy: ErrorHandler.RECOVERY_STRATEGIES.FALLBACK,
								recovery: () => {
									// 폴백: 단순히 텍스트만 읽기
									this._speakTextOnly(selectedText);
								}
							});
							return;
						}

						// TTS 실행
						this._executeTTS(selectedText, highlightSpan);
					}
				} else {
					alert(this.getLocalizedText('msg.error.noSelectedText'));
				}
			}, {
				category: ErrorHandler.CATEGORIES.EVENT_HANDLING,
				severity: ErrorHandler.SEVERITY.ERROR,
				method: 'tts_draggableText',
				component: 'TTS',
				strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
			});
		}

		/**
		 * Checks if a range can safely use surroundContents
		 * @param {Range} range - The range to check
		 * @returns {boolean} True if safe to use surroundContents
		 * @private
		 */
		_canSurroundContents(range) {
			try {
				// 범위가 비어있는지 확인
				if (range.collapsed) {
					return false;
				}

				// 시작과 끝이 같은 컨테이너 내에 있는지 확인
				const commonAncestor = range.commonAncestorContainer;
				
				// 범위가 부분적으로 요소를 선택하지 않는지 확인
				if (range.startContainer === range.endContainer) {
					// 같은 텍스트 노드 내의 선택
					return range.startContainer.nodeType === Node.TEXT_NODE;
				}

				// 복잡한 선택 범위는 안전하지 않다고 간주
				return false;
			} catch (error) {
				return false;
			}
		}

		/**
		 * Safely highlights a complex range using alternative method
		 * @param {Range} range - The range to highlight
		 * @param {HTMLElement} highlightSpan - The span element to use for highlighting
		 * @private
		 */
		_safeHighlightRange(range, highlightSpan) {
			try {
				// 범위의 내용을 추출하고 새 span으로 감싸기
				const contents = range.extractContents();
				highlightSpan.appendChild(contents);
				range.insertNode(highlightSpan);
			} catch (error) {
				// 추출 방법도 실패하면 단순히 CSS 클래스로 하이라이트
				this._fallbackHighlight(range);
			}
		}

		/**
		 * Fallback highlighting method using CSS classes
		 * @param {Range} range - The range to highlight
		 * @private
		 */
		_fallbackHighlight(range) {
			// 선택된 영역에 CSS 클래스를 추가하여 시각적 하이라이트만 제공
			let rangeParent = range.commonAncestorContainer;
			// 텍스트 노드면 부모 요소로 승격해 하이라이트가 적용되도록 함
			if (rangeParent.nodeType === Node.TEXT_NODE) {
				rangeParent = rangeParent.parentElement;
			}

			if (rangeParent && rangeParent.nodeType === Node.ELEMENT_NODE) {
				// 공통 조상이 body/html이면 페이지 전체가 하이라이트되므로 생략
				if (rangeParent === document.body || rangeParent === document.documentElement) {
					return;
				}
				rangeParent.classList.add('wat-tts_highlight-fallback');

				// 일정 시간 후 클래스 제거 (추적형 타이머 — destroy 후 발화 방지)
				this._setTimeout(() => {
					rangeParent.classList.remove('wat-tts_highlight-fallback');
				}, 3000);
			}
		}

		/**
		 * Gets detailed information about a range for debugging
		 * @param {Range} range - The range to analyze
		 * @returns {Object} Range details
		 * @private
		 */
		_getRangeDetails(range) {
			return {
				collapsed: range.collapsed,
				startContainer: {
					nodeType: range.startContainer.nodeType,
					nodeName: range.startContainer.nodeName,
					textContent: range.startContainer.textContent?.substring(0, 50)
				},
				endContainer: {
					nodeType: range.endContainer.nodeType,
					nodeName: range.endContainer.nodeName,
					textContent: range.endContainer.textContent?.substring(0, 50)
				},
				startOffset: range.startOffset,
				endOffset: range.endOffset,
				commonAncestor: {
					nodeType: range.commonAncestorContainer.nodeType,
					nodeName: range.commonAncestorContainer.nodeName
				}
			};
		}

		/**
		 * Executes TTS without visual highlighting
		 * @param {string} text - Text to speak
		 * @private
		 */
		_speakTextOnly(text) {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = this.state.get('plugin.readingSpeed') || 1;
			utterance.lang = this.language;

			this.speechSynthesis.cancel();
			this.speechSynthesis.speak(utterance);
		}

		/**
		 * Executes TTS with highlighting
		 * @param {string} selectedText - Text to speak
		 * @param {HTMLElement} highlightSpan - Span element for highlighting
		 * @private
		 */
		_executeTTS(selectedText, highlightSpan) {
			const utterance = new SpeechSynthesisUtterance(selectedText);
			utterance.rate = this.state.get('plugin.readingSpeed') || 1;
			utterance.lang = this.language;

			// 상태 업데이트
			this.state.set('plugin.currentUtterance', utterance);

			// 음성 출력이 끝난 후, 해당 wrapper span 해제
			utterance.onend = () => {
				this._cleanupTTSHighlight(highlightSpan);
				// 선택한 텍스트 TTS는 일반 TTS 상태와 독립적이므로 isTTSActive 상태를 변경하지 않음
				this.state.set('plugin.currentUtterance', null);
			};

			// 개선된 에러 처리
			utterance.onerror = (event) => {
				// 'interrupted' 에러는 정상적인 사용자 행동이므로 낮은 심각도로 처리
				const isInterrupted = event.error === 'interrupted';
				const isCanceled = event.error === 'canceled';
				const isAborted = event.error === 'aborted';
				const isNormalStop = isInterrupted || isCanceled || isAborted;
				
				const severity = isNormalStop ? 
					ErrorHandler.SEVERITY.DEBUG : 
					ErrorHandler.SEVERITY.WARNING;

				// 디버그 로그: 정상적인 중단도 개발 시 추적을 위해 기록
				if (isNormalStop) {
					console.debug(`[TTS] Normal stop: ${event.error}`, {
						selectedText: selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''),
						errorType: event.error,
						timestamp: new Date().toISOString()
					});
				} else {
					// 정상적인 중단이 아닌 경우만 에러로 기록
					ErrorHandler.handle(new Error(`TTS Error: ${event.error}`), {
						category: ErrorHandler.CATEGORIES.USER_INPUT,
						severity: severity,
						method: '_executeTTS',
						component: 'TTS',
						data: { 
							error: event.error, 
							selectedText: selectedText.substring(0, 100),
							isInterrupted,
							isCanceled,
							isAborted,
							utteranceState: this.speechSynthesis.speaking ? 'speaking' : 'idle',
							queueLength: this.speechSynthesis.pending ? 'has-pending' : 'empty'
						},
						strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
					});
				}

				// 모든 경우에 상태 정리 (정상 중단이든 에러든)
				this.state.set('plugin.isTTSActive', false);
				this.state.set('plugin.currentUtterance', null);
				
				// 하이라이트 정리 (정상 중단의 경우도 포함)
				// 사용자가 의도적으로 중단한 경우에도 하이라이트를 제거하여 깔끔한 UI 제공
				this._cleanupTTSHighlight(highlightSpan);
			};

			// TTS 시작 전 이전 음성 완전히 취소
			this.speechSynthesis.cancel();
			
			// 브라우저별 TTS 취소 완료를 위한 대기 시간
			const cancelDelay = navigator.userAgent.includes('Chrome') ? 50 : 10;
			
			// 짧은 지연 후 새 음성 시작 (브라우저 호환성 및 상태 안정성)
			setTimeout(() => {
				// 다시 한번 상태 확인 - 다른 TTS가 시작되었을 수 있음
				if (this.state.get('plugin.currentUtterance') === utterance && 
					!this.speechSynthesis.speaking) {
					
					try {
						this.speechSynthesis.speak(utterance);
						console.debug('[TTS] Speech started successfully', {
							text: selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''),
							timestamp: new Date().toISOString()
						});
					} catch (error) {
						ErrorHandler.handle(error, {
							category: ErrorHandler.CATEGORIES.USER_INPUT,
							severity: ErrorHandler.SEVERITY.ERROR,
							method: '_executeTTS',
							component: 'TTS',
							data: { selectedText: selectedText.substring(0, 100) },
							strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE,
							recovery: () => {
								this.state.set('plugin.isTTSActive', false);
								this.state.set('plugin.currentUtterance', null);
								this._cleanupTTSHighlight(highlightSpan);
							}
						});
					}
				} else {
					// 다른 TTS가 시작되었거나 상태가 변경된 경우 정리
					console.debug('[TTS] Speech canceled due to state change');
					this._cleanupTTSHighlight(highlightSpan);
					// 발화되지 않은 utterance가 상태에 잔류해 hasCurrentUtterance가 영구 true가 되는 것을 방지
					if (this.state.get('plugin.currentUtterance') === utterance) {
						this.state.set('plugin.currentUtterance', null);
					}
				}
			}, cancelDelay);
		}

		/**
		 * Toggles TTS focus detection functionality (TTS 포커스 감지 기능을 토글합니다)
		 * @param {boolean} flag_ttsStarting - Whether to start TTS focus detection (TTS 포커스 감지를 시작할지 여부)
		 * @returns {void}
		 * @description Enables or disables automatic TTS reading when elements receive focus
		 *              (요소가 포커스를 받을 때 자동 TTS 읽기를 활성화하거나 비활성화합니다)
		 * @example
		 * // Enable focus detection (포커스 감지 활성화)
		 * this.tts_toggleFocusDetection(true);
		 * 
		 * // Disable focus detection (포커스 감지 비활성화)
		 * this.tts_toggleFocusDetection(false);
		 */
		tts_toggleFocusDetection(flag_ttsStarting) {
			console.debug('[TTS Focus] Toggling focus detection:', flag_ttsStarting);
			console.debug('[TTS Focus] Current state before toggle:', this.state.get('tts.focusDetectFlag'));
			
			this.state.set('tts.focusDetectFlag', flag_ttsStarting);
			console.debug('[TTS Focus] State set to:', this.state.get('tts.focusDetectFlag'));
    
			if (flag_ttsStarting) {
				// 포커스 이벤트 리스너 등록
				console.debug('[TTS Focus] Registering focusin event listener');
				this._addGlobalEventListener('focusin', 'focusIn');
				console.debug('[TTS Focus] Event listener registration completed');
				
				// UI 업데이트
				const btn = document.getElementById('wat-button-tts_focus_toggle');
				if (btn) {
					btn.setAttribute('aria-pressed', 'true');
					btn.setAttribute('title', this.getLocalizedText('panel.personal.options.tts.options.focus-stop'));
					btn.textContent = this.getLocalizedText('panel.personal.options.tts.options.focus-stop');
					console.debug('[TTS Focus] Button UI updated to active state');
				} else {
					console.error('[TTS Focus] Focus toggle button not found!');
				}
				
				console.debug('[TTS Focus] Focus detection enabled - listening for focus events');
			} else {
				// 먼저 진행 중인 모든 TTS를 즉시 정지
				if (this.speechSynthesis.speaking) {
					console.debug('[TTS Focus] Stopping active speech synthesis');
					this.speechSynthesis.cancel();
				}
				
				// Regular TTS도 비활성화
				if (this.state.get('plugin.isTTSActive')) {
					console.debug('[TTS Focus] Disabling regular TTS as focus TTS is stopping');
					this.state.set('plugin.isTTSActive', false);
					this.toggleStartbtn_ttsStops(false);
				}
				
				// 포커스 이벤트 리스너 제거
				this._removeGlobalEventListener('focusin');

				// 포커스 TTS가 클릭 시 부여했던 tabindex를 원복 (호스트 페이지 탭 순서 영구 변형 방지)
				document.querySelectorAll('[data-wat-tabindex-added]').forEach(el => {
					el.removeAttribute('tabindex');
					delete el.dataset.watTabindexAdded;
				});

				// UI 업데이트
				const btn = document.getElementById('wat-button-tts_focus_toggle');
				if (btn) {
					btn.setAttribute('aria-pressed', 'false');
					btn.setAttribute('title', this.getLocalizedText('panel.personal.options.tts.options.focus-start'));
					btn.textContent = this.getLocalizedText('panel.personal.options.tts.options.focus-start');
				}
				
				console.debug('[TTS Focus] Focus detection disabled - stopped listening for focus events and canceled active speech');
			}
		}

		/**
		 * Stops TTS reading and resets UI state (TTS 읽기를 중지하고 UI 상태를 재설정합니다)
		 * @returns {void}
		 * @description Cancels speech synthesis, updates button states, and removes all highlights
		 *              (음성 합성을 취소하고, 버튼 상태를 업데이트하며, 모든 강조를 제거합니다)
		 * @example
		 * // Stop TTS reading (TTS 읽기 중지)
		 * this.tts_stopReading();
		 */
		tts_stopReading() {
				this.speechSynthesis.cancel();
				// 버튼 상태는 호출하는 곳에서 직접 관리하도록 변경
				// this.toggleStartbtn_ttsStops(false); // 이 부분을 제거

				// 하이라이트 제거
				const ttsElements = this.state.get('tts.elements');
				ttsElements.forEach(el => el.classList.remove('wat-tts_highlight'));
		}

		/**
		 * Cancels current TTS and cleans up all TTS-related state (현재 TTS를 취소하고 모든 TTS 관련 상태를 정리합니다)
		 * @returns {void}
		 * @description Safely cancels speech synthesis, cleans up highlights, and resets TTS state
		 *              (음성 합성을 안전하게 취소하고, 하이라이트를 정리하며, TTS 상태를 재설정합니다)
		 * @example
		 * // Cancel current TTS (현재 TTS 취소)
		 * this.cancelTTS();
		 */
		cancelTTS() {
			try {
				// 음성 합성 취소
				this.speechSynthesis.cancel();
				
				// 상태 정리
				this.state.set('plugin.isTTSActive', false);
				this.state.set('plugin.currentUtterance', null);
				
				// 모든 TTS 하이라이트 정리
				const ttsWrappers = document.querySelectorAll('.wat-tts_wrapper');
				ttsWrappers.forEach(wrapper => {
					this._cleanupTTSHighlight(wrapper);
				});
				
				console.debug('[TTS] TTS canceled and state cleaned up');
			} catch (error) {
				ErrorHandler.handle(error, {
					category: ErrorHandler.CATEGORIES.USER_INPUT,
					severity: ErrorHandler.SEVERITY.WARNING,
					method: 'cancelTTS',
					component: 'TTS',
					data: {},
					strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
				});
			}
		}

		/**
		 * Gets current TTS status and diagnostics (현재 TTS 상태 및 진단 정보를 가져옵니다)
		 * @returns {Object} TTS status object with detailed information (상세 정보가 포함된 TTS 상태 객체)
		 * @description Provides comprehensive TTS state information for debugging and user feedback
		 *              (디버깅 및 사용자 피드백을 위한 포괄적인 TTS 상태 정보를 제공합니다)
		 * @example
		 * // Get TTS status (TTS 상태 가져오기)
		 * const status = this.getTTSStatus();
		 * console.log('TTS is active:', status.isActive);
		 */
		getTTSStatus() {
			const currentUtterance = this.state.get('plugin.currentUtterance');
			const isActive = this.state.get('plugin.isTTSActive');
			const isSpeaking = this.speechSynthesis.speaking;
			const isPending = this.speechSynthesis.pending;
			const isPaused = this.speechSynthesis.paused;
			
			const highlightElements = document.querySelectorAll('.wat-tts_wrapper');
			
			return {
				isActive,
				isSpeaking,
				isPending,
				isPaused,
				hasCurrentUtterance: !!currentUtterance,
				highlightCount: highlightElements.length,
				isInconsistent: isActive !== isSpeaking,
				canSpeak: 'speechSynthesis' in window,
				voicesAvailable: this.speechSynthesis.getVoices().length > 0,
				timestamp: new Date().toISOString(),
				
				// 디버깅용 상세 정보
				debug: {
					utteranceExists: !!currentUtterance,
					stateFlags: {
						isTTSActive: isActive,
						speaking: isSpeaking,
						pending: isPending,
						paused: isPaused
					},
					highlightElements: Array.from(highlightElements).map(el => ({
						tagName: el.tagName,
						classes: Array.from(el.classList),
						textContent: el.textContent ? el.textContent.substring(0, 50) + '...' : ''
					}))
				}
			};
		}

		/**
		 * Performs TTS health check and recovery (TTS 상태 검사 및 복구를 수행합니다)
		 * @returns {boolean} True if TTS is healthy or successfully recovered (TTS가 정상이거나 성공적으로 복구된 경우 true)
		 * @description Checks TTS consistency and attempts automatic recovery if needed
		 *              (TTS 일관성을 확인하고 필요시 자동 복구를 시도합니다)
		 * @example
		 * // Check and recover TTS (TTS 검사 및 복구)
		 * const isHealthy = this.checkAndRecoverTTS();
		 */
		checkAndRecoverTTS() {
			const status = this.getTTSStatus();
			
			// 상태 불일치 감지
			if (status.isInconsistent) {
				console.warn('[TTS] State inconsistency detected, attempting recovery', status.debug);
				
				// 복구 시도
				this.cancelTTS();
				
				// 복구 후 재검사
				const recoveryStatus = this.getTTSStatus();
				const isRecovered = !recoveryStatus.isInconsistent &&
					!recoveryStatus.isActive &&
					!recoveryStatus.isSpeaking;
				
				if (isRecovered) {
					console.info('[TTS] Successfully recovered from inconsistent state');
					return true;
				} else {
					console.error('[TTS] Failed to recover from inconsistent state', recoveryStatus.debug);
					return false;
				}
			}
			
			// 상태가 일관된 경우
			return true;
		}

		/**
		 * Cleans up TTS highlight wrapper element (TTS 하이라이트 래퍼 요소를 정리합니다)
		 * @param {HTMLElement} wrapperElement - The wrapper element to clean up (정리할 래퍼 요소)
		 * @returns {void}
		 * @description Safely removes TTS highlight wrapper and restores original content
		 *              (TTS 하이라이트 래퍼를 안전하게 제거하고 원본 내용을 복원합니다)
		 * @private
		 * @example
		 * // Clean up a highlight wrapper (하이라이트 래퍼 정리)
		 * this._cleanupTTSHighlight(wrapperSpan);
		 */
		_cleanupTTSHighlight(wrapperElement) {
			try {
				if (!wrapperElement || !wrapperElement.parentNode) {
					return;
				}

				// 래퍼 요소의 내용을 부모로 이동
				const parent = wrapperElement.parentNode;
				while (wrapperElement.firstChild) {
					parent.insertBefore(wrapperElement.firstChild, wrapperElement);
				}

				// 래퍼 요소 제거
				parent.removeChild(wrapperElement);

				console.debug('[TTS] Cleaned up TTS highlight wrapper');
			} catch (error) {
				ErrorHandler.handle(error, {
					category: ErrorHandler.CATEGORIES.DOM_OPERATION,
					severity: ErrorHandler.SEVERITY.WARNING,
					method: '_cleanupTTSHighlight',
					component: 'TTS',
					data: { 
						elementExists: !!wrapperElement,
						hasParent: !!(wrapperElement && wrapperElement.parentNode),
						tagName: wrapperElement ? wrapperElement.tagName : 'null'
					},
					strategy: ErrorHandler.RECOVERY_STRATEGIES.IGNORE
				});
			}
		}

		/**
		 * Toggles TTS start and stop button states (TTS 시작 및 정지 버튼 상태를 토글합니다)
		 * @param {boolean} flag_ttsStarting - Whether TTS is starting (TTS가 시작되는지 여부)
		 * @returns {void}
		 * @description Updates button states and accessibility attributes for TTS controls
		 *              (TTS 컨트롤의 버튼 상태와 접근성 속성을 업데이트합니다)
		 * @example
		 * // Set buttons to playing state (버튼을 재생 상태로 설정)
		 * this.toggleStartbtn_ttsStops(true);
		 * 
		 * // Set buttons to stopped state (버튼을 정지 상태로 설정)
		 * this.toggleStartbtn_ttsStops(false);
		 */
		toggleStartbtn_ttsStops(flag_ttsStarting) {
				// 패널 미렌더/제거 상태에서 호출돼도 크래시 없이 이벤트 디스패치까지 진행되도록 null 가드
				const ttsToggleBtn = document.getElementById('wat-button-tts_toggle');
				const ttsNextBtn = document.getElementById('wat-button-tts_next');
				const ttsPrevBtn = document.getElementById('wat-button-tts_prev');

				if (ttsToggleBtn) ttsToggleBtn.setAttribute('aria-pressed', flag_ttsStarting ? 'true' : 'false');
				if (ttsNextBtn) ttsNextBtn.disabled = !flag_ttsStarting;
				if (ttsPrevBtn) ttsPrevBtn.disabled = !flag_ttsStarting;
				
				// Dispatch TTS state change event
				this._dispatchStateEvent('tts:stateChanged', {
					isActive: flag_ttsStarting,
					state: flag_ttsStarting ? 'started' : 'stopped',
					timestamp: Date.now()
				});
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
					const altText = node.getAttribute('alt') || node.getAttribute('title') || this.getLocalizedText('panel.personal.options.imgTextConvert.msg.noAlt');
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
			const lang = this.language || Localization.DEFAULT_LANGUAGE;

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
					//text += ' ' + this.getLocalizedText('tts.input.types.textFieldSuffix');
					break;
				case 'checkbox':
					text += element.checked ? this.getLocalizedText('tts.input.states.checked') : this.getLocalizedText('tts.input.states.unchecked');
					//text += ' ' + this.getLocalizedText('tts.input.types.checkboxSuffix');
					break;
				case 'radio':
					text += element.checked ? this.getLocalizedText('tts.input.states.selected') : this.getLocalizedText('tts.input.states.unselected');
					//text += ' ' + this.getLocalizedText('tts.input.types.radioSuffix');
					break;
				case 'button':
				case 'submit':
				case 'reset':
					text += value || element.textContent || this.getLocalizedText('tts.input.types.button');
					//text += ' ' + this.getLocalizedText('tts.input.types.buttonSuffix');
					break;
				default:
					if (value) {
						text += value;
					}
					//text += ' ' + type + ' ' + this.getLocalizedText('tts.input.types.fieldSuffix');
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
			
			//text += this.getLocalizedText('tts.textarea.label') + ' ';
			
			if (value) {
				//text += this.getLocalizedText('tts.textarea.currentValue') + ' ' + value;
				text += value;
			} else if (placeholder) {
				//text += this.getLocalizedText('tts.textarea.placeholder') + ' ' + placeholder;
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
				//text += ' ' + this.getLocalizedText('tts.select.suffix'); // 콤보박스, 드롭다운 등
			} else {
				if (label) text += ' ';
				//text += this.getLocalizedText('tts.select.noSelection');
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
				text += ' ' + this.getLocalizedText('tts.link.newWindow');
			}
			
			// 링크임을 나타내는 접미사 추가
			//text += ' ' + this.getLocalizedText('tts.link.suffix');
			
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
				text = this.getLocalizedText('tts.button.unlabeled');
			}
			
			// 버튼임을 나타내는 접미사 추가 (레이블이 아닌 접미사로)
			if (text && text !== this.getLocalizedText('tts.button.unlabeled')) {
				//text += ' ' + this.getLocalizedText('tts.button.suffix');
			}
			
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
			const src = element.src || '';
			
			let text = this.getLocalizedText('tts.image.label') + ' ';
			
			if (alt) {
				text += alt;
			} else if (title) {
				text += title;
			} else {
				text += this.getLocalizedText('tts.image.noDescription');
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
			
			let text = this.getLocalizedText('tts.progress.label') + ' ';
			text += percentage + this.getLocalizedText('tts.progress.percent');
			
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

			let text = this.getLocalizedText('tts.table.label') + ' ';

			if (caption) {
				text += caption.textContent + ' ';
			}

			if (rows > 0) {
				text += this.getLocalizedText('tts.table.size', { rows: rows, cols: Math.round(cols) });
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

		// ========== iframe Style        ==========

		/**
		 * Applies accessibility styles to all valid iframe elements on the page (페이지의 모든 유효한 iframe 요소에 접근성 스타일을 적용합니다)
		 * @returns {void}
		 * @description Finds all iframe elements and processes only those not in exclude zones, applying accessibility styles to their content
		 *              (모든 iframe 요소를 찾아 제외 영역에 없는 것들만 처리하여 콘텐츠에 접근성 스타일을 적용합니다)
		 * @example
		 * // Apply styles to all accessible iframes (모든 접근 가능한 iframe에 스타일 적용)
		 * this.applyStylesToIframes();
		 */
		applyStylesToIframes() {
			const iframes = document.querySelectorAll('iframe');
			if (WAT_DEBUG_ENABLED) console.log(`발견된 iframe 개수: ${iframes.length}`);
			
			// excludeSelector에 해당하지 않는 iframe만 필터링
			const validIframes = Array.from(iframes).filter(iframe => {
				return !this.isIframeInExcludeZone(iframe);
			});
			
			if (WAT_DEBUG_ENABLED) console.log(`처리 대상 iframe 개수: ${validIframes.length} (제외된 개수: ${iframes.length - validIframes.length})`);
			
			validIframes.forEach((iframe, index) => {
				this.processIframe(iframe, index);
			});
		}

		/**
		 * Processes individual iframe for accessibility style application (접근성 스타일 적용을 위해 개별 iframe을 처리합니다)
		 * @param {HTMLIFrameElement} iframe - Target iframe element to process (처리할 대상 iframe 요소)
		 * @param {number} index - Index position of the iframe in the collection (컬렉션에서 iframe의 인덱스 위치)
		 * @returns {void}
		 * @throws {TypeError} Throws error if iframe is not a valid HTMLIFrameElement (iframe이 유효한 HTMLIFrameElement가 아닌 경우 에러 발생)
		 * @description Attempts to access iframe content and apply accessibility styles if same-origin access is possible, with comprehensive error handling
		 *              (동일 출처 접근이 가능한 경우 iframe 콘텐츠에 접근을 시도하고 접근성 스타일을 적용하며, 포괄적인 에러 처리를 포함합니다)
		 * @example
		 * // Process a specific iframe (특정 iframe 처리)
		 * this.processIframe(iframeElement, 0);
		 */
		processIframe(iframe, index) {
			const src = iframe.src || '';
			const iframeId = iframe.id || `iframe-${index}`;
			
			// iframe이 excludeSelector 내부에 있는지 확인
			if (this.isIframeInExcludeZone(iframe)) {
				if (WAT_DEBUG_ENABLED) console.log(`🚫 excludeSelector 내부 iframe 제외: ${iframeId} (${src})`);
				return;
			}
			
			try {
				// 동일 출처 접근 시도
				const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
				
				if (iframeDoc) {
					if (WAT_DEBUG_ENABLED) console.log(`✅ 동일 출처 iframe 처리 성공: ${iframeId} (${src})`);
					this.applyStylesToIframeDocument(iframeDoc, iframeId);
				} else {
					console.warn(`[WAT] iframe document access denied: ${iframeId} (${src})`);
				}
			} catch (error) {
				// 크로스 오리진인 경우
				if (this.isKnownExternalService(src)) {
					if (WAT_DEBUG_ENABLED) console.log(`ℹ️ 외부 서비스 iframe 스킵: ${iframeId} (${src})`);
				} else {
					console.warn(`[WAT] Cross-origin iframe processing failed: ${iframeId} (${src})`, error.message);
				}
			}
		}

		/**
		 * Checks if an iframe is located within an excluded zone (iframe이 제외 영역 내에 위치하는지 확인합니다)
		 * @param {HTMLIFrameElement} iframe - Iframe element to check (확인할 iframe 요소)
		 * @returns {boolean} True if iframe should be excluded, false otherwise (iframe이 제외되어야 하면 true, 그렇지 않으면 false)
		 * @description Verifies if iframe is within container, has exclude classes, or matches user-defined exclude selectors
		 *              (iframe이 컨테이너 내부에 있는지, 제외 클래스를 가지는지, 또는 사용자 정의 제외 선택자와 일치하는지 확인합니다)
		 * @example
		 * // Check if iframe should be excluded (iframe이 제외되어야 하는지 확인)
		 * const shouldExclude = this.isIframeInExcludeZone(iframeElement);
		 */
		isIframeInExcludeZone(iframe) {
			// 1. 컨테이너 내부 iframe 확인
			if (this.container && this.container.contains(iframe)) {
				return true;
			}
			
			// 2. wat-exclude 클래스 확인
			if (iframe.classList.contains('wat-exclude') || iframe.closest('.wat-exclude')) {
				return true;
			}
			
			// 3. 사용자 설정 excludeSelector 확인
			if (this.excludeSelector) {
				const userExcludes = this.excludeSelector.split(',').map(s => s.trim());
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
		 * Determines if the iframe source is from a known external service (iframe 소스가 알려진 외부 서비스에서 온 것인지 판단합니다)
		 * @param {string} src - Source URL of the iframe (iframe의 소스 URL)
		 * @returns {boolean} True if source is from known external service, false otherwise (알려진 외부 서비스에서 온 것이면 true, 그렇지 않으면 false)
		 * @description Checks against a list of known external services like YouTube, Google, social media platforms
		 *              (YouTube, Google, 소셜 미디어 플랫폼과 같은 알려진 외부 서비스 목록과 대조하여 확인합니다)
		 * @example
		 * // Check if source is external service (소스가 외부 서비스인지 확인)
		 * const isExternal = this.isKnownExternalService('https://www.youtube.com/embed/video');
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
		 * Applies accessibility styles to the content of an iframe document (iframe 문서의 콘텐츠에 접근성 스타일을 적용합니다)
		 * @param {Document} iframeDoc - Document object of the iframe (iframe의 Document 객체)
		 * @param {string} iframeId - Unique identifier for the iframe (iframe의 고유 식별자)
		 * @returns {void}
		 * @description Copies main document's accessibility settings to iframe, injects CSS, and marks elements for dynamic styling
		 *              (메인 문서의 접근성 설정을 iframe에 복사하고, CSS를 주입하며, 동적 스타일링을 위해 요소를 마킹합니다)
		 * @example
		 * // Apply styles to iframe document (iframe 문서에 스타일 적용)
		 * this.applyStylesToIframeDocument(iframeDocument, 'iframe-1');
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

			if (WAT_DEBUG_ENABLED) console.log(`✅ iframe 스타일 적용 완료: ${iframeId}`);
		}

		/**
		 * Injects CSS stylesheet into iframe document for accessibility styling (접근성 스타일링을 위해 iframe 문서에 CSS 스타일시트를 주입합니다)
		 * @param {Document} iframeDoc - Target iframe document (대상 iframe 문서)
		 * @param {string} iframeId - Identifier for the iframe (iframe의 식별자)
		 * @returns {void}
		 * @description Copies main document's CSS link and injects it into iframe if not already present
		 *              (메인 문서의 CSS 링크를 복사하여 iframe에 아직 없는 경우 주입합니다)
		 * @example
		 * // Inject CSS into iframe (iframe에 CSS 주입)
		 * this.injectCSSToIframe(iframeDocument, 'iframe-1');
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
					if (WAT_DEBUG_ENABLED) console.log(`✅ CSS 주입 완료: ${iframeId}`);
				}
			} catch (error) {
				console.warn(`[WAT] CSS injection failed: ${iframeId}`, error.message);
			}
		}

		/**
		 * Marks elements within iframe for dynamic styling capabilities (동적 스타일링 기능을 위해 iframe 내부 요소들을 마킹합니다)
		 * @param {Document} iframeDoc - Target iframe document (대상 iframe 문서)
		 * @param {string} iframeId - Identifier for the iframe (iframe의 식별자)
		 * @returns {void}
		 * @description Identifies and marks text elements within iframe with classes for font size, spacing, alignment styling
		 *              (iframe 내부의 텍스트 요소를 식별하고 폰트 크기, 간격, 정렬 스타일링을 위한 클래스로 마킹합니다)
		 * @example
		 * // Mark iframe elements for dynamic styling (동적 스타일링을 위해 iframe 요소 마킹)
		 * this.markDynamicStyledElementsInIframe(iframeDocument, 'iframe-1');
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
				if (this.excludeSelector) {
					const userExcludes = this.excludeSelector.split(',').map(s => s.trim());
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
							const pxValue = this.getPxValueFromIframe(el, css);
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
				
				if (WAT_DEBUG_ENABLED) console.log(`✅ iframe 요소 마킹 완료: ${iframeId}, 처리된 요소: ${elements.length}개`);
			} catch (error) {
				console.warn(`[WAT] iframe element marking failed: ${iframeId}`, error.message);
			}
		}

		/**
		 * Determines if an element within iframe should be excluded from styling (iframe 내부 요소가 스타일링에서 제외되어야 하는지 판단합니다)
		 * @param {Element} element - Element within iframe to check (확인할 iframe 내부 요소)
		 * @param {Document} iframeDoc - Document context of the iframe (iframe의 문서 컨텍스트)
		 * @returns {boolean} True if element should be excluded, false otherwise (요소가 제외되어야 하면 true, 그렇지 않으면 false)
		 * @description Checks for exclude classes and user-defined exclude selectors within iframe context
		 *              (iframe 컨텍스트 내에서 제외 클래스와 사용자 정의 제외 선택자를 확인합니다)
		 * @example
		 * // Check if iframe element should be excluded (iframe 요소가 제외되어야 하는지 확인)
		 * const shouldExclude = this.shouldExcludeElementInIframe(element, iframeDocument);
		 */
		shouldExcludeElementInIframe(element, iframeDoc) {
			// wat-exclude 클래스 확인
			if (element.classList.contains('wat-exclude') || element.closest('.wat-exclude')) {
				return true;
			}
			
			// 사용자 설정 excludeSelector 확인
			if (this.excludeSelector) {
				const userExcludes = this.excludeSelector.split(',').map(s => s.trim());
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
		 * Calculates pixel values for CSS properties within iframe context (iframe 컨텍스트 내에서 CSS 속성의 픽셀 값을 계산합니다)
		 * @param {Element} el - Target element within iframe (iframe 내부의 대상 요소)
		 * @param {string} prop - CSS property name to calculate (계산할 CSS 속성명)
		 * @returns {number|string} Calculated pixel value or empty string if calculation fails (계산된 픽셀 값 또는 계산 실패 시 빈 문자열)
		 * @description Converts various CSS units (em, rem, px) to pixel values for consistent styling within iframes
		 *              (iframe 내에서 일관된 스타일링을 위해 다양한 CSS 단위(em, rem, px)를 픽셀 값으로 변환합니다)
		 * @example
		 * // Get pixel value for font size in iframe (iframe에서 폰트 크기의 픽셀 값 가져오기)
		 * const pixelValue = this.getPxValueFromIframe(element, 'font-size');
		 */
		getPxValueFromIframe(el, prop) {
			try {
				const val = el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue(prop);
				if (!val) return '';
				if (prop === 'line-height' && val === 'normal') return '';
				if (val.endsWith('px')) return parseFloat(val);
				if (val.endsWith('em') || val.endsWith('rem')) {
					const base = parseFloat(el.ownerDocument.defaultView.getComputedStyle(el).fontSize);
					return parseFloat(val) * base;
				}
				return parseFloat(val) || '';
			} catch (error) {
				return '';
			}
		}

		// ========== iframe Sync         ==========

		/**
		 * Synchronizes styles to all accessible iframe elements on the page (페이지의 모든 접근 가능한 iframe 요소에 스타일을 동기화합니다)
		 * @param {string} styleType - Type of style to synchronize ('fontSize', 'fontFamily', 'lineHeight', etc.) (동기화할 스타일 타입)
		 * @param {string} value - Value to apply for the style (스타일에 적용할 값)
		 * @returns {void}
		 * @description Applies the specified style to all iframe documents that are not in exclude zones, with error handling for cross-origin restrictions
		 *              (제외 영역에 없는 모든 iframe 문서에 지정된 스타일을 적용하며, 크로스 오리진 제한에 대한 오류 처리를 포함합니다)
		 * @example
		 * // Sync font size to all iframes (모든 iframe에 폰트 크기 동기화)
		 * this.syncStyleToIframes('fontSize', 'size-1p5x');
		 * 
		 * // Sync font family to all iframes (모든 iframe에 폰트 패밀리 동기화)
		 * this.syncStyleToIframes('fontFamily', 'nanum-gothic');
		 */
		syncStyleToIframes(styleType, value) {
			const iframes = document.querySelectorAll('iframe');
			let processedCount = 0;
			let excludedCount = 0;
			
			iframes.forEach((iframe, index) => {
				// iframe이 제외 영역에 있는지 확인
				if (this.isIframeInExcludeZone(iframe)) {
					excludedCount++;
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

			if (WAT_DEBUG_ENABLED) {
				if (processedCount > 0 || excludedCount > 0) {
					console.log(`✅ ${styleType} 스타일 동기화 - 처리: ${processedCount}개, 제외: ${excludedCount}개`);
				}

			}
		}

		/**
		 * Applies a specific style to an individual iframe document (개별 iframe 문서에 특정 스타일을 적용합니다)
		 * @param {Document} iframeDoc - Target iframe document object (대상 iframe 문서 객체)
		 * @param {string} styleType - Type of style to apply (적용할 스타일 타입)
		 * @param {string} value - Value to set for the style (스타일에 설정할 값)
		 * @returns {void}
		 * @description Sets data attributes and applies direct styles to iframe document element, with special handling for font family
		 *              (iframe 문서 요소에 데이터 속성을 설정하고 직접 스타일을 적용하며, 폰트 패밀리에 대한 특별 처리를 포함합니다)
		 * @example
		 * // Apply font size to iframe document (iframe 문서에 폰트 크기 적용)
		 * this.applyStyleToIframeDocument(iframeDoc, 'fontSize', 'size-2x');
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
					documentElement.style.fontFamily = this.getFontFamily(value);
				}
			}
			
			// 동적 스타일 적용
			if (this.styleMode === 'dynamic') {
				this.applyDynamicStyleToIframe(iframeDoc, styleType, value);
			}
		}

		/**
		 * Applies dynamic styling to iframe document based on current style mode (현재 스타일 모드에 따라 iframe 문서에 동적 스타일링을 적용합니다)
		 * @param {Document} iframeDoc - Target iframe document object (대상 iframe 문서 객체)
		 * @param {string} styleType - Type of dynamic style to apply (적용할 동적 스타일 타입)
		 * @param {string} value - Value for the dynamic style (동적 스타일의 값)
		 * @returns {void}
		 * @description Routes to appropriate dynamic styling method based on style type for iframe-specific application
		 *              (iframe별 적용을 위해 스타일 타입에 따라 적절한 동적 스타일링 메서드로 라우팅합니다)
		 * @example
		 * // Apply dynamic font size to iframe (iframe에 동적 폰트 크기 적용)
		 * this.applyDynamicStyleToIframe(iframeDoc, 'fontSize', 'size-1p2x');
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
		 * Applies dynamic font size scaling to all marked elements within an iframe (iframe 내의 모든 마킹된 요소에 동적 폰트 크기 스케일링을 적용합니다)
		 * @param {Document} iframeDoc - Target iframe document object (대상 iframe 문서 객체)
		 * @param {string} size - Font size setting key (폰트 크기 설정 키)
		 * @returns {void}
		 * @description Scales font sizes of elements within iframe using cached original values and ratio calculations
		 *              (캐시된 원본 값과 비율 계산을 사용하여 iframe 내 요소들의 폰트 크기를 스케일링합니다)
		 * @example
		 * // Apply dynamic font size to iframe elements (iframe 요소에 동적 폰트 크기 적용)
		 * this.applyDynamicFontSizeToIframe(iframeDoc, 'size-1p5x');
		 */
		applyDynamicFontSizeToIframe(iframeDoc, size) {
			const elements = iframeDoc.querySelectorAll('.wat-dyn-fontsize');
			
			if (size === 'initial' || size === 'unset') {
				elements.forEach(el => {
					el.style.removeProperty('font-size');
				});
				return;
			}

			const ratio = this.fontSizeRatios[size] || 1;
			
			elements.forEach(el => {
				const orig = this._originalStyleMap.get(el);
				const origPx = orig && parseFloat(orig['font-size']);
				if (origPx) {
					el.style.setProperty('font-size', (origPx * ratio) + 'px', 'important');
				}
			});
		}

		/**
		 * Applies dynamic line height scaling to all marked elements within an iframe (iframe 내의 모든 마킹된 요소에 동적 줄간격 스케일링을 적용합니다)
		 * @param {Document} iframeDoc - Target iframe document object (대상 iframe 문서 객체)
		 * @param {string} height - Line height setting key (줄간격 설정 키)
		 * @returns {void}
		 * @description Adjusts line heights of elements within iframe using ratio-based calculations from original values
		 *              (원본 값에서 비율 기반 계산을 사용하여 iframe 내 요소들의 줄간격을 조정합니다)
		 * @example
		 * // Apply dynamic line height to iframe elements (iframe 요소에 동적 줄간격 적용)
		 * this.applyDynamicLineHeightToIframe(iframeDoc, 'size-2x');
		 */
		applyDynamicLineHeightToIframe(iframeDoc, height) {
			const elements = iframeDoc.querySelectorAll('.wat-dyn-lineheight');
			
			if (height === 'initial' || height === 'unset') {
				elements.forEach(el => {
					el.style.removeProperty('line-height');
				});
				return;
			}

			const ratio = this.lineHeightRatios[height] || 1;
			
			elements.forEach(el => {
				// fontSize 버전과 동일하게 null 가드 — 원본 맵 미등록 요소에서 TypeError로 전체 중단 방지
				const orig = this._originalStyleMap.get(el);
				const origPx = orig && parseFloat(orig['line-height']);
				if (origPx) {
					el.style.setProperty('line-height', (origPx * ratio) + 'px', 'important');
				}
			});
		}

		/**
		 * Applies dynamic letter spacing scaling to all marked elements within an iframe (iframe 내의 모든 마킹된 요소에 동적 자간 스케일링을 적용합니다)
		 * @param {Document} iframeDoc - Target iframe document object (대상 iframe 문서 객체)
		 * @param {string} spacing - Letter spacing setting key (자간 설정 키)
		 * @returns {void}
		 * @description Adjusts letter spacing of elements within iframe with fallback to calculated base spacing when original values are unavailable
		 *              (원본 값을 사용할 수 없을 때 계산된 기본 자간으로 대체하여 iframe 내 요소들의 자간을 조정합니다)
		 * @example
		 * // Apply dynamic letter spacing to iframe elements (iframe 요소에 동적 자간 적용)
		 * this.applyDynamicLetterSpacingToIframe(iframeDoc, 'wide_normal');
		 */
		applyDynamicLetterSpacingToIframe(iframeDoc, spacing) {
			const elements = iframeDoc.querySelectorAll('.wat-dyn-letterspacing');
			
			if (spacing === 'initial' || spacing === 'unset') {
				elements.forEach(el => {
					el.style.removeProperty('letter-spacing');
				});
				return;
			}

			const ratio = this.letterSpacingRatios[spacing] || 1;
			
			elements.forEach(el => {
				const orig = this._originalStyleMap.get(el);
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

		// ========== iframe Management   ==========

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
		 * Sets up initial iframe handling configuration and processing (초기 iframe 처리 설정 및 처리를 설정합니다)
		 * @returns {void}
		 * @description Initializes iframe processing for existing iframes and sets up mutation observer for newly added ones
		 *              (기존 iframe에 대한 처리를 초기화하고 새로 추가되는 iframe을 위한 뮤테이션 옵저버를 설정합니다)
		 * @example
		 * // Setup iframe handling on plugin initialization (플러그인 초기화 시 iframe 처리 설정)
		 * this.setupIframeHandling();
		 */
		setupIframeHandling() {
			if (WAT_DEBUG_ENABLED) console.log('🔄 iframe 처리 초기화 시작');
			
			// 기존 iframe들 처리
			this.applyStylesToIframes();
			
			// 새로 추가되는 iframe 감지
			this.setupIframeMutationObserver();
		}

		/**
		 * Sets up mutation observer to detect newly added iframe elements (새로 추가되는 iframe 요소를 감지하기 위한 뮤테이션 옵저버를 설정합니다)
		 * @returns {void}
		 * @description Creates and configures a MutationObserver to watch for iframe additions in the document
		 *              (문서에서 iframe 추가를 감시하는 MutationObserver를 생성하고 구성합니다)
		 * @example
		 * // Setup iframe mutation observer (iframe 뮤테이션 옵저버 설정)
		 * this.setupIframeMutationObserver();
		 */
		setupIframeMutationObserver() {
			const observer = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							if (node.tagName === 'IFRAME') {
								if (WAT_DEBUG_ENABLED) console.log('🆕 새 iframe 감지:', node.src || node.id);
								this.handleNewIframe(node);
							} else {
								// 새로 추가된 요소 내부의 iframe들도 확인
								const iframes = node.querySelectorAll && node.querySelectorAll('iframe');
								if (iframes) {
									iframes.forEach(iframe => {
										if (WAT_DEBUG_ENABLED) console.log('🆕 새 iframe 감지 (내부):', iframe.src || iframe.id);
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
			
			this._observers.set('iframe', observer);
			if (WAT_DEBUG_ENABLED) console.log('✅ iframe MutationObserver 설정 완료');
		}

		/**
		 * Handles processing of newly detected iframe elements (새로 감지된 iframe 요소의 처리를 담당합니다)
		 * @param {HTMLIFrameElement} iframe - Newly added iframe element (새로 추가된 iframe 요소)
		 * @returns {void}
		 * @description Checks if iframe should be excluded, waits for load completion, and schedules processing
		 *              (iframe이 제외되어야 하는지 확인하고, 로드 완료를 기다리며, 처리를 예약합니다)
		 * @example
		 * // Handle a newly added iframe (새로 추가된 iframe 처리)
		 * this.handleNewIframe(iframeElement);
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
				this._setTimeout(() => this.processNewIframe(iframe), 100);
			} else {
				// 로드 완료 대기 (cleanup 이후 발화 시 재주입 방지 가드 포함)
				iframe.addEventListener('load', () => {
					if (this._destroyed) return;
					this._setTimeout(() => this.processNewIframe(iframe), 100);
				}, { once: true });
			}
		}

		/**
		 * Processes a new iframe element with accessibility styles (새로운 iframe 요소에 접근성 스타일을 적용하여 처리합니다)
		 * @param {HTMLIFrameElement} iframe - New iframe element to process (처리할 새로운 iframe 요소)
		 * @returns {void}
		 * @description Applies accessibility styles to newly added iframe if it's accessible and not excluded
		 *              (접근 가능하고 제외되지 않은 새로 추가된 iframe에 접근성 스타일을 적용합니다)
		 * @example
		 * // Process a new iframe with styles (새로운 iframe을 스타일과 함께 처리)
		 * this.processNewIframe(iframeElement);
		 */
		processNewIframe(iframe) {
			const iframeId = iframe.id || `new-iframe-${Date.now()}`;
			if (WAT_DEBUG_ENABLED) console.log(`🔄 새 iframe 처리 시작: ${iframeId}`);

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
		 * Removes all CSS that was injected into iframe documents (iframe 문서에 주입된 모든 CSS를 제거합니다)
		 * @returns {void}
		 * @description Cleans up CSS links that were injected by the plugin into accessible iframe documents
		 *              (플러그인에 의해 접근 가능한 iframe 문서에 주입된 CSS 링크를 정리합니다)
		 * @example
		 * // Remove injected CSS during cleanup (정리 과정에서 주입된 CSS 제거)
		 * this.removeInjectedCSS();
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
			const notification = document.createElement('div');
			notification.textContent = message;
			notification.classList.add('wat-notification');
			// 스크린리더가 상태 메시지를 읽도록 라이브 리전 지정 (WCAG 4.1.3)
			notification.setAttribute('role', 'status');
			notification.setAttribute('aria-live', 'polite');
			document.body.appendChild(notification);
			// 추적형 타이머 + remove() 사용 — 다른 경로가 먼저 제거해도 예외 없이 멱등 처리
			this._setTimeout(() => {
				notification.remove();
			}, duration);
		}

		/**
		 * Detects if browser developer tools are open (브라우저 개발자 도구가 열려있는지 감지합니다)
		 * @returns {boolean} True if developer tools are likely open, false otherwise (개발자 도구가 열려있을 가능성이 높으면 true, 그렇지 않으면 false)
		 * @description Uses window size differences to detect developer tools, with configurable threshold
		 *              (창 크기 차이를 사용하여 개발자 도구를 감지하며, 설정 가능한 임계값 사용)
		 * @example
		 * // Check if dev tools are open (개발자 도구가 열려있는지 확인)
		 * if (this._isDevToolsOpen()) {
		 *   console.log('Developer tools detected');
		 * }
		 * @private
		 */
		_isDevToolsOpen() {
			const threshold = Constants.PERFORMANCE.DEV_TOOLS_THRESHOLD;
			return window.outerHeight - window.innerHeight > threshold || 
				window.outerWidth - window.innerWidth > threshold;
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
		 * Validates if an element exists and is valid
		 * @param {HTMLElement|string} element - Element or selector to validate
		 * @param {string} context - Context for error messages
		 * @returns {HTMLElement|null} Valid element or null
		 * @private
		 */
		_validateElement(element, context = 'element validation') {
			if (typeof element === 'string') {
				const found = document.querySelector(element);
				if (!found) {
					this._log('warn', `Element not found in ${context}: ${element}`);
					return null;
				}
				return found;
			}
			
			if (!(element instanceof HTMLElement)) {
				this._log('warn', `Invalid element in ${context}`, element);
				return null;
			}
			
			return element;
		}

		/**
		 * Debounced function execution
		 * @param {Function} func - Function to debounce
		 * @param {number} delay - Delay in milliseconds
		 * @returns {Function} Debounced function
		 * @private
		 */
		_debounce(func, delay = Constants.TIMING.DEBOUNCE_DELAY) {
			let timeoutId;
			return (...args) => {
				if (timeoutId) {
					this._clearTimeout(timeoutId);
				}
				timeoutId = this._setTimeout(() => func.apply(this, args), delay);
			};
		}

		/**
		 * Throttled function execution
		 * @param {Function} func - Function to throttle
		 * @param {number} limit - Time limit in milliseconds
		 * @returns {Function} Throttled function
		 * @private
		 */
		_throttle(func, limit = Constants.TIMING.DEBOUNCE_DELAY) {
			let inThrottle;
			return (...args) => {
				if (!inThrottle) {
					func.apply(this, args);
					inThrottle = true;
					this._setTimeout(() => inThrottle = false, limit);
				}
			};
		}

		/**
		 * Creates multiple elements with attributes in batch
		 * @param {Array} elementsConfig - Array of element configurations
		 * @returns {Array} Array of created elements
		 * @private
		 */
		_createElementsBatch(elementsConfig) {
			return elementsConfig.map(config => {
				const { tag, attrs, content, parent } = config;
				const element = this.createElementWithAttrs(tag, attrs);
				
				if (content) {
					element.textContent = content;
				}
				
				if (parent && parent instanceof HTMLElement) {
					parent.appendChild(element);
				}
				
				return element;
			});
		}

		/**
		 * Safely removes event listeners
		 * @param {HTMLElement} element - Element to remove listeners from
		 * @param {Object} listeners - Object containing event type and handler pairs
		 * @private
		 */
		_removeEventListenersSafe(element, listeners) {
			if (!element || !listeners) return;
			
			Object.entries(listeners).forEach(([eventType, handler]) => {
				try {
					element.removeEventListener(eventType, handler);
				} catch (error) {
					console.warn(`[WAT] Error removing ${eventType} listener:`, error);
				}
			});
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

		// ErrorHandler Usage Examples
		
		/*
		// Example 1: Basic error handling
		ErrorHandler.handle(new Error('Something went wrong'), {
			category: ErrorHandler.CATEGORIES.DOM_OPERATION,
			severity: ErrorHandler.SEVERITY.ERROR,
			method: 'exampleMethod',
			component: 'ExampleComponent'
		});

		// Example 2: Safe execution with fallback
		const result = ErrorHandler.safeExecute(() => {
			// Risky operation
			return document.querySelector('#risky-element').value;
		}, {
			category: ErrorHandler.CATEGORIES.DOM_OPERATION,
			severity: ErrorHandler.SEVERITY.WARNING,
			method: 'getRiskyValue',
			component: 'ExampleComponent'
		}, 'default-value'); // fallback return value

		// Example 3: Async safe execution
		const asyncResult = await ErrorHandler.safeExecuteAsync(async () => {
			// Async risky operation
			const response = await fetch('/api/data');
			return response.json();
		}, {
			category: ErrorHandler.CATEGORIES.NETWORK,
			severity: ErrorHandler.SEVERITY.ERROR,
			method: 'fetchData',
			component: 'APIClient'
		}, {}); // fallback return value

		// Example 4: Custom recovery strategy
		ErrorHandler.handle(error, {
			category: ErrorHandler.CATEGORIES.STATE_MANAGEMENT,
			severity: ErrorHandler.SEVERITY.WARNING,
			method: 'updateState',
			component: 'StateManager',
			recovery: (errorInfo) => {
				// Custom recovery logic
				console.log('Recovering from state error:', errorInfo);
				// Reset state or perform recovery actions
				return { recovered: true };
			}
		});

		// Example 5: Get error metrics
		const metrics = ErrorHandler.getMetrics();
		console.log('Total errors:', metrics.total);
		console.log('Errors by category:', metrics.byCategory);
		console.log('Recent errors:', metrics.recent);
		*/

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



