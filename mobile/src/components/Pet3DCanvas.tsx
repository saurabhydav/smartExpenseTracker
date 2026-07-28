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
            // 3D SPECIES & METAMORPHOSIS MESH BUILDER
            // =========================================================
            function buildPetMesh() {
                // Clear old meshes
                while (petGroup.children.length > 0) {
                    petGroup.remove(petGroup.children[0]);
                }
                while (auraGroup.children.length > 0) {
                    auraGroup.remove(auraGroup.children[0]);
                }

                const scaleFactor = 0.75 + currentStage * 0.045;
                petGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

                const mainMat = new THREE.MeshToonMaterial({
                    color: primaryHex,
                    gradientMap: null
                });
                const secMat = new THREE.MeshToonMaterial({ color: secondaryHex });
                const bellyMat = new THREE.MeshToonMaterial({ color: bellyHex });
                const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.8, roughness: 0.2 });
                const darkMat = new THREE.MeshToonMaterial({ color: 0x0f172a });
                const whiteMat = new THREE.MeshToonMaterial({ color: 0xffffff });
                const pinkMat = new THREE.MeshToonMaterial({ color: 0xf472b6 });
                const armorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
                const crystalMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.1, transparent: true, opacity: 0.85 });

                // Pedestal Shadow Disk
                const shadowGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.05, 32);
                const shadowMat = new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.4 });
                const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
                shadowMesh.position.y = -1.25;
                shadowMesh.name = "shadow";
                petGroup.add(shadowMesh);

                // Stage 1: Cracked Eggshell Base
                if (currentStage === 1) {
                    const eggGeo = new THREE.SphereGeometry(1.1, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
                    const eggMesh = new THREE.Mesh(eggGeo, whiteMat);
                    eggMesh.position.y = -0.6;
                    eggMesh.rotation.x = Math.PI;
                    petGroup.add(eggMesh);
                }

                // 3D Body (Sphere / Capsule)
                const bodyGeo = new THREE.SphereGeometry(1.0, 24, 24);
                bodyGeo.scale(1, 1.15, 0.95);
                const bodyMesh = new THREE.Mesh(bodyGeo, mainMat);
                bodyMesh.position.y = 0.1;
                petGroup.add(bodyMesh);

                // Belly Patch
                const bellyGeo = new THREE.SphereGeometry(0.7, 20, 20);
                bellyGeo.scale(0.85, 1.0, 0.4);
                const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
                bellyMesh.position.set(0, 0.05, 0.75);
                petGroup.add(bellyMesh);

                // 3D Head
                const headGeo = new THREE.SphereGeometry(0.82, 24, 24);
                const headMesh = new THREE.Mesh(headGeo, mainMat);
                headMesh.position.set(0, 1.1, 0.1);
                headMesh.name = "head";
                petGroup.add(headMesh);

                // 3D Eyes
                const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
                const leftEye = new THREE.Mesh(eyeGeo, darkMat);
                leftEye.position.set(-0.28, 1.18, 0.8);
                const rightEye = new THREE.Mesh(eyeGeo, darkMat);
                rightEye.position.set(0.28, 1.18, 0.8);

                const pupilGeo = new THREE.SphereGeometry(0.04, 12, 12);
                const leftPupil = new THREE.Mesh(pupilGeo, whiteMat);
                leftPupil.position.set(-0.26, 1.22, 0.9);
                const rightPupil = new THREE.Mesh(pupilGeo, whiteMat);
                rightPupil.position.set(0.30, 1.22, 0.9);

                petGroup.add(leftEye);
                petGroup.add(rightEye);
                petGroup.add(leftPupil);
                petGroup.add(rightPupil);

                // 3D Nose/Muzzle
                const noseGeo = new THREE.SphereGeometry(0.06, 12, 12);
                const noseMesh = new THREE.Mesh(noseGeo, darkMat);
                noseMesh.position.set(0, 1.05, 0.9);
                petGroup.add(noseMesh);

                // 3D Arms (Left & Right)
                const armGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.7, 12);
                const leftArm = new THREE.Mesh(armGeo, mainMat);
                leftArm.position.set(-0.9, 0.25, 0.1);
                leftArm.rotation.z = 0.4;
                leftArm.name = "leftArm";

                const rightArm = new THREE.Mesh(armGeo, mainMat);
                rightArm.position.set(0.9, 0.25, 0.1);
                rightArm.rotation.z = -0.4;
                rightArm.name = "rightArm";

                petGroup.add(leftArm);
                petGroup.add(rightArm);

                // 3D Legs
                const legGeo = new THREE.SphereGeometry(0.3, 16, 16);
                legGeo.scale(0.8, 1.2, 1.4);
                const leftLeg = new THREE.Mesh(legGeo, mainMat);
                leftLeg.position.set(-0.55, -0.85, 0.2);

                const rightLeg = new THREE.Mesh(legGeo, mainMat);
                rightLeg.position.set(0.55, -0.85, 0.2);

                petGroup.add(leftLeg);
                petGroup.add(rightLeg);

                // =========================================
                // SPECIES-SPECIFIC 3D ANATOMICAL FEATURES
                // =========================================
                if (currentSpecies === 'cat' || currentSpecies === 'fox') {
                    // Pointed Ears
                    const earGeo = new THREE.ConeGeometry(0.28, 0.6, 12);
                    const leftEar = new THREE.Mesh(earGeo, secMat);
                    leftEar.position.set(-0.45, 1.8, 0.1);
                    leftEar.rotation.z = -0.3;

                    const rightEar = new THREE.Mesh(earGeo, secMat);
                    rightEar.position.set(0.45, 1.8, 0.1);
                    rightEar.rotation.z = 0.3;

                    petGroup.add(leftEar);
                    petGroup.add(rightEar);

                    // 3D Tail
                    const tailGeo = new THREE.CylinderGeometry(0.08, 0.22, 1.2, 12);
                    const tailMesh = new THREE.Mesh(tailGeo, secMat);
                    tailMesh.position.set(0, -0.2, -0.9);
                    tailMesh.rotation.x = -0.8;
                    tailMesh.name = "tail";
                    petGroup.add(tailMesh);
                } else if (currentSpecies === 'dog' || currentSpecies === 'koala') {
                    // Fluffy Round Ears
                    const earGeo = new THREE.SphereGeometry(0.35, 16, 16);
                    earGeo.scale(1.2, 1.0, 0.4);
                    const leftEar = new THREE.Mesh(earGeo, secMat);
                    leftEar.position.set(-0.85, 1.45, 0.0);

                    const rightEar = new THREE.Mesh(earGeo, secMat);
                    rightEar.position.set(0.85, 1.45, 0.0);

                    petGroup.add(leftEar);
                    petGroup.add(rightEar);
                } else if (currentSpecies === 'bunny') {
                    // 3D Extra Tall Bunny Ears
                    const earGeo = new THREE.CylinderGeometry(0.1, 0.18, 1.5, 12);
                    const leftEar = new THREE.Mesh(earGeo, secMat);
                    leftEar.position.set(-0.35, 2.2, 0.0);
                    leftEar.rotation.z = -0.15;

                    const rightEar = new THREE.Mesh(earGeo, secMat);
                    rightEar.position.set(0.35, 2.2, 0.0);
                    rightEar.rotation.z = 0.15;

                    petGroup.add(leftEar);
                    petGroup.add(rightEar);
                } else if (currentSpecies === 'panda') {
                    // Round Panda Ears & Eye Patches
                    const earGeo = new THREE.SphereGeometry(0.25, 16, 16);
                    const leftEar = new THREE.Mesh(earGeo, darkMat);
                    leftEar.position.set(-0.6, 1.7, 0.0);

                    const rightEar = new THREE.Mesh(earGeo, darkMat);
                    rightEar.position.set(0.6, 1.7, 0.0);

                    petGroup.add(leftEar);
                    petGroup.add(rightEar);
                }

                // =========================================
                // 10-STAGE EVOLUTION MESH ACCESSORIES
                // =========================================
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

                // Stage 6+: Species-Specific 3D Weapons & Features
                if (currentStage >= 6) {
                    if (currentSpecies === 'dog') {
                        // Dual Shoulder Hydro Cannons (Blastoise)
                        const cannonGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.9, 12);
                        const leftCannon = new THREE.Mesh(cannonGeo, armorMat);
                        leftCannon.position.set(-0.7, 0.7, -0.3);
                        leftCannon.rotation.x = -0.4;

                        const rightCannon = new THREE.Mesh(cannonGeo, armorMat);
                        rightCannon.position.set(0.7, 0.7, -0.3);
                        rightCannon.rotation.x = -0.4;

                        petGroup.add(leftCannon);
                        petGroup.add(rightCannon);
                    } else if (currentSpecies === 'cat') {
                        // Dual Fiery Horns (Charizard)
                        const hornGeo = new THREE.ConeGeometry(0.12, 0.5, 12);
                        const hornMat = new THREE.MeshToonMaterial({ color: 0xef4444 });
                        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
                        leftHorn.position.set(-0.35, 1.85, 0.1);
                        leftHorn.rotation.z = -0.4;

                        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
                        rightHorn.position.set(0.35, 1.85, 0.1);
                        rightHorn.rotation.z = 0.4;

                        petGroup.add(leftHorn);
                        petGroup.add(rightHorn);
                    } else if (currentSpecies === 'fox') {
                        // 6 3D Kitsune Tails
                        for (let t = -3; t <= 3; t++) {
                            if (t === 0) continue;
                            const kTailGeo = new THREE.CylinderGeometry(0.06, 0.18, 1.3, 12);
                            const kTailMesh = new THREE.Mesh(kTailGeo, secMat);
                            kTailMesh.position.set(t * 0.22, -0.1, -0.85);
                            kTailMesh.rotation.x = -0.9;
                            kTailMesh.rotation.z = t * 0.25;
                            petGroup.add(kTailMesh);
                        }
                    } else if (currentSpecies === 'panda') {
                        // Bamboo Martial Staff
                        const bStaffGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 12);
                        const bStaffMat = new THREE.MeshToonMaterial({ color: 0x22c55e });
                        const bStaff = new THREE.Mesh(bStaffGeo, bStaffMat);
                        bStaff.position.set(0.95, 0.2, 0.3);
                        petGroup.add(bStaff);
                    }
                }

                // Stage 7+: 3D Dragon Wings
                if (currentStage >= 7) {
                    const wingGeo = new THREE.BoxGeometry(1.6, 0.7, 0.05);
                    const leftWing = new THREE.Mesh(wingGeo, armorMat);
                    leftWing.position.set(-1.4, 0.6, -0.5);
                    leftWing.rotation.y = 0.5;
                    leftWing.rotation.z = 0.3;

                    const rightWing = new THREE.Mesh(wingGeo, armorMat);
                    rightWing.position.set(1.4, 0.6, -0.5);
                    rightWing.rotation.y = -0.5;
                    rightWing.rotation.z = -0.3;

                    petGroup.add(leftWing);
                    petGroup.add(rightWing);
                }

                // Stage 8+: Arcane Staff with Crystal Orb
                if (currentStage >= 8) {
                    const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 12);
                    const staffMesh = new THREE.Mesh(staffGeo, armorMat);
                    staffMesh.position.set(1.2, 0.4, 0.4);

                    const orbGeo = new THREE.SphereGeometry(0.22, 16, 16);
                    const orbMesh = new THREE.Mesh(orbGeo, crystalMat);
                    orbMesh.position.set(1.2, 1.6, 0.4);

                    petGroup.add(staffMesh);
                    petGroup.add(orbMesh);
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

                build3DParticles();
            }

            // =========================================================
            // 3D PARTICLE EMITTER
            // =========================================================
            function build3DParticles() {
                while (particleGroup.children.length > 0) {
                    particleGroup.remove(particleGroup.children[0]);
                }

                const particleCount = 18;
                const pGeo = new THREE.SphereGeometry(0.06, 8, 8);
                let pColor = 0xf97316;
                if (currentSpecies === 'dog') pColor = 0x38bdf8;
                if (currentSpecies === 'bunny') pColor = 0xfacc15;
                if (currentSpecies === 'panda') pColor = 0x22c55e;
                if (currentSpecies === 'koala') pColor = 0xa855f7;

                const pMat = new THREE.MeshBasicMaterial({ color: pColor });

                for (let i = 0; i < particleCount; i++) {
                    const pMesh = new THREE.Mesh(pGeo, pMat);
                    pMesh.position.set(
                        (Math.random() - 0.5) * 3.2,
                        (Math.random() - 0.5) * 3.2,
                        (Math.random() - 0.5) * 3.2
                    );
                    pMesh.userData = {
                        speedY: 0.01 + Math.random() * 0.02,
                        rotSpeed: Math.random() * 0.05
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

                // 3D Breathing & Hop Animation
                let bounceY = Math.sin(time * 2.2) * 0.08;

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

                // Dynamic Ground Shadow Scaling
                const shadow = petGroup.getObjectByName("shadow");
                if (shadow) {
                    const shadowScale = Math.max(0.4, 1.0 - (bounceY * 0.4));
                    shadow.scale.set(shadowScale, 1.0, shadowScale);
                }

                const head = petGroup.getObjectByName("head");
                if (head) {
                    head.rotation.z = Math.sin(time * 1.5) * 0.06;
                }

                const leftArm = petGroup.getObjectByName("leftArm");
                const rightArm = petGroup.getObjectByName("rightArm");
                if (leftArm && rightArm) {
                    leftArm.rotation.x = Math.sin(time * 2.0) * 0.2;
                    rightArm.rotation.x = -Math.sin(time * 2.0) * 0.2;
                }

                const tail = petGroup.getObjectByName("tail");
                if (tail) {
                    tail.rotation.y = Math.sin(time * 3.0) * 0.3;
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
