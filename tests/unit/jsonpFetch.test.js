import { describe, it, expect, jest } from '@jest/globals';
import { fetchJSONP } from '../../src/core/jsonpFetch.js';

/**
 * appendChild 시 콜백을 비동기로 호출하는 가짜 문서/창
 * @param {*} payload - 콜백에 넘길 값
 * @param {{ failLoad?: boolean }} [opts]
 */
function mockJsonpEnv(payload, opts = {}) {
	const mockWin = /** @type {Record<string, unknown>} */ ({});
	let scriptEl = /** @type {{ src: string; onerror: (() => void) | null; parentNode: { removeChild: (s: unknown) => void } | null }} */ (
		null
	);
	const mockDoc = {
		createElement() {
			scriptEl = {
				src: '',
				onerror: null,
				parentNode: null,
			};
			return scriptEl;
		},
		head: {
			appendChild() {
				if (opts.failLoad) {
					queueMicrotask(() => scriptEl?.onerror?.());
					return;
				}
				const u = new URL(scriptEl.src, 'https://example.com');
				const cb = u.searchParams.get('callback');
				queueMicrotask(() => {
					const fn = mockWin[cb];
					if (typeof fn === 'function') fn(payload);
				});
			},
		},
	};
	return { mockWin, mockDoc };
}

describe('fetchJSONP', () => {
	it('콜백 페이로드로 resolve', async () => {
		const data = { items: [{ title: 'a' }] };
		const { mockWin, mockDoc } = mockJsonpEnv(data);
		await expect(
			fetchJSONP('https://api.example.com/dict', { word: 'x' }, 5000, {
				window: mockWin,
				document: mockDoc,
			})
		).resolves.toEqual(data);
	});

	it('데이터가 없으면 reject', async () => {
		const { mockWin, mockDoc } = mockJsonpEnv(null);
		await expect(
			fetchJSONP('https://x', {}, 5000, { window: mockWin, document: mockDoc })
		).rejects.toThrow('No data returned from dictionary API');
	});

	it('스크립트 로드 오류 시 reject', async () => {
		const { mockWin, mockDoc } = mockJsonpEnv(null, { failLoad: true });
		await expect(
			fetchJSONP('https://x', {}, 5000, { window: mockWin, document: mockDoc })
		).rejects.toThrow('Failed to load dictionary data');
	});

	it('타임아웃 시 reject', async () => {
		jest.useFakeTimers();
		try {
			const mockWin = {};
			const mockDoc = {
				createElement() {
					return { src: '', onerror: null, parentNode: null };
				},
				head: { appendChild() {} },
			};
			const p = fetchJSONP('https://x', {}, 1000, { window: mockWin, document: mockDoc });
			jest.advanceTimersByTime(1000);
			await expect(p).rejects.toThrow('Dictionary request timeout');
		} finally {
			jest.useRealTimers();
		}
	});

	it('window/document 없으면 즉시 reject', async () => {
		await expect(
			fetchJSONP('https://x', {}, 1000, { window: null, document: null })
		).rejects.toThrow('JSONP requires window and document');
	});
});
