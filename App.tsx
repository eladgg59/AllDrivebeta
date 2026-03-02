import React, { useEffect } from 'react';
import { LogBox, StyleSheet, Platform, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackNavigatorParamsList } from './RootStackNavigator';

import HomePage from './screens/HomePage';
import HomeScreen from './screens/GoogleDriveScreen';
import RegisterScreen from './screens/RegisterScreen';
import LoginScreen from './screens/LoginScreen';

import { AuthProvider, useAuth } from './src/Contexts/AuthContext';
import { ThemeProvider } from './src/Contexts/ThemeContext';
import { onAuthStateChanged } from 'firebase/auth';
import { authentication } from './src/Firebase/config';

LogBox.ignoreAllLogs();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    html, body { overflow: auto !important; height: 100%; } 
    #root { min-height: 100%; }
    
    /* Custom Scrollbar Styling */
    ::-webkit-scrollbar {
      width: 0px;
      height: 12px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(0,0,0,0);
    }
    ::-webkit-scrollbar-thumb {
      background-color: rgba(150, 150, 150, 0.5);
      border-radius: 10px;
      border: 3px solid transparent;
      background-clip: content-box;
    }
    ::-webkit-scrollbar-thumb:hover {
      background-color: rgba(150, 150, 150, 0.8);
    }
  `;
  document.head.appendChild(style);
}

const Stack = createStackNavigator<RootStackNavigatorParamsList>();

const AppContent = () => {
    const { loggedInUser, setLoggedInUser } = useAuth();
    const [checkingAuth, setCheckingAuth] = React.useState(true);

    useEffect(() => {
        let mounted = true;
        const unsubscribe = onAuthStateChanged(authentication, (user) => {
            if (mounted) {
                setLoggedInUser(user);
                setCheckingAuth(false);
            }
        });
        const timeout = setTimeout(() => {
            if (mounted) setCheckingAuth(false);
        }, 5000);
        return () => {
            mounted = false;
            unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    if (checkingAuth) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <Stack.Navigator>
            {loggedInUser ? (
                <>
                    <Stack.Screen name="home" component={HomeScreen} options={{ headerShown: false }} />
                </>
            ) : (
                <>
                    <Stack.Screen name="index" component={HomePage} options={{ headerShown: false }} />
                    <Stack.Screen name="login" component={LoginScreen} options={{ headerShown: false }} />
                    <Stack.Screen name="register" component={RegisterScreen} options={{ headerShown: false }} />
                </>
            )}
        </Stack.Navigator>
    );
};

export default function App() {
    return (
        <NavigationContainer>
            <ThemeProvider>
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </ThemeProvider>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
});
