export type CompletedDemandSalesRow = {
  dealer_id: string
  invoice_total_amount: number | null
  completed_at: string | null
  updated_at: string
}

export type DealerSalesStat = {
  dealerId: string
  completedCount: number
  salesTotal: number
  sharePercent: number
}

export function demandCompletionTimestamp(row: CompletedDemandSalesRow): string {
  return row.completed_at ?? row.updated_at
}

export function filterDemandsInPeriod(
  rows: CompletedDemandSalesRow[],
  startIso: string,
  endIso: string
): CompletedDemandSalesRow[] {
  return rows.filter((r) => {
    const ts = demandCompletionTimestamp(r)
    return ts >= startIso && ts <= endIso
  })
}

export function aggregateDealerSales(
  rows: CompletedDemandSalesRow[]
): { byDealer: DealerSalesStat[]; globalSalesTotal: number; globalCompletedCount: number } {
  const map = new Map<string, { count: number; total: number }>()

  for (const r of rows) {
    const cur = map.get(r.dealer_id) ?? { count: 0, total: 0 }
    cur.count += 1
    cur.total += Math.max(0, Number(r.invoice_total_amount ?? 0))
    map.set(r.dealer_id, cur)
  }

  let globalSalesTotal = 0
  let globalCompletedCount = 0
  for (const v of map.values()) {
    globalSalesTotal += v.total
    globalCompletedCount += v.count
  }

  const byDealer: DealerSalesStat[] = Array.from(map.entries()).map(([dealerId, v]) => ({
    dealerId,
    completedCount: v.count,
    salesTotal: Math.round(v.total * 100) / 100,
    sharePercent:
      globalSalesTotal > 0 ? Math.round((v.total / globalSalesTotal) * 10000) / 100 : 0,
  }))

  byDealer.sort((a, b) => b.salesTotal - a.salesTotal)

  return {
    byDealer,
    globalSalesTotal: Math.round(globalSalesTotal * 100) / 100,
    globalCompletedCount,
  }
}

export function topDealersBySales(byDealer: DealerSalesStat[], limit = 5): DealerSalesStat[] {
  return [...byDealer].sort((a, b) => b.salesTotal - a.salesTotal).slice(0, limit)
}

export function activeDealerCount(byDealer: DealerSalesStat[]): number {
  return byDealer.filter((d) => d.completedCount > 0).length
}