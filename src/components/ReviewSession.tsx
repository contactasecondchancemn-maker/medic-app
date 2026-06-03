import React, { useRef, useEffect, useCallback } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  View,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';
import { Button } from './Button';
import { FlashCard } from './FlashCard';
import {
  useReviewQueue,
  DAILY_CAP,
  SECONDS_PER_CARD,
  type DueCard,
} from '../hooks/useReviewQueue';
import type { BodySystem } from './FlashCard';

// ─── Body-system helpers ─────────────────────────────────────────────────────────

const SYSTEM_LABEL: Partial<Record<BodySystem, string>> = {
  cardiovascular:     'Cardiovascular',
  nervous:            'Neurology',
  respiratory:        'Respiratory',
  gastrointestinal:   'GI',
  pharmacology:       'Pharmacology',
  biochemistry:       'Biochemistry',
  microbiology:       'Microbiology',
  pathology:          'Pathology',
  endocrine:          'Endocrine',
  musculoskeletal:    'MSK',
  renal_urinary:      'Renal',
  hematology_oncology:'Heme/Onc',
  immune_lymphatic:   'Immunology',
  psychiatry:         'Psychiatry',
  reproductive:       'Reproductive',
  dermatology:        'Dermatology',
  anatomy:            'Anatomy',
  embryology:         'Embryology',
  ophthalmology:      'Ophthalmology',
  otolaryngology:     'ENT',
  general_principles: 'General',
};

function topSystems(
  cards: DueCard[],
  max = 4
): Array<{ system: BodySystem; count: number }> {
  const counts = new Map<BodySystem, number>();
  for (const card of cards) {
    if (card.bodySystem) {
      counts.set(card.bodySystem, (counts.get(card.bodySystem) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, max)
    .map(([system, count]) => ({ system, count }));
}

// ─── Quality star display ───────────────────────────────────────────────────────

function QualityStars({ value }: { value: number }) {
  const { colors } = useTheme();
  const filled = Math.round(value);
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Text key={i} style={{ fontSize: 16, color: i < filled ? colors.warning : colors.border }}>
          ★
        </Text>
      ))}
    </View>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: number }) {
  const { colors, radius } = useTheme();
  const anim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 350, useNativeDriver: false }).start();
  }, [progress, anim]);

  return (
    <View style={{ height: 4, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: colors.secondary,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

// ─── Catch-up notice ──────────────────────────────────────────────────────────────

function CatchUpNotice({ shown, total, remainder }: { shown: number; total: number; remainder: number }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.warning + '18',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.warning + '44',
      padding: spacing.md,
      gap: spacing.xs,
    }}>
      <Text variant="label" color={colors.warning}>Catch-up session</Text>
      <Text variant="caption" color={colors.textSecondary}>
        {total} cards were due. Showing the {shown} hardest today
        {remainder > 0 ? ` — ${remainder} deferred to tomorrow.` : '.'}
      </Text>
      <Text variant="caption" color={colors.textSecondary}>
        Cards are ordered by lowest ease factor first.
      </Text>
    </View>
  );
}

// ─── Pre-session summary ──────────────────────────────────────────────────────────

function SessionSummary({ sessionCount, estimatedMinutes, totalDue, isCatchUpSession, catchUpRemainder, sessionCards, onStart }: {
  sessionCount: number; estimatedMinutes: number; totalDue: number;
  isCatchUpSession: boolean; catchUpRemainder: number;
  sessionCards: DueCard[]; onStart: () => void;
}) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const systems = topSystems(sessionCards);
  const uniqueSystemCount = new Set(sessionCards.map((c) => c.bodySystem).filter(Boolean)).size;
  const extraSystemCount  = Math.max(0, uniqueSystemCount - systems.length);

  if (sessionCount === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'] }}>
        <Text variant="headline" align="center" color={colors.text}>All caught up!</Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={{ marginTop: spacing.md }}>
          No cards are due right now. Check back later.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, alignItems: 'center' }}
      showsVerticalScrollIndicator={false}
    >
      <Text variant="title" color={colors.textSecondary} align="center">Ready to study</Text>

      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSizes['3xl'], color: colors.primary, textAlign: 'center' }}>
          {sessionCount} {sessionCount === 1 ? 'card' : 'cards'}
        </Text>
        <Text style={{ fontFamily: fontFamilies.displayRegular, fontSize: fontSizes.xl, color: colors.textSecondary, textAlign: 'center' }}>
          ~{estimatedMinutes} {estimatedMinutes === 1 ? 'min' : 'min'}
        </Text>
        <Text variant="caption" color={colors.textDisabled} align="center">
          {SECONDS_PER_CARD}s estimated per card
        </Text>
      </View>

      {isCatchUpSession && (
        <CatchUpNotice shown={sessionCount} total={totalDue} remainder={catchUpRemainder} />
      )}

      {systems.length > 0 && (
        <View style={{ gap: spacing.sm, width: '100%' }}>
          <Text variant="label" color={colors.textSecondary}>Topics in this session</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {systems.map(({ system, count }) => (
              <View key={system} style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.border, borderRadius: radius.full,
                paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs,
              }}>
                <Text variant="caption" color={colors.text}>{SYSTEM_LABEL[system] ?? system}</Text>
                <View style={{ backgroundColor: colors.textDisabled, borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 9, color: colors.surface, fontFamily: fontFamilies.bodyBold }}>{count}</Text>
                </View>
              </View>
            ))}
            {extraSystemCount > 0 && (
              <View style={{ backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                <Text variant="caption" color={colors.textSecondary}>+{extraSystemCount} more</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <Button label="Start Review" variant="primary" size="lg" fullWidth onPress={onStart} />
    </ScrollView>
  );
}

// ─── Active session ────────────────────────────────────────────────────────────────

function ActiveSession({ currentCard, currentIndex, sessionCount, progress, onReviewed, onSkip, onEnd }: {
  currentCard: DueCard; currentIndex: number; sessionCount: number; progress: number;
  onReviewed: (quality: number) => void; onSkip: () => void; onEnd: () => void;
}) {
  const { colors, spacing } = useTheme();
  const fadeAnim   = useRef(new Animated.Value(1)).current;
  const prevTermId = useRef(currentCard.termId);

  useEffect(() => {
    if (currentCard.termId === prevTermId.current) return;
    prevTermId.current = currentCard.termId;
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [currentCard.termId, fadeAnim]);

  const handleReviewed = useCallback((quality: number) => {
    setTimeout(() => onReviewed(quality), 900);
  }, [onReviewed]);

  return (
    <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="caption" color={colors.textSecondary}>
          Card {currentIndex + 1} of {sessionCount}
        </Text>
        <Pressable onPress={onEnd} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text variant="caption" color={colors.textSecondary}>End session</Text>
        </Pressable>
      </View>

      <ProgressBar progress={progress} />

      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <FlashCard
          key={currentCard.termId}
          termId={currentCard.termId}
          term={currentCard.term}
          ipa={currentCard.ipa}
          definition={currentCard.definition}
          bodySystem={currentCard.bodySystem}
          onReviewed={handleReviewed}
        />
      </Animated.View>

      <Pressable onPress={onSkip} style={({ pressed }) => ({ alignSelf: 'center', opacity: pressed ? 0.6 : 1 })} hitSlop={8}>
        <Text variant="caption" color={colors.textDisabled}>Skip this card</Text>
      </Pressable>
    </View>
  );
}

// ─── Completion screen ─────────────────────────────────────────────────────────────

function CompletionScreen({ completedCount, estimatedMinutes, averageQuality, onDone, onReviewAgain }: {
  completedCount: number; estimatedMinutes: number; averageQuality: number | null;
  onDone: () => void; onReviewAgain: () => void;
}) {
  const { colors, spacing, fontFamilies, fontSizes } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.xl }}>
      <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSizes['3xl'], color: colors.secondary, textAlign: 'center' }}>
        Session complete
      </Text>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Text variant="body" color={colors.textSecondary} align="center">
          {completedCount} {completedCount === 1 ? 'card' : 'cards'} reviewed
          {' · '}~{estimatedMinutes} min
        </Text>
        {averageQuality !== null && (
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <QualityStars value={averageQuality} />
            <Text variant="caption" color={colors.textSecondary}>
              Average quality {averageQuality.toFixed(1)} / 5
            </Text>
          </View>
        )}
      </View>
      <View style={{ gap: spacing.sm, width: '100%' }}>
        <Button label="Done" variant="primary" size="lg" fullWidth onPress={onDone} />
        <Button label="Review Again" variant="ghost" size="md" fullWidth onPress={onReviewAgain} />
      </View>
    </View>
  );
}

// ─── ReviewSession ────────────────────────────────────────────────────────────────

interface ReviewSessionProps {
  onDismiss?: () => void;
}

export function ReviewSession({ onDismiss }: ReviewSessionProps) {
  const { colors, spacing } = useTheme();
  const queue = useReviewQueue();

  const handleDone = useCallback(() => {
    queue.reload();
    onDismiss?.();
  }, [queue, onDismiss]);

  if (queue.status === 'loading' || queue.status === 'idle') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
          Loading your review queue…
        </Text>
      </View>
    );
  }

  if (queue.status === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
        <Text variant="title" color={colors.error} align="center">Couldn’t load your cards</Text>
        <Text variant="body" color={colors.textSecondary} align="center">{queue.error}</Text>
        <Button label="Try Again" variant="outline" onPress={queue.reload} />
      </View>
    );
  }

  if (queue.status === 'ready') {
    return (
      <SessionSummary
        sessionCount={queue.sessionCount}
        estimatedMinutes={queue.estimatedMinutes}
        totalDue={queue.totalDue}
        isCatchUpSession={queue.isCatchUpSession}
        catchUpRemainder={queue.catchUpRemainder}
        sessionCards={queue.sessionCards}
        onStart={queue.startSession}
      />
    );
  }

  if (queue.status === 'active' && queue.currentCard) {
    return (
      <ActiveSession
        currentCard={queue.currentCard}
        currentIndex={queue.currentIndex}
        sessionCount={queue.sessionCount}
        progress={queue.progress}
        onReviewed={queue.markReviewed}
        onSkip={queue.skipCard}
        onEnd={queue.endSession}
      />
    );
  }

  if (queue.status === 'complete') {
    return (
      <CompletionScreen
        completedCount={queue.completedCount}
        estimatedMinutes={queue.estimatedMinutes}
        averageQuality={queue.averageQuality}
        onDone={handleDone}
        onReviewAgain={queue.startSession}
      />
    );
  }

  return null;
}
