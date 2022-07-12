/** map from dep name to version spec */
export type Dependencies = { [depName: string]: string };
export type DependencyField = 'devDependencies' | 'dependencies' | 'peerDependencies';
