import { apiRequest } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExploreTopic {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  articleCount: number;
}

export interface ExploreArticle {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverImageUrl: string | null;
  readMinutes: number;
  viewCount: number;
  createdAt: string;
  author: { userId: string; displayName: string | null; avatarUrl: string | null };
  topic: { id: string; title: string; slug: string } | null;
  tags: string[];
}

export interface ExplorePost {
  id: string;
  content: string;
  imageUrls: string[];
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  createdAt: string;
  author: { userId: string; displayName: string | null; avatarUrl: string | null };
}

export interface ExploreFeedResponse {
  topics: ExploreTopic[];
  featuredArticle: ExploreArticle | null;
  recentPosts: ExplorePost[];
}

export interface ArticleListResponse {
  data: ExploreArticle[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PostListResponse {
  data: ExplorePost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  author: { userId: string; displayName: string | null; avatarUrl: string | null };
}

// ─── Explore Feed API ────────────────────────────────────────────────────────

export const exploreApi = {
  /**
   * GET /v1/explore/feed
   * Trả về topics, bài viết nổi bật, posts cộng đồng cho tab "Dành cho bạn"
   */
  getFeed: (): Promise<ExploreFeedResponse> =>
    apiRequest<ExploreFeedResponse>('/explore/feed'),
};

// ─── Articles API ─────────────────────────────────────────────────────────────

export const articlesApi = {
  /**
   * GET /v1/articles
   */
  list: (params?: { topicId?: string; tag?: string; q?: string; cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.topicId) query.set('topicId', params.topicId);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.q) query.set('q', params.q);
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<ArticleListResponse>(`/articles${qs ? `?${qs}` : ''}`);
  },

  /**
   * GET /v1/articles/:id
   */
  findOne: (id: string): Promise<ExploreArticle & { content: string }> =>
    apiRequest(`/articles/${id}`),
};

// ─── Community API ─────────────────────────────────────────────────────────────

export const communityApi = {
  /**
   * GET /v1/community/posts
   */
  listPosts: (params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<PostListResponse>(`/community/posts${qs ? `?${qs}` : ''}`);
  },

  /**
   * POST /v1/community/posts
   */
  createPost: (data: { content: string; imageUrls?: string[] }): Promise<ExplorePost> =>
    apiRequest('/community/posts', { method: 'POST', body: JSON.stringify(data) }),

  /**
   * DELETE /v1/community/posts/:id
   */
  deletePost: (id: string) =>
    apiRequest(`/community/posts/${id}`, { method: 'DELETE' }),

  /**
   * POST /v1/community/posts/:id/like — toggle
   */
  toggleLike: (postId: string): Promise<{ liked: boolean }> =>
    apiRequest(`/community/posts/${postId}/like`, { method: 'POST' }),

  /**
   * GET /v1/community/posts/:id/comments
   */
  listComments: (postId: string): Promise<PostComment[]> =>
    apiRequest(`/community/posts/${postId}/comments`),

  /**
   * POST /v1/community/posts/:id/comments
   */
  addComment: (postId: string, content: string): Promise<PostComment> =>
    apiRequest(`/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  /**
   * DELETE /v1/community/posts/:id/comments/:commentId
   */
  deleteComment: (postId: string, commentId: string): Promise<{ deleted: boolean }> =>
    apiRequest(`/community/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
};

// ─── Topics API (public list) ─────────────────────────────────────────────────

export const topicsApi = {
  /**
   * GET /v1/topics — public list
   */
  list: (): Promise<Omit<ExploreTopic, 'articleCount'>[]> =>
    apiRequest('/topics'),
};
