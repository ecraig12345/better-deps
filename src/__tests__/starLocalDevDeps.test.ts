import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { SpyInstance } from 'jest-mock';
import { starLocalDevDeps } from '../commands/starLocalDevDeps';
import * as getWorkspaceInfoModule from '../utils/getWorkspaceInfo';
import { WorkspacePackagesInfo } from '../utils/types';
import { getFakeWorkspace } from './fixtures/getFakeWorkspace';

describe('starLocalDevDeps', () => {
  let getWorkspaceInfoMock: SpyInstance | undefined;

  function mockWorkspaceInfo(fixture: WorkspacePackagesInfo) {
    getWorkspaceInfoMock = jest
      .spyOn(getWorkspaceInfoModule, 'getWorkspaceInfo')
      .mockImplementationOnce(() => fixture);
  }

  afterEach(() => {
    // restore this in case a test failed and it never got called
    getWorkspaceInfoMock?.mockRestore();
    getWorkspaceInfoMock = undefined;
  });

  it('works in basic case', () => {
    const fixture = getFakeWorkspace({
      packages: {
        foo: { devDependencies: { config: '^1.0.0', scripts: '^1.0.0' } },
        bar: { devDependencies: { config: '^1.0.0', scripts: '^1.0.0' } },
        config: { devDependencies: { scripts: '^1.0.0' } },
        scripts: {},
      },
    });
    mockWorkspaceInfo(fixture);

    const res = starLocalDevDeps(false);
    expect(res).toEqual([
      { ...fixture.packageInfos.foo, devDependencies: { config: '*', scripts: '*' } },
      { ...fixture.packageInfos.bar, devDependencies: { config: '*', scripts: '*' } },
      { ...fixture.packageInfos.config, devDependencies: { scripts: '*' } },
    ]);
  });

  it("doesn't update dependencies", () => {
    const fixture = getFakeWorkspace({
      packages: {
        foo: { dependencies: { bar: '^1.0.0' }, devDependencies: { scripts: '^1.0.0' } },
        bar: { devDependencies: { scripts: '^1.0.0' } },
        scripts: {},
      },
    });
    mockWorkspaceInfo(fixture);

    const res = starLocalDevDeps(false);
    expect(res).toEqual([
      { ...fixture.packageInfos.foo, devDependencies: { scripts: '*' } },
      { ...fixture.packageInfos.bar, devDependencies: { scripts: '*' } },
    ]);
  });

  it('handles no updates', () => {
    const fixture = getFakeWorkspace({
      packages: {
        foo: { dependencies: { bar: '^1.0.0' } },
        bar: {},
      },
    });
    mockWorkspaceInfo(fixture);

    const res = starLocalDevDeps(false);
    expect(res).toEqual([]);
  });

  it("doesn't update packages already using *", () => {
    // this is mainly important for --check mode
    const fixture = getFakeWorkspace({
      packages: {
        foo: { devDependencies: { scripts: '*' } },
        bar: { devDependencies: { scripts: '^1.0.0' } },
        scripts: {},
      },
    });
    mockWorkspaceInfo(fixture);

    const res = starLocalDevDeps(false);
    // foo is NOT modified because it already had scripts as *
    expect(res).toEqual([{ ...fixture.packageInfos.bar, devDependencies: { scripts: '*' } }]);
  });

  // TBD whether this is desirable
  it("doesn't update workspace root", () => {
    const fixture = getFakeWorkspace({
      root: { devDependencies: { foo: '^1.0.0' } },
      packages: {
        foo: {},
      },
    });
    mockWorkspaceInfo(fixture);

    const res = starLocalDevDeps(false);
    expect(res).toEqual([]);
  });
});
