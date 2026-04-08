/**
 * @fileoverview STTManager - 음성 인식 기능 통합 관리자
 * @module src/stt/STTManager
 */
import { VoiceCommand } from './VoiceCommand.js';

/**
 * STT Manager - Speech Recognition Integration Manager
 * @class STTManager
 */
export class STTManager {
	constructor(plugin) {
		this.plugin = plugin;

		this.states = {
			VOICE_COMMAND: 'voiceCommand',
			CONTINUOUS: 'continuous',
			INACTIVE: 'inactive'
		};

		this.currentState = this.states.INACTIVE;

		this.voiceCommand = null;

		this.config = {
			language: plugin.options?.sttLanguage || plugin.language || 'ko-KR',
			interimResults: plugin.options?.sttInterimResults || false,
			continuous: plugin.options?.sttContinuous || false,
			maxAlternatives: plugin.options?.sttMaxAlternatives || 1
		};

		this._initializeModules();
	}

	_initializeModules() {
		this.voiceCommand = new VoiceCommand(this);
	}

	setLanguage(language) {
		if (typeof language === 'string' && language.length > 0) {
			this.config.language = language;
		}
	}

	getLanguage() {
		return this.config.language;
	}

	toggleVoiceCommand() {
		const previousState = this.currentState;

		if (this.currentState === this.states.VOICE_COMMAND) {
			this.voiceCommand.stop();
			this._setState(this.states.INACTIVE);
		} else {
			this._stopOtherSTT(this.states.VOICE_COMMAND);
			this.voiceCommand.start();
			this._setState(this.states.VOICE_COMMAND);
		}

		this._updateUI();

		if (this.plugin && this.plugin._dispatchStateEvent) {
			this.plugin._dispatchStateEvent('stt:stateChanged', {
				isActive: this.currentState === this.states.VOICE_COMMAND,
				state: this.currentState,
				previousState: previousState,
				mode: 'voice_command'
			});
		}
	}

	_setState(newState) {
		this.currentState = newState;
	}

	_stopOtherSTT(exceptState) {
		if (exceptState !== this.states.VOICE_COMMAND && this.voiceCommand) {
			this.voiceCommand.stop();
		}
	}

	_stopAllSTT() {
		if (this.voiceCommand) this.voiceCommand.stop();
	}

	_updateUI() {
		this._updateVoiceCommandButton();
	}

	_updateVoiceCommandButton() {
		const button = document.getElementById('wat-button-stt_start');
		if (button) {
			if (this.currentState === this.states.VOICE_COMMAND) {
				button.textContent = this.plugin.getLocalizedText('panel.personal.options.stt.options.stop')
					|| '음성 명령 중지';
				button.classList.add('active');
			} else {
				button.textContent = this.plugin.getLocalizedText('panel.personal.options.stt.options.start')
					|| '음성 명령 시작';
				button.classList.remove('active');
			}
		}
	}

	getStatus() {
		return {
			currentState: this.currentState,
			isActive: this.currentState !== this.states.INACTIVE,
			config: { ...this.config }
		};
	}
}
