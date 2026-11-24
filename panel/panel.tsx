// Components panel: Orca draws it with its own controls. No build step.
import {
  atom,
  Badge,
  Box,
  Button,
  Callout,
  EmptyState,
  IconButton,
  Link,
  on,
  plugin,
  read,
  RelativeTime,
  Row,
  Select,
  Separator,
  set,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Text,
  update,
  type PanelContext
} from 'orca'

type Repo = {
  fullName: string
  url: string
  description: string
  language: string
  stars: number
  starsInPeriod: number
}
type Entry = { at: number; repos: Repo[]; fresh: string[] }
type Filters = { tab: string; lang: string }

const STALE_MS = 15 * 60 * 1000
const PERIODS = [
  { value: 'daily', label: 'Today', gained: 'today' },
  { value: 'weekly', label: 'Week', gained: 'this week' },
  { value: 'monthly', label: 'Month', gained: 'this month' }
]
// Values are GitHub's own /trending/<language> names, plus 'auto' and 'all'.
const LANGUAGES = [
  { value: 'auto', label: 'Match workspace' },
  { value: 'all', label: 'All languages' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'c++', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'c#', label: 'C#' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'shell', label: 'Shell' }
]
const labelOf = (lang: string) => LANGUAGES.find((l) => l.value === lang)?.label ?? lang

// Remembered between runs, so the panel opens on the person's last view with data already there.
// version 2: `since` became `tab` (it can also be 'saved'), and the language defaults to the workspace's.
const filters = atom<Filters>('filters', { tab: 'weekly', lang: 'auto' }, { persist: 'plugin', version: 2 })
const cache = atom<Record<string, Entry>>('cache', {}, { persist: 'plugin' })
const saved = atom<Repo[]>('saved', [], { persist: 'plugin' })
const workspace = atom<{ language: string | null; name: string | null }>({ language: null, name: null })
const loading = atom(false)
const error = atom<string | null>(null)

/** The language to ask GitHub for: the workspace's when matching, else the chosen one. */
const effectiveLang = () => {
  const { lang } = read(filters)
  return lang === 'auto' ? (read(workspace).language ?? 'all') : lang
}
const keyOf = (since: string, lang: string) => `${since}|${lang}`
const fmt = new Intl.NumberFormat()
let seq = 0

async function load(force = false): Promise<void> {
  const since = read(filters).tab
  if (since === 'saved') return
  const lang = effectiveLang()
  const key = keyOf(since, lang)
  const previous = read(cache)[key]
  if (!force && previous && Date.now() - previous.at < STALE_MS) {
    set(error, null)
    return
  }
  const mine = ++seq // a newer request wins; drop late answers
  set(loading, true)
  set(error, null)
  try {
    const repos: Repo[] = await plugin.request(
      'trending.list',
      { since, language: lang === 'all' ? '' : lang },
      { timeoutMs: 20000 }
    )
    if (mine !== seq) return
    const before = new Set((previous?.repos ?? []).map((r) => r.fullName))
    // "New" means: not in this list the last time it was fetched. Nothing is new on the first fetch.
    const fresh = previous ? repos.filter((r) => !before.has(r.fullName)).map((r) => r.fullName) : []
    update(cache, (all) => {
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000
      const kept = Object.fromEntries(Object.entries(all).filter(([, e]) => e.at > dayAgo))
      return { ...kept, [key]: { at: Date.now(), repos, fresh } }
    })
  } catch (e) {
    if (mine === seq) set(error, e instanceof Error ? e.message : String(e))
  } finally {
    if (mine === seq) set(loading, false)
  }
}

async function matchWorkspace(): Promise<void> {
  try {
    set(workspace, await plugin.request('workspace.language', {}, { timeoutMs: 10000 }))
  } catch {
    set(workspace, { language: null, name: null }) // falls back to all languages
  }
  if (read(filters).lang === 'auto') void load()
}

function change(next: Partial<Filters>): void {
  update(filters, (f) => ({ ...f, ...next }))
  void load()
}

function toggleSaved(repo: Repo): void {
  update(saved, (list) =>
    list.some((r) => r.fullName === repo.fullName)
      ? list.filter((r) => r.fullName !== repo.fullName)
      : [repo, ...list]
  )
}

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(
    // Fires once on subscribe and again each time the focused workspace changes.
    on('workspace.changed', () => void matchWorkspace()),
    plugin.on('trending.refresh', () => void load(true))
  )
  void load()
}

const short = (s: string) => (s.length > 110 ? s.slice(0, 107).trimEnd() + '…' : s)

function RepoRows({ repos, fresh, gained, showLanguage }: { repos: Repo[]; fresh: Set<string>; gained: string; showLanguage: boolean }) {
  const savedNames = new Set(read(saved).map((r) => r.fullName))
  return (
    <Stack gap="sm">
      {repos.map((r) => {
        const isSaved = savedNames.has(r.fullName)
        return (
          <Stack key={r.fullName} gap="sm">
            <Box direction="row" gap="xs" justify="between" align="start">
              <Box grow gap="xs" minWidth={0}>
                <Text weight="semibold">
                  <Link href={r.url}>{r.fullName}</Link>
                </Text>
                {r.description ? (
                  <Text muted size="sm">
                    {short(r.description)}
                  </Text>
                ) : null}
                <Row gap="xs" wrap align="center">
                  {fresh.has(r.fullName) ? <Badge tone="accent">new</Badge> : null}
                  {r.language && showLanguage ? <Badge>{r.language}</Badge> : null}
                  <Text muted size="xs">
                    {r.starsInPeriod && gained ? `+${fmt.format(r.starsInPeriod)} ${gained} · ` : ''}★ {fmt.format(r.stars)}
                  </Text>
                </Row>
              </Box>
              <IconButton
                icon="star"
                size="sm"
                variant={isSaved ? 'solid' : 'ghost'}
                label={isSaved ? `Remove ${r.fullName} from saved` : `Save ${r.fullName}`}
                onPress={() => toggleSaved(r)}
              />
            </Box>
            <Separator />
          </Stack>
        )
      })}
    </Stack>
  )
}

function Trending({ since }: { since: string }) {
  const f = read(filters)
  const lang = effectiveLang()
  const entry = read(cache)[keyOf(since, lang)]
  const busy = read(loading)
  const failed = read(error)
  const ws = read(workspace)
  const gained = PERIODS.find((p) => p.value === since)?.gained ?? ''

  return (
    <Stack gap="sm">
      <Row gap="xs" justify="between" align="center">
        <Select label="Language" labelHidden value={f.lang} options={LANGUAGES} onChange={(lang) => change({ lang })} />
        <Row gap="xs" align="center">
          {entry ? (
            <Text muted size="xs">
              <RelativeTime at={entry.at} format="short" />
            </Text>
          ) : null}
          <IconButton icon="refresh" label="Refresh" variant="ghost" disabled={busy} onPress={() => void load(true)} />
        </Row>
      </Row>

      {f.lang === 'auto' ? (
        <Text muted size="xs">
          {ws.language
            ? `${labelOf(ws.language)}, from ${ws.name ?? 'this workspace'}`
            : 'No language found for this workspace. Showing all languages.'}
        </Text>
      ) : null}

      {failed ? (
        <Callout tone="danger" title="Could not load trending">
          <Text size="sm">{failed}</Text>
          <Button variant="outline" size="sm" onPress={() => void load(true)}>
            Try again
          </Button>
        </Callout>
      ) : null}

      {!entry && busy ? <Skeleton shape="text" lines={8} label="Loading trending repositories" /> : null}

      {entry && entry.repos.length === 0 ? (
        <EmptyState
          title="Nothing trending here"
          description="GitHub lists no repositories for this language and period."
          icon="search"
        />
      ) : null}

      {entry && entry.repos.length > 0 ? (
        <RepoRows repos={entry.repos} fresh={new Set(entry.fresh)} gained={gained} showLanguage={lang === 'all'} />
      ) : null}
    </Stack>
  )
}

function Saved() {
  const list = read(saved)
  return list.length ? (
    <RepoRows repos={list} fresh={new Set()} gained="" showLanguage />
  ) : (
    <EmptyState title="Nothing saved yet" description="Press the star on a repository to keep it here." icon="star" />
  )
}

export default function Panel() {
  return (
    <Tabs label="GitHub Trending" value={read(filters).tab} onChange={(tab) => change({ tab })}>
      {PERIODS.map((p) => (
        <Tab key={p.value} value={p.value} label={p.label}>
          <Trending since={p.value} />
        </Tab>
      ))}
      <Tab value="saved" label="Saved" icon="star">
        <Saved />
      </Tab>
    </Tabs>
  )
}
