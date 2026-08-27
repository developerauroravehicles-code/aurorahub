import type { SupabaseClient } from '@supabase/supabase-js'

export type OrgDepartment = {
  id: string
  code: string | null
  name: string
  parent_id: string | null
}

export type OrgRole = {
  id: string
  code: string
  name: string
  department_id: string
  sort_order: number
}

export type OrgDepartmentTree = {
  mainDepartments: OrgDepartment[]
  subDepartments: OrgDepartment[]
  roles: OrgRole[]
}

export function buildOrgDepartmentTree(
  departments: OrgDepartment[],
  roles: OrgRole[]
): OrgDepartmentTree {
  const mainDepartments = departments
    .filter((d) => d.parent_id == null)
    .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''))
  const subDepartments = departments
    .filter((d) => d.parent_id != null)
    .sort((a, b) => a.name.localeCompare(b.name))
  const sortedRoles = [...roles].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  return { mainDepartments, subDepartments, roles: sortedRoles }
}

export function subDepartmentsForMain(
  tree: OrgDepartmentTree,
  mainDepartmentId: string
): OrgDepartment[] {
  return tree.subDepartments.filter((d) => d.parent_id === mainDepartmentId)
}

export function rolesForSubDepartment(tree: OrgDepartmentTree, subDepartmentId: string): OrgRole[] {
  return tree.roles.filter((r) => r.department_id === subDepartmentId)
}

export function resolveMainDepartmentId(
  tree: OrgDepartmentTree,
  subDepartmentId: string | null | undefined
): string | null {
  if (!subDepartmentId) return null
  const sub = tree.subDepartments.find((d) => d.id === subDepartmentId)
  return sub?.parent_id ?? null
}

export async function fetchOrgDepartmentTree(
  supabase: SupabaseClient
): Promise<OrgDepartmentTree> {
  const [{ data: departments }, { data: roles }] = await Promise.all([
    supabase
      .from('hr_departments')
      .select('id, code, name, parent_id')
      .order('code', { ascending: true }),
    supabase
      .from('hr_org_roles')
      .select('id, code, name, department_id, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  return buildOrgDepartmentTree(
    (departments ?? []) as OrgDepartment[],
    (roles ?? []) as OrgRole[]
  )
}

export function orgRoleLabel(
  person: {
    org_role_id?: string | null
    hr_org_roles?: { name: string } | { name: string }[] | null
    hr_departments?: { name: string; parent_id?: string | null } | { name: string; parent_id?: string | null }[] | null
  },
  tree?: OrgDepartmentTree
): { mainDepartment: string; subDepartment: string; jobTitle: string } {
  const roleRel = Array.isArray(person.hr_org_roles) ? person.hr_org_roles[0] : person.hr_org_roles
  const deptRel = Array.isArray(person.hr_departments) ? person.hr_departments[0] : person.hr_departments

  const jobTitle = roleRel?.name ?? '—'
  const subDepartment = deptRel?.name ?? '—'

  let mainDepartment = '—'
  if (deptRel?.parent_id && tree) {
    mainDepartment =
      tree.mainDepartments.find((d) => d.id === deptRel.parent_id)?.name ?? '—'
  }

  return { mainDepartment, subDepartment, jobTitle }
}

export function parsePersonnelOrgFields(
  formData: Record<string, string | undefined>,
  isCreate: boolean
):
  | { error: string }
  | { dealer_id: string | null; department_id: string | null; org_role_id: string | null } {
  const dealerId = formData.dealer_id?.trim() || null
  const departmentId = formData.department_id?.trim() || null
  const orgRoleId = formData.org_role_id?.trim() || null

  if (dealerId) {
    return { dealer_id: dealerId, department_id: null, org_role_id: null }
  }

  if (isCreate && (!departmentId || !orgRoleId)) {
    return { error: 'Platform personnel require sub-department and job title.' }
  }

  return { dealer_id: null, department_id: departmentId, org_role_id: orgRoleId }
}
