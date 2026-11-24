import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTrending } from '../worker/parse.mjs'

// Live check against github.com/trending: fails if GitHub changes its markup.
test('parses live github.com/trending', async () => {
  const html = await (await fetch('https://github.com/trending?since=weekly')).text()
  const repos = parseTrending(html)
  assert.ok(repos.length >= 5, `got ${repos.length} repos`)
  for (const r of repos) {
    assert.match(r.fullName, /^[^/]+\/[^/]+$/)
    assert.ok(!r.description.startsWith("Star "), `description for ${r.fullName}`)
    assert.ok(r.stars > 0, `stars for ${r.fullName}`)
    assert.ok(r.starsInPeriod > 0, `starsInPeriod for ${r.fullName}`)
  }
})

test('parses a minimal row', () => {
  const html = '<article class="Box-row"><h2><a href="/a/b">a / b</a></h2><p class="col-9 x"> hi &amp; bye </p>' +
    '<span itemprop="programmingLanguage">Go</span><a href="/a/b/stargazers"> 1,234 </a><a href="/a/b/forks">5</a> ' +
    '<span>56 stars this week</span></article>'
  assert.deepEqual(parseTrending(html), [{
    fullName: 'a/b', url: 'https://github.com/a/b', description: 'hi & bye',
    language: 'Go', stars: 1234, forks: 5, starsInPeriod: 56
  }])
})
