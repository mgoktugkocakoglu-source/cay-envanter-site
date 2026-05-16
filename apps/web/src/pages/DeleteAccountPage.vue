<script setup lang="ts">
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';

const contactEmail = 'destek@cayhesabim.com';
const appName = 'Çay Hesabım';

const form = ref({
  fullName: '',
  email: '',
  reason: '',
  acknowledge: false,
});
const submitLoading = ref(false);
const submitError = ref('');
const submitted = ref(false);

const mailtoLink = computed(() => {
  const subject = encodeURIComponent(`${appName} — Hesap Silme Talebi`);
  const body = encodeURIComponent(
    `Ad Soyad: ${form.value.fullName || ''}\n` +
    `Hesap E-posta: ${form.value.email || ''}\n` +
    `Sebep (opsiyonel): ${form.value.reason || ''}\n\n` +
    `Bu hesaba ait tüm verilerin (profil, tarlalar, hasatlar, ödemeler, ilanlar, ` +
    `topluluk gönderileri ve yorumları) ${appName} sistemlerinden kalıcı olarak ` +
    `silinmesini talep ediyorum.`,
  );
  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
});

function handleSubmit() {
  submitError.value = '';

  if (!form.value.fullName.trim()) {
    submitError.value = 'Ad Soyad gereklidir';
    return;
  }
  if (!form.value.email.trim() || !/.+@.+\..+/.test(form.value.email)) {
    submitError.value = 'Geçerli bir e-posta adresi girin';
    return;
  }
  if (!form.value.acknowledge) {
    submitError.value = 'Silme işleminin geri alınamaz olduğunu onaylamalısınız';
    return;
  }

  submitLoading.value = true;
  // Trigger the user's mail client; we don't auto-process here for security.
  window.location.href = mailtoLink.value;
  submitLoading.value = false;
  submitted.value = true;
}
</script>

<template>
  <div class="legal-page">
    <header class="legal-header">
      <RouterLink to="/" class="legal-logo">
        <span class="legal-logo-icon">🍃</span>
        <span>{{ appName }}</span>
      </RouterLink>
    </header>

    <main class="legal-container">
      <article class="legal-card card card-elevated">
        <h1 class="legal-title">Hesap ve Veri Silme</h1>
        <p class="legal-meta">
          Bu sayfa, {{ appName }} hesabınızı ve hesabınıza bağlı verileri silme
          seçeneklerinizi açıklar. Google Play Veri Güvenliği gereklilikleri
          uyarınca uygulama içinden ve web üzerinden silme talebi mümkündür.
        </p>

        <!-- ── 1) In-app deletion ── -->
        <section class="legal-section">
          <h2>1. Uygulama İçinden Silme (Önerilen)</h2>
          <p>Hesabınızı uygulamadan birkaç adımda kalıcı olarak silebilirsiniz:</p>
          <ol class="steps-list">
            <li>Uygulamaya giriş yapın.</li>
            <li>
              <strong>Ayarlar &raquo; Hesap</strong> sekmesine gidin (alt menüden veya
              profil simgesinden ulaşabilirsiniz).
            </li>
            <li>Sayfanın altındaki <strong>Tehlikeli Bölge</strong> kartında <strong>“Hesabımı Sil”</strong> butonuna basın.</li>
            <li>Açılan pencerede mevcut şifrenizi girin ve onay alanına <code>SİL</code> yazın.</li>
            <li><strong>“Hesabımı Kalıcı Olarak Sil”</strong> butonuna tıklayın.</li>
          </ol>
          <p class="hint-text">
            İşlem tamamlandıktan sonra otomatik olarak çıkış yapılır ve hesabınız ile
            tüm verileriniz veritabanından <strong>geri alınamaz</strong> şekilde silinir.
          </p>
          <RouterLink to="/login" class="btn btn-primary">Uygulamaya Giriş Yap</RouterLink>
        </section>

        <!-- ── 2) Web request form ── -->
        <section class="legal-section">
          <h2>2. Web Üzerinden Silme Talebi</h2>
          <p>
            Uygulamaya erişiminiz yoksa (örn. şifrenizi unuttuysanız ve sıfırlama
            yapamıyorsanız) aşağıdaki formu doldurarak bize silme talebi
            iletebilirsiniz. Talebiniz <strong>en geç 30 gün</strong> içinde işleme alınır.
          </p>

          <div v-if="submitted" class="message-box message-info">
            <p>
              <strong>Talebiniz e-posta istemcinizde açıldı.</strong> Lütfen e-postayı
              <code>{{ contactEmail }}</code> adresine gönderdiğinizden emin olun.
              Onayınızı aldıktan sonra hesabınız 30 gün içinde silinecektir.
            </p>
          </div>

          <form v-else class="delete-form" @submit.prevent="handleSubmit">
            <div class="form-group">
              <label class="form-label" for="fullName">Ad Soyad *</label>
              <input
                id="fullName"
                v-model="form.fullName"
                type="text"
                class="form-input"
                placeholder="Hesabınızdaki ad soyadınız"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="email">Hesap E-posta Adresi *</label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                class="form-input"
                placeholder="ornek@eposta.com"
                required
              />
              <span class="form-help">
                Hesabınıza kayıtlı e-posta adresi — kimliğinizi doğrulamak için
                gereklidir.
              </span>
            </div>

            <div class="form-group">
              <label class="form-label" for="reason">Sebep (opsiyonel)</label>
              <textarea
                id="reason"
                v-model="form.reason"
                class="form-input"
                rows="3"
                placeholder="Talebinizin sebebini paylaşabilirsiniz (zorunlu değil)"
              ></textarea>
            </div>

            <div class="form-check">
              <input
                id="acknowledge"
                v-model="form.acknowledge"
                type="checkbox"
              />
              <label for="acknowledge">
                Hesabımın ve tüm verilerimin <strong>kalıcı olarak</strong> silineceğini
                ve bu işlemin geri alınamayacağını anlıyorum.
              </label>
            </div>

            <p v-if="submitError" class="form-error" role="alert">{{ submitError }}</p>

            <button type="submit" class="btn btn-danger btn-block" :disabled="submitLoading">
              {{ submitLoading ? 'Hazırlanıyor...' : 'Silme Talebimi E-posta ile Gönder' }}
            </button>
          </form>

          <p class="hint-text">
            Form e-posta istemcinizi açar ve aşağıdaki adrese hazır bir mesaj
            iletir:
            <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>
          </p>
        </section>

        <!-- ── 3) What gets deleted ── -->
        <section class="legal-section">
          <h2>3. Hangi Veriler Silinir?</h2>
          <p>Hesabınızı sildiğinizde aşağıdaki veriler kalıcı olarak silinir:</p>
          <ul>
            <li><strong>Hesap bilgileri:</strong> Ad-soyad, e-posta, telefon, şifre, profil fotoğrafı, kullanıcı tipi.</li>
            <li><strong>Çay işletmesi verileri:</strong> Tarla kayıtları, hasat kayıtları, ödeme/alacak kayıtları.</li>
            <li><strong>Sosyal hub içerikleri:</strong> İş ilanları, işçi ilanları, topluluk gönderileri ve yorumları, beğeniler.</li>
            <li><strong>Oturumlar:</strong> Aktif tüm oturum ve refresh token kayıtları.</li>
            <li><strong>Yüklediğiniz medya:</strong> Avatar ve ilan görselleri.</li>
          </ul>
        </section>

        <!-- ── 4) What may be retained ── -->
        <section class="legal-section">
          <h2>4. Saklanabilen Veriler</h2>
          <p>
            Aşağıdaki veriler, ilgili mevzuat veya meşru menfaat çerçevesinde
            sınırlı süreyle saklanabilir:
          </p>
          <ul>
            <li>
              <strong>Yedeklemeler:</strong> Mevcut yedekleme rotasyonu içinde kademeli
              olarak en geç <strong>30 gün</strong> içinde temizlenir.
            </li>
            <li>
              <strong>Yasal yükümlülükler:</strong> Vergi, fatura veya hukuki
              uyuşmazlıklar gibi konularda mevzuatın öngördüğü süreyle saklanması
              gereken veriler (varsa).
            </li>
            <li>
              <strong>Anonim log kayıtları:</strong> Kişiyi tanımlamayan teknik log
              ve kullanım istatistikleri.
            </li>
          </ul>
        </section>

        <!-- ── 5) Contact ── -->
        <section class="legal-section">
          <h2>5. Sorularınız mı Var?</h2>
          <p>
            Silme süreci veya kişisel verileriniz hakkında sorularınız için bize
            ulaşın:
          </p>
          <ul>
            <li><strong>E-posta:</strong> <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a></li>
            <li>
              <strong>Gizlilik Politikası:</strong>
              <RouterLink to="/privacy-policy">Gizlilik Politikamızı görüntüleyin</RouterLink>
            </li>
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

.legal-section p,
.legal-section li {
  color: var(--color-text-secondary, #374151);
}

.legal-section ul,
.legal-section ol.steps-list {
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

.delete-form {
  margin: var(--space-4, 16px) 0;
}

.form-group {
  margin-bottom: var(--space-4, 16px);
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--color-text-primary, #111);
}

.form-input {
  width: 100%;
  height: var(--control-height);
  padding: 0 12px;
  background: var(--color-bg-secondary, #f5f7fa);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-md, 8px);
  color: var(--color-text-primary, #111);
  font-size: 15px;
  font-family: inherit;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary, #16a34a);
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
}

.form-help {
  display: block;
  font-size: 12px;
  color: var(--color-text-muted, #6b7280);
  margin-top: 4px;
}

.form-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: var(--space-4, 16px) 0;
}

.form-check input[type="checkbox"] {
  margin-top: 4px;
  flex-shrink: 0;
}

.form-check label {
  font-size: 14px;
  color: var(--color-text-secondary, #374151);
  line-height: 1.5;
}

.form-error {
  color: var(--color-danger, #ef4444);
  font-size: 13px;
  margin: 8px 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--radius-md, 8px);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.btn-block {
  width: 100%;
}

.btn-primary {
  background: var(--color-primary, #16a34a);
  color: #fff;
}

.btn-secondary {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--color-text-primary, #111);
}

.btn-danger {
  background: var(--color-danger, #ef4444);
  color: #fff;
}

.btn:hover:not(:disabled) {
  opacity: 0.9;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message-box {
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  margin: var(--space-4, 16px) 0;
}

.message-info {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #1e40af;
}

.hint-text {
  font-size: 13px;
  color: var(--color-text-muted, #6b7280);
  margin-top: var(--space-3, 12px);
}

code {
  background: var(--color-bg-tertiary, #f3f4f6);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.9em;
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
