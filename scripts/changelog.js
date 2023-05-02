// Changelog line generation, referenced from .changeset/config.json
// @ts-check
const packageJson = require('../package.json');
const repositoryUrl = packageJson.repository.url.replace(/\.git$/, '');

/** @type {import('@changesets/types').ChangelogFunctions} */
const changelogFunctions = {
  getReleaseLine: async (changeset, type, changelogOpts) => {
    const lines = changeset.summary.trim().split('\n');

    const commitLink = changeset.commit
      ? `([${changeset.commit}](${repositoryUrl}/commit/${changeset.commit}))`
      : '';

    return [
      `- ${lines[0]} ${commitLink}`.trimEnd(),
      ...lines.slice(1).map((l) => `  ${l.trimEnd()}`),
    ].join('\n');
  },
  // not used here
  getDependencyReleaseLine: async () => '',
};

module.exports = changelogFunctions;
