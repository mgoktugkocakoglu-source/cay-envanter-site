<script setup lang="ts">
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Info } from '@lucide/vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { PageContainer, PageHeader, Spinner } from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const contactEmail = 'destek@cayhesabim.com';
const appName = 'Çay Hesabım';

const linkClass = 'text-primary underline underline-offset-4';

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

function onAcknowledgeChange(value: boolean | 'indeterminate') {
    form.value.acknowledge = value === true;
}

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
    <AuthLayout variant="page">
        <PageContainer size="narrow">
            <PageHeader
                title="Hesap ve Veri Silme"
                :description="`Bu sayfa, ${appName} hesabınızı ve hesabınıza bağlı verileri silme seçeneklerinizi açıklar. Google Play Veri Güvenliği gereklilikleri uyarınca uygulama içinden ve web üzerinden silme talebi mümkündür.`"
                back-to="/"
                back-label="Ana sayfaya dön"
            />

            <article class="space-y-8 rounded-lg border bg-card p-4 text-sm leading-relaxed text-muted-foreground md:p-6">
                <!-- 1) In-app deletion -->
                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">1. Uygulama İçinden Silme (Önerilen)</h2>
                    <p>Hesabınızı uygulamadan birkaç adımda kalıcı olarak silebilirsiniz:</p>
                    <ol class="list-decimal space-y-1 pl-5">
                        <li>Uygulamaya giriş yapın.</li>
                        <li>
                            <strong class="font-medium text-foreground">Ayarlar &raquo; Hesap</strong> sekmesine gidin (alt menüden veya profil
                            simgesinden ulaşabilirsiniz).
                        </li>
                        <li>
                            Sayfanın altındaki <strong class="font-medium text-foreground">Tehlikeli Bölge</strong> kartında
                            <strong class="font-medium text-foreground">“Hesabımı Sil”</strong> butonuna basın.
                        </li>
                        <li>
                            Açılan pencerede mevcut şifrenizi girin ve onay alanına
                            <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">SİL</code> yazın.
                        </li>
                        <li><strong class="font-medium text-foreground">“Hesabımı Kalıcı Olarak Sil”</strong> butonuna tıklayın.</li>
                    </ol>
                    <p class="text-xs">
                        İşlem tamamlandıktan sonra otomatik olarak çıkış yapılır ve hesabınız ile tüm verileriniz veritabanından
                        <strong class="font-medium text-foreground">geri alınamaz</strong> şekilde silinir.
                    </p>
                    <Button as-child class="h-11 md:h-9">
                        <RouterLink to="/login">Uygulamaya Giriş Yap</RouterLink>
                    </Button>
                </section>

                <!-- 2) Web request form -->
                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">2. Web Üzerinden Silme Talebi</h2>
                    <p>
                        Uygulamaya erişiminiz yoksa (örn. şifrenizi unuttuysanız ve sıfırlama yapamıyorsanız) aşağıdaki formu doldurarak bize
                        silme talebi iletebilirsiniz. Talebiniz <strong class="font-medium text-foreground">en geç 30 gün</strong> içinde
                        işleme alınır.
                    </p>

                    <Alert v-if="submitted" variant="info">
                        <Info aria-hidden="true" />
                        <AlertTitle>Talebiniz e-posta istemcinizde açıldı.</AlertTitle>
                        <AlertDescription>
                            Lütfen e-postayı
                            <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{{ contactEmail }}</code>
                            adresine gönderdiğinizden emin olun. Onayınızı aldıktan sonra hesabınız 30 gün içinde silinecektir.
                        </AlertDescription>
                    </Alert>

                    <form v-else class="space-y-4" novalidate @submit.prevent="handleSubmit">
                        <div class="space-y-2">
                            <Label for="delete-full-name">Ad Soyad *</Label>
                            <Input
                                id="delete-full-name"
                                v-model="form.fullName"
                                type="text"
                                placeholder="Hesabınızdaki ad soyadınız"
                                autocomplete="name"
                                class="h-11 md:h-9"
                                required
                            />
                        </div>

                        <div class="space-y-2">
                            <Label for="delete-email">Hesap E-posta Adresi *</Label>
                            <Input
                                id="delete-email"
                                v-model="form.email"
                                type="email"
                                placeholder="ornek@eposta.com"
                                autocomplete="email"
                                class="h-11 md:h-9"
                                required
                            />
                            <p class="text-xs text-muted-foreground">Hesabınıza kayıtlı e-posta adresi — kimliğinizi doğrulamak için gereklidir.</p>
                        </div>

                        <div class="space-y-2">
                            <Label for="delete-reason">Sebep (opsiyonel)</Label>
                            <Textarea
                                id="delete-reason"
                                v-model="form.reason"
                                rows="3"
                                placeholder="Talebinizin sebebini paylaşabilirsiniz (zorunlu değil)"
                            />
                        </div>

                        <div class="flex items-start gap-2">
                            <Checkbox id="delete-acknowledge" :model-value="form.acknowledge" class="mt-0.5" @update:model-value="onAcknowledgeChange" />
                            <Label for="delete-acknowledge" class="inline cursor-pointer text-sm leading-relaxed font-normal text-muted-foreground">
                                Hesabımın ve tüm verilerimin <strong class="font-medium text-foreground">kalıcı olarak</strong> silineceğini ve bu
                                işlemin geri alınamayacağını anlıyorum.
                            </Label>
                        </div>

                        <Alert v-if="submitError" variant="destructive">
                            <AlertDescription>{{ submitError }}</AlertDescription>
                        </Alert>

                        <Button type="submit" variant="destructive" class="h-11 w-full" :disabled="submitLoading">
                            <Spinner v-if="submitLoading" />
                            {{ submitLoading ? 'Hazırlanıyor...' : 'Silme Talebimi E-posta ile Gönder' }}
                        </Button>
                    </form>

                    <p class="text-xs">
                        Form e-posta istemcinizi açar ve aşağıdaki adrese hazır bir mesaj iletir:
                        <a :href="`mailto:${contactEmail}`" :class="linkClass">{{ contactEmail }}</a>
                    </p>
                </section>

                <!-- 3) What gets deleted -->
                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">3. Hangi Veriler Silinir?</h2>
                    <p>Hesabınızı sildiğinizde aşağıdaki veriler kalıcı olarak silinir:</p>
                    <ul class="list-disc space-y-1 pl-5">
                        <li><strong class="font-medium text-foreground">Hesap bilgileri:</strong> Ad-soyad, e-posta, telefon, şifre, profil fotoğrafı, kullanıcı tipi.</li>
                        <li><strong class="font-medium text-foreground">Çay işletmesi verileri:</strong> Tarla kayıtları, hasat kayıtları, ödeme/alacak kayıtları.</li>
                        <li><strong class="font-medium text-foreground">Sosyal hub içerikleri:</strong> İş ilanları, işçi ilanları, topluluk gönderileri ve yorumları, beğeniler.</li>
                        <li><strong class="font-medium text-foreground">Oturumlar:</strong> Aktif tüm oturum ve refresh token kayıtları.</li>
                        <li><strong class="font-medium text-foreground">Yüklediğiniz medya:</strong> Avatar ve ilan görselleri.</li>
                    </ul>
                </section>

                <!-- 4) What may be retained -->
                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">4. Saklanabilen Veriler</h2>
                    <p>Aşağıdaki veriler, ilgili mevzuat veya meşru menfaat çerçevesinde sınırlı süreyle saklanabilir:</p>
                    <ul class="list-disc space-y-1 pl-5">
                        <li>
                            <strong class="font-medium text-foreground">Yedeklemeler:</strong> Mevcut yedekleme rotasyonu içinde kademeli olarak
                            en geç <strong class="font-medium text-foreground">30 gün</strong> içinde temizlenir.
                        </li>
                        <li>
                            <strong class="font-medium text-foreground">Yasal yükümlülükler:</strong> Vergi, fatura veya hukuki uyuşmazlıklar gibi
                            konularda mevzuatın öngördüğü süreyle saklanması gereken veriler (varsa).
                        </li>
                        <li>
                            <strong class="font-medium text-foreground">Anonim log kayıtları:</strong> Kişiyi tanımlamayan teknik log ve kullanım
                            istatistikleri.
                        </li>
                    </ul>
                </section>

                <!-- 5) Contact -->
                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">5. Sorularınız mı Var?</h2>
                    <p>Silme süreci veya kişisel verileriniz hakkında sorularınız için bize ulaşın:</p>
                    <ul class="list-disc space-y-1 pl-5">
                        <li><strong class="font-medium text-foreground">E-posta:</strong> <a :href="`mailto:${contactEmail}`" :class="linkClass">{{ contactEmail }}</a></li>
                        <li>
                            <strong class="font-medium text-foreground">Gizlilik Politikası:</strong>
                            <RouterLink to="/privacy-policy" :class="linkClass">Gizlilik Politikamızı görüntüleyin</RouterLink>
                        </li>
                    </ul>
                </section>

                <div class="flex justify-center border-t pt-6">
                    <Button as-child variant="outline" class="h-11 md:h-9">
                        <RouterLink to="/">Ana Sayfaya Dön</RouterLink>
                    </Button>
                </div>
            </article>
        </PageContainer>
    </AuthLayout>
</template>
