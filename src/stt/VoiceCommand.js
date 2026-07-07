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
			commandTimeout: null,
			postCommand: null,
			restart: null
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
		this.retryCount = 0;

		this.audioContext = null;
		this.analyser = null;
		this.silenceTimer = null;
		this.isSpeaking = false;
		this.lastSpeechTime = 0;
	}

	/**
	 * 음성 명령을 시작합니다.
	 * @returns {boolean} 시작 성공 여부 (미지원 브라우저면 false)
	 */
	start() {
		if (!this._checkSupport()) {
			this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.noSupport'));
			return false;
		}

		this.retryCount = 0;
		this._createStatusDisplay();
		this._setState(this.states.WAITING);
		this._startContinuousRecognition();
		return true;
	}

	stop() {
		this._setState(this.states.INACTIVE);
		this._clearAllTimers();

		// stop() 대신 abort() 사용: 보류 중인 인식 결과로 명령이 실행되는 것을 방지
		if (this.recognition) {
			this.recognition.abort();
			this.isActive = false;
		}

		this._removeStatusDisplay();
	}

	/**
	 * 복구 불가능한 오류로 음성 명령을 완전히 정지하고 매니저에 통지합니다.
	 * (권한 거부, 재시도 횟수 초과 등)
	 */
	_deactivate() {
		this.stop();

		if (this.sttManager && typeof this.sttManager.handleVoiceCommandStopped === 'function') {
			this.sttManager.handleVoiceCommandStopped();
		}
	}

	_createStatusDisplay() {
		this._removeStatusDisplay();

		this.statusDisplay = document.createElement('div');
		this.statusDisplay.id = 'wat-voice-status';
		this.statusDisplay.className = 'wat-voice-status';
		// 스크린 리더가 상태 변화를 자동으로 읽을 수 있도록 라이브 영역으로 지정
		this.statusDisplay.setAttribute('role', 'status');
		this.statusDisplay.setAttribute('aria-live', 'polite');
		this.statusDisplay.innerHTML = `
			<div class="status-icon">🎤</div>
			<div class="status-text">${this.plugin.getLocalizedText('command.voice.status.preparing')}</div>
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
				text.textContent = this.plugin.getLocalizedText('command.voice.status.inactive');
				detail.textContent = '';
				this.statusDisplay.style.background = 'rgba(128, 128, 128, 0.9)';
				progress.style.display = 'none';
				break;
			case this.states.WAITING:
				icon.textContent = '🎤';
				text.textContent = this.plugin.getLocalizedText('command.voice.status.waiting');
				detail.textContent = this.plugin.getLocalizedText('command.voice.status.waitingDetail');
				this.statusDisplay.style.background = 'rgba(33, 150, 243, 0.9)';
				progress.style.display = 'none';
				break;
			case this.states.LISTENING:
				icon.textContent = '🎧';
				text.textContent = this.plugin.getLocalizedText('command.voice.status.listening');
				detail.textContent = this.plugin.getLocalizedText('command.voice.status.listeningDetail');
				this.statusDisplay.style.background = 'rgba(76, 175, 80, 0.9)';
				progress.style.display = 'block';
				progress.innerHTML = '<div style="width: 100%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;"><div class="progress-bar" style="width: 0%; height: 100%; background: white; border-radius: 2px; animation: pulse 1s infinite;"></div></div>';
				break;
			case this.states.PROCESSING:
				icon.textContent = '⚙️';
				text.textContent = this.plugin.getLocalizedText('command.voice.status.processing');
				detail.textContent = this.plugin.getLocalizedText('command.voice.status.processingDetail');
				this.statusDisplay.style.background = 'rgba(255, 193, 7, 0.9)';
				progress.style.display = 'none';
				break;
			case this.states.EXECUTING:
				icon.textContent = '🚀';
				text.textContent = this.plugin.getLocalizedText('command.voice.status.executing');
				this.statusDisplay.style.background = 'rgba(139, 195, 74, 0.9)';
				progress.style.display = 'none';
				break;
			case this.states.COOLDOWN:
				icon.textContent = '⏱️';
				text.textContent = this.plugin.getLocalizedText('command.voice.status.cooldown');
				detail.textContent = this.plugin.getLocalizedText('command.voice.status.cooldownDetail');
				this.statusDisplay.style.background = 'rgba(158, 158, 158, 0.9)';
				progress.style.display = 'none';
				break;
		}
	}

	_updateExecutingStatus(commandText) {
		if (!this.statusDisplay) return;
		const detail = this.statusDisplay.querySelector('.status-detail');
		detail.textContent = this.plugin.getLocalizedText('command.voice.status.executingDetail', { command: commandText });
	}

	_startContinuousRecognition() {
		// 이전 사이클의 commandTimeout이 남아 있으면 해제 (타이머 누수 방지)
		if (this.timers.commandTimeout) {
			clearTimeout(this.timers.commandTimeout);
			this.timers.commandTimeout = null;
		}

		this._initializeRecognition();

		this.timers.commandTimeout = setTimeout(() => {
			if (this.currentState === this.states.WAITING ||
				this.currentState === this.states.LISTENING) {
				this._setState(this.states.COOLDOWN);
				// 타임아웃 시 진행 중인 인식도 실제로 중단
				if (this.recognition) {
					this.recognition.abort();
				}
				this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.timeout'));
				this._startCooldown();
			}
		}, this.config.commandTimeout);

		this._startRecognition();
	}

	_startCooldown() {
		// stop() 이후에는 쿨다운을 통한 재시작을 하지 않음 (좀비 재시작 방지)
		if (this.currentState === this.states.INACTIVE) return;

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

		// 기존 인스턴스가 있으면 핸들러 해제 + 중단 후 교체 (이벤트 중복/유령 인식 방지)
		if (this.recognition) {
			this.recognition.onstart = null;
			this.recognition.onend = null;
			this.recognition.onresult = null;
			this.recognition.onerror = null;
			this.recognition.onnomatch = null;
			this.recognition.onspeechstart = null;
			this.recognition.onspeechend = null;
			this.recognition.onsoundstart = null;
			this.recognition.onsoundend = null;
			try {
				this.recognition.abort();
			} catch (error) {
				// 이미 종료된 인스턴스면 무시
			}
			this.isActive = false;
		}

		this.recognition = new SpeechRecognition();

		if (SpeechGrammarList) {
			const speechRecognitionList = new SpeechGrammarList();
			this.recognition.grammars = speechRecognitionList;
		}

		this.recognition.lang = this.sttManager.config.language;
		this.recognition.interimResults = this.sttManager.config.interimResults;
		// 상태 머신(WAITING→LISTENING→…→COOLDOWN)이 단발 인식을 전제로 설계되어
		// 설정값과 무관하게 continuous는 항상 false를 유지합니다.
		this.recognition.continuous = false;
		this.recognition.maxAlternatives = this.sttManager.config.maxAlternatives;

		this._setupEventHandlers();
	}

	_setupEventHandlers() {
		this.recognition.onstart = () => {
			// stop()이 이미 호출된 상태라면 뒤늦게 시작된 인식을 즉시 중단
			if (this.currentState === this.states.INACTIVE) {
				this.recognition.abort();
				return;
			}

			this.isActive = true;
			this._setState(this.states.LISTENING);
			this.lastSpeechTime = Date.now();
		};

		this.recognition.onend = () => {
			this.isActive = false;

			if (this.currentState === this.states.LISTENING ||
				this.currentState === this.states.PROCESSING) {
				this._setState(this.states.WAITING);

				// 재시작 전 기존 타이머를 정리하고, 재시작 타이머도 등록해 stop() 시 취소되도록 함
				this._clearAllTimers();
				this.timers.restart = setTimeout(() => {
					if (this.currentState === this.states.WAITING) {
						this._startContinuousRecognition();
					}
				}, 500);
			}
		};

		this.recognition.onresult = (event) => {
			// stop() 이후 도착한 보류 결과는 무시
			if (this.currentState === this.states.INACTIVE) return;

			this._setState(this.states.PROCESSING);
			// 인식 성공 시 재시도 카운터 초기화
			this.retryCount = 0;

			const result = event.results[0][0];
			const transcript = result.transcript.toLowerCase().trim();
			const confidence = result.confidence;

			if (confidence < 0.6) {
				this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.lowConfidence'));
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

			// stop() 이후 발생한 오류나 내부에서 호출한 abort()로 인한 오류는 무시
			if (this.currentState === this.states.INACTIVE || event.error === 'aborted') {
				return;
			}

			// 권한/장치 오류는 재시도해도 해결되지 않으므로 재시도 없이 완전 정지
			if (event.error === 'not-allowed' || event.error === 'audio-capture') {
				const fatalMessage = event.error === 'not-allowed'
					? this.plugin.getLocalizedText('command.voice.msg.notAllowed')
					: this.plugin.getLocalizedText('command.voice.msg.audioCapture');
				this.plugin.showNotification(fatalMessage);
				this._deactivate();
				return;
			}

			// 일시적인 오류는 최대 재시도 횟수까지만 재시도
			this.retryCount++;
			if (this.retryCount > this.config.maxRetries) {
				this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.retryExceeded'));
				this._deactivate();
				return;
			}

			let errorMessage = this.plugin.getLocalizedText('command.voice.msg.error');
			switch (event.error) {
				case 'no-speech':
					errorMessage = this.plugin.getLocalizedText('command.voice.msg.noSpeech');
					break;
				case 'network':
					errorMessage = this.plugin.getLocalizedText('command.voice.msg.network');
					break;
			}

			this.plugin.showNotification(errorMessage);
			this._startCooldown();
		};

		this.recognition.onnomatch = () => {
			this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.noMatch'));
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
			this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.startFailed'));
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
			commandTimeout: null,
			postCommand: null,
			restart: null
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

				// 타이머로 등록해 stop() 시 _clearAllTimers()로 취소되도록 함 (좀비 재시작 방지)
				this.timers.postCommand = setTimeout(() => {
					this._startCooldown();
				}, 1000);
			} else {
				this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.targetNotFound', { target: commandInfo.target }));
				this._startCooldown();
			}
		} else {
			this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.notUnderstood'));
			this._startCooldown();
		}
	}

	_analyzeCommand(transcript) {
		const allCommands = [
			...this.commands.navigation,
			...this.commands.action,
			...this.commands.settings
		];

		// 최장 일치 우선: 긴 명령어부터 검사해 부분 문자열 오매칭을 완화
		allCommands.sort((a, b) => b.length - a.length);

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
		// input[type=submit|button] 등은 value가 표시 텍스트이므로 함께 수집
		if (element.tagName.toLowerCase() === 'input' && element.value) {
			texts.push(element.value.trim());
		}
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
					this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.clicked', { target: element.textContent?.trim() || this.plugin.getLocalizedText('command.voice.label.element') }));
				} else if (element.tagName.toLowerCase() === 'input' &&
					(element.type === 'submit' || element.type === 'button')) {
					element.click();
					this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.clicked', { target: element.value || this.plugin.getLocalizedText('command.voice.label.button') }));
				} else if (element.tagName.toLowerCase() === 'input' &&
					(element.type === 'radio' || element.type === 'checkbox')) {
					element.checked = !element.checked;
					element.dispatchEvent(new Event('change', { bubbles: true }));
					this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.toggled', { target: element.getAttribute('name') || this.plugin.getLocalizedText('command.voice.label.input') }));
				}
			}

			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		} catch (error) {
			console.error('명령 실행 오류:', error);
			this.plugin.showNotification(this.plugin.getLocalizedText('command.voice.msg.executeFailed'));
		}
	}
}
