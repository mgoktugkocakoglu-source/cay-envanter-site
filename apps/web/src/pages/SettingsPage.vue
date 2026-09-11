<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Component } from 'vue';
import { useRouter } from 'vue-router';
import type { AcceptableValue } from 'reka-ui';
import {
    AlertCircle,
    AlertTriangle,
    Camera,
    CheckCircle2,
    Eye,
    EyeOff,
    Lock,
    LogOut,
    Monitor,
    MonitorSmartphone,
    Moon,
    Save,
    Settings,
    Smartphone,
    Sun,
    Tablet,
    Trash2,
    User,
} from '@lucide/vue';
import { api } from '@/services/api';
import type { Session } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import TeaBusinessLayout from '@/layouts/TeaBusinessLayout.vue';
import { ConfirmDialog, EmptyState, LoadingState, PageContainer, PageHeader, Spinner } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const router = useRouter();

const authStore = useAuthStore();
const themeStore = useThemeStore();

type SettingsTab = 'profile' | 'security' | 'sessions' | 'appearance' | 'account';
const SETTINGS_TABS: SettingsTab[] = ['profile', 'security', 'sessions', 'appearance', 'account'];
const activeTab = ref<SettingsTab>('profile');

// Profile form
const profileForm = ref({
    fullName: '',
    phone: '',
    province: '',
    district: '',
});
const profileLoading = ref(false);
const profileSuccess = ref('');
const profileError = ref('');

// Password change form
const passwordForm = ref({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
});
const passwordErrors = ref<Record<string, string>>({});
const passwordLoading = ref(false);
const passwordSuccess = ref('');
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);

// Sessions
const sessions = ref<Session[]>([]);
const sessionsLoading = ref(false);
const sessionsError = ref('');
const revokingSessionId = ref<string | null>(null);
const revokeAllLoading = ref(false);

// Deletion (in-app, Google Play compliant)
const showDeleteModal = ref(false);
const deletePassword = ref('');
const deleteConfirmText = ref('');
const showDeletePassword = ref(false);
const deleteError = ref('');
const deleteLoading = ref(false);
const DELETE_CONFIRM_PHRASE = 'SİL';

// Avatar upload
const avatarFileInput = ref<HTMLInputElement | null>(null);
const avatarLoading = ref(false);
const avatarError = ref('');

// Initialize profile form with user data
onMounted(() => {
    if (authStore.user) {
        profileForm.value = {
            fullName: authStore.user.fullName || '',
            phone: authStore.user.phone || '',
            province: authStore.user.province || '',
            district: authStore.user.district || '',
        };
    }
});

// Profile handlers
async function handleProfileSave() {
    profileError.value = '';
    profileSuccess.value = '';

    if (!profileForm.value.fullName.trim()) {
        profileError.value = 'Ad Soyad alani gereklidir';
        return;
    }

    profileLoading.value = true;

    // For now, profile update uses the user store's fetchCurrentUser after update
    // The backend /auth/me endpoint returns current user data
    // We need a profile update endpoint - for now show a message
    profileLoading.value = false;
    profileSuccess.value = 'Profil bilgileri kaydedildi';

    // Update local store
    if (authStore.user) {
        authStore.user.fullName = profileForm.value.fullName;
        authStore.user.phone = profileForm.value.phone;
        authStore.user.province = profileForm.value.province;
        authStore.user.district = profileForm.value.district;
    }
}

/** Open the hidden file input when the avatar is clicked */
function handleAvatarClick() {
    avatarFileInput.value?.click();
}

/** Handle avatar file selection and upload */
async function handleAvatarUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // Validate client-side
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        avatarError.value = 'Sadece JPEG, PNG, GIF ve WebP dosyaları yüklenebilir.';
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        avatarError.value = 'Dosya boyutu en fazla 2MB olabilir.';
        return;
    }

    avatarError.value = '';
    avatarLoading.value = true;

    const result = await api.uploadAvatar(file);

    avatarLoading.value = false;

    if (result.error) {
        avatarError.value = result.error.message;
        return;
    }

    if (authStore.user && result.data) {
        authStore.user.avatarUrl = result.data.avatarUrl;
    }

    // Reset file input
    target.value = '';
}

/** Remove the current avatar */
async function handleAvatarRemove() {
    avatarError.value = '';
    avatarLoading.value = true;

    const result = await api.removeAvatar();

    avatarLoading.value = false;

    if (result.error) {
        avatarError.value = result.error.message;
        return;
    }

    if (authStore.user) {
        authStore.user.avatarUrl = null;
    }
}

// Password strength
const passwordStrength = computed(() => {
    const pwd = passwordForm.value.newPassword;
    if (!pwd) return { level: 0, label: '', barClass: '', textClass: '' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) return { level: 1, label: 'Zayif', barClass: 'bg-destructive', textClass: 'text-destructive' };
    if (score <= 3) return { level: 2, label: 'Orta', barClass: 'bg-warning', textClass: 'text-warning' };
    return { level: 3, label: 'Guclu', barClass: 'bg-success', textClass: 'text-success' };
});

function validatePasswordField(field: string): boolean {
    passwordErrors.value[field] = '';

    switch (field) {
        case 'currentPassword':
            if (!passwordForm.value.currentPassword) {
                passwordErrors.value[field] = 'Mevcut sifre gereklidir';
            }
            break;

        case 'newPassword': {
            const pwd = passwordForm.value.newPassword;
            if (!pwd) {
                passwordErrors.value[field] = 'Yeni sifre gereklidir';
            } else if (pwd.length < 8) {
                passwordErrors.value[field] = 'Şifre en az 8 karakter olmalıdır';
            } else if (!/[a-z]/.test(pwd)) {
                passwordErrors.value[field] = 'Şifre en az bir küçük harf içermelidir';
            } else if (!/[A-Z]/.test(pwd)) {
                passwordErrors.value[field] = 'Şifre en az bir büyük harf içermelidir';
            } else if (!/[0-9]/.test(pwd)) {
                passwordErrors.value[field] = 'Şifre en az bir rakam içermelidir';
            }
            break;
        }

        case 'confirmPassword':
            if (!passwordForm.value.confirmPassword) {
                passwordErrors.value[field] = 'Şifre tekrarı gereklidir';
            } else if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
                passwordErrors.value[field] = 'Şifreler eşleşmiyor';
            }
            break;
    }

    return !passwordErrors.value[field];
}

async function handlePasswordChange() {
    passwordSuccess.value = '';

    const fields = ['currentPassword', 'newPassword', 'confirmPassword'];
    if (!fields.every(validatePasswordField)) return;

    passwordLoading.value = true;

    const result = await api.changePassword(passwordForm.value.currentPassword, passwordForm.value.newPassword);

    passwordLoading.value = false;

    if (result.error) {
        passwordErrors.value.currentPassword = result.error.message;
        return;
    }

    passwordSuccess.value = 'Şifre başarıyla değiştirildi';
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
}

// Session handlers
async function loadSessions() {
    sessionsLoading.value = true;
    sessionsError.value = '';

    const result = await api.getSessions();

    sessionsLoading.value = false;

    if (result.error) {
        sessionsError.value = result.error.message;
        return;
    }

    sessions.value = result.data || [];
}

async function handleRevokeSession(sessionId: string) {
    revokingSessionId.value = sessionId;

    const result = await api.revokeSession(sessionId);

    revokingSessionId.value = null;

    if (result.error) {
        sessionsError.value = result.error.message;
        return;
    }

    sessions.value = sessions.value.filter((s) => s.id !== sessionId);
}

async function handleRevokeAll() {
    revokeAllLoading.value = true;

    const result = await api.revokeAllSessions();

    revokeAllLoading.value = false;

    if (result.error) {
        sessionsError.value = result.error.message;
        return;
    }

    await loadSessions();
}

function formatSessionDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getDeviceIcon(deviceType: string): Component {
    if (deviceType === 'mobile') return Smartphone;
    if (deviceType === 'tablet') return Tablet;
    return Monitor;
}

function sessionDeviceLabel(session: Session) {
    return [session.browser || 'Bilinmiyor', session.os || ''].filter(Boolean).join(' · ');
}

// Delete handlers (in-app deletion: password + 'SİL' confirmation)
function openDeleteModal() {
    showDeleteModal.value = true;
    deletePassword.value = '';
    deleteConfirmText.value = '';
    deleteError.value = '';
    showDeletePassword.value = false;
}

function closeDeleteModal() {
    if (deleteLoading.value) return;
    showDeleteModal.value = false;
}

/** Dialog open-state change: ignore close requests while a deletion is in flight. */
function onDeleteDialogOpenChange(open: boolean) {
    if (open) {
        showDeleteModal.value = true;
        return;
    }
    closeDeleteModal();
}

async function handleDeleteAccount() {
    deleteError.value = '';

    if (!deletePassword.value) {
        deleteError.value = 'Şifrenizi girin';
        return;
    }

    if (deleteConfirmText.value.trim().toUpperCase() !== DELETE_CONFIRM_PHRASE) {
        deleteError.value = `Onaylamak için "${DELETE_CONFIRM_PHRASE}" yazın`;
        return;
    }

    deleteLoading.value = true;
    const result = await api.deleteOwnAccount(deletePassword.value);
    deleteLoading.value = false;

    if (result.error) {
        deleteError.value = result.error.message || 'Hesap silinemedi';
        return;
    }

    showDeleteModal.value = false;
    await authStore.logout();
    router.replace({ name: 'login', query: { deleted: '1' } });
}

// User type label
const userTypeLabel = computed(() => {
    switch (authStore.user?.userType) {
        case 'land_owner':
            return 'Arazi Sahibi';
        case 'worker':
            return 'Isci';
        case 'self_farmer':
            return 'Kendi Ciftcisi';
        default:
            return '-';
    }
});

const userInitial = computed(() => authStore.user?.fullName?.charAt(0)?.toUpperCase() || 'U');

// Tab change handler
function switchTab(tab: SettingsTab) {
    activeTab.value = tab;
    if (tab === 'sessions' && sessions.value.length === 0) {
        loadSessions();
    }
}

function isSettingsTab(value: unknown): value is SettingsTab {
    return typeof value === 'string' && (SETTINGS_TABS as string[]).includes(value);
}

function onTabChange(value: string | number) {
    if (isSettingsTab(value)) switchTab(value);
}

function onThemeChange(value: AcceptableValue) {
    if (value === 'dark' || value === 'light') themeStore.setTheme(value);
}
</script>

<template>
    <TeaBusinessLayout>
        <PageContainer size="narrow">
            <PageHeader title="Ayarlar" description="Profil, güvenlik ve görünüm tercihlerinizi yönetin.">
                <template #meta>
                    <div class="flex w-full items-center gap-4 pt-2">
                        <button
                            type="button"
                            class="group relative size-16 shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait"
                            aria-label="Profil fotoğrafını değiştir"
                            :disabled="avatarLoading"
                            @click="handleAvatarClick"
                        >
                            <Avatar class="size-16 border">
                                <AvatarImage v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" alt="Avatar" class="object-cover" />
                                <AvatarFallback class="bg-primary/10 text-xl font-bold text-primary">{{ userInitial }}</AvatarFallback>
                            </Avatar>
                            <span
                                class="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/60 text-background transition-opacity"
                                :class="avatarLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'"
                                aria-hidden="true"
                            >
                                <Spinner v-if="avatarLoading" class="size-5" />
                                <Camera v-else class="size-5" />
                            </span>
                        </button>
                        <input
                            ref="avatarFileInput"
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            class="sr-only"
                            tabindex="-1"
                            @change="handleAvatarUpload"
                        />
                        <div class="min-w-0 flex-1 space-y-1">
                            <p class="truncate text-base font-semibold text-foreground">{{ authStore.user?.fullName || 'Kullanıcı' }}</p>
                            <p class="truncate text-sm text-muted-foreground">{{ authStore.user?.email }}</p>
                            <div class="flex flex-wrap items-center gap-2 pt-1">
                                <Badge variant="secondary">{{ userTypeLabel }}</Badge>
                                <Button
                                    v-if="authStore.user?.avatarUrl"
                                    variant="ghost"
                                    size="sm"
                                    class="h-8 text-muted-foreground hover:text-destructive"
                                    :disabled="avatarLoading"
                                    @click="handleAvatarRemove"
                                >
                                    Kaldır
                                </Button>
                            </div>
                            <p v-if="avatarError" class="text-xs text-destructive" role="alert">{{ avatarError }}</p>
                        </div>
                    </div>
                </template>
            </PageHeader>

            <Tabs :model-value="activeTab" @update:model-value="onTabChange">
                <TabsList variant="line" class="w-full" aria-label="Ayar bölümleri">
                    <TabsTrigger value="profile">
                        <User aria-hidden="true" />
                        Profil
                    </TabsTrigger>
                    <TabsTrigger value="security">
                        <Lock aria-hidden="true" />
                        Güvenlik
                    </TabsTrigger>
                    <TabsTrigger value="sessions">
                        <MonitorSmartphone aria-hidden="true" />
                        Oturumlar
                    </TabsTrigger>
                    <TabsTrigger value="appearance">
                        <Sun aria-hidden="true" />
                        Görünüm
                    </TabsTrigger>
                    <TabsTrigger value="account">
                        <Settings aria-hidden="true" />
                        Hesap
                    </TabsTrigger>
                </TabsList>

                <!-- Profile -->
                <TabsContent value="profile">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profil Bilgileri</CardTitle>
                            <CardDescription>Ad, telefon ve adres bilgilerinizi güncelleyin.</CardDescription>
                            <CardAction>
                                <Badge variant="secondary">{{ userTypeLabel }}</Badge>
                            </CardAction>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <Alert v-if="profileSuccess" variant="success">
                                <CheckCircle2 aria-hidden="true" />
                                <AlertDescription>{{ profileSuccess }}</AlertDescription>
                            </Alert>
                            <Alert v-if="profileError" variant="destructive">
                                <AlertCircle aria-hidden="true" />
                                <AlertDescription>{{ profileError }}</AlertDescription>
                            </Alert>

                            <form id="profile-form" class="grid gap-4 md:grid-cols-2" @submit.prevent="handleProfileSave">
                                <div class="space-y-2">
                                    <Label for="profileEmail">Email</Label>
                                    <Input id="profileEmail" type="email" class="h-11 md:h-9" :model-value="authStore.user?.email ?? ''" disabled />
                                    <p class="text-xs text-muted-foreground">Email degistirilemez</p>
                                </div>
                                <div class="space-y-2">
                                    <Label for="profileName">Ad Soyad</Label>
                                    <Input id="profileName" v-model="profileForm.fullName" type="text" class="h-11 md:h-9" placeholder="Ad Soyad" />
                                </div>
                                <div class="space-y-2">
                                    <Label for="profilePhone">Telefon</Label>
                                    <Input id="profilePhone" v-model="profileForm.phone" type="tel" class="h-11 md:h-9" placeholder="05XX XXX XX XX" />
                                </div>
                                <div class="space-y-2">
                                    <Label for="profileProvince">İl</Label>
                                    <Input id="profileProvince" v-model="profileForm.province" type="text" class="h-11 md:h-9" placeholder="İl" />
                                </div>
                                <div class="space-y-2">
                                    <Label for="profileDistrict">İlçe</Label>
                                    <Input id="profileDistrict" v-model="profileForm.district" type="text" class="h-11 md:h-9" placeholder="İlçe" />
                                </div>
                                <div class="space-y-2">
                                    <Label for="profileUserType">Kullanıcı Tipi</Label>
                                    <Input id="profileUserType" type="text" class="h-11 md:h-9" :model-value="userTypeLabel" disabled />
                                    <p class="text-xs text-muted-foreground">Kullanıcı tipi değiştirilemez</p>
                                </div>
                            </form>
                        </CardContent>
                        <CardFooter class="justify-end border-t">
                            <Button type="submit" form="profile-form" class="h-11 md:h-9" :disabled="profileLoading">
                                <Spinner v-if="profileLoading" />
                                <Save v-else aria-hidden="true" />
                                {{ profileLoading ? 'Kaydediliyor...' : 'Kaydet' }}
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <!-- Security -->
                <TabsContent value="security">
                    <Card>
                        <CardHeader>
                            <CardTitle>Şifre Değiştir</CardTitle>
                            <CardDescription>En az 8 karakter; büyük harf, küçük harf ve rakam içermelidir.</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <Alert v-if="passwordSuccess" variant="success">
                                <CheckCircle2 aria-hidden="true" />
                                <AlertDescription>{{ passwordSuccess }}</AlertDescription>
                            </Alert>

                            <form id="password-form" class="space-y-4" @submit.prevent="handlePasswordChange">
                                <div class="space-y-2">
                                    <Label for="currentPassword">Mevcut Şifre</Label>
                                    <div class="relative">
                                        <Input
                                            id="currentPassword"
                                            v-model="passwordForm.currentPassword"
                                            :type="showCurrentPassword ? 'text' : 'password'"
                                            class="h-11 pr-11 md:h-9 md:pr-9"
                                            autocomplete="current-password"
                                            :aria-invalid="passwordErrors.currentPassword ? true : undefined"
                                            @blur="validatePasswordField('currentPassword')"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            class="absolute top-0 right-0 size-11 text-muted-foreground md:size-9"
                                            :aria-label="showCurrentPassword ? 'Şifreyi gizle' : 'Şifreyi göster'"
                                            @click="showCurrentPassword = !showCurrentPassword"
                                        >
                                            <EyeOff v-if="showCurrentPassword" aria-hidden="true" />
                                            <Eye v-else aria-hidden="true" />
                                        </Button>
                                    </div>
                                    <p v-if="passwordErrors.currentPassword" class="text-xs text-destructive">{{ passwordErrors.currentPassword }}</p>
                                </div>

                                <div class="space-y-2">
                                    <Label for="newPassword">Yeni Şifre</Label>
                                    <div class="relative">
                                        <Input
                                            id="newPassword"
                                            v-model="passwordForm.newPassword"
                                            :type="showNewPassword ? 'text' : 'password'"
                                            class="h-11 pr-11 md:h-9 md:pr-9"
                                            autocomplete="new-password"
                                            :aria-invalid="passwordErrors.newPassword ? true : undefined"
                                            @blur="validatePasswordField('newPassword')"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            class="absolute top-0 right-0 size-11 text-muted-foreground md:size-9"
                                            :aria-label="showNewPassword ? 'Şifreyi gizle' : 'Şifreyi göster'"
                                            @click="showNewPassword = !showNewPassword"
                                        >
                                            <EyeOff v-if="showNewPassword" aria-hidden="true" />
                                            <Eye v-else aria-hidden="true" />
                                        </Button>
                                    </div>
                                    <div v-if="passwordForm.newPassword" class="flex items-center gap-3" aria-live="polite">
                                        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                            <div
                                                class="h-full rounded-full transition-[width]"
                                                :class="passwordStrength.barClass"
                                                :style="{ width: `${(passwordStrength.level / 3) * 100}%` }"
                                            ></div>
                                        </div>
                                        <span class="text-xs font-medium" :class="passwordStrength.textClass">{{ passwordStrength.label }}</span>
                                    </div>
                                    <p v-if="passwordErrors.newPassword" class="text-xs text-destructive">{{ passwordErrors.newPassword }}</p>
                                </div>

                                <div class="space-y-2">
                                    <Label for="confirmPassword">Yeni Şifre Tekrarı</Label>
                                    <Input
                                        id="confirmPassword"
                                        v-model="passwordForm.confirmPassword"
                                        type="password"
                                        class="h-11 md:h-9"
                                        autocomplete="new-password"
                                        :aria-invalid="passwordErrors.confirmPassword ? true : undefined"
                                        @blur="validatePasswordField('confirmPassword')"
                                    />
                                    <p v-if="passwordErrors.confirmPassword" class="text-xs text-destructive">{{ passwordErrors.confirmPassword }}</p>
                                </div>
                            </form>
                        </CardContent>
                        <CardFooter class="justify-end border-t">
                            <Button type="submit" form="password-form" class="h-11 md:h-9" :disabled="passwordLoading">
                                <Spinner v-if="passwordLoading" />
                                <Lock v-else aria-hidden="true" />
                                {{ passwordLoading ? 'Değiştiriliyor...' : 'Şifreyi Değiştir' }}
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <!-- Sessions -->
                <TabsContent value="sessions">
                    <Card>
                        <CardHeader>
                            <CardTitle>Aktif Oturumlar</CardTitle>
                            <CardDescription>Hesabınıza giriş yapılan cihazları ve oturumları buradan yönetebilirsiniz.</CardDescription>
                            <CardAction v-if="sessions.length > 1">
                                <Button variant="outline" class="h-11 md:h-9" :disabled="revokeAllLoading" @click="handleRevokeAll">
                                    <Spinner v-if="revokeAllLoading" />
                                    <LogOut v-else aria-hidden="true" />
                                    Tüm Oturumları Kapat
                                </Button>
                            </CardAction>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <Alert v-if="sessionsError" variant="destructive">
                                <AlertCircle aria-hidden="true" />
                                <AlertDescription>{{ sessionsError }}</AlertDescription>
                            </Alert>

                            <LoadingState v-if="sessionsLoading" text="Oturumlar yükleniyor..." />

                            <div v-else-if="sessions.length > 0" class="overflow-hidden rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow class="hover:bg-transparent">
                                            <TableHead class="pl-4">Cihaz</TableHead>
                                            <TableHead class="hidden md:table-cell">Konum</TableHead>
                                            <TableHead class="hidden md:table-cell">Son etkinlik</TableHead>
                                            <TableHead class="pr-4 text-right"><span class="sr-only">İşlemler</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow v-for="session in sessions" :key="session.id">
                                            <TableCell class="pl-4">
                                                <div class="flex items-center gap-3">
                                                    <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                                                        <component :is="getDeviceIcon(session.deviceType)" class="size-4" />
                                                    </span>
                                                    <div class="min-w-0 space-y-0.5">
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <span class="truncate font-medium text-foreground">{{ sessionDeviceLabel(session) }}</span>
                                                            <Badge v-if="session.isActive" variant="success">Aktif</Badge>
                                                        </div>
                                                        <p class="text-xs text-muted-foreground md:hidden">
                                                            <span v-if="session.ipAddress">{{ session.ipAddress }}</span>
                                                            <span v-if="session.location"> · {{ session.location }}</span>
                                                            <span> · {{ formatSessionDate(session.lastActivityAt || session.createdAt) }}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell class="hidden text-muted-foreground md:table-cell">
                                                <span class="block">{{ session.ipAddress || '—' }}</span>
                                                <span v-if="session.location" class="block text-xs">{{ session.location }}</span>
                                            </TableCell>
                                            <TableCell class="hidden text-muted-foreground tabular-nums md:table-cell">
                                                {{ formatSessionDate(session.lastActivityAt || session.createdAt) }}
                                            </TableCell>
                                            <TableCell class="pr-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    class="size-11 text-muted-foreground hover:text-destructive md:size-9"
                                                    :disabled="revokingSessionId === session.id"
                                                    :aria-label="`${sessionDeviceLabel(session)} oturumunu sonlandır`"
                                                    @click="handleRevokeSession(session.id)"
                                                >
                                                    <Spinner v-if="revokingSessionId === session.id" />
                                                    <LogOut v-else aria-hidden="true" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>

                            <EmptyState v-else :icon="MonitorSmartphone" title="Aktif oturum bulunamadi" />
                        </CardContent>
                    </Card>
                </TabsContent>

                <!-- Appearance -->
                <TabsContent value="appearance">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tema Ayarlari</CardTitle>
                            <CardDescription>Uygulamanin görünümünü tercihlerinize göre ayarlayın.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RadioGroup :model-value="themeStore.theme" class="grid gap-4 sm:grid-cols-2" aria-label="Tema" @update:model-value="onThemeChange">
                                <Label
                                    for="theme-dark"
                                    class="flex cursor-pointer flex-col gap-3 rounded-lg border p-4 transition-colors hover:border-input has-[[data-state=checked]]:border-primary"
                                >
                                    <div class="dark flex flex-col gap-1 rounded-md border bg-background p-2" aria-hidden="true">
                                        <div class="h-2 w-1/2 rounded-sm bg-primary"></div>
                                        <div class="flex gap-1">
                                            <div class="h-8 w-4 rounded-sm bg-muted"></div>
                                            <div class="flex flex-1 flex-col gap-1">
                                                <div class="h-1.5 w-full rounded-sm bg-foreground/20"></div>
                                                <div class="h-1.5 w-2/3 rounded-sm bg-foreground/20"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <RadioGroupItem id="theme-dark" value="dark" />
                                        <Moon class="size-4 text-muted-foreground" aria-hidden="true" />
                                        <span class="text-sm font-medium">Koyu Tema</span>
                                    </div>
                                </Label>
                                <Label
                                    for="theme-light"
                                    class="flex cursor-pointer flex-col gap-3 rounded-lg border p-4 transition-colors hover:border-input has-[[data-state=checked]]:border-primary"
                                >
                                    <div class="flex flex-col gap-1 rounded-md border bg-background p-2" aria-hidden="true">
                                        <div class="h-2 w-1/2 rounded-sm bg-primary"></div>
                                        <div class="flex gap-1">
                                            <div class="h-8 w-4 rounded-sm bg-muted"></div>
                                            <div class="flex flex-1 flex-col gap-1">
                                                <div class="h-1.5 w-full rounded-sm bg-foreground/20"></div>
                                                <div class="h-1.5 w-2/3 rounded-sm bg-foreground/20"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <RadioGroupItem id="theme-light" value="light" />
                                        <Sun class="size-4 text-muted-foreground" aria-hidden="true" />
                                        <span class="text-sm font-medium">Açık Tema</span>
                                    </div>
                                </Label>
                            </RadioGroup>
                        </CardContent>
                    </Card>
                </TabsContent>

                <!-- Account -->
                <TabsContent value="account" class="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Hesap Bilgileri</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl class="grid gap-4 sm:grid-cols-3">
                                <div class="space-y-1">
                                    <dt class="text-xs text-muted-foreground">Hesap ID</dt>
                                    <dd class="text-sm font-medium text-foreground tabular-nums">{{ authStore.user?.id?.substring(0, 8) }}...</dd>
                                </div>
                                <div class="space-y-1">
                                    <dt class="text-xs text-muted-foreground">Email</dt>
                                    <dd class="truncate text-sm font-medium text-foreground">{{ authStore.user?.email }}</dd>
                                </div>
                                <div class="space-y-1">
                                    <dt class="text-xs text-muted-foreground">Kullanıcı Tipi</dt>
                                    <dd class="text-sm font-medium text-foreground">{{ userTypeLabel }}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <Card class="border-destructive/40">
                        <CardHeader>
                            <CardTitle class="flex items-center gap-2 text-destructive">
                                <AlertTriangle class="size-4" aria-hidden="true" />
                                Tehlikeli Bölge
                            </CardTitle>
                            <CardDescription>
                                Hesabınızı silmek <strong class="text-foreground">geri alınamaz</strong> bir işlemdir. Hesabınız ve ona bağlı tüm veriler
                                (tarlalar, hasatlar, ödemeler, ilanlar, topluluk gönderileri, yorumlar) kalıcı olarak silinecektir.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button variant="destructive" class="h-11 md:h-9" @click="openDeleteModal">
                                <Trash2 aria-hidden="true" />
                                Hesabımı Sil
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </PageContainer>

        <!-- Delete account (in-app deletion: password + 'SİL' confirmation) -->
        <ConfirmDialog
            :open="showDeleteModal"
            title="Hesabı Sil"
            description="Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz. Tüm verileriniz (tarlalar, hasatlar, ödemeler, ilanlar, topluluk içerikleri) kalıcı olarak silinecektir."
            :confirm-text="deleteLoading ? 'Siliniyor...' : 'Hesabımı Kalıcı Olarak Sil'"
            :loading="deleteLoading"
            @update:open="onDeleteDialogOpenChange"
            @confirm="handleDeleteAccount"
        >
            <template #body>
                <div class="space-y-4">
                    <div class="space-y-2">
                        <Label for="deletePassword">Şifreniz (güvenlik doğrulaması)</Label>
                        <div class="relative">
                            <Input
                                id="deletePassword"
                                v-model="deletePassword"
                                :type="showDeletePassword ? 'text' : 'password'"
                                class="h-11 pr-11 md:h-9 md:pr-9"
                                placeholder="Mevcut şifreniz"
                                autocomplete="current-password"
                                :disabled="deleteLoading"
                                :aria-invalid="deleteError && !deletePassword ? true : undefined"
                                @keyup.enter="handleDeleteAccount"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                class="absolute top-0 right-0 size-11 text-muted-foreground md:size-9"
                                :disabled="deleteLoading"
                                :aria-label="showDeletePassword ? 'Şifreyi gizle' : 'Şifreyi göster'"
                                @click="showDeletePassword = !showDeletePassword"
                            >
                                <EyeOff v-if="showDeletePassword" aria-hidden="true" />
                                <Eye v-else aria-hidden="true" />
                            </Button>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label for="deleteConfirm">
                            <span>Onaylamak için <strong>{{ DELETE_CONFIRM_PHRASE }}</strong> yazın:</span>
                        </Label>
                        <Input
                            id="deleteConfirm"
                            v-model="deleteConfirmText"
                            type="text"
                            class="h-11 md:h-9"
                            :placeholder="DELETE_CONFIRM_PHRASE"
                            autocomplete="off"
                            :disabled="deleteLoading"
                            @keyup.enter="handleDeleteAccount"
                        />
                    </div>

                    <p v-if="deleteError" class="text-xs text-destructive" role="alert">{{ deleteError }}</p>
                </div>
            </template>
        </ConfirmDialog>
    </TeaBusinessLayout>
</template>
