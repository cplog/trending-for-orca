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

const idea = { useCase: 'Compare two layouts.', tryIt: 'Sketch a sample settings screen.', source: 'https://github.com/a/one/blob/main/README.md' }
function host(tried: unknown[], offline = false) {
  return mockHost({
    requests: {
      'trending.list': [repo, other],
      'trending.insight': ({ fullName }: { fullName: string }) => {
        if (offline) throw new Error('feed unavailable')
        return fullName === 'a/one' ? idea : null
      },
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

test('only an expanded matching row shows a sourced usage idea', async () => {
  const view = await mount(panel, { host: host([]) })
  assert.equal(view.find({ text: idea.useCase }), null)
  await view.press({ label: 'Show actions for a/one' })
  assert.ok(view.find({ text: idea.useCase }))
  assert.ok(view.find({ text: `Try it: ${idea.tryIt}` }))
  assert.ok(view.find({ text: 'Read the project docs' }))
  await view.press({ label: 'Show actions for b/two' })
  assert.equal(view.find({ text: idea.useCase }), null)
  assert.ok(view.find({ text: 'Try in a workspace' }))
  await view.unmount()
})

test('an unreachable ideas feed does not disable the row action', async () => {
  const view = await mount(panel, { host: host([], true) })
  await view.press({ label: 'Show actions for a/one' })
  assert.equal(view.find({ text: 'What could I use this for?' }), null)
  await view.press({ text: 'Try in a workspace' })
  assert.ok(view.find({ text: 'Create workspace' }))
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
