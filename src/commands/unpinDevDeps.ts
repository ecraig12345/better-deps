import { PackageInfo } from 'workspace-tools';
import { getWorkspaceInfo } from '../utils/getWorkspaceInfo';
import { partialClonePackageInfo } from '../utils/partialClonePackageInfo';
import { writePackageJsonUpdates } from '../utils/writePackageJsonUpdates';
import { collectDevDeps } from '../utils/collectDevDeps';

export type UnpinDevDepsOptions = {
  /** Exclude these deps */
  exclude?: string[];

  /**
   * Type of range to allow for dev deps: minor (`^`) or patch (`~`).
   * @default 'minor'
   */
  range?: 'minor' | 'patch';

  /** Use patch ranges (`~`) for these dev deps */
  patch?: string[];

  /** Use minor ranges (`^`) for these dev deps */
  minor?: string[];

  /** whether to write changes (default true) */
  write?: boolean;
};

type UpdateDepVersions = Array<{ name: string; oldVersion: string; newVersion: string }>;

/**
 * Get a copy of `packageInfo` with any matching dev deps updated.
 * @param packageInfo package.json for an individual package
 * @param updateDevDeps dev dep versions to change
 * @returns new package info if there were any updates, or undefined if not
 */
function getUpdatedPackageInfo(packageInfo: PackageInfo, updateDevDeps: UpdateDepVersions) {
  if (!packageInfo.devDependencies) {
    return;
  }

  let updatedInfo: PackageInfo | undefined;
  for (const { name, oldVersion, newVersion } of updateDevDeps) {
    if (packageInfo.devDependencies[name] === oldVersion) {
      updatedInfo ??= partialClonePackageInfo(packageInfo, ['devDependencies']);
      updatedInfo.devDependencies![name] = newVersion;
    }
  }
  return updatedInfo;
}

export function unpinDevDeps(options: UnpinDevDepsOptions) {
  const { range = 'minor', exclude = [], patch = [], minor = [], write = true } = options;

  const workspaceInfo = getWorkspaceInfo();
  const { rootPackageInfo, packageInfos } = workspaceInfo;

  // collect external dev deps from the root package.json and individual packages
  const externalDevDeps = collectDevDeps(workspaceInfo, exclude);

  // collect versions to update (use an array in case of multiple versions of a dep)
  const updateDevDeps: UpdateDepVersions = [];
  for (const [name, versions] of Object.entries(externalDevDeps)) {
    for (const oldVersion of Object.keys(versions)) {
      // update if it's an exact version and not prerelease
      if (/^\d+\.\d+\.\d+$/.test(oldVersion)) {
        const depRange = patch.includes(name)
          ? '~'
          : minor.includes(name)
            ? '^'
            : range === 'minor'
              ? '^'
              : '~';
        const newVersion = `${depRange}${oldVersion}`;
        console.log(`Updating ${name}@${oldVersion} to ${newVersion}`);
        updateDevDeps.push({ name, oldVersion, newVersion });
      }
    }
  }

  // update individual packages
  const updatedPackageInfos = [rootPackageInfo, ...Object.values(packageInfos)]
    .map((packageInfo) => getUpdatedPackageInfo(packageInfo, updateDevDeps))
    .filter((p): p is PackageInfo => !!p);

  if (write) {
    writePackageJsonUpdates(updatedPackageInfos);
  }

  return updatedPackageInfos;
}
