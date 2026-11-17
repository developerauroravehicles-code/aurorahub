/** First screen after login or when visiting /dashboard */
export function getDashboardHomeForRole(role: string | null | undefined): string {
  if (role === 'sales') return '/dashboard/sales/demands'
  if (role === 'finance') return '/dashboard/finance/demands'
  return '/dashboard'
}