/**
 * 브라우저 JSONP 요청 (사전 API 등 신뢰 엔드포인트용)
 * @module src/core/jsonpFetch
 */

/**
 * @param {string} url - 엔드포인트 (쿼리 없이)
 * @param {Object} [params={}] - 추가 쿼리 파라미터
 * @param {number} [timeout=10000] - 타임아웃(ms)
 * @param {{ window?: Window; document?: Document }} [env] - 테스트용 주입
 * @returns {Promise<Object>}
 */
export function fetchJSONP(url, params = {}, timeout = 10000, env = {}) {
	const win = Object.hasOwn(env, 'window')
		? env.window
		: (typeof window !== 'undefined' ? window : null);
	const doc = Object.hasOwn(env, 'document')
		? env.document
		: (typeof document !== 'undefined' ? document : null);
	if (
		!win ||
		!doc ||
		typeof doc.createElement !== 'function' ||
		typeof doc.head?.appendChild !== 'function'
	) {
		return Promise.reject(new Error('JSONP requires window and document'));
	}

	return new Promise((resolve, reject) => {
		const callbackName = `jsonpCallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const timeoutId = setTimeout(() => {
			cleanup();
			reject(new Error('Dictionary request timeout'));
		}, timeout);

		/** @type {HTMLScriptElement | null} */
		let script = null;

		const cleanup = () => {
			clearTimeout(timeoutId);
			if (win[callbackName]) {
				try {
					delete win[callbackName];
				} catch (e) {
					win[callbackName] = undefined;
				}
			}
			if (script && script.parentNode) {
				script.parentNode.removeChild(script);
			}
		};

		win[callbackName] = (data) => {
			cleanup();
			if (data) {
				resolve(data);
			} else {
				reject(new Error('No data returned from dictionary API'));
			}
		};

		const queryParams = new URLSearchParams(params);
		queryParams.append('callback', callbackName);
		const fullUrl = `${url}?${queryParams.toString()}`;

		script = doc.createElement('script');
		script.type = 'text/javascript';
		script.src = fullUrl;
		script.async = true;

		script.onerror = () => {
			cleanup();
			reject(new Error('Failed to load dictionary data. Network error or invalid response.'));
		};

		doc.head.appendChild(script);
	});
}
