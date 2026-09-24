import type { PostViewerCapabilities } from '../../services/api/explore';

export type ContentKind = 'DISH' | 'ARTICLE' | 'COMMUNITY_POST';
export type ContentEntryPoint = 'FEED' | 'DETAIL';

export type ContentActionId =
  | 'SAVE'
  | 'UNSAVE'
  | 'SHARE'
  | 'COPY_LINK'
  | 'FOLLOW'
  | 'UNFOLLOW'
  | 'MORE_LIKE_THIS'
  | 'LESS_LIKE_THIS'
  | 'NOT_INTERESTED'
  | 'HIDE'
  | 'WHY_THIS'
  | 'REPORT'
  | 'EDIT'
  | 'CHANGE_VISIBILITY'
  | 'TOGGLE_COMMENTS'
  | 'DELETE';

export type ActionIconName =
  | 'Bookmark'
  | 'Share'
  | 'UserX'
  | 'UserPlus'
  | 'EyeOff'
  | 'Ban'
  | 'AlertOctagon'
  | 'Search'
  | 'HelpCircle'
  | 'Pencil'
  | 'Users'
  | 'Copy'
  | 'MessageSquareOff'
  | 'MessageSquare'
  | 'Trash2';

export type ContentAction = {
  id: ContentActionId;
  label: string;
  iconName: ActionIconName;
  hasChevron?: boolean;
  destructive?: boolean;
  danger?: boolean;
  groupDividerBefore?: boolean;
};

export type ContentActionTarget = {
  kind: ContentKind;
  id: string;
  title?: string | null;
  subtitle?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  imageUrl?: string | null;
  shareUrl?: string | null;
  isSaved?: boolean;
  isFollowingAuthor?: boolean;
  commentsEnabled?: boolean;
  viewerCapabilities?: Partial<PostViewerCapabilities> | null;
  rankingToken?: string | null;
  reasonCode?: string | null;
};

export function isOwner(target: ContentActionTarget): boolean {
  return Boolean(target.viewerCapabilities?.canEdit || target.viewerCapabilities?.canDelete);
}

export function buildContentActions(
  target: ContentActionTarget,
  _entryPoint: ContentEntryPoint = 'FEED',
): ContentAction[] {
  // ── Món ăn & Bài viết (Explore Sheet — Image 2) ──
  if (target.kind === 'DISH' || target.kind === 'ARTICLE') {
    return [
      {
        id: target.isSaved ? 'UNSAVE' : 'SAVE',
        label: target.isSaved ? 'Bỏ lưu nội dung' : 'Lưu nội dung',
        iconName: 'Bookmark',
        hasChevron: true,
      },
      {
        id: 'SHARE',
        label: 'Chia sẻ',
        iconName: 'Share',
        hasChevron: true,
      },
      {
        id: 'MORE_LIKE_THIS',
        label: 'Hiển thị thêm nội dung tương tự',
        iconName: 'Search',
        hasChevron: true,
        groupDividerBefore: true,
      },
      {
        id: 'LESS_LIKE_THIS',
        label: 'Ít nội dung như thế này',
        iconName: 'Ban',
        hasChevron: true,
      },
      {
        id: 'WHY_THIS',
        label: 'Vì sao bạn thấy nội dung này?',
        iconName: 'HelpCircle',
        hasChevron: true,
      },
    ];
  }

  // ── Bài đăng chính chủ (Owner Options — Image 3) ──
  if (isOwner(target)) {
    return [
      {
        id: 'EDIT',
        label: 'Chỉnh sửa bài viết',
        iconName: 'Pencil',
        hasChevron: true,
      },
      {
        id: 'CHANGE_VISIBILITY',
        label: 'Đổi đối tượng xem',
        iconName: 'Users',
        hasChevron: true,
      },
      {
        id: 'COPY_LINK',
        label: 'Sao chép liên kết',
        iconName: 'Copy',
        hasChevron: true,
      },
      {
        id: 'TOGGLE_COMMENTS',
        label: target.commentsEnabled === false ? 'Bật bình luận' : 'Tắt bình luận',
        iconName: target.commentsEnabled === false ? 'MessageSquare' : 'MessageSquareOff',
        hasChevron: true,
      },
      {
        id: 'DELETE',
        label: 'Xóa bài viết',
        iconName: 'Trash2',
        danger: true,
        destructive: true,
        hasChevron: true,
      },
    ];
  }

  // ── Bài đăng của người khác (Community Post Options — Image 1) ──
  const authorName = target.authorName ? target.authorName.trim() : '';

  return [
    {
      id: target.isSaved ? 'UNSAVE' : 'SAVE',
      label: target.isSaved ? 'Bỏ lưu bài viết' : 'Lưu bài viết',
      iconName: 'Bookmark',
    },
    {
      id: 'SHARE',
      label: 'Chia sẻ',
      iconName: 'Share',
    },
    {
      id: target.isFollowingAuthor ? 'UNFOLLOW' : 'FOLLOW',
      label: target.isFollowingAuthor
        ? authorName
          ? `Bỏ theo dõi ${authorName}`
          : 'Bỏ theo dõi'
        : authorName
          ? `Theo dõi ${authorName}`
          : 'Theo dõi',
      iconName: target.isFollowingAuthor ? 'UserX' : 'UserPlus',
    },
    {
      id: 'HIDE',
      label: 'Ẩn bài viết',
      iconName: 'EyeOff',
      groupDividerBefore: true,
    },
    {
      id: 'NOT_INTERESTED',
      label: 'Không quan tâm',
      iconName: 'Ban',
    },
    {
      id: 'REPORT',
      label: 'Báo cáo bài viết',
      iconName: 'AlertOctagon',
      danger: true,
      destructive: true,
    },
  ];
}
