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
		overlay.classList.add('overlay', 'wat-overlay', 'wat-exclude');
		fragment.appendChild(overlay);

		// 모달 레이어 생성
		const layer = document.createElement('div');
		layer.id = 'pgStructure_layer';
		layer.classList.add('page-structure-layer', 'wat-exclude');
		layer.setAttribute('role', 'dialog');
		layer.setAttribute('aria-modal', 'true');
		layer.setAttribute('aria-labelledby', 'page-structure-title');
		layer.setAttribute('tabindex', '-1');
		// 호스트 <html lang>은 건드리지 않으므로 위젯 문구(제목·탭·버튼)가 위젯 언어로 읽히게 지정한다.
		// 목록의 페이지 글은 _hostText가 원래 언어로 감싼다. 열 때마다 지정해 언어를 바꾼 뒤에도 따라간다 (WCAG 3.1.2)
		this.plugin._applyWidgetLang(layer);

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
			{ id: 'pgStruct_landmark', text: this.plugin.getLocalizedText('panel.personal.options.pageStructure.text.tabList-landmark') },
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
			this.plugin.overlayManager.restoreFocus(previousFocusedElement);
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
				li.appendChild(this._hostText(text, heading));
				li.classList.add('pgStruct_item', 'heading', heading.tagName.toLowerCase());
				li.appendChild(this._createMarkerButton(text));

				li.addEventListener('click', () => this._moveTo(heading));
				panelList.appendChild(li);
			});
		} else if (tab.id === 'pgStruct_landmark') {
			const landmarks = this._collectLandmarks();

			landmarks.forEach(({ element, role, label }) => {
				const li = document.createElement('li');
				li.classList.add('pgStruct_item', 'landmark');
				// 역할명은 로케일의 자연어 표기 사용 (미정의 역할은 토큰 폴백), 이름이 있으면 병기
				const roleLabel = this.plugin.getLocalizedText(`panel.personal.options.pageStructure.landmarks.${role}`) || role;
				li.textContent = roleLabel;
				if (label) li.append(' — ', this._hostText(label, element));
				li.appendChild(this._createMarkerButton(label ? `${roleLabel} — ${label}` : roleLabel));

				li.addEventListener('click', () => this._moveTo(element));
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
				tag_a.appendChild(this._hostText(linkLabel, link));
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

				const btn_marker = this._createMarkerButton(linkLabel);
				btn_marker.addEventListener('click', () => this._moveTo(link));
				li.appendChild(btn_marker);
				panelList.appendChild(li);
			});
		}

		tabPanel.appendChild(panelList);
		return tabPanel;
	}

	/**
	 * 페이지의 랜드마크 영역을 수집합니다 (문서 순서 유지)
	 * @returns {Array<{element: Element, role: string, label: string}>}
	 * @private
	 * @description header/footer는 섹셔닝 콘텐츠 내부에 있으면 랜드마크가 아니므로 제외하고,
	 *              section/form/[role=region]은 접근 가능한 이름이 있을 때만 랜드마크로 취급한다
	 */
	_collectLandmarks() {
		const roleByTag = { main: 'main', nav: 'navigation', aside: 'complementary', header: 'banner', footer: 'contentinfo', section: 'region', form: 'form' };
		const candidates = document.querySelectorAll(
			'main, nav, aside, header, footer, section, form, ' +
			'[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], ' +
			'[role="complementary"], [role="search"], [role="region"], [role="form"]'
		);
		const selector = this.plugin.selector;
		const results = [];

		candidates.forEach(element => {
			// 도구 자신·명시적 제외 영역·숨김 요소 제외
			if (element.closest(selector) || element.closest('.wat-exclude')) return;
			if (!this._isVisibleForListing(element)) return;

			const explicitRole = element.getAttribute('role');
			const tag = element.tagName.toLowerCase();
			const role = explicitRole || roleByTag[tag];
			if (!role) return;

			// header/footer는 body 직속 문맥에서만 banner/contentinfo 랜드마크
			if (!explicitRole && (tag === 'header' || tag === 'footer') &&
				element.parentElement && element.parentElement.closest('main, article, section, aside, nav')) {
				return;
			}

			const label = this._getAccessibleLabel(element);
			// 이름 없는 region/form은 랜드마크로 안내되지 않으므로 제외
			if ((role === 'region' || role === 'form') && !label) return;

			results.push({ element, role, label });
		});
		return results;
	}

	/**
	 * 요소의 접근 가능한 이름(aria-label/aria-labelledby)을 얻습니다
	 * @param {Element} element
	 * @returns {string}
	 * @private
	 */
	_getAccessibleLabel(element) {
		const ariaLabel = element.getAttribute('aria-label');
		if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

		const labelledby = element.getAttribute('aria-labelledby');
		if (labelledby) {
			const text = labelledby.split(/\s+/)
				.map(id => { const el = document.getElementById(id); return el ? el.textContent.trim() : ''; })
				.filter(Boolean)
				.join(' ');
			if (text) return text;
		}
		return '';
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
	 * 대화상자를 닫고 고른 항목 위치로 이동하며 포커스도 옮깁니다
	 * @param {Element} target - 이동할 제목·랜드마크·링크
	 * @returns {void}
	 * @private
	 * @description 대화상자만 닫으면 포커스가 body로 사라진다 (WCAG 2.4.3). 제목·랜드마크처럼 포커스를
	 *              받을 수 없는 요소는 임시 tabindex=-1을 주고, 포커스가 떠나면 지워 페이지 탭 순서를 바꾸지 않는다
	 */
	_moveTo(target) {
		this.closePageStructure();
		const focusable = target.matches('a[href], area[href], button, input, select, textarea, [tabindex], [contenteditable="true"]');
		if (!focusable) {
			target.setAttribute('tabindex', '-1');
			target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
		}
		target.focus({ preventScroll: true });
		target.scrollIntoView({ behavior: 'smooth' });
	}

	/**
	 * 페이지에서 가져온 글을 그 글이 쓰인 언어로 감쌉니다
	 * @param {string} text - 페이지의 제목·랜드마크 이름·링크 글자
	 * @param {Element} source - 글을 가져온 요소 — 가장 가까운 lang 조상으로 언어를 정한다
	 * @returns {HTMLSpanElement}
	 * @private
	 * @description 대화상자에 위젯 언어를 지정하므로 감싸지 않으면 페이지 글까지 위젯 언어로 읽힌다 (WCAG 3.1.2).
	 *              페이지에 언어 지정이 없으면 lang=""(언어 미상)으로 두어 위젯 언어를 물려받지 않게 한다
	 */
	_hostText(text, source) {
		const span = document.createElement('span');
		const owner = source.closest('[lang]');
		span.setAttribute('lang', owner ? owner.getAttribute('lang') : '');
		span.textContent = text;
		return span;
	}

	/**
	 * 항목 위치로 이동하는 마커 버튼(위치 표시 아이콘)을 생성합니다
	 * @param {string} [itemText] - 이동할 항목의 텍스트 — 버튼 이름에 넣어 버튼마다 이름이 달라지게 한다 (WCAG 2.4.6)
	 * @returns {HTMLButtonElement}
	 * @private
	 */
	_createMarkerButton(itemText) {
		const btn_marker = document.createElement('button');
		btn_marker.classList.add('btn_marker');
		const markerText = this.plugin.getLocalizedText('panel.personal.options.pageStructure.options.marker');
		const trimmedItemText = (itemText || '').trim();
		const markerLabel = trimmedItemText ? `${trimmedItemText} ${markerText}` : markerText;
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
		// 레이어·오버레이 제거 + 스크롤 잠금 정리(교차 모달 안전) — OverlayManager로 통합.
		// (기존 무조건 해제 → 남은 .wat-overlay가 없을 때만 해제로 수렴)
		this.plugin.overlayManager.teardown(layer, overlay);
	}
}
