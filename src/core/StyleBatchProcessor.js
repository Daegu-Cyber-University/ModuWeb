/**
 * @fileoverview StyleBatchProcessor - 스타일 업데이트 배치 최적화
 * @module src/core/StyleBatchProcessor
 */
import { ErrorHandler } from './ErrorHandler.js';
import { Constants } from './constants.js';

export class StyleBatchProcessor {
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
