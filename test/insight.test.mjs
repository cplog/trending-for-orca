import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchInsight } from '../worker/trending.mjs'

test('matches the public feed locally and accepts only docs from the matching repo', async t => {
  const idea = { useCase: 'Compare layouts.', tryIt: 'Sketch a sample screen.', source: 'https://github.com/a/one/blob/main/README.md' }
  const feed = { 'a/one': idea }
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(feed))
  assert.deepEqual(await fetchInsight('A/One'), idea)
  assert.equal(await fetchInsight('a/missing'), null)
  for (const source of ['javascript:alert(1)', 'https://github.com/a/one/blob/../../../elsewhere', 'https://other.example/a/one/blob/main/README.md']) {
    idea.source = source
    assert.equal(await fetchInsight('a/one'), null)
  }
  for (const call of mock.mock.calls) assert.deepEqual(call.arguments, ['https://cplog.github.io/trending/insights.json', { signal: undefined, credentials: 'omit', redirect: 'error' }])
})
