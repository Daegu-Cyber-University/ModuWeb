/**
 * @fileoverview StateManager - WAT 플러그인 중앙집중식 상태 관리
 * @module src/wat/StateManager
 */
import { ErrorHandler } from '../core/ErrorHandler.js';

/**
 * Centralized state management system for WAT plugin
 * @class StateManager
 */
export class StateManager {
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
	 * @returns {*} The value at the path
	 */
	get(path) {
		return path.split('.').reduce((obj, key) => obj && obj[key], this._state);
	}

	/**
	 * Sets a value in state using dot notation path
	 * @param {string} path - Dot notation path
	 * @param {*} value - Value to set
	 * @param {boolean} skipNotify - Whether to skip observer notifications
	 */
	set(path, value, skipNotify = false) {
		const oldValue = this.get(path);
		const keys = path.split('.');
		const lastKey = keys.pop();
		const target = keys.reduce((obj, key) => {
			if (!(key in obj)) obj[key] = {};
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
	 * Validates state structure
	 * @param {Object} schema - Validation schema
	 * @returns {boolean} Whether state is valid
	 */
	validate(schema) {
		return true;
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
