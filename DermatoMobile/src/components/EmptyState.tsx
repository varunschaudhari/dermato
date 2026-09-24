import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants';

interface Props {
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  description?: string;
}

export default function EmptyState({ icon: Icon, title, description }: Props) {
  return (
    <View style={styles.container}>
      {Icon && (
        <View style={styles.iconWrap}>
          <Icon size={22} color={COLORS.teal} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: SPACING.xxl, paddingHorizontal: SPACING.lg },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { fontSize: 14, fontWeight: '600', color: COLORS.heading, textAlign: 'center' },
  description: { fontSize: 13, color: COLORS.secondaryText, marginTop: SPACING.xs, textAlign: 'center' },
});
