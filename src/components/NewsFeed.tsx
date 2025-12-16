import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { NewsService, NewsItem } from '../services/newsService';
import { Skeleton } from './Skeleton';

interface NewsFeedProps {
    keywords: string[];
}

export const NewsFeed: React.FC<NewsFeedProps> = ({ keywords }) => {
    const { colors, fontScale } = useTheme();
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchNews = async () => {
            setLoading(true);
            // Default keywords if none provided or only empty strings
            const searchKeywords = (keywords && keywords.length > 0)
                ? keywords
                : ['Borsa İstanbul', 'Ekonomi', 'Dolar', 'Altın'];

            // Remove duplicates and empty strings
            const uniqueKeywords = [...new Set(searchKeywords)].filter(k => k && k.trim().length > 0);

            if (uniqueKeywords.length === 0) uniqueKeywords.push('Finans');

            const items = await NewsService.fetchNews(uniqueKeywords);

            if (isMounted) {
                // Show maximum 4 relevant news items to keep home screen clean
                setNews(items.slice(0, 4));
                setLoading(false);
            }
        };

        fetchNews();

        return () => { isMounted = false; };
    }, [keywords]);

    // Handle Link Opening
    const openLink = async (url: string) => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            }
        } catch (error) {
            console.error("Couldn't open link:", error);
        }
    };

    const styles = StyleSheet.create({
        container: {
            marginTop: 24,
            marginBottom: 40,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            paddingHorizontal: 4,
        },
        headerTitle: {
            fontSize: 18 * fontScale,
            fontWeight: '700',
            marginLeft: 8,
        },
        card: {
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            borderWidth: 1,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
        },
        sourceRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        sourceText: {
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'uppercase',
        },
        timeText: {
            fontSize: 12,
        },
        title: {
            fontSize: 15 * fontScale,
            fontWeight: '600',
            marginBottom: 8,
            lineHeight: 22,
        },
        readMoreRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
        },
        readMoreText: { // Make sure this is defined
            fontSize: 12,
            fontWeight: '500',
            marginRight: 4,
        }
    });

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Feather name="globe" size={20} color={colors.subText} />
                    <Text style={[styles.headerTitle, { color: colors.subText }]}>Piyasa Gündemi</Text>
                </View>
                {[1, 2, 3].map(i => (
                    <View key={i} style={{ marginBottom: 12 }}>
                        <Skeleton width="100%" height={100} borderRadius={16} />
                    </View>
                ))}
            </View>
        );
    }

    if (news.length === 0) {
        return null; // Hide section if no news
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Feather name="globe" size={20} color={colors.primary} />
                <Text style={[styles.headerTitle, { color: colors.text }]}>Piyasa Gündemi</Text>
            </View>

            {news.map((item, index) => (
                <TouchableOpacity
                    key={index}
                    style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                    onPress={() => openLink(item.link)}
                    activeOpacity={0.7}
                >
                    <View style={styles.sourceRow}>
                        <Text style={[styles.sourceText, { color: colors.primary }]}>{item.source}</Text>
                        <Text style={[styles.timeText, { color: colors.subText }]}>{item.timeAgo}</Text>
                    </View>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>{item.title}</Text>

                    <View style={styles.readMoreRow}>
                        <Text style={[styles.readMoreText, { color: colors.subText }]}>Habere Git</Text>
                        <Feather name="external-link" size={12} color={colors.subText} />
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
};
