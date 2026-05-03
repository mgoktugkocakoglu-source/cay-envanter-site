# Çay Hesabım — iOS App Store Yayınlama Rehberi

Bu döküman, Windows tarafında **kod hazırlığı tamamlanmış** iOS uygulamasının macOS makinede build edilip App Store'a gönderilmesi için adım adım kılavuzdur.

---

## 0. Ön Koşullar

| Gereksinim | Açıklama |
|------------|----------|
| **macOS** | Sonoma 14+ (Xcode 15+ için gerekli) |
| **Xcode** | 15.4+ (App Store yüklemesi için zorunlu) |
| **Apple Developer hesabı** | $99/yıl — https://developer.apple.com/programs/ |
| **App Store Connect** | https://appstoreconnect.apple.com (developer hesabıyla birlikte gelir) |
| **Node.js** | 20+ |
| **CocoaPods** | Gerekli değil (proje SPM kullanıyor) |

---

## 1. Bundle ID & App Store Connect Kaydı

1. https://developer.apple.com/account/resources/identifiers → **+** → **App IDs** → **App**
2. Bundle ID: `com.cayhesabim.app` (Explicit)
3. Description: `Cay Hesabim`
4. Capabilities: yalnızca varsayılanlar (Sign in with Apple **gerekmiyor** — uygulamada 3. taraf sosyal giriş yok)
5. Continue → Register

Sonra App Store Connect'te:
1. https://appstoreconnect.apple.com/apps → **+** → **New App**
2. Platform: **iOS**
3. Name: `Çay Hesabım`
4. Primary Language: `Turkish`
5. Bundle ID: `com.cayhesabim.app` (yukarıda oluşturulan)
6. SKU: `cayhesabim-ios-001` (kendi takip kodunuz)

---

## 2. macOS Build Adımları

```bash
# 1) Repo
git clone <repo-url>
cd cayhesabim
pnpm install

# 2) Web build + capacitor sync
cd apps/web
pnpm build:mobile
npx cap sync ios

# 3) iOS ikon ve splash setini üret
pnpm generate:assets

# 4) Xcode aç
npx cap open ios
```

---

## 3. Xcode'da Yapılacaklar

### 3.1 Signing & Capabilities
- Sol panelde **App** projesi → **Signing & Capabilities** sekmesi
- **Team**: Apple Developer hesabınızı seçin
- **Provisioning Profile**: Automatic (önerilir)
- "Automatically manage signing" işaretli olsun

### 3.2 Sürüm Doğrulama
- **General** sekmesi
- Version: `1.0.4` (Android ile aynı)
- Build: `6` (Android versionCode ile aynı)
- Minimum Deployments → iOS: `15.0`
- Supported Destinations: iPhone + iPad

### 3.3 İmza Ön Test (Simulator)
- Üst barda hedef cihaz: iPhone 15 simulator
- ⌘R ile çalıştır → uygulama açılmalı, splash + giriş ekranı görünmeli

### 3.4 Gerçek Cihaz Test (Opsiyonel ama önerilir)
- iPhone'u kabloyla bağla, Trust → cihazı seçip ⌘R
- Konum, kamera, fotoğraf izinlerinin Türkçe metinlerle çıktığını doğrula

---

## 4. Archive ve App Store'a Yükleme

```
1. Üst bar: hedef cihaz → "Any iOS Device (arm64)"
2. Menü: Product → Archive
3. Archive bittiğinde Organizer açılır
4. "Distribute App" → "App Store Connect" → "Upload"
5. "Automatically manage signing" → Next
6. Upload → 5-10 dakika bekle
```

Yükleme bittikten sonra App Store Connect'te build görünmesi 10-30 dakika sürer.

---

## 5. App Store Connect Metadata

### 5.1 App Information
- **Subtitle** (30 karakter): `Çay Üreticisi Hesap Defteri`
- **Category**: Primary = `Business`, Secondary = `Finance`
- **Content Rights**: "Does it contain third-party content?" → No

### 5.2 Pricing and Availability
- Price: **Free**
- Availability: Tüm ülkeler (veya yalnızca Türkiye)

### 5.3 App Privacy
PrivacyInfo.xcprivacy dosyasıyla uyumlu olarak şunları beyan et:

| Veri Türü | Linked | Tracking | Amaç |
|-----------|--------|----------|------|
| E-posta | ✓ | ✗ | App Functionality |
| Ad | ✓ | ✗ | App Functionality |
| Telefon | ✓ | ✗ | App Functionality |
| Yaklaşık Konum | ✗ | ✗ | App Functionality |
| Fotoğraflar/Videolar | ✗ | ✗ | App Functionality |

### 5.4 Version (1.0.4) — App Store sayfası
- **Promotional Text** (170 karakter): _Çay üreticisi olarak günlük yaş çay teslimatlarınızı, fiyat hesaplamalarınızı ve gelir takibinizi tek bir yerden kolayca yönetin._
- **Description**: README'den uyarlanmış uzun açıklama (4000 karakter sınırı)
- **Keywords** (100 karakter): `çay,üretici,çaykur,yaş çay,hesap,gelir,takip,tarla,fındık,rize`
- **Support URL**: https://cayhesabim.com.tr/destek (varsa)
- **Marketing URL**: https://cayhesabim.com.tr (opsiyonel)
- **Copyright**: `© 2026 Çay Hesabım`

### 5.5 Build
- 5-30 dk içinde Xcode'dan yüklenen build burada görünür → seçip "Add Build"
- **Encryption export compliance** sorusu Info.plist'teki `ITSAppUsesNonExemptEncryption=false` ile otomatik geçer

### 5.6 Ekran Görüntüleri (zorunlu)

| Cihaz | Boyut | Adet |
|-------|-------|------|
| **iPhone 6.7"** (iPhone 15 Pro Max) | 1290×2796 | 3-10 adet |
| **iPhone 6.5"** (iPhone 11 Pro Max) | 1242×2688 veya 1284×2778 | 3-10 adet (opsiyonel ama önerilir) |
| **iPad Pro 12.9" (3rd gen)** | 2048×2732 | 3-10 adet (iPad desteklediğimiz için zorunlu) |

**Önerilen 5 ekran**: Anasayfa/Dashboard, Tarla ekleme, Hesap geçmişi, Topluluk akışı, Profil.

### 5.7 App Review Information
- Sign-in required: **Yes** → Demo hesap kullanıcı adı + şifre ver (Apple test eder)
- Notes: _"Uygulama Türkiye'deki çay üreticilerinin Çaykur ve özel firmalara teslim ettikleri yaş çayın hesabını tutmaları için tasarlanmıştır."_

### 5.8 Version Release
- "Manually release this version" (önerilir — onay sonrası kontrolünüzde)

---

## 6. Submit for Review

1. Tüm "Required" alanları yeşil olunca üst sağdaki **Add for Review** → **Submit to App Review**
2. Review süresi tipik olarak 24-48 saat
3. Reddedilirse: Resolution Center'dan ne istendiği görülür → düzelt → yeni build ile tekrar gönder

---

## 7. Yeni Sürüm (Update) Yayınlama

Her yeni sürümde:

1. `apps/web/android/app/build.gradle` → `versionCode` ve `versionName` artır
2. `apps/web/ios/App/App.xcodeproj/project.pbxproj` → `CURRENT_PROJECT_VERSION` ve `MARKETING_VERSION` artır (Android ile aynı tut)
3. `pnpm cap:build:ios && pnpm generate:assets`
4. Xcode → Archive → Upload
5. App Store Connect → "+ Version" → release notes yaz → submit

---

## 8. Tamamlanan Hazırlıklar (Bu Repo'da)

- ✅ `Info.plist` — `arm64` (armv7 değil), tüm izin metinleri Türkçe, ATS HTTPS-only
- ✅ `ITSAppUsesNonExemptEncryption=false` (encryption export muafiyeti otomatik)
- ✅ `UIRequiresFullScreen=false` (iPad multitasking destekli)
- ✅ `PrivacyInfo.xcprivacy` (Apple zorunluluğu — 2024+)
- ✅ Bundle ID: `com.cayhesabim.app`
- ✅ Custom URL Scheme: `cayhesabim://`
- ✅ Sürüm Android ile senkron: `1.0.4` / build `6`
- ✅ iOS deployment target: 15.0
- ✅ Capacitor 8 + Swift Package Manager (CocoaPods'suz)
- ✅ Universal Links / Open URL handler hazır

## 9. App Store Reddinin Yaygın Sebepleri ve Önlemlerimiz

| Sebep | Önlemimiz |
|-------|-----------|
| Çakışan/eksik permission açıklaması | Tüm `NS*UsageDescription` metinleri Türkçe ve gerçek kullanıma uygun |
| 32-bit binary | `arm64` ile derleniyor |
| Crash | Web app olduğundan crash olasılığı çok düşük; simulator + gerçek cihaz testi şart |
| Tamamlanmamış işlevsellik | TestFlight'a önce iç dağıtım yapıp gerçek hesapla deneyin |
| Düşük kalite UI | Capacitor scrollEnabled + contentInset='always' + safe-area CSS env'leri (web tarafında) |
| Privacy Manifest eksik | `PrivacyInfo.xcprivacy` mevcut |
| Demo hesap çalışmıyor | Review notes'a doğru çalışan demo kullanıcı eklemek **zorunlu** |
