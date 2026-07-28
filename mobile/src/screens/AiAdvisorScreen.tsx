import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Clipboard,
    Animated
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, formatCurrency } from '../utils';
import { useAppStore } from '../store';
import { getCodexPetAdvice, loadBonsaiModel } from '../services/BonsaiLlmService';
import { getFinancialSummary } from '../services/AIAdvisorService';
import { BonsaiModelDownloaderWidget } from '../components/BonsaiModelDownloaderWidget';
import { BonsaiModelDownloader } from '../services/BonsaiModelDownloader';

interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
}

const ThinkingDots: React.FC = () => {
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const createAnim = (val: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(val, { toValue: 1.0, duration: 400, useNativeDriver: true }),
                    Animated.timing(val, { toValue: 0.3, duration: 400, useNativeDriver: true }),
                ])
            );
        };

        const a1 = createAnim(dot1, 0);
        const a2 = createAnim(dot2, 150);
        const a3 = createAnim(dot3, 300);

        a1.start();
        a2.start();
        a3.start();

        return () => {
            a1.stop();
            a2.stop();
            a3.stop();
        };
    }, []);

    return (
        <View style={styles.thinkingDotsContainer}>
            <Animated.View style={[styles.dot, { opacity: dot1, transform: [{ scale: dot1.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.3] }) }] }]} />
            <Animated.View style={[styles.dot, { opacity: dot2, transform: [{ scale: dot2.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.3] }) }] }]} />
            <Animated.View style={[styles.dot, { opacity: dot3, transform: [{ scale: dot3.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.3] }) }] }]} />
        </View>
    );
};

const QUICK_CHIPS = [
    "How am I doing this month?",
    "What's my biggest expense?",
    "How much can I save?",
    "Any budget warnings?",
    "Show my daily average",
    "Top merchants this month",
];

export default function AiAdvisorScreen({ navigation }: any) {
    const user = useAppStore(state => state.user);
    const monthlyTotal = useAppStore(state => state.monthlyTotal);
    const transactions = useAppStore(state => state.transactions);
    const categories = useAppStore(state => state.categories);
    const userId = user?.id || 1;

    const scrollViewRef = useRef<ScrollView>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isLoadingWelcome, setIsLoadingWelcome] = useState(false);

    // Calculate context stats
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - today.getDate();
    const txnCount = transactions.length;
    const safeCategories = Array.isArray(categories) ? categories : [];
    const budgetCount = safeCategories.filter(c => c.budgetLimit && c.budgetLimit > 0).length;

    const handleResetChat = () => {
        setMessages([]);
    };

    const scrollToBottom = () => {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const handleSendMessage = async (textToSend?: string) => {
        const query = textToSend || inputText;
        if (!query || query.trim().length === 0 || isThinking) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: query,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const aiMsgId = (Date.now() + 1).toString();
        const placeholderAiMsg: ChatMessage = {
            id: aiMsgId,
            sender: 'ai',
            text: '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMsg, placeholderAiMsg]);
        if (!textToSend) setInputText('');
        setIsThinking(true);
        scrollToBottom();

        try {
            let accumulatedText = '';
            const aiResponseText = await getCodexPetAdvice(
                userId, 
                query, 
                messages,
                (token: string) => {
                    accumulatedText += token;
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText } : m));
                    scrollToBottom();
                }
            );

            // Final text update with metadata/badges if any
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: aiResponseText || accumulatedText } : m));
        } catch (error) {
            setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                ...m,
                text: "I couldn't analyze your data right now. Please try again! 🔄",
            } : m));
        } finally {
            setIsThinking(false);
            scrollToBottom();
        }
    };

    const handleCopyMessage = (text: string) => {
        Clipboard.setString(text);
        Alert.alert('Copied to Clipboard', 'AI response text copied to clipboard!');
    };

    // Render a structured AI message card
    const renderAiMessage = (text: string) => {
        if (!text || text.trim().length === 0) {
            return <ThinkingDots />;
        }

        // Split by double newlines to create visual sections
        const sections = text.split('\n\n').filter(s => s.trim());
        if (sections.length <= 1) {
            return <Text selectable={true} style={styles.bubbleText}>{text}</Text>;
        }
        return (
            <View style={styles.structuredResponse}>
                {sections.map((section, idx) => {
                    const trimmed = section.trim();
                    // Detect header-like sections (start with emoji + **)
                    const isHeader = /^(📊|📈|📉|🚨|⚠️|💡|💰|🎉|✅|🔥|💪|🏪|📋|📅|📭|✨)/.test(trimmed);
                    return (
                        <View key={idx} style={[
                            styles.responseSection,
                            idx > 0 && styles.responseSectionBorder,
                            isHeader && styles.responseSectionHeader,
                        ]}>
                            <Text selectable={true} style={[
                                styles.bubbleText,
                                isHeader && styles.sectionHeaderText,
                            ]}>{trimmed}</Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    const [modelStatus, setModelStatus] = useState<string>('NOT_DOWNLOADED');
    const [isAnyDownloaded, setIsAnyDownloaded] = useState<boolean>(false);

    const checkDiskModels = async () => {
        const anyDownloaded = await BonsaiModelDownloader.isAnyModelDownloaded();
        setIsAnyDownloaded(anyDownloaded);

        const st = await BonsaiModelDownloader.checkModelStatus();
        setModelStatus(st);
        if (st === 'READY') {
            loadBonsaiModel();
        }
    };

    // Check model status on mount and subscribe to multi-subscriber status changes
    useEffect(() => {
        checkDiskModels();

        const unsub = BonsaiModelDownloader.addStatusListener((st) => {
            checkDiskModels();
        });

        return () => unsub();
    }, []);

    const handleStatusChange = (st: string) => {
        checkDiskModels();
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Screen Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.aiIconContainer}>
                        <Icon name="auto-awesome" size={22} color={colors.primary} />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>FinAI</Text>
                        <Text style={styles.headerSubtitle}>Smart Offline Engine</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        style={styles.resetButton}
                        onPress={() => navigation.navigate('BonsaiModelManager')}
                        activeOpacity={0.7}
                    >
                        <Icon name="tune" size={18} color={colors.primary} />
                        <Text style={styles.resetButtonText}>Models</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.resetButton}
                        onPress={handleResetChat}
                        activeOpacity={0.7}
                    >
                        <Icon name="refresh" size={18} color={colors.primary} />
                        <Text style={styles.resetButtonText}>Reset</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Non-Advisory Safety Disclaimer Banner */}
            <View style={styles.disclaimerBanner}>
                <Icon name="info-outline" size={14} color="#94a3b8" />
                <Text style={styles.disclaimerText}>
                    Financial Assistant — Expense Tracking & Budget Analysis Only (Not a financial advisor)
                </Text>
            </View>

            {/* Downloader Widget — Only shown when NO model is downloaded on disk */}
            {!isAnyDownloaded && (
                <BonsaiModelDownloaderWidget onStatusChange={handleStatusChange} />
            )}

            {/* Quick Chips Bar */}
            <View style={styles.chipsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
                    {QUICK_CHIPS.map((chip, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={styles.chip}
                            onPress={() => handleSendMessage(chip)}
                            disabled={isThinking}
                        >
                            <Text style={styles.chipText}>{chip}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Chat Messages */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.messageList}
                contentContainerStyle={styles.messageContent}
                onContentSizeChange={scrollToBottom}
            >
                {isLoadingWelcome ? (
                    <View style={styles.welcomeLoader}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.welcomeLoaderText}>Loading your financial data...</Text>
                    </View>
                ) : (
                    messages.map((msg) => (
                        <View
                            key={msg.id}
                            style={[
                                styles.bubbleWrapper,
                                msg.sender === 'user' ? styles.userBubbleWrapper : styles.aiBubbleWrapper
                            ]}
                        >
                            {msg.sender === 'ai' && (
                                <View style={styles.aiAvatar}>
                                    <Icon name="auto-awesome" size={16} color={colors.primary} />
                                </View>
                            )}
                            <View
                                style={[
                                    styles.bubble,
                                    msg.sender === 'user' ? styles.userBubble : styles.aiBubble
                                ]}
                            >
                                {msg.sender === 'ai' ? renderAiMessage(msg.text) : (
                                    <Text selectable={true} style={[styles.bubbleText, styles.userBubbleText]}>{msg.text}</Text>
                                )}
                                <View style={styles.bubbleFooter}>
                                    <Text style={[styles.timestamp, msg.sender === 'user' && styles.userTimestamp]}>{msg.timestamp}</Text>
                                    {msg.sender === 'ai' && (
                                        <TouchableOpacity
                                            style={styles.copyButton}
                                            onPress={() => handleCopyMessage(msg.text)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Icon name="content-copy" size={14} color={colors.primary} />
                                            <Text style={styles.copyButtonText}>Copy</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))
                )}

                {isThinking && (
                    <View style={[styles.bubbleWrapper, styles.aiBubbleWrapper]}>
                        <View style={styles.aiAvatar}>
                            <Icon name="auto-awesome" size={16} color={colors.primary} />
                        </View>
                        <View style={[styles.bubble, styles.aiBubble, styles.thinkingBubble]}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.thinkingText}>Analyzing your transactions...</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Input Bar */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Ask about spending, budgets, savings..."
                    placeholderTextColor={colors.textMuted}
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={() => handleSendMessage()}
                    editable={!isThinking}
                />
                <TouchableOpacity
                    style={[styles.sendButton, (!inputText.trim() || isThinking) && styles.disabledSendButton]}
                    onPress={() => handleSendMessage()}
                    disabled={!inputText.trim() || isThinking}
                >
                    <Icon name="send" size={20} color="#ffffff" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 48,
        paddingBottom: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    aiIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: colors.text,
    },
    headerSubtitle: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    resetButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.primary,
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
    },
    aiBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#10b981',
    },
    contextBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border + '50',
    },
    contextItem: {
        alignItems: 'center',
    },
    contextValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text,
    },
    contextLabel: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 1,
    },
    contextDivider: {
        width: 1,
        height: 24,
        backgroundColor: colors.border,
    },
    chipsWrapper: {
        backgroundColor: colors.background,
        paddingVertical: 8,
    },
    chipsContainer: {
        paddingHorizontal: 16,
        gap: 8,
    },
    chip: {
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chipText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    messageList: {
        flex: 1,
    },
    messageContent: {
        padding: 16,
        paddingBottom: 8,
    },
    welcomeLoader: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
    },
    welcomeLoaderText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    bubbleWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 6,
    },
    userBubbleWrapper: {
        justifyContent: 'flex-end',
    },
    aiBubbleWrapper: {
        justifyContent: 'flex-start',
    },
    aiAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginTop: 2,
    },
    bubble: {
        maxWidth: '82%',
        borderRadius: 18,
    },
    userBubble: {
        backgroundColor: colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    structuredResponse: {
        gap: 0,
    },
    responseSection: {
        paddingVertical: 4,
    },
    responseSectionBorder: {
        borderTopWidth: 1,
        borderTopColor: colors.border + '40',
        marginTop: 6,
        paddingTop: 8,
    },
    responseSectionHeader: {
        paddingVertical: 6,
    },
    sectionHeaderText: {
        fontWeight: '600',
    },
    bubbleText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    userBubbleText: {
        color: '#ffffff',
    },
    bubbleFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingTop: 4,
    },
    timestamp: {
        fontSize: 10,
        color: colors.textMuted,
    },
    userTimestamp: {
        color: 'rgba(255,255,255,0.65)',
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    copyButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.primary,
    },
    thinkingDotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    thinkingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    thinkingText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 8,
    },
    input: {
        flex: 1,
        backgroundColor: colors.background,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: colors.text,
        fontSize: 14,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disclaimerBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        marginHorizontal: 12,
        marginTop: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    disclaimerText: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '500',
        flex: 1,
    },
    disabledSendButton: {
        backgroundColor: colors.textMuted,
    },
});

