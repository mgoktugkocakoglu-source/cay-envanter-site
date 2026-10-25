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

## 4. Ortam değişkenleri

| Değişken | Not |
| --- | --- |
| `DB_*` ya da `DATABASE_URL` | Postgres; yönetilen hizmette `DB_SSL=true` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Çekirdekle aynı |
| `SEED_DEMO=true` | Paketleri ve demo ÇAYKUR kullanıcılarını yükler (demo şifre `caykur-seed.service.ts` içinde varsayılan; üretimde `SEED_DEMO_PASSWORD` verin) |
| `APP_URL` | Sitenin kök adresi; kanıt PDF'leri uydu kesitlerini `APP_URL/inventory-imagery/...` üzerinden çeker |
| `VITE_API_BASE_URL` (web) | API ayrı origin'deyse; aynı origin'de `/api` proxy yeterli |
| R2 / Resend / Gemini | İsteğe bağlı, çekirdekteki gibi |

TKGM parsel sorgusu tarayıcıdan `cbsapi.tkgm.gov.tr` halka açık servisine gider; günlük sorgu kotası IP
başınadır (~200–250). Harici anahtar gerekmez.

## 5. Roller ve menü

Modülün tamamı `CaykurRole` ile korunur: `KURUM_ADMIN`, `FABRIKA_SORUMLUSU`, `SAHA_PERSONELI`, `DENETCI`
(alım yeri / finans rolleri görmez). Ruhsat işlemlerinde onay yalnız `KURUM_ADMIN` ve `FABRIKA_SORUMLUSU`;
kalibrasyon etiketi `SAHA_PERSONELI` girer. Menü girişi `nav.ts` içinde "Çay Envanteri".

## 6. Taşıma adımları (önerilen sıra)

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

## 7. Bilinen sınırlar

- Ruhsat/müstahsil verisi **DEMO** üretimidir; her ekranda etiketlidir. Gerçek ÇAYKUR verisi geldiğinde
  içe aktarma şablonu ayrıca yazılacak.
- Budama ve sağlık kararları saha etiketiyle kalibre edilmedi; idari ön değerlendirmedir.
- Mahalle paketleri motorun çıktısıdır; yeni mahalle eklemek sitede değil motorda yapılır, sonra paket kopyalanır.
