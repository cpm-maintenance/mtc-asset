import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Higiene repo: gitlink tanpa `.gitmodules`.
 *
 * `.open/skills` adalah repo git bersarang yang ter-track sebagai gitlink
 * (mode `160000`) tanpa entri di `.gitmodules`. Akibatnya `git submodule
 * foreach` di post-job cleanup GitHub Actions gagal:
 *   `fatal: No url found for submodule path '.open/skills' in .gitmodules`
 *   `The process '/usr/bin/git' failed with exit code 128`
 * Perbaikannya bukan menyentuh isi folder, melainkan berhenti men-track-nya
 * dan mengabaikannya.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

describe('higiene repo — tidak ada gitlink tanpa .gitmodules', () => {
  it('.gitignore mengabaikan .open/', () => {
    const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^\.open\/$/m);
  });

  it('.open/skills tidak lagi ter-track', () => {
    expect(git(['ls-files', '.open'])).toBe('');
  });

  it('tidak ada entri mode 160000 selama .gitmodules tidak ada', () => {
    const hasGitmodules = fs.existsSync(path.join(ROOT, '.gitmodules'));
    expect(
      hasGitmodules,
      'repo ini tidak memakai submodule; kalau nanti dipakai, aturan di bawah tak berlaku',
    ).toBe(false);

    const gitlinks = git(['ls-files', '-s'])
      .split('\n')
      .filter((line) => line.startsWith('160000 '));

    expect(gitlinks, `gitlink tanpa .gitmodules:\n${gitlinks.join('\n')}`).toEqual([]);
  });
});
