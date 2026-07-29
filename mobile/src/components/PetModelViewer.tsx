import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, Text, ActivityIndicator } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';

interface PetModelViewerProps {
    species: string;
    stage: number;
    emotion?: 'happy' | 'sad' | 'worried' | 'neutral';
    glbUri?: string | null;
    onLoadError?: () => void;
}

export const PetModelViewer: React.FC<PetModelViewerProps> = ({
    species,
    stage = 1,
    emotion = 'happy',
    glbUri = null,
    onLoadError
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const rotationY = useRef(0);
    const rotationX = useRef(0);
    const velocityY = useRef(0);
    const velocityX = useRef(0);
    const glRef = useRef<any>(null);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                const dy = gestureState.vx * 0.06;
                const dx = gestureState.vy * 0.04;
                rotationY.current += dy;
                rotationX.current = Math.max(-0.4, Math.min(0.4, rotationX.current + dx));
                velocityY.current = dy;
                velocityX.current = dx;
            },
            onPanResponderRelease: () => {
                // Velocity inertia on touch release
            }
        })
    ).current;

    const onContextCreate = async (gl: any) => {
        glRef.current = gl;
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;

        // WebGL Renderer Setup with high-precision antialiasing
        const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(2, width / height));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 1.2, 4.5);

        // Anime Lighting Setup (Key Light + Cool Rim Light + Warm Fill Light)
        const ambientLight = new THREE.AmbientLight(0xfff8e7, 0.9);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
        keyLight.position.set(3, 5, 4);
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
        rimLight.position.set(-3, 2, -4);
        scene.add(rimLight);

        // Double Concentric Neon Anime Stage Rings
        const ringGeo1 = new THREE.RingGeometry(1.15, 1.3, 32);
        const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const stageRing1 = new THREE.Mesh(ringGeo1, ringMat1);
        stageRing1.rotation.x = Math.PI / 2;
        stageRing1.position.y = -1.0;
        scene.add(stageRing1);

        const ringGeo2 = new THREE.RingGeometry(1.35, 1.42, 32);
        const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xec4899, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
        const stageRing2 = new THREE.Mesh(ringGeo2, ringMat2);
        stageRing2.rotation.x = Math.PI / 2;
        stageRing2.position.y = -1.0;
        scene.add(stageRing2);

        // Dynamic Soft Contact Shadow Disc (Grounding the pet)
        const shadowGeo = new THREE.RingGeometry(0, 0.9, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
        const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
        contactShadow.rotation.x = Math.PI / 2;
        contactShadow.position.y = -0.99;
        scene.add(contactShadow);

        // Species Color-Coded Anime Palette
        const speciesColors: Record<string, number> = {
            cat: 0xa855f7,      // Purple
            dog: 0xf59e0b,      // Amber
            fox: 0xf97316,      // Flame Orange
            bunny: 0xec4899,    // Pink
            panda: 0x10b981,    // Emerald Green
            koala: 0x64748b,    // Slate Gray
            owl: 0x6366f1,      // Indigo
            turtle: 0x06b6d4,   // Teal
            hedgehog: 0xeab308, // Gold
            axolotl: 0x06b6d4   // Cyan
        };
        const pColor = speciesColors[species.toLowerCase()] || 0xf59e0b;

        // Species Particle System (24 elements)
        const particleGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const particleMat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.75 });
        const particles: THREE.Mesh[] = [];
        for (let i = 0; i < 24; i++) {
            const p = new THREE.Mesh(particleGeo, particleMat);
            p.position.set(
                (Math.random() - 0.5) * 3,
                Math.random() * 2.5 - 0.8,
                (Math.random() - 0.5) * 3
            );
            particles.push(p);
            scene.add(p);
        }

        // Main Pet Group Container
        const petGroup = new THREE.Group();
        scene.add(petGroup);

        // Bone Socket Attachment Node Helper
        const headSocket = new THREE.Group(); headSocket.name = "head_top"; headSocket.position.set(0, 1.6, 0); petGroup.add(headSocket);
        const chestSocket = new THREE.Group(); chestSocket.name = "chest"; chestSocket.position.set(0, 0.4, 0.2); petGroup.add(chestSocket);
        const backSocket = new THREE.Group(); backSocket.name = "back"; backSocket.position.set(0, 0.3, -0.4); petGroup.add(backSocket);
        const handSocket = new THREE.Group(); handSocket.name = "right_hand"; handSocket.position.set(0.8, 0.2, 0.3); petGroup.add(handSocket);

        // 3D Stage Accessory System (Stages 2 to 10)
        if (stage >= 2) {
            // Stage 2 Scarf
            const scarfGeo = new THREE.TorusGeometry(0.55, 0.08, 8, 16);
            const scarfMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
            const scarfMesh = new THREE.Mesh(scarfGeo, scarfMat);
            scarfMesh.rotation.x = Math.PI / 2;
            chestSocket.add(scarfMesh);
        }
        if (stage >= 3) {
            // Stage 3 Visor / Specs
            const visorGeo = new THREE.BoxGeometry(0.6, 0.12, 0.15);
            const visorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 });
            const visorMesh = new THREE.Mesh(visorGeo, visorMat);
            visorMesh.position.set(0, -0.2, 0.4);
            headSocket.add(visorMesh);
        }
        if (stage >= 4) {
            // Stage 4 Chest Plate Armor
            const armorGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.4, 12);
            const armorMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 });
            const armorMesh = new THREE.Mesh(armorGeo, armorMat);
            chestSocket.add(armorMesh);
        }
        if (stage >= 5) {
            // Stage 5 Golden Crown
            const crownGeo = new THREE.ConeGeometry(0.35, 0.35, 5);
            const crownMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.1 });
            const crownMesh = new THREE.Mesh(crownGeo, crownMat);
            crownMesh.rotation.x = Math.PI;
            crownMesh.position.y = 0.2;
            headSocket.add(crownMesh);
        }
        if (stage >= 7) {
            // Stage 7 Wings
            const wingGeo = new THREE.ConeGeometry(0.3, 1.2, 4);
            const wingMat = new THREE.MeshStandardMaterial({ color: 0x818cf8, transparent: true, opacity: 0.9 });
            const leftWing = new THREE.Mesh(wingGeo, wingMat); leftWing.position.set(-0.6, 0.4, 0); leftWing.rotation.z = 0.8;
            const rightWing = new THREE.Mesh(wingGeo, wingMat); rightWing.position.set(0.6, 0.4, 0); rightWing.rotation.z = -0.8;
            backSocket.add(leftWing); backSocket.add(rightWing);
        }
        if (stage >= 8) {
            // Stage 8 Archmage Staff
            const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
            const staffMat = new THREE.MeshStandardMaterial({ color: 0xec4899, metalness: 0.5 });
            const staffMesh = new THREE.Mesh(staffGeo, staffMat);
            const orbGeo = new THREE.SphereGeometry(0.15, 12, 12);
            const orbMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.8 });
            const orbMesh = new THREE.Mesh(orbGeo, orbMat);
            orbMesh.position.y = 0.9;
            staffMesh.add(orbMesh);
            handSocket.add(staffMesh);
        }
        if (stage >= 9) {
            // Stage 9 Celestial Halo
            const haloGeo = new THREE.TorusGeometry(0.45, 0.04, 8, 24);
            const haloMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.9 });
            const haloMesh = new THREE.Mesh(haloGeo, haloMat);
            haloMesh.rotation.x = Math.PI / 2;
            haloMesh.position.y = 0.5;
            headSocket.add(haloMesh);
        }

        setLoading(false);

        // Animation Loop
        let animationFrameId: number;
        let clock = new THREE.Clock();

        const render = () => {
            animationFrameId = requestAnimationFrame(render);

            const elapsedTime = clock.getElapsedTime();

            // Inertial friction damping physics
            rotationY.current += velocityY.current;
            rotationX.current = Math.max(-0.4, Math.min(0.4, rotationX.current + velocityX.current));
            velocityY.current *= 0.92;
            velocityX.current *= 0.92;

            // Smooth rotation interpolation
            petGroup.rotation.y = rotationY.current;
            petGroup.rotation.x = rotationX.current;

            // Weight shift Z-roll
            petGroup.rotation.z = Math.sin(elapsedTime * 0.9) * 0.025;

            // Breathing & Idle bounce
            const bounceFreq = emotion === 'happy' ? 3 : 1.5;
            const bounceY = Math.sin(elapsedTime * bounceFreq) * 0.08;
            petGroup.position.y = bounceY;

            // Volume-Preserving Squash & Stretch (Sy * Sx * Sz = Constant Volume)
            const sy = 1 + bounceY * 0.8;
            const sxz = 1 / Math.sqrt(sy);
            petGroup.scale.set(sxz, sy, sxz);

            // Living Chest Micro-Breathing
            chestSocket.scale.setScalar(1 + Math.sin(elapsedTime * 2.2) * 0.03);

            // Periodic Eye Blinking (every 4.0 seconds for 0.15s)
            const blinkCycle = elapsedTime % 4.0;
            const isBlinking = blinkCycle < 0.15;
            headSocket.scale.y = isBlinking ? 0.1 : 1.0;

            // Dynamic Soft Contact Shadow scaling & opacity falloff
            const shadowScale = Math.max(0.4, 1.0 - bounceY * 0.4);
            contactShadow.scale.set(shadowScale, shadowScale, 1.0);
            (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * Math.max(0.2, 1.0 - bounceY * 0.4);

            // Dual stage ring pulse
            stageRing1.rotation.z = elapsedTime * 0.4;
            stageRing2.rotation.z = -elapsedTime * 0.3;

            // Animate particles
            particles.forEach((p, idx) => {
                p.position.y += Math.sin(elapsedTime + idx) * 0.003;
                if (p.position.y > 2.2) p.position.y = -0.8;
            });

            renderer.render(scene, camera);
            gl.endFrameEXP();
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
            renderer.dispose();
            ringGeo1.dispose(); ringMat1.dispose();
            ringGeo2.dispose(); ringMat2.dispose();
            shadowGeo.dispose(); shadowMat.dispose();
            particleGeo.dispose(); particleMat.dispose();
        };
    };

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#06b6d4" />
                    <Text style={styles.loadingText}>Loading 3D Anime Renderer...</Text>
                </View>
            )}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>3D Engine Fallback</Text>
                </View>
            )}
            <GLView style={styles.glView} onContextCreate={onContextCreate} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 280,
        backgroundColor: '#0f172a',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    glView: {
        flex: 1,
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingText: {
        color: '#94a3b8',
        marginTop: 10,
        fontSize: 12,
        fontWeight: '600',
    },
    errorContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 12,
        fontWeight: '600',
    },
});

export default PetModelViewer;

