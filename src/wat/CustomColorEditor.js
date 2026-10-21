/**
 * @fileoverview 내 색상 편집기 — 환경설정 탭에서 배경·글자색을 고르는 UI
 * @module src/wat/CustomColorEditor
 * @description 견본·색 선택기·색상 코드로 두 색을 고르고, 한쪽을 바꾸면 상대편 추천색을 제안한다.
 *              편집 중에는 미리보기에만 반영하고 [저장하고 적용] 때 plugin.setCustomColors로 넘긴다.
 *
 *              추천 상태 모델 — 슬롯마다 default(이번 편집에서 손대지 않음) / suggested(추천 승인) / manual(직접 고름).
 *              자동 추천은 manual이 아닌 슬롯만 대상으로 해서, 양쪽을 직접 고른 뒤 추천이 서로 번갈아
 *              뜨는 일을 막는다. 두 슬롯을 모두 직접 고르면 [추천 받기]로만 추천한다.
 *
 *              패널 전역 위임과 겹치지 않도록 .wat-item-type-*, .setCont, .opt_item 클래스와
 *              tts_/pageScroll_가 든 id를 쓰지 않는다 (WAT._handleRadioChange, _handleButtonClick).
 *              패널은 언어를 바꾸면 통째로 다시 만들어지므로 상태는 DOM이 아니라 인스턴스에 둔다.
 */
import {
	CONTRAST,
	normalizeHex,
	contrastRatio,
	floorRatio,
	contrastLevel,
	suggestCounterpart,
	deriveThemeColors,
	describeColor
} from '../core/colorContrast.js';
import { CUSTOM_COLOR_DEFAULTS, BG_SWATCHES, FG_SWATCHES, CUSTOM_COLOR_PRESETS } from './CustomColorTheme.js';

const LOCALE_PREFIX = 'panel.settings.manage.options.customColors';
const ID_PREFIX = 'watSet_customColors';
const SLOTS = ['bg', 'fg'];
const SWATCHES = { bg: BG_SWATCHES, fg: FG_SWATCHES };
// 화살표로 견본을 훑을 때마다 낭독하지 않도록 마지막 변경 뒤 이만큼 기다린다
const ANNOUNCE_DELAY = 500;
// 대비 등급을 색만으로 전달하지 않도록 함께 쓰는 기호 (WCAG 1.4.1)
const LEVEL_GLYPHS = { aaa: '✓', aa: '✓', low: '⚠' };

const otherSlot = slot => (slot === 'bg' ? 'fg' : 'bg');

export class CustomColorEditor {
	/**
	 * @param {Object} plugin - WAT 인스턴스 (요소 생성·로케일·낭독·알림·타이머·내 색상 저장 서비스)
	 */
	constructor(plugin) {
		this.plugin = plugin;
		/** @type {{bg:string, fg:string}|null} 편집 중인 색 (저장 전) */
		this.draft = null;
		this.slotState = { bg: 'default', fg: 'default' };
		/** @type {'bg'|'fg'|null} 마지막으로 사용자가 바꾼 슬롯 — [추천 받기]의 대상을 정한다 */
		this.lastEdited = null;
		/** @type {{slot:'bg'|'fg', hex:string, ratio:number}|null} 표시 중인 추천 */
		this.suggestion = null;
		this.refs = null;
		this._announceTimer = null;
	}

	/**
	 * 편집기 DOM을 만듭니다. 다시 부르면(언어 변경) 편집 중인 초안 그대로 새로 그린다.
	 * @returns {HTMLFieldSetElement}
	 */
	build() {
		if (!this.draft) this._resetDraft();
		const refs = { slots: {} };
		this.refs = refs;

		const root = this._el('fieldset', { id: 'watSetWrap_customColors', class: ['watSet-item-container', 'customColors-container'] });
		root.appendChild(this._el('legend', { class: 'watSet-title' }, this._t('title')));
		const inner = this._el('div', { class: ['watSet-inner', 'wat-cc'] });
		root.appendChild(inner);

		inner.appendChild(this._el('p', { class: 'wat-cc-desc' }, this._t('desc')));
		refs.notice = this._el('p', { class: 'wat-cc-notice' }, this._t('filterNotice'));
		inner.appendChild(refs.notice);
		inner.appendChild(this._buildPresets());
		inner.appendChild(this._buildPreview());

		refs.contrast = this._el('p', { class: 'wat-cc-contrast' });
		refs.contrastGlyph = this._el('span', { class: 'wat-cc-contrast-glyph', 'aria-hidden': 'true' });
		refs.contrastText = this._el('span', { class: 'wat-cc-contrast-text' });
		refs.contrast.append(refs.contrastGlyph, refs.contrastText);
		inner.appendChild(refs.contrast);

		refs.request = this._el('button', { type: 'button', id: `${ID_PREFIX}_request`, class: ['wat-cc-button', 'wat-cc-request'] }, this._t('suggest.request'));
		refs.request.addEventListener('click', () => this._requestSuggestion());
		inner.appendChild(refs.request);

		refs.card = this._buildSuggestionCard();
		SLOTS.forEach(slot => {
			refs.slots[slot] = this._buildSlot(slot);
			inner.appendChild(refs.slots[slot].fieldset);
			// 추천 카드는 처음엔 배경 슬롯 뒤에 두고, 표시할 때 방금 바꾼 슬롯 뒤로 옮긴다
			if (slot === 'bg') inner.appendChild(refs.card);
		});
		inner.appendChild(this._buildActions());

		// 패널을 연 채 채도 설정을 바꿀 수 있으므로 편집기에 들어올 때마다 필터 안내를 다시 맞춘다
		root.addEventListener('focusin', () => this._updateFilterNotice());

		this._render();
		return root;
	}

	// ========== DOM 생성 ==========

	_el(tag, attrs = {}, text) {
		const node = this.plugin.createElementWithAttrs(tag, attrs);
		if (text !== undefined) node.textContent = text;
		return node;
	}

	_t(key, params) {
		return this.plugin.getLocalizedText(`${LOCALE_PREFIX}.${key}`, params);
	}

	_buildPresets() {
		const titleId = `${ID_PREFIX}_presetsTitle`;
		const wrap = this._el('div', { class: 'wat-cc-presets', role: 'group', 'aria-labelledby': titleId });
		wrap.appendChild(this._el('p', { id: titleId, class: 'wat-cc-subtitle' }, this._t('presetsTitle')));
		const list = this._el('ul', { class: 'wat-cc-preset-list' });
		CUSTOM_COLOR_PRESETS.forEach(preset => {
			const button = this._el('button', { type: 'button', id: `${ID_PREFIX}_preset_${preset.id}`, class: 'wat-cc-preset' });
			button.appendChild(this._chip(preset.bg, preset.fg));
			button.appendChild(this._el('span', { class: 'wat-cc-preset-name' }, this._t(`presets.${preset.id}`)));
			button.addEventListener('click', () => this._applyPreset(preset));
			const item = this._el('li');
			item.appendChild(button);
			list.appendChild(item);
		});
		wrap.appendChild(list);
		return wrap;
	}

	/** 색 견본 칩 — 장식이므로 스크린리더에는 숨기고 이름은 옆 텍스트가 전한다 */
	_chip(bg, fg) {
		const chip = this._el('span', { class: 'wat-cc-chip', 'aria-hidden': 'true' }, fg ? this._t('chipSample') : undefined);
		chip.style.backgroundColor = bg;
		if (fg) chip.style.color = fg;
		return chip;
	}

	_buildPreview() {
		const wrap = this._el('div', { class: 'wat-cc-preview-wrap' });
		wrap.appendChild(this._el('p', { class: 'wat-cc-subtitle' }, this._t('previewTitle')));
		this.refs.preview = this._el('div', { class: 'wat-cc-preview' });
		this.refs.preview.appendChild(this._el('p', { class: 'wat-cc-preview-text' }, this._t('previewText')));
		// 링크 모양만 보여 주는 span — 실제 링크면 Tab이 멈추고 눌렸을 때 이동해 버린다
		this.refs.previewLink = this._el('span', { class: 'wat-cc-preview-link' }, this._t('previewLink'));
		this.refs.preview.appendChild(this.refs.previewLink);
		wrap.appendChild(this.refs.preview);
		return wrap;
	}

	_buildSlot(slot) {
		const slotName = this._t(`slots.${slot}`);
		const fieldset = this._el('fieldset', { class: 'wat-cc-slot', 'data-slot': slot });
		const legend = this._el('legend', { class: 'wat-cc-slot-title' });
		legend.appendChild(this._el('span', { class: 'wat-cc-slot-name' }, slotName));
		const current = this._el('span', { class: 'wat-cc-current' });
		legend.appendChild(current);
		fieldset.appendChild(legend);

		// 네이티브 라디오 묶음 — Tab 한 번으로 들어와 화살표로 고르고 "12개 중 N번째"로 안내된다
		const list = this._el('ul', { class: 'wat-cc-swatches' });
		const radios = SWATCHES[slot].map(swatch => {
			const id = `${ID_PREFIX}_${slot}_${swatch.id}`;
			const item = this._el('li', { class: 'wat-cc-swatch-item' });
			const radio = this._el('input', { type: 'radio', id, name: `${ID_PREFIX}_${slot}`, value: swatch.hex, class: 'wat-cc-swatch-input' });
			const label = this._el('label', { for: id, class: 'wat-cc-swatch' });
			label.appendChild(this._chip(swatch.hex));
			label.appendChild(this._el('span', { class: 'wat-cc-swatch-name' }, this._t(`colorNames.${swatch.id}`)));
			// 음성 명령(STT)은 이미 체크된 라디오를 해제한 채 change를 보낼 수 있다 — 선택만 처리
			radio.addEventListener('change', e => {
				if (e.target.checked) this._onUserChange(slot, e.target.value);
			});
			item.append(radio, label);
			list.appendChild(item);
			return radio;
		});
		fieldset.appendChild(list);

		const custom = this._el('div', { class: 'wat-cc-custom' });
		const pickerId = `${ID_PREFIX}_${slot}_picker`;
		const picker = this._el('input', { type: 'color', id: pickerId, class: 'wat-cc-picker' });
		// 끄는 중(input)에는 미리보기만, 확정(change) 때 직접 고른 것으로 처리 — 카드 깜빡임 방지
		picker.addEventListener('input', () => this._onPickerInput(slot));
		picker.addEventListener('change', () => {
			const value = normalizeHex(picker.value);
			if (value) this._onUserChange(slot, value);
		});
		custom.append(this._el('label', { for: pickerId, class: 'wat-cc-custom-label' }, this._t('picker', { slot: slotName })), picker);

		// 색 선택기는 브라우저·스크린리더마다 접근성이 고르지 않아 코드 입력을 함께 둔다
		const hexId = `${ID_PREFIX}_${slot}_hex`;
		const hintId = `${hexId}Hint`;
		const errorId = `${hexId}Error`;
		const hex = this._el('input', {
			// maxlength는 두지 않는다 — 앞뒤 공백이 붙은 코드를 붙여 넣으면 잘려 거부된다 (normalizeHex가 공백을 다듬는다)
			type: 'text', id: hexId, class: 'wat-cc-hex',
			autocomplete: 'off', spellcheck: 'false', 'aria-describedby': hintId
		});
		hex.addEventListener('change', () => this._onHexCommit(slot));
		const error = this._el('p', { id: errorId, class: 'wat-cc-error' }, this._t('hexError'));
		error.hidden = true;
		custom.append(
			this._el('label', { for: hexId, class: 'wat-cc-custom-label' }, this._t('hex', { slot: slotName })),
			hex,
			this._el('p', { id: hintId, class: 'wat-cc-hint' }, this._t('hexHint')),
			error
		);
		fieldset.appendChild(custom);

		return { fieldset, current, radios, picker, hex, hintId, error };
	}

	_buildSuggestionCard() {
		const refs = this.refs;
		const titleId = `${ID_PREFIX}_suggestTitle`;
		const card = this._el('div', { class: 'wat-cc-suggest', role: 'group', 'aria-labelledby': titleId });
		card.hidden = true;
		refs.suggestTitle = this._el('p', { id: titleId, class: 'wat-cc-subtitle' }, this._t('suggest.title', { slot: this._t('slots.fg') }));
		const detail = this._el('p', { class: 'wat-cc-suggest-detail' });
		refs.suggestChip = this._chip(this.draft.bg, this.draft.fg);
		refs.suggestText = this._el('span', { class: 'wat-cc-suggest-text' });
		detail.append(refs.suggestChip, refs.suggestText);

		const actions = this._el('div', { class: 'wat-cc-suggest-actions' });
		refs.suggestApply = this._el('button', { type: 'button', id: `${ID_PREFIX}_suggestApply`, class: ['wat-cc-button', 'wat-cc-primary'] }, this._t('suggest.apply'));
		refs.suggestApply.addEventListener('click', () => this._applySuggestion());
		refs.suggestManual = this._el('button', { type: 'button', id: `${ID_PREFIX}_suggestManual`, class: 'wat-cc-button' }, this._t('suggest.manual'));
		refs.suggestManual.addEventListener('click', () => this._declineSuggestion());
		actions.append(refs.suggestApply, refs.suggestManual);

		card.append(refs.suggestTitle, detail, actions);
		return card;
	}

	_buildActions() {
		const actions = this._el('div', { class: 'wat-cc-actions' });
		const save = this._el('button', { type: 'button', id: `${ID_PREFIX}_save`, class: ['wat-cc-button', 'wat-cc-primary'] }, this._t('actions.save'));
		save.addEventListener('click', () => this._save());
		const cancel = this._el('button', { type: 'button', id: `${ID_PREFIX}_cancel`, class: 'wat-cc-button' }, this._t('actions.cancel'));
		cancel.addEventListener('click', () => this._cancel());
		actions.append(save, cancel);
		return actions;
	}

	// ========== 사용자 동작 ==========

	_onUserChange(slot, hex) {
		this._setHexError(slot, false);
		this.draft = { ...this.draft, [slot]: hex };
		this.slotState = { ...this.slotState, [slot]: 'manual' };
		this.lastEdited = slot;
		const target = otherSlot(slot);
		this.suggestion = this.slotState[target] === 'manual' ? null : this._suggestFor(target);
		this._render();
		this._scheduleAnnouncement(this.suggestion ? this._suggestionMessage() : this._contrastMessage(slot));
	}

	_onPickerInput(slot) {
		const value = normalizeHex(this.refs.slots[slot].picker.value);
		if (!value) return;
		this.draft = { ...this.draft, [slot]: value };
		this._render();
	}

	_onHexCommit(slot) {
		const value = normalizeHex(this.refs.slots[slot].hex.value);
		if (!value) {
			this._setHexError(slot, true);
			return;
		}
		this._onUserChange(slot, value);
	}

	_applyPreset(preset) {
		SLOTS.forEach(slot => this._setHexError(slot, false));
		this.draft = { bg: preset.bg, fg: preset.fg };
		this.slotState = { bg: 'default', fg: 'default' };
		this.lastEdited = null;
		this.suggestion = null;
		this._render();
		const ratio = contrastRatio(preset.bg, preset.fg);
		this._scheduleAnnouncement(this._t('presetApplied', { name: this._t(`presets.${preset.id}`), ratio: this._formatRatio(ratio) }));
	}

	_applySuggestion() {
		const suggestion = this.suggestion;
		if (!suggestion) return;
		this._setHexError(suggestion.slot, false);
		this.draft = { ...this.draft, [suggestion.slot]: suggestion.hex };
		this.slotState = { ...this.slotState, [suggestion.slot]: 'suggested' };
		this.suggestion = null;
		this._render();
		// 카드가 숨겨지며 포커스를 잃지 않도록 바뀐 슬롯으로 옮긴다 (견본에 없는 색이면 코드 입력)
		this._focusSlot(suggestion.slot, true);
		this._scheduleAnnouncement(this._t('suggest.applied', {
			slot: this._t(`slots.${suggestion.slot}`),
			name: this._colorName(suggestion.hex, suggestion.slot)
		}));
	}

	_declineSuggestion() {
		const suggestion = this.suggestion;
		if (!suggestion) return;
		this._cancelAnnouncement();
		this.suggestion = null;
		this._render();
		this._focusSlot(suggestion.slot, false);
	}

	_requestSuggestion() {
		const target = this.lastEdited ? otherSlot(this.lastEdited) : 'fg';
		this.suggestion = this._suggestFor(target);
		if (!this.suggestion) return;
		this._render();
		this.refs.suggestApply.focus();
		this._scheduleAnnouncement(this._suggestionMessage());
	}

	_save() {
		this._cancelAnnouncement();
		const colors = { ...this.draft };
		const plugin = this.plugin;
		if (!plugin.setCustomColors(colors)) {
			plugin._notify(this._t('msg.saveFailed'), { type: 'error' });
			return;
		}
		this.slotState = { bg: 'default', fg: 'default' };
		this.lastEdited = null;
		this.suggestion = null;
		this._render();
		// 낮은 대비가 편한 사용자도 있어 막지는 않되 알린다
		const ratio = contrastRatio(colors.bg, colors.fg);
		if (ratio < CONTRAST.AA) {
			plugin._notify(this._t('msg.savedLow', { ratio: this._formatRatio(ratio) }), { type: 'warning' });
		} else {
			plugin._notify(this._t('msg.saved'), { type: 'success' });
		}
	}

	_cancel() {
		this._cancelAnnouncement();
		SLOTS.forEach(slot => this._setHexError(slot, false));
		this._resetDraft();
		this._render();
		this.plugin._announceToLiveRegion(this._t('msg.canceled'), 'polite');
	}

	// ========== 상태·표시 ==========

	_resetDraft() {
		const saved = this.plugin.getCustomColors();
		this.draft = { ...(saved || CUSTOM_COLOR_DEFAULTS) };
		this.slotState = { bg: 'default', fg: 'default' };
		this.lastEdited = null;
		this.suggestion = null;
	}

	/** 상대편 색(anchor)에 맞춘 target 슬롯 추천 — 이미 7:1 이상이면 null */
	_suggestFor(target) {
		const result = suggestCounterpart(this.draft[otherSlot(target)], this.draft[target]);
		if (!result || result.method === 'keep') return null;
		return { slot: target, hex: result.hex, ratio: result.ratio };
	}

	_render() {
		const refs = this.refs;
		if (!refs) return;
		const { bg, fg } = this.draft;
		const theme = deriveThemeColors(bg, fg);

		refs.preview.style.backgroundColor = bg;
		refs.preview.style.color = fg;
		refs.previewLink.style.color = theme.link;
		refs.previewLink.style.textDecorationLine = theme.linkUnderline ? 'underline' : 'none';

		const ratio = contrastRatio(bg, fg);
		const level = contrastLevel(ratio);
		refs.contrast.dataset.level = level;
		refs.contrastGlyph.textContent = LEVEL_GLYPHS[level];
		refs.contrastText.textContent = `${this._t('contrast.label', { ratio: this._formatRatio(ratio) })} · ${this._t(`contrast.${level}`)}`;
		refs.request.hidden = !(ratio < CONTRAST.AA && !this.suggestion);

		SLOTS.forEach(slot => this._renderSlot(slot));
		this._renderSuggestion();
		this._updateFilterNotice();
	}

	_renderSlot(slot) {
		const slotRefs = this.refs.slots[slot];
		const value = this.draft[slot];
		slotRefs.radios.forEach(radio => { radio.checked = radio.value === value; });
		// 같은 값을 다시 넣으면 끄는 중인 색 선택기·입력 중인 커서가 흔들리므로 다를 때만
		if (slotRefs.picker.value !== value) slotRefs.picker.value = value;
		slotRefs.current.textContent = ` (${this._t('current', { name: this._colorName(value, slot) })})`;
		// 거부된 입력은 반대편 슬롯을 바꾸는 동안에도 남겨 둔다 — 그 슬롯을 다시 고르거나 취소·견본 조합을 고르면 지운다
		if (slotRefs.hex.hasAttribute('aria-invalid')) return;
		if (slotRefs.hex.value !== value) slotRefs.hex.value = value;
	}

	_renderSuggestion() {
		const refs = this.refs;
		const suggestion = this.suggestion;
		if (!suggestion) {
			refs.card.hidden = true;
			return;
		}
		const combo = { ...this.draft, [suggestion.slot]: suggestion.hex };
		refs.suggestTitle.textContent = this._t('suggest.title', { slot: this._t(`slots.${suggestion.slot}`) });
		refs.suggestChip.style.backgroundColor = combo.bg;
		refs.suggestChip.style.color = combo.fg;
		refs.suggestText.textContent = this._t('suggest.detail', {
			name: this._colorName(suggestion.hex, suggestion.slot),
			ratio: this._formatRatio(suggestion.ratio)
		});
		// 방금 바꾼 슬롯(추천 대상의 반대편) 바로 뒤에 둔다
		const anchor = this.refs.slots[otherSlot(suggestion.slot)].fieldset;
		if (anchor.nextElementSibling !== refs.card) anchor.after(refs.card);
		refs.card.hidden = false;
	}

	_setHexError(slot, invalid) {
		const { hex, hintId, error } = this.refs.slots[slot];
		if (invalid) {
			hex.setAttribute('aria-invalid', 'true');
			hex.setAttribute('aria-describedby', `${hintId} ${error.id}`);
		} else {
			hex.removeAttribute('aria-invalid');
			hex.setAttribute('aria-describedby', hintId);
		}
		error.hidden = !invalid;
	}

	_updateFilterNotice() {
		if (!this.refs) return;
		const saturation = document.documentElement.dataset.saturation;
		this.refs.notice.hidden = !saturation || saturation === 'initial';
	}

	_focusSlot(slot, preferHex) {
		const slotRefs = this.refs.slots[slot];
		const checked = slotRefs.radios.find(radio => radio.checked);
		if (checked) {
			checked.focus();
		} else if (preferHex) {
			slotRefs.hex.focus();
		} else {
			slotRefs.radios[0].focus();
		}
	}

	/** 소수 첫째 자리 내림 — 4.49가 "4.5"로 보여 기준 충족으로 오해되지 않게 */
	_formatRatio(ratio) {
		return floorRatio(ratio).toFixed(1);
	}

	/** 스크린리더가 hex를 한 글자씩 읽지 않도록 견본 이름이나 대략적인 색 이름을 쓴다 */
	_colorName(hex, slot) {
		const swatch = SWATCHES[slot].find(s => s.hex === hex) || SWATCHES[otherSlot(slot)].find(s => s.hex === hex);
		if (swatch) return this._t(`colorNames.${swatch.id}`);
		const description = describeColor(hex);
		if (!description) return hex;
		if (description.kind === 'neutral') return this._t(`colorNames.${description.key}`);
		const hue = this._t(`hues.${description.hue}`);
		if (description.tone === 'base') return hue;
		return this._t('colorPattern', { tone: this._t(`tones.${description.tone}`), hue });
	}

	// ========== 낭독 ==========

	_suggestionMessage() {
		const suggestion = this.suggestion;
		return this._t('suggest.announce', {
			slot: this._t(`slots.${suggestion.slot}`),
			name: this._colorName(suggestion.hex, suggestion.slot),
			ratio: this._formatRatio(suggestion.ratio)
		});
	}

	_contrastMessage(slot) {
		const ratio = contrastRatio(this.draft.bg, this.draft.fg);
		return this._t('contrastAnnounce', {
			slot: this._t(`slots.${slot}`),
			name: this._colorName(this.draft[slot], slot),
			ratio: this._formatRatio(ratio),
			level: this._t(`contrast.${contrastLevel(ratio)}`)
		});
	}

	_scheduleAnnouncement(message) {
		this._cancelAnnouncement();
		if (!message) return;
		this._announceTimer = this.plugin._setTimeout(() => {
			this._announceTimer = null;
			this.plugin._announceToLiveRegion(message, 'polite');
		}, ANNOUNCE_DELAY);
	}

	_cancelAnnouncement() {
		if (this._announceTimer) {
			this.plugin._clearTimeout(this._announceTimer);
			this._announceTimer = null;
		}
	}
}
