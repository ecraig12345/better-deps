import { sortObject } from './sortObject';
import { MonorepoInfo } from './types';

/** map from version spec to list of packages using it */
export type DepVersions = { [version: string]: string[] };

/** map from dep name to versions used by packages */
export type CollectedDeps = { [depName: string]: DepVersions };

/**
 * Collect all external dev deps for the repo.
 * @param exclude dep names to exclude
 */
export function collectDevDeps(repoInfo: MonorepoInfo, exclude: string[]) {
  const { rootPackageInfo, packageInfos } = repoInfo;
  const allPackageInfos = [rootPackageInfo, ...Object.values(packageInfos)];
  const allExclude = [...exclude, ...Object.keys(packageInfos)];

  const devDeps: CollectedDeps = {};
  for (const packageInfo of allPackageInfos) {
    for (const [depName, version] of Object.entries(packageInfo.devDependencies || {})) {
      if (!allExclude.includes(depName)) {
        devDeps[depName] ??= {};
        devDeps[depName][version] ??= [];
        devDeps[depName][version].push(packageInfo.name);
      }
    }
  }
  // use sorted order for nicer logging
  return sortObject(devDeps);
}
