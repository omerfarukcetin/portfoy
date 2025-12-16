import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { NewsService } from '../services/newsService';
import { Ionicons } from '@expo/vector-icons';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    type: 'text' | 'analysis';
    data?: any;
    timestamp: number;
}

const SUGGESTED_COMMANDS = [
    { id: 'analyze', text: 'Analiz Et', icon: 'pie-chart' },
    { id: 'news', text: 'Haberler', icon: 'newspaper' },
    { id: 'risk', text: 'Risk Durumum', icon: 'alert-circle' },
    { id: 'advice', text: 'Tavsiye Ver', icon: 'bulb' },
    { id: 'cash', text: 'Nakit', icon: 'wallet' },
];

export const AIAnalysisScreen = () => {
    const { colors, fontScale, fonts } = useTheme();
    const { getPortfolioTotalValue, getPortfolioDistribution, portfolios, activePortfolioId, history, portfolio } = usePortfolio();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const activePortfolio = portfolios.find(p => p.id === activePortfolioId);

    useEffect(() => {
        if (messages.length === 0) {
            addMessage({
                id: 'welcome',
                text: `Merhaba! Ben Portföy Asistanın. ${activePortfolio?.name} portföyünle ilgili detaylı analizler yapabilirim. Aşağıdaki butonları kullanarak hızlıca soru sorabilirsin.`,
                sender: 'ai',
                type: 'text',
                timestamp: Date.now()
            });
        }
    }, [activePortfolioId]);

    const addMessage = (msg: Message) => {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const handleSend = (text: string = inputText) => {
        if (!text.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: text,
            sender: 'user',
            type: 'text',
            timestamp: Date.now()
        };

        addMessage(userMsg);
        setInputText('');
        processUserMessage(text);
    };

    const processUserMessage = async (text: string) => {
        setIsTyping(true);

        // Simulate "thinking" time but allow async calls
        const lowerText = text.toLowerCase();
        let responseText = '';
        let analysisData = null;
        let msgType: 'text' | 'analysis' = 'text';

        try {
            const analysis = generateDetailedAnalysis();

            if (lowerText.includes('haber') || lowerText.includes('gündem')) {
                // Fetch News
                const keywords = portfolio.length > 0
                    ? portfolio.slice(0, 3).map(p => p.instrumentId.replace('.IS', ''))
                    : ['Borsa İstanbul', 'Ekonomi'];
                if (portfolio.length > 0) keywords.push('Borsa İstanbul');

                const newsItems = await NewsService.fetchNews(keywords);
                const relevantNews = newsItems.slice(0, 5);

                if (relevantNews.length > 0) {
                    responseText = `📰 **Piyasa Gündemi**\n\n` +
                        relevantNews.map(n => `• ${n.title}`).join('\n\n') +
                        `\n\n(Detaylar için ana sayfadaki piyasa raporuna bakabilirsin.)`;
                } else {
                    responseText = 'Şu an sizin için önemli bir haber bulamadım.';
                }

            } else if (lowerText.includes('analiz') || lowerText.includes('durum') || lowerText.includes('özet')) {
                // Use Dynamic Response
                responseText = generateDynamicResponse(analysis);
                analysisData = analysis;
                msgType = 'analysis';
            } else if (lowerText.includes('risk')) {
                responseText = `📊 **Risk Analizi**\n\nRisk Skorun: **${analysis.riskScore}/10**\n\n${analysis.riskAssessment}`;
            } else if (lowerText.includes('tavsiye') || lowerText.includes('öneri') || lowerText.includes('ne yapayım')) {
                const suggestions = analysis.insights.filter((i: any) => i.type === 'suggestion' || i.type === 'warning' || i.type === 'opportunity');
                if (suggestions.length > 0) {
                    responseText = '💡 **Sana Özel Önerilerim:**\n\n' + suggestions.map((s: any) => `• ${s.message}`).join('\n\n');
                } else {
                    responseText = '✅ **Harika!**\n\nPortföyün şu an gayet dengeli görünüyor. Mevcut stratejine devam edebilirsin.';
                }
            } else if (lowerText.includes('nakit')) {
                const cashInfo = analysis.distribution.find((d: any) => d.name === 'Nakit (TL)');
                const ratio = cashInfo ? (cashInfo.value / analysis.totalValue * 100).toFixed(1) : '0';
                responseText = `💰 **Nakit Durumu**\n\nPortföyünün **%${ratio}**'si nakitte.\n\n${Number(ratio) < 10 ? '⚠️ Nakit oranın düşük. Acil durumlar ve fırsatlar için en az %10 nakit tutmanı öneririm.' : '✅ Nakit oranın sağlıklı seviyede.'}`;
            } else if (lowerText.includes('altın')) {
                const goldInfo = analysis.distribution.find((d: any) => d.name === 'Altın');
                const ratio = goldInfo ? (goldInfo.value / analysis.totalValue * 100).toFixed(1) : '0';
                responseText = `🥇 **Altın Durumu**\n\nPortföyünün **%${ratio}**'si altında.\n\n${Number(ratio) < 10 ? '⚠️ Enflasyona karşı koruma ("Hedge") için altın oranını %10-15 seviyesine çıkarabilirsin.' : '✅ Altın oranın gayet iyi.'}`;
            } else {
                responseText = 'Anladığımdan emin değilim. Aşağıdaki butonları kullanarak portföyünü analiz etmemi veya haberleri sormamı isteyebilirsin.';
            }

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: responseText,
                sender: 'ai',
                type: msgType,
                data: analysisData,
                timestamp: Date.now()
            };

            addMessage(aiMsg);
        } catch (error) {
            console.error(error);
            addMessage({
                id: Date.now().toString(),
                text: 'Bir hata oluştu, lütfen tekrar dene.',
                sender: 'ai',
                type: 'text',
                timestamp: Date.now()
            });
        } finally {
            setIsTyping(false);
        }
    };

    const generateDynamicResponse = (analysis: any) => {
        // 1. Time-based Greeting
        const hour = new Date().getHours();
        let greeting = '';
        if (hour < 11) greeting = ['Günaydın! ☀️', 'Sabah şeriflerin hayrolsun.', 'Güne güzel başlayalım!'].sort(() => 0.5 - Math.random())[0];
        else if (hour > 18) greeting = ['İyi akşamlar. 🌙', 'Günün yorgunluğunu portföyünü inceleyerek atalım.', 'Akşam analizi hazır.'].sort(() => 0.5 - Math.random())[0];
        else greeting = ['Selam! 👋', 'Merhabalar.', 'Portföy koçun iş başında.'].sort(() => 0.5 - Math.random())[0];

        // 2. High Level Sentiment
        const totalValueStr = analysis.totalValue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
        let sentiment = '';

        // Find Best/Worst performers from distribution (this is simplified as distribution doesn't hold change, we need portfolio items or daily changes passed in)
        // But we have insights generated from weekly changes.
        const weeklyInsight = analysis.insights.find((i: any) => i.title.includes('Haftalık'));

        if (analysis.riskScore >= 8) {
            sentiment = `Portföyün oldukça yüksek riskli (${analysis.riskScore}/10). Adrenalin seviyorsun belli ki! 🎢`;
        } else if (analysis.riskScore <= 3) {
            sentiment = `Gayet sağlamcı ve defansif bir yapın var (${analysis.riskScore}/10). "Az olsun öz olsun" diyorsun. 🛡️`;
        } else {
            sentiment = `Dengeli bir portföy kurmuşsun (${analysis.riskScore}/10). Hem koruma hem büyüme odaklı. ⚖️`;
        }

        let specificComment = '';
        // 3. Asset Specific Commentary (Randomized)
        const assets = analysis.distribution.filter((d: any) => d.name !== 'Nakit (TL)');
        if (assets.length > 0) {
            const randomAsset = assets[Math.floor(Math.random() * assets.length)];
            const ratio = (randomAsset.value / analysis.totalValue * 100).toFixed(0);

            const comments = [
                `${randomAsset.name} portföyünün %${ratio}'sini oluşturuyor. Bu varlığa güvenin tam gibi.`,
                `Gözüm ${randomAsset.name} üzerinde, portföyündeki ağırlığı %${ratio}.`,
                `${randomAsset.name} stratejinin önemli bir parçası (%${ratio}).`
            ];
            specificComment = comments[Math.floor(Math.random() * comments.length)];
        }

        // 4. Construct Response
        return `${greeting}\n\nBugün toplam varlığın **${totalValueStr}** seviyesinde.\n\n${sentiment}\n\n${specificComment}\n\n${weeklyInsight ? `🗓️ **Özet:** ${weeklyInsight.message}` : ''}`;
    };

    const generateDetailedAnalysis = () => {
        const totalValue = getPortfolioTotalValue();
        const distribution = getPortfolioDistribution();

        const insights = [];
        let riskScore = 0;
        let diversificationScore = 0;

        const cryptoDist = distribution.find(d => d.name === 'Kripto');
        const goldDist = distribution.find(d => d.name === 'Altın');
        const cashDist = distribution.find(d => d.name === 'Nakit (TL)');
        const stockDist = distribution.find(d => d.name === 'Hisse (BIST)');
        const fundDist = distribution.find(d => d.name === 'Yatırım Fonu');

        const cryptoRatio = cryptoDist ? (cryptoDist.value / totalValue) * 100 : 0;
        const goldRatio = goldDist ? (goldDist.value / totalValue) * 100 : 0;
        const cashRatio = cashDist ? (cashDist.value / totalValue) * 100 : 0;
        const stockRatio = stockDist ? (stockDist.value / totalValue) * 100 : 0;

        // --- Risk Calculation (Refined) ---
        // Base Score: 3 (Balanced)
        riskScore = 3;

        if (cryptoRatio > 50) riskScore += 5; // Very risky
        else if (cryptoRatio > 25) riskScore += 3;

        if (stockRatio > 60) riskScore += 2;

        if (goldRatio > 20) riskScore -= 1; // Hedge
        if (cashRatio > 25) riskScore -= 2; // Liquid

        riskScore = Math.max(1, Math.min(10, riskScore));

        // --- Diversification Calculation ---
        const assetCount = distribution.length;
        if (assetCount >= 5) diversificationScore = 10;
        else if (assetCount >= 4) diversificationScore = 8;
        else if (assetCount >= 3) diversificationScore = 6;
        else diversificationScore = 3;

        // --- Insight Generation ---

        // 0. Weekly Performance (History Analysis)
        if (history && history.length >= 7) {
            const weekAgo = history[history.length - 7];
            const currentVal = history[history.length - 1]?.valueTry || totalValue;

            if (weekAgo && weekAgo.valueTry > 0) {
                const weeklyChange = ((currentVal - weekAgo.valueTry) / weekAgo.valueTry) * 100;

                if (weeklyChange < -3) {
                    insights.push({
                        type: 'warning',
                        title: 'Haftalık Düşüş',
                        message: `Son 1 haftada %${Math.abs(weeklyChange).toFixed(1)} erime var. Piyasalar biraz tatsız.`
                    });
                } else if (weeklyChange > 5) {
                    insights.push({
                        type: 'suggestion',
                        title: 'Güçlü Performans',
                        message: `Son 1 hafta harika geçti! Portföyün %${weeklyChange.toFixed(1)} büyüdü. 🚀`
                    });
                }
            }
        }

        // 1. Crypto Analysis
        if (cryptoRatio > 50) {
            insights.push({
                type: 'warning',
                title: 'Yüksek Kripto Riski',
                message: `Portföyünün yarısından fazlası (%${cryptoRatio.toFixed(0)}) kriptoda. Kalbin dayanıyorsa sorun yok ama dikkatli ol!`
            });
        }

        // 2. Gold Analysis
        if (goldRatio < 5) {
            insights.push({
                type: 'suggestion',
                title: 'Altın Eksikliği',
                message: 'Hiç "yastık altı" yapmamışsın. Portföyüne biraz Altın eklemek fırtınalı günlerde sığınağın olabilir.'
            });
        }

        // 3. Cash Analysis
        if (cashRatio < 5) {
            insights.push({
                type: 'critical',
                title: 'Nakit Sıkıntısı',
                message: 'Cebinde neredeyse hiç nakit yok. Fırsat çıkarsa trene uzaktan bakarsın. Biraz nakit (veya likit fon) iyidir.'
            });
        } else if (cashRatio > 60) {
            insights.push({
                type: 'info',
                title: 'Nakit Kraldır (Ama Fazlası değil)',
                message: 'Çok fazla nakitte bekliyorsun (%${cashRatio.toFixed(0)}). Enflasyon paranı kemiriyor olabilir.'
            });
        }

        let riskAssessment = '';
        if (riskScore >= 8) riskAssessment = 'Portföyün **Çok Yüksek Riskli**. Kemerleri bağla! 🎢';
        else if (riskScore >= 5) riskAssessment = 'Portföyün **Orta Riskli**. Dengeli gidiyoruz.';
        else riskAssessment = 'Portföyün **Düşük Riskli**. Sağlamcısın.';

        return {
            riskScore,
            diversificationScore,
            insights,
            totalValue,
            distribution,
            riskAssessment
        };
    };



    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.sender === 'user';

        return (
            <View style={[
                styles.messageContainer,
                isUser ? styles.userMessageContainer : styles.aiMessageContainer
            ]}>
                {!isUser && (
                    <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                        <Ionicons name="logo-android" size={16} color="#fff" />
                    </View>
                )}
                <View style={[
                    styles.bubble,
                    isUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border }
                ]}>
                    <Text style={[
                        styles.messageText,
                        isUser ? { color: '#fff' } : { color: colors.text }
                    ]}>
                        {item.text}
                    </Text>
                </View>
            </View>
        );
    };

    const styles = createStyles(fontScale);

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Asistan 🤖</Text>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.listContent}
            />

            {isTyping && (
                <View style={styles.typingContainer}>
                    <ActivityIndicator size="small" color={colors.subText} />
                    <Text style={[styles.typingText, { color: colors.subText }]}>Analiz ediliyor...</Text>
                </View>
            )}

            <View style={styles.inputWrapper}>
                {/* Command Chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipsContainer}
                    contentContainerStyle={styles.chipsContent}
                >
                    {SUGGESTED_COMMANDS.map(cmd => (
                        <TouchableOpacity
                            key={cmd.id}
                            style={[styles.chip, { backgroundColor: colors.cardBackground, borderColor: colors.primary }]}
                            onPress={() => handleSend(cmd.text)}
                        >
                            <Ionicons name={cmd.icon as any} size={14} color={colors.primary} style={{ marginRight: 5 }} />
                            <Text style={[styles.chipText, { color: colors.primary }]}>{cmd.text}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                        placeholder="Bir şeyler yazın..."
                        placeholderTextColor={colors.subText}
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={() => handleSend()}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]}
                        onPress={() => handleSend()}
                        disabled={!inputText.trim()}
                    >
                        <Ionicons name="arrow-up" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const createStyles = (fontScale: number) => StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 15,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 18 * fontScale,
        fontWeight: '600',
    },
    listContent: {
        padding: 15,
        paddingBottom: 20,
    },
    messageContainer: {
        marginBottom: 15,
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    userMessageContainer: {
        justifyContent: 'flex-end',
    },
    aiMessageContainer: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    bubble: {
        maxWidth: '85%',
        padding: 12,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 15 * fontScale,
        lineHeight: 22 * fontScale,
    },
    inputWrapper: {
        width: '100%',
    },
    chipsContainer: {
        maxHeight: 50,
        marginBottom: 5,
    },
    chipsContent: {
        paddingHorizontal: 15,
        alignItems: 'center',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
    },
    chipText: {
        fontSize: 13 * fontScale,
        fontWeight: '600',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        paddingBottom: 30, // Safe area for bottom
        alignItems: 'center',
        borderTopWidth: 1,
    },
    input: {
        flex: 1,
        height: 40,
        borderRadius: 20,
        paddingHorizontal: 15,
        marginRight: 10,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 20,
        marginBottom: 10,
    },
    typingText: {
        marginLeft: 8,
        fontSize: 12,
    },
});
