import './global.css';
import './src/lib/nativewind-interop';
import { useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, LogBox, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

LogBox.ignoreAllLogs();
import { Home, Compass, Shuffle, Heart, User } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/lib/query-client';

import { SplashScreen } from './src/screens/SplashScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { RandomFlowScreen } from './src/screens/RandomFlowScreen';
import { ExploreScreenV2 as ExploreScreen } from './src/screens/ExploreScreenV2';
import { HealthScreen } from './src/screens/HealthScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { NotificationScreen } from './src/screens/NotificationScreen';
import DishDetailLoaderScreen from './src/screens/DishDetailLoaderScreen';
import { DayIngredientsScreen } from './src/screens/DayIngredientsScreen';
import { WeeklyGroceryScreen } from './src/screens/WeeklyGroceryScreen';
import { CommunityPostDetailScreen } from './src/screens/CommunityPostDetailScreen';
import { ExploreDetailScreen } from './src/screens/ExploreDetailScreen';
import { PublicProfileScreen } from './src/screens/explore/PublicProfileScreen';

import { WeeklyPlanScreen } from './src/screens/WeeklyPlanScreen';
import { EditPlanScreen } from './src/screens/EditPlanScreen';
import { ScreenFadeTransition } from './src/components/ui/screen-transition';
import { InAppNotificationBanner } from './src/components/organisms/InAppNotificationBanner';
import { notificationRealtime } from './src/services/notification-realtime';
import { registerPushNotificationsAsync } from './src/lib/push-notifications';
import { syncCurrentMealReminders } from './src/lib/meal-reminders';
import { navigationRef, handleDeepLink } from './src/lib/deep-link';
import type { NotificationItem } from './src/services/api/types';

import { authApi } from './src/services/api/auth';
import { getSession } from './src/services/api/storage';

// ── Param lists ──────────────────────────────────────────────────────────────

type RootParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: { screen?: string } | undefined;
  Notification: undefined;
  FoodDetail: { dishId: string; title?: string; mealLabel?: string };
  WeeklyPlan: { planId?: string } | undefined;
  EditPlan: undefined;
  DayIngredients: { planId: string; date: string; title?: string };
  WeeklyGrocery: { planId: string };
  PostDetail: { postId: string };
  ArticleDetail: { articleId: string };
  PublicProfile: { userId: string };
};

type AuthParamList = {
  Login: undefined;
  Register: undefined;
};

type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Random: undefined;
  Health: undefined;
  Profile: undefined;
};

const Root = createNativeStackNavigator<RootParamList>();
const AuthNav = createNativeStackNavigator<AuthParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// ── Loading ──────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDFAF3' }}>
      <ActivityIndicator size="large" color="#FFD83E" />
      <Text style={{ marginTop: 16, color: '#4E4A43', fontSize: 15 }}>Đang tải...</Text>
    </View>
  );
}

// ── Auth Stack ───────────────────────────────────────────────────────────────

function AuthNavigator({ navigation }: { navigation: any }) {
  const handleLogin = useCallback(
    async (username: string, password: string) => {
      const result = await authApi.login(username, password);
      void notificationRealtime.connectSocket();
      void registerPushNotificationsAsync();
      navigation.replace(result.nextStep?.startsWith('onboarding') ? 'Onboarding' : 'Main');
    },
    [navigation],
  );

  const handleRegister = useCallback(
    async (username: string, password: string) => {
      const result = await authApi.register(username, password);
      void notificationRealtime.connectSocket();
      void registerPushNotificationsAsync();
      navigation.replace(result.nextStep?.startsWith('onboarding') ? 'Onboarding' : 'Main');
    },
    [navigation],
  );

  return (
    <AuthNav.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <AuthNav.Screen name="Login">
        {({ navigation: authNav }) => (
          <LoginScreen
            onRegister={() => authNav.navigate('Register')}
            onLogin={handleLogin}
          />
        )}
      </AuthNav.Screen>
      <AuthNav.Screen name="Register">
        {({ navigation: authNav }) => (
          <RegisterScreen
            onLogin={() => authNav.navigate('Login')}
            onRegister={handleRegister}
          />
        )}
      </AuthNav.Screen>
    </AuthNav.Navigator>
  );
}

// ── Main Tabs ────────────────────────────────────────────────────────────────

const ICON_SIZE = 24;

function MainNavigator({ navigation }: { navigation: any }) {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <MainTab.Screen
        name="Home"
        options={{
          tabBarLabel: 'Trang chủ',
          tabBarIcon: ({ color }) => <Home size={ICON_SIZE} color={color} />,
        }}
      >
        {({ navigation: tabNav }) => (
          <ScreenFadeTransition>
            <HomeScreen
              onRandom={() => tabNav.navigate('Random')}
              onExplore={() => tabNav.navigate('Explore')}
              onHealth={() => tabNav.navigate('Health')}
              onProfile={() => tabNav.navigate('Profile')}
              onNotification={() => navigation.navigate('Notification')}
              onWeeklyPlan={() => navigation.navigate('WeeklyPlan')}
              onEditPlan={() => navigation.navigate('EditPlan')}
            />
          </ScreenFadeTransition>
        )}
      </MainTab.Screen>

      <MainTab.Screen
        name="Explore"
        options={{
          tabBarLabel: 'Khám phá',
          tabBarIcon: ({ color }) => <Compass size={ICON_SIZE} color={color} />,
        }}
      >
        {({ navigation: tabNav }) => (
          <ScreenFadeTransition>
            <ExploreScreen
              onBack={() => tabNav.navigate('Home')}
              onHealth={() => tabNav.navigate('Health')}
              onProfile={() => tabNav.navigate('Profile')}
              onRandom={() => tabNav.navigate('Random')}
            />
          </ScreenFadeTransition>
        )}
      </MainTab.Screen>

      <MainTab.Screen
        name="Random"
        options={{
          tabBarLabel: 'Ngẫu nhiên',
          tabBarIcon: ({ color }) => <Shuffle size={ICON_SIZE} color={color} />,
        }}
      >
        {({ navigation: tabNav }) => (
          <ScreenFadeTransition>
            <RandomFlowScreen onClose={() => tabNav.navigate('Home')} />
          </ScreenFadeTransition>
        )}
      </MainTab.Screen>

      <MainTab.Screen
        name="Health"
        options={{
          tabBarLabel: 'Sức khoẻ',
          tabBarIcon: ({ color }) => <Heart size={ICON_SIZE} color={color} />,
        }}
      >
        {({ navigation: tabNav }) => (
          <ScreenFadeTransition>
            <HealthScreen
              onHome={() => tabNav.navigate('Home')}
              onExplore={() => tabNav.navigate('Explore')}
              onRandom={() => tabNav.navigate('Random')}
              onProfile={() => tabNav.navigate('Profile')}
            />
          </ScreenFadeTransition>
        )}
      </MainTab.Screen>

      <MainTab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Hồ sơ',
          tabBarIcon: ({ color }) => <User size={ICON_SIZE} color={color} />,
        }}
      >
        {({ navigation: tabNav }) => (
          <ScreenFadeTransition>
            <ProfileScreen
              onHome={() => tabNav.navigate('Home')}
              onExplore={() => tabNav.navigate('Explore')}
              onRandom={() => tabNav.navigate('Random')}
              onHealth={() => tabNav.navigate('Health')}
              onNotification={() => tabNav.getParent()?.navigate('Notification')}
              onDishDetail={(dishId, title) =>
                tabNav.getParent()?.navigate('FoodDetail', { dishId, title })
              }
              onLoggedOut={() =>
                tabNav.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] })
              }
            />
          </ScreenFadeTransition>
        )}
      </MainTab.Screen>
    </MainTab.Navigator>
  );
}

// ── Root Navigator ───────────────────────────────────────────────────────────

function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootParamList>('Auth');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        if (!session) {
          setInitialRoute('Auth');
          return;
        }
        const user = await authApi.me();
        setInitialRoute(user.onboardingStatus === 'COMPLETED' ? 'Main' : 'Onboarding');
      } catch {
        setInitialRoute('Auth');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) return <LoadingScreen />;

  return (
    <Root.Navigator
      key={initialRoute}
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Root.Screen name="Auth" component={AuthNavigator} />
      <Root.Screen name="Onboarding">
        {({ navigation }) => (
          <SplashScreen onFinish={() => navigation.replace('Main')} />
        )}
      </Root.Screen>
      <Root.Screen name="Main" component={MainNavigator} />
      <Root.Screen
        name="FoodDetail"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        component={DishDetailLoaderScreen}
      />
      <Root.Screen
        name="Notification"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      >
        {({ navigation }) => (
          <NotificationScreen
            onBack={() => navigation.goBack()}
            onOpenDeepLink={(deepLink) => handleDeepLink(deepLink)}
          />
        )}
      </Root.Screen>

      <Root.Screen
        name="PostDetail"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      >
        {({ navigation, route }: any) => (
          <CommunityPostDetailScreen
            postId={route.params?.postId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Root.Screen>

      <Root.Screen
        name="ArticleDetail"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      >
        {({ navigation, route }: any) => (
          <ExploreDetailScreen
            type="article"
            resourceId={route.params?.articleId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Root.Screen>

      <Root.Screen
        name="PublicProfile"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      >
        {({ navigation, route }: any) => (
          <PublicProfileScreen
            userId={route.params?.userId}
            onBack={() => navigation.goBack()}
            onOpenPost={(postId) => navigation.navigate('PostDetail', { postId })}
          />
        )}
      </Root.Screen>

      <Root.Screen
        name="WeeklyPlan"
        options={{ animation: 'slide_from_right' }}
      >
        {({ navigation, route }) => (
          <WeeklyPlanScreen
            initialPlanId={(route.params as any)?.planId}
            onBack={() => navigation.goBack()}
            onEditPlan={() => navigation.navigate('EditPlan')}
            onOpenDish={(dishId, title, mealLabel) =>
              navigation.navigate('FoodDetail', { dishId, title, mealLabel })
            }
            onOpenIngredients={(planId, date, title) =>
              navigation.navigate('DayIngredients', { planId, date, title })
            }
            onOpenWeeklyGrocery={(planId) =>
              navigation.navigate('WeeklyGrocery', { planId })
            }
          />
        )}
      </Root.Screen>

      <Root.Screen
        name="DayIngredients"
        options={{ animation: 'slide_from_right' }}
      >
        {({ navigation, route }) => (
          <DayIngredientsScreen
            planId={route.params.planId}
            date={route.params.date}
            title={route.params.title}
            onBack={() => navigation.goBack()}
          />
        )}
      </Root.Screen>

      <Root.Screen
        name="WeeklyGrocery"
        options={{ animation: 'slide_from_right' }}
      >
        {({ navigation, route }) => (
          <WeeklyGroceryScreen
            planId={route.params.planId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Root.Screen>

      <Root.Screen
        name="EditPlan"
        options={{ animation: 'slide_from_right' }}
      >
        {({ navigation }) => (
          <EditPlanScreen
            onBack={() => navigation.goBack()}
            onReset={() => {}}
            onSave={() => {}}
            onOpenWeeklyPlan={(planId) => {
              navigation.replace('WeeklyPlan', { planId });
            }}
            onGoHome={() => {
              navigation.navigate('Main');
            }}
            onViewDishes={() => {
              navigation.navigate('Main');
            }}
          />
        )}
      </Root.Screen>
    </Root.Navigator>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  useEffect(() => {
    void notificationRealtime.init();
    void registerPushNotificationsAsync();
    void syncCurrentMealReminders();

    // Configure global notification presentation and interaction listener
    if (!(Platform.OS === 'android' && isRunningInExpoGo())) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Notifications = require('expo-notifications');
        if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
          });
        }

        const subscription = Notifications.addNotificationResponseReceivedListener?.(
          (response: any) => {
            const data = response?.notification?.request?.content?.data;
            if (data?.type === 'meal_reminder') {
              if (navigationRef.isReady()) {
                navigationRef.navigate(
                  'WeeklyPlan',
                  data.planId ? { planId: data.planId } : undefined,
                );
              }
              return;
            }
            if (data?.deepLink) {
              handleDeepLink(data.deepLink);
              return;
            }
            if (navigationRef.isReady()) {
              navigationRef.navigate('Notification');
            }
          },
        );

        // Check if app was opened by tapping a notification while closed
        Notifications.getLastNotificationResponseAsync?.()
          .then((response: any) => {
            if (!response) return;
            const data = response?.notification?.request?.content?.data;
            if (data?.type === 'meal_reminder') {
              if (navigationRef.isReady()) {
                navigationRef.navigate(
                  'WeeklyPlan',
                  data.planId ? { planId: data.planId } : undefined,
                );
              }
              return;
            }
            if (data?.deepLink) {
              handleDeepLink(data.deepLink);
            }
          })
          .catch(() => null);

        return () => {
          subscription?.remove?.();
        };
      } catch (err) {
        if (__DEV__) {
          console.warn('[App] failed to initialize Notifications listeners:', err);
        }
      }
    }
  }, []);

  const handleOpenNotification = useCallback((notif: NotificationItem) => {
    if (notif.deepLink) {
      handleDeepLink(notif.deepLink);
      return;
    }
    if (navigationRef.isReady()) {
      navigationRef.navigate('Notification');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <NavigationContainer ref={navigationRef}>
            <RootNavigator />
          </NavigationContainer>
          <InAppNotificationBanner onPressNotification={handleOpenNotification} />
          <PortalHost />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
