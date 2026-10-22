'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCameraModel } from './actions'
import { DemandFieldWrap } from '@/components/demand-field-highlight'
import type { DemandFieldKey, FieldHighlightBucket } from '@/lib/demand-field-updates'

const inputClass =
  'w-full border border-zinc-300 dark:border-gray-700 bg-white dark:bg-zinc-900 p-2 rounded text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00] placeholder:text-zinc-500 dark:placeholder:text-gray-400'

const selectClass = `${inputClass} [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-zinc-900 dark:[&>option]:text-zinc-100`

interface CameraModelOption {
  id: string
  name: string
  label?: string
}

interface EditCameraModelFormProps {
  demandId: string
  cameraModel: string | null
  cameraModels: CameraModelOption[]
  canEdit: boolean
  fieldHighlights?: Partial<Record<DemandFieldKey, FieldHighlightBucket>>
}

function getInitialSelection(cameraModel: string | null, cameraModels: CameraModelOption[]) {
  const current = (cameraModel ?? '').trim()
  if (!current) return { selectedCamera: '', customCamera: '' }

  const match = cameraModels.find((c) => c.name === current)
  if (match) return { selectedCamera: match.name, customCamera: '' }

  return { selectedCamera: '__custom__', customCamera: current }
}

export function EditCameraModelForm({
  demandId,
  cameraModel,
  cameraModels,
  canEdit,
  fieldHighlights,
}: EditCameraModelFormProps) {
  const router = useRouter()
  const initial = useMemo(
    () => getInitialSelection(cameraModel, cameraModels),
    [cameraModel, cameraModels]
  )
  const [selectedCamera, setSelectedCamera] = useState(initial.selectedCamera)
  const [customCamera, setCustomCamera] = useState(initial.customCamera)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const resolvedValue =
    selectedCamera === '__custom__' ? customCamera.trim() : selectedCamera.trim()
  const hasChange = resolvedValue !== (cameraModel ?? '').trim()
  const isValid = resolvedValue.length > 0

  const handleSave = async () => {
    if (!isValid) {
      setMessage({ type: 'error', text: 'Camera model is required' })
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await updateCameraModel(demandId, resolvedValue)
    setSaving(false)
    if (result.success) {
      setMessage({ type: 'success', text: 'Camera model updated' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to update' })
    }
  }

  if (!canEdit) {
    return (
      <DemandFieldWrap field="camera_model" highlights={fieldHighlights}>
        <p className="text-zinc-900 dark:text-white">{cameraModel || '—'}</p>
      </DemandFieldWrap>
    )
  }

  return (
    <DemandFieldWrap field="camera_model" highlights={fieldHighlights}>
    <div className="space-y-2">
      {cameraModels.length > 0 ? (
        <>
          <select
            value={selectedCamera}
            onChange={(e) => {
              setSelectedCamera(e.target.value)
              setCustomCamera('')
              setMessage(null)
            }}
            className={selectClass}
            style={{ colorScheme: 'dark' }}
          >
            <option value="">-- Select a camera model --</option>
            {cameraModels.map((camera) => (
              <option key={camera.id} value={camera.name}>
                {camera.label ?? camera.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          No cameras assigned to this dealer. Assign cameras in System Management before changing the booking model.
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChange || !isValid}
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
    </DemandFieldWrap>
  )
}
