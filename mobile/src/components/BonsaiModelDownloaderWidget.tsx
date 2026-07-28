// PrismML Bonsai Model Downloader & Manager UI Card Component

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../utils';
import { 
    BonsaiModelDownloader, 
    BonsaiModelStatus, 
    BonsaiDownloadProgress, 
    BonsaiModelMetadata, 
    BONSAI_MODEL 
} from '../services/BonsaiModelDownloader';
import { loadBonsaiModel, isBonsaiModelLoaded, unloadBonsaiModel } from '../services/BonsaiLlmService';

export interface BonsaiModelCardProps {
    model?: BonsaiModelMetadata;
    onStatusChange?: (status: BonsaiModelStatus) => void;
}

export const BonsaiModelCard: React.FC<BonsaiModelCardProps> = ({ 
    model = BONSAI_MODEL, 
    onStatusChange 
}) => {
    const [status, setStatus] = useState<BonsaiModelStatus>('NOT_DOWNLOADED');
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [compatibility, setCompatibility] = useState<{ isCompatible: boolean; reason?: string }>({ isCompatible: true });
    const [progress, setProgress] = useState<BonsaiDownloadProgress>({
        bytesWritten: 0,
        contentLength: model.expectedSizeBytes,
        percent: 0,
        speedMbps: 0,
        remainingSeconds: 0,
    });

    const checkState = async () => {
        const loaded = isBonsaiModelLoaded(model.id);
        setIsLoaded(loaded);

        const comp = await BonsaiModelDownloader.checkModelCompatibility(model);
        setCompatibility(comp);

        const st = await BonsaiModelDownloader.checkSpecificModelStatus(model);
        setStatus(st);
        if (onStatusChange) onStatusChange(st);
    };

    useEffect(() => {
        checkState();

        const removeStatusListener = BonsaiModelDownloader.addStatusListener((st, err) => {
            if (BonsaiModelDownloader.getActiveModelId() === model.id) {
                setStatus(st);
                if (err) setErrorMessage(err);
                if (onStatusChange) onStatusChange(st);
            }
        });

        const removeProgressListener = BonsaiModelDownloader.addProgressListener(pg => {
            if (BonsaiModelDownloader.getActiveModelId() === model.id) {
                setProgress(pg);
            }
        });

        return () => {
            removeStatusListener();
            removeProgressListener();
        };
    }, [model.id]);

    const handleStartDownload = async () => {
        setErrorMessage(null);
        try {
            await BonsaiModelDownloader.startSpecificDownload(model);
            await checkState();
        } catch (e: any) {
            Alert.alert('Download Error', e.message || 'Could not download model.');
        }
    };

    const handlePauseDownload = async () => {
        await BonsaiModelDownloader.pauseDownload();
        await checkState();
    };

    const handleLoadModel = async () => {
        setIsLoadingModel(true);
        setErrorMessage(null);
        try {
            const success = await loadBonsaiModel(model);
            setIsLoaded(success);
            if (success) {
                Alert.alert('Model Loaded', `${model.modelName} is now active in device RAM for 100% offline inference!`);
            } else {
                Alert.alert('Load Failed', 'Could not load model into memory. Check if device has enough RAM.');
            }
        } catch (e: any) {
            Alert.alert('Load Error', e.message || 'Failed to load model.');
        } finally {
            setIsLoadingModel(false);
            await checkState();
        }
    };

    const handleUnloadModel = async () => {
        await unloadBonsaiModel();
        setIsLoaded(false);
        await checkState();
    };

    const handleDeleteModel = async () => {
        Alert.alert('Delete Model', `Are you sure you want to delete the ${model.expectedSizeMB}MB ${model.modelName} model binary?`, [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => {
                    if (isLoaded) {
                        await unloadBonsaiModel();
                        setIsLoaded(false);
                    }
                    await BonsaiModelDownloader.deleteSpecificModel(model);
                    await checkState();
                } 
            }
        ]);
    };

    return (
        <View style={[styles.card, isLoaded && styles.cardActiveLoaded]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.treeIcon}>🌳</Text>
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.title}>{model.modelName}</Text>
                    <Text style={styles.subtitle}>
                        {isLoaded && '🟢 Model Active in Memory • 100% Offline'}
                        {!isLoaded && status === 'READY' && '⚡ Model Ready on Disk • Tap to Load'}
                        {status === 'DOWNLOADING' && `Downloading • ${progress.percent}% (${progress.speedMbps.toFixed(1)} MB/s)`}
                        {status === 'PAUSED' && 'Download Paused'}
                        {status === 'VERIFYING' && 'Verifying Integrity...'}
                        {status === 'NOT_DOWNLOADED' && `${model.expectedSizeMB}MB Model Binary Not Downloaded`}
                        {status === 'ERROR' && 'Download/Load Error'}
                    </Text>
                </View>
                <View style={[
                    styles.badge, 
                    isLoaded ? styles.badgeActive : (status === 'READY' ? styles.badgeReady : styles.badgePending)
                ]}>
                    <Text style={[styles.badgeText, isLoaded && styles.badgeTextActive]}>
                        {isLoaded ? 'ACTIVE' : status}
                    </Text>
                </View>
            </View>

            {/* Description */}
            <Text style={styles.descriptionText}>{model.description}</Text>

            {/* Device Compatibility Warning */}
            {!compatibility.isCompatible && (
                <View style={styles.warningContainer}>
                    <Icon name="warning" size={16} color="#f59e0b" />
                    <Text style={styles.warningText}>{compatibility.reason}</Text>
                </View>
            )}

            {/* Specs Summary Row */}
            <View style={styles.specsContainer}>
                <View style={styles.specItem}>
                    <Text style={styles.specLabel}>File Size</Text>
                    <Text style={styles.specValue}>{model.expectedSizeMB} MB</Text>
                </View>
                <View style={styles.specItem}>
                    <Text style={styles.specLabel}>RAM Required</Text>
                    <Text style={styles.specValue}>{model.ramRequired}</Text>
                </View>
                <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Quantization</Text>
                    <Text style={styles.specValue}>{model.quantization}</Text>
                </View>
            </View>

            {/* Error Banner */}
            {errorMessage && (
                <View style={styles.errorContainer}>
                    <Icon name="error-outline" size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            )}

            {/* Progress Bar */}
            {(status === 'DOWNLOADING' || status === 'PAUSED') && (
                <View style={styles.progressContainer}>
                    <View style={styles.progressBarBackground}>
                        <View style={[styles.progressBarFill, { width: `${progress.percent}%` }]} />
                    </View>
                    <View style={styles.progressMeta}>
                        <Text style={styles.metaText}>
                            {(progress.bytesWritten / (1024 * 1024)).toFixed(1)} MB / {model.expectedSizeMB} MB ({progress.percent}%)
                        </Text>
                        <Text style={styles.metaText}>
                            {status === 'PAUSED' ? 'Paused' : (progress.speedMbps > 0 ? `${progress.speedMbps.toFixed(1)} MB/s` : 'Connecting...')}
                        </Text>
                    </View>
                </View>
            )}

            {/* Controls */}
            <View style={styles.controls}>
                {status === 'NOT_DOWNLOADED' && (
                    <TouchableOpacity 
                        style={[styles.primaryButton, !compatibility.isCompatible && styles.disabledButton]} 
                        onPress={handleStartDownload}
                        disabled={!compatibility.isCompatible}
                    >
                        <Icon name={compatibility.isCompatible ? "cloud-download" : "block"} size={18} color="#fff" />
                        <Text style={styles.buttonText}>
                            {compatibility.isCompatible ? `Download Model (${model.expectedSizeMB}MB)` : 'Incompatible Device'}
                        </Text>
                    </TouchableOpacity>
                )}

                {status === 'DOWNLOADING' && (
                    <TouchableOpacity style={styles.secondaryButton} onPress={handlePauseDownload}>
                        <Icon name="pause" size={18} color={colors.primary} />
                        <Text style={styles.secondaryButtonText}>Pause Download</Text>
                    </TouchableOpacity>
                )}

                {status === 'PAUSED' && (
                    <TouchableOpacity style={styles.primaryButton} onPress={handleStartDownload}>
                        <Icon name="play-arrow" size={18} color="#fff" />
                        <Text style={styles.buttonText}>Resume Download</Text>
                    </TouchableOpacity>
                )}

                {status === 'READY' && !isLoaded && (
                    <View style={styles.loadedActions}>
                        <View style={styles.readyTag}>
                            <Icon name="check-circle" size={16} color="#10b981" />
                            <Text style={styles.readyText}>Ready</Text>
                        </View>
                        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteModel}>
                            <Icon name="delete-outline" size={16} color="#ef4444" />
                            <Text style={styles.deleteText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isLoaded && (
                    <View style={styles.loadedActions}>
                        <TouchableOpacity style={styles.unloadButton} onPress={handleUnloadModel}>
                            <Icon name="power-settings-new" size={16} color="#eab308" />
                            <Text style={styles.unloadText}>Unload RAM</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteModel}>
                            <Icon name="delete-outline" size={16} color="#ef4444" />
                            <Text style={styles.deleteText}>Delete Binary</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {status === 'VERIFYING' && (
                    <View style={styles.verifyingContainer}>
                        <ActivityIndicator color={colors.primary} size="small" />
                        <Text style={styles.verifyingText}>Verifying GGUF Checksum...</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

export const BonsaiModelDownloaderWidget: React.FC<{ onStatusChange?: (status: BonsaiModelStatus) => void }> = (props) => {
    return <BonsaiModelCard model={BONSAI_MODEL} {...props} />;
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    cardActiveLoaded: {
        borderColor: '#3b82f6',
        backgroundColor: '#0f172a',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    treeIcon: {
        fontSize: 22,
    },
    headerText: {
        flex: 1,
    },
    title: {
        color: '#f8fafc',
        fontSize: 15,
        fontWeight: '700',
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: 11,
        marginTop: 2,
    },
    descriptionText: {
        color: '#cbd5e1',
        fontSize: 12,
        marginTop: 10,
        lineHeight: 17,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.25)',
    },
    badgeReady: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    badgePending: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#34d399',
    },
    badgeTextActive: {
        color: '#60a5fa',
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        padding: 8,
        borderRadius: 8,
        marginTop: 10,
    },
    warningText: {
        color: '#fcd34d',
        fontSize: 11,
        flex: 1,
    },
    specsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#0f172a',
        borderRadius: 10,
        padding: 10,
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    specItem: {
        alignItems: 'center',
        flex: 1,
    },
    specLabel: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    specValue: {
        color: '#f8fafc',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        padding: 8,
        borderRadius: 8,
        marginTop: 10,
    },
    errorText: {
        color: '#fca5a5',
        fontSize: 11,
        flex: 1,
    },
    progressContainer: {
        marginTop: 14,
    },
    progressBarBackground: {
        height: 8,
        backgroundColor: '#334155',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    progressMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    metaText: {
        color: '#64748b',
        fontSize: 11,
    },
    controls: {
        marginTop: 14,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
    },
    disabledButton: {
        backgroundColor: '#475569',
        opacity: 0.6,
    },
    loadButton: {
        backgroundColor: '#10b981',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    secondaryButton: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
    },
    secondaryButtonText: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    loadedActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingTop: 4,
    },
    readyTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    readyText: {
        color: '#10b981',
        fontSize: 13,
        fontWeight: '700',
    },
    unloadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
    },
    unloadText: {
        color: '#eab308',
        fontSize: 12,
        fontWeight: '600',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    deleteText: {
        color: '#ef4444',
        fontSize: 12,
        fontWeight: '600',
    },
    verifyingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    verifyingText: {
        color: '#94a3b8',
        fontSize: 13,
    },
});
