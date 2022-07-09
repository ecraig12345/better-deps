import fs from 'fs';
import os from 'os';
import path from 'path';
import { getPackageInfos, getWorkspaceRoot, PackageInfo } from 'workspace-tools';

async function starLocalDevDeps() {
  const workspaceRoot = getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    throw new Error('Directory does not appear to be within a workspace: ' + process.cwd());
  }

  const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');
  const rootPackageInfo: PackageInfo = {
    ...JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8')),
    packageJsonPath: rootPackageJsonPath,
  };

  const packageInfos = {
    ...getPackageInfos(workspaceRoot),
    [rootPackageInfo.name]: rootPackageInfo,
  };
  const localPackages = Object.keys(packageInfos);

  for (const { packageJsonPath, ...packageJson } of Object.values(packageInfos)) {
    if (!packageJson.devDependencies) {
      continue;
    }

    let hasChanges = false;
    for (const localDep of localPackages) {
      if (packageJson.devDependencies[localDep]) {
        packageJson.devDependencies[localDep] = '*';
        hasChanges = true;
      }
    }
    if (hasChanges) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + os.EOL);
    }
  }
}

starLocalDevDeps().catch((err) => {
  console.error(err);
  process.exit(1);
});
