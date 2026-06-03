import React, { useRef, useState, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  View,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';
import { Badge } from './Badge';
import { supabase } from '../lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BodySystem =
  | 'anatomy' | 'biochemistry' | 'cardiovascular' | 'dermatology'
  | 'embryology' | 'endocrine' | 'gastrointestinal' | 'general_principles'
  | 'hematology_oncology' | 'immune_lymphatic' | 'microbiology'
  | 'musculoskeletal' | 'nervous' | 'ophthalmology' | 'otolaryngology'
  | 'pathology' | 'pharmacology' | 'psychiatry' | 'renal_urinary'
  | 'reproductive' | 'respiratory';

export interface EtymologyPart {
  type: 'prefix' | 'root' | 'suffix';
  value: string;
  meaning: string;
  language: 'greek' | 'latin';
}

export interface FlashCardProps {
  termId: string;
  term: string;
  ipa?: string;
  definition: string;
  etymologyText?: string;
  etymologyParts?: { parts: EtymologyPart[] };
  bodySystem?: BodySystem;
  difficulty?: number;   // 1–5
  step1Rating?: number;  // 1–5
  onReviewed?: (quality: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

const BODY_SYSTEM_LABELS: Record<BodySystem, string> = {
  anatomy:            'Anatomy',
  biochemistry:       'Biochemistry',
  cardiovascular:     'Cardiovascular',
  dermatology:        'Dermatology',
  embryology:         'Embryology',
  endocrine:          'Endocrine',
  gastrointestinal:   'GI',
  general_principles: 'General',
  hematology_oncology:'Heme/Onc',
  immune_lymphatic:   'Immunology',
  microbiology:       'Microbiology',
  musculoskeletal:    'MSK',
  nervous:            'Neurology',
  ophthalmology:      'Ophthalmology',
  otolaryngology:     'ENT',
  pathology:          'Pathology',
  pharmacology:       'Pharmacology',
  psychiatry:         'Psychiatry',
  renal_urinary:      'Renal',
  reproductive:       'Reproductive',
  respiratory:        'Respiratory',
};

const BODY_SYSTEM_BADGE_VARIANT: Record<BodySystem, 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'neutral'> = {
  anatomy:            'neutral',
  biochemistry:       'info',
  cardiovascular:     'error',
  dermatology:        'warning',
  embryology:         'neutral',
  endocrine:          'secondary',
  gastrointestinal:   'warning',
  general_principles: 'neutral',
  hematology_oncology:'error',
  immune_lymphatic:   'secondary',
  microbiology:       'info',
  musculoskeletal:    'neutral',
  nervous:            'primary',
  ophthalmology:      'info',
  otolaryngology:     'info',
  pathology:          'error',
  pharmacology:       'secondary',
  psychiatry:         'primary',
  renal_urinary:      'info',
  reproductive:       'secondary',
  respiratory:        'warning',
};

// SM-2 quality values mapped to the five confidence buttons.
const CONFIDENCE_STEPS = [
  { label: 'Again',   quality: 1 },
  { label: 'Hard',    quality: 2 },
  { label: 'Good',    quality: 3 },
  { label: 'Easy',    quality: 4 },
  { label: 'Perfect', quality: 5 },
];

// ─── Sub-components ─────────────────────────────────────────────────────────────

function DifficultyDots({ difficulty }: { difficulty: number }) {
  const { colors, spacing } = useTheme();

  const dotColors = [
    colors.success,
    colors.secondary,
    colors.warning,
    colors.tertiary,
    colors.error,
  ];

  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: i < difficulty ? dotColors[difficulty - 1] : colors.border,
          }}
        />
      ))}
    </View>
  );
}

function EtymologyChips({ parts }: { parts: EtymologyPart[] }) {
  const { colors, radius, spacing, fontFamilies, fontSizes } = useTheme();

  const langColor = (lang: 'greek' | 'latin') =>
    lang === 'greek' ? colors.secondary : colors.tertiary;

  const typeOpacity = (type: 'prefix' | 'root' | 'suffix') => {
    if (type === 'root')   return '33';
    if (type === 'prefix') return '22';
    return '18';
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {parts.map((part, i) => {
        const color = langColor(part.language);
        const bg    = color + typeOpacity(part.type);
        return (
          <View
            key={i}
            style={{
              backgroundColor: bg,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: color + '44',
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
            }}
          >
            <Text
              variant="code"
              color={color}
              style={{ fontFamily: fontFamilies.monoMedium, fontSize: fontSizes.xs }}
            >
              {part.value}
            </Text>
            <Text
              variant="caption"
              color={color + 'CC'}
              style={{ fontSize: 9, fontFamily: fontFamilies.mono }}
            >
              {part.meaning}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function EtymologyBreakdown({ parts }: { parts: EtymologyPart[] }) {
  const { colors, spacing } = useTheme();

  const langColor = (lang: 'greek' | 'latin') =>
    lang === 'greek' ? colors.secondary : colors.tertiary;

  return (
    <View style={{ gap: spacing.xs }}>
      {parts.map((part, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 48, alignItems: 'flex-end' }}>
            <Text variant="caption" color={colors.textSecondary}>
              {part.type}
            </Text>
          </View>
          <Text variant="code" color={langColor(part.language)} style={{ minWidth: 64 }}>
            {part.value}
          </Text>
          <Text variant="caption" color={colors.text} style={{ flex: 1 }}>
            "{part.meaning}"
            <Text variant="caption" color={colors.textSecondary}>
              {' '}({part.language})
            </Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function ConfidenceRow({
  onSelect,
  selected,
  loading,
}: {
  onSelect: (quality: number) => void;
  selected: number | null;
  loading: boolean;
}) {
  const { colors, radius, spacing, fontFamilies, fontSizes } = useTheme();

  const stepColors = [
    colors.error,
    colors.tertiary,
    colors.warning,
    colors.secondary,
    colors.success,
  ];

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" color={colors.textSecondary} align="center">
        How well did you know this?
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        {CONFIDENCE_STEPS.map((step, i) => {
          const isSelected = selected === step.quality;
          const color = stepColors[i];

          return (
            <Pressable
              key={step.quality}
              onPress={() => !loading && onSelect(step.quality)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                alignItems: 'center',
                backgroundColor: isSelected ? color : color + '18',
                borderWidth: 1.5,
                borderColor: isSelected ? color : color + '44',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              {loading && isSelected ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Text
                    style={{
                      fontFamily: fontFamilies.bodyBold,
                      fontSize: fontSizes.lg,
                      color: isSelected ? colors.white : color,
                    }}
                  >
                    {step.quality}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fontFamilies.body,
                      fontSize: 9,
                      color: isSelected ? colors.white + 'CC' : color + 'BB',
                      marginTop: 1,
                    }}
                  >
                    {step.label}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Card faces ──────────────────────────────────────────────────────────────────

function CardFront({
  term,
  ipa,
  etymologyParts,
  bodySystem,
  difficulty,
}: Pick<FlashCardProps, 'term' | 'ipa' | 'etymologyParts' | 'bodySystem' | 'difficulty'>) {
  const { colors, spacing } = useTheme();
  const parts = etymologyParts?.parts ?? [];

  return (
    <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'space-between' }}>
      {/* Top row: body system + difficulty */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {bodySystem ? (
          <Badge
            label={BODY_SYSTEM_LABELS[bodySystem]}
            variant={BODY_SYSTEM_BADGE_VARIANT[bodySystem]}
            size="sm"
          />
        ) : (
          <View />
        )}
        {difficulty != null && <DifficultyDots difficulty={difficulty} />}
      </View>

      {/* Centre: term + IPA */}
      <View style={{ gap: spacing.md }}>
        <Text
          style={{
            fontFamily: 'PlayfairDisplay_400Regular_Italic',
            fontSize: 34,
            lineHeight: 42,
            color: colors.primary,
            letterSpacing: 0.2,
          }}
        >
          {term}
        </Text>
        {ipa ? (
          <Text variant="phonetic" color={colors.textSecondary}>
            {ipa}
          </Text>
        ) : null}
      </View>

      {/* Bottom: etymology chips + hint */}
      <View style={{ gap: spacing.sm }}>
        {parts.length > 0 && <EtymologyChips parts={parts} />}
        <Text variant="caption" color={colors.textDisabled} align="center">
          Tap to reveal definition
        </Text>
      </View>
    </View>
  );
}

function CardBack({
  term,
  definition,
  etymologyText,
  etymologyParts,
  bodySystem,
  termId,
  onReviewed,
}: Pick<FlashCardProps, 'term' | 'definition' | 'etymologyText' | 'etymologyParts' | 'bodySystem' | 'termId' | 'onReviewed'>) {
  const { colors, spacing } = useTheme();
  const parts = etymologyParts?.parts ?? [];

  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleConfidence = useCallback(async (quality: number) => {
    if (submitted) return;
    setSelected(quality);
    setLoading(true);
    try {
      await supabase.rpc('update_card_review', {
        p_term_id: termId,
        p_quality: quality,
      });
      setSubmitted(true);
      onReviewed?.(quality);
    } finally {
      setLoading(false);
    }
  }, [termId, onReviewed, submitted]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {bodySystem && (
        <Badge
          label={BODY_SYSTEM_LABELS[bodySystem]}
          variant={BODY_SYSTEM_BADGE_VARIANT[bodySystem]}
          size="sm"
        />
      )}

      <Text
        style={{
          fontFamily: 'PlayfairDisplay_400Regular_Italic',
          fontSize: 22,
          color: colors.primary,
        }}
      >
        {term}
      </Text>

      <View style={{ height: 1, backgroundColor: colors.border }} />

      <Text variant="body" color={colors.text} style={{ lineHeight: 24 }}>
        {definition}
      </Text>

      {(parts.length > 0 || etymologyText) && (
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color={colors.textSecondary}>
            Etymology
          </Text>
          {parts.length > 0 ? (
            <EtymologyBreakdown parts={parts} />
          ) : (
            <Text variant="body" color={colors.textSecondary}>
              {etymologyText}
            </Text>
          )}
        </View>
      )}

      <View style={{ height: 1, backgroundColor: colors.border }} />

      <ConfidenceRow
        onSelect={handleConfidence}
        selected={selected}
        loading={loading}
      />

      {submitted && (
        <Text variant="caption" color={colors.success} align="center">
          Review saved ✓
        </Text>
      )}

      <View style={{ height: spacing.lg }} />
    </ScrollView>
  );
}

// ─── FlashCard ────────────────────────────────────────────────────────────────────

export function FlashCard(props: FlashCardProps) {
  const { colors, radius, spacing } = useTheme();

  const flipAnim = useRef(new Animated.Value(0)).current;
  const [isFlipped, setIsFlipped] = useState(false);
  const [backMounted, setBackMounted] = useState(false);

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const flip = useCallback(() => {
    const toValue = isFlipped ? 0 : 1;
    if (!backMounted) setBackMounted(true);
    Animated.spring(flipAnim, {
      toValue,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  }, [isFlipped, backMounted, flipAnim]);

  const cardBase = {
    width: CARD_WIDTH,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
    minHeight: 420,
    overflow: 'hidden' as const,
    backfaceVisibility: 'hidden' as const,
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: CARD_WIDTH, minHeight: 420 }}>
        {/* Front face */}
        <Animated.View
          style={[
            cardBase,
            {
              position: 'absolute',
              top: 0, left: 0, right: 0,
              transform: [{ perspective: 1200 }, { rotateY: frontRotateY }],
              zIndex: isFlipped ? 0 : 1,
            },
          ]}
        >
          <Pressable onPress={flip} style={{ flex: 1, minHeight: 420 }}>
            <CardFront
              term={props.term}
              ipa={props.ipa}
              etymologyParts={props.etymologyParts}
              bodySystem={props.bodySystem}
              difficulty={props.difficulty}
            />
          </Pressable>
        </Animated.View>

        {/* Back face — lazy mounted on first flip */}
        {backMounted && (
          <Animated.View
            style={[
              cardBase,
              {
                position: 'absolute',
                top: 0, left: 0, right: 0,
                transform: [{ perspective: 1200 }, { rotateY: backRotateY }],
                zIndex: isFlipped ? 1 : 0,
              },
            ]}
          >
            <Pressable
              onPress={flip}
              style={{
                paddingVertical: spacing.sm,
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text variant="caption" color={colors.textDisabled}>
                Tap to flip back
              </Text>
            </Pressable>
            <CardBack
              term={props.term}
              definition={props.definition}
              etymologyText={props.etymologyText}
              etymologyParts={props.etymologyParts}
              bodySystem={props.bodySystem}
              termId={props.termId}
              onReviewed={props.onReviewed}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}
