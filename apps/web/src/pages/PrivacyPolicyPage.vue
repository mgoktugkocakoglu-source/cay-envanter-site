<script setup lang="ts">
import { RouterLink } from 'vue-router';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { PageContainer, PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';

const lastUpdated = '01.05.2026';
const effectiveDate = '01.05.2026';
const contactEmail = 'destek@cayhesabim.com';
const websiteUrl = 'https://cayhesabim.com';

const linkClass = 'text-primary underline underline-offset-4';
</script>

<template>
    <AuthLayout variant="page">
        <PageContainer size="narrow">
            <PageHeader title="Gizlilik Politikası" back-to="/" back-label="Ana sayfaya dön">
                <template #meta>
                    <p class="text-xs text-muted-foreground">
                        <strong class="font-medium text-foreground">Yürürlük Tarihi:</strong> {{ effectiveDate }}
                        <span aria-hidden="true"> · </span>
                        <strong class="font-medium text-foreground">Son Güncelleme:</strong> {{ lastUpdated }}
                    </p>
                </template>
            </PageHeader>

            <article class="space-y-8 rounded-lg border bg-card p-4 text-sm leading-relaxed text-muted-foreground md:p-6">
                <section class="space-y-4">
                    <p>
                        Çay Hesabım (<a :href="websiteUrl" :class="linkClass">cayhesabim.com</a>) olarak gizliliğinize önem veriyoruz. Bu
                        Gizlilik Politikası; web sitemizi, mobil uygulamamızı ve ilgili hizmetlerimizi (birlikte “Hizmet”) kullandığınızda
                        kişisel verilerinizin nasıl toplandığını, kullanıldığını, paylaşıldığını ve korunduğunu açıklamaktadır. Hizmeti
                        kullanarak bu politikayı kabul etmiş sayılırsınız.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">1. Veri Sorumlusu</h2>
                    <p>
                        6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) ve Avrupa Birliği Genel Veri Koruma Tüzüğü (“GDPR”)
                        kapsamında veri sorumlusu Çay Hesabım’dır. Bize aşağıdaki iletişim bilgileri üzerinden ulaşabilirsiniz:
                    </p>
                    <ul class="list-disc space-y-1 pl-5">
                        <li><strong class="font-medium text-foreground">E-posta:</strong> <a :href="`mailto:${contactEmail}`" :class="linkClass">{{ contactEmail }}</a></li>
                        <li><strong class="font-medium text-foreground">Web Sitesi:</strong> <a :href="websiteUrl" :class="linkClass">{{ websiteUrl }}</a></li>
                    </ul>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">2. Topladığımız Veriler</h2>
                    <h3 class="text-base font-semibold text-foreground">2.1. Sizin Sağladığınız Bilgiler</h3>
                    <ul class="list-disc space-y-1 pl-5">
                        <li><strong class="font-medium text-foreground">Hesap Bilgileri:</strong> Ad-soyad, e-posta adresi, telefon numarası, şifre (şifrelenmiş olarak saklanır).</li>
                        <li><strong class="font-medium text-foreground">Profil Bilgileri:</strong> Profil fotoğrafı, bölge/şehir bilgisi, kullanıcı rolü (üretici, işçi, firma vb.).</li>
                        <li><strong class="font-medium text-foreground">Çay İşletmesi Verileri:</strong> Tarla bilgileri (ad, konum, alan), hasat kayıtları, ödeme/alacak kayıtları, firma bilgileri.</li>
                        <li><strong class="font-medium text-foreground">Sosyal Hub İçerikleri:</strong> İş ilanları, işçi ilanları, topluluk gönderileri, yorumlar, ekipman/pazar yeri ilanları, mesajlaşma içerikleri.</li>
                        <li><strong class="font-medium text-foreground">İletişim İçerikleri:</strong> Destek talepleri, geri bildirimler, e-posta yazışmaları.</li>
                    </ul>

                    <h3 class="text-base font-semibold text-foreground">2.2. Otomatik Olarak Toplanan Bilgiler</h3>
                    <ul class="list-disc space-y-1 pl-5">
                        <li><strong class="font-medium text-foreground">Cihaz Bilgileri:</strong> Cihaz modeli, işletim sistemi sürümü, dil ayarları, benzersiz cihaz tanımlayıcıları.</li>
                        <li><strong class="font-medium text-foreground">Kullanım Verileri:</strong> Görüntülenen sayfalar, tıklamalar, oturum süresi, hata kayıtları.</li>
                        <li><strong class="font-medium text-foreground">Log Kayıtları:</strong> IP adresi, tarayıcı türü, erişim zamanı, yönlendiren URL.</li>
                        <li><strong class="font-medium text-foreground">Çerezler ve Benzeri Teknolojiler:</strong> Oturum yönetimi ve tercihlerinizin hatırlanması için kullanılan çerezler.</li>
                    </ul>

                    <h3 class="text-base font-semibold text-foreground">2.3. Konum Bilgisi</h3>
                    <p>
                        Tarla kaydı, iş ilanları ve harita özellikleri için yaklaşık veya kesin konum bilginizi
                        <strong class="font-medium text-foreground">yalnızca açık izninizle</strong> kullanırız. Konum iznini cihaz ayarlarınızdan
                        istediğiniz zaman geri alabilirsiniz.
                    </p>

                    <h3 class="text-base font-semibold text-foreground">2.4. Kamera ve Galeri</h3>
                    <p>
                        Profil fotoğrafı, ilan görselleri ve topluluk gönderileri için cihazınızın kamerasına veya galerisine erişim
                        isteyebiliriz. Bu erişim yalnızca sizin seçtiğiniz dosyalarla sınırlıdır.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">3. Verileri Kullanma Amaçlarımız</h2>
                    <ul class="list-disc space-y-1 pl-5">
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

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">4. Hukuki Dayanak</h2>
                    <p>Kişisel verilerinizi şu hukuki sebeplere dayanarak işliyoruz:</p>
                    <ul class="list-disc space-y-1 pl-5">
                        <li>Sözleşmenin ifası (Hizmet sözleşmemiz).</li>
                        <li>Açık rızanız (örn. konum, pazarlama iletişimleri).</li>
                        <li>Hukuki yükümlülüklerimiz (vergi, KVKK, GDPR vb.).</li>
                        <li>Meşru menfaatlerimiz (güvenlik, dolandırıcılık önleme, ürün geliştirme).</li>
                    </ul>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">5. Verilerin Paylaşımı</h2>
                    <p>
                        Kişisel verilerinizi <strong class="font-medium text-foreground">satmayız</strong>. Verileriniz aşağıdaki sınırlı
                        durumlarda paylaşılabilir:
                    </p>
                    <ul class="list-disc space-y-1 pl-5">
                        <li>
                            <strong class="font-medium text-foreground">Hizmet Sağlayıcılar:</strong> Sunucu barındırma (cloud hosting), e-posta
                            gönderimi, hata izleme ve analiz hizmeti veren güvenilir üçüncü taraflar — yalnızca hizmeti sağlamak için gerekli
                            ölçüde.
                        </li>
                        <li>
                            <strong class="font-medium text-foreground">Diğer Kullanıcılar:</strong> Sosyal hub’da paylaştığınız içerikler (iş
                            ilanı, topluluk gönderisi vb.) ve profil bilginiz diğer kullanıcılar tarafından görüntülenebilir.
                        </li>
                        <li>
                            <strong class="font-medium text-foreground">Yasal Talepler:</strong> Mahkeme kararı veya yetkili makam talebi halinde
                            mevzuat gereği gerekli paylaşımlar yapılabilir.
                        </li>
                        <li>
                            <strong class="font-medium text-foreground">İşletme Devri:</strong> Birleşme, satın alma veya varlık devri durumunda
                            verileriniz devralan tarafa aktarılabilir; size önceden bilgi verilir.
                        </li>
                    </ul>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">6. Veri Saklama Süresi</h2>
                    <p>Kişisel verilerinizi yalnızca işleme amacının gerektirdiği süre boyunca saklarız. Hesabınızı sildiğinizde:</p>
                    <ul class="list-disc space-y-1 pl-5">
                        <li>Profil ve hesap verileriniz <strong class="font-medium text-foreground">30 gün</strong> içinde silinir.</li>
                        <li>Yasal yükümlülükler gereği saklanması gereken bazı veriler ilgili mevzuatın öngördüğü süreyle saklanır.</li>
                        <li>Yedeklemeler kademeli olarak rotasyon süresi içinde temizlenir.</li>
                    </ul>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">7. Veri Güvenliği</h2>
                    <p>
                        Verilerinizi korumak için sektör standardı önlemler alıyoruz: HTTPS/TLS şifreleme, parola hashleme (bcrypt benzeri),
                        erişim kontrolü, düzenli güvenlik güncellemeleri ve güvenlik logları. Ancak hiçbir sistem %100 güvenli değildir; veri
                        ihlali durumunda sizi ve ilgili otoriteleri mevzuatın gerektirdiği süre içinde bilgilendireceğiz.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">8. Çocukların Gizliliği</h2>
                    <p>
                        Hizmetimiz <strong class="font-medium text-foreground">16 yaşın altındaki</strong> kişilere yönelik değildir. 16 yaş altı
                        bir kullanıcıya ait veri topladığımızı fark edersek, bu veriyi derhal sileriz. Bu yaş grubunda bir hesap olduğunu
                        düşünüyorsanız lütfen bizimle iletişime geçin.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">9. KVKK ve GDPR Kapsamındaki Haklarınız</h2>
                    <p>İlgili mevzuatlar gereği şu haklara sahipsiniz:</p>
                    <ul class="list-disc space-y-1 pl-5">
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
                        Haklarınızı kullanmak için <a :href="`mailto:${contactEmail}`" :class="linkClass">{{ contactEmail }}</a> adresine yazılı
                        başvuruda bulunabilirsiniz. Başvurunuzu en geç 30 gün içinde ücretsiz olarak sonuçlandırırız.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">10. Hesap ve Veri Silme</h2>
                    <p>
                        Hesabınızı uygulama içinden <strong class="font-medium text-foreground">Ayarlar &raquo; Hesap Sil</strong> adımıyla
                        silebilirsiniz. Ayrıca
                        <a :href="`mailto:${contactEmail}?subject=Hesap%20Silme%20Talebi`" :class="linkClass">{{ contactEmail }}</a>
                        adresine “Hesap Silme Talebi” konulu e-posta gönderebilirsiniz.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">11. Uluslararası Veri Aktarımı</h2>
                    <p>
                        Sunucularımız Türkiye ve/veya Avrupa Birliği ülkelerinde barındırılabilir. Verilerin yurt dışına aktarımı yapılması
                        halinde KVKK ve GDPR’ın gerektirdiği güvenceler (standart sözleşme maddeleri vb.) sağlanır.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">12. Çerezler</h2>
                    <p>
                        Oturum yönetimi, dil tercihi ve performans analizi için çerezler ve benzeri yerel depolama teknolojileri kullanırız.
                        Tarayıcı ayarlarından çerezleri engelleyebilir veya silebilirsiniz; ancak bu, Hizmetin bazı özelliklerinin
                        çalışmamasına yol açabilir.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">13. Üçüncü Taraf Bağlantıları</h2>
                    <p>
                        Hizmet, üçüncü taraf web sitelerine veya hizmetlerine bağlantılar içerebilir. Bu üçüncü tarafların gizlilik
                        uygulamalarından sorumlu değiliz; ziyaret etmeden önce ilgili gizlilik politikalarını incelemenizi öneririz.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">14. Politikadaki Değişiklikler</h2>
                    <p>
                        Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişiklikleri Hizmet içinde duyuru veya e-posta yoluyla
                        bildiririz. Güncel sürümün yürürlük tarihi sayfanın başında belirtilir. Değişiklikten sonra Hizmeti kullanmaya devam
                        etmeniz, güncel politikayı kabul ettiğiniz anlamına gelir.
                    </p>
                </section>

                <section class="space-y-4">
                    <h2 class="text-lg font-semibold text-foreground">15. İletişim</h2>
                    <p>Bu Gizlilik Politikası veya kişisel verileriniz hakkında sorularınız için bize ulaşın:</p>
                    <ul class="list-disc space-y-1 pl-5">
                        <li><strong class="font-medium text-foreground">E-posta:</strong> <a :href="`mailto:${contactEmail}`" :class="linkClass">{{ contactEmail }}</a></li>
                        <li><strong class="font-medium text-foreground">Web:</strong> <a :href="websiteUrl" :class="linkClass">{{ websiteUrl }}</a></li>
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
