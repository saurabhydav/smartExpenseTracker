import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface AiAdvisorDialogProps {
    message: string;
    isVisible: boolean;
}

export const AiAdvisorDialog: React.FC<AiAdvisorDialogProps> = ({ message, isVisible }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [fadeAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        if (isVisible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            let i = 0;
            setDisplayedText('');
            const timer = setInterval(() => {
                if (i < message.length) {
                    setDisplayedText((prev) => prev + message.charAt(i));
                    i++;
                } else {
                    clearInterval(timer);
                }
            }, 30);
            return () => clearInterval(timer);
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible, message, fadeAnim]);

    if (!isVisible && fadeAnim.valueOf() === 0) return null;

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <View style={styles.bubble}>
                <Text style={styles.text}>{displayedText}</Text>
            </View>
            <View style={styles.tail} />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        right: 20,
        left: 60,
        zIndex: 100,
    },
    bubble: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 15,
        borderRadius: 20,
        borderBottomRightRadius: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    text: {
        fontFamily: 'Inter-Medium',
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 20,
    },
    tail: {
        position: 'absolute',
        bottom: -10,
        right: 15,
        width: 0,
        height: 0,
        borderTopWidth: 15,
        borderTopColor: 'rgba(255, 255, 255, 0.95)',
        borderLeftWidth: 15,
        borderLeftColor: 'transparent',
    }
});
