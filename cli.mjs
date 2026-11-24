#!/usr/bin/env node
// For agents and scripts: prints trending repositories as JSON.
//   node cli.mjs [daily|weekly|monthly] [language]
import { fetchTrending } from './worker/trending.mjs'

const [since = 'weekly', language = ''] = process.argv.slice(2)
try {
  console.log(JSON.stringify(await fetchTrending(since, language, AbortSignal.timeout(20000)), null, 2))
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
