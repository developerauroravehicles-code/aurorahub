# AuroraHub — Workflow Akış Şemaları

> Görsel referans dosyası. Sistem koduna müdahale etmez.  
> Mermaid diyagramları GitHub, VS Code veya [mermaid.live](https://mermaid.live) ile görüntülenebilir.

---

## 1. Demand (Talep) Yaşam Döngüsü

### Akış şeması

```mermaid
flowchart TD
    subgraph CREATE["Oluşturma"]
        A1[Sales veya Finance<br/>Yeni demand formu] --> A2{Validasyon<br/>slot / stock / VIN}
        A2 -->|Hata| A1
        A2 -->|OK| A3[(demands<br/>status: pending_finance)]
    end

    subgraph FINANCE["Finance Onayı"]
        A3 --> B1[Finance kuyruğu<br/>/finance/demands]
        B1 --> B2{Karar}
        B2 -->|Atama| B3[assigned_finance_id]
        B3 --> B1
        B2 -->|İptal| B4[(status: cancelled)]
        B2 -->|Onay| B5[Specialist atanır<br/>specialist_dealers]
        B5 --> B6[(status: approved)]
        B2 -->|Geri al| A3
    end

    subgraph SPECIALIST["Kurulum"]
        B6 --> C1[Specialist iş listesi<br/>/specialist/work]
        C1 --> C2{İş al / devam}
        C2 --> C3[Kurulum tamamla<br/>service_type + fiyat]
        C3 --> C4[(status: completed<br/>completed_at)]
    end

    subgraph POST["Tamamlama sonrası"]
        C4 --> D1[Daily invoice batch'e ekle<br/>PT tarihine göre]
        C4 --> D2[Invoice alanları doldurulabilir]
        C4 --> D3[Webhook: appointment_completed]
    end

    subgraph EXTERNAL["Harici / Admin"]
        E1[Aurora Manager<br/>External demand] --> E2{Complete on create?}
        E2 -->|Evet| C4
        E2 -->|Hayır| A3
    end

    style A3 fill:#fef3c7
    style B6 fill:#dbeafe
    style C4 fill:#dcfce7
    style B4 fill:#fee2e2
```

### Adım tablosu

| Adım | Durum | Aktör | Aksiyon | Route / Dosya |
|:----:|-------|-------|---------|---------------|
| 1 | `pending_finance` | Sales / Finance | Demand oluştur | `/dashboard/sales/demands/new`, `/dashboard/finance/demands/new` |
| 2 | `pending_finance` | Finance | Kendine ata | `finance/demands/actions.ts` |
| 3 | `approved` | Finance | Onayla + specialist ata | `/dashboard/finance/demands` |
| 4 | `approved` | Specialist | İşi al / tamamla | `/dashboard/specialist/work` |
| 5 | `completed` | Specialist | Kurulum bitir | `specialist/work/actions.ts` → `addDemandToDailyBatch` |
| — | `cancelled` | Finance | İptal | SMS + webhook |
| — | `pending_finance` | Finance | Onayı geri al | `revertDemandToPending` |
| — | `completed` | Aurora Manager | Harici demand | `/dashboard/admin/demands` (external) |

### Otomatik hatırlatmalar (Cron)

| Zamanlama | API | Açıklama |
|-----------|-----|----------|
| Saatlik | `/api/send-reminders` | Onaylı randevulara 24s / 4s SMS hatırlatması |

---

## 2. Daily Invoice Workflow

### Akış şeması

```mermaid
flowchart TD
    START[Demand completed] --> SYNC[addDemandToDailyBatch<br/>dealer + PT batch_date]
    SYNC --> BATCH[(dealer_daily_invoice_batches<br/>+ batch_items)]

    BATCH --> PAGE[Daily Invoices sayfası<br/>syncDailyBatchesForPtDate]
    PAGE --> REVIEW[Aurora Manager inceleme<br/>include / exclude / edit]

    CRON1{21:00 PT<br/>Cron} --> NOTIFY[notifyDailyInvoiceReview]
    NOTIFY --> NOTIF1[(comm_notifications<br/>daily_invoice_review)]

    REVIEW --> EDIT[Invoice detay<br/>Approve = Save + Drive + onay]
    EDIT --> APPROVED[(invoice_approved_at)]

    REVIEW --> MANUAL{Manuel Send?}
    MANUAL -->|Evet| SEND1[sendDealerDailyBatchInvoices<br/>dealer e-postaları + PDF]
    APPROVED --> CRON2{08:30 PT<br/>Cron — dünün batch'i}
    CRON2 --> SEND2[Auto-send<br/>approvedOnly: true]

    SEND1 --> SENT[(batch status: sent<br/>sent_at)]
    SEND2 --> SENT
    SEND2 -->|Hata| FAIL[(daily_invoice_send_failed<br/>bildirim)]

    SENT --> ROW[Tablo satır status: Sent]
    SENT --> INV[Invoice sekmesi<br/>realtime sync]

    style SENT fill:#dcfce7
    style FAIL fill:#fee2e2
    style APPROVED fill:#dbeafe
```

### Adım tablosu

| Adım | Aktör | Koşul | Sonuç | Route / Dosya |
|:----:|-------|-------|-------|---------------|
| 1 | Sistem | Demand `completed` | Batch item eklenir | `daily-dealer-invoices.ts` |
| 2 | Aurora Manager | Sayfa açılışı | Eksik item'lar senkronize | `/dashboard/admin/daily-invoices` |
| 3 | Cron (21:00 PT) | Batch var | İnceleme bildirimi | `/api/daily-invoice-review-notify` |
| 4 | Aurora Manager | Invoice düzenle | Approve → kaydet + Drive + onay | `/dashboard/admin/invoices/[id]?return=...` |
| 5 | Aurora Manager | Manuel Send | Toplu PDF e-posta | `daily-invoices/actions.ts` |
| 6 | Cron (08:30 PT) | Önceki PT günü, onaylı | Otomatik gönderim | `/api/daily-invoice-auto-send` |
| 7 | Sistem | Gönderim OK | Batch `sent`, satırlar **Sent** | `send-dealer-daily-batch-invoices.ts` |

### Cron tablosu

| Schedule (UTC cron) | Route | Etkin saat (PT) | İşlev |
|---------------------|-------|-----------------|-------|
| `0 * * * *` | `/api/daily-invoice-review-notify` | 21:00 | İnceleme bildirimi |
| `30 * * * *` | `/api/daily-invoice-auto-send` | 08:30 | Dünün onaylı batch'lerini gönder |

---

## 3. Invoice (Düz Fatura) Workflow

### Akış şeması

```mermaid
flowchart TD
    COMP[(Demand completed)] --> LIST[Invoice listesi<br/>/admin/invoices]
    LIST --> OPEN[Invoice detay / Preview]

    OPEN --> MENU{⋮ Menü}
    MENU --> EMAIL[E-posta gönder]
    MENU --> DL[PDF indir<br/>invoice_downloaded_at]

    OPEN --> APPROVE{Approve<br/>Aurora Manager}

    APPROVE --> S1[Save — invoice_saved_at]
    S1 --> S2[approveInvoiceAction<br/>invoice_approved_at]
    S2 --> S3[Drive upload<br/>invoice_drive_uploaded_at]
    S3 --> RET{return param?}
    RET -->|Evet| BACK[Daily Invoices'a dön]
    RET -->|Hayır| REF[Sayfa yenile]

    S3 --> RT[Realtime UPDATE<br/>Invoice tablosu sync]

    subgraph STATUS["Invoice tablo status"]
        ST1[Waiting] --> ST2[Edited]
        ST2 --> ST3[Saved to Drive]
    end

    style S1 fill:#fef3c7
    style S2 fill:#dbeafe
    style S3 fill:#dcfce7
```

### Adım tablosu

| Adım | Aktör | Aksiyon | DB alanı | Yetki |
|:----:|-------|---------|----------|-------|
| 1 | AM / GM | Listele / filtrele | — | AM: tüm dealer, GM: kendi dealer |
| 2 | Aurora Manager | Alan düzenle + kaydet | `invoice_saved_at` | AM only |
| 3 | Aurora Manager | Approve (tek tık) | Save + `invoice_approved_at` + Drive | AM only |
| 4 | AM / GM | PDF indir | `invoice_downloaded_at` | AM + GM |
| 5 | Aurora Manager | E-posta (⋮ menü) | mail log | AM only |
| 6 | Aurora Manager | Drive (Approve içinde otomatik) | `invoice_drive_uploaded_at` | AM only |

---

## 4. Statement Workflow

### Akış şeması

```mermaid
flowchart TD
    A[Statement sayfası<br/>/admin/statements] --> B[Dealer + tarih aralığı seç]
    B --> C[getStatementDataAction<br/>completed demands]
    C --> D[Önizleme / PDF oluştur]

    D --> E{Eylem}
    E --> F[PDF indir]
    E --> G[Drive yükle<br/>Aurora Manager]
    E --> H[E-posta gönder<br/>AM veya GM]

    style G fill:#dcfce7
    style H fill:#dbeafe
```

### Adım tablosu

| Adım | Aktör | Aksiyon | Yetki |
|:----:|-------|---------|-------|
| 1 | AM / GM | Dealer ve dönem filtrele | GM: kendi dealer kilitli |
| 2 | AM / GM | Statement verisi yükle | Tamamlanmış demand'ler |
| 3 | AM / GM | PDF önizle / indir | Her ikisi |
| 4 | Aurora Manager | Google Drive'a yükle | AM only |
| 5 | AM / GM | E-posta ile gönder | Her ikisi |

---

## 5. Bildirim (Notification) Workflow

### Akış şeması

```mermaid
flowchart TD
    subgraph SOURCES["Bildirim kaynakları"]
        S1[Chat mesajı]
        S2[Meet davet / başlangıç]
        S3[SMS gönderilemedi]
        S4[Daily invoice review — 21:00 PT]
        S5[Daily invoice send failed — 08:30 PT]
    end

    SOURCES --> DB[(comm_notifications)]
    DB --> RT[Supabase Realtime]
    RT --> BELL[Dashboard zili + sidebar badge]
    RT --> PAGE[/communication/notifications]

    BELL --> CLICK{Tıkla}
    PAGE --> CLICK
    CLICK --> DEL[deleteNotificationAction]
    DEL --> NAV[İlgili sayfaya git<br/>chat / meet / daily-invoices]

    style DEL fill:#fee2e2
    style NAV fill:#dcfce7
```

### Bildirim türleri tablosu

| Tür | Tetikleyici | Hedef kullanıcı | Yönlendirme |
|-----|-------------|-----------------|-------------|
| `chat_message` | Yeni mesaj | Konuşma üyeleri | `/communication/chat?c=...` |
| `mention` | Bahsetme | İlgili kullanıcı | Chat |
| `meet_invite` | Davet | Davetliler | Meet odası (yeni sekme) |
| `meet_started` | Meet başladı | Katılımcılar | Meet odası |
| `sms_pending` | SMS hatası | Aurora Manager | Notifications |
| `daily_invoice_review` | 21:00 PT cron | Aurora Manager | Daily Invoices link |
| `daily_invoice_send_failed` | Auto-send hata | Aurora Manager | Daily Invoices link |

---

## 6. Rol & Yetki Workflow (Özet)

### Akış şeması

```mermaid
flowchart LR
    LOGIN[Giriş / Supabase Auth] --> MW[Middleware<br/>session kontrol]
    MW --> ROLE{Rol?}

    ROLE -->|sales| R1[Sales dashboard]
    ROLE -->|finance| R2[Finance dashboard]
    ROLE -->|specialist| R3[Work list]
    ROLE -->|general_manager| R4[GM dashboard]
    ROLE -->|inventory_manager| R5[Dealer-scoped admin]
    ROLE -->|aurora_manager| R6[Platform admin]
    ROLE -->|hr| R7[HR modülü]
    ROLE -->|it| R8[IT / sistem yönetimi]

    R6 --> AM_OPS[Demands, Invoice, Daily Invoice,<br/>Inventory, Employees, Config]
    R4 --> GM_OPS[Dealer Invoice, Statement, Reports]

    style R6 fill:#fef3c7
    style R8 fill:#dbeafe
```

### Rol — yetki matrisi (özet)

| Yetenek | Sales | Finance | Specialist | GM | Inv. Mgr | Aurora Mgr | HR | IT |
|---------|:-----:|:-------:|:----------:|:--:|:--------:|:------------:|:--:|:--:|
| Demand oluştur | ✓ | ✓ | — | — | — | External | — | — |
| Demand onayla | — | ✓ | — | — | — | Override | — | — |
| Kurulum tamamla | — | — | ✓ | — | — | — | — | — |
| Invoice düzenle / onayla | — | — | — | Görüntüle | — | ✓ | — | — |
| Daily invoice | — | — | — | — | — | ✓ | — | — |
| Statement | — | — | — | ✓ | — | ✓ | — | — |
| Platform config | — | — | — | — | — | ✓ | — | ✓ |
| Communication | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 7. Entegrasyon & Otomasyon Workflow

### Akış şeması

```mermaid
flowchart TD
    subgraph EVENTS["Olaylar"]
        E1[Demand created]
        E2[Demand approved]
        E3[Demand completed]
        E4[Low stock]
    end

    EVENTS --> WH[Webhook dispatch]
    EVENTS --> SMS[Twilio SMS]
    EVENTS --> MAIL[E-posta servisi]
    EVENTS --> DRIVE[Google Drive API]

    CRON[Cron jobs<br/>vercel.json] --> REM[Hatırlatma SMS]
    CRON --> RPT[Zamanlanmış raporlar]
    CRON --> STOCK[Stok uyarısı]
    CRON --> ALERT[Alert dispatch]
    CRON --> DI1[Daily invoice review]
    CRON --> DI2[Daily invoice auto-send]
```

### Cron tablosu (tüm sistem)

| Schedule | Route | Açıklama |
|----------|-------|----------|
| `0 * * * *` | `/api/send-reminders` | Randevu SMS hatırlatmaları |
| `0 * * * *` | `/api/send-scheduled-reports` | Zamanlanmış rapor e-postaları |
| `0 9 * * *` | `/api/check-low-stock` | Düşük stok kontrolü |
| `*/15 * * * *` | `/api/run-alerts` | Alert kuralları |
| `0 * * * *` | `/api/daily-invoice-review-notify` | 21:00 PT — daily invoice inceleme |
| `30 * * * *` | `/api/daily-invoice-auto-send` | 08:30 PT — otomatik gönderim |

---

*Son güncelleme: AuroraHub mevcut kod tabanına göre hazırlanmıştır.*
