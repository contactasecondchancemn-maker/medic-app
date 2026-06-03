import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  Animated,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';
import { Button } from './Button';
import type { BodySystem } from './FlashCard';
import {
  useSessionFilter,
  BODY_SYSTEMS,
  BODY_REGIONS,
  type BodyRegion,
} from '../hooks/useSessionFilter';
import { type QueueFilters, SECONDS_PER_CARD } from '../hooks/useReviewQueue';

// ─── Section header ───────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  badge,
}: {
  title: string;
  badge?: number;
}) {
  const { colors, spacing, radius, fontFamilies } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Text variant="label" color={colors.textSecondary} style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {title}
      </Text>
      {badge !== undefined && badge > 0 && (
        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.full,
            paddingHorizontal: 6,
            paddingVertical: 1,
            minWidth: 18,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 10, color: colors.white, fontFamily: fontFamilies.bodyBold }}>
            {badge}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Chip toggle ────────────────────────────────────────────────────────────────────

function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const activeColor = color ?? colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: radius.full,
        borderWidth: 1.5,
        borderColor: selected ? activeColor : colors.border,
        backgroundColor: selected ? activeColor + '18' : colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 13,
          color: selected ? activeColor : colors.textSecondary,
          fontWeight: selected ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Difficulty range picker ────────────────────────────────────────────────────────

const DIFF_LABELS = ['', 'Basic', 'Easy', 'Medium', 'Hard', 'Expert'];
const DIFF_COLORS = ['', '#22C55E', '#14B8A6', '#F59E0B', '#E07B2A', '#EF4444'];

function DifficultyPicker({
  min,
  max,
  onChange,
}: {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const { colors, spacing, radius } = useTheme();

  const effectiveMin = min ?? 1;
  const effectiveMax = max ?? 5;

  const isSelected = (v: number) => v >= effectiveMin && v <= effectiveMax;
  const isActive   = min !== null || max !== null;

  const handleTap = (v: number) => {
    if (!isActive) {
      // First tap: select only that value
      onChange(v, v);
      return;
    }
    if (min === v && max === v) {
      // Tapping the only selected dot clears
      onChange(null, null);
      return;
    }
    // Expand range to include tapped dot
    onChange(Math.min(effectiveMin, v), Math.max(effectiveMax, v));
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((v) => {
          const sel = isSelected(v);
          const dotColor = DIFF_COLORS[v];
          return (
            <Pressable
              key={v}
              onPress={() => handleTap(v)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: sel ? dotColor : colors.border,
                backgroundColor: sel ? dotColor + '22' : colors.surface,
                alignItems: 'center',
                gap: 4,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: sel ? dotColor : colors.border,
                }}
              />
              <Text style={{ fontSize: 10, color: sel ? dotColor : colors.textDisabled }}>
                {v}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {isActive && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="caption" color={colors.textSecondary}>
            {min === max
              ? `Difficulty ${min} — ${DIFF_LABELS[min ?? 1]}`
              : `Difficulty ${effectiveMin}–${effectiveMax} (${DIFF_LABELS[effectiveMin]} to ${DIFF_LABELS[effectiveMax]})`}
          </Text>
          <Pressable
            onPress={() => onChange(null, null)}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text variant="caption" color={colors.primary}>Clear</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Live count badge ───────────────────────────────────────────────────────────────────

function LiveCountBadge({
  count,
  loading,
  error,
}: {
  count: number | null;
  loading: boolean;
  error: string | null;
}) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count;
      fadeAnim.setValue(0.4);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [count, fadeAnim]);

  const estimatedMin = count !== null
    ? Math.max(1, Math.ceil((Math.min(count, 150) * SECONDS_PER_CARD) / 60))
    : null;

  return (
    <View
      style={{
        backgroundColor: colors.primary + '0E',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.primary + '33',
        padding: spacing.lg,
        alignItems: 'center',
        gap: spacing.xs,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : error ? (
        <Text variant="caption" color={colors.error} align="center">{error}</Text>
      ) : (
        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', gap: spacing.xs }}>
          <Text
            style={{
              fontFamily: fontFamilies.display,
              fontSize: fontSizes['3xl'],
              color: count === 0 ? colors.textDisabled : colors.primary,
              lineHeight: fontSizes['3xl'] * 1.1,
            }}
          >
            {count ?? '—'}
          </Text>
          <Text variant="caption" color={colors.textSecondary} align="center">
            {count === 0
              ? 'No cards match these filters'
              : count === 1
              ? `1 card due  ·  ~${estimatedMin} min`
              : `cards due  ·  ~${estimatedMin} min`}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Collapsible section ───────────────────────────────────────────────────────────────

function Section({
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  badge?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || (badge ?? 0) > 0);
  const { colors, spacing } = useTheme();

  useEffect(() => {
    if ((badge ?? 0) > 0) setOpen(true);
  }, [badge]);

  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <SectionHeader title={title} badge={badge} />
        <Text variant="caption" color={colors.textDisabled}>
          {open ? '▲' : '▼'}
        </Text>
      </Pressable>
      {open && children}
    </View>
  );
}

// ─── Organ search input ───────────────────────────────────────────────────────────────

function OrganPicker({
  availableOrgans,
  selected,
  onToggle,
}: {
  availableOrgans: string[];
  selected: string[];
  onToggle: (organ: string) => void;
}) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? availableOrgans.filter((o) =>
        o.toLowerCase().includes(query.toLowerCase())
      )
    : availableOrgans;

  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search organs…"
        placeholderTextColor={colors.textDisabled}
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSizes.sm,
          color: colors.text,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {filtered.slice(0, 30).map((organ) => (
          <Chip
            key={organ}
            label={organ}
            selected={selected.includes(organ)}
            onPress={() => onToggle(organ)}
            color={colors.tertiary}
          />
        ))}
        {filtered.length === 0 && (
          <Text variant="caption" color={colors.textDisabled}>No organs match</Text>
        )}
      </View>
    </View>
  );
}

// ─── Active filter pills (summary strip) ───────────────────────────────────────────────

function ActiveFilterStrip({
  filters,
  onClear,
}: {
  filters: QueueFilters;
  onClear: () => void;
}) {
  const { colors, spacing, radius } = useTheme();

  const pills: string[] = [
    ...(filters.bodySystems?.map((s) =>
      BODY_SYSTEMS.find((b) => b.value === s)?.label ?? s
    ) ?? []),
    ...(filters.regions ?? []),
    ...(filters.organs ?? []),
    ...(filters.difficultyMin !== null || filters.difficultyMax !== null
      ? [`Diff ${filters.difficultyMin ?? 1}–${filters.difficultyMax ?? 5}`]
      : []),
  ];

  if (pills.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
      {pills.map((pill) => (
        <View
          key={pill}
          style={{
            backgroundColor: colors.secondary + '18',
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.secondary }}>{pill}</Text>
        </View>
      ))}
      <Pressable
        onPress={onClear}
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ fontSize: 11, color: colors.error }}>Clear all</Text>
      </Pressable>
    </View>
  );
}

// ─── SessionFilter ───────────────────────────────────────────────────────────────────

interface SessionFilterProps {
  onStart: (filters: QueueFilters) => void;
  onDismiss?: () => void;
}

export function SessionFilter({ onStart, onDismiss }: SessionFilterProps) {
  const { colors, spacing, radius, fontFamilies, fontSizes } = useTheme();
  const {
    filters,
    liveCount,
    countLoading,
    countError,
    availableOrgans,
    activeFilterCount,
    toggleBodySystem,
    toggleRegion,
    toggleOrgan,
    setDifficultyRange,
    clearFilters,
  } = useSessionFilter();

  const selectedSystems = filters.bodySystems ?? [];
  const selectedRegions = filters.regions     ?? [];
  const selectedOrgans  = filters.organs      ?? [];

  const canStart = liveCount !== null && liveCount > 0 && !countLoading;

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
              Filter session
            </Text>
            <Text variant="body" color={colors.textSecondary}>
              Narrow your review queue. Leave all filters off to review everything due.
            </Text>
          </View>
          {onDismiss && (
            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingLeft: spacing.md })}
            >
              <Text variant="label" color={colors.textSecondary}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Live count */}
        <LiveCountBadge count={liveCount} loading={countLoading} error={countError} />

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <ActiveFilterStrip filters={filters} onClear={clearFilters} />
        )}

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.border }} />

        {/* ── Body System ── */}
        <Section
          title="Body System"
          badge={selectedSystems.length}
          defaultOpen
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {BODY_SYSTEMS.map(({ value, label }) => (
              <Chip
                key={value}
                label={label}
                selected={selectedSystems.includes(value)}
                onPress={() => toggleBodySystem(value)}
                color={colors.primary}
              />
            ))}
          </View>
        </Section>

        {/* ── Body Region ── */}
        <Section title="Body Region" badge={selectedRegions.length}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {BODY_REGIONS.map((region) => (
              <Chip
                key={region}
                label={region}
                selected={selectedRegions.includes(region)}
                onPress={() => toggleRegion(region)}
                color={colors.secondary}
              />
            ))}
          </View>
        </Section>

        {/* ── Organ ── */}
        <Section title="Organ" badge={selectedOrgans.length}>
          <OrganPicker
            availableOrgans={availableOrgans}
            selected={selectedOrgans}
            onToggle={toggleOrgan}
          />
        </Section>

        {/* ── Difficulty ── */}
        <Section
          title="Difficulty"
          badge={filters.difficultyMin !== null || filters.difficultyMax !== null ? 1 : 0}
        >
          <DifficultyPicker
            min={filters.difficultyMin}
            max={filters.difficultyMax}
            onChange={setDifficultyRange}
          />
        </Section>
      </ScrollView>

      {/* Sticky action bar */}
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
        <Button
          label={
            countLoading
              ? 'Counting cards…'
              : liveCount === 0
              ? 'No cards match'
              : liveCount === null
              ? 'Start Session'
              : `Start Session  ·  ${Math.min(liveCount, 150)} card${liveCount === 1 ? '' : 's'}`
          }
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canStart}
          loading={countLoading}
          onPress={() => onStart(filters)}
        />
        {activeFilterCount > 0 && (
          <Button
            label="Clear Filters"
            variant="ghost"
            size="md"
            fullWidth
            onPress={clearFilters}
          />
        )}
      </View>
    </View>
  );
}
