import { PackageInfo } from 'workspace-tools';
import { partialClonePackageInfo } from '../utils/partialClonePackageInfo';
import { getWorkspaceInfo } from '../utils/getWorkspaceInfo';
import { writePackageJsonUpdates } from '../utils/writePackageJsonUpdates';

export function starLocalDevDeps(write: boolean = true) {
  const { packageInfos, localPackages } = getWorkspaceInfo();

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
          updatedInfo ??= partialClonePackageInfo(packageInfo, ['devDependencies']);
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
