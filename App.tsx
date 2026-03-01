import React, { useEffect } from 'react';
import { LogBox, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackNavigatorParamsList } from './RootStackNavigator';

import HomePage from './screens/HomePage';
import HomeScreen from './screens/GoogleDriveScreen';
import RegisterScreen from './screens/RegisterScreen';
import LoginScreen from './screens/LoginScreen';

import { AuthProvider, useAuth } from './src/Contexts/AuthContext';
import { ThemeProvider } from './src/Contexts/ThemeContext';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
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

GoogleSignin.configure({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    webClientId: '182469331264-evqkdsma127oqs6ict1ckmhvcmdlk97n.apps.googleusercontent.com',
});

const Stack = createStackNavigator<RootStackNavigatorParamsList>();

const AppContent = () => {
    const { loggedInUser, setLoggedInUser } = useAuth();
    const [checkingAuth, setCheckingAuth] = React.useState(true);

    useEffect(() => {
        setPersistence(authentication, browserLocalPersistence)
            .then(() => {
                const unsubscribe = onAuthStateChanged(authentication, (user) => {
                    setLoggedInUser(user);
                    setCheckingAuth(false);
                });
                return unsubscribe;
            })
            .catch((error) => {
                console.error('Failed to set Firebase persistence:', error);
                setCheckingAuth(false);
            });
    }, []);

    if (checkingAuth) return null; // or a loading indicator

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
