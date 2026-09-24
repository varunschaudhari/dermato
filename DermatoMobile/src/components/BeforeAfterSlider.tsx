import React, { useRef, useState } from 'react';
import { Animated, Image, ImageStyle, LayoutChangeEvent, PanResponder, StyleProp, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants';

// Drag-to-compare slider: "after" sits full-size underneath, "before" is
// stacked on top and clipped to an animated width that follows the touch, so
// dragging left/right reveals more of one photo or the other. Pure
// PanResponder + Animated -- no new native dependency (this app already
// avoids those for comparison UI, see ProgressScreen's TrendTrack comment).
export default function BeforeAfterSlider({
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
  const [containerWidth, setContainerWidth] = useState(0);
  const widthRef = useRef(0);
  const handleX = useRef(new Animated.Value(0)).current;
  const initialized = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setContainerWidth(w);
    if (!initialized.current) {
      initialized.current = true;
      handleX.setValue(w / 2);
    }
  };

  const moveHandleTo = (locationX: number) => {
    const x = Math.max(0, Math.min(widthRef.current, locationX));
    handleX.setValue(x);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => moveHandleTo(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => moveHandleTo(evt.nativeEvent.locationX),
    })
  ).current;

  return (
    <View
      onLayout={onLayout}
      style={[imageStyle, styles.container]}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={`Comparing ${beforeLabel} and ${afterLabel}. Drag to reveal more of either photo.`}
    >
      {containerWidth > 0 && (
        <>
          <Image
            source={{ uri: afterUri }}
            style={{ position: 'absolute', top: 0, left: 0, width: containerWidth, height: '100%' }}
            accessibilityLabel={`${afterLabel} photo`}
          />
          <Animated.View style={[styles.clip, { width: handleX }]}>
            <Image
              source={{ uri: beforeUri }}
              style={{ position: 'absolute', top: 0, left: 0, width: containerWidth, height: '100%' }}
              accessibilityLabel={`${beforeLabel} photo`}
            />
          </Animated.View>
          <Animated.View style={[styles.handle, { left: handleX }]} pointerEvents="none">
            <View style={styles.handleGrip} />
          </Animated.View>
        </>
      )}
      <View style={styles.labelLeft}>
        <Text style={styles.labelText}>{beforeLabel}</Text>
      </View>
      <View style={styles.labelRight}>
        <Text style={styles.labelText}>{afterLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  clip: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden' },
  handle: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: '#fff', alignItems: 'center' },
  handleGrip: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    marginLeft: -14,
    left: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  labelLeft: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  labelRight: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  labelText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
