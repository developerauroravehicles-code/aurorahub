# SMS Gönderim Dokümantasyonu

Bu dokümantasyon, AuroraHub sisteminde SMS gönderimlerinin ne zaman, hangi şartlarda ve kime gönderildiğini detaylı olarak açıklar.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [SMS Mesaj Tipleri](#sms-mesaj-tipleri)
3. [SMS Gönderim Senaryoları](#sms-gönderim-senaryoları)
4. [SMS Mesaj Formatı](#sms-mesaj-formatı)
5. [Teknik Detaylar](#teknik-detaylar)
6. [Hata Yönetimi](#hata-yönetimi)

---

## Genel Bakış

AuroraHub sisteminde SMS gönderimleri **Twilio** servisi üzerinden yapılmaktadır. SMS gönderimleri belirli durumlarda ve kullanıcı onayı ile gerçekleşir.

### SMS Gönderim Noktaları

1. **Finance Approve İşlemi** (Appointment Created mesajı)
2. **Demand Cancellation** (Cancellation/Rescheduling Notice mesajı)
3. **Demand Rescheduling** (Cancellation/Rescheduling Notice mesajı)
4. **4-Hour Reminder** (Otomatik hatırlatma - Cron Job)
5. **Specialist Appointment Alerts** (4-Hour Reminder formatı - Yarınki randevular için)

## SMS Mesaj Tipleri

Sistemde 3 farklı SMS mesaj tipi kullanılmaktadır:

### 1. Appointment Created
**Ne Zaman:** Finance kullanıcısı bir demand'i approve ettiğinde  
**Alıcı:** Customer ve Specialist  
**Format:**
```
Appointment Created

A dashcam installation appointment has been scheduled for [Date] at [Address].

Aurora Vehicles.
```

### 2. Cancellation / Rescheduling Notice
**Ne Zaman:** 
- Demand iptal edildiğinde VE randevu 24 saat içindeyse
- Demand yeniden planlandığında VE eski randevu 24 saat içindeyse

**Alıcı:** Customer  
**Format:**
```
Cancellation / Rescheduling Notice

For cancellation or rescheduling requests within the last 24 hours prior to your appointment, please contact us at (604) 833-5801.
```

### 3. 4-Hour Reminder
**Ne Zaman:** 
- Randevudan 4 saat önce (Cron Job ile otomatik)
- Specialist dashboard'unda yarınki randevular için (manuel tetikleme)

**Alıcı:** Customer (cron job) veya Specialist (dashboard alert)  
**Format:**
```
4-Hour Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in 4 hours at [Address].

Aurora Vehicles.
```

---

## SMS Gönderim Senaryoları

### 1. Finance Approve İşlemi

**Dosya:** `src/app/dashboard/finance/demands/actions.ts`  
**Fonksiyon:** `approveDemand()`

#### Ne Zaman Gönderilir?

Finance kullanıcısı bir demand'i approve ettiğinde, onay modal'ında seçilen seçeneklere göre SMS gönderilir.

#### Şartlar ve Kontroller

**Customer SMS Gönderimi:**
- ✅ Finance kullanıcısı "Send appointment information to customer via SMS" checkbox'ını işaretlediğinde
- ✅ Demand'in `customer_phone` alanı dolu olduğunda
- ✅ Demand başarıyla `approved` status'üne güncellendiğinde

**Specialist SMS Gönderimi:**
- ✅ Finance kullanıcısı "Send information to Specialist" checkbox'ını işaretlediğinde (varsayılan: işaretli ve kilitli)
- ✅ Demand otomatik olarak dealer'daki specialist'e assign edildiğinde veya zaten assign edilmiş specialist varsa
- ✅ Specialist'in `phone` alanı dolu olduğunda
- ✅ Demand başarıyla `approved` status'üne güncellendiğinde

#### Otomatik İşlemler

1. **Specialist Auto-Assignment:**
   - Approve edildiğinde, eğer demand'de `assigned_specialist_id` yoksa
   - Sistem otomatik olarak demand'in `dealer_id`'sine göre specialist arar
   - İlk bulunan specialist'e otomatik assign edilir
   - Bu işlem SMS gönderiminden önce yapılır

2. **SMS Gönderim Sırası:**
   - Önce customer'a SMS gönderilir (eğer seçildiyse)
   - Sonra specialist'e SMS gönderilir (eğer seçildiyse ve specialist varsa)
   - Her iki SMS de aynı mesaj içeriğini kullanır

#### Mesaj İçeriği

```
An appointment has been created for [Tarih] at [Adres]. Aurora Vehicles.
```

**Örnek:**
```
An appointment has been created for February 20, 2026 at 02:00 PM at Applewood Kia Surrey. Aurora Vehicles.
```

#### Modal Yapısı

Finance kullanıcısı "Approve" butonuna tıkladığında bir modal açılır:

1. **"Are you sure you want to approve this demand?"** (Zorunlu)
   - Kullanıcı bu checkbox'ı işaretlemeden approve edemez

2. **"Send appointment information to customer via SMS"** (Opsiyonel)
   - Varsayılan: İşaretli
   - Kullanıcı isterse kaldırabilir

3. **"Send information to Specialist"** (Opsiyonel, Kilitli)
   - Varsayılan: İşaretli ve kilitli (disabled)
   - Kullanıcı değiştiremez
   - Otomatik assign edileceği için her zaman işaretli kalır
   - Helper text: "(Will be auto-assigned to dealer's specialist)"

---

### 2. Demand Cancellation (İptal Bildirimi)

**Dosya:** `src/app/dashboard/finance/demands/actions.ts`  
**Fonksiyon:** `cancelDemand()`

#### Ne Zaman Gönderilir?

Finance kullanıcısı bir demand'i iptal ettiğinde, eğer randevu **24 saat içindeyse** otomatik olarak SMS gönderilir.

#### Şartlar ve Kontroller

- ✅ Demand başarıyla `cancelled` status'üne güncellendiğinde
- ✅ Randevu tarihi **24 saat içinde** olduğunda
- ✅ Demand'in `customer_phone` alanı dolu olduğunda

#### Mesaj İçeriği

**Format:** Cancellation / Rescheduling Notice

```
Cancellation / Rescheduling Notice

For cancellation or rescheduling requests within the last 24 hours prior to your appointment, please contact us at (604) 833-5801.
```

### 3. Demand Rescheduling (Yeniden Planlama Bildirimi)

**Dosya:** `src/app/dashboard/finance/demands/actions.ts`  
**Fonksiyon:** `updateDemand()`

#### Ne Zaman Gönderilir?

Finance kullanıcısı bir demand'in randevu tarihini değiştirdiğinde, eğer **eski randevu tarihi 24 saat içindeyse** otomatik olarak SMS gönderilir.

#### Şartlar ve Kontroller

- ✅ Demand başarıyla güncellendiğinde
- ✅ Randevu tarihi değiştiğinde
- ✅ Eski randevu tarihi **24 saat içinde** olduğunda
- ✅ Demand'in `customer_phone` alanı dolu olduğunda

#### Mesaj İçeriği

**Format:** Cancellation / Rescheduling Notice (aynı mesaj)

```
Cancellation / Rescheduling Notice

For cancellation or rescheduling requests within the last 24 hours prior to your appointment, please contact us at (604) 833-5801.
```

### 4. 4-Hour Reminder (Otomatik Hatırlatma - Cron Job)

**Dosya:** `src/app/api/send-reminders/route.ts`  
**Cron Schedule:** Her saat başı (`0 * * * *`)

#### Ne Zaman Gönderilir?

Vercel Cron Job her saat başı çalışır ve **randevudan 4 saat önce** olan tüm approved demand'ler için SMS gönderir.

#### Şartlar ve Kontroller

- ✅ Demand status'ü `approved` olduğunda
- ✅ Randevu tarihi **4 saat içinde** olduğunda
- ✅ Demand'in `customer_phone` alanı dolu olduğunda
- ✅ Randevu tarihi geçmişte değilse

#### Otomatik İşlem

- Vercel Cron Job her saat başı `/api/send-reminders` endpoint'ini çağırır
- Endpoint tüm approved demand'leri kontrol eder
- 4 saat içindeki randevular için SMS gönderilir
- Her randevu için sadece bir kez SMS gönderilir (cron job her saat çalıştığı için)

#### Mesaj İçeriği

**Format:** 4-Hour Reminder

```
4-Hour Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in 4 hours at [Adres].

Aurora Vehicles.
```

**Örnek:**
```
4-Hour Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in 4 hours at Applewood Kia Surrey.

Aurora Vehicles.
```

### 5. Specialist Appointment Alerts (Yarınki Randevular)

**Dosya:** `src/app/dashboard/specialist/appointment-alerts.tsx`  
**Fonksiyon:** `sendAppointmentReminderSMS()` (via `src/app/dashboard/specialist/actions.ts`)

#### Ne Zaman Gönderilir?

Specialist dashboard'unda randevu uyarı tablosu görüntülendiğinde, **yarınki randevular** için otomatik olarak SMS gönderilir.

#### Şartlar ve Kontroller

- ✅ Randevu tarihi **bugünden 1 gün sonra** (tomorrow) olduğunda
- ✅ Demand'in `assigned_specialist_id` mevcut kullanıcıya ait olduğunda
- ✅ Specialist'in `phone` alanı dolu olduğunda
- ✅ SMS daha önce gönderilmemişse (her randevu için sadece bir kez)

#### Otomatik İşlem

- Component mount olduğunda veya appointments listesi değiştiğinde
- `useEffect` hook'u ile otomatik kontrol edilir
- Yarınki randevular için SMS gönderilir
- Gönderilen SMS'ler `sentSMS` state'inde tutulur (tekrar gönderim önlenir)

#### Mesaj İçeriği

**Format:** 4-Hour Reminder (aynı format, specialist'e gönderilir)

```
4-Hour Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in 4 hours at [Adres].

Aurora Vehicles.
```

**Not:** Bu mesaj 4-Hour Reminder formatındadır, ancak specialist'e gönderilir ve yarınki randevular için tetiklenir.

---

## SMS Mesaj Formatı

### 1. Appointment Created Format

```
Appointment Created

A dashcam installation appointment has been scheduled for [Tarih] at [Adres].

Aurora Vehicles.
```

**Tarih Formatı:**
- **Format:** `MMMM dd, yyyy 'at' HH:mm`
- **Örnek:** `February 20, 2026 at 02:00 PM`

**Adres Önceliği:**
1. `demand.customer_address` (varsa)
2. `dealer.address` (varsa)
3. `dealer.name` (varsa)
4. `'Authorized Dealer'` (fallback)

### 2. Cancellation / Rescheduling Notice Format

```
Cancellation / Rescheduling Notice

For cancellation or rescheduling requests within the last 24 hours prior to your appointment, please contact us at (604) 833-5801.
```

**Not:** Bu mesaj sabit bir formattadır, değişken içermez.

### 3. 4-Hour Reminder Format

```
4-Hour Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in 4 hours at [Adres].

Aurora Vehicles.
```

**Adres Önceliği:**
1. `demand.customer_address` (varsa)
2. `'the specified location'` (fallback)

---

## Teknik Detaylar

### SMS Gönderim Fonksiyonu

**Dosya:** `src/lib/twilio.ts`  
**Fonksiyon:** `sendSMS(to: string, body: string)`

#### Özellikler

- Telefon numarasını E.164 formatına dönüştürür
- Twilio API üzerinden SMS gönderir
- Hata durumunda log kaydı tutar
- SMS gönderim hatası approve işlemini etkilemez (non-blocking)

#### Telefon Numarası Formatı

- E.164 formatı kullanılır: `+[country code][number]`
- Örnek: `+15551234567` (Canada/USA) veya `+905551234567` (Turkey)
- Varsayılan country code: `TWILIO_DEFAULT_COUNTRY_CODE` env variable'dan alınır

### Environment Variables

```env
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=your-twilio-number
TWILIO_DEFAULT_COUNTRY_CODE=1  # Optional: 1 for Canada/USA, 90 for Turkey, etc.
```

---

## Hata Yönetimi

### SMS Gönderim Hataları

1. **Customer SMS Hatası:**
   - SMS gönderiminde hata olsa bile approve işlemi başarılı sayılır
   - Hata console'a loglanır
   - Kullanıcıya hata mesajı gösterilmez

2. **Specialist SMS Hatası:**
   - SMS gönderiminde hata olsa bile approve işlemi başarılı sayılır
   - Hata console'a loglanır
   - Kullanıcıya hata mesajı gösterilmez

3. **Appointment Alert SMS Hatası:**
   - SMS gönderiminde hata olsa bile component render edilmeye devam eder
   - Hata console'a loglanır
   - Kullanıcıya hata mesajı gösterilmez

### Hata Senaryoları

- ❌ Twilio credentials eksik
- ❌ Telefon numarası geçersiz format
- ❌ Telefon numarası boş
- ❌ Twilio API hatası
- ❌ Network hatası

**Tüm hatalar non-blocking'dir** - SMS gönderim hatası ana işlemi (approve, alert) etkilemez.

---

## SMS Gönderim Akış Şeması

### Finance Approve Akışı

```
1. Finance kullanıcısı "Approve" butonuna tıklar
   ↓
2. Approve Confirmation Modal açılır
   ↓
3. Kullanıcı onayları:
   - ✅ Approve confirmation (zorunlu)
   - ✅ Customer SMS (opsiyonel, varsayılan: işaretli)
   - ✅ Specialist SMS (opsiyonel, varsayılan: işaretli, kilitli)
   ↓
4. "Approve" butonuna tıklar
   ↓
5. approveDemand() fonksiyonu çalışır:
   a. Demand status'ü 'approved' olarak güncellenir
   b. Eğer specialist yoksa, dealer'dan specialist bulunur ve assign edilir
   c. Customer SMS gönderilir (Appointment Created formatı, eğer seçildiyse)
   d. Specialist SMS gönderilir (Appointment Created formatı, eğer seçildiyse ve specialist varsa)
   ↓
6. Sayfa refresh edilir
```

### Demand Cancellation Akışı

```
1. Finance kullanıcısı "Cancel" butonuna tıklar
   ↓
2. cancelDemand() fonksiyonu çalışır:
   a. Demand status'ü 'cancelled' olarak güncellenir
   b. Randevu tarihi kontrol edilir (24 saat içinde mi?)
   c. Eğer 24 saat içindeyse, Cancellation Notice SMS gönderilir
   ↓
3. Sayfa refresh edilir
```

### Demand Rescheduling Akışı

```
1. Finance kullanıcısı "Edit" butonuna tıklar
   ↓
2. EditDemandModal açılır
   ↓
3. Randevu tarihi değiştirilir ve form gönderilir
   ↓
4. updateDemand() fonksiyonu çalışır:
   a. Demand güncellenir
   b. Eski randevu tarihi kontrol edilir (24 saat içinde mi?)
   c. Eğer eski tarih 24 saat içindeyse, Cancellation Notice SMS gönderilir
   ↓
5. Sayfa refresh edilir
```

### 4-Hour Reminder Cron Job Akışı

```
1. Vercel Cron Job her saat başı tetiklenir (0 * * * *)
   ↓
2. /api/send-reminders endpoint'i çağrılır
   ↓
3. Tüm approved demand'ler sorgulanır:
   a. Status = 'approved'
   b. Appointment date >= now
   c. Appointment date <= now + 4 hours
   d. Customer phone is not null
   ↓
4. Her demand için:
   a. 4 saat içinde mi kontrol edilir
   b. 4-Hour Reminder SMS gönderilir
   c. Sonuç loglanır
   ↓
5. JSON response döner (sent count, error count)
```

### Specialist Appointment Alert Akışı

```
1. Specialist dashboard yüklenir
   ↓
2. AppointmentAlerts component render edilir
   ↓
3. useEffect hook çalışır:
   a. Yarınki randevular filtrelenir
   b. Daha önce SMS gönderilmemiş randevular bulunur
   c. Her randevu için sendAppointmentReminderSMS() çağrılır
   d. Başarılı gönderimler sentSMS state'ine eklenir
   ↓
4. SMS gönderilir (4-Hour Reminder formatı, her randevu için sadece bir kez)
```

---

## Özet Tablo

| Senaryo | Tetikleyici | Alıcı | Mesaj Tipi | Şartlar | Varsayılan Durum |
|---------|------------|-------|------------|---------|------------------|
| **Finance Approve** | Finance kullanıcısı approve eder | Customer | Appointment Created | Checkbox işaretli + customer_phone var | ✅ İşaretli |
| **Finance Approve** | Finance kullanıcısı approve eder | Specialist | Appointment Created | Checkbox işaretli + specialist assign edilmiş + specialist phone var | ✅ İşaretli (Kilitli) |
| **Demand Cancellation** | Finance kullanıcısı cancel eder | Customer | Cancellation Notice | Randevu 24 saat içinde + customer_phone var | 🔄 Otomatik |
| **Demand Rescheduling** | Finance kullanıcısı randevu tarihini değiştirir | Customer | Cancellation Notice | Eski randevu 24 saat içinde + customer_phone var | 🔄 Otomatik |
| **4-Hour Reminder** | Vercel Cron Job (her saat başı) | Customer | 4-Hour Reminder | Randevu 4 saat içinde + status approved + customer_phone var | 🔄 Otomatik |
| **Specialist Alert** | Specialist dashboard yüklenir | Specialist | 4-Hour Reminder | Randevu yarın + specialist assign edilmiş + daha önce gönderilmemiş | 🔄 Otomatik |

---

## Notlar

1. **Talep Oluşturma:** Talep oluşturulduğunda SMS gönderilmez. SMS sadece finance approve ettiğinde gönderilir.

2. **Otomatik Assignment:** Approve edildiğinde, eğer demand'de specialist yoksa, sistem otomatik olarak dealer'daki specialist'i bulur ve assign eder.

3. **SMS Mesaj Formatları:** Artık 3 farklı mesaj formatı kullanılmaktadır:
   - **Appointment Created:** Finance approve ettiğinde
   - **Cancellation Notice:** İptal veya yeniden planlama (24 saat içindeyse)
   - **4-Hour Reminder:** Randevudan 4 saat önce (cron job) veya yarınki randevular (specialist alert)

4. **24 Saat Kuralı:** Cancellation/Rescheduling notice sadece randevu 24 saat içindeyse gönderilir.

5. **4 Saat Hatırlatma:** Cron job her saat başı çalışır ve 4 saat içindeki randevular için otomatik hatırlatma gönderir.

6. **Non-Blocking:** SMS gönderim hataları ana işlemleri (approve, cancel, update) etkilemez.

7. **Tekrar Gönderim Önleme:** Specialist appointment alert SMS'leri her randevu için sadece bir kez gönderilir.

8. **Cron Job Güvenliği:** `/api/send-reminders` endpoint'i `CRON_SECRET` environment variable ile korunur.

---

## Son Güncelleme

**Tarih:** 2026-02-20  
**Versiyon:** 2.0  
**Son Değişiklikler:**
- SMS mesaj formatları güncellendi (3 yeni format)
- Appointment Created formatı eklendi
- Cancellation/Rescheduling Notice formatı eklendi
- 4-Hour Reminder formatı eklendi
- Cancellation SMS gönderimi eklendi (24 saat içindeyse)
- Rescheduling SMS gönderimi eklendi (24 saat içindeyse)
- 4-Hour Reminder cron job eklendi (her saat başı)
- Specialist appointment alert mesaj formatı güncellendi (4-Hour Reminder formatı)

