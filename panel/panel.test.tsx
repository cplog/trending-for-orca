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

function host(tried: unknown[]) {
  return mockHost({
    requests: {
      'trending.list': [repo, other],
      'workspace.language': { language: null, name: null },
      'actions.context': context,
      'workspace.try': (input: unknown) => {
        tried.push(input)
        return { name: 'try-one' }
      }
    }
  })
}

test('a workspace is created only after the person confirms, and cancel creates nothing', async () => {
  const tried: unknown[] = []
  const view = await mount(panel, { host: host(tried) })

  await view.press({ label: 'Show actions for a/one' })
  await view.press({ text: 'Try in a workspace' })
  assert.ok(view.find({ text: /Creates a new workspace named "try-one"/ }))
  await view.press({ text: 'Cancel' })
  assert.deepEqual(tried, [], 'nothing is created before the confirmation')

  await view.press({ text: 'Try in a workspace' })
  await view.press({ text: 'Create workspace' })
  assert.deepEqual(tried, [{ fullName: 'a/one', projectId: 'p1' }])
  assert.ok(view.find({ text: /Created the workspace try-one/ }))
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('the filter narrows the list and saving keeps a repository', async () => {
  const view = await mount(panel, { host: host([]) })

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
