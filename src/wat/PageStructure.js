/**
 * @fileoverview PageStructure - 페이지 구조(제목/링크) 분석 다이얼로그 담당
 * @module src/wat/PageStructure
 * @description WAT.js에서 추출된 페이지 구조 클러스터 (Phase 6-3).
 *              페이지의 제목 계층·링크 목록을 수집해 접근성 모달(role=dialog,
 *              aria-modal, 포커스 트랩)로 표시한다. 메서드명의 structure_ 접두는
 *              추출 과정에서 정규화됨 (createTabButton/createTabPanel).
 */

export class PageStructure {
	/**
	 * @param {Object} plugin - WAT 인스턴스 (로케일·포커스트랩·자산 경로·셀렉터 서비스 제공자)
	 */
	constructor(plugin) {
		this.plugin = plugin;
	}

	/**
	 * 페이지 구조 분석 다이얼로그(제목/링크 탭)를 엽니다
	 * @returns {void}
	 */
	openPageStructure() {
		// 현재 포커스된 요소를 저장하여 다이얼로그 종료 후 복원
		const previousFocusedElement = document.activeElement;

		// DocumentFragment를 사용해 DOM 조작을 최소화
		const fragment = document.createDocumentFragment();
		const body = document.body;
		body.classList.add('overlay-active');

		// 오버레이 생성 및 추가 — 호스트 페이지의 .overlay와 구분되도록 플러그인 클래스 병기
		const overlay = document.createElement('div');
		overlay.classList.add('overlay', 'wat-overlay');
		fragment.appendChild(overlay);

		// 모달 레이어 생성
		const layer = document.createElement('div');
		layer.id = 'pgStructure_layer';
		layer.classList.add('page-structure-layer');
		layer.setAttribute('role', 'dialog');
		layer.setAttribute('aria-modal', 'true');
		layer.setAttribute('aria-labelledby', 'page-structure-title');
		layer.setAttribute('tabindex', '-1');

		// 타이틀 생성
		const layerTitle = document.createElement('h3');
		layerTitle.id = 'page-structure-title';
		layerTitle.textContent = this.plugin.getLocalizedText('panel.personal.options.pageStructure.title');
		layer.appendChild(layerTitle);

		// 탭 목록과 콘텐츠 컨테이너 생성
		const layerTabWrap = document.createElement('div');
		layerTabWrap.classList.add('tab-wrap');
		layerTabWrap.setAttribute('role', 'tablist');

		const layerContentWrap = document.createElement('div');
		layerContentWrap.classList.add('tab-content-wrap');

		// 탭 데이터 배열 (필요시 탭 추가 가능)
		const tabListData = [
			{ id: 'pgStruct_heading', text: this.plugin.getLocalizedText('panel.personal.options.pageStructure.text.tabList-heading') },
			{ id: 'pgStruct_link', text: this.plugin.getLocalizedText('panel.personal.options.pageStructure.text.tabList-link') }
		];

		// 탭 버튼과 탭 패널 생성
		tabListData.forEach((tab, index) => {
			const tabButton = this.createTabButton(tab, index);
			layerTabWrap.appendChild(tabButton);

			const tabPanel = this.createTabPanel(tab, index);
			layerContentWrap.appendChild(tabPanel);
		});

		layer.appendChild(layerTabWrap);
		layer.appendChild(layerContentWrap);

		// 닫기 버튼 생성
		const closeButton = document.createElement('button');
		closeButton.textContent = this.plugin.getLocalizedText('tags.button.text.close');
		closeButton.classList.add('btnClose');
		closeButton.addEventListener('click', () => {
			this.closePageStructure();
			if (previousFocusedElement) {
				previousFocusedElement.focus();
			} else {
				body.focus();
			}
		});
		layer.appendChild(closeButton);

		fragment.appendChild(layer);
		body.appendChild(fragment);
		layer.focus();

		// 포커스 트랩 설정 (공용 프리미티브 재사용)
		this.plugin.trapFocus(layer, previousFocusedElement, overlay);
	}

	/**
	 * 다이얼로그용 탭 버튼을 생성합니다 (ARIA + 좌우 화살표 키 탐색)
	 * @param {Object} tab - {id, text}
	 * @param {number} index - 탭 인덱스 (0이 초기 선택)
	 * @returns {HTMLButtonElement}
	 */
	createTabButton(tab, index) {
		const tabButton = document.createElement('button');
		tabButton.classList.add('tab-title');
		tabButton.id = `${tab.id}_tab`;
		tabButton.setAttribute('role', 'tab');
		tabButton.textContent = tab.text;
		tabButton.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
		tabButton.setAttribute('tabindex', index === 0 ? '0' : '-1');
		tabButton.setAttribute('data-target-panel', `${tab.id}_panel`);

		tabButton.addEventListener('click', () => {
			// 모든 탭 버튼 업데이트
			const allTabs = tabButton.parentElement.querySelectorAll('.tab-title');
			allTabs.forEach(btn => {
				btn.setAttribute('aria-selected', 'false');
				btn.setAttribute('tabindex', '-1');
			});
			tabButton.setAttribute('aria-selected', 'true');
			tabButton.setAttribute('tabindex', '0');

			// 모든 탭 패널 업데이트
			const allPanels = tabButton.closest('.page-structure-layer').querySelectorAll('.tab-content');
			allPanels.forEach(panel => {
				panel.setAttribute('aria-hidden', 'true');
				panel.style.display = 'none';
			});
			const targetPanel = document.getElementById(`${tab.id}_panel`);
			targetPanel.setAttribute('aria-hidden', 'false');
			targetPanel.style.display = 'block';
			targetPanel.focus();
		});

		tabButton.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowRight') {
				const nextTab = tabButton.nextElementSibling || tabButton.parentElement.firstElementChild;
				nextTab.focus();
			} else if (e.key === 'ArrowLeft') {
				const prevTab = tabButton.previousElementSibling || tabButton.parentElement.lastElementChild;
				prevTab.focus();
			}
		});

		return tabButton;
	}

	/**
	 * 페이지 구조 콘텐츠(제목 계층 또는 링크 목록) 탭 패널을 생성합니다
	 * @param {Object} tab - {id}
	 * @param {number} index - 패널 인덱스 (0이 초기 표시)
	 * @returns {HTMLDivElement}
	 * @description 도구 자신(this.plugin.selector 내부)과 숨김 요소(.blind 조상,
	 *              aria-hidden, hidden, display:none, visibility:hidden)는 제외한다
	 */
	createTabPanel(tab, index) {
		const tabPanel = document.createElement('div');
		tabPanel.classList.add('tab-content');
		tabPanel.id = `${tab.id}_panel`;
		tabPanel.setAttribute('role', 'tabpanel');
		tabPanel.setAttribute('aria-labelledby', `${tab.id}_tab`);
		tabPanel.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
		tabPanel.style.display = index === 0 ? 'block' : 'none';

		// 패널 내 목록 생성
		const panelList = document.createElement('ul');
		const selector = this.plugin.selector;

		if (tab.id === 'pgStruct_heading') {
			// 도구 컨테이너 내부에 있는 heading 태그 제외
			const allHeadings = document.querySelectorAll(
				`h1:not(${selector} h1), h2:not(${selector} h2), h3:not(${selector} h3), h4:not(${selector} h4), h5:not(${selector} h5), h6:not(${selector} h6)`
			);
			// heading 태그의 조상 중에 (해당 태그 자체를 제외하고) .blind, aria-hidden="true", hidden, display:none, visibility:hidden이 있는 경우 제외
			const headings = Array.from(allHeadings).filter(heading => this._isVisibleForListing(heading));

			headings.forEach(heading => {
				const li = document.createElement('li');
				// 개행, 탭 문자를 제거한 텍스트 추출
				let text = heading.textContent.replace(/[\r\n\t]/g, '');
				// 텍스트가 없으면 내부 img의 alt 속성 사용
				if (!text.trim()) {
					const img = heading.querySelector('img[alt]');
					if (img) {
						text = img.alt;
					}
				}
				li.textContent = text;
				li.classList.add('pgStruct_item', 'heading', heading.tagName.toLowerCase());
				li.appendChild(this._createMarkerButton());

				li.addEventListener('click', () => {
					this.closePageStructure();
					heading.scrollIntoView({ behavior: 'smooth' });
				});
				panelList.appendChild(li);
			});
		} else if (tab.id === 'pgStruct_link') {
			// 링크 모아보기: 도구 컨테이너 내부의 링크 제외
			const allLinks = document.querySelectorAll(`a:not(${selector} a)`);
			// 링크의 조상 중에 조건에 해당하는 요소가 있으면 제외
			const links = Array.from(allLinks).filter(link => this._isVisibleForListing(link));

			links.forEach(link => {
				const li = document.createElement('li');
				li.classList.add('pgStruct_item', 'link');

				const tag_a = document.createElement('a');
				// decodeURI는 '%' 포함 일반 텍스트에서 URIError를 던지므로 href에만 시도하고 실패 시 원문 사용
				let linkLabel = (link.textContent || '').trim();
				if (!linkLabel) {
					try {
						linkLabel = decodeURI(link.href);
					} catch (e) {
						linkLabel = link.href;
					}
				}
				tag_a.textContent = linkLabel;
				tag_a.href = link.href;
				tag_a.target = '_blank';
				tag_a.title = link.title || this.plugin.getLocalizedText('text.newWindow');
				tag_a.classList.add('pgStruct_link');

				const img_link = document.createElement('img');
				img_link.classList.add('img_icon', 'link');
				img_link.src = this.plugin._assetUrl('assets/images/icon_pgStructure_link.svg');
				img_link.alt = this.plugin.getLocalizedText('panel.personal.options.pageStructure.options.link');
				tag_a.appendChild(img_link);
				li.appendChild(tag_a);

				const btn_marker = this._createMarkerButton();
				btn_marker.addEventListener('click', () => {
					this.closePageStructure();
					link.scrollIntoView({ behavior: 'smooth' });
				});
				li.appendChild(btn_marker);
				panelList.appendChild(li);
			});
		}

		tabPanel.appendChild(panelList);
		return tabPanel;
	}

	/**
	 * 목록 대상 요소가 사용자에게 보이는지 판단합니다 (숨김 조상 검사)
	 * @param {Element} element - 검사할 요소
	 * @returns {boolean} 목록에 포함해도 되면 true
	 * @private
	 */
	_isVisibleForListing(element) {
		// 조상에 blind 클래스가 있는지 검사 (요소 자체에 blind 클래스가 있는 경우는 허용)
		const blindAncestor = element.closest('.blind');
		if (blindAncestor && blindAncestor !== element) {
			return false;
		}
		// 부모 요소부터 최상위까지 순회하며 검사
		let current = element.parentElement;
		while (current) {
			if (
				current.getAttribute('aria-hidden') === 'true' ||
				current.hasAttribute('hidden')
			) {
				return false;
			}
			const computedStyle = window.getComputedStyle(current);
			if (
				computedStyle.display === 'none' ||
				computedStyle.visibility === 'hidden'
			) {
				return false;
			}
			current = current.parentElement;
		}
		return true;
	}

	/**
	 * 항목 위치로 이동하는 마커 버튼(위치 표시 아이콘)을 생성합니다
	 * @returns {HTMLButtonElement}
	 * @private
	 */
	_createMarkerButton() {
		const btn_marker = document.createElement('button');
		btn_marker.classList.add('btn_marker');
		const markerLabel = this.plugin.getLocalizedText('panel.personal.options.pageStructure.options.marker');
		const img = document.createElement('img');
		img.classList.add('img_icon', 'marker');
		img.src = this.plugin._assetUrl('assets/images/icon_pgStructure_marker.svg');
		img.alt = markerLabel;
		btn_marker.appendChild(img);
		btn_marker.title = markerLabel;
		return btn_marker;
	}

	/**
	 * 페이지 구조 다이얼로그를 닫고 오버레이·스크롤 잠금을 정리합니다
	 * @returns {void}
	 */
	closePageStructure() {
		const layer = document.getElementById('pgStructure_layer');
		// 플러그인이 만든 오버레이만 제거 (호스트 페이지의 .overlay 오삭제 방지)
		const overlay = document.querySelector('.overlay.wat-overlay');
		const body = document.body;
		if (layer) {
			layer.classList.add('hidden');
			layer.remove();
		}
		if (overlay) {
			overlay.remove();
		}
		body.classList.remove('overlay-active');
	}
}
