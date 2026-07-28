import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// Import local 100% offline Base64 Three.js (0 CDN network requests needed)
import THREE_BASE64 from '../assets/threeMinJs';

export interface Pet3DProps {
    speciesId: 'cat' | 'dog' | 'bunny' | 'panda' | 'fox' | 'koala';
    stageLevel: number;
    primaryColor: string;
    secondaryColor: string;
    bellyColor: string;
    emotion: 'idle' | 'happy' | 'excited';
    isBlinking: boolean;
}

export const Pet3DCanvas: React.FC<Pet3DProps> = ({
    speciesId,
    stageLevel,
    primaryColor,
    secondaryColor,
    bellyColor,
    emotion,
    isBlinking,
}) => {
    const webViewRef = useRef<any>(null);

    // Send state updates to 3D WebGL scene in real time
    useEffect(() => {
        if (webViewRef.current) {
            const updateMsg = JSON.stringify({
                speciesId,
                stageLevel,
                primaryColor,
                secondaryColor,
                bellyColor,
                emotion,
                isBlinking,
            });
            webViewRef.current.injectJavaScript(`
                if (window.updatePet3D) {
                    window.updatePet3D(${updateMsg});
                }
                true;
            `);
        }
    }, [speciesId, stageLevel, primaryColor, secondaryColor, bellyColor, emotion, isBlinking]);

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; touch-action: none; }
            body, html { width: 100%; height: 100%; overflow: hidden; background: transparent; }
            #canvas-container { width: 100%; height: 100%; position: relative; }
        </style>
        <script>
            try {
                window.eval(atob("${THREE_BASE64}"));
            } catch(e) {
                console.error('Three.js Base64 decode error:', e);
            }
        </script>
    </head>
    <body>
        <div id="canvas-container"></div>
        <script>
            // =========================================================
            // THREE.JS 3D POKÉMON GO ENGINE WITH CEL-SHADING & RIM LIGHT
            // =========================================================
            let scene, camera, renderer, petGroup, auraGroup, particleGroup;
            let currentSpecies = '${speciesId}';
            let currentStage = ${stageLevel};
            let currentEmotion = '${emotion}';
            let blinking = ${isBlinking};

            let primaryHex = '${primaryColor}';
            let secondaryHex = '${secondaryColor}';
            let bellyHex = '${bellyColor}';

            // Touch rotation variables
            let isDragging = false;
            let previousTouchX = 0;
            let previousTouchY = 0;
            let targetRotationY = 0;
            let targetRotationX = 0;

            function init3D() {
                const container = document.getElementById('canvas-container');
                const width = container.clientWidth || 240;
                const height = container.clientHeight || 190;

                scene = new THREE.Scene();

                camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
                camera.position.set(0, 0.5, 6.2);

                renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
                renderer.setSize(width, height);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                container.appendChild(renderer.domElement);

                // Lighting: Pokémon GO Style (Ambient + Key Light + Rim Light)
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
                scene.add(ambientLight);

                const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
                keyLight.position.set(3, 5, 4);
                keyLight.castShadow = true;
                scene.add(keyLight);

                const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
                rimLight.position.set(-4, 3, -4);
                scene.add(rimLight);

                const fillLight = new THREE.PointLight(0xfacc15, 0.6, 10);
                fillLight.position.set(0, -2, 3);
                scene.add(fillLight);

                // Root Pet Group
                petGroup = new THREE.Group();
                scene.add(petGroup);

                // Aura Group (Stage 10)
                auraGroup = new THREE.Group();
                scene.add(auraGroup);

                // Particle Group
                particleGroup = new THREE.Group();
                scene.add(particleGroup);

                buildPetMesh();

                // Touch & Mouse rotation listeners (360° interactive orbit)
                window.addEventListener('pointerdown', (e) => {
                    isDragging = true;
                    previousTouchX = e.clientX;
                    previousTouchY = e.clientY;
                });

                window.addEventListener('pointermove', (e) => {
                    if (!isDragging) return;
                    const deltaX = e.clientX - previousTouchX;
                    const deltaY = e.clientY - previousTouchY;

                    targetRotationY += deltaX * 0.015;
                    targetRotationX += deltaY * 0.008;
                    targetRotationX = Math.max(-0.4, Math.min(0.4, targetRotationX));

                    previousTouchX = e.clientX;
                    previousTouchY = e.clientY;
                });

                window.addEventListener('pointerup', () => { isDragging = false; });

                animate();
            }

            // =========================================================
            // RECURSIVE DISPOSAL HELPER (Prevents WebGL Memory Leaks)
            // =========================================================
            function disposeGroup(group) {
                while (group.children.length > 0) {
                    const child = group.children[0];
                    if (child.children && child.children.length > 0) {
                        disposeGroup(child);
                    }
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                    group.remove(child);
                }
            }

            // =========================================================
            // 3D SPECIES & METAMORPHOSIS MESH BUILDER (PER-SPECIES ARCHITECTURE)
            // =========================================================
            function buildPetMesh() {
                // Clear & Dispose old meshes safely
                disposeGroup(petGroup);
                disposeGroup(auraGroup);

                const scaleFactor = 0.75 + currentStage * 0.045;
                petGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

                const mainMat = new THREE.MeshToonMaterial({ color: primaryHex });
                const secMat = new THREE.MeshToonMaterial({ color: secondaryHex });
                const bellyMat = new THREE.MeshToonMaterial({ color: bellyHex });
                const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.8, roughness: 0.2 });
                const darkMat = new THREE.MeshToonMaterial({ color: 0x0f172a });
                const whiteMat = new THREE.MeshToonMaterial({ color: 0xffffff });
                const pinkMat = new THREE.MeshToonMaterial({ color: 0xf472b6 });
                const armorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
                const crystalMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.1, transparent: true, opacity: 0.85 });

                // Pedestal Shadow Disk & Neon Stage Ring
                const shadowGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.05, 32);
                const shadowMat = new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.4 });
                const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
                shadowMesh.position.y = -1.25;
                shadowMesh.name = "shadow";
                petGroup.add(shadowMesh);

                const ringGeo = new THREE.TorusGeometry(1.65, 0.035, 16, 48);
                const ringMat = new THREE.MeshStandardMaterial({ 
                    color: 0x38bdf8, 
                    emissive: 0x0284c7, 
                    emissiveIntensity: 0.8, 
                    roughness: 0.1 
                });
                const ringMesh = new THREE.Mesh(ringGeo, ringMat);
                ringMesh.position.y = -1.23;
                ringMesh.rotation.x = Math.PI * 0.5;
                ringMesh.name = "stageRing";
                petGroup.add(ringMesh);

                // Stage 1: Cracked Eggshell Base
                if (currentStage === 1) {
                    const eggGeo = new THREE.SphereGeometry(1.1, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
                    const eggMesh = new THREE.Mesh(eggGeo, whiteMat);
                    eggMesh.position.y = -0.6;
                    eggMesh.rotation.x = Math.PI;
                    petGroup.add(eggMesh);
                }

                // Call Dedicated Per-Species Builder
                if (currentSpecies === 'cat') {
                    buildCatMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat);
                } else if (currentSpecies === 'dog') {
                    buildDogMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat);
                } else if (currentSpecies === 'fox') {
                    buildFoxMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat);
                } else if (currentSpecies === 'bunny') {
                    buildBunnyMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat);
                } else if (currentSpecies === 'panda') {
                    buildPandaMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat);
                } else if (currentSpecies === 'koala') {
                    buildKoalaMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat);
                } else {
                    buildCatMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat);
                }

                // Universal Accessories Across Evolution Stages
                buildUniversalAccessories(mainMat, secMat, bellyMat, goldMat, darkMat, whiteMat, armorMat, crystalMat);

                build3DParticles();
            }

            // ---------------------------------------------------------
            // 🐱 1. CAT MESH BUILDER (Milo - Lean, Whiskers, Curved Tail)
            // ---------------------------------------------------------
            function buildCatMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat) {
                // Slim Torso
                const bodyGeo = new THREE.SphereGeometry(0.95, 24, 24);
                bodyGeo.scale(0.85, 1.15, 0.85);
                const bodyMesh = new THREE.Mesh(bodyGeo, mainMat);
                bodyMesh.position.y = 0.1;
                petGroup.add(bodyMesh);

                const bellyGeo = new THREE.SphereGeometry(0.65, 20, 20);
                bellyGeo.scale(0.8, 0.95, 0.4);
                const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
                bellyMesh.position.set(0, 0.05, 0.68);
                petGroup.add(bellyMesh);

                // Angular Head
                const headGeo = new THREE.SphereGeometry(0.8, 24, 24);
                headGeo.scale(0.95, 0.92, 0.95);
                const headMesh = new THREE.Mesh(headGeo, mainMat);
                headMesh.position.set(0, 1.1, 0.1);
                headMesh.name = "head";
                petGroup.add(headMesh);

                // Almond Eyes & Pupils with Glossy Catchlights
                const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
                eyeGeo.scale(1.1, 0.9, 0.8);
                const leftEye = new THREE.Mesh(eyeGeo, darkMat);
                leftEye.position.set(-0.28, 1.18, 0.78);
                leftEye.rotation.z = -0.15;

                const rightEye = new THREE.Mesh(eyeGeo, darkMat);
                rightEye.position.set(0.28, 1.18, 0.78);
                rightEye.rotation.z = 0.15;

                const pupilGeo = new THREE.SphereGeometry(0.045, 12, 12);
                const leftPupil = new THREE.Mesh(pupilGeo, whiteMat);
                leftPupil.position.set(-0.26, 1.22, 0.87);
                const rightPupil = new THREE.Mesh(pupilGeo, whiteMat);
                rightPupil.position.set(0.30, 1.22, 0.87);

                const catchGeo = new THREE.SphereGeometry(0.018, 8, 8);
                const leftCatch = new THREE.Mesh(catchGeo, whiteMat); leftCatch.position.set(-0.24, 1.24, 0.91);
                const rightCatch = new THREE.Mesh(catchGeo, whiteMat); rightCatch.position.set(0.32, 1.24, 0.91);

                petGroup.add(leftEye); petGroup.add(rightEye);
                petGroup.add(leftPupil); petGroup.add(rightPupil);
                petGroup.add(leftCatch); petGroup.add(rightCatch);

                // Red Collar with Golden Bell
                const collarGeo = new THREE.TorusGeometry(0.62, 0.04, 12, 24);
                const collarMat = new THREE.MeshToonMaterial({ color: 0xef4444 });
                const collarMesh = new THREE.Mesh(collarGeo, collarMat);
                collarMesh.position.set(0, 0.62, 0.18);
                collarMesh.rotation.x = Math.PI * 0.45;
                petGroup.add(collarMesh);

                const bellGeo = new THREE.SphereGeometry(0.07, 12, 12);
                const bellMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.1 });
                const bellMesh = new THREE.Mesh(bellGeo, bellMat);
                bellMesh.position.set(0, 0.52, 0.76);
                petGroup.add(bellMesh);

                // Rounded Cat Snout & Pink Nose
                const snoutGeo = new THREE.SphereGeometry(0.14, 16, 16);
                snoutGeo.scale(1.2, 0.8, 0.9);
                const snoutMesh = new THREE.Mesh(snoutGeo, bellyMat);
                snoutMesh.position.set(0, 1.04, 0.78);
                petGroup.add(snoutMesh);

                const noseGeo = new THREE.SphereGeometry(0.05, 12, 12);
                const noseMesh = new THREE.Mesh(noseGeo, pinkMat);
                noseMesh.position.set(0, 1.08, 0.9);
                petGroup.add(noseMesh);

                // 6 Thin Whisker Lines
                for (let w = -1; w <= 1; w++) {
                    const whiskerGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.4, 8);
                    const leftW = new THREE.Mesh(whiskerGeo, darkMat);
                    leftW.position.set(-0.35, 1.04 + w * 0.05, 0.8);
                    leftW.rotation.z = Math.PI * 0.5 + w * 0.15;

                    const rightW = new THREE.Mesh(whiskerGeo, darkMat);
                    rightW.position.set(0.35, 1.04 + w * 0.05, 0.8);
                    rightW.rotation.z = -Math.PI * 0.5 - w * 0.15;

                    petGroup.add(leftW); petGroup.add(rightW);
                }

                // Pointed Ears & Pink Inner Ear Inserts
                const earGeo = new THREE.ConeGeometry(0.26, 0.6, 12);
                const leftEar = new THREE.Mesh(earGeo, secMat);
                leftEar.position.set(-0.42, 1.82, 0.08);
                leftEar.rotation.z = -0.25;

                const rightEar = new THREE.Mesh(earGeo, secMat);
                rightEar.position.set(0.42, 1.82, 0.08);
                rightEar.rotation.z = 0.25;

                const innerEarGeo = new THREE.ConeGeometry(0.16, 0.45, 12);
                const leftInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
                leftInnerEar.position.set(-0.41, 1.81, 0.12); leftInnerEar.rotation.z = -0.25;
                const rightInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
                rightInnerEar.position.set(0.41, 1.81, 0.12); rightInnerEar.rotation.z = 0.25;

                petGroup.add(leftEar); petGroup.add(rightEar);
                petGroup.add(leftInnerEar); petGroup.add(rightInnerEar);

                // Long Curved 3-Segment Tail
                const tailGroup = new THREE.Group();
                tailGroup.position.set(0, -0.2, -0.85);
                tailGroup.name = "tail";

                const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.5, 12), secMat);
                t1.position.set(0, 0.2, 0);
                t1.rotation.x = -0.6;
                const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 12), secMat);
                t2.position.set(0, 0.5, -0.15);
                t2.rotation.x = -0.3;

                tailGroup.add(t1); tailGroup.add(t2);
                petGroup.add(tailGroup);

                // Arms & Legs with Pink Paw Pads
                const armGeo = new THREE.CylinderGeometry(0.14, 0.1, 0.65, 12);
                const leftArm = new THREE.Mesh(armGeo, mainMat);
                leftArm.position.set(-0.85, 0.25, 0.1); leftArm.rotation.z = 0.35; leftArm.name = "leftArm";
                const rightArm = new THREE.Mesh(armGeo, mainMat);
                rightArm.position.set(0.85, 0.25, 0.1); rightArm.rotation.z = -0.35; rightArm.name = "rightArm";
                petGroup.add(leftArm); petGroup.add(rightArm);

                const legGeo = new THREE.SphereGeometry(0.28, 16, 16);
                legGeo.scale(0.75, 1.15, 1.35);
                const leftLeg = new THREE.Mesh(legGeo, mainMat); leftLeg.position.set(-0.5, -0.85, 0.18);
                const rightLeg = new THREE.Mesh(legGeo, mainMat); rightLeg.position.set(0.5, -0.85, 0.18);
                petGroup.add(leftLeg); petGroup.add(rightLeg);

                const padGeo = new THREE.SphereGeometry(0.04, 8, 8);
                for (let p = -1; p <= 1; p++) {
                    const lPad = new THREE.Mesh(padGeo, pinkMat); lPad.position.set(-0.85 + p * 0.05, -0.05, 0.22);
                    const rPad = new THREE.Mesh(padGeo, pinkMat); rPad.position.set(0.85 + p * 0.05, -0.05, 0.22);
                    petGroup.add(lPad); petGroup.add(rPad);
                }

                // Stage 6+ Dual Fiery Horns
                if (currentStage >= 6) {
                    const hornGeo = new THREE.ConeGeometry(0.12, 0.5, 12);
                    const hornMat = new THREE.MeshToonMaterial({ color: 0xef4444 });
                    const leftHorn = new THREE.Mesh(hornGeo, hornMat); leftHorn.position.set(-0.35, 1.85, 0.1); leftHorn.rotation.z = -0.4;
                    const rightHorn = new THREE.Mesh(hornGeo, hornMat); rightHorn.position.set(0.35, 1.85, 0.1); rightHorn.rotation.z = 0.4;
                    petGroup.add(leftHorn); petGroup.add(rightHorn);
                }
            }

            // ---------------------------------------------------------
            // 🐶 2. DOG MESH BUILDER (Buddy - Stocky, Wagging Tail, Snout, Floppy Ears)
            // ---------------------------------------------------------
            function buildDogMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat) {
                // Stocky Broad Torso
                const bodyGeo = new THREE.SphereGeometry(1.05, 24, 24);
                bodyGeo.scale(1.1, 1.05, 1.0);
                const bodyMesh = new THREE.Mesh(bodyGeo, mainMat);
                bodyMesh.position.y = 0.1;
                petGroup.add(bodyMesh);

                const bellyGeo = new THREE.SphereGeometry(0.7, 20, 20);
                bellyGeo.scale(0.9, 0.95, 0.45);
                const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
                bellyMesh.position.set(0, 0.05, 0.78);
                petGroup.add(bellyMesh);

                // Round Friendly Head
                const headGeo = new THREE.SphereGeometry(0.85, 24, 24);
                const headMesh = new THREE.Mesh(headGeo, mainMat);
                headMesh.position.set(0, 1.1, 0.1);
                headMesh.name = "head";
                petGroup.add(headMesh);

                // Protruding Dog Snout / Muzzle
                const snoutGeo = new THREE.BoxGeometry(0.38, 0.28, 0.38);
                const snoutMesh = new THREE.Mesh(snoutGeo, bellyMat);
                snoutMesh.position.set(0, 1.02, 0.82);
                petGroup.add(snoutMesh);

                const noseGeo = new THREE.SphereGeometry(0.08, 12, 12);
                const noseMesh = new THREE.Mesh(noseGeo, darkMat);
                noseMesh.position.set(0, 1.12, 1.0);
                petGroup.add(noseMesh);

                // Poking Pink Tongue
                const tongueGeo = new THREE.SphereGeometry(0.06, 12, 12);
                tongueGeo.scale(1.0, 1.4, 0.5);
                const tongueMesh = new THREE.Mesh(tongueGeo, pinkMat);
                tongueMesh.position.set(0.06, 0.94, 0.98);
                tongueMesh.rotation.x = 0.3;
                petGroup.add(tongueMesh);

                // Friendly Round Eyes & Catchlights
                const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
                const leftEye = new THREE.Mesh(eyeGeo, darkMat); leftEye.position.set(-0.3, 1.2, 0.8);
                const rightEye = new THREE.Mesh(eyeGeo, darkMat); rightEye.position.set(0.3, 1.2, 0.8);

                const pupilGeo = new THREE.SphereGeometry(0.045, 12, 12);
                const leftPupil = new THREE.Mesh(pupilGeo, whiteMat); leftPupil.position.set(-0.28, 1.23, 0.9);
                const rightPupil = new THREE.Mesh(pupilGeo, whiteMat); rightPupil.position.set(0.32, 1.23, 0.9);

                const catchGeo = new THREE.SphereGeometry(0.018, 8, 8);
                const leftCatch = new THREE.Mesh(catchGeo, whiteMat); leftCatch.position.set(-0.26, 1.25, 0.93);
                const rightCatch = new THREE.Mesh(catchGeo, whiteMat); rightCatch.position.set(0.34, 1.25, 0.93);

                // Expressive Eyebrow Spots
                const browGeo = new THREE.SphereGeometry(0.05, 12, 12);
                browGeo.scale(1.2, 0.5, 0.5);
                const leftBrow = new THREE.Mesh(browGeo, bellyMat); leftBrow.position.set(-0.28, 1.38, 0.82);
                const rightBrow = new THREE.Mesh(browGeo, bellyMat); rightBrow.position.set(0.28, 1.38, 0.82);

                petGroup.add(leftEye); petGroup.add(rightEye);
                petGroup.add(leftPupil); petGroup.add(rightPupil);
                petGroup.add(leftCatch); petGroup.add(rightCatch);
                petGroup.add(leftBrow); petGroup.add(rightBrow);

                // Blue Dog Collar with Gold Bone Pendant
                const collarGeo = new THREE.TorusGeometry(0.72, 0.05, 12, 24);
                const collarMat = new THREE.MeshToonMaterial({ color: 0x3b82f6 });
                const collarMesh = new THREE.Mesh(collarGeo, collarMat);
                collarMesh.position.set(0, 0.64, 0.16);
                collarMesh.rotation.x = Math.PI * 0.45;
                petGroup.add(collarMesh);

                const boneGeo = new THREE.BoxGeometry(0.14, 0.06, 0.04);
                const boneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
                const boneMesh = new THREE.Mesh(boneGeo, boneMat);
                boneMesh.position.set(0, 0.5, 0.85);
                petGroup.add(boneMesh);

                // Floppy Drooping Ears & Inner Ear Folds
                const earGeo = new THREE.CylinderGeometry(0.18, 0.26, 0.75, 12);
                const leftEar = new THREE.Mesh(earGeo, secMat);
                leftEar.position.set(-0.82, 1.2, 0.1); leftEar.rotation.z = 0.5; leftEar.rotation.x = 0.2;

                const rightEar = new THREE.Mesh(earGeo, secMat);
                rightEar.position.set(0.82, 1.2, 0.1); rightEar.rotation.z = -0.5; rightEar.rotation.x = 0.2;

                const innerEarGeo = new THREE.CylinderGeometry(0.12, 0.2, 0.65, 12);
                const leftInnerEar = new THREE.Mesh(innerEarGeo, bellyMat);
                leftInnerEar.position.set(-0.8, 1.2, 0.16); leftInnerEar.rotation.z = 0.5; leftInnerEar.rotation.x = 0.2;
                const rightInnerEar = new THREE.Mesh(innerEarGeo, bellyMat);
                rightInnerEar.position.set(0.8, 1.2, 0.16); rightInnerEar.rotation.z = -0.5; rightInnerEar.rotation.x = 0.2;

                petGroup.add(leftEar); petGroup.add(rightEar);
                petGroup.add(leftInnerEar); petGroup.add(rightInnerEar);

                // Medium Upward Curved Dog Tail (Wagging Animation Target)
                const tailGeo = new THREE.CylinderGeometry(0.1, 0.2, 0.9, 12);
                const tailMesh = new THREE.Mesh(tailGeo, secMat);
                tailMesh.position.set(0, -0.15, -0.9);
                tailMesh.rotation.x = -1.1;
                tailMesh.name = "tail";
                petGroup.add(tailMesh);

                // Arms & Legs
                const armGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.7, 12);
                const leftArm = new THREE.Mesh(armGeo, mainMat); leftArm.position.set(-0.92, 0.25, 0.1); leftArm.rotation.z = 0.4; leftArm.name = "leftArm";
                const rightArm = new THREE.Mesh(armGeo, mainMat); rightArm.position.set(0.92, 0.25, 0.1); rightArm.rotation.z = -0.4; rightArm.name = "rightArm";
                petGroup.add(leftArm); petGroup.add(rightArm);

                const legGeo = new THREE.SphereGeometry(0.32, 16, 16);
                legGeo.scale(0.85, 1.2, 1.4);
                const leftLeg = new THREE.Mesh(legGeo, mainMat); leftLeg.position.set(-0.58, -0.85, 0.2);
                const rightLeg = new THREE.Mesh(legGeo, mainMat); rightLeg.position.set(0.58, -0.85, 0.2);
                petGroup.add(leftLeg); petGroup.add(rightLeg);

                // Stage 6+ Dual Hydro Cannons
                if (currentStage >= 6) {
                    const cannonGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.9, 12);
                    const leftCannon = new THREE.Mesh(cannonGeo, armorMat); leftCannon.position.set(-0.7, 0.7, -0.3); leftCannon.rotation.x = -0.4;
                    const rightCannon = new THREE.Mesh(cannonGeo, armorMat); rightCannon.position.set(0.7, 0.7, -0.3); rightCannon.rotation.x = -0.4;
                    petGroup.add(leftCannon); petGroup.add(rightCannon);
                }
            }

            // ---------------------------------------------------------
            // 🦊 3. FOX MESH BUILDER (Rusty - Sharp Snout, Bushy Tail w/ White Tip, Socks)
            // ---------------------------------------------------------
            function buildFoxMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat) {
                // Leggy Slender Torso
                const bodyGeo = new THREE.SphereGeometry(0.95, 24, 24);
                bodyGeo.scale(0.85, 1.12, 0.85);
                const bodyMesh = new THREE.Mesh(bodyGeo, mainMat);
                bodyMesh.position.y = 0.1;
                petGroup.add(bodyMesh);

                const bellyGeo = new THREE.SphereGeometry(0.65, 20, 20);
                bellyGeo.scale(0.8, 0.95, 0.4);
                const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
                bellyMesh.position.set(0, 0.05, 0.68);
                petGroup.add(bellyMesh);

                // Sharp Angled Head
                const headGeo = new THREE.SphereGeometry(0.82, 24, 24);
                headGeo.scale(0.92, 0.9, 0.92);
                const headMesh = new THREE.Mesh(headGeo, mainMat);
                headMesh.position.set(0, 1.1, 0.1);
                headMesh.name = "head";
                petGroup.add(headMesh);

                // Elongated Pointed Fox Snout
                const snoutGeo = new THREE.ConeGeometry(0.22, 0.55, 16);
                const snoutMesh = new THREE.Mesh(snoutGeo, bellyMat);
                snoutMesh.position.set(0, 1.02, 0.85);
                snoutMesh.rotation.x = Math.PI * 0.5;
                petGroup.add(snoutMesh);

                const noseGeo = new THREE.SphereGeometry(0.06, 12, 12);
                const noseMesh = new THREE.Mesh(noseGeo, darkMat);
                noseMesh.position.set(0, 1.02, 1.12);
                petGroup.add(noseMesh);

                // Alert Angled Eyes & Glossy Catchlights
                const eyeGeo = new THREE.SphereGeometry(0.11, 16, 16);
                eyeGeo.scale(1.2, 0.8, 0.7);
                const leftEye = new THREE.Mesh(eyeGeo, darkMat); leftEye.position.set(-0.28, 1.18, 0.76); leftEye.rotation.z = -0.25;
                const rightEye = new THREE.Mesh(eyeGeo, darkMat); rightEye.position.set(0.28, 1.18, 0.76); rightEye.rotation.z = 0.25;

                const pupilGeo = new THREE.SphereGeometry(0.04, 12, 12);
                const leftPupil = new THREE.Mesh(pupilGeo, whiteMat); leftPupil.position.set(-0.26, 1.22, 0.84);
                const rightPupil = new THREE.Mesh(pupilGeo, whiteMat); rightPupil.position.set(0.30, 1.22, 0.84);

                const catchGeo = new THREE.SphereGeometry(0.016, 8, 8);
                const leftCatch = new THREE.Mesh(catchGeo, whiteMat); leftCatch.position.set(-0.24, 1.24, 0.87);
                const rightCatch = new THREE.Mesh(catchGeo, whiteMat); rightCatch.position.set(0.32, 1.24, 0.87);

                // Kitsune Celestial Forehead Diamond Mark
                const diamondGeo = new THREE.ConeGeometry(0.06, 0.16, 4);
                const diamondMesh = new THREE.Mesh(diamondGeo, whiteMat);
                diamondMesh.position.set(0, 1.38, 0.82);
                diamondMesh.rotation.z = Math.PI * 0.25;
                petGroup.add(diamondMesh);

                petGroup.add(leftEye); petGroup.add(rightEye);
                petGroup.add(leftPupil); petGroup.add(rightPupil);
                petGroup.add(leftCatch); petGroup.add(rightCatch);

                // Large Sharp Upright Ears & White Inner Ear Fluff
                const earGeo = new THREE.ConeGeometry(0.32, 0.7, 12);
                const leftEar = new THREE.Mesh(earGeo, secMat); leftEar.position.set(-0.45, 1.85, 0.08); leftEar.rotation.z = -0.2; leftEar.name = "leftEar";
                const rightEar = new THREE.Mesh(earGeo, secMat); rightEar.position.set(0.45, 1.85, 0.08); rightEar.rotation.z = 0.2; rightEar.name = "rightEar";

                const innerFluffGeo = new THREE.ConeGeometry(0.2, 0.5, 12);
                const leftFluff = new THREE.Mesh(innerFluffGeo, whiteMat); leftFluff.position.set(-0.44, 1.84, 0.12); leftFluff.rotation.z = -0.2;
                const rightFluff = new THREE.Mesh(innerFluffGeo, whiteMat); rightFluff.position.set(0.44, 1.84, 0.12); rightFluff.rotation.z = 0.2;

                petGroup.add(leftEar); petGroup.add(rightEar);
                petGroup.add(leftFluff); petGroup.add(rightFluff);

                // Large Bushy Brush Tail with Distinct White Tip
                const tailGroup = new THREE.Group();
                tailGroup.position.set(0, -0.15, -0.9);
                tailGroup.name = "tail";

                const mainTailGeo = new THREE.CylinderGeometry(0.08, 0.32, 1.1, 14);
                const mainTail = new THREE.Mesh(mainTailGeo, secMat);
                mainTail.position.set(0, 0.4, 0);
                mainTail.rotation.x = -0.8;

                const tipTailGeo = new THREE.ConeGeometry(0.18, 0.45, 14);
                const tipTail = new THREE.Mesh(tipTailGeo, whiteMat);
                tipTail.position.set(0, 0.95, -0.32);
                tipTail.rotation.x = -0.8;

                tailGroup.add(mainTail); tailGroup.add(tipTail);
                petGroup.add(tailGroup);

                // Arms & Legs with Dark Paw Socks
                const armGeo = new THREE.CylinderGeometry(0.14, 0.1, 0.65, 12);
                const leftArm = new THREE.Mesh(armGeo, mainMat); leftArm.position.set(-0.85, 0.25, 0.1); leftArm.rotation.z = 0.35; leftArm.name = "leftArm";
                const rightArm = new THREE.Mesh(armGeo, mainMat); rightArm.position.set(0.85, 0.25, 0.1); rightArm.rotation.z = -0.35; rightArm.name = "rightArm";
                petGroup.add(leftArm); petGroup.add(rightArm);

                const legGeo = new THREE.SphereGeometry(0.28, 16, 16);
                legGeo.scale(0.75, 1.25, 1.35);
                const leftLeg = new THREE.Mesh(legGeo, darkMat); leftLeg.position.set(-0.5, -0.88, 0.18);
                const rightLeg = new THREE.Mesh(legGeo, darkMat); rightLeg.position.set(0.5, -0.88, 0.18);
                petGroup.add(leftLeg); petGroup.add(rightLeg);

                // Stage 6+ 6 Kitsune Tails
                if (currentStage >= 6) {
                    for (let t = -3; t <= 3; t++) {
                        if (t === 0) continue;
                        const kTailGeo = new THREE.CylinderGeometry(0.06, 0.18, 1.3, 12);
                        const kTailMesh = new THREE.Mesh(kTailGeo, secMat);
                        kTailMesh.position.set(t * 0.22, -0.1, -0.85);
                        kTailMesh.rotation.x = -0.9; kTailMesh.rotation.z = t * 0.25;
                        petGroup.add(kTailMesh);
                    }
                }
            }

            // ---------------------------------------------------------
            // 🐰 4. BUNNY MESH BUILDER (Luna - Large Haunches, Buck Teeth, Cotton Tail, Hop Idle)
            // ---------------------------------------------------------
            function buildBunnyMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat) {
                // Soft Rounded Body
                const bodyGeo = new THREE.SphereGeometry(1.0, 24, 24);
                bodyGeo.scale(0.9, 1.1, 0.9);
                const bodyMesh = new THREE.Mesh(bodyGeo, mainMat);
                bodyMesh.position.y = 0.1;
                petGroup.add(bodyMesh);

                const bellyGeo = new THREE.SphereGeometry(0.68, 20, 20);
                bellyGeo.scale(0.85, 0.95, 0.4);
                const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
                bellyMesh.position.set(0, 0.05, 0.72);
                petGroup.add(bellyMesh);

                // Head
                const headGeo = new THREE.SphereGeometry(0.82, 24, 24);
                const headMesh = new THREE.Mesh(headGeo, mainMat);
                headMesh.position.set(0, 1.1, 0.1);
                headMesh.name = "head";
                petGroup.add(headMesh);

                // Short Snout & Front Buck Teeth
                const snoutGeo = new THREE.SphereGeometry(0.15, 16, 16);
                snoutGeo.scale(1.1, 0.8, 0.8);
                const snoutMesh = new THREE.Mesh(snoutGeo, bellyMat);
                snoutMesh.position.set(0, 1.02, 0.78);
                petGroup.add(snoutMesh);

                const noseGeo = new THREE.SphereGeometry(0.05, 12, 12);
                const noseMesh = new THREE.Mesh(noseGeo, pinkMat);
                noseMesh.position.set(0, 1.08, 0.88);
                petGroup.add(noseMesh);

                // Two Small White Buck Teeth
                const toothGeo = new THREE.BoxGeometry(0.04, 0.08, 0.02);
                const leftTooth = new THREE.Mesh(toothGeo, whiteMat); leftTooth.position.set(-0.025, 0.96, 0.88);
                const rightTooth = new THREE.Mesh(toothGeo, whiteMat); rightTooth.position.set(0.025, 0.96, 0.88);
                petGroup.add(leftTooth); petGroup.add(rightTooth);

                // Round Bunny Eyes & Glossy Catchlights
                const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
                const leftEye = new THREE.Mesh(eyeGeo, darkMat); leftEye.position.set(-0.28, 1.18, 0.8);
                const rightEye = new THREE.Mesh(eyeGeo, darkMat); rightEye.position.set(0.28, 1.18, 0.8);

                const pupilGeo = new THREE.SphereGeometry(0.045, 12, 12);
                const leftPupil = new THREE.Mesh(pupilGeo, whiteMat); leftPupil.position.set(-0.26, 1.22, 0.9);
                const rightPupil = new THREE.Mesh(pupilGeo, whiteMat); rightPupil.position.set(0.30, 1.22, 0.9);

                const catchGeo = new THREE.SphereGeometry(0.018, 8, 8);
                const leftCatch = new THREE.Mesh(catchGeo, whiteMat); leftCatch.position.set(-0.24, 1.24, 0.93);
                const rightCatch = new THREE.Mesh(catchGeo, whiteMat); rightCatch.position.set(0.32, 1.24, 0.93);

                petGroup.add(leftEye); petGroup.add(rightEye);
                petGroup.add(leftPupil); petGroup.add(rightPupil);
                petGroup.add(leftCatch); petGroup.add(rightCatch);

                // Tall Ears & Pink Inner Ear Inserts
                const earGeo = new THREE.CylinderGeometry(0.09, 0.18, 1.6, 14);
                const leftEar = new THREE.Mesh(earGeo, secMat); leftEar.position.set(-0.35, 2.25, 0.0); leftEar.rotation.z = -0.15;
                const rightEar = new THREE.Mesh(earGeo, secMat); rightEar.position.set(0.35, 2.25, 0.0); rightEar.rotation.z = 0.15;

                const innerEarGeo = new THREE.CylinderGeometry(0.05, 0.12, 1.3, 12);
                const leftInner = new THREE.Mesh(innerEarGeo, pinkMat); leftInner.position.set(-0.34, 2.24, 0.05); leftInner.rotation.z = -0.15;
                const rightInner = new THREE.Mesh(innerEarGeo, pinkMat); rightInner.position.set(0.34, 2.24, 0.05); rightInner.rotation.z = 0.15;

                petGroup.add(leftEar); petGroup.add(rightEar);
                petGroup.add(leftInner); petGroup.add(rightInner);

                // Multi-Sphere Fluffy Cotton Ball Tail
                const tailGroup = new THREE.Group();
                tailGroup.position.set(0, -0.3, -0.85);
                tailGroup.name = "tail";

                const mainTail = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), whiteMat);
                const subTail1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), whiteMat); subTail1.position.set(-0.08, 0.08, 0);
                const subTail2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), whiteMat); subTail2.position.set(0.08, 0.08, 0);

                tailGroup.add(mainTail); tailGroup.add(subTail1); tailGroup.add(subTail2);
                petGroup.add(tailGroup);

                // Small Front Paws & LARGE HIND HAUNCHES (Asymmetric Proportions)
                const frontArmGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.45, 12);
                const leftArm = new THREE.Mesh(frontArmGeo, mainMat); leftArm.position.set(-0.65, 0.1, 0.4); leftArm.rotation.x = 0.5; leftArm.name = "leftArm";
                const rightArm = new THREE.Mesh(frontArmGeo, mainMat); rightArm.position.set(0.65, 0.1, 0.4); rightArm.rotation.x = 0.5; rightArm.name = "rightArm";
                petGroup.add(leftArm); petGroup.add(rightArm);

                const hindLegGeo = new THREE.SphereGeometry(0.42, 20, 20);
                hindLegGeo.scale(0.85, 1.35, 1.6);
                const leftLeg = new THREE.Mesh(hindLegGeo, mainMat); leftLeg.position.set(-0.65, -0.75, 0.1);
                const rightLeg = new THREE.Mesh(hindLegGeo, mainMat); rightLeg.position.set(0.65, -0.75, 0.1);
                petGroup.add(leftLeg); petGroup.add(rightLeg);

                // Stage 6+ Glowing Carrot Charm Accessory (Fixes Stage 6+ Parity Gap)
                if (currentStage >= 6) {
                    const carrotGeo = new THREE.ConeGeometry(0.14, 0.6, 12);
                    const carrotMat = new THREE.MeshToonMaterial({ color: 0xf97316 });
                    const carrotMesh = new THREE.Mesh(carrotGeo, carrotMat);
                    carrotMesh.position.set(0.85, 0.2, 0.3);
                    carrotMesh.rotation.z = -0.5;
                    petGroup.add(carrotMesh);

                    const leafGeo = new THREE.ConeGeometry(0.08, 0.25, 8);
                    const leafMat = new THREE.MeshToonMaterial({ color: 0x22c55e });
                    const leafMesh = new THREE.Mesh(leafGeo, leafMat);
                    leafMesh.position.set(0.98, 0.45, 0.3);
                    petGroup.add(leafMesh);
                }
            }

            // ---------------------------------------------------------
            // 🐼 5. PANDA MESH BUILDER (Bao - Chunky, Black Eye Patches, Two-Tone Limbs)
            // ---------------------------------------------------------
            function buildPandaMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat) {
                // Chunky Round Torso (White Body)
                const bodyGeo = new THREE.SphereGeometry(1.15, 24, 24);
                bodyGeo.scale(1.1, 1.1, 1.05);
                const bodyMesh = new THREE.Mesh(bodyGeo, whiteMat);
                bodyMesh.position.y = 0.1;
                petGroup.add(bodyMesh);

                const bellyGeo = new THREE.SphereGeometry(0.75, 20, 20);
                bellyGeo.scale(0.9, 0.95, 0.4);
                const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
                bellyMesh.position.set(0, 0.05, 0.82);
                petGroup.add(bellyMesh);

                // Round White Head
                const headGeo = new THREE.SphereGeometry(0.88, 24, 24);
                const headMesh = new THREE.Mesh(headGeo, whiteMat);
                headMesh.position.set(0, 1.1, 0.1);
                headMesh.name = "head";
                petGroup.add(headMesh);

                // DISTINCTIVE BLACK EYE PATCHES
                const patchGeo = new THREE.SphereGeometry(0.2, 16, 16);
                patchGeo.scale(1.2, 0.95, 0.3);
                const leftPatch = new THREE.Mesh(patchGeo, darkMat);
                leftPatch.position.set(-0.28, 1.18, 0.82);
                leftPatch.rotation.z = -0.25;

                const rightPatch = new THREE.Mesh(patchGeo, darkMat);
                rightPatch.position.set(0.28, 1.18, 0.82);
                rightPatch.rotation.z = 0.25;

                petGroup.add(leftPatch); petGroup.add(rightPatch);

                // Eyes inside Patches with Glossy Catchlights
                const eyeGeo = new THREE.SphereGeometry(0.07, 12, 12);
                const leftEye = new THREE.Mesh(eyeGeo, whiteMat); leftEye.position.set(-0.28, 1.18, 0.88);
                const rightEye = new THREE.Mesh(eyeGeo, whiteMat); rightEye.position.set(0.28, 1.18, 0.88);

                const pupilGeo = new THREE.SphereGeometry(0.04, 12, 12);
                const leftPupil = new THREE.Mesh(pupilGeo, darkMat); leftPupil.position.set(-0.27, 1.19, 0.94);
                const rightPupil = new THREE.Mesh(pupilGeo, darkMat); rightPupil.position.set(0.29, 1.19, 0.94);

                const catchGeo = new THREE.SphereGeometry(0.016, 8, 8);
                const leftCatch = new THREE.Mesh(catchGeo, whiteMat); leftCatch.position.set(-0.25, 1.21, 0.96);
                const rightCatch = new THREE.Mesh(catchGeo, whiteMat); rightCatch.position.set(0.31, 1.21, 0.96);

                petGroup.add(leftEye); petGroup.add(rightEye);
                petGroup.add(leftPupil); petGroup.add(rightPupil);
                petGroup.add(leftCatch); petGroup.add(rightCatch);

                // Stubby Flat Snout & Bamboo Leaf Mouth Accessory
                const snoutGeo = new THREE.SphereGeometry(0.16, 16, 16);
                snoutGeo.scale(1.3, 0.7, 0.6);
                const snoutMesh = new THREE.Mesh(snoutGeo, whiteMat);
                snoutMesh.position.set(0, 1.02, 0.85);
                petGroup.add(snoutMesh);

                const noseGeo = new THREE.SphereGeometry(0.07, 12, 12);
                const noseMesh = new THREE.Mesh(noseGeo, darkMat);
                noseMesh.position.set(0, 1.06, 0.94);
                petGroup.add(noseMesh);

                // Cute Bamboo Leaf in Mouth
                const bLeafGeo = new THREE.ConeGeometry(0.05, 0.28, 4);
                const bLeafMat = new THREE.MeshToonMaterial({ color: 0x10b981 });
                const bLeafMesh = new THREE.Mesh(bLeafGeo, bLeafMat);
                bLeafMesh.position.set(0.12, 0.96, 0.92);
                bLeafMesh.rotation.z = -1.2;
                bLeafMesh.rotation.x = 0.3;
                petGroup.add(bLeafMesh);

                // Round Dark Ears
                const earGeo = new THREE.SphereGeometry(0.26, 16, 16);
                const leftEar = new THREE.Mesh(earGeo, darkMat); leftEar.position.set(-0.62, 1.72, 0.0);
                const rightEar = new THREE.Mesh(earGeo, darkMat); rightEar.position.set(0.62, 1.72, 0.0);
                petGroup.add(leftEar); petGroup.add(rightEar);

                // TWO-TONE BLACK LIMBS (Arms & Legs)
                const armGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.75, 12);
                const leftArm = new THREE.Mesh(armGeo, darkMat); leftArm.position.set(-0.95, 0.25, 0.1); leftArm.rotation.z = 0.4; leftArm.name = "leftArm";
                const rightArm = new THREE.Mesh(armGeo, darkMat); rightArm.position.set(0.95, 0.25, 0.1); rightArm.rotation.z = -0.4; rightArm.name = "rightArm";
                petGroup.add(leftArm); petGroup.add(rightArm);

                const legGeo = new THREE.SphereGeometry(0.35, 16, 16);
                legGeo.scale(0.85, 1.2, 1.4);
                const leftLeg = new THREE.Mesh(legGeo, darkMat); leftLeg.position.set(-0.6, -0.85, 0.2);
                const rightLeg = new THREE.Mesh(legGeo, darkMat); rightLeg.position.set(0.6, -0.85, 0.2);
                petGroup.add(leftLeg); petGroup.add(rightLeg);

                // White Paw Claw Tips
                const clawGeo = new THREE.ConeGeometry(0.03, 0.1, 6);
                for (let c = -1; c <= 1; c++) {
                    const lc = new THREE.Mesh(clawGeo, whiteMat); lc.position.set(-0.95 + c * 0.04, -0.1, 0.25); lc.rotation.x = Math.PI * 0.4;
                    const rc = new THREE.Mesh(clawGeo, whiteMat); rc.position.set(0.95 + c * 0.04, -0.1, 0.25); rc.rotation.x = Math.PI * 0.4;
                    petGroup.add(lc); petGroup.add(rc);
                }

                // Stage 6+ Bamboo Staff
                if (currentStage >= 6) {
                    const bStaffGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 12);
                    const bStaffMat = new THREE.MeshToonMaterial({ color: 0x22c55e });
                    const bStaff = new THREE.Mesh(bStaffGeo, bStaffMat);
                    bStaff.position.set(0.95, 0.2, 0.3);
                    petGroup.add(bStaff);
                }
            }

            // ---------------------------------------------------------
            // 🐨 6. KOALA MESH BUILDER (Koko - Low Build, Oversized Nose, Fluffy Ear Tufts)
            // ---------------------------------------------------------
            function buildKoalaMesh(mainMat, secMat, bellyMat, darkMat, whiteMat, pinkMat, armorMat) {
                // Stocky Low-Slung Torso
                const bodyGeo = new THREE.SphereGeometry(1.05, 24, 24);
                bodyGeo.scale(1.05, 0.95, 1.05);
                const bodyMesh = new THREE.Mesh(bodyGeo, mainMat);
                bodyMesh.position.y = 0.05;
                petGroup.add(bodyMesh);

                const bellyGeo = new THREE.SphereGeometry(0.7, 20, 20);
                bellyGeo.scale(0.88, 0.9, 0.4);
                const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
                bellyMesh.position.set(0, 0.0, 0.78);
                petGroup.add(bellyMesh);

                // Broad Round Head
                const headGeo = new THREE.SphereGeometry(0.88, 24, 24);
                headGeo.scale(1.05, 0.92, 1.0);
                const headMesh = new THREE.Mesh(headGeo, mainMat);
                headMesh.position.set(0, 1.05, 0.1);
                headMesh.name = "head";
                petGroup.add(headMesh);

                // OVERSIZED ROUND BLACK NOSE (Koala Signature)
                const noseGeo = new THREE.SphereGeometry(0.2, 16, 16);
                noseGeo.scale(0.9, 1.4, 0.8);
                const noseMesh = new THREE.Mesh(noseGeo, darkMat);
                noseMesh.position.set(0, 1.02, 0.92);
                petGroup.add(noseMesh);

                // Friendly Eyes & Glossy Catchlights
                const eyeGeo = new THREE.SphereGeometry(0.1, 16, 16);
                const leftEye = new THREE.Mesh(eyeGeo, darkMat); leftEye.position.set(-0.32, 1.18, 0.8);
                const rightEye = new THREE.Mesh(eyeGeo, darkMat); rightEye.position.set(0.32, 1.18, 0.8);

                const pupilGeo = new THREE.SphereGeometry(0.035, 12, 12);
                const leftPupil = new THREE.Mesh(pupilGeo, whiteMat); leftPupil.position.set(-0.3, 1.2, 0.88);
                const rightPupil = new THREE.Mesh(pupilGeo, whiteMat); rightPupil.position.set(0.34, 1.2, 0.88);

                const catchGeo = new THREE.SphereGeometry(0.016, 8, 8);
                const leftCatch = new THREE.Mesh(catchGeo, whiteMat); leftCatch.position.set(-0.28, 1.22, 0.91);
                const rightCatch = new THREE.Mesh(catchGeo, whiteMat); rightCatch.position.set(0.36, 1.22, 0.91);

                // Tucked Eucalyptus Leaf Accent Behind Ear
                const eucLeafGeo = new THREE.ConeGeometry(0.06, 0.32, 4);
                const eucLeafMat = new THREE.MeshToonMaterial({ color: 0x06b6d4 });
                const eucLeafMesh = new THREE.Mesh(eucLeafGeo, eucLeafMat);
                eucLeafMesh.position.set(-0.68, 1.62, 0.2);
                eucLeafMesh.rotation.z = 0.8;
                eucLeafMesh.rotation.x = -0.3;
                petGroup.add(eucLeafMesh);

                petGroup.add(leftEye); petGroup.add(rightEye);
                petGroup.add(leftPupil); petGroup.add(rightPupil);
                petGroup.add(leftCatch); petGroup.add(rightCatch);

                // LARGE FLUFFY EAR TUFTS
                const earGeo = new THREE.SphereGeometry(0.42, 16, 16);
                earGeo.scale(1.1, 1.0, 0.35);
                const leftEar = new THREE.Mesh(earGeo, secMat); leftEar.position.set(-0.85, 1.5, 0.05); leftEar.rotation.z = -0.2;
                const rightEar = new THREE.Mesh(earGeo, secMat); rightEar.position.set(0.85, 1.5, 0.05); rightEar.rotation.z = 0.2;

                const tuftGeo = new THREE.SphereGeometry(0.26, 12, 12);
                tuftGeo.scale(1.0, 1.0, 0.3);
                const leftTuft = new THREE.Mesh(tuftGeo, whiteMat); leftTuft.position.set(-0.85, 1.5, 0.12);
                const rightTuft = new THREE.Mesh(tuftGeo, whiteMat); rightTuft.position.set(0.85, 1.5, 0.12);

                petGroup.add(leftEar); petGroup.add(rightEar);
                petGroup.add(leftTuft); petGroup.add(rightTuft);

                // Short Compact Limbs
                const armGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.55, 12);
                const leftArm = new THREE.Mesh(armGeo, mainMat); leftArm.position.set(-0.85, 0.15, 0.1); leftArm.rotation.z = 0.45; leftArm.name = "leftArm";
                const rightArm = new THREE.Mesh(armGeo, mainMat); rightArm.position.set(0.85, 0.15, 0.1); rightArm.rotation.z = -0.45; rightArm.name = "rightArm";
                petGroup.add(leftArm); petGroup.add(rightArm);

                const legGeo = new THREE.SphereGeometry(0.3, 16, 16);
                legGeo.scale(0.8, 1.1, 1.3);
                const leftLeg = new THREE.Mesh(legGeo, mainMat); leftLeg.position.set(-0.55, -0.8, 0.18);
                const rightLeg = new THREE.Mesh(legGeo, mainMat); rightLeg.position.set(0.55, -0.8, 0.18);
                petGroup.add(leftLeg); petGroup.add(rightLeg);

                // Stage 6+ Eucalyptus Branch Accessory (Fixes Stage 6+ Parity Gap)
                if (currentStage >= 6) {
                    const eBranchGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.4, 10);
                    const eBranchMat = new THREE.MeshToonMaterial({ color: 0x15803d });
                    const eBranch = new THREE.Mesh(eBranchGeo, eBranchMat);
                    eBranch.position.set(0.85, 0.3, 0.3); eBranch.rotation.z = -0.4;
                    petGroup.add(eBranch);
                }
            }

            // ---------------------------------------------------------
            // UNIVERSAL STAGE ACCESSORIES (Stage 2 - 10)
            // ---------------------------------------------------------
            function buildUniversalAccessories(mainMat, secMat, bellyMat, goldMat, darkMat, whiteMat, armorMat, crystalMat) {
                // Stage 2+: Scarf / Collar
                if (currentStage >= 2) {
                    const scarfGeo = new THREE.TorusGeometry(0.62, 0.09, 12, 24);
                    const scarfMat = new THREE.MeshToonMaterial({ color: 0xef4444 });
                    const scarfMesh = new THREE.Mesh(scarfGeo, scarfMat);
                    scarfMesh.position.set(0, 0.65, 0.1);
                    scarfMesh.rotation.x = Math.PI * 0.5;
                    petGroup.add(scarfMesh);
                }

                // Stage 3+: Cyber Visor
                if (currentStage >= 3) {
                    const visorGeo = new THREE.BoxGeometry(0.7, 0.18, 0.25);
                    const visorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1 });
                    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
                    visorMesh.position.set(0, 1.25, 0.72);
                    petGroup.add(visorMesh);
                }

                // Stage 4+: Heavy Armor Chest Plate
                if (currentStage >= 4) {
                    const armorGeo = new THREE.BoxGeometry(0.9, 0.8, 0.3);
                    const armorMesh = new THREE.Mesh(armorGeo, armorMat);
                    armorMesh.position.set(0, 0.1, 0.72);
                    petGroup.add(armorMesh);
                }

                // Stage 5+: 5-Pointed Metallic Golden Crown
                if (currentStage >= 5) {
                    const crownGeo = new THREE.CylinderGeometry(0.45, 0.35, 0.35, 5);
                    const crownMesh = new THREE.Mesh(crownGeo, goldMat);
                    crownMesh.position.set(0, 1.95, 0.1);
                    petGroup.add(crownMesh);
                }

                // Stage 7+: 3D Dragon Wings
                if (currentStage >= 7) {
                    const wingGeo = new THREE.BoxGeometry(1.6, 0.7, 0.05);
                    const leftWing = new THREE.Mesh(wingGeo, armorMat);
                    leftWing.position.set(-1.4, 0.6, -0.5); leftWing.rotation.y = 0.5; leftWing.rotation.z = 0.3;

                    const rightWing = new THREE.Mesh(wingGeo, armorMat);
                    rightWing.position.set(1.4, 0.6, -0.5); rightWing.rotation.y = -0.5; rightWing.rotation.z = -0.3;

                    petGroup.add(leftWing); petGroup.add(rightWing);
                }

                // Stage 8+: Arcane Staff with Crystal Orb
                if (currentStage >= 8) {
                    const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 12);
                    const staffMesh = new THREE.Mesh(staffGeo, armorMat);
                    staffMesh.position.set(1.2, 0.4, 0.4);

                    const orbGeo = new THREE.SphereGeometry(0.22, 16, 16);
                    const orbMesh = new THREE.Mesh(orbGeo, crystalMat);
                    orbMesh.position.set(1.2, 1.6, 0.4);

                    petGroup.add(staffMesh); petGroup.add(orbMesh);
                }

                // Stage 9+: Divine Floating Halo Ring
                if (currentStage >= 9) {
                    const haloGeo = new THREE.TorusGeometry(0.65, 0.05, 12, 32);
                    const haloMesh = new THREE.Mesh(haloGeo, goldMat);
                    haloMesh.position.set(0, 2.3, 0.1);
                    haloMesh.rotation.x = Math.PI * 0.5;
                    petGroup.add(haloMesh);
                }

                // Stage 10: Mega Form Power Aura Shield
                if (currentStage >= 10) {
                    const auraGeo = new THREE.SphereGeometry(2.2, 24, 24);
                    const auraMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.18, wireframe: true });
                    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
                    auraMesh.position.set(0, 0.5, 0);
                    auraGroup.add(auraMesh);
                }
            }

            // =========================================================
            // 3D PARTICLE EMITTER
            // =========================================================
            function build3DParticles() {
                while (particleGroup.children.length > 0) {
                    particleGroup.remove(particleGroup.children[0]);
                }

                const particleCount = 24;
                const pGeo = new THREE.SphereGeometry(0.05, 8, 8);
                let pColor = 0xfacc15;
                if (currentSpecies === 'cat') pColor = 0xfacc15;      // Golden Sparkles
                if (currentSpecies === 'dog') pColor = 0x38bdf8;      // Hydro Aqua Drops
                if (currentSpecies === 'fox') pColor = 0xf97316;      // Spirit Flame Embers
                if (currentSpecies === 'bunny') pColor = 0xc084fc;    // Plasma Stars
                if (currentSpecies === 'panda') pColor = 0x10b981;    // Jade Bamboo Petals
                if (currentSpecies === 'koala') pColor = 0x06b6d4;    // Eucalyptus Cyan Sparks

                const pMat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.85 });

                for (let i = 0; i < particleCount; i++) {
                    const pMesh = new THREE.Mesh(pGeo, pMat);
                    pMesh.position.set(
                        (Math.random() - 0.5) * 3.6,
                        (Math.random() - 0.5) * 3.6,
                        (Math.random() - 0.5) * 3.6
                    );
                    pMesh.userData = {
                        speedY: 0.008 + Math.random() * 0.018,
                        rotSpeed: Math.random() * 0.06
                    };
                    particleGroup.add(pMesh);
                }
            }

            // =========================================================
            // REAL-TIME 60FPS ANIMATION LOOP WITH 3D HOP & MOMENTUM
            // =========================================================
            let clock = new THREE.Clock();
            let velocityY = 0;
            let velocityX = 0;
            let isHopping = false;
            let hopProgress = 0;

            function trigger3DHop() {
                if (isHopping) return;
                isHopping = true;
                hopProgress = 0;
            }

            // Click / Tap listener for 3D Hop trigger
            window.addEventListener('click', (e) => {
                trigger3DHop();
            });

            function animate() {
                requestAnimationFrame(animate);

                const time = clock.getElapsedTime();

                // Momentum Dampening (Glides smoothly when user lets go)
                if (!isDragging) {
                    targetRotationY += velocityY;
                    targetRotationX += velocityX;
                    velocityY *= 0.92;
                    velocityX *= 0.92;
                }

                // Smooth touch rotation interpolation
                petGroup.rotation.y += (targetRotationY - petGroup.rotation.y) * 0.12;
                petGroup.rotation.x += (targetRotationX - petGroup.rotation.x) * 0.12;

                // 3D Breathing & Per-Species Idle Animation
                let bounceY = Math.sin(time * 2.2) * 0.08;

                // Bunny Hop Idle Accent
                if (currentSpecies === 'bunny' && !isHopping) {
                    bounceY += Math.abs(Math.sin(time * 3.5)) * 0.08;
                }

                if (isHopping) {
                    hopProgress += 0.06;
                    const hopHeight = Math.sin(hopProgress * Math.PI) * 0.8;
                    bounceY += hopHeight;
                    petGroup.rotation.y += 0.2; // 360 Spin on tap

                    if (hopProgress >= 1.0) {
                        isHopping = false;
                        hopProgress = 0;
                    }
                }

                petGroup.position.y = bounceY;

                // Panda Side-to-Side Rock/Sway
                if (currentSpecies === 'panda' && !isDragging) {
                    petGroup.rotation.z = Math.sin(time * 1.2) * 0.04;
                } else if (!isDragging) {
                    petGroup.rotation.z = 0;
                }

                // Dynamic Ground Shadow Scaling & Stage Ring Rotation
                const shadow = petGroup.getObjectByName("shadow");
                if (shadow) {
                    const shadowScale = Math.max(0.4, 1.0 - (bounceY * 0.4));
                    shadow.scale.set(shadowScale, 1.0, shadowScale);
                }

                const stageRing = petGroup.getObjectByName("stageRing");
                if (stageRing) {
                    stageRing.rotation.z += 0.012;
                }

                const head = petGroup.getObjectByName("head");
                if (head) {
                    if (isDragging) {
                        head.rotation.y = (targetRotationY - petGroup.rotation.y) * 0.35;
                        head.rotation.x = (targetRotationX - petGroup.rotation.x) * 0.35;
                    } else if (currentSpecies === 'koala') {
                        head.rotation.x = Math.sin(time * 1.5) * 0.12;
                        head.rotation.z = Math.sin(time * 1.0) * 0.04;
                        head.rotation.y = 0;
                    } else {
                        head.rotation.z = Math.sin(time * 1.5) * 0.06;
                        head.rotation.x = 0;
                        head.rotation.y = 0;
                    }
                }

                const leftArm = petGroup.getObjectByName("leftArm");
                const rightArm = petGroup.getObjectByName("rightArm");
                if (leftArm && rightArm) {
                    leftArm.rotation.x = Math.sin(time * 2.0) * 0.2;
                    rightArm.rotation.x = -Math.sin(time * 2.0) * 0.2;
                }

                // Fox Ear Swivel Animation
                const leftEar = petGroup.getObjectByName("leftEar");
                const rightEar = petGroup.getObjectByName("rightEar");
                if (currentSpecies === 'fox' && leftEar && rightEar) {
                    leftEar.rotation.x = Math.sin(time * 4.0) * 0.15;
                    rightEar.rotation.x = -Math.sin(time * 4.0) * 0.15;
                }

                // Tail Animations (Dog Wag vs Cat/Fox Tail Flick)
                const tail = petGroup.getObjectByName("tail");
                if (tail) {
                    if (currentSpecies === 'dog') {
                        // Fast Happy Tail Wag
                        const isHappy = currentEmotion === 'happy' || currentEmotion === 'excited';
                        const wagSpeed = isHappy ? 14.0 : 6.0;
                        const wagAmp = isHappy ? 0.45 : 0.25;
                        tail.rotation.z = Math.sin(time * wagSpeed) * wagAmp;
                    } else {
                        // Gentle Tail Oscillation
                        tail.rotation.y = Math.sin(time * 3.0) * 0.3;
                    }
                }

                // Stage 10 Aura rotation
                if (auraGroup.children.length > 0) {
                    auraGroup.children[0].rotation.y += 0.01;
                    auraGroup.children[0].rotation.x += 0.005;
                }

                // 3D Particle movement
                particleGroup.children.forEach(p => {
                    p.position.y += p.userData.speedY;
                    p.rotation.y += p.userData.rotSpeed;
                    if (p.position.y > 2.0) {
                        p.position.y = -1.5;
                    }
                });

                renderer.render(scene, camera);
            }

            // Dynamic State Update Bridge
            window.updatePet3D = function(data) {
                currentSpecies = data.speciesId;
                currentStage = data.stageLevel;
                primaryHex = data.primaryColor;
                secondaryHex = data.secondaryColor;
                bellyHex = data.bellyColor;
                currentEmotion = data.emotion;
                blinking = data.isBlinking;

                buildPetMesh();
            };

            window.onload = init3D;
        </script>
    </body>
    </html>
    `;

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: htmlContent }}
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
                mixedContentMode="always"
                scrollEnabled={false}
                overScrollMode="never"
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                backgroundColor="transparent"
                androidLayerType={"hardware" as any}
                onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.warn('Pet3DCanvas WebView error:', nativeEvent);
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 240,
        height: 190,
        alignItems: 'center',
        justifyContent: 'center',
    },
    webview: {
        width: 240,
        height: 190,
        backgroundColor: 'transparent',
    },
});
