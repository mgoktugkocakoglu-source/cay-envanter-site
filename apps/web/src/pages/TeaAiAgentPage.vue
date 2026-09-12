<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue';
import {
    ArrowUp,
    BookOpen,
    Check,
    Copy,
    Download,
    Eye,
    Info,
    Leaf,
    MoreVertical,
    RefreshCw,
    Sparkles,
    Square,
    Trash2,
    Upload,
} from '@lucide/vue';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import { useAuthStore } from '@/stores/authStore';
import { useConfirm } from '@/composables/useConfirm';
import { useToast } from '@/composables/useToast';
import {
    api,
    type KnowledgeChatHistoryMessage,
    type KnowledgeChatSource,
    type KnowledgeDocument,
    type KnowledgeRetrievalMode,
    type KnowledgeStatus,
} from '@/services/api';
import { renderMarkdown } from '@/lib/markdown';
import { documentKind, downloadKnowledgeDocument, formatBytes } from '@/lib/knowledgeFiles';
import DocumentViewerDialog, { type ViewerTarget } from '@/components/knowledge/DocumentViewerDialog.vue';
import { EmptyState, PageContainer, PageHeader, SearchInput, Spinner } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

interface ChatMessage {
    id: string;
    role: 'assistant' | 'user';
    text: string;
    sources: KnowledgeChatSource[];
    followUps: string[];
    retrievalMode?: KnowledgeRetrievalMode;
    /** True for the retrieval-only fallback (no LLM answer). */
    sourceOnly?: boolean;
    streaming?: boolean;
    error?: string;
}

/** Sources of one answer grouped per document, keeping every cited page. */
interface SourceGroup {
    documentId: string;
    title: string;
    fileName: string;
    mimeType: string;
    citations: KnowledgeChatSource[];
}

const authStore = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();
const isAdmin = computed(() => authStore.isAdmin);

const FALLBACK_QUESTIONS = [
    'Yaş çay alım fiyatı nasıl belirleniyor?',
    'Budama desteği kimlere ve nasıl ödeniyor?',
    'Çay bahçesinde gübreleme hangi döneme göre planlanmalı?',
    'Rize çay üretiminde son yıllardaki eğilim nedir?',
];
const STARTER_QUESTION_COUNT = 6;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];
const PROCESSING_POLL_MS = 4000;

// ─── Chat state ───
const messages = ref<ChatMessage[]>([]);
const question = ref('');
const streaming = ref(false);
const chatError = ref('');
const chatScroll = ref<HTMLElement | null>(null);
const composerEl = ref<ComponentPublicInstance | null>(null);
const copiedMessageId = ref('');
let abortController: AbortController | null = null;

// ─── Library state ───
const status = ref<KnowledgeStatus | null>(null);
const documents = ref<KnowledgeDocument[]>([]);
const loadingDocuments = ref(true);
const librarySearch = ref('');
const starterQuestions = ref<string[]>([]);
let pollTimer: number | null = null;

// ─── Viewer state ───
const viewerOpen = ref(false);
const viewerTarget = ref<ViewerTarget | null>(null);

// ─── Admin upload state ───
const uploadOpen = ref(false);
const selectedFile = ref<File | null>(null);
const uploadTitle = ref('');
const uploading = ref(false);
const uploadError = ref('');
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const reindexingAll = ref(false);

const hasConversation = computed(() => messages.value.length > 0);
const sourceMode = computed(() => !!status.value && !status.value.aiConfigured);

const statusPill = computed(() => {
    if (!status.value) return null;
    return status.value.aiConfigured
        ? { label: 'Yapay zekâ aktif', tone: 'active' as const, title: `Model: ${status.value.model}` }
        : {
              label: 'Kaynak modu',
              tone: 'muted' as const,
              title: 'Yapay zekâ bağlı değil; yanıtlar yüklenen belge metinlerinden özetlenir.',
          };
});

const documentsById = computed(() => new Map(documents.value.map((document) => [document.id, document])));

const filteredDocuments = computed(() => {
    const term = librarySearch.value.trim().toLocaleLowerCase('tr-TR');
    if (!term) return documents.value;
    return documents.value.filter(
        (document) =>
            document.title.toLocaleLowerCase('tr-TR').includes(term) ||
            document.fileName.toLocaleLowerCase('tr-TR').includes(term),
    );
});

const processingCount = computed(() => documents.value.filter((document) => document.status === 'processing').length);

const lastAssistantId = computed(() => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
        if (messages.value[i].role === 'assistant') return messages.value[i].id;
    }
    return '';
});

function createId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function retrievalLabel(mode?: KnowledgeRetrievalMode): string {
    if (mode === 'hybrid') return 'Anlamsal + anahtar kelime arama';
    if (mode === 'keyword') return 'Anahtar kelime arama';
    return '';
}

/** Picks a fresh random handful of LLM-generated starter questions from the library. */
function pickStarterQuestions(): void {
    const pool = documents.value
        .filter((document) => document.status === 'ready')
        .flatMap((document) => document.suggestedQuestions ?? []);
    if (!pool.length) {
        starterQuestions.value = FALLBACK_QUESTIONS;
        return;
    }
    const shuffled = [...new Set(pool)];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    starterQuestions.value = shuffled.slice(0, STARTER_QUESTION_COUNT);
}

// ─── Library ───

async function loadKnowledge(options: { silent?: boolean } = {}): Promise<void> {
    if (!options.silent) loadingDocuments.value = true;
    const [statusResult, documentsResult] = await Promise.all([api.getKnowledgeStatus(), api.getKnowledgeDocuments()]);
    if (statusResult.data) status.value = statusResult.data;
    if (documentsResult.data) documents.value = documentsResult.data;
    loadingDocuments.value = false;
    if (!options.silent || !starterQuestions.value.length || starterQuestions.value === FALLBACK_QUESTIONS) {
        pickStarterQuestions();
    }
    schedulePoll();
}

/** While any document is still being embedded, refresh the list periodically. */
function schedulePoll(): void {
    if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
    }
    if (processingCount.value > 0) {
        pollTimer = window.setTimeout(() => void loadKnowledge({ silent: true }), PROCESSING_POLL_MS);
    }
}

function openDocument(document: KnowledgeDocument, pageNumber?: number | null, snippet?: string): void {
    viewerTarget.value = { document, pageNumber: pageNumber ?? null, snippet };
    viewerOpen.value = true;
}

async function downloadDocument(document: KnowledgeDocument): Promise<void> {
    const message = await downloadKnowledgeDocument(document);
    if (message) toast.error(message);
}

function openSource(source: KnowledgeChatSource): void {
    const document = documentsById.value.get(source.documentId);
    if (!document) {
        toast.warning('Bu kaynak belge artık kütüphanede yok.');
        return;
    }
    openDocument(document, source.pageNumber, source.snippet);
}

function groupSources(sources: KnowledgeChatSource[]): SourceGroup[] {
    const groups = new Map<string, SourceGroup>();
    for (const source of sources) {
        const existing = groups.get(source.documentId);
        if (existing) {
            existing.citations.push(source);
            continue;
        }
        const document = documentsById.value.get(source.documentId);
        groups.set(source.documentId, {
            documentId: source.documentId,
            title: source.title,
            fileName: source.fileName,
            mimeType: document?.mimeType ?? '',
            citations: [source],
        });
    }
    return [...groups.values()];
}

// ─── Chat ───

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
    return messages.value
        .filter((message) => !message.error && message.text.trim())
        .slice(-8)
        .map((message) => ({ role: message.role, content: message.text }));
}

function renderAnswer(message: ChatMessage): string {
    return renderMarkdown(message.text, message.sources.length);
}

/** Citation chips are rendered inside v-html; delegate their clicks here. */
function onAnswerClick(event: MouseEvent, message: ChatMessage): void {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-citation]');
    if (!target) return;
    const index = Number(target.dataset.citation);
    const source = message.sources.find((item) => item.index === index);
    if (source) openSource(source);
}

async function ask(prompt?: string): Promise<void> {
    const text = (prompt ?? question.value).trim();
    if (!text || streaming.value) return;

    chatError.value = '';
    const history = buildHistory();
    messages.value.push({ id: createId('user'), role: 'user', text, sources: [], followUps: [] });

    const assistant: ChatMessage = {
        id: createId('assistant'),
        role: 'assistant',
        text: '',
        sources: [],
        followUps: [],
        streaming: true,
    };
    messages.value.push(assistant);
    const assistantIndex = messages.value.length - 1;
    const patch = (changes: Partial<ChatMessage>): void => {
        messages.value[assistantIndex] = { ...messages.value[assistantIndex], ...changes };
    };

    question.value = '';
    await nextTick();
    autoGrow();
    streaming.value = true;
    abortController = new AbortController();
    await scrollToBottom();

    try {
        await api.streamKnowledgeChat(
            text,
            history,
            (event) => {
                if (event.type === 'meta') {
                    patch({ sources: event.sources, retrievalMode: event.retrievalMode, sourceOnly: !event.usedAi });
                } else if (event.type === 'delta') {
                    patch({ text: messages.value[assistantIndex].text + event.text });
                    void scrollToBottom();
                } else if (event.type === 'done') {
                    patch({ text: event.answer || messages.value[assistantIndex].text, followUps: event.followUps });
                } else if (event.type === 'error') {
                    patch({ error: event.message });
                }
            },
            abortController.signal,
        );
    } catch (error) {
        if (abortController.signal.aborted) {
            patch({ error: messages.value[assistantIndex].text ? 'Yanıt durduruldu.' : '' });
        } else {
            const message = error instanceof Error && error.message ? error.message : 'Yanıt alınamadı. Lütfen tekrar deneyin.';
            chatError.value = message;
            patch({ error: message });
        }
    } finally {
        patch({ streaming: false });
        streaming.value = false;
        abortController = null;
        await scrollToBottom();
    }
}

function stopStreaming(): void {
    abortController?.abort();
}

async function clearConversation(): Promise<void> {
    if (streaming.value) stopStreaming();
    messages.value = [];
    chatError.value = '';
    pickStarterQuestions();
    await nextTick();
}

async function copyAnswer(message: ChatMessage): Promise<void> {
    try {
        await navigator.clipboard.writeText(message.text);
        copiedMessageId.value = message.id;
        window.setTimeout(() => {
            if (copiedMessageId.value === message.id) copiedMessageId.value = '';
        }, 2000);
    } catch {
        toast.error('Panoya kopyalanamadı.');
    }
}

function onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void ask();
    }
}

// ─── Admin: upload / reindex / delete ───

function openUploadDialog(): void {
    uploadError.value = '';
    selectedFile.value = null;
    uploadTitle.value = '';
    uploadOpen.value = true;
}

function setFile(file: File | null): void {
    uploadError.value = '';
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

function onDrop(event: DragEvent): void {
    isDragging.value = false;
    if (uploading.value) return;
    setFile(event.dataTransfer?.files?.[0] ?? null);
}

async function uploadDocument(): Promise<void> {
    if (!selectedFile.value || uploading.value) return;
    uploading.value = true;
    uploadError.value = '';

    const { data, error } = await api.uploadKnowledgeDocument(selectedFile.value, uploadTitle.value.trim() || undefined);
    uploading.value = false;

    if (!data) {
        uploadError.value = error?.message ?? 'Belge yüklenemedi.';
        return;
    }

    toast.success(`"${data.title}" eklendi · ${data.chunkCount} bölüm indeksleniyor.`);
    uploadOpen.value = false;
    selectedFile.value = null;
    uploadTitle.value = '';
    if (fileInput.value) fileInput.value.value = '';
    await loadKnowledge({ silent: true });
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
        toast.error(error.message);
        return;
    }
    toast.success('Belge kaldırıldı.');
    await loadKnowledge({ silent: true });
}

async function reindexDocument(document: KnowledgeDocument): Promise<void> {
    const { error } = await api.reindexKnowledgeDocument(document.id);
    if (error) {
        toast.error(error.message);
        return;
    }
    toast.info(`"${document.title}" yeniden indeksleniyor.`);
    await loadKnowledge({ silent: true });
}

async function reindexAll(): Promise<void> {
    if (reindexingAll.value) return;
    const accepted = await confirm({
        title: 'Tümünü yeniden indeksle',
        message: 'Tüm belgeler yeniden gömülecek ve başlangıç soruları yenilenecek. Bu işlem Gemini kredisi kullanır.',
        confirmText: 'Başlat',
        cancelText: 'Vazgeç',
    });
    if (!accepted) return;
    reindexingAll.value = true;
    const { data, error } = await api.reindexKnowledge();
    reindexingAll.value = false;
    if (error) {
        toast.error(error.message);
        return;
    }
    toast.info(`${data?.queued ?? 0} belge yeniden indeksleniyor.`);
    await loadKnowledge({ silent: true });
}

onMounted(() => void loadKnowledge());
onBeforeUnmount(() => {
    if (pollTimer !== null) window.clearTimeout(pollTimer);
    abortController?.abort();
});
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer size="wide">
            <PageHeader
                title="Çay uzmanı asistan"
                description="Yalnızca kütüphanedeki belgelerden yanıt verir; her bilgi kaynağına ve sayfasına bağlıdır."
            >
                <template v-if="statusPill" #badge>
                    <Badge :variant="statusPill.tone === 'active' ? 'success' : 'muted'" :title="statusPill.title">
                        <span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
                        {{ statusPill.label }}
                    </Badge>
                </template>
                <template v-if="status" #meta>
                    <Badge variant="secondary" class="tabular-nums">{{ status.documentCount }} belge</Badge>
                    <Badge v-if="status.pageCount" variant="secondary" class="tabular-nums">{{ status.pageCount }} sayfa</Badge>
                    <Badge variant="secondary" class="tabular-nums">{{ status.chunkCount }} bölüm</Badge>
                </template>
                <template v-if="isAdmin" #actions>
                    <Button type="button" variant="outline" class="h-11 md:h-9" :disabled="reindexingAll" @click="reindexAll">
                        <RefreshCw aria-hidden="true" />
                        <span class="hidden sm:inline">Yeniden indeksle</span>
                    </Button>
                    <Button type="button" class="h-11 md:h-9" @click="openUploadDialog">
                        <Upload aria-hidden="true" />
                        Belge ekle
                    </Button>
                </template>
            </PageHeader>

            <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <!-- Conversation -->
                <Card class="min-w-0 gap-0 overflow-hidden py-0" aria-label="Asistan sohbeti">
                    <div
                        ref="chatScroll"
                        class="flex max-h-[60vh] min-h-80 flex-col gap-6 overflow-y-auto scroll-smooth p-4 md:p-5 lg:h-[calc(100dvh-19rem)] lg:max-h-none motion-reduce:scroll-auto"
                        aria-live="polite"
                    >
                        <!-- Welcome -->
                        <div v-if="!hasConversation" class="m-auto flex w-full max-w-2xl flex-col items-center gap-3 py-6 text-center">
                            <span class="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                                <Leaf class="size-7" />
                            </span>
                            <h2 class="text-lg font-bold tracking-tight text-foreground">Belgelere dayalı çay uzmanınız</h2>
                            <p class="max-w-md text-sm leading-relaxed text-muted-foreground">
                                Yanıtlarımı yalnızca kütüphanedeki belgelerden üretirim; her cümlenin yanında hangi belgenin hangi
                                sayfasından geldiğini görürsünüz. Belgede olmayan bir şeyi uydurmam.
                            </p>
                            <Alert v-if="sourceMode" variant="info" class="max-w-md text-left">
                                <Info aria-hidden="true" />
                                <AlertDescription>Şu an kaynak modunda: yanıtlar yalnızca yüklenen belgelerden özetlenir.</AlertDescription>
                            </Alert>

                            <div v-if="starterQuestions.length" class="mt-3 flex w-full flex-col items-center gap-2">
                                <span class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                    <Sparkles class="size-3.5" aria-hidden="true" />
                                    Belgelerden sorabilecekleriniz
                                </span>
                                <div class="flex flex-wrap justify-center gap-2">
                                    <Button
                                        v-for="sample in starterQuestions"
                                        :key="sample"
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        class="h-auto max-w-full min-h-11 whitespace-normal text-left md:min-h-9"
                                        :disabled="streaming"
                                        @click="ask(sample)"
                                    >
                                        {{ sample }}
                                    </Button>
                                </div>
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

                                <!-- User bubble -->
                                <div v-if="message.role === 'user'" class="max-w-[84%] rounded-lg border bg-muted px-4 py-3">
                                    <p class="text-sm leading-relaxed whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{{ message.text }}</p>
                                </div>

                                <!-- Assistant answer -->
                                <div v-else class="group min-w-0 max-w-3xl flex-1 pt-1">
                                    <div
                                        v-if="message.text"
                                        class="text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:font-semibold [&_h5]:mt-2 [&_h5]:font-semibold [&_strong]:font-semibold [&_.citation]:ml-0.5 [&_.citation]:inline-flex [&_.citation]:h-5 [&_.citation]:min-w-5 [&_.citation]:cursor-pointer [&_.citation]:items-center [&_.citation]:justify-center [&_.citation]:rounded-sm [&_.citation]:bg-primary/10 [&_.citation]:px-1 [&_.citation]:align-text-bottom [&_.citation]:text-[11px] [&_.citation]:font-bold [&_.citation]:text-primary [&_.citation]:tabular-nums [&_.citation:hover]:bg-primary/20 [&_.citation:focus-visible]:ring-2 [&_.citation:focus-visible]:ring-ring/50 [&_.citation:focus-visible]:outline-none"
                                        @click="onAnswerClick($event, message)"
                                        v-html="renderAnswer(message)"
                                    ></div>

                                    <!-- Typing indicator (before the first fragment) -->
                                    <span v-if="message.streaming && !message.text" class="flex items-center gap-1.5 py-2" role="status" aria-label="Asistan yazıyor">
                                        <span class="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s] motion-reduce:animate-none"></span>
                                        <span class="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s] motion-reduce:animate-none"></span>
                                        <span class="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"></span>
                                    </span>
                                    <span
                                        v-else-if="message.streaming"
                                        class="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary align-text-bottom motion-reduce:animate-none"
                                        aria-hidden="true"
                                    ></span>

                                    <p v-if="message.error" class="mt-2 text-xs text-destructive">{{ message.error }}</p>

                                    <div v-if="!message.streaming && message.text" class="mt-2 flex flex-wrap items-center gap-2">
                                        <Badge v-if="message.sourceOnly" variant="warning">Kaynak özeti</Badge>
                                        <span v-if="retrievalLabel(message.retrievalMode)" class="text-xs text-muted-foreground">
                                            {{ retrievalLabel(message.retrievalMode) }}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-9 px-2 text-muted-foreground"
                                            :aria-label="copiedMessageId === message.id ? 'Kopyalandı' : 'Yanıtı kopyala'"
                                            @click="copyAnswer(message)"
                                        >
                                            <Check v-if="copiedMessageId === message.id" class="text-success" aria-hidden="true" />
                                            <Copy v-else aria-hidden="true" />
                                            {{ copiedMessageId === message.id ? 'Kopyalandı' : 'Kopyala' }}
                                        </Button>
                                    </div>

                                    <!-- Sources -->
                                    <div v-if="message.sources.length" class="mt-3 rounded-lg border bg-card">
                                        <span class="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
                                            <BookOpen class="size-3.5" aria-hidden="true" />
                                            Kaynaklar
                                        </span>
                                        <ul class="flex flex-col divide-y">
                                            <li
                                                v-for="group in groupSources(message.sources)"
                                                :key="`${message.id}-${group.documentId}`"
                                                class="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                                            >
                                                <div class="flex min-w-0 flex-1 items-center gap-2">
                                                    <Badge variant="outline" class="shrink-0 rounded-sm font-bold">
                                                        {{ documentKind({ fileName: group.fileName, mimeType: group.mimeType }) }}
                                                    </Badge>
                                                    <strong class="truncate text-sm font-semibold text-foreground">{{ group.title }}</strong>
                                                </div>
                                                <div class="flex flex-wrap items-center gap-1.5">
                                                    <button
                                                        v-for="citation in group.citations"
                                                        :key="citation.chunkId"
                                                        type="button"
                                                        class="inline-flex min-h-9 items-center gap-1 rounded-md border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                                                        :title="citation.snippet"
                                                        @click="openSource(citation)"
                                                    >
                                                        <span class="flex size-4 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-bold text-primary tabular-nums">
                                                            {{ citation.index }}
                                                        </span>
                                                        <span class="tabular-nums">{{ citation.pageNumber ? `Sayfa ${citation.pageNumber}` : 'Bölüm' }}</span>
                                                    </button>
                                                    <Button
                                                        v-if="documentsById.get(group.documentId)?.hasFile"
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        class="size-9 text-muted-foreground"
                                                        :aria-label="`${group.title} belgesini indir`"
                                                        @click="downloadDocument(documentsById.get(group.documentId)!)"
                                                    >
                                                        <Download aria-hidden="true" />
                                                    </Button>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>

                                    <!-- Follow-up suggestions -->
                                    <div v-if="message.followUps.length && message.id === lastAssistantId && !streaming" class="mt-3 flex flex-wrap gap-2">
                                        <Button
                                            v-for="followUp in message.followUps"
                                            :key="followUp"
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            class="h-auto max-w-full min-h-11 whitespace-normal text-left md:min-h-9"
                                            @click="ask(followUp)"
                                        >
                                            <Sparkles class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                                            {{ followUp }}
                                        </Button>
                                    </div>
                                </div>
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
                                placeholder="Belgelerle ilgili bir soru yazın…"
                                :disabled="streaming"
                                @input="autoGrow"
                                @keydown="onInputKeydown"
                            />
                            <Button
                                v-if="streaming"
                                type="button"
                                variant="outline"
                                size="icon"
                                class="size-11 shrink-0 rounded-full md:size-9"
                                aria-label="Yanıtı durdur"
                                @click="stopStreaming"
                            >
                                <Square class="size-3.5 fill-current" aria-hidden="true" />
                            </Button>
                            <Button
                                v-else
                                type="submit"
                                size="icon"
                                class="size-11 shrink-0 rounded-full md:size-9"
                                :disabled="!question.trim()"
                                aria-label="Gönder"
                            >
                                <ArrowUp aria-hidden="true" />
                            </Button>
                        </div>
                        <div class="flex items-center justify-between gap-2">
                            <p class="text-xs text-muted-foreground">Enter ile gönderin, Shift+Enter ile yeni satır.</p>
                            <Button
                                v-if="hasConversation"
                                type="button"
                                variant="ghost"
                                size="sm"
                                class="h-9 text-muted-foreground"
                                @click="clearConversation"
                            >
                                Sohbeti temizle
                            </Button>
                        </div>
                    </form>
                </Card>

                <!-- Library -->
                <Card class="min-w-0 self-start" aria-label="Belge kütüphanesi">
                    <CardHeader>
                        <CardTitle>Kütüphane</CardTitle>
                        <CardDescription>Asistanın yanıt verdiği belgeler. Açabilir ve indirebilirsiniz.</CardDescription>
                        <CardAction>
                            <Badge v-if="processingCount" variant="info" class="tabular-nums">
                                <Spinner class="size-3" />
                                {{ processingCount }} indeksleniyor
                            </Badge>
                            <Badge v-else variant="secondary" class="tabular-nums">{{ documents.length }} belge</Badge>
                        </CardAction>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-3">
                        <SearchInput v-if="documents.length > 4" v-model="librarySearch" placeholder="Belge ara…" aria-label="Belge ara" />

                        <ul v-if="loadingDocuments" class="flex flex-col divide-y" aria-hidden="true">
                            <li v-for="n in 4" :key="`sk-${n}`" class="flex items-center gap-3 py-3">
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
                                    ? 'Sağ üstteki “Belge ekle” ile PDF, Word veya metin yükleyin.'
                                    : 'Belgeleri yalnızca yöneticiler ekleyebilir.'
                            "
                            class="min-h-40 py-6"
                        />

                        <EmptyState
                            v-else-if="!filteredDocuments.length"
                            :icon="BookOpen"
                            title="Eşleşen belge yok"
                            description="Farklı bir arama terimi deneyin."
                            class="min-h-32 py-4"
                        />

                        <ul v-else class="flex flex-col divide-y">
                            <li v-for="document in filteredDocuments" :key="document.id" class="flex items-center gap-3 py-3">
                                <Badge variant="outline" class="min-w-11 justify-center rounded-sm font-bold">{{ documentKind(document) }}</Badge>
                                <button
                                    type="button"
                                    class="flex min-h-11 min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
                                    :disabled="!document.hasFile"
                                    :title="document.hasFile ? 'Belgeyi aç' : 'Orijinal dosya saklanmamış'"
                                    @click="openDocument(document)"
                                >
                                    <strong class="w-full truncate text-sm font-semibold text-foreground">{{ document.title }}</strong>
                                    <span class="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground tabular-nums">
                                        <span v-if="document.pageCount">{{ document.pageCount }} sayfa ·</span>
                                        <span>{{ formatBytes(document.fileSize) }} · {{ formatDate(document.createdAt) }}</span>
                                    </span>
                                    <span class="flex flex-wrap gap-1">
                                        <Badge v-if="document.status === 'processing'" variant="info" class="text-[11px]">
                                            <Spinner class="size-3" />
                                            İndeksleniyor
                                        </Badge>
                                        <Badge v-else-if="document.status === 'failed'" variant="danger" class="text-[11px]">Başarısız</Badge>
                                        <Badge
                                            v-else-if="document.errorMessage"
                                            variant="warning"
                                            class="text-[11px]"
                                            :title="document.errorMessage"
                                        >
                                            Anahtar kelime modu
                                        </Badge>
                                        <Badge v-if="!document.hasFile" variant="muted" class="text-[11px]" title="Açmak için belgeyi yeniden yükleyin">
                                            Dosya yok
                                        </Badge>
                                    </span>
                                </button>

                                <div class="flex shrink-0 items-center">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        class="size-11 text-muted-foreground md:size-9"
                                        :disabled="!document.hasFile"
                                        :aria-label="`${document.title} belgesini aç`"
                                        @click="openDocument(document)"
                                    >
                                        <Eye aria-hidden="true" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        class="size-11 text-muted-foreground md:size-9"
                                        :disabled="!document.hasFile"
                                        :aria-label="`${document.title} belgesini indir`"
                                        @click="downloadDocument(document)"
                                    >
                                        <Download aria-hidden="true" />
                                    </Button>
                                    <DropdownMenu v-if="isAdmin">
                                        <DropdownMenuTrigger as-child>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                class="size-11 text-muted-foreground md:size-9"
                                                :aria-label="`${document.title} için işlemler`"
                                            >
                                                <MoreVertical aria-hidden="true" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem :disabled="document.status === 'processing'" @select="reindexDocument(document)">
                                                <RefreshCw aria-hidden="true" />
                                                Yeniden indeksle
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem variant="destructive" @select="removeDocument(document)">
                                                <Trash2 aria-hidden="true" />
                                                Kaldır
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>

        <DocumentViewerDialog v-model:open="viewerOpen" :target="viewerTarget" />

        <!-- Admin upload dialog -->
        <Dialog v-if="isAdmin" v-model:open="uploadOpen">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Kütüphaneye belge ekle</DialogTitle>
                    <DialogDescription>Metin çıkarılır, sayfalara göre bölünür ve anlamsal olarak indekslenir.</DialogDescription>
                </DialogHeader>

                <form class="flex flex-col gap-4" @submit.prevent="uploadDocument">
                    <div
                        class="flex flex-col gap-3 rounded-lg"
                        :class="isDragging && 'ring-3 ring-ring/50'"
                        @dragover.prevent="isDragging = true"
                        @dragleave.prevent="isDragging = false"
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
                            class="flex min-h-24 w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-background p-4 text-left text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
                    </div>

                    <div class="space-y-2">
                        <Label for="ai-doc-title">Başlık (opsiyonel)</Label>
                        <Input id="ai-doc-title" v-model="uploadTitle" type="text" class="h-11 md:h-9" placeholder="Örn. Yaş Çay Alım Kararnamesi 2026" />
                    </div>

                    <Alert v-if="uploadError" variant="destructive" role="alert">
                        <AlertDescription>{{ uploadError }}</AlertDescription>
                    </Alert>

                    <DialogFooter>
                        <Button type="button" variant="outline" class="h-11 md:h-9" :disabled="uploading" @click="uploadOpen = false">Vazgeç</Button>
                        <Button type="submit" class="h-11 md:h-9" :disabled="!selectedFile || uploading">
                            <Spinner v-if="uploading" />
                            {{ uploading ? 'Yükleniyor…' : 'Kütüphaneye ekle' }}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    </TeaBusinessLayout>
</template>
