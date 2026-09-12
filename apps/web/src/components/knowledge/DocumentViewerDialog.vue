<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { Download, ExternalLink, FileText, Quote } from '@lucide/vue';
import { api, type KnowledgeDocument } from '@/services/api';
import { useToast } from '@/composables/useToast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingState } from '@/components/shared';
import { downloadKnowledgeDocument, documentKind } from '@/lib/knowledgeFiles';

/** What the viewer should show: a document, optionally opened at a cited page. */
export interface ViewerTarget {
    document: KnowledgeDocument;
    pageNumber?: number | null;
    /** Cited passage shown above the file so the reader knows what to look for. */
    snippet?: string;
}

const props = defineProps<{
    open: boolean;
    target: ViewerTarget | null;
}>();
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();

const toast = useToast();

const loading = ref(false);
const error = ref('');
const blobUrl = ref('');
const textContent = ref('');
const loadedDocumentId = ref('');
const downloading = ref(false);

type PreviewKind = 'pdf' | 'text' | 'unsupported';

const previewKind = computed<PreviewKind>(() => {
    const document = props.target?.document;
    if (!document) return 'unsupported';
    const name = document.fileName.toLowerCase();
    if (document.mimeType.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (document.mimeType.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) return 'text';
    return 'unsupported';
});

/** PDF viewers honour `#page=N` on the URL, so a citation opens on its page. */
const frameSrc = computed(() => {
    if (!blobUrl.value) return '';
    const page = props.target?.pageNumber;
    return page ? `${blobUrl.value}#page=${page}` : blobUrl.value;
});

function revoke(): void {
    if (blobUrl.value) {
        URL.revokeObjectURL(blobUrl.value);
        blobUrl.value = '';
    }
    textContent.value = '';
    loadedDocumentId.value = '';
}

async function load(): Promise<void> {
    const document = props.target?.document;
    if (!document) return;
    if (loadedDocumentId.value === document.id && blobUrl.value) return;

    revoke();
    error.value = '';

    if (!document.hasFile) {
        error.value = 'Bu belgenin orijinal dosyası saklanmamış. Yöneticinin belgeyi yeniden yüklemesi gerekir.';
        return;
    }

    loading.value = true;
    const { data, error: apiError } = await api.getKnowledgeDocumentFile(document.id);
    loading.value = false;

    if (!data) {
        error.value = apiError?.message ?? 'Dosya açılamadı.';
        return;
    }

    loadedDocumentId.value = document.id;
    if (previewKind.value === 'text') {
        textContent.value = await data.text();
        return;
    }
    blobUrl.value = URL.createObjectURL(data);
}

function openInNewTab(): void {
    if (!blobUrl.value) return;
    window.open(frameSrc.value, '_blank', 'noopener');
}

async function download(): Promise<void> {
    const document = props.target?.document;
    if (!document || downloading.value) return;
    downloading.value = true;
    const message = await downloadKnowledgeDocument(document);
    downloading.value = false;
    if (message) toast.error(message);
}

watch(
    () => [props.open, props.target?.document.id],
    ([open]) => {
        if (open) void load();
    },
    { immediate: true },
);

watch(
    () => props.open,
    (open) => {
        if (!open) revoke();
    },
);

onBeforeUnmount(revoke);
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="flex h-[92dvh] max-w-[calc(100%-1rem)] flex-col gap-3 p-4 sm:max-w-5xl md:p-6">
            <DialogHeader v-if="target" class="pr-8 text-left">
                <DialogTitle class="flex flex-wrap items-center gap-2 text-base">
                    <Badge variant="outline" class="rounded-sm font-bold">{{ documentKind(target.document) }}</Badge>
                    <span class="min-w-0 truncate">{{ target.document.title }}</span>
                    <Badge v-if="target.pageNumber" variant="secondary" class="tabular-nums">Sayfa {{ target.pageNumber }}</Badge>
                </DialogTitle>
                <DialogDescription class="truncate">{{ target.document.fileName }}</DialogDescription>
            </DialogHeader>

            <div class="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" class="h-11 md:h-9" :disabled="!target?.document.hasFile || downloading" @click="download">
                    <Download aria-hidden="true" />
                    İndir
                </Button>
                <Button
                    v-if="previewKind === 'pdf'"
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="h-11 md:h-9"
                    :disabled="!blobUrl"
                    @click="openInNewTab"
                >
                    <ExternalLink aria-hidden="true" />
                    Yeni sekmede aç
                </Button>
            </div>

            <blockquote v-if="target?.snippet" class="flex items-start gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <Quote class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span class="line-clamp-3">{{ target.snippet }}</span>
            </blockquote>

            <div class="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/40">
                <LoadingState v-if="loading" text="Belge yükleniyor…" class="h-full" />

                <Alert v-else-if="error" variant="destructive" class="m-4 w-auto">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>

                <iframe
                    v-else-if="previewKind === 'pdf' && frameSrc"
                    :src="frameSrc"
                    :title="target?.document.title ?? 'Belge'"
                    class="h-full w-full bg-background"
                ></iframe>

                <pre
                    v-else-if="previewKind === 'text' && loadedDocumentId"
                    class="h-full overflow-auto p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground"
                >{{ textContent }}</pre>

                <div v-else-if="previewKind === 'unsupported' && target?.document.hasFile" class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <span class="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                        <FileText class="size-6" />
                    </span>
                    <p class="max-w-sm text-sm text-muted-foreground">
                        Word belgeleri tarayıcıda önizlenemez. Dosyayı indirip cihazınızda açabilirsiniz.
                    </p>
                    <Button type="button" class="h-11 md:h-9" :disabled="downloading" @click="download">
                        <Download aria-hidden="true" />
                        Belgeyi indir
                    </Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>
