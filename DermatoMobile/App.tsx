import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Home as HomeIcon, ScanFace, History as HistoryIcon, TrendingUp } from 'lucide-react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import AnalyzeScreen from './src/screens/AnalyzeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, typeof HomeIcon> = {
  Home: HomeIcon,
  Analyze: ScanFace,
  History: HistoryIcon,
  Progress: TrendingUp,
};

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 11, fontWeight: focused ? '700' : '500', color: focused ? '#0d9488' : '#9ca3af' }}>{label}</Text>;
}

function MainTabs() {
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

function RootNavigator() {
  const { loading, token } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
