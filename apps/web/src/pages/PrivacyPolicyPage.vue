<script setup lang="ts">
import { RouterLink } from 'vue-router';

const lastUpdated = '01.05.2026';
const effectiveDate = '01.05.2026';
const contactEmail = 'destek@cayhesabim.com';
const websiteUrl = 'https://cayhesabim.com';
</script>

<template>
  <div class="legal-page">
    <header class="legal-header">
      <RouterLink to="/" class="legal-logo">
        <span class="legal-logo-icon">🍃</span>
        <span>Çay Hesabım</span>
      </RouterLink>
    </header>

    <main class="legal-container">
      <article class="legal-card card card-elevated">
        <h1 class="legal-title">Gizlilik Politikası</h1>
        <p class="legal-meta">
          <strong>Yürürlük Tarihi:</strong> {{ effectiveDate }}<br>
          <strong>Son Güncelleme:</strong> {{ lastUpdated }}
        </p>

        <section class="legal-section">
          <p>
            Çay Hesabım (<a :href="websiteUrl">cayhesabim.com</a>) olarak gizliliğinize
            önem veriyoruz. Bu Gizlilik Politikası; web sitemizi, mobil uygulamamızı ve
            ilgili hizmetlerimizi (birlikte “Hizmet”) kullandığınızda kişisel
            verilerinizin nasıl toplandığını, kullanıldığını, paylaşıldığını ve
            korunduğunu açıklamaktadır. Hizmeti kullanarak bu politikayı kabul etmiş
            sayılırsınız.
          </p>
        </section>

        <section class="legal-section">
          <h2>1. Veri Sorumlusu</h2>
          <p>
            6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) ve Avrupa Birliği
            Genel Veri Koruma Tüzüğü (“GDPR”) kapsamında veri sorumlusu Çay Hesabım’dır.
            Bize aşağıdaki iletişim bilgileri üzerinden ulaşabilirsiniz:
          </p>
          <ul>
            <li><strong>E-posta:</strong> <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a></li>
            <li><strong>Web Sitesi:</strong> <a :href="websiteUrl">{{ websiteUrl }}</a></li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>2. Topladığımız Veriler</h2>
          <h3>2.1. Sizin Sağladığınız Bilgiler</h3>
          <ul>
            <li><strong>Hesap Bilgileri:</strong> Ad-soyad, e-posta adresi, telefon numarası, şifre (şifrelenmiş olarak saklanır).</li>
            <li><strong>Profil Bilgileri:</strong> Profil fotoğrafı, bölge/şehir bilgisi, kullanıcı rolü (üretici, işçi, firma vb.).</li>
            <li><strong>Çay İşletmesi Verileri:</strong> Tarla bilgileri (ad, konum, alan), hasat kayıtları, ödeme/alacak kayıtları, firma bilgileri.</li>
            <li><strong>Sosyal Hub İçerikleri:</strong> İş ilanları, işçi ilanları, topluluk gönderileri, yorumlar, ekipman/pazar yeri ilanları, mesajlaşma içerikleri.</li>
            <li><strong>İletişim İçerikleri:</strong> Destek talepleri, geri bildirimler, e-posta yazışmaları.</li>
          </ul>

          <h3>2.2. Otomatik Olarak Toplanan Bilgiler</h3>
          <ul>
            <li><strong>Cihaz Bilgileri:</strong> Cihaz modeli, işletim sistemi sürümü, dil ayarları, benzersiz cihaz tanımlayıcıları.</li>
            <li><strong>Kullanım Verileri:</strong> Görüntülenen sayfalar, tıklamalar, oturum süresi, hata kayıtları.</li>
            <li><strong>Log Kayıtları:</strong> IP adresi, tarayıcı türü, erişim zamanı, yönlendiren URL.</li>
            <li><strong>Çerezler ve Benzeri Teknolojiler:</strong> Oturum yönetimi ve tercihlerinizin hatırlanması için kullanılan çerezler.</li>
          </ul>

          <h3>2.3. Konum Bilgisi</h3>
          <p>
            Tarla kaydı, iş ilanları ve harita özellikleri için yaklaşık veya kesin
            konum bilginizi <strong>yalnızca açık izninizle</strong> kullanırız. Konum
            iznini cihaz ayarlarınızdan istediğiniz zaman geri alabilirsiniz.
          </p>

          <h3>2.4. Kamera ve Galeri</h3>
          <p>
            Profil fotoğrafı, ilan görselleri ve topluluk gönderileri için cihazınızın
            kamerasına veya galerisine erişim isteyebiliriz. Bu erişim yalnızca sizin
            seçtiğiniz dosyalarla sınırlıdır.
          </p>
        </section>

        <section class="legal-section">
          <h2>3. Verileri Kullanma Amaçlarımız</h2>
          <ul>
            <li>Hizmeti sağlamak, hesabınızı oluşturmak ve yönetmek.</li>
            <li>Çay işletmenize ait kayıtları (tarla, hasat, ödeme) tutmak ve raporlamak.</li>
            <li>Sosyal hub içinde ilan, mesajlaşma ve topluluk özelliklerini sunmak.</li>
            <li>E-posta doğrulama, şifre sıfırlama ve hesap güvenliğini sağlamak.</li>
            <li>Hizmeti iyileştirmek, hata ayıklamak ve performans analizi yapmak.</li>
            <li>Yasal yükümlülüklere ve mahkeme/idari makam taleplerine uymak.</li>
            <li>Spam, dolandırıcılık ve kötüye kullanımları önlemek.</li>
            <li>Açık rızanız varsa pazarlama ve bilgilendirme iletişimleri göndermek.</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>4. Hukuki Dayanak</h2>
          <p>Kişisel verilerinizi şu hukuki sebeplere dayanarak işliyoruz:</p>
          <ul>
            <li>Sözleşmenin ifası (Hizmet sözleşmemiz).</li>
            <li>Açık rızanız (örn. konum, pazarlama iletişimleri).</li>
            <li>Hukuki yükümlülüklerimiz (vergi, KVKK, GDPR vb.).</li>
            <li>Meşru menfaatlerimiz (güvenlik, dolandırıcılık önleme, ürün geliştirme).</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>5. Verilerin Paylaşımı</h2>
          <p>
            Kişisel verilerinizi <strong>satmayız</strong>. Verileriniz aşağıdaki sınırlı
            durumlarda paylaşılabilir:
          </p>
          <ul>
            <li>
              <strong>Hizmet Sağlayıcılar:</strong> Sunucu barındırma (cloud hosting),
              e-posta gönderimi, hata izleme ve analiz hizmeti veren güvenilir üçüncü
              taraflar — yalnızca hizmeti sağlamak için gerekli ölçüde.
            </li>
            <li>
              <strong>Diğer Kullanıcılar:</strong> Sosyal hub’da paylaştığınız içerikler
              (iş ilanı, topluluk gönderisi vb.) ve profil bilginiz diğer kullanıcılar
              tarafından görüntülenebilir.
            </li>
            <li>
              <strong>Yasal Talepler:</strong> Mahkeme kararı veya yetkili makam talebi
              halinde mevzuat gereği gerekli paylaşımlar yapılabilir.
            </li>
            <li>
              <strong>İşletme Devri:</strong> Birleşme, satın alma veya varlık devri
              durumunda verileriniz devralan tarafa aktarılabilir; size önceden bilgi
              verilir.
            </li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>6. Veri Saklama Süresi</h2>
          <p>
            Kişisel verilerinizi yalnızca işleme amacının gerektirdiği süre boyunca
            saklarız. Hesabınızı sildiğinizde:
          </p>
          <ul>
            <li>Profil ve hesap verileriniz <strong>30 gün</strong> içinde silinir.</li>
            <li>Yasal yükümlülükler gereği saklanması gereken bazı veriler ilgili mevzuatın öngördüğü süreyle saklanır.</li>
            <li>Yedeklemeler kademeli olarak rotasyon süresi içinde temizlenir.</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>7. Veri Güvenliği</h2>
          <p>
            Verilerinizi korumak için sektör standardı önlemler alıyoruz: HTTPS/TLS
            şifreleme, parola hashleme (bcrypt benzeri), erişim kontrolü, düzenli
            güvenlik güncellemeleri ve güvenlik logları. Ancak hiçbir sistem %100
            güvenli değildir; veri ihlali durumunda sizi ve ilgili otoriteleri
            mevzuatın gerektirdiği süre içinde bilgilendireceğiz.
          </p>
        </section>

        <section class="legal-section">
          <h2>8. Çocukların Gizliliği</h2>
          <p>
            Hizmetimiz <strong>16 yaşın altındaki</strong> kişilere yönelik değildir. 16
            yaş altı bir kullanıcıya ait veri topladığımızı fark edersek, bu veriyi
            derhal sileriz. Bu yaş grubunda bir hesap olduğunu düşünüyorsanız lütfen
            bizimle iletişime geçin.
          </p>
        </section>

        <section class="legal-section">
          <h2>9. KVKK ve GDPR Kapsamındaki Haklarınız</h2>
          <p>İlgili mevzuatlar gereği şu haklara sahipsiniz:</p>
          <ul>
            <li>Verilerinizin işlenip işlenmediğini öğrenme.</li>
            <li>Hangi verilerin işlendiğine ilişkin bilgi talep etme.</li>
            <li>Verilerin işlenme amacını ve uygun kullanılıp kullanılmadığını öğrenme.</li>
            <li>Yurt içi/yurt dışı aktarılan üçüncü tarafları öğrenme.</li>
            <li>Verilerin düzeltilmesini, silinmesini veya yok edilmesini isteme.</li>
            <li>İşlemenin sınırlandırılmasını isteme.</li>
            <li>Verilerin taşınabilirliğini talep etme.</li>
            <li>Otomatik sistemlerle alınan kararlara itiraz etme.</li>
            <li>Açık rızayı dilediğiniz zaman geri çekme.</li>
            <li>Zarar halinde tazminat talep etme.</li>
          </ul>
          <p>
            Haklarınızı kullanmak için <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>
            adresine yazılı başvuruda bulunabilirsiniz. Başvurunuzu en geç 30 gün içinde
            ücretsiz olarak sonuçlandırırız.
          </p>
        </section>

        <section class="legal-section">
          <h2>10. Hesap ve Veri Silme</h2>
          <p>
            Hesabınızı uygulama içinden <strong>Ayarlar &raquo; Hesap Sil</strong>
            adımıyla silebilirsiniz. Ayrıca
            <a :href="`mailto:${contactEmail}?subject=Hesap%20Silme%20Talebi`">{{ contactEmail }}</a>
            adresine “Hesap Silme Talebi” konulu e-posta gönderebilirsiniz.
          </p>
        </section>

        <section class="legal-section">
          <h2>11. Uluslararası Veri Aktarımı</h2>
          <p>
            Sunucularımız Türkiye ve/veya Avrupa Birliği ülkelerinde barındırılabilir.
            Verilerin yurt dışına aktarımı yapılması halinde KVKK ve GDPR’ın gerektirdiği
            güvenceler (standart sözleşme maddeleri vb.) sağlanır.
          </p>
        </section>

        <section class="legal-section">
          <h2>12. Çerezler</h2>
          <p>
            Oturum yönetimi, dil tercihi ve performans analizi için çerezler ve benzeri
            yerel depolama teknolojileri kullanırız. Tarayıcı ayarlarından çerezleri
            engelleyebilir veya silebilirsiniz; ancak bu, Hizmetin bazı özelliklerinin
            çalışmamasına yol açabilir.
          </p>
        </section>

        <section class="legal-section">
          <h2>13. Üçüncü Taraf Bağlantıları</h2>
          <p>
            Hizmet, üçüncü taraf web sitelerine veya hizmetlerine bağlantılar
            içerebilir. Bu üçüncü tarafların gizlilik uygulamalarından sorumlu değiliz;
            ziyaret etmeden önce ilgili gizlilik politikalarını incelemenizi öneririz.
          </p>
        </section>

        <section class="legal-section">
          <h2>14. Politikadaki Değişiklikler</h2>
          <p>
            Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişiklikleri Hizmet
            içinde duyuru veya e-posta yoluyla bildiririz. Güncel sürümün yürürlük
            tarihi sayfanın başında belirtilir. Değişiklikten sonra Hizmeti kullanmaya
            devam etmeniz, güncel politikayı kabul ettiğiniz anlamına gelir.
          </p>
        </section>

        <section class="legal-section">
          <h2>15. İletişim</h2>
          <p>
            Bu Gizlilik Politikası veya kişisel verileriniz hakkında sorularınız için
            bize ulaşın:
          </p>
          <ul>
            <li><strong>E-posta:</strong> <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a></li>
            <li><strong>Web:</strong> <a :href="websiteUrl">{{ websiteUrl }}</a></li>
          </ul>
        </section>

        <div class="legal-footer">
          <RouterLink to="/" class="btn btn-secondary">← Ana Sayfaya Dön</RouterLink>
        </div>
      </article>
    </main>
  </div>
</template>

<style scoped>
.legal-page {
  min-height: 100vh;
  background: var(--color-bg-secondary, #f5f7fa);
  display: flex;
  flex-direction: column;
}

.legal-header {
  padding: var(--space-4, 16px) var(--space-6, 24px);
  background: var(--color-bg-primary, #fff);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.legal-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  font-weight: 700;
  font-size: var(--font-size-lg, 18px);
  color: var(--color-text-primary, #111);
  text-decoration: none;
}

.legal-logo-icon {
  font-size: 24px;
}

.legal-container {
  flex: 1;
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: var(--space-6, 24px) var(--space-4, 16px);
}

.legal-card {
  background: var(--color-bg-primary, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-8, 32px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  line-height: 1.7;
  color: var(--color-text-primary, #1f2937);
}

.legal-title {
  font-size: var(--font-size-2xl, 28px);
  font-weight: 700;
  margin: 0 0 var(--space-3, 12px);
  color: var(--color-text-primary, #111);
}

.legal-meta {
  color: var(--color-text-muted, #6b7280);
  font-size: var(--font-size-sm, 14px);
  margin-bottom: var(--space-6, 24px);
  padding-bottom: var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.legal-section {
  margin-bottom: var(--space-6, 24px);
}

.legal-section h2 {
  font-size: var(--font-size-xl, 20px);
  font-weight: 600;
  margin: var(--space-6, 24px) 0 var(--space-3, 12px);
  color: var(--color-text-primary, #111);
}

.legal-section h3 {
  font-size: var(--font-size-md, 16px);
  font-weight: 600;
  margin: var(--space-4, 16px) 0 var(--space-2, 8px);
  color: var(--color-text-primary, #111);
}

.legal-section p,
.legal-section li {
  color: var(--color-text-secondary, #374151);
}

.legal-section ul {
  padding-left: var(--space-6, 24px);
  margin: var(--space-2, 8px) 0;
}

.legal-section li {
  margin-bottom: var(--space-2, 8px);
}

.legal-section a {
  color: var(--color-primary, #16a34a);
  text-decoration: underline;
}

.legal-footer {
  margin-top: var(--space-8, 32px);
  padding-top: var(--space-4, 16px);
  border-top: 1px solid var(--color-border, #e5e7eb);
  text-align: center;
}

@media (max-width: 600px) {
  .legal-card {
    padding: var(--space-4, 16px);
  }
  .legal-title {
    font-size: 22px;
  }
}
</style>
