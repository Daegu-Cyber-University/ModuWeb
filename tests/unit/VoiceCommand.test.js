/**
 * @fileoverview VoiceCommand 파싱 로직 단위 테스트
 * SpeechRecognition 없이 생성 가능한 순수/준순수 파싱 메서드를 검증한다.
 * (생성자는 SpeechRecognition 을 참조하지 않으므로 최소 mock plugin 으로 인스턴스화 가능)
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { VoiceCommand } from '../../src/stt/VoiceCommand.js';

/**
 * 파싱 테스트에 필요한 최소 sttManager/plugin mock 을 생성한다.
 * getLocalizedText 미제공 시 VoiceCommand 는 한국어 기본 명령어를 사용한다.
 * @param {Object} [pluginOverrides]
 * @returns {Object} sttManager mock
 */
function createSttManagerMock(pluginOverrides = {}) {
	const plugin = {
		showNotification: () => {},
		...pluginOverrides
	};
	return {
		plugin,
		config: {
			language: 'ko-KR',
			interimResults: false,
			maxAlternatives: 1
		}
	};
}

describe('VoiceCommand - 인스턴스 생성', () => {
	test('SpeechRecognition 없이도 생성됨', () => {
		const vc = new VoiceCommand(createSttManagerMock());
		expect(vc).toBeInstanceOf(VoiceCommand);
	});

	test('plugin 이 getLocalizedText 를 제공하지 않으면 기본 명령어 사용', () => {
		const vc = new VoiceCommand(createSttManagerMock());
		expect(vc.commands.navigation).toEqual(['이동', '링크', '클릭']);
		expect(vc.commands.action).toEqual(['실행', '켜기', '끄기', '종료']);
		expect(vc.commands.settings).toEqual(['설정', '옵션', '메뉴']);
	});
});

describe('VoiceCommand._loadLocalizedCommands', () => {
	test('로케일 텍스트에서 콤마 구분 키워드를 파싱', () => {
		const getLocalizedText = (key) => {
			const map = {
				'command.voiceCommands.navigation': '이동, 링크, 클릭, 스크롤',
				'command.voiceCommands.action': '실행, 켜기',
				'command.voiceCommands.settings': '설정'
			};
			return map[key];
		};
		const vc = new VoiceCommand(createSttManagerMock({ getLocalizedText }));
		expect(vc.commands.navigation).toEqual(['이동', '링크', '클릭', '스크롤']);
		expect(vc.commands.action).toEqual(['실행', '켜기']);
		expect(vc.commands.settings).toEqual(['설정']);
	});

	test('빈 로케일 텍스트는 기본값으로 폴백', () => {
		const getLocalizedText = () => '   ';
		const vc = new VoiceCommand(createSttManagerMock({ getLocalizedText }));
		expect(vc.commands.navigation).toEqual(['이동', '링크', '클릭']);
	});

	test('refreshCommands 는 명령어를 다시 로드', () => {
		let value = '이동';
		const getLocalizedText = (key) =>
			key === 'command.voiceCommands.navigation' ? value : '';
		const vc = new VoiceCommand(createSttManagerMock({ getLocalizedText }));
		expect(vc.commands.navigation).toEqual(['이동']);
		value = '이동, 링크';
		vc.refreshCommands();
		expect(vc.commands.navigation).toEqual(['이동', '링크']);
	});
});

describe('VoiceCommand._analyzeCommand', () => {
	let vc;

	beforeEach(() => {
		vc = new VoiceCommand(createSttManagerMock());
	});

	test('명령어와 대상을 분리', () => {
		const result = vc._analyzeCommand('클릭 로그인');
		expect(result.command).toBe('클릭');
		expect(result.target).toBe('로그인');
	});

	test('설정 명령어 인식', () => {
		const result = vc._analyzeCommand('설정 메뉴');
		expect(result.command).toBe('설정');
		expect(result.target).toBe('메뉴');
	});

	test('일치하는 명령어가 없으면 null 반환', () => {
		const result = vc._analyzeCommand('안녕하세요 반갑습니다');
		expect(result.command).toBeNull();
		expect(result.target).toBeNull();
	});

	test('최장 일치 우선 (부분 문자열 오매칭 완화)', () => {
		// '이동' 과 '페이지이동' 이 모두 존재할 때 더 긴 명령어가 우선 매칭되어야 함
		vc.commands = {
			navigation: ['이동', '페이지이동'],
			action: [],
			settings: []
		};
		const result = vc._analyzeCommand('페이지이동');
		expect(result.command).toBe('페이지이동');
		expect(result.target).toBe('');
	});
});

describe('VoiceCommand._isTextMatching', () => {
	let vc;

	beforeEach(() => {
		vc = new VoiceCommand(createSttManagerMock());
	});

	test('대소문자 무시 부분 일치', () => {
		expect(vc._isTextMatching(['Login Button'], 'login', 'login')).toBe(true);
	});

	test('공백 제거 후 일치', () => {
		expect(vc._isTextMatching(['로그 인'], '로그인', '로그인')).toBe(true);
	});

	test('일치하지 않으면 false', () => {
		expect(vc._isTextMatching(['취소'], '확인', '확인')).toBe(false);
	});
});

describe('VoiceCommand._collectElementTexts', () => {
	let vc;

	beforeEach(() => {
		vc = new VoiceCommand(createSttManagerMock());
		document.body.innerHTML = '';
	});

	test('버튼의 textContent 수집', () => {
		document.body.innerHTML = '<button id="b">저장</button>';
		const el = document.getElementById('b');
		expect(vc._collectElementTexts(el)).toContain('저장');
	});

	test('input value / aria-label / title 수집', () => {
		document.body.innerHTML =
			'<input id="i" type="submit" value="제출" title="폼 제출" aria-label="제출 버튼">';
		const el = document.getElementById('i');
		const texts = vc._collectElementTexts(el);
		expect(texts).toContain('제출');
		expect(texts).toContain('폼 제출');
		expect(texts).toContain('제출 버튼');
	});

	test('이미지 alt 텍스트 수집', () => {
		document.body.innerHTML = '<a id="a"><img alt="홈으로"></a>';
		const el = document.getElementById('a');
		expect(vc._collectElementTexts(el)).toContain('홈으로');
	});
});

describe('VoiceCommand._findTargetElements', () => {
	let vc;

	beforeEach(() => {
		vc = new VoiceCommand(createSttManagerMock());
		document.body.innerHTML = '';
	});

	test('텍스트로 대상 요소를 찾음', () => {
		document.body.innerHTML = `
			<button>로그인</button>
			<a href="#">회원가입</a>
			<button>취소</button>
		`;
		const found = vc._findTargetElements('로그인');
		expect(found.length).toBe(1);
		expect(found[0].textContent).toBe('로그인');
	});

	test('공백이 포함된 텍스트도 매칭', () => {
		document.body.innerHTML = '<button>로그 인</button>';
		const found = vc._findTargetElements('로그인');
		expect(found.length).toBe(1);
	});

	test('일치하는 요소가 없으면 빈 배열', () => {
		document.body.innerHTML = '<button>저장</button>';
		const found = vc._findTargetElements('존재하지않는텍스트');
		expect(found).toEqual([]);
	});

	test('여러 요소가 매칭되면 모두 반환', () => {
		document.body.innerHTML = `
			<button>메뉴 열기</button>
			<a href="#">메뉴 닫기</a>
		`;
		const found = vc._findTargetElements('메뉴');
		expect(found.length).toBe(2);
	});
});
