import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useTheme, FontFamilyKey } from '../theme';

type Variant =
  | 'display'        // Playfair Display Bold — hero headers
  | 'headline'       // Playfair Display Medium — section titles
  | 'title'          // DM Sans SemiBold — card titles
  | 'body'           // DM Sans Regular — default prose
  | 'bodyMedium'     // DM Sans Medium — emphasized body
  | 'label'          // DM Sans SemiBold — buttons, caps labels
  | 'caption'        // DM Sans Regular — supporting text
  | 'phonetic'       // DM Mono Regular — IPA / phonetic strings
  | 'code';          // DM Mono Medium — technical labels

interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

const variantMap: Record<Variant, { family: FontFamilyKey; sizeKey: keyof ReturnType<typeof useTheme>['fontSizes'] }> = {
  display:    { family: 'display',      sizeKey: '4xl' },
  headline:   { family: 'displayMedium', sizeKey: '2xl' },
  title:      { family: 'bodySemiBold', sizeKey: 'xl'  },
  body:       { family: 'body',         sizeKey: 'md'  },
  bodyMedium: { family: 'bodyMedium',   sizeKey: 'md'  },
  label:      { family: 'bodySemiBold', sizeKey: 'sm'  },
  caption:    { family: 'body',         sizeKey: 'xs'  },
  phonetic:   { family: 'mono',         sizeKey: 'md'  },
  code:       { family: 'monoMedium',   sizeKey: 'sm'  },
};

export function Text({ variant = 'body', color, align, style, ...props }: TextProps) {
  const theme = useTheme();
  const { family, sizeKey } = variantMap[variant];

  return (
    <RNText
      style={[
        {
          fontFamily: theme.fontFamilies[family],
          fontSize: theme.fontSizes[sizeKey],
          color: color ?? theme.colors.text,
          textAlign: align,
        },
        style,
      ]}
      {...props}
    />
  );
}
