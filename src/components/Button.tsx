import React from 'react';
import {
  Pressable,
  PressableProps,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;

  const isDisabled = disabled || loading;

  const variantStyles: Record<Variant, { bg: string; border: string | null; labelColor: string }> = {
    primary:   { bg: colors.primary,   border: null,           labelColor: colors.white },
    secondary: { bg: colors.secondary, border: null,           labelColor: colors.white },
    outline:   { bg: 'transparent',    border: colors.primary, labelColor: colors.primary },
    ghost:     { bg: 'transparent',    border: null,           labelColor: colors.primary },
    danger:    { bg: colors.error,     border: null,           labelColor: colors.white },
  };

  const sizeStyles: Record<Size, { paddingV: number; paddingH: number; borderRadius: number }> = {
    sm: { paddingV: spacing.xs, paddingH: spacing.md,  borderRadius: radius.md },
    md: { paddingV: spacing.sm, paddingH: spacing.lg,  borderRadius: radius.md },
    lg: { paddingV: spacing.md, paddingH: spacing.xl,  borderRadius: radius.lg },
  };

  const vs = variantStyles[variant];
  const ss = sizeStyles[size];

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        paddingVertical: ss.paddingV,
        paddingHorizontal: ss.paddingH,
        borderRadius: ss.borderRadius,
        backgroundColor: vs.bg,
        borderWidth: vs.border ? 1.5 : 0,
        borderColor: vs.border ?? 'transparent',
        opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1,
        gap: spacing.xs,
      })}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.labelColor} />
      ) : (
        <>
          {leftIcon}
          <Text variant="label" color={vs.labelColor}>
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}
