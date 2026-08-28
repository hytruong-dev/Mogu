import { BlurView } from 'expo-blur';
import { Pressable, Text, View } from 'react-native';
import { Compass, HeartPulse, Home, Sparkles, UserRound } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export type MainTab = 'home' | 'explore' | 'random' | 'health' | 'profile';

type Props = {
  active: MainTab;
  onHome?: () => void;
  onExplore?: () => void;
  onRandom?: () => void;
  onHealth?: () => void;
  onProfile?: () => void;
};

const tabs = [
  { key: 'home', label: 'Trang chủ', icon: Home },
  { key: 'explore', label: 'Khám phá', icon: Compass },
  { key: 'random', label: 'Random', icon: Sparkles },
  { key: 'health', label: 'Sức khỏe', icon: HeartPulse },
  { key: 'profile', label: 'Cá nhân', icon: UserRound },
] as const;

export function LiquidGlassBottomNav({ active, ...actions }: Props) {
  const callbacks: Record<MainTab, (() => void) | undefined> = {
    home: actions.onHome,
    explore: actions.onExplore,
    random: actions.onRandom,
    health: actions.onHealth,
    profile: actions.onProfile,
  };

  return (
    <View className="absolute left-4 right-4 bottom-3" pointerEvents="box-none">
      {/* Shadow shell */}
      <View
        className="h-[92px] rounded-[32px]"
        style={{
          shadowColor: '#5B4312',
          shadowOpacity: 0.12,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
          backgroundColor: 'rgba(255,255,255,0.48)',
        }}
      >
        {/* Glass */}
        <BlurView
          intensity={32}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          className="flex-1 rounded-[32px] overflow-visible"
          style={{
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.72)',
            backgroundColor: 'rgba(255,255,255,0.42)',
          }}
        >
          {/* Top reflection */}
          <View
            className="absolute left-[18px] right-[18px] top-px h-px"
            style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
          />

          {/* Tab row */}
          <View className="flex-1 flex-row items-center px-[7px]">
            {tabs.map(({ key, label, icon: Icon }) => {
              const selected = active === key;
              const isRandom = key === 'random';

              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  onPress={callbacks[key]}
                  className={cn(
                    'flex-1 min-w-14 min-h-14 items-center justify-center',
                    isRandom && 'pt-0.5',
                  )}
                  style={({ pressed }) => [
                    pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
                  ]}
                >
                  {isRandom ? (
                    /* Floating orb for Random tab */
                    <View
                      className="w-[68px] h-[68px] rounded-full p-1 items-center justify-center"
                      style={{
                        marginTop: -31,
                        backgroundColor: 'rgba(255,255,255,0.55)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.8)',
                        shadowColor: '#F5BD18',
                        shadowOpacity: 0.28,
                        shadowRadius: 18,
                        shadowOffset: { width: 0, height: 7 },
                        elevation: 9,
                      }}
                    >
                      <BlurView
                        intensity={24}
                        tint="light"
                        className="flex-1 rounded-[30px] overflow-hidden"
                      >
                        <View
                          className="flex-1 rounded-[30px] items-center justify-center"
                          style={{ backgroundColor: 'rgba(255,213,79,0.9)' }}
                        >
                          {/* Highlight */}
                          <View
                            className="absolute w-[22px] h-[9px] rounded-lg left-3 top-[7px]"
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.58)',
                              transform: [{ rotate: '-18deg' }],
                            }}
                          />
                          <Icon size={27} color="#161616" strokeWidth={2} />
                        </View>
                      </BlurView>
                    </View>
                  ) : (
                    /* Standard tab */
                    <View
                      className="w-12 h-[38px] rounded-[19px] items-center justify-center"
                      style={
                        selected
                          ? {
                              backgroundColor: 'rgba(255,220,104,0.24)',
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.78)',
                              shadowColor: '#F5BD18',
                              shadowOpacity: 0.2,
                              shadowRadius: 11,
                              shadowOffset: { width: 0, height: 3 },
                              elevation: 2,
                            }
                          : undefined
                      }
                    >
                      <Icon
                        size={24}
                        color={selected ? '#161616' : '#777A82'}
                        strokeWidth={selected ? 2 : 1.8}
                        fill={selected ? '#FFD54F' : 'transparent'}
                      />
                    </View>
                  )}

                  <Text
                    className={cn(
                      'mt-0.5',
                      selected
                        ? 'text-[13px] font-semibold text-mogu-ink'
                        : 'text-xs font-medium text-[#777A82]',
                    )}
                    style={{ lineHeight: 16 }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}
