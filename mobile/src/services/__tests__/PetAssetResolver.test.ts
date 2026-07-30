import { getModelPathForSpecies, isModelAvailableForSpecies } from '../PetAssetResolver';

describe('PetAssetResolver Unit Tests', () => {
    it('returns null for unknown or unmodeled species', () => {
        expect(getModelPathForSpecies('unknown_species')).toBeNull();
        expect(getModelPathForSpecies('')).toBeNull();
    });

    it('isModelAvailableForSpecies returns false for unmodeled species', () => {
        expect(isModelAvailableForSpecies('dragon')).toBe(false);
        expect(isModelAvailableForSpecies('cat')).toBe(false); // Currently null until cat.glb is registered
    });
});
