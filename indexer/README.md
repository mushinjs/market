# The market index

The index of plugins that the Mushin.js dashboard shows on **Plugins → Market**. This folder builds it from the npm
registry; the workflow in `.github/workflows/index.yml` runs it every 30 minutes and publishes it to GitHub Pages, next
to the market site:

```
https://mushinjs.github.io/market/index.json
```

Dashboards read this file first. When it cannot be read (or a dashboard is set to other addresses), they search npm
themselves, so the market works without it, only slower.

## How a plugin gets in

Publish it to npm with the `mushin-plugin` keyword and a `mushin` field in its `package.json`:

```json
{
  "name": "mushin-plugin-weather",
  "keywords": ["mushin-plugin"],
  "mushin": {
    "kind": "app",
    "category": "feature",
    "displayName": { "en": "Weather", "zh-CN": "天气" },
    "description": { "en": "Sends the weather", "zh-CN": "发送天气" },
    "requires": { "mushin": ">=0.4.0", "plugins": { "@mushinjs/plugin-bots": "*" } }
  }
}
```

It shows up within half an hour. There is nothing to submit here.

- `requires.mushin` decides which Mushin.js versions can install which version of the plugin. Keep it accurate: a
  dashboard installs the newest version whose range fits.
- `category` is one of `adapter`, `provider`, `ai`, `feature`, `core`, `example`, `bundle`.
- Publish from a CI workflow with [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) to get the
  **Trusted publishing** badge: it shows the package was built from its public repository.
- Deprecating a package on npm (`npm deprecate`) takes it out of the market.

## Picked and blocked plugins

- `indexer/curated.json` lists **picked** plugins: they get a badge, and dashboards with "only picked plugins can be installed"
  turned on can install only these and the official ones.
- `indexer/blocked.json` lists packages never shown, such as malicious ones or ones with an unfixed security problem.

Changes to either come by pull request. For **picked**, say what the plugin does and link its repository; a maintainer
installs it in a test app, reads its code for anything it does beyond what it says (network calls, file access,
secrets), and merges when it holds up. For **blocked**, say why, with evidence; security reports can also go privately
to the maintainers first. Keep the lists sorted, one package name per entry.

## The index format

`format.d.ts` describes `index.json` (`format: 1`). It is a copy of the types in `@mushinjs/core`
(`packages/core/src/market.ts` in mushinjs/mushin); change both together, and raise `format` for a change older
dashboards cannot read.

## Running it

```sh
cd indexer
npm test
npm run build            # writes out/index.json from registry.npmjs.org
REGISTRY=http://127.0.0.1:4873/ npm run build   # from another registry, such as a test one
```

Node.js 22.13 or newer, no dependencies.
