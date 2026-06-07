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

const sampleQuestions = [
  "Çay tarımına yeni başlıyorum, ilk olarak nelere dikkat etmeliyim?",
  "Çay bahçesinde gübrelemeyi neye göre planlamalıyım?",
  "Yaş çayda kalite kaybını nasıl azaltırım?",
  "Dekar başına maliyetimi nasıl hesaplarım?",
];

const messages = ref<ChatMessage[]>([]);
const question = ref("");
const sending = ref(false);
const chatError = ref("");
const chatScroll = ref<HTMLElement | null>(null);
const composerEl = ref<HTMLTextAreaElement | null>(null);

const status = ref<KnowledgeStatus | null>(null);
const documents = ref<KnowledgeDocument[]>([]);
const loadingDocuments = ref(true);

const selectedFile = ref<File | null>(null);
const uploadTitle = ref("");
const uploading = ref(false);
const uploadError = ref("");
const uploadSuccess = ref("");
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

const hasConversation = computed(() => messages.value.length > 0);

const sourceMode = computed(
  () => !!status.value && !status.value.aiConfigured,
);

const statusPill = computed(() => {
  if (!status.value) return null;
  return status.value.aiConfigured
    ? {
        label: "Yapay zekâ aktif",
        tone: "active" as const,
        title: `Model: ${status.value.model}`,
      }
    : {
        label: "Kaynak modu",
        tone: "muted" as const,
        title:
          "Yapay zekâ bağlı değil; yanıtlar yüklenen belge metinlerinden özetlenir.",
      };
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
  if (name.endsWith(".md")) return "MD";
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

function autoGrow(): void {
  const el = composerEl.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

function buildHistory(): KnowledgeChatHistoryMessage[] {
  return messages.value
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
  await nextTick();
  autoGrow();
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

function setFile(file: File | null): void {
  uploadError.value = "";
  uploadSuccess.value = "";

  if (!file) {
    selectedFile.value = null;
    return;
  }

  const name = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    uploadError.value = "Yalnızca PDF, Word (.docx), TXT veya MD yükleyebilirsiniz.";
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = "";
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    uploadError.value = "Dosya en fazla 25 MB olabilir.";
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = "";
    return;
  }
  selectedFile.value = file;
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  setFile(input.files?.[0] ?? null);
}

function onDragOver(): void {
  if (!isAdmin.value || uploading.value) return;
  isDragging.value = true;
}

function onDragLeave(): void {
  isDragging.value = false;
}

function onDrop(event: DragEvent): void {
  isDragging.value = false;
  if (!isAdmin.value || uploading.value) return;
  setFile(event.dataTransfer?.files?.[0] ?? null);
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
    uploadSuccess.value = `"${data.title}" bilgi tabanına eklendi · ${data.chunkCount} bölüm indekslendi.`;
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
    <div class="ai">
      <header class="ai__bar">
        <div class="ai__title">
          <h1>Çay tarımı asistanı</h1>
          <p>
            Yöneticilerin yüklediği belgeleri okur; kaynaklarda olmayan
            konularda kendi tarım bilgisiyle yanıtlar.
          </p>
        </div>
        <div v-if="status" class="ai__status">
          <span class="ai__meta">
            {{ status.documentCount }} belge · {{ status.chunkCount }} bölüm
          </span>
          <span
            v-if="statusPill"
            class="pill"
            :class="`pill--${statusPill.tone}`"
            :title="statusPill.title"
          >
            <span class="pill__dot" aria-hidden="true"></span>
            {{ statusPill.label }}
          </span>
        </div>
      </header>

      <div class="ai__grid">
        <!-- Conversation -->
        <section class="convo" aria-label="Asistan sohbeti">
          <div ref="chatScroll" class="convo__log" aria-live="polite">
            <!-- Welcome / empty state -->
            <div v-if="!hasConversation" class="welcome">
              <span class="welcome__badge" aria-hidden="true">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M7 20h10" />
                  <path d="M10 20c5.5-2.5.8-6.4 3-10" />
                  <path
                    d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"
                  />
                  <path
                    d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"
                  />
                </svg>
              </span>
              <h2 class="welcome__title">Çay tarımı asistanınız hazır</h2>
              <p class="welcome__text">
                Yüklenen kaynak belgelere ve kendi tarım bilgime dayanarak;
                çaya başlama, bahçe bakımı, gübreleme, hasat kalitesi ve maliyet
                gibi konularda yardımcı olurum.
              </p>
              <p v-if="sourceMode" class="welcome__note">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Şu an kaynak modunda: yanıtlar yalnızca yüklenen belgelerden
                özetlenir.
              </p>
              <div class="welcome__samples">
                <button
                  v-for="(sample, index) in sampleQuestions"
                  :key="sample"
                  type="button"
                  class="chip"
                  :style="{ '--i': index }"
                  :disabled="sending"
                  @click="ask(sample)"
                >
                  {{ sample }}
                </button>
              </div>
            </div>

            <!-- Messages -->
            <template v-else>
              <article
                v-for="message in messages"
                :key="message.id"
                class="msg"
                :class="`msg--${message.role}`"
              >
                <span
                  v-if="message.role === 'assistant'"
                  class="msg__avatar"
                  aria-hidden="true"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M7 20h10" />
                    <path d="M10 20c5.5-2.5.8-6.4 3-10" />
                    <path
                      d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"
                    />
                    <path
                      d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"
                    />
                  </svg>
                </span>
                <div class="msg__body">
                  <p class="msg__text">{{ message.text }}</p>
                  <span v-if="message.sourceOnly" class="msg__tag">
                    Kaynak özeti
                  </span>
                  <div
                    v-if="message.sources && message.sources.length"
                    class="sources"
                  >
                    <span class="sources__label">Kaynaklar</span>
                    <ol class="sources__list">
                      <li
                        v-for="(source, index) in message.sources"
                        :key="`${message.id}-${source.documentId}-${index}`"
                        class="source"
                      >
                        <span class="source__num">{{ index + 1 }}</span>
                        <div class="source__body">
                          <strong class="source__title">{{
                            source.title
                          }}</strong>
                          <span class="source__snippet">{{
                            source.snippet
                          }}</span>
                        </div>
                      </li>
                    </ol>
                  </div>
                </div>
              </article>

              <article
                v-if="sending"
                class="msg msg--assistant"
                role="status"
                aria-label="Asistan yazıyor"
              >
                <span class="msg__avatar" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M7 20h10" />
                    <path d="M10 20c5.5-2.5.8-6.4 3-10" />
                    <path
                      d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"
                    />
                    <path
                      d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"
                    />
                  </svg>
                </span>
                <div class="msg__body">
                  <span class="typing" aria-hidden="true">
                    <i></i><i></i><i></i>
                  </span>
                </div>
              </article>
            </template>
          </div>

          <!-- Composer -->
          <form class="composer" @submit.prevent="ask()">
            <p v-if="chatError" class="composer__error" role="alert">
              {{ chatError }}
            </p>
            <div class="composer__field">
              <label class="sr-only" for="ai-question">Sorunuz</label>
              <textarea
                id="ai-question"
                ref="composerEl"
                v-model="question"
                rows="1"
                class="composer__input"
                placeholder="Bir soru yazın…"
                :disabled="sending"
                @input="autoGrow"
                @keydown="onInputKeydown"
              />
              <button
                type="submit"
                class="composer__send"
                :disabled="sending || !question.trim()"
                :aria-label="sending ? 'Yanıtlanıyor' : 'Gönder'"
              >
                <svg
                  v-if="!sending"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
                <span v-else class="spinner" aria-hidden="true"></span>
              </button>
            </div>
            <p class="composer__hint">
              Enter ile gönderin, Shift+Enter ile yeni satır.
            </p>
          </form>
        </section>

        <!-- Knowledge base -->
        <aside class="kb" aria-label="Bilgi tabanı">
          <div class="kb__panel">
            <header class="kb__head">
              <h2>Bilgi tabanı</h2>
              <span class="kb__count">{{ documents.length }} belge</span>
            </header>

            <!-- Admin upload -->
            <div
              v-if="isAdmin"
              class="upload"
              :class="{ 'is-drag': isDragging }"
              @dragover.prevent="onDragOver"
              @dragleave.prevent="onDragLeave"
              @drop.prevent="onDrop"
            >
              <input
                ref="fileInput"
                type="file"
                class="sr-only"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                @change="onFileChange"
              />
              <button
                type="button"
                class="upload__drop"
                @click="fileInput?.click()"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 13v8" />
                  <path d="m8 17 4-4 4 4" />
                  <path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3" />
                </svg>
                <span class="upload__drop-main">
                  <span class="upload__drop-title">
                    {{ selectedFile ? selectedFile.name : "Dosya seç veya buraya bırak" }}
                  </span>
                  <span class="upload__drop-sub">
                    {{
                      selectedFile
                        ? formatBytes(selectedFile.size)
                        : "PDF, Word, TXT veya MD · en fazla 25 MB"
                    }}
                  </span>
                </span>
              </button>

              <label class="sr-only" for="ai-doc-title">Belge başlığı</label>
              <input
                id="ai-doc-title"
                v-model="uploadTitle"
                type="text"
                class="form-input"
                placeholder="Başlık (opsiyonel)"
              />

              <button
                type="button"
                class="btn btn-primary btn-block"
                :disabled="!selectedFile || uploading"
                @click="uploadDocument"
              >
                <span v-if="uploading" class="spinner" aria-hidden="true"></span>
                {{ uploading ? "Yükleniyor…" : "Bilgi tabanına ekle" }}
              </button>

              <div
                v-if="uploadError"
                class="message-box message-box-error kb__msg"
                role="alert"
              >
                {{ uploadError }}
              </div>
              <div
                v-if="uploadSuccess"
                class="message-box message-box-success kb__msg"
                role="status"
              >
                {{ uploadSuccess }}
              </div>
            </div>

            <div v-if="isAdmin" class="kb__divider" aria-hidden="true"></div>

            <!-- Document list -->
            <div class="kb__list-wrap">
              <ul v-if="loadingDocuments" class="kb__list" aria-hidden="true">
                <li v-for="n in 3" :key="`sk-${n}`" class="doc doc--skeleton">
                  <span class="skeleton doc__kind-sk"></span>
                  <span class="doc__text">
                    <span class="skeleton doc__title-sk"></span>
                    <span class="skeleton doc__meta-sk"></span>
                  </span>
                </li>
              </ul>

              <div v-else-if="!documents.length" class="kb__empty">
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 7v14" />
                  <path
                    d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
                  />
                </svg>
                <p class="kb__empty-title">Henüz belge eklenmedi</p>
                <p class="kb__empty-sub">
                  {{
                    isAdmin
                      ? "Yukarıdan bir doküman ekleyin; metni asistanın hafızasına işlenir."
                      : "Belgeleri yalnızca yöneticiler ekleyebilir."
                  }}
                </p>
              </div>

              <ul v-else class="kb__list">
                <li
                  v-for="document in documents"
                  :key="document.id"
                  class="doc"
                >
                  <span class="doc__kind" :data-kind="documentKind(document)">
                    {{ documentKind(document) }}
                  </span>
                  <div class="doc__text">
                    <strong class="doc__title">{{ document.title }}</strong>
                    <span class="doc__meta">
                      {{ document.chunkCount }} bölüm ·
                      {{ formatBytes(document.fileSize) }} ·
                      {{ formatDate(document.createdAt) }}
                    </span>
                  </div>
                  <button
                    v-if="isAdmin"
                    type="button"
                    class="doc__remove"
                    :aria-label="`${document.title} belgesini kaldır`"
                    @click="removeDocument(document)"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <line x1="10" x2="10" y1="11" y2="17" />
                      <line x1="14" x2="14" y1="11" y2="17" />
                    </svg>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </TeaBusinessLayout>
</template>

<style scoped>
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

.ai {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-6) var(--space-6);
  color: var(--color-text-primary);
}

/* ── Top bar ── */
.ai__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3) var(--space-4);
}

.ai__title h1 {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.ai__title p {
  margin: 6px 0 0;
  max-width: 62ch;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.ai__status {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.ai__meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.pill__dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: currentColor;
}

.pill--active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-color: color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.pill--muted {
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

/* ── Grid ── */
.ai__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
}

/* ── Conversation ── */
.convo {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.convo__log {
  flex: 1;
  min-height: 0;
  max-height: 56vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5);
  scroll-behavior: smooth;
}

/* ── Welcome / empty ── */
.welcome {
  margin: auto;
  max-width: 540px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) 0;
  text-align: center;
}

.welcome__badge {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.welcome__title {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.01em;
}

.welcome__text {
  margin: 0;
  max-width: 48ch;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.welcome__note {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-1) 0 0;
  padding: var(--space-2) var(--space-3);
  max-width: 46ch;
  text-align: left;
  background: color-mix(in srgb, var(--color-info) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-info) 30%, transparent);
  border-radius: var(--radius-md);
  color: var(--color-info);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.welcome__note svg {
  flex-shrink: 0;
}

.welcome__samples {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
  margin-top: var(--space-3);
}

.chip {
  min-height: 36px;
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
  animation: chip-in 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--i, 0) * 50ms);
}

.chip:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes chip-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

/* ── Messages ── */
.msg {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  animation: msg-in 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.msg--user {
  justify-content: flex-end;
}

.msg__avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.msg--assistant .msg__body {
  flex: 1;
  min-width: 0;
  max-width: 660px;
  padding-top: 5px;
}

.msg--user .msg__body {
  max-width: 84%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.msg__text {
  margin: 0;
  color: var(--color-text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.msg__tag {
  display: inline-block;
  margin-top: var(--space-2);
  padding: 2px 8px;
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  border-radius: var(--radius-sm);
  color: var(--color-warning);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

@keyframes msg-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* ── Sources ── */
.sources {
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.sources__label {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.sources__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
}

.source {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.source__num {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
}

.source__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.source__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.source__snippet {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

/* ── Typing indicator ── */
.typing {
  display: inline-flex;
  gap: 5px;
  padding: var(--space-2) 0;
}

.typing i {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
  opacity: 0.5;
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

/* ── Composer ── */
.composer {
  flex-shrink: 0;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.composer__error {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 32%, transparent);
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.composer__field {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: 6px 6px 6px var(--space-4);
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-lg);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.composer__field:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.composer__input {
  flex: 1;
  min-width: 0;
  min-height: 32px;
  max-height: 160px;
  padding: 8px 0;
  border: none;
  background: transparent;
  resize: none;
  color: var(--color-text-primary);
  font: inherit;
  line-height: 1.5;
}

.composer__input:focus {
  outline: none;
}

.composer__input::placeholder {
  color: var(--color-text-muted);
}

.composer__send {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-on-primary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.composer__send:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.composer__send:active:not(:disabled) {
  transform: scale(0.94);
}

.composer__send:disabled {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.composer__hint {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* ── Knowledge base ── */
.kb {
  min-width: 0;
}

.kb__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.kb__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.kb__head h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.kb__count {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

/* Upload */
.upload {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border-radius: var(--radius-md);
  transition: box-shadow var(--transition-fast);
}

.upload.is-drag {
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.upload__drop {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 80px;
  padding: var(--space-4);
  text-align: left;
  background: var(--color-bg-primary);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
}

.upload__drop:hover,
.upload.is-drag .upload__drop {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.upload__drop svg {
  flex-shrink: 0;
}

.upload__drop-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.upload__drop-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload__drop-sub {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.upload__drop:hover .upload__drop-sub,
.upload.is-drag .upload__drop-sub {
  color: inherit;
}

.kb__msg {
  margin: 0;
  font-size: var(--font-size-sm);
}

.kb__divider {
  height: 1px;
  background: var(--color-border);
}

/* List */
.kb__list-wrap {
  min-height: 0;
}

.kb__list {
  display: flex;
  flex-direction: column;
}

.doc {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.doc:last-child {
  border-bottom: none;
}

.doc__kind {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  min-width: 44px;
  height: 26px;
  padding: 0 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 0.6875rem;
  font-weight: var(--font-weight-bold);
}

.doc__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.doc__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc__meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.doc__remove {
  display: grid;
  place-items: center;
  position: relative;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.doc__remove::before {
  content: "";
  position: absolute;
  inset: -5px;
}

.doc__remove:hover {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 9%, transparent);
  border-color: color-mix(in srgb, var(--color-danger) 26%, transparent);
}

/* Empty */
.kb__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--color-text-muted);
}

.kb__empty-title {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.kb__empty-sub {
  margin: 0;
  max-width: 30ch;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

/* Skeleton */
.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
}

.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    var(--color-overlay-lighter),
    transparent
  );
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  to {
    transform: translateX(100%);
  }
}

.doc--skeleton {
  align-items: center;
}

.doc__kind-sk {
  width: 44px;
  height: 26px;
  flex-shrink: 0;
}

.doc__title-sk {
  width: 70%;
  height: 12px;
  margin-bottom: 6px;
}

.doc__meta-sk {
  width: 45%;
  height: 10px;
}

/* ── Desktop: full-height app surface ── */
@media (min-width: 961px) {
  .ai {
    height: calc(100vh - 64px - env(safe-area-inset-top));
    overflow: hidden;
  }

  .ai__grid {
    flex: 1;
    min-height: 0;
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: stretch;
  }

  .convo {
    min-height: 0;
  }

  .convo__log {
    max-height: none;
  }

  .kb__panel {
    height: 100%;
    min-height: 0;
  }

  .kb__list-wrap {
    flex: 1;
    overflow-y: auto;
    margin-right: calc(-1 * var(--space-2));
    padding-right: var(--space-2);
  }
}

/* ── Small screens ── */
@media (max-width: 600px) {
  .ai {
    padding: var(--space-4) var(--space-4) var(--space-5);
    gap: var(--space-4);
  }

  .ai__status {
    width: 100%;
    justify-content: space-between;
  }

  .convo__log {
    padding: var(--space-4);
    gap: var(--space-4);
  }

  .composer {
    padding: var(--space-3) var(--space-4);
  }

  .msg--user .msg__body {
    max-width: 90%;
  }
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .chip,
  .msg {
    animation: none;
  }

  .typing i {
    animation: none;
  }

  .skeleton::after {
    animation: none;
  }

  .convo__log {
    scroll-behavior: auto;
  }
}
</style>
