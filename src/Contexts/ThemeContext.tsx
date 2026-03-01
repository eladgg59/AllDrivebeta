import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'theme_preference';

interface ThemeContextType {
    isDark: boolean;
    toggleTheme: () => void;
    themeAnim: Animated.Value;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [isDark, setIsDark] = useState(true);
    const themeAnim = useRef(new Animated.Value(1)).current; // 1 for dark, 0 for light

    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(THEME_KEY);
                if (savedTheme !== null) {
                    const isDarkTheme = savedTheme === 'dark';
                    setIsDark(isDarkTheme);
                    themeAnim.setValue(isDarkTheme ? 1 : 0);
                }
            } catch (error) {
                console.error('Failed to load theme from storage', error);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = () => {
        const newIsDark = !isDark;
        setIsDark(newIsDark);
        Animated.timing(themeAnim, {
            toValue: newIsDark ? 1 : 0,
            duration: 400,
            useNativeDriver: false,
        }).start();
        AsyncStorage.setItem(THEME_KEY, newIsDark ? 'dark' : 'light').catch(error => {
            console.error('Failed to save theme to storage', error);
        });
    };

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, themeAnim }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};