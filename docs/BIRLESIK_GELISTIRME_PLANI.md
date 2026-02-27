# AuroraHub Birleşik Geliştirme Planı

System Management kategorizasyonu, Logs sekmesi, Mail sender, Raporlama otomasyonları, Gelecek otomasyonlar (Takvim, Kamera-Bayi) tek plan altında toplanmıştır.

---

## 0. System Management Kategorizasyonu ve Logs Sekmesi (Yeni)

### 0.1 Tab kategorileri (önerilen gruplama)

Mevcut yatay tab bar gruplandırılacak. Her grup kendi dropdown veya accordion altında toplanır:

| Kategori | Alt sekmeler | Açıklama |
|---------|--------------|----------|
| **Organizasyon** | User, Dealer, Region, Calendar Management | Kullanıcı, bayi, bölge ve takvim yönetimi |
| **İletişim** | SMS Management | SMS ayarları ve tetikleyiciler |
| **Ürünler** | Camera Models | Kamera modelleri ve bayi atamaları |
| **Sistem** | Database Management, API Management, Logo Management, Mail Ayarları, Automation | Altyapı ve marka |
| **Logs** | SMS Logs, Demand Logs | Tüm sistem loglarının merkezi görüntülemesi |

### 0.2 Kategori UI seçenekleri

**Seçenek A — Dropdown grupları:** Her kategori bir dropdown. Tıklanınca alt sekmeler açılır, seçilince ilgili sayfaya gidilir.

**Seçenek B — İki seviyeli nav:** Üst satırda kategori butonları (Organizasyon, İletişim, …). Seçilen kategorinin altında ikinci satırda o kategoriye ait sekmeler.

**Seçenek C — Sol sidebar + içerik:** Solda kategori listesi (accordion), her kategori açılınca alt öğeler. Sağda içerik alanı.

Öneri: **Seçenek B** — mevcut tek satırlık tab bar'ı korur, kategoriler arası geçiş net olur.

### 0.3 Logs sekmesi yapısı

- **Route:** `/dashboard/system-management/logs` (veya `/logs/sms`, `/logs/demands` alt route'ları)
- **Logs sayfası:** Sol tarafta veya üstte log türü seçimi (SMS Logs, Demand Logs)
- **SMS Logs:** `sms_logs` tablosu — mevcut SMS Management içindeki "SMS Log / Tracking" bölümü burada birleşik görünüm olarak kullanılır veya taşınır
- **Demand Logs:** `demand_logs` tablosu — tüm taleplerin audit trail'i; demand_id, actor, previous_status, new_status, notes, created_at. Filtre: tarih aralığı, demand_id, actor

### 0.4 Dosya değişiklikleri (kategorizasyon + logs)

| Dosya | Değişiklik |
|-------|------------|
| `src/app/dashboard/system-management/system-management-tabs.tsx` | Kategori grupları, iki seviyeli veya dropdown tab yapısı |
| `src/app/dashboard/system-management/logs/page.tsx` | **Yeni** — Logs ana sayfa |
| `src/app/dashboard/system-management/logs/logs-content.tsx` | **Yeni** — SMS Logs / Demand Logs seçici + tablo |
| `src/app/dashboard/system-management/logs/actions.ts` | **Yeni** — getSmsLogs, getDemandLogs (server actions) |
| `src/app/dashboard/system-management/sms/sms-management-content.tsx` | SMS Log bölümü kaldırılabilir veya "Logs sayfasına git" linki eklenir |

### 0.5 Demand Logs veri modeli (mevcut)

```sql
demand_logs: id, demand_id, actor_id, previous_status, new_status, notes, created_at
```

Demand Logs listesinde: demand number (join), actor adı, önceki/yeni status, not, tarih. Filtre: date range, demand number, status değişikliği tipi.

---

## Mevcut Durum (Raporlama & Mail)

- **E-posta:** `src/lib/email.ts` Resend API kullanıyor (`RESEND_API_KEY`). Manuel rapor e-postası `src/app/dashboard/reports/actions.ts` üzerinden gönderiliyor.
- **Raporlama template'leri:** `src/lib/automation-templates.ts` içinde sadece `daily_report_email` ve `weekly_summary` var; parametreler minimal.
- **Edit modal:** `src/app/dashboard/system-management/automation/automation-content.tsx` raporlama template'leri için özel alan göstermiyor; sadece Enabled ve genel params var.

---

## 1. Mail Sender Sistemi (Yeni)

Kullanıcının System Management'tan tanımlayacağı SMTP hesabı ile e-posta gönderimi.

### 1.1 Veri modeli

`system_settings` tablosunda yeni key: `mail_settings`

```typescript
interface MailSettings {
  host: string
  port: number
  secure: boolean
  user: string
  password: string  // encrypted veya plain - Supabase ortamında saklanacak
  fromEmail: string
  fromName: string
  enabled: boolean
}
```

### 1.2 Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `package.json` | `nodemailer` eklenir |
| `src/lib/mail-sender.ts` | **Yeni**: SMTP ile gönderim; `sendEmail({ to, subject, html, attachments? })` |
| `src/app/dashboard/system-management/mail-settings/` | **Yeni**: Mail ayarları sayfası (System Management altında tab veya bölüm) |
| `src/lib/email.ts` | Refactor: `mail_settings` varsa `mail-sender` kullan, yoksa Resend fallback (veya sadece mail-sender) |

### 1.3 UI

- System Management içinde **"Mail Ayarları"** sekmesi veya mevcut bir sekmenin alt bölümü
- Host, port, user, password, from email, from name
- Test e-postası gönder butonu

---

## 2. Raporlama Template Varyasyonları

`src/lib/automation-templates.ts` içinde tüm varyasyonlar için template'ler eklenir.

### 2.1 Boyutlar ve Template ID'ler

| Periyot | Kapsam (Scope) | İçerik Tipi | Örnek Template ID |
|---------|----------------|-------------|--------------------|
| Günlük | Sales | Talep özeti | `daily_report_sales_demands` |
| Günlük | Finance | Talep özeti | `daily_report_finance_demands` |
| Günlük | Admin | Talep özeti (tüm/bayi) | `daily_report_admin_demands` |
| Günlük | Specialist | Randevu listesi | `daily_report_specialist_appointments` |
| Haftalık | Sales | Talep özeti | `weekly_report_sales_demands` |
| Haftalık | Finance | Talep özeti | `weekly_report_finance_demands` |
| Haftalık | Admin | Talep özeti | `weekly_report_admin_demands` |
| Haftalık | Specialist | Tamamlanan işler | `weekly_report_specialist_completed` |
| Aylık | Admin | Özet + kamera/status dağılımı | `monthly_report_admin_summary` |

Tüm kombinasyonlar yerine, en anlamlı olanlar seçilir:

- `daily_report_sales` - Satıcının kendi talepleri, günlük
- `daily_report_finance` - Finance'ın atanan talepleri, günlük
- `daily_report_admin` - Admin tüm talepler (opsiyonel bayi filtresi)
- `daily_report_specialist` - Specialist randevuları, günlük
- `weekly_report_sales`, `weekly_report_finance`, `weekly_report_admin`, `weekly_report_specialist`
- `monthly_report_admin` - Aylık admin özeti

### 2.2 Ortak parametreler (her template için)

```typescript
// Her raporlama template'i için
params: [
  { key: 'scheduleTime', label: 'Gönderim saati', type: 'string', default: '09:00' },  // HH:mm
  { key: 'recipientType', label: 'Alıcı tipi', type: 'select', options: [
    { value: 'aurora_manager', label: 'Aurora Manager' },
    { value: 'role_based', label: 'Rol bazlı (bayi/satış/finance)' },
    { value: 'custom', label: 'Özel e-posta listesi' }
  ], default: 'aurora_manager' },
  { key: 'customEmails', label: 'Özel e-posta adresleri (virgülle)', type: 'string', default: '' },
  { key: 'includePdfAttachment', label: 'PDF ekli gönder', type: 'boolean', default: true }
]
```

Admin template'leri için ek: `{ key: 'dealerId', label: 'Bayi (boşsa tümü)', type: 'string', default: '' }`

### 2.3 Template listesi (önerilen)

| ID | Ad | Açıklama |
|----|-----|----------|
| `daily_report_sales` | Günlük Satış Raporu | Satıcının oluşturduğu talepler, günlük |
| `daily_report_finance` | Günlük Finance Raporu | Finance'ın atanan talepleri |
| `daily_report_admin` | Günlük Admin Raporu | Tüm talepler (ops. bayi filtresi) |
| `daily_report_specialist` | Günlük Specialist Randevuları | Specialist'ın randevuları |
| `weekly_report_sales` | Haftalık Satış Raporu | Satış özeti, haftalık |
| `weekly_report_finance` | Haftalık Finance Raporu | Finance özeti |
| `weekly_report_admin` | Haftalık Admin Raporu | Admin özeti |
| `weekly_report_specialist` | Haftalık Specialist Özeti | Tamamlanan işler |
| `monthly_report_admin` | Aylık Admin Özeti | Kamera/status dağılımı dahil |

---

## 3. Raporlama Template Düzenleme UI

`src/app/dashboard/system-management/automation/automation-content.tsx` içinde, `editingItem.category === 'reporting'` veya `templateId` reporting grubundaysa:

- **Gönderim saati** (time picker veya HH:mm input)
- **Alıcı tipi** (dropdown: Aurora Manager / Rol bazlı / Özel)
- **Özel e-postalar** (textarea, virgülle ayrılmış)
- **PDF ekli** (checkbox)
- Admin template'leri için: **Bayi** dropdown (getDealersAndCameras benzeri getDealers)

---

## 4. Rapor Oluşturma ve Gönderim Mantığı

### 4.1 Rapor verisi hazırlama

Mevcut `src/lib/export-report-pdf.ts` ve report sayfalarındaki veri çekme mantığı kullanılır. Yeni modül:

- `src/lib/report-data-resolver.ts`: scope (sales/finance/admin/specialist), periyot (daily/weekly/monthly), dealerId parametreleri ile uygun talepleri çeker
- `exportReportToPdf` zaten var; bu veriye `ExportReportOptions` formatında beslenecek

### 4.2 Cron / API

- `src/app/api/send-scheduled-reports/route.ts`: GET, `CRON_SECRET` ile korunur
- `vercel.json` cron: günlük 09:00, haftalık Pazartesi 09:00, aylık 1. gün 09:00 (veya tek cron, içeride schedule kontrolü)
- Bu API: `automation_settings`'ten enabled reporting automations'ları alır, `scheduleTime` ve periyoda göre hangilerinin tetikleneceğini belirler, `report-data-resolver` + `export-report-pdf` + `mail-sender` ile gönderir

---

## 5. Gelecek Otomasyonlar (Yeni)

Bu otomasyonlar `src/lib/automation-templates.ts` içinde tanımlı ancak tetikleyici/cron henüz implement edilmedi.

### 5.1 Takvim: Geçmiş Slot Kilitleme (`calendar_past_slots_lock`)

| Özellik | Detay |
|---------|-------|
| Template ID | `calendar_past_slots_lock` |
| Tetikleyici | Scheduled — günlük kontrol veya talep formu yüklenirken |
| Mantık | Bayinin timezone'una göre geçmiş gün ve slotları kilitler; talep formunda seçilemez |
| Veri | `dealers → region_codes → timezones` kullanılır |
| Uygulama | Talep formu `demand-form.tsx` ve `getTakenSlots` / `getDealerBlocksForDate` ile slot filtresi; geçmiş slotları `isPastSlot(dealerTz)` ile eler |

### 5.2 Kamera & Bayi: Düşük Stok Uyarısı (`camera_low_stock_alert`)

| Özellik | Detay |
|---------|-------|
| Template ID | `camera_low_stock_alert` |
| Tetikleyici | Scheduled — cron (günlük veya saatlik) |
| Mantık | `camera_models` veya `dealer_cameras` (bayi-bazlı stok) stoku threshold altına düştüğünde e-posta bildirimi |
| Veri | `camera_models` `stock_quantity`; `dealer_cameras` stok varsa oradan |
| Uygulama | `src/app/api/check-low-stock/route.ts` — cron tetikler; automation_settings'ten enabled + dealerId, cameraModelId, threshold okur; mail-sender ile e-posta |

### 5.3 Kamera & Bayi: Bayi–Kamera Atama Bildirimi (`camera_dealer_assignment_notify`)

| Özellik | Detay |
|---------|-------|
| Template ID | `camera_dealer_assignment_notify` |
| Tetikleyici | Event — `dealer_cameras` insert/delete |
| Mantık | Bayiye kamera atandığında veya kaldırıldığında ilgili kullanıcılara (örn. dealer manager) e-posta/SMS |
| Veri | `assignCameraToDealer`, `removeCameraFromDealer` |
| Uygulama | Bu action'lara hook: `dealer_cameras` değişince `automation_settings`'ten enabled ise mail-sender ile bildirim |

### 5.4 Raporlama Otomasyonları (Bölüm 2–4 ile çakışan)

Raporlama template'leri (daily/weekly/monthly) Bölüm 2–4'te detaylandırıldı. Bunlar "gelecek" statüsünden "implement" statüsüne Bölüm 2–4 tamamlandıkça geçer.

---

## 6. Uygulama Sırası (Birleşik)

| Sıra | Bileşen | Açıklama |
|-----|---------|----------|
| 1 | Kategorizasyon + Logs | system-management-tabs kategorileri, Logs sayfası (SMS Logs, Demand Logs) |
| 2 | Mail Sender | nodemailer, mail-sender.ts, Mail Ayarları sekmesi |
| 3 | Raporlama Template'leri | automation-templates.ts'e 9 rapor template |
| 4 | Raporlama Edit UI | automation-content.tsx reporting param formları |
| 5 | Report Data Resolver | scope/periyot/dealer bazlı veri |
| 6 | Cron Raporlama | send-scheduled-reports API |
| 7 | Geçmiş Slot Kilitleme | calendar_past_slots_lock — talep formunda slot filtresi |
| 8 | Düşük Stok Uyarısı | check-low-stock API + cron |
| 9 | Bayi-Kamera Bildirimi | dealer_cameras hook + mail |

**Akış:**
- Faz 1: Kategorizasyon + Logs → Mail Sender
- Faz 2: Raporlama (Template → Edit UI → Data Resolver → Cron)
- Faz 3: Geçmiş Slot Kilitleme → Düşük Stok → Bayi-Kamera Bildirimi

---

## 7. Özet Dosya Değişiklikleri

**Kategorizasyon ve Logs (Bölüm 0):**
| Dosya | İşlem |
|-------|-------|
| `src/app/dashboard/system-management/system-management-tabs.tsx` | Kategori grupları, iki seviyeli tab |
| `src/app/dashboard/system-management/logs/page.tsx` | Yeni — Logs ana sayfa |
| `src/app/dashboard/system-management/logs/logs-content.tsx` | Yeni — SMS / Demand log listesi |
| `src/app/dashboard/system-management/logs/actions.ts` | Yeni — getSmsLogs, getDemandLogs |

**Raporlama ve Mail (Bölüm 1–4):**
| Dosya | İşlem |
|-------|-------|
| `package.json` | nodemailer ekle |
| `src/lib/mail-sender.ts` | Yeni — SMTP gönderim |
| `src/lib/mail-settings.ts` | Yeni — MailSettings type, get/save |
| `src/app/dashboard/system-management/system-management-tabs.tsx` | Mail sekmesi ekle (Sistem kategorisinde) |
| `src/app/dashboard/system-management/mail-settings/` | Mail ayarları sayfa + içerik |
| `src/lib/automation-templates.ts` | 9 raporlama template ekle, params güncelle |
| `src/app/dashboard/system-management/automation/automation-content.tsx` | Reporting için edit form (saat, alıcı, e-postalar, bayi) |
| `src/lib/report-data-resolver.ts` | Yeni — scope/periyot/dealer bazlı veri |
| `src/app/api/send-scheduled-reports/route.ts` | Yeni — cron tetikleyici |
| `vercel.json` | Cron job(s) ekle |
| `src/lib/email.ts` | mail-sender kullanacak şekilde refactor |

**Gelecek Otomasyonlar (Bölüm 5):**
| Dosya | İşlem |
|-------|-------|
| `src/app/dashboard/sales/demands/new/demand-form.tsx` veya `getTakenSlots` / slot actions | Geçmiş slot filtrelemesi (dealer timezone) |
| `src/app/api/check-low-stock/route.ts` | Yeni — düşük stok kontrolü cron API |
| `src/app/dashboard/system-management/actions.ts` | assignCameraToDealer / removeCameraFromDealer — atama bildirimi hook |
| `vercel.json` | check-low-stock cron ekle (opsiyonel) |

---

## 8. Referans: Birleştirilen Eski Planlar

Bu plan şu bağımsız planları tek dokümanda birleştirir:

- **Raporlama Otomasyonları ve Mail Sistemi** — Mail sender, rapor template'leri, cron
- **automation_categories_and_templates** — Kategori tanımları, şablon–kategori eşlemesi
- **automation_tab_system_management** — Automation sekmesi yapısı, veri modeli
- **System Management Kategorizasyonu + Logs** — Tab grupları, Logs sekmesi (SMS, Demand)
- **Gelecek Otomasyonlar** — calendar_past_slots_lock, camera_low_stock_alert, camera_dealer_assignment_notify
