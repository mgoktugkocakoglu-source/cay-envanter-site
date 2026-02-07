<template>
    <AppModal
        v-model="visible"
        :title="title"
        size="sm"
        :persistent="true"
        :closable="true"
        @close="handleCancel"
    >
        <div class="confirm-body">
            <div v-if="icon" class="confirm-icon" :class="`confirm-icon--${variant}`">
                <!-- Danger -->
                <svg v-if="variant === 'danger'" width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2">
                    <path
                        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <!-- Warning -->
                <svg v-else-if="variant === 'warning'" width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <!-- Info -->
                <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                </svg>
            </div>
            <p class="confirm-message">{{ message }}</p>
        </div>

        <template #footer>
            <button type="button" class="confirm-btn confirm-btn--cancel" @click="handleCancel">
                {{ cancelText }}
            </button>
            <button type="button" class="confirm-btn" :class="`confirm-btn--${variant}`" @click="handleConfirm">
                {{ confirmText }}
            </button>
        </template>
    </AppModal>
</template>

<script setup lang="ts">
import AppModal from './AppModal.vue';

interface Props {
    modelValue: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    icon?: boolean;
}

withDefaults(defineProps<Props>(), {
    title: 'Onay',
    confirmText: 'Evet',
    cancelText: 'Iptal',
    variant: 'danger',
    icon: true,
});

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [];
    cancel: [];
}>();

const visible = defineModel<boolean>({ default: false });

function handleConfirm() {
    emit('confirm');
    visible.value = false;
}

function handleCancel() {
    emit('cancel');
    visible.value = false;
}
</script>

<style scoped>
.confirm-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
}

.confirm-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.confirm-icon--danger {
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
}

.confirm-icon--warning {
    background: rgba(251, 191, 36, 0.12);
    color: #fbbf24;
}

.confirm-icon--info {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
}

.confirm-message {
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--color-text-secondary, #94a3b8);
}

.confirm-btn {
    padding: 10px 22px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.confirm-btn--cancel {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-secondary, #94a3b8);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-btn--cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary, #e2e8f0);
}

.confirm-btn--danger {
    background: #ef4444;
    color: #fff;
}

.confirm-btn--danger:hover {
    background: #dc2626;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.confirm-btn--warning {
    background: #f59e0b;
    color: #fff;
}

.confirm-btn--warning:hover {
    background: #d97706;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.confirm-btn--info {
    background: #3b82f6;
    color: #fff;
}

.confirm-btn--info:hover {
    background: #2563eb;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}
</style>
