<script setup lang="ts">
import { computed, nextTick, onMounted, ref, type ComponentPublicInstance } from 'vue';
import { ArrowUp, BookOpen, Info, Leaf, Trash2, Upload } from '@lucide/vue';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import { useAuthStore } from '@/stores/authStore';
import { useConfirm } from '@/composables/useConfirm';
import { api, type KnowledgeChatHistoryMessage, type KnowledgeChatSource, type KnowledgeDocument, type KnowledgeStatus } from '@/services/api';
import { EmptyState, PageContainer, PageHeader, Spinner } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

interface ChatMessage {
    id: string;
    role: 'assistant' | 'user';
    text: string;
    sources?: KnowledgeChatSource[];
    sourceOnly?: boolean;
}

const authStore = useAuthStore();
const { confirm } = useConfirm();
const isAdmin = computed(() => authStore.isAdmin);

const sampleQuestions = [
    'Çay tarımına yeni başlıyorum, ilk olarak nelere dikkat etmeliyim?',
    'Çay bahçesinde gübrelemeyi neye göre planlamalıyım?',
    'Yaş çayda kalite kaybını nasıl azaltırım?',
    'Dekar başına maliyetimi nasıl hesaplarım?',
];

const messages = ref<ChatMessage[]>([]);
const question = ref('');
const sending = ref(false);
const chatError = ref('');
const chatScroll = ref<HTMLElement | null>(null);
const composerEl = ref<ComponentPublicInstance | null>(null);

const status = ref<KnowledgeStatus | null>(null);
const documents = ref<KnowledgeDocument[]>([]);
const loadingDocuments = ref(true);

const selectedFile = ref<File | null>(null);
const uploadTitle = ref('');
const uploading = ref(false);
const uploadError = ref('');
const uploadSuccess = ref('');
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];

const hasConversation = computed(() => messages.value.length > 0);

const sourceMode = computed(() => !!status.value && !status.value.aiConfigured);

const statusPill = computed(() => {
    if (!status.value) return null;
    return status.value.aiConfigured
        ? {
              label: 'Yapay zekâ aktif',
              tone: 'active' as const,
              title: `Model: ${status.value.model}`,
          }
        : {
              label: 'Kaynak modu',
              tone: 'muted' as const,
              title: 'Yapay zekâ bağlı değil; yanıtlar yüklenen belge metinlerinden özetlenir.',
          };
});

/** Share of uploaded documents that are fully indexed, as a percentage. */
const indexedPercent = computed(() => {
    if (!status.value || status.value.documentCount === 0) return 0;
    return Math.round((status.value.readyDocumentCount / status.value.documentCount) * 100);
});

function createId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes: number): string {
    if (!bytes) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function documentKind(document: KnowledgeDocument): string {
    const name = document.fileName.toLowerCase();
    if (document.mimeType.includes('pdf') || name.endsWith('.pdf')) return 'PDF';
    if (document.mimeType.includes('word') || name.endsWith('.docx')) return 'Word';
    if (name.endsWith('.md')) return 'MD';
    return 'Metin';
}

async function loadKnowledge(): Promise<void> {
    loadingDocuments.value = true;
    const [statusResult, documentsResult] = await Promise.all([api.getKnowledgeStatus(), api.getKnowledgeDocuments()]);
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
    const el = composerEl.value?.$el;
    if (!(el instanceof HTMLTextAreaElement)) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

function buildHistory(): KnowledgeChatHistoryMessage[] {
    return messages.value.slice(-8).map((message) => ({ role: message.role, content: message.text }));
}

async function ask(prompt?: string): Promise<void> {
    const text = (prompt ?? question.value).trim();
    if (!text || sending.value) return;

    chatError.value = '';
    const history = buildHistory();
    messages.value.push({ id: createId('user'), role: 'user', text });
    question.value = '';
    await nextTick();
    autoGrow();
    sending.value = true;
    await scrollToBottom();

    const { data, error } = await api.knowledgeChat(text, history);

    if (data) {
        messages.value.push({
            id: createId('assistant'),
            role: 'assistant',
            text: data.answer,
            sources: data.sources,
            sourceOnly: !data.usedAi,
        });
    } else {
        chatError.value = error?.message ?? 'Yanıt alınamadı. Lütfen tekrar deneyin.';
        messages.value.push({
            id: createId('assistant'),
            role: 'assistant',
            text: 'Şu anda yanıt veremiyorum. Bağlantınızı kontrol edip tekrar deneyebilirsiniz.',
        });
    }

    sending.value = false;
    await scrollToBottom();
}

function onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void ask();
    }
}

function setFile(file: File | null): void {
    uploadError.value = '';
    uploadSuccess.value = '';

    if (!file) {
        selectedFile.value = null;
        return;
    }

    const name = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
        uploadError.value = 'Yalnızca PDF, Word (.docx), TXT veya MD yükleyebilirsiniz.';
        selectedFile.value = null;
        if (fileInput.value) fileInput.value.value = '';
        return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        uploadError.value = 'Dosya en fazla 25 MB olabilir.';
        selectedFile.value = null;
        if (fileInput.value) fileInput.value.value = '';
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
    uploadError.value = '';
    uploadSuccess.value = '';

    const { data, error } = await api.uploadKnowledgeDocument(selectedFile.value, uploadTitle.value.trim() || undefined);

    if (data) {
        uploadSuccess.value = `"${data.title}" bilgi tabanına eklendi · ${data.chunkCount} bölüm indekslendi.`;
        selectedFile.value = null;
        uploadTitle.value = '';
        if (fileInput.value) fileInput.value.value = '';
        await loadKnowledge();
    } else {
        uploadError.value = error?.message ?? 'Belge yüklenemedi.';
    }

    uploading.value = false;
}

async function removeDocument(document: KnowledgeDocument): Promise<void> {
    const accepted = await confirm({
        title: 'Belgeyi kaldır',
        message: `"${document.title}" belgesi bilgi tabanından kalıcı olarak kaldırılsın mı?`,
        confirmText: 'Kaldır',
        cancelText: 'Vazgeç',
        variant: 'danger',
    });
    if (!accepted) return;
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
        <PageContainer size="wide">
            <PageHeader
                title="Çay tarımı asistanı"
                description="Yöneticilerin yüklediği belgeleri okur; kaynaklarda olmayan konularda kendi tarım bilgisiyle yanıtlar."
            >
                <template v-if="statusPill" #badge>
                    <Badge :variant="statusPill.tone === 'active' ? 'success' : 'muted'" :title="statusPill.title">
                        <span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
                        {{ statusPill.label }}
                    </Badge>
                </template>
                <template v-if="status" #meta>
                    <Badge variant="secondary" class="tabular-nums">{{ status.documentCount }} belge</Badge>
                    <Badge variant="secondary" class="tabular-nums">{{ status.chunkCount }} bölüm</Badge>
                </template>
            </PageHeader>

            <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
                <!-- Conversation -->
                <Card class="min-w-0 gap-0 overflow-hidden py-0" aria-label="Asistan sohbeti">
                    <div
                        ref="chatScroll"
                        class="flex max-h-[56vh] min-h-80 flex-col gap-5 overflow-y-auto scroll-smooth p-4 md:p-5 lg:h-[calc(100dvh-20rem)] lg:max-h-none motion-reduce:scroll-auto"
                        aria-live="polite"
                    >
                        <!-- Welcome / empty state -->
                        <div v-if="!hasConversation" class="m-auto flex max-w-xl flex-col items-center gap-3 py-6 text-center">
                            <span class="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                                <Leaf class="size-7" />
                            </span>
                            <h2 class="text-lg font-bold tracking-tight text-foreground">Çay tarımı asistanınız hazır</h2>
                            <p class="max-w-md text-sm leading-relaxed text-muted-foreground">
                                Yüklenen kaynak belgelere ve kendi tarım bilgime dayanarak; çaya başlama, bahçe bakımı, gübreleme, hasat
                                kalitesi ve maliyet gibi konularda yardımcı olurum.
                            </p>
                            <Alert v-if="sourceMode" variant="info" class="max-w-md text-left">
                                <Info aria-hidden="true" />
                                <AlertDescription>Şu an kaynak modunda: yanıtlar yalnızca yüklenen belgelerden özetlenir.</AlertDescription>
                            </Alert>
                            <div class="mt-2 flex flex-wrap justify-center gap-2">
                                <Button
                                    v-for="sample in sampleQuestions"
                                    :key="sample"
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    class="h-auto max-w-full min-h-11 whitespace-normal text-left md:min-h-9"
                                    :disabled="sending"
                                    @click="ask(sample)"
                                >
                                    {{ sample }}
                                </Button>
                            </div>
                        </div>

                        <!-- Messages -->
                        <template v-else>
                            <article
                                v-for="message in messages"
                                :key="message.id"
                                class="flex items-start gap-3"
                                :class="message.role === 'user' && 'justify-end'"
                            >
                                <span
                                    v-if="message.role === 'assistant'"
                                    class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                                    aria-hidden="true"
                                >
                                    <Leaf class="size-4" />
                                </span>
                                <div
                                    :class="
                                        message.role === 'assistant'
                                            ? 'min-w-0 max-w-2xl flex-1 pt-1'
                                            : 'max-w-[84%] rounded-lg border bg-muted px-4 py-3'
                                    "
                                >
                                    <p class="text-sm leading-relaxed whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{{ message.text }}</p>
                                    <Badge v-if="message.sourceOnly" variant="warning" class="mt-2">Kaynak özeti</Badge>
                                    <div v-if="message.sources && message.sources.length" class="mt-4 border-t pt-3">
                                        <span class="mb-2 block text-xs font-semibold text-muted-foreground">Kaynaklar</span>
                                        <ol class="flex flex-col gap-2">
                                            <li
                                                v-for="(source, index) in message.sources"
                                                :key="`${message.id}-${source.documentId}-${index}`"
                                                class="flex items-start gap-3"
                                            >
                                                <span
                                                    class="flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-bold text-muted-foreground tabular-nums"
                                                >
                                                    {{ index + 1 }}
                                                </span>
                                                <div class="flex min-w-0 flex-col gap-0.5">
                                                    <strong class="text-sm font-semibold text-foreground">{{ source.title }}</strong>
                                                    <span class="text-xs text-muted-foreground">{{ source.snippet }}</span>
                                                </div>
                                            </li>
                                        </ol>
                                    </div>
                                </div>
                            </article>

                            <article v-if="sending" class="flex items-start gap-3" role="status" aria-label="Asistan yazıyor">
                                <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                                    <Leaf class="size-4" />
                                </span>
                                <span class="flex items-center gap-1.5 py-3" aria-hidden="true">
                                    <span class="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s] motion-reduce:animate-none"></span>
                                    <span class="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s] motion-reduce:animate-none"></span>
                                    <span class="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"></span>
                                </span>
                            </article>
                        </template>
                    </div>

                    <!-- Composer -->
                    <form class="flex flex-col gap-2 border-t p-3 md:p-4" @submit.prevent="ask()">
                        <Alert v-if="chatError" variant="destructive" role="alert">
                            <AlertDescription>{{ chatError }}</AlertDescription>
                        </Alert>
                        <div class="flex items-end gap-2">
                            <Label for="ai-question" class="sr-only">Sorunuz</Label>
                            <Textarea
                                id="ai-question"
                                ref="composerEl"
                                v-model="question"
                                rows="1"
                                class="max-h-40 min-h-11 resize-none md:min-h-9"
                                placeholder="Bir soru yazın…"
                                :disabled="sending"
                                @input="autoGrow"
                                @keydown="onInputKeydown"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                class="size-11 shrink-0 rounded-full md:size-9"
                                :disabled="sending || !question.trim()"
                                :aria-label="sending ? 'Yanıtlanıyor' : 'Gönder'"
                            >
                                <Spinner v-if="sending" />
                                <ArrowUp v-else aria-hidden="true" />
                            </Button>
                        </div>
                        <p class="text-xs text-muted-foreground">Enter ile gönderin, Shift+Enter ile yeni satır.</p>
                    </form>
                </Card>

                <!-- Knowledge base -->
                <Card class="min-w-0 self-start" aria-label="Bilgi tabanı">
                    <CardHeader>
                        <CardTitle>Bilgi tabanı</CardTitle>
                        <CardDescription v-if="status" class="tabular-nums">{{ status.readyDocumentCount }} / {{ status.documentCount }} belge indekslendi</CardDescription>
                        <CardAction>
                            <Badge variant="secondary" class="tabular-nums">{{ documents.length }} belge</Badge>
                        </CardAction>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-4">
                        <Progress v-if="status && status.documentCount > 0" :model-value="indexedPercent" aria-label="İndeksleme durumu" />

                        <!-- Admin upload -->
                        <template v-if="isAdmin">
                            <div
                                class="flex flex-col gap-3 rounded-lg"
                                :class="isDragging && 'ring-3 ring-ring/50'"
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
                                    class="flex min-h-20 w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-background p-4 text-left text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                                    :class="isDragging && 'border-primary bg-primary/5 text-primary'"
                                    @click="fileInput?.click()"
                                >
                                    <Upload class="size-5 shrink-0" aria-hidden="true" />
                                    <span class="flex min-w-0 flex-col gap-0.5">
                                        <span class="truncate text-sm font-semibold">
                                            {{ selectedFile ? selectedFile.name : 'Dosya seç veya buraya bırak' }}
                                        </span>
                                        <span class="text-xs">
                                            {{ selectedFile ? formatBytes(selectedFile.size) : 'PDF, Word, TXT veya MD · en fazla 25 MB' }}
                                        </span>
                                    </span>
                                </button>

                                <div class="space-y-2">
                                    <Label for="ai-doc-title" class="sr-only">Belge başlığı</Label>
                                    <Input id="ai-doc-title" v-model="uploadTitle" type="text" class="h-11 md:h-9" placeholder="Başlık (opsiyonel)" />
                                </div>

                                <Button type="button" class="h-11 w-full md:h-9" :disabled="!selectedFile || uploading" @click="uploadDocument">
                                    <Spinner v-if="uploading" />
                                    {{ uploading ? 'Yükleniyor…' : 'Bilgi tabanına ekle' }}
                                </Button>

                                <Alert v-if="uploadError" variant="destructive" role="alert">
                                    <AlertDescription>{{ uploadError }}</AlertDescription>
                                </Alert>
                                <Alert v-if="uploadSuccess" variant="success" role="status">
                                    <AlertDescription>{{ uploadSuccess }}</AlertDescription>
                                </Alert>
                            </div>

                            <Separator />
                        </template>

                        <!-- Document list -->
                        <ul v-if="loadingDocuments" class="flex flex-col divide-y" aria-hidden="true">
                            <li v-for="n in 3" :key="`sk-${n}`" class="flex items-center gap-3 py-3">
                                <Skeleton class="h-6 w-11 shrink-0 rounded-sm" />
                                <span class="flex flex-1 flex-col gap-1.5">
                                    <Skeleton class="h-3 w-3/4" />
                                    <Skeleton class="h-2.5 w-1/2" />
                                </span>
                            </li>
                        </ul>

                        <EmptyState
                            v-else-if="!documents.length"
                            :icon="BookOpen"
                            title="Henüz belge eklenmedi"
                            :description="
                                isAdmin
                                    ? 'Yukarıdan bir doküman ekleyin; metni asistanın hafızasına işlenir.'
                                    : 'Belgeleri yalnızca yöneticiler ekleyebilir.'
                            "
                            class="min-h-40 py-6"
                        />

                        <ul v-else class="flex flex-col divide-y">
                            <li v-for="document in documents" :key="document.id" class="flex items-center gap-3 py-3">
                                <Badge variant="outline" class="min-w-11 justify-center rounded-sm font-bold">{{ documentKind(document) }}</Badge>
                                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <strong class="truncate text-sm font-semibold text-foreground">{{ document.title }}</strong>
                                    <span class="text-xs text-muted-foreground tabular-nums">
                                        {{ document.chunkCount }} bölüm · {{ formatBytes(document.fileSize) }} · {{ formatDate(document.createdAt) }}
                                    </span>
                                </div>
                                <Button
                                    v-if="isAdmin"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    class="size-11 shrink-0 text-muted-foreground hover:text-destructive md:size-9"
                                    :aria-label="`${document.title} belgesini kaldır`"
                                    @click="removeDocument(document)"
                                >
                                    <Trash2 aria-hidden="true" />
                                </Button>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    </TeaBusinessLayout>
</template>
