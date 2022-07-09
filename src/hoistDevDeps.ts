import fs from 'fs';
import os from 'os';
import { getWorkspaceInfo } from './getWorkspaceInfo';
import { PackageJson, Dependencies } from './types';

const widelyUsedThreshold = 0.5;
console.log(`"Widely used" threshold: ${Math.round(widelyUsedThreshold * 100)}% of packages\n`);

/** always hoist these dev deps */
const defaultForceHoist: string[] = [];
/** never hoist these dev deps */
const defaultNoHoist: string[] = [];

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
  /** list of packages that should be hoisted regardless of popularity */
  forceHoist: string[];
}): string | undefined {
  const { depName, versions, rootDepVersion, localPackageCount, forceHoist } = options;
  const versionSpecs = Object.keys(versions);
  if (versionSpecs.length > 1) {
    console.warn(`Found multiple versions of ${depName}: ${versionSpecs.join(', ')}`);
    for (const [version, packages] of Object.entries(versions)) {
      console.warn(`  ${version} in ${packages.join(', ')}`);
    }
  }

  const popularVersion = versionSpecs.reduce((popular, ver) =>
    versions[ver].length > versions[popular].length ? ver : popular,
  );

  let hoistVersion = '';
  let reason = '';
  const mostPopularReason = versionSpecs.length > 1 ? ', choosing the most popular version' : '';
  if (rootDepVersion) {
    // if a dep version specified at the root is also used elsewhere, always hoist it
    // ("hoisting" a dep used only at the root would do nothing, but exclude it to reduce log spam)
    if (versions[rootDepVersion].length > 1) {
      hoistVersion = rootDepVersion;
      reason = 'included in root package.json';
    } else {
      reason = 'already hoisted';
    }
  } else if (forceHoist.includes(depName)) {
    hoistVersion = popularVersion;
    reason = 'included in forceHoist' + mostPopularReason;
  } else if (versions[popularVersion].length / localPackageCount > widelyUsedThreshold) {
    hoistVersion = popularVersion;
    reason = `widely used${mostPopularReason}`;
  } else {
    reason = 'not widely used';
  }

  if (hoistVersion) {
    console.log(`Hoisting ${depName}@${hoistVersion} (${reason})`);
    return hoistVersion;
  }
  if (reason !== 'already hoisted') {
    console.log(`NOT hoisting ${depName} (${reason})`);
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

/**
 * @param forceHoist always hoist these packages
 * @param noHoist never hoist these packages
 */
async function hoistDeps(forceHoist: string[], noHoist: string[]) {
  const { rootPackageJson, rootPackageJsonPath, packageInfos, localPackages } = getWorkspaceInfo();

  /** requested noHoist packages + local packages */
  const allNoHoist = [...noHoist, ...localPackages];

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
      forceHoist,
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

hoistDeps(defaultForceHoist, defaultNoHoist).catch((err) => {
  console.error(err);
  process.exit(1);
});
