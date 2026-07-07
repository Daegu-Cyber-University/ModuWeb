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
			// 시작 실패(미지원 브라우저 등) 시 상태 전이/UI 갱신/이벤트 디스패치를 건너뜀
			if (!this.voiceCommand.start()) {
				return;
			}
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

		// 정지 후 매니저 상태/UI/이벤트를 동기화
		this.handleVoiceCommandStopped();
	}

	/**
	 * VoiceCommand가 내부 오류(권한 거부, 재시도 초과 등)로 스스로 정지했을 때 호출됩니다.
	 * 매니저 상태를 INACTIVE로 전환하고 UI 갱신 및 상태 변경 이벤트를 디스패치합니다.
	 */
	handleVoiceCommandStopped() {
		if (this.currentState === this.states.INACTIVE) return;

		const previousState = this.currentState;
		this._setState(this.states.INACTIVE);
		this._updateUI();

		if (this.plugin && this.plugin._dispatchStateEvent) {
			this.plugin._dispatchStateEvent('stt:stateChanged', {
				isActive: false,
				state: this.currentState,
				previousState: previousState,
				mode: 'voice_command'
			});
		}
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
