// Run with `orca plugin test .` (plain Node, no Orca window).
import { assert, mockHost, mount, test } from 'orca/testing'
import * as panel from './panel'

const repo = {
  fullName: 'a/one',
  url: 'https://github.com/a/one',
  description: 'First sample',
  language: 'Rust',
  stars: 10,
  forks: 0,
  starsInPeriod: 5
}
const other = { ...repo, fullName: 'b/two', url: 'https://github.com/b/two', description: 'Second sample' }
const context = {
  agent: 'claude',
  workspace: { id: 'w1', name: 'main' },
  projects: [{ id: 'p1', name: 'my-app' }],
  canCreate: true
}

function host(asked: string[], tried: unknown[]) {
  return mockHost({
    requests: {
      'trending.list': [repo, other],
      'workspace.language': { language: null, name: null },
      'actions.context': context,
      'agent.ask': ({ fullName }: { fullName: string }) => {
        asked.push(fullName)
        return { workspace: 'main' }
      },
      'workspace.try': (input: unknown) => {
        tried.push(input)
        return { name: 'try-one' }
      }
    }
  })
}

test('an agent starts only after the person confirms', async () => {
  const asked: string[] = []
  const view = await mount(panel, { host: host(asked, []) })

  await view.press({ label: 'Show actions for a/one' })
  await view.press({ text: 'Ask an agent' })
  assert.ok(view.find({ text: /Starts claude in the workspace "main"/ }))
  assert.deepEqual(asked, [], 'nothing starts before the confirmation')

  await view.press({ text: 'Start claude' })
  assert.deepEqual(asked, ['a/one'])
  assert.ok(view.find({ text: /Started claude in main/ }))
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('cancel starts nothing, and try creates a workspace in the chosen project', async () => {
  const asked: string[] = []
  const tried: unknown[] = []
  const view = await mount(panel, { host: host(asked, tried) })

  await view.press({ label: 'Show actions for a/one' })
  await view.press({ text: 'Ask an agent' })
  await view.press({ text: 'Cancel' })
  assert.deepEqual(asked, [])

  await view.press({ text: 'Try in a workspace' })
  await view.press({ text: 'Create workspace' })
  assert.deepEqual(tried, [{ fullName: 'a/one', projectId: 'p1' }])
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('the filter narrows the list and saving keeps a repository', async () => {
  const view = await mount(panel, { host: host([], []) })

  await view.type({ label: 'Filter this list' }, 'second')
  assert.equal(view.find({ text: 'a/one' }), null)
  assert.ok(view.find({ text: 'b/two' }))

  await view.press({ label: 'Save b/two' })
  assert.deepEqual(
    view.persisted.plugin.saved.map((r: { fullName: string }) => r.fullName),
    ['b/two']
  )
  assert.deepEqual(view.errors, [])
  await view.unmount()
})
