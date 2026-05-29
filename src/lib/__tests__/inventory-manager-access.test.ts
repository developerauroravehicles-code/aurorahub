import { describe, expect, it } from 'vitest'
import {
  canAccessAdminCustomers,
  canAccessAdminDemands,
  canUseSmsFeatures,
  getInventoryManagerDealerId,
  inventoryManagerMustHaveDealer,
  isInventoryManager,
  normalizeUserRole,
} from '../inventory-manager-access'

describe('inventory-manager-access', () => {
  it('normalizes role strings for sidebar checks', () => {
    expect(normalizeUserRole('Inventory Manager')).toBe('inventory_manager')
    expect(normalizeUserRole(' inventory_manager ')).toBe('inventory_manager')
  })

  it('detects inventory manager role', () => {
    expect(isInventoryManager('inventory_manager')).toBe(true)
    expect(isInventoryManager('Inventory Manager')).toBe(true)
    expect(isInventoryManager('sales')).toBe(false)
  })

  it('grants admin demands and customers nav access', () => {
    expect(canAccessAdminDemands('inventory_manager')).toBe(true)
    expect(canAccessAdminCustomers('inventory_manager')).toBe(true)
    expect(canAccessAdminCustomers('general_manager')).toBe(false)
  })

  it('requires dealer assignment for inventory manager scoping', () => {
    expect(getInventoryManagerDealerId({ role: 'inventory_manager', dealer_id: 'dealer-1' })).toBe('dealer-1')
    expect(getInventoryManagerDealerId({ role: 'inventory_manager', dealer_id: null })).toBeNull()
    expect(inventoryManagerMustHaveDealer({ role: 'inventory_manager', dealer_id: 'dealer-1' })).toBe(true)
  })

  it('denies SMS features for inventory manager', () => {
    expect(canUseSmsFeatures('inventory_manager')).toBe(false)
    expect(canUseSmsFeatures('aurora_manager')).toBe(true)
  })
})
