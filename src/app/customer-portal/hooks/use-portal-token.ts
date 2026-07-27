'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CustomerPortalRow } from '@/types/customer-portal'

const SESSION_TOKEN_KEY = 'customer_portal_token'
const SESSION_PHONE_KEY = 'customer_portal_phone'

export type PortalAccessMode = 'vin' | 'token'

export function usePortalTokenSession() {
  const [accessMode, setAccessMode] = useState<PortalAccessMode>('vin')
  const [tokenExpired, setTokenExpired] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [phone, setPhone] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)

  const clearSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_TOKEN_KEY)
      sessionStorage.removeItem(SESSION_PHONE_KEY)
    }
    setAccessMode('vin')
    setPhone(null)
    setTokenExpired(false)
    setTokenError(null)
  }, [])

  const validateAndStore = useCallback(async (token: string): Promise<boolean> => {
    setTokenLoading(true)
    setTokenError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('customer_portal_validate_token', {
        p_token: token.trim(),
      })

      if (error) {
        console.error('customer_portal_validate_token', error)
        setTokenError('We could not verify your access link. Please enter your VIN instead.')
        setAccessMode('vin')
        return false
      }

      const result = data as {
        valid?: boolean
        expired?: boolean
        customer_phone?: string | null
      } | null

      if (result?.valid && result.customer_phone) {
        sessionStorage.setItem(SESSION_TOKEN_KEY, token.trim())
        sessionStorage.setItem(SESSION_PHONE_KEY, result.customer_phone)
        setPhone(result.customer_phone)
        setAccessMode('token')
        setTokenExpired(false)
        return true
      }

      if (result?.expired) {
        setTokenExpired(true)
        setAccessMode('vin')
        if (result.customer_phone) setPhone(result.customer_phone)
      } else {
        setTokenError('This access link is invalid. Please enter your VIN instead.')
        setAccessMode('vin')
      }
      return false
    } finally {
      setTokenLoading(false)
    }
  }, [])

  const restoreSession = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false
    const stored = sessionStorage.getItem(SESSION_TOKEN_KEY)
    if (!stored) return false
    return validateAndStore(stored)
  }, [validateAndStore])

  return {
    accessMode,
    tokenExpired,
    tokenLoading,
    phone,
    tokenError,
    validateAndStore,
    restoreSession,
    clearSession,
  }
}

export function usePortalPhoneLookup() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CustomerPortalRow[] | null>(null)
  const [queried, setQueried] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookupByPhone = useCallback(async (phone: string): Promise<CustomerPortalRow[] | null> => {
    setLoading(true)
    setError(null)
    setQueried(true)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('customer_portal_lookup_by_phone', {
        p_phone: phone,
      })

      if (rpcError) {
        console.error('customer_portal_lookup_by_phone', rpcError)
        setError('We could not load your installations right now. Please try again in a moment.')
        setRows(null)
        return null
      }

      const result = (data ?? []) as CustomerPortalRow[]
      setRows(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
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
    loading,
    rows,
    queried,
    error,
    lookupByPhone,
    reset,
    updateRowRating,
  }
}

export function usePortalContact() {
  const [contact, setContact] = useState<{ phone: string; email: string; hours: string } | null>(null)

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase.rpc('customer_portal_get_contact')
      if (data && typeof data === 'object') {
        const c = data as Record<string, string>
        setContact({
          phone: c.phone ?? '',
          email: c.email ?? '',
          hours: c.hours ?? '',
        })
      }
    })()
  }, [])

  return contact
}
