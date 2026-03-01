import React, { useEffect } from 'react';
import { LogBox, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackNavigatorParamsList } from './RootStackNavigator';

import HomeScreen from './screens/GoogleDriveScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import RegisterScreen from './screens/RegisterScreen';
import LoginScreen from './screens/LoginScreen';
import AccountAddScreen from './screens/AccountAddScreen';
import DropboxScreen from './screens/DropboxScreen';
import HomeScreenOneDrive from './screens/HomeScreenOneDrive';
import AllDriveScreen from './screens/AllDriveScreen';

import { AuthProvider, useAuth } from './src/Contexts/AuthContext';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { authentication } from './src/Firebase/config';

LogBox.ignoreAllLogs();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'html, body { overflow: auto !important; height: 100%; } #root { min-height: 100%; }';
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
                    <Stack.Screen name="AccountAdd" component={AccountAddScreen} options={{ headerShown: false }} />
                    <Stack.Screen name="dropbox" component={DropboxScreen} options={{ headerShown: false }} />
                    <Stack.Screen name="HomeScreenOneDrive" component={HomeScreenOneDrive} options={{ headerShown: false }} />
                    <Stack.Screen name="AllDriveScreen" component={AllDriveScreen} options={{ headerShown: false }} />
                </>
            ) : (
                <>
                    <Stack.Screen name="welcome" component={WelcomeScreen} options={{ headerShown: false }} />
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
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
});
