// Bonsai Multi-Model Manager Screen with Full Progress Bar, Verification & Hardware Guardrails

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../utils';
import {
    BonsaiModelDownloader,
    BONSAI_MODELS,
    BonsaiModelMetadata,
    BonsaiModelStatus,
    BonsaiDownloadProgress
} from '../services/BonsaiModelDownloader';
import { loadBonsaiModel, isBonsaiModelLoaded, unloadBonsaiModel } from '../services/BonsaiLlmService';
import { BonsaiModelCard } from '../components/BonsaiModelDownloaderWidget';

export const BonsaiModelManagerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [statuses, setStatuses] = useState<Record<string, BonsaiModelStatus>>({});
    const [progresses, setProgresses] = useState<Record<string, BonsaiDownloadProgress>>({});
    const [capabilities, setCapabilities] = useState<Record<string, { isCompatible: boolean; reason?: string }>>({});
    const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
    const [freeStorage, setFreeStorage] = useState<number>(0);
    const [activeDownloadingId, setActiveDownloadingId] = useState<string | null>(null);

    const refreshStatuses = async () => {
        try {
            const free = await BonsaiModelDownloader.getFreeStorageMB();
            setFreeStorage(free);

            const [statusResults, capResults] = await Promise.all([
                Promise.all(BONSAI_MODELS.map(m => BonsaiModelDownloader.checkSpecificModelStatus(m))),
                Promise.all(BONSAI_MODELS.map(m => BonsaiModelDownloader.checkModelCompatibility(m))),
            ]);

            const newStatuses: Record<string, BonsaiModelStatus> = {};
            const newCaps: Record<string, { isCompatible: boolean; reason?: string }> = {};

            BONSAI_MODELS.forEach((m, idx) => {
                newStatuses[m.id] = statusResults[idx];
                newCaps[m.id] = capResults[idx];
            });

            setStatuses(newStatuses);
            setCapabilities(newCaps);

            if (isBonsaiModelLoaded()) {
                setLoadedModelId('bonsai-360m');
            } else {
                setLoadedModelId(null);
            }
        } catch (e) {
            console.error('[BonsaiModelManager] Error refreshing statuses:', e);
        }
    };

    useEffect(() => {
        refreshStatuses();

        const unsubStatus = BonsaiModelDownloader.addStatusListener((st) => {
            refreshStatuses();
        });

        const unsubProgress = BonsaiModelDownloader.addProgressListener((pg) => {
            const activeId = BonsaiModelDownloader.getActiveModelId();
            setProgresses(prev => ({ ...prev, [activeId]: pg }));
        });

        return () => {
            unsubStatus();
            unsubProgress();
        };
    }, []);

    const handleDownloadModel = async (model: BonsaiModelMetadata) => {
        const cap = capabilities[model.id];
        if (cap && !cap.isCompatible) {
            Alert.alert('Device Incompatible', cap.reason || 'Hardware specs insufficient for this model tier.');
            return;
        }

        setStatuses(prev => ({ ...prev, [model.id]: 'DOWNLOADING' }));

        try {
            await BonsaiModelDownloader.startSpecificDownload(model, (st) => {
                setStatuses(prev => ({ ...prev, [model.id]: st }));
            });
            await refreshStatuses();
        } catch (e: any) {
            Alert.alert('Download Error', e.message || 'Download failed.');
            await refreshStatuses();
        }
    };

    const handlePauseDownload = async (model: BonsaiModelMetadata) => {
        await BonsaiModelDownloader.pauseDownload();
        setStatuses(prev => ({ ...prev, [model.id]: 'PAUSED' }));
        await refreshStatuses();
    };

    const handleDeleteModel = (model: BonsaiModelMetadata) => {
        Alert.alert(
            'Delete Model',
            `Delete ${model.modelName} (${model.expectedSizeMB} MB) to free up storage space?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (loadedModelId === model.id) {
                                await unloadBonsaiModel();
                                setLoadedModelId(null);
                            }
                            await BonsaiModelDownloader.deleteSpecificModel(model);
                            Alert.alert('Deleted', `${model.modelName} binary removed from storage.`);
                            await refreshStatuses();
                        } catch (e: any) {
                            Alert.alert('Delete Error', e.message || 'Could not delete model.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <ScrollView style={styles.container}>
            {/* Screen Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            navigation.navigate('MainTabs', { screen: 'AiAdvisor' });
                        }
                    }}
                    style={styles.backButton}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Icon name="arrow-back" size={24} color="#f8fafc" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Models</Text>
                    <Text style={styles.headerSubtitle}>Free Device Storage: {freeStorage} MB</Text>
                </View>
            </View>

            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Bonsai Offline AI Models</Text>
                <Text style={styles.sectionSubtitle}>Download, monitor progress, or delete offline GGUF binaries.</Text>

                {BONSAI_MODELS.map((model) => (
                    <BonsaiModelCard key={model.id} model={model} />
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 48,
        paddingBottom: 16,
        backgroundColor: '#1e293b',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    backButton: {
        marginRight: 16,
        padding: 4,
    },
    headerTitle: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: '700',
    },
    headerSubtitle: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2,
    },
    content: {
        padding: 16,
    },
    sectionTitle: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    sectionSubtitle: {
        color: '#94a3b8',
        fontSize: 13,
        marginBottom: 16,
    },
    card: {
        backgroundColor: 'rgba(30, 41, 59, 0.85)',
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    activeCard: {
        borderColor: '#10b981',
        borderWidth: 1.5,
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        shadowColor: '#10b981',
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    disabledCard: {
        opacity: 0.8,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    modelIconBg: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    treeIcon: {
        fontSize: 24,
    },
    cardHeaderText: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 6,
    },
    modelName: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
        flexShrink: 1,
        letterSpacing: 0.3,
    },
    targetDevice: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 3,
        fontWeight: '500',
    },
    activeBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        flexShrink: 0,
    },
    activeBadgeText: {
        color: '#34d399',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    modelDesc: {
        color: '#cbd5e1',
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 14,
    },
    incompatibleBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        padding: 10,
        borderRadius: 12,
        marginBottom: 14,
    },
    incompatibleText: {
        color: '#fbbf24',
        fontSize: 12,
        marginLeft: 8,
        flex: 1,
        fontWeight: '500',
    },
    specsContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    specItem: {
        alignItems: 'center',
        flex: 1,
    },
    specLabel: {
        color: '#64748b',
        fontSize: 11,
        marginBottom: 4,
        fontWeight: '500',
    },
    specValue: {
        color: '#f8fafc',
        fontSize: 13,
        fontWeight: '600',
    },
    progressContainer: {
        marginBottom: 14,
    },
    progressBarBackground: {
        height: 10,
        backgroundColor: 'rgba(51, 65, 85, 0.8)',
        borderRadius: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#3b82f6',
        borderRadius: 6,
    },
    progressMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    metaText: {
        color: '#38bdf8',
        fontSize: 12,
        fontWeight: '600',
    },
    verifyingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        padding: 10,
        borderRadius: 12,
        marginBottom: 14,
    },
    verifyingText: {
        color: colors.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    dotGreen: {
        backgroundColor: '#10b981',
    },
    dotYellow: {
        backgroundColor: '#f59e0b',
    },
    dotGray: {
        backgroundColor: '#64748b',
    },
    statusText: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '500',
    },
    buttonGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deleteButton: {
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        marginRight: 8,
    },
    downloadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        elevation: 3,
    },
    pauseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    pauseButtonText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
    },
    disabledButton: {
        backgroundColor: '#475569',
        opacity: 0.5,
    },
    downloadButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
    },
    readyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    readyText: {
        color: '#34d399',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
    },
});
