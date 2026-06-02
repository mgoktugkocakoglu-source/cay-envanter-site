<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import TeaBusinessLayout from "@/layouts/TeaBusinessLayout.vue";
import { useAuthStore } from "@/stores/authStore";
import {
  api,
  type KnowledgeChatHistoryMessage,
  type KnowledgeChatSource,
  type KnowledgeDocument,
  type KnowledgeStatus,
} from "@/services/api";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  sources?: KnowledgeChatSource[];
  sourceOnly?: boolean;
}

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

const WELCOME_TEXT =
  "Merhaba! Ben çay tarımı asistanınız. Yüklenen kaynak belgelere ve kendi tarım bilgime dayanarak; çaya başlama, bahçe bakımı, gübreleme, hasat kalitesi, maliyet ve risk yönetimi gibi konularda yardımcı olabilirim. Aşağıdan bir soru sorun.";

const sampleQuestions = [
  "Çay tarımına yeni başlıyorum, ilk olarak nelere dikkat etmeliyim?",
  "Çay bahçesinde gübrelemeyi neye göre planlamalıyım?",
  "Yaş çayda kalite kaybını nasıl azaltırım?",
  "Dekar başına maliyetimi nasıl hesaplarım?",
];

const messages = ref<ChatMessage[]>([
  { id: "welcome", role: "assistant", text: WELCOME_TEXT },
]);
const question = ref("");
const sending = ref(false);
const chatError = ref("");
const chatScroll = ref<HTMLElement | null>(null);

const status = ref<KnowledgeStatus | null>(null);
const documents = ref<KnowledgeDocument[]>([]);
const loadingDocuments = ref(true);

const selectedFile = ref<File | null>(null);
const uploadTitle = ref("");
const uploading = ref(false);
const uploadError = ref("");
const uploadSuccess = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const hasConversation = computed(() =>
  messages.value.some((message) => message.role === "user"),
);

const aiBadge = computed(() => {
  if (!status.value) return null;
  return status.value.aiConfigured
    ? { label: "Yapay zekâ aktif", tone: "active" as const }
    : { label: "Kaynak modu", tone: "muted" as const };
});

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function documentKind(document: KnowledgeDocument): string {
  const name = document.fileName.toLowerCase();
  if (document.mimeType.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (document.mimeType.includes("word") || name.endsWith(".docx"))
    return "Word";
  if (name.endsWith(".md")) return "Markdown";
  return "Metin";
}

async function loadKnowledge(): Promise<void> {
  loadingDocuments.value = true;
  const [statusResult, documentsResult] = await Promise.all([
    api.getKnowledgeStatus(),
    api.getKnowledgeDocuments(),
  ]);
  if (statusResult.data) status.value = statusResult.data;
  if (documentsResult.data) documents.value = documentsResult.data;
  loadingDocuments.value = false;
}

async function scrollToBottom(): Promise<void> {
  await nextTick();
  const el = chatScroll.value;
  if (el) el.scrollTop = el.scrollHeight;
}

function buildHistory(): KnowledgeChatHistoryMessage[] {
  return messages.value
    .filter((message) => message.id !== "welcome")
    .slice(-8)
    .map((message) => ({ role: message.role, content: message.text }));
}

async function ask(prompt?: string): Promise<void> {
  const text = (prompt ?? question.value).trim();
  if (!text || sending.value) return;

  chatError.value = "";
  const history = buildHistory();
  messages.value.push({ id: createId("user"), role: "user", text });
  question.value = "";
  sending.value = true;
  await scrollToBottom();

  const { data, error } = await api.knowledgeChat(text, history);

  if (data) {
    messages.value.push({
      id: createId("assistant"),
      role: "assistant",
      text: data.answer,
      sources: data.sources,
      sourceOnly: !data.usedAi,
    });
  } else {
    chatError.value =
      error?.message ?? "Yanıt alınamadı. Lütfen tekrar deneyin.";
    messages.value.push({
      id: createId("assistant"),
      role: "assistant",
      text: "Şu anda yanıt veremiyorum. Bağlantınızı kontrol edip tekrar deneyebilirsiniz.",
    });
  }

  sending.value = false;
  await scrollToBottom();
}

function onInputKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void ask();
  }
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  uploadError.value = "";
  uploadSuccess.value = "";

  if (file && file.size > MAX_UPLOAD_BYTES) {
    uploadError.value = "Dosya en fazla 25 MB olabilir.";
    selectedFile.value = null;
    input.value = "";
    return;
  }
  selectedFile.value = file;
}

async function uploadDocument(): Promise<void> {
  if (!selectedFile.value || uploading.value) return;

  uploading.value = true;
  uploadError.value = "";
  uploadSuccess.value = "";

  const { data, error } = await api.uploadKnowledgeDocument(
    selectedFile.value,
    uploadTitle.value.trim() || undefined,
  );

  if (data) {
    uploadSuccess.value = `"${data.title}" bilgi tabanına eklendi (${data.chunkCount} bölüm).`;
    selectedFile.value = null;
    uploadTitle.value = "";
    if (fileInput.value) fileInput.value.value = "";
    await loadKnowledge();
  } else {
    uploadError.value = error?.message ?? "Belge yüklenemedi.";
  }

  uploading.value = false;
}

async function removeDocument(document: KnowledgeDocument): Promise<void> {
  if (
    !window.confirm(
      `"${document.title}" belgesi bilgi tabanından kalıcı olarak kaldırılsın mı?`,
    )
  ) {
    return;
  }
  const { error } = await api.deleteKnowledgeDocument(document.id);
  if (error) {
    uploadError.value = error.message;
    return;
  }
  await loadKnowledge();
}

onMounted(loadKnowledge);
</script>

<template>
  <TeaBusinessLayout>
    <div class="ai-page">
      <header class="ai-header">
        <div class="ai-header__intro">
          <span class="eyebrow">Çay Bilgi Asistanı</span>
          <h1>Belge destekli çay tarımı danışmanı</h1>
          <p>
            Yöneticilerin yüklediği doküman ve ders notlarını referans alır,
            kaynaklarda olmayan konularda kendi tarım bilgisiyle yanıt verir.
          </p>
        </div>
        <dl class="ai-stats" aria-label="Bilgi tabanı özeti">
          <div class="ai-stat">
            <dt>Belge</dt>
            <dd>{{ status?.documentCount ?? "–" }}</dd>
          </div>
          <div class="ai-stat">
            <dt>İndekslenen bölüm</dt>
            <dd>{{ status?.chunkCount ?? "–" }}</dd>
          </div>
          <div v-if="aiBadge" class="ai-stat">
            <dt>Durum</dt>
            <dd class="ai-stat__badge" :class="`is-${aiBadge.tone}`">
              {{ aiBadge.label }}
            </dd>
          </div>
        </dl>
      </header>

      <div class="ai-layout">
        <!-- Chat -->
        <section class="chat" aria-label="Asistan sohbeti">
          <div ref="chatScroll" class="chat__log" aria-live="polite">
            <article
              v-for="message in messages"
              :key="message.id"
              class="msg"
              :class="`msg--${message.role}`"
            >
              <div class="msg__avatar" aria-hidden="true">
                {{ message.role === "assistant" ? "AI" : "Siz" }}
              </div>
              <div class="msg__body">
                <p class="msg__text">{{ message.text }}</p>
                <span v-if="message.sourceOnly" class="msg__note">
                  Yapay zekâ yapılandırılmadığı için kaynak özetleri gösteriliyor.
                </span>
                <div
                  v-if="message.sources && message.sources.length"
                  class="msg__sources"
                >
                  <span class="msg__sources-title">Kaynaklar</span>
                  <ul>
                    <li
                      v-for="source in message.sources"
                      :key="source.documentId"
                    >
                      <strong>{{ source.title }}</strong>
                      <span>{{ source.snippet }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </article>

            <article
              v-if="sending"
              class="msg msg--assistant"
              aria-label="Asistan yazıyor"
            >
              <div class="msg__avatar" aria-hidden="true">AI</div>
              <div class="msg__body">
                <span class="typing" aria-hidden="true">
                  <i></i><i></i><i></i>
                </span>
              </div>
            </article>
          </div>

          <div v-if="!hasConversation" class="chat__samples">
            <button
              v-for="sample in sampleQuestions"
              :key="sample"
              type="button"
              class="chip"
              :disabled="sending"
              @click="ask(sample)"
            >
              {{ sample }}
            </button>
          </div>

          <form class="chat__form" @submit.prevent="ask()">
            <label class="sr-only" for="ai-question">Sorunuz</label>
            <textarea
              id="ai-question"
              v-model="question"
              rows="2"
              class="chat__input"
              placeholder="Bir soru yazın… (Enter ile gönder, Shift+Enter ile yeni satır)"
              :disabled="sending"
              @keydown="onInputKeydown"
            />
            <button
              type="submit"
              class="btn btn-primary chat__send"
              :disabled="sending || !question.trim()"
            >
              {{ sending ? "Yanıtlanıyor…" : "Gönder" }}
            </button>
          </form>
          <p v-if="chatError" class="chat__error" role="alert">
            {{ chatError }}
          </p>
        </section>

        <!-- Knowledge base -->
        <aside class="kb" aria-label="Bilgi tabanı">
          <section v-if="isAdmin" class="kb__card kb__upload">
            <h2>Belge yükle</h2>
            <p class="kb__hint">
              PDF, Word (.docx), TXT veya MD. Yüklenen belge metni asistanın
              hafızasına eklenir.
            </p>
            <input
              ref="fileInput"
              type="file"
              class="sr-only"
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              @change="onFileChange"
            />
            <button
              type="button"
              class="kb__filepick"
              @click="fileInput?.click()"
            >
              <span>{{ selectedFile ? selectedFile.name : "Dosya seç" }}</span>
              <span v-if="selectedFile" class="kb__filesize">
                {{ formatBytes(selectedFile.size) }}
              </span>
            </button>
            <label class="sr-only" for="ai-doc-title">Başlık</label>
            <input
              id="ai-doc-title"
              v-model="uploadTitle"
              type="text"
              class="kb__title-input"
              placeholder="Başlık (opsiyonel)"
            />
            <button
              type="button"
              class="btn btn-primary kb__upload-btn"
              :disabled="!selectedFile || uploading"
              @click="uploadDocument"
            >
              {{ uploading ? "Yükleniyor…" : "Bilgi tabanına ekle" }}
            </button>
            <p v-if="uploadError" class="kb__msg is-error" role="alert">
              {{ uploadError }}
            </p>
            <p v-if="uploadSuccess" class="kb__msg is-success" role="status">
              {{ uploadSuccess }}
            </p>
          </section>

          <section class="kb__card">
            <div class="kb__head">
              <h2>Bilgi tabanı</h2>
              <span class="kb__count">{{ documents.length }} belge</span>
            </div>

            <p v-if="loadingDocuments" class="kb__empty">Yükleniyor…</p>
            <p v-else-if="!documents.length" class="kb__empty">
              Henüz belge yok.
              <template v-if="!isAdmin">
                Belgeleri yalnızca yöneticiler ekleyebilir.
              </template>
            </p>

            <ul v-else class="kb__list">
              <li v-for="document in documents" :key="document.id" class="doc">
                <div class="doc__main">
                  <span class="doc__kind">{{ documentKind(document) }}</span>
                  <div class="doc__text">
                    <strong class="doc__title">{{ document.title }}</strong>
                    <span class="doc__meta">
                      {{ document.chunkCount }} bölüm ·
                      {{ formatBytes(document.fileSize) }} ·
                      {{ formatDate(document.createdAt) }}
                    </span>
                  </div>
                </div>
                <button
                  v-if="isAdmin"
                  type="button"
                  class="doc__remove"
                  :aria-label="`${document.title} belgesini kaldır`"
                  @click="removeDocument(document)"
                >
                  Kaldır
                </button>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  </TeaBusinessLayout>
</template>

<style scoped>
.ai-page {
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-6);
  color: var(--color-text-primary);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Header */
.ai-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-6);
  margin-bottom: var(--space-6);
}

.eyebrow {
  display: inline-block;
  margin-bottom: var(--space-2);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ai-header h1 {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-3xl);
  line-height: var(--line-height-tight);
}

.ai-header__intro p {
  max-width: 60ch;
  margin: 0;
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.ai-stats {
  display: flex;
  gap: var(--space-3);
  margin: 0;
}

.ai-stat {
  min-width: 92px;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.ai-stat dt {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.ai-stat dd {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: 1;
}

.ai-stat__badge {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.ai-stat__badge.is-active {
  color: var(--color-primary);
}

.ai-stat__badge.is-muted {
  color: var(--color-text-muted);
}

/* Layout */
.ai-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: var(--space-6);
  align-items: start;
}

/* Chat */
.chat {
  display: flex;
  flex-direction: column;
  min-height: 540px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.chat__log {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-height: 56vh;
  overflow-y: auto;
  padding-right: var(--space-2);
}

.msg {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}

.msg--user {
  grid-template-columns: minmax(0, 1fr) 36px;
}

.msg__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.msg--user .msg__avatar {
  grid-column: 2;
  grid-row: 1;
}

.msg--user .msg__body {
  grid-column: 1;
  grid-row: 1;
}

.msg__body {
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.msg--user .msg__body {
  background: var(--color-bg-tertiary);
}

.msg__text {
  margin: 0;
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.msg__note {
  display: block;
  margin-top: var(--space-2);
  color: var(--color-warning);
  font-size: var(--font-size-xs);
}

.msg__sources {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.msg__sources-title {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.msg__sources ul {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.msg__sources li {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.msg__sources strong {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.msg__sources span {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

.typing {
  display: inline-flex;
  gap: 5px;
  padding: var(--space-1) 0;
}

.typing i {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
  opacity: 0.5;
}

@media (prefers-reduced-motion: no-preference) {
  .typing i {
    animation: typing-bounce 1.2s infinite ease-in-out;
  }
  .typing i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .typing i:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes typing-bounce {
    0%,
    60%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-4px);
      opacity: 0.9;
    }
  }
}

.chat__samples {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.chip {
  min-height: 36px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast);
}

.chip:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat__form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.chat__input {
  width: 100%;
  resize: vertical;
  min-height: var(--control-height);
  padding: var(--space-3) var(--space-4);
  font: inherit;
  color: var(--color-text-primary);
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
}

.chat__input:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

.chat__send {
  align-self: end;
  min-height: var(--control-height);
  white-space: nowrap;
}

.chat__error {
  margin: var(--space-3) 0 0;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

/* Knowledge base */
.kb {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.kb__card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.kb__card h2 {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-lg);
}

.kb__hint {
  margin: 0 0 var(--space-4);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.kb__filepick {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--control-height);
  padding: var(--space-3) var(--space-4);
  text-align: left;
  background: var(--color-bg-primary);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.kb__filepick:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.kb__filesize {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.kb__title-input {
  width: 100%;
  min-height: var(--control-height);
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  font: inherit;
  color: var(--color-text-primary);
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
}

.kb__title-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

.kb__upload-btn {
  width: 100%;
  min-height: var(--control-height);
  margin-top: var(--space-3);
}

.kb__msg {
  margin: var(--space-3) 0 0;
  font-size: var(--font-size-sm);
}

.kb__msg.is-error {
  color: var(--color-danger);
}

.kb__msg.is-success {
  color: var(--color-primary);
}

.kb__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.kb__head h2 {
  margin: 0;
}

.kb__count {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.kb__empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.kb__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.doc {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.doc__main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.doc__kind {
  flex-shrink: 0;
  padding: 4px 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 0.6875rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.02em;
}

.doc__text {
  min-width: 0;
}

.doc__title {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc__meta {
  display: block;
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.doc__remove {
  flex-shrink: 0;
  min-height: 32px;
  padding: 0 var(--space-3);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.doc__remove:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

/* Responsive */
@media (max-width: 960px) {
  .ai-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .ai-page {
    padding: var(--space-4);
  }
  .ai-header h1 {
    font-size: var(--font-size-2xl);
  }
  .chat__form {
    grid-template-columns: 1fr;
  }
  .chat__send {
    width: 100%;
  }
}
</style>
