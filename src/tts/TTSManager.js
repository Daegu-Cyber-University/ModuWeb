/**
 * @fileoverview TTSManager - TTS 기능 통합 관리자
 * @module src/tts/TTSManager
 */
import { AutoTTS } from './AutoTTS.js';
import { FocusTTS } from './FocusTTS.js';
import { KeyboardTTS } from './KeyboardTTS.js';

/**
 * TTS Manager - Integrated TTS functionality manager
 * @class TTSManager
 */
export class TTSManager {
	constructor(plugin) {
		this.plugin = plugin;

		this.states = {
			AUTO_TTS: 'autoTTS',
			FOCUS_TTS: 'focusTTS',
			KEYBOARD_TTS: 'keyboardTTS',
			INACTIVE: 'inactive'
		};

		this.currentState = this.states.INACTIVE;

		this.autoTTS = null;
		this.focusTTS = null;
		this.keyboardTTS = null;

		this.config = {
			autoAdvanceDelay: plugin.options?.ttsAutoAdvanceDelay || 1000,
			speechRate: plugin.options?.ttsSpeechRate || 1.6,
			voiceURI: plugin.options?.ttsVoice || ''
		};

		// 음성 목록은 브라우저가 비동기로 채우므로 캐시하고 voiceschanged로 갱신한다
		this._voices = [];
		this._onVoicesChanged = null;

		this._initializeModules();
		this._initializeVoices();
	}

	_initializeModules() {
		this.autoTTS = new AutoTTS(this);
		this.focusTTS = new FocusTTS(this);
		this.keyboardTTS = new KeyboardTTS(this);
	}

	/**
	 * 사용 가능한 음성 목록을 초기화하고 브라우저의 목록 갱신에 대비합니다.
	 * @private
	 */
	_initializeVoices() {
		if (typeof window === 'undefined' || !window.speechSynthesis) return;

		this._refreshVoices();

		// 크롬 계열은 첫 getVoices() 호출에서 빈 배열을 주고 이후 이벤트로 전달한다
		if (typeof window.speechSynthesis.addEventListener === 'function') {
			this._onVoicesChanged = () => {
				this._refreshVoices();
				// 패널이 이미 그려져 있으면 목록을 다시 채운다 (없으면 no-op)
				if (typeof this.plugin.updateTTSVoiceOptions === 'function') {
					this.plugin.updateTTSVoiceOptions();
				}
			};
			window.speechSynthesis.addEventListener('voiceschanged', this._onVoicesChanged);
		}
	}

	/**
	 * 브라우저에서 음성 목록을 다시 읽어 캐시합니다.
	 * @private
	 */
	_refreshVoices() {
		try {
			this._voices = window.speechSynthesis.getVoices() || [];
		} catch (error) {
			this._voices = [];
		}
	}

	/**
	 * 사용 가능한 음성 목록을 반환합니다.
	 * @returns {Array<SpeechSynthesisVoice>} 음성 목록 (미지원 환경에서는 빈 배열)
	 */
	getAvailableVoices() {
		if (!this._voices.length && typeof window !== 'undefined' && window.speechSynthesis) {
			this._refreshVoices();
		}
		return this._voices;
	}

	/**
	 * 낭독에 사용할 음성을 지정합니다.
	 * @param {string} voiceURI - SpeechSynthesisVoice.voiceURI (빈 값이면 브라우저 기본 음성)
	 */
	setVoice(voiceURI) {
		this.config.voiceURI = voiceURI || '';
	}

	/**
	 * 현재 선택된 음성의 voiceURI를 반환합니다.
	 * @returns {string} voiceURI (기본 음성이면 빈 문자열)
	 */
	getVoice() {
		return this.config.voiceURI;
	}

	/**
	 * 발화 객체에 선택된 음성을 적용합니다.
	 * @param {SpeechSynthesisUtterance} utterance - 적용 대상
	 * @description 선택된 음성이 목록에 없으면(기기 변경 등) 기본 음성으로 조용히 폴백한다.
	 *              음성과 lang이 어긋나면 브라우저가 음성 지정을 무시하므로 lang도 함께 맞춘다.
	 */
	applyVoice(utterance) {
		if (!utterance || !this.config.voiceURI) return;
		const voice = this.getAvailableVoices().find(v => v.voiceURI === this.config.voiceURI);
		if (!voice) return;
		utterance.voice = voice;
		if (voice.lang) utterance.lang = voice.lang;
	}

	/**
	 * 플러그인 언어 설정을 음성 합성용 BCP-47 언어 코드로 변환합니다.
	 * @returns {string} 언어 코드 (설정이 없으면 빈 문자열)
	 */
	getSpeechLang() {
		const lang = this.plugin && this.plugin.language;
		if (!lang) return '';
		const langMap = { ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', de: 'de-DE' };
		return langMap[lang] || lang;
	}

	setSpeechRate(rate) {
		if (rate >= 0.1 && rate <= 10) {
			this.config.speechRate = rate;
		} else {
			console.warn('TTS speed must be between 0.1 and 10 (TTS 속도는 0.1 ~ 10 사이의 값이어야 합니다):', rate);
		}
	}

	getSpeechRate() {
		return this.config.speechRate;
	}

	toggleAutoTTS() {
		if (this.currentState === this.states.AUTO_TTS) {
			this._stopAllTTS();
			this._setState(this.states.INACTIVE);
		} else {
			this._stopOtherTTS(this.states.AUTO_TTS);
			this._setState(this.states.AUTO_TTS);
			this.autoTTS.start();
		}
		this._updateUI();
	}

	toggleFocusTTS() {
		if (this.currentState === this.states.FOCUS_TTS) {
			this._stopAllTTS();
			this._setState(this.states.INACTIVE);
		} else {
			this._stopOtherTTS(this.states.FOCUS_TTS);
			this._setState(this.states.FOCUS_TTS);
			this.focusTTS.enable();
		}
		this._updateUI();
	}

	executeKeyboardTTS() {
		if (this.currentState !== this.states.INACTIVE) {
			this._stopAllTTS();
			this._setState(this.states.INACTIVE);
			this._updateUI();
		}
		this.keyboardTTS.execute();
	}

	navigatePrevious() {
		if (this.currentState === this.states.AUTO_TTS && this.autoTTS) {
			this.autoTTS.moveToPrevious();
		}
	}

	navigateNext() {
		if (this.currentState === this.states.AUTO_TTS && this.autoTTS) {
			this.autoTTS.moveToNext();
		}
	}

	_setState(newState) {
		this.currentState = newState;
		this.plugin.state.set('tts.currentState', newState);
	}

	_stopOtherTTS(exceptState) {
		if (exceptState !== this.states.AUTO_TTS && this.autoTTS) {
			this.autoTTS.stop();
		}
		if (exceptState !== this.states.FOCUS_TTS && this.focusTTS) {
			this.focusTTS.disable();
		}
	}

	_stopAllTTS() {
		if (this.autoTTS) this.autoTTS.stop();
		if (this.focusTTS) this.focusTTS.disable();
		if (window.speechSynthesis) {
			window.speechSynthesis.cancel();
		}
	}

	/**
	 * TTS 매니저를 완전히 정리합니다.
	 * 플러그인 cleanup(destroy) 시 호출해 리스너, 타이머, 진행 중인 발화를 모두 해제합니다.
	 */
	destroy() {
		if (this._onVoicesChanged && typeof window !== 'undefined' && window.speechSynthesis &&
			typeof window.speechSynthesis.removeEventListener === 'function') {
			window.speechSynthesis.removeEventListener('voiceschanged', this._onVoicesChanged);
			this._onVoicesChanged = null;
		}
		try {
			if (this.autoTTS) this.autoTTS.destroy();
		} catch (error) {
			console.warn('Failed to destroy AutoTTS:', error);
		}
		try {
			if (this.focusTTS) this.focusTTS.destroy();
		} catch (error) {
			console.warn('Failed to destroy FocusTTS:', error);
		}
		try {
			if (this.keyboardTTS) this.keyboardTTS.destroy();
		} catch (error) {
			console.warn('Failed to destroy KeyboardTTS:', error);
		}
		if (window.speechSynthesis) {
			window.speechSynthesis.cancel();
		}
		this.currentState = this.states.INACTIVE;
	}

	_updateUI() {
		this._updateAutoTTSButton();
		this._updateFocusTTSButton();
		this._updateNavigationButtons();
	}

	_updateAutoTTSButton() {
		const btn = document.getElementById('wat-button-tts_toggle');
		if (btn) {
			if (this.currentState === this.states.AUTO_TTS) {
				btn.textContent = this.plugin.getLocalizedText('panel.tts.stop') || '자동 읽기 중지';
				btn.classList.add('active');
			} else {
				btn.textContent = this.plugin.getLocalizedText('panel.tts.start') || '자동 읽기';
				btn.classList.remove('active');
			}
		}
	}

	_updateFocusTTSButton() {
		const btn = document.getElementById('wat-button-tts_focus_toggle');
		if (btn) {
			if (this.currentState === this.states.FOCUS_TTS) {
				btn.textContent = this.plugin.getLocalizedText('panel.tts.focusStop') || '포커스 읽기 중지';
				btn.classList.add('active');
			} else {
				btn.textContent = this.plugin.getLocalizedText('panel.tts.focusStart') || '포커스 읽기';
				btn.classList.remove('active');
			}
		}
	}

	_updateNavigationButtons() {
		const isAutoTTSActive = this.currentState === this.states.AUTO_TTS;
		const prevBtn = document.getElementById('wat-button-tts_prev');
		const nextBtn = document.getElementById('wat-button-tts_next');

		if (prevBtn) prevBtn.disabled = !isAutoTTSActive;
		if (nextBtn) nextBtn.disabled = !isAutoTTSActive;
	}
}
