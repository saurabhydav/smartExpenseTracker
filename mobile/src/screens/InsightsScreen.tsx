// Insights Screen - Analytics, predictions, and subscriptions

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useAppStore } from '../store';
import {
    calculateBurnRate,
    generateInsights,
    getChartData,
    type BurnRateData,
    type SpendingInsight,
} from '../services/AnalyticsService';
import {
    detectSubscriptions,
    getActiveSubscriptions,
    getMonthlySubscriptionCost,
    type DetectedSubscription,
} from '../services/SubscriptionService';
import { shareCurrentMonthReport } from '../services/ReportService';
import { colors, formatCurrency, getMonthName } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

export default function InsightsScreen() {
    const { categories, selectedMonth, monthlyTotal, user } = useAppStore();
    const [burnRate, setBurnRate] = useState<BurnRateData | null>(null);
    const [insights, setInsights] = useState<SpendingInsight[]>([]);
    const [subscriptions, setSubscriptions] = useState<DetectedSubscription[]>([]);
    const [chartData, setChartData] = useState<{ date: string; amount: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const totalBudget = categories.reduce((sum, c) => sum + (c.budgetLimit || 0), 0);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [selectedMonth, user]);

    const loadData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const rate = await calculateBurnRate(user.id, totalBudget > 0 ? totalBudget : undefined);
            setBurnRate(rate);

            const insightsList = await generateInsights(user.id, totalBudget > 0 ? totalBudget : undefined);
            setInsights(insightsList);

            const subs = await getActiveSubscriptions(); // Needs update?
            setSubscriptions(subs);

            const chart = await getChartData(user.id, 30);
            setChartData(chart);
        } catch (error) {
            console.error('Error loading insights:', error);
        }
        setIsLoading(false);
    };

    const handleDetectSubscriptions = async () => {
        setIsLoading(true);
        try {
            const detected = await detectSubscriptions();
            setSubscriptions(detected);
            Alert.alert('Complete', `Found ${detected.length} recurring payments`);
        } catch (error) {
            Alert.alert('Error', 'Failed to detect subscriptions');
        }
        setIsLoading(false);
    };

    const handleExportReport = async () => {
        setIsExporting(true);
        try {
            const success = await shareCurrentMonthReport();
            if (!success) {
                Alert.alert('Error', 'Failed to generate report');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to export report');
        }
        setIsExporting(false);
    };

    const getTrendIcon = () => {
        if (!burnRate) return 'trending-flat';
        if (burnRate.trend === 'increasing') return 'trending-up';
        if (burnRate.trend === 'decreasing') return 'trending-down';
        return 'trending-flat';
    };

    const getTrendColor = () => {
        if (!burnRate) return colors.textMuted;
        if (burnRate.trend === 'increasing') return colors.warning;
        if (burnRate.trend === 'decreasing') return colors.success;
        return colors.textSecondary;
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    // Prepare chart data
    const chartLabels = chartData.length > 0
        ? chartData.filter((_, i) => i % 5 === 0).map(d => d.date.slice(8))
        : [''];
    const chartValues = chartData.length > 0
        ? chartData.map(d => d.amount)
        : [0];

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Insights</Text>
                <TouchableOpacity
                    style={styles.exportButton}
                    onPress={handleExportReport}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                        <Icon name="share" size={20} color={colors.text} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Burn Rate Card */}
            {burnRate && (
                <View style={styles.burnRateCard}>
                    <View style={styles.burnRateHeader}>
                        <Text style={styles.cardTitle}>Burn Rate</Text>
                        <View style={styles.trendBadge}>
                            <Icon name={getTrendIcon()} size={16} color={getTrendColor()} />
                            <Text style={[styles.trendText, { color: getTrendColor() }]}>
                                {burnRate.trend === 'stable' ? 'Stable' :
                                    `${Math.round(burnRate.trendPercentage)}% ${burnRate.trend}`}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.burnRateStats}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Daily Avg</Text>
                            <Text style={styles.statValue}>{formatCurrency(burnRate.dailyAverage)}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Weekly Avg</Text>
                            <Text style={styles.statValue}>{formatCurrency(burnRate.weeklyAverage)}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Month Projection</Text>
                            <Text style={styles.statValue}>{formatCurrency(burnRate.monthlyProjection)}</Text>
                        </View>
                    </View>

                    {burnRate.daysUntilBudgetExhausted !== null && (
                        <View style={styles.budgetWarning}>
                            <Icon
                                name={burnRate.daysUntilBudgetExhausted <= 5 ? 'warning' : 'info'}
                                size={18}
                                color={burnRate.daysUntilBudgetExhausted <= 5 ? colors.warning : colors.primary}
                            />
                            <Text style={styles.budgetWarningText}>
                                {burnRate.daysUntilBudgetExhausted <= 0
                                    ? 'Budget exhausted!'
                                    : `${burnRate.daysUntilBudgetExhausted} days until budget limit`}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Spending Chart */}
            {chartData.length > 0 && (
                <View style={styles.chartCard}>
                    <Text style={styles.cardTitle}>Last 30 Days</Text>
                    <LineChart
                        data={{
                            labels: chartLabels,
                            datasets: [{ data: chartValues.length > 0 ? chartValues : [0] }],
                        }}
                        width={width - 48}
                        height={180}
                        chartConfig={{
                            backgroundColor: colors.surface,
                            backgroundGradientFrom: colors.surface,
                            backgroundGradientTo: colors.surface,
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                            labelColor: () => colors.textSecondary,
                            style: { borderRadius: 16 },
                            propsForDots: { r: '3', strokeWidth: '1', stroke: colors.primary },
                        }}
                        bezier
                        style={styles.chart}
                    />
                </View>
            )}

            {/* Insights */}
            {insights.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Insights</Text>
                    {insights.map((insight, index) => (
                        <View
                            key={index}
                            style={[
                                styles.insightCard,
                                insight.type === 'warning' && styles.insightWarning,
                                insight.type === 'success' && styles.insightSuccess,
                            ]}
                        >
                            <Icon
                                name={insight.icon}
                                size={24}
                                color={
                                    insight.type === 'warning' ? colors.warning :
                                        insight.type === 'success' ? colors.success : colors.primary
                                }
                            />
                            <View style={styles.insightContent}>
                                <Text style={styles.insightTitle}>{insight.title}</Text>
                                <Text style={styles.insightDesc}>{insight.description}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Subscriptions */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recurring Payments</Text>
                    <TouchableOpacity onPress={handleDetectSubscriptions}>
                        <Text style={styles.detectButton}>Detect</Text>
                    </TouchableOpacity>
                </View>

                {subscriptions.length > 0 ? (
                    <>
                        <View style={styles.subscriptionTotal}>
                            <Text style={styles.subscriptionTotalLabel}>Monthly Total</Text>
                            <Text style={styles.subscriptionTotalValue}>
                                {formatCurrency(getMonthlySubscriptionCost())}
                            </Text>
                        </View>

                        {subscriptions.map((sub, index) => (
                            <View key={index} style={styles.subscriptionCard}>
                                <View style={styles.subscriptionInfo}>
                                    <Text style={styles.subscriptionName}>{sub.merchant}</Text>
                                    <Text style={styles.subscriptionFreq}>
                                        {sub.frequency} • Next: {sub.nextExpectedDate}
                                    </Text>
                                </View>
                                <Text style={styles.subscriptionAmount}>{formatCurrency(sub.amount)}</Text>
                            </View>
                        ))}
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <Icon name="refresh" size={40} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No recurring payments detected</Text>
                        <Text style={styles.emptySubtext}>Tap "Detect" to scan your transactions</Text>
                    </View>
                )}
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingTop: 48,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    exportButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    burnRateCard: {
        backgroundColor: colors.surface,
        marginHorizontal: 24,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    burnRateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    trendText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    burnRateStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    budgetWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        padding: 12,
        borderRadius: 10,
        marginTop: 16,
    },
    budgetWarningText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginLeft: 8,
    },
    chartCard: {
        backgroundColor: colors.surface,
        marginHorizontal: 24,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    chart: {
        marginTop: 12,
        borderRadius: 16,
    },
    section: {
        paddingHorizontal: 24,
        marginTop: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 12,
    },
    detectButton: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    insightCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
    },
    insightWarning: {
        borderLeftWidth: 3,
        borderLeftColor: colors.warning,
    },
    insightSuccess: {
        borderLeftWidth: 3,
        borderLeftColor: colors.success,
    },
    insightContent: {
        marginLeft: 14,
        flex: 1,
    },
    insightTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    insightDesc: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    subscriptionTotal: {
        backgroundColor: colors.primary + '20',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    subscriptionTotalLabel: {
        fontSize: 14,
        color: colors.text,
    },
    subscriptionTotalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.primary,
    },
    subscriptionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
    },
    subscriptionInfo: {
        flex: 1,
    },
    subscriptionName: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.text,
    },
    subscriptionFreq: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    subscriptionAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: colors.surface,
        borderRadius: 12,
    },
    emptyText: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 4,
    },
});
