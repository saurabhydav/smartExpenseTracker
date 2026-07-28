// PrismML Bonsai 1.7B Model Downloader & Manager UI Widget

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../utils';
import { BonsaiModelDownloader, BonsaiModelStatus, BonsaiDownloadProgress, BONSAI_MODEL } from '../services/BonsaiModelDownloader';
import { loadBonsaiModel, isBonsaiModelLoaded, unloadBonsaiModel } from '../services/BonsaiLlmService';

export const BonsaiModelDownloaderWidget: React.FC<{ onStatusChange?: (status: BonsaiModelStatus) => void }> = ({ onStatusChange }) => {
    const [status, setStatus] = useState<BonsaiModelStatus>('NOT_DOWNLOADED');
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [progress, setProgress] = useState<BonsaiDownloadProgress>({
        bytesWritten: 0,
        contentLength: BONSAI_MODEL.expectedSizeBytes,
        percent: 0,
        speedMbps: 0,
        remainingSeconds: 0,
    });

    useEffect(() => {
        setIsLoaded(isBonsaiModelLoaded());

        BonsaiModelDownloader.checkModelStatus().then(st => {
            setStatus(st);
            if (onStatusChange) onStatusChange(st);
        });

        BonsaiModelDownloader.setStatusCallback((st, err) => {
            setStatus(st);
            if (err) setErrorMessage(err);
            if (onStatusChange) onStatusChange(st);
        });

        BonsaiModelDownloader.setProgressCallback(pg => {
            setProgress(pg);
        });
    }, []);

    const handleStartDownload = async () => {
        setErrorMessage(null);
        try {
            await BonsaiModelDownloader.startDownload();
        } catch (e: any) {
            Alert.alert('Download Error', e.message || 'Could not download model.');
        }
    };

    const handlePauseDownload = async () => {
        await BonsaiModelDownloader.pauseDownload();
    };

    const handleLoadModel = async () => {
        setIsLoadingModel(true);
        setErrorMessage(null);
        try {
            const success = await loadBonsaiModel();
            setIsLoaded(success);
            if (success) {
                Alert.alert('Model Loaded', 'PrismML Bonsai 1.7B is now active in device RAM for 100% offline inference!');
            } else {
                Alert.alert('Load Failed', 'Could not load model into memory. Check if device has enough RAM.');
            }
        } catch (e: any) {
            Alert.alert('Load Error', e.message || 'Failed to load model.');
        } finally {
            setIsLoadingModel(false);
        }
    };

    const handleUnloadModel = async () => {
        await unloadBonsaiModel();
        setIsLoaded(false);
    };

    const handleDeleteModel = async () => {
        Alert.alert('Delete Model', `Are you sure you want to delete the ${BONSAI_MODEL.expectedSizeMB}MB Bonsai 1.7B model binary?`, [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => {
                    await unloadBonsaiModel();
                    setIsLoaded(false);
                    await BonsaiModelDownloader.deleteModel();
                } 
            }
        ]);
    };

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.treeIcon}>🌳</Text>
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.title}>PrismML Bonsai 1.7B (1-bit SLM)</Text>
                    <Text style={styles.subtitle}>
                        {isLoaded && '🟢 Model Active in Memory • 100% Offline'}
                        {!isLoaded && status === 'READY' && '⚡ Model Ready on Disk • Tap to Load'}
                        {status === 'DOWNLOADING' && `Downloading • ${progress.percent}% (${progress.speedMbps.toFixed(1)} MB/s)`}
                        {status === 'PAUSED' && 'Download Paused'}
                        {status === 'VERIFYING' && 'Verifying Integrity...'}
                        {status === 'NOT_DOWNLOADED' && `${BONSAI_MODEL.expectedSizeMB}MB Model Binary Not Downloaded`}
                        {status === 'ERROR' && 'Download/Load Error'}
                    </Text>
                </View>
                <View style={[
                    styles.badge, 
                    isLoaded ? styles.badgeActive : (status === 'READY' ? styles.badgeReady : styles.badgePending)
                ]}>
                    <Text style={styles.badgeText}>{isLoaded ? 'ACTIVE' : status}</Text>
                </View>
            </View>

            {/* Error banner */}
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
                            {(progress.bytesWritten / (1024 * 1024)).toFixed(1)} MB / {BONSAI_MODEL.expectedSizeMB} MB
                        </Text>
                        <Text style={styles.metaText}>
                            {progress.speedMbps > 0 ? `${progress.speedMbps.toFixed(1)} MB/s` : 'Connecting...'}
                        </Text>
                    </View>
                </View>
            )}

            {/* Controls */}
            <View style={styles.controls}>
                {status === 'NOT_DOWNLOADED' && (
                    <TouchableOpacity style={styles.primaryButton} onPress={handleStartDownload}>
                        <Icon name="cloud-download" size={18} color="#fff" />
                        <Text style={styles.buttonText}>Download Model ({BONSAI_MODEL.expectedSizeMB}MB)</Text>
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
                    <TouchableOpacity 
                        style={styles.loadButton} 
                        onPress={handleLoadModel}
                        disabled={isLoadingModel}
                    >
                        {isLoadingModel ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Icon name="bolt" size={18} color="#fff" />
                        )}
                        <Text style={styles.buttonText}>
                            {isLoadingModel ? 'Loading to Memory...' : 'Load Model into RAM'}
                        </Text>
                    </TouchableOpacity>
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
    unloadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(234, 179, 8, 0.12)',
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
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
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
