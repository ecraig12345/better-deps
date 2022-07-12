import fs from 'fs';
import os from 'os';
import { getWorkspaceInfo } from '../utils/getWorkspaceInfo';
import { PackageJson, Dependencies } from '../utils/types';

export type HoistDevDepsOptions = {
  /** never hoist these deps */
  exclude?: string[];
  /** only hoist these deps */
  only?: string[];
  /** popularity threshold for hoisting (0 to 1) */
  threshold?: number;
  /** always hoist these deps regardless of popularity (only relevant with `threshold`) */
  always?: string[];
};

/** map from version spec to list of packages using it */
type DepVersions = { [version: string]: string[] };

/** map from dep name to versions used by packages */
type CollectedDeps = { [depName: string]: DepVersions };

/**
 * Collect all dev deps from an individual package.
 * @param packageJson package.json for an individual package
 * @param repoDevDeps accumulated dev deps of the repo
 * @param exclude dep names to exclude
 */
function collectDevDeps(packageJson: PackageJson, repoDevDeps: CollectedDeps, exclude: string[]) {
  for (const [depName, version] of Object.entries(packageJson.devDependencies || {})) {
    if (!exclude.includes(depName)) {
      repoDevDeps[depName] = repoDevDeps[depName] || {};
      repoDevDeps[depName][version] = repoDevDeps[depName][version] || [];
      repoDevDeps[depName][version].push(packageJson.name);
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
    if (versions[rootDepVersion].length === 1) {
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
  } else if (versions[popularVersion].length / localPackageCount >= threshold) {
    // dep is popular enough
    hoistVersion = popularVersion;
    reason = 'widely used';
  }

  if (hoistVersion) {
    if (hasMismatch && hoistVersion === popularVersion) {
      reason += reason ? ', ' : '';
      reason += 'choosing most popular version';
    }
    console.log(`Hoisting ${depName}@${hoistVersion}${reason ? ` (${reason})` : ''}`);
    return hoistVersion;
  }

  // skip logging "already hoisted" deps to reduce log spam
  if (reason !== 'already hoisted') {
    console.log(`NOT hoisting ${depName} (not widely used)`);
  }
}

/**
 * Update `packageJson` to delete any matching `hoistedDeps`
 * @param packageJson package.json for an individual package
 * @param hoistedDeps packages that have been hoisted and should be deleted here
 */
function updatePackageJson(packageJson: PackageJson, hoistedDeps: Dependencies) {
  const devDeps = packageJson.devDependencies || {};

  for (const [name, version] of Object.entries(hoistedDeps)) {
    if (devDeps[name] && devDeps[name] === version) {
      delete devDeps[name];
    }
  }

  if (!Object.keys(devDeps).length) {
    delete packageJson.devDependencies;
  }
}

export async function hoistDevDeps(options: HoistDevDepsOptions) {
  const { threshold = 0, always, exclude, only } = options;

  threshold &&
    console.log(`"Widely used" threshold: ${Math.round(threshold * 100)}% of packages\n`);

  const { rootPackageJson, rootPackageJsonPath, packageInfos, localPackages } = getWorkspaceInfo();

  /** requested exclude packages + local packages */
  const allNoHoist = [...(exclude || []), ...localPackages];

  const devDeps: CollectedDeps = {};

  // collect dev deps from the root package.json
  collectDevDeps(rootPackageJson, devDeps, allNoHoist);

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
      rootDepVersion: rootPackageJson.devDependencies?.[depName],
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
  for (const { packageJsonPath, ...packageJson } of Object.values(packageInfos)) {
    if (packageJson.devDependencies) {
      updatePackageJson(packageJson, hoistedDeps);
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + os.EOL);
    }
  }

  // update root package.json (with dep names sorted)
  const newRootDeps = { ...rootPackageJson.devDependencies, ...hoistedDeps };
  const sortedDeps = Object.keys(newRootDeps).sort();
  rootPackageJson.devDependencies = {};
  for (const depName of sortedDeps) {
    rootPackageJson.devDependencies[depName] = newRootDeps[depName];
  }
  fs.writeFileSync(rootPackageJsonPath, JSON.stringify(rootPackageJson, null, 2) + os.EOL);
}
