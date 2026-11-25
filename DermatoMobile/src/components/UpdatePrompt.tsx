import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppVersionInfo } from '../api/client';
import { APP_VERSION, SNOOZE_MS, UpdateDecision, decideUpdate, isSnoozed } from '../services/appUpdate';
import { COLORS } from '../constants';

const SNOOZE_KEY = 'updatePromptSnooze';
// Re-check when the app comes back to the foreground, at most this often.
const RECHECK_MS = 60 * 60 * 1000;

async function readSnooze(): Promise<{ version: string; until: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function UpdatePrompt() {
  const [update, setUpdate] = useState<UpdateDecision>({ kind: 'none' });
  const [visible, setVisible] = useState(false);
  const lastCheckRef = useRef(0);

  const check = useCallback(async () => {
    lastCheckRef.current = Date.now();
    try {
      const { data } = await getAppVersionInfo();
      const decision = decideUpdate(data);
      if (decision.kind === 'none') {
        setVisible(false);
        return;
      }
      if (decision.kind === 'optional' && isSnoozed(await readSnooze(), decision.latestVersion)) return;
      setUpdate(decision);
      setVisible(true);
    } catch {
      // Offline or server unreachable: just don't prompt; the next launch retries.
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastCheckRef.current > RECHECK_MS) check();
    });
    return () => sub.remove();
  }, [check]);

  if (update.kind === 'none') return null;
  const required = update.kind === 'required';

  const later = async () => {
    if (required) return;
    setVisible(false);
    try {
      await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify({ version: update.latestVersion, until: Date.now() + SNOOZE_MS }));
    } catch {
      // Not persisted: worst case the prompt shows again next launch.
    }
  };

  const download = () => {
    Linking.openURL(update.downloadUrl).catch(() => {});
    // A required update stays on screen so the old version can't be used.
    if (!required) setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={later} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{required ? 'Update required' : 'Update available'}</Text>
          <Text style={styles.body}>
            {required
              ? `This version of Dermato (${APP_VERSION}) is no longer supported. Install version ${update.latestVersion} to keep using the app.`
              : `Dermato ${update.latestVersion} is ready. You have ${APP_VERSION}.`}
          </Text>
          <Text style={styles.hint}>
            Your browser will download the update. Open the downloaded file to install it. Your data and login are kept.
          </Text>
          {update.releaseUrl ? (
            <TouchableOpacity onPress={() => Linking.openURL(update.releaseUrl!).catch(() => {})} accessibilityRole="link">
              <Text style={styles.link}>What's new</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.actions}>
            {!required && (
              <TouchableOpacity style={styles.secondary} onPress={later} accessibilityRole="button" accessibilityLabel="Remind me later">
                <Text style={styles.secondaryText}>Later</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.primary} onPress={download} accessibilityRole="button" accessibilityLabel="Download update">
              <Text style={styles.primaryText}>Download update</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.heading, marginBottom: 8 },
  body: { fontSize: 14, color: '#374151', lineHeight: 20 },
  hint: { fontSize: 12, color: COLORS.secondaryText, lineHeight: 17, marginTop: 10 },
  link: { fontSize: 13, color: COLORS.teal, fontWeight: '600', marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  secondary: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16 },
  secondaryText: { color: COLORS.secondaryText, fontWeight: '600', fontSize: 14 },
  primary: { backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
