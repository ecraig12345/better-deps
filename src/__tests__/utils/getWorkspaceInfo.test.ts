import { describe, it, expect } from '@jest/globals';
import { findGitRoot } from 'workspace-tools';
import { getMonorepoInfo } from '../../utils/getMonorepoInfo';

describe('getMonorepoInfo', () => {
  it('works in a non-monorepo', () => {
    const gitRoot = findGitRoot(process.cwd());
    expect(getMonorepoInfo()).toEqual({
      root: gitRoot,
      rootPackageInfo: expect.objectContaining({ name: 'better-deps' }),
      packageInfos: {},
    });
  });
});
