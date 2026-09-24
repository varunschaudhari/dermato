import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertOctagon } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../constants';

export default function FormError({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <AlertOctagon size={16} color={COLORS.danger} style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.md,
  },
  icon: { marginTop: 1 },
  text: { flex: 1, fontSize: 13, color: COLORS.danger, lineHeight: 18 },
});
