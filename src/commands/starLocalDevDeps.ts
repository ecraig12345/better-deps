import type { PackageInfo } from 'workspace-tools';
import { getMonorepoInfo } from '../utils/getMonorepoInfo';
import { writePackageJsonUpdates } from '../utils/writePackageJsonUpdates';

export function starLocalDevDeps(write: boolean = true) {
  const { packageInfos } = getMonorepoInfo();
  const localPackages = Object.keys(packageInfos);

  const updatedPackageInfos = Object.values(packageInfos)
    .map((packageInfo) => {
      if (!packageInfo.devDependencies) {
        return;
      }

      let updatedInfo: PackageInfo | undefined;
      for (const localDep of localPackages) {
        if (
          packageInfo.devDependencies[localDep] &&
          packageInfo.devDependencies[localDep] !== '*'
        ) {
          updatedInfo ??= { ...packageInfo, devDependencies: { ...packageInfo.devDependencies } };
          updatedInfo.devDependencies![localDep] = '*';
        }
      }
      return updatedInfo;
    })
    .filter((p): p is PackageInfo => !!p);

  if (write) {
    writePackageJsonUpdates(updatedPackageInfos);
  }

  return updatedPackageInfos;
}
