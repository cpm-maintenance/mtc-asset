// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/error-handler.js` (kartu D, S33af).
 *
 * Modul ini sebelumnya **0 %** (31 branch, 3,8 % lines): satu-satunya berkas di
 * `src/js/` tanpa tes sama sekali, padahal ia yang menentukan pesan error yang
 * dilihat teknisi dan satu-satunya jalur pelaporan ke Sentry.
 *
 * Yang dikunci: setiap kelas pesan (network / permission / quota / not found /
 * auth) plus fallback-nya, `errorDetails` yang tetap terisi untuk error
 * non-`Error`, dan `handleError` yang tidak boleh melempar walau Sentry sendiri
 * gagal.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { errorHandlerModule } from '../src/js/error-handler.js';

function makeCtx() {
    return Object.assign(Object.create(errorHandlerModule), {
        hasError: false,
        errorMessage: '',
        errorDetails: '',
        userRole: 'admin',
        currentPage: 'dashboard',
        showNotification: vi.fn(),
    });
}

describe('getUserFriendlyError', () => {
    it.each([
        ['Network request failed', 'Network error. Please check your connection.'],
        ['fetch failed', 'Network error. Please check your connection.'],
        ['PERMISSION_DENIED', 'Access denied. Admin privileges required.'],
        ['quota exceeded', 'Rate limit exceeded. Please try again later.'],
        ['rate limit hit', 'Rate limit exceeded. Please try again later.'],
        ['Document not found', 'Data not found. Please refresh the page.'],
        ['value is null', 'Data not found. Please refresh the page.'],
        ['auth/invalid-credential', 'Authentication error. Please login again.'],
        ['please login first', 'Authentication error. Please login again.'],
        ['something else entirely', 'An error occurred. Please try again.'],
    ])('memetakan "%s" → pesan yang bisa dibaca', (input, expected) => {
        expect(makeCtx().getUserFriendlyError(new Error(input))).toBe(expected);
    });

    it('tanpa argumen / null → pesan umum, bukan "undefined"', () => {
        expect(makeCtx().getUserFriendlyError()).toBe('An unexpected error occurred');
        expect(makeCtx().getUserFriendlyError(null)).toBe('An unexpected error occurred');
    });

    it('menerima string mentah, bukan hanya objek Error', () => {
        expect(makeCtx().getUserFriendlyError('network down')).toBe(
            'Network error. Please check your connection.'
        );
    });
});

describe('handleError', () => {
    /** @type {any} */
    let originalSentry;

    beforeEach(() => {
        originalSentry = /** @type {any} */ (window).Sentry;
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        /** @type {any} */ (window).Sentry = originalSentry;
        vi.restoreAllMocks();
    });

    it('mengisi state error dan memberi notifikasi', () => {
        const ctx = makeCtx();
        ctx.handleError(new Error('Network request failed'), 'submitLog');

        expect(ctx.hasError).toBe(true);
        expect(ctx.errorMessage).toBe('Network error. Please check your connection.');
        expect(ctx.errorDetails).toBe('Network request failed');
        expect(ctx.showNotification).toHaveBeenCalledWith(
            'Network error. Please check your connection.',
            'error'
        );
    });

    it('error non-Error tetap punya errorDetails', () => {
        const ctx = makeCtx();
        ctx.handleError('boom', 'ctx');
        expect(ctx.errorDetails).toBe('boom');
        expect(ctx.hasError).toBe(true);
    });

    it('mengirim ke Sentry dengan tag context, dan "unknown" kalau context kosong', () => {
        const captureException = vi.fn();
        /** @type {any} */ (window).Sentry = { captureException };

        const ctx = makeCtx();
        ctx.handleError(new Error('x'), 'approveReq');
        expect(captureException).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                tags: { context: 'approveReq' },
                extra: { userRole: 'admin', page: 'dashboard' },
            })
        );

        ctx.handleError(new Error('y'));
        expect(captureException.mock.calls[1][1].tags.context).toBe('unknown');
    });

    it('tidak melempar kalau Sentry sendiri gagal', () => {
        /** @type {any} */ (window).Sentry = {
            captureException: () => {
                throw new Error('sentry down');
            },
        };
        const ctx = makeCtx();
        expect(() => ctx.handleError(new Error('x'), 'ctx')).not.toThrow();
        expect(console.warn).toHaveBeenCalled();
    });

    it('tanpa window.Sentry tetap menangani error', () => {
        /** @type {any} */ (window).Sentry = undefined;
        const ctx = makeCtx();
        expect(() => ctx.handleError(new Error('x'))).not.toThrow();
        expect(ctx.hasError).toBe(true);
    });
});

describe('clearError', () => {
    it('mengosongkan state error', () => {
        const ctx = makeCtx();
        ctx.hasError = true;
        ctx.errorMessage = 'x';
        ctx.errorDetails = 'y';
        ctx.clearError();
        expect(ctx.hasError).toBe(false);
        expect(ctx.errorMessage).toBe('');
        expect(ctx.errorDetails).toBe('');
    });
});
