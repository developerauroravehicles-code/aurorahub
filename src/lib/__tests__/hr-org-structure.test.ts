import { describe, expect, it } from 'vitest'
import {
  buildOrgDepartmentTree,
  rolesForSubDepartment,
  resolveMainDepartmentId,
  subDepartmentsForMain,
} from '@/lib/hr-org-structure'

describe('hr-org-structure', () => {
  const tree = buildOrgDepartmentTree(
    [
      { id: 'main-1', code: 'D-001', name: 'Executive Management', parent_id: null },
      { id: 'sub-1', code: 'D-001-BOARD', name: 'Board of Directors', parent_id: 'main-1' },
      { id: 'sub-2', code: 'D-001-CSUITE', name: 'C-Suite', parent_id: 'main-1' },
    ],
    [
      { id: 'role-1', code: 'R-1', name: 'Chairman', department_id: 'sub-1', sort_order: 1 },
      { id: 'role-2', code: 'R-2', name: 'CEO', department_id: 'sub-2', sort_order: 1 },
    ]
  )

  it('filters sub-departments by main department', () => {
    expect(subDepartmentsForMain(tree, 'main-1')).toHaveLength(2)
    expect(subDepartmentsForMain(tree, 'missing')).toHaveLength(0)
  })

  it('filters roles by sub-department', () => {
    expect(rolesForSubDepartment(tree, 'sub-1')).toEqual([
      expect.objectContaining({ id: 'role-1', name: 'Chairman' }),
    ])
  })

  it('resolves main department from sub-department', () => {
    expect(resolveMainDepartmentId(tree, 'sub-2')).toBe('main-1')
    expect(resolveMainDepartmentId(tree, null)).toBeNull()
  })
})
