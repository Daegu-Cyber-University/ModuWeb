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
		this.keepAliveTimer = null;
		this.highlightRemoveTimer = null;
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
				// surroundContents 실패 시(요소 경계를 가로지르는 선택 등)
				// 호스트 페이지의 DOM을 분할/훼손하지 않도록 하이라이트를 포기하고 발화만 진행합니다.
				this.highlightWrapper = null;
				return;
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
		this._clearHighlightRemoveTimer();
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

		const speechLang = this._getSpeechLang();
		if (speechLang) {
			this.currentUtterance.lang = speechLang;
		}
		// 사용자가 고른 음성이 있으면 lang까지 함께 맞춘다 (없으면 브라우저 기본 음성)
		this.ttsManager.applyVoice(this.currentUtterance);

		this.currentUtterance.onend = () => {
			this._stopKeepAlive();
			this.currentUtterance = null;
			if (typeof onEnd === 'function') onEnd();
		};

		this.currentUtterance.onerror = () => {
			this._stopKeepAlive();
			this.currentUtterance = null;
			if (typeof onError === 'function') onError();
		};

		window.speechSynthesis.speak(this.currentUtterance);
		this._startKeepAlive();
	}

	/**
	 * 플러그인 언어 설정을 음성 합성용 BCP-47 언어 코드로 변환합니다.
	 * @returns {string} 언어 코드 (설정이 없으면 빈 문자열)
	 */
	_getSpeechLang() {
		return this.ttsManager.getSpeechLang();
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

	/**
	 * 하이라이트 제거를 지연 예약합니다. (핸들을 보관해 취소 가능)
	 * @param {number} [delay=500] - 지연 시간(ms)
	 */
	_scheduleHighlightRemoval(delay = 500) {
		this._clearHighlightRemoveTimer();
		this.highlightRemoveTimer = setTimeout(() => {
			this.highlightRemoveTimer = null;
			this._removeHighlight();
		}, delay);
	}

	/**
	 * 예약된 하이라이트 제거 타이머를 취소합니다.
	 */
	_clearHighlightRemoveTimer() {
		if (this.highlightRemoveTimer) {
			clearTimeout(this.highlightRemoveTimer);
			this.highlightRemoveTimer = null;
		}
	}

	/**
	 * 현재 진행 중인 음성 합성을 중지합니다.
	 */
	_stopCurrentSpeech() {
		this._stopKeepAlive();
		if (this.currentUtterance) {
			this.currentUtterance.onend = null;
			this.currentUtterance.onerror = null;
			this.currentUtterance = null;
		}
		if (window.speechSynthesis) {
			window.speechSynthesis.cancel();
		}
	}

	/**
	 * 진행 중인 발화, 타이머, 하이라이트를 모두 정리합니다.
	 */
	destroy() {
		this._stopCurrentSpeech();
		this._clearHighlightRemoveTimer();
		this._removeHighlight();
	}
}
