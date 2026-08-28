import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// ─── Root Stack ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  FoodDetail: { dishId: string; title?: string };
  RandomResult: { dishId?: string };
  Notification: undefined;
};

// ─── Auth Stack ───────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Random: undefined;
  Health: undefined;
  Profile: undefined;
};

// ─── Screen Props Helpers ─────────────────────────────────────────────────────
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;
