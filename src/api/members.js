const memberColumns = 'id,is_admin,display_name,profile_picture,motto,favourite_books'

// Older databases have neither date column. Optional sorting metadata must not
// prevent the main member list from loading.
export async function fetchMembers(client) {
  const { data, error } = await client.from('users').select(memberColumns)
  if (error) throw error
  const members = data || []
  if (!members.length) return members
  for (const column of ['auth_created_at', 'created_at']) {
    const { data: dates, error: dateError } = await client.from('users').select(`id,${column}`)
    if (dateError) {
      if (dateError.code === '42703' || dateError.code === 'PGRST204') continue
      // Registration metadata is optional even if its permissions differ.
      return members
    }
    const datesById = new Map((dates || []).map(row => [row.id, row[column]]))
    return members.map(member => ({ ...member, auth_created_at: datesById.get(member.id) || null }))
  }
  return members
}
