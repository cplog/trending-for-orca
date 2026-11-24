import { parseTrending } from './parse.mjs'

export const SINCE = ['daily', 'weekly', 'monthly']
const bad = (message) => Object.assign(new Error(message), { code: 'invalid_params' })

/** Trending repositories from github.com/trending. `language` is GitHub's own name, '' for all. */
export async function fetchTrending(since, language, signal) {
  // These end up in a URL, so validate them here rather than trust the caller.
  if (!SINCE.includes(since)) throw bad('since must be daily, weekly or monthly')
  const lang = String(language ?? '').trim()
  if (!/^[\w.+#-]{0,40}$/.test(lang)) throw bad('invalid language')
  const url = `https://github.com/trending${lang ? `/${encodeURIComponent(lang)}` : ''}?since=${since}`
  const res = await fetch(url, { signal, headers: { 'user-agent': 'orca-plugin-github-trending' } })
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
  return parseTrending(await res.text())
}
