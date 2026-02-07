<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    content: string;
}>();

const sanitizedContent = computed(() => {
    // Basic sanitization - strip script tags and event handlers
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
    line-height: 1.7;
    word-break: break-word;
}

.rich-content :deep(p) {
    margin: 0 0 8px 0;
}

.rich-content :deep(p:last-child) {
    margin-bottom: 0;
}

.rich-content :deep(h2) {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    margin: 16px 0 8px 0;
}

.rich-content :deep(h3) {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin: 12px 0 6px 0;
}

.rich-content :deep(strong) {
    color: #fff;
}

.rich-content :deep(ul),
.rich-content :deep(ol) {
    padding-left: 24px;
    margin: 8px 0;
}

.rich-content :deep(li) {
    margin-bottom: 4px;
}

.rich-content :deep(blockquote) {
    border-left: 3px solid #10b981;
    padding-left: 16px;
    margin: 12px 0;
    color: #94a3b8;
    font-style: italic;
}

.rich-content :deep(pre) {
    background: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
    padding: 16px;
    margin: 12px 0;
    overflow-x: auto;
    font-family: 'Fira Code', monospace;
    font-size: 14px;
    color: #e2e8f0;
}

.rich-content :deep(code) {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 14px;
}

.rich-content :deep(pre code) {
    background: none;
    color: inherit;
    padding: 0;
}

.rich-content :deep(img) {
    max-width: 100%;
    border-radius: 8px;
    margin: 12px 0;
}

.rich-content :deep(a) {
    color: #10b981;
    text-decoration: underline;
}

.rich-content :deep(a:hover) {
    color: #059669;
}

.rich-content :deep(iframe) {
    border-radius: 8px;
    max-width: 100%;
    margin: 12px 0;
}

.rich-content :deep(hr) {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin: 16px 0;
}
</style>
