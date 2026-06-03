import React, { useCallback } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';
import { Button } from './Button';
import { useAnkiImport, type ImportPhase } from '../hooks/useAnkiImport';

// ─── Phase metadata ───────────────────────────────────────────────────────────

const PHASES: ImportPhase[] = [
  'picking',
  'unzipping',
  'parsing',
  'enriching',
  'saving',
  'complete',
];

const PHASE_LABEL: Record<ImportPhase, string> = {
  idle:      'Waiting',
  picking:   'Select file',
  unzipping: 'Unzipping',
  parsing:   'Parsing cards',
  enriching: 'AI enrichment',
  saving:    'Saving to library',
  complete:  'Done',
  error:     'Error',
};

function phaseIndex(phase: ImportPhase): number {
  return PHASES.indexOf(phase);
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepList({ currentPhase }: { currentPhase: ImportPhase }) {
  const { colors, spacing, radius } = useTheme();
  const activeIdx = phaseIndex(currentPhase);

  return (
    <View style={{ gap: spacing.sm }}>
      {PHASES.map((phase, i) => {
        const done    = i < activeIdx;
        const active  = i === activeIdx;
        const pending = i > activeIdx;

        const dotColor = done
          ? colors.success
          : active
          ? colors.primary
          : colors.border;

        const labelColor = done
          ? colors.success
          : active
          ? colors.text
          : colors.textDisabled;

        return (
          <View
            key={phase}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          >
            {/* Dot */}
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: radius.full,
                backgroundColor: dotColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {done && (
                <Text style={{ fontSize: 11, color: colors.surface, lineHeight: 14 }}>
                  ✓
                </Text>
              )}
              {active && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radius.full,
                    backgroundColor: colors.surface,
                  }}
                />
              )}
            </View>

            {/* Connector line */}
            {i < PHASES.length - 1 && (
              <View
                style={{
                  position: 'absolute',
                  left: 9,
                  top: 20,
                  width: 2,
                  height: spacing.sm,
                  backgroundColor: done ? colors.success : colors.border,
                }}
              />
            )}

            <Text variant="body" color={labelColor}>
              {PHASE_LABEL[phase]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function EnrichProgress({
  enriched,
  total,
}: {
  enriched: number;
  total: number;
}) {
  const { colors, spacing, radius } = useTheme();
  if (total === 0) return null;
  const pct = Math.min(1, enriched / total);

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          height: 6,
          backgroundColor: colors.border,
          borderRadius: radius.full,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.round(pct * 100)}%`,
            backgroundColor: colors.secondary,
            borderRadius: radius.full,
          }}
        />
      </View>
      <Text variant="caption" color={colors.textSecondary} align="center">
        {enriched} / {total} terms enriched
      </Text>
    </View>
  );
}

// ─── AnkiImport ───────────────────────────────────────────────────────────────

interface AnkiImportProps {
  onDismiss?: () => void;
}

export function AnkiImport({ onDismiss }: AnkiImportProps) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const { progress, runImport, cancel, reset } = useAnkiImport();
  const { phase, error, enriched, total, saved } = progress;

  const isActive = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  const handleClose = useCallback(() => {
    reset();
    onDismiss?.();
  }, [reset, onDismiss]);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.xl,
      }}
      showsVerticalScrollIndicator={false}
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
            Import from Anki
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            Import a .apkg deck file to add cards with your existing progress.
          </Text>
        </View>
        {!isActive && (
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingLeft: spacing.md })}
          >
            <Text variant="label" color={colors.textSecondary}>
              ✕
            </Text>
          </Pressable>
        )}
      </View>

      {/* Info chips */}
      {phase === 'idle' && (
        <View style={{ gap: spacing.sm }}>
          {[
            ['File format', '.apkg (Anki deck export)'],
            ['SRS progress', 'Existing intervals & ease factors preserved'],
            ['AI enrichment', 'IPA, body system, etymology auto-filled'],
          ].map(([label, desc]) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                backgroundColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: radius.full,
                  backgroundColor: colors.secondary,
                  marginTop: 6,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text variant="label" color={colors.text}>{label}</Text>
                <Text variant="caption" color={colors.textSecondary}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Step list — shown while active */}
      {isActive && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <StepList currentPhase={phase} />

          {phase === 'enriching' && (
            <EnrichProgress enriched={enriched} total={total} />
          )}
        </View>
      )}

      {/* Complete state */}
      {phase === 'complete' && (
        <View
          style={{
            backgroundColor: colors.success + '18',
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.success + '44',
            padding: spacing.lg,
            gap: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 32 }}>✓</Text>
          <Text variant="headline" color={colors.success} align="center">
            Import complete
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            {saved} {saved === 1 ? 'card' : 'cards'} added to your library
          </Text>
        </View>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <View
          style={{
            backgroundColor: colors.error + '18',
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.error + '44',
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <Text variant="label" color={colors.error}>
            Import failed
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {error}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={{ gap: spacing.sm }}>
        {phase === 'idle' && (
          <Button
            label="Choose .apkg File"
            variant="primary"
            size="lg"
            fullWidth
            onPress={runImport}
          />
        )}

        {isActive && (
          <Button
            label="Cancel"
            variant="ghost"
            size="md"
            fullWidth
            onPress={cancel}
          />
        )}

        {phase === 'complete' && (
          <Button
            label="Done"
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleClose}
          />
        )}

        {phase === 'error' && (
          <>
            <Button
              label="Try Again"
              variant="primary"
              size="lg"
              fullWidth
              onPress={runImport}
            />
            <Button
              label="Cancel"
              variant="ghost"
              size="md"
              fullWidth
              onPress={handleClose}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
