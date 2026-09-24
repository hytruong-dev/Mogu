import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertOctagon,
  Ban,
  Bookmark,
  ChevronRight,
  Copy,
  EyeOff,
  HelpCircle,
  MessageSquare,
  MessageSquareOff,
  Pencil,
  Search,
  Share as ShareIcon,
  Trash2,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react-native';
import { Drawer } from '../../components/ui/drawer';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Button } from '../../components/ui/button';
import { AvatarImage } from '../../components/organisms/AvatarImage';
import { AppImage } from '../../components/ui/app-image';
import {
  articlesApi,
  communityApi,
  moderationApi,
  type PostVisibility,
} from '../../services/api/explore';
import { toggleDishSave } from '../../services/saved-dishes-store';
import { recordPostDeletedStore, recordPostUpdatedStore } from '../../services/app-store';
import { dishesApi } from '../../services/api/dishes';
import {
  buildContentActions,
  isOwner,
  type ActionIconName,
  type ContentAction,
  type ContentActionId,
  type ContentActionTarget,
  type ContentEntryPoint,
} from './buildContentActions';
import { AudienceSheet } from './AudienceSheet';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ContentActionTarget | null;
  entryPoint?: ContentEntryPoint;
  onRemoved?: (target: ContentActionTarget) => void;
  onUndoHide?: (target: ContentActionTarget) => void;
  onEdited?: () => void;
  onToast?: (message: string) => void;
  /** Khi có callback: SHARE bài viết mở ExploreShareSheet thay vì Share native */
  onRequestShare?: (target: ContentActionTarget) => void;
};

const REPORT_REASONS = [
  { code: 'SPAM', label: 'Spam hoặc quảng cáo' },
  { code: 'HARASSMENT', label: 'Quấy rối hoặc công kích' },
  { code: 'HATE', label: 'Nội dung thù ghét' },
  { code: 'VIOLENCE', label: 'Bạo lực hoặc nguy hiểm' },
  { code: 'NUDITY', label: 'Nội dung nhạy cảm' },
  { code: 'MISINFORMATION', label: 'Thông tin sai lệch' },
  { code: 'OTHER', label: 'Lý do khác' },
];

const ACTION_ICON_COMPONENTS: Record<ActionIconName, any> = {
  Bookmark,
  Share: ShareIcon,
  UserX,
  UserPlus,
  EyeOff,
  Ban,
  AlertOctagon,
  Search,
  HelpCircle,
  Pencil,
  Users,
  Copy,
  MessageSquareOff,
  MessageSquare,
  Trash2,
};

function contentTypeApi(kind: ContentActionTarget['kind']) {
  if (kind === 'DISH') return 'DISH';
  if (kind === 'ARTICLE') return 'ARTICLE';
  return 'COMMUNITY_POST';
}

export function ContentActionSheet({
  open,
  onOpenChange,
  target,
  entryPoint = 'FEED',
  onRemoved,
  onUndoHide,
  onEdited,
  onToast,
  onRequestShare,
}: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [whyText, setWhyText] = useState('');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [visibility, setVisibility] = useState<PostVisibility>('PUBLIC');

  const isOwnerTarget = useMemo(() => Boolean(target && isOwner(target)), [target]);

  const actions = useMemo(
    () => (target ? buildContentActions(target, entryPoint) : []),
    [target, entryPoint],
  );

  const snapHeight = useMemo(() => {
    if (!target) return 480;
    if (isOwnerTarget) return 430;
    if (target.kind === 'COMMUNITY_POST') return 510;
    return 460;
  }, [target, isOwnerTarget]);

  useEffect(() => {
    if (!open) {
      setReportOpen(false);
      setWhyOpen(false);
      setConfirmDelete(false);
      setAudienceOpen(false);
      setBusy(false);
    } else if (target?.kind === 'COMMUNITY_POST') {
      setVisibility('PUBLIC');
    }
  }, [open, target]);

  const close = () => onOpenChange(false);

  const shareOrCopy = async (mode: 'SHARE' | 'COPY_LINK') => {
    if (!target) return;
    const url =
      target.shareUrl ||
      `https://mogu.app/${target.kind === 'DISH' ? 'dishes' : target.kind === 'ARTICLE' ? 'articles' : 'posts'}/${target.id}`;
    await Share.share({ message: url, url });
    if (mode === 'COPY_LINK') onToast?.('Đã mở chia sẻ liên kết');
  };

  const runHide = async (alsoFeedback?: boolean) => {
    if (!target) return;
    await moderationApi.hide(contentTypeApi(target.kind), target.id);
    if (alsoFeedback) {
      await moderationApi.feedback({
        contentType: contentTypeApi(target.kind) as any,
        contentId: target.id,
        action: 'NOT_INTERESTED',
        rankingToken: target.rankingToken ?? undefined,
      });
    }
    onRemoved?.(target);
    onToast?.(alsoFeedback ? 'Đã ẩn · Không quan tâm' : 'Đã ẩn nội dung');
    onUndoHide?.(target);
  };

  const handleAction = useCallback(
    async (action: ContentAction) => {
      if (!target || busy) return;
      setBusy(true);
      try {
        switch (action.id as ContentActionId) {
          case 'SAVE':
            if (target.kind === 'DISH') {
              await toggleDishSave(target.id, false, {
                name: target.title ?? undefined,
                imageUrl: target.imageUrl ?? undefined,
              });
            } else if (target.kind === 'ARTICLE') {
              await articlesApi.save(target.id);
            } else {
              await communityApi.savePost(target.id);
            }
            onToast?.('Đã lưu');
            close();
            break;
          case 'UNSAVE':
            if (target.kind === 'DISH') {
              await toggleDishSave(target.id, true, {
                name: target.title ?? undefined,
                imageUrl: target.imageUrl ?? undefined,
              });
            } else if (target.kind === 'ARTICLE') {
              await articlesApi.unsave(target.id);
            } else {
              await communityApi.unsavePost(target.id);
            }
            onToast?.('Đã bỏ lưu');
            close();
            break;
          case 'SHARE':
            if (onRequestShare && (target.kind === 'ARTICLE' || target.kind === 'COMMUNITY_POST')) {
              close();
              onRequestShare(target);
            } else {
              await shareOrCopy('SHARE');
              close();
            }
            break;
          case 'COPY_LINK':
            await shareOrCopy('COPY_LINK');
            close();
            break;
          case 'FOLLOW':
            if (target.authorId) await communityApi.followUser(target.authorId);
            onToast?.('Đã theo dõi');
            close();
            break;
          case 'UNFOLLOW':
            if (target.authorId) await communityApi.unfollowUser(target.authorId);
            onToast?.('Đã bỏ theo dõi');
            close();
            break;
          case 'MORE_LIKE_THIS':
            await moderationApi.feedback({
              contentType: contentTypeApi(target.kind) as any,
              contentId: target.id,
              action: 'MORE_LIKE_THIS',
              rankingToken: target.rankingToken ?? undefined,
            });
            onToast?.('Sẽ gợi ý thêm nội dung tương tự');
            close();
            break;
          case 'LESS_LIKE_THIS':
            await moderationApi.feedback({
              contentType: contentTypeApi(target.kind) as any,
              contentId: target.id,
              action: 'LESS_LIKE_THIS',
              rankingToken: target.rankingToken ?? undefined,
            });
            onToast?.('Sẽ ít gợi ý nội dung tương tự');
            close();
            break;
          case 'HIDE':
            await runHide(false);
            close();
            break;
          case 'NOT_INTERESTED':
            await runHide(true);
            close();
            break;
          case 'WHY_THIS': {
            const res = await moderationApi.explanation(
              contentTypeApi(target.kind),
              target.id,
              target.rankingToken ?? undefined,
            );
            setWhyText(res.message || 'Vì nội dung này phù hợp với sở thích ăn uống của bạn.');
            setWhyOpen(true);
            break;
          }
          case 'REPORT':
            setReportOpen(true);
            break;
          case 'EDIT':
            onEdited?.();
            close();
            break;
          case 'CHANGE_VISIBILITY':
            setAudienceOpen(true);
            break;
          case 'TOGGLE_COMMENTS':
            await communityApi.updatePost(target.id, {
              commentsEnabled: target.commentsEnabled === false,
            });
            onToast?.(
              target.commentsEnabled === false ? 'Đã bật bình luận' : 'Đã tắt bình luận',
            );
            close();
            break;
          case 'DELETE':
            setConfirmDelete(true);
            break;
          default:
            break;
        }
      } catch (e: any) {
        onToast?.(e?.message || 'Không thực hiện được');
      } finally {
        setBusy(false);
      }
    },
    [target, busy, onToast, onEdited, onRemoved, onUndoHide, onRequestShare],
  );

  return (
    <>
      <Drawer
        open={open && !reportOpen && !whyOpen && !audienceOpen}
        onOpenChange={onOpenChange}
        snapHeight={snapHeight}
        sheetBackgroundColor="#FFFDF7"
      >
        {busy ? (
          <View style={s.centerLoading}>
            <ActivityIndicator color="#18181B" size="large" />
          </View>
        ) : (
          <View style={s.container}>
            {/* ── Header ── */}
            {isOwnerTarget ? (
              // Image 3: Centered Title for Owner Options
              <View style={s.ownerHeader}>
                <Text style={s.ownerTitle}>Tùy chọn bài viết</Text>
              </View>
            ) : target?.kind === 'COMMUNITY_POST' ? (
              // Image 1: Community Post Author Card
              <View style={s.cardHeader}>
                <AvatarImage uri={target.authorAvatarUrl} size={44} />
                <View style={s.headerMeta}>
                  <Text style={s.headerTitle} numberOfLines={1}>
                    {target.authorName || 'quanghy'}
                  </Text>
                  <Text style={s.headerSub} numberOfLines={1}>
                    Bài viết của {target.authorName || 'quanghy'}
                  </Text>
                </View>
              </View>
            ) : (
              // Image 2: Dish / Article Card
              <View style={s.cardHeader}>
                <AppImage
                  uri={target?.imageUrl}
                  style={s.dishThumb}
                  contentFit="cover"
                />
                <View style={s.headerMeta}>
                  <Text style={s.headerTitle} numberOfLines={1}>
                    {target?.title || 'Hủ tiếu Nam Vang'}
                  </Text>
                  <Text style={s.headerSub} numberOfLines={1}>
                    {target?.subtitle ||
                      (target?.kind === 'DISH' ? 'Món ăn • Mogu' : 'Bài viết • Mogu')}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Actions List ── */}
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingBottom: 6 }}
            >
              {actions.map((action, index) => {
                const IconComponent = ACTION_ICON_COMPONENTS[action.iconName] || Bookmark;
                const isDanger = action.danger;
                const iconColor = isDanger ? '#EF4444' : '#18181B';
                const textColor = isDanger ? '#EF4444' : '#18181B';

                return (
                  <View key={action.id}>
                    {action.groupDividerBefore ? <View style={s.divider} /> : null}
                    {isOwnerTarget && index > 0 ? <View style={s.thinDivider} /> : null}

                    <Pressable
                      onPress={() => void handleAction(action)}
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                    >
                      {({ pressed }) => (
                        <View
                          style={[
                            s.actionRow,
                            pressed ? s.actionRowPressed : null,
                          ]}
                        >
                          <View style={s.actionIconWrap}>
                            <IconComponent size={22} color={iconColor} strokeWidth={1.9} />
                          </View>
                          <Text
                            style={[s.actionLabel, { color: textColor }]}
                            numberOfLines={1}
                          >
                            {action.label}
                          </Text>
                          {action.hasChevron ? (
                            <View style={s.actionChevron}>
                              <ChevronRight size={18} color="#A1A1AA" strokeWidth={2} />
                            </View>
                          ) : null}
                        </View>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>

            {/* ── Cancel Button (Hủy) ── */}
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Hủy"
            >
              {({ pressed }) => (
                <View
                  style={[
                    s.cancelBtn,
                    pressed ? s.cancelBtnPressed : null,
                  ]}
                >
                  <Text style={s.cancelBtnTxt}>Hủy</Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </Drawer>

      {/* ── Report Reasons Sub-Sheet ── */}
      <Drawer
        open={reportOpen}
        onOpenChange={setReportOpen}
        snapHeight={480}
        sheetBackgroundColor="#FFFDF7"
      >
        <View style={s.ownerHeader}>
          <Text style={s.ownerTitle}>Báo cáo bài viết</Text>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 6 }}
        >
          {REPORT_REASONS.map((r, i) => (
            <View key={r.code}>
              {i > 0 && <View style={s.thinDivider} />}
              <Pressable
                onPress={() => {
                  if (!target) return;
                  void moderationApi
                    .report({
                      targetType: 'COMMUNITY_POST',
                      targetId: target.id,
                      reasonCode: r.code,
                    })
                    .then(() => {
                      onToast?.('Đã gửi báo cáo');
                      setReportOpen(false);
                      close();
                    })
                    .catch((e: any) => onToast?.(e?.message || 'Không gửi được báo cáo'));
                }}
              >
                {({ pressed }) => (
                  <View style={[s.actionRow, pressed ? s.actionRowPressed : null]}>
                    <View style={s.actionIconWrap}>
                      <AlertOctagon size={20} color="#EF4444" strokeWidth={1.8} />
                    </View>
                    <Text style={[s.actionLabel, { color: '#18181B' }]}>{r.label}</Text>
                    <View style={s.actionChevron}>
                      <ChevronRight size={18} color="#A1A1AA" />
                    </View>
                  </View>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
        <Pressable onPress={() => setReportOpen(false)}>
          {({ pressed }) => (
            <View
              style={[
                s.cancelBtn,
                { marginBottom: Math.max(insets.bottom, 12) },
                pressed ? s.cancelBtnPressed : null,
              ]}
            >
              <Text style={s.cancelBtnTxt}>Hủy</Text>
            </View>
          )}
        </Pressable>
      </Drawer>

      {/* ── Why This Recommendation Sub-Sheet ── */}
      <Drawer
        open={whyOpen}
        onOpenChange={setWhyOpen}
        snapHeight={300}
        sheetBackgroundColor="#FFFDF7"
      >
        <View style={s.ownerHeader}>
          <Text style={s.ownerTitle}>Vì sao bạn thấy nội dung này?</Text>
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 }}>
          <Text style={{ fontSize: 15, lineHeight: 22, color: '#4B5563' }}>
            {whyText}
          </Text>
          <Button
            className="mt-6 h-12 rounded-full bg-[#FFD54F]"
            onPress={() => setWhyOpen(false)}
          >
            <Text className="font-extrabold text-[#161616]">Đã hiểu</Text>
          </Button>
        </View>
      </Drawer>

      {/* ── Audience Selection Sub-Sheet ── */}
      {target?.kind === 'COMMUNITY_POST' ? (
        <AudienceSheet
          open={audienceOpen}
          value={visibility}
          onOpenChange={setAudienceOpen}
          onSelect={(v) => {
            setVisibility(v);
            void communityApi
              .updatePost(target.id, { visibility: v })
              .then((updated) => {
                if (updated) recordPostUpdatedStore(updated as any);
                onToast?.('Đã cập nhật đối tượng xem');
                close();
              })
              .catch((e: any) => onToast?.(e?.message || 'Không cập nhật được'));
          }}
        />
      ) : null}

      {/* ── Confirmation Dialog for Delete ── */}
      <ConfirmDialog
        visible={confirmDelete}
        title="Xóa bài viết?"
        description="Bài viết sẽ bị xóa vĩnh viễn khỏi cộng đồng Mogu. Bạn không thể hoàn tác thao tác này."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        tone="danger"
        loading={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!target) return;
          setBusy(true);
          void communityApi
            .deletePost(target.id)
            .then(() => {
              recordPostDeletedStore(target.id);
              onRemoved?.(target);
              onToast?.('Đã xóa bài viết');
              setConfirmDelete(false);
              close();
            })
            .catch((e: any) => onToast?.(e?.message || 'Không xóa được'))
            .finally(() => setBusy(false));
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerLoading: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Header 1 & 2: User or Content card
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 12,
  },
  dishThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#E4E4E7',
  },
  headerMeta: {
    marginLeft: 12,
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18181B',
  },
  headerSub: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
  },
  // Header 3: Centered title for Owner
  ownerHeader: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  ownerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#18181B',
  },
  // Action rows — layout trên View (không gắn style trực tiếp lên Pressable)
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionRowPressed: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  actionIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionLabel: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15.5,
    fontWeight: '500',
  },
  actionChevron: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Dividers
  divider: {
    height: 1,
    backgroundColor: '#F0EDE6',
    marginHorizontal: 20,
    marginVertical: 6,
  },
  thinDivider: {
    height: 1,
    backgroundColor: '#F3EFE8',
    marginHorizontal: 20,
  },
  // Cancel button
  cancelBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnPressed: {
    backgroundColor: '#EAE8E1',
  },
  cancelBtnTxt: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#18181B',
  },
});
