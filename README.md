# NPM Download Stats Tracker — Trend by Package

Get download counts for one or more npm packages over a chosen period,
plus percent change versus the immediately prior period of the same
length.

Built for tracking adoption trends — is a package gaining or losing
ground — rather than watching for new releases (see [NPM Package Update
Tracker](https://github.com/timmKal01/npm-package-tracker) for that).

## Input

```json
{
  "packages": ["react", "vue", "svelte"],
  "daysBack": 7
}
```

| Field | Type | Description |
|---|---|---|
| `packages` | array of strings | npm package names to check, e.g. `"react"`, `"@angular/core"`. At least one required. |
| `daysBack` | number | Length of the period to measure, and also the length of the prior period it's compared against. Default `7`, max `365`. |

## Output

One record per package:

```json
{
  "package": "react",
  "currentPeriodDownloads": 163083190,
  "currentPeriodStart": "2026-08-03",
  "currentPeriodEnd": "2026-08-09",
  "previousPeriodDownloads": 158200412,
  "previousPeriodStart": "2026-07-27",
  "previousPeriodEnd": "2026-08-02",
  "percentChange": 3.09
}
```

`currentPeriodDownloads` is `null` for a package name npm doesn't
recognize (typo, unpublished, or scoped name missing its `@scope/`
prefix) — check the package name if you see this.

**Note:** npm's own download-count pipeline occasionally reports `0`
for an isolated day due to upstream CDN log-processing gaps, a known
limitation of the source data itself, not this actor. A single-day dip
to zero within an otherwise normal trend is that artifact, not a real
usage drop.

A request is billed once regardless of how many packages are checked.

## How it works

Direct calls to the official [npm registry downloads
API](https://github.com/npm/registry/blob/main/docs/download-counts.md)
(`api.npmjs.org`) — no proxy, no key, no scraping.

## Pricing note

Billed per **request**, not per package returned — one charge whether
you check 1 package or several.

## Related products

- [NPM Package Update Tracker](https://github.com/timmKal01/npm-package-tracker) — new versions and deprecation warnings, the release-activity counterpart to this actor's usage-trend data
