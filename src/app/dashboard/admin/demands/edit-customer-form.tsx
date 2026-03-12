'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCustomerInfo } from './actions'

const inputClass = 'w-full border border-gray-700 bg-white/5 p-2 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]'

interface EditCustomerFormProps {
  demandId: string
  firstName: string
  lastName: string
  phone: string
  address: string | null
  isAuroraManager: boolean
}

export function EditCustomerForm({
  demandId,
  firstName,
  lastName,
  phone,
  address,
  isAuroraManager,
}: EditCustomerFormProps) {
  const router = useRouter()
  const [firstNameVal, setFirstNameVal] = useState(firstName ?? '')
  const [lastNameVal, setLastNameVal] = useState(lastName ?? '')
  const [phoneVal, setPhoneVal] = useState(phone ?? '')
  const [addressVal, setAddressVal] = useState(address ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const hasChange =
    firstNameVal.trim() !== (firstName ?? '').trim() ||
    lastNameVal.trim() !== (lastName ?? '').trim() ||
    phoneVal.trim() !== (phone ?? '').trim() ||
    addressVal.trim() !== (address ?? '').trim()

  const handleSave = async () => {
    if (!firstNameVal.trim() || !lastNameVal.trim() || !phoneVal.trim()) {
      setMessage({ type: 'error', text: 'First name, last name and phone are required' })
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await updateCustomerInfo(demandId, {
      firstName: firstNameVal.trim(),
      lastName: lastNameVal.trim(),
      phone: phoneVal.trim(),
      address: addressVal.trim() || undefined,
    })
    setSaving(false)
    if (result.success) {
      setMessage({ type: 'success', text: 'Customer info updated' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to update' })
    }
  }

  if (!isAuroraManager) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-400">Name</p>
          <p className="text-white font-medium">{firstName} {lastName}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Phone</p>
          <p className="text-white">{phone}</p>
        </div>
        {address && (
          <div>
            <p className="text-sm text-gray-400">Address</p>
            <p className="text-white">{address}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">First Name</label>
        <input
          type="text"
          value={firstNameVal}
          onChange={(e) => setFirstNameVal(e.target.value.toUpperCase())}
          style={{ textTransform: 'uppercase' }}
          className={inputClass}
          placeholder="First name"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Last Name</label>
        <input
          type="text"
          value={lastNameVal}
          onChange={(e) => setLastNameVal(e.target.value.toUpperCase())}
          style={{ textTransform: 'uppercase' }}
          className={inputClass}
          placeholder="Last name"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Phone</label>
        <input
          type="tel"
          value={phoneVal}
          onChange={(e) => setPhoneVal(e.target.value)}
          className={inputClass}
          placeholder="(604) 833-5801"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Address</label>
        <input
          type="text"
          value={addressVal}
          onChange={(e) => setAddressVal(e.target.value)}
          className={inputClass}
          placeholder="Optional"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChange}
          className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {message && (
        <p
          className={`text-sm ${
            message.type === 'success' ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
