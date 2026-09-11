<script setup lang="ts">
import type { Component } from 'vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
    Building2,
    ClipboardList,
    Flag,
    FileText,
    MessageSquare,
    Pin,
    Plus,
    UserRound,
    Users,
} from '@lucide/vue';
import { useAuthStore } from '@/stores/authStore';
import AdminLayout from '@/layouts/AdminLayout.vue';
import { PageContainer, PageHeader, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const router = useRouter();
const authStore = useAuthStore();

// Redirect if not admin/moderator
onMounted(() => {
    if (!authStore.isAuthenticated) {
        router.push('/login');
        return;
    }
});

// Stats (mock data - would come from API)
const stats = ref({
    totalUsers: 0,
    totalTopics: 0,
    totalReplies: 0,
    pendingReports: 0,
    activeUsers: 0,
    todayTopics: 0,
});

type ActivityType = 'topic' | 'reply' | 'user' | 'report';

interface ActivityItem {
    id: number;
    type: ActivityType;
    action: string;
    user: string;
    time: string;
}

// Recent activity
const recentActivity = ref<ActivityItem[]>([
    { id: 1, type: 'topic', action: 'Yeni konu oluşturuldu', user: 'Ahmet Y.', time: '5 dk önce' },
    { id: 2, type: 'reply', action: 'Cevap eklendi', user: 'Mehmet K.', time: '12 dk önce' },
    { id: 3, type: 'user', action: 'Yeni kullanıcı kaydı', user: 'Ali T.', time: '1 sa önce' },
    { id: 4, type: 'report', action: 'İçerik rapor edildi', user: 'Veli B.', time: '2 sa önce' },
]);

const quickActions: { label: string; to: string; icon: Component }[] = [
    { label: 'Yeni Kategori', to: '/admin/categories', icon: Plus },
    { label: 'Kullanıcı Yönet', to: '/admin/users', icon: UserRound },
    { label: 'Firma Yönet', to: '/admin/firms', icon: Building2 },
    { label: 'Raporları Gör', to: '/admin/reports', icon: ClipboardList },
];

function navigateTo(route: string) {
    router.push(route);
}

function getActivityIcon(type: string): Component {
    const icons: Record<string, Component> = {
        topic: FileText,
        reply: MessageSquare,
        user: UserRound,
        report: Flag,
    };
    return icons[type] ?? Pin;
}
</script>

<template>
    <AdminLayout>
        <PageContainer>
            <PageHeader title="Admin Panel" description="Topluluk yönetimi ve moderasyon">
                <template #meta>
                    <Badge variant="secondary">{{ stats.activeUsers }} aktif kullanıcı</Badge>
                    <Badge variant="secondary">{{ stats.todayTopics }} bugünkü konu</Badge>
                </template>
                <template #actions>
                    <Button variant="outline" class="h-11 md:h-9" @click="navigateTo('/admin/users')">
                        <Users aria-hidden="true" />
                        Kullanıcılar
                    </Button>
                    <Button class="h-11 md:h-9" @click="navigateTo('/admin/firms')">
                        <Building2 aria-hidden="true" />
                        Firmalar
                    </Button>
                </template>
            </PageHeader>

            <!-- Stats -->
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Toplam Kullanıcı" :value="stats.totalUsers" :icon="Users" to="/admin/users" />
                <StatCard label="Toplam Konu" :value="stats.totalTopics" :icon="MessageSquare" />
                <StatCard label="Toplam Cevap" :value="stats.totalReplies" :icon="FileText" />
                <StatCard label="Bekleyen Rapor" :value="stats.pendingReports" :icon="Flag" hint="İnceleme bekliyor" />
            </div>

            <!-- Quick actions -->
            <Card>
                <CardHeader>
                    <CardTitle>Hızlı İşlemler</CardTitle>
                    <CardDescription>Sık kullanılan yönetim sayfalarına hızlı erişim</CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <Button
                            v-for="action in quickActions"
                            :key="action.to"
                            variant="outline"
                            class="h-11 justify-start md:h-9"
                            @click="navigateTo(action.to)"
                        >
                            <component :is="action.icon" aria-hidden="true" />
                            {{ action.label }}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <!-- Recent activity -->
            <Card>
                <CardHeader>
                    <CardTitle>Son Aktiviteler</CardTitle>
                    <CardDescription>Platformdaki son hareketler</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul class="divide-y rounded-lg border">
                        <li
                            v-for="activity in recentActivity"
                            :key="activity.id"
                            class="flex items-center gap-3 px-4 py-3"
                        >
                            <span
                                class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                                aria-hidden="true"
                            >
                                <component :is="getActivityIcon(activity.type)" class="size-4" />
                            </span>
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium text-foreground">{{ activity.action }}</p>
                                <p class="truncate text-xs text-muted-foreground">{{ activity.user }}</p>
                            </div>
                            <span class="shrink-0 text-xs text-muted-foreground">{{ activity.time }}</span>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </PageContainer>
    </AdminLayout>
</template>
