/**
 * @fileoverview PanelBuilder - 설정 패널 UI 항목 생성 담당
 * @module src/wat/PanelBuilder
 * @description WAT.js에서 추출된 패널 생성 클러스터 (Phase 6-6).
 *              개인 옵션 18종은 개별 createXXXSettings 함수 대신
 *              OPTION_DEFS 데이터 테이블 + buildOption 팩토리로 생성한다.
 *              메서드명의 snake_case 지역 변수는 추출 과정에서 정규화됨.
 */
import { Constants, FONT_FAMILY_OPTIONS } from '../core/constants.js';
import { Defaults } from '../core/defaults.js';
import { escapeHTML } from '../core/escapeHTML.js';

/**
 * 개인 옵션 로케일 키 헬퍼 — panel.personal.options.<group>.options.<key>
 * @param {string} group - 로케일 그룹명 (옵션명과 다를 수 있음: colorTheme→colorMode 등)
 * @param {string} key - 옵션 값 키
 * @returns {string} 로케일 키
 */
const optionLocaleKey = (group, key) => `panel.personal.options.${group}.options.${key}`;

/**
 * 개인 옵션 18종 정의 테이블.
 * - type: createSettingsItem에 전달되는 입력 타입 (radio | checkbox | button)
 * - group: 로케일 그룹명 (생략 시 옵션명과 동일)
 * - items: 정적 옵션 목록. labelKey 생략 시 value를 로케일 키로 사용,
 *          toggleKey가 있으면 label_toggle(상태 반전 라벨)을 생성
 * - ratios: true면 플러그인의 <name>Ratios/<name>Options 설정 기반 동적 목록
 *   (ratio가 false인 키 제외, 커스텀 label/checked/disabled 지원, initial 기본 선택)
 * fontFamily는 FONT_FAMILY_OPTIONS 병합·웹폰트 로드가 필요해 별도 빌더를 사용한다.
 */
const OPTION_DEFS = {
	fontSize: { type: 'radio', ratios: true },
	fontFamily: { type: 'radio', fontFamily: true },
	screenScale: { type: 'radio', items: [
		{ value: 'initial' }, { value: 'scale-1p2x' }, { value: 'scale-1p5x' }, { value: 'scale-2x' }
	] },
	txtAlign: { type: 'radio', items: [
		{ value: 'initial' }, { value: 'left' }, { value: 'center' }, { value: 'right' }
	] },
	letterSpacing: { type: 'radio', ratios: true },
	lineHeight: { type: 'radio', ratios: true },
	colorTheme: { type: 'radio', group: 'colorMode', items: [
		{ value: 'initial' }, { value: 'light' }, { value: 'dark', disabled: true }, { value: 'reverse' }
	] },
	saturation: { type: 'radio', items: [
		{ value: 'initial' }, { value: 'low' }, { value: 'high' }, { value: 'monochrome' }
	] },
	readGuide: { type: 'radio', items: [
		{ value: 'unset' }, { value: 'mask' }, { value: 'underline' }, { value: 'bigCursor' }
	] },
	imgDisplayMode: { type: 'radio', items: [
		{ value: 'initial' }, { value: 'hide' }, { value: 'convert' }
	] },
	mediaStop: { type: 'checkbox', group: 'mediaControl', items: [
		{ value: 'stop', toggleKey: 'play' }
	] },
	mediaMute: { type: 'checkbox', group: 'soundControl', items: [
		{ value: 'mute', toggleKey: 'unmute' }
	] },
	stopAni: { type: 'checkbox', group: 'animationControl', items: [
		{ value: 'stop', toggleKey: 'play' }
	] },
	pageScroll: { type: 'button', items: [
		{ value: 'toggle', labelKey: 'start', toggleKey: 'stop', addClass: 'btn_iconSet btn_toggle' },
		{ value: 'up', addClass: 'btn_iconSet btn_up' },
		{ value: 'down', addClass: 'btn_iconSet btn_down' }
	] },
	tts: { type: 'button', items: [
		{ value: 'toggle', labelKey: 'start', toggleKey: 'stop', addClass: 'btn_iconSet btn_toggle' },
		{ value: 'prev', disabled: true, addClass: 'btn_iconSet btn_prev' },
		{ value: 'next', disabled: true, addClass: 'btn_iconSet btn_next' },
		{ value: 'focus_toggle', labelKey: 'focus-start', addClass: 'btn_iconSet btn_toggle btn_focus' }
	] },
	stt: { type: 'button', items: [
		{ value: 'start' }
	] },
	diction: { type: 'checkbox', items: [
		{ value: 'on', toggleKey: 'off' }
	] },
	pageStructure: { type: 'button', items: [
		{ value: 'show', toggleKey: 'hide' }
	] }
};

export class PanelBuilder {
	/**
	 * @param {Object} plugin - WAT 인스턴스 (로케일·요소 생성·설정 저장 등 서비스 제공자)
	 */
	constructor(plugin) {
		this.plugin = plugin;
	}

	/**
	 * 개인 옵션명으로 설정 항목 요소를 생성합니다 (OPTION_DEFS 테이블 기반)
	 * @param {string} optionName - 옵션명 ('fontSize', 'colorTheme' 등)
	 * @returns {HTMLLIElement} 설정 항목 리스트 요소
	 */
	buildOption(optionName) {
		const def = OPTION_DEFS[optionName];
		if (!def) {
			throw new Error(`[WAT] Unknown personal option: ${optionName}`);
		}
		const group = def.group || optionName;
		const title = this.plugin.getLocalizedText(`panel.personal.options.${group}.title`);

		let optionItems;
		if (def.ratios) {
			optionItems = this._buildRatioItems(optionName);
		} else if (def.fontFamily) {
			optionItems = this._buildFontFamilyItems();
		} else {
			optionItems = def.items.map(item => {
				const built = {
					value: item.value,
					label: this.plugin.getLocalizedText(optionLocaleKey(group, item.labelKey || item.value))
				};
				if (item.toggleKey) built.label_toggle = this.plugin.getLocalizedText(optionLocaleKey(group, item.toggleKey));
				if (item.disabled) built.disabled = true;
				if (item.addClass) built.addClass = item.addClass;
				return built;
			});
		}

		return this.createSettingsItem(def.type, title, optionName, optionItems);
	}

	/**
	 * 비율 설정 기반 옵션 목록 생성 (fontSize/letterSpacing/lineHeight 공통)
	 * @private
	 * @param {string} optionName - 옵션명
	 * @returns {Array<Object>} 옵션 목록
	 */
	_buildRatioItems(optionName) {
		const plugin = this.plugin;
		const ratios = plugin[`${optionName}Ratios`];
		const customOptions = plugin.options[`${optionName}Options`];
		const generateLabel = plugin[`generate${optionName.charAt(0).toUpperCase()}${optionName.slice(1)}Label`].bind(plugin);
		const optionItems = [];

		for (const [key, ratio] of Object.entries(ratios)) {
			if (ratio === false) continue;

			const customConfig = customOptions?.[key];
			let label = plugin.getLocalizedText(optionLocaleKey(optionName, key));
			let checked = false;
			let disabled = false;

			if (typeof customConfig === 'object') {
				label = customConfig.label || label || generateLabel(key, ratio);
				checked = customConfig.checked === true;
				disabled = customConfig.disabled === true;
			} else {
				label = label || generateLabel(key, ratio);
			}

			optionItems.push({
				value: key,
				label,
				checked: key === 'initial' ? true : checked,
				disabled
			});
		}

		return optionItems;
	}

	/**
	 * 폰트 패밀리 옵션 목록 생성 — 기본 FONT_FAMILY_OPTIONS와 사용자 옵션 병합,
	 * URL이 있는 웹폰트는 동적 로드
	 * @private
	 * @returns {Array<Object>} 옵션 목록
	 */
	_buildFontFamilyItems() {
		const plugin = this.plugin;
		const mergedFontOptions = {
			...FONT_FAMILY_OPTIONS,
			...plugin.options.fontFamily
		};
		const optionItems = [];

		for (const [fontName, fontConfig] of Object.entries(mergedFontOptions)) {
			// 명시적으로 비활성화(false)된 폰트만 제외 — enabled 생략은 활성으로 취급
			if (fontConfig === false || (typeof fontConfig === 'object' && fontConfig.enabled === false)) continue;

			// 웹폰트 URL이 있는 경우 동적으로 로드
			if (typeof fontConfig === 'object' && fontConfig.url) {
				plugin.loadWebFont(fontConfig.url);
			}

			optionItems.push({
				value: fontName,
				label: plugin.getLocalizedText(optionLocaleKey('fontFamily', fontName)) || fontConfig.label || fontName,
				// enabled(표시 여부)와 checked(선택 여부)는 별개 — 기본 선택은 'initial'만
				checked: fontName === 'initial'
			});
		}

		return optionItems;
	}

	/**
	 * 지정된 타입과 옵션으로 일반적인 설정 항목을 생성합니다
	 * @param {string} itemType - 입력 요소의 타입 ('radio', 'checkbox', 'button' 등)
	 * @param {string} titleText - 설정 항목의 제목 텍스트
	 * @param {string} optionName - 폼 요소의 name 속성
	 * @param {Array<Object>} optionItems - 옵션 설정 배열
	 * @returns {HTMLLIElement} 설정 UI가 포함된 리스트 아이템 요소
	 */
	createSettingsItem(itemType, titleText, optionName, optionItems) {
		const plugin = this.plugin;
		// config/로케일 유래 값이 innerHTML 템플릿에 삽입되므로 전부 이스케이프 (XSS 방지)
		titleText = escapeHTML(titleText);
		const itemsHtml = optionItems.map(item => {
			const elementId = escapeHTML(`${optionName}_${item.value}`);
			const itemLabel = escapeHTML(item.label);
			const toggleLabel = escapeHTML(item.label_toggle || '');
			const additionalClass = escapeHTML(item.addClass || '');
			const checkedAttr = item.checked ? 'checked' : '';
			const selectedClass = item.selected ? Constants.CSS_CLASSES.SELECTED : '';
			const disabledAttr = item.disabled ? 'disabled' : '';
			const itemStyle = escapeHTML(item.style || '');
			const itemValue = escapeHTML(item.value);
			const itemSrc = escapeHTML(item.src || '');
			const labelTitleAttr = itemLabel ? ` title="${itemLabel}"` : '';
			let htmlString = `
				<li class='opt_item wat-item-li'>
					<input type="${itemType}" class="wat-items wat-item-type-radio" id="wat-${itemType}-${elementId}" name="${optionName}" title="${titleText} ${itemLabel}" value="${itemValue}" ${checkedAttr} ${disabledAttr}><label for="wat-${itemType}-${elementId}"${labelTitleAttr}>${itemLabel}</label>
				</li>
				`;
			if (itemType === 'select') {
				htmlString = `
					<li class='opt_item'>
						<option class="wat-items wat-item-type-option" value="${itemValue}" ${selectedClass} ${disabledAttr}>${itemLabel}</option>
					</li>
					`;
			} else if (itemType === 'button') {
				let toggleAttr = '';
				if (toggleLabel) {
					toggleAttr = `data-stateText-on="${itemLabel}" data-stateText-off="${toggleLabel}"`;
				}
				htmlString = `
					<li class='opt_item' style="${itemStyle}">
						<button type="button" class="wat-items wat-item-type-button btn_basic ${additionalClass}" id="wat-${itemType}-${elementId}" name="${optionName}" value="${itemValue}" ${disabledAttr} ${toggleAttr} title="${titleText} ${itemLabel}">${itemLabel}</button>
					</li>
					`;
			} else if (itemType === 'buttonMix') {
				htmlString = `
					<li class='opt_item'>
						<button type="button" class="wat-items wat-item-type-button" id="wat-${itemType}-${elementId}" name="${optionName}" value="${itemValue}" ${disabledAttr}>${itemLabel}</button>
					</li>
					`;
			} else if (itemType === 'buttonImg') {
				htmlString = `
					<li class='opt_item'>
						<button type="button" class="wat-items wat-item-type-button btn_buttonImg ${additionalClass}" id="wat-${itemType}-${elementId}" name="${optionName}" value="${itemValue}" ${disabledAttr}><img src="${itemSrc}" alt="${itemLabel}"></button>
					</li>
					`;
			} else if (itemType === 'buttonImgSVG') {
				htmlString = `
					<li class='opt_item'>
						<button type="button" class="wat-items wat-item-type-button btn_buttonImgSVG ${additionalClass}" id="wat-${itemType}-${elementId}" name="${optionName}" value="${itemValue}" ${disabledAttr} title="${titleText} ${itemLabel}"><span class="icon-svg"></span></button>
					</li>
					`;
			} else if (itemType === 'checkbox') {
				htmlString = `
					<li class='opt_item'>
						<input type="${itemType}" class="wat-items wat-item-type-checkbox switch" id="wat-${itemType}-${optionName}" name="${optionName}" value="${itemValue}" title="${titleText} ${itemLabel}" role="switch" aria-checked="${item.checked ? 'true' : 'false'}" ${checkedAttr} ${disabledAttr}><label for="wat-${itemType}-${optionName}" class="switch-label">${itemLabel}</label>
						<span class="switch-state" data-stateText-on="${itemLabel}" data-stateText-off="${toggleLabel}">${itemLabel}</span>
					</li>
					`;
			}
			return htmlString;
		}).join('');
		const listItemElement = document.createElement('li');
		// .setTitle은 클릭 시 옵션을 순환/토글하는 버튼이므로 키보드 포커스 가능하게 tabindex 부여 (WCAG 2.1.1)
		let listItemInnerHTML = `
			<div class='setWrap'>
				<div class='setTitle' role='button' tabindex='0'>${titleText}</div>
				<div class='setCont'>
				`;
				if (itemType === 'radio') {
					listItemInnerHTML += `<button class='hidden btn_chgOpt prev' type='button' title="${titleText} ${plugin.getLocalizedText('tags.button.text.prevOpt')}" aria-label="${titleText} ${plugin.getLocalizedText('tags.button.text.prevOpt')}">${plugin.getLocalizedText('tags.button.text.prevOpt')}</button>`;
				}
				// 라디오 묶음에 그룹 시맨틱 부여 — 스크린리더가 그룹명·위치를 안내 (WCAG 1.3.1)
				const listGroupAttr = itemType === 'radio' ? ` role="radiogroup" aria-label="${titleText}"` : '';
				listItemInnerHTML += `<ul class='opt_lists'${listGroupAttr}>${itemsHtml}</ul>`;
				if (itemType === 'radio') {
					listItemInnerHTML += `<button class='hidden btn_chgOpt next' type='button' title="${titleText} ${plugin.getLocalizedText('tags.button.text.nextOpt')}" aria-label="${titleText} ${plugin.getLocalizedText('tags.button.text.nextOpt')}">${plugin.getLocalizedText('tags.button.text.nextOpt')}</button>`;
				}
				listItemInnerHTML += `</div>
			</div>
			`;
		listItemElement.innerHTML = listItemInnerHTML;

		// .setTitle 클릭 시 라디오 버튼 순차 선택 및 change 이벤트 트리거
		const setWrapElement = listItemElement.querySelector('.setWrap');
		const titleElement = setWrapElement.querySelector('.setTitle');
		const labelElement = setWrapElement.querySelector('.switch-label');

		// role="button"인 .setTitle을 키보드로도 활성화 (Enter/Space → 클릭) (WCAG 2.1.1)
		titleElement.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				titleElement.click();
			}
		});

		// 라디오 순환 선택 공통 처리 (제목 클릭/이전·다음 버튼)
		const cycleRadio = (direction) => {
			const radioElements = setWrapElement.querySelectorAll('.setCont input[type="radio"]');
			const targetIndex = plugin.getRadioTargetIndex(setWrapElement, direction);
			if (radioElements[targetIndex]) {
				radioElements[targetIndex].checked = true;
				// change 이벤트를 수동으로 트리거
				radioElements[targetIndex].dispatchEvent(new Event('change', { bubbles: true }));
			}
		};

		if (itemType === 'radio') {
			setWrapElement.classList.add('radio');
			titleElement.addEventListener('click', () => cycleRadio('next'));
			setWrapElement.querySelector('.btn_chgOpt.prev').addEventListener('click', () => cycleRadio('prev'));
			setWrapElement.querySelector('.btn_chgOpt.next').addEventListener('click', () => cycleRadio('next'));
		} else if (itemType === 'checkbox') {
			setWrapElement.classList.add('checkbox');
			const toggleCheckbox = () => {
				const checkboxElement = setWrapElement.querySelector('.setCont input[type="checkbox"]');
				checkboxElement.checked = !checkboxElement.checked;
				// change 이벤트를 수동으로 트리거
				checkboxElement.dispatchEvent(new Event('change', { bubbles: true }));
			};
			titleElement.addEventListener('click', toggleCheckbox);
			labelElement.addEventListener('click', toggleCheckbox);
		} else if (itemType === 'button') {
			setWrapElement.classList.add('button');
			titleElement.addEventListener('click', () => {
				const buttonElements = setWrapElement.querySelectorAll('.setCont button');
				const inputElements = setWrapElement.querySelectorAll('.setCont input[type="button"], .setCont input[type="image"], .setCont input[type="submit"]');

				// 첫 번째 button이 있으면 선택, 없으면 input[type="button" | "image" | "submit"] 중 첫 번째 요소 선택
				let targetButtonElement = buttonElements.length > 0 ? buttonElements[0] : (inputElements.length > 0 ? inputElements[0] : null);
				if (targetButtonElement.disabled || targetButtonElement.classList.contains('disabled') || targetButtonElement.style.display === 'none') {
					targetButtonElement = buttonElements.length > 1 ? buttonElements[1] : (inputElements.length > 1 ? inputElements[1] : null);
				}
				if (targetButtonElement) targetButtonElement.click();
			});
		} else if (itemType === 'buttonMix') {
			setWrapElement.classList.add('button', 'mixCont');
			titleElement.addEventListener('click', () => {
				const buttonElements = setWrapElement.querySelectorAll('.setCont button');
				const inputElements = setWrapElement.querySelectorAll('.setCont input[type="button"], .setCont input[type="image"], .setCont input[type="submit"]');

				// 첫 번째 button이 있으면 선택, 없으면 input[type="button" | "image" | "submit"] 중 첫 번째 요소 선택
				const targetButtonElement = buttonElements.length > 0 ? buttonElements[0] : (inputElements.length > 0 ? inputElements[0] : null);
				targetButtonElement.click();
			});
		}

		return listItemElement;
	}

	/**
	 * 설정 패널에 프로필 설정 섹션을 생성합니다
	 * @param {HTMLElement} container - 프로필 설정을 추가할 컨테이너 요소
	 * @returns {void}
	 * @description 각 접근성 프로필에 대한 토글과 개별 설정 옵션이 있는 프로필 선택 UI를 생성합니다
	 */
	createProfileSettings(container) {
		const plugin = this.plugin;
		const profileSettingTitleElement = plugin.createElementWithAttrs('h4', { class: 'watSet-group-title' });
		profileSettingTitleElement.textContent = plugin.getLocalizedText('panel.settings.profile.title');
		container.appendChild(profileSettingTitleElement);

		// ************************* Profile Lists .Start *************************
		const profileValues = Defaults.PROFILES;
		const profileContainerElement = plugin.createElementWithAttrs('div', { id: 'watSetWrap_profile', class: ['watSet-item-container', 'profile-container'] });
		const profileListElement = plugin.createElementWithAttrs('ul', { class: 'profileLists' });

		for (const profile in profileValues) {
			const profileItemElement = plugin.createElementWithAttrs('li', { class: 'profileItem' });
			const profileItemContainerElement = plugin.createElementWithAttrs('fieldset', { class: 'watSet-profile-item-container', 'data-profile': profile });
			const profileItemTitleElement = plugin.createElementWithAttrs('legend', { class: ['watSet-profile-title', 'profileItemTitle'] });
			const profileItemTitleLabelElement = plugin.createElementWithAttrs('label', { id: `watSet_profile_title_label_${profile}`, class: ['watSet-label', 'watSet-profile-title-label', `${profile}`], for: `watSet_profile_button_toggle_${profile}` });
			const profileTitleText = plugin.getLocalizedText(`panel.settings.profile.options.${profile}.title`);
			profileItemTitleLabelElement.textContent = profileTitleText;
			profileItemTitleElement.appendChild(profileItemTitleLabelElement);

			// ***** Button - Profile Options .Start *****
			// 옵션 열기/닫기는 disclosure 패턴 — aria-expanded + aria-controls,
			// 접근명은 "프로필명 + 옵션 열기"가 되도록 제목 라벨을 함께 참조
			const profileOptionsToggleButtonElement = plugin.createElementWithAttrs('button', { class: ['watSet-button', 'watSet-profile-button-accordion', 'btnType_1'], 'aria-expanded': 'false', 'aria-controls': `watSet_profile_items_wrap_${profile}`, title: `${profileTitleText} ${plugin.getLocalizedText('tags.button.attr.type.option')}`, 'aria-labelledby': `watSet_profile_title_label_${profile} watSet_profile_Opts_Label_${profile}` });
			const profileOptionsToggleLabelElement = plugin.createElementWithAttrs('span', { id: `watSet_profile_Opts_Label_${profile}`, class: 'watSet-button-label' });
			profileOptionsToggleLabelElement.textContent = plugin.getLocalizedText('tags.button.text.optionsOpen');
			profileOptionsToggleButtonElement.appendChild(profileOptionsToggleLabelElement);
			profileOptionsToggleButtonElement.addEventListener('click', (evt) => {
				const targetToggleElement = evt.target.closest('.watSet-profile-button-accordion');
				const profile = targetToggleElement.closest('.watSet-profile-item-container').getAttribute('data-profile');
				const isOn = targetToggleElement.getAttribute('aria-expanded') === 'true';
				const targetLabelElement = targetToggleElement.querySelector('.watSet-button-label');
				targetLabelElement.textContent = isOn ? plugin.getLocalizedText('tags.button.text.optionsOpen') : plugin.getLocalizedText('tags.button.text.optionsClose');
				targetToggleElement.setAttribute('aria-expanded', isOn ? 'false' : 'true');
				const profileInner = document.getElementById(`watSet_profile_items_wrap_${profile}`);
				if (isOn) {
					profileInner.classList.remove(Constants.CSS_CLASSES.ACTIVE);
					profileInner.setAttribute('aria-hidden', 'true');
					plugin._setTimeout(() => {
						targetToggleElement.closest('.watSet-profile-item-container').querySelector('.watSet-profile-button-accordion').focus();
					}, 100);
				} else {
					profileInner.classList.add(Constants.CSS_CLASSES.ACTIVE);
					profileInner.setAttribute('aria-hidden', 'false');
					plugin._setTimeout(() => {
						const focusableElements = profileInner.querySelectorAll('a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])');
						if (focusableElements.length > 0) {
							focusableElements[0].focus();
						} else {
							console.error('No focusable elements found inside profileInner');
						}
					}, 100);
				}
				targetToggleElement.classList.toggle(Constants.CSS_CLASSES.ACTIVE, !isOn);
			});
			profileItemTitleElement.appendChild(profileOptionsToggleButtonElement);
			// ***** Button - Profile Options .End   *****

			profileItemContainerElement.appendChild(profileItemTitleElement);

			// ***** Button - Profile Toggle Switch .Start *****
			// switch 역할의 상태는 aria-checked로 전달하고, 접근명은 프로필 제목 라벨을 참조
			// (상태 라벨 "꺼짐/켜짐"을 이름으로 쓰면 모든 토글의 접근명이 동일해진다)
			const profileToggle = plugin.createElementWithAttrs('button', {
				id: `watSet_profile_button_toggle_${profile}`,
				class: ['watSet-button', 'btn-toggleSwitch', 'profileToggle'],
				role: 'switch',
				'aria-checked': 'false',
				'data-profile': profile,
				title: `${profileTitleText} ${plugin.getLocalizedText('tags.button.attr.type.toggle')}`,
				'aria-labelledby': `watSet_profile_title_label_${profile}`
			});
			const profileToggleLabel = plugin.createElementWithAttrs('span', {
				id: `watSet_profileToggleLabel_${profile}`,
				class: 'watSet-button-label'
			});
			profileToggleLabel.textContent = plugin.getLocalizedText('tags.button.text.stateOff');
			profileToggle.appendChild(profileToggleLabel);
			profileToggle.addEventListener('click', (evt) => {
				const targetToggle = evt.target.closest('.profileToggle');
				const profile = targetToggle.getAttribute('data-profile');
				plugin.toggleProfile(profile, targetToggle);
			});
			// 토글은 제목바(legend) 안에 배치 — fieldset 직속 절대배치는 legend 아래 익명 콘텐츠
			// 박스를 기준으로 잡혀 제목바 밖(overflow:hidden 영역)으로 밀려 잘리기 때문 (CSS와 짝)
			profileItemTitleElement.appendChild(profileToggle);
			// ***** Button - Profile Toggle Switch .End   *****

			// ***** Container - Profile Options .Start *****
			const profileInner = plugin.createElementWithAttrs('div', { id: `watSet_profile_items_wrap_${profile}`, class: 'watSet-profile-items-wrap' });
			const profileListInner = plugin.createElementWithAttrs('ul', { class: 'watSet-profile-items-ul' });

			const profileItems = profileValues[profile].settings;
			for (const item in profileItems) {
				if (plugin.options[item] === false) continue;

				const profileListItem = plugin.createElementWithAttrs('li', { class: 'watSet-profile-item-li' });
				const input = plugin.createElementWithAttrs('input', { type: 'checkbox', class: ['watSet-checkbox', 'profileListItemInput'], id: `watSet_checkbox_${profile}_${item}`, name: `${profile}_${item}`, value: profileItems[item], 'data-key': item });
				input.checked = profileValues[profile].enabled[item];
				const label = plugin.createElementWithAttrs('label', { class: ['watSet_label', 'watSet-profile-item-label'], for: `watSet_checkbox_${profile}_${item}` });
				label.textContent = plugin.getLocalizedText(`panel.personal.options.${item}.title`);
				profileListItem.appendChild(input);
				profileListItem.appendChild(label);
				profileListInner.appendChild(profileListItem);
			}
			profileInner.appendChild(profileListInner);
			profileItemContainerElement.appendChild(profileInner);
			// ***** Container - Profile Options .End   *****

			profileItemElement.appendChild(profileItemContainerElement);
			profileListElement.appendChild(profileItemElement);
		}
		profileContainerElement.appendChild(profileListElement);
		container.appendChild(profileContainerElement);
		// ************************* Profile Lists .End   *************************
	}

	/**
	 * 위치, 뷰 모드, 언어, 저장 옵션을 포함한 도구 설정 섹션을 생성합니다
	 * @param {HTMLElement} container - 도구 설정을 추가할 컨테이너 요소
	 * @returns {void}
	 */
	createToolsSettings(container) {
		const plugin = this.plugin;
		const manageSettingTitle = plugin.createElementWithAttrs('h4', { class: 'watSet-group-title' });
		manageSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.title');
		container.appendChild(manageSettingTitle);

		// ************************* Tool Position Setting .Start *************************
		const toolPositionContainer = plugin.createElementWithAttrs('fieldset', { id: 'watSetWrap_position', class: ['watSet-item-container', 'tool-position-container'] });

		const toolPositionSettingTitle = plugin.createElementWithAttrs('legend', { class: 'watSet-title' });
		toolPositionSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.options.position.title');
		toolPositionContainer.appendChild(toolPositionSettingTitle);

		const toolPositionInner = plugin.createElementWithAttrs('div', { class: 'watSet-inner' });
		const toolPositionList = plugin.createElementWithAttrs('ul', { class: 'watSet-list' });
		const toolPositionItems = [
			{ id: 'watSet_postion_left', label: plugin.getLocalizedText('panel.settings.manage.options.position.options.left'), value: 'left', checked: false },
			{ id: 'watSet_postion_right', label: plugin.getLocalizedText('panel.settings.manage.options.position.options.right'), value: 'right', checked: true }
		];
		toolPositionItems.forEach(item => {
			const toolPositionItem = plugin.createElementWithAttrs('li', { class: 'watSet-item' });
			const input = plugin.createElementWithAttrs('input', { type: 'radio', id: item.id, class: ['wat-set-items', 'wat-set-item-type-radio'], name: 'toolPosition', value: item.value });
			input.checked = item.checked;
			input.onchange = () => {
				document.documentElement.dataset['watPosition'] = item.value;
				plugin.savePreferences();
			};
			const label = plugin.createElementWithAttrs('label', { for: item.id, class: 'wat-set-label' });
			label.textContent = item.label;
			toolPositionItem.appendChild(input);
			toolPositionItem.appendChild(label);
			toolPositionList.appendChild(toolPositionItem);
		});
		toolPositionInner.appendChild(toolPositionList);
		toolPositionContainer.appendChild(toolPositionInner);

		container.appendChild(toolPositionContainer);
		// ************************* Tool Position Setting .End   *************************

		// ************************* View Mode Setting .Start *************************
		const viewModeContainer = plugin.createElementWithAttrs('fieldset', { id: 'watSetWrap_viewMode', class: ['watSet-item-container', 'tool-viewMode-container'] });

		const viewModeSettingTitle = plugin.createElementWithAttrs('legend', { class: 'watSet-title' });
		viewModeSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.options.viewMode.title');
		viewModeContainer.appendChild(viewModeSettingTitle);

		const viewModeSettingInner = plugin.createElementWithAttrs('div', { class: 'watSet-inner' });
		const viewModeSettingList = plugin.createElementWithAttrs('ul', { class: 'watSet-list' });
		const viewModeSettingItems = [
			{ id: 'watSet_viewMode_icon', label: plugin.getLocalizedText('panel.settings.manage.options.viewMode.iconMode.title'), setMode: 'icon', checked: true },
			{ id: 'watSet_viewMode_list', label: plugin.getLocalizedText('panel.settings.manage.options.viewMode.listMode.title'), setMode: 'list', checked: false }
		];
		const storedSettings = localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS);
		let viewModeStoredValue = null;
		if (storedSettings) {
			try {
				const settings = JSON.parse(storedSettings);
				if (settings.viewMode) {
					viewModeStoredValue = settings.viewMode.toLowerCase();
				}
			} catch (e) {
				// JSON 파싱 에러 처리
				viewModeStoredValue = null;
			}
		}
		// "icon"과 "list" 외의 값은 무시
		if (viewModeStoredValue !== 'icon' && viewModeStoredValue !== 'list') {
			viewModeStoredValue = null;
		}
		viewModeSettingItems.forEach(item => {
			const viewModeSettingItem = plugin.createElementWithAttrs('li', { class: 'watSet-item' });
			const input = plugin.createElementWithAttrs('input', { type: 'radio', id: item.id, class: ['wat-set-items', 'wat-set-item-type-radio'], name: 'viewMode', value: item.setMode });
			input.checked = viewModeStoredValue ? (item.setMode === viewModeStoredValue) : item.checked;
			input.onchange = () => {
				plugin.updateViewMode(item.setMode);
			};
			const label = plugin.createElementWithAttrs('label', { for: item.id, class: 'wat-set-label' });
			label.textContent = item.label;
			viewModeSettingItem.appendChild(input);
			viewModeSettingItem.appendChild(label);
			viewModeSettingList.appendChild(viewModeSettingItem);
		});
		viewModeSettingInner.appendChild(viewModeSettingList);
		viewModeContainer.appendChild(viewModeSettingInner);

		container.appendChild(viewModeContainer);
		// ************************* View Mode Setting .End   *************************

		// ************************* Language Setting .Start *************************
		if (plugin.languageOptions && plugin.languageOptions.length > 1 && plugin.languageConfig?.showSelector !== false) {
			const languageContainer = plugin.createElementWithAttrs('fieldset', { id: 'watSetWrap_language', class: ['watSet-item-container', 'tool-language-container'] });

			const languageSettingTitle = plugin.createElementWithAttrs('legend', { class: 'watSet-title' });
			languageSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.options.language.title');
			languageContainer.appendChild(languageSettingTitle);

			const languageSettingInner = plugin.createElementWithAttrs('div', { class: 'watSet-inner' });
			const languageSettingList = plugin.createElementWithAttrs('ul', { class: 'watSet-list' });
			const languageSettingItems = plugin.languageOptions.map(lang => {
				return { id: `watSet_language_${lang}`, label: plugin.getLocalizedText(`panel.settings.manage.options.language.options.${lang}`), lang: lang, checked: plugin.language === lang };
			});
			languageSettingItems.forEach(item => {
				const languageSettingItem = plugin.createElementWithAttrs('li', { class: 'watSet-item' });
				const input = plugin.createElementWithAttrs('input', { type: 'radio', id: item.id, class: ['wat-set-items', 'wat-set-item-type-radio'], name: 'watSet_language', value: item.lang });
				input.checked = item.checked;
				input.onchange = () => {
					plugin.language = item.lang;
					document.documentElement.dataset['watLanguage'] = item.lang;
					// 스크린리더가 올바른 언어 엔진으로 UI를 읽도록 문서 lang 갱신 (WCAG 3.1.2)
					document.documentElement.setAttribute('lang', item.lang);
					plugin.updateLanguageSetting();

					plugin.loadLocale(item.lang).then(() => {
						plugin.generateHTMLElements();
						plugin.setInitialPreferences();

						plugin.setupTabs();
						plugin.activateInitialTab();
						plugin.setEventListeners();
						plugin.extractFocusableElements(document.body);
						plugin.updateTextLocalization();
						plugin.savePreferences();
					});
				};
				const label = plugin.createElementWithAttrs('label', { for: item.id, class: 'wat-set-label' });
				label.textContent = item.label;
				languageSettingItem.appendChild(input);
				languageSettingItem.appendChild(label);
				languageSettingList.appendChild(languageSettingItem);
			});
			languageSettingInner.appendChild(languageSettingList);
			languageContainer.appendChild(languageSettingInner);

			container.appendChild(languageContainer);
		}
		// ************************* Language Setting .End   *************************

		// ************************* Setting value Storage .Start *************************
		const storageSettingContainer = plugin.createElementWithAttrs('fieldset', { id: 'watSetWrap_storage', class: ['watSet-item-container', 'storage-container'] });

		const storageSettingTitle = plugin.createElementWithAttrs('legend', { class: 'watSet-title' });
		storageSettingTitle.textContent = plugin.getLocalizedText('panel.settings.manage.options.storage.title');

		const storageSettingInner = plugin.createElementWithAttrs('div', { class: 'watSet-inner' });
		const storageSettingList = plugin.createElementWithAttrs('ul', { class: ['watSet-list', 'watSet-list-type-button'] });
		const storageSettingItems = [
			{ id: 'watSet_storage_save', class: 'watSet_storage_save', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.save'), type: 'button' },
			{ id: 'watSet_storage_reset', class: 'watSet_storage_reset', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.delete'), type: 'button' },
			{ id: 'watSet_storage_check', class: 'watSet_storage_check', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.check'), type: 'button' },
			{ id: 'watSet_storage_export', class: 'watSet_storage_export', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.export') || '설정 내보내기', type: 'button' },
			{ id: 'watSet_storage_import', class: 'watSet_storage_import', label: plugin.getLocalizedText('panel.settings.manage.options.storage.options.import') || '설정 가져오기', type: 'button' }
		];
		storageSettingItems.forEach(item => {
			const storageSettingItem = plugin.createElementWithAttrs('li', { class: 'watSet-item' });

			const input = plugin.createElementWithAttrs('input', { type: item.type, id: item.id, class: ['wat-set-items', 'wat-set-item-type-button'], name: 'watSet_storage', value: item.label });
			input.addEventListener('click', () => {
				if (item.id === 'watSet_storage_save') {
					plugin.savePreferences();
					// 저장 성공 피드백 (기존엔 무피드백이라 저장 여부 불확실)
					plugin.showNotification(plugin.getLocalizedText('msg.success.save') || '저장되었습니다.');
				} else if (item.id === 'watSet_storage_reset') {
					// 파괴적 동작이므로 확인 절차 추가
					const confirmMsg = plugin.getLocalizedText('msg.confirm.reset') || '접근성 설정을 모두 초기화하시겠습니까?';
					if (!window.confirm(confirmMsg)) {
						return;
					}
					// localStorage.clear()는 호스트 사이트의 전체 데이터를 삭제하므로 WAT 키만 개별 삭제
					Object.values(Constants.STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
					// 화면에 즉시 반영되도록 새로고침 (삭제 후 다른 설정 변경 시 savePreferences가 되쓰는 문제도 방지)
					window.location.reload();
				} else if (item.id === 'watSet_storage_export') {
					plugin.exportSettings();
				} else if (item.id === 'watSet_storage_import') {
					plugin._promptImportSettings();
				} else if (item.id === 'watSet_storage_check') {
					// WAT 소유 키만 확인 — 호스트 사이트의 전체 localStorage를 덤프하지 않음 (정보 노출 방지)
					const settings = localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS);
					const containerValue = localStorage.getItem(Constants.STORAGE_KEYS.CONTAINER);
					const found = plugin.getLocalizedText('msg.state.saved') || '있음';
					const notFound = plugin.getLocalizedText('msg.state.notSaved') || '없음';
					const summary = plugin.getLocalizedText('msg.info.storageCheck', {
						settings: settings ? found : notFound,
						container: containerValue ? found : notFound
					}) || `저장된 설정: ${settings ? found : notFound}, 컨테이너: ${containerValue ? found : notFound}`;
					plugin.showNotification(summary);
				}
			});
			storageSettingItem.appendChild(input);
			storageSettingList.appendChild(storageSettingItem);
		});
		storageSettingInner.appendChild(storageSettingList);
		storageSettingContainer.appendChild(storageSettingTitle);
		storageSettingContainer.appendChild(storageSettingInner);

		container.appendChild(storageSettingContainer);
		// ************************* Setting value Storage .End   *************************
	}
}
