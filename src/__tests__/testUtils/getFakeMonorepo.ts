import type { PackageInfo, PackageInfos } from 'workspace-tools';
import type { MonorepoInfo } from '../../utils/types';

export type MonorepoFixture = {
  root?: Partial<PackageInfo>;
  packages?: { [packageName: string]: Partial<PackageInfo> };
};

/** get a full fake return value of `getMonorepoInfo()` based on a fixture */
export function getFakeMonorepo(fixture: MonorepoFixture): MonorepoInfo {
  const root = 'fake-root';
  const rootPackageInfo = {
    name: 'fake-root',
    version: '1.0.0',
    ...fixture.root,
    packageJsonPath: `${root}/package.json`,
  } as PackageInfo;

  const packageInfos: PackageInfos = {};
  for (const [name, packageJson] of Object.entries(fixture.packages || {})) {
    const packageJsonPath = `${root}/packages/${name}/package.json`;
    packageInfos[name] = { name, version: '1.0.0', ...packageJson, packageJsonPath } as PackageInfo;
  }

  return { root, rootPackageInfo, packageInfos };
}
