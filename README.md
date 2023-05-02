# better-deps

CLI for reducing issues with JavaScript dependencies in monorepos/workspaces.

## Caveat

The changes implemented by this CLI may help reduce issues encountered in certain common monorepo setups, but they may not be applicable or preferable in all cases.

## Commands

Currently, each command has a `--check` mode which can be used in CI, but the commands must be run individually. In the future, the tool may be modified to follow more of a "linter" model with a configurable list of rules, or entirely rewritten as an ESLint plugin.

- [`hoist-dev-deps`](#hoist-dev-deps)
- [`star-local-dev-deps`](#star-local-dev-deps)
- [`unpin-dev-deps`](#unpin-dev-deps)

### `hoist-dev-deps`

Remove `devDependencies` from individual packages and declare them at the monorepo/workspace root instead.

This approach helps mitigate issues with package manager behavior (particularly Yarn v1) and reduce churn, but it has some downsides. Alternatively, some repos may prefer to use a package manager which implements strict installation layout (essentially the opposite of this strategy).

#### Options

- `--check`: Check for issues without making any changes, and exit non-zero if issues are found (good for CI)
- `--exclude <deps...>`: Don't hoist these `devDependencies`
- `--only <deps...>`: Only hoist these `devDependencies` (mutually exclusive with other options)
- `--threshold <percent>`: Only hoist devDependencies used in \>= this percent of packages. This can help mitigate concerns about how hoisting makes it less explicit which packages actually use which dependencies.
  - `--always <deps...>`: Always hoist these `devDependencies` (only relevant with `--threshold`)

#### Usage

```bash
# Hoist all dev deps
better-deps hoist-dev-deps

# Check that no new non-hoisted deps have been introduced
better-deps hoist-dev-deps --check

# Hoist all dev deps except @storybook/html
better-deps hoist-dev-deps --exclude @storybook/html

# Hoist dev deps used by >= 50% of packages
better-deps hoist-dev-deps --threshold 50

# As above, but always hoist typescript and react deps
better-deps hoist-dev-deps --threshold 50 --always typescript react react-dom @types/react @types/react-dom

# Only hoist @types/react and @types/react-dom
better-deps hoist-dev-deps --only @types/react @types/react-dom
```

#### Why

This is a _potentially_ "less bad" approach to mitigate issues with package manager behavior and reduce churn, though it has some downsides.

- Pros:
  - Reduces churn and merge conflicts when updating `devDependencies`. This is especially important for frequent updates with a tool such as Renovate or Dependabot.
    - This is less important for Renovate now: its capability for lockfile-only in-range updates (such as updating the installed version for `"foo": "^1.0.0"` from `1.1.0` to `1.2.0`) has been improved, so its recommended config presets no longer pin `devDependencies` by default.
  - Makes it easier for a human to update `devDependencies` without accidentally introducing mismatches and duplicates. (But you should also be using [syncpack](https://www.npmjs.com/package/syncpack) or another tool to prevent mismatches!)
  - Prevents the wrong version of a dep from being hoisted implicitly. Most package managers don't install dependencies strictly nested within their trees; instead, they flatten the tree to some degree, which involves implicitly hoisting some deps to be installed under the monorepo's root `node_modules`. Yarn (at least v1) seems _nondeterministic_ about which package version it chooses to install at the repo root if more than one version is present anywhere in the tree, sometimes leading to different behavior between computers. (npm may also have a variant of this problem when generating or updating the lock file.)
- Cons:
  - Makes it less obvious which packages use which `devDependencies`. This can be mitigated somewhat by using the `--threshold` option to hoist only things that are widely used.
  - May make it easier for packages to add implicit dependencies in production code. This can be mitigated by lint rules (which is a good practice regardless).

Another approach which eliminates implicit hoisting while avoiding the cons listed above is to use a package manager which implements strict installation layout instead (essentially the opposite of this strategy). Some examples are [pnpm](https://pnpm.io/), [midgard-yarn-strict](https://www.npmjs.com/package/midgard-yarn-strict), or [npm's upcoming isolated mode](https://github.com/npm/rfcs/blob/main/accepted/0042-isolated-mode.md) once implemented. However, this approach doesn't address issues of churn from updating `devDependencies`.

### `star-local-dev-deps`

Change version specs of `devDependencies` on local packages (those defined within the monorepo/workspace) to `*`.

#### Options

- `--check`: Check for issues without making any changes, and exit non-zero if issues are found (good for CI)

#### Usage

```bash
better-deps star-local-dev-deps
```

#### Why

Many monorepos define build scripts or configuration in local packages (which may also be published), and all the other packages have `devDependencies` on the shared build packages. Using `*` for those `devDependencies` minimizes churn and merge conflicts when package versions are updated, while also maintaining the dependency graph.

### `unpin-dev-deps`

Change exact versions of external `devDependencies` to use `^` or `~` ranges (excluding anything using a prerelease version). This is mainly an easy way to revert Renovate's old behavior of pinning `devDependencies`.

#### Options

- `--check`: Check for issues without making any changes, and exit non-zero if issues are found (good for CI)
- `--exclude <deps...>`: Don't modify these `devDependencies`
- `--patch <deps...>`: Only allow patch version of these deps to vary (`~`)

#### Usage

```bash
# Unpin all dev deps
better-deps unpin-dev-deps

# Unpin all dev deps except typescript and prettier
better-deps unpin-dev-deps --exclude typescript prettier

# Unpin all dev deps, using ~ versions for typescript and prettier
better-deps unpin-dev-deps --patch typescript prettier
```
