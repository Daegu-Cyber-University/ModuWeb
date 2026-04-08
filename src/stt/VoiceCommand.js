/**
 * @fileoverview VoiceCommand - 음성으로 웹페이지를 제어하는 기능
 * @module src/stt/VoiceCommand
 */
export class VoiceCommand {
	constructor(sttManager) {
		this.sttManager = sttManager;
		this.plugin = sttManager.plugin;

		this.recognition = null;
		this.isActive = false;

		this.states = {
			INACTIVE: 'inactive',
			WAITING: 'waiting',
			LISTENING: 'listening',
			PROCESSING: 'processing',
			EXECUTING: 'executing',
			COOLDOWN: 'cooldown'
		};
		this.currentState = this.states.INACTIVE;

		this.timers = {
			cooldown: null,
			silenceDetection: null,
			commandTimeout: null
		};

		this.config = {
			silenceThreshold: 1500,
			minRecordingTime: 1000,
			commandTimeout: 8000,
			cooldownTime: 2000,
			maxRetries: 3
		};

		this.commands = this._loadLocalizedCommands();

		this.statusDisplay = null;
		this.lastCommandTime = 0;
		this.commandHistory = [];

		this.audioContext = null;
		this.analyser = null;
		this.silenceTimer = null;
		this.isSpeaking = false;
		this.lastSpeechTime = 0;
	}

	start() {
		if (!this._checkSupport()) {
			this.plugin.showNotification('음성 인식을 지원하지 않는 브라우저입니다.');
			return;
		}

		this._createStatusDisplay();
		this._setState(this.states.WAITING);
		this._startContinuousRecognition();
	}

	stop() {
		this._setState(this.states.INACTIVE);
		this._clearAllTimers();

		if (this.recognition && this.isActive) {
			this.recognition.stop();
			this.isActive = false;
		}

		this._removeStatusDisplay();
	}

	_createStatusDisplay() {
		this._removeStatusDisplay();

		this.statusDisplay = document.createElement('div');
		this.statusDisplay.id = 'wat-voice-status';
		this.statusDisplay.className = 'wat-voice-status';
		this.statusDisplay.innerHTML = `
			<div class="status-icon">🎤</div>
			<div class="status-text">음성 명령 준비 중...</div>
			<div class="status-detail"></div>
			<div class="status-progress"></div>
		`;

		this.statusDisplay.style.cssText = `
			position: fixed;
			top: 20px;
			left: 50%;
			transform: translateX(-50%);
			background: rgba(0, 0, 0, 0.9);
			color: white;
			padding: 15px 25px;
			border-radius: 25px;
			z-index: 10000;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 14px;
			text-align: center;
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
			backdrop-filter: blur(10px);
			transition: all 0.3s ease;
			min-width: 200px;
		`;

		document.body.appendChild(this.statusDisplay);
	}

	_removeStatusDisplay() {
		if (this.statusDisplay && this.statusDisplay.parentNode) {
			this.statusDisplay.parentNode.removeChild(this.statusDisplay);
			this.statusDisplay = null;
		}
	}

	_setState(newState) {
		this.currentState = newState;
		this._updateStatusDisplay();
	}

	_updateStatusDisplay() {
		if (!this.statusDisplay) return;

		const icon = this.statusDisplay.querySelector('.status-icon');
		const text = this.statusDisplay.querySelector('.status-text');
		const detail = this.statusDisplay.querySelector('.status-detail');
		const progress = this.statusDisplay.querySelector('.status-progress');

		switch (this.currentState) {
			case this.states.INACTIVE:
				icon.textContent = '🔇';
				text.textContent = '음성 명령 비활성';
				detail.textContent = '';
				this.statusDisplay.style.background = 'rgba(128, 128, 128, 0.9)';
				progress.style.display = 'none';
				break;
			case this.states.WAITING:
				icon.textContent = '🎤';
				text.textContent = '명령 대기 중...';
				detail.textContent = '명령을 말씀해주세요';
				this.statusDisplay.style.background = 'rgba(33, 150, 243, 0.9)';
				progress.style.display = 'none';
				break;
			case this.states.LISTENING:
				icon.textContent = '🎧';
				text.textContent = '음성 인식 중...';
				detail.textContent = '말씀하고 계세요';
				this.statusDisplay.style.background = 'rgba(76, 175, 80, 0.9)';
				progress.style.display = 'block';
				progress.innerHTML = '<div style="width: 100%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;"><div class="progress-bar" style="width: 0%; height: 100%; background: white; border-radius: 2px; animation: pulse 1s infinite;"></div></div>';
				break;
			case this.states.PROCESSING:
				icon.textContent = '⚙️';
				text.textContent = '명령 분석 중...';
				detail.textContent = '잠시만 기다려주세요';
				this.statusDisplay.style.background = 'rgba(255, 193, 7, 0.9)';
				progress.style.display = 'none';
				break;
			case this.states.EXECUTING:
				icon.textContent = '🚀';
				text.textContent = '명령 실행 중...';
				this.statusDisplay.style.background = 'rgba(139, 195, 74, 0.9)';
				progress.style.display = 'none';
				break;
			case this.states.COOLDOWN:
				icon.textContent = '⏱️';
				text.textContent = '대기 중...';
				detail.textContent = '다음 명령까지 잠시 기다려주세요';
				this.statusDisplay.style.background = 'rgba(158, 158, 158, 0.9)';
				progress.style.display = 'none';
				break;
		}
	}

	_updateExecutingStatus(commandText) {
		if (!this.statusDisplay) return;
		const detail = this.statusDisplay.querySelector('.status-detail');
		detail.textContent = `"${commandText}" 실행 중`;
	}

	_startContinuousRecognition() {
		this._initializeRecognition();

		this.timers.commandTimeout = setTimeout(() => {
			if (this.currentState === this.states.WAITING ||
				this.currentState === this.states.LISTENING) {
				this._setState(this.states.COOLDOWN);
				this.plugin.showNotification('음성 명령 대기 시간이 초과되었습니다.');
				this._startCooldown();
			}
		}, this.config.commandTimeout);

		this._startRecognition();
	}

	_startCooldown() {
		this._clearAllTimers();
		this._setState(this.states.COOLDOWN);

		this.timers.cooldown = setTimeout(() => {
			if (this.currentState === this.states.COOLDOWN) {
				this._setState(this.states.WAITING);
				this._startContinuousRecognition();
			}
		}, this.config.cooldownTime);
	}

	/**
	 * 로케일에서 음성 명령어 키워드를 로드합니다.
	 * 로케일 데이터가 없으면 한국어 기본값을 사용합니다.
	 * @returns {{navigation: string[], action: string[], settings: string[]}}
	 */
	_loadLocalizedCommands() {
		const defaults = {
			navigation: ['이동', '링크', '클릭'],
			action: ['실행', '켜기', '끄기', '종료'],
			settings: ['설정', '옵션', '메뉴']
		};

		if (!this.plugin || typeof this.plugin.getLocalizedText !== 'function') {
			return defaults;
		}

		const parseKeywords = (key, fallback) => {
			const text = this.plugin.getLocalizedText(key);
			if (typeof text === 'string' && text.trim()) {
				return text.split(',').map(s => s.trim()).filter(Boolean);
			}
			return fallback;
		};

		return {
			navigation: parseKeywords('command.voiceCommands.navigation', defaults.navigation),
			action: parseKeywords('command.voiceCommands.action', defaults.action),
			settings: parseKeywords('command.voiceCommands.settings', defaults.settings)
		};
	}

	/**
	 * 언어 변경 시 명령어 키워드를 다시 로드합니다.
	 */
	refreshCommands() {
		this.commands = this._loadLocalizedCommands();
	}

	_checkSupport() {
		return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
	}

	_initializeRecognition() {
		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;

		this.recognition = new SpeechRecognition();

		if (SpeechGrammarList) {
			const speechRecognitionList = new SpeechGrammarList();
			this.recognition.grammars = speechRecognitionList;
		}

		this.recognition.lang = this.sttManager.config.language;
		this.recognition.interimResults = false;
		this.recognition.continuous = false;
		this.recognition.maxAlternatives = 1;

		this._setupEventHandlers();
	}

	_setupEventHandlers() {
		this.recognition.onstart = () => {
			this.isActive = true;
			this._setState(this.states.LISTENING);
			this.lastSpeechTime = Date.now();
		};

		this.recognition.onend = () => {
			this.isActive = false;

			if (this.currentState === this.states.LISTENING ||
				this.currentState === this.states.PROCESSING) {
				this._setState(this.states.WAITING);

				setTimeout(() => {
					if (this.currentState === this.states.WAITING) {
						this._startContinuousRecognition();
					}
				}, 500);
			}
		};

		this.recognition.onresult = (event) => {
			this._setState(this.states.PROCESSING);

			const result = event.results[0][0];
			const transcript = result.transcript.toLowerCase().trim();
			const confidence = result.confidence;

			if (confidence < 0.6) {
				this.plugin.showNotification('음성을 명확하게 인식하지 못했습니다. 다시 시도해주세요.');
				this._startCooldown();
				return;
			}

			if (transcript.length < 2) {
				this._startCooldown();
				return;
			}

			this._processVoiceCommand(transcript);
		};

		this.recognition.onerror = (event) => {
			console.error('음성 인식 오류:', event.error);
			this.isActive = false;

			let errorMessage = '음성 인식 오류가 발생했습니다.';
			switch (event.error) {
				case 'no-speech':
					errorMessage = '음성이 감지되지 않았습니다. 다시 시도해주세요.';
					break;
				case 'audio-capture':
					errorMessage = '마이크에 접근할 수 없습니다. 권한을 확인해주세요.';
					break;
				case 'not-allowed':
					errorMessage = '마이크 사용 권한이 필요합니다.';
					break;
				case 'network':
					errorMessage = '네트워크 오류가 발생했습니다.';
					break;
			}

			this.plugin.showNotification(errorMessage);
			this._startCooldown();
		};

		this.recognition.onnomatch = () => {
			this.plugin.showNotification('명령을 인식하지 못했습니다. 다시 시도해주세요.');
			this._startCooldown();
		};

		this.recognition.onspeechstart = () => {
			this.isSpeaking = true;
			this.lastSpeechTime = Date.now();
		};

		this.recognition.onspeechend = () => {
			this.isSpeaking = false;
		};

		this.recognition.onsoundstart = () => {};
		this.recognition.onsoundend = () => {};
	}

	_startRecognition() {
		try {
			if (!this.isActive && this.currentState !== this.states.INACTIVE) {
				this.recognition.start();
			}
		} catch (error) {
			console.error('음성 인식 시작 오류:', error);
			this.plugin.showNotification('음성 인식을 시작할 수 없습니다.');
			this._startCooldown();
		}
	}

	_clearAllTimers() {
		Object.values(this.timers).forEach(timer => {
			if (timer) clearTimeout(timer);
		});
		this.timers = {
			cooldown: null,
			silenceDetection: null,
			commandTimeout: null
		};
	}

	_processVoiceCommand(transcript) {
		if (!transcript || transcript.trim() === '') {
			this._startCooldown();
			return;
		}

		const now = Date.now();
		if (now - this.lastCommandTime < this.config.cooldownTime) {
			this._startCooldown();
			return;
		}

		const commandInfo = this._analyzeCommand(transcript);

		if (commandInfo.command && commandInfo.target) {
			this._setState(this.states.EXECUTING);
			this._updateExecutingStatus(`${commandInfo.command} ${commandInfo.target}`);

			const elements = this._findTargetElements(commandInfo.target);
			if (elements.length > 0) {
				this._executeCommand(commandInfo.command, elements[0]);
				this.lastCommandTime = now;

				this.commandHistory.unshift({
					command: commandInfo.command,
					target: commandInfo.target,
					timestamp: now,
					success: true
				});

				if (this.commandHistory.length > 10) {
					this.commandHistory.pop();
				}

				setTimeout(() => {
					this._startCooldown();
				}, 1000);
			} else {
				this.plugin.showNotification(`"${commandInfo.target}"을(를) 찾을 수 없습니다.`);
				this._startCooldown();
			}
		} else {
			this.plugin.showNotification('명령을 이해할 수 없습니다. 다시 시도해주세요.');
			this._startCooldown();
		}
	}

	_analyzeCommand(transcript) {
		const allCommands = [
			...this.commands.navigation,
			...this.commands.action,
			...this.commands.settings
		];

		const command = allCommands.find(cmd => transcript.includes(cmd));
		if (command) {
			const target = transcript.replace(command, '').trim();
			return { command, target };
		}

		return { command: null, target: null };
	}

	_findTargetElements(searchText) {
		const lowerCaseSearchText = searchText.toLowerCase();
		const lowerCaseSearchTextNoSpaces = lowerCaseSearchText.replace(/\s+/g, '');

		const selectors = [
			'a', 'button', '[role="button"]',
			'input[type="radio"]', 'input[type="checkbox"]',
			'input[type="submit"]', 'input[type="button"]'
		];

		const elements = document.querySelectorAll(selectors.join(', '));
		const matchingElements = [];

		elements.forEach(element => {
			const texts = this._collectElementTexts(element);
			if (this._isTextMatching(texts, lowerCaseSearchText, lowerCaseSearchTextNoSpaces)) {
				matchingElements.push(element);
			}
		});

		return matchingElements;
	}

	_collectElementTexts(element) {
		const texts = [];
		if (element.textContent) texts.push(element.textContent.trim());
		const img = element.querySelector('img');
		if (img && img.alt) texts.push(img.alt);
		if (element.title) texts.push(element.title);
		if (element.getAttribute('aria-label')) texts.push(element.getAttribute('aria-label'));
		return texts;
	}

	_isTextMatching(texts, searchText, searchTextNoSpaces) {
		return texts.some(text => {
			const lowerText = text.toLowerCase();
			const lowerTextNoSpaces = lowerText.replace(/\s+/g, '');
			return lowerText.includes(searchText) ||
				lowerTextNoSpaces.includes(searchTextNoSpaces);
		});
	}

	_executeCommand(command, element) {
		try {
			if (this.commands.navigation.includes(command) ||
				this.commands.action.includes(command)) {

				if (element.tagName.toLowerCase() === 'a' ||
					element.tagName.toLowerCase() === 'button' ||
					element.getAttribute('role') === 'button') {
					element.click();
					this.plugin.showNotification(`"${element.textContent?.trim() || '요소'}"을(를) 클릭했습니다.`);
				} else if (element.tagName.toLowerCase() === 'input' &&
					(element.type === 'radio' || element.type === 'checkbox')) {
					element.checked = !element.checked;
					element.dispatchEvent(new Event('change', { bubbles: true }));
					this.plugin.showNotification(`"${element.getAttribute('name') || '입력'}"을(를) 토글했습니다.`);
				}
			}

			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		} catch (error) {
			console.error('명령 실행 오류:', error);
			this.plugin.showNotification('명령을 실행할 수 없습니다.');
		}
	}
}
