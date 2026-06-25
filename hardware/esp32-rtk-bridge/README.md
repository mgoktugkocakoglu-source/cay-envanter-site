# RTK GPS Köprüsü (ESP32) — Budama İşaretleme POC

Telefonun 3–5 m'lik GPS'i yerine, budama (`budama işaretleme`) sayfasındaki
"GPS ile saha ölçümü" modunu **santimetre doğruluğunda** çalıştırmak için harici
RTK alıcısını telefona bağlayan köprü.

## Veri akışı

```
[Here+ rover / u-blox M8P]
   │  UART: NMEA (GGA + GST)  ──►  ESP32  ──► WiFi/WebSocket ──►  [Telefon app]
   │  UART: RTCM3  ◄──────────────  ESP32  ◄── TCP/NTRIP ──────  [CORS caster]
```

ESP32 **telefonun hotspot'una** bağlanır (station modu). Bu tek bağlantı hem
NTRIP düzeltmesi için internet sağlar, hem de telefonun ESP32'ye WebSocket
açabileceği yerel bir adres verir. App şuraya bağlanır: `ws://caygps.local:81`
(ya da seri monitörde yazan IP ile `ws://192.168.x.x:81`).

> Neden Here+ (M8P), Here4 değil? M8P UART'tan düz **NMEA** basar; ESP32 bunu
> doğrudan okur. Here4 **DroneCAN/CAN bus** konuşur — telefon zinciri için ayrı
> ve daha riskli bir iş. POC'ta Here+ kullan, Here4'ü v2'ye bırak.

## 1) Kablolama (M8P UART1 ↔ ESP32 UART2)

3.3V mantık seviyesi — RX/TX'e **5V verme**.

| M8P | ESP32 |
|-----|-------|
| TX  | GPIO16 (RX2) |
| RX  | GPIO17 (TX2) — RTCM3 düzeltmesi rover'a buradan gider |
| GND | GND |
| VCC | 5V (modülün konektörüne göre; mantık 3.3V kalır) |

## 2) M8P'yi u-center ile bir kez yapılandır

USB ile bağlan, `View → Messages` ve `View → Configuration`:

- **UART1 baud**: `38400` (`CFG-PRT`). Firmware'deki `GPS_BAUD` ile aynı olmalı.
  Fabrika çıkışı 9600'dür — yükselt.
- **NMEA çıkışı (UART1)**: `GGA` ve `GST` **açık** (`CFG-MSG`). `GST` gerçek
  doğruluk değerini (±cm) verir; app onu okur. İstersen `RMC` de açabilirsin;
  `GSV/GLL/VTG` kapat (bant genişliği).
- **RTCM3 girişi (UART1)**: `CFG-PRT` → UART1 input protocol'da **RTCM3 açık**.
- **High precision NMEA**: `CFG-NMEA` → "High precision mode" **açık**
  (lat/lon'a fazladan ondalık ekler; cm gösterimi için şart).
- **Mod**: rover (TMODE kapalı). Nav rate 5 Hz iyi olur (`CFG-RATE`, opsiyonel).
- Ayarları `CFG` → **Save** ile flash'a yaz.

## 3) Firmware'i yükle

`esp32-rtk-bridge.ino` içindeki sabitleri doldur:

- `WIFI_SSID` / `WIFI_PASS` → **telefonun hotspot'u**.
- `NTRIP_HOST` / `NTRIP_PORT` / `NTRIP_MOUNT` / `NTRIP_USER` / `NTRIP_PASS` →
  CORS hesabın (Türkiye: **TUSAGA-Aktif / TKGM**). Mountpoint için yakın bir
  istasyon veya VRS/RTCM3 noktası seç. M8P tek bant (L1) olduğundan baz hattı
  kısa olmalı (≤ ~10–15 km) — yoksa FIXED yerine FLOAT'ta kalır.

Arduino IDE → Library Manager → **"WebSockets" by Markus Sattler** kur. Board:
ESP32 dev module. Yükle, seri monitörü 115200'de aç; IP ve `ws://caygps.local:81`
satırlarını göreceksin.

## 4) App tarafı

Budama sayfası → **GPS ile saha ölçümü** → kaynak: **RTK Alıcı**.

- Bağlantı durumu ("Alıcı bağlı") ve fix rozeti (**RTK Sabit** = cm) görünür.
- Doğruluk satırı `±2 cm` gibi gösterir; her köşede **"Konumu ekle"**.
- Adres yanlışsa **Ayar** → WebSocket adresini gir → **Bağlan**. Varsayılan
  `ws://caygps.local:81`. `.local` çözülmezse seri monitördeki IP'yi yaz.
- Alıcı bağlı değilse **Telefon GPS**'e tek dokunuşla düşebilirsin (fallback).

## 5) POC günü — kontrol listesi

1. Telefon hotspot **açık** (2.4 GHz; ESP32 5 GHz görmez).
2. ESP32'ye güç → seri monitörde "WiFi OK" + IP.
3. Açık gökyüzü altında M8P'ye birkaç dakika tanı (fix oturması).
4. App "RTK Alıcı" → "Alıcı bağlı" → rozet **RTK Float** → birkaç dk içinde
   **RTK Sabit**. Sahaya çıkmadan FIXED'i gör.
5. Köşeleri gez, her köşede "Konumu ekle", kaydet.

### Gerçekçi beklenti
App + köprü + canlı konum/fix göstergesi **sağlam** çalışır. Sahada ilk kez
**RTK FIXED** kilidi NTRIP kapsamasına ve baz hattı mesafesine bağlıdır; kapsama
zayıfsa FLOAT'ta (~0.5 m) kalabilirsin — yine telefon GPS'inden kat kat iyidir,
ve app fix kalitesini dürüstçe gösterir. FIXED tutmazsa Telefon GPS fallback'i
demoyu kurtarır.

## Sorun giderme

| Belirti | Bak |
|---|---|
| App "Alıcı bağlı değil" | Hotspot 2.4 GHz mi; ESP32 IP aldı mı; adres/port doğru mu |
| `.local` çözülmüyor | Seri monitördeki IP ile `ws://<ip>:81` gir (özellikle Android) |
| Rozet hep "GPS"/"DGPS", FIXED yok | NTRIP akıyor mu (seri log "akis basladi"); mountpoint/baz hattı; açık gökyüzü |
| Doğruluk metrede takılı | u-center'da GST + High-precision NMEA açık mı; UART1 baud eşleşiyor mu |
| Konum geliyor ama "±..m" | GST yok → fix-kalitesi tahminine düşüyor; GST'yi aç |
