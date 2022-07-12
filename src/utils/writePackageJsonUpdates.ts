import fs from 'fs';
import os from 'os';
import { PackageInfo } from 'workspace-tools';

export async function writePackageJsonUpdates(packageInfos: PackageInfo[]) {
  for (const { packageJsonPath, ...packageJson } of packageInfos) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + os.EOL);
  }
}
