import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`)
  }
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile(envPath)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const targetEmailNeedle = process.argv[2] ?? 'test.im'

async function findUserByEmailNeedle(needle) {
  let page = 1
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => (u.email ?? '').toLowerCase().includes(needle.toLowerCase()))
    if (match) return match
    if (data.users.length < 200) break
    page += 1
  }
  return null
}

const user = await findUserByEmailNeedle(targetEmailNeedle)
if (!user) {
  console.error(`No auth user found matching "${targetEmailNeedle}"`)
  process.exit(1)
}

const { data: dealers, error: dealersError } = await admin
  .from('dealers')
  .select('id, name, code')
  .order('name')
  .limit(1)

if (dealersError) throw dealersError
if (!dealers?.length) {
  console.error('No dealers found')
  process.exit(1)
}

const dealer = dealers[0]

const { data: profileBefore, error: profileReadError } = await admin
  .from('profiles')
  .select('id, role, dealer_id, full_name')
  .eq('id', user.id)
  .single()

if (profileReadError) throw profileReadError

const { error: updateError } = await admin
  .from('profiles')
  .update({
    role: 'inventory_manager',
    dealer_id: dealer.id,
  })
  .eq('id', user.id)

if (updateError) throw updateError

const { data: profileAfter } = await admin
  .from('profiles')
  .select('id, role, dealer_id, full_name')
  .eq('id', user.id)
  .single()

console.log(
  JSON.stringify(
    {
      email: user.email,
      before: profileBefore,
      after: profileAfter,
      assignedDealer: dealer,
    },
    null,
    2
  )
)
