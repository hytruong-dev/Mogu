import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityService } from '../community/community.service';

const SESSION_TTL_MS = 15 * 60 * 1000;
const APP_BASE =
  process.env.PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://mogu.app';

type RankedCandidate = {
  type: 'article' | 'post';
  id: string;
  rankingToken: string;
  reasonCode: string;
  score: number;
  authorKey: string;
  topicKey: string;
  article?: any;
  post?: any;
};

@Injectable()
export class ExploreService {
  private readonly logger = new Logger(ExploreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly community: CommunityService,
  ) {}

  private cleanupExpiredSessions() {
    this.prisma.db.exploreFeedSession
      .deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
      .catch((err) => {
        this.logger.warn(`Failed to cleanup expired feed sessions: ${err}`);
      });
  }

  private recencyScore(createdAt: Date | string): number {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageDays = Math.max(0, ageMs / (24 * 60 * 60 * 1000));
    return Math.exp(-ageDays / 7);
  }

  private diversify(items: RankedCandidate[]): RankedCandidate[] {
    const remaining = [...items];
    const out: RankedCandidate[] = [];
    while (remaining.length) {
      let picked = -1;
      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i];
        const last2 = out.slice(-2);
        const sameAuthor =
          last2.length === 2 &&
          last2.every((x) => x.authorKey && x.authorKey === cand.authorKey);
        const sameTopic =
          last2.length === 2 &&
          cand.topicKey &&
          last2.every((x) => x.topicKey && x.topicKey === cand.topicKey);
        if (!sameAuthor && !sameTopic) {
          picked = i;
          break;
        }
      }
      if (picked < 0) picked = 0;
      out.push(remaining.splice(picked, 1)[0]);
    }
    return out;
  }

  private async loadRankingSignals(userId: string) {
    const [feedback, events] = await Promise.all([
      this.prisma.db.recommendationFeedback.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { contentType: true, contentId: true, action: true },
      }),
      this.prisma.db.exploreEngagementEvent
        .findMany({
          where: {
            userId,
            eventType: { in: ['OPEN', 'DWELL', 'LIKE', 'SAVE', 'IMPRESSION'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 300,
          select: { contentType: true, contentId: true, eventType: true, dwellMs: true },
        })
        .catch(() => []),
    ]);

    const notInterested = new Set<string>();
    const moreLike = new Set<string>();
    const affinityAuthors = new Set<string>();
    const affinityTopics = new Set<string>();

    for (const f of feedback) {
      const key = `${f.contentType}:${f.contentId}`;
      if (f.action === 'NOT_INTERESTED' || f.action === 'LESS_LIKE_THIS') {
        notInterested.add(key);
      }
      if (f.action === 'MORE_LIKE_THIS') {
        moreLike.add(key);
      }
    }

    // Derive topic/author affinity from MORE_LIKE_THIS targets
    const moreArticleIds = [...moreLike]
      .filter((k) => k.startsWith('ARTICLE:'))
      .map((k) => k.split(':')[1]);
    const morePostIds = [...moreLike]
      .filter((k) => k.startsWith('COMMUNITY_POST:'))
      .map((k) => k.split(':')[1]);

    const engagedContent = new Set<string>();
    const engagedAuthors = new Set<string>();
    for (const e of events) {
      const weight =
        e.eventType === 'DWELL' && (e.dwellMs ?? 0) >= 3000
          ? 2
          : e.eventType === 'OPEN' || e.eventType === 'LIKE' || e.eventType === 'SAVE'
            ? 2
            : 1;
      if (weight >= 2) {
        engagedContent.add(`${e.contentType}:${e.contentId}`);
      }
    }

    const engagedArticleIds = [...engagedContent]
      .filter((k) => k.includes('ARTICLE'))
      .map((k) => k.split(':').pop()!);

    // Chạy song song truy vấn chi tiết bài viết và bài đăng để tăng tốc
    const [artsFromMore, postsFromMore, artsFromEngaged] = await Promise.all([
      moreArticleIds.length
        ? this.prisma.db.article.findMany({
            where: { id: { in: moreArticleIds } },
            select: { authorId: true, topicId: true },
          })
        : [],
      morePostIds.length
        ? this.prisma.db.communityPost.findMany({
            where: { id: { in: morePostIds } },
            select: { authorId: true },
          })
        : [],
      engagedArticleIds.length
        ? this.prisma.db.article.findMany({
            where: { id: { in: engagedArticleIds.slice(0, 50) } },
            select: { authorId: true, topicId: true },
          })
        : [],
    ]);

    for (const a of artsFromMore) {
      if (a.authorId) affinityAuthors.add(a.authorId);
      if (a.topicId) affinityTopics.add(a.topicId);
    }
    for (const p of postsFromMore) {
      if (p.authorId) affinityAuthors.add(p.authorId);
    }
    for (const a of artsFromEngaged) {
      if (a.authorId) engagedAuthors.add(a.authorId);
      if (a.topicId) affinityTopics.add(a.topicId);
    }

    return {
      notInterested,
      moreLike,
      affinityAuthors,
      affinityTopics,
      engagedContent,
      engagedAuthors,
    };
  }

  private scoreItem(
    kind: 'article' | 'post',
    raw: any,
    signals: Awaited<ReturnType<ExploreService['loadRankingSignals']>>,
  ): { score: number; reasonCode: string } {
    const contentType = kind === 'article' ? 'ARTICLE' : 'COMMUNITY_POST';
    const key = `${contentType}:${raw.id}`;
    let score = this.recencyScore(raw.createdAt) * 40;
    score += Math.min(25, Math.log10((raw.likeCount ?? 0) + 1) * 12);
    score += Math.min(15, Math.log10((raw.viewCount ?? raw.commentCount ?? 0) + 1) * 8);

    let reasonCode = kind === 'article' ? 'POPULAR' : 'COMMUNITY';

    if (signals.notInterested.has(key)) {
      score -= 80;
    }
    if (signals.moreLike.has(key)) {
      score += 35;
      reasonCode = 'MORE_LIKE_THIS';
    }

    const authorId = raw.author?.userId ?? raw.authorId;
    const topicId = raw.topic?.id ?? raw.topicId ?? null;

    if (
      (authorId && signals.affinityAuthors.has(authorId)) ||
      (topicId && signals.affinityTopics.has(topicId)) ||
      signals.engagedContent.has(key) ||
      (authorId && signals.engagedAuthors.has(authorId))
    ) {
      score += 20;
      if (reasonCode !== 'MORE_LIKE_THIS') reasonCode = 'TOPIC_AFFINITY';
    }

    if (kind === 'article' && (raw.likeCount ?? 0) >= 10 && reasonCode === 'POPULAR') {
      reasonCode = 'POPULAR';
    }

    return { score, reasonCode };
  }

  async getFeed(
    userId: string,
    opts?: { scope?: string; cursor?: string; limit?: number; feedSessionId?: string },
  ): Promise<{
    topics: any[];
    items: any[];
    nextCursor: string | null;
    hasMore: boolean;
    feedSessionId: string | null;
    featuredArticle: any;
    recentPosts: any[];
  }> {
    const scope = (opts?.scope ?? 'forYou').toLowerCase();
    const limit = Math.min(Number(opts?.limit) || 20, 40);

    const [topics, hidden] = await Promise.all([
      this.prisma.db.topic.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          coverImageUrl: true,
          _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
        },
      }),
      this.prisma.db.hiddenContent.findMany({
        where: { userId },
        select: { contentType: true, contentId: true },
      }),
    ]);

    const topicsOut = topics.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      coverImageUrl: t.coverImageUrl,
      articleCount: t._count.articles,
    }));

    const hiddenArticle = new Set(
      hidden.filter((h) => h.contentType === 'ARTICLE').map((h) => h.contentId),
    );
    const hiddenPost = new Set(
      hidden.filter((h) => h.contentType === 'COMMUNITY_POST').map((h) => h.contentId),
    );

    if (scope === 'following') {
      const posts = await this.community.listPosts(
        { limit, cursor: opts?.cursor, scope: 'FOLLOWING' },
        userId,
      );
      const items = posts.data.map((p: any) => ({
        type: 'post' as const,
        id: p.id,
        rankingToken: `following:${p.id}`,
        reasonCode: 'FOLLOWING',
        post: p,
      }));
      return {
        topics: topicsOut,
        items,
        nextCursor: posts.nextCursor,
        hasMore: posts.hasMore,
        feedSessionId: null,
        featuredArticle: null,
        recentPosts: posts.data.slice(0, 5),
      };
    }

    let sessionId = opts?.feedSessionId;
    let articleItems: any[] = [];
    let postItems: any[] = [];
    let allItems: any[] = [];

    let dbSession: any = null;
    if (sessionId) {
      dbSession = await this.prisma.db.exploreFeedSession.findUnique({
        where: { id: sessionId },
      });
      if (
        dbSession &&
        (!dbSession.userId || dbSession.userId === userId) &&
        new Date(dbSession.expiresAt).getTime() > Date.now()
      ) {
        allItems = (dbSession.itemKeys as any[]) || [];
        articleItems = allItems.filter((i: any) => i.type === 'article');
        postItems = allItems.filter((i: any) => i.type === 'post');
      } else {
        dbSession = null;
      }
    }

    if (!dbSession) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);

      const [freshArticles, trendingArticles, postsRes, trendingPosts, articleLikes, signals] =
        await Promise.all([
          // Fresh articles (60)
          this.prisma.db.article.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: [{ createdAt: 'desc' }],
            take: 60,
            select: {
              id: true,
              slug: true,
              title: true,
              summary: true,
              coverImageUrl: true,
              readMinutes: true,
              viewCount: true,
              likeCount: true,
              commentCount: true,
              createdAt: true,
              authorId: true,
              topicId: true,
              author: { select: { userId: true, displayName: true, avatarUrl: true } },
              topic: { select: { id: true, title: true, slug: true } },
              tags: { select: { tag: true } },
            },
          }),
          // Trending articles in last 7 days (30)
          this.prisma.db.article.findMany({
            where: { status: 'PUBLISHED', createdAt: { gte: sevenDaysAgo } },
            orderBy: [{ likeCount: 'desc' }, { viewCount: 'desc' }],
            take: 30,
            select: {
              id: true,
              slug: true,
              title: true,
              summary: true,
              coverImageUrl: true,
              readMinutes: true,
              viewCount: true,
              likeCount: true,
              commentCount: true,
              createdAt: true,
              authorId: true,
              topicId: true,
              author: { select: { userId: true, displayName: true, avatarUrl: true } },
              topic: { select: { id: true, title: true, slug: true } },
              tags: { select: { tag: true } },
            },
          }),
          // Fresh community posts (60)
          this.community.listPosts({ limit: 60, scope: 'FOR_YOU' }, userId),
          // Trending posts in last 7 days (30)
          this.prisma.db.communityPost.findMany({
            where: { status: 'ACTIVE', visibility: 'PUBLIC', createdAt: { gte: sevenDaysAgo } },
            orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }],
            take: 30,
            include: {
              author: { select: { userId: true, displayName: true, avatarUrl: true } },
              tags: { select: { tag: true } },
            },
          }),
          this.prisma.db.articleLike.findMany({
            where: { userId },
            select: { articleId: true },
          }),
          this.loadRankingSignals(userId),
        ]);

      // Deduplicate articles
      const articleMap = new Map<string, any>();
      for (const a of freshArticles) articleMap.set(a.id, a);
      for (const a of trendingArticles) articleMap.set(a.id, a);
      const combinedArticles = [...articleMap.values()];

      // Deduplicate posts
      const postMap = new Map<string, any>();
      for (const p of postsRes.data ?? []) postMap.set(p.id, p);
      for (const p of trendingPosts ?? []) postMap.set(p.id, p);
      const combinedPosts = [...postMap.values()];

      const likedArticleIds = new Set(articleLikes.map((l) => l.articleId));

      const rankedArticles: RankedCandidate[] = combinedArticles
        .filter((a) => !hiddenArticle.has(a.id))
        .map((a) => {
          const { score, reasonCode } = this.scoreItem('article', a, signals);
          return {
            type: 'article' as const,
            id: a.id,
            rankingToken: `article:${a.id}`,
            reasonCode,
            score,
            authorKey: a.author?.userId ?? a.authorId,
            topicKey: a.topic?.id ?? a.topicId ?? '',
            article: this.formatArticle(a, likedArticleIds.has(a.id)),
          };
        })
        .filter((c) => c.score > -50);

      const rankedPosts: RankedCandidate[] = combinedPosts
        .filter((p: any) => !hiddenPost.has(p.id))
        .map((p: any) => {
          const { score, reasonCode } = this.scoreItem('post', p, signals);
          // Set real topicKey from hashtag, dishId, or placeId
          const topicKey =
            p.tags?.[0]?.tag ??
            (p.dishId ? `dish:${p.dishId}` : p.placeId ? `place:${p.placeId}` : '');
          return {
            type: 'post' as const,
            id: p.id,
            rankingToken: `post:${p.id}`,
            reasonCode,
            score,
            authorKey: p.author?.userId ?? '',
            topicKey,
            post: p,
          };
        })
        .filter((c: RankedCandidate) => c.score > -50);

      // Score-sort within type, then interleave 1:1, then diversity pass
      rankedArticles.sort((a, b) => b.score - a.score);
      rankedPosts.sort((a, b) => b.score - a.score);

      const interleaved: RankedCandidate[] = [];
      const max = Math.max(rankedArticles.length, rankedPosts.length);
      for (let i = 0; i < max; i++) {
        if (rankedArticles[i]) interleaved.push(rankedArticles[i]);
        if (rankedPosts[i]) interleaved.push(rankedPosts[i]);
      }
      allItems = this.diversify(interleaved).map(
        ({ score: _s, authorKey: _a, topicKey: _t, ...rest }) => rest,
      );

      articleItems = allItems.filter((i) => i.type === 'article');
      postItems = allItems.filter((i) => i.type === 'post');

      sessionId = randomUUID();
      await this.prisma.db.exploreFeedSession.create({
        data: {
          id: sessionId,
          userId,
          itemKeys: allItems as any,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      });
      this.cleanupExpiredSessions();
    }

    const keys: string[] = allItems.map((it) => `${it.type}:${it.id}`);
    let start = 0;
    if (opts?.cursor) {
      const idx = keys.findIndex((k) => k === opts.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const pageKeys = keys.slice(start, start + limit);
    const byKey = new Map(allItems.map((it) => [`${it.type}:${it.id}`, it]));
    const page = pageKeys.map((k) => byKey.get(k)).filter(Boolean);
    const hasMore = start + limit < keys.length;
    const nextCursor = hasMore ? pageKeys[pageKeys.length - 1] ?? null : null;

    // Featured article: Ưu tiên bài viết được ghim (isPinned=true), nếu không có thì lấy top 1 bài viết đã chấm điểm
    const pinnedArticle = await this.prisma.db.article.findFirst({
      where: { status: 'PUBLISHED', isPinned: true },
      orderBy: [{ featuredAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverImageUrl: true,
        readMinutes: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        author: { select: { userId: true, displayName: true, avatarUrl: true } },
        topic: { select: { id: true, title: true, slug: true } },
        tags: { select: { tag: true } },
      },
    });

    const isPinnedLiked = pinnedArticle
      ? await this.prisma.db.articleLike
          .findUnique({
            where: { articleId_userId: { articleId: pinnedArticle.id, userId } },
          })
          .then(Boolean)
      : false;

    const featuredArticle = pinnedArticle
      ? this.formatArticle(pinnedArticle, isPinnedLiked)
      : articleItems[0]?.article ?? null;

    return {
      topics: topicsOut,
      items: page,
      nextCursor,
      hasMore,
      feedSessionId: sessionId ?? null,
      featuredArticle,
      recentPosts: postItems.slice(0, 5).map((p: any) => p.post),
    };
  }

  private formatArticle(a: any, isLiked = false) {
    return {
      ...a,
      tags: a.tags?.map((t: any) => (typeof t === 'string' ? t : t.tag)) ?? [],
      isLiked,
      shareUrl: `${APP_BASE}/explore/articles/${a.slug || a.id}`,
    };
  }

  async getTrending(userId?: string) {
    const [hashtags, articles, posts, dishes] = await Promise.all([
      this.community.trendingHashtags(10),
      this.prisma.db.article.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ likeCount: 'desc' }, { viewCount: 'desc' }],
        take: 5,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          coverImageUrl: true,
          readMinutes: true,
          likeCount: true,
          viewCount: true,
          createdAt: true,
        },
      }),
      this.prisma.db.communityPost.findMany({
        where: { status: 'ACTIVE', visibility: 'PUBLIC' },
        orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }],
        take: 5,
        include: {
          author: { select: { userId: true, displayName: true, avatarUrl: true } },
          tags: { select: { tag: true } },
        },
      }),
      this.prisma.db.dish.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ ratingCount: 'desc' }, { ratingAvg: 'desc' }],
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          priceMin: true,
          priceMax: true,
          ratingAvg: true,
          ratingCount: true,
          media: {
            where: { isPrimary: true },
            take: 1,
            select: { storageKey: true, bucket: true },
          },
        },
      }),
    ]);

    return {
      hashtags,
      articles,
      posts,
      dishes,
    };
  }

  async recordEvents(
    userId: string,
    events: Array<{
      contentType: string;
      contentId: string;
      eventType: string;
      dwellMs?: number;
      rankingToken?: string;
    }>,
  ) {
    const rows = (events ?? []).slice(0, 50).map((e) => ({
      userId,
      contentType: e.contentType.toUpperCase(),
      contentId: e.contentId,
      eventType: e.eventType.toUpperCase(),
      dwellMs: typeof e.dwellMs === 'number' ? e.dwellMs : null,
      rankingToken: e.rankingToken ?? null,
    }));
    if (!rows.length) return { accepted: 0 };
    try {
      const res = await this.prisma.db.exploreEngagementEvent.createMany({
        data: rows,
        skipDuplicates: true,
      });
      return { accepted: res.count };
    } catch (err) {
      this.logger.warn(`Failed to record engagement events: ${err}`);
      return { accepted: 0 };
    }
  }

  async search(
    userId: string,
    opts: { q?: string; type?: string; limit?: number; offset?: number },
  ) {
    const q = (opts.q ?? '').trim();
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 40);
    const offset = Math.max(opts.offset ?? 0, 0);
    const type = (opts.type ?? 'all').toLowerCase();
    if (!q) {
      return { dishes: [], articles: [], posts: [], users: [], limit, offset };
    }

    const [dishes, articles, posts, users] = await Promise.all([
      type === 'all' || type === 'dish'
        ? this.searchDishes(q, limit, offset)
        : Promise.resolve([]),
      type === 'all' || type === 'article'
        ? this.searchArticles(q, limit, offset)
        : Promise.resolve([]),
      type === 'all' || type === 'post'
        ? this.searchPosts(q, limit, offset, userId)
        : Promise.resolve([]),
      type === 'all' || type === 'user'
        ? this.searchUsers(q, limit, offset)
        : Promise.resolve([]),
    ]);

    return { dishes, articles, posts, users, limit, offset };
  }

  private async searchDishes(q: string, limit: number, offset: number) {
    try {
      const rows = await this.prisma.db.$queryRaw<{ id: string }[]>`
        SELECT id FROM dishes
        WHERE status = 'PUBLISHED'
          AND deleted_at IS NULL
          AND (
            unaccent(COALESCE(search_text, '')) ILIKE '%' || unaccent(${q.toLowerCase()}) || '%'
            OR unaccent(name) ILIKE '%' || unaccent(${q.toLowerCase()}) || '%'
            OR unaccent(name) % unaccent(${q.toLowerCase()})
          )
        ORDER BY
          similarity(unaccent(name), unaccent(${q.toLowerCase()})) DESC,
          published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const items = await this.prisma.db.dish.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          slug: true,
          prepMinutes: true,
          priceMin: true,
          priceMax: true,
          media: {
            where: { isPrimary: true },
            take: 1,
            select: { storageKey: true, bucket: true },
          },
        },
      });
      const byId = new Map(items.map((i) => [i.id, i]));
      return ids.map((id) => byId.get(id)).filter(Boolean);
    } catch {
      return this.prisma.db.dish.findMany({
        where: {
          status: 'PUBLISHED',
          name: { contains: q, mode: 'insensitive' },
        },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          slug: true,
          prepMinutes: true,
          priceMin: true,
          priceMax: true,
          media: {
            where: { isPrimary: true },
            take: 1,
            select: { storageKey: true, bucket: true },
          },
        },
      });
    }
  }

  private async searchArticles(q: string, limit: number, offset: number) {
    try {
      const rows = await this.prisma.db.$queryRaw<{ id: string }[]>`
        SELECT id FROM articles
        WHERE status = 'PUBLISHED'
          AND (
            unaccent(title) ILIKE '%' || unaccent(${q.toLowerCase()}) || '%'
            OR unaccent(COALESCE(summary, '')) ILIKE '%' || unaccent(${q.toLowerCase()}) || '%'
            OR unaccent(title) % unaccent(${q.toLowerCase()})
          )
        ORDER BY
          similarity(unaccent(title), unaccent(${q.toLowerCase()})) DESC,
          created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const items = await this.prisma.db.article.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          coverImageUrl: true,
          readMinutes: true,
          createdAt: true,
        },
      });
      const byId = new Map(items.map((i) => [i.id, i]));
      return ids.map((id) => byId.get(id)).filter(Boolean);
    } catch {
      return this.prisma.db.article.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { summary: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        skip: offset,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          coverImageUrl: true,
          readMinutes: true,
          createdAt: true,
        },
      });
    }
  }

  private async searchUsers(q: string, limit: number, offset: number) {
    try {
      const rows = await this.prisma.db.$queryRaw<{ userId: string }[]>`
        SELECT user_id as "userId" FROM profiles
        WHERE account_status = 'ACTIVE'
          AND (
            unaccent(COALESCE(display_name, '')) ILIKE '%' || unaccent(${q.toLowerCase()}) || '%'
            OR unaccent(COALESCE(display_name, '')) % unaccent(${q.toLowerCase()})
          )
        ORDER BY
          similarity(unaccent(COALESCE(display_name, '')), unaccent(${q.toLowerCase()})) DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      if (!rows.length) return [];
      const ids = rows.map((r) => r.userId);
      const items = await this.prisma.db.profile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, displayName: true, avatarUrl: true, bio: true },
      });
      const byId = new Map(items.map((i) => [i.userId, i]));
      return ids.map((id) => byId.get(id)).filter(Boolean);
    } catch {
      return this.prisma.db.profile.findMany({
        where: {
          displayName: { contains: q, mode: 'insensitive' },
          accountStatus: 'ACTIVE',
        },
        take: limit,
        skip: offset,
        select: { userId: true, displayName: true, avatarUrl: true, bio: true },
      });
    }
  }

  private async searchPosts(q: string, limit: number, offset: number, userId: string) {
    try {
      const rows = await this.prisma.db.$queryRaw<{ id: string }[]>`
        SELECT id FROM community_posts
        WHERE status = 'ACTIVE'
          AND visibility = 'PUBLIC'
          AND (
            unaccent(content) ILIKE '%' || unaccent(${q.toLowerCase()}) || '%'
            OR unaccent(content) % unaccent(${q.toLowerCase()})
          )
        ORDER BY
          similarity(unaccent(content), unaccent(${q.toLowerCase()})) DESC,
          created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const items = await this.prisma.db.communityPost.findMany({
        where: { id: { in: ids } },
        include: {
          author: { select: { userId: true, displayName: true, avatarUrl: true } },
          tags: { select: { tag: true } },
        },
      });
      const byId = new Map(items.map((i) => [i.id, i]));
      return ids.map((id) => byId.get(id)).filter(Boolean);
    } catch {
      return this.community.listPosts({ q, limit, scope: 'FOR_YOU' }, userId).then((r) => r.data);
    }
  }
}
