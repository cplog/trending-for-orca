// Scenarios for `orca plugin check`: the panel is rendered once for each.
import { defineCheck } from 'orca/testing'

const repo = (fullName: string) => ({
  fullName,
  url: `https://github.com/${fullName}`,
  description: 'A sample repository',
  language: 'Rust',
  stars: 1234,
  forks: 5,
  starsInPeriod: 56
})

export default defineCheck({
  'with repositories': {
    requests: {
      'trending.list': [repo('a/one'), repo('b/two')],
      'workspace.language': { language: 'rust', name: 'main' }
    },
    events: [{ event: 'workspace.changed', payload: { context: null } }]
  },
  'no repositories': {
    requests: { 'trending.list': [], 'workspace.language': { language: null, name: null } }
  },
  'saved tab': {
    requests: { 'trending.list': [], 'workspace.language': { language: null, name: null } },
    persisted: { filters: { tab: 'saved', lang: 'all' }, saved: [repo('a/one')] }
  }
})
