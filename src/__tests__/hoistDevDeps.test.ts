import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { SpyInstance } from 'jest-mock';
import { PackageInfo } from 'workspace-tools';
import { hoistDevDeps } from '../commands/hoistDevDeps';
import * as getWorkspaceInfoModule from '../utils/getWorkspaceInfo';
import { WorkspacePackagesInfo } from '../utils/types';
import { getFakeWorkspace, WorkspaceFixture } from './fixtures/getFakeWorkspace';

describe('hoistDevDeps', () => {
  let getWorkspaceInfoMock: SpyInstance | undefined;
  let consoleLogMock: SpyInstance | undefined;
  let consoleWarnMock: SpyInstance | undefined;
  let logs: string[] | undefined;

  function mockWorkspaceAndLogs(fixture: WorkspacePackagesInfo) {
    getWorkspaceInfoMock = jest
      .spyOn(getWorkspaceInfoModule, 'getWorkspaceInfo')
      .mockImplementationOnce(() => fixture);

    // combine console.log and console.warn output in order
    logs = [];
    const saveLog = (...args: any[]) => logs!.push(args.join(' '));
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(saveLog);
    consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(saveLog);
  }

  function mockGetWorkspaceInfoThrow() {
    getWorkspaceInfoMock = jest
      .spyOn(getWorkspaceInfoModule, 'getWorkspaceInfo')
      .mockImplementation(() => {
        throw new Error('options were not validated properly (should not reach this code)');
      });
  }

  /** get a mapping of modified package names to new devDependencies, for cases where a full test isn't needed */
  function getNewDevDependencies(packageInfos: PackageInfo[]) {
    return Object.fromEntries(
      packageInfos.map(({ name, devDependencies }) => [name, devDependencies]),
    );
  }

  function getConsoleLogs() {
    return logs!.join('\n');
  }

  afterEach(() => {
    // restore this in case a test failed and it never got called
    getWorkspaceInfoMock?.mockRestore();
    getWorkspaceInfoMock = undefined;

    consoleLogMock?.mockRestore();
    consoleLogMock = undefined;
    consoleWarnMock?.mockRestore();
    consoleWarnMock = undefined;
    logs = undefined;
  });

  describe('basic', () => {
    const basicFixtures = {
      basic: (): WorkspaceFixture => ({
        root: { devDependencies: { typescript: '^4.0.0' } },
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0' } },
          pkg2: { devDependencies: { jest: '^28.0.0', rimraf: '^3.0.0' } },
        },
      }),
      noRoot: (): WorkspaceFixture => ({
        packages: { ...basicFixtures.basic().packages },
      }),
      /** has mismatched jest versions, hoists `^28.0.0` due to popularity */
      mismatched: (): WorkspaceFixture => ({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0' } },
          pkg2: { devDependencies: { jest: '^28.0.0' } },
          pkg3: { devDependencies: { jest: '^27.0.0' } },
        },
      }),
      /** has mismatched jest versions, hoists `^27.0.0` because it's at root */
      mismatchedWithRoot: (): WorkspaceFixture => ({
        root: { devDependencies: { jest: '^27.0.0' } },
        packages: {
          ...basicFixtures.mismatched().packages,
          // also ensure the root version won't win by popularity
          pkg4: { devDependencies: { jest: '^28.0.0' } },
        },
      }),
      /** has mismatched jest versions where `^27.0.0 is at root only, hoists nothing */
      mismatchedRootOnly: (): WorkspaceFixture => {
        const fixture = basicFixtures.mismatchedWithRoot();
        delete fixture.packages.pkg3;
        return fixture;
      },
    };

    it('works in basic case', () => {
      const fixture = getFakeWorkspace(basicFixtures.basic());
      mockWorkspaceAndLogs(fixture);

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
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "Hoisting jest@^28.0.0
        Hoisting rimraf@^3.0.0"
      `);
    });

    it("works if root doesn't already have devDependencies", () => {
      const fixture = getFakeWorkspace(basicFixtures.noRoot());
      mockWorkspaceAndLogs(fixture);

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
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "Hoisting jest@^28.0.0
        Hoisting rimraf@^3.0.0"
      `);
    });

    it('works with nothing to hoist', () => {
      const fixture = getFakeWorkspace({ packages: { pkg1: {} } });
      mockWorkspaceAndLogs(fixture);

      expect(hoistDevDeps({ write: false })).toEqual([]);
      expect(getConsoleLogs()).toEqual('');
    });

    it("doesn't hoist local devDependencies", () => {
      const fixture = getFakeWorkspace({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0', scripts: '^1.0.0' } },
          scripts: {},
        },
      });
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ write: false });
      expect(getNewDevDependencies(res)).toEqual({
        pkg1: { scripts: '^1.0.0' },
        'fake-root': { jest: '^28.0.0' },
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`"Hoisting jest@^28.0.0"`);
    });

    it("doesn't hoist dependencies", () => {
      const fixture = getFakeWorkspace({
        packages: { pkg1: { dependencies: { jest: '^28.0.0' } } },
      });
      mockWorkspaceAndLogs(fixture);

      expect(hoistDevDeps({ write: false })).toEqual([]);
      expect(getConsoleLogs()).toEqual('');
    });

    it('logs in sorted order', () => {
      const deps = ['e', 'c', 'a', 'b', 'd'];
      const fixture = getFakeWorkspace({
        packages: {
          pkg1: { devDependencies: Object.fromEntries(deps.map((dep) => [dep, '1.0.0'])) },
        },
      });
      mockWorkspaceAndLogs(fixture);

      hoistDevDeps({ write: false });
      const sortedDeps = [...deps].sort();
      const expectedLogs = sortedDeps.map((dep) => `Hoisting ${dep}@1.0.0`).join('\n');
      expect(getConsoleLogs()).toEqual(expectedLogs);
    });

    it('chooses most popular version if mismatched and no root version present', () => {
      const fixture = getFakeWorkspace(basicFixtures.mismatched());
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ write: false });
      expect(getNewDevDependencies(res)).toEqual({
        pkg1: {},
        pkg2: {},
        'fake-root': { jest: '^28.0.0' },
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "Found multiple versions of jest: ^28.0.0, ^27.0.0
          ^28.0.0 in pkg1, pkg2
          ^27.0.0 in pkg3
        Hoisting jest@^28.0.0 (choosing most popular version)"
      `);
    });

    it('chooses root version if present and mismatched', () => {
      const fixture = getFakeWorkspace(basicFixtures.mismatchedWithRoot());
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ write: false });
      expect(getNewDevDependencies(res)).toEqual({
        'fake-root': { jest: '^27.0.0' },
        pkg3: {},
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "Found multiple versions of jest: ^27.0.0, ^28.0.0
          ^27.0.0 in fake-root, pkg3
          ^28.0.0 in pkg1, pkg2, pkg4
        Hoisting jest@^27.0.0 (included in root package.json)"
      `);
    });

    it('does nothing if mismatched version is at root only', () => {
      const fixture = getFakeWorkspace(basicFixtures.mismatchedRootOnly());
      mockWorkspaceAndLogs(fixture);

      expect(hoistDevDeps({ write: false })).toEqual([]);
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "Found multiple versions of jest: ^27.0.0, ^28.0.0
          ^27.0.0 in fake-root
          ^28.0.0 in pkg1, pkg2, pkg4"
      `);
    });
  });

  describe('exclude', () => {
    const excludeFixtures = {
      basic: (): WorkspaceFixture => ({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0', rimraf: '^3.0.0' } },
        },
      }),
    };

    it('excludes deps', () => {
      const fixture = getFakeWorkspace(excludeFixtures.basic());
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ exclude: ['rimraf'], write: false });
      expect(res).toEqual([
        { ...fixture.packageInfos.pkg1, devDependencies: { rimraf: '^3.0.0' } },
        { ...fixture.rootPackageInfo, devDependencies: { jest: '^28.0.0' } },
      ]);
      expect(getConsoleLogs()).toMatchInlineSnapshot(`"Hoisting jest@^28.0.0"`);
    });

    it('excludes deps even if specified at root', () => {
      const fixture = getFakeWorkspace({
        ...excludeFixtures.basic(),
        root: { devDependencies: { rimraf: '^3.0.0' } },
      });
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ exclude: ['rimraf'], write: false });
      expect(getNewDevDependencies(res)).toEqual({
        pkg1: { rimraf: '^3.0.0' },
        'fake-root': { rimraf: '^3.0.0', jest: '^28.0.0' },
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`"Hoisting jest@^28.0.0"`);
    });
  });

  describe('only', () => {
    const onlyFixtures = {
      basic: (): WorkspaceFixture => ({
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
      mockGetWorkspaceInfoThrow();
      expect(() =>
        hoistDevDeps({ only: ['pkg1'], threshold: 0.5, write: false }),
      ).toThrowErrorMatchingInlineSnapshot(`"\`only\` and other options are not compatible"`);
      expect(() =>
        hoistDevDeps({ only: ['pkg1'], exclude: ['pkg2'], write: false }),
      ).toThrowErrorMatchingInlineSnapshot(`"\`only\` and other options are not compatible"`);
    });

    it('respects option', () => {
      const fixture = getFakeWorkspace(onlyFixtures.basic());
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ only: ['jest', 'typescript'], write: false });
      expect(getNewDevDependencies(res)).toEqual({
        pkg1: { rimraf: '^3.0.0' },
        pkg2: {},
        'fake-root': { jest: '^28.0.0', typescript: '^4.0.0', rimraf: '^3.0.0' },
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "Hoisting jest@^28.0.0
        Hoisting typescript@^4.0.0"
      `);
    });

    it("does nothing with package that's never a devDependency", () => {
      const fixture = getFakeWorkspace({
        packages: {
          pkg1: { dependencies: { glob: '^8.0.0' }, devDependencies: { rimraf: '^3.0.0' } },
        },
      });
      mockWorkspaceAndLogs(fixture);

      expect(hoistDevDeps({ only: ['glob'], write: false })).toEqual([]);
      expect(getConsoleLogs()).toEqual('');
    });

    it('does nothing with local devDependency', () => {
      const fixture = getFakeWorkspace({
        packages: {
          pkg1: { devDependencies: { scripts: '^1.0.0' } },
          scripts: {},
        },
      });
      mockWorkspaceAndLogs(fixture);

      expect(hoistDevDeps({ only: ['scripts'], write: false })).toEqual([]);
      expect(getConsoleLogs()).toEqual('');
    });
  });

  describe('threshold and always', () => {
    const thresholdFixtures = {
      /** hoists jest and rimraf */
      basic: (): WorkspaceFixture => ({
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
      mismatch: (): WorkspaceFixture => ({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0' } },
          pkg2: { devDependencies: { jest: '^28.0.0' } },
          pkg3: { devDependencies: { jest: '^27.0.0' } },
        },
      }),
      /** cumulatively, jest is above 50% threshold, but no individual version is above threshold */
      mismatchBelowThreshold: (): WorkspaceFixture => ({
        packages: { ...thresholdFixtures.mismatch().packages, pkg4: {}, pkg5: {} },
      }),
      /** as with `mismatchBelowThreshold` but jest 27 is also at root and is hoisted */
      mismatchBelowThresholdWithRoot: (): WorkspaceFixture => ({
        ...thresholdFixtures.mismatchBelowThreshold(),
        root: { devDependencies: { jest: '^27.0.0' } },
      }),
    };

    it('throws if invalid threshold', () => {
      mockGetWorkspaceInfoThrow();
      expect(() =>
        hoistDevDeps({ write: false, threshold: -1 }),
      ).toThrowErrorMatchingInlineSnapshot(`"\`threshold\` must be between 0 and 1 inclusive"`);
      expect(() =>
        hoistDevDeps({ write: false, threshold: 50 }),
      ).toThrowErrorMatchingInlineSnapshot(`"\`threshold\` must be between 0 and 1 inclusive"`);
    });

    it('throws if `always` used without `threshold`', () => {
      mockGetWorkspaceInfoThrow();
      expect(() =>
        hoistDevDeps({ write: false, always: ['pkg1'] }),
      ).toThrowErrorMatchingInlineSnapshot(`"\`always\` is only relevant with \`threshold\`"`);
    });

    it('throws if a package is listed in both `exclude` and `always`', () => {
      mockGetWorkspaceInfoThrow();
      expect(() =>
        hoistDevDeps({ write: false, exclude: ['pkg1'], always: ['pkg1'], threshold: 0.5 }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"a package cannot be listed in both \`exclude\` and \`always\`"`,
      );
    });

    it('respects threshold', () => {
      const fixture = getFakeWorkspace(thresholdFixtures.basic());
      mockWorkspaceAndLogs(fixture);

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
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "\\"Widely used\\" threshold: 50% of packages

        NOT hoisting glob (used by 25%)
        Hoisting jest@^28.0.0 (used by 50%)
        Hoisting rimraf@^3.0.0 (used by 50%)
        NOT hoisting typescript (used by 25%)"
      `);
    });

    it('overrides threshold with always', () => {
      const fixture = getFakeWorkspace({
        packages: {
          pkg1: { devDependencies: { jest: '^28.0.0' } },
          pkg2: {},
          pkg3: {},
        },
      });
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ always: ['jest'], threshold: 0.5, write: false });
      expect(getNewDevDependencies(res)).toEqual({
        pkg1: {},
        'fake-root': { jest: '^28.0.0' },
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "\\"Widely used\\" threshold: 50% of packages

        Hoisting jest@^28.0.0 (as requested)"
      `);
    });

    it('hoists root deps regardless of threshold', () => {
      const fixture = getFakeWorkspace({
        ...thresholdFixtures.basic(),
        root: { devDependencies: { glob: '^8.0.0' } },
      });
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ threshold: 0.5, write: false });
      expect(getNewDevDependencies(res)).toEqual({
        pkg1: {},
        pkg2: {},
        pkg3: {},
        'fake-root': { jest: '^28.0.0', rimraf: '^3.0.0', glob: '^8.0.0' },
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "\\"Widely used\\" threshold: 50% of packages

        Hoisting glob@^8.0.0 (included in root package.json)
        Hoisting jest@^28.0.0 (used by 50%)
        Hoisting rimraf@^3.0.0 (used by 50%)
        NOT hoisting typescript (used by 25%)"
      `);
    });

    it('hoists deps over threshold even if mismatched', () => {
      const fixture = getFakeWorkspace(thresholdFixtures.mismatch());
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ threshold: 0.5, write: false });
      expect(getNewDevDependencies(res)).toEqual({
        'fake-root': { jest: '^28.0.0' },
        pkg1: {},
        pkg2: {},
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "\\"Widely used\\" threshold: 50% of packages

        Found multiple versions of jest: ^28.0.0, ^27.0.0
          ^28.0.0 in pkg1, pkg2
          ^27.0.0 in pkg3
        Hoisting jest@^28.0.0 (used by 67%, choosing most popular version)"
      `);
    });

    // behavior could potentially be better here
    it('does not count mismatched versions cumulatively when comparing to threshold', () => {
      const fixture = getFakeWorkspace(thresholdFixtures.mismatchBelowThreshold());
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ threshold: 0.5, write: false });
      expect(res).toEqual([]);
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "\\"Widely used\\" threshold: 50% of packages

        Found multiple versions of jest: ^28.0.0, ^27.0.0
          ^28.0.0 in pkg1, pkg2
          ^27.0.0 in pkg3
        NOT hoisting jest (used by 40%)"
      `);
    });

    it('hoists mismatched version even if below threshold when specified in `always`', () => {
      const fixture = getFakeWorkspace(thresholdFixtures.mismatchBelowThreshold());
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ always: ['jest'], threshold: 0.5, write: false });
      expect(getNewDevDependencies(res)).toEqual({
        'fake-root': { jest: '^28.0.0' },
        pkg1: {},
        pkg2: {},
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "\\"Widely used\\" threshold: 50% of packages

        Found multiple versions of jest: ^28.0.0, ^27.0.0
          ^28.0.0 in pkg1, pkg2
          ^27.0.0 in pkg3
        Hoisting jest@^28.0.0 (as requested, choosing most popular version)"
      `);
    });

    it('hoists mismatched deps under threshold if at root', () => {
      const fixture = getFakeWorkspace(thresholdFixtures.mismatchBelowThresholdWithRoot());
      mockWorkspaceAndLogs(fixture);

      const res = hoistDevDeps({ threshold: 0.5, write: false });
      expect(getNewDevDependencies(res)).toEqual({
        'fake-root': { jest: '^27.0.0' },
        pkg3: {},
      });
      expect(getConsoleLogs()).toMatchInlineSnapshot(`
        "\\"Widely used\\" threshold: 50% of packages

        Found multiple versions of jest: ^27.0.0, ^28.0.0
          ^27.0.0 in fake-root, pkg3
          ^28.0.0 in pkg1, pkg2
        Hoisting jest@^27.0.0 (included in root package.json)"
      `);
    });
  });
});
