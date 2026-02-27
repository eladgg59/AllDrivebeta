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
import { createUserWithEmailAndPassword } from "firebase/auth";
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

type RegisterScreenProps = {
    navigation: StackNavigationProp<RootStackNavigatorParamsList>;
};

const RegisterScreen = ({ navigation }: RegisterScreenProps) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { setLoggedInUser } = useAuth();
    const buttonScale = useSharedValue(1);
    const [isButtonHovered, setIsButtonHovered] = useState(false);

    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(buttonScale.value) }],
    }));

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1);
    };

    const handleSignUp = () => {
        if (password !== confirmPassword) {
            return;
        }
        setIsLoading(true);
        createUserWithEmailAndPassword(authentication, email, password)
            .then((res) => {
                setLoggedInUser(res.user);
            })
            .catch((err) => {
                console.log(err);
                console.log("\n\n\n",err.code);
                if (err.code === 'auth/weak-password'){
                    setError("Password should be at least 6 characters");
                }
                else if (err.code === 'auth/email-already-in-use'){
                    setError("Email already in use");
                }
                else {
                    setError("Account creation failed. Please retry");
                }
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
                    <Text style={styles.title}>Create Account</Text>
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
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        placeholderTextColor="rgba(255,255,255,0.7)"
                        secureTextEntry
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                    />
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(1000).springify().delay(300)}
                    style={styles.buttonContainer}
                >
                    <Text style={{color: '#e12c50', fontSize: "20px", paddingBottom: 20}}>{error}</Text>
                    <Animated.View style={buttonStyle}>
                        <Pressable
                            style={[
                                styles.button,
                                isButtonHovered && styles.buttonHovered
                            ]}
                            onPressIn={handlePressIn}
                            onPressOut={handlePressOut}
                            onPress={handleSignUp}
                            onHoverIn={() => setIsButtonHovered(true)}
                            onHoverOut={() => setIsButtonHovered(false)}
                        >
                            <Text style={styles.buttonText}>
                                {isLoading ? 'Creating Account...' : 'Sign Up'}
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
                        onPress={() => navigation.navigate('login')}
                        style={styles.registerLink}
                    >
                        <Text style={styles.registerText}>
                            Already have an account? Log In
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
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 40,
        width: '100%',
    },
    formContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: MAX_BUTTON_WIDTH,
    },
    title: {
        fontSize: 48,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: '#fff',
        marginBottom: 40,
        textAlign: 'center',
    },
    input: {
        width: '100%',
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
        alignItems: 'center',
        paddingBottom: 20,
    },
    button: {
        width: Math.min(width - 40, MAX_BUTTON_WIDTH),
        height: BUTTON_HEIGHT,
        borderRadius: BUTTON_HEIGHT / 2,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
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
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: '#4a148c',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
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
        textDecorationLine: 'underline',
    },
};

export default RegisterScreen;
