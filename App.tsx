import React, { useState, useCallback } from 'react';
import {
  View,
  SafeAreaView,
  StatusBar,
  Platform,
  Pressable,
  Modal,
} from 'react-native';
import { useAppFonts, useTheme } from './src/theme';
import { Text } from './src/components/Text';
import { HomeScreen } from './src/screens/HomeScreen';
import { SessionFilter } from './src/components/SessionFilter';
import { ReviewSession } from './src/components/ReviewSession';
import { AnkiImport } from './src/components/AnkiImport';
import { CardGeneration } from './src/components/CardGeneration';
import { type QueueFilters } from './src/hooks/useReviewQueue';

// ─── Screen types ─────────────────────────────────────────────────────────────

type Screen =
  | { id: 'home' }
  | { id: 'filter' }
  | { id: 'review'; filters: QueueFilters }
  | { id: 'anki' }
  | { id: 'generate' };

// ─── Modal sheet wrapper ────────────────────────────────────────────────────

function ModalSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { colors, spacing, fontFamilies, fontSizes } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.displayMedium,
              fontSize: fontSizes.lg,
              color: colors.text,
            }}
          >
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemiBold,
                fontSize: fontSizes.md,
                color: colors.primary,
              }}
            >
              Close
            </Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────────

function RootNavigator() {
  const { colors } = useTheme();
  const [screen, setScreen] = useState<Screen>({ id: 'home' });

  const goHome = useCallback(() => setScreen({ id: 'home' }), []);

  const handleStartReview   = useCallback(() => setScreen({ id: 'filter' }), []);
  const handleImportAnki    = useCallback(() => setScreen({ id: 'anki' }), []);
  const handleGenerateCards = useCallback(() => setScreen({ id: 'generate' }), []);

  const handleFilterStart = useCallback((filters: QueueFilters) => {
    setScreen({ id: 'review', filters });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        <HomeScreen
          onStartReview={handleStartReview}
          onImportAnki={handleImportAnki}
          onGenerateCards={handleGenerateCards}
        />
      </SafeAreaView>

      <ModalSheet visible={screen.id === 'filter'} onClose={goHome} title="Filter Session">
        <SessionFilter onStart={handleFilterStart} />
      </ModalSheet>

      <ModalSheet visible={screen.id === 'review'} onClose={goHome} title="Review">
        {screen.id === 'review' && (
          <ReviewSession filters={screen.filters} onDismiss={goHome} />
        )}
      </ModalSheet>

      <ModalSheet visible={screen.id === 'anki'} onClose={goHome} title="Import from Anki">
        <AnkiImport onDismiss={goHome} />
      </ModalSheet>

      <ModalSheet visible={screen.id === 'generate'} onClose={goHome} title="Generate Cards">
        <CardGeneration onDismiss={goHome} />
      </ModalSheet>
    </View>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [fontsLoaded, fontError] = useAppFonts();

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#0D1F6E' }} />;
  }

  return (
    <>
      <StatusBar barStyle="dark-content" translucent={Platform.OS === 'android'} />
      <RootNavigator />
    </>
  );
}
