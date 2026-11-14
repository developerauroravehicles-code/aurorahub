import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/google-drive', () => ({ uploadSpecialistExpenseReceiptToDrive: vi.fn() }))
vi.mock('@/lib/notify-expense-claim-pending', () => ({ notifyAuroraManagersExpenseClaimPending: vi.fn() }))
vi.mock('@/lib/specialist-expense-claims', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/specialist-expense-claims')>()
  return { ...actual, getGoogleDriveSettingsFromDb: vi.fn(async () => ({ folderId: 'f' })) }
})

import { createITRequestCore, requestLeaveCore } from '../requests'
import { expenseAccessError, submitExpenseClaimCore } from '../expenses'
import { uploadSpecialistExpenseReceiptToDrive } from '@/lib/google-drive'
import { notifyAuroraManagersExpenseClaimPending } from '@/lib/notify-expense-claim-pending'

type Inserted = { table: string; row: Record<string, unknown> }

/** Minimal chainable Supabase fake: profiles/personnel reads + recorded inserts. */
function fakeSupabase(opts: { dealerId?: string | null; personnel?: Record<string, unknown> | null } = {}) {
  const inserts: Inserted[] = []
  const client = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: table === 'profiles' ? { dealer_id: opts.dealerId ?? null } : null }),
        maybeSingle: async () => ({ data: table === 'personnel' ? (opts.personnel ?? null) : null }),
        insert: (row: Record<string, unknown>) => {
          inserts.push({ table, row })
          const after = {
            select: () => after,
            single: async () => ({ data: { id: 'claim-1' }, error: null }),
            then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
          }
          return after
        },
      }
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient, inserts }
}

const specialist = { id: 'user-1', role: 'specialist', full_name: 'Kutay Kurt', dealer_id: null }

describe('requestLeaveCore', () => {
  it('inserts a pending leave request for the user', async () => {
    const { client, inserts } = fakeSupabase()
    const result = await requestLeaveCore(client, 'user-1', {
      leave_type: 'vacation',
      start_date: '2026-11-10',
      end_date: '2026-11-12',
      notes: '  family  ',
    })
    expect(result).toEqual({ success: true })
    expect(inserts).toEqual([
      {
        table: 'leave_requests',
        row: expect.objectContaining({
          profile_id: 'user-1',
          leave_type: 'vacation',
          status: 'pending',
          notes: 'family',
          created_by: 'user-1',
        }),
      },
    ])
  })

  it('rejects dealer users, unknown types and reversed dates', async () => {
    const dealer = fakeSupabase({ dealerId: 'd1' })
    expect(
      await requestLeaveCore(dealer.client, 'u', { leave_type: 'vacation', start_date: '2026-11-10', end_date: '2026-11-10' })
    ).toEqual({ error: 'Leave requests are only for platform users' })

    const { client, inserts } = fakeSupabase()
    expect(
      await requestLeaveCore(client, 'u', { leave_type: 'holiday', start_date: '2026-11-10', end_date: '2026-11-10' })
    ).toEqual({ error: 'Invalid leave type' })
    expect(
      await requestLeaveCore(client, 'u', { leave_type: 'sick', start_date: '2026-11-10', end_date: '2026-11-09' })
    ).toEqual({ error: 'End date must be on or after start date' })
    expect(inserts).toHaveLength(0)
  })
})

describe('createITRequestCore', () => {
  it('defaults priority to medium and trims fields', async () => {
    const { client, inserts } = fakeSupabase()
    const result = await createITRequestCore(client, 'user-1', {
      title: '  Tablet broken ',
      category: 'system_issue',
    })
    expect(result).toEqual({ success: true })
    expect(inserts[0]).toEqual({
      table: 'it_tickets',
      row: { title: 'Tablet broken', description: null, category: 'system_issue', priority: 'medium', requested_by: 'user-1' },
    })
  })

  it('rejects unknown categories', async () => {
    const { client } = fakeSupabase()
    expect(await createITRequestCore(client, 'u', { title: 't', category: 'nope' })).toEqual({ error: 'Invalid category' })
  })
})

describe('expenses', () => {
  beforeEach(() => vi.clearAllMocks())

  it('only allows platform specialists', () => {
    expect(expenseAccessError(specialist)).toBeNull()
    expect(expenseAccessError({ ...specialist, role: 'sales' })).toBe('Only Technical Support can submit expenses.')
    expect(expenseAccessError({ ...specialist, dealer_id: 'd1' })).toBe('Expenses are only for platform specialists.')
    expect(expenseAccessError(null)).toBe('Expenses are only for platform specialists.')
  })

  it('requires a receipt for regular expenses', async () => {
    const { client, inserts } = fakeSupabase()
    const result = await submitExpenseClaimCore(client, specialist, {
      description: 'Fuel',
      expenseDate: '2026-11-05',
      category: 'fuel',
      amount: '42.50',
      receipt: null,
    })
    expect(result).toEqual({ error: 'Receipt photo or PDF is required.' })
    expect(inserts).toHaveLength(0)
  })

  it('uploads the receipt, saves the claim and notifies managers', async () => {
    vi.mocked(uploadSpecialistExpenseReceiptToDrive).mockResolvedValue({
      success: true,
      fileId: 'drive-1',
      webViewLink: 'https://drive/1',
      name: 'receipt.jpg',
    } as never)
    const { client, inserts } = fakeSupabase()
    const result = await submitExpenseClaimCore(client, specialist, {
      description: 'Fuel',
      expenseDate: '2026-11-05',
      category: 'fuel',
      amount: '42.555',
      receipt: { buffer: Buffer.from('x'), mimeType: 'image/jpeg', fileName: 'r.jpg', size: 1 },
    })
    expect(result).toEqual({ success: true })
    expect(inserts[0].table).toBe('specialist_expense_claims')
    expect(inserts[0].row).toEqual(
      expect.objectContaining({ amount: 42.56, category: 'fuel', receipt_drive_file_id: 'drive-1', status: 'pending' })
    )
    expect(notifyAuroraManagersExpenseClaimPending).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ claimId: 'claim-1', amount: 42.56 })
    )
  })

  it('prices extra duty from salary without a receipt', async () => {
    const { client, inserts } = fakeSupabase({ personnel: { salary_amount: 4000, salary_type: 'monthly' } })
    const result = await submitExpenseClaimCore(client, specialist, {
      description: 'Weekend install',
      expenseDate: '2026-11-05',
      category: 'extra_duty',
      dutyHours: '2',
      dutyMinutes: '0',
      receipt: null,
    })
    expect(result).toEqual({ success: true })
    expect(uploadSpecialistExpenseReceiptToDrive).not.toHaveBeenCalled()
    expect(inserts[0].row).toEqual(expect.objectContaining({ category: 'extra_duty', duration_minutes: 120 }))
    expect(Number(inserts[0].row.amount)).toBeGreaterThan(0)
  })
})
