import React, { useState } from 'react';
import { SafeAreaView, Text, Pressable, Dimensions, Platform } from 'react-native';
import Animated, {
    FadeInDown,
    FadeInUp,
    withSpring,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackNavigatorParamsList } from '../RootStackNavigator';
import HomeScreenOneDrive from './HomeScreenOneDrive';
const { width } = Dimensions.get('window');
const MAX_BUTTON_WIDTH = 650;
const BUTTON_HEIGHT = 75;

const AccountAddScreen = () => {
    const navigation = useNavigation<StackNavigationProp<RootStackNavigatorParamsList>>();
    const buttonScales = {
        google: useSharedValue(1),
        dropbox: useSharedValue(1),
        onedrive: useSharedValue(1)
    };
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);

    const getButtonStyle = (key: keyof typeof buttonScales) => useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(buttonScales[key].value) }],
    }));

    const handlePressIn = (key: keyof typeof buttonScales) => {
        buttonScales[key].value = withSpring(0.95);
    };

    const handlePressOut = (key: keyof typeof buttonScales) => {
        buttonScales[key].value = withSpring(1);
    };

    return (
        <LinearGradient
            colors={['#1a237e', '#4a148c']}
            style={{ flex: 1 }}
        >
            <SafeAreaView style={styles.container}>
                <Animated.View
                    entering={FadeInDown.duration(1000).springify()}
                    style={styles.headerContainer}
                >
                    <Text style={styles.title}>Add Account</Text>
                    <Text style={styles.subtitle}>Choose a cloud service to connect</Text>
                </Animated.View>

                <Animated.View
                    entering={FadeInUp.duration(1000).springify().delay(300)}
                    style={styles.buttonContainer}
                >
                    {[
                        {
                            key: 'google',
                            text: 'Google Drive',
                            icon: 'google-drive',
                            color: '#4285F4',
                            onPress: () => navigation.navigate('home')
                        },
                        {
                            key: 'onedrive',
                            text: 'OneDrive+Google Drive',
                            color: '#0078D4',
                            onPress: () => navigation.navigate('AllDriveScreen')
                        },
                        {
                            key: 'onedrive',
                            text: 'OneDrive',
                            icon: 'microsoft-onedrive',
                            color: '#0078D4',
                            onPress: () => navigation.navigate('HomeScreenOneDrive')
                        },
                    ].map((item) => (
                        <Animated.View key={item.key} style={getButtonStyle(item.key as keyof typeof buttonScales)}>
                            <Pressable
                                style={[
                                    styles.button,
                                    { backgroundColor: item.color },
                                    hoveredButton === item.key && styles.buttonHovered
                                ]}
                                onPressIn={() => handlePressIn(item.key as keyof typeof buttonScales)}
                                onPressOut={() => handlePressOut(item.key as keyof typeof buttonScales)}
                                onPress={item.onPress}
                                onHoverIn={() => setHoveredButton(item.key)}
                                onHoverOut={() => setHoveredButton(null)}
                            >
                                <MaterialCommunityIcons name={item.icon} size={32} color="#fff" style={styles.icon} />
                                <Text style={styles.buttonText}>{item.text}</Text>
                            </Pressable>
                        </Animated.View>
                    ))}
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
    headerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    title: {
        fontSize: 72,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 24,
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
        flexDirection: 'row',
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
    },
    buttonText: {
        fontSize: 24,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        letterSpacing: 1.5,
        color: '#fff',
        marginLeft: 12,
    },
    buttonHovered: {
        opacity: 0.9,
    },
    icon: {
        marginRight: 8,
    },
};

export default AccountAddScreen;
