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
					el.classList.add(cssClasses.EXCLUDE);
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
