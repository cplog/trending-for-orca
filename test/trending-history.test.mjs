import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchPanelTrending } from '../worker/trending.mjs'

test('history decorates live results without changing their order or requiring the tracker', async (t) => {
  const html = ['one', 'two'].map(n => `<article class="Box-row"><h2><a href="/a/${n}">a / ${n}</a></h2></article>`).join('')
  const snapshot = { generatedAt: new Date().toISOString(), since: { daily: [
    { fullName: 'A/TWO', streakDays: 3 }, { fullName: 'a/one', isNew: true, streakDays: 1 }
  ] } }
  let reads = 0
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.startsWith('https://github.com/trending')) return new Response(html)
    assert.equal(url, 'https://cplog.github.io/trending/data.json')
    reads++
    if (reads === 3) throw new Error('offline')
    return Response.json(snapshot)
  })
  const load = (lang = '') => fetchPanelTrending('daily', lang)
  const live = await load('go')
  assert.equal(reads, 0)
  assert.deepEqual(await load(), [{ ...live[0], firstSeenToday: true }, { ...live[1], streakDays: 3 }])
  snapshot.generatedAt = '2000-01-01T00:00:00Z'
  assert.deepEqual(await load(), live)
  assert.deepEqual(await load(), live)
})
