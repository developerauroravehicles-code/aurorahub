# SMS Gönderim Dokümantasyonu

Bu dokümantasyon, AuroraHub sisteminde SMS gönderimlerinin ne zaman, hangi şartlarda ve kime gönderildiğini detaylı olarak açıklar.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [SMS Gönderim Senaryoları](#sms-gönderim-senaryoları)
3. [SMS Mesaj Formatı](#sms-mesaj-formatı)
4. [Teknik Detaylar](#teknik-detaylar)
5. [Hata Yönetimi](#hata-yönetimi)

---

## Genel Bakış

AuroraHub sisteminde SMS gönderimleri **Twilio** servisi üzerinden yapılmaktadır. SMS gönderimleri sadece belirli durumlarda ve kullanıcı onayı ile gerçekleşir.

### SMS Gönderim Noktaları

1. **Finance Approve İşlemi** (Ana SMS Gönderim Noktası)
2. **Specialist Appointment Alerts** (Otomatik Hatırlatma)

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

### 2. Specialist Appointment Alerts (Otomatik Hatırlatma)

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

```
An appointment has been created for [Tarih] at [Adres]. Aurora Vehicles.
```

**Örnek:**
```
An appointment has been created for February 20, 2026 at 02:00 PM at Applewood Kia Surrey. Aurora Vehicles.
```

**Not:** Bu mesaj customer SMS'i ile aynı formattadır.

---

## SMS Mesaj Formatı

### Standart Format

```
An appointment has been created for [Tarih] at [Adres]. Aurora Vehicles.
```

### Tarih Formatı

- **Format:** `MMMM dd, yyyy 'at' HH:mm`
- **Örnek:** `February 20, 2026 at 02:00 PM`

### Adres Önceliği

1. `demand.customer_address` (varsa)
2. `dealer.address` (varsa)
3. `dealer.name` (varsa)
4. `'Authorized Dealer'` (fallback)

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
   c. Customer SMS gönderilir (eğer seçildiyse)
   d. Specialist SMS gönderilir (eğer seçildiyse ve specialist varsa)
   ↓
6. Sayfa refresh edilir
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
4. SMS gönderilir (her randevu için sadece bir kez)
```

---

## Özet Tablo

| Senaryo | Tetikleyici | Alıcı | Şartlar | Varsayılan Durum |
|---------|------------|-------|---------|------------------|
| **Finance Approve** | Finance kullanıcısı approve eder | Customer | Checkbox işaretli + customer_phone var | ✅ İşaretli |
| **Finance Approve** | Finance kullanıcısı approve eder | Specialist | Checkbox işaretli + specialist assign edildi + specialist phone var | ✅ İşaretli (Kilitli) |
| **Appointment Alert** | Specialist dashboard yüklenir | Specialist | Randevu yarın + specialist assign edilmiş + daha önce gönderilmemiş | 🔄 Otomatik |

---

## Notlar

1. **Talep Oluşturma:** Talep oluşturulduğunda SMS gönderilmez. SMS sadece finance approve ettiğinde gönderilir.

2. **Otomatik Assignment:** Approve edildiğinde, eğer demand'de specialist yoksa, sistem otomatik olarak dealer'daki specialist'i bulur ve assign eder.

3. **SMS Mesajı:** Tüm SMS'ler aynı formatta gönderilir (customer ve specialist için aynı mesaj).

4. **Non-Blocking:** SMS gönderim hataları ana işlemleri (approve, alert) etkilemez.

5. **Tekrar Gönderim Önleme:** Appointment alert SMS'leri her randevu için sadece bir kez gönderilir.

---

## Son Güncelleme

**Tarih:** 2026-02-20  
**Versiyon:** 1.0  
**Son Değişiklikler:**
- Finance approve sırasında SMS gönderimi eklendi
- Specialist'e otomatik SMS gönderimi eklendi
- Appointment alert otomatik SMS gönderimi eklendi
- Talep oluşturma sırasında SMS gönderimi kaldırıldı

