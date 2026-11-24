import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { detectLanguage } from '../worker/main.mjs'

const has = (...files) => (path) => files.some((f) => path === join('/w', f))

test('detects the workspace language from marker files', () => {
  assert.equal(detectLanguage('/w', has('Cargo.toml', 'package.json')), 'rust')
  assert.equal(detectLanguage('/w', has('package.json', 'tsconfig.json')), 'typescript')
  assert.equal(detectLanguage('/w', has('package.json')), 'javascript')
  assert.equal(detectLanguage('/w', has('README.md')), null)
})
