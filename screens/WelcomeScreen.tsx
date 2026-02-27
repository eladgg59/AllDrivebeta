import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useState } from 'react';
import { SafeAreaView, Text, TouchableOpacity, Dimensions, Platform, Pressable } from "react-native";
import Animated, {
    FadeInDown,
    FadeInUp,
    withSpring,
    withTiming,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackNavigatorParamsList } from '../RootStackNavigator';

const { width } = Dimensions.get('window');
const MAX_BUTTON_WIDTH = 650; // Increased max width
const BUTTON_HEIGHT = 75; // Increased height

const WelcomeScreen = () => {
    const navigation = useNavigation<StackNavigationProp<RootStackNavigatorParamsList>>();
    const primaryButtonScale = useSharedValue(1);
    const secondaryButtonScale = useSharedValue(1);
    const [isPrimaryHovered, setIsPrimaryHovered] = useState(false);
    const [isSecondaryHovered, setIsSecondaryHovered] = useState(false);

    const primaryButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(primaryButtonScale.value) }],
    }));

    const secondaryButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(secondaryButtonScale.value) }],
    }));

    const handlePressIn = (buttonScale: Animated.SharedValue<number>) => {
        buttonScale.value = withSpring(0.95);
    };

    const handlePressOut = (buttonScale: Animated.SharedValue<number>) => {
        buttonScale.value = withSpring(1);
    };

    return (
        <LinearGradient
            colors={['#1a237e', '#4a148c']}
            style={{ flex: 1 }}
        >
            <SafeAreaView style={styles.container}>
                <Animated.View
                    entering={FadeInDown.duration(1000).springify()}
                    style={styles.logoContainer}
                >
                    <Text style={styles.title}>AllDrive</Text>
                    <Text style={styles.subtitle}>All your clouds in one place</Text>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(1000).springify().delay(300)}
                    style={styles.buttonContainer}
                >
                    <Animated.View style={primaryButtonStyle}>
                        <Pressable
                            style={[
                                styles.button,
                                { backgroundColor: '#fff' },
                                isPrimaryHovered && styles.buttonHovered
                            ]}
                            onPressIn={() => handlePressIn(primaryButtonScale)}
                            onPressOut={() => handlePressOut(primaryButtonScale)}
                            onPress={() => navigation.navigate("login")}
                            onHoverIn={() => setIsPrimaryHovered(true)}
                            onHoverOut={() => setIsPrimaryHovered(false)}
                        >
                            <Text style={[styles.buttonText, { color: '#4a148c' }]}>Sign In</Text>
                        </Pressable>
                    </Animated.View>

                    <Animated.View style={secondaryButtonStyle}>
                        <Pressable
                            style={[
                                styles.button,
                                styles.secondaryButton,
                                { borderColor: '#fff',borderWidth: 2},
                                isSecondaryHovered && styles.secondaryButtonHovered
                            ]}
                            onPressIn={() => handlePressIn(secondaryButtonScale)}
                            onPressOut={() => handlePressOut(secondaryButtonScale)}
                            onPress={() => navigation.navigate("register")}
                            onHoverIn={() => setIsSecondaryHovered(true)}
                            onHoverOut={() => setIsSecondaryHovered(false)}
                        >
                            <Text style={[styles.buttonText, { color: '#fff' }]}>Sign Up</Text>
                        </Pressable>
                    </Animated.View>
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
    logoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    title: {
        fontSize: 72, // Increased from 48
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 24, // Increased from 18
        fontWeight: '500',
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 40,
        textAlign: 'center',
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 50,
        marginTop: 'auto',
    },
    button: {
        width: Math.min(width - 40, MAX_BUTTON_WIDTH),
        height: BUTTON_HEIGHT,
        borderRadius: BUTTON_HEIGHT / 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        transition: 'all 0.3s ease',
    },
    buttonText: {
        fontSize: 24, // Increased from 20
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    buttonHovered: {
        backgroundColor: '#dadada', // light gray for Sign In
    },

    secondaryButtonHovered: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)', // translucent white overlay for Sign Up
    },
    // ... (other styles remain the same)
};

export default WelcomeScreen;
