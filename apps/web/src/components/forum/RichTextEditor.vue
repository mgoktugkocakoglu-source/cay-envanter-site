<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { watch } from 'vue';

const props = defineProps<{
    modelValue: string;
    placeholder?: string;
    minHeight?: string;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const editor = useEditor({
    content: props.modelValue,
    extensions: [
        StarterKit,
        Image.configure({ inline: false, allowBase64: true }),
        Youtube.configure({ width: 640, height: 360 }),
        Link.configure({ openOnClick: false, autolink: true }),
        Placeholder.configure({ placeholder: props.placeholder || 'İçeriğinizi yazın...' }),
    ],
    onUpdate: ({ editor }) => {
        emit('update:modelValue', editor.getHTML());
    },
});

watch(() => props.modelValue, (val) => {
    if (editor.value && editor.value.getHTML() !== val) {
        editor.value.commands.setContent(val, false);
    }
});

function addImage() {
    const url = window.prompt('Görsel URL girin:');
    if (url && editor.value) {
        editor.value.chain().focus().setImage({ src: url }).run();
    }
}

function addYoutube() {
    const url = window.prompt('YouTube video URL girin:');
    if (url && editor.value) {
        editor.value.chain().focus().setYoutubeVideo({ src: url }).run();
    }
}

function addLink() {
    const url = window.prompt('Link URL girin:');
    if (url && editor.value) {
        editor.value.chain().focus().setLink({ href: url }).run();
    }
}
</script>

<template>
    <div class="rich-editor">
        <div v-if="editor" class="toolbar">
            <div class="toolbar-group">
                <button
                    type="button"
                    :class="{ active: editor.isActive('bold') }"
                    title="Kalın"
                    @click="editor.chain().focus().toggleBold().run()"
                >
                    <strong>B</strong>
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('italic') }"
                    title="İtalik"
                    @click="editor.chain().focus().toggleItalic().run()"
                >
                    <em>I</em>
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('strike') }"
                    title="Üstü Çizili"
                    @click="editor.chain().focus().toggleStrike().run()"
                >
                    <s>S</s>
                </button>
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button
                    type="button"
                    :class="{ active: editor.isActive('heading', { level: 2 }) }"
                    title="Başlık"
                    @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
                >
                    H2
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('heading', { level: 3 }) }"
                    title="Alt Başlık"
                    @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
                >
                    H3
                </button>
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button
                    type="button"
                    :class="{ active: editor.isActive('bulletList') }"
                    title="Madde Listesi"
                    @click="editor.chain().focus().toggleBulletList().run()"
                >
                    &#8226;
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('orderedList') }"
                    title="Sıralı Liste"
                    @click="editor.chain().focus().toggleOrderedList().run()"
                >
                    1.
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('blockquote') }"
                    title="Alıntı"
                    @click="editor.chain().focus().toggleBlockquote().run()"
                >
                    &ldquo;
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('codeBlock') }"
                    title="Kod Bloğu"
                    @click="editor.chain().focus().toggleCodeBlock().run()"
                >
                    &lt;/&gt;
                </button>
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button type="button" title="Görsel Ekle" @click="addImage">
                    &#128247;
                </button>
                <button type="button" title="YouTube Video Ekle" @click="addYoutube">
                    &#9654;
                </button>
                <button
                    type="button"
                    :class="{ active: editor.isActive('link') }"
                    title="Link Ekle"
                    @click="addLink"
                >
                    &#128279;
                </button>
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button
                    type="button"
                    title="Geri Al"
                    :disabled="!editor.can().undo()"
                    @click="editor.chain().focus().undo().run()"
                >
                    &#8617;
                </button>
                <button
                    type="button"
                    title="İleri Al"
                    :disabled="!editor.can().redo()"
                    @click="editor.chain().focus().redo().run()"
                >
                    &#8618;
                </button>
            </div>
        </div>
        <EditorContent :editor="editor" class="editor-content" :style="{ minHeight: minHeight || '200px' }" />
    </div>
</template>

<style scoped>
.rich-editor {
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease;
}

.rich-editor:focus-within {
    border-color: #10b981;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-wrap: wrap;
}

.toolbar-group {
    display: flex;
    gap: 2px;
}

.toolbar-divider {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 4px;
}

.toolbar button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.toolbar button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
}

.toolbar button.active {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.3);
}

.toolbar button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.editor-content {
    padding: 16px;
    color: #e2e8f0;
    font-size: 15px;
    line-height: 1.7;
}

.editor-content :deep(.tiptap) {
    outline: none;
    min-height: inherit;
}

.editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: #4a5568;
    pointer-events: none;
    height: 0;
}

.editor-content :deep(.tiptap p) {
    margin: 0 0 8px 0;
}

.editor-content :deep(.tiptap h2) {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    margin: 16px 0 8px 0;
}

.editor-content :deep(.tiptap h3) {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin: 12px 0 6px 0;
}

.editor-content :deep(.tiptap strong) {
    color: #fff;
}

.editor-content :deep(.tiptap ul),
.editor-content :deep(.tiptap ol) {
    padding-left: 24px;
    margin: 8px 0;
}

.editor-content :deep(.tiptap li) {
    margin-bottom: 4px;
}

.editor-content :deep(.tiptap blockquote) {
    border-left: 3px solid #10b981;
    padding-left: 16px;
    margin: 12px 0;
    color: #94a3b8;
    font-style: italic;
}

.editor-content :deep(.tiptap pre) {
    background: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
    padding: 16px;
    margin: 12px 0;
    overflow-x: auto;
    font-family: 'Fira Code', monospace;
    font-size: 14px;
    color: #e2e8f0;
}

.editor-content :deep(.tiptap code) {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 14px;
}

.editor-content :deep(.tiptap pre code) {
    background: none;
    color: inherit;
    padding: 0;
}

.editor-content :deep(.tiptap img) {
    max-width: 100%;
    border-radius: 8px;
    margin: 12px 0;
}

.editor-content :deep(.tiptap a) {
    color: #10b981;
    text-decoration: underline;
}

.editor-content :deep(.tiptap a:hover) {
    color: #059669;
}

.editor-content :deep(div[data-youtube-video]) {
    margin: 12px 0;
}

.editor-content :deep(div[data-youtube-video] iframe) {
    border-radius: 8px;
    max-width: 100%;
}

.editor-content :deep(.tiptap hr) {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin: 16px 0;
}
</style>
