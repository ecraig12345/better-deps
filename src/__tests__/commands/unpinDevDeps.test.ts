import { describe, it, expect, afterEach } from '@jest/globals';
import { unpinDevDeps } from '../../commands/unpinDevDeps';
import { getFakeWorkspace } from '../testUtils/getFakeWorkspace';
import { mockWorkspaceAndLogs } from '../testUtils/mockWorkspace';
import { getDevDependencies } from '../testUtils/getDevDependencies';

describe('unpinDevDeps', () => {
  let mocks: ReturnType<typeof mockWorkspaceAndLogs> | undefined;

  afterEach(() => {
    mocks?.restore();
  });

  it('works in basic case', () => {
    const fixture = getFakeWorkspace({
      root: { devDependencies: { typescript: '4.0.1' } },
      packages: {
        pkg1: { devDependencies: { jest: '28.5.6' } },
        pkg2: { devDependencies: { jest: '28.5.6', rimraf: '3.0.0' } },
      },
    });
    mocks = mockWorkspaceAndLogs(fixture);

    const res = unpinDevDeps({ write: false });
    // test the full objects to verify other properties are preserved
    expect(res).toEqual([
      { ...fixture.rootPackageInfo, devDependencies: { typescript: '^4.0.1' } },
      { ...fixture.packageInfos.pkg1, devDependencies: { jest: '^28.5.6' } },
      { ...fixture.packageInfos.pkg2, devDependencies: { jest: '^28.5.6', rimraf: '^3.0.0' } },
    ]);
    expect(mocks.getConsoleLogs()).toMatchInlineSnapshot(`
      "Updating jest@28.5.6 to ^28.5.6
      Updating rimraf@3.0.0 to ^3.0.0
      Updating typescript@4.0.1 to ^4.0.1"
    `);
  });

  it('works with multiple versions', () => {
    const fixture = getFakeWorkspace({
      packages: {
        pkg1: { devDependencies: { jest: '28.2.0' } },
        pkg2: { devDependencies: { jest: '28.2.0' } },
        pkg3: { devDependencies: { jest: '28.0.5' } },
      },
    });
    mocks = mockWorkspaceAndLogs(fixture);

    const res = unpinDevDeps({ write: false });
    // Kind of debatable if this is "right" but currently it preserves each individual version
    // even when they overlap
    expect(getDevDependencies(res)).toEqual({
      pkg1: { jest: '^28.2.0' },
      pkg2: { jest: '^28.2.0' },
      pkg3: { jest: '^28.0.5' },
    });
    expect(mocks.getConsoleLogs()).toMatchInlineSnapshot(`
      "Updating jest@28.2.0 to ^28.2.0
      Updating jest@28.0.5 to ^28.0.5"
    `);
  });

  it('works with nothing to do', () => {
    const fixture = getFakeWorkspace({ packages: { pkg1: {} } });
    mocks = mockWorkspaceAndLogs(fixture);

    expect(unpinDevDeps({ write: false })).toEqual([]);
    expect(mocks.getConsoleLogs()).toEqual('');
  });

  it("doesn't modify existing ranges", () => {
    const fixture = getFakeWorkspace({
      packages: { pkg1: { devDependencies: { jest: '~28.0.0' } } },
    });
    mocks = mockWorkspaceAndLogs(fixture);

    const res = unpinDevDeps({ write: false });
    expect(res).toEqual([]);
    expect(mocks.getConsoleLogs()).toEqual('');
  });

  it('works in a non-monorepo', () => {
    const fixture = getFakeWorkspace({
      root: { devDependencies: { jest: '28.2.0' } },
    });
    mocks = mockWorkspaceAndLogs(fixture);

    const res = unpinDevDeps({ write: false });
    expect(res).toEqual([{ ...fixture.rootPackageInfo, devDependencies: { jest: '^28.2.0' } }]);
  });

  it("doesn't modify local devDependencies", () => {
    const fixture = getFakeWorkspace({
      packages: {
        pkg1: { devDependencies: { jest: '28.2.0', scripts: '1.0.0' } },
        scripts: {},
      },
    });
    mocks = mockWorkspaceAndLogs(fixture);

    const res = unpinDevDeps({ write: false });
    expect(getDevDependencies(res)).toEqual({
      pkg1: { jest: '^28.2.0', scripts: '1.0.0' },
    });
    expect(mocks.getConsoleLogs()).toMatchInlineSnapshot(`"Updating jest@28.2.0 to ^28.2.0"`);
  });

  it("doesn't modify prerelease versions", () => {
    const fixture = getFakeWorkspace({
      packages: { pkg1: { devDependencies: { jest: '28.2.0-rc.0' } } },
    });
    mocks = mockWorkspaceAndLogs(fixture);

    const res = unpinDevDeps({ write: false });
    expect(res).toEqual([]);
    expect(mocks.getConsoleLogs()).toEqual('');
  });

  it("doesn't modify dependencies", () => {
    const fixture = getFakeWorkspace({
      packages: { pkg1: { dependencies: { jest: '^28.0.0' } } },
    });
    mocks = mockWorkspaceAndLogs(fixture);

    expect(unpinDevDeps({ write: false })).toEqual([]);
    expect(mocks.getConsoleLogs()).toEqual('');
  });

  it('respects exclude', () => {
    const fixture = getFakeWorkspace({
      packages: {
        pkg1: { devDependencies: { typescript: '4.0.3' } },
        pkg2: { devDependencies: { rimraf: '3.0.0', typescript: '4.0.3' } },
      },
    });
    mocks = mockWorkspaceAndLogs(fixture);

    const res = unpinDevDeps({ exclude: ['typescript'], write: false });
    expect(getDevDependencies(res)).toEqual({
      pkg2: { typescript: '4.0.3', rimraf: '^3.0.0' },
    });
  });

  it('respects patch', () => {
    const fixture = getFakeWorkspace({
      packages: {
        pkg1: { devDependencies: { typescript: '4.0.3' } },
        pkg2: { devDependencies: { rimraf: '3.0.0', typescript: '4.0.3' } },
      },
    });
    mocks = mockWorkspaceAndLogs(fixture);

    const res = unpinDevDeps({ patch: ['typescript'], write: false });
    expect(getDevDependencies(res)).toEqual({
      pkg1: { typescript: '~4.0.3' },
      pkg2: { rimraf: '^3.0.0', typescript: '~4.0.3' },
    });
  });
});
