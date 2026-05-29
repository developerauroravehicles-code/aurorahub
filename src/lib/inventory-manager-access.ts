type ProfileForDemandAccess = {
  role: string
  dealer_id?: string | null
}

/** Normalize role strings from DB/UI for consistent comparisons. */
export function normalizeUserRole(role: string | null | undefined): string {
  return (role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function isInventoryManager(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === 'inventory_manager'
}

export function isAuroraManager(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === 'aurora_manager'
}

export function canAccessAdminCustomers(role: string | null | undefined): boolean {
  const normalized = normalizeUserRole(role)
  return normalized === 'aurora_manager' || normalized === 'inventory_manager'
}

export function canAccessAdminDemands(role: string | null | undefined): boolean {
  const normalized = normalizeUserRole(role)
  return normalized === 'aurora_manager' || normalized === 'inventory_manager' || normalized === 'general_manager'
}

export function canEditDemandCoreFields(role: string | null | undefined): boolean {
  return isAuroraManager(role) || isInventoryManager(role)
}

export function assertDealerDemandAccess(
  profile: ProfileForDemandAccess,
  demandDealerId: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (!isInventoryManager(profile.role)) {
    return { ok: true }
  }

  if (!profile.dealer_id) {
    return { ok: false, error: 'Inventory Manager must be assigned to a dealer' }
  }

  if (!demandDealerId || demandDealerId !== profile.dealer_id) {
    return { ok: false, error: 'You can only edit demands for your dealer' }
  }

  return { ok: true }
}
