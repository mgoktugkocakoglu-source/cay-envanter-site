<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    content: string;
}>();

const sanitizedContent = computed(() => {
    let html = props.content || '';
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/\son\w+="[^"]*"/g, '');
    html = html.replace(/\son\w+='[^']*'/g, '');
    return html;
});
</script>

<template>
    <div class="rich-content" v-html="sanitizedContent"></div>
</template>

<style scoped>
.rich-content {
    color: #e2e8f0;
    font-size: 15px;
    line-height: 1.75;
    word-break: break-word;
}

.rich-content :deep(p) { margin: 0 0 12px 0; }
.rich-content :deep(p:last-child) { margin-bottom: 0; }

.rich-content :deep(h2) {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    margin: 20px 0 10px 0;
}

.rich-content :deep(h3) {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin: 16px 0 8px 0;
}

.rich-content :deep(strong) { color: #fff; }

.rich-content :deep(em) {
    color: #cbd5e1;
}

.rich-content :deep(ul),
.rich-content :deep(ol) {
    padding-left: 24px;
    margin: 10px 0;
}

.rich-content :deep(li) { margin-bottom: 6px; }

.rich-content :deep(li::marker) {
    color: #10b981;
}

.rich-content :deep(blockquote) {
    border-left: 3px solid #10b981;
    padding: 12px 16px;
    margin: 16px 0;
    color: #94a3b8;
    font-style: italic;
    background: rgba(16, 185, 129, 0.04);
    border-radius: 0 8px 8px 0;
}

.rich-content :deep(blockquote p:last-child) {
    margin-bottom: 0;
}

.rich-content :deep(pre) {
    background: rgba(0, 0, 0, 0.4);
    border-radius: 10px;
    padding: 16px;
    margin: 16px 0;
    overflow-x: auto;
    font-family: 'Fira Code', monospace;
    font-size: 13px;
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.06);
    -webkit-overflow-scrolling: touch;
}

.rich-content :deep(code) {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'Fira Code', monospace;
}

.rich-content :deep(pre code) {
    background: none;
    color: inherit;
    padding: 0;
}

/* Images */
.rich-content :deep(img) {
    max-width: 100%;
    border-radius: 10px;
    margin: 16px 0;
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.2s;
    cursor: zoom-in;
}

.rich-content :deep(img:hover) {
    border-color: rgba(16, 185, 129, 0.2);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* Links */
.rich-content :deep(a) {
    color: #10b981;
    text-decoration: none;
    border-bottom: 1px solid rgba(16, 185, 129, 0.3);
    transition: all 0.2s;
}

.rich-content :deep(a:hover) {
    color: #34d399;
    border-bottom-color: #34d399;
}

/* YouTube Embeds */
.rich-content :deep(iframe) {
    border-radius: 10px;
    max-width: 100%;
    margin: 16px 0;
    border: 1px solid rgba(255, 255, 255, 0.06);
}

.rich-content :deep(div[data-youtube-video]) {
    margin: 16px 0;
    position: relative;
    padding-bottom: 56.25%;
    height: 0;
    overflow: hidden;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
}

.rich-content :deep(div[data-youtube-video] iframe) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 10px;
    margin: 0;
}

.rich-content :deep(hr) {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin: 20px 0;
}

/* Tables (if any) */
.rich-content :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
}

.rich-content :deep(th),
.rich-content :deep(td) {
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    text-align: left;
}

.rich-content :deep(th) {
    background: rgba(255, 255, 255, 0.04);
    font-weight: 600;
    color: #f1f5f9;
}

/* Selection highlight */
.rich-content :deep(::selection) {
    background: rgba(16, 185, 129, 0.25);
}
</style>
