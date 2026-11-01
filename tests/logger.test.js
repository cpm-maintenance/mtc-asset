/**
 * Logger: `debug`/`info` harus hidup di DEV dan benar-benar no-op di produksi
 * (bukan sekadar "tidak dipanggil" — bundle produksi mengandalkan no-op ini
 * supaya log internal tidak bocor ke console pengguna).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

/** @param {boolean} dev */
async function loadLogger(dev) {
  vi.stubEnv('DEV', dev);
  vi.resetModules();
  const mod = await import('../src/js/logger.js');
  return mod.logger;
}

describe('logger', () => {
  it('warn dan error selalu diteruskan tanpa prefix', async () => {
    const logger = await loadLogger(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.warn('a', 1);
    logger.error('b', 2);

    expect(warn).toHaveBeenCalledWith('a', 1);
    expect(error).toHaveBeenCalledWith('b', 2);
  });

  it('debug dan info menulis dengan prefix saat DEV', async () => {
    const logger = await loadLogger(true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    logger.debug('x', 1);
    logger.info('y', 2);

    expect(log).toHaveBeenCalledWith('[debug]', 'x', 1);
    expect(info).toHaveBeenCalledWith('[info]', 'y', 2);
  });

  it('debug dan info no-op saat produksi', async () => {
    const logger = await loadLogger(false);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    logger.debug('x');
    logger.info('y');

    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('default export menunjuk objek yang sama', async () => {
    vi.stubEnv('DEV', true);
    vi.resetModules();
    const mod = await import('../src/js/logger.js');
    expect(mod.default).toBe(mod.logger);
  });
});
