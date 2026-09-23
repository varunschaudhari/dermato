import { PermissionsAndroid, Platform } from 'react-native';
import { getMessaging, getToken, onTokenRefresh } from '@react-native-firebase/messaging';
import { registerPushToken } from '../api/client';

// Called once after a successful login/registration (see AuthContext.loginWithToken)
// and on app-start rehydration. Every failure mode here -- no Firebase project
// configured on this build, permission denied, no Google Play services on an
// emulator -- is silently swallowed: push is a nice-to-have, never something
// that should block or crash the rest of the app.
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }

    const messaging = getMessaging();
    const token = await getToken(messaging);
    await registerPushToken(token);

    onTokenRefresh(messaging, (refreshedToken: string) => {
      registerPushToken(refreshedToken).catch(() => {});
    });
  } catch {
    // See comment above -- nothing to do here.
  }
}
