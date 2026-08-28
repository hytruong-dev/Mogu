import './global.css';
import './src/lib/nativewind-interop';
import { useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator } from 'react-native';
import { Home, Compass, Shuffle, Heart, User } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SplashScreen } from './src/screens/SplashScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { RandomFlowScreen } from './src/screens/RandomFlowScreen';
import { ExploreScreenV2 as ExploreScreen } from './src/screens/ExploreScreenV2';
import { HealthScreen } from './src/screens/HealthScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { NotificationScreen } from './src/screens/NotificationScreen';
import FoodDetailScreen from './src/screens/FoodDetailScreen';

import { WeeklyPlanScreen } from './src/screens/WeeklyPlanScreen';
import { EditPlanScreen } from './src/screens/EditPlanScreen';

import { authApi } from './src/services/api/auth';
import { getSession } from './src/services/api/storage';

// ── Param lists ──────────────────────────────────────────────────────────────

type RootParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  Notification: undefined;
  FoodDetail: { dishId: string; title?: string };
  WeeklyPlan: undefined;
  EditPlan: undefined;
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
      navigation.replace(result.nextStep?.startsWith('onboarding') ? 'Onboarding' : 'Main');
    },
    [navigation],
  );

  const handleRegister = useCallback(
    async (username: string, password: string) => {
      const result = await authApi.register(username, password);
      navigation.replace(result.nextStep?.startsWith('onboarding') ? 'Onboarding' : 'Main');
    },
    [navigation],
  );

  return (
    <AuthNav.Navigator screenOptions={{ headerShown: false }}>
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
          <HomeScreen
            onRandom={() => tabNav.navigate('Random')}
            onExplore={() => tabNav.navigate('Explore')}
            onHealth={() => tabNav.navigate('Health')}
            onProfile={() => tabNav.navigate('Profile')}
            onNotification={() => navigation.navigate('Notification')}
            onWeeklyPlan={() => navigation.navigate('WeeklyPlan')}
            onEditPlan={() => navigation.navigate('EditPlan')}
          />
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
          <ExploreScreen
            onBack={() => tabNav.navigate('Home')}
            onHealth={() => tabNav.navigate('Health')}
            onProfile={() => tabNav.navigate('Profile')}
            onRandom={() => tabNav.navigate('Random')}
          />
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
          <RandomFlowScreen onClose={() => tabNav.navigate('Home')} />
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
          <HealthScreen
            onHome={() => tabNav.navigate('Home')}
            onExplore={() => tabNav.navigate('Explore')}
            onRandom={() => tabNav.navigate('Random')}
            onProfile={() => tabNav.navigate('Profile')}
          />
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
          <ProfileScreen
            onHome={() => tabNav.navigate('Home')}
            onExplore={() => tabNav.navigate('Explore')}
            onRandom={() => tabNav.navigate('Random')}
            onHealth={() => tabNav.navigate('Health')}
          />
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
        component={FoodDetailScreen}
      />
      <Root.Screen
        name="Notification"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      >
        {({ navigation }) => (
          <NotificationScreen onBack={() => navigation.goBack()} />
        )}
      </Root.Screen>

      <Root.Screen
        name="WeeklyPlan"
        options={{ animation: 'slide_from_right' }}
      >
        {({ navigation }) => (
          <WeeklyPlanScreen
            onBack={() => navigation.goBack()}
            onEditPlan={() => navigation.navigate('EditPlan')}
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
            onSave={() => navigation.goBack()}
          />
        )}
      </Root.Screen>
    </Root.Navigator>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
