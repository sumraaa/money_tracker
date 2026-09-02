import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { ShieldCheck, User, Phone, ArrowRight, Lock } from 'lucide-react-native';
import { login } from '../services/AuthService';

export default function LoginScreen({ onLoginSuccess }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pulsing animation for loading state
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleSubmit = async () => {
    setErrorMsg('');
    const trimmedName = name.trim();
    const cleanPhone = phone.trim().replace(/\D/g, '');

    if (!trimmedName) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit phone number.');
      return;
    }

    try {
      setLoading(true);
      startPulseAnimation();
      await login(trimmedName, cleanPhone);

      // Wait 1.2s transition as specified
      setTimeout(() => {
        setLoading(false);
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }, 1200);
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to initialize session');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#eeebe3" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexOne}
      >
        <View style={styles.content}>
          {/* Centered Pace Emblem & Title */}
          <View style={styles.brandContainer}>
            <View style={styles.emblemContainer}>
              <View style={styles.emblemInner}>
                <Lock size={28} color="#ffffff" strokeWidth={2.5} />
              </View>
            </View>
            <Text style={styles.brandTitle}>Pace</Text>
            <Text style={styles.brandSubtitle}>Your private, offline financial OS.</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Create Local Vault Identity</Text>
            
            {errorMsg ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.inputWrapper}>
              <User size={20} color="#6c7772" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#929d96"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Phone size={20} color="#6c7772" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone number (10 digits)"
                placeholderTextColor="#929d96"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={15}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>Get Started</Text>
              <ArrowRight size={20} color="#ffffff" strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.securityBadge}>
              <ShieldCheck size={14} color="#6c7772" />
              <Text style={styles.securityBadgeText}>100% Offline & Encrypted Locally</Text>
            </View>
          </View>
        </View>

        {/* Animated Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
              <Animated.View style={[styles.pulsingIcon, { opacity: pulseAnim }]}>
                <ActivityIndicator size="large" color="#ca0013" />
              </Animated.View>
              <Text style={styles.loadingText}>Initializing your vault...</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eeebe3',
  },
  flexOne: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emblemContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#171e19',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#171e19',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  emblemInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ca0013',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#171e19',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6c7772',
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(183, 198, 194, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171e19',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(202, 0, 19, 0.08)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#ca0013',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f7f3',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(183, 198, 194, 0.4)',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#171e19',
  },
  submitButton: {
    backgroundColor: '#ca0013',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
    shadowColor: '#ca0013',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  securityBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6c7772',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(238, 235, 227, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingBox: {
    backgroundColor: '#ffffff',
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(183, 198, 194, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  pulsingIcon: {
    marginBottom: 14,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171e19',
  },
});
