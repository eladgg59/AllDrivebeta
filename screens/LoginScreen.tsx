import React, { useState, useRef, useEffect } from "react";
import {
    SafeAreaView,
    Text,
    TextInput,
    Platform,
    Dimensions,
    Pressable,
    ActivityIndicator,
    View,
    Animated,
    TouchableOpacity,
} from "react-native";
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackNavigatorParamsList } from '../RootStackNavigator';
import { authentication } from "../src/Firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "../src/Contexts/AuthContext";
import { useTheme } from "../src/Contexts/ThemeContext";
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const MAX_BUTTON_WIDTH = 650;
const BUTTON_HEIGHT = 75;

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type LoginScreenProps = {
    navigation: StackNavigationProp<RootStackNavigatorParamsList>;
};

const LoginScreen = ({ navigation }: LoginScreenProps) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { setLoggedInUser } = useAuth();
    const { isDark, toggleTheme, themeAnim } = useTheme();
    const buttonHoverAnim = useRef(new Animated.Value(0)).current;
    
    // Entrance Animations
    const formOpacity = useRef(new Animated.Value(0)).current;
    const formTranslateY = useRef(new Animated.Value(-50)).current;
    const btnOpacity = useRef(new Animated.Value(0)).current;
    const btnTranslateY = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(formOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.spring(formTranslateY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
            Animated.sequence([
                Animated.delay(300),
                Animated.parallel([
                    Animated.timing(btnOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
                    Animated.spring(btnTranslateY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true })
                ])
            ])
        ]).start();
    }, []);

    const handleHover = (isHovering: boolean) => {
        Animated.spring(buttonHoverAnim, {
            toValue: isHovering ? 1 : 0,
            useNativeDriver: false,
            friction: 8,
            tension: 40
        }).start();
    };

    const btnScale = buttonHoverAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
    const auraOpacity = buttonHoverAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

    const backgroundColor = themeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#ffffff', '#000000']
    });

    const textColor = themeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#0f172a', '#ffffff']
    });

    const inputBackgroundColor = themeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)']
    });

    const inputBorderColor = themeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(0,0,0,0.1)', 'rgba(148, 163, 184, 0.2)']
    });

    const blueColor = themeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#3b82f6', '#3b67f6']
    });

    const handleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        signInWithEmailAndPassword(authentication, email, password)
            .then((res) => {
                setLoggedInUser(res.user);
            })
            .catch(() => {
                setError("Incorrect Email/Password");
            })
            .finally(() => setIsLoading(false));
    };

    return (
        <Animated.View style={[styles.container, { backgroundColor }]}>
            <SafeAreaView style={{flex: 1, width: '100%'}}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.navigate('index')} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={isDark ? "#fff" : "#000"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
                        <MaterialCommunityIcons
                            name={isDark ? "white-balance-sunny" : "moon-waning-crescent"}
                            size={24}
                            color={isDark ? "#fff" : "#000"}
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.contentContainer}>
                <Animated.View
                    style={[styles.formContainer, { opacity: formOpacity, transform: [{ translateY: formTranslateY }] }]}
                >
                    <Animated.Text style={[styles.title, { color: textColor }]}>Sign In</Animated.Text>
                    <AnimatedTextInput
                        style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]}
                        placeholder="Email"
                        placeholderTextColor={isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)"}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <AnimatedTextInput
                        style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]}
                        placeholder="Password"
                        placeholderTextColor={isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)"}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                    {error && <Animated.Text style={styles.errorText}>{error}</Animated.Text>}
                </Animated.View>

                <Animated.View
                    style={[styles.buttonContainer, { opacity: btnOpacity, transform: [{ translateY: btnTranslateY }] }]}
                >
                    <Pressable
                        onPress={handleSignIn}
                        onHoverIn={() => handleHover(true)}
                        onHoverOut={() => handleHover(false)}
                        onPressIn={() => handleHover(true)}
                        onPressOut={() => handleHover(false)}
                    >
                        <Animated.View style={[styles.auraGlow, { backgroundColor: blueColor, opacity: auraOpacity, transform: [{ scale: btnScale }] }]} />
                        <Animated.View style={[styles.button, { backgroundColor: blueColor, transform: [{ scale: btnScale }] }]}>

                            <Text style={styles.buttonText}>
                                {isLoading ? 'Signing In...' : 'Sign In'}
                            </Text>
                            {isLoading && (
                                <ActivityIndicator
                                    size="small"
                                    color="#fff"
                                    style={styles.loader}
                                />
                            )}
                        </Animated.View>
                    </Pressable>

                    <Pressable
                        onPress={() => navigation.navigate('register')}
                        style={styles.registerLink}
                    >
                        <Animated.Text style={[styles.registerText, { color: textColor }]}>
                            Don't have an account? Sign Up
                        </Animated.Text>
                    </Pressable>
                </Animated.View>
                </View>
            </SafeAreaView>
        </Animated.View>
    );
};

const styles = {
    container: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 20,
    },
    header: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backButton: {
        padding: 10,
    },
    themeBtn: {
        padding: 10,
    },
    formContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center' as const, // Fix alignItems type
        width: '100%',
        maxWidth: MAX_BUTTON_WIDTH,
    },
    title: {
        fontSize: 60,
        fontWeight: '700' as const, // Fix fontWeight type
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        marginBottom: 40,
        textAlign: 'center' as const, // Fix textAlign type
    },
    input: {
        width: '100%', // This is valid for TextInput
        height: 60,
        borderRadius: 30,
        paddingHorizontal: 20,
        fontSize: 18,
        marginBottom: 20,
        borderWidth: 1,
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center' as const, // Fix alignItems type
        paddingBottom: 70,
        marginTop: 'auto',
    },
    button: {
        width: Math.min(width - 40, MAX_BUTTON_WIDTH),
        height: BUTTON_HEIGHT,
        borderRadius: BUTTON_HEIGHT / 2,
        justifyContent: 'center' as const, // Fix justifyContent type
        alignItems: 'center' as const, // Fix alignItems type
        flexDirection: 'row' as const, // Fix flexDirection type
    },
    auraGlow: {
        position: 'absolute',
        width: Math.min(width - 40, MAX_BUTTON_WIDTH),
        height: BUTTON_HEIGHT,
        borderRadius: BUTTON_HEIGHT / 2,
        ...Platform.select({ web: { filter: 'blur(25px)' }, default: { shadowColor: '#3b82f6', shadowRadius: 20, elevation: 20 } })
    },
    buttonText: {
        fontSize: 24,
        fontWeight: '700' as const, // Fix fontWeight type
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: '#fff',
        letterSpacing: 1.5,
        textTransform: 'uppercase' as const, // Fix textTransform type
        marginRight: 10,
    },
    loader: {
        marginLeft: 10,
    },
    registerLink: {
        marginTop: 20,
        padding: 10,
    },
    registerText: {
        fontSize: 16,
        textDecorationLine: 'underline' as const, // Fix textDecorationLine type
    },
    errorText: {
        color: '#e12c50',
        fontSize: 16,
        paddingBottom: 20,
    }
};

export default LoginScreen;
