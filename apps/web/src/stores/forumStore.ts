import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    api,
    type ForumCategory,
    type ForumTopic,
    type ForumReply,
    type ForumTopicListQuery,
    type ReactionType,
} from '@/services/api';

export const useForumStore = defineStore('forum', () => {
    // State
    const categories = ref<ForumCategory[]>([]);
    const currentCategory = ref<ForumCategory | null>(null);
    const topics = ref<ForumTopic[]>([]);
    const currentTopic = ref<ForumTopic | null>(null);
    const replies = ref<ForumReply[]>([]);
    const topicsMeta = ref({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
    });

    const loading = ref(false);
    const error = ref<string | null>(null);

    // Getters
    const activeCategories = computed(() => categories.value.filter((c) => c.isActive));
    const pinnedTopics = computed(() => topics.value.filter((t) => t.isPinned));
    const regularTopics = computed(() => topics.value.filter((t) => !t.isPinned));

    // Actions - Categories
    async function fetchCategories() {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.getForumCategories();
            if (response.data) {
                categories.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (err) {
            error.value = 'Failed to load forum categories';
            console.error('Error fetching categories:', err);
        } finally {
            loading.value = false;
        }
    }

    async function fetchCategory(id: string) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.getForumCategory(id);
            if (response.data) {
                currentCategory.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (err) {
            error.value = 'Failed to load category';
            console.error('Error fetching category:', err);
        } finally {
            loading.value = false;
        }
    }

    // Actions - Topics
    async function fetchTopics(query?: ForumTopicListQuery) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.getForumTopics(query);
            if (response.data) {
                // Backend returns { items, total, page, limit, totalPages }
                // Frontend expects { data, meta: { total, page, limit, totalPages } }
                const backendData = response.data as any;

                topics.value = backendData.items || backendData.data || [];
                topicsMeta.value = {
                    total: backendData.total,
                    page: backendData.page,
                    limit: backendData.limit,
                    totalPages: backendData.totalPages,
                };
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (err) {
            error.value = 'Failed to load topics';
            console.error('Error fetching topics:', err);
        } finally {
            loading.value = false;
        }
    }

    async function fetchTopic(id: string) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.getForumTopic(id);
            if (response.data) {
                currentTopic.value = response.data;
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (err) {
            error.value = 'Failed to load topic';
            console.error('Error fetching topic:', err);
        } finally {
            loading.value = false;
        }
    }

    async function createTopic(data: { title: string; content: string; categoryId: string }) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.createForumTopic(data);
            if (response.data) {
                return response.data;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
            return null;
        } catch (err) {
            error.value = 'Failed to create topic';
            console.error('Error creating topic:', err);
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function updateTopic(id: string, data: { title?: string; content?: string }) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.updateForumTopic(id, data);
            if (response.data) {
                if (currentTopic.value?.id === id) {
                    currentTopic.value = response.data;
                }
                return response.data;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
            return null;
        } catch (err) {
            error.value = 'Failed to update topic';
            console.error('Error updating topic:', err);
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function deleteTopic(id: string) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.deleteForumTopic(id);
            if (response.error) {
                error.value = response.error.message;
                return false;
            }
            topics.value = topics.value.filter((t) => t.id !== id);
            if (currentTopic.value?.id === id) {
                currentTopic.value = null;
            }
            return true;
        } catch (err) {
            error.value = 'Failed to delete topic';
            console.error('Error deleting topic:', err);
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function togglePin(id: string) {
        try {
            const response = await api.pinForumTopic(id);
            if (response.data) {
                const index = topics.value.findIndex((t) => t.id === id);
                if (index !== -1) {
                    topics.value[index] = response.data;
                }
                if (currentTopic.value?.id === id) {
                    currentTopic.value = response.data;
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error toggling pin:', err);
            return false;
        }
    }

    async function toggleLock(id: string) {
        try {
            const response = await api.lockForumTopic(id);
            if (response.data) {
                const index = topics.value.findIndex((t) => t.id === id);
                if (index !== -1) {
                    topics.value[index] = response.data;
                }
                if (currentTopic.value?.id === id) {
                    currentTopic.value = response.data;
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error toggling lock:', err);
            return false;
        }
    }

    async function toggleSolve(id: string) {
        try {
            const response = await api.solveForumTopic(id);
            if (response.data) {
                const index = topics.value.findIndex((t) => t.id === id);
                if (index !== -1) {
                    topics.value[index] = response.data;
                }
                if (currentTopic.value?.id === id) {
                    currentTopic.value = response.data;
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error toggling solve:', err);
            return false;
        }
    }

    // Actions - Replies
    async function fetchReplies(topicId: string) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.getForumReplies(topicId);
            if (response.data) {
                // Backend returns { items, total, ... } structure for replies too
                const backendData = response.data as any;
                const rawItems = Array.isArray(backendData) ? backendData : (backendData.items || []);

                // Map backend 'user' to frontend 'author'
                replies.value = rawItems.map((item: any) => ({
                    ...item,
                    author: item.user ? { id: item.user.id, fullName: item.user.fullName } : item.author,
                    replies: item.childReplies ? item.childReplies.map((child: any) => ({
                        ...child,
                        author: child.user ? { id: child.user.id, fullName: child.user.fullName } : child.author,
                    })) : []
                }));
            } else if (response.error) {
                error.value = response.error.message;
            }
        } catch (err) {
            error.value = 'Failed to load replies';
            console.error('Error fetching replies:', err);
        } finally {
            loading.value = false;
        }
    }

    async function createReply(data: { content: string; topicId: string; parentId?: string }) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.createForumReply(data.topicId, {
                content: data.content,
                parentReplyId: data.parentId,
            });
            if (response.data) {
                const newReply = {
                    ...response.data,
                    author: (response.data as any).user ? {
                        id: (response.data as any).user.id,
                        fullName: (response.data as any).user.fullName
                    } : response.data.author
                };
                replies.value.push(newReply);
                if (currentTopic.value) {
                    currentTopic.value.replyCount++;
                }
                return newReply;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
            return null;
        } catch (err) {
            error.value = 'Failed to create reply';
            console.error('Error creating reply:', err);
            return null;
        } finally {
            loading.value = false;
        }
    }


    async function updateReply(id: string, content: string) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.updateForumReply(id, content);
            if (response.data) {
                const index = replies.value.findIndex((r) => r.id === id);
                if (index !== -1) {
                    replies.value[index] = response.data;
                }
                return response.data;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
            return null;
        } catch (err) {
            error.value = 'Failed to update reply';
            console.error('Error updating reply:', err);
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function deleteReply(id: string) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.deleteForumReply(id);
            if (response.error) {
                error.value = response.error.message;
                return false;
            }
            replies.value = replies.value.filter((r) => r.id !== id);
            if (currentTopic.value) {
                currentTopic.value.replyCount--;
            }
            return true;
        } catch (err) {
            error.value = 'Failed to delete reply';
            console.error('Error deleting reply:', err);
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function markAsSolution(id: string) {
        try {
            const response = await api.markReplyAsSolution(id);
            if (response.data) {
                const index = replies.value.findIndex((r) => r.id === id);
                if (index !== -1) {
                    replies.value[index] = {
                        ...response.data,
                        author: (response.data as any).user ? {
                            id: (response.data as any).user.id,
                            fullName: (response.data as any).user.fullName
                        } : response.data.author
                    };
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error marking as solution:', err);
            return false;
        }
    }

    // Actions - Reactions
    async function toggleReaction(targetType: 'topic' | 'reply', targetId: string, type: ReactionType) {
        try {
            const response = await api.toggleForumReaction({ targetType, targetId, reactionType: type });
            if (response.data?.success) {
                // Refresh the stats for the target
                const statsResponse = await api.getForumReactionStats(targetType, targetId);
                if (statsResponse.data) {
                    if (targetType === 'topic' && currentTopic.value?.id === targetId) {
                        currentTopic.value.reactions = statsResponse.data;
                    } else if (targetType === 'reply') {
                        const reply = replies.value.find((r) => r.id === targetId);
                        if (reply) {
                            reply.reactions = statsResponse.data;
                        }
                    }
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error toggling reaction:', err);
            return false;
        }
    }

    // Actions - Subscriptions
    async function subscribeToTopic(topicId: string) {
        try {
            const response = await api.subscribeToTopic(topicId);
            if (response.data) {
                if (currentTopic.value?.id === topicId) {
                    currentTopic.value.isSubscribed = true;
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error subscribing to topic:', err);
            return false;
        }
    }

    async function unsubscribeFromTopic(topicId: string) {
        try {
            const response = await api.unsubscribeFromTopic(topicId);
            if (!response.error) {
                if (currentTopic.value?.id === topicId) {
                    currentTopic.value.isSubscribed = false;
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error unsubscribing from topic:', err);
            return false;
        }
    }

    // Admin - Category Management
    async function createCategory(data: {
        name: string;
        description?: string;
        icon?: string;
        displayOrder?: number;
    }) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.createForumCategory(data);
            if (response.data) {
                categories.value.push(response.data);
                return response.data;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
            return null;
        } catch (err) {
            error.value = 'Kategori oluşturulamadı';
            console.error('Error creating category:', err);
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function updateCategory(
        id: string,
        data: {
            name?: string;
            description?: string;
            icon?: string;
            displayOrder?: number;
            isActive?: boolean;
        },
    ) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.updateForumCategory(id, data);
            if (response.data) {
                const index = categories.value.findIndex((c) => c.id === id);
                if (index !== -1) {
                    categories.value[index] = response.data;
                }
                return response.data;
            } else if (response.error) {
                error.value = response.error.message;
                return null;
            }
            return null;
        } catch (err) {
            error.value = 'Kategori güncellenemedi';
            console.error('Error updating category:', err);
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function deleteCategory(id: string) {
        loading.value = true;
        error.value = null;
        try {
            const response = await api.deleteForumCategory(id);
            if (response.error) {
                error.value = response.error.message;
                return false;
            }
            categories.value = categories.value.filter((c) => c.id !== id);
            return true;
        } catch (err) {
            error.value = 'Kategori silinemedi';
            console.error('Error deleting category:', err);
            return false;
        } finally {
            loading.value = false;
        }
    }

    // Utility
    function clearError() {
        error.value = null;
    }

    function resetCurrentTopic() {
        currentTopic.value = null;
        replies.value = [];
    }

    return {
        // State
        categories,
        currentCategory,
        topics,
        currentTopic,
        replies,
        topicsMeta,
        loading,
        error,

        // Getters
        activeCategories,
        pinnedTopics,
        regularTopics,

        // Actions
        fetchCategories,
        fetchCategory,
        fetchTopics,
        fetchTopic,
        createTopic,
        updateTopic,
        deleteTopic,
        togglePin,
        toggleLock,
        toggleSolve,
        fetchReplies,
        createReply,
        updateReply,
        deleteReply,
        markAsSolution,
        toggleReaction,
        subscribeToTopic,
        unsubscribeFromTopic,
        clearError,
        resetCurrentTopic,
        // Admin
        createCategory,
        updateCategory,
        deleteCategory,
    };
});
