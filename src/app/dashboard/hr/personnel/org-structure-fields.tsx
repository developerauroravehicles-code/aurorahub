'use client'

import { useMemo, useState } from 'react'
import {
  rolesForSubDepartment,
  resolveMainDepartmentId,
  subDepartmentsForMain,
  type OrgDepartmentTree,
} from '@/lib/hr-org-structure'

type Props = {
  tree: OrgDepartmentTree
  isPlatform: boolean
  initialDepartmentId?: string | null
  initialOrgRoleId?: string | null
  selectClass: string
  labelClass: string
  requireOrgFields?: boolean
  layout?: 'default' | 'row'
}

export function OrgStructureFields({
  tree,
  isPlatform,
  initialDepartmentId,
  initialOrgRoleId,
  selectClass,
  labelClass,
  requireOrgFields = false,
  layout = 'default',
}: Props) {
  const initialMainId = useMemo(
    () => resolveMainDepartmentId(tree, initialDepartmentId) ?? '',
    [tree, initialDepartmentId]
  )

  const [mainDepartmentId, setMainDepartmentId] = useState(initialMainId)
  const [subDepartmentId, setSubDepartmentId] = useState(initialDepartmentId ?? '')
  const [orgRoleId, setOrgRoleId] = useState(initialOrgRoleId ?? '')

  const subOptions = useMemo(
    () => (mainDepartmentId ? subDepartmentsForMain(tree, mainDepartmentId) : []),
    [tree, mainDepartmentId]
  )

  const roleOptions = useMemo(
    () => (subDepartmentId ? rolesForSubDepartment(tree, subDepartmentId) : []),
    [tree, subDepartmentId]
  )

  if (!isPlatform) return null

  const fields = (
    <>
      <input type="hidden" name="department_id" value={subDepartmentId} />
      <input type="hidden" name="org_role_id" value={orgRoleId} />
      <div>
        <label className={labelClass}>Main Department{requireOrgFields ? ' *' : ''}</label>
        <select
          className={selectClass}
          value={mainDepartmentId}
          required={requireOrgFields}
          onChange={(e) => {
            setMainDepartmentId(e.target.value)
            setSubDepartmentId('')
            setOrgRoleId('')
          }}
        >
          <option value="">— Select —</option>
          {tree.mainDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Sub-department{requireOrgFields ? ' *' : ''}</label>
        <select
          className={selectClass}
          value={subDepartmentId}
          required={requireOrgFields}
          disabled={!mainDepartmentId}
          onChange={(e) => {
            setSubDepartmentId(e.target.value)
            setOrgRoleId('')
          }}
        >
          <option value="">— Select —</option>
          {subOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Job Title{requireOrgFields ? ' *' : ''}</label>
        <select
          className={selectClass}
          value={orgRoleId}
          required={requireOrgFields}
          disabled={!subDepartmentId}
          onChange={(e) => setOrgRoleId(e.target.value)}
        >
          <option value="">— Select —</option>
          {roleOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    </>
  )

  if (layout === 'row') {
    return (
      <div className="md:col-span-2 rounded-lg border border-zinc-300/80 dark:border-gray-700 bg-zinc-100/40 dark:bg-black/20 p-4">
        <p className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Organization structure</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{fields}</div>
      </div>
    )
  }

  return fields
}
