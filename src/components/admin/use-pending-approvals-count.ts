'use client'

import { useEffect, useState } from 'react'
import { getPendingExpenseClaimsCount } from '@/app/dashboard/admin/approvals/actions'

export function usePendingApprovalsCount(enabled: boolean): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    let cancelled = false
    void getPendingExpenseClaimsCount().then((n) => {
      if (!cancelled) setCount(n)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return count
}
