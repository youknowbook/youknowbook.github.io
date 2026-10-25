import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchMembers } from '../src/api/members.js'

function clientWith(responses) {
  const calls = []
  return { calls, from: table => ({ select: async columns => {
    calls.push({ table, columns })
    if (!responses.length) throw new Error('Unexpected query')
    return responses.shift()
  } }) }
}
const member = { id: 'one', display_name: 'Tag', is_admin: false }
const missing = { error: { code: '42703', message: 'column does not exist' } }

test('staging profiles still load when both registration date columns are absent', async () => {
  const client = clientWith([{ data: [member] }, missing, missing])
  assert.deepEqual(await fetchMembers(client), [member])
  assert.equal(client.calls[0].columns.includes('auth_created_at'), false)
  assert.equal(client.calls.length, 3)
})

test('existing auth registration dates are preserved for sorting', async () => {
  const client = clientWith([{ data: [member] }, { data: [{ id: 'one', auth_created_at: '2025-01-01' }] }])
  assert.equal((await fetchMembers(client))[0].auth_created_at, '2025-01-01')
})

test('created_at is used when the older auth date field is missing', async () => {
  const client = clientWith([{ data: [member] }, missing, { data: [{ id: 'one', created_at: '2024-01-01' }] }])
  assert.equal((await fetchMembers(client))[0].auth_created_at, '2024-01-01')
})

test('member query permission errors are reported rather than disguised as an empty list', async () => {
  const error = { code: '42501', message: 'permission denied' }
  await assert.rejects(fetchMembers(clientWith([{ error }])), error)
})

test('empty results do not trigger optional lookups', async () => {
  const client = clientWith([{ data: [] }])
  assert.deepEqual(await fetchMembers(client), [])
  assert.equal(client.calls.length, 1)
})
