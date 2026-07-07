/**
 * @fileoverview ContainerManager - DOM 컨테이너 생성 및 선택자 적용
 * @module src/core/ContainerManager
 */
import { ErrorHandler } from './ErrorHandler.js';

export class ContainerManager {
	/**
	 * Creates or finds an existing container element
	 * @param {Object} config - Container configuration
	 * @param {string} config.id - Container ID
	 * @param {string} config.targetSelector - Target selector for container placement
	 * @param {string} config.position - Position relative to target ('before' or 'after')
	 * @returns {HTMLElement} Container element
	 */
	static createOrFindContainer(config) {
		return ErrorHandler.safeExecute(() => {
			let container = document.getElementById(config.id);

			if (!container) {
				container = document.createElement('div');
				container.id = config.id;

				const target = document.querySelector(config.targetSelector) || document.body;
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
			recovery: () => document.body
		}, document.body);
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
