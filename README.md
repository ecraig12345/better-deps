# better-deps

CLI for cleaning up issues with JavaScript dependencies in monorepos/workspaces.

## Caveats

The term "issues" here is somewhat subjective: the recommendations implemented by this CLI are "better practices" that tend to reduce issues encountered in certain common monorepo setups, but they may not be applicable or preferable in all cases.

The initial implementation of this tool doesn't provide any enforcement to prevent issues from being re-introduced. In the future, it may be modified to follow more of a "linter" model with a configurable list of rules, or entirely rewritten as an ESLint plugin.

## Commands

### `hoist-dev-deps`

Remove `devDependencies` from individual packages and declare them at the monorepo/workspace root instead.

**Why:** TODO

**Options:**

- `--exclude <deps...>`: Don't hoist these `devDependencies`
- `--only <deps...>`: Only hoist these `devDependencies` (mutually exclusive with other options)
- `--threshold <percent>`: Only hoist devDependencies used in \>= this percent of packages
  - `--always <deps...>`: Always hoist these `devDependencies` (only relevant with `--threshold`)

**Usage:**

```bash
# Hoist all dev deps
better-deps hoist-dev-deps

# Hoist all dev deps except @storybook/html
better-deps hoist-dev-deps --exclude @storybook/html

# Hoist dev deps used by >= 50% of packages
better-deps hoist-dev-deps -t 0.5

# As above, but always hoist typescript and react deps
better-deps hoist-dev-deps -t 0.5 --always typescript react react-dom @types/react @types/react-dom

#
better-deps hoist-dev-deps
```

### `star-local-dev-deps`

Change version specs of `devDependencies` on local packages (those defined within the monorepo/workspace) to `*`.

**Why:** If a monorepo runs builds and other tasks on a per-package basis, and most packages have `devDependencies` on some shared script or config packages (which may also be published), using `*` for those `devDependencies` maintains the dependency graph while minimizing churn and merge conflicts when package versions are updated.

**Usage:**

```bash
better-deps star-local-dev-deps
```
