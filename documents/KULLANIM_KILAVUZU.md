# AuroraHub - Kapsamlı Kullanım Kılavuzu

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Sistem Rolleri ve Yetkileri](#sistem-rolleri-ve-yetkileri)
3. [Giriş Sistemi](#giriş-sistemi)
4. [Dashboard Özellikleri](#dashboard-özellikleri)
5. [Talep (Demand) Yönetimi](#talep-demand-yönetimi)
6. [Randevu Sistemi](#randevu-sistemi)
7. [SMS Bildirimleri](#sms-bildirimleri)
8. [Raporlar](#raporlar)
9. [Çalışan Yönetimi](#çalışan-yönetimi)
10. [Sistem Yönetimi](#sistem-yönetimi)
11. [Teknik Özellikler](#teknik-özellikler)

---

## Genel Bakış

**AuroraHub**, dashcam kurulum randevularını yönetmek için tasarlanmış kapsamlı bir randevu ve talep yönetim sistemidir. Sistem, çoklu dealer yapısı, rol tabanlı erişim kontrolü, otomatik SMS bildirimleri ve zaman dilimi desteği ile donatılmıştır.

### Temel Özellikler

- ✅ **Rol Tabanlı Erişim Kontrolü**: 5 farklı kullanıcı rolü (Sales, Finance, Specialist, General Manager, Aurora Manager)
- ✅ **Çoklu Dealer Desteği**: Her dealer için bağımsız yönetim
- ✅ **Randevu Yönetimi**: Gerçek zamanlı takvim, zaman dilimi desteği, çakışma önleme
- ✅ **SMS Bildirimleri**: Otomatik ve manuel SMS gönderimleri (Twilio entegrasyonu)
- ✅ **Raporlama**: Detaylı raporlar ve istatistikler
- ✅ **Sistem Yönetimi**: Dealer, bölge, zaman dilimi, takvim ayarları yönetimi
- ✅ **Çalışan Yönetimi**: Kullanıcı oluşturma, şifre sıfırlama, specialist-dealer atamaları

---

## Sistem Rolleri ve Yetkileri

### 1. Sales (Satış)

**Yetkiler:**
- ✅ Kendi dealer'ına ait talepler oluşturabilir
- ✅ Oluşturduğu talepleri görüntüleyebilir
- ✅ Raporları görüntüleyebilir
- ❌ Talepleri onaylayamaz
- ❌ Sistem ayarlarına erişemez

**Erişebildiği Bölümler:**
- Dashboard
- Demands (Talep Oluşturma ve Listeleme)
- Reports (Raporlar)

**Özellikler:**
- Randevu oluştururken gerçek zamanlı takvim kullanır
- Dealer'ın takvim ayarlarına göre slotlar görüntülenir
- Müşteri adresi otomatik olarak dealer adı ile doldurulur (kilitli)
- Stok numarası girişi zorunludur

---

### 2. Finance (Finans)

**Yetkiler:**
- ✅ Tüm talepleri görüntüleyebilir
- ✅ Talepleri onaylayabilir (SMS gönderimi ile)
- ✅ Talepleri iptal edebilir
- ✅ Talepleri düzenleyebilir
- ✅ Onaylanmış talepleri "Pending" durumuna geri çekebilir
- ✅ Raporları görüntüleyebilir
- ❌ Sistem ayarlarına erişemez

**Erişebildiği Bölümler:**
- Dashboard
- Demands (Talep Yönetimi)
- Reports (Raporlar)

**Özellikler:**
- Onay işlemi sırasında SMS gönderim onayı alır
- Otomatik specialist ataması yapılır
- İptal/Rescheduling durumunda 24 saat içindeki randevular için SMS gönderilir

---

### 3. Specialist (Uzman)

**Yetkiler:**
- ✅ Kendi dealer'ına veya atandığı dealer'lara ait işleri görüntüleyebilir
- ✅ İşleri tamamlayabilir
- ✅ Randevu uyarılarını görüntüleyebilir
- ✅ Raporları görüntüleyebilir
- ❌ Talep oluşturamaz
- ❌ Sistem ayarlarına erişemez

**Erişebildiği Bölümler:**
- Dashboard (Randevu Uyarıları ile)
- Work List (İş Listesi)
- Reports (Raporlar)

**Özellikler:**
- Dashboard'da randevu uyarı tablosu görüntülenir:
  - 🔴 **Kırmızı**: Geçmiş randevular
  - 🟡 **Sarı**: Yarınki randevular (SMS otomatik gönderilir)
  - 🔵 **Mavi**: Bugünkü randevular
- Birden fazla dealer'a atanabilir (Aurora Manager tarafından)
- Atandığı tüm dealer'lardan işleri görüntüleyebilir

---

### 4. General Manager (Genel Müdür)

**Yetkiler:**
- ✅ Kendi dealer'ına ait tüm talepleri görüntüleyebilir
- ✅ Kendi dealer'ına ait raporları görüntüleyebilir
- ✅ Kendi dealer'ına ait Sales ve Finance kullanıcıları oluşturabilir
- ✅ Kendi dealer'ına ait çalışanları görüntüleyebilir
- ✅ Çalışan şifrelerini sıfırlayabilir
- ❌ Specialist, Aurora Manager veya General Manager oluşturamaz
- ❌ Sistem ayarlarına erişemez
- ❌ Specialist dealer atamalarını göremez

**Erişebildiği Bölümler:**
- Dashboard
- Demands (Kendi dealer'ına ait)
- Reports (Kendi dealer'ına ait)
- Employees (Sadece kendi dealer'ına ait Sales ve Finance)

**Özellikler:**
- Employees listesinde sadece kendi dealer'ına ait Sales ve Finance kullanıcılarını görür
- Specialist'lerin dealer atamalarını göremez

---

### 5. Aurora Manager (Aurora Yöneticisi)

**Yetkiler:**
- ✅ Tüm sistem ayarlarına erişebilir
- ✅ Tüm dealer'ları yönetebilir
- ✅ Tüm çalışanları yönetebilir
- ✅ Specialist'lere birden fazla dealer atayabilir
- ✅ Specialist dealer atamalarını görüntüleyebilir ve yönetebilir
- ✅ Bölge (Region) ve zaman dilimi (Timezone) yönetimi
- ✅ Takvim ayarları (Calendar Management) yönetimi
- ✅ Kamera modelleri yönetimi
- ✅ Logo yönetimi
- ✅ Veritabanı ve API yönetimi
- ✅ Tüm talepleri görüntüleyebilir
- ✅ Tüm raporları görüntüleyebilir

**Erişebildiği Bölümler:**
- Dashboard
- Demands (Tüm dealer'lar)
- Reports (Tüm dealer'lar)
- Employees (Sadece Specialist'ler)
- System Management (Tüm alt bölümler)

**System Management Alt Bölümleri:**
- User Management
- Dealer Management
- Region Management
- Calendar Management
- Database Management
- API Management
- Logo Management
- Camera Models

---

## Giriş Sistemi

### Giriş Adımları

1. **Dealer Code Girişi**
   - Dealer kodunu girin (örn: "HQ", "AKS")
   - Büyük/küçük harf duyarlı değildir
   - HQ staff için "HQ" kodu kullanılır

2. **Email ve Şifre**
   - Email adresinizi girin
   - Şifrenizi girin

3. **Giriş Kontrolü**
   - Sistem dealer kodunu doğrular
   - Kullanıcı bilgilerini kontrol eder
   - Rol bazlı dashboard'a yönlendirir

### Giriş Hataları

- **"Dealer code does not match your account"**: Dealer kodu kullanıcının dealer'ı ile eşleşmiyor
- **"Dealer information not found"**: Dealer bilgisi bulunamadı
- **"Invalid credentials"**: Email veya şifre hatalı

---

## Dashboard Özellikleri

### Ortak Özellikler (Tüm Roller)

- **Gerçek Zamanlı Saat**: Sidebar'ın en üstünde dealer'ın zaman dilimine göre gerçek zamanlı saat ve tarih
- **Kullanıcı Bilgileri**: Sidebar'ın altında kullanıcı adı ve rolü
- **Çıkış Butonu**: Güvenli çıkış yapma

### Role-Specific Dashboard Özellikleri

#### Sales Dashboard
- Son oluşturulan talepler
- Talep istatistikleri (Pending, Approved, Completed, Cancelled)
- Hızlı talep oluşturma linki

#### Finance Dashboard
- Atanmış talepler
- Bekleyen talepler (pending_finance)
- Onaylanmış talepler
- Talep istatistikleri

#### Specialist Dashboard
- **Randevu Uyarı Tablosu**:
  - 🔴 Geçmiş randevular (kırmızı)
  - 🟡 Yarınki randevular (sarı) - SMS otomatik gönderilir
  - 🔵 Bugünkü randevular (mavi)
- Atanmış işler
- Tamamlanan işler

#### General Manager Dashboard
- Kendi dealer'ına ait tüm talepler
- Talep istatistikleri
- Çalışan listesi (Sales ve Finance)

#### Aurora Manager Dashboard
- Tüm dealer'lara ait talepler
- Sistem geneli istatistikler
- Specialist listesi

---

## Talep (Demand) Yönetimi

### Talep Oluşturma (Sales)

**Adımlar:**

1. **Müşteri Bilgileri**
   - First Name (Ad)
   - Last Name (Soyad)
   - Phone Number (Telefon) - Kanada formatı: (604) 833-5801 veya +1 604 833 5801
   - Customer Address (Adres) - Otomatik doldurulur, kilitli (Dealer adı)

2. **Araç Bilgileri**
   - Make (Marka)
   - Model (Model)
   - Year (Yıl)
   - Stock Number (Stok Numarası) - **Zorunlu**

3. **Kamera Bilgileri**
   - Camera Model (Kamera Modeli) - Dropdown'dan seçim veya özel model girişi

4. **Randevu Seçimi**
   - Takvimden tarih seçimi
   - Mevcut slotlardan saat seçimi
   - Geçmiş tarihler seçilemez
   - Bloklu slotlar gösterilmez

**Randevu Kuralları:**
- Her randevu 75 dakika sürer (varsayılan, dealer ayarlarına göre değişebilir)
- Slotlar arasında 90 dakika aralık vardır (varsayılan, dealer ayarlarına göre değişebilir)
- Aynı saat bloğu sadece bir randevu için kullanılabilir (tüm dealer'lar için global)
- Dealer'ın takvim ayarlarına göre hafta içi/hafta sonu farklı saatler olabilir

**Talep Durumları:**
- `pending_finance`: Finance onayı bekliyor
- `approved`: Onaylandı, specialist'e atandı
- `completed`: Tamamlandı
- `cancelled`: İptal edildi

---

### Talep Onaylama (Finance)

**Onay İşlemi:**

1. **Approve Butonu**
   - Finance kullanıcısı "Approve" butonuna tıklar
   - Onay modal'ı açılır

2. **Onay Modal'ı**
   - ✅ "Are you sure you want to approve this demand?" (Zorunlu)
   - ✅ "Send appointment information to customer via SMS" (Opsiyonel, varsayılan: işaretli)
   - ✅ "Send information to Specialist" (Opsiyonel, varsayılan: işaretli, kilitli)

3. **Otomatik İşlemler**
   - Demand status'ü `approved` olur
   - Eğer specialist yoksa, dealer'dan specialist bulunur ve otomatik atanır
   - Customer'a SMS gönderilir (eğer seçildiyse)
   - Specialist'e SMS gönderilir (eğer seçildiyse ve specialist varsa)

4. **Onay Sonrası**
   - "Approve" butonu gizlenir
   - "Edit" butonu görünür

---

### Talep Düzenleme (Finance)

**Edit Modal Özellikleri:**

- Tüm talep bilgileri düzenlenebilir
- Randevu tarihi değiştirilebilir
- **"Revert to Pending"** seçeneği:
  - Onaylanmış talebi tekrar `pending_finance` durumuna çekebilir
  - Bu işlem specialist atamasını kaldırmaz

**Rescheduling SMS:**
- Randevu tarihi değiştirildiğinde
- Eğer eski randevu 24 saat içindeyse
- Otomatik olarak Cancellation Notice SMS gönderilir

---

### Talep İptali (Finance)

**İptal İşlemi:**

- Finance kullanıcısı "Cancel" butonuna tıklar
- Demand status'ü `cancelled` olur
- Eğer randevu 24 saat içindeyse, otomatik olarak Cancellation Notice SMS gönderilir

---

## Randevu Sistemi

### Randevu Oluşturma

**Takvim Özellikleri:**

- **Gerçek Zamanlı Takvim**: Aylık görünüm, tarih seçimi
- **Renk Kodlaması**:
  - 🟡 **Sarı**: Seçili tarih
  - 🔵 **Mavi**: Bugün
  - 🔴 **Kırmızı**: Randevu olan tarihler
- **Geçmiş Tarih Engelleme**: Geçmiş tarihler seçilemez
- **Manuel Tarih Seçimi**: Kaldırıldı, sadece takvimden seçim yapılabilir

**Slot Oluşturma:**

- Dealer'ın takvim ayarlarına göre slotlar oluşturulur
- **Hafta İçi (Weekday)**: Pazartesi-Cumartesi
- **Hafta Sonu (Weekend)**: Pazar
- Her dealer için farklı saatler ayarlanabilir

**Slot Kuralları:**

- Başlangıç saati: Dealer ayarlarına göre (varsayılan: 09:00)
- Bitiş saati: Dealer ayarlarına göre (varsayılan: 18:00)
- Slot aralığı: Dealer ayarlarına göre (varsayılan: 90 dakika)
- Randevu süresi: Dealer ayarlarına göre (varsayılan: 75 dakika)

**Çakışma Önleme:**

- Aynı saat bloğu sadece bir randevu için kullanılabilir
- Tüm dealer'lar için global kontrol
- Database seviyesinde trigger ile korunur
- UI'da bloklu slotlar gösterilmez

---

### Randevu Görüntüleme

**Tarih Formatı:**

- Randevu tarihleri dealer'ın zaman dilimine göre görüntülenir
- Format: `February 20, 2026 at 02:00 PM` (dealer timezone'ına göre)

**Timezone Desteği:**

- Her dealer bir bölgeye (region) atanır
- Her bölge bir zaman dilimine (timezone) atanır
- Randevular dealer'ın zaman dilimine göre oluşturulur ve görüntülenir

---

## SMS Bildirimleri

Detaylı SMS dokümantasyonu için `SMS_DOCUMENTATION.md` dosyasına bakın.

### SMS Gönderim Senaryoları

1. **Finance Approve** → Customer ve Specialist'e "Appointment Created" mesajı
2. **Demand Cancellation** (24 saat içindeyse) → Customer'a "Cancellation Notice"
3. **Demand Rescheduling** (24 saat içindeyse) → Customer'a "Cancellation Notice"
4. **4-Hour Reminder** (Cron Job) → Customer'a "4-Hour Reminder"
5. **Specialist Alert** (Yarınki randevular) → Specialist'e "4-Hour Reminder"

### SMS Mesaj Formatları

**Appointment Created:**
```
Appointment Created

A dashcam installation appointment has been scheduled for [Date] at [Address].

Aurora Vehicles.
```

**Cancellation / Rescheduling Notice:**
```
Cancellation / Rescheduling Notice

For cancellation or rescheduling requests within the last 24 hours prior to your appointment, please contact us at (604) 833-5801.
```

**4-Hour Reminder:**
```
4-Hour Reminder

This is a reminder that your dashcam installation appointment is scheduled to take place in 4 hours at [Address].

Aurora Vehicles.
```

---

## Raporlar

### Rapor Özellikleri

**Filtreleme Seçenekleri:**

- **Tarih Aralığı**: Başlangıç ve bitiş tarihi
- **Durum Filtresi**: Tüm durumlar veya belirli durumlar
- **Dealer Filtresi**: Tüm dealer'lar veya belirli dealer
- **Personel Filtresi**: Kategorize edilmiş personel seçimi
  - Sales > [Kullanıcı Adı]
  - Finance > [Kullanıcı Adı]
  - Specialist > [Kullanıcı Adı]

**Rapor İçeriği:**

- Müşteri bilgileri
- Araç bilgileri
- Randevu tarihi ve saati
- Durum bilgisi
- Oluşturulma tarihi
- Oluşturan kullanıcı

**Rapor Rolleri:**

- **Sales**: Sadece kendi oluşturduğu talepler
- **Finance**: Tüm talepler
- **Specialist**: Kendi tamamladığı işler
- **General Manager**: Kendi dealer'ına ait tüm talepler
- **Aurora Manager**: Tüm talepler

---

## Çalışan Yönetimi

### Kullanıcı Oluşturma

**Aurora Manager:**

- Tüm rolleri oluşturabilir (Sales, Finance, Specialist, Aurora Manager, General Manager)
- Tüm dealer'lara kullanıcı atayabilir

**General Manager:**

- Sadece Sales ve Finance oluşturabilir
- Sadece kendi dealer'ına kullanıcı atayabilir

**Kullanıcı Oluşturma Formu:**

- Full Name (Tam Ad)
- Phone (Telefon)
- Email (E-posta)
- Password (Şifre)
- Role (Rol)
- Dealer (Dealer Seçimi)

---

### Specialist Dealer Ataması

**Aurora Manager Özellikleri:**

- Specialist'lere birden fazla dealer atayabilir
- Specialist detail sayfasından dealer atama/kaldırma yapabilir
- Atanan dealer'ları görüntüleyebilir

**Diğer Roller:**

- Specialist dealer atamalarını göremez
- Employees listesinde specialist'ler için "—" gösterilir

**Specialist İş Görüntüleme:**

- Atandığı tüm dealer'lardan işleri görüntüleyebilir
- Her işte hangi dealer'dan geldiği gösterilir

---

### Şifre Sıfırlama

- Aurora Manager ve General Manager çalışan şifrelerini sıfırlayabilir
- "Reset Password" butonu ile yeni şifre atanır

---

## Sistem Yönetimi

Sadece **Aurora Manager** erişebilir.

### 1. User Management

- Kullanıcı oluşturma
- Kullanıcı listeleme
- Kullanıcı bilgilerini görüntüleme

### 2. Dealer Management

- Dealer oluşturma, düzenleme, silme
- Dealer'a bölge (region) atama
- Dealer'a kamera modelleri atama
- Dealer logo yükleme

### 3. Region Management

- Bölge (Region Code) oluşturma, düzenleme, silme
- Bölgeye zaman dilimi (Timezone) atama
- Zaman dilimi yönetimi:
  - Zaman dilimi oluşturma
  - Zaman dilimi düzenleme
  - Zaman dilimi silme

**Varsayılan Zaman Dilimleri:**
- Pacific Time (PT) - America/Vancouver
- Mountain Time (MT) - America/Edmonton
- Central Time (CT) - America/Winnipeg
- Eastern Time (ET) - America/Toronto
- Atlantic Time (AT) - America/Halifax
- Newfoundland Time (NT) - America/St_Johns

### 4. Calendar Management

**Dealer Bazlı Takvim Ayarları:**

Her dealer için hafta içi ve hafta sonu için ayrı ayarlar yapılabilir:

- **Start Hour**: Başlangıç saati (0-23)
- **End Hour**: Bitiş saati (0-23)
- **Slot Interval**: Slot aralığı (dakika)
- **Appointment Duration**: Randevu süresi (dakika)

**Özellikler:**

- Dealer seçimi
- Day Type seçimi (Weekday/Weekend)
- Her dealer için farklı saatler ayarlanabilir
- Ayarlar randevu oluşturma formunda otomatik kullanılır

**Varsayılan Değerler:**

- Start Hour: 9 (09:00)
- End Hour: 18 (18:00)
- Slot Interval: 90 dakika
- Appointment Duration: 75 dakika
- Weekend Start Hour: 11 (11:00)
- Weekend End Hour: 17 (17:00)

### 5. Database Management

- Veritabanı sorguları çalıştırma
- Veritabanı yönetimi

### 6. API Management

- API ayarları yönetimi
- API endpoint'leri görüntüleme

### 7. Logo Management

- Sistem logosu yükleme
- Logo görüntüleme

### 8. Camera Models

- Kamera modeli oluşturma, düzenleme, silme
- Kamera modeli açıklaması
- Stok miktarı takibi
- Aktif/Pasif durumu

---

## Teknik Özellikler

### Zaman Dilimi (Timezone) Sistemi

**Hiyerarşi:**

1. **Timezone**: Zaman dilimi tanımları (örn: America/Vancouver)
2. **Region**: Bölge kodları, timezone'a atanır
3. **Dealer**: Dealer'lar, region'a atanır
4. **User**: Kullanıcılar, dealer'a atanır

**Kullanım:**

- Randevu oluşturulurken dealer'ın timezone'ı kullanılır
- SMS mesajlarında tarih formatı dealer'ın timezone'ına göre yapılır
- Dashboard'da gerçek zamanlı saat dealer'ın timezone'ına göre gösterilir

### Randevu Çakışma Önleme

**Database Seviyesi:**

- `check_appointment_overlap()` fonksiyonu
- `trg_prevent_overlap` trigger
- 75 dakikalık randevular için çakışma kontrolü
- Tüm dealer'lar için global kontrol

**UI Seviyesi:**

- Bloklu slotlar gösterilmez
- Slot seçilmeden önce kontrol yapılır
- Gerçek zamanlı slot güncellemesi

### SMS Entegrasyonu

**Twilio Entegrasyonu:**

- E.164 formatında telefon numarası dönüşümü
- Kanada telefon numarası formatı: (604) 833-5801 veya +1 604 833 5801
- Non-blocking SMS gönderimi (hata durumunda işlem devam eder)

**Cron Job:**

- Vercel Cron Job: Her saat başı (`0 * * * *`)
- 4 saat içindeki randevular için otomatik hatırlatma
- `/api/send-reminders` endpoint'i

### Performans Optimizasyonları

- Database query optimizasyonları
- React.memo kullanımı
- Code splitting
- Image optimization
- Bundle size optimizasyonu

---

## Önemli Notlar

### Güvenlik

- Row Level Security (RLS) policies aktif
- Rol bazlı erişim kontrolü
- Server-side validation
- Environment variables ile güvenli credential yönetimi

### Veri Bütünlüğü

- Database trigger'lar ile çakışma önleme
- Foreign key constraints
- Unique constraints
- Check constraints

### Kullanıcı Deneyimi

- Gerçek zamanlı slot güncellemesi
- Responsive tasarım
- Dark theme
- Loading states
- Error handling

---

## Sık Sorulan Sorular (FAQ)

### 1. Randevu oluştururken neden bazı saatler görünmüyor?

- O saat bloğu zaten dolu olabilir (başka bir dealer tarafından)
- Dealer'ın takvim ayarlarına göre o saat aralığında slot olmayabilir
- Geçmiş tarihler seçilemez

### 2. SMS neden gönderilmedi?

- Telefon numarası eksik veya geçersiz format olabilir
- Twilio credentials eksik olabilir
- SMS gönderim onayı işaretlenmemiş olabilir (Finance approve)

### 3. Specialist'e neden iş atanmıyor?

- Dealer'da specialist yoksa atama yapılamaz
- Approve işlemi sırasında otomatik atama yapılır
- Aurora Manager manuel olarak specialist'e dealer atayabilir

### 4. General Manager neden sadece Sales ve Finance görebiliyor?

- General Manager sadece kendi dealer'ına ait Sales ve Finance kullanıcılarını görebilir
- Specialist'leri göremez (Aurora Manager'a özel)
- Bu bir güvenlik önlemidir

### 5. Takvim ayarları nasıl çalışır?

- Aurora Manager System Management > Calendar Management'dan ayarlar
- Her dealer için hafta içi ve hafta sonu ayrı ayarlar yapılabilir
- Ayarlar yapılmazsa varsayılan değerler kullanılır

---

## Destek ve İletişim

Teknik destek için sistem yöneticinizle iletişime geçin.

---

## Son Güncelleme

**Tarih:** 2026-02-20  
**Versiyon:** 2.0  
**Son Değişiklikler:**
- Calendar Management özelliği eklendi
- Specialist çoklu dealer ataması eklendi
- General Manager kısıtlamaları eklendi
- Timezone desteği geliştirildi
- Randevu çakışma önleme sistemi eklendi
- SMS mesaj formatları güncellendi

