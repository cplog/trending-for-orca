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

/** Match locally so the feed never receives the repository name. */
export async function fetchInsight(fullName, signal) {
  if (typeof fullName !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(fullName)) return null
  const key = fullName.toLowerCase()
  const res = await fetch('https://cplog.github.io/trending/insights.json', { signal, credentials: 'omit', redirect: 'error' })
  if (!res.ok) return null
  const entry = (await res.json())?.[key]
  if (![entry?.useCase, entry?.tryIt].every(s => typeof s === 'string' && s.trim() && s.length <= 500)) return null
  if (!URL.canParse(entry.source)) return null
  const url = new URL(entry.source)
  if (url.origin !== 'https://github.com' || url.username || url.password || !url.pathname.toLowerCase().startsWith(`/${key}/blob/`)) return null
  return { useCase: entry.useCase, tryIt: entry.tryIt, source: url.href }
}

/** Keep GitHub's live ordering. The public tracker only samples all-language lists. */
export async function fetchPanelTrending(since, language, signal) {
  const repos = await fetchTrending(since, language, signal)
  if (language || !repos.length) return repos
  try {
    const timeout = AbortSignal.timeout(2500)
    const res = await fetch('https://cplog.github.io/trending/data.json', {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      credentials: 'omit'
    })
    if (!res.ok) return repos
    const snapshot = await res.json()
    if (snapshot.generatedAt?.slice(0, 10) !== new Date().toISOString().slice(0, 10)) return repos
    const byName = new Map(snapshot.since[since].map(r => [r.fullName.toLowerCase(), r]))
    for (const repo of repos) {
      const seen = byName.get(repo.fullName.toLowerCase())
      if (Number.isSafeInteger(seen?.streakDays) && seen.streakDays > 1) repo.streakDays = seen.streakDays
      else if (seen?.isNew === true && seen.streakDays === 1) repo.firstSeenToday = true
    }
  } catch {
    signal?.throwIfAborted()
    // History is optional: an unavailable snapshot must not hide the live list.
  }
  return repos
}
