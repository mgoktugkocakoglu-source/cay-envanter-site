<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import TeaBusinessLayout from "@/layouts/TeaBusinessLayout.vue";

type KnowledgeType = "Doküman" | "Tez" | "Kılavuz" | "Yüklenen";
type MessageRole = "assistant" | "user";

interface KnowledgeDocument {
  id: string;
  title: string;
  type: KnowledgeType;
  author: string;
  year: string;
  source: string;
  summary: string;
  topics: string[];
  recommendations: string[];
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  references: KnowledgeDocument[];
}

const STORAGE_KEY = "cayhesabim_tea_ai_uploaded_documents";

const baseKnowledge: KnowledgeDocument[] = [
  {
    id: "organic-tea",
    title: "Organik Çay Tarımı Esasları",
    type: "Kılavuz",
    author: "Tarım ve Orman Bakanlığı / saha uygulamaları özeti",
    year: "Güncel uygulama notu",
    source:
      "Organik tarım mevzuatı, üretici kayıt süreçleri ve Doğu Karadeniz çay bahçesi saha pratikleri",
    summary:
      "Organik çay üretiminde geçiş süreci, kayıt tutma, kimyasal girdilerden kaçınma, bahçe tampon alanı ve sertifikasyon denetimleri öne çıkar.",
    topics: ["organik", "sertifika", "geçiş", "kayıt", "gübre", "toprak"],
    recommendations: [
      "Başlamadan önce arazinin geçmiş girdi kullanımını ve komşu parsellerden bulaşma riskini kayıt altına al.",
      "Organik üretime geçişte her işlem için tarihli kayıt, fatura ve uygulama notu tut.",
      "Toprak analizini yılda en az bir kez planla ve gübrelemeyi analiz sonucuna göre yap.",
    ],
  },
  {
    id: "tea-economics",
    title: "Çay İşletmelerinde Maliyet, Verim ve Gelir Yönetimi",
    type: "Tez",
    author:
      "Çay ekonomisi ve tarımsal işletme tezlerinden derlenmiş karar notu",
    year: "Literatür sentezi",
    source:
      "Çay üretim maliyetleri, işçilik, taşıma, alım fiyatı ve nakit akışı üzerine akademik çalışmalar",
    summary:
      "Kârlılık yalnızca yaş çay fiyatına değil; işçilik organizasyonu, hasat zamanlaması, nakliye, fire ve ödeme takibine bağlıdır.",
    topics: [
      "maliyet",
      "gelir",
      "işçilik",
      "nakliye",
      "ödeme",
      "verim",
      "fiyat",
    ],
    recommendations: [
      "Dekar başına işçilik, taşıma ve bakım maliyetini ayrı ayrı hesapla.",
      "Her sürgün için kg, alıcı firma, randıman, ödeme vadesi ve net gelir takibi yap.",
      "Nakit akışı için gübre, budama ve işçilik giderlerini hasat gelirinden önce planla.",
    ],
  },
  {
    id: "soil-fertilization",
    title: "Çay Bahçelerinde Toprak Verimliliği ve Gübreleme",
    type: "Doküman",
    author: "Toprak bilimi ve bitki besleme yayınları özeti",
    year: "Saha rehberi",
    source:
      "Toprak analizi, pH yönetimi, organik madde ve dengeli besleme üzerine teknik dokümanlar",
    summary:
      "Çay bitkisi asidik topraklara uyumlu olsa da aşırı asitlenme, organik madde düşüklüğü ve bilinçsiz gübreleme verimi azaltır.",
    topics: ["toprak", "ph", "gübre", "azot", "organik madde", "analiz"],
    recommendations: [
      "Toprak numunesini aynı bahçede benzer eğim ve yapıdaki alanlardan karışık örnek şeklinde al.",
      "Gübre miktarını alışkanlıkla değil analiz raporu ve beklenen verime göre belirle.",
      "Erozyon riski olan eğimli arazide organik maddeyi koruyacak örtü ve malç uygulamalarını değerlendir.",
    ],
  },
  {
    id: "harvest-quality",
    title: "Yaş Çay Hasadı, Kalite ve Lojistik Yönetimi",
    type: "Doküman",
    author: "Çay teknolojisi ve hasat sonrası kalite kaynakları özeti",
    year: "Uygulama rehberi",
    source:
      "Hasat standardı, bekletme süresi, taşıma koşulları ve kalite kaybı üzerine dokümanlar",
    summary:
      "Kaliteli yaş çay için doğru sürgün olgunluğu, temiz hasat, kısa bekleme süresi ve havadar taşıma koşulları kritik önemdedir.",
    topics: ["hasat", "kalite", "sürgün", "taşıma", "randıman", "fire"],
    recommendations: [
      "Hasadı sürgün dönemine göre planla; kaba yaprak oranını ve yabancı maddeyi düşür.",
      "Toplanan çayı güneşte ve kapalı çuvallarda uzun süre bekletme.",
      "Teslim noktası, sıra, tartım ve alım belgesini aynı gün kaydet.",
    ],
  },
  {
    id: "pest-climate",
    title: "İklim, Hastalık-Zararlı ve Risk Yönetimi",
    type: "Tez",
    author: "Bitki koruma ve iklim uyumu çalışmalarından sentez",
    year: "Literatür sentezi",
    source:
      "Doğu Karadeniz iklim değişkenliği, zararlı takibi ve entegre mücadele notları",
    summary:
      "Aşırı yağış, sıcaklık dalgalanması, erozyon ve zararlı baskısı üretimde verim ve kalite riskini artırır.",
    topics: ["iklim", "hastalık", "zararlı", "erozyon", "risk", "sigorta"],
    recommendations: [
      "Bahçe gözlemlerini haftalık tut; renk değişimi, yaprak deformasyonu ve drenaj sorunlarını fotoğrafla kaydet.",
      "Kimyasal müdahaleden önce entegre mücadele ve yetkili teknik danışman görüşünü değerlendir.",
      "Şiddetli yağış riski olan parsellerde drenaj ve teras bakımını hasat sezonu öncesinde kontrol et.",
    ],
  },
];

const roadmapSteps = [
  {
    title: "1. Arazi ve hedef analizi",
    detail:
      "Parsel konumu, eğim, yol erişimi, toprak analizi, mevcut çay yaşı ve yıllık iş gücü kapasitesini çıkar.",
  },
  {
    title: "2. Resmi kayıt ve alıcı stratejisi",
    detail:
      "ÇKS/üretici kayıtlarını, alım yeri seçeneklerini, özel sektör ve kooperatif bağlantılarını netleştir.",
  },
  {
    title: "3. Maliyet planı",
    detail:
      "Budama, gübreleme, işçilik, taşıma, ekipman, bakım ve beklenmeyen giderler için sezonluk bütçe oluştur.",
  },
  {
    title: "4. Bahçe bakım takvimi",
    detail:
      "Toprak analizi, gübreleme, budama, yabancı ot kontrolü, drenaj ve hasat hazırlığını aylık takvime bağla.",
  },
  {
    title: "5. Hasat ve kalite operasyonu",
    detail:
      "Sürgün dönemi, işçi planı, çuval/taşıma düzeni, tartım belgesi ve fire takibini standartlaştır.",
  },
  {
    title: "6. Gelir, ödeme ve büyüme kararı",
    detail:
      "Dekar başı verim, kg başı net kâr, ödeme vadesi ve yıllık iyileştirme hedeflerini karşılaştır.",
  },
];

const sampleQuestions = [
  "Çay işine yeni başlayacağım, ilk 90 gün ne yapmalıyım?",
  "Organik çay üretimine geçmek için nelere dikkat etmeliyim?",
  "Dekar başı maliyetimi nasıl hesaplarım?",
  "Hasatta kalite kaybını azaltmak için hangi adımları izlemeliyim?",
];

const question = ref("");
const selectedTopic = ref("yol-haritasi");
const messages = ref<ChatMessage[]>([
  {
    id: "welcome",
    role: "assistant",
    text: "Merhaba, ben Çay Bilgi AI. Çay üretimine başlama, organik üretim, maliyet, hasat kalitesi ve risk yönetimi konularında yüklenen doküman ve tez özetlerini referans alarak cevap verebilirim. Başlamak için yol haritası sorabilir veya kendi doküman notunu yükleyebilirsin.",
    references: baseKnowledge.slice(0, 3),
  },
]);
const chatEndRef = ref<HTMLElement | null>(null);
const uploadStatus = ref("");
const uploadForm = reactive({
  title: "",
  author: "",
  source: "",
  notes: "",
});
const uploadedDocuments = ref<KnowledgeDocument[]>(loadUploadedDocuments());

const allDocuments = computed(() => [
  ...baseKnowledge,
  ...uploadedDocuments.value,
]);
const documentStats = computed(() => [
  { label: "Bilgi kaynağı", value: allDocuments.value.length.toString() },
  {
    label: "Tez / literatür",
    value: allDocuments.value
      .filter((doc) => doc.type === "Tez")
      .length.toString(),
  },
  { label: "Başlangıç adımı", value: roadmapSteps.length.toString() },
]);
const visibleReferences = computed(() => allDocuments.value.slice(0, 8));

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

function tokenize(value: string) {
  return normalize(value)
    .replace(/[^a-zçğıöşü0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function loadUploadedDocuments(): KnowledgeDocument[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  const parsed = JSON.parse(raw) as KnowledgeDocument[];
  return Array.isArray(parsed) ? parsed : [];
}

function persistUploadedDocuments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uploadedDocuments.value));
}

function findRelevantDocuments(prompt: string) {
  const tokens = tokenize(prompt);
  const scored = allDocuments.value.map((doc) => {
    const haystack = normalize(
      [
        doc.title,
        doc.type,
        doc.author,
        doc.source,
        doc.summary,
        doc.topics.join(" "),
        doc.recommendations.join(" "),
      ].join(" "),
    );
    const score = tokens.reduce(
      (total, token) => total + (haystack.includes(token) ? 1 : 0),
      0,
    );
    return { doc, score };
  });

  const matches = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.doc);

  return matches.length > 0
    ? matches.slice(0, 3)
    : allDocuments.value.slice(0, 3);
}

function buildRoadmapAnswer(references: KnowledgeDocument[]) {
  const steps = roadmapSteps
    .map((step) => `• ${step.title}: ${step.detail}`)
    .join("\n");
  const referenceHints = references
    .flatMap((doc) => doc.recommendations.slice(0, 1))
    .slice(0, 3)
    .map((item) => `• ${item}`)
    .join("\n");

  return `Bu işe yeni başlamak için pratik yol haritası:\n\n${steps}\n\nDokümanlardan çıkan kritik uyarılar:\n${referenceHints}\n\nÖnerim: İlk sezon hedefin yüksek kârdan önce kayıt düzeni, alıcı ilişkisi, kalite standardı ve gerçek maliyetini öğrenmek olsun. Çay Hesabım içinde tarla, hasat ve ödeme kayıtlarını birlikte tutarsan ikinci sezon kararların daha netleşir.`;
}

function buildTopicAnswer(prompt: string, references: KnowledgeDocument[]) {
  const intro = `Sorunu "${prompt}" olarak anladım. Yüklenen bilgi tabanında en alakalı ${references.length} kaynağa göre özet cevap:`;
  const bullets = references
    .flatMap((doc) => doc.recommendations)
    .slice(0, 5)
    .map((item) => `• ${item}`)
    .join("\n");
  const sources = references
    .map((doc) => `• ${doc.title}: ${doc.summary}`)
    .join("\n");

  return `${intro}\n\n${bullets}\n\nReferans özeti:\n${sources}\n\nNot: Bu ekran karar desteği sağlar; resmi sertifikasyon, destek, ilaçlama veya mevzuat adımlarında yetkili kurum ve ziraat mühendisi görüşüyle doğrulama yap.`;
}

function isRoadmapQuestion(prompt: string) {
  const value = normalize(`${prompt} ${selectedTopic.value}`);
  return [
    "başla",
    "basla",
    "yol",
    "roadmap",
    "ilk",
    "kurmak",
    "yeni",
    "90",
  ].some((keyword) => value.includes(keyword));
}

async function askAgent(customQuestion?: string) {
  const prompt = (customQuestion || question.value).trim();
  if (!prompt) return;

  messages.value.push({
    id: createId("user"),
    role: "user",
    text: prompt,
    references: [],
  });
  question.value = "";

  const references = findRelevantDocuments(prompt);
  const answer = isRoadmapQuestion(prompt)
    ? buildRoadmapAnswer(references)
    : buildTopicAnswer(prompt, references);

  messages.value.push({
    id: createId("assistant"),
    role: "assistant",
    text: answer,
    references,
  });
  await nextTick();
  chatEndRef.value?.scrollIntoView({ behavior: "smooth", block: "end" });
}

async function handleDocumentUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploadStatus.value = "Doküman okunuyor...";
  let extractedText = uploadForm.notes.trim();

  if (file.type.startsWith("text/") || file.name.endsWith(".md")) {
    extractedText = [extractedText, await file.text()]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000);
  }

  const doc: KnowledgeDocument = {
    id: createId("uploaded"),
    title: uploadForm.title.trim() || file.name,
    type: "Yüklenen",
    author: uploadForm.author.trim() || "Kullanıcı yüklemesi",
    year: new Date().getFullYear().toString(),
    source: uploadForm.source.trim() || file.name,
    summary:
      extractedText ||
      "PDF/Word gibi tarayıcıda metni okunamayan dosyalar için başlık ve kaynak bilgisi referans olarak eklendi. Daha iyi cevap için not alanına özet ekleyin.",
    topics: tokenize(
      `${uploadForm.title} ${uploadForm.source} ${extractedText}`,
    ).slice(0, 12),
    recommendations: extractedText
      ? extractedText
          .split(/[.!?\n]/)
          .map((item) => item.trim())
          .filter((item) => item.length > 30)
          .slice(0, 4)
      : [
          "Bu dokümanın ana bulgularını not alanına ekleyerek AI cevaplarında daha güçlü referans üretin.",
        ],
  };

  uploadedDocuments.value.unshift(doc);
  persistUploadedDocuments();
  uploadStatus.value = "Doküman bilgi tabanına eklendi.";
  uploadForm.title = "";
  uploadForm.author = "";
  uploadForm.source = "";
  uploadForm.notes = "";
  input.value = "";
}

function removeUploadedDocument(id: string) {
  uploadedDocuments.value = uploadedDocuments.value.filter(
    (doc) => doc.id !== id,
  );
  persistUploadedDocuments();
}
</script>

<template>
  <TeaBusinessLayout>
    <div class="tea-ai-page">
      <section class="ai-hero">
        <div class="hero-copy">
          <span class="eyebrow">Çay Bilgi AI Agent</span>
          <h1>Doküman ve tez referanslı çay danışmanı</h1>
          <p>
            Çay üretimine başlamak, bahçe bakımını planlamak, maliyetleri
            hesaplamak ve hasat kalitesini artırmak için bilgi tabanına dayalı
            cevaplar üretir. Kullanıcı kendi doküman notlarını da ekleyebilir.
          </p>
          <div class="hero-actions">
            <button
              class="btn btn-primary"
              type="button"
              @click="
                askAgent(
                  'Çay işine yeni başlayacağım, ilk 90 gün ne yapmalıyım?',
                )
              "
            >
              Yol haritası oluştur
            </button>
            <a class="btn btn-secondary" href="#document-upload"
              >Doküman yükle</a
            >
          </div>
        </div>
        <div class="hero-card" aria-label="Bilgi tabanı özeti">
          <div v-for="stat in documentStats" :key="stat.label" class="stat-box">
            <strong>{{ stat.value }}</strong>
            <span>{{ stat.label }}</span>
          </div>
        </div>
      </section>

      <section class="content-grid">
        <div class="agent-panel">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Soru-cevap</span>
              <h2>AI Agent'a sor</h2>
            </div>
            <select
              v-model="selectedTopic"
              class="topic-select"
              aria-label="Konu seçimi"
            >
              <option value="yol-haritasi">Yol haritası</option>
              <option value="organik">Organik üretim</option>
              <option value="maliyet">Maliyet ve gelir</option>
              <option value="hasat">Hasat kalitesi</option>
              <option value="risk">Risk yönetimi</option>
            </select>
          </div>

          <div class="sample-questions" aria-label="Örnek sorular">
            <button
              v-for="sample in sampleQuestions"
              :key="sample"
              type="button"
              @click="askAgent(sample)"
            >
              {{ sample }}
            </button>
          </div>

          <div class="chat-window" aria-live="polite">
            <article
              v-for="message in messages"
              :key="message.id"
              class="chat-message"
              :class="`chat-message--${message.role}`"
            >
              <div class="message-avatar">
                {{ message.role === "assistant" ? "AI" : "Siz" }}
              </div>
              <div class="message-body">
                <p>{{ message.text }}</p>
                <div
                  v-if="message.references.length"
                  class="message-references"
                >
                  <span>Referanslar:</span>
                  <ul>
                    <li
                      v-for="reference in message.references"
                      :key="reference.id"
                    >
                      {{ reference.title }} · {{ reference.type }} ·
                      {{ reference.year }}
                    </li>
                  </ul>
                </div>
              </div>
            </article>
            <div ref="chatEndRef"></div>
          </div>

          <form class="question-form" @submit.prevent="askAgent()">
            <textarea
              v-model="question"
              rows="3"
              placeholder="Örn: Organik çaya geçmek için ilk yıl hangi kayıtları tutmalıyım?"
            />
            <button class="btn btn-primary" type="submit">Sor</button>
          </form>
        </div>

        <aside class="side-panel">
          <div class="roadmap-card">
            <span class="eyebrow">Başlangıç planı</span>
            <h2>Çay işine başlama yol haritası</h2>
            <ol>
              <li v-for="step in roadmapSteps" :key="step.title">
                <strong>{{ step.title }}</strong>
                <span>{{ step.detail }}</span>
              </li>
            </ol>
          </div>

          <div id="document-upload" class="upload-card">
            <span class="eyebrow">Bilgi tabanı</span>
            <h2>Doküman / tez yükle</h2>
            <p>
              TXT ve Markdown dosyalarının metni okunur. PDF/Word için not
              alanına özet ekleyerek referans kalitesini artırabilirsiniz.
            </p>
            <input
              v-model="uploadForm.title"
              class="form-input"
              type="text"
              placeholder="Doküman başlığı"
            />
            <input
              v-model="uploadForm.author"
              class="form-input"
              type="text"
              placeholder="Yazar / kurum"
            />
            <input
              v-model="uploadForm.source"
              class="form-input"
              type="text"
              placeholder="Kaynak linki veya açıklama"
            />
            <textarea
              v-model="uploadForm.notes"
              class="upload-notes"
              rows="4"
              placeholder="Ana bulgular, alıntı notları veya özet"
            />
            <label class="file-upload">
              <input
                type="file"
                accept=".txt,.md,.pdf,.doc,.docx"
                @change="handleDocumentUpload"
              />
              Dosya seç ve ekle
            </label>
            <p v-if="uploadStatus" class="upload-status">{{ uploadStatus }}</p>
          </div>
        </aside>
      </section>

      <section class="reference-library">
        <div class="panel-header">
          <div>
            <span class="eyebrow">Referans kütüphanesi</span>
            <h2>AI cevaplarında kullanılan kaynaklar</h2>
          </div>
        </div>
        <div class="reference-grid">
          <article
            v-for="doc in visibleReferences"
            :key="doc.id"
            class="reference-card"
          >
            <div class="reference-meta">
              <span>{{ doc.type }}</span>
              <span>{{ doc.year }}</span>
            </div>
            <h3>{{ doc.title }}</h3>
            <p>{{ doc.summary }}</p>
            <div class="topic-list">
              <span v-for="topic in doc.topics.slice(0, 4)" :key="topic"
                >#{{ topic }}</span
              >
            </div>
            <button
              v-if="doc.type === 'Yüklenen'"
              class="remove-doc"
              type="button"
              @click="removeUploadedDocument(doc.id)"
            >
              Kaldır
            </button>
          </article>
        </div>
      </section>
    </div>
  </TeaBusinessLayout>
</template>

<style scoped>
.tea-ai-page {
  max-width: 1440px;
  margin: 0 auto;
  padding: var(--space-6);
  color: var(--color-text-primary);
}

.ai-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: var(--space-6);
  align-items: stretch;
  margin-bottom: var(--space-6);
}

.hero-copy,
.agent-panel,
.side-panel > *,
.reference-library {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 24px;
  box-shadow: var(--shadow-md);
}

.hero-copy {
  padding: clamp(24px, 4vw, 48px);
  background:
    radial-gradient(
      circle at top right,
      rgba(34, 197, 94, 0.16),
      transparent 34%
    ),
    linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-tertiary));
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-copy h1,
.panel-header h2,
.roadmap-card h2,
.upload-card h2,
.reference-library h2 {
  margin: var(--space-2) 0 var(--space-3);
  color: var(--color-text-primary);
  line-height: 1.12;
}

.hero-copy h1 {
  max-width: 760px;
  font-size: clamp(2rem, 5vw, 4.25rem);
}

.hero-copy p {
  max-width: 760px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-relaxed);
}

.hero-actions,
.sample-questions,
.reference-meta,
.topic-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.hero-actions {
  margin-top: var(--space-6);
}

.hero-card {
  display: grid;
  gap: var(--space-4);
}

.stat-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 120px;
  padding: var(--space-6);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 24px;
  box-shadow: var(--shadow-md);
}

.stat-box strong {
  color: var(--color-primary);
  font-size: 2.5rem;
  line-height: 1;
}

.stat-box span {
  margin-top: var(--space-2);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-semibold);
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: var(--space-6);
  align-items: start;
}

.agent-panel,
.reference-library {
  padding: var(--space-6);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: center;
  margin-bottom: var(--space-5);
}

.topic-select {
  min-height: var(--control-height);
  padding: 0 var(--space-4);
  color: var(--color-text-primary);
  background: var(--color-input-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.sample-questions {
  margin-bottom: var(--space-5);
}

.sample-questions button,
.topic-list span,
.reference-meta span {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.sample-questions button {
  padding: 8px 12px;
  cursor: pointer;
}

.sample-questions button:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.chat-window {
  display: grid;
  gap: var(--space-4);
  max-height: 620px;
  overflow: auto;
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 18px;
}

.chat-message {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: var(--space-3);
}

.chat-message--user {
  grid-template-columns: minmax(0, 1fr) 44px;
}

.chat-message--user .message-avatar {
  grid-column: 2;
  grid-row: 1;
  background: var(--color-secondary);
}

.chat-message--user .message-body {
  grid-column: 1;
  grid-row: 1;
  background: var(--color-primary-light);
}

.message-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--color-primary);
  color: white;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.message-body {
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 18px;
}

.message-body p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  white-space: pre-line;
}

.message-references {
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.message-references span {
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);
}

.message-references ul {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-5);
}

.question-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.question-form textarea,
.upload-notes {
  width: 100%;
  resize: vertical;
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-primary);
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  font: inherit;
}

.side-panel {
  display: grid;
  gap: var(--space-6);
}

.roadmap-card,
.upload-card {
  padding: var(--space-6);
}

.roadmap-card ol {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding-left: 1.25rem;
}

.roadmap-card li::marker {
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
}

.roadmap-card strong,
.roadmap-card span {
  display: block;
}

.roadmap-card span,
.upload-card p,
.reference-card p {
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.upload-card {
  scroll-margin-top: 90px;
}

.upload-card .form-input,
.upload-card .upload-notes {
  margin-top: var(--space-3);
}

.file-upload {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--control-height);
  margin-top: var(--space-3);
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}

.file-upload input {
  display: none;
}

.upload-status {
  margin-bottom: 0;
  color: var(--color-success) !important;
  font-weight: var(--font-weight-semibold);
}

.reference-library {
  margin-top: var(--space-6);
}

.reference-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.reference-card {
  position: relative;
  min-height: 260px;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: var(--color-bg-primary);
}

.reference-meta span,
.topic-list span {
  padding: 5px 9px;
}

.reference-card h3 {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--font-size-lg);
}

.remove-doc {
  margin-top: var(--space-3);
  padding: 6px 10px;
  color: var(--color-danger);
  background: transparent;
  border: 1px solid currentColor;
  border-radius: var(--radius-md);
}

@media (max-width: 1180px) {
  .ai-hero,
  .content-grid {
    grid-template-columns: 1fr;
  }

  .hero-card {
    grid-template-columns: repeat(3, 1fr);
  }

  .reference-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .tea-ai-page {
    padding: var(--space-4);
  }

  .hero-card,
  .reference-grid {
    grid-template-columns: 1fr;
  }

  .panel-header,
  .question-form {
    grid-template-columns: 1fr;
    display: grid;
  }

  .chat-message,
  .chat-message--user {
    grid-template-columns: 1fr;
  }

  .chat-message--user .message-avatar,
  .chat-message--user .message-body {
    grid-column: auto;
    grid-row: auto;
  }
}
</style>
