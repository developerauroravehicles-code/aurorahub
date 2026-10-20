'use client'

import {
  useActionState,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  startTransition,
} from 'react'
import {
  createExternalDemand,
  previewExternalDemandBarcode,
  previewExternalDemandCompletionPricing,
  saveDealerInstallationPriceForExternalDemand,
  suggestExternalDemandCameraModel,
  validateExternalDemandBarcodes,
} from './create-external-demand-actions'
import type { ExternalDemandMissingPrice } from './external-demand-shared-types'
import {
  clearExternalDemandDraft,
  EXTERNAL_DEMAND_RESTORE_FLAG,
  loadExternalDemandDraft,
  saveExternalDemandDraft,
  type ExternalDemandFormDraft,
} from '@/lib/external-demand-form-draft'
import { getCameraModelsForDealer } from './get-cameras-for-dealer'
import { VEHICLE_MAKES_CA } from '@/lib/vehicle-makes'
import { getModelsForMake, getTrimsForModel } from '@/lib/vehicle-models'
import { CanadianPhoneInput } from '@/components/canadian-phone-input'
import { DemandDocumentFillButton } from '@/components/demand-document-fill-button'
import { VinDecodeField } from '@/components/vin-decode-field'
import type { DemandVehicleFieldsFromVin } from '@/lib/vin-decode/map-to-demand-vehicle'
import { AppointmentCalendar } from '@/components/appointment-calendar'
import { formatInTimeZone } from 'date-fns-tz'
import { getEffectiveTimezone } from '@/lib/timezone-defaults'
import { getTimezoneFromDealer } from '@/lib/dealer-timezone'
import {
  DemandServiceType,
  SERVICE_TYPE_LABELS,
  isBarcodeRequiredForServiceType,
} from '@/lib/demand-pricing'

interface Dealer {
  id: string
  name: string
  region_codes?: { timezone_id?: unknown; timezones?: { name: string } | Array<{ name: string }> } | Array<{
    timezone_id?: unknown
    timezones?: { name: string } | Array<{ name: string }>
  }> | null
}

interface CameraModel {
  id: string
  name: string
  label?: string
}

interface Specialist {
  id: string
  full_name: string | null
}

type ScannedBarcode = { code: string; modelName: string; cameraModelId: string }

const CAMERA_CUSTOM = '__custom__'

interface CreateExternalDemandFormProps {
  dealers: Dealer[]
  specialists: Specialist[]
  barcodeModeEnabled?: boolean
  isOpen?: boolean
  onSuccess?: () => void
  onCancel?: () => void
}

const inputClass =
  'mt-1 block w-full rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 py-2 px-3 shadow-sm focus:border-[#C27E00] focus:outline-none focus:ring-[#C27E00] sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500'
const inputReadOnlyClass = inputClass + ' opacity-75 cursor-not-allowed'

export function CreateExternalDemandForm({
  dealers,
  specialists,
  barcodeModeEnabled = false,
  isOpen = true,
  onSuccess,
  onCancel,
}: CreateExternalDemandFormProps) {
  const [state, formAction, isPending] = useActionState(createExternalDemand, null)
  const restoringDraftRef = useRef(false)
  const prevDealerIdRef = useRef<string | null>(null)
  const prevSpecialistIdRef = useRef<string | null>(null)
  const [selectedDealerId, setSelectedDealerId] = useState<string>(dealers[0]?.id ?? '')

  useEffect(() => {
    if (dealers.length > 0 && !selectedDealerId) {
      setSelectedDealerId(dealers[0].id)
    }
  }, [dealers])

  const [cameraModels, setCameraModels] = useState<CameraModel[]>([])
  const [camerasLoading, setCamerasLoading] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [stockNumber, setStockNumber] = useState('')
  const [vinLast6, setVinLast6] = useState('')
  const [selectedMake, setSelectedMake] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedTrim, setSelectedTrim] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [customCamera, setCustomCamera] = useState('')
  const [cameraNameForSubmit, setCameraNameForSubmit] = useState('')
  const [comment, setComment] = useState('')
  const [isFutureCustomer, setIsFutureCustomer] = useState(false)
  const [completeOnCreate, setCompleteOnCreate] = useState(false)
  const [serviceType, setServiceType] = useState<DemandServiceType>('installation')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [assignedSpecialistId, setAssignedSpecialistId] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scannedBarcodes, setScannedBarcodes] = useState<ScannedBarcode[]>([])
  const [scanPending, setScanPending] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const [pricingCheckPending, setPricingCheckPending] = useState(false)
  const [missingPrice, setMissingPrice] = useState<ExternalDemandMissingPrice | null>(null)
  const [inlinePriceCad, setInlinePriceCad] = useState('')
  const [inlinePricePending, setInlinePricePending] = useState(false)
  const [inlinePriceMessage, setInlinePriceMessage] = useState<string | null>(null)

  const selectedDealer = dealers.find((d) => d.id === selectedDealerId)
  const dealerTimezone = useMemo(
    () =>
      getEffectiveTimezone(
        getTimezoneFromDealer(selectedDealer as Parameters<typeof getTimezoneFromDealer>[0])
      ),
    [selectedDealer]
  )

  const collectDraft = useCallback((): ExternalDemandFormDraft => {
    return {
      version: 1,
      selectedDealerId,
      assignedSpecialistId,
      completeOnCreate,
      serviceType,
      firstName,
      lastName,
      phone,
      address,
      vehicleYear,
      stockNumber,
      vinLast6,
      selectedMake,
      selectedModel,
      selectedTrim,
      customModel,
      selectedCameraId,
      customCamera,
      cameraNameForSubmit,
      comment,
      isFutureCustomer,
      appointmentDate,
      scannedBarcodes,
    }
  }, [
    selectedDealerId,
    assignedSpecialistId,
    completeOnCreate,
    serviceType,
    firstName,
    lastName,
    phone,
    address,
    vehicleYear,
    stockNumber,
    vinLast6,
    selectedMake,
    selectedModel,
    selectedTrim,
    customModel,
    selectedCameraId,
    customCamera,
    cameraNameForSubmit,
    comment,
    isFutureCustomer,
    appointmentDate,
    scannedBarcodes,
  ])

  const applyDraft = useCallback((draft: ExternalDemandFormDraft) => {
    restoringDraftRef.current = true
    prevDealerIdRef.current = draft.selectedDealerId
    setSelectedDealerId(draft.selectedDealerId)
    setAssignedSpecialistId(draft.assignedSpecialistId)
    setCompleteOnCreate(draft.completeOnCreate)
    setServiceType(draft.serviceType)
    setFirstName(draft.firstName)
    setLastName(draft.lastName)
    setPhone(draft.phone)
    setAddress(draft.address)
    setVehicleYear(draft.vehicleYear)
    setStockNumber(draft.stockNumber)
    setVinLast6(draft.vinLast6)
    setSelectedMake(draft.selectedMake)
    setSelectedModel(draft.selectedModel)
    setSelectedTrim(draft.selectedTrim)
    setCustomModel(draft.customModel)
    setSelectedCameraId(draft.selectedCameraId)
    setCustomCamera(draft.customCamera)
    setCameraNameForSubmit(draft.cameraNameForSubmit)
    setComment(draft.comment)
    setIsFutureCustomer(draft.isFutureCustomer)
    setAppointmentDate(draft.appointmentDate)
    setScannedBarcodes(draft.scannedBarcodes)
    queueMicrotask(() => {
      restoringDraftRef.current = false
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    if (typeof sessionStorage === 'undefined') return
    if (sessionStorage.getItem(EXTERNAL_DEMAND_RESTORE_FLAG) !== '1') return
    const stored = loadExternalDemandDraft()
    if (stored) applyDraft(stored)
  }, [isOpen, applyDraft])

  useLayoutEffect(() => {
    if (!state?.error) return
    const stored = state.draft ?? loadExternalDemandDraft()
    if (stored) {
      applyDraft(stored)
      saveExternalDemandDraft(stored)
    }
  }, [state?.error, state?.draft, applyDraft])

  useEffect(() => {
    if (!isOpen) return
    const timer = window.setTimeout(() => {
      saveExternalDemandDraft(collectDraft())
    }, 350)
    return () => window.clearTimeout(timer)
  }, [collectDraft, isOpen])

  useEffect(() => {
    if (state?.success) {
      clearExternalDemandDraft()
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(EXTERNAL_DEMAND_RESTORE_FLAG)
      }
      onSuccess?.()
    }
  }, [state?.success, onSuccess])

  useEffect(() => {
    if (!selectedDealerId) {
      setCameraModels([])
      setCamerasLoading(false)
      return
    }
    let cancelled = false
    setCamerasLoading(true)
    getCameraModelsForDealer(selectedDealerId).then((models) => {
      if (cancelled) return
      setCameraModels(models)
      setCamerasLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedDealerId])

  useEffect(() => {
    if (restoringDraftRef.current) {
      prevDealerIdRef.current = selectedDealerId
      return
    }
    if (prevDealerIdRef.current === null) {
      prevDealerIdRef.current = selectedDealerId
      return
    }
    if (prevDealerIdRef.current !== selectedDealerId) {
      prevDealerIdRef.current = selectedDealerId
      setSelectedCameraId('')
      setCustomCamera('')
      setCameraNameForSubmit('')
    }
  }, [selectedDealerId])

  useEffect(() => {
    if (restoringDraftRef.current) {
      prevSpecialistIdRef.current = assignedSpecialistId
      return
    }
    if (prevSpecialistIdRef.current === null) {
      prevSpecialistIdRef.current = assignedSpecialistId
      return
    }
    if (prevSpecialistIdRef.current !== assignedSpecialistId && scannedBarcodes.length > 0) {
      setScannedBarcodes([])
      setClientError('Specialist changed — re-scan barcodes from that specialist’s field stock.')
    }
    prevSpecialistIdRef.current = assignedSpecialistId
  }, [assignedSpecialistId, scannedBarcodes.length])

  useEffect(() => {
    const unitIds = scannedBarcodes.map((b) => b.cameraModelId).filter(Boolean)
    if (!selectedDealerId || unitIds.length === 0) return

    let cancelled = false
    void suggestExternalDemandCameraModel(selectedDealerId, unitIds).then((result) => {
      if (cancelled || !('ok' in result) || !result.ok) return
      setSelectedCameraId(result.cameraModelId)
      setCustomCamera('')
      setCameraNameForSubmit(result.cameraModelName)
    })
    return () => {
      cancelled = true
    }
  }, [scannedBarcodes, selectedDealerId])

  useEffect(() => {
    if (barcodeModeEnabled && isFutureCustomer) {
      setCompleteOnCreate(true)
    }
  }, [barcodeModeEnabled, isFutureCustomer])

  async function handleSaveInlinePrice() {
    if (!missingPrice) return
    const price = parseFloat(inlinePriceCad)
    if (!Number.isFinite(price) || price < 0) {
      setInlinePriceMessage('Enter a valid price (0 or greater).')
      return
    }
    setInlinePricePending(true)
    setInlinePriceMessage(null)
    const result = await saveDealerInstallationPriceForExternalDemand({
      dealerId: missingPrice.dealerId,
      cameraModelId: missingPrice.cameraModelId,
      priceCad: price,
    })
    setInlinePricePending(false)
    if (result.error) {
      setInlinePriceMessage(result.error)
      return
    }
    setInlinePriceMessage('Price saved — submit again to create the demand.')
    setMissingPrice(null)
    setClientError(null)
  }

  function applyVinDecodeFields(fields: DemandVehicleFieldsFromVin) {
    setVinLast6(fields.vinLast6)
    if (fields.vehicleYear) setVehicleYear(fields.vehicleYear)
    if (fields.selectedMake) {
      setSelectedMake(fields.selectedMake)
      setSelectedTrim(fields.selectedTrim)
      if (fields.selectedModel === '__custom__') {
        setSelectedModel('__custom__')
        setCustomModel(fields.customModel)
      } else if (fields.selectedModel) {
        setSelectedModel(fields.selectedModel)
        setCustomModel('')
      }
    }
  }

  async function addScannedBarcode() {
    const raw = barcodeInput.trim()
    if (!raw) return
    if (scannedBarcodes.some((b) => b.code.toLowerCase() === raw.toLowerCase())) {
      setClientError('This barcode is already in the list.')
      setBarcodeInput('')
      return
    }
    setScanPending(true)
    setClientError(null)
    const preview = await previewExternalDemandBarcode(assignedSpecialistId, raw)
    setScanPending(false)
    if ('error' in preview && preview.error) {
      setClientError(preview.error)
      return
    }
    if ('ok' in preview && preview.ok) {
      setScannedBarcodes((prev) => [
        ...prev,
        { code: preview.code, modelName: preview.modelName, cameraModelId: preview.cameraModelId },
      ])
      setBarcodeInput('')
    }
  }

  const showBarcodeOnComplete = barcodeModeEnabled && completeOnCreate
  const barcodeRequiredOnComplete =
    showBarcodeOnComplete && isBarcodeRequiredForServiceType(serviceType)
  const installationCompletedOnCreate = completeOnCreate && serviceType === 'installation'
  const allowCustomCamera = !installationCompletedOnCreate
  const selectedCatalogCamera = cameraModels.find((c) => c.id === selectedCameraId)
  const submitCameraModelName =
    selectedCameraId === CAMERA_CUSTOM
      ? customCamera
      : selectedCatalogCamera?.name ?? cameraNameForSubmit
  const specialistRequiredForBarcodes =
    showBarcodeOnComplete &&
    (isBarcodeRequiredForServiceType(serviceType) || scannedBarcodes.length > 0)

  const barcodeFields = showBarcodeOnComplete ? (
    <div className="sm:col-span-2 space-y-2 rounded-lg border border-[#C27E00]/30 bg-[#C27E00]/5 p-4">
      <label className="block text-sm font-medium text-zinc-900 dark:text-white">
        Product barcodes{barcodeRequiredOnComplete ? ' *' : ' (optional for transfer)'}
      </label>
      {!assignedSpecialistId && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Select the specialist above — scans must match their field stock.
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addScannedBarcode()
            }
          }}
          autoComplete="off"
          disabled={scanPending || isPending || !assignedSpecialistId}
          placeholder="Scan unit barcode, press Enter…"
          className="flex-1 rounded-md border border-zinc-300 dark:border-gray-700 bg-white dark:bg-black/50 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-white focus:border-[#C27E00] focus:outline-none focus:ring-1 focus:ring-[#C27E00] disabled:opacity-50"
        />
        <button
          type="button"
          disabled={scanPending || isPending || !barcodeInput.trim() || !assignedSpecialistId}
          onClick={() => void addScannedBarcode()}
          className="shrink-0 rounded-md border border-[#C27E00]/50 px-3 py-2 text-sm text-[#C27E00] hover:bg-[#C27E00]/10 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-gray-500">
        {barcodeRequiredOnComplete
          ? 'Required for completed retroactive installs. Scan each unit label (not the set box).'
          : 'Optional for transfer — scan only if you want to consume specialist field stock.'}
      </p>
      {scannedBarcodes.map((b) => (
        <input key={b.code} type="hidden" name="barcodeCodes" value={b.code} />
      ))}
      {scannedBarcodes.length > 0 && (
        <ul className="space-y-1 rounded-md border border-zinc-200 dark:border-gray-800 divide-y divide-zinc-200 dark:divide-gray-800">
          {scannedBarcodes.map((b) => (
            <li
              key={b.code}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm bg-zinc-50 dark:bg-black/30"
            >
              <span>
                <span className="font-mono text-zinc-900 dark:text-white">{b.code}</span>
                <span className="text-zinc-500 ml-2">{b.modelName}</span>
              </span>
              <button
                type="button"
                className="text-xs text-red-400 hover:underline"
                onClick={() => setScannedBarcodes((prev) => prev.filter((x) => x.code !== b.code))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : barcodeModeEnabled && !completeOnCreate ? (
    <p className="sm:col-span-2 text-xs text-zinc-500 dark:text-gray-400">
      Turn on <strong className="text-zinc-700 dark:text-gray-300">Mark as completed on creation</strong> to scan
      product barcodes for this external demand.
    </p>
  ) : null

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault()
        setClientError(null)
        setInlinePriceMessage(null)
        if (barcodeRequiredOnComplete && scannedBarcodes.length === 0) {
          setClientError('Scan at least one product barcode (Enter after each scan).')
          return
        }
        if (specialistRequiredForBarcodes && !assignedSpecialistId) {
          setClientError('Select a specialist — barcodes are taken from their field stock.')
          return
        }
        if (installationCompletedOnCreate && !submitCameraModelName.trim()) {
          setClientError(
            'Select a camera from the dealer list or scan unit barcodes so pricing can match the catalog.'
          )
          return
        }

        const form = e.currentTarget
        const draft = collectDraft()
        saveExternalDemandDraft(draft)
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(EXTERNAL_DEMAND_RESTORE_FLAG, '1')
        }

        const fd = new FormData(form)
        fd.set('draftPayload', JSON.stringify(draft))

        if (
          completeOnCreate &&
          assignedSpecialistId &&
          scannedBarcodes.length > 0
        ) {
          setPricingCheckPending(true)
          const barcodeValidation = await validateExternalDemandBarcodes(
            assignedSpecialistId,
            scannedBarcodes.map((b) => b.code)
          )
          if ('error' in barcodeValidation) {
            setPricingCheckPending(false)
            setClientError(barcodeValidation.error)
            saveExternalDemandDraft(draft)
            applyDraft(draft)
            return
          }
        }

        if (completeOnCreate && serviceType) {
          const preview = await previewExternalDemandCompletionPricing(fd)
          setPricingCheckPending(false)
          if ('error' in preview && preview.error) {
            setClientError(preview.error)
            if ('missingPrice' in preview && preview.missingPrice) {
              setMissingPrice(preview.missingPrice)
            }
            saveExternalDemandDraft(draft)
            applyDraft(draft)
            return
          }
          setMissingPrice(null)
        } else {
          setPricingCheckPending(false)
        }

        startTransition(() => {
          formAction(fd)
        })
      }}
    >
      <div>
        <h2 className="text-lg font-medium text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-gray-800 pb-2">Create External Demand</h2>
        <p className="text-sm text-zinc-500 dark:text-gray-400 mt-1">Date only — no slot. External demands do not affect normal demand slots. Past dates allowed for retroactive entry.</p>
      </div>

      {(state?.error || clientError) && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-md text-sm">
          {clientError ?? state?.error}
        </div>
      )}

      {missingPrice && (
        <div className="rounded-md border border-amber-700/50 bg-amber-950/40 p-4 space-y-3 text-sm">
          <p className="text-amber-100">
            Missing installation price for{' '}
            <strong>
              {missingPrice.dealerName} / {missingPrice.cameraModelName}
            </strong>
            . Enter the dealer price here (same as Inventory → Pricing) without leaving this form.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[8rem]">
              <span className="block text-xs text-amber-200/80 mb-1">Price (CAD)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={inlinePriceCad}
                onChange={(ev) => setInlinePriceCad(ev.target.value)}
                className="w-full rounded-md border border-amber-800/60 bg-black/40 px-3 py-2 text-white"
              />
            </label>
            <button
              type="button"
              disabled={inlinePricePending}
              onClick={() => void handleSaveInlinePrice()}
              className="shrink-0 rounded-md bg-[#C27E00] px-4 py-2 text-white hover:bg-[#a06900] disabled:opacity-50"
            >
              {inlinePricePending ? 'Saving…' : 'Save price'}
            </button>
          </div>
          {inlinePriceMessage && <p className="text-xs text-amber-200">{inlinePriceMessage}</p>}
        </div>
      )}

      {!isFutureCustomer && (
        <DemandDocumentFillButton
          disabled={isPending}
          currentValues={{
            firstName,
            lastName,
            phone,
            vehicleYear,
            stockNumber,
            vinLast6,
            selectedMake,
            selectedModel,
            customModel,
          }}
          setters={{
            setFirstName,
            setLastName,
            setPhone,
            setVehicleYear,
            setStockNumber,
            setVinLast6,
            setSelectedMake,
            setSelectedModel,
            setSelectedTrim,
            setCustomModel,
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Dealer *</label>
          <select
            name="dealerId"
            value={selectedDealerId}
            onChange={(e) => setSelectedDealerId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">-- Select dealer --</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Date *</label>
          <AppointmentCalendar
            timezoneName={dealerTimezone}
            allowPastDates
            selectedPacificYmd={appointmentDate || null}
            onDateSelect={(date) => {
              setAppointmentDate(formatInTimeZone(date, dealerTimezone, 'yyyy-MM-dd'))
            }}
            getTakenSlots={async () => []}
          />
          <input type="hidden" name="appointmentDate" value={appointmentDate} required />
          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-2">
            Calendar uses the selected dealer&apos;s region timezone ({dealerTimezone}). Past dates are allowed.
            Saved as noon on that day in the dealer region so the date does not shift.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">
            Specialist{specialistRequiredForBarcodes ? ' *' : ''}
          </label>
          {specialists.length > 0 ? (
            <select
              name="assignedSpecialistId"
              value={assignedSpecialistId}
              onChange={(e) => setAssignedSpecialistId(e.target.value)}
              required={specialistRequiredForBarcodes}
              className={inputClass}
            >
              <option value="" className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                -- Select specialist --
              </option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                  {s.full_name || 'Unknown'}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" name="assignedSpecialistId" value="" />
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                No specialists in the system — add a specialist user before scanning barcodes on completed external
                demands.
              </p>
            </>
          )}
          {specialistRequiredForBarcodes && (
            <p className="text-xs text-zinc-500 mt-1">
              Required when barcodes are used — stock is consumed from this specialist&apos;s field inventory.
            </p>
          )}
        </div>

        <h3 className="col-span-full text-sm font-medium text-zinc-900 dark:text-white border-t border-zinc-200 dark:border-gray-800 pt-4 mt-4">Customer</h3>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="futureCustomer"
            checked={isFutureCustomer}
            onChange={(e) => setIsFutureCustomer(e.target.checked)}
            className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-0"
          />
          <label htmlFor="futureCustomer" className="text-sm font-medium text-zinc-600 dark:text-gray-300 cursor-pointer">
            Future Customer
          </label>
          <span className="text-xs text-zinc-500 dark:text-gray-500">— When checked, customer info is set to &quot;Future&quot;</span>
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="completeOnCreate"
            checked={completeOnCreate}
            onChange={(e) => setCompleteOnCreate(e.target.checked)}
            className="rounded border-zinc-300 dark:border-gray-600 bg-white dark:bg-black/50 text-[#C27E00] focus:ring-[#C27E00] focus:ring-offset-0"
          />
          <label htmlFor="completeOnCreate" className="text-sm font-medium text-zinc-600 dark:text-gray-300 cursor-pointer">
            Mark as completed on creation
          </label>
          <span className="text-xs text-zinc-500 dark:text-gray-500">— When checked, demand is created directly as completed</span>
        </div>
        {completeOnCreate && <input type="hidden" name="completeOnCreate" value="true" />}
        {completeOnCreate && (
          <div className="sm:col-span-2 space-y-2">
            <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Service type *</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { value: 'installation' as const, hint: 'Dealer camera price (pricing cascade)' },
                  { value: 'transfer' as const, hint: 'Transfer fee (Inventory → Pricing)' },
                  { value: 'removal' as const, hint: 'Removal fee (Inventory → Pricing)' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm ${
                    serviceType === opt.value
                      ? 'border-[#C27E00]/60 bg-[#C27E00]/10'
                      : 'border-zinc-300 dark:border-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="serviceType"
                    value={opt.value}
                    checked={serviceType === opt.value}
                    onChange={() => setServiceType(opt.value)}
                    className="mt-0.5 text-[#C27E00] focus:ring-[#C27E00]"
                  />
                  <span>
                    <span className="block font-medium text-zinc-900 dark:text-white">{SERVICE_TYPE_LABELS[opt.value]}</span>
                    <span className="block text-xs text-zinc-500 dark:text-gray-500">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">First Name *</label>
          <input
            name="firstName"
            required
            value={isFutureCustomer ? 'Future' : firstName}
            readOnly={isFutureCustomer}
            onChange={!isFutureCustomer ? (e) => setFirstName(e.target.value.toUpperCase()) : undefined}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={isFutureCustomer ? '' : undefined}
            style={!isFutureCustomer ? { textTransform: 'uppercase' } : undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Last Name *</label>
          <input
            name="lastName"
            required
            value={isFutureCustomer ? 'Customer' : lastName}
            readOnly={isFutureCustomer}
            onChange={!isFutureCustomer ? (e) => setLastName(e.target.value.toUpperCase()) : undefined}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={isFutureCustomer ? '' : undefined}
            style={!isFutureCustomer ? { textTransform: 'uppercase' } : undefined}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Phone *</label>
          {isFutureCustomer ? (
            <input
              name="phone"
              type="tel"
              required
              value="000 - 000 - 0000"
              readOnly
              className={inputReadOnlyClass}
            />
          ) : (
            <CanadianPhoneInput
              name="phone"
              required
              value={phone}
              onChange={setPhone}
              placeholder="416 - 123 - 4567"
              className={inputClass}
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Address</label>
          <input
            name="address"
            value={isFutureCustomer ? 'Future' : address}
            readOnly={isFutureCustomer}
            onChange={!isFutureCustomer ? (e) => setAddress(e.target.value) : undefined}
            className={isFutureCustomer ? inputReadOnlyClass : inputClass}
            placeholder={!isFutureCustomer ? 'Optional' : undefined}
          />
        </div>

        <h3 className="col-span-full text-sm font-medium text-zinc-900 dark:text-white border-t border-zinc-200 dark:border-gray-800 pt-4 mt-4">Vehicle</h3>
        <VinDecodeField disabled={isPending} onDecoded={applyVinDecodeFields} inputClassName={inputClass} />
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Make *</label>
          <select
            name="vehicleMake"
            value={selectedMake}
            onChange={(e) => {
              setSelectedMake(e.target.value)
              setSelectedModel('')
              setSelectedTrim('')
              setCustomModel('')
            }}
            required
            className={inputClass}
          >
            <option value="">-- Select --</option>
            {VEHICLE_MAKES_CA.map((m) => (
              <option key={m} value={m} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Model *</label>
          {selectedMake ? (
            <div className="space-y-1">
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value)
                  setSelectedTrim('')
                  setCustomModel(e.target.value === '__custom__' ? customModel : '')
                }}
                required={selectedModel !== '__custom__'}
                className={inputClass}
              >
                <option value="">-- Select --</option>
                {getModelsForMake(selectedMake).map((m) => (
                  <option key={m} value={m} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                    {m}
                  </option>
                ))}
                <option value="__custom__" className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                  Other
                </option>
              </select>
              {selectedModel === '__custom__' && (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Model name"
                  required
                  name="vehicleModel"
                  className={inputClass}
                />
              )}
              {selectedModel && selectedModel !== '__custom__' && (
                <>
                  {getTrimsForModel(selectedMake, selectedModel).length > 0 ? (
                    <select
                      value={selectedTrim}
                      onChange={(e) => setSelectedTrim(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">-- Trim (optional) --</option>
                      {getTrimsForModel(selectedMake, selectedModel).map((t) => (
                        <option key={t} value={t} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    type="hidden"
                    name="vehicleModel"
                    value={selectedTrim ? `${selectedModel} (${selectedTrim})` : selectedModel}
                  />
                </>
              )}
            </div>
          ) : (
            <input readOnly placeholder="Select make first" className={`${inputClass} opacity-50 cursor-not-allowed`} />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Year *</label>
          <input name="vehicleYear" type="number" min={1900} max={2100} required value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Stock Number *</label>
          <input name="stockNumber" required value={stockNumber} onChange={(e) => setStockNumber(e.target.value.toUpperCase())} className={inputClass} placeholder="Stock number" style={{ textTransform: 'uppercase' }} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">VIN Last 6 Digits <span className="text-red-400">*</span></label>
          <input
            name="vinLast6"
            required
            minLength={6}
            value={vinLast6}
            onChange={(e) => setVinLast6(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="Last 6 digits"
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        <h3 className="col-span-full text-sm font-medium text-zinc-900 dark:text-white border-t border-zinc-200 dark:border-gray-800 pt-4 mt-4">Camera</h3>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Camera Model *</label>
          {camerasLoading ? (
            <select disabled className={`${inputClass} opacity-70`}>
              <option>Loading dealer cameras…</option>
            </select>
          ) : cameraModels.length > 0 ? (
            <div className="space-y-1">
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  const next = e.target.value
                  setSelectedCameraId(next)
                  setCustomCamera('')
                  if (next && next !== CAMERA_CUSTOM) {
                    const cam = cameraModels.find((c) => c.id === next)
                    setCameraNameForSubmit(cam?.name ?? '')
                  } else {
                    setCameraNameForSubmit('')
                  }
                }}
                required={selectedCameraId !== CAMERA_CUSTOM}
                className={inputClass}
              >
                <option value="">-- Select --</option>
                {cameraModels.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                    {c.label ?? c.name}
                  </option>
                ))}
                {!selectedCatalogCamera &&
                  selectedCameraId &&
                  selectedCameraId !== CAMERA_CUSTOM &&
                  cameraNameForSubmit && (
                    <option value={selectedCameraId} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                      {cameraNameForSubmit} (from scanned units)
                    </option>
                  )}
                {allowCustomCamera && (
                  <option value={CAMERA_CUSTOM} className="bg-white text-zinc-900 dark:bg-black dark:text-white">
                    Other
                  </option>
                )}
              </select>
              {installationCompletedOnCreate && (
                <p className="text-xs text-zinc-500 dark:text-gray-500">
                  Completed installs use dealer catalog pricing — pick a camera from the list or scan unit barcodes to
                  auto-select a set.
                </p>
              )}
              {selectedCameraId === CAMERA_CUSTOM && (
                <input
                  type="text"
                  value={customCamera}
                  onChange={(e) => setCustomCamera(e.target.value)}
                  placeholder="Camera model"
                  required
                  className={inputClass}
                />
              )}
              {submitCameraModelName.trim() && selectedCameraId !== CAMERA_CUSTOM && (
                <>
                  <input type="hidden" name="cameraModel" value={submitCameraModelName} />
                  <input type="hidden" name="cameraModelId" value={selectedCameraId} />
                </>
              )}
              {selectedCameraId === CAMERA_CUSTOM && customCamera.trim() && (
                <input type="hidden" name="cameraModel" value={customCamera} />
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {selectedCameraId && cameraNameForSubmit ? (
                <>
                  <input
                    readOnly
                    value={cameraNameForSubmit}
                    className={`${inputClass} opacity-90`}
                    aria-label="Camera model from scanned units"
                  />
                  <input type="hidden" name="cameraModel" value={cameraNameForSubmit} />
                  <input type="hidden" name="cameraModelId" value={selectedCameraId} />
                </>
              ) : (
                <input
                  name="cameraModel"
                  required
                  value={customCamera}
                  onChange={(e) => setCustomCamera(e.target.value)}
                  className={inputClass}
                  placeholder="Enter camera model"
                />
              )}
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No cameras assigned to this dealer for booking — assign cameras in System Management or scan unit
                barcodes below to infer the set.
              </p>
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300">Comment</label>
          <textarea
            name="comment"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={inputClass}
            placeholder="Optional"
          />
        </div>

        {barcodeFields}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-gray-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-gray-300 hover:text-zinc-900 dark:text-white border border-zinc-300 dark:border-gray-700 rounded-md"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || pricingCheckPending}
          className="px-4 py-2 text-sm font-medium text-white bg-[#C27E00] hover:bg-[#a06900] rounded-md disabled:opacity-50"
        >
          {pricingCheckPending ? 'Checking price…' : isPending ? 'Creating...' : 'Create External Demand'}
        </button>
      </div>
    </form>
  )
}
