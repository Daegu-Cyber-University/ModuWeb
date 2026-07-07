/**
 * @fileoverview Dictionary - 선택 텍스트 사전 검색 기능 담당
 * @module src/wat/Dictionary
 * @description WAT.js에서 추출된 사전 클러스터 (Phase 6-2).
 *              검색어 정제(조사 제거)·서버 요청·결과 모달·알림을 담당한다.
 *              보안(S-1): fetch+JSON(CORS)을 우선 사용하고, 서버가 지원하지 않을 때만
 *              JSONP로 폴백한다 (JSONP는 응답을 스크립트로 실행하므로 deprecated).
 */
import { ErrorHandler } from '../core/ErrorHandler.js';
import { isSafeHttpUrl } from '../core/safeUrl.js';

export class Dictionary {
	/**
	 * @param {Object} plugin - WAT 인스턴스 (config·로케일·상태·알림·포커스트랩 서비스 제공자)
	 */
	constructor(plugin) {
		this.plugin = plugin;
		// 세션 내 전송 방식 캐시 — 'json' | 'jsonp' | null(미확정)
		this._transport = null;
	}

	/**
	 * 선택된 단어를 정제(조사 제거)하고 사전 검색을 수행합니다
	 * @param {string} word - 검색할 단어
	 * @returns {Promise<void>}
	 */
	async performDiction(word) {
		word = word.trim();
		if (!word) return;

		// Dispatch dictionary search start event
		this.plugin._dispatchStateEvent('dictionary:searchStarted', {
			searchTerm: word,
			timestamp: Date.now()
		});

		// Wait for configuration to be loaded
		await this.plugin._waitForConfig();

		// 고유명사 예외 패턴 (예: "경상북도", "경상남도" 등)
		const properNounPatternStr = this.plugin.getLocalizedText('patterns.properNoun.list');
		const properNounPattern = new RegExp(properNounPatternStr + '$');

		// 조사 제거를 위한 정규식 패턴
		const particlesPatternStr = this.plugin.getLocalizedText('patterns.particles.list');
		const particlesPattern = new RegExp(particlesPatternStr + '$');

		// 고유명사 예외 처리
		let cleanedWord = word;
		if (!properNounPattern.test(word)) {
			// 단어에서 조사 제거
			cleanedWord = word.replace(particlesPattern, '');
		}

		// Get configuration-based endpoint and settings
		const serverEndpoint = this.plugin.getConfigValue('api.dictionary.serverEndpoint', null);

		// Check if dictionary endpoint is configured
		if (!serverEndpoint) {
			this._showDictionaryError(cleanedWord, this.plugin.getLocalizedText('msg.error.dictionaryServerNotConfigured') || '사전 검색 서버가 설정되지 않았습니다.');
			return;
		}

		// JSONP 폴백은 응답을 <script>로 실행하므로 endpoint를 https로 제한 (임의 코드 실행/MITM 방지)
		if (!isSafeHttpUrl(serverEndpoint) || !/^https:/i.test(serverEndpoint)) {
			console.error('[WAT] 사전 serverEndpoint는 https URL이어야 합니다:', serverEndpoint);
			this._showDictionaryError(cleanedWord, this.plugin.getLocalizedText('msg.error.dictionaryServerInvalid') || '사전 검색 서버 주소가 올바르지 않습니다. (https 필요)');
			return;
		}

		const timeout = this.plugin.getConfigValue('api.dictionary.timeout', 10000);

		try {
			const data = await this._fetchDictionaryData(serverEndpoint, {
				word: cleanedWord
			}, timeout);

			// 데이터 처리
			if (data && data.items && data.items.length > 0) {
				this.displayDictionResult(data.items[0]);

				// Dispatch dictionary search success event
				this.plugin._dispatchStateEvent('dictionary:searchSuccess', {
					searchTerm: cleanedWord,
					originalTerm: word,
					result: data.items[0],
					timestamp: Date.now()
				});
			} else {
				this._showDictionaryNotFound(cleanedWord);

				// Dispatch dictionary search not found event
				this.plugin._dispatchStateEvent('dictionary:searchNotFound', {
					searchTerm: cleanedWord,
					originalTerm: word,
					timestamp: Date.now()
				});
			}

		} catch (error) {
			ErrorHandler.handle(error, {
				category: ErrorHandler.CATEGORIES.NETWORK,
				severity: ErrorHandler.SEVERITY.ERROR,
				method: 'performDiction',
				component: 'Dictionary',
				data: {
					word: cleanedWord,
					serverEndpoint: serverEndpoint
				}
			});

			// Show error message to user
			this._showDictionaryError(cleanedWord, error.message);

			// Dispatch dictionary search error event
			this.plugin._dispatchStateEvent('dictionary:searchError', {
				searchTerm: cleanedWord,
				originalTerm: word,
				error: error.message,
				timestamp: Date.now()
			});
		}
	}

	/**
	 * 사전 데이터를 요청합니다 — fetch+JSON(CORS) 우선, 실패 시 JSONP 폴백 (S-1 보안 개선)
	 * @private
	 * @param {string} url - 서버 엔드포인트 (https)
	 * @param {Object} params - 요청 파라미터
	 * @param {number} timeout - 타임아웃(ms)
	 * @returns {Promise<Object>} 응답 데이터
	 * @description JSON+CORS 응답은 스크립트로 실행되지 않아 서버 침해·MITM 시에도
	 *              호스트 페이지 코드 실행으로 이어지지 않는다. 서버가 JSON을 지원하지
	 *              않으면 기존 JSONP 계약으로 폴백하되 deprecated 경고를 남긴다.
	 *              세션 내 성공한 전송 방식을 캐시해 이중 요청을 반복하지 않는다.
	 */
	async _fetchDictionaryData(url, params, timeout) {
		if (this._transport !== 'jsonp') {
			try {
				const queryParams = new URLSearchParams(params);
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);
				try {
					const response = await fetch(`${url}?${queryParams.toString()}`, {
						signal: controller.signal,
						headers: { 'Accept': 'application/json' }
					});
					if (response.ok) {
						const contentType = response.headers.get('content-type') || '';
						if (contentType.includes('json')) {
							const data = await response.json();
							this._transport = 'json';
							return data;
						}
					}
				} finally {
					clearTimeout(timeoutId);
				}
			} catch (e) {
				// CORS 미지원/네트워크 오류 — JSONP 폴백 시도
			}
			console.warn('[WAT] 사전 서버가 JSON+CORS로 응답하지 않아 JSONP로 폴백합니다. JSONP는 보안상 deprecated이며 서버를 JSON+CORS로 전환해주세요.');
			this._transport = 'jsonp';
		}
		return this._fetchJSONP(url, params, timeout);
	}

	/**
	 * JSONP 요청 구현 — 레거시 서버 계약용 폴백 (deprecated)
	 * @private
	 * @param {string} url - 요청할 URL
	 * @param {Object} params - 요청 파라미터
	 * @param {number} timeout - 타임아웃(ms)
	 * @returns {Promise<Object>} 응답 데이터
	 */
	_fetchJSONP(url, params = {}, timeout = 10000) {
		return new Promise((resolve, reject) => {
			// 고유한 콜백 함수명 생성
			const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

			// 타임아웃 타이머
			const timeoutId = setTimeout(() => {
				cleanup();
				reject(new Error('Dictionary request timeout'));
			}, timeout);

			// 정리 함수
			const cleanup = () => {
				clearTimeout(timeoutId);
				if (window[callbackName]) {
					try {
						delete window[callbackName];
					} catch (e) {
						window[callbackName] = undefined;
					}
				}
				if (script && script.parentNode) {
					script.parentNode.removeChild(script);
				}
			};

			// 전역 콜백 함수 등록
			window[callbackName] = (data) => {
				cleanup();

				// 데이터 검증
				if (data) {
					resolve(data);
				} else {
					reject(new Error('No data returned from dictionary API'));
				}
			};

			// URL 파라미터 구성 (콜백 함수명 포함)
			const queryParams = new URLSearchParams(params);
			queryParams.append('callback', callbackName);  // 서버가 이 콜백 함수명으로 응답해야 함
			const fullUrl = `${url}?${queryParams.toString()}`;

			// Script 태그 생성 및 추가
			const script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = fullUrl;
			script.async = true;

			script.onerror = () => {
				cleanup();
				reject(new Error('Failed to load dictionary data. Network error or invalid response.'));
			};

			// 스크립트를 DOM에 추가하여 요청 시작
			document.head.appendChild(script);
		});
	}

	/**
	 * 사전 검색 결과를 접근성 모달(포커스 트랩·오버레이·aria-modal)로 표시합니다
	 * @param {Object} item - 검색 결과 항목 {title, description, [pronunciation], [link]}
	 * @returns {void}
	 */
	displayDictionResult(item) {
		// 현재 포커스를 가진 요소를 저장
		const previousFocusedElement = document.activeElement;

		// 기존 레이어 제거
		this.removeAllDictionLayers();

		// Get UI settings from configuration
		// config 실제 구조는 settings.ui.* — 잘못된 경로면 config 값이 항상 무시됨
		const modalWidth = this.plugin.getConfigValue('settings.ui.modalWidth', 600);
		const showPronunciation = this.plugin.getConfigValue('settings.ui.showPronunciation', true);

		// 배경 오버레이 생성 — 모달 뒤 콘텐츠와의 시각적 분리 (WCAG 4.1.2 배경 격리 보강).
		// 주의: body.overlay-active(position:fixed 스크롤 잠금)는 페이지를 최상단으로 점프시키므로
		// 본문 중간(선택 텍스트 위치)에서 열리는 사전 모달에는 사용하지 않는다 — CSS의
		// .wat-diction-overlay 규칙이 body 클래스 없이도 오버레이를 표시한다
		const overlay = document.createElement('div');
		overlay.classList.add('overlay', 'wat-overlay', 'wat-diction-overlay');
		document.body.appendChild(overlay);

		// 새로운 레이어 생성
		const layer = document.createElement('div');
		layer.classList.add('wat-diction-result-layer');
		layer.setAttribute('role', 'dialog');
		layer.setAttribute('aria-modal', 'true'); // 모달임을 명시 (배경과 분리, WCAG 4.1.2)
		layer.setAttribute('aria-labelledby', 'diction-result-title');
		layer.setAttribute('tabindex', '-1');

		// Apply configured width
		layer.style.maxWidth = `${modalWidth}px`;

		// 레이어 내용 구성 — 외부 API 응답은 textContent로만 삽입 (XSS 방지)
		const titleElement = document.createElement('h3');
		titleElement.id = 'diction-result-title';
		titleElement.textContent = item.title;
		layer.appendChild(titleElement);

		const descriptionElement = document.createElement('p');
		descriptionElement.textContent = item.description;
		layer.appendChild(descriptionElement);

		// Show pronunciation if enabled and available
		if (showPronunciation && item.pronunciation) {
			const pronunciationElement = document.createElement('div');
			pronunciationElement.className = 'wat-diction-pronunciation';
			const pronunciationLabel = document.createElement('strong');
			pronunciationLabel.textContent = `${this.plugin.getLocalizedText('dictionary.pronunciation')}:`;
			pronunciationElement.appendChild(pronunciationLabel);
			pronunciationElement.appendChild(document.createTextNode(` ${item.pronunciation}`));
			layer.appendChild(pronunciationElement);
		}

		// 링크는 http(s) 스킴만 허용 (javascript: URL 차단)
		if (item.link && isSafeHttpUrl(item.link)) {
			const linkIcon = document.createElement('span');
			linkIcon.textContent = '🔗';
			const linkElement = document.createElement('a');
			linkElement.href = item.link;
			linkElement.target = '_blank';
			linkElement.rel = 'noopener noreferrer';
			linkElement.appendChild(linkIcon);
			titleElement.appendChild(linkElement);
		}

		const closeButton = document.createElement('button');
		closeButton.textContent = this.plugin.getLocalizedText('tags.button.text.close');
		closeButton.addEventListener('click', () => {
			layer.remove();
			overlay.remove();
			// 다른 모달의 오버레이가 없을 때만 스크롤 잠금 해제 (사전 모달 자체는 잠금을 걸지 않음)
			if (!document.querySelector('.wat-overlay')) {
				document.body.classList.remove('overlay-active');
			}
			if (previousFocusedElement) {
				previousFocusedElement.focus();
			} else {
				document.body.focus();
			}
		});
		layer.appendChild(closeButton);

		// 레이어를 문서에 추가하기 전, 레이어의 위치를 결정하기 위해 DOM에 추가
		document.body.appendChild(layer);

		// 모달 위치를 계산하고 조정하는 함수
		this._adjustModalPosition(layer, modalWidth);

		// 레이어가 열리면 포커스를 이동
		layer.focus();

		// 포커스 트래핑 — 공용 trapFocus 재사용 (Tab 순환 + Escape 닫기 + 오버레이 정리)
		this.plugin.trapFocus(layer, previousFocusedElement, overlay);
	}

	/**
	 * 사전 검색 기능을 켜거나 끕니다 (끌 때 열린 결과 레이어 정리)
	 * @returns {void}
	 */
	toggleDiction() {
		const currentState = this.plugin.state.get('plugin.isDictionEnabled');
		this.plugin.state.set('plugin.isDictionEnabled', !currentState);

		if (!this.plugin.state.get('plugin.isDictionEnabled')) {
			// 열려 있는 모든 검색 결과 레이어 제거
			this.removeAllDictionLayers();
		}
	}

	/**
	 * 모든 사전 결과 레이어와 오버레이를 제거합니다
	 * @returns {void}
	 */
	removeAllDictionLayers() {
		const layers = document.querySelectorAll('.wat-diction-result-layer');
		layers.forEach(layer => layer.remove());
		// 사전 모달의 배경 오버레이도 함께 정리 — 다른 모달(페이지 구조)의 오버레이가 남아 있으면 잠금 유지
		document.querySelectorAll('.wat-diction-overlay').forEach(el => el.remove());
		if (!document.querySelector('.wat-overlay')) {
			document.body.classList.remove('overlay-active');
		}
	}

	/**
	 * 사전 검색 오류를 사용자에게 알립니다
	 * @param {string} word - 검색했던 단어
	 * @param {string} errorMessage - 오류 메시지
	 * @private
	 */
	_showDictionaryError(word, errorMessage) {
		const prefix = this.plugin.getLocalizedText('msg.error.dictionarySearch') || '사전 검색 오류';
		this._showDictionaryMessage(`${prefix}: ${errorMessage}`, 'error');
	}

	/**
	 * 검색 결과 없음을 사용자에게 알립니다
	 * @param {string} word - 검색했던 단어
	 * @private
	 */
	_showDictionaryNotFound(word) {
		const message = this.plugin.getLocalizedText('msg.info.dictionaryNotFound', { word });
		this._showDictionaryMessage(message, 'info');
	}

	/**
	 * 사전 알림을 표시합니다 — plugin._notify 위임 (사전 전용 클래스는 CSS 호환용)
	 * @param {string} message - 메시지
	 * @param {string} type - 타입 ('error', 'info', 'success')
	 * @private
	 */
	_showDictionaryMessage(message, type = 'info') {
		this.plugin._notify(message, {
			type,
			duration: 5000,
			dismissible: true,
			extraClass: `wat-dictionary-notification wat-dictionary-notification--${type}`
		});
	}

	/**
	 * 모달이 뷰포트를 벗어나지 않도록 위치를 조정합니다 (선택 텍스트 위치 기준)
	 * @param {HTMLElement} modal - 모달 요소
	 * @param {number} modalWidth - 설정된 모달 너비
	 * @private
	 */
	_adjustModalPosition(modal, modalWidth) {
		try {
			// Get viewport dimensions
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// Set initial modal styles
			modal.style.position = 'fixed';
			modal.style.width = `${Math.min(modalWidth, viewportWidth * 0.9)}px`;
			modal.style.maxHeight = '80vh';
			modal.style.overflow = 'auto';
			modal.style.zIndex = '9999';

			// Try to get selection position if available
			let targetRect = null;
			try {
				const selection = window.getSelection();
				if (selection.rangeCount > 0) {
					const range = selection.getRangeAt(0);
					targetRect = range.getBoundingClientRect();
				}
			} catch (e) {
				// Selection not available, use center positioning
				ErrorHandler.debugLog('Selection not available for modal positioning', e);
			}

			// Get modal dimensions after setting width
			const modalRect = modal.getBoundingClientRect();
			const modalWidth_actual = modalRect.width;
			const modalHeight_actual = modalRect.height;

			let left, top;

			if (targetRect && targetRect.width > 0) {
				// Position relative to selected text
				// Center horizontally relative to selection
				left = targetRect.left + (targetRect.width / 2) - (modalWidth_actual / 2);

				// Position below the selection with some spacing
				top = targetRect.bottom + 10;

				// If modal would go below viewport, position above selection
				if (top + modalHeight_actual > viewportHeight) {
					top = targetRect.top - modalHeight_actual - 10;
				}
			} else {
				// Center in viewport as fallback
				left = (viewportWidth - modalWidth_actual) / 2;
				top = (viewportHeight - modalHeight_actual) / 2;
			}

			// Ensure modal stays within horizontal bounds
			const margin = 20; // Minimum margin from edge
			if (left < margin) {
				left = margin;
			} else if (left + modalWidth_actual > viewportWidth - margin) {
				left = viewportWidth - modalWidth_actual - margin;
			}

			// Ensure modal stays within vertical bounds
			if (top < margin) {
				top = margin;
			} else if (top + modalHeight_actual > viewportHeight - margin) {
				top = viewportHeight - modalHeight_actual - margin;
			}

			// Apply final position
			modal.style.left = `${left}px`;
			modal.style.top = `${top}px`;
			modal.style.transform = 'none'; // Remove any transform that might interfere

			ErrorHandler.debugLog('Modal positioned', {
				modalWidth: modalWidth_actual,
				modalHeight: modalHeight_actual,
				finalPosition: { left, top },
				viewport: { width: viewportWidth, height: viewportHeight },
				targetRect: targetRect
			});

		} catch (error) {
			ErrorHandler.handle(error, {
				category: ErrorHandler.CATEGORIES.DOM_OPERATION,
				severity: ErrorHandler.SEVERITY.WARNING,
				method: '_adjustModalPosition',
				component: 'Dictionary'
			});

			// Fallback to center positioning
			modal.style.position = 'fixed';
			modal.style.top = '50%';
			modal.style.left = '50%';
			modal.style.transform = 'translate(-50%, -50%)';
			modal.style.maxWidth = '90vw';
			modal.style.maxHeight = '80vh';
		}
	}
}
