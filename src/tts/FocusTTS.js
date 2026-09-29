/**
 * @fileoverview FocusTTS - 포커스 탐지 낭독: 키보드로 포커스가 이동한 요소와
 *               마우스로 클릭·선택·드래그한 텍스트를 읽어주는 기능
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
		// 마지막 입력이 마우스·터치였는지 — 그 입력으로 생긴 포커스는 mouseup 경로가 읽는다
		this.lastInputWasPointer = false;

		this.boundHandlers = {
			doubleClick: this._handleDoubleClick.bind(this),
			mouseUp: this._handleMouseUp.bind(this),
			focusIn: this._handleFocusIn.bind(this),
			pointerDown: this._handlePointerDown.bind(this),
			keyDown: this._handleKeyDown.bind(this)
		};
	}

	enable() {
		if (this.isEnabled) return;

		this.isEnabled = true;
		this.lastInputWasPointer = false;
		document.addEventListener('dblclick', this.boundHandlers.doubleClick, { passive: true });
		document.addEventListener('mouseup', this.boundHandlers.mouseUp, { passive: true });
		// 입력 방식은 캡처 단계에서 먼저 기록해 focusin 시점에 판단할 수 있게 한다
		document.addEventListener('pointerdown', this.boundHandlers.pointerDown, { capture: true, passive: true });
		document.addEventListener('mousedown', this.boundHandlers.pointerDown, { capture: true, passive: true });
		document.addEventListener('keydown', this.boundHandlers.keyDown, { capture: true, passive: true });
		document.addEventListener('focusin', this.boundHandlers.focusIn);
	}

	disable() {
		if (!this.isEnabled) return;

		this.isEnabled = false;
		document.removeEventListener('dblclick', this.boundHandlers.doubleClick, { passive: true });
		document.removeEventListener('mouseup', this.boundHandlers.mouseUp, { passive: true });
		document.removeEventListener('pointerdown', this.boundHandlers.pointerDown, { capture: true, passive: true });
		document.removeEventListener('mousedown', this.boundHandlers.pointerDown, { capture: true, passive: true });
		document.removeEventListener('keydown', this.boundHandlers.keyDown, { capture: true, passive: true });
		document.removeEventListener('focusin', this.boundHandlers.focusIn);

		this._clearSelectionTimer();
		this._stopCurrentSpeech();
		this._removeHighlight();
		this.lastEventTime = 0;
		this.lastInputWasPointer = false;
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

	/**
	 * 마우스·터치 입력을 기록합니다 — 이 입력으로 생긴 포커스는 mouseup 경로가 읽는다
	 */
	_handlePointerDown() {
		this.lastInputWasPointer = true;
	}

	/**
	 * 키보드 입력을 기록합니다 — 이후의 포커스 이동은 키보드 탐색으로 보고 읽는다
	 */
	_handleKeyDown() {
		this.lastInputWasPointer = false;
	}

	/**
	 * 키보드로 포커스가 이동하면 포커스된 요소를 읽습니다.
	 * @param {FocusEvent} event - focusin 이벤트
	 * @description 마우스 클릭으로 생긴 포커스는 mouseup 경로가 같은 요소를 읽으므로 건너뛴다(중복 발화 방지).
	 *              body·html로 포커스가 돌아가는 경우는 페이지 전체 낭독이 되므로 읽지 않는다.
	 */
	_handleFocusIn(event) {
		if (!this.isEnabled || this.lastInputWasPointer) return;

		const element = event.target;
		if (!element || element === document.body || element === document.documentElement) return;
		if (this._isWatUIElement(element)) return;

		const textToRead = this._extractElementText(element);
		if (textToRead && textToRead.trim().length > 0) {
			this._speakText(textToRead.trim());
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
