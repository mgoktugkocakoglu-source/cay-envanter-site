# Çay Envanteri eklentisi — devir notu (çayhesabım.com'a aktarım için)

Bu depo `cayhesabim` kod tabanından türetildi; `main` dalının üzerine **Çay Envanteri / Ruhsatlandırma / Budama
Takibi / Bahçe Sağlığı** modülleri eklendi. Eklentinin tamamı `feat/tea-inventory` dalında, `main`'e göre
**32 commit, 85 dosya** (veri paketleri ve uydu görüntüleri hariç). Aynı kodu yeniden yazmaya gerek yok:
aşağıdaki dosyalar olduğu gibi taşınır, çekirdekte dokunulan yerler azdır ve listelidir.

Tam farkı görmek için (çayhesabım.com bu `main`'den türediği için fark birebir uygulanabilir):

```bash
git fetch origin main feat/tea-inventory
git diff --stat origin/main...origin/feat/tea-inventory -- . ':!apps/api/src/tea-inventory/seed-data' ':!apps/web/public/inventory-imagery'
```

## 1. Eklenen modül (yeni dosyalar, çekirdeğe bağımsız)

| Yer | İçerik |
| --- | --- |
| `apps/api/src/tea-inventory/` | NestJS modülü: `tea-inventory.module.ts`, 8 controller, 11 servis, `dto/`, `entities/` (12 tablo), `enums/`, `report/` (pdfkit yardımcıları), `seed-data/` (mahalle paketleri, JSON) |
| `apps/api/src/assets/fonts/` | DejaVu fontları base64 (PDF'lerde Türkçe karakter; serverless paketlemede dosya kopyalama gerekmez) |
| `apps/web/src/pages/caykur/CaykurTeaInventoryPage.vue` | Tek sayfa, sekmeler: Bölge · Envanter · Budama Takibi · Ruhsatlandırma · Bahçe Sağlığı |
| `apps/web/src/components/caykur/Caykur*.vue` (13 bileşen) | Bölge özeti, budama (füzyon, tarama kayıtları, müstahsil, raporlar, kalibrasyon), ruhsat (liste, işlemler, harita editörü), bahçe sağlığı |
| `apps/web/src/services/caykur/teaInventory.ts` | Etiketler, sınıf/karar meta verileri, biçimlendirme yardımcıları |
| `apps/web/src/composables/useTkgmParcelLookup.ts` | Haritada tıklanan noktayı TKGM'den canlı sorgular |
| `apps/web/public/inventory-imagery/<alan-kodu>/` | Sezon uydu görüntüleri (statik dosya; PDF'ler `APP_URL` üzerinden okur) |

Hepsi `@/` alias'ı kullanır, `tea-inventory` dışına bağımlılığı yalnızca `auth` (guard, `@CaykurRoles`,
`CaykurRole`) ve `common/dto/paginated.dto`'dur.

## 2. Çekirdekte dokunulan dosyalar (dikkat edilecekler)

| Dosya | Değişiklik |
| --- | --- |
| `apps/api/src/app.module.ts` | `TeaInventoryModule` import; Joi şemasına `DB_SSL` (yönetilen Postgres için TLS) |
| `apps/api/src/main.ts`, `app.setup.ts`, `serverless.ts`, `api/index.js`, `vercel.json`, `.vercelignore` | Vercel serverless sarmalayıcı (uygulama kurulumu `app.setup.ts`'e taşındı, `main.ts` onu çağırır). **Klasik sunucuda gereksiz**; `main.ts`'teki kurulum aynı kalır |
| `apps/api/src/managed-postgres-env.ts` | `DATABASE_URL` verilirse `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE/DB_SSL`'e çevirir (Neon/Supabase). İsteğe bağlı |
| `apps/api/src/geo/geo.service.ts` | TKGM parsel sorgusuna 500 kayıtlık önbellek ve nokta-poligon testi eklendi (tıkla-sorgula için) |
| `apps/api/nest-cli.json` | `assets`: `tea-inventory/seed-data/*.json` ve `assets/**/*.txt` dist'e kopyalanır (**şart**, yoksa paketler yüklenmez) |
| `apps/web/src/router/index.ts` | Rota: `/caykur/tea-inventory` (name `caykur-tea-inventory`, `requiresAuth`) |
| `apps/web/src/services/caykur/nav.ts`, `roles.ts` | Menüye "Çay Envanteri"; `ModuleKey`'e `tea_inventory` ve rollerin erişim listesi |
| `apps/web/src/services/api.ts` | `api.*` çağrıları ve tipleri (tea-inventory bölümü; büyük ek, çekirdek çağrılar değişmedi) |
| `apps/web/src/types/polygon-splitter.d.ts` | Tip bildirimi |

Bağımlılıklar (pnpm): API `@turf/turf 7.4.0`, `pdfkit 0.20.2`, `exceljs 4.4.0`, `jszip 3.10.2`,
`dejavu-fonts-ttf 2.37.3`, `@types/pdfkit`, `@types/geojson`; web `@turf/turf 7.4.0`,
`@geoman-io/leaflet-geoman-free 2.20.4`, `polygon-splitter 0.0.11`.

## 3. Veritabanı

TypeORM `synchronize: true` ile 12 tablo kendiliğinden oluşur (migration yok, çekirdekle aynı kural):
`tea_inventory_areas`, `tea_inventory_parcels`, `tea_inventory_gardens`, `tea_inventory_licenses`,
`tea_inventory_producers`, `tea_inventory_parcel_lineage`, `licensing_applications`, `licensing_decisions`,
`pruning_decisions`, `calibration_labels`, `ministry_requests`, `fertilisation_records`.

Veri akışı: analiz motoru (`cay-envanter`, ayrı özel depo; **gerekli değil**) mahalle başına bir paket üretir →
`apps/api/src/tea-inventory/seed-data/<il>-<ilçe>-<mahalle>.json`. API `SEED_DEMO=true` ile açılınca
`TeaInventorySeedService` her paketi içe aktarır; yalnız `generatedAt` değişen paketler yeniden yüklenir.
Sitede yapılan işlemler (alt bölünme, ruhsat ayırımı, kararlar, etiketler, talepler, gübre kayıtları) kod
anahtarlı tablolarda ve `source='site'` ile saklanır; yeniden yüklemede **korunur**. Bu yüzden eski
veritabanından taşınacak bir şey yok: boş Postgres + seed yeterli.

Mahalle paketleri büyüktür (Çataldere 15 MB, toplam ~45 MB); ilk açılışta içe aktarma Neon'da ~1–2 dk sürer.

## 4. Sıfırdan çalışır hale getirme (bu depo, kendi sunucusu, veritabanı yok)

Depo tek başına yeterlidir; veritabanı **boş** olmalı, içeriği uygulama kendisi üretir. Eski ortamdan
dosya ya da veri taşınmaz.

### 4.1 Gereksinimler

- Node.js **22.18 veya üzeri** (motor 22 ister; site 20 ile de çalışır ama 22 önerilir), pnpm **8.15**
  (`corepack enable && corepack prepare pnpm@8.15.0 --activate`).
- PostgreSQL **16** (yerel kurulum, Docker ya da yönetilen hizmet: Neon, Supabase, RDS…). Boş bir veritabanı
  ve yetkili bir kullanıcı: `CREATE DATABASE cayhesabim;`
- Sunucuda giden HTTPS erişimi: tarayıcı istemcisi `cbsapi.tkgm.gov.tr`'ye, API ise (yalnız PDF üretirken)
  kendi `APP_URL`'ine ulaşabilmeli.

### 4.2 Kurulum

```bash
git clone https://github.com/mgoktugkocakoglu-source/cay-envanter-site.git
cd cay-envanter-site
pnpm install --frozen-lockfile
```

`apps/api/.env` dosyasını oluşturun (`.env.example` şablondur; aşağıdakiler **zorunlu**, eksikse API Joi
doğrulamasıyla açılmaz):

```ini
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=cayhesabim
DB_PASSWORD=<güçlü-şifre>
DB_DATABASE=cayhesabim
DB_SSL=false                 # Neon/Supabase gibi yönetilen Postgres'te true
JWT_SECRET=<rastgele 32+ karakter>
JWT_REFRESH_SECRET=<rastgele 32+ karakter, farklı>
APP_URL=https://www.alanadiniz.com   # sitenin kök adresi, sondaki / olmadan
SEED_DEMO=true               # ilk açılışta paketleri ve demo kullanıcıları yükler
SEED_DEMO_PASSWORD=<demo hesapların şifresi>   # verilmezse koddaki varsayılan kullanılır; üretimde mutlaka verin
```

Rastgele anahtar üretmek için: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

İsteğe bağlı (yoksa ilgili özellik sessizce kapalı kalır): `RESEND_API_KEY`/`RESEND_FROM` (e-posta),
`R2_*` (dosya yükleme), `GEMINI_*` (bilgi asistanı). `DATABASE_URL` tek satır olarak da verilebilir;
`managed-postgres-env.ts` onu `DB_*`'ye çevirir.

Web için `apps/web/.env.production` yalnız API **farklı bir origin'de** çalışıyorsa gerekir:
`VITE_API_BASE_URL=https://api.alanadiniz.com/api`. Aynı alan adında `/api` ters vekille sunuluyorsa boş bırakın.

### 4.3 Derleme ve çalıştırma

```bash
pnpm build:api      # apps/api/dist (seed-data/*.json ve fontlar dist'e kopyalanır)
pnpm build:web      # apps/web/dist (statik dosyalar; inventory-imagery dahil)
cd apps/api && node dist/main.js     # ya da pm2: pm2 start dist/main.js --name cayhesabim-api
```

İlk açılışta API, `synchronize` ile 12 tabloyu oluşturur, sonra paketleri içe aktarır. Logda şu satırlar
görünmeli (12 mahalle için 12 satır, toplam 1–3 dk):

```
[TeaInventorySeedService] Imported tea inventory trabzon-of-cataldere: 339 parcels
[TeaInventorySeedService] Imported tea inventory trabzon-of-tekoba: 157 parcels
...
```

Web `apps/web/dist` bir statik sunucudan (nginx, Caddy, Apache) sunulur; `/api/*` istekleri 3000 portuna
vekillenir, diğer her yol `index.html`'e düşer (SPA). Örnek nginx:

```nginx
server {
    server_name www.alanadiniz.com;
    root /srv/cay-envanter-site/apps/web/dist;
    location /api/ { proxy_pass http://127.0.0.1:3000/api/; proxy_set_header Host $host; proxy_read_timeout 120; }
    location / { try_files $uri /index.html; }
}
```

`proxy_read_timeout` önemli: kanıt PDF'i ve sezon raporu 20–40 sn sürebilir. Statik görüntü klasörü
(`inventory-imagery/`, ~30 MB) dist içinde gelir; ayrıca bir şey kopyalamak gerekmez.

**Docker ile** (depodaki `docker-compose.yml`): `docker-compose up -d` Postgres 16 + API (3000) + web (5173,
geliştirme sunucusu) kaldırır; `.env` yine `apps/api/.env`'den okunur. Üretim için `docker-compose.prod.yml`.

**Vercel ile** (bu deponun şu anki dağıtımı): `vercel.json` hazırdır; projeyi depoya bağlayın, ortam
değişkenlerini Vercel panelinde girin (`DATABASE_URL` + `DB_SSL=true` yeterli), her push `main`'i dağıtır.
Serverless fonksiyon 60 sn / 1 GB ile ayarlı; ilk istek soğuk başlar.

### 4.4 İlk giriş ve doğrulama

`SEED_DEMO=true` ile oluşan ÇAYKUR hesapları (şifre `SEED_DEMO_PASSWORD`):

| E-posta | Rol | Gördüğü |
| --- | --- | --- |
| `admin@caykur.gov.tr` | Kurum yöneticisi | Her şey, ruhsat onayları |
| `fabrika@caykur.gov.tr` | Fabrika sorumlusu | Envanter, budama, ruhsat onayı |
| `saha@caykur.gov.tr` | Saha personeli | Envanter, kalibrasyon etiketi girişi |
| `denetci@caykur.gov.tr` | Denetçi | Salt okunur |
| `alim@caykur.gov.tr`, `finans@caykur.gov.tr` | Alım yeri, finans | Çay Envanteri menüsünü **görmez** |

Kontrol listesi:

1. `GET /api/health` → 200.
2. `admin@caykur.gov.tr` ile giriş → sol menüde "Çay Envanteri".
3. `/caykur/tea-inventory` → **Bölge** sekmesi: Rize / Trabzon / Artvin / Giresun kartları, Trabzon → Of altında
   12 mahalle, harita sınırları.
4. Çataldere → Budama Takibi → bir müstahsilde **Kanıt dosyası (PDF)** inmeli (Türkçe karakterler ve uydu
   kesitleri görünüyorsa fontlar ve `APP_URL` doğrudur).
5. Ruhsatlandırma → bir bahçede "Alt bölünme" → harita editörü açılmalı (leaflet-geoman yüklü).
6. Envanter haritasında boş bir noktaya tıklayınca TKGM ada/parsel gelmeli (tarayıcıdan doğrudan TKGM'ye gider;
   kurumsal ağ dışarı çıkışı kesiyorsa çalışmaz, uygulamayı etkilemez).

### 4.5 Sık karşılaşılan sorunlar

| Belirti | Neden / çözüm |
| --- | --- |
| API açılmıyor, "ValidationError … required" | `.env`'de zorunlu değişken eksik (bkz. 4.2) |
| Bölge sekmesi boş, log'da "Imported" yok | `SEED_DEMO` `true` değil ya da `dist/tea-inventory/seed-data` boş → `nest-cli.json` assets girişi silinmiş, `pnpm build:api` yeniden |
| Paket değişti ama site eskisini gösteriyor | İçe aktarma yalnız `generatedAt` değişince yapılır; paket yeniden üretilmeli |
| PDF 500 ya da kutu karakterler | Fontlar koda gömülü, bu olmaz; 500 ise `APP_URL` yanlış, API görüntüleri kendi adresinden çekemiyor |
| PDF/rapor zaman aşımı | Ters vekil zaman aşımını 120 sn yapın |
| Yönetilen Postgres'e bağlanamıyor | `DB_SSL=true` |
| Vite dev sunucusu "EBUSY" ile çöküyor | `public/inventory-imagery` dosyaları çalışırken üzerine yazıldı; yeniden başlatın |

## 5. Ortam değişkenleri (özet)

| Değişken | Not |
| --- | --- |
| `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE`, `DB_SSL` | Postgres; yönetilen hizmette `DB_SSL=true`. Alternatif: `DATABASE_URL` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Çekirdekle aynı; `JWT_EXPIRES_IN` (30m), `JWT_REFRESH_EXPIRES_IN` (7d) |
| `SEED_DEMO=true`, `SEED_DEMO_PASSWORD` | Paketleri ve demo ÇAYKUR kullanıcılarını yükler; üretimde şifreyi mutlaka verin |
| `APP_URL` | Sitenin kök adresi; kanıt PDF'leri uydu kesitlerini `APP_URL/inventory-imagery/...` üzerinden çeker |
| `VITE_API_BASE_URL` (web) | API ayrı origin'deyse; aynı origin'de `/api` proxy yeterli |
| R2 / Resend / Gemini | İsteğe bağlı, çekirdekteki gibi |

TKGM parsel sorgusu tarayıcıdan `cbsapi.tkgm.gov.tr` halka açık servisine gider; günlük sorgu kotası IP
başınadır (~200–250). Harici anahtar gerekmez.

## 6. Roller ve menü

Modülün tamamı `CaykurRole` ile korunur: `KURUM_ADMIN`, `FABRIKA_SORUMLUSU`, `SAHA_PERSONELI`, `DENETCI`
(alım yeri / finans rolleri görmez). Ruhsat işlemlerinde onay yalnız `KURUM_ADMIN` ve `FABRIKA_SORUMLUSU`;
kalibrasyon etiketi `SAHA_PERSONELI` girer. Menü girişi `nav.ts` içinde "Çay Envanteri".

## 7. Çayhesabım.com koduna aktarma (önerilen sıra)

1. `feat/tea-inventory` dalını çayhesabım.com deposuna çekin, `main` ile birleştirin (çakışma beklenen
   dosyalar: `app.module.ts`, `main.ts`, `router/index.ts`, `nav.ts`, `roles.ts`, `api.ts`, `package.json`).
2. `pnpm install` (lockfile güncel).
3. `nest-cli.json` assets girişinin kaldığını doğrulayın; `pnpm build:api && pnpm build:web`.
4. Ortam değişkenlerini verin, API'yi `SEED_DEMO=true` ile açın; logda
   `Imported tea inventory trabzon-of-...` satırlarını görün.
5. `/caykur/tea-inventory` → Bölge sekmesi 12 mahalleyi listelemeli; Budama Takibi → "Kanıt dosyası (PDF)"
   indirilebilmeli (fontlar ve `APP_URL` doğru demektir).
6. Vercel'e özel dosyalar (`api/index.js`, `serverless.ts`, `vercel.json`, `.vercelignore`,
   `managed-postgres-env.ts`) klasik sunucuda silinebilir.

## 8. Bilinen sınırlar

- Ruhsat/müstahsil verisi **DEMO** üretimidir; her ekranda etiketlidir. Gerçek ÇAYKUR verisi geldiğinde
  içe aktarma şablonu ayrıca yazılacak.
- Budama ve sağlık kararları saha etiketiyle kalibre edilmedi; idari ön değerlendirmedir.
- Mahalle paketleri motorun çıktısıdır; yeni mahalle eklemek sitede değil motorda yapılır, sonra paket kopyalanır.
