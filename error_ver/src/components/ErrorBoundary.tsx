import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Eyvah! Bir şeyler ters gitti. 😅</Text>
            <Text style={styles.subtitle}>Uygulama beklenmedik bir hata ile karşılaştı.</Text>
            
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
            </View>

            <TouchableOpacity 
              style={styles.button}
              onPress={() => window.location.reload()}
            >
              <Text style={styles.buttonText}>Sayfayı Yenile</Text>
            </TouchableOpacity>

            <Text style={styles.technicalTitle}>Teknik Detaylar:</Text>
            <Text style={styles.technicalText}>
              {this.state.errorInfo?.componentStack}
            </Text>
          </ScrollView>
        </View>
      );
    }

    return this.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  content: {
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#feb2b2',
    width: '100%',
    marginBottom: 30,
  },
  errorText: {
    fontFamily: 'monospace',
    color: '#c53030',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 40,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  technicalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  technicalText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  }
});
