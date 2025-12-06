import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
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
    { id: 'analyze', text: 'Portföyümü Analiz Et', icon: 'pie-chart' },
    { id: 'risk', text: 'Risk Durumum', icon: 'alert-circle' },
    { id: 'advice', text: 'Yatırım Tavsiyesi', icon: 'bulb' },
    { id: 'cash', text: 'Nakit Durumu', icon: 'wallet' },
    { id: 'gold', text: 'Altın Oranı', icon: 'trending-up' },
];

export const AIAnalysisScreen = () => {
    const { colors, fontScale } = useTheme();
    const { getPortfolioTotalValue, getPortfolioDistribution, portfolios, activePortfolioId } = usePortfolio();
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

        setTimeout(() => {
            const lowerText = text.toLowerCase();
            let responseText = '';
            let analysisData = null;
            let msgType: 'text' | 'analysis' = 'text';

            const analysis = generateDetailedAnalysis();

            if (lowerText.includes('analiz') || lowerText.includes('durum') || lowerText.includes('özet')) {
                responseText = formatAnalysisResponse(analysis);
                analysisData = analysis;
                msgType = 'analysis';
            } else if (lowerText.includes('risk')) {
                responseText = `📊 **Risk Analizi**\n\nRisk Skorun: **${analysis.riskScore}/10**\n\n${analysis.riskAssessment}`;
            } else if (lowerText.includes('tavsiye') || lowerText.includes('öneri')) {
                const suggestions = analysis.insights.filter(i => i.type === 'suggestion' || i.type === 'warning');
                if (suggestions.length > 0) {
                    responseText = '💡 **Sana Özel Önerilerim:**\n\n' + suggestions.map(s => `• ${s.message}`).join('\n\n');
                } else {
                    responseText = '✅ **Harika!**\n\nPortföyün şu an gayet dengeli görünüyor. Mevcut stratejine devam edebilirsin.';
                }
            } else if (lowerText.includes('nakit')) {
                const cashInfo = analysis.distribution.find(d => d.name === 'Nakit (TL)');
                const ratio = cashInfo ? (cashInfo.value / analysis.totalValue * 100).toFixed(1) : '0';
                responseText = `💰 **Nakit Durumu**\n\nPortföyünün **%${ratio}**'si nakitte.\n\n${Number(ratio) < 10 ? '⚠️ Nakit oranın düşük. Acil durumlar ve fırsatlar için en az %10 nakit tutmanı öneririm.' : '✅ Nakit oranın sağlıklı seviyede.'}`;
            } else if (lowerText.includes('altın')) {
                const goldInfo = analysis.distribution.find(d => d.name === 'Altın');
                const ratio = goldInfo ? (goldInfo.value / analysis.totalValue * 100).toFixed(1) : '0';
                responseText = `🥇 **Altın Durumu**\n\nPortföyünün **%${ratio}**'si altında.\n\n${Number(ratio) < 10 ? '⚠️ Enflasyona karşı koruma ("Hedge") için altın oranını %10-15 seviyesine çıkarabilirsin.' : '✅ Altın oranın gayet iyi.'}`;
            } else {
                responseText = 'Anladığımdan emin değilim. Aşağıdaki butonları kullanarak portföyünü analiz etmemi isteyebilirsin.';
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
            setIsTyping(false);
        }, 1500);
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

        // --- Risk Calculation ---
        if (cryptoRatio > 60) riskScore += 9;
        else if (cryptoRatio > 40) riskScore += 7;
        else if (cryptoRatio > 20) riskScore += 5;
        else if (cryptoRatio > 0) riskScore += 3;

        if (stockRatio > 50) riskScore += 2;

        if (goldRatio > 20) riskScore -= 2;
        if (cashRatio > 20) riskScore -= 2;
        if (fundDist && (fundDist.value / totalValue * 100) > 30) riskScore -= 1;

        riskScore = Math.max(1, Math.min(10, riskScore));

        // --- Diversification Calculation ---
        const assetCount = distribution.length;
        if (assetCount >= 5) diversificationScore = 10;
        else if (assetCount >= 4) diversificationScore = 8;
        else if (assetCount >= 3) diversificationScore = 6;
        else diversificationScore = 3;

        // --- Insight Generation ---

        // 1. Crypto Analysis
        if (cryptoRatio > 50) {
            insights.push({
                type: 'warning',
                title: 'Yüksek Volatilite Riski',
                message: `Portföyünün %${cryptoRatio.toFixed(0)}'ı kripto paralarda. Bu oran çok yüksek risk taşıyor. Ani düşüşlerde portföyün ciddi değer kaybedebilir. Kripto oranını %30'un altına çekmeyi düşünebilirsin.`
            });
        }

        // 2. Gold Analysis
        if (goldRatio < 10) {
            insights.push({
                type: 'suggestion',
                title: 'Güvenli Liman Eksikliği',
                message: 'Portföyünde yeterince Altın yok. Piyasa belirsizliklerinde ve enflasyona karşı korunmak için %10-15 oranında Altın bulundurmak sağlıklı bir stratejidir.'
            });
        }

        // 3. Cash Analysis
        if (cashRatio < 5) {
            insights.push({
                type: 'critical',
                title: 'Nakit (Yedek Akçe) Yetersiz',
                message: 'Portföyünde neredeyse hiç nakit yok. Olası piyasa düşüşlerinde alım fırsatlarını değerlendiremezsin. Ayrıca acil durumlar için portföyünün en az %10\'unu likit fona veya nakitte tutmalısın.'
            });
        } else if (cashRatio > 50) {
            insights.push({
                type: 'info',
                title: 'Aşırı Nakit Tutuyorsun',
                message: 'Portföyünün yarısından fazlası nakitte. Enflasyon karşısında paran eriyor olabilir. Düşük riskli Yatırım Fonları veya Temettü hisseleri ile değerlendirebilirsin.'
            });
        }

        // 4. Diversification Analysis
        if (assetCount < 3) {
            insights.push({
                type: 'suggestion',
                title: 'Çeşitlendirme Yapmalısın',
                message: 'Yumurtaları aynı sepete koyuyorsun. Sadece 1-2 varlık sınıfına yatırım yapmak riski artırır. Fon, Döviz veya Yabancı Hisse Senetleri ekleyerek riski dağıtabilirsin.'
            });
        }

        let riskAssessment = '';
        if (riskScore >= 8) riskAssessment = 'Portföyün **Çok Yüksek Riskli**. Agresif büyüme hedefliyorsan normal, ancak sermaye koruma önceliğin varsa bu yapı tehlikeli.';
        else if (riskScore >= 5) riskAssessment = 'Portföyün **Orta Riskli**. Büyüme ve koruma arasında bir denge var.';
        else riskAssessment = 'Portföyün **Düşük Riskli (Muhafazakar)**. Sermaye koruma odaklısın, ancak getiri potansiyelin sınırlı olabilir.';

        return {
            riskScore,
            diversificationScore,
            insights,
            totalValue,
            distribution,
            riskAssessment
        };
    };

    const formatAnalysisResponse = (analysis: any) => {
        let response = `📋 **Portföy Analiz Raporu**\n\n`;

        response += `💰 **Genel Durum**\n`;
        response += `Toplam Varlık: **${analysis.totalValue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}**\n`;
        response += `Risk Skoru: **${analysis.riskScore}/10** (${analysis.riskScore > 7 ? 'Yüksek' : analysis.riskScore > 4 ? 'Orta' : 'Düşük'})\n\n`;

        response += `🔍 **Tespitler**\n`;
        if (analysis.insights.length > 0) {
            analysis.insights.forEach((insight: any) => {
                const icon = insight.type === 'critical' ? '⛔' : insight.type === 'warning' ? '⚠️' : '💡';
                response += `${icon} **${insight.title}**\n${insight.message}\n\n`;
            });
        } else {
            response += `✅ Portföy dağılımın gayet dengeli ve sağlıklı görünüyor.\n\n`;
        }

        response += `⚖️ **Varlık Dağılımı**\n`;
        analysis.distribution.forEach((d: any) => {
            const ratio = (d.value / analysis.totalValue * 100).toFixed(1);
            if (Number(ratio) > 1) {
                response += `• ${d.name}: %${ratio}\n`;
            }
        });

        return response;
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
