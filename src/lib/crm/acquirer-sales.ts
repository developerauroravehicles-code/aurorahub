import type { DealerSalesStat } from '@/lib/crm/dealer-sales'

export type DealerAcquirerRow = {
  dealerId: string
  acquiredByProfileId: string | null
}

export type AcquirerSalesStat = {
  profileId: string
  dealerCount: number
  completedCount: number
  salesTotal: number
  sharePercent: number
}

export function aggregateAcquirerSales(
  dealers: DealerAcquirerRow[],
  byDealer: DealerSalesStat[]
): { byAcquirer: AcquirerSalesStat[]; unattributed: { completedCount: number; salesTotal: number } } {
  const dealerStats = new Map(byDealer.map((d) => [d.dealerId, d]))
  const map = new Map<string, { dealers: number; count: number; total: number }>()
  let unCount = 0
  let unTotal = 0

  for (const d of dealers) {
    const stat = dealerStats.get(d.dealerId)
    if (!stat) continue
    if (!d.acquiredByProfileId) {
      unCount += stat.completedCount
      unTotal += stat.salesTotal
      continue
    }
    const cur = map.get(d.acquiredByProfileId) ?? { dealers: 0, count: 0, total: 0 }
    cur.dealers += 1
    cur.count += stat.completedCount
    cur.total += stat.salesTotal
    map.set(d.acquiredByProfileId, cur)
  }

  const globalTotal = byDealer.reduce((s, d) => s + d.salesTotal, 0)

  const byAcquirer: AcquirerSalesStat[] = Array.from(map.entries()).map(([profileId, v]) => ({
    profileId,
    dealerCount: v.dealers,
    completedCount: v.count,
    salesTotal: Math.round(v.total * 100) / 100,
    sharePercent: globalTotal > 0 ? Math.round((v.total / globalTotal) * 10000) / 100 : 0,
  }))

  byAcquirer.sort((a, b) => b.salesTotal - a.salesTotal)

  return {
    byAcquirer,
    unattributed: {
      completedCount: unCount,
      salesTotal: Math.round(unTotal * 100) / 100,
    },
  }
}