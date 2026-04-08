import fs from 'fs';
import path from 'path';
import { getPackageInfos, getWorkspaceManagerRoot, type PackageInfo } from 'workspace-tools';
import type { MonorepoInfo } from './types';

export function getMonorepoInfo(): MonorepoInfo {
  const root = getWorkspaceManagerRoot(process.cwd());
  if (!root) {
    throw new Error('Directory does not appear to be within a monorepo: ' + process.cwd());
  }

  const rootPackageJsonPath = path.join(root, 'package.json');
  const rootPackageInfo: PackageInfo = {
    packageJsonPath: rootPackageJsonPath,
    ...JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8')),
  };

  let packageInfos = getPackageInfos(root);
  if (packageInfos[rootPackageInfo.name]) {
    packageInfos = { ...packageInfos };
    delete packageInfos[rootPackageInfo.name];
  }

  return { root, rootPackageInfo, packageInfos };
}
