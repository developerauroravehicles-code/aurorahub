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

/** Inventory Manager has no SMS send UI or actions. */
export function canUseSmsFeatures(role: string | null | undefined): boolean {
  return !isInventoryManager(role)
}

export function assertDealerDemandAccess(
  profile: ProfileForDemandAccess | null | undefined,
  demandDealerId: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (!profile) {
    return { ok: false, error: 'Unauthorized' }
  }

  if (!isInventoryManager(profile.role)) {
    return { ok: true }
  }

  if (!profile.dealer_id) {
    return { ok: false, error: 'Inventory Manager must be assigned to a dealer' }
  }

  if (!demandDealerId || demandDealerId !== profile.dealer_id) {
    return { ok: false, error: 'You can only access demands for your dealer' }
  }

  return { ok: true }
}

/** Inventory Manager pages require a dealer assignment. */
export function getInventoryManagerDealerId(
  profile: ProfileForDemandAccess | null | undefined
): string | null {
  if (!isInventoryManager(profile?.role) || !profile?.dealer_id) {
    return null
  }
  return profile.dealer_id
}

export function inventoryManagerMustHaveDealer(
  profile: ProfileForDemandAccess | null | undefined
): boolean {
  return isInventoryManager(profile?.role) && !!profile?.dealer_id
}
