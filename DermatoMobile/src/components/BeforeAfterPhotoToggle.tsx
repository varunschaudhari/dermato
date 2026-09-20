import React, { useRef, useState } from 'react';
import { Animated, Image, ImageStyle, StyleProp, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Shared "tap the photo, cross-fade to the other one" mechanic used by both
// ProgressScreen (first vs. latest scan) and ResultsScreen (previous visit
// vs. today) — each screen keeps its own surrounding card/title/date chrome.
export default function BeforeAfterPhotoToggle({
  beforeUri,
  afterUri,
  beforeLabel,
  afterLabel,
  imageStyle,
}: {
  beforeUri: string;
  afterUri: string;
  beforeLabel: string;
  afterLabel: string;
  imageStyle: StyleProp<ImageStyle>;
}) {
  const [showAfter, setShowAfter] = useState(true);
  const fade = useRef(new Animated.Value(1)).current;

  const toggle = () => {
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setShowAfter((v) => !v);
      Animated.timing(fade, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    });
  };

  const shownUri = showAfter ? afterUri : beforeUri;
  const shownLabel = showAfter ? afterLabel : beforeLabel;
  const otherLabel = showAfter ? beforeLabel : afterLabel;

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Showing ${shownLabel}. Tap to compare with ${otherLabel}.`}
    >
      <Animated.View style={{ opacity: fade }}>
        <Image source={{ uri: shownUri }} style={imageStyle} accessibilityLabel={`${shownLabel} photo`} />
      </Animated.View>
      <View style={styles.compareLabel}>
        <Text style={styles.compareLabelText}>{shownLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  compareLabel: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  compareLabelText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
