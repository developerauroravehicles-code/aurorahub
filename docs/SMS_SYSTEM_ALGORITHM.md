# AuroraHub SMS Sistemi — Algoritma Şeması

Bu doküman, AuroraHub'daki SMS sisteminin tam kapsamlı algoritma ve akış şemasını açıklar.

---

## 1. Genel Mimari

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AURORAHUB SMS SİSTEMİ                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   TRİGGER    │    │ SMS SETTINGS │    │   TWILIO     │    │  SMS LOGS    │   │
│  │   (Olay)     │───▶│  (Ayarlar)   │───▶│   (API)      │───▶│  (Kayıt)     │   │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                                                  │
│  Tetikleyiciler:              Template +          E.164 format              DB   │
│  • Talep Onayı                Placeholder        Twilio API                Log   │
│  • Talep İptal                çözümü             gönderim                  Kayıt │
│  • Randevu Değişikliği                                                          │
│  • 4 Saat Hatırlatma (Cron)                                                      │
│  • Manuel Gönderim                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Veri Akışı Özeti

| Tetikleyici | Mesaj Tipi | Alıcılar | Tetikleyen | Dosya/Kaynak |
|-------------|------------|----------|------------|--------------|
| **Talep Onayı** | `appointment_created` | Customer, Specialist, Aurora Manager | Finance (modal checkbox) | `finance/demands/actions.ts` → `approveDemand` |
| **Talep İptali** | `cancellation_notice` | Customer, Specialist | Finance | `finance/demands/actions.ts` → `cancelDemand` |
| **Randevu Güncelleme** | `rescheduling_notice` | Customer, Specialist | Finance | `finance/demands/actions.ts` → `updateDemand` |
| **4 Saat Önce Hatırlatma** | `four_hour_reminder` | Customer, Specialist | Cron (saatlik) | `api/send-reminders/route.ts` |
| **Manuel Hatırlatma** | `four_hour_reminder` | Specialist (kendine) | Specialist | `specialist/actions.ts` → `sendAppointmentReminderSMS` |
| **Manuel Gönderim** | Herhangi | Customer / Specialist | Aurora Manager | `system-management/sms/actions.ts` → `sendManualSms` |

---

## 3. SMS Tetikleyicileri — Detaylı Akış

### 3.1 Talep Onayı (Appointment Created)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  approveDemand(demandId, sendSMSToCustomer, sendSMSToSpecialist, sendSMSToAM)  │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  1. Yetki: Finance, talebe atanmış olmalı                                        │
│  2. Status: pending_finance                                                      │
│  3. Specialist atama: specialist_dealers → profiles.dealer_id fallback          │
│  4. demands.status = 'approved'                                                  │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │ Customer SMS      │ │ Specialist SMS    │ │ Aurora Manager SMS │
        │                   │ │                   │ │                   │
        │ ac.enabled        │ │ ac.enabled        │ │ ac.enabled        │
        │ sendToCustomer    │ │ sendToSpecialist  │ │ sendToAuroraManager│
        │ sendSMSToCustomer │ │ sendSMSToSpecialist│ │ sendSMSToAM       │
        │ customer_phone    │ │ specialist.phone  │ │ role=aurora_mgr    │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │ Template: appointment_created  │
                        │ {{date}}, {{address}},         │
                        │ {{signature}}                  │
                        │ timezone: dealer → Pacific     │
                        └───────────────────────────────┘
```

**Kontrol matrisi:**

| Koşul | Customer | Specialist | Aurora Manager |
|-------|----------|------------|----------------|
| `ac.enabled` | ✓ | ✓ | ✓ |
| `sendTo*` (ayar) | ✓ | ✓ | ✓ |
| Modal checkbox | ✓ | ✓ | ✓ |
| `*.phone` | `customer_phone` | `profiles.phone` | `profiles.phone` |
| Specialist atanmış | — | Gerekli | — |

---

### 3.2 Talep İptali (Cancellation Notice)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  cancelDemand(demandId)                                                         │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  1. Yetki: Finance, talebe atanmış                                               │
│  2. demands.status = 'cancelled'                                                 │
│  3. 24 saat kontrolü YOK — iptal anında her zaman gönderilir                     │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        ┌───────────────────────┐             ┌───────────────────────┐
        │ Customer               │             │ Specialist             │
        │ cn.sendToCustomer      │             │ cn.sendToSpecialist   │
        │ customer_phone         │             │ assigned_specialist_id │
        └───────────────────────┘             └───────────────────────┘
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │ Template: cancellation_notice │
                        │ {{phone}}, {{signature}}       │
                        │ contactPhone: (604) 833-5801   │
                        └───────────────────────────────┘
```

---

### 3.3 Randevu Güncelleme (Rescheduling Notice)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  updateDemand(demandId, formData)                                               │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  1. Yetki: Finance, talebe atanmış                                               │
│  2. Status: approved                                                             │
│  3. appointment_date değişti mi? oldDate !== newDate                             │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ (sadece tarih değiştiyse)
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        ┌───────────────────────┐             ┌───────────────────────┐
        │ Customer               │             │ Specialist             │
        │ rn.sendToCustomer      │             │ rn.sendToSpecialist     │
        └───────────────────────┘             └───────────────────────┘
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │ Template: rescheduling_notice │
                        │ {{date}}, {{phone}}, {{sign}}  │
                        │ dealer timezone ile format     │
                        └───────────────────────────────┘
```

---

### 3.4 4 Saat Hatırlatma — Otomatik Cron

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  GET /api/send-reminders                                                        │
│  Auth: Authorization: Bearer <CRON_SECRET> veya ?secret=<CRON_SECRET>           │
│  Zamanlama: Her saat başı (0 * * * *) — Vercel Cron                             │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  Aday Talepler:                                                                 │
│  • status = 'approved'                                                          │
│  • appointment_date ∈ [now, now + 7 saat]                                        │
│  • reminder_sent_at IS NULL                                                      │
│  • customer_phone IS NOT NULL                                                     │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  Pencere Filtresi: isWithin4HoursBeforeWindow(appointmentDate)                 │
│  • diffInHours > 3.5  AND  diffInHours <= 4.5                                   │
│  • Örn: 11:00 randevu → 07:00–07:30 arası gönderim                              │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        ┌───────────────────────┐             ┌───────────────────────┐
        │ Customer               │             │ Specialist             │
        │ rh.sendToCustomer      │             │ rh.sendToSpecialist    │
        └───────────────────────┘             └───────────────────────┘
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │ Template: four_hour_reminder  │
                        │ {{hours}} = "4 hours"          │
                        │ {{address}}, {{signature}}    │
                        └───────────────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │ reminder_sent_at = NOW()       │
                        │ (tekrar gönderim engeli)       │
                        └───────────────────────────────┘
```

**Önemli:** Cron, `createAdminClient()` ile service role kullanır; RLS atlanır.

---

### 3.5 Manuel Hatırlatma (Specialist)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  sendAppointmentReminderSMS(demandId) — Specialist Work List                    │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  Yetki: Specialist, talebe atanmış (assigned_specialist_id = user.id)           │
│  rh.enabled = true                                                              │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │ Alıcı: Specialist (kendisi)   │
                        │ profile.phone                 │
                        │ hoursText = gerçek saat farkı │
                        └───────────────────────────────┘
```

---

### 3.6 Manuel Gönderim (Aurora Manager)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  sendManualSms(demandId, messageType, recipient)                                │
│  messageType: appointment_created | cancellation_notice | rescheduling_notice   │
│               | four_hour_reminder                                               │
│  recipient: customer | specialist                                                │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  Yetki: aurora_manager                                                          │
│  trigger.enabled = true                                                         │
│  sendToCustomer / sendToSpecialist (messageType'a göre)                        │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │ recipient = customer          │
                        │   → demand.customer_phone      │
                        │ recipient = specialist        │
                        │   → profiles.phone            │
                        │                               │
                        │ triggered_by: 'manual'        │
                        └───────────────────────────────┘
```

---

## 4. SMS Ayarları (SMSSettings)

**Kaynak:** `system_settings` tablosu, `key = 'sms_settings'`, JSON value.

```typescript
interface SMSSettings {
  appointment_created: SMSTriggerSetting
  cancellation_notice: SMSTriggerSetting
  rescheduling_notice: SMSTriggerSetting
  four_hour_reminder: SMSTriggerSetting
  contactPhone: string
  signature: string
}

interface SMSTriggerSetting {
  enabled: boolean
  sendToCustomer: boolean
  sendToSpecialist?: boolean
  sendToAuroraManager?: boolean  // sadece appointment_created
  template: string
  description?: string
}
```

**Placeholder’lar:**

| Placeholder | Açıklama | Kullanıldığı template’ler |
|-------------|----------|---------------------------|
| `{{date}}` | Randevu tarihi (örn. February 9, 2026 at 2:30 PM) | appointment_created, rescheduling_notice |
| `{{address}}` | Adres | appointment_created, four_hour_reminder |
| `{{hours}}` | Saat (örn. 4 hours) | four_hour_reminder |
| `{{phone}}` | İletişim telefonu | cancellation_notice, rescheduling_notice |
| `{{signature}}` | İmza (örn. Aurora Vehicles.) | Tümü |

---

## 5. Telefon Formatı ve Twilio

```
formatPhoneNumberToE164(phoneNumber, defaultCountryCode?)
  │
  ├── TWILIO_DEFAULT_COUNTRY_CODE (env) veya '1' (US/Canada)
  │
  ├── E.164: +[country][number]
  │   Örn: +15551234567, +905551234567
  │
  └── sendSMS(to, body)
        │
        ├── formatPhoneNumberToE164(to)
        ├── client.messages.create({ body, from, to })
        └── { success, error? }
```

**Mock:** `TWILIO_ACCOUNT_SID` yoksa SMS gönderilmez, `{ success: true, mocked: true }` döner.

---

## 6. Loglama (sms_logs)

Her başarılı SMS gönderiminde `logSmsSent()` çağrılır:

```typescript
interface LogSmsParams {
  phoneNumber: string
  recipientType: 'customer' | 'specialist' | 'aurora_manager'
  recipientName?: string
  demandId?: string
  messageType: 'appointment_created' | 'cancellation_notice' | 'rescheduling_notice' | 'four_hour_reminder'
  triggeredBy: 'system' | 'manual'
  messageContent?: string
}
```

**Tablo:** `sms_logs`
- `sent_at` (otomatik)
- `phone_number`, `recipient_type`, `recipient_name`
- `demand_id`, `message_type`, `triggered_by`, `message_content`

---

## 7. Zaman Dilimi Kuralları

| Bileşen | Zaman Dilimi |
|---------|--------------|
| Sistem varsayılanı | `America/Vancouver` (Pacific) |
| Randevu saklama | Dealer timezone → PT |
| SMS tarih formatı | Dealer timezone veya Pacific |
| Cron reminder penceresi | 3.5h–4.5h (evrensel saat farkı, dealer’dan bağımsız) |

`getEffectiveTimezone(dealerTz)` → dealer ayarlıysa onu, değilse Pacific kullanır.

---

## 8. Karar Ağacı Özeti

```
                    ┌─────────────────────┐
                    │   SMS Gönderim       │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │ Tetikleyici │     │   Ayar      │     │   Veri      │
    │   Uygun mu? │     │ enabled?    │     │   Var mı?   │
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                  │                   │
           └──────────────────┼───────────────────┘
                              │
                    Hepsi EVET ise
                              │
                              ▼
                    ┌─────────────────────┐
                    │   sendSMS()         │
                    │   logSmsSent()      │
                    └─────────────────────┘
```

---

## 9. Dosya Haritası

| Dosya | Rol |
|-------|-----|
| `src/lib/twilio.ts` | E.164 format, `sendSMS()` |
| `src/lib/sms-settings.ts` | Tip tanımları, varsayılan ayarlar |
| `src/lib/sms-resolver.ts` | `getSmsSettings()`, template resolver’lar |
| `src/lib/sms-messages.ts` | Yardımcı fonksiyonlar (isWithin4HoursBeforeWindow vb.) |
| `src/lib/sms-logger.ts` | `logSmsSent()` |
| `src/app/dashboard/finance/demands/actions.ts` | approveDemand, cancelDemand, updateDemand |
| `src/app/api/send-reminders/route.ts` | Cron reminder API |
| `src/app/dashboard/specialist/actions.ts` | Manuel specialist hatırlatma |
| `src/app/dashboard/system-management/sms/actions.ts` | Manuel SMS, log sorguları |

---

## 10. Migration’lar

| Dosya | İçerik |
|-------|--------|
| `add_sms_logs.sql` | `sms_logs` tablosu, `recipient_type` CHECK |
| `add_sms_logs_message_content.sql` | `message_content` kolonu |
| `add_aurora_manager_to_sms_logs_recipient_type.sql` | `aurora_manager` recipient tipi |
| `add_reminder_sent_at.sql` | `demands.reminder_sent_at` (tekrar gönderim engeli) |

---

*Son güncelleme: Şema AuroraHub kod tabanına göre hazırlanmıştır.*
