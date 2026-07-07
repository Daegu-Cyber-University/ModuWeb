/**
 * @fileoverview FocusTTS - 마우스 선택/드래그로 텍스트를 읽어주는 기능
 * @module src/tts/FocusTTS
 */
import { BaseTTS } from './BaseTTS.js';

export class FocusTTS extends BaseTTS {
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
