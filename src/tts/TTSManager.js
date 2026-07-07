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
			speechRate: plugin.options?.ttsSpeechRate || 1.6
		};

		this._initializeModules();
	}

	_initializeModules() {
		this.autoTTS = new AutoTTS(this);
		this.focusTTS = new FocusTTS(this);
		this.keyboardTTS = new KeyboardTTS(this);
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
