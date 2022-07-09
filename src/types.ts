/** map from dep name to version spec */
export type Dependencies = { [depName: string]: string };
/** partial package.json */
export type PackageJson = { name: string; version: string; devDependencies?: Dependencies };
