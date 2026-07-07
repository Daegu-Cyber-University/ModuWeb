/**
 * @fileoverview TextExtractor - TTS 낭독용 텍스트 추출 담당
 * @module src/tts/TextExtractor
 * @description WAT.js에서 추출된 텍스트 추출 클러스터 (Phase 6-4).
 *              요소 유형별(입력·링크·버튼·이미지·표 등) 낭독 텍스트 생성과
 *              이미지 alt 포함 텍스트 추출을 담당한다. AutoTTS/FocusTTS가
 *              WAT 메서드를 역참조하던 구조를 해소한다.
 */
import { Localization } from '../core/localization.js';

export class TextExtractor {
	/**
	 * @param {Object} plugin - WAT 인스턴스 (로케일·언어 서비스 제공자)
	 */
	constructor(plugin) {
		this.plugin = plugin;
	}

	/**
	 * Extracts text content including image descriptions from an element (요소에서 이미지 설명을 포함한 텍스트 내용을 추출합니다)
	 * @param {HTMLElement} element - Element to extract text from (텍스트를 추출할 요소)
	 * @returns {string} Extracted text with image descriptions (이미지 설명이 포함된 추출된 텍스트)
	 * @description Walks through element nodes and extracts text and image alt text for comprehensive TTS reading
	 *              (요소 노드를 순회하며 포괄적인 TTS 읽기를 위해 텍스트와 이미지 alt 텍스트를 추출합니다)
	 * @example
	 * // Extract text with images from a container (컨테이너에서 이미지와 함께 텍스트 추출)
	 * const text = this.extractTextWithImages(containerElement);
	 */
	extractTextWithImages(element) {
		let text = '';
		
		// 텍스트 노드와 이미지를 순회하며 텍스트 추출
		const walker = document.createTreeWalker(
			element,
			NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
			{
				acceptNode: function(node) {
					// 텍스트 노드이거나 img 태그인 경우만 허용
					if (node.nodeType === Node.TEXT_NODE) {
						return NodeFilter.FILTER_ACCEPT;
					}
					if (node.tagName && node.tagName.toLowerCase() === 'img') {
						return NodeFilter.FILTER_ACCEPT;
					}
					return NodeFilter.FILTER_SKIP;
				}
			}
		);

		let node;
		while ((node = walker.nextNode())) {
			if (node.nodeType === Node.TEXT_NODE) {
				// 텍스트 노드의 경우 내용 추가
				const textContent = node.textContent.trim();
				if (textContent) {
					text += textContent + ' ';
				}
			} else if (node.tagName && node.tagName.toLowerCase() === 'img') {
				// 이미지의 경우 alt 속성 또는 title 속성 사용
				const altText = node.getAttribute('alt') || node.getAttribute('title') || this.plugin.getLocalizedText('panel.personal.options.imgTextConvert.msg.noAlt');
				text += `[${altText}] `;
			}
		}

		return text.trim();
	}

	/**
	 * Generates appropriate TTS text based on element type (요소 타입에 따라 적절한 TTS 텍스트를 생성합니다)
	 * @param {HTMLElement} element - Element to generate text for (텍스트를 생성할 요소)
	 * @param {string} tagName - Tag name of the element (요소의 태그명)
	 * @returns {string} Generated TTS text (생성된 TTS 텍스트)
	 * @description Creates contextual TTS text based on element type (input, button, link, etc.)
	 *              (요소 타입(input, button, link 등)에 따라 맥락적 TTS 텍스트를 생성합니다)
	 * @example
	 * // Generate text for a button element (버튼 요소에 대한 텍스트 생성)
	 * const text = this.generateTextToRead(buttonElement, 'button');
	 */
	generateTextToRead(element, tagName) {
		let textToRead = '';
		const lang = this.plugin.language || Localization.DEFAULT_LANGUAGE;

		switch (tagName) {
			case 'input':
				textToRead = this.generateInputText(element, lang);
				break;
			case 'textarea':
				textToRead = this.generateTextareaText(element, lang);
				break;
			case 'select':
				textToRead = this.generateSelectText(element, lang);
				break;
			case 'a':
				textToRead = this.generateLinkText(element, lang);
				break;
			case 'button':
				textToRead = this.generateButtonText(element, lang);
				break;
			case 'img':
				textToRead = this.generateImageText(element, lang);
				break;
			case 'progress':
				textToRead = this.generateProgressText(element, lang);
				break;
			case 'table':
				textToRead = this.generateTableText(element, lang);
				break;
			default:
				textToRead = this.extractTextWithImages(element);
				break;
		}

		return textToRead;
	}

	/**
	 * Generates TTS text for input elements (입력 요소에 대한 TTS 텍스트를 생성합니다)
	 * @param {HTMLInputElement} element - Input element (입력 요소)
	 * @param {string} lang - Language code (언어 코드)
	 * @returns {string} Generated input text description (생성된 입력 텍스트 설명)
	 * @description Creates descriptive text for various input types including current values and states
	 *              (현재 값과 상태를 포함하여 다양한 입력 타입에 대한 설명 텍스트를 생성합니다)
	 * @example
	 * // Generate text for a text input (텍스트 입력에 대한 텍스트 생성)
	 * const text = this.generateInputText(inputElement, 'ko');
	 */
	generateInputText(element, lang) {
		const type = element.type || 'text';
		const label = this.findLabelForElement(element);
		const value = element.value || '';
		const placeholder = element.placeholder || '';
		
		let text = '';
		
		if (label) {
			text += label + ' ';
		}
		
		// 입력 타입별 처리
		switch (type) {
			case 'text':
			case 'email':
			case 'password':
			case 'search':
			case 'url':
				if (value) {
					text += value;
				} else if (placeholder) {
					text += placeholder;
				}
				//text += ' ' + this.plugin.getLocalizedText('tts.input.types.textFieldSuffix');
				break;
			case 'checkbox':
				text += element.checked ? this.plugin.getLocalizedText('tts.input.states.checked') : this.plugin.getLocalizedText('tts.input.states.unchecked');
				//text += ' ' + this.plugin.getLocalizedText('tts.input.types.checkboxSuffix');
				break;
			case 'radio':
				text += element.checked ? this.plugin.getLocalizedText('tts.input.states.selected') : this.plugin.getLocalizedText('tts.input.states.unselected');
				//text += ' ' + this.plugin.getLocalizedText('tts.input.types.radioSuffix');
				break;
			case 'button':
			case 'submit':
			case 'reset':
				text += value || element.textContent || this.plugin.getLocalizedText('tts.input.types.button');
				//text += ' ' + this.plugin.getLocalizedText('tts.input.types.buttonSuffix');
				break;
			default:
				if (value) {
					text += value;
				}
				//text += ' ' + type + ' ' + this.plugin.getLocalizedText('tts.input.types.fieldSuffix');
				break;
		}
		
		return text.trim();
	}

	/**
	 * Generates TTS text for textarea elements (textarea 요소에 대한 TTS 텍스트를 생성합니다)
	 * @param {HTMLTextAreaElement} element - Textarea element (textarea 요소)
	 * @param {string} lang - Language code (언어 코드)
	 * @returns {string} Generated textarea text description (생성된 textarea 텍스트 설명)
	 * @description Creates descriptive text for textarea including labels, values, and placeholders
	 *              (라벨, 값, 플레이스홀더를 포함하여 textarea에 대한 설명 텍스트를 생성합니다)
	 * @example
	 * // Generate text for a textarea (textarea에 대한 텍스트 생성)
	 * const text = this.generateTextareaText(textareaElement, 'ko');
	 */
	generateTextareaText(element, lang) {
		const label = this.findLabelForElement(element);
		const value = element.value || '';
		const placeholder = element.placeholder || '';
		
		let text = '';
		
		if (label) {
			text += label + ' ';
		}
		
		//text += this.plugin.getLocalizedText('tts.textarea.label') + ' ';
		
		if (value) {
			//text += this.plugin.getLocalizedText('tts.textarea.currentValue') + ' ' + value;
			text += value;
		} else if (placeholder) {
			//text += this.plugin.getLocalizedText('tts.textarea.placeholder') + ' ' + placeholder;
			text += placeholder;
		}
		
		return text.trim();
	}

	/**
	 * Generates TTS text for select elements (select 요소에 대한 TTS 텍스트를 생성합니다)
	 * @param {HTMLSelectElement} element - Select element (select 요소)
	 * @param {string} lang - Language code (언어 코드)
	 * @returns {string} Generated select text description (생성된 select 텍스트 설명)
	 * @description Creates descriptive text for select elements including labels and selected options
	 *              (라벨과 선택된 옵션을 포함하여 select 요소에 대한 설명 텍스트를 생성합니다)
	 * @example
	 * // Generate text for a select dropdown (select 드롭다운에 대한 텍스트 생성)
	 * const text = this.generateSelectText(selectElement, 'ko');
	 */
	generateSelectText(element, lang) {
		const label = this.findLabelForElement(element);
		const selectedOption = element.selectedOptions[0];
		
		let text = '';
		
		if (label) {
			text += label;
		}
		
		if (selectedOption) {
			if (label) text += ' ';
			text += selectedOption.textContent;
			//text += ' ' + this.plugin.getLocalizedText('tts.select.suffix'); // 콤보박스, 드롭다운 등
		} else {
			if (label) text += ' ';
			//text += this.plugin.getLocalizedText('tts.select.noSelection');
		}
		
		return text.trim();
	}

	/**
	 * Generates TTS text for link elements (링크 요소에 대한 TTS 텍스트를 생성합니다)
	 * @param {HTMLAnchorElement} element - Link element (링크 요소)
	 * @param {string} lang - Language code (언어 코드)
	 * @returns {string} Generated link text description (생성된 링크 텍스트 설명)
	 * @description Creates descriptive text for links including link text, titles, and new window indicators
	 *              (링크 텍스트, 제목, 새 창 표시기를 포함하여 링크에 대한 설명 텍스트를 생성합니다)
	 * @example
	 * // Generate text for a link (링크에 대한 텍스트 생성)
	 * const text = this.generateLinkText(linkElement, 'ko');
	 */
	generateLinkText(element, lang) {
		const linkText = element.textContent.trim() || element.href;
		const title = element.title || '';
		
		let text = linkText;
		
		if (title && title !== linkText) {
			text += ' ' + title;
		}
		
		// 새 창에서 열리는 링크인지 확인
		if (element.target === '_blank') {
			text += ' ' + this.plugin.getLocalizedText('tts.link.newWindow');
		}
		
		// 링크임을 나타내는 접미사 추가
		//text += ' ' + this.plugin.getLocalizedText('tts.link.suffix');
		
		return text.trim();
	}

	/**
	 * Generates TTS text for button elements (버튼 요소에 대한 TTS 텍스트를 생성합니다)
	 * @param {HTMLButtonElement} element - Button element (버튼 요소)
	 * @param {string} lang - Language code (언어 코드)
	 * @returns {string} Generated button text description (생성된 버튼 텍스트 설명)
	 * @description Creates descriptive text for buttons using aria-labels, text content, or titles
	 *              (aria-label, 텍스트 내용, 또는 제목을 사용하여 버튼에 대한 설명 텍스트를 생성합니다)
	 * @example
	 * // Generate text for a button (버튼에 대한 텍스트 생성)
	 * const text = this.generateButtonText(buttonElement, 'ko');
	 */
	generateButtonText(element, lang) {
		const buttonText = element.textContent.trim() || element.value || '';
		const title = element.title || '';
		const ariaLabel = element.getAttribute('aria-label') || '';
		
		let text = '';
		
		if (ariaLabel) {
			text = ariaLabel;
		} else if (buttonText) {
			text = buttonText;
		} else if (title) {
			text = title;
		} else {
			text = this.plugin.getLocalizedText('tts.button.unlabeled');
		}
		
		// 버튼임을 나타내는 접미사 추가 (레이블이 아닌 접미사로)
		if (text && text !== this.plugin.getLocalizedText('tts.button.unlabeled')) {
			//text += ' ' + this.plugin.getLocalizedText('tts.button.suffix');
		}
		
		return text.trim();
	}

	/**
	 * Generates TTS text for image elements (이미지 요소에 대한 TTS 텍스트를 생성합니다)
	 * @param {HTMLImageElement} element - Image element (이미지 요소)
	 * @param {string} lang - Language code (언어 코드)
	 * @returns {string} Generated image text description (생성된 이미지 텍스트 설명)
	 * @description Creates descriptive text for images using alt text, title, or default descriptions
	 *              (alt 텍스트, 제목, 또는 기본 설명을 사용하여 이미지에 대한 설명 텍스트를 생성합니다)
	 * @example
	 * // Generate text for an image (이미지에 대한 텍스트 생성)
	 * const text = this.generateImageText(imageElement, 'ko');
	 */
	generateImageText(element, lang) {
		const alt = element.alt || '';
		const title = element.title || '';
		const src = element.src || '';
		
		let text = this.plugin.getLocalizedText('tts.image.label') + ' ';
		
		if (alt) {
			text += alt;
		} else if (title) {
			text += title;
		} else {
			text += this.plugin.getLocalizedText('tts.image.noDescription');
		}
		
		return text.trim();
	}

	/**
	 * Generates TTS text for progress elements (progress 요소에 대한 TTS 텍스트를 생성합니다)
	 * @param {HTMLProgressElement} element - Progress element (progress 요소)
	 * @param {string} lang - Language code (언어 코드)
	 * @returns {string} Generated progress text description (생성된 progress 텍스트 설명)
	 * @description Creates descriptive text for progress bars including percentage completion
	 *              (완료 백분율을 포함하여 진행률 표시줄에 대한 설명 텍스트를 생성합니다)
	 * @example
	 * // Generate text for a progress bar (진행률 표시줄에 대한 텍스트 생성)
	 * const text = this.generateProgressText(progressElement, 'ko');
	 */
	generateProgressText(element, lang) {
		const value = element.value || 0;
		const max = element.max || 100;
		const percentage = Math.round((value / max) * 100);
		
		let text = this.plugin.getLocalizedText('tts.progress.label') + ' ';
		text += percentage + this.plugin.getLocalizedText('tts.progress.percent');
		
		return text.trim();
	}

	/**
	 * Generates TTS text for table elements (table 요소에 대한 TTS 텍스트를 생성합니다)
	 * @param {HTMLTableElement} element - Table element (table 요소)
	 * @param {string} lang - Language code (언어 코드)
	 * @returns {string} Generated table text description (생성된 table 텍스트 설명)
	 * @description Creates descriptive text for tables including captions and dimensions
	 *              (캡션과 크기를 포함하여 테이블에 대한 설명 텍스트를 생성합니다)
	 * @example
	 * // Generate text for a table (테이블에 대한 텍스트 생성)
	 * const text = this.generateTableText(tableElement, 'ko');
	 */
	generateTableText(element, lang) {
		const caption = element.querySelector('caption');
		const rows = element.querySelectorAll('tr').length;
		// 행이 0개인 빈 테이블에서 0으로 나눠 NaN이 발화되는 것을 방지
		const cols = rows > 0 ? element.querySelectorAll('th, td').length / rows : 0;

		let text = this.plugin.getLocalizedText('tts.table.label') + ' ';

		if (caption) {
			text += caption.textContent + ' ';
		}

		if (rows > 0) {
			text += this.plugin.getLocalizedText('tts.table.size', { rows: rows, cols: Math.round(cols) });
		}

		return text.trim();
	}

	/**
	 * Finds the label associated with a form element (폼 요소와 연관된 라벨을 찾습니다)
	 * @param {HTMLElement} element - Form element to find label for (라벨을 찾을 폼 요소)
	 * @returns {string} Label text or empty string if not found (라벨 텍스트 또는 찾을 수 없으면 빈 문자열)
	 * @description Searches for labels using various methods: for attribute, parent label, aria-label, aria-labelledby, title
	 *              (다양한 방법으로 라벨을 검색: for 속성, 부모 라벨, aria-label, aria-labelledby, title)
	 * @example
	 * // Find label for an input element (입력 요소의 라벨 찾기)
	 * const label = this.findLabelForElement(inputElement);
	 */
	findLabelForElement(element) {
		// 1. label[for] 속성으로 연결된 경우 — 호스트 페이지 id에 특수문자가 있어도 안전하도록 이스케이프
		if (element.id) {
			try {
				const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(element.id) : element.id;
				const label = document.querySelector(`label[for="${escapedId}"]`);
				if (label) {
					return label.textContent.trim();
				}
			} catch (e) {
				// 셀렉터 오류 시 다음 탐색 방법으로 진행
			}
		}
		
		// 2. label로 감싸진 경우
		const parentLabel = element.closest('label');
		if (parentLabel) {
			return parentLabel.textContent.replace(element.textContent, '').trim();
		}
		
		// 3. aria-label 또는 aria-labelledby
		const ariaLabel = element.getAttribute('aria-label');
		if (ariaLabel) {
			return ariaLabel;
		}
		
		const ariaLabelledBy = element.getAttribute('aria-labelledby');
		if (ariaLabelledBy) {
			// aria-labelledby는 공백으로 구분된 여러 ID를 가질 수 있음
			const labelText = ariaLabelledBy.split(/\s+/)
				.map(id => {
					const labelElement = document.getElementById(id);
					return labelElement ? labelElement.textContent.trim() : '';
				})
				.filter(Boolean)
				.join(' ');
			if (labelText) {
				return labelText;
			}
		}
		
		// 4. title 속성
		const title = element.getAttribute('title');
		if (title) {
			return title;
		}
		
		return '';
	}
}
