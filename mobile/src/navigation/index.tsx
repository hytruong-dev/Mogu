import { useEffect, useState } from "react";
import { View } from "react-native";
import { BootSkeleton } from "../components/skeletons/ScreenSkeletons";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { authApi } from "../services/api/auth";
import { getSession } from "../services/api/storage";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ExploreScreenV2 as ExploreScreen } from "../screens/ExploreScreenV2";
import { RandomFlowScreen } from "../screens/RandomFlowScreen";
import { HealthScreen } from "../screens/HealthScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { NotificationScreen } from "../screens/NotificationScreen";
import type { RootStackParamList, AuthStackParamList, MainTabParamList } from "./types";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator({ navigation }: any) {
  const handleLogin = async (username: string, password: string) => {
    const result = await authApi.login(username, password);
    navigation.replace(result.nextStep?.startsWith("onboarding") ? "Onboarding" : "Main");
  };
  const handleRegister = async (username: string, password: string) => {
    const result = await authApi.register(username, password);
    navigation.replace(result.nextStep?.startsWith("onboarding") ? "Onboarding" : "Main");
  };
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login">
        {({ navigation: n }: any) => (
          <LoginScreen onLogin={handleLogin} onRegister={() => n.navigate("Register")} />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {({ navigation: n }: any) => (
          <RegisterScreen onRegister={handleRegister} onLogin={() => n.navigate("Login")} />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

// MainNavigator: tabBar hoan toan an - man tu render LiquidGlassBottomNav
function MainNavigator({ navigation: rootNav }: any) {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <MainTab.Screen name="Home">
        {({ navigation: n }: any) => (
          <HomeScreen
            onRandom={() => n.navigate("Random")}
            onExplore={() => n.navigate("Explore")}
            onHealth={() => n.navigate("Health")}
            onProfile={() => n.navigate("Profile")}
            onNotification={() => rootNav.navigate("Notification")}
          />
        )}
      </MainTab.Screen>
      <MainTab.Screen name="Explore">
        {({ navigation: n }: any) => (
          <ExploreScreen
            onBack={() => n.navigate("Home")}
            onHealth={() => n.navigate("Health")}
            onProfile={() => n.navigate("Profile")}
            onRandom={() => n.navigate("Random")}
          />
        )}
      </MainTab.Screen>
      <MainTab.Screen name="Random">
        {({ navigation: n }: any) => <RandomFlowScreen onClose={() => n.navigate("Home")} />}
      </MainTab.Screen>
      <MainTab.Screen name="Health">
        {({ navigation: n }: any) => (
          <HealthScreen
            onHome={() => n.navigate("Home")}
            onExplore={() => n.navigate("Explore")}
            onRandom={() => n.navigate("Random")}
            onProfile={() => n.navigate("Profile")}
          />
        )}
      </MainTab.Screen>
      <MainTab.Screen name="Profile">
        {({ navigation: n }: any) => (
          <ProfileScreen
            onHome={() => n.navigate("Home")}
            onExplore={() => n.navigate("Explore")}
            onRandom={() => n.navigate("Random")}
            onHealth={() => n.navigate("Health")}
            onLoggedOut={() =>
              n.getParent()?.reset({ index: 0, routes: [{ name: "Auth" }] })
            }
          />
        )}
      </MainTab.Screen>
    </MainTab.Navigator>
  );
}

export function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>("Auth");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) { setInitialRoute("Auth"); setReady(true); return; }
      try {
        const user = await authApi.me();
        setInitialRoute(user.onboardingStatus === "COMPLETED" ? "Main" : "Onboarding");
      } catch { setInitialRoute("Auth"); } finally { setReady(true); }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFBF0" }}>
        <BootSkeleton />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false, animation: "fade" }}>
        <RootStack.Screen name="Auth" component={AuthNavigator} />
        <RootStack.Screen name="Onboarding" options={{ gestureEnabled: false }}>
          {({ navigation }: any) => <SplashScreen onFinish={() => navigation.replace("Main")} />}
        </RootStack.Screen>
        <RootStack.Screen name="Main" component={MainNavigator} />
        <RootStack.Screen name="FoodDetail" options={{ presentation: "modal", animation: "slide_from_bottom" }}>
          {({ route, navigation }: any) => {
            const { default: FoodDetailScreen } = require("../screens/FoodDetailScreen");
            return <FoodDetailScreen route={route} navigation={navigation} />;
          }}
        </RootStack.Screen>
        <RootStack.Screen name="RandomResult" options={{ presentation: "modal", animation: "slide_from_bottom" }}>
          {({ navigation }: any) => <RandomFlowScreen onClose={() => navigation.goBack()} />}
        </RootStack.Screen>
        <RootStack.Screen name="Notification" options={{ presentation: "modal", animation: "slide_from_bottom" }}>
          {({ navigation }: any) => <NotificationScreen onBack={() => navigation.goBack()} />}
        </RootStack.Screen>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}