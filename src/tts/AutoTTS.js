/**
 * @fileoverview AutoTTS - 자동 순차 TTS 기능
 * @module src/tts/AutoTTS
 */
export class AutoTTS {
	constructor(ttsManager) {
		this.ttsManager = ttsManager;
		this.plugin = ttsManager.plugin;

		this.elements = [];
		this.currentIndex = -1;
		this.autoAdvanceTimer = null;
		this.currentUtterance = null;
	}

	start() {
		this._extractReadableElements();

		if (this.elements.length === 0) {
			this.plugin.showNotification('No readable elements found. (읽을 수 있는 요소가 없습니다.)');
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
	}

	moveToPrevious() {
		if (this.currentIndex > 0) {
			this.currentIndex--;
			this._readCurrentElement();
		} else {
			this.plugin.showNotification('This is the first element. (첫 번째 요소입니다.)');
		}
	}

	moveToNext() {
		if (this.currentIndex < this.elements.length - 1) {
			this.currentIndex++;
			this._readCurrentElement();
		} else {
			this.plugin.showNotification('This is the last element. (마지막 요소입니다.)');
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
			return this.plugin.generateTextToRead(element, tagName);
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
			this.plugin.showNotification('음성 합성을 지원하지 않는 브라우저입니다.');
			return;
		}

		this.currentUtterance = new SpeechSynthesisUtterance(text);
		this.currentUtterance.rate = this.ttsManager.config.speechRate;
		this.currentUtterance.onend = onEnd;

		window.speechSynthesis.speak(this.currentUtterance);
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
		if (window.speechSynthesis) {
			window.speechSynthesis.cancel();
		}
		this.currentUtterance = null;
	}

	_clearAutoAdvanceTimer() {
		if (this.autoAdvanceTimer) {
			clearTimeout(this.autoAdvanceTimer);
			this.autoAdvanceTimer = null;
		}
	}
}
