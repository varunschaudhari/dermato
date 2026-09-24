import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, AlertOctagon, Info, X } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../constants';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  anim: Animated.Value;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, typeof CheckCircle2> = { success: CheckCircle2, error: AlertOctagon, info: Info };
const ICON_COLORS: Record<ToastType, string> = { success: COLORS.success, error: COLORS.danger, info: COLORS.teal };

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId++;
      const anim = new Animated.Value(0);
      setToasts((prev) => [...prev, { id, type, message, anim }]);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 4 }).start();
      const timer = setTimeout(() => dismiss(id), 4000);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.container, { top: insets.top + SPACING.sm }]}>
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <Animated.View
              key={t.id}
              style={[
                styles.toast,
                {
                  opacity: t.anim,
                  transform: [{ translateY: t.anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
                },
              ]}
            >
              <Icon size={18} color={ICON_COLORS[t.type]} style={styles.icon} />
              <Text style={styles.message}>{t.message}</Text>
              <TouchableOpacity onPress={() => dismiss(t.id)} accessibilityRole="button" accessibilityLabel="Dismiss notification" hitSlop={8}>
                <X size={16} color={COLORS.mutedGray} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, zIndex: 999, gap: SPACING.sm },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#fff',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  icon: { marginTop: 1 },
  message: { flex: 1, fontSize: 13, color: COLORS.heading, lineHeight: 18 },
});
