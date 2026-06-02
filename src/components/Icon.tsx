import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme';

// Feather is the primary icon set — clean, consistent weight, great coverage.
type FeatherName = React.ComponentProps<typeof Feather>['name'];

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  name: FeatherName;
  size?: Size;
  color?: string;
  onPress?: PressableProps['onPress'];
  hitSlop?: PressableProps['hitSlop'];
}

const sizeMap: Record<Size, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export function Icon({ name, size = 'md', color, onPress, hitSlop = 8 }: IconProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.text;
  const resolvedSize = sizeMap[size];

  const icon = <Feather name={name} size={resolvedSize} color={resolvedColor} />;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={hitSlop}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        {icon}
      </Pressable>
    );
  }

  return icon;
}
