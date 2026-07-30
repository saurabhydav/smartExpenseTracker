import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, Text, ActivityIndicator } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface PetModelViewerProps {
    species: string;
    stage: number;
    emotion?: 'happy' | 'sad' | 'worried' | 'neutral';
    glbUri?: string | null;
    onLoadError?: () => void;
}

// Maps our app's emotion prop to the named animation clips defined in
// mobile/assets/pets3d/ASSET_SPEC.md — every generated model is required to
// ship clips with these exact names.
const EMOTION_TO_CLIP: Record<string, string> = {
    happy: 'happy',
    sad: 'sad',
    worried: 'sad',
    neutral: 'idle',
};

export const PetModelViewer: React.FC<PetModelViewerProps> = ({
    species,
    stage = 1,
    emotion = 'happy',
    glbUri = null,
    onLoadError,
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const rotationY = useRef(0);
    const rotationX = useRef(0);
    const velocityY = useRef(0);
    const velocityX = useRef(0);
    const glRef = useRef<any>(null);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
    const currentActionRef = useRef<THREE.AnimationAction | null>(null);
    // Tracks every geometry/material/texture we create so cleanup is complete
    // on unmount or species change — real GLTF assets carry real GPU memory
    // (textures especially), so leaking these is much costlier than it was
    // with the old primitive-only version.
    const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);

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
            },
        })
    ).current;

    // Crossfades to the animation clip matching the current emotion, once the
    // model and its clips have finished loading. Safe to call before load
    // completes — it just no-ops until actionsRef is populated.
    const playEmotionClip = (targetEmotion: string) => {
        const clipName = EMOTION_TO_CLIP[targetEmotion] ?? 'idle';
        const nextAction = actionsRef.current[clipName] ?? actionsRef.current['idle'];
        if (!nextAction || nextAction === currentActionRef.current) return;

        if (currentActionRef.current) {
            currentActionRef.current.crossFadeTo(nextAction.reset().play(), 0.35, true);
        } else {
            nextAction.reset().play();
        }
        currentActionRef.current = nextAction;
    };

    useEffect(() => {
        playEmotionClip(emotion);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [emotion]);

    const onContextCreate = async (gl: any) => {
        glRef.current = gl;
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;

        const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(2, width / height));
        renderer.outputColorSpace = THREE.SRGBColorSpace;

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

        // A real PBR-textured model needs environment reflections to read
        // correctly — the old flat-color version didn't need this, a loaded
        // GLTF with MeshStandardMaterial will look flat/grey without it.
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        scene.environment = pmremGenerator.fromScene(new THREE.Scene(), 0.04).texture;

        // Clean Minimal Stage Ring Platform
        const ringGeo1 = new THREE.RingGeometry(1.15, 1.3, 32);
        const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const stageRing1 = new THREE.Mesh(ringGeo1, ringMat1);
        stageRing1.rotation.x = Math.PI / 2;
        stageRing1.position.y = -1.0;
        scene.add(stageRing1);
        disposablesRef.current.push(ringGeo1, ringMat1);

        // Dynamic Soft Contact Shadow Disc (Grounding the pet)
        const shadowGeo = new THREE.RingGeometry(0, 0.9, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
        const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
        contactShadow.rotation.x = Math.PI / 2;
        contactShadow.position.y = -0.99;
        scene.add(contactShadow);
        disposablesRef.current.push(shadowGeo, shadowMat);

        const speciesColors: Record<string, number> = {
            cat: 0xa855f7, dog: 0xf59e0b, fox: 0xf97316, bunny: 0xec4899,
            panda: 0x10b981, koala: 0x64748b, owl: 0x6366f1, turtle: 0x06b6d4,
            hedgehog: 0xeab308, axolotl: 0x06b6d4,
        };
        const pColor = speciesColors[species.toLowerCase()] || 0xf59e0b;

        const particleGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const particleMat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.75 });
        const particles: THREE.Mesh[] = [];
        for (let i = 0; i < 24; i++) {
            const p = new THREE.Mesh(particleGeo, particleMat);
            p.position.set((Math.random() - 0.5) * 3, Math.random() * 2.5 - 0.8, (Math.random() - 0.5) * 3);
            particles.push(p);
            scene.add(p);
        }
        disposablesRef.current.push(particleGeo, particleMat);

        // Main Pet Group Container — this now actually gets a body added to it.
        const petGroup = new THREE.Group();
        scene.add(petGroup);

        // Bone socket fallbacks — used ONLY if the loaded GLTF doesn't already
        // define bones with these exact names (per ASSET_SPEC.md, a correctly
        // exported model will). Real bone-driven sockets move naturally with
        // the rig's animation; these static fallbacks don't, so treat this as
        // a safety net for an incorrectly-rigged asset, not the normal path.
        let headSocket: THREE.Object3D = new THREE.Group();
        let chestSocket: THREE.Object3D = new THREE.Group();
        let backSocket: THREE.Object3D = new THREE.Group();
        let handSocket: THREE.Object3D = new THREE.Group();
        headSocket.name = 'head_top'; headSocket.position.set(0, 1.6, 0);
        chestSocket.name = 'chest'; chestSocket.position.set(0, 0.4, 0.2);
        backSocket.name = 'back'; backSocket.position.set(0, 0.3, -0.4);
        handSocket.name = 'right_hand'; handSocket.position.set(0.8, 0.2, 0.3);

        let idleBob: (elapsed: number) => void = () => {};

        if (glbUri) {
            // --- REAL MODEL PATH ---
            const loader = new GLTFLoader();
            loader.load(
                glbUri,
                (gltf) => {
                    const model = gltf.scene;
                    petGroup.add(model);

                    // Track every material/texture/geometry in the loaded
                    // model so we can dispose them properly later.
                    model.traverse((child: any) => {
                        if (child.isMesh) {
                            disposablesRef.current.push(child.geometry);
                            const mats = Array.isArray(child.material) ? child.material : [child.material];
                            mats.forEach((m: THREE.Material) => {
                                disposablesRef.current.push(m);
                                Object.values(m).forEach((v: any) => {
                                    if (v && v.isTexture) disposablesRef.current.push(v);
                                });
                            });
                        }
                        // Prefer the model's own named bones over our static
                        // fallback groups, so accessories move with the rig.
                        if (child.name === 'head_top') headSocket = child;
                        if (child.name === 'chest') chestSocket = child;
                        if (child.name === 'back') backSocket = child;
                        if (child.name === 'right_hand') handSocket = child;
                    });

                    // Set up animation playback from the clips baked into the GLB.
                    if (gltf.animations && gltf.animations.length > 0) {
                        const mixer = new THREE.AnimationMixer(model);
                        mixerRef.current = mixer;
                        gltf.animations.forEach((clip) => {
                            actionsRef.current[clip.name] = mixer.clipAction(clip);
                        });
                        playEmotionClip(emotion);
                    } else {
                        console.warn(`[PetModelViewer] ${species}: GLB has no animation clips — check the export matches ASSET_SPEC.md`);
                    }

                    attachAccessories();
                    setLoading(false);
                },
                undefined,
                (err) => {
                    console.warn(`[PetModelViewer] Failed to load model for ${species}:`, err);
                    setError(true);
                    setLoading(false);
                    onLoadError?.();
                }
            );
        } else {
            // --- NO REAL ASSET YET ---
            // Be honest about this state rather than silently rendering
            // nothing. Swap this placeholder out the moment a real glbUri
            // is available for this species.
            console.warn(`[PetModelViewer] No glbUri provided for "${species}" — showing placeholder, not a real model.`);
            const placeholderGeo = new THREE.SphereGeometry(0.6, 16, 16);
            const placeholderMat = new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.6 });
            const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
            petGroup.add(placeholder);
            disposablesRef.current.push(placeholderGeo, placeholderMat);
            attachAccessories();
            setLoading(false);
        }

        function attachAccessories() {
            if (!headSocket.parent) petGroup.add(headSocket);
            if (!chestSocket.parent) petGroup.add(chestSocket);
            if (!backSocket.parent) petGroup.add(backSocket);
            if (!handSocket.parent) petGroup.add(handSocket);

            if (stage >= 2) {
                const scarfGeo = new THREE.TorusGeometry(0.55, 0.08, 8, 16);
                const scarfMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
                const scarfMesh = new THREE.Mesh(scarfGeo, scarfMat);
                scarfMesh.rotation.x = Math.PI / 2;
                chestSocket.add(scarfMesh);
                disposablesRef.current.push(scarfGeo, scarfMat);
            }
            if (stage >= 3) {
                const visorGeo = new THREE.BoxGeometry(0.6, 0.12, 0.15);
                const visorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 });
                const visorMesh = new THREE.Mesh(visorGeo, visorMat);
                visorMesh.position.set(0, -0.2, 0.4);
                headSocket.add(visorMesh);
                disposablesRef.current.push(visorGeo, visorMat);
            }
            if (stage >= 4) {
                const armorGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.4, 12);
                const armorMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 });
                const armorMesh = new THREE.Mesh(armorGeo, armorMat);
                chestSocket.add(armorMesh);
                disposablesRef.current.push(armorGeo, armorMat);
            }
            if (stage >= 5) {
                const crownGeo = new THREE.ConeGeometry(0.35, 0.35, 5);
                const crownMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.1 });
                const crownMesh = new THREE.Mesh(crownGeo, crownMat);
                crownMesh.rotation.x = Math.PI;
                crownMesh.position.y = 0.2;
                headSocket.add(crownMesh);
                disposablesRef.current.push(crownGeo, crownMat);
            }
            if (stage >= 7) {
                const wingGeo = new THREE.ConeGeometry(0.3, 1.2, 4);
                const wingMat = new THREE.MeshStandardMaterial({ color: 0x818cf8, transparent: true, opacity: 0.9 });
                const leftWing = new THREE.Mesh(wingGeo, wingMat); leftWing.position.set(-0.6, 0.4, 0); leftWing.rotation.z = 0.8;
                const rightWing = new THREE.Mesh(wingGeo, wingMat); rightWing.position.set(0.6, 0.4, 0); rightWing.rotation.z = -0.8;
                backSocket.add(leftWing); backSocket.add(rightWing);
                disposablesRef.current.push(wingGeo, wingMat);
            }
            if (stage >= 8) {
                const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
                const staffMat = new THREE.MeshStandardMaterial({ color: 0xec4899, metalness: 0.5 });
                const staffMesh = new THREE.Mesh(staffGeo, staffMat);
                const orbGeo = new THREE.SphereGeometry(0.15, 12, 12);
                const orbMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.8 });
                const orbMesh = new THREE.Mesh(orbGeo, orbMat);
                orbMesh.position.y = 0.9;
                staffMesh.add(orbMesh);
                handSocket.add(staffMesh);
                disposablesRef.current.push(staffGeo, staffMat, orbGeo, orbMat);
            }
            if (stage >= 9) {
                const haloGeo = new THREE.TorusGeometry(0.45, 0.04, 8, 24);
                const haloMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.9 });
                const haloMesh = new THREE.Mesh(haloGeo, haloMat);
                haloMesh.rotation.x = Math.PI / 2;
                haloMesh.position.y = 0.5;
                headSocket.add(haloMesh);
                disposablesRef.current.push(haloGeo, haloMat);
            }
        }

        let animationFrameId: number;
        const clock = new THREE.Clock();

        const render = () => {
            animationFrameId = requestAnimationFrame(render);
            const elapsedTime = clock.getElapsedTime();
            const delta = clock.getDelta();

            // Drive the real skeletal animation clips (idle/happy/sad/walk).
            mixerRef.current?.update(delta);

            rotationY.current += velocityY.current;
            rotationX.current = Math.max(-0.4, Math.min(0.4, rotationX.current + velocityX.current));
            velocityY.current *= 0.92;
            velocityX.current *= 0.92;
            petGroup.rotation.y = rotationY.current;
            petGroup.rotation.x = rotationX.current;
            petGroup.rotation.z = Math.sin(elapsedTime * 0.9) * 0.025;

            // Only apply the old hand-coded bounce/squash when there's no
            // real "idle" clip driving vertical motion already — otherwise
            // the two fight each other and the model jitters.
            const hasRealIdleClip = !!actionsRef.current['idle'];
            if (!hasRealIdleClip) {
                const bounceFreq = emotion === 'happy' ? 3 : 1.5;
                const bounceY = Math.sin(elapsedTime * bounceFreq) * 0.08;
                petGroup.position.y = bounceY;
                const sy = 1 + bounceY * 0.8;
                const sxz = 1 / Math.sqrt(sy);
                petGroup.scale.set(sxz, sy, sxz);
                const shadowScale = Math.max(0.4, 1.0 - bounceY * 0.4);
                contactShadow.scale.set(shadowScale, shadowScale, 1.0);
                (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * Math.max(0.2, 1.0 - bounceY * 0.4);
            }

            stageRing1.rotation.z = elapsedTime * 0.4;
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
            mixerRef.current?.stopAllAction();
            disposablesRef.current.forEach((d) => d.dispose());
            disposablesRef.current = [];
            renderer.dispose();
        };
    };

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#06b6d4" />
                    <Text style={styles.loadingText}>Loading 3D model…</Text>
                </View>
            )}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Couldn't load this pet's 3D model</Text>
                </View>
            )}
            <GLView style={styles.glView} onContextCreate={onContextCreate} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', height: 280, backgroundColor: '#0f172a', borderRadius: 16, overflow: 'hidden', position: 'relative' },
    glView: { flex: 1 },
    loadingContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    loadingText: { color: '#94a3b8', marginTop: 10, fontSize: 12, fontWeight: '600' },
    errorContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
    errorText: { color: '#ef4444', fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 16 },
});

export default PetModelViewer;
