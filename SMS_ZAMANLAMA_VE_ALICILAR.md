# SMS Gönderim Zamanları ve Alıcılar Analizi

Bu dokümantasyon, AuroraHub projesindeki SMS sisteminin gönderim zamanları ve teslim edilen kişileri özetler.

---

## 1. Appointment Created (Randevu Oluşturuldu)

| Özellik | Değer |
|---------|-------|
| **Ne zaman** | Finance talebi onayladığında |
| **Kime** | Müşteri (`customer_phone`) + Atanan specialist (`specialist.phone`) |
| **Kod yeri** | `approveDemand` – `src/app/dashboard/finance/demands/actions.ts` |

Checkbox ile müşteriye ve specialist'e gönderim seçilebilir. ✅ Doğru.

---

## 2. Cancellation Notice (İptal Bildirimi)

| Özellik | Değer |
|---------|-------|
| **Ne zaman** | Talep iptal edildiğinde (direkt) |
| **Kime** | Müşteri **ve** Atanan Specialist |
| **Kod** | `cancelDemand` – `src/app/dashboard/finance/demands/actions.ts` |

✅ Doğru. İptal edildiği anda hem müşteriye hem specialist'a SMS gider.

---

## 3. Rescheduling Notice (Yeniden Planlama Bildirimi)

| Özellik | Değer |
|---------|-------|
| **Ne zaman** | Randevu tarihi değiştirildiğinde (direkt) |
| **Kime** | Müşteri **ve** Atanan Specialist |
| **Kod** | `updateDemand` – `src/app/dashboard/finance/demands/actions.ts` |

✅ Doğru. Reschedule edildiği anda hem müşteriye hem specialist'a SMS gider.

---

## 4. 4-Hour Reminder (4 Saat Öncesi Hatırlatma)

| Özellik | Değer |
|---------|-------|
| **Ne zaman** | Randevudan yaklaşık **3.5–4.5 saat** önce (saatlik cron) |
| **Kime** | Müşteri **ve** Atanan Specialist (aynı mesaj, aynı anda) |
| **Kod** | `send-reminders/route.ts` – `isWithin4HoursBeforeWindow()` |

✅ Doğru. Müşteri ve specialist aynı sistem üzerinden, 4 saat kala aynı hatırlatma mesajını alır. SMS Management ayarlarında "Send to Customer" ve "Send to Assigned Specialist" checkbox'ları ile her iki alıcı da kontrol edilebilir.

---

## Özet Tablo

| Tetikleyici | Zamanlama | Alıcı | Durum |
|-------------|-----------|-------|-------|
| Appointment Created | Onay anı | Müşteri + Specialist | ✅ |
| Cancellation Notice | İptal anı | Müşteri + Specialist | ✅ |
| Rescheduling Notice | Tarih değişince | Müşteri + Specialist | ✅ |
| 4-Hour Reminder (Cron) | 3.5–4.5 saat önce | Müşteri + Specialist | ✅ |

---

## Sonuç

- Alıcılar doğru: müşteriye müşteri bilgisi, specialist'a specialist bilgisi gidiyor.
- Zamanlamalar doğru.
- 4 saat öncesi hatırlatma: müşteri ve specialist aynı mesajı aynı anda (cron ile) alır.
