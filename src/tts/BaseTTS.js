/**
 * @fileoverview BaseTTS - FocusTTS와 KeyboardTTS의 공통 기능 베이스 클래스
 * @module src/tts/BaseTTS
 */
export class BaseTTS {
	constructor(ttsManager) {
		this.ttsManager = ttsManager;
		this.plugin = ttsManager.plugin;

		this.currentUtterance = null;
		this.highlightWrapper = null;
		this.originalSelection = null;
	}

	/**
	 * 주어진 DOM 요소가 WAT 자체 UI 요소인지 확인합니다.
	 * @param {Element} target - 검사할 요소
	 * @returns {boolean}
	 */
	_isWatUIElement(target) {
		if (!target) return false;
		return (
			target.closest('#wat-container') !== null ||
			target.closest('.wat-exclude') !== null ||
			target.closest('[id^="wat-"]') !== null ||
			target.closest('[class*="wat-"]') !== null ||
			(target.id && target.id.startsWith('wat-')) ||
			Array.from(target.classList || []).some(cls => cls.startsWith('wat-'))
		);
	}

	/**
	 * 선택 범위(range)를 하이라이트 래퍼로 감쌉니다.
	 * @param {Range} range - 감쌀 선택 범위
	 * @param {string} [extraClasses=''] - 추가 CSS 클래스
	 * @param {string} [extraStyles=''] - 추가 인라인 스타일
	 */
	_createHighlightWrapper(range, extraClasses = '', extraStyles = '') {
		try {
			this._removeHighlight();

			this.highlightWrapper = document.createElement('span');
			this.highlightWrapper.className = `wat-focus-tts-highlight${extraClasses ? ' ' + extraClasses : ''}`;
			this.highlightWrapper.style.cssText = `display: inline !important; position: relative !important;${extraStyles ? ' ' + extraStyles : ''}`;

			try {
				range.surroundContents(this.highlightWrapper);
			} catch (e) {
				const contents = range.extractContents();
				this.highlightWrapper.appendChild(contents);
				range.insertNode(this.highlightWrapper);
			}

			const newRange = document.createRange();
			newRange.selectNodeContents(this.highlightWrapper);

			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(newRange);

			this.highlightWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
		} catch (error) {
			console.warn('Failed to create highlight wrapper:', error);
		}
	}

	/**
	 * 하이라이트 래퍼를 제거하고 원래 DOM 구조를 복원합니다.
	 */
	_removeHighlight() {
		if (this.highlightWrapper && this.highlightWrapper.parentNode) {
			try {
				const parent = this.highlightWrapper.parentNode;
				const fragment = document.createDocumentFragment();

				while (this.highlightWrapper.firstChild) {
					fragment.appendChild(this.highlightWrapper.firstChild);
				}

				parent.insertBefore(fragment, this.highlightWrapper);
				parent.removeChild(this.highlightWrapper);

				this.highlightWrapper = null;
				this.originalSelection = null;
				parent.normalize();
			} catch (error) {
				console.warn('Failed to remove highlight wrapper:', error);
			}
		}
	}

	/**
	 * 텍스트를 음성으로 읽습니다.
	 * @param {string} text - 읽을 텍스트
	 * @param {Object} [callbacks={}] - onEnd / onError 콜백
	 */
	_speakText(text, { onEnd, onError } = {}) {
		if (!window.speechSynthesis) {
			this.plugin.showNotification('Browser does not support speech synthesis. (음성 합성을 지원하지 않는 브라우저입니다.)');
			return;
		}

		this._stopCurrentSpeech();

		this.currentUtterance = new SpeechSynthesisUtterance(text);
		this.currentUtterance.rate = this.ttsManager.config.speechRate;

		this.currentUtterance.onend = () => {
			if (typeof onEnd === 'function') onEnd();
		};

		this.currentUtterance.onerror = () => {
			if (typeof onError === 'function') onError();
		};

		window.speechSynthesis.speak(this.currentUtterance);
	}

	/**
	 * 현재 진행 중인 음성 합성을 중지합니다.
	 */
	_stopCurrentSpeech() {
		if (this.currentUtterance) {
			this.currentUtterance.onend = null;
			this.currentUtterance.onerror = null;
			this.currentUtterance = null;
		}
		if (window.speechSynthesis) {
			window.speechSynthesis.cancel();
		}
	}
}
