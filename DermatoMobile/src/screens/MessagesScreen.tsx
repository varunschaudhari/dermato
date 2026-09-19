import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getMessages, sendMessage, MessageOut } from '../api/client';

export default function MessagesScreen() {
  const { patientId } = useAuth();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!patientId) return;
    const { data } = await getMessages(patientId);
    setMessages(data);
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Mirrors the web app's 30s polling — this screen has no push channel of its own.
      const interval = setInterval(load, 30000);
      return () => clearInterval(interval);
    }, [load])
  );

  const handleSend = async () => {
    const text = body.trim();
    if (!text || !patientId) return;
    setBody('');
    setSending(true);
    try {
      await sendMessage(patientId, text);
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>‹ Back</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Messages</Text>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 20, paddingTop: 8, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No messages yet — start the conversation with your dermatologist.</Text>
        }
        renderItem={({ item }) => {
          const mine = item.sender_role === 'patient';
          return (
            <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {!mine && <Text style={styles.senderName}>{item.sender_name}</Text>}
                <Text style={mine ? styles.bodyTextMine : styles.bodyText}>{item.body}</Text>
                <Text style={mine ? styles.timeTextMine : styles.timeText}>
                  {new Date(item.created_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Type a message..."
          style={styles.input}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!body.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!body.trim() || sending}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerRow: { paddingHorizontal: 20, paddingTop: 20 },
  backLink: { fontSize: 14, fontWeight: '600', color: '#0d9488' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', paddingHorizontal: 20, marginTop: 6 },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: '#0d9488' },
  bubbleTheirs: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3f4f6' },
  senderName: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 2 },
  bodyText: { fontSize: 14, color: '#1f2937' },
  bodyTextMine: { fontSize: 14, color: '#fff' },
  timeText: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  timeTextMine: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: { backgroundColor: '#0d9488', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  sendButtonDisabled: { backgroundColor: '#99d5cf' },
  sendButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
