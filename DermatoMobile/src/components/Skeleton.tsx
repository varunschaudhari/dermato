import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants';

export function SkeletonLine({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.line, { opacity }, style]} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          style={i === 0 ? { width: '35%' } : i === lines - 1 ? { width: '55%', marginBottom: 0 } : { width: '100%' }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { height: 14, borderRadius: RADIUS.sm, backgroundColor: COLORS.divider, marginBottom: SPACING.sm },
  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
