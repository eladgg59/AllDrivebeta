import React, { useState } from "react";
import {
    SafeAreaView,
    Text,
    TextInput,
    Platform,
    Dimensions,
    Pressable,
    ActivityIndicator,
} from "react-native";
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackNavigatorParamsList } from '../RootStackNavigator';
import { authentication } from "../src/Firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "../src/Contexts/AuthContext";
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const MAX_BUTTON_WIDTH = 650;
const BUTTON_HEIGHT = 75;

type LoginScreenProps = {
    navigation: StackNavigationProp<RootStackNavigatorParamsList>;
};

const LoginScreen = ({ navigation }: LoginScreenProps) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isButtonHovered, setIsButtonHovered] = useState(false);
    const { setLoggedInUser } = useAuth();
    const buttonScale = useSharedValue(1);

    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(buttonScale.value) }],
    }));

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1);
    };

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
        <LinearGradient
            colors={['#1a237e', '#4a148c']}
            style={{ flex: 1 }}
        >
            <SafeAreaView style={styles.container}>
                <Animated.View
                    entering={FadeInDown.duration(1000).springify()}
                    style={styles.formContainer}
                >
                    <Text style={styles.title}>Sign In</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="rgba(255,255,255,0.7)"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="rgba(255,255,255,0.7)"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                    {error && <Text style={styles.errorText}>{error}</Text>}
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(1000).springify().delay(300)}
                    style={styles.buttonContainer}
                >
                    <Animated.View style={buttonStyle}>
                        <Pressable
                            style={[
                                styles.button,
                                isButtonHovered && styles.buttonHovered
                            ]}
                            onPressIn={handlePressIn}
                            onPressOut={handlePressOut}
                            onPress={handleSignIn}
                            onHoverIn={() => setIsButtonHovered(true)}
                            onHoverOut={() => setIsButtonHovered(false)}
                        >
                            <Text style={styles.buttonText}>
                                {isLoading ? 'Signing In...' : 'Sign In'}
                            </Text>
                            {isLoading && (
                                <ActivityIndicator
                                    size="small"
                                    color="#4a148c"
                                    style={styles.loader}
                                />
                            )}
                        </Pressable>
                    </Animated.View>

                    <Pressable
                        onPress={() => navigation.navigate('register')}
                        style={styles.registerLink}
                    >
                        <Text style={styles.registerText}>
                            Don't have an account? Sign Up
                        </Text>
                    </Pressable>
                </Animated.View>
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = {
    container: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center' as const, // Fix alignItems type
        paddingHorizontal: 20,
        paddingVertical: 40,
        width: '100%',
    },
    formContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center' as const, // Fix alignItems type
        width: '100%',
        maxWidth: MAX_BUTTON_WIDTH,
    },
    title: {
        fontSize: 48,
        fontWeight: '700' as const, // Fix fontWeight type
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: '#fff',
        marginBottom: 40,
        textAlign: 'center' as const, // Fix textAlign type
    },
    input: {
        width: '100%', // This is valid for TextInput
        height: 60,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 30,
        paddingHorizontal: 20,
        fontSize: 18,
        color: '#fff',
        marginBottom: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center' as const, // Fix alignItems type
        paddingBottom: 20,
    },
    button: {
        width: Math.min(width - 40, MAX_BUTTON_WIDTH),
        height: BUTTON_HEIGHT,
        borderRadius: BUTTON_HEIGHT / 2,
        backgroundColor: '#fff',
        justifyContent: 'center' as const, // Fix justifyContent type
        alignItems: 'center' as const, // Fix alignItems type
        flexDirection: 'row' as const, // Fix flexDirection type
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    buttonText: {
        fontSize: 24,
        fontWeight: '700' as const, // Fix fontWeight type
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: '#4a148c',
        letterSpacing: 1.5,
        textTransform: 'uppercase' as const, // Fix textTransform type
        marginRight: 10,
    },
    buttonHovered: {
        backgroundColor: '#dadada',
    },
    loader: {
        marginLeft: 10,
    },
    registerLink: {
        marginTop: 20,
        padding: 10,
    },
    registerText: {
        color: '#fff',
        fontSize: 16,
        textDecorationLine: 'underline' as const, // Fix textDecorationLine type
    },
};

export default LoginScreen;
