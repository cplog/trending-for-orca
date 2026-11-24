// Components panel: Orca draws it with its own controls. No build step.
import {
  atom,
  Badge,
  Button,
  Callout,
  EmptyState,
  IconButton,
  List,
  ListItem,
  plugin,
  read,
  RelativeTime,
  Row,
  Select,
  set,
  shell,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Text,
  update
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

const STALE_MS = 15 * 60 * 1000
const PERIODS = [
  { value: 'daily', label: 'Today', gained: 'today' },
  { value: 'weekly', label: 'Week', gained: 'this week' },
  { value: 'monthly', label: 'Month', gained: 'this month' }
]
// Values are GitHub's own /trending/<language> names.
const LANGUAGES = [
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

// Remembered between runs, so the panel opens on the person's last view with data already there.
const filters = atom('filters', { since: 'weekly', lang: 'all' }, { persist: 'plugin' })
const cache = atom<Record<string, Entry>>('cache', {}, { persist: 'plugin' })
const loading = atom(false)
const error = atom<string | null>(null)

const keyOf = (f: { since: string; lang: string }) => `${f.since}|${f.lang}`
const fmt = new Intl.NumberFormat()
let seq = 0

async function load(force = false): Promise<void> {
  const f = read(filters)
  const key = keyOf(f)
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
      { since: f.since, language: f.lang === 'all' ? '' : f.lang },
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

function change(next: Partial<{ since: string; lang: string }>): void {
  update(filters, (f) => ({ ...f, ...next }))
  void load()
}

export function setup(): void {
  void load()
}

const short = (s: string) => (s.length > 110 ? s.slice(0, 107).trimEnd() + '…' : s)

function Body() {
  const f = read(filters)
  const entry = read(cache)[keyOf(f)]
  const busy = read(loading)
  const failed = read(error)
  const gained = PERIODS.find((p) => p.value === f.since)?.gained ?? ''
  const fresh = new Set(entry?.fresh ?? [])

  return (
    <Stack gap="sm">
      <Row gap="xs" justify="between" align="center">
        <Select
          label="Language"
          labelHidden
          value={f.lang}
          options={LANGUAGES}
          onChange={(lang) => change({ lang })}
        />
        <Row gap="xs" align="center">
          {entry ? (
            <Text muted size="xs">
              <RelativeTime at={entry.at} format="short" />
            </Text>
          ) : null}
          <IconButton icon="refresh" label="Refresh" variant="ghost" disabled={busy} onPress={() => void load(true)} />
        </Row>
      </Row>

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
        <List label="Trending repositories">
          {entry.repos.map((r) => (
            <ListItem
              key={r.fullName}
              title={r.fullName}
              description={short(r.description)}
              onPress={() => void shell.openExternal(r.url)}
            >
              <Row gap="xs" wrap align="center">
                {fresh.has(r.fullName) ? <Badge tone="accent">new</Badge> : null}
                {r.language && f.lang === 'all' ? <Badge>{r.language}</Badge> : null}
                <Text muted size="xs">
                  {r.starsInPeriod ? `+${fmt.format(r.starsInPeriod)} ${gained} · ` : ''}★ {fmt.format(r.stars)}
                </Text>
              </Row>
            </ListItem>
          ))}
        </List>
      ) : null}
    </Stack>
  )
}

export default function Panel() {
  return (
    <Tabs label="Trending period" value={read(filters).since} onChange={(since) => change({ since })}>
      {PERIODS.map((p) => (
        <Tab key={p.value} value={p.value} label={p.label}>
          <Body />
        </Tab>
      ))}
    </Tabs>
  )
}
