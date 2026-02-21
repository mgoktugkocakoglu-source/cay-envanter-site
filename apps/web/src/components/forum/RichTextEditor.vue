<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { watch, ref } from 'vue';
import { api } from '@/services/api';

const props = defineProps<{
    modelValue: string;
    placeholder?: string;
    minHeight?: string;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const showYoutubeModal = ref(false);
const showLinkModal = ref(false);
const showImageModal = ref(false);
const youtubeUrl = ref('');
const linkUrl = ref('');
const linkText = ref('');
const imageUrl = ref('');
const imageTab = ref<'upload' | 'url'>('upload');
const isUploading = ref(false);
const uploadError = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

const editor = useEditor({
    content: props.modelValue,
    extensions: [
        StarterKit,
        Image.configure({ inline: false, allowBase64: true }),
        Youtube.configure({ width: 640, height: 360 }),
        Link.configure({ openOnClick: false, autolink: true }),
        Placeholder.configure({ placeholder: props.placeholder || 'Iceriginizi yazin...' }),
    ],
    onUpdate: ({ editor }) => {
        emit('update:modelValue', editor.getHTML());
    },
});

watch(() => props.modelValue, (val) => {
    if (editor.value && editor.value.getHTML() !== val) {
        editor.value.commands.setContent(val, { emitUpdate: false });
    }
});

function openImageModal() {
    imageUrl.value = '';
    imageTab.value = 'upload';
    uploadError.value = '';
    showImageModal.value = true;
}

async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !editor.value) return;

    if (file.size > 5 * 1024 * 1024) {
        uploadError.value = 'Dosya boyutu 5MB\'dan kucuk olmalidir';
        return;
    }

    isUploading.value = true;
    uploadError.value = '';

    const result = await api.uploadImage(file);
    if (result.data) {
        editor.value.chain().focus().setImage({ src: result.data.url }).run();
        showImageModal.value = false;
    } else {
        uploadError.value = result.error?.message || 'Yuklenirken hata olustu';
    }
    isUploading.value = false;
    input.value = '';
}

function insertImageFromUrl() {
    if (!imageUrl.value.trim() || !editor.value) return;
    editor.value.chain().focus().setImage({ src: imageUrl.value.trim() }).run();
    showImageModal.value = false;
    imageUrl.value = '';
}

function openYoutubeModal() {
    youtubeUrl.value = '';
    showYoutubeModal.value = true;
}

function insertYoutube() {
    if (!youtubeUrl.value.trim() || !editor.value) return;
    editor.value.chain().focus().setYoutubeVideo({ src: youtubeUrl.value.trim() }).run();
    showYoutubeModal.value = false;
    youtubeUrl.value = '';
}

function openLinkModal() {
    linkUrl.value = '';
    linkText.value = '';
    showLinkModal.value = true;
}

function insertLink() {
    if (!linkUrl.value.trim() || !editor.value) return;
    let href = linkUrl.value.trim();
    if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
    editor.value.chain().focus().setLink({ href }).run();
    showLinkModal.value = false;
    linkUrl.value = '';
}

function removeLink() {
    if (!editor.value) return;
    editor.value.chain().focus().unsetLink().run();
    showLinkModal.value = false;
}

function triggerFileInput() {
    fileInputRef.value?.click();
}

function handleDrop(e: DragEvent) {
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/') || !editor.value) return;
    e.preventDefault();

    if (file.size > 5 * 1024 * 1024) return;

    isUploading.value = true;
    api.uploadImage(file).then((result) => {
        if (result.data && editor.value) {
            editor.value.chain().focus().setImage({ src: result.data.url }).run();
        }
        isUploading.value = false;
    });
}

function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items || !editor.value) return;

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (!file || file.size > 5 * 1024 * 1024) return;

            isUploading.value = true;
            api.uploadImage(file).then((result) => {
                if (result.data && editor.value) {
                    editor.value.chain().focus().setImage({ src: result.data.url }).run();
                }
                isUploading.value = false;
            });
            break;
        }
    }
}
</script>

<template>
    <div class="rich-editor" @drop.prevent="handleDrop" @paste="handlePaste" @dragover.prevent>
        <div v-if="editor" class="toolbar">
            <!-- Text Formatting -->
            <div class="toolbar-group">
                <button
                    type="button"
                    :class="{ active: editor.isActive('bold') }"
                    title="Kalin"
                    @click="editor.chain().focus().toggleBold().run()"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('italic') }"
                    title="Italik"
                    @click="editor.chain().focus().toggleItalic().run()"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('strike') }"
                    title="Ustu Cizili"
                    @click="editor.chain().focus().toggleStrike().run()"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.2 2.8 3.4 3.4"/><path d="M4 12h16"/><path d="M6.7 19.1c2.3.6 4.4 1 6.2.9 2.7 0 5.3-.7 5.3-3.6 0-1.5-1.2-2.8-3.4-3.4"/></svg>
                </button>
            </div>

            <div class="toolbar-sep"></div>

            <!-- Headings -->
            <div class="toolbar-group">
                <button
                    type="button"
                    :class="{ active: editor.isActive('heading', { level: 2 }) }"
                    title="Baslik"
                    @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
                >
                    <span class="btn-text">H2</span>
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('heading', { level: 3 }) }"
                    title="Alt Baslik"
                    @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
                >
                    <span class="btn-text">H3</span>
                </button>
            </div>

            <div class="toolbar-sep"></div>

            <!-- Lists & Blocks -->
            <div class="toolbar-group">
                <button
                    type="button"
                    :class="{ active: editor.isActive('bulletList') }"
                    title="Madde Listesi"
                    @click="editor.chain().focus().toggleBulletList().run()"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('orderedList') }"
                    title="Sirali Liste"
                    @click="editor.chain().focus().toggleOrderedList().run()"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" font-size="8" fill="currentColor" stroke="none" font-weight="bold">1</text><text x="2" y="14" font-size="8" fill="currentColor" stroke="none" font-weight="bold">2</text><text x="2" y="20" font-size="8" fill="currentColor" stroke="none" font-weight="bold">3</text></svg>
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('blockquote') }"
                    title="Alinti"
                    @click="editor.chain().focus().toggleBlockquote().run()"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('codeBlock') }"
                    title="Kod Blogu"
                    @click="editor.chain().focus().toggleCodeBlock().run()"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                </button>
            </div>

            <div class="toolbar-sep"></div>

            <!-- Media -->
            <div class="toolbar-group">
                <button type="button" title="Gorsel Ekle" class="media-btn" @click="openImageModal">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </button>
                <button type="button" title="YouTube Video Ekle" class="media-btn" @click="openYoutubeModal">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.43z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('link') }"
                    title="Link Ekle"
                    class="media-btn"
                    @click="openLinkModal"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                </button>
            </div>

            <div class="toolbar-sep"></div>

            <!-- Undo/Redo -->
            <div class="toolbar-group">
                <button
                    type="button"
                    title="Geri Al"
                    :disabled="!editor.can().undo()"
                    @click="editor.chain().focus().undo().run()"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                </button>
                <button
                    type="button"
                    title="Ileri Al"
                    :disabled="!editor.can().redo()"
                    @click="editor.chain().focus().redo().run()"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                </button>
            </div>
        </div>

        <!-- Upload indicator -->
        <div v-if="isUploading" class="upload-indicator">
            <div class="upload-spinner"></div>
            <span>Gorsel yukleniyor...</span>
        </div>

        <EditorContent :editor="editor" class="editor-content" :style="{ minHeight: minHeight || '200px' }" />

        <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style="display: none"
            @change="handleFileUpload"
        />

        <!-- Image Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="showImageModal" class="modal-overlay" @click.self="showImageModal = false">
                    <div class="modal-box">
                        <div class="modal-header">
                            <h3>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                Gorsel Ekle
                            </h3>
                            <button class="modal-close" @click="showImageModal = false">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div class="modal-tabs">
                            <button :class="{ active: imageTab === 'upload' }" @click="imageTab = 'upload'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Dosya Yukle
                            </button>
                            <button :class="{ active: imageTab === 'url' }" @click="imageTab = 'url'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                                URL ile Ekle
                            </button>
                        </div>

                        <div class="modal-body">
                            <div v-if="imageTab === 'upload'" class="upload-area" @click="triggerFileInput">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                <p class="upload-text">Tiklayarak gorsel secin</p>
                                <p class="upload-hint">JPEG, PNG, GIF veya WebP - Maks. 5MB</p>
                                <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
                            </div>
                            <div v-else class="url-input-area">
                                <label>Gorsel URL</label>
                                <input
                                    v-model="imageUrl"
                                    type="url"
                                    placeholder="https://ornek.com/gorsel.jpg"
                                    @keyup.enter="insertImageFromUrl"
                                />
                            </div>
                        </div>

                        <div v-if="imageTab === 'url'" class="modal-footer">
                            <button class="modal-btn-secondary" @click="showImageModal = false">Iptal</button>
                            <button class="modal-btn-primary" :disabled="!imageUrl.trim()" @click="insertImageFromUrl">Ekle</button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- YouTube Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="showYoutubeModal" class="modal-overlay" @click.self="showYoutubeModal = false">
                    <div class="modal-box">
                        <div class="modal-header">
                            <h3>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.43z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
                                YouTube Video Ekle
                            </h3>
                            <button class="modal-close" @click="showYoutubeModal = false">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div class="modal-body">
                            <label>YouTube Video URL</label>
                            <input
                                v-model="youtubeUrl"
                                type="url"
                                placeholder="https://www.youtube.com/watch?v=..."
                                @keyup.enter="insertYoutube"
                            />
                            <p class="input-hint">YouTube video linkini yapistirin</p>
                        </div>
                        <div class="modal-footer">
                            <button class="modal-btn-secondary" @click="showYoutubeModal = false">Iptal</button>
                            <button class="modal-btn-primary" :disabled="!youtubeUrl.trim()" @click="insertYoutube">Ekle</button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- Link Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="showLinkModal" class="modal-overlay" @click.self="showLinkModal = false">
                    <div class="modal-box">
                        <div class="modal-header">
                            <h3>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                                Link Ekle
                            </h3>
                            <button class="modal-close" @click="showLinkModal = false">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div class="modal-body">
                            <label>URL</label>
                            <input
                                v-model="linkUrl"
                                type="url"
                                placeholder="https://ornek.com"
                                @keyup.enter="insertLink"
                            />
                        </div>
                        <div class="modal-footer">
                            <button v-if="editor?.isActive('link')" class="modal-btn-danger" @click="removeLink">Linki Kaldir</button>
                            <button class="modal-btn-secondary" @click="showLinkModal = false">Iptal</button>
                            <button class="modal-btn-primary" :disabled="!linkUrl.trim()" @click="insertLink">Ekle</button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.rich-editor {
    border: 1px solid var(--color-border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--color-bg-tertiary);
    transition: border-color 0.2s;
}

.rich-editor:focus-within {
    border-color: rgba(16, 185, 129, 0.5);
}

/* Toolbar */
.toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 10px;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
}

.toolbar-group {
    display: flex;
    gap: 1px;
}

.toolbar-sep {
    width: 1px;
    height: 20px;
    background: var(--color-border);
    margin: 0 6px;
}

.toolbar button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
}

.toolbar button:hover:not(:disabled) {
    background: var(--color-border);
    color: var(--color-text-primary);
}

.toolbar button.active {
    background: var(--color-primary-light);
    color: var(--color-primary);
}

.toolbar button:disabled {
    opacity: 0.25;
    cursor: not-allowed;
}

.toolbar button.media-btn {
    color: var(--color-text-secondary);
}

.toolbar button.media-btn:hover:not(:disabled) {
    color: var(--color-primary);
    background: var(--color-primary-light);
}

.btn-text {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: -0.5px;
}

/* Upload Indicator */
.upload-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-primary-light);
    border-bottom: 1px solid var(--color-primary-light);
    color: var(--color-primary);
    font-size: 13px;
}

.upload-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(16, 185, 129, 0.2);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Editor Content */
.editor-content {
    padding: 16px;
    color: var(--color-text-primary);
    font-size: 15px;
    line-height: 1.7;
}

.editor-content :deep(.tiptap) { outline: none; min-height: inherit; }
.editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder); float: left; color: var(--color-text-muted); pointer-events: none; height: 0;
}
.editor-content :deep(.tiptap p) { margin: 0 0 8px 0; }
.editor-content :deep(.tiptap h2) { font-size: 22px; font-weight: 700; color: var(--color-text-primary); margin: 16px 0 8px 0; }
.editor-content :deep(.tiptap h3) { font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin: 12px 0 6px 0; }
.editor-content :deep(.tiptap strong) { color: var(--color-text-primary); }
.editor-content :deep(.tiptap ul), .editor-content :deep(.tiptap ol) { padding-left: 24px; margin: 8px 0; }
.editor-content :deep(.tiptap li) { margin-bottom: 4px; }
.editor-content :deep(.tiptap blockquote) { border-left: 3px solid var(--color-primary); padding-left: 16px; margin: 12px 0; color: var(--color-text-secondary); font-style: italic; }
.editor-content :deep(.tiptap pre) { background: var(--color-bg-primary); border-radius: 8px; padding: 16px; margin: 12px 0; overflow-x: auto; font-family: 'Fira Code', monospace; font-size: 14px; color: var(--color-text-primary); }
.editor-content :deep(.tiptap code) { background: var(--color-primary-light); color: var(--color-primary); padding: 2px 6px; border-radius: 4px; font-size: 14px; }
.editor-content :deep(.tiptap pre code) { background: none; color: inherit; padding: 0; }
.editor-content :deep(.tiptap img) { max-width: 100%; border-radius: 8px; margin: 12px 0; cursor: pointer; }
.editor-content :deep(.tiptap a) { color: var(--color-primary); text-decoration: underline; }
.editor-content :deep(.tiptap a:hover) { color: var(--color-primary-hover); }
.editor-content :deep(div[data-youtube-video]) { margin: 12px 0; }
.editor-content :deep(div[data-youtube-video] iframe) { border-radius: 8px; max-width: 100%; }
.editor-content :deep(.tiptap hr) { border: none; border-top: 1px solid var(--color-border); margin: 16px 0; }

/* Modal Transition */
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-enter-active .modal-box { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-leave-active .modal-box { transition: transform 0.15s ease, opacity 0.15s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-box { transform: scale(0.95) translateY(10px); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-box { transform: scale(0.95) translateY(10px); opacity: 0; }

/* Modal */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
}

.modal-box {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    width: 100%;
    max-width: 480px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 22px;
    border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.modal-header h3 svg { color: var(--color-primary); }

.modal-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    transition: all 0.15s;
}

.modal-close:hover {
    background: var(--color-border);
    color: var(--color-text-primary);
}

.modal-tabs {
    display: flex;
    padding: 0 22px;
    gap: 0;
    border-bottom: 1px solid var(--color-border);
}

.modal-tabs button {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.modal-tabs button:hover {
    color: var(--color-text-primary);
}

.modal-tabs button.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
}

.modal-body {
    padding: 22px;
}

.modal-body label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
}

.modal-body input {
    width: 100%;
    padding: 10px 14px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-size: 14px;
    transition: border-color 0.2s;
}

.modal-body input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.modal-body input::placeholder {
    color: var(--color-text-muted);
}

.input-hint {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--color-text-muted);
}

/* Upload Area */
.upload-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 20px;
    border: 2px dashed var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
    color: var(--color-text-muted);
}

.upload-area:hover {
    border-color: rgba(16, 185, 129, 0.3);
    background: var(--color-primary-light);
    color: var(--color-primary);
}

.upload-text {
    margin: 12px 0 4px;
    font-size: 14px;
    color: var(--color-text-primary);
    font-weight: 500;
}

.upload-hint {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-muted);
}

.upload-error {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--color-danger);
}

.url-input-area {
    display: flex;
    flex-direction: column;
}

/* Modal Footer */
.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 22px;
    border-top: 1px solid var(--color-border);
}

.modal-btn-primary {
    padding: 8px 18px;
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.modal-btn-primary:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.modal-btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.modal-btn-secondary {
    padding: 8px 18px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.modal-btn-secondary:hover {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
}

.modal-btn-danger {
    padding: 8px 18px;
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    margin-right: auto;
    transition: all 0.2s;
}

.modal-btn-danger:hover {
    background: rgba(239, 68, 68, 0.15);
}

/* Responsive */
@media (max-width: 640px) {
    .toolbar {
        gap: 1px;
        padding: 6px 6px;
    }

    .toolbar button {
        width: 28px;
        height: 28px;
    }

    .toolbar-sep {
        height: 16px;
        margin: 0 3px;
    }
}
</style>
