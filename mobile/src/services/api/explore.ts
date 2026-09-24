import { apiRequest } from './client';

export interface ExploreTopic {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
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
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  shareUrl?: string;
  createdAt: string;
  author: { userId: string; displayName: string | null; avatarUrl: string | null };
  topic: { id: string; title: string; slug: string } | null;
  tags: string[];
}

export interface ArticleComment {
  id: string;
  content: string;
  parentCommentId?: string | null;
  createdAt: string;
  author: { userId: string; displayName: string | null; avatarUrl: string | null };
  likeCount?: number;
  isLiked?: boolean;
}

export type PostVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

export interface PostViewerCapabilities {
  canEdit: boolean;
  canDelete: boolean;
  canReport: boolean;
  canComment: boolean;
  canChangeVisibility: boolean;
}

export interface ExplorePostMedia {
  id: string;
  url: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
  sortOrder?: number;
}

export interface ExplorePostDish {
  id: string;
  name: string;
  slug?: string;
  thumbnailUrl?: string | null;
  prepMinutes?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  status?: string;
}

export interface ExplorePostPlace {
  id: string;
  provider: string;
  providerPlaceId?: string | null;
  name: string;
  addressShort?: string | null;
  lat?: number | null;
  lng?: number | null;
  thumbnailUrl?: string | null;
}

export interface ExplorePost {
  id: string;
  content: string;
  imageUrls: string[];
  media?: ExplorePostMedia[];
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isFollowingAuthor?: boolean;
  visibility?: PostVisibility;
  commentsEnabled?: boolean;
  status?: string;
  createdAt: string;
  updatedAt?: string;
  author: { userId: string; displayName: string | null; avatarUrl: string | null };
  dish?: ExplorePostDish | null;
  place?: ExplorePostPlace | null;
  viewerCapabilities?: PostViewerCapabilities;
  shareUrl?: string;
}

export type ExploreFeedItem =
  | { type: 'dish'; id: string; rankingToken: string; reasonCode: string; dish: any }
  | { type: 'article'; id: string; rankingToken: string; reasonCode: string; article: ExploreArticle }
  | { type: 'post'; id: string; rankingToken: string; reasonCode: string; post: ExplorePost };

export interface ExploreFeedResponse {
  topics: ExploreTopic[];
  items?: ExploreFeedItem[];
  nextCursor?: string | null;
  hasMore?: boolean;
  feedSessionId?: string | null;
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
  parentCommentId?: string | null;
  author: { userId: string; displayName: string | null; avatarUrl: string | null };
}

export interface PlaceItem {
  id: string;
  provider: string;
  providerPlaceId?: string | null;
  name: string;
  addressShort?: string | null;
  lat?: number | null;
  lng?: number | null;
  distanceMeters?: number | null;
  thumbnailUrl?: string | null;
}

export interface CreatePostPayload {
  content: string;
  mediaIds?: string[];
  imageUrls?: string[];
  dishId?: string;
  placeId?: string;
  visibility?: PostVisibility;
  commentsEnabled?: boolean;
  status?: 'ACTIVE' | 'DRAFT';
  clientRequestId?: string;
}

export const exploreApi = {
  getFeed: (params?: {
    scope?: string;
    cursor?: string;
    limit?: number;
    feedSessionId?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.scope) query.set('scope', params.scope);
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.feedSessionId) query.set('feedSessionId', params.feedSessionId);
    const qs = query.toString();
    return apiRequest<ExploreFeedResponse>(`/explore/feed${qs ? `?${qs}` : ''}`);
  },
  recordEvents: (events: Array<{
    contentType: 'COMMUNITY_POST' | 'ARTICLE' | 'DISH';
    contentId: string;
    eventType: 'IMPRESSION' | 'OPEN_DETAIL' | 'DWELL';
    dwellMs?: number;
    rankingToken?: string;
  }>) =>
    apiRequest<{ accepted: number }>('/explore/events', {
      method: 'POST',
      body: JSON.stringify({ events }),
    }),
  trending: () =>
    apiRequest<{
      hashtags: Array<{ tag: string; postCount: number }>;
      articles: ExploreArticle[];
      posts: ExplorePost[];
      dishes: any[];
    }>('/explore/trending'),
  search: (params?: { q?: string; type?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.type) query.set('type', params.type);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return apiRequest<{
      dishes: any[];
      articles: ExploreArticle[];
      posts: ExplorePost[];
      users: Array<{ userId: string; displayName: string | null; avatarUrl: string | null; bio: string | null }>;
      limit?: number;
      offset?: number;
    }>(`/explore/search${qs ? `?${qs}` : ''}`);
  },
};

export const articlesApi = {
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
  findOne: (id: string): Promise<ExploreArticle & { content: string }> =>
    apiRequest(`/articles/${id}`),
  save: (id: string) => apiRequest(`/articles/${id}/saves/me`, { method: 'PUT' }),
  unsave: (id: string) => apiRequest(`/articles/${id}/saves/me`, { method: 'DELETE' }),
  toggleLike: (id: string): Promise<{ liked: boolean; likeCount?: number }> =>
    apiRequest(`/articles/${id}/like`, { method: 'POST' }),
  listComments: async (id: string, params?: { cursor?: string; limit?: number; sort?: string }): Promise<ArticleComment[]> => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    const res = await apiRequest<ArticleComment[] | { data: ArticleComment[]; hasMore?: boolean; nextCursor?: string | null }>(
      `/articles/${id}/comments${qs ? `?${qs}` : ''}`,
    );
    return Array.isArray(res) ? res : res.data ?? [];
  },
  addComment: (id: string, content: string, parentCommentId?: string): Promise<ArticleComment> =>
    apiRequest(`/articles/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentCommentId }),
    }),
  toggleCommentLike: (
    articleId: string,
    commentId: string,
  ): Promise<{ liked: boolean; likeCount?: number }> =>
    apiRequest(`/articles/${articleId}/comments/${commentId}/like`, { method: 'POST' }),
  deleteComment: (id: string, commentId: string) =>
    apiRequest(`/articles/${id}/comments/${commentId}`, { method: 'DELETE' }),
  listSaved: (params?: { cursor?: string; limit?: number; q?: string }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.q) query.set('q', params.q);
    const qs = query.toString();
    return apiRequest<{
      items?: Array<{ id: string; savedAt?: string; article: ExploreArticle }>;
      data?: ExploreArticle[];
      pageInfo?: { nextCursor: string | null; hasNextPage: boolean };
    }>(`/me/saved-articles${qs ? `?${qs}` : ''}`);
  },
};

export const communityApi = {
  listPosts: (params?: {
    cursor?: string;
    limit?: number;
    scope?: string;
    status?: string;
    q?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.scope) query.set('scope', params.scope);
    if (params?.status) query.set('status', params.status);
    if (params?.q) query.set('q', params.q);
    const qs = query.toString();
    return apiRequest<PostListResponse>(`/community/posts${qs ? `?${qs}` : ''}`);
  },

  createPost: (data: CreatePostPayload): Promise<ExplorePost> =>
    apiRequest('/community/posts', { method: 'POST', body: JSON.stringify(data) }),

  updatePost: (id: string, data: Partial<CreatePostPayload>): Promise<ExplorePost> =>
    apiRequest(`/community/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deletePost: (id: string) =>
    apiRequest(`/community/posts/${id}`, { method: 'DELETE' }),

  getPost: (postId: string): Promise<ExplorePost> =>
    apiRequest(`/community/posts/${postId}`),

  createMediaIntent: (data: {
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    checksum?: string;
  }) =>
    apiRequest<{
      mediaId: string;
      uploadUrl: string;
      bucket: string;
      objectKey: string;
      expiresAt: string;
    }>('/community/media/upload-intents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  finalizeMedia: (mediaId: string) =>
    apiRequest<{ id: string; status: string; publicUrl: string | null }>(
      `/community/media/${mediaId}/finalize`,
      { method: 'POST' },
    ),

  deleteMedia: (mediaId: string) =>
    apiRequest(`/community/media/${mediaId}`, { method: 'DELETE' }),

  toggleLike: (postId: string): Promise<{ liked: boolean; likeCount?: number }> =>
    apiRequest(`/community/posts/${postId}/like`, { method: 'POST' }),

  likePost: (postId: string): Promise<{ liked: boolean }> =>
    apiRequest(`/community/posts/${postId}/likes/me`, { method: 'PUT' }),

  unlikePost: (postId: string): Promise<{ liked: boolean }> =>
    apiRequest(`/community/posts/${postId}/likes/me`, { method: 'DELETE' }),

  followUser: (userId: string): Promise<{ following: boolean }> =>
    apiRequest(`/community/users/${userId}/follow/me`, { method: 'PUT' }),

  unfollowUser: (userId: string): Promise<{ following: boolean }> =>
    apiRequest(`/community/users/${userId}/follow/me`, { method: 'DELETE' }),

  getPublicProfile: (userId: string) =>
    apiRequest<{
      userId: string;
      displayName: string | null;
      avatarUrl: string | null;
      bio: string | null;
      followerCount: number;
      followingCount: number;
      postCount: number;
      isFollowing: boolean;
      isSelf: boolean;
    }>(`/community/users/${userId}`),

  listUserPosts: (userId: string, params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<PostListResponse>(
      `/community/users/${userId}/posts${qs ? `?${qs}` : ''}`,
    );
  },

  savePost: (postId: string): Promise<{ saved: boolean }> =>
    apiRequest(`/community/posts/${postId}/saves/me`, { method: 'PUT' }),

  unsavePost: (postId: string): Promise<{ saved: boolean }> =>
    apiRequest(`/community/posts/${postId}/saves/me`, { method: 'DELETE' }),

  addComment: (postId: string, content: string, parentCommentId?: string): Promise<PostComment> =>
    apiRequest(`/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentCommentId }),
    }),

  listComments: async (postId: string, params?: { cursor?: string; limit?: number; sort?: string }): Promise<PostComment[]> => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    const res = await apiRequest<PostComment[] | { data: PostComment[]; hasMore?: boolean; nextCursor?: string | null }>(
      `/community/posts/${postId}/comments${qs ? `?${qs}` : ''}`,
    );
    return Array.isArray(res) ? res : res.data ?? [];
  },

  deleteComment: (postId: string, commentId: string): Promise<{ deleted: boolean }> =>
    apiRequest(`/community/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),

  listSavedPosts: (params?: { cursor?: string; limit?: number; q?: string }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.q) query.set('q', params.q);
    const qs = query.toString();
    return apiRequest<{
      items?: Array<{ id: string; savedAt?: string; post: ExplorePost }>;
      data?: ExplorePost[];
      pageInfo?: { nextCursor: string | null; hasNextPage: boolean };
    }>(`/me/saved-posts${qs ? `?${qs}` : ''}`);
  },
};

export const placesApi = {
  search: (params?: { q?: string; lat?: number; lng?: number; cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.lat != null) query.set('lat', String(params.lat));
    if (params?.lng != null) query.set('lng', String(params.lng));
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<{ data: PlaceItem[]; nextCursor: string | null; hasMore: boolean }>(
      `/places/search${qs ? `?${qs}` : ''}`,
    );
  },
  resolve: (data: {
    provider: string;
    providerPlaceId?: string;
    name: string;
    addressShort?: string;
    lat?: number;
    lng?: number;
    thumbnailUrl?: string;
  }) =>
    apiRequest<PlaceItem>('/places/resolve', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const moderationApi = {
  reportReasons: (targetType?: string) => {
    const qs = targetType ? `?targetType=${encodeURIComponent(targetType)}` : '';
    return apiRequest<{ reasons: Array<{ code: string; label: string }> }>(
      `/moderation/report-reasons${qs}`,
    );
  },
  report: (data: {
    targetType: 'COMMUNITY_POST' | 'COMMENT' | 'USER';
    targetId: string;
    reasonCode: string;
    note?: string;
  }) =>
    apiRequest<{ reportId: string; status: string }>('/moderation/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  hide: (contentType: string, contentId: string) =>
    apiRequest(`/me/hidden-content/${contentType}/${contentId}`, { method: 'PUT' }),
  unhide: (contentType: string, contentId: string) =>
    apiRequest(`/me/hidden-content/${contentType}/${contentId}`, { method: 'DELETE' }),
  feedback: (data: {
    contentType: 'COMMUNITY_POST' | 'DISH' | 'ARTICLE';
    contentId: string;
    action: 'NOT_INTERESTED' | 'MORE_LIKE_THIS' | 'LESS_LIKE_THIS' | 'HIDE_AUTHOR' | 'WHY_THIS';
    rankingToken?: string;
  }) =>
    apiRequest('/recommendation-feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  explanation: (contentType: string, contentId: string, rankingToken?: string) => {
    const qs = rankingToken ? `?rankingToken=${encodeURIComponent(rankingToken)}` : '';
    return apiRequest<{ reasonCode: string; message: string }>(
      `/recommendations/explanations/${contentType}/${contentId}${qs}`,
    );
  },
};

export const topicsApi = {
  list: (): Promise<Omit<ExploreTopic, 'articleCount'>[]> => apiRequest('/topics'),
  getFeed: (slug: string, params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<{
      topic?: ExploreTopic;
      data?: ExploreArticle[];
      items?: Array<{ type?: string; article?: ExploreArticle } | ExploreArticle>;
      nextCursor?: string | null;
      hasMore?: boolean;
    }>(`/topics/${encodeURIComponent(slug)}/feed${qs ? `?${qs}` : ''}`);
  },
};

/** Saved collections under /me/* */
export const meApi = {
  listSavedPosts: (params?: { cursor?: string; limit?: number; q?: string }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.q) query.set('q', params.q);
    const qs = query.toString();
    return apiRequest<{
      items?: Array<{ id: string; savedAt?: string; post: ExplorePost }>;
      data?: ExplorePost[];
      pageInfo?: { nextCursor: string | null; hasNextPage: boolean };
      nextCursor?: string | null;
      hasMore?: boolean;
    }>(`/me/saved-posts${qs ? `?${qs}` : ''}`);
  },
  listSavedArticles: (params?: { cursor?: string; limit?: number; q?: string }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.q) query.set('q', params.q);
    const qs = query.toString();
    return apiRequest<{
      items?: Array<{ id: string; savedAt?: string; article: ExploreArticle }>;
      data?: ExploreArticle[];
      pageInfo?: { nextCursor: string | null; hasNextPage: boolean };
      nextCursor?: string | null;
      hasMore?: boolean;
    }>(`/me/saved-articles${qs ? `?${qs}` : ''}`);
  },
};
