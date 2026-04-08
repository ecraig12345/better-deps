import type { PackageInfo, PackageInfos } from 'workspace-tools';

/** map from dep name to version spec */
export type Dependencies = { [depName: string]: string };
export type DependencyField = 'devDependencies' | 'dependencies' | 'peerDependencies';

export type MonorepoInfo = {
  root: string;
  rootPackageInfo: PackageInfo;
  packageInfos: PackageInfos;
};
