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
