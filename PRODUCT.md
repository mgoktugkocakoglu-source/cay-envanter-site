# Product

## Register

product

## Users

Turkish tea producers and the people who work their gardens, primarily in the Black Sea region.

- **Land owners & self-farmers** (`land_owner`, `self_farmer`): own or work tea gardens; manage fields, harvest cycles, and their relationships and deliveries with tea-processing firms.
- **Workers** (`worker`): seasonal and day laborers who find work and connect with producers through the social hub.

**Context of use:** mobile-first. The product ships as a native iOS/Android app (Capacitor) and is most often used on a phone, outdoors, in the field, in bright sunlight, over variable or intermittent connectivity. Tech literacy is mixed: from older producers who track everything on paper today to younger workers fluent with apps. The interface cannot assume a desk, a stable connection, or training.

**Job to be done:** run the tea-production lifecycle from the field, fields and harvest cycles, firm relationships and deliveries, payments and receivables, and reports, and connect with workers, equipment, and a producer community through the social hub.

## Product Purpose

"Çay Üreticisi Platformu" (app name: **Çay Hesabım**) is a digital platform that puts the full tea-production lifecycle in a producer's pocket. Its core is **field and production management**: tracking fields, harvest cycles, the firms that buy the harvest, and the payments and receivables that follow. Around that core, a **Social Hub** connects producers with workers (job listings), equipment, a marketplace, and a community.

It exists because tea production today is tracked on paper, from memory, or scattered across WhatsApp messages, so harvest figures, firm balances, and field history are easy to lose and hard to trust. The platform centralizes that record and makes it dependable and reachable from the garden.

**What success looks like:** a producer, standing in their field with one hand on their phone, can see the state of their gardens, log a harvest, know exactly what a firm owes them, and find a worker, without a manual, a desk, or a perfect signal.

## Budama Ölçüm Modülü

Çay Hesabım, Çaykur personelinin çay budama ölçümünü sahada dijital olarak kaydedebileceği bir **Budama Ölçüm Modülü** içermelidir. Modülün amacı yalnızca budanan alanın metrekare değerini almak değil; üretici, ada/parsel, budanan bölüm geometrisi, ölçüm yöntemi, personel bilgisi, tarih/saat, GPS doğruluğu, fotoğraf ve üretici onayını aynı güvenilir kayıt altında toplamaktır.

Personel akışı: personel girişi yapılır, üretici ve ada/parsel seçilir, parsel haritada görüntülenir, ölçüm yöntemi seçilir, budanan alan çizilir veya GPS noktalarıyla oluşturulur, sistem alanı ve 1/10 budama oranını hesaplar, uyarıları gösterir ve kayıt üretici/personel onayıyla tamamlanır.

Ölçüm yöntemleri:

- **Haritadan işaretleme:** Açık ve uydu görüntüsünde net görünen arazilerde budanan alan poligon olarak çizilir.
- **GPS ile saha ölçümü:** Ağaç altı veya görüntüden seçilemeyen alanlarda personel alan çevresinde yürür ya da köşe noktalarını işaretler.
- **Kontrollü kayıt:** Şüpheli ölçümlerde fotoğraf, konum doğruluğu ve personel notu zorunlu hale gelir.

Sistem personeli aktif olarak uyarmalıdır: çizilen alan parsel dışına taşıyorsa, GPS doğruluğu düşükse, yıllık 1/10 oranı yakalanmıyorsa veya önceki yıl budanan alanla yüksek çakışma varsa kayıt onayından önce durum açıkça gösterilmelidir.

## Brand Personality

**Reliable, simple, practical.** (Güvenilir, sade, pratik.)

- **Voice & tone:** plain Turkish, direct and respectful, no jargon and no hype. It speaks to a working farmer getting a task done, not to a software buyer. All user-facing copy is Turkish; code, schema, and API contracts stay English.
- **Emotional goals:** trust (the money and harvest figures are right and won't be lost), ease (the task is done in a few taps), and quiet competence (capable without being intimidating).

## Anti-references

- **Cold, complex corporate ERP / accounting software.** No crowded screens, no training requirement, no intimidating wall of menus, fields, and enterprise jargon. The product manages real production and money data but must never *feel* like enterprise accounting software. When a screen starts to look like an ERP form, simplify it.
- By extension, avoid the generic-template look (purple-to-blue gradients, cards nested in cards, an eyebrow over every section): identity here comes from being a focused, trustworthy field tool, not from SaaS decoration.

## Design Principles

1. **Field-first, not desk-first.** Every core task must be completable one-handed on a phone, outdoors, and tolerant of a weak connection. Design for the garden, not the office.
2. **Trust through clarity.** The numbers, harvest kilos, prices, balances, receivables, are the product's promise. Show them unambiguously and never bury, round away, or approximate them. The user must always believe the figure on screen.
3. **Earned familiarity over novelty.** Use standard, recognizable patterns so a non-technical producer never has to *learn* the tool. The interface should disappear into the task; this is the direct antidote to the ERP anti-reference.
4. **Say less, plainly.** Plain Turkish, short labels, one clear primary action per screen. Remove before adding. Density is allowed only where the data genuinely demands it.
5. **Inclusive by default.** Large touch targets, high contrast for sunlight, readable type, respected reduced-motion, and teaching empty/error states are the baseline for every screen, not features to add later.

## Accessibility & Inclusion

- **Target: WCAG 2.1 AA.** Body text ≥ 4.5:1 against its background; large text (≥ 18px, or bold ≥ 14px) ≥ 3:1. Verify contrast in **both** the default light theme and the optional dark theme. Avoid muted-gray-on-tinted-white, the most common readability failure.
- **Touch targets ≥ 44 × 44px.** Mobile and outdoor use is the primary context; tap areas must be forgiving.
- **Sunlight readability.** Favor high contrast and avoid low-contrast "elegant" grays; the screen is often viewed in bright daylight.
- **Large, readable typography and plain language.** Clear labels, simple Turkish, no jargon, to serve mixed and lower tech literacy.
- **Reduced motion is not optional.** Every animation needs a `@media (prefers-reduced-motion: reduce)` alternative (crossfade or instant). Motion conveys state, never decoration.
- **Teaching error and empty states, in Turkish.** Error messages and empty states explain what happened and the next step; they never leave the user stranded.
- **Tolerate intermittent connectivity.** Clear loading and error-recovery states for slow or dropped networks.
