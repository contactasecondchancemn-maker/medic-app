import React from 'react';
import { Pressable, PressableProps, View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

type Elevation = 'flat' | 'raised' | 'floating';

interface CardProps extends ViewProps {
  elevation?: Elevation;
  onPress?: PressableProps['onPress'];
  padding?: boolean;
}

export function Card({ elevation = 'raised', onPress, padding = true, style, children, ...props }: CardProps) {
  const { colors, radius, spacing } = useTheme();

  const shadowByElevation: Record<Elevation, object> = {
    flat: {},
    raised: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    floating: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 6,
    },
  };

  const baseStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: elevation === 'flat' ? 1 : 0,
    borderColor: colors.border,
    padding: padding ? spacing.lg : 0,
    overflow: 'hidden' as const,
    ...shadowByElevation[elevation],
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [baseStyle, { opacity: pressed ? 0.85 : 1 }, style]}
        {...(props as PressableProps)}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[baseStyle, style]} {...props}>
      {children}
    </View>
  );
}
