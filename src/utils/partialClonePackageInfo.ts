import { PackageInfo } from 'workspace-tools';
import { DependencyField } from './types';

// IMPORTANT: If a field with a format besides object mapping from string to primitive
// is added here, the implementation below must also be updated to support it!
export type CloneableField = DependencyField;

/**
 * Clone a PackageInfo, deeply cloning only specified fields.
 */
export function partialClonePackageInfo(
  packageInfo: PackageInfo,
  fields: CloneableField[],
): PackageInfo {
  const clone = { ...packageInfo };
  for (const field of fields) {
    if (packageInfo[field]) {
      clone[field] = { ...packageInfo[field] };
    }
  }
  return clone;
}
