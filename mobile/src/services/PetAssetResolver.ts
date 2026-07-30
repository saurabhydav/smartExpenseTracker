/**
 * PetAssetResolver
 * Resolves local bundled .glb 3D model assets for pet species.
 * Returns a URI string suitable for GLTFLoader, or null if no model asset exists for the species.
 */

// Registry of bundled 3D GLB model require calls per species ID
const MODEL_REGISTRY: Record<string, any> = {
    // Registered species models will be required here as .glb files are placed in assets/pets3d/models/
    // Example: cat: require('../../assets/pets3d/models/cat.glb')
};

/**
 * Resolves the loadable URI string for a given pet species ID.
 * Returns null if no GLB model asset is currently available for that species.
 */
export function getModelPathForSpecies(speciesId: string): string | null {
    if (!speciesId) return null;
    const normalizedId = speciesId.toLowerCase().trim();
    const assetModule = MODEL_REGISTRY[normalizedId];

    if (!assetModule) {
        return null;
    }

    try {
        const { Image } = require('react-native');
        const resolved = Image?.resolveAssetSource ? Image.resolveAssetSource(assetModule) : null;
        return resolved ? resolved.uri : null;
    } catch (error) {
        console.warn(`[PetAssetResolver] Failed to resolve asset source for species '${speciesId}':`, error);
        return null;
    }
}

/**
 * Returns true if a bundled 3D GLB model asset exists for the given species ID.
 */
export function isModelAvailableForSpecies(speciesId: string): boolean {
    return getModelPathForSpecies(speciesId) !== null;
}
