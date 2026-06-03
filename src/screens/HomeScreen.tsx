import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../theme';
import { Text } from '../components/Text';
import { useHomeData, type SystemMastery } from '../hooks/useHomeData';

// ─── Types ───────────────────────────────────────────────────────────────────────────────────

export interface HomeScreenProps {
  onStartReview: () => void;
  onImportAnki: () => void;
  onGenerateCards: () => void;
}

// ─── Daily summary card ─────────────────────────────────────────────────────

function DailySummaryCard({
  cardsDue,
  estimatedMinutes,
  streakDays,
  onStart,
}: {
  cardsDue: number;
  estimatedMinutes: number;
  streakDays: number;
  onStart: () => void;
}) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const nonedue = cardsDue === 0;

  return (
    <View
      style={{
        backgroundColor: colors.primary,
        borderRadius: radius.lg,
        padding: spacing.xl,
        gap: spacing.lg,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 6,
      }}
    >
      {/* Top row: greeting + streak */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSizes['2xl'],
            color: '#FFFFFF',
            flex: 1,
          }}
        >
          {nonedue ? 'All caught up!' : 'Ready to study?'}
        </Text>
        {streakDays > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.tertiary,
              borderRadius: radius.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 13 }}>🔥</Text>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.sm, color: '#FFF' }}>
              {streakDays}
            </Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      {!nonedue && (
        <View style={{ flexDirection: 'row', gap: spacing.xl }}>
          <View style={{ gap: 2 }}>
            <Text
              style={{
                fontFamily: fontFamilies.display,
                fontSize: fontSizes['4xl'],
                color: '#FFFFFF',
                lineHeight: fontSizes['4xl'] * 1.1,
              }}
            >
              {cardsDue}
            </Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.65)' }}>
              cards due
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 }} />
          <View style={{ gap: 2 }}>
            <Text
              style={{
                fontFamily: fontFamilies.display,
                fontSize: fontSizes['4xl'],
                color: '#FFFFFF',
                lineHeight: fontSizes['4xl'] * 1.1,
              }}
            >
              ~{estimatedMinutes}
            </Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.65)' }}>
              min
            </Text>
          </View>
        </View>
      )}

      {nonedue && (
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSizes.md, color: 'rgba(255,255,255,0.75)' }}>
          No cards are due right now. Check back later or study ahead.
        </Text>
      )}

      {/* Start button */}
      {!nonedue && (
        <Pressable
          onPress={onStart}
          style={({ pressed }) => ({
            backgroundColor: colors.secondary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.md, color: '#FFF' }}>
            Start Review
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Quick action button ──────────────────────────────────────────────────

function QuickAction({
  emoji,
  label,
  sublabel,
  onPress,
  accentColor,
}: {
  emoji: string;
  label: string;
  sublabel: string;
  onPress: () => void;
  accentColor: string;
}) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.sm,
        borderWidth: 1.5,
        borderColor: accentColor + '33',
        opacity: pressed ? 0.75 : 1,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: accentColor + '1A',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: fontSizes.sm, color: colors.text }}>
          {label}
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSizes.xs, color: colors.textSecondary }}>
          {sublabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Mastery bar ──────────────────────────────────────────────────────────────

function MasteryRow({ item }: { item: SystemMastery }) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const pct = Math.round(item.ratio * 100);
  const barColor = item.ratio >= 0.8
    ? colors.secondary
    : item.ratio >= 0.5
    ? colors.tertiary
    : colors.primary;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSizes.sm, color: colors.text }}>
          {item.label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={{ fontFamily: fontFamilies.mono, fontSize: fontSizes.xs, color: colors.textSecondary }}>
            {item.masteredCards}/{item.totalCards}
          </Text>
          <Text style={{ fontFamily: fontFamilies.monoMedium, fontSize: fontSizes.xs, color: barColor }}>
            {pct}%
          </Text>
        </View>
      </View>
      <View style={{ height: 5, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: barColor,
            borderRadius: radius.full,
          }}
        />
      </View>
    </View>
  );
}

// ─── HomeScreen ──────────────────────────────────────────────────────────────────

export function HomeScreen({ onStartReview, onImportAnki, onGenerateCards }: HomeScreenProps) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const data = useHomeData();

  const onRefresh = useCallback(() => { data.refresh(); }, [data]);

  if (data.loading && data.cardsDue === 0 && data.systemMastery.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
          Loading…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['4xl'] }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={data.loading}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Wordmark */}
      <View style={{ paddingTop: spacing.lg }}>
        <Text
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSizes['3xl'],
            color: colors.primary,
            letterSpacing: -0.5,
          }}
        >
          MeDic
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.textSecondary }}>
          Medical vocabulary, mastered.
        </Text>
      </View>

      {/* Daily summary */}
      <DailySummaryCard
        cardsDue={data.cardsDue}
        estimatedMinutes={data.estimatedMinutes}
        streakDays={data.streakDays}
        onStart={onStartReview}
      />

      {/* Quick actions */}
      <View style={{ gap: spacing.md }}>
        <Text
          style={{
            fontFamily: fontFamilies.displayMedium,
            fontSize: fontSizes.lg,
            color: colors.text,
          }}
        >
          Tools
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <QuickAction
            emoji="🗂️"
            label="Import Anki"
            sublabel="Load an .apkg deck"
            onPress={onImportAnki}
            accentColor={colors.primary}
          />
          <QuickAction
            emoji="✨"
            label="Generate Cards"
            sublabel="From text or PDF"
            onPress={onGenerateCards}
            accentColor={colors.secondary}
          />
        </View>
      </View>

      {/* Body system mastery */}
      {data.systemMastery.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text
              style={{
                fontFamily: fontFamilies.displayMedium,
                fontSize: fontSizes.lg,
                color: colors.text,
              }}
            >
              Mastery
            </Text>
            <Text style={{ fontFamily: fontFamilies.mono, fontSize: fontSizes.xs, color: colors.textDisabled }}>
              confidence ≥ 4
            </Text>
          </View>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.lg,
              shadowColor: colors.black,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {data.systemMastery.map((item) => (
              <MasteryRow key={item.system} item={item} />
            ))}
          </View>
        </View>
      )}

      {/* Error notice */}
      {data.error && (
        <View
          style={{
            backgroundColor: colors.error + '14',
            borderRadius: radius.md,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.error + '33',
          }}
        >
          <Text variant="caption" color={colors.error}>
            {data.error}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
