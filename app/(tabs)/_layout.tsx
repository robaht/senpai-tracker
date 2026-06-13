import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { fonts, useTheme } from '../../src/theme';
import { withAlpha } from '../../src/components/ui/Badge';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: [
          styles.tabBar,
          {
            borderTopColor: colors.border,
            // Translucent tint so the blur reads underneath on native; solid on web.
            backgroundColor:
              Platform.OS === 'web'
                ? colors.bgDeep
                : withAlpha(colors.bg, isDark ? 0.62 : 0.8),
          },
        ],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarBackground:
          Platform.OS === 'web'
            ? undefined
            : () => (
                <BlurView
                  intensity={40}
                  tint={isDark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
              ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'bookmark' : 'bookmark-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === 'ios' ? 86 : 68,
    paddingTop: 8,
    elevation: 0,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    marginTop: 2,
  },
  item: {
    paddingTop: 4,
  },
});
