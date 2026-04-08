	// DOM 로딩 완료 후 WAT 초기화
	document.addEventListener('DOMContentLoaded', () => {
		const watOptions = {
			configPath: './accTest/config.json',		// config.json
		};
			// 기본 설정으로 WAT 초기화
			//const wat = new WAT();
			const wat = new WAT(watOptions);
			window.watPlugin = wat;
			wat.init();

			// 초기화 완료 후 환영 메시지
			document.addEventListener('wat:initialized', () => {
				console.log('웹 접근성 도구가 준비되었습니다! 21');
			});
	});