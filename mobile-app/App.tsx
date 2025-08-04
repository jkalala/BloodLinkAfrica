import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import BloodRequestScreen from './src/screens/BloodRequestScreen';
import DonorMapScreen from './src/screens/DonorMapScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import USSDMenuScreen from './src/screens/USSDMenuScreen';
import WhatsAppScreen from './src/screens/WhatsAppScreen';
import OfflineMapsScreen from './src/screens/OfflineMapsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Components
import { AuthProvider } from './src/contexts/AuthContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { NotificationProvider } from './src/contexts/NotificationContext';

// Theme
import { theme } from './src/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.gray,
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.lightGray,
        },
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Request" 
        component={BloodRequestScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="plus-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Map" 
        component={DonorMapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="map" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <LocationProvider>
              <NotificationProvider>
                <NavigationContainer>
                  <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />
                  <Stack.Navigator
                    initialRouteName="Home"
                    screenOptions={{
                      headerStyle: {
                        backgroundColor: theme.colors.primary,
                      },
                      headerTintColor: theme.colors.white,
                      headerTitleStyle: {
                        fontWeight: 'bold',
                      },
                    }}
                  >
                    <Stack.Screen 
                      name="Home" 
                      component={HomeScreen}
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen 
                      name="Login" 
                      component={LoginScreen}
                      options={{ title: 'Sign In' }}
                    />
                    <Stack.Screen 
                      name="Register" 
                      component={RegisterScreen}
                      options={{ title: 'Create Account' }}
                    />
                    <Stack.Screen 
                      name="MainApp" 
                      component={TabNavigator}
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen 
                      name="Notifications" 
                      component={NotificationsScreen}
                      options={{ title: 'Notifications' }}
                    />
                    <Stack.Screen 
                      name="History" 
                      component={HistoryScreen}
                      options={{ title: 'Donation History' }}
                    />
                    <Stack.Screen 
                      name="USSDMenu" 
                      component={USSDMenuScreen}
                      options={{ title: 'USSD Menu' }}
                    />
                    <Stack.Screen 
                      name="WhatsApp" 
                      component={WhatsAppScreen}
                      options={{ title: 'WhatsApp Integration' }}
                    />
                    <Stack.Screen 
                      name="OfflineMaps" 
                      component={OfflineMapsScreen}
                      options={{ title: 'Offline Maps' }}
                    />
                    <Stack.Screen 
                      name="Settings" 
                      component={SettingsScreen}
                      options={{ title: 'Settings' }}
                    />
                  </Stack.Navigator>
                </NavigationContainer>
              </NotificationProvider>
            </LocationProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
} 