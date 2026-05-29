import { describe, expect, it } from 'vitest'
import {
  canAccessAdminCustomers,
  canAccessAdminDemands,
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
})
