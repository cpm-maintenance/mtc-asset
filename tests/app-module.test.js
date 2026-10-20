// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { app } from '../src/js/app.js';

describe('app.js harness', () => {
  it('app() mengembalikan state gabungan', () => {
    const s = app();
    expect(typeof s.navigateTo).toBe('function');
    expect(s.currentPage).toBe('dash');
  });
});
