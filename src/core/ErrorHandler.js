/**
 * @fileoverview WAT 중앙집중식 에러 처리 시스템
 * @module src/core/ErrorHandler
 */

export class ErrorHandler {
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
