import { describe, it, expect, afterEach } from '@jest/globals';
import { hoistDevDeps } from '../../commands/hoistDevDeps';
import { getFakeMonorepo, MonorepoFixture } from '../testUtils/getFakeMonorepo';
import { mockMonorepoAndLogs } from '../testUtils/mockMonorepo';
import { getDevDependencies } from '../testUtils/getDevDependencies';

describe('hoistDevDeps', () => {
  let mocks: ReturnType<typeof mockMonorepoAndLogs> | undefined;

  afterEach(() => {
    mocks?.restore();
  });

  describe('basic', () => {
    const basicFixtures = {
      basic: (): MonorepoFixture => ({
        root: { devDependencies: { typescript: '^4.0.0' } },
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0' } },
          pkg2: { devDependencies: { jest: '^28.0.0', rimraf: '^3.0.0' } },
        },
      }),
      noRoot: (): MonorepoFixture => ({
        packages: { ...basicFixtures.basic().packages },
      }),
      /** has mismatched jest versions, hoists `^28.0.0` due to popularity */
      mismatched: (): MonorepoFixture => ({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0' } },
          pkg2: { devDependencies: { jest: '^28.0.0' } },
          pkg3: { devDependencies: { jest: '^27.0.0' } },
        },
      }),
      /** has mismatched jest versions, hoists `^27.0.0` because it's at root */
      mismatchedWithRoot: (): MonorepoFixture => ({
        root: { devDependencies: { jest: '^27.0.0' } },
        packages: {
          ...basicFixtures.mismatched().packages,
          // also ensure the root version won't win by popularity
          pkg4: { devDependencies: { jest: '^28.0.0' } },
        },
      }),
      /** has mismatched jest versions where `^27.0.0 is at root only, hoists nothing */
      mismatchedRootOnly: (): MonorepoFixture => {
        const fixture = basicFixtures.mismatchedWithRoot();
        delete fixture.packages?.pkg3;
        return fixture;
      },
    };

    it('works in basic case', () => {
      const fixture = getFakeMonorepo(basicFixtures.basic());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ write: false });
      // test the full objects to verify other properties are preserved
      expect(res).toEqual([
        { ...fixture.packageInfos.pkg1, devDependencies: {} },
        { ...fixture.packageInfos.pkg2, devDependencies: {} },
        {
          ...fixture.rootPackageInfo,
          devDependencies: { jest: '^28.0.0', rimraf: '^3.0.0', typescript: '^4.0.0' },
        },
      ]);
      expect(mocks.getConsoleLogs()).toEqual(['Hoisting jest@^28.0.0', 'Hoisting rimraf@^3.0.0']);
    });

    it("works if root doesn't already have devDependencies", () => {
      const fixture = getFakeMonorepo(basicFixtures.noRoot());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ write: false });
      // test the full objects to verify other properties are preserved
      expect(res).toEqual([
        { ...fixture.packageInfos.pkg1, devDependencies: {} },
        { ...fixture.packageInfos.pkg2, devDependencies: {} },
        {
          ...fixture.rootPackageInfo,
          devDependencies: { jest: '^28.0.0', rimraf: '^3.0.0' },
        },
      ]);
      expect(mocks.getConsoleLogs()).toEqual(['Hoisting jest@^28.0.0', 'Hoisting rimraf@^3.0.0']);
    });

    it('works with nothing to hoist', () => {
      const fixture = getFakeMonorepo({ packages: { pkg1: {} } });
      mocks = mockMonorepoAndLogs(fixture);

      expect(hoistDevDeps({ write: false })).toEqual([]);
      expect(mocks.getConsoleLogs()).toEqual([]);
    });

    it("doesn't hoist local devDependencies", () => {
      const fixture = getFakeMonorepo({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0', scripts: '^1.0.0' } },
          scripts: {},
        },
      });
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ write: false });
      expect(getDevDependencies(res)).toEqual({
        pkg1: { scripts: '^1.0.0' },
        'fake-root': { jest: '^28.0.0' },
      });
      expect(mocks.getConsoleLogs()).toEqual(['Hoisting jest@^28.0.0']);
    });

    it("doesn't hoist dependencies", () => {
      const fixture = getFakeMonorepo({
        packages: { pkg1: { dependencies: { jest: '^28.0.0' } } },
      });
      mocks = mockMonorepoAndLogs(fixture);

      expect(hoistDevDeps({ write: false })).toEqual([]);
      expect(mocks.getConsoleLogs()).toEqual([]);
    });

    it('logs in sorted order', () => {
      const deps = ['e', 'c', 'a', 'b', 'd'];
      const fixture = getFakeMonorepo({
        packages: {
          pkg1: { devDependencies: Object.fromEntries(deps.map((dep) => [dep, '1.0.0'])) },
        },
      });
      mocks = mockMonorepoAndLogs(fixture);

      hoistDevDeps({ write: false });
      const sortedDeps = [...deps].sort();
      const expectedLogs = sortedDeps.map((dep) => `Hoisting ${dep}@1.0.0`);
      expect(mocks.getConsoleLogs()).toEqual(expectedLogs);
    });

    it('chooses most popular version if mismatched and no root version present', () => {
      const fixture = getFakeMonorepo(basicFixtures.mismatched());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ write: false });
      expect(getDevDependencies(res)).toEqual({
        pkg1: {},
        pkg2: {},
        'fake-root': { jest: '^28.0.0' },
      });
      expect(mocks.getConsoleLogs()).toEqual([
        'Found multiple versions of jest: ^28.0.0, ^27.0.0',
        '  ^28.0.0 in pkg1, pkg2',
        '  ^27.0.0 in pkg3',
        'Hoisting jest@^28.0.0 (choosing most popular version)',
      ]);
    });

    it('chooses root version if present and mismatched', () => {
      const fixture = getFakeMonorepo(basicFixtures.mismatchedWithRoot());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ write: false });
      expect(getDevDependencies(res)).toEqual({
        'fake-root': { jest: '^27.0.0' },
        pkg3: {},
      });
      expect(mocks.getConsoleLogs()).toEqual([
        'Found multiple versions of jest: ^27.0.0, ^28.0.0',
        '  ^27.0.0 in fake-root, pkg3',
        '  ^28.0.0 in pkg1, pkg2, pkg4',
        'Hoisting jest@^27.0.0 (included in root package.json)',
      ]);
    });

    it('does nothing if mismatched version is at root only', () => {
      const fixture = getFakeMonorepo(basicFixtures.mismatchedRootOnly());
      mocks = mockMonorepoAndLogs(fixture);

      expect(hoistDevDeps({ write: false })).toEqual([]);
      expect(mocks.getConsoleLogs()).toEqual([
        'Found multiple versions of jest: ^27.0.0, ^28.0.0',
        '  ^27.0.0 in fake-root',
        '  ^28.0.0 in pkg1, pkg2, pkg4',
      ]);
    });
  });

  describe('exclude', () => {
    const excludeFixtures = {
      basic: (): MonorepoFixture => ({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0', rimraf: '^3.0.0' } },
        },
      }),
    };

    it('excludes deps', () => {
      const fixture = getFakeMonorepo(excludeFixtures.basic());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ exclude: ['rimraf'], write: false });
      expect(res).toEqual([
        { ...fixture.packageInfos.pkg1, devDependencies: { rimraf: '^3.0.0' } },
        { ...fixture.rootPackageInfo, devDependencies: { jest: '^28.0.0' } },
      ]);
      expect(mocks.getConsoleLogs()).toEqual(['Hoisting jest@^28.0.0']);
    });

    it('excludes deps even if specified at root', () => {
      const fixture = getFakeMonorepo({
        ...excludeFixtures.basic(),
        root: { devDependencies: { rimraf: '^3.0.0' } },
      });
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ exclude: ['rimraf'], write: false });
      expect(getDevDependencies(res)).toEqual({
        pkg1: { rimraf: '^3.0.0' },
        'fake-root': { rimraf: '^3.0.0', jest: '^28.0.0' },
      });
      expect(mocks.getConsoleLogs()).toEqual(['Hoisting jest@^28.0.0']);
    });
  });

  describe('only', () => {
    const onlyFixtures = {
      basic: (): MonorepoFixture => ({
        root: { devDependencies: { rimraf: '^3.0.0' } },
        packages: {
          pkg1: {
            devDependencies: { jest: '^28.0.0', rimraf: '^3.0.0', typescript: '^4.0.0' },
          },
          pkg2: { devDependencies: { jest: '^28.0.0' } },
        },
      }),
    };

    it('throws if used with other options', () => {
      mocks = mockMonorepoAndLogs(false);
      expect(() => hoistDevDeps({ only: ['pkg1'], threshold: 0.5, write: false })).toThrowError(
        '`only` and other options are not compatible',
      );
      expect(() => hoistDevDeps({ only: ['pkg1'], exclude: ['pkg2'], write: false })).toThrowError(
        '`only` and other options are not compatible',
      );
    });

    it('respects option', () => {
      const fixture = getFakeMonorepo(onlyFixtures.basic());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ only: ['jest', 'typescript'], write: false });
      expect(getDevDependencies(res)).toEqual({
        pkg1: { rimraf: '^3.0.0' },
        pkg2: {},
        'fake-root': { jest: '^28.0.0', typescript: '^4.0.0', rimraf: '^3.0.0' },
      });
      expect(mocks.getConsoleLogs()).toEqual([
        'Hoisting jest@^28.0.0',
        'Hoisting typescript@^4.0.0',
      ]);
    });

    it("does nothing with package that's never a devDependency", () => {
      const fixture = getFakeMonorepo({
        packages: {
          pkg1: { dependencies: { glob: '^8.0.0' }, devDependencies: { rimraf: '^3.0.0' } },
        },
      });
      mocks = mockMonorepoAndLogs(fixture);

      expect(hoistDevDeps({ only: ['glob'], write: false })).toEqual([]);
      expect(mocks.getConsoleLogs()).toEqual([]);
    });

    it('does nothing with local devDependency', () => {
      const fixture = getFakeMonorepo({
        packages: {
          pkg1: { devDependencies: { scripts: '^1.0.0' } },
          scripts: {},
        },
      });
      mocks = mockMonorepoAndLogs(fixture);

      expect(hoistDevDeps({ only: ['scripts'], write: false })).toEqual([]);
      expect(mocks.getConsoleLogs()).toEqual([]);
    });
  });

  describe('threshold and always', () => {
    const thresholdFixtures = {
      /** hoists jest and rimraf */
      basic: (): MonorepoFixture => ({
        packages: {
          pkg1: {
            dependencies: { typescript: '^4.0.0' }, // shouldn't count for threshold
            devDependencies: { jest: '^28.0.0' },
          },
          pkg2: { devDependencies: { jest: '^28.0.0', rimraf: '^3.0.0' } },
          pkg3: { devDependencies: { rimraf: '^3.0.0', glob: '^8.0.0' } },
          pkg4: { devDependencies: { typescript: '^4.0.0' } },
        },
      }),
      /** has mismatched jest but hoists 28 due to over threshold */
      mismatch: (): MonorepoFixture => ({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0' } },
          pkg2: { devDependencies: { jest: '^28.0.0' } },
          pkg3: { devDependencies: { jest: '^27.0.0' } },
        },
      }),
      /** cumulatively, jest is above 50% threshold, but no individual version is above threshold */
      mismatchBelowThreshold: (): MonorepoFixture => ({
        packages: { ...thresholdFixtures.mismatch().packages, pkg4: {}, pkg5: {} },
      }),
      /** as with `mismatchBelowThreshold` but jest 27 is also at root and is hoisted */
      mismatchBelowThresholdWithRoot: (): MonorepoFixture => ({
        ...thresholdFixtures.mismatchBelowThreshold(),
        root: { devDependencies: { jest: '^27.0.0' } },
      }),
    };

    it('throws if invalid threshold', () => {
      mocks = mockMonorepoAndLogs(false);
      expect(() => hoistDevDeps({ write: false, threshold: -1 })).toThrowError(
        '`threshold` must be between 0 and 1 inclusive',
      );
      expect(() => hoistDevDeps({ write: false, threshold: 50 })).toThrowError(
        '`threshold` must be between 0 and 1 inclusive',
      );
    });

    it('throws if `always` used without `threshold`', () => {
      mocks = mockMonorepoAndLogs(false);
      expect(() => hoistDevDeps({ write: false, always: ['pkg1'] })).toThrowError(
        '`always` is only relevant with `threshold`',
      );
    });

    it('throws if a package is listed in both `exclude` and `always`', () => {
      mocks = mockMonorepoAndLogs(false);
      expect(() =>
        hoistDevDeps({ write: false, exclude: ['pkg1'], always: ['pkg1'], threshold: 0.5 }),
      ).toThrowError('a package cannot be listed in both `exclude` and `always`');
    });

    it('respects threshold', () => {
      const fixture = getFakeMonorepo(thresholdFixtures.basic());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ threshold: 0.5, write: false });
      expect(res).toEqual([
        { ...fixture.packageInfos.pkg1, devDependencies: {} },
        { ...fixture.packageInfos.pkg2, devDependencies: {} },
        { ...fixture.packageInfos.pkg3, devDependencies: { glob: '^8.0.0' } },
        {
          ...fixture.rootPackageInfo,
          devDependencies: { jest: '^28.0.0', rimraf: '^3.0.0' },
        },
      ]);
      expect(mocks.getConsoleLogs()).toEqual([
        '"Widely used" threshold: 50% of packages',
        '',
        'NOT hoisting glob (used by 25%)',
        'Hoisting jest@^28.0.0 (used by 50%)',
        'Hoisting rimraf@^3.0.0 (used by 50%)',
        'NOT hoisting typescript (used by 25%)',
      ]);
    });

    it('overrides threshold with always', () => {
      const fixture = getFakeMonorepo({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0' } },
          pkg2: {},
          pkg3: {},
        },
      });
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ always: ['jest'], threshold: 0.5, write: false });
      expect(getDevDependencies(res)).toEqual({
        pkg1: {},
        'fake-root': { jest: '^28.0.0' },
      });
      expect(mocks.getConsoleLogs()).toEqual([
        '"Widely used" threshold: 50% of packages',
        '',
        'Hoisting jest@^28.0.0 (as requested)',
      ]);
    });

    it('hoists root deps regardless of threshold', () => {
      const fixture = getFakeMonorepo({
        ...thresholdFixtures.basic(),
        root: { devDependencies: { glob: '^8.0.0' } },
      });
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ threshold: 0.5, write: false });
      expect(getDevDependencies(res)).toEqual({
        pkg1: {},
        pkg2: {},
        pkg3: {},
        'fake-root': { jest: '^28.0.0', rimraf: '^3.0.0', glob: '^8.0.0' },
      });
      expect(mocks.getConsoleLogs()).toEqual([
        '"Widely used" threshold: 50% of packages',
        '',
        'Hoisting glob@^8.0.0 (included in root package.json)',
        'Hoisting jest@^28.0.0 (used by 50%)',
        'Hoisting rimraf@^3.0.0 (used by 50%)',
        'NOT hoisting typescript (used by 25%)',
      ]);
    });

    it('hoists deps over threshold even if mismatched', () => {
      const fixture = getFakeMonorepo(thresholdFixtures.mismatch());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ threshold: 0.5, write: false });
      expect(getDevDependencies(res)).toEqual({
        'fake-root': { jest: '^28.0.0' },
        pkg1: {},
        pkg2: {},
      });
      expect(mocks.getConsoleLogs()).toEqual([
        '"Widely used" threshold: 50% of packages',
        '',
        'Found multiple versions of jest: ^28.0.0, ^27.0.0',
        '  ^28.0.0 in pkg1, pkg2',
        '  ^27.0.0 in pkg3',
        'Hoisting jest@^28.0.0 (used by 67%, choosing most popular version)',
      ]);
    });

    // behavior could potentially be better here
    it('does not count mismatched versions cumulatively when comparing to threshold', () => {
      const fixture = getFakeMonorepo(thresholdFixtures.mismatchBelowThreshold());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ threshold: 0.5, write: false });
      expect(res).toEqual([]);
      expect(mocks.getConsoleLogs()).toEqual([
        '"Widely used" threshold: 50% of packages',
        '',
        'Found multiple versions of jest: ^28.0.0, ^27.0.0',
        '  ^28.0.0 in pkg1, pkg2',
        '  ^27.0.0 in pkg3',
        'NOT hoisting jest (used by 40%)',
      ]);
    });

    it('hoists mismatched version even if below threshold when specified in `always`', () => {
      const fixture = getFakeMonorepo(thresholdFixtures.mismatchBelowThreshold());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ always: ['jest'], threshold: 0.5, write: false });
      expect(getDevDependencies(res)).toEqual({
        'fake-root': { jest: '^28.0.0' },
        pkg1: {},
        pkg2: {},
      });
      expect(mocks.getConsoleLogs()).toEqual([
        '"Widely used" threshold: 50% of packages',
        '',
        'Found multiple versions of jest: ^28.0.0, ^27.0.0',
        '  ^28.0.0 in pkg1, pkg2',
        '  ^27.0.0 in pkg3',
        'Hoisting jest@^28.0.0 (as requested, choosing most popular version)',
      ]);
    });

    it('hoists mismatched deps under threshold if at root', () => {
      const fixture = getFakeMonorepo(thresholdFixtures.mismatchBelowThresholdWithRoot());
      mocks = mockMonorepoAndLogs(fixture);

      const res = hoistDevDeps({ threshold: 0.5, write: false });
      expect(getDevDependencies(res)).toEqual({
        'fake-root': { jest: '^27.0.0' },
        pkg3: {},
      });
      expect(mocks.getConsoleLogs()).toEqual([
        '"Widely used" threshold: 50% of packages',
        '',
        'Found multiple versions of jest: ^27.0.0, ^28.0.0',
        '  ^27.0.0 in fake-root, pkg3',
        '  ^28.0.0 in pkg1, pkg2',
        'Hoisting jest@^27.0.0 (included in root package.json)',
      ]);
    });
  });
});
