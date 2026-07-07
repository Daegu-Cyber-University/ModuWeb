/**
 * @fileoverview IframeStyler - 동일 출처 iframe에 대한 접근성 스타일 적용/동기화 담당
 * @module src/wat/IframeStyler
 * @description WAT.js에서 추출된 iframe 스타일링 클러스터 (Phase 6-1).
 *              iframe 탐지·제외 판정·CSS 주입·동적 스타일 마킹/적용·신규 iframe 감시를 담당한다.
 *              WAT 인스턴스(plugin)의 서비스(제외 셀렉터, 비율 테이블, 원본 스타일 맵,
 *              추적형 타이머, 옵저버 레지스트리)를 위임받아 사용한다.
 */
import { Constants } from '../core/constants.js';

const WAT_DEBUG_ENABLED = false;

export class IframeStyler {
	/**
	 * @param {Object} plugin - WAT 인스턴스 (container, excludeSelector, styleMode,
	 *                          fontSizeRatios 등 서비스 제공자)
	 */
	constructor(plugin) {
		this.plugin = plugin;
	}

	/**
	 * 페이지의 모든 유효한 iframe에 접근성 스타일을 적용합니다
	 * @returns {void}
	 */
	applyStylesToIframes() {
		const iframes = document.querySelectorAll('iframe');
		if (WAT_DEBUG_ENABLED) console.log(`발견된 iframe 개수: ${iframes.length}`);

		// excludeSelector에 해당하지 않는 iframe만 필터링
		const validIframes = Array.from(iframes).filter(iframe => {
			return !this.isIframeInExcludeZone(iframe);
		});

		if (WAT_DEBUG_ENABLED) console.log(`처리 대상 iframe 개수: ${validIframes.length} (제외된 개수: ${iframes.length - validIframes.length})`);

		validIframes.forEach((iframe, index) => {
			this.processIframe(iframe, index);
		});
	}

	/**
	 * 개별 iframe에 접근성 스타일을 적용합니다 (동일 출처만, 크로스 오리진은 안내 후 스킵)
	 * @param {HTMLIFrameElement} iframe - 처리할 iframe
	 * @param {number} index - 컬렉션 내 인덱스 (id 폴백용)
	 * @returns {void}
	 */
	processIframe(iframe, index) {
		const src = iframe.src || '';
		const iframeId = iframe.id || `iframe-${index}`;

		// iframe이 excludeSelector 내부에 있는지 확인
		if (this.isIframeInExcludeZone(iframe)) {
			if (WAT_DEBUG_ENABLED) console.log(`🚫 excludeSelector 내부 iframe 제외: ${iframeId} (${src})`);
			return;
		}

		try {
			// 동일 출처 접근 시도
			const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

			if (iframeDoc) {
				if (WAT_DEBUG_ENABLED) console.log(`✅ 동일 출처 iframe 처리 성공: ${iframeId} (${src})`);
				this.applyStylesToIframeDocument(iframeDoc, iframeId);
			} else {
				console.warn(`[WAT] iframe document access denied: ${iframeId} (${src})`);
			}
		} catch (error) {
			// 크로스 오리진인 경우
			if (this.isKnownExternalService(src)) {
				if (WAT_DEBUG_ENABLED) console.log(`ℹ️ 외부 서비스 iframe 스킵: ${iframeId} (${src})`);
			} else {
				console.warn(`[WAT] Cross-origin iframe processing failed: ${iframeId} (${src})`, error.message);
			}
		}
	}

	/**
	 * iframe이 제외 영역(도구 컨테이너·wat-exclude·사용자 excludeSelector) 내에 있는지 판단합니다
	 * @param {HTMLIFrameElement} iframe - 확인할 iframe
	 * @returns {boolean} 제외 대상이면 true
	 */
	isIframeInExcludeZone(iframe) {
		// 1. 컨테이너 내부 iframe 확인
		if (this.plugin.container && this.plugin.container.contains(iframe)) {
			return true;
		}

		// 2. wat-exclude 클래스 확인
		if (iframe.classList.contains('wat-exclude') || iframe.closest('.wat-exclude')) {
			return true;
		}

		// 3. 사용자 설정 excludeSelector 확인
		if (this.plugin.excludeSelector) {
			const userExcludes = this.plugin.excludeSelector.split(',').map(s => s.trim());
			for (const exclude of userExcludes) {
				if (exclude) {
					try {
						// iframe 자체가 선택자에 해당하거나
						if (iframe.matches(exclude)) {
							return true;
						}
						// iframe의 부모 요소가 선택자에 해당하는 경우
						if (iframe.closest(exclude)) {
							return true;
						}
					} catch (error) {
						console.warn(`[WAT] Invalid excludeSelector: ${exclude}`, error);
					}
				}
			}
		}

		return false;
	}

	/**
	 * iframe 소스가 알려진 외부 서비스(YouTube 등)인지 판단합니다 (크로스 오리진 경고 억제용)
	 * @param {string} src - iframe 소스 URL
	 * @returns {boolean}
	 */
	isKnownExternalService(src) {
		const externalServices = [
			'youtube.com', 'youtu.be', 'vimeo.com',
			'google.com', 'maps.google.com', 'googleapis.com',
			'facebook.com', 'twitter.com', 'instagram.com',
			'kakao.com', 'naver.com'
		];

		return externalServices.some(service => src.includes(service));
	}

	/**
	 * iframe 문서에 메인 문서의 접근성 설정을 복사하고 CSS 주입·요소 마킹을 수행합니다
	 * @param {Document} iframeDoc - iframe 문서
	 * @param {string} iframeId - 식별자 (로그용)
	 * @returns {void}
	 */
	applyStylesToIframeDocument(iframeDoc, iframeId) {
		const documentElement = iframeDoc.documentElement;

		// 메인 문서의 data 속성들을 iframe에도 적용
		const styleAttributes = [
			'fontSize', 'fontFamily', 'txtAlign',
			'letterSpacing', 'lineHeight', 'colorTheme',
			'saturation', 'screenScale', 'hideImg', 'stopAni'
		];

		styleAttributes.forEach(attr => {
			const value = document.documentElement.dataset[attr];
			if (value && value !== 'initial') {
				documentElement.dataset[attr] = value;
			}
		});

		// 폰트 패밀리 직접 적용
		if (document.documentElement.style.fontFamily) {
			documentElement.style.fontFamily = document.documentElement.style.fontFamily;
		}

		// CSS 파일 주입
		this.injectCSSToIframe(iframeDoc, iframeId);

		// 동적 스타일 요소 마킹
		this.markDynamicStyledElementsInIframe(iframeDoc, iframeId);

		if (WAT_DEBUG_ENABLED) console.log(`✅ iframe 스타일 적용 완료: ${iframeId}`);
	}

	/**
	 * 메인 문서의 CSS 링크를 iframe 문서에 주입합니다 (data-wat-injected로 추적, 중복 방지)
	 * @param {Document} iframeDoc - iframe 문서
	 * @param {string} iframeId - 식별자 (로그용)
	 * @returns {void}
	 */
	injectCSSToIframe(iframeDoc, iframeId) {
		try {
			const cssLink = document.querySelector(`link[href*="${Constants.PATHS.CSS_FILE}"]`);
			if (cssLink && !iframeDoc.querySelector(`link[href*="${Constants.PATHS.CSS_FILE}"]`)) {
				const iframeCssLink = iframeDoc.createElement('link');
				iframeCssLink.rel = 'stylesheet';
				iframeCssLink.href = cssLink.href;
				iframeCssLink.setAttribute('data-wat-injected', 'true');
				iframeDoc.head.appendChild(iframeCssLink);
				if (WAT_DEBUG_ENABLED) console.log(`✅ CSS 주입 완료: ${iframeId}`);
			}
		} catch (error) {
			console.warn(`[WAT] CSS injection failed: ${iframeId}`, error.message);
		}
	}

	/**
	 * iframe 내부 텍스트 요소를 동적 스타일링 대상으로 마킹하고 원본 스타일을 기록합니다
	 * @param {Document} iframeDoc - iframe 문서
	 * @param {string} iframeId - 식별자 (로그용)
	 * @returns {void}
	 */
	markDynamicStyledElementsInIframe(iframeDoc, iframeId) {
		try {
			const styleProps = [
				{ css: 'font-size', className: 'wat-dyn-fontsize', px: true },
				{ css: 'letter-spacing', className: 'wat-dyn-letterspacing', px: true },
				{ css: 'line-height', className: 'wat-dyn-lineheight', px: true },
				{ css: 'text-align', className: 'wat-dyn-textalign', px: false }
			];

			// iframe 내부에서도 excludeSelector 적용
			const excludeSelectors = ['.wat-container', '.wat-container *'];

			// 사용자 설정 excludeSelector 추가
			if (this.plugin.excludeSelector) {
				const userExcludes = this.plugin.excludeSelector.split(',').map(s => s.trim());
				userExcludes.forEach(exclude => {
					if (exclude) {
						excludeSelectors.push(exclude, `${exclude} *`);
					}
				});
			}

			excludeSelectors.push('.wat-exclude', '.wat-exclude *');

			const notSelector = excludeSelectors.length > 0 ? `:not(${excludeSelectors.join('):not(')})` : '';

			const selector = `*${notSelector}`;
			// 사용자 excludeSelector가 잘못된 CSS면 전체가 죽지 않도록 방어 (메인 문서 버전과 동일)
			let elements;
			try {
				elements = iframeDoc.querySelectorAll(selector);
			} catch (e) {
				console.warn(`[WAT] iframe excludeSelector가 유효하지 않아 제외 없이 진행합니다: ${iframeId}`, e.message);
				elements = iframeDoc.querySelectorAll('*');
			}

			elements.forEach(el => {
				// iframe 내부에서도 제외 검증
				if (this.shouldExcludeElementInIframe(el, iframeDoc)) {
					return;
				}

				if (!el.textContent.trim()) return;

				let hasDynamic = false;
				const origStyles = {};
				// 요소당 getComputedStyle 1회로 축소 (성능 — 대형 iframe 프리즈 방지)
				const computed = el.ownerDocument.defaultView.getComputedStyle(el);

				styleProps.forEach(({ css, className, px }) => {
					const elVal = computed.getPropertyValue(css);

					let value = elVal;
					if (px && value) {
						const pxValue = this.getPxValueFromIframe(el, css, computed);
						if (pxValue) value = pxValue;
					}
					origStyles[css] = value;
					el.classList.add('wat-dyn-el', className);
					hasDynamic = true;
				});

				if (hasDynamic) {
					this.plugin._originalStyleMap.set(el, origStyles);
				}
			});

			if (WAT_DEBUG_ENABLED) console.log(`✅ iframe 요소 마킹 완료: ${iframeId}, 처리된 요소: ${elements.length}개`);
		} catch (error) {
			console.warn(`[WAT] iframe element marking failed: ${iframeId}`, error.message);
		}
	}

	/**
	 * iframe 내부 요소가 스타일링 제외 대상인지 판단합니다
	 * @param {Element} element - iframe 내부 요소
	 * @param {Document} iframeDoc - iframe 문서 컨텍스트
	 * @returns {boolean} 제외 대상이면 true
	 */
	shouldExcludeElementInIframe(element, iframeDoc) {
		// wat-exclude 클래스 확인
		if (element.classList.contains('wat-exclude') || element.closest('.wat-exclude')) {
			return true;
		}

		// 사용자 설정 excludeSelector 확인
		if (this.plugin.excludeSelector) {
			const userExcludes = this.plugin.excludeSelector.split(',').map(s => s.trim());
			for (const exclude of userExcludes) {
				if (exclude) {
					try {
						if (element.matches(exclude) || element.closest(exclude)) {
							return true;
						}
					} catch (error) {
						// 선택자 오류 시 무시
					}
				}
			}
		}

		return false;
	}

	/**
	 * iframe 컨텍스트에서 CSS 속성 값을 px로 환산합니다 (em/rem 지원)
	 * @param {Element} el - 대상 요소
	 * @param {string} prop - CSS 속성명
	 * @param {CSSStyleDeclaration} [computed] - 호출자가 이미 계산한 computed 스타일 (재사용으로 리플로우 절감)
	 * @returns {number|string} px 값 또는 빈 문자열
	 */
	getPxValueFromIframe(el, prop, computed) {
		try {
			const cs = computed || el.ownerDocument.defaultView.getComputedStyle(el);
			const val = cs.getPropertyValue(prop);
			if (!val) return '';
			if (prop === 'line-height' && val === 'normal') return '';
			if (val.endsWith('px')) return parseFloat(val);
			if (val.endsWith('em') || val.endsWith('rem')) {
				const base = parseFloat(cs.fontSize);
				return parseFloat(val) * base;
			}
			return parseFloat(val) || '';
		} catch (error) {
			return '';
		}
	}

	// ========== iframe Sync ==========

	/**
	 * 스타일 변경을 모든 접근 가능한 iframe에 동기화합니다
	 * @param {string} styleType - 스타일 타입 ('fontSize', 'lineHeight' 등)
	 * @param {string} value - 적용할 값
	 * @returns {void}
	 */
	syncStyleToIframes(styleType, value) {
		const iframes = document.querySelectorAll('iframe');
		let processedCount = 0;
		let excludedCount = 0;

		iframes.forEach((iframe) => {
			// iframe이 제외 영역에 있는지 확인
			if (this.isIframeInExcludeZone(iframe)) {
				excludedCount++;
				return;
			}

			try {
				const iframeDoc = iframe.contentDocument;
				if (iframeDoc) {
					this.applyStyleToIframeDocument(iframeDoc, styleType, value);
					processedCount++;
				}
			} catch (error) {
				// 크로스 오리진은 조용히 스킵
			}
		});

		if (WAT_DEBUG_ENABLED) {
			if (processedCount > 0 || excludedCount > 0) {
				console.log(`✅ ${styleType} 스타일 동기화 - 처리: ${processedCount}개, 제외: ${excludedCount}개`);
			}
		}
	}

	/**
	 * 개별 iframe 문서에 특정 스타일을 적용합니다 (data 속성 + 동적 모드 시 인라인 스타일)
	 * @param {Document} iframeDoc - iframe 문서
	 * @param {string} styleType - 스타일 타입
	 * @param {string} value - 값
	 * @returns {void}
	 */
	applyStyleToIframeDocument(iframeDoc, styleType, value) {
		const documentElement = iframeDoc.documentElement;

		// data 속성 설정
		documentElement.dataset[styleType] = value;

		// 폰트 패밀리는 직접 스타일도 적용
		if (styleType === 'fontFamily') {
			if (value === 'initial') {
				documentElement.style.fontFamily = '';
			} else {
				documentElement.style.fontFamily = this.plugin.getFontFamily(value);
			}
		}

		// 동적 스타일 적용
		if (this.plugin.styleMode === 'dynamic') {
			this.applyDynamicStyleToIframe(iframeDoc, styleType, value);
		}
	}

	/**
	 * 스타일 타입에 따라 적절한 동적 적용 메서드로 라우팅합니다
	 * @param {Document} iframeDoc - iframe 문서
	 * @param {string} styleType - 스타일 타입
	 * @param {string} value - 값
	 * @returns {void}
	 */
	applyDynamicStyleToIframe(iframeDoc, styleType, value) {
		if (styleType === 'fontSize') {
			this.applyDynamicFontSizeToIframe(iframeDoc, value);
		} else if (styleType === 'lineHeight') {
			this.applyDynamicLineHeightToIframe(iframeDoc, value);
		} else if (styleType === 'letterSpacing') {
			this.applyDynamicLetterSpacingToIframe(iframeDoc, value);
		}
	}

	/**
	 * iframe 내 마킹된 요소들에 동적 폰트 크기를 적용합니다
	 * @param {Document} iframeDoc - iframe 문서
	 * @param {string} size - 폰트 크기 키
	 * @returns {void}
	 */
	applyDynamicFontSizeToIframe(iframeDoc, size) {
		const elements = iframeDoc.querySelectorAll('.wat-dyn-fontsize');

		if (size === 'initial' || size === 'unset') {
			elements.forEach(el => {
				el.style.removeProperty('font-size');
			});
			return;
		}

		const ratio = this.plugin.fontSizeRatios[size] || 1;

		elements.forEach(el => {
			const orig = this.plugin._originalStyleMap.get(el);
			const origPx = orig && parseFloat(orig['font-size']);
			if (origPx) {
				el.style.setProperty('font-size', (origPx * ratio) + 'px', 'important');
			}
		});
	}

	/**
	 * iframe 내 마킹된 요소들에 동적 줄간격을 적용합니다
	 * @param {Document} iframeDoc - iframe 문서
	 * @param {string} height - 줄간격 키
	 * @returns {void}
	 */
	applyDynamicLineHeightToIframe(iframeDoc, height) {
		const elements = iframeDoc.querySelectorAll('.wat-dyn-lineheight');

		if (height === 'initial' || height === 'unset') {
			elements.forEach(el => {
				el.style.removeProperty('line-height');
			});
			return;
		}

		const ratio = this.plugin.lineHeightRatios[height] || 1;

		elements.forEach(el => {
			// fontSize 버전과 동일하게 null 가드 — 원본 맵 미등록 요소에서 TypeError로 전체 중단 방지
			const orig = this.plugin._originalStyleMap.get(el);
			const origPx = orig && parseFloat(orig['line-height']);
			if (origPx) {
				el.style.setProperty('line-height', (origPx * ratio) + 'px', 'important');
			}
		});
	}

	/**
	 * iframe 내 마킹된 요소들에 동적 자간을 적용합니다 (원본 미기록 시 폰트 크기 기반 폴백)
	 * @param {Document} iframeDoc - iframe 문서
	 * @param {string} spacing - 자간 키
	 * @returns {void}
	 */
	applyDynamicLetterSpacingToIframe(iframeDoc, spacing) {
		const elements = iframeDoc.querySelectorAll('.wat-dyn-letterspacing');

		if (spacing === 'initial' || spacing === 'unset') {
			elements.forEach(el => {
				el.style.removeProperty('letter-spacing');
			});
			return;
		}

		const ratio = this.plugin.letterSpacingRatios[spacing] || 1;

		elements.forEach(el => {
			const orig = this.plugin._originalStyleMap.get(el);
			const rawLs = orig && orig['letter-spacing'];
			const origPx = rawLs != null && rawLs !== '' ? parseFloat(String(rawLs)) : NaN;
			let valuePx;
			if (Number.isFinite(origPx)) {
				valuePx = origPx * ratio;
			} else {
				const fontSize = parseFloat(el.ownerDocument.defaultView.getComputedStyle(el).fontSize);
				const baseSpacing = fontSize * 0.05;
				valuePx = baseSpacing * ratio;
			}
			el.style.setProperty('letter-spacing', valuePx + 'px', 'important');
		});
	}

	// ========== iframe Management ==========

	/**
	 * 기존 iframe 처리 + 신규 iframe 감시를 시작합니다 (init 시 1회)
	 * @returns {void}
	 */
	setupIframeHandling() {
		if (WAT_DEBUG_ENABLED) console.log('🔄 iframe 처리 초기화 시작');

		// 기존 iframe들 처리
		this.applyStylesToIframes();

		// 새로 추가되는 iframe 감지
		this.setupIframeMutationObserver();
	}

	/**
	 * 새로 추가되는 iframe을 감지하는 MutationObserver를 설정합니다
	 * @returns {void}
	 */
	setupIframeMutationObserver() {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						if (node.tagName === 'IFRAME') {
							if (WAT_DEBUG_ENABLED) console.log('🆕 새 iframe 감지:', node.src || node.id);
							this.handleNewIframe(node);
						} else {
							// 새로 추가된 요소 내부의 iframe들도 확인
							const iframes = node.querySelectorAll && node.querySelectorAll('iframe');
							if (iframes) {
								iframes.forEach(iframe => {
									if (WAT_DEBUG_ENABLED) console.log('🆕 새 iframe 감지 (내부):', iframe.src || iframe.id);
									this.handleNewIframe(iframe);
								});
							}
						}
					}
				});
			});
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		this.plugin._observers.set('iframe', observer);
		if (WAT_DEBUG_ENABLED) console.log('✅ iframe MutationObserver 설정 완료');
	}

	/**
	 * 새로 감지된 iframe을 로드 완료 후 처리 예약합니다
	 * @param {HTMLIFrameElement} iframe - 새 iframe
	 * @returns {void}
	 */
	handleNewIframe(iframe) {
		const iframeId = iframe.id || `new-iframe-${Date.now()}`;

		// 새 iframe도 제외 영역 확인
		if (this.isIframeInExcludeZone(iframe)) {
			console.log(`🚫 새 iframe이 excludeSelector 내부에 있어 제외: ${iframeId}`);
			return;
		}

		// iframe 로드 완료 대기 — HTMLIFrameElement에는 complete/readyState가 없으므로 contentDocument로 판정
		let alreadyLoaded = false;
		try {
			alreadyLoaded = !!(iframe.contentDocument && iframe.contentDocument.readyState === 'complete');
		} catch (e) {
			// cross-origin — load 이벤트 대기로 폴백
		}
		if (alreadyLoaded) {
			// 이미 로드된 경우 바로 처리 (추적형 타이머 — destroy 후 재주입 방지)
			this.plugin._setTimeout(() => this.processNewIframe(iframe), 100);
		} else {
			// 로드 완료 대기 (cleanup 이후 발화 시 재주입 방지 가드 포함)
			iframe.addEventListener('load', () => {
				if (this.plugin._destroyed) return;
				this.plugin._setTimeout(() => this.processNewIframe(iframe), 100);
			}, { once: true });
		}
	}

	/**
	 * 새 iframe에 접근성 스타일을 적용합니다
	 * @param {HTMLIFrameElement} iframe - 새 iframe
	 * @returns {void}
	 */
	processNewIframe(iframe) {
		const iframeId = iframe.id || `new-iframe-${Date.now()}`;
		if (WAT_DEBUG_ENABLED) console.log(`🔄 새 iframe 처리 시작: ${iframeId}`);

		try {
			const iframeDoc = iframe.contentDocument;
			if (iframeDoc) {
				this.applyStylesToIframeDocument(iframeDoc, iframeId);
			}
		} catch (error) {
			const src = iframe.src || '';
			if (this.isKnownExternalService(src)) {
				console.log(`ℹ️ 새 외부 서비스 iframe 스킵: ${iframeId} (${src})`);
			} else {
				console.warn(`⚠️ 새 크로스 오리진 iframe 처리 불가: ${iframeId} (${src})`);
			}
		}
	}

	/**
	 * 플러그인이 iframe들에 주입한 CSS를 모두 제거합니다 (cleanup 시)
	 * @returns {void}
	 */
	removeInjectedCSS() {
		const iframes = document.querySelectorAll('iframe');
		let removedCount = 0;
		let excludedCount = 0;

		iframes.forEach(iframe => {
			// 제외 영역에 있는 iframe은 처리하지 않음
			if (this.isIframeInExcludeZone(iframe)) {
				excludedCount++;
				return;
			}

			try {
				const iframeDoc = iframe.contentDocument;
				if (iframeDoc) {
					const injectedCSS = iframeDoc.querySelectorAll('link[data-wat-injected="true"]');
					injectedCSS.forEach(link => {
						link.remove();
						removedCount++;
					});
				}
			} catch (error) {
				// 크로스 오리진은 조용히 스킵
			}
		});

		if (removedCount > 0) {
			console.log(`✅ ${removedCount}개 iframe에서 주입된 CSS 제거 완료 (제외: ${excludedCount}개)`);
		}
	}
}
