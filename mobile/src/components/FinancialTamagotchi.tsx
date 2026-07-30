import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppStore } from '../store';
import { colors } from '../utils';
import { Pet3DCanvas } from './Pet3DCanvas';
import { PetModelViewer } from './PetModelViewer';
import { getModelPathForSpecies } from '../services/PetAssetResolver';

// ============================================
// ORIGINAL ELEMENTAL PET SPECIES DEFINITIONS
// ============================================
export interface PetSpeciesDef {
    id: 'cat' | 'dog' | 'bunny' | 'panda' | 'fox' | 'koala' | 'owl' | 'turtle' | 'hedgehog' | 'axolotl';
    name: string;
    elementalClass: string;
    emoji: string;
    speciality: string;
    specialAbilityName: string;
    specialAbilityEmoji: string;
    specialAbilityDesc: string;
    coinReward: number;
    expReward: number;
    primaryColor: string;
    secondaryColor: string;
    bellyColor: string;
    earType: string;
    evolutions: { level: number; title: string; badge: string; scale: number }[];
}

export const SPECIES_CAT: PetSpeciesDef = {
    id: 'cat',
    name: 'Milo the Cat',
    elementalClass: 'Inferno Pyrocat Sovereign',
    emoji: '🐱',
    speciality: 'Financial Stealth & Saver',
    specialAbilityName: 'Flamethrower Pounce',
    specialAbilityEmoji: '🔥',
    specialAbilityDesc: '+30 Coins • Fire Blast',
    coinReward: 30,
    expReward: 15,
    primaryColor: '#f97316',
    secondaryColor: '#fb923c',
    bellyColor: '#ffedd5',
    earType: 'cat',
    evolutions: [
        { level: 1, title: 'Ember Kitten', badge: '🐣 Stage 1 Baby Starter', scale: 0.70 },
        { level: 2, title: 'Flame Claws', badge: '🎀 Stage 2 Claws & Scarf', scale: 0.77 },
        { level: 3, title: 'Pyro Scholar', badge: '🎓 Stage 3 Cyber Goggles', scale: 0.84 },
        { level: 4, title: 'Shadow Ninja Cat', badge: '🥷 Stage 4 Ninja Armor', scale: 0.91 },
        { level: 5, title: 'Inferno Samurai', badge: '⚔️ Stage 5 Golden Katana Crown', scale: 0.98 },
        { level: 6, title: 'Blazing Panther', badge: '⚡ Stage 6 Dual Fire Horns', scale: 1.06 },
        { level: 7, title: 'Solar Sekhmet', badge: '🦅 Stage 7 Dragon Wings', scale: 1.14 },
        { level: 8, title: 'Flare Dragon Sphinx', badge: '🔮 Stage 8 Arcane Staff', scale: 1.21 },
        { level: 9, title: 'Phoenix Bastet God', badge: '😇 Stage 9 Bastet Divine Halo', scale: 1.28 },
        { level: 10, title: 'INFERNO PYROCAT SOVEREIGN', badge: '🌌 Stage 10 ELEMENTAL TITAN FORM', scale: 1.36 },
    ]
};

export const SPECIES_DOG: PetSpeciesDef = {
    id: 'dog',
    name: 'Buddy the Dog',
    elementalClass: 'Hydro Tidalhound Emperor',
    emoji: '🐶',
    speciality: 'Loyal Budget Guard',
    specialAbilityName: 'Hydro Cannon Bark',
    specialAbilityEmoji: '🌊',
    specialAbilityDesc: '+25 Coins • Hydro Shield',
    coinReward: 25,
    expReward: 20,
    primaryColor: '#0284c7',
    secondaryColor: '#38bdf8',
    bellyColor: '#e0f2fe',
    earType: 'dog',
    evolutions: [
        { level: 1, title: 'Bubble Pup', badge: '🐣 Stage 1 Baby Hydro Pup', scale: 0.70 },
        { level: 2, title: 'Tide Hound', badge: '🎀 Stage 2 Tide Scarf', scale: 0.77 },
        { level: 3, title: 'Torrent Sleuth', badge: '🎓 Stage 3 Visor Specs', scale: 0.84 },
        { level: 4, title: 'Hydro Paladin Dog', badge: '🛡️ Stage 4 Paladin Armor', scale: 0.91 },
        { level: 5, title: 'Shell Champion', badge: '👑 Stage 5 Golden Shell Crown', scale: 0.98 },
        { level: 6, title: 'Hydro Cannon Doberman', badge: '⚡ Stage 6 Hydro Shoulder Cannons', scale: 1.06 },
        { level: 7, title: 'Tidal Valkyrie', badge: '🦅 Stage 7 Tidal Wings', scale: 1.14 },
        { level: 8, title: 'Cerberus Warden', badge: '🔮 Stage 8 Trident Staff', scale: 1.21 },
        { level: 9, title: 'Poseidon Monarch', badge: '😇 Stage 9 Sea Halo', scale: 1.28 },
        { level: 10, title: 'HYDRO TIDALHOUND EMPEROR', badge: '🌌 Stage 10 OCEAN TITAN FORM', scale: 1.36 },
    ]
};

export const SPECIES_BUNNY: PetSpeciesDef = {
    id: 'bunny',
    name: 'Luna the Bunny',
    elementalClass: 'Volt Stormhare Titan',
    emoji: '🐰',
    speciality: 'EXP Burst & Agility',
    specialAbilityName: 'Volt Tackle Hop',
    specialAbilityEmoji: '⚡',
    specialAbilityDesc: '+40 EXP • Plasma Burst',
    coinReward: 10,
    expReward: 40,
    primaryColor: '#ec4899',
    secondaryColor: '#f472b6',
    bellyColor: '#fce7f3',
    earType: 'bunny',
    evolutions: [
        { level: 1, title: 'Spark Bunny', badge: '🐣 Stage 1 Baby Volt Bunny', scale: 0.70 },
        { level: 2, title: 'Volt Hopper', badge: '🎀 Stage 2 Paw Pads', scale: 0.77 },
        { level: 3, title: 'Speed Scholar', badge: '🎓 Stage 3 Speed Specs', scale: 0.84 },
        { level: 4, title: 'Wind Runner Bunny', badge: '🛡️ Stage 4 Wind Shield', scale: 0.91 },
        { level: 5, title: 'Lightning Champion', badge: '👑 Stage 5 Volt Crown', scale: 0.98 },
        { level: 6, title: 'Volt Hare', badge: '⚡ Stage 6 90px Lightning Ears', scale: 1.06 },
        { level: 7, title: 'Astro Lapin', badge: '🦅 Stage 7 Plasma Wings', scale: 1.14 },
        { level: 8, title: 'Quantum Volt Rabbit', badge: '🔮 Stage 8 Volt Staff', scale: 1.21 },
        { level: 9, title: 'Eclipse Thunder God', badge: '😇 Stage 9 High-Volt Halo', scale: 1.28 },
        { level: 10, title: 'VOLT STORMHARE TITAN', badge: '🌌 Stage 10 THUNDER TITAN FORM', scale: 1.36 },
    ]
};

export const SPECIES_PANDA: PetSpeciesDef = {
    id: 'panda',
    name: 'Bao the Panda',
    elementalClass: 'Jade Monarch Panda',
    emoji: '🐼',
    speciality: 'Zen Cash Balance',
    specialAbilityName: 'Dragon Zen Slam',
    specialAbilityEmoji: '🐉',
    specialAbilityDesc: '+50 Coins • Earth Harmony',
    coinReward: 50,
    expReward: 10,
    primaryColor: '#334155',
    secondaryColor: '#475569',
    bellyColor: '#f8fafc',
    earType: 'panda',
    evolutions: [
        { level: 1, title: 'Bamboo Cub', badge: '🐣 Stage 1 Baby Panda Cub', scale: 0.70 },
        { level: 2, title: 'Boulder Panda', badge: '🎀 Stage 2 Bamboo Staff', scale: 0.77 },
        { level: 3, title: 'Terra Monk', badge: '🎓 Stage 3 Monk Specs', scale: 0.84 },
        { level: 4, title: 'Iron Paw Dragon', badge: '🛡️ Stage 4 Gauntlet Shield', scale: 0.91 },
        { level: 5, title: 'Jade Tai Chi Master', badge: '👑 Stage 5 Jade Crown', scale: 0.98 },
        { level: 6, title: 'Yin-Yang Guardian', badge: '⚡ Stage 6 Jade Dragon Horns', scale: 1.06 },
        { level: 7, title: 'Earth Dragon Panda', badge: '🦅 Stage 7 Emerald Wings', scale: 1.14 },
        { level: 8, title: 'Lotus Sage Emperor', badge: '🔮 Stage 8 Lotus Staff', scale: 1.21 },
        { level: 9, title: 'Nirvana Emperor', badge: '😇 Stage 9 Nirvana Halo', scale: 1.28 },
        { level: 10, title: 'JADE MONARCH PANDA', badge: '🌌 Stage 10 EARTH TITAN FORM', scale: 1.36 },
    ]
};

export const SPECIES_FOX: PetSpeciesDef = {
    id: 'fox',
    name: 'Rusty the Fox',
    elementalClass: 'Kitsune Celestial Fox',
    emoji: '🦊',
    speciality: 'Smart Cashback Finder',
    specialAbilityName: 'Kitsune Fire Blast',
    specialAbilityEmoji: '🦊',
    specialAbilityDesc: '+35 Coins • Spirit Fire',
    coinReward: 35,
    expReward: 25,
    primaryColor: '#ef4444',
    secondaryColor: '#f87171',
    bellyColor: '#fef2f2',
    earType: 'fox',
    evolutions: [
        { level: 1, title: 'Fennec Kit', badge: '🐣 Stage 1 Baby Kit Fox', scale: 0.70 },
        { level: 2, title: 'Spirit Trickster', badge: '🎀 Stage 2 Kitsune Mark', scale: 0.77 },
        { level: 3, title: 'Sleuth Inspector', badge: '🎓 Stage 3 Inspector Specs', scale: 0.84 },
        { level: 4, title: 'Flame Tail Runner', badge: '🛡️ Stage 4 Chest Plate', scale: 0.91 },
        { level: 5, title: 'Kitsune Champion', badge: '👑 Stage 5 Ruby Crown', scale: 0.98 },
        { level: 6, title: 'Kitsune 6-Tail', badge: '⚡ Stage 6 6-Tails Morph', scale: 1.06 },
        { level: 7, title: 'Spirit 9-Tail Fox', badge: '🦅 Stage 7 9 MAGNIFICENT TAILS', scale: 1.14 },
        { level: 8, title: 'Nine-Tailed Sage', badge: '🔮 Stage 8 Kitsune Orb Staff', scale: 1.21 },
        { level: 9, title: 'Celestial Inari', badge: '😇 Stage 9 Inari Divine Halo', scale: 1.28 },
        { level: 10, title: 'KITSUNE CELESTIAL FOX', badge: '🌌 Stage 10 SPIRIT TITAN FORM', scale: 1.36 },
    ]
};

export const SPECIES_KOALA: PetSpeciesDef = {
    id: 'koala',
    name: 'Koko the Koala',
    elementalClass: 'Astral Mystic Koala',
    emoji: '🐨',
    speciality: 'Compound Interest Nap',
    specialAbilityName: 'Psystrike Sleep',
    specialAbilityEmoji: '💤',
    specialAbilityDesc: '+45 Coins • Psychic Yield',
    coinReward: 45,
    expReward: 15,
    primaryColor: '#8b5cf6',
    secondaryColor: '#a78bfa',
    bellyColor: '#f5f3ff',
    earType: 'koala',
    evolutions: [
        { level: 1, title: 'Joey Baby', badge: '🐣 Stage 1 Baby Joey', scale: 0.70 },
        { level: 2, title: 'Astral Climber', badge: '🎀 Stage 2 Leaf in Mouth', scale: 0.77 },
        { level: 3, title: 'Psychic Scholar', badge: '🎓 Stage 3 Psychic Specs', scale: 0.84 },
        { level: 4, title: 'Eucalyptus Knight', badge: '🛡️ Stage 4 Knight Armor', scale: 0.91 },
        { level: 5, title: 'Mind Master', badge: '👑 Stage 5 Mind Crown', scale: 0.98 },
        { level: 6, title: 'Nebula Sleeper', badge: '⚡ Stage 6 52px Fluffy Ears', scale: 1.06 },
        { level: 7, title: 'Chrono Koala', badge: '🦅 Stage 7 Astral Wings', scale: 1.14 },
        { level: 8, title: 'Time-Lord Sovereign', badge: '🔮 Stage 8 Psychic Orb Staff', scale: 1.21 },
        { level: 9, title: 'Eternal Dream God', badge: '😇 Stage 9 Astral Halo', scale: 1.28 },
        { level: 10, title: 'ASTRAL MYSTIC KOALA', badge: '🌌 Stage 10 COSMIC TITAN FORM', scale: 1.36 },
    ]
};

export const SPECIES_OWL: PetSpeciesDef = {
    id: 'owl',
    name: 'Hoot the Owl',
    elementalClass: 'Astral Nightwing Sage',
    emoji: '🦉',
    speciality: 'Night Analytics & Audit',
    specialAbilityName: 'Moonlight Insight',
    specialAbilityEmoji: '🌙',
    specialAbilityDesc: '+40 Coins • Night Gaze',
    coinReward: 40,
    expReward: 25,
    primaryColor: '#6366f1',
    secondaryColor: '#818cf8',
    bellyColor: '#e0e7ff',
    earType: 'owl',
    evolutions: [
        { level: 1, title: 'Fledgling Owlet', badge: '🐣 Stage 1 Owlet', scale: 0.70 },
        { level: 2, title: 'Feather Scholar', badge: '🎓 Stage 2 Scholar Specs', scale: 0.77 },
        { level: 3, title: 'Starlight Sentinel', badge: '⭐ Stage 3 Star Amulet', scale: 0.84 },
        { level: 4, title: 'Nightwing Ranger', badge: '🛡️ Stage 4 Ranger Cloak', scale: 0.91 },
        { level: 5, title: 'Astral Archmage', badge: '👑 Stage 5 Astral Crown', scale: 0.98 },
        { level: 6, title: 'Cosmic Oracle', badge: '⚡ Stage 6 Cosmic Wings', scale: 1.06 },
        { level: 7, title: 'Moonlight Archon', badge: '🦅 Stage 7 MOON WINGS MORPH', scale: 1.14 },
        { level: 8, title: 'Celestial Sage', badge: '🔮 Stage 8 Starlight Staff', scale: 1.21 },
        { level: 9, title: 'Nirvana Sovereign', badge: '😇 Stage 9 Divine Feather Halo', scale: 1.28 },
        { level: 10, title: 'ASTRAL SAGE OWL', badge: '🌌 Stage 10 NIGHT TITAN FORM', scale: 1.36 },
    ]
};

export const SPECIES_TURTLE: PetSpeciesDef = {
    id: 'turtle',
    name: 'Shelly the Turtle',
    elementalClass: 'Ancient Obsidian Fortress',
    emoji: '🐢',
    speciality: 'Patience & Long-term Wealth',
    specialAbilityName: 'Obsidian Shield',
    specialAbilityEmoji: '🛡️',
    specialAbilityDesc: '+45 Coins • Iron Defense',
    coinReward: 45,
    expReward: 30,
    primaryColor: '#10b981',
    secondaryColor: '#34d399',
    bellyColor: '#d1fae5',
    earType: 'turtle',
    evolutions: [
        { level: 1, title: 'Shell Hatchling', badge: '🐣 Stage 1 Hatchling', scale: 0.70 },
        { level: 2, title: 'Pebble Guardian', badge: '🎀 Stage 2 Pebble Shell', scale: 0.77 },
        { level: 3, title: 'Jade Defender', badge: '🎓 Stage 3 Jade Plate', scale: 0.84 },
        { level: 4, title: 'Obsidian Knight', badge: '🛡️ Stage 4 Obsidian Armor', scale: 0.91 },
        { level: 5, title: 'Fortress Sentinel', badge: '👑 Stage 5 Fortress Helm', scale: 0.98 },
        { level: 6, title: 'Titan Shell', badge: '⚡ Stage 6 Spiked Shell', scale: 1.06 },
        { level: 7, title: 'Dragon Turtle', badge: '🦅 Stage 7 DRAGON TURTLE MORPH', scale: 1.14 },
        { level: 8, title: 'Ancient Aegis', badge: '🔮 Stage 8 Aegis Shield', scale: 1.21 },
        { level: 9, title: 'Immortal Bastion', badge: '😇 Stage 9 Bastion Halo', scale: 1.28 },
        { level: 10, title: 'OBSIDIAN FORTRESS TURTLE', badge: '🌌 Stage 10 EARTH TITAN FORM', scale: 1.36 },
    ]
};

export const SPECIES_HEDGEHOG: PetSpeciesDef = {
    id: 'hedgehog',
    name: 'Quill the Hedgehog',
    elementalClass: 'Lightning Quill Sprinter',
    emoji: '🦔',
    speciality: 'Speed Savings & Fast Budgeting',
    specialAbilityName: 'Quill Rocket Roll',
    specialAbilityEmoji: '⚡',
    specialAbilityDesc: '+35 Coins • Speed Spin',
    coinReward: 35,
    expReward: 20,
    primaryColor: '#06b6d4',
    secondaryColor: '#22d3ee',
    bellyColor: '#cffaff',
    earType: 'hedgehog',
    evolutions: [
        { level: 1, title: 'Tiny Quill', badge: '🐣 Stage 1 Quill Pup', scale: 0.70 },
        { level: 2, title: 'Spike Runner', badge: '🎀 Stage 2 Speed Boots', scale: 0.77 },
        { level: 3, title: 'Turbo Dash', badge: '🎓 Stage 3 Visor Specs', scale: 0.84 },
        { level: 4, title: 'Thunder Quill', badge: '🛡️ Stage 4 Thunder Armor', scale: 0.91 },
        { level: 5, title: 'Volt Champion', badge: '👑 Stage 5 Lightning Crown', scale: 0.98 },
        { level: 6, title: 'Overdrive Sprinter', badge: '⚡ Stage 6 Aura Boost', scale: 1.06 },
        { level: 7, title: 'Hyper Volt', badge: '🦅 Stage 7 HYPER SPEED MORPH', scale: 1.14 },
        { level: 8, title: 'Plasma Sage', badge: '🔮 Stage 8 Plasma Rod', scale: 1.21 },
        { level: 9, title: 'Lightspeed Sovereign', badge: '😇 Stage 9 Lightning Halo', scale: 1.28 },
        { level: 10, title: 'LIGHTNING SPRINTER HEDGEHOG', badge: '🌌 Stage 10 SPEED TITAN FORM', scale: 1.36 },
    ]
};

export const SPECIES_AXOLOTL: PetSpeciesDef = {
    id: 'axolotl',
    name: 'Loti the Axolotl',
    elementalClass: 'Tidepool Regeneration Spirit',
    emoji: '🦎',
    speciality: 'Emergency Fund Regeneration',
    specialAbilityName: 'Hydro Healing Surge',
    specialAbilityEmoji: '💧',
    specialAbilityDesc: '+50 Coins • Aqua Heal',
    coinReward: 50,
    expReward: 30,
    primaryColor: '#ec4899',
    secondaryColor: '#f472b6',
    bellyColor: '#fce7f3',
    earType: 'axolotl',
    evolutions: [
        { level: 1, title: 'Pink Frill Fry', badge: '🐣 Stage 1 Frill Fry', scale: 0.70 },
        { level: 2, title: 'Aqua Paddle', badge: '🎀 Stage 2 Aqua Scarf', scale: 0.77 },
        { level: 3, title: 'Tide Scholar', badge: '🎓 Stage 3 Tide Goggles', scale: 0.84 },
        { level: 4, title: 'Coral Guardian', badge: '🛡️ Stage 4 Coral Armor', scale: 0.91 },
        { level: 5, title: 'Oceanic Monarch', badge: '👑 Stage 5 Pearl Crown', scale: 0.98 },
        { level: 6, title: 'Hydro Dragon', badge: '⚡ Stage 6 6-Frill Dragon Morph', scale: 1.06 },
        { level: 7, title: 'Leviathan Spirit', badge: '🦅 Stage 7 LEVIATHAN MORPH', scale: 1.14 },
        { level: 8, title: 'Regeneration Oracle', badge: '🔮 Stage 8 Trident Staff', scale: 1.21 },
        { level: 9, title: 'Tidepool Deity', badge: '😇 Stage 9 Water Halo', scale: 1.28 },
        { level: 10, title: 'TIDEPOOL REGEN AXOLOTL', badge: '🌌 Stage 10 WATER TITAN FORM', scale: 1.36 },
    ]
};

export const ALL_PET_SPECIES: PetSpeciesDef[] = [
    SPECIES_CAT,
    SPECIES_DOG,
    SPECIES_BUNNY,
    SPECIES_PANDA,
    SPECIES_FOX,
    SPECIES_KOALA,
    SPECIES_OWL,
    SPECIES_TURTLE,
    SPECIES_HEDGEHOG,
    SPECIES_AXOLOTL,
];

const DIALOG_QUOTES = [
    "Great job tracking your expenses today! 🌟",
    "You're staying well under budget this month! 💪",
    "Did you know? Saving 10% daily adds up fast! 💰",
    "Tap my Special Ability to activate my Elemental Power! ⚡",
    "I'm feeling super energized today! ✨",
    "Remember to log your recent coffee purchase! ☕",
    "Your financial health score is looking strong! 📈",
];



export default function FinancialTamagotchi() {
    const { tamagotchi, updateTamagotchi } = useAppStore();
    
    const currentPetId = tamagotchi?.petType || 'cat';
    
    const petsData = tamagotchi?.petsData || {};
    const activePetState = petsData[currentPetId] || {
        level: tamagotchi?.level || 1,
        exp: tamagotchi?.exp || 0,
        coins: tamagotchi?.coins || 100,
        feedCount: 0,
        playCount: 0,
        specialCount: 0,
    };

    const level = activePetState.level;
    const exp = activePetState.exp;
    const maxExp = level * 100;
    const coins = activePetState.coins;

    const speciesDef = ALL_PET_SPECIES.find(p => p.id === currentPetId) || SPECIES_CAT;
    const stageIdx = Math.min(9, Math.max(0, level - 1));
    const currentStage = speciesDef.evolutions[stageIdx] || speciesDef.evolutions[0];

    const [speech, setSpeech] = useState(`Hi! I'm ${speciesDef.name} (${currentStage.title})! 🚀`);
    const [floatingParticle, setFloatingParticle] = useState<{ id: number; text: string; color: string } | null>(null);
    const [emotion, setEmotion] = useState<'idle' | 'happy' | 'excited'>('idle');
    const [isBlinking, setIsBlinking] = useState(false);

    const bounceAnim = useRef(new Animated.Value(0)).current;
    const squishYAnim = useRef(new Animated.Value(1)).current;
    const squishXAnim = useRef(new Animated.Value(1)).current;

    const rotateSpinAnim = useRef(new Animated.Value(0)).current;
    
    const particleAnim = useRef(new Animated.Value(0)).current;
    const particleOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const blinkInterval = setInterval(() => {
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 220);
        }, 3500);
        return () => clearInterval(blinkInterval);
    }, []);

    useEffect(() => {
        // All animations here use useNativeDriver: true (GPU-accelerated)
        const loop = Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(bounceAnim, { toValue: -14, duration: 850, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                    Animated.timing(bounceAnim, { toValue: 0, duration: 850, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(squishYAnim, { toValue: 1.09, duration: 850, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                    Animated.timing(squishYAnim, { toValue: 0.92, duration: 850, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(squishXAnim, { toValue: 0.92, duration: 850, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                    Animated.timing(squishXAnim, { toValue: 1.08, duration: 850, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                ]),
            ])
        );
        loop.start();

        return () => {
            loop.stop();
        };
    }, []);

    useEffect(() => {
        setSpeech(`Hi! I'm ${speciesDef.name}! 🚀`);
        const interval = setInterval(() => {
            const randomQuote = DIALOG_QUOTES[Math.floor(Math.random() * DIALOG_QUOTES.length)];
            setSpeech(randomQuote);
        }, 12000);
        return () => clearInterval(interval);
    }, [currentPetId]);

    const triggerParticleEffect = (text: string, color: string, emotionType: 'happy' | 'excited') => {
        setFloatingParticle({ id: Date.now(), text, color });
        setEmotion(emotionType);
        setTimeout(() => setEmotion('idle'), 2500);

        particleAnim.setValue(0);
        particleOpacity.setValue(1);
        rotateSpinAnim.setValue(0);

        Animated.parallel([
            Animated.timing(particleAnim, {
                toValue: -50,
                duration: 1000,
                easing: Easing.out(Easing.back(1.8)),
                useNativeDriver: true,
            }),
            Animated.timing(particleOpacity, {
                toValue: 0,
                duration: 1000,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(rotateSpinAnim, {
                toValue: 1,
                duration: 600,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start(() => setFloatingParticle(null));
    };

    const updateActivePetState = (updates: Partial<typeof activePetState>) => {
        const updatedPet = { ...activePetState, ...updates };
        const updatedPetsData = { ...petsData, [currentPetId]: updatedPet };

        updateTamagotchi({
            petsData: updatedPetsData,
            level: updatedPet.level,
            exp: updatedPet.exp,
            coins: updatedPet.coins,
        });
    };

    const setDirectLevel = (targetLvl: number) => {
        const targetStageIdx = Math.min(9, Math.max(0, targetLvl - 1));
        const targetStage = speciesDef.evolutions[targetStageIdx];
        triggerParticleEffect(`✨ STAGE ${targetLvl}: ${targetStage.title.toUpperCase()}`, "#38bdf8", "excited");
        setSpeech(`EVOLVED TO STAGE ${targetLvl}: ${targetStage.title.toUpperCase()}! 🚀`);
        updateActivePetState({
            level: targetLvl,
            exp: 0,
        });
    };

    // Shared EXP gain logic with level cap at 10 and multi-level overflow handling
    const processExpGain = (expGain: number): { newLevel: number; newExp: number; evolved: boolean; evolvedTitle: string } => {
        let newExp = exp + expGain;
        let newLevel = level;
        let currentMaxExp = newLevel * 100;
        let evolved = false;

        // Handle multi-level jumps (while loop, not just if)
        while (newExp >= currentMaxExp && newLevel < 10) {
            newExp -= currentMaxExp;
            newLevel += 1;
            currentMaxExp = newLevel * 100;
            evolved = true;
        }

        // Hard cap at level 10
        if (newLevel >= 10) {
            newLevel = 10;
            const maxExpAtCap = newLevel * 100;
            if (newExp >= maxExpAtCap) {
                newExp = maxExpAtCap - 1;
            }
        }

        const stageIdx = Math.min(9, Math.max(0, newLevel - 1));
        const evolvedTitle = speciesDef.evolutions[stageIdx]?.title || 'MAX FORM';
        return { newLevel, newExp, evolved, evolvedTitle };
    };

    const handleFeed = () => {
        triggerParticleEffect("🍎 +20 EXP", "#22c55e", "happy");
        const { newLevel, newExp, evolved, evolvedTitle } = processExpGain(20);
        if (evolved) {
            setSpeech(`DIGIVOLVE! 🎉 EVOLVED TO ${evolvedTitle.toUpperCase()}!`);
        } else {
            setSpeech("Yum! Delicious treat! +20 EXP 🍎");
        }
        updateActivePetState({
            level: newLevel,
            exp: newExp,
            coins: coins + 5,
            feedCount: (activePetState.feedCount || 0) + 1,
        });
    };

    const handlePlay = () => {
        triggerParticleEffect("🎾 +10 EXP", "#3b82f6", "excited");
        const { newLevel, newExp, evolved, evolvedTitle } = processExpGain(10);
        if (evolved) {
            setSpeech(`DIGIVOLVE! 🎉 Battle Evolution to ${evolvedTitle.toUpperCase()}!`);
        } else {
            setSpeech("Woohoo! Battle Hop! +10 EXP 🎾");
        }
        updateActivePetState({
            level: newLevel,
            exp: newExp,
            coins: coins + 10,
            playCount: (activePetState.playCount || 0) + 1,
        });
    };

    const [specialCooldown, setSpecialCooldown] = useState(false);

    const handleSpecialAbility = () => {
        if (specialCooldown) {
            setSpeech("⏳ Ability recharging! Please wait a moment...");
            return;
        }

        setSpecialCooldown(true);
        setTimeout(() => setSpecialCooldown(false), 5000);

        triggerParticleEffect(`${speciesDef.specialAbilityEmoji} ${speciesDef.specialAbilityDesc}`, "#eab308", "excited");
        const { newLevel, newExp, evolved, evolvedTitle } = processExpGain(speciesDef.expReward);
        if (evolved) {
            setSpeech(`MEGA DIGIVOLVE! 🌟 ${speciesDef.specialAbilityName}! EVOLVED TO ${evolvedTitle.toUpperCase()}!`);
        } else {
            setSpeech(`${speciesDef.specialAbilityEmoji} ${speciesDef.specialAbilityName}! +${speciesDef.coinReward} Coins, +${speciesDef.expReward} EXP!`);
        }
        updateActivePetState({
            level: newLevel,
            exp: newExp,
            coins: coins + speciesDef.coinReward,
            specialCount: (activePetState.specialCount || 0) + 1,
        });
    };

    const cyclePet = () => {
        triggerParticleEffect("✨ SWITCH PET!", "#a855f7", "happy");
        const currentIndex = ALL_PET_SPECIES.findIndex(p => p.id === currentPetId);
        const nextIndex = (currentIndex + 1) % ALL_PET_SPECIES.length;
        const nextPet = ALL_PET_SPECIES[nextIndex];
        
        const nextPetState = petsData[nextPet.id] || { level: 1, exp: 0, coins: 100, feedCount: 0, playCount: 0, specialCount: 0 };
        const nextStageIdx = Math.min(9, Math.max(0, nextPetState.level - 1));
        const nextStage = nextPet.evolutions[nextStageIdx];

        updateTamagotchi({
            petType: nextPet.id,
            petsData: { ...petsData, [nextPet.id]: nextPetState },
            level: nextPetState.level,
            exp: nextPetState.exp,
            coins: nextPetState.coins,
        });
        setSpeech(`Switched to ${nextPet.name} (${nextStage.title})! ✨`);
    };

    const spinInterpolation = rotateSpinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.cardContainer}>
            {/* Header */}
            <View style={styles.cardHeader}>
                <View style={styles.petBadge}>
                    <Text style={styles.petEmoji}>{speciesDef.emoji}</Text>
                    <View>
                        <Text style={styles.petName}>{speciesDef.name}</Text>
                        <Text style={styles.petLevel}>Lvl {level} • {currentStage.badge}</Text>
                    </View>
                </View>
                <View style={styles.statsContainer}>
                    <View style={styles.coinBadge}>
                        <Text style={styles.coinText}>🪙 {coins}</Text>
                    </View>
                    <TouchableOpacity style={styles.switchButton} onPress={cyclePet} activeOpacity={0.7}>
                        <Icon name="cached" size={18} color="#38bdf8" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* EXP Bar */}
            <View style={styles.expBarBackground}>
                <View style={[styles.expBarFill, { width: `${Math.min(100, (exp / maxExp) * 100)}%` }]} />
            </View>

            {/* Speech Bubble */}
            <View style={styles.speechContainer}>
                <View style={styles.speechBubble}>
                    <Text style={styles.speechText}>{speech}</Text>
                </View>
                <View style={styles.speechArrow} />
            </View>

            {/* STAGE SELECTOR (QUICK LEVEL SWITCHER L1 to L10) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stageScroll}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lvl => (
                    <TouchableOpacity
                        key={lvl}
                        style={[styles.stageChip, level === lvl && styles.activeStageChip]}
                        onPress={() => setDirectLevel(lvl)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.stageChipText, level === lvl && styles.activeStageChipText]}>
                            {lvl === 10 ? '🌌 L10' : `L${lvl}`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* 100% NATIVE GPU STAGE RENDERER */}
            <View style={styles.petStage}>
                {floatingParticle && (
                    <Animated.View style={[styles.particleContainer, { transform: [{ translateY: particleAnim }], opacity: particleOpacity }]}>
                        <Text style={[styles.particleText, { color: floatingParticle.color }]}>{floatingParticle.text}</Text>
                    </Animated.View>
                )}
                
                {/* 60FPS Squish, Stretch & Spin Animation Container (all native-driver) */}
                <Animated.View
                    style={{
                        transform: [
                            { translateY: bounceAnim },
                            { scaleY: squishYAnim },
                            { scaleX: squishXAnim },
                            { rotate: spinInterpolation },
                        ],
                    }}
                >
                    <PetModelViewer
                        species={speciesDef.id}
                        stage={level}
                        emotion={emotion === 'idle' ? 'neutral' : 'happy'}
                        glbUri={getModelPathForSpecies(speciesDef.id)}
                        onLoadError={() => console.warn(`[FinancialTamagotchi] GLTF asset load error for species '${speciesDef.id}'`)}
                    />
                </Animated.View>
            </View>

            {/* Action Bar (4 Action Buttons including Special Ability) */}
            <View style={styles.actionBar}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleFeed} activeOpacity={0.7}>
                    <Text style={styles.actionEmoji}>🍎</Text>
                    <Text style={styles.actionLabel}>Feed</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={handlePlay} activeOpacity={0.7}>
                    <Text style={styles.actionEmoji}>🎾</Text>
                    <Text style={styles.actionLabel}>Play</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.specialActionBtn, specialCooldown && { opacity: 0.4 }]}
                    onPress={handleSpecialAbility}
                    activeOpacity={0.7}
                >
                    <Text style={styles.actionEmoji}>{specialCooldown ? '⏳' : speciesDef.specialAbilityEmoji}</Text>
                    <Text style={[styles.actionLabel, { color: specialCooldown ? '#94a3b8' : '#facc15' }]}>
                        {specialCooldown ? 'Wait' : 'Special'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.primaryActionBtn]} onPress={cyclePet} activeOpacity={0.7}>
                    <Text style={styles.actionEmoji}>✨</Text>
                    <Text style={[styles.actionLabel, { color: '#ffffff' }]}>Pet</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    cardContainer: {
        backgroundColor: '#0f172a',
        borderRadius: 20,
        padding: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(59, 130, 246, 0.35)',
        marginVertical: 10,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 6,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    petBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    petEmoji: {
        fontSize: 26,
    },
    petName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#f8fafc',
    },
    petLevel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#38bdf8',
        marginTop: 1,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    coinBadge: {
        backgroundColor: 'rgba(234, 179, 8, 0.18)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(234, 179, 8, 0.4)',
    },
    coinText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#facc15',
    },
    switchButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    expBarBackground: {
        height: 6,
        backgroundColor: '#1e293b',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    expBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 3,
    },
    speechContainer: {
        alignItems: 'center',
        marginBottom: 6,
    },
    speechBubble: {
        backgroundColor: '#1e293b',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        maxWidth: '94%',
    },
    speechText: {
        fontSize: 12,
        color: '#f8fafc',
        fontWeight: '600',
        textAlign: 'center',
    },
    speechArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 5,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: 'rgba(255,255,255,0.1)',
        marginTop: -1,
    },
    stageScroll: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    stageChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#1e293b',
        marginRight: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    activeStageChip: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    stageChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
    },
    activeStageChipText: {
        color: '#ffffff',
    },
    petStage: {
        height: 185,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
        position: 'relative',
        borderRadius: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    particleContainer: {
        position: 'absolute',
        top: 8,
        zIndex: 10,
    },
    particleText: {
        fontSize: 15,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#1e293b',
        paddingHorizontal: 6,
        paddingVertical: 8,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    specialActionBtn: {
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        borderColor: 'rgba(234, 179, 8, 0.4)',
    },
    primaryActionBtn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    actionEmoji: {
        fontSize: 14,
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#f8fafc',
    },
});
