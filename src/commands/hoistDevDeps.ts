import { PackageInfo } from 'workspace-tools';
import { getWorkspaceInfo } from '../utils/getWorkspaceInfo';
import { partialClonePackageInfo } from '../utils/partialClonePackageInfo';
import { Dependencies } from '../utils/types';
import { writePackageJsonUpdates } from '../utils/writePackageJsonUpdates';

export type HoistDevDepsOptions = {
  /** never hoist these deps */
  exclude?: string[];
  /** only hoist these deps (not compatible with other options) */
  only?: string[];
  /** popularity threshold for hoisting (0 to 1) */
  threshold?: number;
  /** always hoist these deps regardless of popularity (only relevant with `threshold`) */
  always?: string[];
  /** whether to write changes (default true) */
  write?: boolean;
};

/** map from version spec to list of packages using it */
type DepVersions = { [version: string]: string[] };

/** map from dep name to versions used by packages */
type CollectedDeps = { [depName: string]: DepVersions };

/**
 * Collect all dev deps from an individual package.
 * @param packageInfo package.json for an individual package
 * @param repoDevDeps accumulated dev deps of the repo
 * @param exclude dep names to exclude
 */
function collectDevDeps(packageInfo: PackageInfo, repoDevDeps: CollectedDeps, exclude: string[]) {
  for (const [depName, version] of Object.entries(packageInfo.devDependencies || {})) {
    if (!exclude.includes(depName)) {
      repoDevDeps[depName] = repoDevDeps[depName] || {};
      repoDevDeps[depName][version] = repoDevDeps[depName][version] || [];
      repoDevDeps[depName][version].push(packageInfo.name);
    }
  }
}

/**
 * Determines whether this dep should be hoisted and which version to use (if multiple are present)
 * @returns version to hoist or undefined if it's not popular enough
 */
function chooseHoistVersion(options: {
  /** name of the dependency */
  depName: string;
  /** versions of this dep and packages that use them */
  versions: DepVersions;
  /** dev dep version specified in the root package.json (if any) */
  rootDepVersion: string | undefined;
  /** number of packages defined in this monorepo */
  localPackageCount: number;
  /** deps that should be hoisted regardless of popularity */
  always?: string[];
  /** only hoist these deps */
  only?: string[];
  /** popularity threshold for hoisting (0 to 1) */
  threshold?: number;
}): string | undefined {
  const { depName, versions, rootDepVersion, localPackageCount, always, only, threshold } = options;

  if (only && !only.includes(depName)) {
    return;
  }

  const versionSpecs = Object.keys(versions);
  const hasMismatch = versionSpecs.length > 1;
  if (hasMismatch) {
    console.warn(`Found multiple versions of ${depName}: ${versionSpecs.join(', ')}`);
    for (const [version, packages] of Object.entries(versions)) {
      console.warn(`  ${version} in ${packages.join(', ')}`);
    }
  }

  // If a dep is already specified at the root, always use that version.
  // Otherwise, choose the most popular version if there's more than one.
  const popularVersion = versionSpecs.reduce((popular, ver) =>
    versions[ver].length > versions[popular].length ? ver : popular,
  );

  let hoistVersion = '';
  let reason = '';

  if (rootDepVersion) {
    if (versions[rootDepVersion].length > 1) {
      // if a dep version specified at the root is also used elsewhere, always hoist it
      hoistVersion = rootDepVersion;
      if (only) {
        reason = hasMismatch ? 'choosing root package.json version' : '';
      } else {
        reason = 'included in root package.json';
      }
    } else {
      // else, no-op ("hoisting" a dep used only at the root would do nothing, but exclude it to reduce log spam)
      reason = 'already hoisted';
    }
  } else if (always?.includes(depName)) {
    // dep is requested to always hoist
    hoistVersion = popularVersion;
    reason = 'as requested';
  } else if (!threshold) {
    // no threshold specified => hoist all dev deps
    hoistVersion = popularVersion;
  } else {
    const usedAmount = versions[popularVersion].length / localPackageCount;
    reason = `used by ${Math.round(usedAmount * 100)}%`;
    if (usedAmount >= threshold) {
      // dep is popular enough
      hoistVersion = popularVersion;
    }
  }

  if (hoistVersion) {
    if (hasMismatch && hoistVersion !== rootDepVersion) {
      reason += reason ? ', ' : '';
      reason += 'choosing most popular version';
    }
    console.log(`Hoisting ${depName}@${hoistVersion}${reason ? ` (${reason})` : ''}`);
    return hoistVersion;
  }

  // skip logging "already hoisted" deps to reduce log spam
  if (reason !== 'already hoisted') {
    console.log(`NOT hoisting ${depName} (${reason})`);
  }
}

/**
 * Get a copy of `packageInfo` with any matching `hoistedDeps` removed.
 * @param packageInfo package.json for an individual package
 * @param hoistedDeps packages that have been hoisted and should be deleted here
 * @returns new package info if there were any updates, or undefined if not
 */
function getUpdatedPackageInfo(packageInfo: PackageInfo, hoistedDeps: Dependencies) {
  if (!packageInfo.devDependencies) {
    return;
  }

  let updatedInfo: PackageInfo | undefined;
  for (const [name, version] of Object.entries(hoistedDeps)) {
    if (packageInfo.devDependencies[name] === version) {
      updatedInfo ??= partialClonePackageInfo(packageInfo, ['devDependencies']);
      delete updatedInfo.devDependencies![name];
    }
  }
  return updatedInfo;
}

export function hoistDevDeps(options: HoistDevDepsOptions) {
  const { threshold = 0, always, exclude, only, write = true } = options;

  if (only && (threshold || always || exclude)) {
    throw new Error('`only` and other options are not compatible');
  }
  if (always && !threshold) {
    throw new Error('`always` is only relevant with `threshold`');
  }
  if (threshold && (threshold < 0 || threshold > 1)) {
    throw new Error('`threshold` must be between 0 and 1 inclusive');
  }
  if (exclude && always && exclude.some((dep) => always.includes(dep))) {
    throw new Error('a package cannot be listed in both `exclude` and `always`');
  }

  threshold &&
    console.log(`"Widely used" threshold: ${Math.round(threshold * 100)}% of packages\n`);

  const { rootPackageInfo, packageInfos, localPackages } = getWorkspaceInfo();

  /** requested exclude packages + local packages */
  const allNoHoist = [...(exclude || []), ...localPackages];

  const devDeps: CollectedDeps = {};

  // collect dev deps from the root package.json
  collectDevDeps(rootPackageInfo, devDeps, allNoHoist);

  // collect potentially-hoistable dev deps from all the individual packages
  for (const packageJson of Object.values(packageInfos)) {
    collectDevDeps(packageJson, devDeps, allNoHoist);
  }

  // generate the hoisting list (and validate that the versions are consistent)
  const hoistedDeps: Dependencies = {};
  for (const [depName, versions] of Object.entries(devDeps)) {
    const hoistVersion = chooseHoistVersion({
      depName,
      versions,
      rootDepVersion: rootPackageInfo.devDependencies?.[depName],
      localPackageCount: localPackages.length,
      always,
      only,
      threshold,
    });
    if (hoistVersion) {
      hoistedDeps[depName] = hoistVersion;
    }
  }

  // update individual packages
  const updatedPackageInfos = Object.values(packageInfos)
    .map((packageInfo) => getUpdatedPackageInfo(packageInfo, hoistedDeps))
    .filter((p): p is PackageInfo => !!p);

  // update root package.json (with dep names sorted)
  if (updatedPackageInfos.length) {
    const newRootDeps = { ...rootPackageInfo.devDependencies, ...hoistedDeps };
    const sortedDeps = Object.entries(newRootDeps).sort(([aName], [bName]) =>
      aName < bName ? -1 : 1,
    );
    const newRootPackageInfo = { ...rootPackageInfo };
    newRootPackageInfo.devDependencies = Object.fromEntries(sortedDeps);
    updatedPackageInfos.push(newRootPackageInfo);
  }

  if (write) {
    writePackageJsonUpdates(updatedPackageInfos);
  }

  return updatedPackageInfos;
}
