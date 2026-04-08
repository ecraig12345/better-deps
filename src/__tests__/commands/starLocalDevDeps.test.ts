import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { SpyInstance } from 'jest-mock';
import { starLocalDevDeps } from '../../commands/starLocalDevDeps';
import * as getMonorepoInfoModule from '../../utils/getMonorepoInfo';
import { MonorepoInfo } from '../../utils/types';
import { getFakeMonorepo } from '../testUtils/getFakeMonorepo';
import { getDevDependencies } from '../testUtils/getDevDependencies';

describe('starLocalDevDeps', () => {
  let getMonorepoInfoMock: SpyInstance | undefined;

  function mockMonorepoInfo(fixture: MonorepoInfo) {
    getMonorepoInfoMock = jest
      .spyOn(getMonorepoInfoModule, 'getMonorepoInfo')
      .mockImplementationOnce(() => fixture);
  }

  afterEach(() => {
    // restore this in case a test failed and it never got called
    getMonorepoInfoMock?.mockRestore();
    getMonorepoInfoMock = undefined;
  });

  it('works in basic case', () => {
    const fixture = getFakeMonorepo({
      packages: {
        foo: { devDependencies: { config: '^1.0.0', scripts: '^1.0.0' } },
        bar: { devDependencies: { config: '^1.0.0', scripts: '^1.0.0' } },
        config: { devDependencies: { scripts: '^1.0.0' } },
        scripts: {},
      },
    });
    mockMonorepoInfo(fixture);

    const res = starLocalDevDeps(false);
    // test the full objects to verify other properties are preserved
    expect(res).toEqual([
      { ...fixture.packageInfos.foo, devDependencies: { config: '*', scripts: '*' } },
      { ...fixture.packageInfos.bar, devDependencies: { config: '*', scripts: '*' } },
      { ...fixture.packageInfos.config, devDependencies: { scripts: '*' } },
    ]);
  });

  it("doesn't update dependencies", () => {
    const fixture = getFakeMonorepo({
      packages: {
        foo: { dependencies: { bar: '^1.0.0' }, devDependencies: { scripts: '^1.0.0' } },
        bar: { devDependencies: { scripts: '^1.0.0' } },
        scripts: {},
      },
    });
    mockMonorepoInfo(fixture);

    const res = starLocalDevDeps(false);
    expect(getDevDependencies(res)).toEqual({
      foo: { scripts: '*' },
      bar: { scripts: '*' },
    });
  });

  it('handles no updates', () => {
    const fixture = getFakeMonorepo({
      packages: {
        foo: { dependencies: { bar: '^1.0.0' } },
        bar: {},
      },
    });
    mockMonorepoInfo(fixture);

    const res = starLocalDevDeps(false);
    expect(res).toEqual([]);
  });

  it("doesn't update packages already using *", () => {
    // this is mainly important for --check mode
    const fixture = getFakeMonorepo({
      packages: {
        foo: { devDependencies: { scripts: '*' } },
        bar: { devDependencies: { scripts: '^1.0.0' } },
        scripts: {},
      },
    });
    mockMonorepoInfo(fixture);

    const res = starLocalDevDeps(false);
    // foo is NOT modified because it already had scripts as *
    expect(getDevDependencies(res)).toEqual({
      bar: { scripts: '*' },
    });
  });

  // TBD whether this is desirable
  it("doesn't update repo root", () => {
    const fixture = getFakeMonorepo({
      root: { devDependencies: { foo: '^1.0.0' } },
      packages: {
        foo: {},
      },
    });
    mockMonorepoInfo(fixture);

    const res = starLocalDevDeps(false);
    expect(res).toEqual([]);
  });
});
