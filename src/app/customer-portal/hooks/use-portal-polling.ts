'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CustomerPortalRow } from '@/types/customer-portal'
import { detectStatusChanges } from '@/lib/customer-portal-utils'

const POLL_INTERVAL_MS = 60_000

type Options = {
  enabled: boolean
  vin: string
  rows: CustomerPortalRow[] | null
  onRefresh: () => Promise<CustomerPortalRow[] | null>
}

export function usePortalPolling({ enabled, vin, rows, onRefresh }: Options) {
  const [refreshing, setRefreshing] = useState(false)
  const [statusBanner, setStatusBanner] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const rowsRef = useRef<CustomerPortalRow[] | null>(rows)
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  const refresh = useCallback(async () => {
    if (!vin.trim()) return
    setRefreshing(true)
    try {
      const prev = rowsRef.current
      const next = await onRefreshRef.current()
      if (next) {
        const message = detectStatusChanges(prev, next)
        if (message) setStatusBanner(message)
        setRefreshToken((n) => n + 1)
      }
    } finally {
      setRefreshing(false)
    }
  }, [vin])

  useEffect(() => {
    if (!enabled || !vin.trim() || !rows?.length) return
    const id = window.setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [enabled, vin, rows?.length, refresh])

  const dismissBanner = useCallback(() => setStatusBanner(null), [])

  return { refreshing, refresh, statusBanner, dismissBanner, refreshToken }
}
