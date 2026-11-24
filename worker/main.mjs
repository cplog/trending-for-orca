import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseTrending } from './parse.mjs'

const SINCE = ['daily', 'weekly', 'monthly']
const bad = (message) => Object.assign(new Error(message), { code: 'invalid_params' })

async function fetchTrending(since, language, signal) {
  // These end up in a URL, so validate them here rather than trust the caller.
  if (!SINCE.includes(since)) throw bad('since must be daily, weekly or monthly')
  const lang = String(language ?? '').trim()
  if (!/^[\w.+#-]{0,40}$/.test(lang)) throw bad('invalid language')
  const url = `https://github.com/trending${lang ? `/${encodeURIComponent(lang)}` : ''}?since=${since}`
  const res = await fetch(url, { signal, headers: { 'user-agent': 'orca-plugin-github-trending' } })
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
  return parseTrending(await res.text())
}

// First marker file found wins. Values are the panel's language options.
const MARKERS = [
  ['Cargo.toml', 'rust'],
  ['go.mod', 'go'],
  ['tsconfig.json', 'typescript'],
  ['package.json', 'javascript'],
  ['pyproject.toml', 'python'],
  ['requirements.txt', 'python'],
  ['build.gradle.kts', 'kotlin'],
  ['pom.xml', 'java'],
  ['build.gradle', 'java'],
  ['Package.swift', 'swift'],
  ['Gemfile', 'ruby'],
  ['composer.json', 'php']
]
export const detectLanguage = (dir, exists = existsSync) =>
  MARKERS.find(([file]) => exists(join(dir, file)))?.[1] ?? null

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

export default function activate(orca) {
  orca.panels.handle('trending.list', ({ since, language }, { signal }) => fetchTrending(since, language, signal))

  // Language of the focused workspace, from marker files in its folder. Local workspaces only.
  orca.panels.handle('workspace.language', async () => {
    const context = await orca.host.call('workspace.readContext', {})
    if (!context?.workspaceId) return { language: null, name: null }
    const { workspaces } = await orca.host.call('workspace.list', {})
    const workspace = workspaces.find((w) => w.id === context.workspaceId)
    const local = workspace && (workspace.hostId === null || workspace.hostId === 'local')
    return { language: local ? detectLanguage(workspace.path) : null, name: context.displayName }
  })

  orca.commands.register('trending.refresh', () => {
    orca.panels.post('trending.refresh', {})
    void updateStatus()
    return 'Refreshing GitHub Trending'
  })

  async function updateStatus() {
    try {
      const [top] = await fetchTrending('daily', '', AbortSignal.timeout(20000))
      if (!top) return
      await orca.host.call('statusBar.update', {
        id: 'top',
        text: `${top.fullName} +${compact.format(top.starsInPeriod)}`,
        tooltip: `Top trending on GitHub today: ${top.fullName}. Click to show or hide the side panel.`
      })
    } catch (error) {
      orca.log(`status bar update failed: ${error.message}`)
    }
  }
  void updateStatus()
  const timer = setInterval(updateStatus, 30 * 60 * 1000)
  timer.unref()
}
