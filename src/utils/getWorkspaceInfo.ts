import fs from 'fs';
import path from 'path';
import { getPackageInfos, getWorkspaceRoot } from 'workspace-tools';
import { PackageJson } from './types';

export function getWorkspaceInfo() {
  const workspaceRoot = getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    throw new Error('Directory does not appear to be within a workspace: ' + process.cwd());
  }

  const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');
  const rootPackageJson: PackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));

  const packageInfos = getPackageInfos(workspaceRoot);

  return {
    workspaceRoot,
    rootPackageJsonPath,
    rootPackageJson,
    packageInfos,
    localPackages: Object.keys(packageInfos),
  };
}
