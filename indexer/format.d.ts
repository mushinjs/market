// The market index format, copied from @mushinjs/core (packages/core/src/market.ts) of mushinjs/mushin.
// Keep the two in step: the dashboard reads what scripts/build-index.mjs writes. `format` goes up on a breaking change.

/** Text in several languages, such as { en: 'Weather', 'zh-CN': '天气' }, or one string. */
export type LocalizedText = string | Record<string, string>

/** One published version, with the Mushin.js versions it runs on. */
export interface MarketVersion {
  version: string
  /** Its `mushin.requires.mushin` range. */
  mushin?: string
  time?: string
  deprecated?: boolean
}

/** One plugin package in the market. */
export interface MarketEntry {
  name: string
  displayName?: LocalizedText
  description?: LocalizedText
  kind: 'app' | 'bot'
  category?: string
  platforms?: string[]
  requires?: { mushin?: string; plugins?: Record<string, string> }
  optional?: { mushin?: string; plugins?: Record<string, string> }
  /** The latest version. */
  version: string
  /** The `next` dist-tag, when newer than latest. */
  next?: string
  /** Recent versions, newest first, for picking one that runs on this Mushin.js. */
  versions?: MarketVersion[]
  /** Downloads in the last week. */
  downloads?: number
  /** When the latest version was published. */
  updatedAt?: string
  license?: string
  repository?: string
  homepage?: string
  /** Who published the latest version (an npm user, or "GitHub Actions" with trusted publishing). */
  publisher?: string
  /** Published from a CI workflow with npm Trusted Publishing, so the code matches its repository. */
  trusted?: boolean
  /** An `@mushinjs/*` package. */
  official?: boolean
  /** On the market's picked list. */
  curated?: boolean
  /** The start of its README, in Markdown. */
  readme?: string
  /** An icon: an image address, or the inside of a 24×24 SVG. */
  icon?: string
  keywords?: string[]
}

export interface MarketIndex {
  /** The format version; this file reads 1. */
  format: 1
  generatedAt: string
  packages: MarketEntry[]
}
