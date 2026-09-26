import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BootSplash from 'react-native-bootsplash';
import { Home as HomeIcon, ScanFace, History as HistoryIcon, TrendingUp, Users, MessageCircle, LayoutDashboard, CalendarClock } from 'lucide-react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { SelectedPatientProvider } from './src/context/SelectedPatientContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import AnalyzeScreen from './src/screens/AnalyzeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import PatientListScreen from './src/screens/PatientListScreen';
import MessagesInboxScreen from './src/screens/MessagesInboxScreen';
import DoctorHomeScreen from './src/screens/DoctorHomeScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import ReportScreen from './src/screens/ReportScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, typeof HomeIcon> = {
  Home: HomeIcon,
  Analyze: ScanFace,
  History: HistoryIcon,
  Progress: TrendingUp,
  Patients: Users,
  MessagesInbox: MessageCircle,
  Worklist: LayoutDashboard,
  AppointmentsTab: CalendarClock,
};

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 11, fontWeight: focused ? '700' : '500', color: focused ? '#0d9488' : '#9ca3af' }}>{label}</Text>;
}

// Patient tab bar -- unchanged from before dermatologist mobile access existed.
function PatientTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0d9488',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarIcon: ({ color, size }) => {
          const Icon = TAB_ICONS[route.name];
          return Icon ? <Icon color={color} size={size ?? 22} /> : null;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} /> }} />
      <Tab.Screen name="Analyze" component={AnalyzeScreen} options={{ tabBarLabel: ({ focused }) => <TabLabel label="Analyze" focused={focused} /> }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: ({ focused }) => <TabLabel label="History" focused={focused} /> }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ tabBarLabel: ({ focused }) => <TabLabel label="Progress" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// Dermatologist tab bar -- built up incrementally across phases: Phase 1
// (this one) ships Patients only; Phase 2 adds Messages; Phase 3 adds
// Worklist (as the first/home tab) and promotes Appointments into the tab
// bar. Analyze/History/Progress are deliberately NOT tabs here -- they're
// root-Stack screens (see RootNavigator below) reachable only via an
// explicit navigate() from PatientListScreen (and, from Phase 2/3 on,
// DoctorHomeScreen/MessagesInboxScreen), each of which sets
// SelectedPatientContext first. Tabs don't propagate params when tapped
// directly, so a Context is what makes "which patient" survive switching tabs.
function DoctorTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0d9488',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarIcon: ({ color, size }) => {
          const Icon = TAB_ICONS[route.name];
          return Icon ? <Icon color={color} size={size ?? 22} /> : null;
        },
      })}
    >
      <Tab.Screen name="Worklist" component={DoctorHomeScreen} options={{ tabBarLabel: ({ focused }) => <TabLabel label="Worklist" focused={focused} /> }} />
      <Tab.Screen name="Patients" component={PatientListScreen} options={{ tabBarLabel: ({ focused }) => <TabLabel label="Patients" focused={focused} /> }} />
      {/* Route names deliberately differ from the root-Stack "Messages" and
          "Appointments" screens (this tab bar's own screens, plus other
          screens like ResultsScreen/DoctorHomeScreen, navigate to those by
          name) -- the same route name at two nesting levels in one active
          tree would make navigate('Messages')/navigate('Appointments')
          ambiguous. Tab labels still read "Messages"/"Appointments" to match
          web's nav. */}
      <Tab.Screen name="MessagesInbox" component={MessagesInboxScreen} options={{ tabBarLabel: ({ focused }) => <TabLabel label="Messages" focused={focused} /> }} />
      <Tab.Screen name="AppointmentsTab" component={AppointmentsScreen} options={{ tabBarLabel: ({ focused }) => <TabLabel label="Appointments" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { loading, token, role } = useAuth();

  // Keeps the native splash up through the initial auth check (AuthContext's
  // AsyncStorage/getMe round-trip) instead of hiding it into a bare
  // ActivityIndicator -- one continuous cold-start visual, no flash between them.
  useEffect(() => {
    if (!loading) BootSplash.hide({ fade: true });
  }, [loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token && role === 'dermatologist' ? (
        <>
          <Stack.Screen name="MainTabs" component={DoctorTabs} />
          <Stack.Screen name="Analyze" component={AnalyzeScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Progress" component={ProgressScreen} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="Report" component={ReportScreen} />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Appointments" component={AppointmentsScreen} />
        </>
      ) : token ? (
        <>
          <Stack.Screen name="MainTabs" component={PatientTabs} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="Report" component={ReportScreen} />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Appointments" component={AppointmentsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <SelectedPatientProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SelectedPatientProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
