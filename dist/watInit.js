	// 스크립트 로드 시점에 자신의 src 기준으로 config.json 절대 경로 계산
	// (문서 URL 기준 상대 경로는 하위 페이지에서 404가 나므로)
	const watConfigPath = new URL('./config.json', (document.currentScript && document.currentScript.src) || document.baseURI).href;

	// DOM 로딩 완료 후 WAT 초기화
	document.addEventListener('DOMContentLoaded', () => {
		const watOptions = {
			configPath: watConfigPath,		// config.json
		};
			// 기본 설정으로 WAT 초기화
			//const wat = new WAT();
			const wat = new WAT(watOptions);
			window.watPlugin = wat;
			wat.init();

			// 초기화 완료 후 환영 메시지
			document.addEventListener('wat:initialized', () => {
				console.log('웹 접근성 도구가 준비되었습니다!');
			});
	});
