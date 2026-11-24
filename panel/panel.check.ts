// Scenarios for `orca plugin check` and `orca plugin shot --scenario`: the panel is rendered once for each.
import { defineCheck } from 'orca/testing'

const repo = (fullName: string, description: string, language: string, stars: number, starsInPeriod: number) => ({
  fullName,
  url: `https://github.com/${fullName}`,
  description,
  language,
  stars,
  forks: 0,
  starsInPeriod
})

// Sample data, not a live list.
const sample = [
  repo('sample-labs/agent-toolkit', 'Composable tools and skills for coding agents.', 'TypeScript', 48210, 3120),
  repo('example-org/fastgrep', 'A very fast code search tool with a friendly output.', 'Rust', 31877, 2475),
  repo('demo-dev/notebook-ui', 'Reactive notebooks that run in the browser.', 'TypeScript', 12904, 1930),
  repo('sample-labs/tinydb', 'An embedded database in one small file.', 'Go', 22051, 1422),
  repo('example-org/design-tokens', 'Design tokens that agents and people can both read.', 'TypeScript', 8830, 1218),
  repo('demo-dev/pycheck', 'A fast type checker and linter for Python.', 'Python', 40312, 1107),
  repo('sample-labs/term-charts', 'Charts for the terminal, with no dependencies.', 'Go', 6120, 905)
]

const context = {
  agent: 'claude',
  workspace: { id: 'w1', name: 'main' },
  projects: [
    { id: 'p1', name: 'my-app' },
    { id: 'p2', name: 'my-site' }
  ],
  canCreate: true
}

const requests = {
  'trending.list': sample,
  'workspace.language': { language: 'typescript', name: 'main' },
  'actions.context': context
}

export default defineCheck({
  'with repositories': { requests },
  'no repositories': {
    requests: { ...requests, 'trending.list': [] }
  }
})
