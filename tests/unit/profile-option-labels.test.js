/**
 * @fileoverview 프로필 UI의 라벨 — 빈 체크박스 라벨, 언어 변경 뒤 덮어써지는 프로필 제목 (WCAG 1.3.1·2.4.6·4.1.2)
 * @description
 *   - 프로필 항목 체크박스 라벨을 panel.personal.options.<설정키>.title로 조회해, 로케일 그룹명이 다른
 *     설정(stopAni→animationControl, mediaStop→mediaControl)은 라벨이 빈 문자열이었다(움직임 민감 프로필).
 *   - updateTextLocalization이 첫 번째 프로필 제목(저시력)을 '시각 장애'로 덮어써, 언어를 바꾸면
 *     저시력 프로필이 시각 장애로 표시·낭독됐다.
 *   실제 로케일 파일로 실제 createProfileSettings를 그린다.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WAT } from '../../src/wat/WAT.js';
import { StateManager } from '../../src/wat/StateManager.js';
import { Defaults } from '../../src/core/defaults.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', '..', 'dist', 'assets', 'locales');
const readLocale = (lang) => JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8'));

function mountProfiles(lang = 'ko') {
	const wat = Object.create(WAT.prototype);
	wat.options = {};
	wat.state = new StateManager({ locale: readLocale(lang) });
	wat._setTimeout = jest.fn();
	const container = document.createElement('div');
	document.body.appendChild(container);
	wat.createProfileSettings(container);
	return wat;
}

/** 프로필 항목 체크박스의 라벨 글자 */
const itemLabel = (profile, key) => document.querySelector(`label[for="watSet_checkbox_${profile}_${key}"]`).textContent;
/** 프로필 제목 라벨 글자 */
const profileTitle = (profile) => document.getElementById(`watSet_profile_title_label_${profile}`).textContent;

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('프로필 항목 체크박스 라벨', () => {
	test('움직임 민감: 애니메이션·미디어 정지 체크박스에 개별 설정과 같은 이름이 붙는다', () => {
		mountProfiles('ko');

		expect(itemLabel('motionSensitivity', 'stopAni')).toBe('애니메이션 제어');
		expect(itemLabel('motionSensitivity', 'mediaStop')).toBe('미디어 제어');
	});

	test('모든 프로필의 모든 항목 체크박스 라벨이 비어 있지 않다', () => {
		mountProfiles('ko');

		const empty = [];
		Object.entries(Defaults.PROFILES).forEach(([profile, { settings }]) => {
			Object.keys(settings).forEach((key) => {
				if (!itemLabel(profile, key).trim()) empty.push(`${profile}.${key}`);
			});
		});
		expect(empty).toEqual([]);
	});
});

describe('updateTextLocalization — 프로필 제목을 덮어쓰지 않는다', () => {
	test('저시력 프로필 제목은 그대로 저시력이다', () => {
		const wat = mountProfiles('ko');

		wat.updateTextLocalization();

		expect(profileTitle('lowVision')).toBe('저시력');
		expect(profileTitle('visualImpairment')).toBe('시각 장애');
	});

	test('지금 로케일로 각 프로필 제목을 자기 이름으로 맞춘다', () => {
		const wat = mountProfiles('ko');
		wat.state.set('locale', readLocale('en-US'));

		wat.updateTextLocalization();

		expect(profileTitle('lowVision')).toBe('Low Vision');
		expect(profileTitle('motionSensitivity')).toBe('Motion Sensitivity');
	});
});
