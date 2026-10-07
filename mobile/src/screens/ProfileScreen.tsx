import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { ScreenSlideTransition } from '../components/ui/screen-transition';
import { useProfileDashboard } from '../hooks/useProfileDashboard';
import { MealJournalScreen } from './meal-journal/MealJournalScreen';
import { P, SubHeader } from './profile/ProfileUI';
import { registerConfirmSetter, type ConfirmState, type Page, type Props } from './profile/shared';
import { ProfileMain } from './profile/pages/ProfileMain';
import { SettingsPage } from './profile/pages/SettingsPage';
import { EditPage } from './profile/pages/EditPage';
import { JourneyPage } from './profile/pages/JourneyPage';
import { HealthPage } from './profile/pages/HealthPage';
import { PreferencesPage } from './profile/pages/PreferencesPage';
import { AvoidPage } from './profile/pages/AvoidPage';
import { SavedPage } from './profile/pages/SavedPage';
import { PrivacyPage } from './profile/pages/PrivacyPage';
import { HistoryPage } from './profile/pages/HistoryPage';
import { PostsPage } from './profile/pages/PostsPage';
import { FollowersPage } from './profile/pages/FollowersPage';

export function ProfileScreen(props: Props) {
  const [page, setPage] = useState<Page>('main');
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const handleOpenDish = useCallback(
    (dishId: string, title?: string) => {
      props.onDishDetail?.(dishId, title);
    },
    [props.onDishDetail],
  );

  useEffect(() => {
    registerConfirmSetter(setConfirmState);
    return () => registerConfirmSetter(null);
  }, []);

  useEffect(() => {
    if (page === 'main') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPage('main');
      return true;
    });
    return () => sub.remove();
  }, [page]);

  return (
    <>
      <View style={{ flex: 1 }}>
        <ProfileMain {...props} open={setPage} />
      </View>
      <ScreenSlideTransition visible={page !== 'main'} direction="right" onBack={() => setPage('main')}>
        {page !== 'main' ? (
          <SubScreen
            page={page}
            onBack={() => setPage('main')}
            onNavigate={setPage}
            onLoggedOut={props.onLoggedOut}
            onOpenDish={handleOpenDish}
            onOpenPost={props.onOpenPost}
            onOpenProfile={props.onOpenProfile}
          />
        ) : null}
      </ScreenSlideTransition>
      {confirmState ? (
        <ConfirmDialog
          visible={confirmState.visible}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel="Huỷ"
          tone={confirmState.tone}
          onConfirm={() => {
            const action = confirmState.onConfirm;
            setConfirmState(null);
            action();
          }}
          onCancel={() => setConfirmState(null)}
        />
      ) : null}
    </>
  );
}

const PAGE_META: Record<Exclude<Page, 'main' | 'diary'>, { title: string; sub: string }> = {
  settings: { title: 'Cài đặt', sub: 'Thông báo, giao diện và tài khoản' },
  edit: { title: 'Chỉnh sửa hồ sơ', sub: 'Ảnh đại diện và thông tin cơ bản' },
  journey: { title: 'Hành trình của bạn', sub: 'Chuỗi ngày, lịch và thành tích' },
  health: { title: 'Thông tin sức khỏe', sub: 'Chỉ số cơ thể và mục tiêu mỗi ngày' },
  preferences: { title: 'Mục tiêu & sở thích', sub: 'Giúp NOAN gợi ý đúng gu của bạn' },
  avoid: { title: 'Nguyên liệu cần tránh', sub: 'Dị ứng và những thứ bạn không ăn' },
  saved: { title: 'Món đã lưu', sub: 'Bộ sưu tập của bạn' },
  privacy: { title: 'Quyền riêng tư & bảo mật', sub: 'Phiên đăng nhập, hiển thị và dữ liệu' },
  history: { title: 'Lịch sử Random', sub: 'Những lần NOAN chọn món cho bạn' },
  posts: { title: 'Bài viết của tôi', sub: 'Đã đăng và bản nháp' },
  followers: { title: 'Kết nối', sub: 'Người theo dõi và đang theo dõi' },
  following: { title: 'Kết nối', sub: 'Người theo dõi và đang theo dõi' },
};

function SubScreen({
  page,
  onBack,
  onNavigate,
  onLoggedOut,
  onOpenDish,
  onOpenPost,
  onOpenProfile,
}: {
  page: Exclude<Page, 'main'>;
  onBack: () => void;
  onNavigate: (page: Page) => void;
  onLoggedOut?: () => void;
  onOpenDish?: (dishId: string, title?: string) => void;
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const { dash } = useProfileDashboard();

  if (page === 'diary') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'bottom']}>
        <MealJournalScreen onBack={onBack} onOpenDish={onOpenDish} />
      </SafeAreaView>
    );
  }

  const m = PAGE_META[page];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'left', 'right']}>
      <SubHeader title={m.title} subtitle={m.sub} onBack={onBack} />
      {page === 'settings' ? (
        <SettingsPage onLoggedOut={onLoggedOut} />
      ) : page === 'edit' ? (
        <EditPage />
      ) : page === 'journey' ? (
        <JourneyPage />
      ) : page === 'health' ? (
        <HealthPage onEditProfile={() => onNavigate('edit')} />
      ) : page === 'preferences' ? (
        <PreferencesPage />
      ) : page === 'avoid' ? (
        <AvoidPage />
      ) : page === 'saved' ? (
        <SavedPage onOpenDish={onOpenDish} />
      ) : page === 'privacy' ? (
        <PrivacyPage onLoggedOut={onLoggedOut} />
      ) : page === 'history' ? (
        <HistoryPage onOpenDish={onOpenDish} />
      ) : page === 'followers' || page === 'following' ? (
        <FollowersPage
          initialTab={page === 'following' ? 'following' : 'followers'}
          followerCount={dash?.socialStats.followerCount}
          followingCount={dash?.socialStats.followingCount}
          onOpenProfile={onOpenProfile}
        />
      ) : (
        <PostsPage onOpenPost={onOpenPost} />
      )}
    </SafeAreaView>
  );
}
