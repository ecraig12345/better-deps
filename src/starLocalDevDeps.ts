import fs from 'fs';
import os from 'os';
import { getWorkspaceInfo } from './getWorkspaceInfo';

async function starLocalDevDeps() {
  const { packageInfos, localPackages, rootPackageJson, rootPackageJsonPath } = getWorkspaceInfo();

  packageInfos[rootPackageJson.name] = {
    ...rootPackageJson,
    packageJsonPath: rootPackageJsonPath,
  };

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
