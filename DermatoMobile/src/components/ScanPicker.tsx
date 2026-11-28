import React, { useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { absoluteUrl, SessionOut } from '../api/client';
import { COLORS, SEVERITY_META } from '../constants';
import { ScanType } from '../utils/scanTypes';
import { buildScanPickerItems, ScanPickerItem } from '../utils/scanMonths';

// Fixed row heights let FlatList open at the selected scan without measuring.
const MONTH_H = 34;
const ROW_H = 68;

type Props = {
  label: string; // "Before" / "After"
  otherLabel: string; // the opposite side, for "Used as After"
  sessions: SessionOut[]; // comparable scans, oldest first
  type: ScanType; // whose severity each row shows
  selectedIndex: number;
  otherIndex: number; // chosen on the other side, so not pickable here
  markUntagged: (s: SessionOut) => boolean;
  onSelect: (index: number) => void;
};

const shortDate = (s: SessionOut) => new Date(s.captured_at).toLocaleDateString();
const longDate = (s: SessionOut) =>
  new Date(s.captured_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// A one-line button showing the chosen scan; tapping it opens a bottom sheet
// listing every comparable scan by month. Keeps the Before & After card the
// same height however many scans a patient has.
export default function ScanPicker({ label, otherLabel, sessions, type, selectedIndex, otherIndex, markUntagged, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = sessions[selectedIndex];

  const { items, offsets, monthIndices } = useMemo(() => {
    const list = buildScanPickerItems(sessions);
    const offs: number[] = [];
    let y = 0;
    for (const it of list) {
      offs.push(y);
      y += it.kind === 'month' ? MONTH_H : ROW_H;
    }
    return {
      items: list,
      offsets: offs,
      monthIndices: list.flatMap((it, i) => (it.kind === 'month' ? [i] : [])),
    };
  }, [sessions]);

  if (!selected) return null;

  // Open with the selected scan near the top, its month header just above it.
  const selectedRow = items.findIndex((it) => it.kind === 'scan' && it.index === selectedIndex);
  const initialScrollIndex = Math.max(0, selectedRow - 1);

  const close = () => setOpen(false);

  const renderItem = ({ item }: { item: ScanPickerItem<SessionOut> }) => {
    if (item.kind === 'month') {
      return (
        <View style={styles.monthRow} accessibilityRole="header">
          <Text style={styles.monthText}>{item.title}</Text>
        </View>
      );
    }
    const { session: s, index } = item;
    const isSelected = index === selectedIndex;
    const taken = index === otherIndex;
    const sev = s[`${type}_severity` as keyof SessionOut] as string | undefined;
    const meta = sev ? SEVERITY_META[sev] : undefined;
    const untagged = markUntagged(s);
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        disabled={taken}
        onPress={() => {
          onSelect(index);
          close();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: taken }}
        accessibilityLabel={[longDate(s), meta?.label, untagged && 'untagged', taken && `already used as ${otherLabel}`]
          .filter(Boolean)
          .join(', ')}
      >
        <Image source={{ uri: absoluteUrl(s.image_url) }} style={[styles.thumb, taken && styles.faded]} />
        <View style={[styles.rowBody, taken && styles.faded]}>
          <Text style={styles.rowDate}>{longDate(s)}</Text>
          <View style={styles.rowMeta}>
            {meta && (
              <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            )}
            {untagged && (
              <View style={styles.untagged}>
                <View style={styles.dot} />
                <Text style={styles.metaText}>Untagged</Text>
              </View>
            )}
            {taken && <Text style={styles.metaText}>Used as {otherLabel}</Text>}
          </View>
        </View>
        {isSelected && <Check size={18} color={COLORS.teal} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} scan: ${longDate(selected)}${markUntagged(selected) ? ', untagged' : ''}`}
        accessibilityHint={`Opens the list of ${sessions.length} scans to choose from`}
      >
        {markUntagged(selected) && <View style={styles.dot} />}
        <Text style={styles.buttonText} numberOfLines={1}>
          {shortDate(selected)}
        </Text>
        <ChevronDown size={16} color={COLORS.secondaryText} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]} accessibilityViewIsModal>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Choose {label.toLowerCase()} scan</Text>
                <Text style={styles.sheetCount}>{sessions.length} scans</Text>
              </View>
              <TouchableOpacity onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
                <X size={20} color={COLORS.secondaryText} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={items}
              keyExtractor={(it) => it.key}
              renderItem={renderItem}
              getItemLayout={(_, i) => ({ length: items[i].kind === 'month' ? MONTH_H : ROW_H, offset: offsets[i], index: i })}
              initialScrollIndex={initialScrollIndex}
              stickyHeaderIndices={monthIndices}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { fontSize: 11, color: COLORS.mutedGray, marginBottom: 4 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.heading },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '80%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.heading },
  sheetCount: { fontSize: 12, color: COLORS.secondaryText, marginTop: 2 },

  // Opaque so rows don't show through while the header is stuck.
  monthRow: { height: MONTH_H, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#f9fafb' },
  monthText: { fontSize: 12, fontWeight: '700', color: COLORS.secondaryText },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  rowSelected: { backgroundColor: COLORS.tealSoft },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.divider },
  rowBody: { flex: 1 },
  rowDate: { fontSize: 14, fontWeight: '600', color: COLORS.heading },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '600' },
  untagged: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: COLORS.mutedGray },
  faded: { opacity: 0.4 },
});
