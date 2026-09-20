import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { COLORS } from '../constants';

// Shared "the request failed" state for screens that fetch on mount/focus —
// mirrors the web's QueryError. Without this, a failed fetch left several
// screens indistinguishable from "genuinely empty" (stale/default state with
// no error surfaced).
export default function ErrorState({
  message = "Couldn't load this.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <AlertTriangle size={28} color={COLORS.mutedGray} />
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  message: { fontSize: 13, color: COLORS.secondaryText, textAlign: 'center', marginTop: 10, marginBottom: 14 },
  retryButton: {
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { fontSize: 13, fontWeight: '600', color: COLORS.teal },
});
