import React, { useCallback, useRef } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';
import { Button } from './Button';
import { Badge } from './Badge';
import {
  useCardGeneration,
  type GeneratedCard,
  type InputMode,
} from '../hooks/useCardGeneration';

// ─── Body-system label map (mirrors ReviewSession) ────────────────────────────────

const SYSTEM_LABEL: Record<string, string> = {
  cardiovascular:      'Cardio',
  nervous:             'Neuro',
  respiratory:         'Resp',
  gastrointestinal:    'GI',
  pharmacology:        'Pharm',
  biochemistry:        'Biochem',
  microbiology:        'Micro',
  pathology:           'Path',
  endocrine:           'Endo',
  musculoskeletal:     'MSK',
  renal_urinary:       'Renal',
  hematology_oncology: 'Heme/Onc',
  immune_lymphatic:    'Immuno',
  psychiatry:          'Psych',
  reproductive:        'Repro',
  dermatology:         'Derm',
  anatomy:             'Anatomy',
  embryology:          'Embryo',
  ophthalmology:       'Ophtho',
  otolaryngology:      'ENT',
  general_principles:  'General',
};

// ─── Difficulty dots ────────────────────────────────────────────────────────────────

function DifficultyDots({ value }: { value: number }) {
  const { colors } = useTheme();
  const dotColors = [
    colors.success,
    colors.secondary,
    colors.warning,
    colors.tertiary,
    colors.error,
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i < value ? dotColors[i] : colors.border,
          }}
        />
      ))}
    </View>
  );
}

// ─── Card preview row ──────────────────────────────────────────────────────────────

function CardPreviewRow({ card, index }: { card: GeneratedCard; index: number }) {
  const { colors, spacing, radius, fontFamilies } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text
          style={{
            fontFamily: fontFamilies.displayItalic,
            fontSize: 15,
            color: colors.primary,
            flex: 1,
            marginRight: spacing.sm,
          }}
        >
          {card.term}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
          {card.body_system && (
            <View
              style={{
                backgroundColor: colors.secondary + '22',
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 10, color: colors.secondary, fontFamily: fontFamilies.bodyBold }}>
                {SYSTEM_LABEL[card.body_system] ?? card.body_system}
              </Text>
            </View>
          )}
          <DifficultyDots value={card.difficulty} />
        </View>
      </View>

      {card.ipa ? (
        <Text style={{ fontFamily: fontFamilies.mono, fontSize: 12, color: colors.textSecondary }}>
          {card.ipa}
        </Text>
      ) : null}

      <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18 }}>
        {card.definition.length > 140 ? card.definition.slice(0, 137) + '…' : card.definition}
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {card.abbreviation ? (
          <Text style={{ fontSize: 10, color: colors.textDisabled, fontFamily: fontFamilies.bodyBold }}>
            {card.abbreviation}
          </Text>
        ) : <View />}
        <Text style={{ fontSize: 10, color: colors.textDisabled }}>
          Step 1: {'★'.repeat(card.step1_rating)}{'☆'.repeat(5 - card.step1_rating)}
        </Text>
      </View>
    </View>
  );
}

// ─── Input mode toggle ────────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
}: {
  mode: InputMode;
  onChange: (m: InputMode) => void;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.border,
        borderRadius: radius.md,
        padding: 3,
      }}
    >
      {(['text', 'pdf'] as InputMode[]).map((m) => {
        const active = m === mode;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={{
              flex: 1,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.sm,
              backgroundColor: active ? colors.surface : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              variant="label"
              color={active ? colors.text : colors.textSecondary}
            >
              {m === 'text' ? 'Paste Text' : 'Upload PDF'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Pulsing generation indicator ────────────────────────────────────────────────

function GeneratingIndicator() {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={{ alignItems: 'center', gap: spacing.xl, paddingVertical: spacing['2xl'] }}>
      <Animated.View style={{ opacity: pulse }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.primary + '18',
            borderWidth: 2,
            borderColor: colors.primary + '44',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Animated.View>
      <View style={{ gap: spacing.xs, alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSizes.xl,
            color: colors.primary,
            textAlign: 'center',
          }}
        >
          Generating cards…
        </Text>
        <Text variant="caption" color={colors.textSecondary} align="center">
          Claude is analyzing your content
        </Text>
      </View>
    </View>
  );
}

// ─── Deck name input ────────────────────────────────────────────────────────────────

function DeckNameInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label" color={colors.textSecondary}>
        Deck name
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="e.g. Cardiovascular Pathology"
        placeholderTextColor={colors.textDisabled}
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSizes.md,
          color: colors.text,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
        returnKeyType="done"
        maxLength={80}
      />
    </View>
  );
}

// ─── CardGeneration ───────────────────────────────────────────────────────────────

interface CardGenerationProps {
  onDismiss?: () => void;
}

export function CardGeneration({ onDismiss }: CardGenerationProps) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const {
    state,
    setInputMode,
    setTextInput,
    pickPdf,
    setDeckName,
    generate,
    save,
    cancel,
    reset,
    backToInput,
  } = useCardGeneration();

  const { phase, error, inputMode, textInput, pdfName, cards, deckName, savedDeckId } = state;

  const canGenerate =
    (inputMode === 'text' && textInput.trim().length > 0) ||
    (inputMode === 'pdf' && pdfName !== null);

  const handleClose = useCallback(() => {
    reset();
    onDismiss?.();
  }, [reset, onDismiss]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text
              style={{
                fontFamily: fontFamilies.display,
                fontSize: fontSizes['2xl'],
                color: colors.primary,
              }}
            >
              {phase === 'review' || phase === 'saving'
                ? `${cards.length} cards generated`
                : phase === 'complete'
                ? 'Deck saved'
                : 'Generate cards'}
            </Text>
            <Text variant="body" color={colors.textSecondary}>
              {phase === 'review' || phase === 'saving'
                ? 'Review and name your deck before saving.'
                : phase === 'complete'
                ? 'Your new deck is ready to study.'
                : 'Paste notes or upload a PDF and Claude will create a full flashcard deck.'}
            </Text>
          </View>
          {phase !== 'generating' && phase !== 'saving' && (
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingLeft: spacing.md })}
            >
              <Text variant="label" color={colors.textSecondary}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* ── Input phase ── */}
        {(phase === 'idle' || phase === 'input') && (
          <>
            <ModeToggle mode={inputMode} onChange={setInputMode} />

            {inputMode === 'text' ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="label" color={colors.textSecondary}>
                  Medical text
                </Text>
                <TextInput
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder="Paste lecture notes, textbook passages, review sheets…"
                  placeholderTextColor={colors.textDisabled}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSizes.md,
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    minHeight: 180,
                    lineHeight: 22,
                  }}
                />
                {textInput.length > 0 && (
                  <Text variant="caption" color={colors.textDisabled} align="right">
                    {textInput.length.toLocaleString()} chars
                    {textInput.length > 12000 ? '  (first 12 000 will be used)' : ''}
                  </Text>
                )}
              </View>
            ) : (
              <Pressable
                onPress={pickPdf}
                style={({ pressed }) => ({
                  borderWidth: 1.5,
                  borderColor: pdfName ? colors.secondary : colors.border,
                  borderStyle: pdfName ? 'solid' : 'dashed',
                  borderRadius: radius.lg,
                  padding: spacing.xl,
                  alignItems: 'center',
                  gap: spacing.sm,
                  backgroundColor: pdfName ? colors.secondary + '0C' : colors.surface,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 32 }}>{pdfName ? '📄' : '⬆️'}</Text>
                <Text variant="label" color={pdfName ? colors.secondary : colors.textSecondary} align="center">
                  {pdfName ?? 'Tap to choose a PDF'}
                </Text>
                {pdfName && (
                  <Text variant="caption" color={colors.textDisabled} align="center">
                    Tap to choose a different file
                  </Text>
                )}
              </Pressable>
            )}
          </>
        )}

        {/* ── Generating phase ── */}
        {phase === 'generating' && <GeneratingIndicator />}

        {/* ── Review phase ── */}
        {(phase === 'review' || phase === 'saving') && (
          <>
            <DeckNameInput value={deckName} onChange={setDeckName} />

            {/* Stats row */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <View
                style={{
                  backgroundColor: colors.primary + '14',
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.primary, fontFamily: fontFamilies.bodyBold }}>
                  {cards.length} cards
                </Text>
              </View>
              {(() => {
                const avgDiff = cards.reduce((s, c) => s + c.difficulty, 0) / cards.length;
                const avgStep = cards.reduce((s, c) => s + c.step1_rating, 0) / cards.length;
                return (
                  <>
                    <View style={{ backgroundColor: colors.warning + '18', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
                      <Text style={{ fontSize: 12, color: colors.warning, fontFamily: fontFamilies.bodyBold }}>
                        Avg difficulty {avgDiff.toFixed(1)}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: colors.secondary + '18', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
                      <Text style={{ fontSize: 12, color: colors.secondary, fontFamily: fontFamilies.bodyBold }}>
                        Step 1 avg {avgStep.toFixed(1)}★
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>

            {/* Card list */}
            <View style={{ gap: spacing.sm }}>
              {cards.map((card, i) => (
                <CardPreviewRow key={`${card.term}-${i}`} card={card} index={i} />
              ))}
            </View>
          </>
        )}

        {/* ── Complete phase ── */}
        {phase === 'complete' && (
          <View
            style={{
              backgroundColor: colors.success + '18',
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.success + '44',
              padding: spacing.xl,
              gap: spacing.sm,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 40 }}>✓</Text>
            <Text variant="headline" color={colors.success} align="center">
              {deckName || 'Deck'} saved
            </Text>
            <Text variant="body" color={colors.textSecondary} align="center">
              {cards.length} cards are now in your library and ready to review.
            </Text>
          </View>
        )}

        {/* ── Error phase ── */}
        {phase === 'error' && (
          <View
            style={{
              backgroundColor: colors.error + '18',
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.error + '44',
              padding: spacing.lg,
              gap: spacing.xs,
            }}
          >
            <Text variant="label" color={colors.error}>Generation failed</Text>
            <Text variant="caption" color={colors.textSecondary}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky action bar ── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        {(phase === 'idle' || phase === 'input') && (
          <>
            <Button
              label="Generate Cards"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!canGenerate}
              onPress={generate}
            />
            {phase === 'input' && (
              <Button
                label="Cancel"
                variant="ghost"
                size="md"
                fullWidth
                onPress={handleClose}
              />
            )}
          </>
        )}

        {phase === 'generating' && (
          <Button label="Cancel" variant="ghost" size="md" fullWidth onPress={cancel} />
        )}

        {(phase === 'review') && (
          <>
            <Button
              label={`Save Deck  ·  ${cards.length} cards`}
              variant="primary"
              size="lg"
              fullWidth
              onPress={save}
            />
            <Button
              label="Regenerate"
              variant="ghost"
              size="md"
              fullWidth
              onPress={backToInput}
            />
          </>
        )}

        {phase === 'saving' && (
          <Button label="Saving…" variant="primary" size="lg" fullWidth loading />
        )}

        {phase === 'complete' && (
          <>
            <Button label="Done" variant="primary" size="lg" fullWidth onPress={handleClose} />
            <Button
              label="Generate Another Deck"
              variant="ghost"
              size="md"
              fullWidth
              onPress={reset}
            />
          </>
        )}

        {phase === 'error' && (
          <>
            <Button label="Try Again" variant="primary" size="lg" fullWidth onPress={generate} />
            <Button label="Cancel" variant="ghost" size="md" fullWidth onPress={handleClose} />
          </>
        )}
      </View>
    </View>
  );
}
