/**
 * @fileoverview OverlayManager - 모달 오버레이 공통 프리미티브
 * @module src/wat/OverlayManager
 * @description WAT.js에서 추출·통합된 모달 오버레이 접근성 프리미티브 (Phase 6-8).
 *              사전(Dictionary)·페이지구조(PageStructure) 모달이 공유하는
 *              포커스 트랩(Tab 순환)·Escape 닫기·오버레이 정리·포커스 복원을 한곳에서 담당한다.
 *
 *              설계 노트:
 *              - aria-modal / 배경 오버레이 / 포커스 트랩이 이미 모달 격리를 제공하므로
 *                `inert`는 도입하지 않았다(오적용 시 페이지 전역 조작 불능이라는 심각한 실패 모드
 *                대비 한계 이득이 작고, 이 저장소 환경에서 브라우저 회귀 검증이 불가). — 향후 과제.
 *              - 대상 오버레이가 애니메이션을 사용하지 않아 reduced-motion 처리는 no-op.
 *              - overlay-active(스크롤 잠금) 해제는 '남은 .wat-overlay가 없을 때만'으로 통일한다
 *                (기존에 Escape·PageStructure 경로가 무조건 해제하던 불일치를 교차 모달 안전 규칙으로 수렴).
 */
export class OverlayManager {
	/**
	 * @param {Object} [plugin] - WAT 인스턴스 (현재 트랩/정리 로직은 plugin에 의존하지 않음)
	 */
	constructor(plugin) {
		this.plugin = plugin;
	}

	/**
	 * 모달 레이어에 포커스 트랩(Tab 순환)과 Escape 닫기를 설정합니다.
	 * @param {HTMLElement} layer - 모달 레이어 (role=dialog)
	 * @param {HTMLElement|null} previousFocusedElement - 닫을 때 포커스를 복원할 요소
	 * @param {HTMLElement} overlay - 배경 오버레이 요소
	 * @returns {void}
	 */
	trap(layer, previousFocusedElement, overlay) {
		const self = this;

		// 탭 전환 등으로 모달 내용이 바뀌므로 keydown 시점에 재조회하고,
		// disabled/hidden 요소는 순환 경계에서 제외한다
		function getFocusable() {
			return Array.from(layer.querySelectorAll(
				'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
			)).filter(el => !el.disabled && !el.hidden && !el.closest('[hidden]'));
		}

		function handleTab(e) {
			if (e.key === 'Tab') {
				const focusableElements = getFocusable();
				// 포커스 가능 요소가 없으면 Tab을 차단해 포커스가 모달 밖으로 새지 않도록 고정
				if (focusableElements.length === 0) {
					e.preventDefault();
					return;
				}
				const firstFocusableElement = focusableElements[0];
				const lastFocusableElement = focusableElements[focusableElements.length - 1];
				if (e.shiftKey) { // Shift + Tab
					if (document.activeElement === firstFocusableElement) {
						e.preventDefault();
						lastFocusableElement.focus();
					}
				} else { // Tab
					if (document.activeElement === lastFocusableElement) {
						e.preventDefault();
						firstFocusableElement.focus();
					}
				}
			} else if (e.key === 'Escape') {
				self.teardown(layer, overlay);
				self.restoreFocus(previousFocusedElement);
			}
		}

		layer.addEventListener('keydown', handleTab);
	}

	/**
	 * 모달 레이어·오버레이를 제거하고 스크롤 잠금을 정리합니다 (포커스는 건드리지 않음).
	 * @param {HTMLElement|null} layer - 제거할 모달 레이어
	 * @param {HTMLElement|null} overlay - 제거할 배경 오버레이
	 * @returns {void}
	 */
	teardown(layer, overlay) {
		if (layer) layer.remove();
		if (overlay) overlay.remove();
		// 다른 모달의 오버레이가 남아 있지 않을 때만 스크롤 잠금 해제 (교차 모달 안전)
		if (!document.querySelector('.wat-overlay')) {
			document.body.classList.remove('overlay-active');
		}
	}

	/**
	 * 모달을 닫은 뒤 이전 포커스 요소로 포커스를 복원합니다 (없거나 소실됐으면 body).
	 * @param {HTMLElement|null} previousFocusedElement - 복원할 포커스 대상
	 * @returns {void}
	 */
	restoreFocus(previousFocusedElement) {
		if (previousFocusedElement && document.contains(previousFocusedElement)) {
			previousFocusedElement.focus();
		} else {
			// body는 기본적으로 포커스 불가 — 일시적으로 tabindex를 부여해 확실히 이동시킨다
			const body = document.body;
			const hadTabindex = body.hasAttribute('tabindex');
			if (!hadTabindex) body.setAttribute('tabindex', '-1');
			body.focus();
			if (!hadTabindex) body.removeAttribute('tabindex');
		}
	}
}
