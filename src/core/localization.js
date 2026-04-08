/**
 * @fileoverview WAT 다국어 상수 정의
 * @module src/core/localization
 */

export class Localization {
	static SUPPORTED_LANGUAGES = ['ko', 'en-US', 'en-GB', 'ja', 'zh', 'de'];

	static DEFAULT_LANGUAGE = 'ko';

	static LANGUAGE_FILES = {
		'ko': 'ko.json',
		'en-US': 'en-US.json',
		'en-GB': 'en-GB.json',
		'ja': 'ja.json',
		'zh': 'zh.json',
		'de': 'de.json'
	};
}
