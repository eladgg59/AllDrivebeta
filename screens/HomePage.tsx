import React, { useState, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackNavigatorParamsList } from '../RootStackNavigator';
import { useTheme } from '../src/Contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function App() {
  const navigation = useNavigation<StackNavigationProp<RootStackNavigatorParamsList>>();
  const { isDark, toggleTheme, themeAnim } = useTheme();
  
  // Animation Values
  const hoverAnim = useRef(new Animated.Value(0)).current; // 0 = normal, 1 = hovered
  const signupHoverAnim = useRef(new Animated.Value(0)).current;
  const loginHoverAnim = useRef(new Animated.Value(0)).current;

  // Hover Handlers
  const handleHover = (isHovering) => {
    Animated.spring(hoverAnim, {
      toValue: isHovering ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40
    }).start();
  };

  const handleSignupHover = (isHovering) => {
    Animated.spring(signupHoverAnim, {
      toValue: isHovering ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40
    }).start();
  };

  const handleLoginHover = (isHovering) => {
    Animated.spring(loginHoverAnim, {
      toValue: isHovering ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40
    }).start();
  };

  // Interpolations
  const backgroundColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ffffff', '#000000']
  });

  const textColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#0f172a', '#ffffff']
  });

  const btnScale = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03]
  });

  const auraOpacity = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7]
  });

  const signupBtnScale = signupHoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03]
  });

  const signupAuraOpacity = signupHoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7]
  });

  const loginBtnScale = loginHoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02]
  });

  const loginShadowOpacity = loginHoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5]
  });

  const glassOpacity = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 0.03]
  });

  const glassBorderColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(59, 130, 246, 0.2)', 'rgba(148, 163, 184, 0.2)']
  });

  const blueColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#3b82f6', '#3b67f6']
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Animated.View style={[styles.logoBox, { backgroundColor: blueColor }]} />
          <Animated.Text style={[styles.logoText, { color: textColor }]}>ALLDRIVE</Animated.Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onHoverIn={() => handleLoginHover(true)}
            onHoverOut={() => handleLoginHover(false)}
            onPress={() => navigation.navigate('login')}
          >
            <Animated.View style={[styles.loginAuraGlow, { opacity: loginShadowOpacity, transform: [{ scale: loginBtnScale }], backgroundColor: blueColor }]} />
            <Animated.View style={[styles.loginBtn, { 
              transform: [{ scale: loginBtnScale }],
              backgroundColor: glassOpacity.interpolate({
                inputRange: [0.03, 0.7],
                outputRange: ['rgba(255, 255, 255, 0.03)', 'rgba(241, 245, 249, 0.7)']
              }),
              borderColor: glassBorderColor
            }]}>
              <Animated.Text style={[styles.loginBtnText, { color: textColor }]}>Login</Animated.Text>
            </Animated.View>
          </Pressable>
          <Pressable
            onHoverIn={() => handleSignupHover(true)}
            onHoverOut={() => handleSignupHover(false)}
            onPress={() => navigation.navigate('register')}
          >
            <Animated.View style={[styles.signupAuraGlow, { opacity: signupAuraOpacity, transform: [{ scale: signupBtnScale }], backgroundColor: blueColor }]} />
            <Animated.View style={[styles.signupBtn, { transform: [{ scale: signupBtnScale }], backgroundColor: blueColor }]}>
              <Text style={styles.signupBtnText}>Sign Up</Text>
            </Animated.View>
          </Pressable>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
            <MaterialCommunityIcons 
              name={isDark ? "white-balance-sunny" : "moon-waning-crescent"} 
              size={isWeb ? 20 : 18} 
              color={isDark ? "#fff" : "#000"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.content}>
        <Animated.Text style={[styles.heroTitle, { color: textColor }]}>
          Storage for <Animated.Text style={{ color: blueColor }}>Visionaries.</Animated.Text>
        </Animated.Text>
        <Animated.Text style={[styles.description, { color: textColor }]}>Our service combines multiple Google Drive accounts into one easy-to-manage workspace.{"\n"} Access and organize all your files from a single dashboard.</Animated.Text>
        <View style={styles.buttonContainer}>
          {/* Hoverable Primary Button */}
          <Pressable 
            onHoverIn={() => handleHover(true)}
            onHoverOut={() => handleHover(false)}
            style={styles.fullWidth}
            onPress={() => navigation.navigate('register')}
          >
            <Animated.View style={[styles.auraGlow, { opacity: auraOpacity, transform: [{ scale: btnScale }], backgroundColor: blueColor }]} />
            <Animated.View style={[styles.primaryBtn, { transform: [{ scale: btnScale }], backgroundColor: blueColor }]}>
              <Text style={styles.primaryBtnText}>Get Started Free</Text>
            </Animated.View>
          </Pressable>


        </View>

        {/* Features grid */}
        <View style={styles.featuresContainer}>
          <FeatureCard 
            icon={<MaterialCommunityIcons name="shield-check" size={isWeb ? 32 : 26} color="#3b82f6" />} 
            title="We prioritize your privacy" 
            desc="we don't collect, store, or access any of your personal data while connecting your Google Drive accounts." 
            textColor={textColor}
            borderColor={glassBorderColor}
            backgroundColor={isDark ? 'rgb(17, 17, 17)' : 'rgba(255,255,255,1)'}
          />
          <FeatureCard 
            icon={<MaterialCommunityIcons name="lightning-bolt-circle" size={isWeb ? 32 : 26} color="#3b82f6" />} 
            title="Instant Sync" 
            desc="Collaborate in real time without delays. Work seamlessly across all your devices and stay perfectly in sync." 
            textColor={textColor}
            borderColor={glassBorderColor}
            backgroundColor={isDark ? 'rgb(17, 17, 17)' : 'rgba(255,255,255,1)'}
          />
          <FeatureCard 
            icon={<MaterialCommunityIcons name="layers" size={isWeb ? 32 : 26} color="#3b82f6" />} 
            title="Multiple Accounts" 
            desc="Connect and manage multiple Google Drive accounts in one streamlined workspace for total control and convenience." 
            textColor={textColor}
            borderColor={glassBorderColor}
            backgroundColor={isDark ? 'rgb(17, 17, 17)' : 'rgba(255,255,255,1)'}
          />
        </View>
      </View>
    </Animated.View>
  );
}

// Helper for mobile touch
const TouchableOpacity = ({ children, onPress, style }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}>
    {children}
  </Pressable>
);

// Reusable feature card component with hover aura
function FeatureCard({ icon, title, desc, textColor, borderColor, backgroundColor }) {
  const hoverAnim = useRef(new Animated.Value(0)).current;
  const scale = hoverAnim.interpolate({ inputRange: [0,1], outputRange: [1,1.02] });
  const auraOpacity = hoverAnim.interpolate({ inputRange: [0,1], outputRange: [0,0.6] });

  const handleHover = (hovering) => {
    Animated.spring(hoverAnim, { toValue: hovering?1:0, useNativeDriver: false, friction: 8, tension: 40 }).start();
  };

  return (
    <Pressable onHoverIn={() => handleHover(true)} onHoverOut={() => handleHover(false)} style={styles.cardWrapper}>
      <Animated.View
        style={[
          styles.cardAura,
          { opacity: auraOpacity, backgroundColor: '#3b82f6' }
        ]}
      />
      <Animated.View style={[styles.featureCard, {backgroundColor: backgroundColor, borderColor: borderColor.interpolate ? borderColor : borderColor, transform:[{scale}] }]}> 
        {icon}
        <Animated.Text style={[styles.featureTitle, { color: textColor }]}>{title}</Animated.Text>
        <Animated.Text style={[styles.featureDesc, { color: textColor }]}>{desc}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const isWeb = Platform.OS === 'web';
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: isWeb ? 30 : 16,
    paddingTop: isWeb ? 60 : 40,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoBox: { width: isWeb ? 30 : 26, height: isWeb ? 30 : 26, borderRadius: isWeb ? 8 : 6 },
  logoText: { fontSize: isWeb ? 22 : 18, fontWeight: '900', marginLeft: isWeb ? 12 : 8, letterSpacing: -1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: isWeb ? 15 : 10 },
  loginBtn: {
    paddingHorizontal: isWeb ? 20 : 14,
    paddingVertical: isWeb ? 10 : 8,
    borderRadius: isWeb ? 16 : 12,
    borderWidth: 1,
    backdropFilter: 'blur(12px)',
    zIndex: 2,
  },
  loginBtnText: { fontSize: isWeb ? 16 : 14, fontWeight: '700' },
  loginAuraGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    ...Platform.select({ web: { filter: 'blur(25px)' }, default: { elevation: 20, shadowColor: '#3b82f6', shadowRadius: 20 } })
  },
  signupBtn: { paddingHorizontal: isWeb ? 20 : 14, paddingVertical: isWeb ? 10 : 8, borderRadius: isWeb ? 16 : 12, zIndex: 2 },
  signupBtnText: { color: '#fff', fontSize: isWeb ? 16 : 14, fontWeight: '700' },
  signupAuraGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    ...Platform.select({ web: { filter: 'blur(25px)' }, default: { elevation: 20, shadowColor: '#3b82f6', shadowRadius: 20 } })
  },
  themeBtn: { padding: isWeb ? 10 : 8 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: isWeb ? 40 : 20 },
  heroTitle: {
    fontSize: isWeb ? 100 : 36,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: isWeb ? 60 : 44,
    letterSpacing: -2.5,
    fontFamily: Platform.select({ web: 'Poppins, Arial, sans-serif', default: 'System' }),
  },
  description: { fontSize: isWeb ? 18 : 14, opacity: 0.6, textAlign: 'center', marginTop: isWeb ? 40 : 24, maxWidth: '90%', alignSelf: 'center' },
  buttonContainer: { marginTop: isWeb ? 50 : 28, gap: isWeb ? 15 : 12, alignItems: 'center' },
  fullWidth: { width: isWeb ? '20%' : '70%', minWidth: isWeb ? undefined : 200, alignItems: 'center' },
  primaryBtn: { width: '100%', paddingVertical: isWeb ? 20 : 14, borderRadius: isWeb ? 16 : 12, alignItems: 'center', zIndex: 2 },
  primaryBtnText: { color: '#fff', fontSize: isWeb ? 18 : 15, fontWeight: '700' },
  auraGlow: { 
    position: 'absolute', 
    width: '100%', 
    height: '100%', 
    borderRadius: 16,
    ...Platform.select({ web: { filter: 'blur(25px)' }, default: { elevation: 20, shadowColor: '#3b82f6', shadowRadius: 20 } })
  },
  cardAura: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    ...Platform.select({ web: { filter: 'blur(25px)' }, default: { elevation: 20, shadowColor: '#3b82f6', shadowRadius: 20 } })
  },

  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: isWeb ? 24 : 16,
    marginTop: isWeb ? 40 : 24,
    paddingHorizontal: isWeb ? 20 : 12,
  },
  cardWrapper: {
    flexBasis: isWeb ? '30%' : '45%',
    maxWidth: isWeb ? '30%' : '45%',
    marginBottom: isWeb ? 20 : 14,
  },
  featureCard: {
    width: '100%',
    padding: isWeb ? 20 : 14,
    borderRadius: isWeb ? 24 : 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  featureTitle: {
    fontSize: isWeb ? 18 : 15,
    fontWeight: '700',
    marginTop: isWeb ? 8 : 6,
  },
  featureDesc: {
    fontSize: isWeb ? 14 : 12,
    opacity: 0.7,
    marginTop: isWeb ? 4 : 2,
  },

});
