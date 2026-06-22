'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CustomerPortalRow } from '@/types/customer-portal'
import { isValidVinQuery, normalizeVinInput } from '@/lib/customer-portal-utils'

export function usePortalLookup() {
  const [vin, setVin] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CustomerPortalRow[] | null>(null)
  const [queried, setQueried] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = useCallback(async (vinQuery?: string): Promise<CustomerPortalRow[] | null> => {
    const trimmed = normalizeVinInput(vinQuery ?? vin)
    if (!isValidVinQuery(trimmed)) {
      setRows([])
      setQueried(true)
      setError(null)
      return []
    }

    setLoading(true)
    setError(null)
    setQueried(true)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('customer_portal_lookup_by_vin', {
        p_vin_query: trimmed,
      })

      if (rpcError) {
        console.error('customer_portal_lookup_by_vin', rpcError)
        setError('We could not look up your VIN right now. Please try again in a moment.')
        setRows(null)
        return null
      }

      const result = (data ?? []) as CustomerPortalRow[]
      setRows(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [vin])

  const reset = useCallback(() => {
    setVin('')
    setRows(null)
    setQueried(false)
    setError(null)
  }, [])

  const updateRowRating = useCallback(
    (index: number, customerRating: number, qualityScore: number, comment: string) => {
      setRows((prev) => {
        if (!prev) return prev
        return prev.map((row, i) =>
          i === index
            ? {
                ...row,
                rated_customer_rating: customerRating,
                rated_quality_score: qualityScore,
                rated_comment: comment,
              }
            : row
        )
      })
    },
    []
  )

  return {
    vin,
    setVin,
    loading,
    rows,
    setRows,
    queried,
    error,
    lookup,
    reset,
    updateRowRating,
  }
}

export type PortalLookupState = ReturnType<typeof usePortalLookup>
