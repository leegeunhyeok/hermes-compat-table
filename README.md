# hermes-compat-table

Run [compat-table](https://github.com/compat-table/compat-table) spec
tests against arbitrary [Hermes](https://github.com/facebook/hermes)
release tags, and produce a pass/fail matrix.

## Requirements

- [mise](https://mise.jdx.dev/) (provides Node 24)
- `cmake`, a C++ toolchain, Python 3, and (optionally) `ninja` for
  faster Hermes builds.

Bootstrap:

```sh
mise install
git submodule update --init --recursive
```

## Build Hermes for a tag

```sh
mise run build:hermes <tag>
# e.g.
mise run build:hermes hermes-v250829098.0.2
```

Sources are cloned once into `.cache/hermes/src` and reused across
tags. Build output goes to `.cache/hermes/build/<tag>/`, and the
resulting `hermes` / `hermesc` binaries are copied to
`bin/<tag>/`.

Available tags can be listed with:

```sh
git ls-remote --tags https://github.com/facebook/hermes.git | grep hermes-v
```

## Dashboard

A static dashboard reads everything under `results/` and renders a
per-spec pass/fail matrix across Hermes tags.

```sh
yarn install      # first time only
mise run web:dev      # local dev (http://localhost:5173)
mise run web:build    # static build to dist/
mise run web:preview  # serve dist/ locally
```

Adding a new tag to the dashboard is just `mise run run:compat <tag>` —
the JSON drops into `results/` and the next build picks it up.

## Run compat-table specs against Hermes

```sh
mise run run:compat <tag>
# subset of suites
mise run run:compat <tag> --suite es5,es6
# cap number of tests (smoke runs)
mise run run:compat <tag> --limit 50
```

If `bin/<tag>/hermes` is missing the runner will invoke `build:hermes`
automatically and continue. Results land at `results/<tag>.json`:

```json
{
  "tag": "hermes-v250829098.0.2",
  "hermesVersion": "Hermes 1.0.0 (HBC 98)",
  "summary": { "executed": 50, "pass": 39, "fail": 11, "skipped": 0 },
  "results": [ { "suite": "es6", "path": ["..."], "pass": true } ]
}
```
