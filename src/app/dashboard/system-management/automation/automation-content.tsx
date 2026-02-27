'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  getAutomationSettings,
  saveAutomation,
  addAutomation,
  removeAutomation,
  saveSmsTriggerContent,
  getDealersAndCameras,
  getReportPreviewData,
  type AutomationItem,
} from './actions'
import {
  AUTOMATION_TEMPLATES,
  AUTOMATION_CATEGORIES,
  getTemplateById,
  getSmsTriggerForTemplate,
  type TemplateId,
  type AutomationCategory,
} from '@/lib/automation-templates'
import { SMS_PLACEHOLDERS } from '@/lib/sms-settings'
import { Clock, MousePointerClick, MessageSquare, Plus, Pencil, Trash2, FileText, Calendar, Camera, Info, Eye } from 'lucide-react'
import { ReportPreviewModal } from '@/components/report-preview-modal'
import type { ExportReportOptions } from '@/lib/export-report-pdf'

export function AutomationContent() {
  const [automations, setAutomations] = useState<AutomationItem[]>([])
  const [smsSettings, setSmsSettings] = useState<import('@/lib/sms-settings').SMSSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    enabled: boolean
    params: Record<string, unknown>
    smsContent?: { template: string; sendToCustomer: boolean; sendToSpecialist: boolean; sendToAuroraManager?: boolean }
  } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addTemplateId, setAddTemplateId] = useState<TemplateId | ''>('')
  const [addParams, setAddParams] = useState<Record<string, unknown>>({})
  const [addDealers, setAddDealers] = useState<{ id: string; name: string; code: string }[]>([])
  const [addCameras, setAddCameras] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [dealers, setDealers] = useState<{ id: string; name: string; code: string }[]>([])
  const [cameras, setCameras] = useState<{ id: string; name: string }[]>([])
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false)
  const [reportPreviewOptions, setReportPreviewOptions] = useState<ExportReportOptions | null>(null)
  const [reportPreviewLoading, setReportPreviewLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await getAutomationSettings()
    setLoading(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
      return
    }
    setAutomations(res.automations)
    if (res.smsSettings) setSmsSettings(res.smsSettings)
  }

  useEffect(() => {
    load()
  }, [])

  const isReportingTemplate = (id: string) =>
    ['daily_report_email', 'weekly_summary', 'daily_report_sales', 'daily_report_finance', 'daily_report_admin', 'daily_report_specialist', 'weekly_report_sales', 'weekly_report_finance', 'weekly_report_admin', 'weekly_report_specialist', 'monthly_report_admin'].includes(id)
  const isAdminReportingTemplate = (id: string) =>
    ['daily_report_admin', 'weekly_report_admin', 'monthly_report_admin'].includes(id)

  const openEdit = async (item: AutomationItem) => {
    setEditingId(item.id)
    if (item.templateId === 'camera_low_stock_alert' || isReportingTemplate(item.templateId)) {
      const res = await getDealersAndCameras()
      if (res.dealers) setDealers(res.dealers)
      if (res.cameras) setCameras(res.cameras)
    }
    const triggerKey = getSmsTriggerForTemplate(item.templateId)
    const smsContent =
      smsSettings && triggerKey
        ? {
            template: smsSettings[triggerKey].template,
            sendToCustomer: smsSettings[triggerKey].sendToCustomer,
            sendToSpecialist: smsSettings[triggerKey].sendToSpecialist ?? false,
            sendToAuroraManager: (smsSettings[triggerKey] as { sendToAuroraManager?: boolean }).sendToAuroraManager ?? false,
          }
        : undefined
    setEditForm({
      enabled: item.enabled,
      params: { ...item.params },
      smsContent,
    })
  }

  const closeEdit = () => {
    setEditingId(null)
    setEditForm(null)
  }

  const handleReportPreview = async (item: AutomationItem) => {
    if (!isReportingTemplate(item.templateId)) return
    setReportPreviewLoading(true)
    setMessage(null)
    const res = await getReportPreviewData(item.templateId, item.params)
    setReportPreviewLoading(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
      return
    }
    if (res.options) {
      setReportPreviewOptions(res.options)
      setReportPreviewOpen(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editForm) return
    const editingItem = automations.find((a) => a.id === editingId)
    if (!editingItem) return
    setSaving(true)
    setMessage(null)
    const params = { ...editForm.params }
    if (editForm.smsContent && ['sms_reminder_4h', 'sms_reminder_24h'].includes(editingItem.templateId)) {
      params.sendToCustomer = editForm.smsContent.sendToCustomer
      params.sendToSpecialist = editForm.smsContent.sendToSpecialist
    }
    const res = await saveAutomation(editingId, {
      enabled: editForm.enabled,
      params,
    })
    if (!res.success) {
      setSaving(false)
      setMessage({ type: 'error', text: res.error ?? 'Failed to save' })
      return
    }
    if (editForm.smsContent) {
      const triggerKey = getSmsTriggerForTemplate(editingItem.templateId)
      if (triggerKey) {
        const smsRes = await saveSmsTriggerContent(triggerKey, {
          template: editForm.smsContent.template,
          sendToCustomer: editForm.smsContent.sendToCustomer,
          sendToSpecialist: editForm.smsContent.sendToSpecialist,
          ...(editingItem.templateId === 'sms_appointment_created' && {
            sendToAuroraManager: editForm.smsContent.sendToAuroraManager,
          }),
        })
        if (!smsRes.success) {
          setSaving(false)
          setMessage({ type: 'error', text: smsRes.error ?? 'Failed to save SMS content' })
          return
        }
      }
    }
    setSaving(false)
    setMessage({ type: 'success', text: 'Automation updated' })
    closeEdit()
    load()
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this automation?')) return
    setRemovingId(id)
    setMessage(null)
    const res = await removeAutomation(id)
    setRemovingId(null)
    if (res.success) {
      setMessage({ type: 'success', text: 'Automation removed' })
      load()
    } else {
      setMessage({ type: 'error', text: res.error ?? 'Failed to remove' })
    }
  }

  const handleAdd = async () => {
    if (!addTemplateId) {
      setMessage({ type: 'error', text: 'Select a template' })
      return
    }
    const template = getTemplateById(addTemplateId as TemplateId)
    if (!template || template.type === 'event') {
      setMessage({ type: 'error', text: 'Event automations are built-in. Use SMS Management.' })
      return
    }
    setSaving(true)
    setMessage(null)
    const res = await addAutomation(addTemplateId as TemplateId, addParams)
    setSaving(false)
    if (res.success) {
      setMessage({ type: 'success', text: 'Automation added' })
      setShowAddModal(false)
      setAddTemplateId('')
      setAddParams({})
      load()
    } else {
      setMessage({ type: 'error', text: res.error ?? 'Failed to add' })
    }
  }

  const addableTemplates = AUTOMATION_TEMPLATES.filter(
    (t) => t.type === 'scheduled' && !automations.some((a) => a.templateId === t.id)
  )
  const editingItem = editingId ? automations.find((a) => a.id === editingId) : null

  const categoriesOrder: AutomationCategory[] = ['sms', 'reporting', 'calendar', 'camera_dealer']
  const automationsByCategory = categoriesOrder.map((cat) => ({
    category: cat,
    items: automations.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0)

  const categoryIcons: Record<AutomationCategory, React.ComponentType<{ className?: string }>> = {
    sms: MessageSquare,
    reporting: FileText,
    calendar: Calendar,
    camera_dealer: Camera,
  }

  if (loading) {
    return (
      <div className="text-gray-400 py-8 text-center">
        Loading automations...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Automation</h3>
        <p className="text-sm text-gray-400 mb-4">
          View, edit, and add automated tasks. Scheduled tasks run on a cron (e.g. hourly).
          Event-triggered tasks run when you perform an action (e.g. approve demand).
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-800 text-green-200'
              : 'bg-red-900/50 border border-red-800 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add new automation */}
      {addableTemplates.length > 0 && (
        <div className="bg-[#C27E00]/10 border border-[#C27E00]/30 rounded-lg p-4">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 text-[#C27E00] hover:text-[#d99500] font-medium"
          >
            <Plus className="w-5 h-5" />
            Add New Automation
          </button>
        </div>
      )}

      {/* Automation list - grouped by category */}
      <div className="space-y-8">
        {automationsByCategory.map(({ category, items }) => {
          const CatIcon = categoryIcons[category]
          const catInfo = AUTOMATION_CATEGORIES[category]
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2 text-gray-300">
                <CatIcon className="w-5 h-5 text-[#C27E00]" />
                <h4 className="font-semibold">{catInfo.name}</h4>
              </div>
              <div className="space-y-4">
                {items.map((item) => (
          <div
            key={item.id}
            className="bg-black/30 rounded-lg border border-gray-800 p-4 flex items-start justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                {item.type === 'scheduled' ? (
                  <Clock className="w-5 h-5 text-[#C27E00] shrink-0" />
                ) : (
                  <MousePointerClick className="w-5 h-5 text-blue-400 shrink-0" />
                )}
                <span className="font-medium text-white">{item.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    item.enabled ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {item.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {item.description && (
                <p className="text-sm text-gray-400 ml-8">{item.description}</p>
              )}
              {item.type === 'scheduled' && item.params?.hoursBefore != null && (
                <p className="text-sm text-gray-500 ml-8 mt-1">
                  Sent {String(item.params.hoursBefore)} hours before appointment
                </p>
              )}
              {item.templateId === 'camera_low_stock_alert' && (
                <p className="text-sm text-gray-500 ml-8 mt-1">
                  Threshold: {String(item.params?.threshold ?? 5)} items • Dealer and camera model configurable
                </p>
              )}
              {isReportingTemplate(item.templateId) && (
                <p className="text-sm text-gray-500 ml-8 mt-1">
                  Time: {String(item.params?.scheduleTime ?? '09:00')} • Recipient: {String(item.params?.recipientType ?? 'aurora_manager')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.smsSettingKey && (
                <Link
                  href="/dashboard/system-management/sms"
                  className="text-sm text-[#C27E00] hover:underline flex items-center gap-1"
                >
                  <MessageSquare className="w-4 h-4" />
                  SMS Settings
                </Link>
              )}
              {isReportingTemplate(item.templateId) && (
                <button
                  type="button"
                  onClick={() => handleReportPreview(item)}
                  disabled={reportPreviewLoading}
                  className="p-2 text-gray-400 hover:text-[#C27E00] hover:bg-white/5 rounded transition-colors disabled:opacity-50"
                  title="Report preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {!item.builtIn && (
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  disabled={removingId === item.id}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {editingId && editForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-lg w-full p-6 shadow-xl my-8">
            <h4 className="text-lg font-semibold text-white mb-4">Edit Automation</h4>
            {editingItem && (
              <>
                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.enabled}
                      onChange={(e) =>
                        setEditForm((f) => f && { ...f, enabled: e.target.checked })
                      }
                      className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                    />
                    <span className="text-sm text-gray-300">Enabled</span>
                  </label>

                  {editForm.smsContent && (
                    <>
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2">Recipients</p>
                        <div className="flex flex-wrap gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.smsContent.sendToCustomer}
                              onChange={(e) =>
                                setEditForm((f) =>
                                  f?.smsContent
                                    ? { ...f, smsContent: { ...f.smsContent, sendToCustomer: e.target.checked } }
                                    : f
                                )
                              }
                              className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                            />
                            <span className="text-sm text-gray-300">Customer</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.smsContent.sendToSpecialist}
                              onChange={(e) =>
                                setEditForm((f) =>
                                  f?.smsContent
                                    ? { ...f, smsContent: { ...f.smsContent, sendToSpecialist: e.target.checked } }
                                    : f
                                )
                              }
                              className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                            />
                            <span className="text-sm text-gray-300">Specialist</span>
                          </label>
                          {editingItem.templateId === 'sms_appointment_created' && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.smsContent.sendToAuroraManager ?? false}
                                onChange={(e) =>
                                  setEditForm((f) =>
                                    f?.smsContent
                                      ? { ...f, smsContent: { ...f.smsContent, sendToAuroraManager: e.target.checked } }
                                      : f
                                  )
                                }
                                className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                              />
                              <span className="text-sm text-gray-300">Aurora Manager</span>
                            </label>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Message template</label>
                        <textarea
                          value={editForm.smsContent.template}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f?.smsContent
                                ? { ...f, smsContent: { ...f.smsContent, template: e.target.value } }
                                : f
                            )
                          }
                          rows={6}
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-[#C27E00] focus:border-[#C27E00]"
                          placeholder="Message template..."
                        />
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                          {Object.entries(SMS_PLACEHOLDERS).slice(0, 4).map(([ph, desc]) => (
                            <span key={ph} title={desc}>
                              <code className="text-[#C27E00]">{ph}</code>
                            </span>
                          ))}
                          <Link
                            href="/dashboard/system-management/sms"
                            className="text-[#C27E00] hover:underline flex items-center gap-1"
                          >
                            <Info className="w-3 h-3" />
                            All placeholders
                          </Link>
                        </div>
                      </div>
                    </>
                  )}

                  {isReportingTemplate(editingItem.templateId) && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Send time (HH:mm)</label>
                        <input
                          type="text"
                          value={String(editForm.params?.scheduleTime ?? '09:00')}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f ? { ...f, params: { ...f.params, scheduleTime: e.target.value } } : null
                            )
                          }
                          placeholder="09:00"
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Recipient type</label>
                        <select
                          value={String(editForm.params?.recipientType ?? 'aurora_manager')}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f ? { ...f, params: { ...f.params, recipientType: e.target.value } } : null
                            )
                          }
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        >
                          <option value="aurora_manager">Aurora Manager</option>
                          <option value="role_based">Role based (dealer/sales/finance)</option>
                          <option value="custom">Custom email list</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Custom email addresses (comma-separated)</label>
                        <input
                          type="text"
                          value={String(editForm.params?.customEmails ?? '')}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f ? { ...f, params: { ...f.params, customEmails: e.target.value } } : null
                            )
                          }
                          placeholder="a@x.com, b@y.com"
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(editForm.params?.includePdfAttachment ?? true)}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f ? { ...f, params: { ...f.params, includePdfAttachment: e.target.checked } } : null
                            )
                          }
                          className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                        />
                        <span className="text-sm text-gray-300">Send with PDF attachment</span>
                      </label>
                      {isAdminReportingTemplate(editingItem.templateId) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Dealer (all if empty)</label>
                          <select
                            value={String(editForm.params?.dealerId ?? '')}
                            onChange={(e) =>
                              setEditForm((f) =>
                                f ? { ...f, params: { ...f.params, dealerId: e.target.value } } : null
                              )
                            }
                            className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                          >
                            <option value="">-- All dealers --</option>
                            {dealers.map((d) => (
                              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editingItem) return
                          setReportPreviewLoading(true)
                          setMessage(null)
                          const res = await getReportPreviewData(editingItem.templateId, editForm.params)
                          setReportPreviewLoading(false)
                          if (res.error) {
                            setMessage({ type: 'error', text: res.error })
                            return
                          }
                          if (res.options) {
                            setReportPreviewOptions(res.options)
                            setReportPreviewOpen(true)
                          }
                        }}
                        disabled={reportPreviewLoading}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white/5 border border-gray-600 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                      >
                        <Eye className="w-4 h-4" />
                        {reportPreviewLoading ? 'Loading...' : 'Preview'}
                      </button>
                    </div>
                  )}

                  {editingItem.templateId === 'camera_low_stock_alert' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Dealer</label>
                        <select
                          value={String(editForm.params?.dealerId ?? '')}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f
                                ? { ...f, params: { ...f.params, dealerId: e.target.value } }
                                : null
                            )
                          }
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        >
                          <option value="">-- Select dealer --</option>
                          {dealers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.code})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Camera model</label>
                        <select
                          value={String(editForm.params?.cameraModelId ?? '')}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f
                                ? { ...f, params: { ...f.params, cameraModelId: e.target.value } }
                                : null
                            )
                          }
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        >
                          <option value="">-- Select camera model --</option>
                          {cameras.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Threshold (stock count)</label>
                        <input
                          type="number"
                          min={0}
                          value={Number(editForm.params?.threshold ?? 5)}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f
                                ? { ...f, params: { ...f.params, threshold: Number(e.target.value) || 0 } }
                                : null
                            )
                          }
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Alert is sent when stock falls below this number
                        </p>
                      </div>
                    </div>
                  )}

                  {editingItem.type === 'scheduled' && editingItem.params?.hoursBefore !== undefined && (() => {
                    const template = getTemplateById(editingItem.templateId)
                    const hoursParam = template?.params.find((p) => p.key === 'hoursBefore')
                    const options = hoursParam?.type === 'select' && hoursParam.options
                      ? hoursParam.options
                      : [{ value: 2, label: '2 hours' }, { value: 4, label: '4 hours' }, { value: 6, label: '6 hours' }]
                    const defaultHours = hoursParam?.default ?? 4
                    return (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Hours before appointment to send
                        </label>
                        <select
                          value={String(editForm.params?.hoursBefore ?? defaultHours)}
                          onChange={(e) =>
                            setEditForm((f) =>
                              f
                                ? {
                                    ...f,
                                    params: {
                                      ...f.params,
                                      hoursBefore: Number(e.target.value),
                                    },
                                  }
                                : null
                            )
                          }
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        >
                          {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })()}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="px-4 py-2 text-gray-300 hover:text-white border border-gray-600 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-white mb-4">Add Automation</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Template
                </label>
                <select
                  value={addTemplateId}
                  onChange={async (e) => {
                    const v = e.target.value as TemplateId | ''
                    setAddTemplateId(v)
                    const t = getTemplateById(v as TemplateId)
                    setAddParams(t ? { ...Object.fromEntries(t.params.map((p) => [p.key, p.default])) } : {})
                    if (v === 'camera_low_stock_alert' || isReportingTemplate(v)) {
                      const res = await getDealersAndCameras()
                      if (res.dealers) setAddDealers(res.dealers)
                      if (res.cameras) setAddCameras(res.cameras)
                    }
                  }}
                  className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                >
                  <option value="">-- Select template --</option>
                  {categoriesOrder.map((cat) => {
                    const templates = addableTemplates.filter((t) => t.category === cat)
                    if (templates.length === 0) return null
                    return (
                      <optgroup key={cat} label={AUTOMATION_CATEGORIES[cat].name}>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </div>

              {addTemplateId && addableTemplates.some((t) => t.id === addTemplateId) && (
                <>
                  {(addTemplateId === 'sms_reminder_4h' || addTemplateId === 'sms_reminder_24h') && (
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(addParams.sendToCustomer ?? true)}
                          onChange={(e) =>
                            setAddParams((p) => ({ ...p, sendToCustomer: e.target.checked }))
                          }
                          className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                        />
                        <span className="text-sm text-gray-300">Send to customer</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(addParams.sendToSpecialist ?? true)}
                          onChange={(e) =>
                            setAddParams((p) => ({ ...p, sendToSpecialist: e.target.checked }))
                          }
                          className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                        />
                        <span className="text-sm text-gray-300">Send to specialist</span>
                      </label>
                    </div>
                  )}
                  {addTemplateId === 'sms_reminder_24h' && (
                    <p className="text-xs text-gray-500">
                      Note: 24-hour reminder requires daily cron. Currently only 4-hour reminder works with hourly cron.
                    </p>
                  )}
                  {addTemplateId && addableTemplates.some((t) => t.id === addTemplateId) && isReportingTemplate(addTemplateId) && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Send time (HH:mm)</label>
                        <input
                          type="text"
                          value={String(addParams.scheduleTime ?? '09:00')}
                          onChange={(e) => setAddParams((p) => ({ ...p, scheduleTime: e.target.value }))}
                          placeholder="09:00"
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Recipient type</label>
                        <select
                          value={String(addParams.recipientType ?? 'aurora_manager')}
                          onChange={(e) => setAddParams((p) => ({ ...p, recipientType: e.target.value }))}
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        >
                          <option value="aurora_manager">Aurora Manager</option>
                          <option value="role_based">Role based</option>
                          <option value="custom">Custom email list</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Custom email addresses (comma-separated)</label>
                        <input
                          type="text"
                          value={String(addParams.customEmails ?? '')}
                          onChange={(e) => setAddParams((p) => ({ ...p, customEmails: e.target.value }))}
                          placeholder="a@x.com, b@y.com"
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(addParams.includePdfAttachment ?? true)}
                          onChange={(e) => setAddParams((p) => ({ ...p, includePdfAttachment: e.target.checked }))}
                          className="rounded border-gray-600 bg-black/50 text-[#C27E00] focus:ring-[#C27E00]"
                        />
                        <span className="text-sm text-gray-300">Send with PDF attachment</span>
                      </label>
                      {addTemplateId && isAdminReportingTemplate(addTemplateId) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Dealer (all if empty)</label>
                          <select
                            value={String(addParams.dealerId ?? '')}
                            onChange={(e) => setAddParams((p) => ({ ...p, dealerId: e.target.value }))}
                            className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                          >
                            <option value="">-- All dealers --</option>
                            {addDealers.map((d) => (
                              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                  {addTemplateId === 'camera_low_stock_alert' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Dealer</label>
                        <select
                          value={String(addParams.dealerId ?? '')}
                          onChange={(e) => setAddParams((p) => ({ ...p, dealerId: e.target.value }))}
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        >
                          <option value="">-- Select dealer --</option>
                          {addDealers.map((d) => (
                            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Camera model</label>
                        <select
                          value={String(addParams.cameraModelId ?? '')}
                          onChange={(e) => setAddParams((p) => ({ ...p, cameraModelId: e.target.value }))}
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        >
                          <option value="">-- Select camera model --</option>
                          {addCameras.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Threshold (stock count)</label>
                        <input
                          type="number"
                          min={0}
                          value={Number(addParams.threshold ?? 5)}
                          onChange={(e) => setAddParams((p) => ({ ...p, threshold: Number(e.target.value) || 0 }))}
                          className="w-full border border-gray-700 bg-black/50 text-white rounded px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  setAddTemplateId('')
                  setAddParams({})
                }}
                className="px-4 py-2 text-gray-300 hover:text-white border border-gray-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !addTemplateId}
                className="px-4 py-2 bg-[#C27E00] hover:bg-[#a06900] text-white rounded font-medium disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportPreviewModal
        isOpen={reportPreviewOpen}
        onClose={() => {
          setReportPreviewOpen(false)
          setReportPreviewOptions(null)
        }}
        reportOptions={reportPreviewOptions}
      />
    </div>
  )
}
