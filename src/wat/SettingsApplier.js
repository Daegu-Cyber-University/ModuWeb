/**
 * @fileoverview SettingsApplier - 설정 저장/복원/프로필 적용 담당
 * @module src/wat/SettingsApplier
 * @description WAT.js에서 추출된 설정 영속화 클러스터 (Phase 6-7).
 *              localStorage 기반 설정 저장·로드·내보내기/가져오기와
 *              접근성 프로필(저시력/색각이상/난독증) 적용·해제·복원을 담당한다.
 *              형제 메서드 호출은 plugin을 경유해 동적 디스패치를 유지한다
 *              (인스턴스 단위 오버라이드·테스트 스텁 호환).
 */
import { Constants } from '../core/constants.js';
import { Defaults } from '../core/defaults.js';
import { safeParseJSON } from '../core/safeParseJSON.js';

export class SettingsApplier {
	/**
	 * @param {Object} plugin - WAT 인스턴스 (change 계열 적용 메서드·상태·로케일 서비스 제공자)
	 */
	constructor(plugin) {
		this.plugin = plugin;
	}

	/**
	 * 현재 선택된 접근성 프로필의 이름을 가져옵니다
	 * @returns {string|null} 선택된 프로필명 또는 선택된 것이 없으면 null
	 */
	getSelectedProfileName() {
		const activeButton = document.querySelector('.watSet-item-container.profile-container .profileToggle[aria-pressed="true"]');
		if (activeButton) {
			return activeButton.getAttribute('data-profile') || activeButton.textContent.trim();
		}
		return null;
	}

	/**
	 * 지정된 접근성 프로필의 설정을 적용합니다
	 * @param {string} profileName - 적용할 프로필명 ('lowVision', 'colorBlindness', 'dyslexia')
	 * @returns {void}
	 * @description 체크된 옵션을 기반으로 프로필 설정을 적용하며 최소 하나의 옵션이 선택되었는지 검증합니다
	 */
	applyProfileSettings(profileName) {
		const plugin = this.plugin;
		const profileDefault = Defaults.PROFILES[profileName];
		if (!profileDefault) {
			console.warn(plugin.getLocalizedText('msg.warning.profileNotFound', { profileName: profileName }));
			return;
		}
		// 정적 기본값(Defaults.PROFILES)을 UI 상태로 직접 변이하면 세션 내내 기본값이 오염되므로 복사본 사용
		const profileData = {
			settings: { ...profileDefault.settings },
			enabled: { ...profileDefault.enabled }
		};

		// 프로필 전환 시 접근성 설정들을 기본값으로 초기화하고 보기모드/위치는 유지
		const currentSettings = {
			// 접근성 설정들은 기본값으로 초기화
			fontSize: Defaults.SETTINGS.fontSize,
			fontFamily: Defaults.SETTINGS.fontFamily,
			screenScale: Defaults.SETTINGS.screenScale,
			txtAlign: Defaults.SETTINGS.txtAlign,
			letterSpacing: Defaults.SETTINGS.letterSpacing,
			lineHeight: Defaults.SETTINGS.lineHeight,
			colorTheme: Defaults.SETTINGS.colorTheme,
			saturation: Defaults.SETTINGS.saturation,
			readGuide: Defaults.SETTINGS.readGuide,
			imgDisplayMode: Defaults.SETTINGS.imgDisplayMode,
			// 도구 관련 설정들은 현재 사용자 설정 유지
			viewMode: document.documentElement.dataset.watViewmode || Defaults.SETTINGS.viewMode,
			toolPosition: document.documentElement.dataset.watPosition || Defaults.SETTINGS.toolPosition
		};

		const effectiveSettings = { ...currentSettings };

		const profileCheckboxs = document.querySelectorAll(`.watSet-profile-item-container[data-profile="${profileName}"] .profileListItemInput[type="checkbox"]`);
		// ************************* Checkboxes Validation .Start *************************
		const checkedCheckbox = document.querySelectorAll(`.watSet-profile-item-container[data-profile="${profileName}"] .profileListItemInput[type="checkbox"]:checked`);
		if (checkedCheckbox.length === 0) {
			const profileToggle = document.querySelector(`.watSet-profile-item-container[data-profile="${profileName}"] .profileToggle`);
			alert(plugin.getLocalizedText('msg.warning.noSettingsChecked'));
			// 체크박스가 하나도 렌더링되지 않은 경우(옵션 전체 비활성화) 크래시 방지
			if (profileCheckboxs.length > 0) {
				profileCheckboxs[0].focus();
				profileCheckboxs[0].classList.add('force-focus');

				const handleFocusOut = () => {
					plugin._setTimeout(() => {
						if (document.activeElement !== profileCheckboxs[0]) {
							profileCheckboxs[0].classList.remove('force-focus');
							profileCheckboxs[0].removeEventListener('focusout', handleFocusOut);
						}
					}, 100);
				};

				profileCheckboxs[0].addEventListener('focusout', handleFocusOut);
			}
			if (profileToggle) {
				// textContent 직접 설정 시 내부 .watSet-button-label span이 파괴되어 이후 토글이 고장남
				const toggleLabel = profileToggle.querySelector('.watSet-button-label');
				if (toggleLabel) {
					toggleLabel.textContent = plugin.getLocalizedText('tags.button.text.on');
				} else {
					profileToggle.textContent = plugin.getLocalizedText('tags.button.text.on');
				}
				profileToggle.setAttribute('aria-pressed', 'false');
			}
			return;
		}
		// ************************* Checkboxes Validation .End   *************************

		// 프로필 설정 적용: 각 항목에 대해 UI에 있는 체크박스 상태를 반영해서 병합
		for (const key in profileData.settings) {
			// 사용자 옵션에 해당 기능이 비활성화된 경우 => 건너뜀
			if (plugin.options[key] === false) continue;

			// UI에 체크박스가 있다면 이를 통해 최신 상태를 반영 (data-key 속성 기준)
			const checkbox = document.querySelector(`.watSet-profile-item-container[data-profile="${profileName}"] .profileListItemInput[type="checkbox"][data-key="${key}"]`);
			if (checkbox) {
				profileData.enabled[key] = checkbox.checked;
			}
			// 체크된 항목만 baseSettings에 덮어쓰도록 함
			if (profileData.enabled[key]) {
				effectiveSettings[key] = profileData.settings[key];
			}
		}

		// 프로필 적용 중 저장 비활성화
		const originalSkipFlag = plugin._skipSavePreferences;
		plugin._skipSavePreferences = true;
		if (effectiveSettings.fontSize) { plugin.changeFontSize(effectiveSettings.fontSize); }
		if (effectiveSettings.fontFamily) { plugin.changeFontFamily(effectiveSettings.fontFamily); }
		if (effectiveSettings.screenScale) { plugin.changeScreenScale(effectiveSettings.screenScale); }
		if (effectiveSettings.txtAlign) { plugin.changeTextAlign(effectiveSettings.txtAlign); }
		if (effectiveSettings.letterSpacing) { plugin.changeLetterSpacing(effectiveSettings.letterSpacing); }
		if (effectiveSettings.lineHeight) { plugin.changeLineHeight(effectiveSettings.lineHeight); }
		if (effectiveSettings.colorTheme) { plugin.changeColorTheme(effectiveSettings.colorTheme); }
		if (effectiveSettings.saturation) { plugin.changeSaturation(effectiveSettings.saturation); }
		if (effectiveSettings.readGuide) { plugin.changeReadGuide(effectiveSettings.readGuide); }

		// 저장 플래그 복원
		plugin._skipSavePreferences = originalSkipFlag;

		// 프로필 적용 후 개별 설정 UI 동기화
		plugin._syncIndividualSettingsUI(effectiveSettings);

		// 프로필 적용 완료 후 저장
		plugin.savePreferences();
		// UI 동기화를 확실하게 하기 위해 약간의 지연 후 한 번 더 실행
		setTimeout(() => {
			plugin._syncIndividualSettingsUI(effectiveSettings);
		}, 50);

		localStorage.setItem(Constants.STORAGE_KEYS.SELECTED_PROFILE, JSON.stringify({
			profileName: profileName,
			enabledSettings: profileData.enabled,
			appliedSesttings: effectiveSettings
		}));
	}

	/**
	 * 지정된 프로필을 켜거나 끕니다
	 * @param {string} profile - 토글할 프로필명
	 * @param {HTMLElement} targetToggle - 클릭된 토글 버튼 요소
	 * @returns {void}
	 * @description 프로필 활성화를 토글하고, 설정을 적용/리셋하며, UI 상태를 업데이트합니다
	 */
	toggleProfile(profile, targetToggle) {
		const plugin = this.plugin;
		const isOn = targetToggle.getAttribute('aria-pressed') === 'true';
		const siblingToggles = Array.from(targetToggle.closest('.watSet-item-container.profile-container').querySelectorAll('.profileToggle')).filter(toggle => toggle !== targetToggle);
		const targetLabel = targetToggle.querySelector('.watSet-button-label');
		targetLabel.textContent = isOn ? plugin.getLocalizedText('tags.button.text.stateOff') : plugin.getLocalizedText('tags.button.text.stateOn');
		targetToggle.setAttribute('aria-pressed', isOn ? 'false' : 'true');

		if (isOn) {
			// 프로필을 끌 때: 접근성 설정만 기본값으로 리셋, 도구 설정은 유지
			const defaults = Defaults.SETTINGS;

			// 접근성 설정들만 기본값으로 리셋
			plugin.changeFontSize(defaults.fontSize);
			plugin.changeFontFamily(defaults.fontFamily);
			plugin.changeScreenScale(defaults.screenScale);
			plugin.changeTextAlign(defaults.txtAlign);
			plugin.changeLetterSpacing(defaults.letterSpacing);
			plugin.changeLineHeight(defaults.lineHeight);
			plugin.changeColorTheme(defaults.colorTheme);
			plugin.changeSaturation(defaults.saturation);
			plugin.changeReadGuide(defaults.readGuide);
			document.documentElement.dataset.imgDisplayMode = defaults.imgDisplayMode;

			// 도구 설정들은 현재 사용자 설정 유지
			const resetSettings = {
				fontSize: defaults.fontSize,
				fontFamily: defaults.fontFamily,
				screenScale: defaults.screenScale,
				txtAlign: defaults.txtAlign,
				letterSpacing: defaults.letterSpacing,
				lineHeight: defaults.lineHeight,
				colorTheme: defaults.colorTheme,
				saturation: defaults.saturation,
				readGuide: defaults.readGuide,
				imgDisplayMode: defaults.imgDisplayMode,
				// 현재 사용자 설정 유지
				viewMode: document.documentElement.dataset.watViewmode || defaults.viewMode,
				toolPosition: document.documentElement.dataset.watPosition || defaults.toolPosition
			};

			// UI 동기화
			plugin._syncIndividualSettingsUI(resetSettings);

			// 현재 토글 버튼에서 active 클래스 제거
			targetToggle.classList.remove(Constants.CSS_CLASSES.ACTIVE);

			// 프로필 해제 시 저장된 선택 상태도 제거 (재방문 시 잘못 복원 방지)
			localStorage.removeItem(Constants.STORAGE_KEYS.SELECTED_PROFILE);

			// 설정 저장
			plugin.savePreferences();
		} else {
			// 프로필을 켤 때
			plugin.applyProfileSettings(profile);

			// 현재 토글 버튼에 active 클래스 추가
			targetToggle.classList.add(Constants.CSS_CLASSES.ACTIVE);
		}

		// 다른 프로필 토글들은 모두 비활성화
		siblingToggles.forEach(toggle => {
			const siblingLabel = toggle.querySelector('.watSet-button-label');
			siblingLabel.textContent = plugin.getLocalizedText('tags.button.text.stateOff');
			toggle.setAttribute('aria-pressed', 'false');
			toggle.classList.remove(Constants.CSS_CLASSES.ACTIVE);
		});
	}

	/**
	 * 모든 접근성 설정을 기본값으로 리셋합니다
	 * @returns {void}
	 * @description 모든 접근성 기능을 초기/기본 상태로 복원합니다 (도구 설정은 유지)
	 */
	resetWatSettings() {
		const plugin = this.plugin;
		const defaults = Defaults.SETTINGS;

		// 접근성 설정들만 기본값으로 리셋
		plugin.changeFontSize(defaults.fontSize);
		plugin.changeFontFamily(defaults.fontFamily);
		plugin.changeScreenScale(defaults.screenScale);
		plugin.changeTextAlign(defaults.txtAlign);
		plugin.changeLetterSpacing(defaults.letterSpacing);
		plugin.changeLineHeight(defaults.lineHeight);
		plugin.changeColorTheme(defaults.colorTheme);
		plugin.changeSaturation(defaults.saturation);
		plugin.changeReadGuide(defaults.readGuide);
		// 이미지 표시 모드도 접근성 설정으로 포함
		document.documentElement.dataset.imgDisplayMode = defaults.imgDisplayMode;

		// 리셋할 설정들만 포함 (도구 설정 viewMode/toolPosition은 현재 사용자 설정 유지)
		const resetSettings = {
			fontSize: defaults.fontSize,
			fontFamily: defaults.fontFamily,
			screenScale: defaults.screenScale,
			txtAlign: defaults.txtAlign,
			letterSpacing: defaults.letterSpacing,
			lineHeight: defaults.lineHeight,
			colorTheme: defaults.colorTheme,
			saturation: defaults.saturation,
			readGuide: defaults.readGuide,
			imgDisplayMode: defaults.imgDisplayMode,
			// 현재 사용자 설정 유지
			viewMode: document.documentElement.dataset.watViewmode || defaults.viewMode,
			toolPosition: document.documentElement.dataset.watPosition || defaults.toolPosition
		};

		// 전체 리셋 후 개별 설정 UI 동기화
		plugin._syncIndividualSettingsUI(resetSettings);

		// UI 동기화를 확실하게 하기 위해 약간의 지연 후 한 번 더 실행
		setTimeout(() => {
			plugin._syncIndividualSettingsUI(defaults);
		}, 50);
	}

	/**
	 * 특정 접근성 프로필의 설정을 리셋합니다
	 * @param {string} profileId - 프로필 식별자 ('lowVision', 'colorBlindness', 'dyslexia')
	 * @returns {void}
	 */
	resetProfileSettings(profileId) {
		const plugin = this.plugin;
		const resetSettings = {};

		switch (profileId) {
			case 'lowVision': // 실제 프로필 키(Defaults.PROFILES)와 일치시킴 — 구 명칭 'visualImpairment'
				plugin.changeFontSize('initial');
				plugin.changeFontFamily('initial');
				plugin.toggleImgTextConversion(false);
				plugin.toggleDisplayContents(false);
				resetSettings.fontSize = 'initial';
				resetSettings.fontFamily = 'initial';
				break;
			case 'colorBlindness':
				plugin.changeSaturation('initial');
				plugin.toggleDataAttribute('stopAni', false);
				resetSettings.saturation = 'initial';
				break;
			case 'dyslexia':
				plugin.changeFontFamily('initial');
				plugin.changeLineHeight('initial');
				plugin.toggleDataAttribute('stopAni', false);
				plugin.changeReadGuide('');
				resetSettings.fontFamily = 'initial';
				resetSettings.lineHeight = 'initial';
				resetSettings.readGuide = 'unset';
				break;
		}

		// 프로필 리셋 후 개별 설정 UI 동기화
		plugin._syncIndividualSettingsUI(resetSettings);

		// UI 동기화를 확실하게 하기 위해 약간의 지연 후 한 번 더 실행
		setTimeout(() => {
			plugin._syncIndividualSettingsUI(resetSettings);
		}, 50);
	}

	/**
	 * 현재 접근성 설정을 localStorage에 저장합니다
	 * @returns {void}
	 * @description HTML 데이터 속성에서 현재 설정을 수집하고 JSON으로 localStorage에 저장합니다
	 */
	savePreferences() {
		const plugin = this.plugin;
		// 초기화 중에는 저장하지 않음
		if (plugin._skipSavePreferences) {
			return;
		}

		const defaultSettings = Defaults.SETTINGS;

		const settings = {
			fontSize: document.documentElement.dataset.fontSize || defaultSettings.fontSize,
			fontFamily: document.documentElement.dataset.fontFamily || defaultSettings.fontFamily,
			screenScale: document.documentElement.dataset.screenScale || defaultSettings.screenScale,
			txtAlign: document.documentElement.getAttribute('data-txt-align') || defaultSettings.txtAlign,
			letterSpacing: document.documentElement.getAttribute('data-letter-spacing') || defaultSettings.letterSpacing,
			lineHeight: document.documentElement.getAttribute('data-line-height') || defaultSettings.lineHeight,
			colorTheme: document.documentElement.dataset.colorTheme || defaultSettings.colorTheme,
			saturation: document.documentElement.dataset.saturation || defaultSettings.saturation,
			readGuide: document.documentElement.getAttribute('data-read-guide') || defaultSettings.readGuide,
			imgDisplayMode: document.documentElement.dataset.imgDisplayMode || defaultSettings.imgDisplayMode,
			viewMode: document.documentElement.dataset.watViewmode || defaultSettings.viewMode,
			toolPosition: document.documentElement.dataset.watPosition || defaultSettings.toolPosition,
			language: document.documentElement.dataset.watLanguage || defaultSettings.language
		};

		localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

		// StateManager 설정도 함께 갱신
		plugin.state.set('settings', settings);

		// 설정 저장 이벤트 디스패치
		plugin._dispatchStateEvent('settings:saved', {
			settings: { ...settings },
			timestamp: Date.now()
		});
	}

	/**
	 * 저장된 접근성 설정을 JSON 파일로 내보냅니다 (브라우저·기기 간 설정 이전 지원)
	 * @returns {void}
	 */
	exportSettings() {
		const plugin = this.plugin;
		try {
			const data = {};
			Object.values(Constants.STORAGE_KEYS).forEach(key => {
				const value = localStorage.getItem(key);
				if (value !== null) data[key] = value;
			});

			const payload = {
				format: 'moduweb-settings',
				version: 1,
				data
			};

			const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'moduweb-settings.json';
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);

			plugin._notify(plugin.getLocalizedText('msg.success.export') || '설정을 파일로 내보냈습니다.', { type: 'success' });
		} catch (error) {
			console.error('[WAT] 설정 내보내기 실패:', error);
			plugin._notify(plugin.getLocalizedText('msg.error.general') || '오류가 발생했습니다.', { type: 'error' });
		}
	}

	/**
	 * 파일 선택 대화상자를 열어 설정 JSON을 가져옵니다
	 * @returns {void}
	 */
	promptImportSettings() {
		const plugin = this.plugin;
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json,.json';
		input.addEventListener('change', () => {
			const file = input.files && input.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => plugin.importSettings(String(reader.result));
			reader.readAsText(file);
		});
		input.click();
	}

	/**
	 * 내보낸 설정 JSON을 검증 후 적용합니다 (적용 후 페이지 새로고침)
	 * @param {string} jsonText - exportSettings()가 생성한 JSON 문자열
	 * @returns {boolean} 적용 성공 여부
	 */
	importSettings(jsonText) {
		const plugin = this.plugin;
		const invalidMsg = plugin.getLocalizedText('msg.error.importInvalid') || '올바른 ModuWeb 설정 파일이 아닙니다.';
		const payload = safeParseJSON(jsonText, null);

		// 형식 검증 — WAT가 만든 파일만 수용
		if (!payload || payload.format !== 'moduweb-settings' || typeof payload.data !== 'object' || payload.data === null) {
			plugin._notify(invalidMsg, { type: 'error' });
			return false;
		}

		// 알려진 WAT 키만 반영 (임의 키로 호스트 localStorage를 오염시키지 않음)
		const knownKeys = new Set(Object.values(Constants.STORAGE_KEYS));
		let applied = 0;
		for (const [key, value] of Object.entries(payload.data)) {
			if (knownKeys.has(key) && typeof value === 'string') {
				localStorage.setItem(key, value);
				applied++;
			}
		}

		if (applied === 0) {
			plugin._notify(invalidMsg, { type: 'error' });
			return false;
		}

		plugin._notify(plugin.getLocalizedText('msg.success.import') || '설정을 가져왔습니다. 페이지를 새로고침합니다.', { type: 'success' });
		// 새 설정이 전체 UI·스타일에 반영되도록 새로고침 (reset 버튼과 동일 패턴)
		plugin._setTimeout(() => window.location.reload(), 800);
		return true;
	}

	/**
	 * localStorage에서 접근성 설정을 로드합니다
	 * @returns {Object} 기본값으로 대체된 로드된 설정 객체
	 * @description localStorage에서 저장된 설정을 가져와 기본 설정과 병합하고 라디오 UI를 동기화합니다
	 */
	loadPreferences() {
		const plugin = this.plugin;
		const savedSettings = localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS);
		const loadedSettings = safeParseJSON(savedSettings, {});
		const defaultSettings = Defaults.SETTINGS;

		// 초기값 설정
		const pluginSettings = {
			fontSize: loadedSettings.fontSize || defaultSettings.fontSize,
			fontFamily: loadedSettings.fontFamily || defaultSettings.fontFamily,
			screenScale: loadedSettings.screenScale || defaultSettings.screenScale,
			txtAlign: loadedSettings.txtAlign || defaultSettings.txtAlign,
			letterSpacing: loadedSettings.letterSpacing || defaultSettings.letterSpacing,
			lineHeight: loadedSettings.lineHeight || defaultSettings.lineHeight,
			colorTheme: loadedSettings.colorTheme || defaultSettings.colorTheme,
			saturation: loadedSettings.saturation || defaultSettings.saturation,
			readGuide: loadedSettings.readGuide || defaultSettings.readGuide,
			imgDisplayMode: loadedSettings.imgDisplayMode || defaultSettings.imgDisplayMode,
			viewMode: loadedSettings.viewMode || defaultSettings.viewMode,
			toolPosition: loadedSettings.toolPosition || defaultSettings.toolPosition
		};

		const controlItems = ['viewMode', 'toolPosition'];

		// 설정 적용
		Object.entries(pluginSettings).forEach(([key, value]) => {
			// UI 컨트롤 설정 - 라디오 버튼 체크 및 UI 상태 업데이트
			const classSelector = controlItems.includes(key) ? '.wat-set-item-type-radio' : '.wat-item-type-radio';
			const selector = `${classSelector}[name="${key}"][value="${value}"]`;
			const radioElement = document.querySelector(selector);

			if (radioElement) {
				radioElement.checked = true;

				// UI 상태 업데이트 (setRadioListeners와 동일한 로직)
				const parentListItem = radioElement.closest('.opt_item');
				const parentPersonalOptItem = radioElement.closest('.personalOpt_item');

				if (parentListItem) {
					const parentList = parentListItem.closest('.opt_lists');
					if (parentList) {
						// 모든 형제 요소에서 selectOn 클래스 제거
						Array.from(parentList.children)
							.filter(child => child !== parentListItem)
							.forEach(sibling => sibling.classList.remove('selectOn'));
						// 현재 요소에 selectOn 클래스 추가
						parentListItem.classList.add('selectOn');
					}
				}

				if (parentPersonalOptItem) {
					if (value === 'initial' || value === 'unset') {
						parentPersonalOptItem.classList.remove('selectOn');
					} else {
						parentPersonalOptItem.classList.add('selectOn');
					}
				}
			} else {
				console.warn(`Radio element not found for ${key}=${value}: ${selector}`);
			}

			// 화면 확대 설정에 대한 현재 비율 초기화
			if (key === 'screenScale') {
				const ratio = plugin.screenScaleRatios[value] || 1;
				plugin.state.set('plugin.currentScreenScale', ratio);
			}
		});

		// 설정 로드 이벤트 디스패치
		plugin._dispatchStateEvent('settings:loaded', {
			settings: { ...pluginSettings },
			wasEmpty: !savedSettings,
			timestamp: Date.now()
		});

		return pluginSettings;
	}

	/**
	 * 특정 설정을 실제 페이지 콘텐츠에 적용합니다
	 * @param {string} settingKey - 설정 키 (예: 'fontSize', 'screenScale')
	 * @param {string} settingValue - 설정 값 (예: 'size-1p5x', 'scale-1p2x')
	 * @returns {void}
	 */
	applySettingToPage(settingKey, settingValue) {
		const plugin = this.plugin;
		switch (settingKey) {
			case 'fontSize':
				plugin.changeFontSize(settingValue);
				break;
			case 'fontFamily':
				plugin.changeFontFamily(settingValue);
				break;
			case 'screenScale':
				plugin.changeScreenScale(settingValue);
				break;
			case 'txtAlign':
				plugin.changeTextAlign(settingValue);
				break;
			case 'letterSpacing':
				plugin.changeLetterSpacing(settingValue);
				break;
			case 'lineHeight':
				plugin.changeLineHeight(settingValue);
				break;
			case 'colorTheme':
				plugin.changeColorTheme(settingValue);
				break;
			case 'saturation':
				plugin.changeSaturation(settingValue);
				break;
			case 'readGuide':
				plugin.changeReadGuide(settingValue);
				break;
			case 'imgDisplayMode':
				plugin.changeImgDisplayMode(settingValue);
				break;
			case 'viewMode':
				// UI 스타일링을 위해 documentElement dataset에 적용
				document.documentElement.dataset.watViewmode = settingValue;
				break;
			case 'toolPosition':
				// UI 위치 지정을 위해 documentElement dataset에 적용
				document.documentElement.dataset.watPosition = settingValue;
				break;
			default:
				console.warn(`Unknown setting key: ${settingKey}`);
		}
	}

	/**
	 * 플러그인 시작 시 초기 환경설정을 적용합니다
	 * @returns {void}
	 * @description 저장된 환경설정을 로드하고 적용하며, 저장된 상태와 일치하도록 UI 컨트롤을 설정합니다
	 */
	setInitialPreferences() {
		const plugin = this.plugin;
		const loadedSettings = plugin.loadPreferences();

		// 초기 설정 로드 후 UI 동기화
		if (loadedSettings) {
			setTimeout(() => {
				plugin._syncIndividualSettingsUI(loadedSettings);
			}, 100);
		}

		// 저장된 프로필 선택 상태 복원 (사용성 U-1) —
		// 설정값 자체는 loadPreferences가 복원하므로 토글·체크박스 UI만 동기화
		plugin._restoreSelectedProfileUI();
	}

	/**
	 * 저장된 프로필 선택 상태를 토글 UI에 복원합니다
	 * @returns {void}
	 * @description 이전 방문에서 켠 프로필이 재방문 시 "꺼짐"으로 보이고, 다시 켜면
	 *              설정이 리셋되던 문제(U-1)를 해결한다. localStorage의 selectedProfile을
	 *              읽어 해당 프로필 토글을 켜짐 상태로 표시하고 체크박스 선택을 복원한다.
	 */
	restoreSelectedProfileUI() {
		const plugin = this.plugin;
		const saved = safeParseJSON(localStorage.getItem(Constants.STORAGE_KEYS.SELECTED_PROFILE), null);
		if (!saved || !saved.profileName) return;

		const container = document.querySelector(`.watSet-profile-item-container[data-profile="${saved.profileName}"]`);
		if (!container) {
			// 프로필 구성이 바뀌어 더 이상 존재하지 않으면 저장값 정리
			localStorage.removeItem(Constants.STORAGE_KEYS.SELECTED_PROFILE);
			return;
		}

		const toggle = container.querySelector('.profileToggle');
		if (toggle) {
			toggle.setAttribute('aria-pressed', 'true');
			toggle.classList.add(Constants.CSS_CLASSES.ACTIVE);
			const label = toggle.querySelector('.watSet-button-label');
			if (label) label.textContent = plugin.getLocalizedText('tags.button.text.stateOn');
		}

		// 프로필 내 개별 항목 체크박스 선택 상태 복원
		if (saved.enabledSettings && typeof saved.enabledSettings === 'object') {
			for (const [key, enabled] of Object.entries(saved.enabledSettings)) {
				const checkbox = container.querySelector(`.profileListItemInput[type="checkbox"][data-key="${key}"]`);
				if (checkbox) checkbox.checked = !!enabled;
			}
		}
	}

	/**
	 * 개별 UI 컨트롤을 현재 설정값과 동기화합니다
	 * @param {Object} settings - UI 컨트롤과 동기화할 설정 객체
	 * @returns {void}
	 * @description 제공된 설정을 시각적으로 반영하도록 UI 컨트롤(라디오 버튼, 체크박스)을 업데이트합니다
	 */
	syncIndividualSettingsUI(settings) {
		if (!settings || typeof settings !== 'object') {
			return;
		}

		const controlItems = ['viewMode', 'toolPosition', 'readGuideMode'];

		Object.entries(settings).forEach(([key, value]) => {
			// UI 컨트롤 설정 - 라디오 버튼 체크 및 UI 상태 업데이트
			const classSelector = controlItems.includes(key) ? '.wat-set-item-type-radio' : '.wat-item-type-radio';
			const selector = `${classSelector}[name="${key}"][value="${value}"]`;
			const radioElement = document.querySelector(selector);

			if (radioElement) {
				// 강제로 라디오 버튼 체크 상태 업데이트
				radioElement.checked = true;

				// 변경 이벤트 발생시켜서 UI 업데이트 강제 실행
				const changeEvent = new Event('change', { bubbles: true, cancelable: true });
				radioElement.dispatchEvent(changeEvent);

				// UI 상태 업데이트 (setRadioListeners와 동일한 로직)
				const parentListItem = radioElement.closest('.opt_item');
				const parentPersonalOptItem = radioElement.closest('.personalOpt_item');

				if (parentListItem) {
					const parentList = parentListItem.closest('.opt_lists');
					if (parentList) {
						// 모든 형제 요소에서 selectOn 클래스 제거
						Array.from(parentList.children)
							.filter(child => child !== parentListItem)
							.forEach(sibling => sibling.classList.remove('selectOn'));
						// 현재 요소에 selectOn 클래스 추가
						parentListItem.classList.add('selectOn');
					}
				}

				if (parentPersonalOptItem) {
					if (value === 'initial' || value === 'unset') {
						parentPersonalOptItem.classList.remove('selectOn');
					} else {
						parentPersonalOptItem.classList.add('selectOn');
					}
				}
			}
		});

		// 읽기 가이드 관련 버튼 상태 동기화
		if (settings.readGuide !== undefined) {
			const modeButtons = document.querySelectorAll('[data-read-guide-mode]');
			modeButtons.forEach(button => {
				const buttonMode = button.getAttribute('data-read-guide-mode');
				if (buttonMode === settings.readGuide) {
					button.classList.add(Constants.CSS_CLASSES.ACTIVE);
					button.setAttribute('aria-pressed', 'true');
				} else {
					button.classList.remove(Constants.CSS_CLASSES.ACTIVE);
					button.setAttribute('aria-pressed', 'false');
				}
			});
		}
	}
}
