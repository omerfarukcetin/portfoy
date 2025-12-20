import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import { ArrowLeft } from 'lucide-react-native';

export const LoginScreen = () => {
    const { colors, fontScale } = useTheme();
    const navigation = useNavigation<any>();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
            return;
        }

        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Navigation will be handled by auth state listener or we go back
            navigation.goBack();
        } catch (error: any) {
            console.error(error);
            let msg = 'Giriş başarısız.';
            if (error.code === 'auth/invalid-credential') msg = 'E-posta veya şifre hatalı.';
            if (error.code === 'auth/user-not-found') msg = 'Kullanıcı bulunamadı.';
            if (error.code === 'auth/wrong-password') msg = 'Hatalı şifre.';
            Alert.alert('Hata', msg);
        } finally {
            setIsLoading(false);
        }
    };

    const styles = createStyles(colors, fontScale);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Giriş Yap</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>E-posta</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="ornek@email.com"
                        placeholderTextColor={colors.subText}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Şifre</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="******"
                        placeholderTextColor={colors.subText}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Giriş Yap</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.navigate('Register')}
                >
                    <Text style={styles.linkText}>Hesabın yok mu? <Text style={styles.linkEmphasis}>Kayıt Ol</Text></Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: any, fontScale: number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 15,
    },
    title: {
        fontSize: 24 * fontScale,
        fontWeight: 'bold',
        color: colors.text,
    },
    form: {
        padding: 24,
        flex: 1,
        justifyContent: 'center',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14 * fontScale,
        color: colors.subText,
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        padding: 16,
        fontSize: 16 * fontScale,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16 * fontScale,
        fontWeight: 'bold',
    },
    linkButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    linkText: {
        fontSize: 14 * fontScale,
        color: colors.subText,
    },
    linkEmphasis: {
        color: colors.primary,
        fontWeight: 'bold',
    }
});
