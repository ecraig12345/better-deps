# better-deps

CLI for cleaning up issues with JavaScript dependencies in monorepos/workspaces.

Right now it provides two separate CLIs, which will be unified under a single tool later.

`hoist-dev-deps` hoists widely-used `devDependencies` from individual packages to the repo root.

`star-local-dev-deps` looks at the `devDependencies` of each package and changes the version specs for any packages within the monorepo to `*`.
