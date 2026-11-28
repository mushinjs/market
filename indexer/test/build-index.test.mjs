import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildEntry, readmeSummary } from '../scripts/build-index.mjs'

const lists = { curated: new Set(['mushin-plugin-weather']), blocked: new Set(['mushin-plugin-bad']) }

const doc = {
  name: 'mushin-plugin-weather',
  'dist-tags': { latest: '1.1.0', next: '1.2.0-next.1' },
  time: { '1.0.0': '2026-01-01T00:00:00Z', '1.1.0': '2026-02-01T00:00:00Z' },
  readme: '[![npm](https://img.shields.io/npm/v/x)](https://npm.im/x)\n\n# Weather\n\nSends the weather.',
  versions: {
    '1.0.0': { name: 'mushin-plugin-weather', version: '1.0.0', mushin: { kind: 'app', requires: { mushin: '>=0.3.0' } } },
    '1.1.0': {
      name: 'mushin-plugin-weather', version: '1.1.0', license: 'MIT', repository: { url: 'git+https://github.com/a/weather.git' },
      mushin: { kind: 'app', category: 'feature', displayName: { en: 'Weather', 'zh-CN': '天气' }, requires: { mushin: '>=0.4.0' } },
    },
  },
}
const found = { package: { name: 'mushin-plugin-weather', publisher: { username: 'GitHub Actions', trustedPublisher: { id: 'github' } } }, downloads: { weekly: 120 } }

test('an entry carries the manifest, versions, downloads and publishing facts', () => {
  const entry = buildEntry(doc, found, lists)
  assert.deepEqual(entry.versions, [
    { version: '1.1.0', mushin: '>=0.4.0', time: '2026-02-01T00:00:00Z' },
    { version: '1.0.0', mushin: '>=0.3.0', time: '2026-01-01T00:00:00Z' },
  ])
  assert.equal(entry.version, '1.1.0')
  assert.equal(entry.next, '1.2.0-next.1')
  assert.equal(entry.downloads, 120)
  assert.equal(entry.trusted, true)
  assert.equal(entry.curated, true)
  assert.equal(entry.official, false)
  assert.equal(entry.repository, 'https://github.com/a/weather')
  assert.equal(entry.readme, '# Weather\n\nSends the weather.')
})

test('blocked, deprecated and manifest-less packages are left out', () => {
  assert.equal(buildEntry({ ...doc, name: 'mushin-plugin-bad' }, found, lists), undefined)
  assert.equal(buildEntry({ ...doc, versions: { '1.1.0': { ...doc.versions['1.1.0'], deprecated: 'no' } } }, found, lists), undefined)
  assert.equal(buildEntry({ ...doc, versions: { '1.1.0': { name: 'x', version: '1.1.0' } } }, found, lists), undefined)
})

test('a long README is cut at a paragraph', () => {
  const long = `${'a'.repeat(900)}\n\n${'b'.repeat(900)}`
  assert.equal(readmeSummary(long), `${'a'.repeat(900)}\n\n…`)
})
