import { describe, it, expect } from '@jest/globals';
import { findGitRoot } from 'workspace-tools';
import { getWorkspaceInfo } from '../../utils/getWorkspaceInfo';

describe('getWorkspaceInfo', () => {
  it('works in a non-monorepo', () => {
    const gitRoot = findGitRoot(process.cwd());
    expect(getWorkspaceInfo()).toEqual({
      workspaceRoot: gitRoot,
      rootPackageInfo: expect.objectContaining({ name: 'better-deps' }),
      packageInfos: {},
      localPackages: [],
    });
  });
});
