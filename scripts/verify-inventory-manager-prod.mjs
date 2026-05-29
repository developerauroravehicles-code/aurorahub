import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`)
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

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data: profile, error } = await admin
  .from('profiles')
  .select('id, role, dealer_id, full_name')
  .eq('role', 'inventory_manager')
  .limit(5)

if (error) throw error

console.log(
  JSON.stringify(
    {
      inventoryManagerProfiles: profile ?? [],
      enumAndProfilesOk: (profile ?? []).length > 0,
      note: 'Run 20260529120100_inventory_manager_demands_rls.sql in Supabase SQL Editor if demand edits fail.',
    },
    null,
    2
  )
)
