import fs from 'fs';
import path from 'path';
import { getPackageInfos, getWorkspaceRoot, PackageInfo } from 'workspace-tools';
import { WorkspacePackagesInfo } from './types';

export function getWorkspaceInfo(): WorkspacePackagesInfo {
  const workspaceRoot = getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    throw new Error('Directory does not appear to be within a workspace: ' + process.cwd());
  }

  const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');
  const rootPackageInfo: PackageInfo = {
    packageJsonPath: rootPackageJsonPath,
    ...JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8')),
  };

  // special case: not a monorepo
  let packageInfos = getPackageInfos(workspaceRoot);
  if (packageInfos[rootPackageInfo.name]) {
    packageInfos = { ...packageInfos };
    delete packageInfos[rootPackageInfo.name];
  }

  return {
    workspaceRoot,
    rootPackageInfo,
    packageInfos,
    localPackages: Object.keys(packageInfos),
  };
}
