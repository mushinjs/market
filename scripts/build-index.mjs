// Builds the Mushin.js plugin market index from the npm registry.
//
//   node scripts/build-index.mjs [out=public/index.json]
//
// Every package with the `mushin-plugin` keyword whose latest version has a `mushin` manifest is listed, unless it
// is deprecated or on blocked.json. curated.json marks the picked ones. The format is in format.d.ts.
// REGISTRY (default https://registry.npmjs.org/) points it at another registry, such as a test one.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const KEYWORD = 'mushin-plugin'
/** How many versions each entry keeps, for picking one that runs on an older Mushin.js. */
const VERSIONS_KEPT = 20
/** The README summary's length. */
const README_LENGTH = 1200

const encode = (name) => name.replace('/', '%2F')

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
      if (response.status === 404) return undefined
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      if (attempt >= 3) throw new Error(`${url}: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}

async function readList(file) {
  try {
    const value = JSON.parse(await readFile(join(root, file), 'utf8'))
    return new Set(Array.isArray(value.packages) ? value.packages : [])
  } catch {
    return new Set()
  }
}

const repoUrl = (repository) => {
  const url = typeof repository === 'string' ? repository : repository?.url
  return url?.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://')
}

/** Compares versions with prerelease tags, newest first. */
function byVersionDesc(a, b) {
  const split = (text) => {
    const [core, pre = ''] = text.split(/-(.*)/s)
    return [core.split('.').map(Number), pre]
  }
  const [coreA, preA] = split(a)
  const [coreB, preB] = split(b)
  for (let i = 0; i < 3; i++) if ((coreA[i] ?? 0) !== (coreB[i] ?? 0)) return (coreB[i] ?? 0) - (coreA[i] ?? 0)
  if (preA === preB) return 0
  if (!preA) return -1
  if (!preB) return 1
  return preB.localeCompare(preA, 'en', { numeric: true })
}

/** The start of a README, without badges and HTML, cut at a paragraph. */
export function readmeSummary(text) {
  if (!text) return undefined
  const clean = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*\[?!\[[^\]]*\]\([^)]*\)\]?(\([^)]*\))?\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (clean.length <= README_LENGTH) return clean
  const cut = clean.slice(0, README_LENGTH)
  const paragraph = cut.lastIndexOf('\n\n')
  return `${(paragraph > README_LENGTH / 2 ? cut.slice(0, paragraph) : cut).trim()}\n\n…`
}

/** One index entry from a package's full registry document and its search result. */
export function buildEntry(doc, found, lists) {
  const latestVersion = doc['dist-tags']?.latest
  const latest = doc.versions?.[latestVersion]
  const manifest = latest?.mushin
  if (!latest || !manifest || latest.deprecated || lists.blocked.has(doc.name)) return undefined
  const versions = Object.values(doc.versions ?? {})
    .filter((item) => item.mushin)
    .map((item) => ({
      version: item.version,
      ...(item.mushin?.requires?.mushin ? { mushin: item.mushin.requires.mushin } : {}),
      ...(doc.time?.[item.version] ? { time: doc.time[item.version] } : {}),
      ...(item.deprecated ? { deprecated: true } : {}),
    }))
    .sort((a, b) => byVersionDesc(a.version, b.version))
    .slice(0, VERSIONS_KEPT)
  const next = doc['dist-tags']?.next
  const publisher = found?.package?.publisher
  return Object.fromEntries(Object.entries({
    name: doc.name,
    displayName: manifest.displayName,
    description: manifest.description ?? latest.description,
    kind: manifest.kind === 'bot' ? 'bot' : 'app',
    category: manifest.category,
    platforms: manifest.platforms,
    requires: manifest.requires,
    optional: manifest.optional,
    version: latestVersion,
    next: next && byVersionDesc(next, latestVersion) < 0 ? next : undefined,
    versions,
    downloads: found?.downloads?.weekly,
    updatedAt: doc.time?.[latestVersion],
    license: latest.license,
    repository: repoUrl(latest.repository),
    homepage: latest.homepage,
    publisher: publisher?.username ?? latest._npmUser?.name,
    trusted: !!publisher?.trustedPublisher,
    official: doc.name.startsWith('@mushinjs/'),
    curated: lists.curated.has(doc.name) || undefined,
    readme: readmeSummary(doc.readme),
    icon: typeof manifest.icon === 'string' ? manifest.icon : undefined,
    keywords: latest.keywords,
  }).filter(([, value]) => value !== undefined))
}

export async function buildIndex(registry = process.env.REGISTRY ?? 'https://registry.npmjs.org/') {
  const base = registry.replace(/\/?$/, '/')
  const lists = { curated: await readList('curated.json'), blocked: await readList('blocked.json') }
  const found = []
  for (let from = 0; ; from += 250) {
    const page = await getJson(`${base}-/v1/search?text=keywords:${KEYWORD}&size=250&from=${from}`)
    const objects = page?.objects ?? []
    found.push(...objects)
    if (objects.length < 250) break
  }
  const packages = []
  // A few at a time, to be gentle with the registry.
  for (let i = 0; i < found.length; i += 8) {
    const batch = await Promise.all(found.slice(i, i + 8).map(async (item) => {
      try {
        const doc = await getJson(`${base}${encode(item.package.name)}`)
        return doc ? buildEntry(doc, item, lists) : undefined
      } catch (error) {
        console.warn(`skipped ${item.package.name}: ${error.message}`)
        return undefined
      }
    }))
    packages.push(...batch.filter(Boolean))
  }
  packages.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0) || a.name.localeCompare(b.name))
  return { format: 1, generatedAt: new Date().toISOString(), packages }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = resolve(root, process.argv[2] ?? 'public/index.json')
  const index = await buildIndex()
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(index) + '\n')
  console.log(`${index.packages.length} packages → ${out}`)
}
