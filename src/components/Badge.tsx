import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';
type Size = 'sm' | 'md';

interface BadgeProps extends ViewProps {
  label: string;
  variant?: Variant;
  size?: Size;
  dot?: boolean;
}

export function Badge({ label, variant = 'primary', size = 'md', dot = false, style, ...props }: BadgeProps) {
  const { colors, radius, spacing } = useTheme();

  const variantColors: Record<Variant, { bg: string; text: string }> = {
    primary:   { bg: colors.primary + '1A',   text: colors.primary },
    secondary: { bg: colors.secondary + '1A', text: colors.secondary },
    success:   { bg: colors.success + '1A',   text: colors.success },
    error:     { bg: colors.error + '1A',     text: colors.error },
    warning:   { bg: colors.warning + '1A',   text: colors.warning },
    info:      { bg: colors.info + '1A',      text: colors.info },
    neutral:   { bg: colors.border,           text: colors.textSecondary },
  };

  const vc = variantColors[variant];
  const paddingH = size === 'sm' ? spacing.xs : spacing.sm;
  const paddingV = size === 'sm' ? 2 : spacing.xs;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          backgroundColor: vc.bg,
          borderRadius: radius.full,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          gap: spacing.xs,
        },
        style,
      ]}
      {...props}
    >
      {dot && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: radius.full,
            backgroundColor: vc.text,
          }}
        />
      )}
      <Text variant={size === 'sm' ? 'caption' : 'label'} color={vc.text}>
        {label}
      </Text>
    </View>
  );
}
