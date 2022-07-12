import { jest, describe, it, expect } from '@jest/globals';
import { starLocalDevDeps } from '../commands/starLocalDevDeps';
import * as getWorkspaceInfoModule from '../utils/getWorkspaceInfo';
import { getFakeWorkspace } from './fixtures/getFakeWorkspace';

describe('starLocalDevDeps', () => {
  it('works in basic case', () => {
    const fixture = getFakeWorkspace({
      packages: {
        foo: { devDependencies: { config: '^1.0.0', scripts: '^1.0.0' } },
        bar: { devDependencies: { config: '^1.0.0', scripts: '^1.0.0' } },
        config: { devDependencies: { scripts: '^1.0.0' } },
        scripts: {},
      },
    });
    jest.spyOn(getWorkspaceInfoModule, 'getWorkspaceInfo').mockImplementationOnce(() => fixture);

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
    jest.spyOn(getWorkspaceInfoModule, 'getWorkspaceInfo').mockImplementationOnce(() => fixture);

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
    jest.spyOn(getWorkspaceInfoModule, 'getWorkspaceInfo').mockImplementationOnce(() => fixture);

    const res = starLocalDevDeps(false);
    expect(res).toEqual([]);
  });

  // TBD whether this is desirable
  it("doesn't update workspace root", () => {
    const fixture = getFakeWorkspace({
      root: { devDependencies: { foo: '^1.0.0' } },
      packages: {
        foo: {},
      },
    });
    jest.spyOn(getWorkspaceInfoModule, 'getWorkspaceInfo').mockImplementationOnce(() => fixture);

    const res = starLocalDevDeps(false);
    expect(res).toEqual([]);
  });
});
