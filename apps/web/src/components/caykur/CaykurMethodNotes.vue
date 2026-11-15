<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toneVariant, type Tone } from '@/components/caykur/tone';

/**
 * Method and limits (Yöntem ve Sınırlar): for every module, what it does, which data it rests on, what it cannot do
 * and how far its results have been checked against the ground. Plain statements for a reader who has to decide how
 * much weight a number on another tab can carry.
 */
type Checked = 'field' | 'partial' | 'none';
const CHECKED_META: Record<Checked, { label: string; tone: Tone }> = {
    field: { label: 'Saha verisiyle sınandı', tone: 'success' },
    partial: { label: 'Kısmen sınandı', tone: 'warning' },
    none: { label: 'Sahada sınanmadı', tone: 'muted' },
};
interface ModuleNote {
    name: string;
    where: string;
    does: string;
    data: string[];
    cannot: string[];
    checked: Checked;
    checkedNote: string;
}
const PRINCIPLES: Array<{ title: string; text: string }> = [
    { title: 'Ön değerlendirme', text: 'Hiçbir ekran idari karar üretmez. Bir bulgu, yerinde kontrol ya da kayıt düzeltmesi önerisidir; kararı yetkili personel verir.' },
    { title: 'Kanıt sırası', text: 'Saha gözlemi en güçlü kanıttır; ardından uzmanın doğruladığı görüntü okuması, sonra drone, en son uydu gelir. Zayıf kanıt bir sonucu “inceleme”ye taşır, “aykırı” yapmaz.' },
    { title: 'Aleyhe bulgu için net kanıt', text: 'Bir kişi aleyhine sonuç (ruhsatsız çay, çaysız ruhsat) yalnız net kanıtla verilir. Küçük parsel, kararsız okuma ya da çelişen kaynaklar şüpheden yana yorumlanır.' },
    { title: 'DEMO kayıtlar', text: 'Gerçek ÇAYKUR ruhsat ve üretici listesi gelene kadar ruhsat ve üretici kayıtları DEMO olarak üretilmiştir ve her ekranda öyle etiketlidir. Ruhsata dayanan sayılar yöntemi gösterir, gerçek durumu göstermez.' },
    { title: 'Görüntü olduğu gibi', text: 'Kanıt görüntüleri yapay olarak keskinleştirilmez ya da büyütülmez. 10 m uydu pikseli 10 m olarak, video karesi çekildiği çözünürlükte gösterilir.' },
];
const MODULES: ModuleNote[] = [
    {
        name: 'Bahçe kayıtları ve çay tespiti',
        where: 'Ruhsatlandırma → Bahçe Kayıtları',
        does: 'Her kadastro parseli için uydu görüntüsünden çay olasılığı ve çaylık alan tahmini üretir; tapu niteliği ve ruhsat kaydıyla yan yana koyar.',
        data: ['TKGM parsel geometrisi ve tapu niteliği', 'Sentinel-2 optik ve Sentinel-1 radar görüntüleri (10 m)', 'Tapu niteliğinden türetilen eğitim etiketleri'],
        cannot: ['300 m² altındaki parselleri güvenle okuyamaz: parsel birkaç pikselden küçüktür.', 'Alan ölçmez; verdiği m² piksel sayımından gelen bir tahmindir.', 'Ağaç altındaki ya da çok seyrek çayı göremeyebilir.', 'Eğitim etiketleri tapu niteliğinden geldiği için tapudaki hatayı kısmen öğrenir.'],
        checked: 'partial',
        checkedNote: 'Ayrılmış test parsellerinde sınandı (oranlar Arazi tespit kararı sekmesinde); bağımsız saha etiketiyle sınanmadı.',
    },
    {
        name: 'Arazi tespit kararı',
        where: 'Ruhsatlandırma → Ruhsat İşlemleri → Arazi tespit kararı',
        does: 'Üç bağımsız kaynağı (tapu niteliği, ruhsat kaydı, uyduda çay) parsel başına tek karara bağlar: çay arazisi, ruhsat hatası, ruhsatsız çay ve diğer beş birleşim.',
        data: ['Tapu niteliği', 'Ruhsat kaydı (şimdilik DEMO)', 'Tapudan bağımsız uydu tespiti', 'Açık bina izi verisi', 'Varsa saha gözlemi'],
        cannot: ['DEMO ruhsat kaydıyla gerçek bir ruhsat ihlali gösteremez.', 'Kararsız ya da küçük parselde karar vermez; “inceleme gerekli” der.', 'Açık bina verisi eksik ve dik arazide metrelerce kayık olabilir.'],
        checked: 'partial',
        checkedNote: 'Az sayıda parselde saha gözlemiyle karşılaştırıldı; sistematik saha sınaması yok.',
    },
    {
        name: 'Drone doğrulama',
        where: 'Ruhsatlandırma → Ruhsat İşlemleri → Drone doğrulama',
        does: 'Drone videosunun gördüğü parselleri bulur, TKGM sınırını videoya yaklaşık olarak bindirir, her parsel için kanıt karelerini ve çay mevcut / bulunamadı / kısmen / belirsiz sınıfını verir.',
        data: ['Drone videosu (konum verisi olmayan sıradan çekim)', 'Videodan çözülen kamera konumları', 'Haritada işaretlenen kontrol binaları', 'Karelerin gözle okunması'],
        cannot: ['Sınır tespiti ve alan ölçümü yapamaz: bindirme metre düzeyinde kayıktır (ortalama hata ekranda yazılıdır).', 'Küçük parsellerde komşu parselin bir bölümünü içine alabilir.', 'Sınıflar görüntü okumasıdır ve doğrulanmamıştır; otomatik piksel sınıflandırıcı deneyseldir ve haritayı renklendirmez.', 'Santimetre düzeyi için RTK/PPK konumlu, ızgara planlı çekim gerekir.'],
        checked: 'none',
        checkedNote: 'Okumalar bir uzman ya da saha ziyaretiyle doğrulanmadı; her biri “doğrulanmamış” olarak işaretlidir.',
    },
    {
        name: 'Uygunluk raporu',
        where: 'Ruhsatlandırma → Ruhsat İşlemleri → Uygunluk raporu',
        does: 'Her parseli yazılı on kurala karşı sınar; her kuralın sonucunu dayandığı kanıt cümlesiyle verir.',
        data: ['Arazi tespit kararının girdileri', 'Drone doğrulama sınıfları', 'Saha gözlemleri'],
        cannot: ['Kural seti taslaktır: kural metinlerinin dayandığı mevzuat maddeleri ÇAYKUR ile eşleştirilmemiştir.', 'Kendi başına yeni kanıt üretmez; diğer modüllerin sınırlarını aynen taşır.', 'Alan kuralı bulgu vermez: 10 m piksel alan ölçemez.'],
        checked: 'none',
        checkedNote: 'Kuralların sahadaki isabeti ölçülmedi.',
    },
    {
        name: 'Budama takibi',
        where: 'Budama → Budama Takibi',
        does: 'Sezon içinde uydu zaman serisindeki ani düşüşten bahçenin budanıp budanmadığını tahmin eder; üretici başına budanan alan oranını kurum kuralıyla karşılaştırır.',
        data: ['Sentinel-2 bitki indeksi zaman serisi', 'Sentinel-1 radar geri saçılımı ve uyum (coherence) verisi', 'Bahçe ve üretici kayıtları (şimdilik DEMO)'],
        cannot: ['Bulutlu dönemde budama tarihini kaçırabilir ya da geç görebilir.', 'Küçük bahçelerde komşu bahçenin sinyali karışır.', 'Budamayı hasat, don ya da hastalık kaynaklı düşüşten her zaman ayıramaz.', 'Üretici kayıtları DEMO olduğu için üretici bazındaki kararlar gösterim amaçlıdır.'],
        checked: 'partial',
        checkedNote: 'Saha Testi sekmesindeki denetçi kayıtlarıyla sınırlı sayıda bahçede karşılaştırıldı.',
    },
    {
        name: 'Saha testi',
        where: 'Budama → Saha Testi',
        does: 'Denetçinin sahada kaydettiği budama bilgisini uydu serisindeki bağımsız bir sınamayla karşılaştırır; modellerin gerçek isabetini ölçmenin yoludur.',
        data: ['Denetçi saha kayıtları', 'Aynı bahçenin uydu zaman serisi'],
        cannot: ['Şimdilik tek mahalleyi kapsar.', 'Kayıt sayısı az olduğu için oranlar geniş bir belirsizlik taşır.'],
        checked: 'field',
        checkedNote: 'Tanımı gereği saha verisidir; kapsamı dardır.',
    },
    {
        name: 'Bahçe sağlığı',
        where: 'Zirai Analizler → Bahçe Sağlığı',
        does: 'Bahçenin sezon içindeki bitki canlılığını çevresindeki bahçelerle karşılaştırır, olağan dışı zayıf bahçeleri işaretler ve göreli bir verim göstergesi verir.',
        data: ['Sentinel-2 bitki indeksleri', 'Bahçe sınırları'],
        cannot: ['Zayıflığın nedenini (hastalık, kuraklık, bakımsızlık, budama) söyleyemez.', 'Verim göstergesi tartılmış ürünle kalibre edilmemiştir; kilogram değerleri yaklaşık bir sıralamadır.'],
        checked: 'none',
        checkedNote: 'Alım kayıtları ya da saha gözlemiyle karşılaştırılmadı.',
    },
    {
        name: 'Arazi değerlendirme',
        where: 'Zirai Analizler → Arazi Değerlendirme',
        does: 'Parselin yükseklik, eğim, bakı ve iklim koşullarına göre çay tarımına uygunluğunu puanlar.',
        data: ['Sayısal yükseklik modeli', 'İklim verisi', 'Parsel geometrisi'],
        cannot: ['Toprak analizi içermez.', 'Puan genel bir uygunluk göstergesidir; parsel içi farkları göstermez.'],
        checked: 'none',
        checkedNote: 'Verim ya da saha verisiyle karşılaştırılmadı.',
    },
    {
        name: 'Bahçe yaşı',
        where: 'Zirai Analizler → Bahçe Yaşı',
        does: 'Uzun dönem uydu arşivinden bahçenin ne zamandan beri var olduğunu, yenilenip yenilenmediğini ve terk belirtisi gösterip göstermediğini tahmin eder.',
        data: ['1984’ten bugüne Landsat arşivi (30 m)', 'Sentinel-2 etkinlik serisi'],
        cannot: ['30 m piksel küçük bahçelerde komşu araziyi içine alır.', 'Arşivin başladığı yıldan eski bahçelerin yaşı “en az” olarak bilinir.', 'Yıl tahmini birkaç yıl sapabilir.'],
        checked: 'none',
        checkedNote: 'Dikim kayıtlarıyla karşılaştırılmadı.',
    },
];
const NEXT: string[] = [
    'Gerçek ÇAYKUR ruhsat ve üretici listesi: ruhsata dayanan her sonucu gerçek hale getirir.',
    'Sistematik saha doğrulaması: her modül için ölçülmüş bir isabet oranı üretir.',
    'Planlı drone çekimi (ızgara uçuş, dik bakış, yüksek bindirme, uçuş kaydı, mümkünse RTK): sınır ve alan ölçümünü mümkün kılar.',
    'Kural setinin mevzuat maddeleriyle eşleştirilmesi.',
];
</script>

<template>
    <div class="flex flex-col gap-4">
        <Card class="gap-0 py-0">
            <CardHeader class="py-4">
                <CardTitle>Yöntem ve sınırlar</CardTitle>
                <CardDescription>Her modülün ne yaptığı, hangi veriye dayandığı, neyi yapamadığı ve sonuçlarının sahada ne kadar sınandığı. Başka bir sekmedeki sayıya ne kadar güvenileceğini buradan okuyun.</CardDescription>
            </CardHeader>
            <CardContent class="border-t py-4">
                <dl class="grid gap-4 md:grid-cols-2">
                    <div v-for="p in PRINCIPLES" :key="p.title" class="flex flex-col gap-1">
                        <dt class="font-medium">{{ p.title }}</dt>
                        <dd class="text-sm text-muted-foreground">{{ p.text }}</dd>
                    </div>
                </dl>
            </CardContent>
        </Card>

        <Card v-for="m in MODULES" :key="m.name" class="gap-0 py-0">
            <CardHeader class="py-4">
                <CardTitle class="flex flex-wrap items-center gap-2">
                    {{ m.name }}
                    <Badge :variant="toneVariant(CHECKED_META[m.checked].tone)">{{ CHECKED_META[m.checked].label }}</Badge>
                </CardTitle>
                <CardDescription>{{ m.where }}</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-4 border-t py-4">
                <p class="text-sm">{{ m.does }}</p>
                <div class="grid gap-4 md:grid-cols-2">
                    <div class="flex flex-col gap-1.5">
                        <h4 class="text-sm font-medium">Dayandığı veri</h4>
                        <ul class="list-disc pl-5 text-sm text-muted-foreground">
                            <li v-for="d in m.data" :key="d">{{ d }}</li>
                        </ul>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <h4 class="text-sm font-medium">Yapamadığı</h4>
                        <ul class="list-disc pl-5 text-sm text-muted-foreground">
                            <li v-for="c in m.cannot" :key="c">{{ c }}</li>
                        </ul>
                    </div>
                </div>
                <p class="text-sm"><span class="font-medium">Doğrulama durumu:</span> {{ m.checkedNote }}</p>
            </CardContent>
        </Card>

        <Card class="gap-0 py-0">
            <CardHeader class="py-4">
                <CardTitle>Güveni artıracak adımlar</CardTitle>
                <CardDescription>Sistemin bugünkü sınırlarının çoğu yazılımdan değil, eldeki veriden gelir.</CardDescription>
            </CardHeader>
            <CardContent class="border-t py-4">
                <ol class="list-decimal pl-5 text-sm">
                    <li v-for="n in NEXT" :key="n" class="py-0.5">{{ n }}</li>
                </ol>
            </CardContent>
        </Card>
    </div>
</template>
