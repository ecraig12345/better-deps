import fs from 'fs';
import path from 'path';
import { getPackageInfos, getWorkspaceRoot, PackageInfo } from 'workspace-tools';

export function getWorkspaceInfo() {
  const workspaceRoot = getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    throw new Error('Directory does not appear to be within a workspace: ' + process.cwd());
  }

  const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');
  const rootPackageInfo: PackageInfo = {
    packageJsonPath: rootPackageJsonPath,
    ...JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8')),
  };

  const packageInfos = getPackageInfos(workspaceRoot);

  return {
    workspaceRoot,
    rootPackageInfo,
    packageInfos,
    localPackages: Object.keys(packageInfos),
  };
}
