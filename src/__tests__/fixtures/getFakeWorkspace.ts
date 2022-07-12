import { PackageInfo, PackageInfos } from 'workspace-tools';
import { WorkspacePackagesInfo } from '../../utils/types';

export type WorkspaceFixture = {
  root?: Partial<PackageInfo>;
  packages: { [packageName: string]: Partial<PackageInfo> };
};

/** get a full fake return value of `getWorkspaceInfo()` based on a fixture */
export function getFakeWorkspace(fixture: WorkspaceFixture): WorkspacePackagesInfo {
  const workspaceRoot = 'fake-root';
  const rootPackageInfo = {
    name: 'fake-root',
    version: '1.0.0',
    ...fixture.root,
    packageJsonPath: `${workspaceRoot}/package.json`,
  } as PackageInfo;

  const packageInfos: PackageInfos = {};
  for (const [name, packageJson] of Object.entries(fixture.packages)) {
    const packageJsonPath = `${workspaceRoot}/packages/${name}/package.json`;
    packageInfos[name] = { name, version: '1.0.0', ...packageJson, packageJsonPath } as PackageInfo;
  }

  return {
    workspaceRoot,
    rootPackageInfo,
    packageInfos,
    localPackages: Object.keys(packageInfos),
  };
}
