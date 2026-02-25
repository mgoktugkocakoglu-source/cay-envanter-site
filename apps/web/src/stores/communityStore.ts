import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
    api,
    type CommunityPost,
    type CommunityTag,
    type CommunityComment,
    type CommunityPostQuery,
    type CommunityReactionType,
    type CreateCommunityPostData,
} from '@/services/api';

export const useCommunityStore = defineStore('community', () => {
    /** Feed state */
    const posts = ref<CommunityPost[]>([]);
    const nextCursor = ref<string | null>(null);
    const hasMore = ref(true);
    const userReactions = ref<Record<string, CommunityReactionType>>({});
    const feedLoading = ref(false);
    const feedError = ref<string | null>(null);

    /** Current post detail state */
    const currentPost = ref<CommunityPost | null>(null);
    const currentPostLoading = ref(false);

    /** Comments state */
    const comments = ref<CommunityComment[]>([]);
    const commentsLoading = ref(false);

    /** Tags state */
    const allTags = ref<CommunityTag[]>([]);
    const trendingTags = ref<CommunityTag[]>([]);
    const tagsLoading = ref(false);

    /** Active filters */
    const activeFilters = ref<CommunityPostQuery>({});

    /** Creating post state */
    const createPostLoading = ref(false);

    // ─── Feed Actions ───────────────────────────────────────

    async function fetchFeed(query?: CommunityPostQuery, append = false): Promise<void> {
        feedLoading.value = true;
        feedError.value = null;

        try {
            const mergedQuery = { ...activeFilters.value, ...query };
            if (append && nextCursor.value) {
                mergedQuery.cursor = nextCursor.value;
            }

            const result = await api.getCommunityFeed(mergedQuery);

            if (result.error) {
                feedError.value = result.error.message;
                return;
            }

            if (result.data) {
                if (append) {
                    posts.value = [...posts.value, ...result.data.items];
                } else {
                    posts.value = result.data.items;
                }
                nextCursor.value = result.data.nextCursor;
                hasMore.value = result.data.hasMore;

                /** Merge user reactions */
                userReactions.value = {
                    ...userReactions.value,
                    ...result.data.userReactions,
                };
            }
        } finally {
            feedLoading.value = false;
        }
    }

    async function loadMorePosts(): Promise<void> {
        if (!hasMore.value || feedLoading.value) return;
        await fetchFeed(undefined, true);
    }

    function setFilter(filter: CommunityPostQuery): void {
        activeFilters.value = filter;
        posts.value = [];
        nextCursor.value = null;
        hasMore.value = true;
        fetchFeed();
    }

    function clearFilters(): void {
        activeFilters.value = {};
        posts.value = [];
        nextCursor.value = null;
        hasMore.value = true;
        fetchFeed();
    }

    // ─── Post CRUD ──────────────────────────────────────────

    async function createPost(data: CreateCommunityPostData): Promise<CommunityPost | null> {
        createPostLoading.value = true;
        try {
            const result = await api.createCommunityPost(data);
            if (result.error) {
                feedError.value = result.error.message;
                return null;
            }
            if (result.data) {
                posts.value = [result.data, ...posts.value];
                return result.data;
            }
            return null;
        } finally {
            createPostLoading.value = false;
        }
    }

    async function fetchPostDetail(postId: string): Promise<void> {
        currentPostLoading.value = true;
        try {
            const result = await api.getCommunityPost(postId);
            if (result.data) {
                currentPost.value = result.data;
            }
        } finally {
            currentPostLoading.value = false;
        }
    }

    async function deletePost(postId: string): Promise<boolean> {
        const result = await api.deleteCommunityPost(postId);
        if (!result.error) {
            posts.value = posts.value.filter((post) => post.id !== postId);
            return true;
        }
        return false;
    }

    // ─── Reactions ──────────────────────────────────────────

    async function toggleReaction(
        targetType: 'post' | 'comment',
        targetId: string,
        reactionType: CommunityReactionType,
    ): Promise<void> {
        const result = await api.toggleCommunityReaction({ targetType, targetId, reactionType });
        if (!result.data) return;

        const { action, reactionType: resultType } = result.data;

        if (targetType === 'post') {
            updatePostReaction(targetId, action, resultType, reactionType);
        } else {
            updateCommentReaction(targetId, action, resultType, reactionType);
        }
    }

    function updatePostReaction(
        postId: string,
        action: string,
        resultType: CommunityReactionType,
        clickedType: CommunityReactionType,
    ): void {
        const post = posts.value.find((p) => p.id === postId) ?? currentPost.value;
        if (!post) return;

        if (action === 'added') {
            if (resultType === 'like') post.likeCount++;
            else post.dislikeCount++;
            userReactions.value[postId] = resultType;
        } else if (action === 'removed') {
            if (clickedType === 'like') post.likeCount = Math.max(0, post.likeCount - 1);
            else post.dislikeCount = Math.max(0, post.dislikeCount - 1);
            delete userReactions.value[postId];
        } else if (action === 'switched') {
            if (resultType === 'like') {
                post.likeCount++;
                post.dislikeCount = Math.max(0, post.dislikeCount - 1);
            } else {
                post.dislikeCount++;
                post.likeCount = Math.max(0, post.likeCount - 1);
            }
            userReactions.value[postId] = resultType;
        }
    }

    function updateCommentReaction(
        commentId: string,
        action: string,
        resultType: CommunityReactionType,
        clickedType: CommunityReactionType,
    ): void {
        const comment = comments.value.find((c) => c.id === commentId);
        if (!comment) return;

        if (action === 'added') {
            if (resultType === 'like') comment.likeCount++;
            else comment.dislikeCount++;
        } else if (action === 'removed') {
            if (clickedType === 'like') comment.likeCount = Math.max(0, comment.likeCount - 1);
            else comment.dislikeCount = Math.max(0, comment.dislikeCount - 1);
        } else if (action === 'switched') {
            if (resultType === 'like') {
                comment.likeCount++;
                comment.dislikeCount = Math.max(0, comment.dislikeCount - 1);
            } else {
                comment.dislikeCount++;
                comment.likeCount = Math.max(0, comment.likeCount - 1);
            }
        }
    }

    // ─── Comments ───────────────────────────────────────────

    async function fetchComments(postId: string): Promise<void> {
        commentsLoading.value = true;
        try {
            const result = await api.getCommunityComments(postId);
            if (result.data) {
                comments.value = result.data;
            }
        } finally {
            commentsLoading.value = false;
        }
    }

    async function addComment(postId: string, content: string): Promise<CommunityComment | null> {
        const result = await api.createCommunityComment(postId, content);
        if (result.data) {
            comments.value = [...comments.value, result.data];
            /** Update comment count on the post */
            const post = posts.value.find((p) => p.id === postId) ?? currentPost.value;
            if (post) post.commentCount++;
            return result.data;
        }
        return null;
    }

    async function deleteComment(commentId: string, postId: string): Promise<boolean> {
        const result = await api.deleteCommunityComment(commentId);
        if (!result.error) {
            comments.value = comments.value.filter((c) => c.id !== commentId);
            const post = posts.value.find((p) => p.id === postId) ?? currentPost.value;
            if (post) post.commentCount = Math.max(0, post.commentCount - 1);
            return true;
        }
        return false;
    }

    // ─── Tags ───────────────────────────────────────────────

    async function fetchAllTags(): Promise<void> {
        tagsLoading.value = true;
        try {
            const result = await api.getCommunityTags();
            if (result.data) {
                allTags.value = result.data;
            }
        } finally {
            tagsLoading.value = false;
        }
    }

    async function fetchTrendingTags(): Promise<void> {
        const result = await api.getTrendingTags(10);
        if (result.data) {
            trendingTags.value = result.data;
        }
    }

    // ─── Media Upload ───────────────────────────────────────

    async function uploadMedia(file: File): Promise<string | null> {
        const result = await api.uploadCommunityMedia(file);
        if (result.data) {
            return result.data.url;
        }
        return null;
    }

    // ─── Reset ──────────────────────────────────────────────

    function resetFeed(): void {
        posts.value = [];
        nextCursor.value = null;
        hasMore.value = true;
        userReactions.value = {};
        feedError.value = null;
        activeFilters.value = {};
    }

    return {
        /** State */
        posts,
        nextCursor,
        hasMore,
        userReactions,
        feedLoading,
        feedError,
        currentPost,
        currentPostLoading,
        comments,
        commentsLoading,
        allTags,
        trendingTags,
        tagsLoading,
        activeFilters,
        createPostLoading,

        /** Actions */
        fetchFeed,
        loadMorePosts,
        setFilter,
        clearFilters,
        createPost,
        fetchPostDetail,
        deletePost,
        toggleReaction,
        fetchComments,
        addComment,
        deleteComment,
        fetchAllTags,
        fetchTrendingTags,
        uploadMedia,
        resetFeed,
    };
});
