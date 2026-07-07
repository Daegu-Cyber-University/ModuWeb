/**
 * @fileoverview KeyboardTTS - 키보드 단축키로 선택된 텍스트를 읽어주는 기능
 * @module src/tts/KeyboardTTS
 */
import { BaseTTS } from './BaseTTS.js';

export class KeyboardTTS extends BaseTTS {
	constructor(ttsManager) {
		super(ttsManager);
	}

	execute() {
		const selection = window.getSelection();
		const selectedText = selection.toString().trim();

		if (!selectedText) {
			this.plugin.showNotification('No text selected. (선택된 텍스트가 없습니다.)');
			return;
		}

		if (selection.rangeCount > 0) {
			this.originalSelection = selection.getRangeAt(0).cloneRange();
			this._createHighlightWrapper(
				this.originalSelection,
				'wat-keyboard-tts',
				'box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.4) !important;'
			);
			this._speakText(selectedText, {
				onEnd: () => this._scheduleHighlightRemoval(500),
				onError: () => this._removeHighlight()
			});
		}
	}
}
