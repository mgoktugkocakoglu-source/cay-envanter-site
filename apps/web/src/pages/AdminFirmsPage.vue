<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Building2, CheckCircle2, MoreHorizontal, Pencil, Plus, Trash2, Upload, X } from '@lucide/vue';
import { useToast } from '@/composables/useToast';
import { useFirmsStore } from '@/stores/firmsStore';
import { api, type Firm } from '@/services/api';
import AdminLayout from '@/layouts/AdminLayout.vue';
import { ConfirmDialog, EmptyState, ListToolbar, LoadingState, PageContainer, PageHeader, SearchInput, Spinner, StatCard } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const firmsStore = useFirmsStore();
const toast = useToast();

const searchQuery = ref('');
const showCreateForm = ref(false);
const isSubmitting = ref(false);
const isUploadingLogo = ref(false);
const isDeleting = ref(false);
const formError = ref<string | null>(null);
const editTarget = ref<Firm | null>(null);
const deleteTarget = ref<Firm | null>(null);
const showDeleteConfirm = ref(false);
const logoInputRef = ref<HTMLInputElement | null>(null);

const firmForm = ref({
    name: '',
    description: '',
    logoUrl: '',
    phone: '',
    email: '',
    address: '',
    isActive: true,
});

const filteredFirms = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return firmsStore.firms;

    return firmsStore.firms.filter((firm) =>
        firm.name.toLowerCase().includes(query) ||
        firm.description?.toLowerCase().includes(query) ||
        firm.phone?.toLowerCase().includes(query) ||
        firm.email?.toLowerCase().includes(query),
    );
});

const activeFirmCount = computed(() => firmsStore.firms.filter((firm) => firm.isActive).length);
const passiveFirmCount = computed(() => firmsStore.firmCount - activeFirmCount.value);

function resetForm() {
    firmForm.value = {
        name: '',
        description: '',
        logoUrl: '',
        phone: '',
        email: '',
        address: '',
        isActive: true,
    };
    formError.value = null;
}

function openCreateForm() {
    resetForm();
    showCreateForm.value = true;
}

function openEditForm(firm: Firm) {
    editTarget.value = firm;
    firmForm.value = {
        name: firm.name,
        description: firm.description || '',
        logoUrl: firm.logoUrl || '',
        phone: firm.phone || '',
        email: firm.email || '',
        address: firm.address || '',
        isActive: firm.isActive,
    };
    formError.value = null;
    showCreateForm.value = true;
}

function closeCreateForm() {
    showCreateForm.value = false;
    editTarget.value = null;
    resetForm();
}

/** Dialog `open` is two-way bound; a close from overlay/escape must also reset the form. */
function onFormOpenChange(open: boolean) {
    if (!open) closeCreateForm();
}

async function saveFirm() {
    const name = firmForm.value.name.trim();
    if (!name) {
        formError.value = 'Firma adı zorunludur';
        return;
    }

    isSubmitting.value = true;
    formError.value = null;

    const payload: Partial<Firm> = {
        name,
        description: firmForm.value.description.trim() || null,
        logoUrl: firmForm.value.logoUrl.trim() || null,
        phone: firmForm.value.phone.trim() || null,
        email: firmForm.value.email.trim() || null,
        address: firmForm.value.address.trim() || null,
        isActive: firmForm.value.isActive,
    };

    const wasEditing = !!editTarget.value;
    const success = editTarget.value
        ? await firmsStore.updateFirm(editTarget.value.id, payload)
        : await firmsStore.createFirm(payload);
    isSubmitting.value = false;

    if (success) {
        closeCreateForm();
        toast.success(wasEditing ? 'Firma güncellendi' : 'Firma eklendi');
        return;
    }

    formError.value = firmsStore.error || 'Firma kaydedilemedi';
}

function triggerLogoUpload() {
    logoInputRef.value?.click();
}

async function uploadLogo(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        formError.value = 'Logo için bir görsel dosyası seçin';
        input.value = '';
        return;
    }

    isUploadingLogo.value = true;
    formError.value = null;

    const response = await api.uploadImage(file);
    isUploadingLogo.value = false;
    input.value = '';

    if (response.data?.url) {
        firmForm.value.logoUrl = response.data.url;
        return;
    }

    formError.value = response.error?.message || 'Logo yüklenemedi';
}

function clearLogo() {
    firmForm.value.logoUrl = '';
}

function confirmDeleteFirm(firm: Firm) {
    deleteTarget.value = firm;
    showDeleteConfirm.value = true;
}

async function deleteFirm() {
    if (!deleteTarget.value) return;

    const firmName = deleteTarget.value.name;
    isDeleting.value = true;
    const success = await firmsStore.deleteFirm(deleteTarget.value.id);
    isDeleting.value = false;
    deleteTarget.value = null;
    showDeleteConfirm.value = false;

    if (success) {
        toast.success(`${firmName} kaldırıldı`);
    } else {
        toast.error(firmsStore.error || 'Firma kaldırılamadı');
    }
}

function getInitial(firm: Firm) {
    return firm.name.charAt(0).toUpperCase();
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

onMounted(() => {
    firmsStore.fetchFirms();
});
</script>

<template>
    <AdminLayout>
        <PageContainer size="wide">
            <PageHeader title="Firma Yönetimi" description="Çay alım yapan firmaları ekleyin, düzenleyin ve durumlarını yönetin." back-to="/admin" back-label="Admin Panel">
                <template #meta>
                    <Badge variant="secondary">{{ firmsStore.firmCount }} firma</Badge>
                    <Badge variant="secondary">{{ activeFirmCount }} aktif</Badge>
                </template>
                <template #actions>
                    <Button class="h-11 md:h-9" @click="openCreateForm">
                        <Plus aria-hidden="true" />
                        Firma Ekle
                    </Button>
                </template>
            </PageHeader>

            <div class="grid gap-4 sm:grid-cols-3">
                <StatCard label="Toplam Firma" :value="firmsStore.firmCount" :icon="Building2" />
                <StatCard label="Aktif Firma" :value="activeFirmCount" :icon="CheckCircle2" />
                <StatCard label="Pasif Firma" :value="passiveFirmCount" :icon="X" />
            </div>

            <ListToolbar>
                <SearchInput v-model="searchQuery" placeholder="Firma ara..." aria-label="Firma ara" />
            </ListToolbar>

            <Alert v-if="firmsStore.error && !showCreateForm" variant="destructive">
                <AlertDescription>{{ firmsStore.error }}</AlertDescription>
            </Alert>

            <LoadingState v-if="firmsStore.isLoading && !showCreateForm" text="Firmalar yükleniyor..." />

            <EmptyState
                v-else-if="filteredFirms.length === 0"
                :icon="Building2"
                :title="searchQuery ? 'Aramaya uyan firma yok' : 'Firma bulunamadı'"
                :description="searchQuery ? 'Arama terimini değiştirerek tekrar deneyin.' : 'İlk firmayı ekleyerek başlayın.'"
            >
                <Button v-if="searchQuery" variant="outline" class="h-11 md:h-9" @click="searchQuery = ''">Aramayı temizle</Button>
                <Button v-else class="h-11 md:h-9" @click="openCreateForm">
                    <Plus aria-hidden="true" />
                    Firma Ekle
                </Button>
            </EmptyState>

            <div v-else class="overflow-hidden rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow class="hover:bg-transparent">
                            <TableHead class="pl-4">Firma</TableHead>
                            <TableHead class="hidden md:table-cell">İletişim</TableHead>
                            <TableHead class="hidden md:table-cell">Durum</TableHead>
                            <TableHead class="hidden lg:table-cell">Kayıt</TableHead>
                            <TableHead class="pr-4 text-right"><span class="sr-only">İşlemler</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="firm in filteredFirms" :key="firm.id">
                            <TableCell class="pl-4">
                                <div class="flex items-center gap-3">
                                    <Avatar class="size-10 rounded-md border bg-muted">
                                        <AvatarImage v-if="firm.logoUrl" :src="firm.logoUrl" :alt="`${firm.name} logosu`" class="object-contain" />
                                        <AvatarFallback class="rounded-md bg-primary/10 text-sm font-bold text-primary">{{ getInitial(firm) }}</AvatarFallback>
                                    </Avatar>
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-medium text-foreground">{{ firm.name }}</p>
                                        <p class="truncate text-xs text-muted-foreground">{{ firm.description || 'Açıklama yok' }}</p>
                                        <Badge :variant="firm.isActive ? 'success' : 'muted'" class="mt-1 md:hidden">
                                            {{ firm.isActive ? 'Aktif' : 'Pasif' }}
                                        </Badge>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell class="hidden md:table-cell">
                                <span class="block text-foreground">{{ firm.phone || '—' }}</span>
                                <span class="block text-xs text-muted-foreground">{{ firm.email || '—' }}</span>
                            </TableCell>
                            <TableCell class="hidden md:table-cell">
                                <Badge :variant="firm.isActive ? 'success' : 'muted'">{{ firm.isActive ? 'Aktif' : 'Pasif' }}</Badge>
                            </TableCell>
                            <TableCell class="hidden text-muted-foreground lg:table-cell">{{ formatDate(firm.createdAt) }}</TableCell>
                            <TableCell class="pr-4 text-right">
                                <div class="flex justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="hidden size-9 md:inline-flex"
                                        :aria-label="`${firm.name} firmasını düzenle`"
                                        @click="openEditForm(firm)"
                                    >
                                        <Pencil aria-hidden="true" />
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger as-child>
                                            <Button variant="ghost" size="icon" class="size-11 md:size-9" :aria-label="`${firm.name} için işlemler`">
                                                <MoreHorizontal aria-hidden="true" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" class="w-44">
                                            <DropdownMenuItem class="min-h-11 md:min-h-9" @select="openEditForm(firm)">
                                                <Pencil aria-hidden="true" />
                                                Düzenle
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem class="min-h-11 md:min-h-9" variant="destructive" @select="confirmDeleteFirm(firm)">
                                                <Trash2 aria-hidden="true" />
                                                Kaldır
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </PageContainer>

        <!-- Create / edit dialog -->
        <Dialog :open="showCreateForm" @update:open="onFormOpenChange">
            <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <form class="flex flex-col gap-4" @submit.prevent="saveFirm">
                    <DialogHeader>
                        <DialogTitle>{{ editTarget ? 'Firmayı Düzenle' : 'Yeni Firma' }}</DialogTitle>
                        <DialogDescription>
                            {{ editTarget ? 'Firma bilgilerini güncelleyin.' : 'Çay alımı yapan yeni bir firma ekleyin.' }}
                        </DialogDescription>
                    </DialogHeader>

                    <Alert v-if="formError" variant="destructive">
                        <AlertDescription>{{ formError }}</AlertDescription>
                    </Alert>

                    <div class="space-y-2">
                        <Label for="firm-name">Firma adı *</Label>
                        <Input id="firm-name" v-model="firmForm.name" maxlength="150" type="text" required class="h-11 md:h-9" />
                    </div>

                    <div class="space-y-2">
                        <Label for="firm-description">Açıklama</Label>
                        <Textarea id="firm-description" v-model="firmForm.description" maxlength="2000" rows="3" />
                    </div>

                    <div class="space-y-2">
                        <Label for="firm-logo-url">Logo yolu</Label>
                        <Input id="firm-logo-url" v-model="firmForm.logoUrl" maxlength="255" type="text" placeholder="https://cdn.example.com/..." class="h-11 md:h-9" />
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <input
                            ref="logoInputRef"
                            type="file"
                            accept="image/*"
                            class="sr-only"
                            :disabled="isUploadingLogo"
                            aria-label="Logo dosyası seç"
                            @change="uploadLogo"
                        />
                        <Button type="button" variant="outline" class="h-11 md:h-9" :disabled="isUploadingLogo" @click="triggerLogoUpload">
                            <Spinner v-if="isUploadingLogo" />
                            <Upload v-else aria-hidden="true" />
                            {{ isUploadingLogo ? 'Yükleniyor...' : 'Logo Yükle' }}
                        </Button>
                        <Button v-if="firmForm.logoUrl" type="button" variant="ghost" class="h-11 md:h-9" @click="clearLogo">
                            <X aria-hidden="true" />
                            Logoyu Kaldır
                        </Button>
                    </div>

                    <div v-if="firmForm.logoUrl" class="flex items-center gap-3 rounded-lg border p-3">
                        <img :src="firmForm.logoUrl" alt="Logo önizleme" class="size-13 rounded-md border bg-muted object-contain" />
                        <span class="text-sm text-muted-foreground">Logo önizleme</span>
                    </div>

                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="space-y-2">
                            <Label for="firm-phone">Telefon</Label>
                            <Input id="firm-phone" v-model="firmForm.phone" maxlength="20" type="tel" class="h-11 md:h-9" />
                        </div>
                        <div class="space-y-2">
                            <Label for="firm-email">E-posta</Label>
                            <Input id="firm-email" v-model="firmForm.email" maxlength="255" type="email" class="h-11 md:h-9" />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label for="firm-address">Adres</Label>
                        <Input id="firm-address" v-model="firmForm.address" maxlength="500" type="text" class="h-11 md:h-9" />
                    </div>

                    <div class="flex items-center gap-3">
                        <Switch id="firm-active" v-model="firmForm.isActive" />
                        <Label for="firm-active">Aktif firma</Label>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" class="h-11 md:h-9" :disabled="isSubmitting" @click="closeCreateForm">Vazgeç</Button>
                        <Button type="submit" class="h-11 md:h-9" :disabled="isSubmitting">
                            <Spinner v-if="isSubmitting" />
                            {{ isSubmitting ? 'Kaydediliyor...' : 'Kaydet' }}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        <ConfirmDialog
            v-model:open="showDeleteConfirm"
            title="Firmayı Kaldır"
            :description="`${deleteTarget?.name || ''} firmasını kalıcı olarak kaldırmak istediğinize emin misiniz?`"
            confirm-text="Kaldır"
            cancel-text="Vazgeç"
            :loading="isDeleting"
            @confirm="deleteFirm"
        />
    </AdminLayout>
</template>
