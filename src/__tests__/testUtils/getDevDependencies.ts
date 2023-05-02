import { PackageInfo } from 'workspace-tools';

/** Get a mapping of package names to devDependencies */
export function getDevDependencies(packageInfos: PackageInfo[]) {
  return Object.fromEntries(
    packageInfos.map(({ name, devDependencies }) => [name, devDependencies]),
  );
}
