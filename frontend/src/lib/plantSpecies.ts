export interface PlantStage {
  week: number;
  emoji: string;
  name: string;
  description: string;
}

export interface PlantSpecies {
  id: string;
  name: string;
  stages: PlantStage[];
}

export const plantSpecies: PlantSpecies[] = [
  {
    id: 'cherry',
    name: 'Cherry Blossom',
    stages: [
      { week: 0, emoji: '🌰', name: 'Seed', description: 'Your journey begins' },
      { week: 1, emoji: '🌱', name: 'Sprout', description: 'First signs of growth' },
      { week: 2, emoji: '🌿', name: 'Young Plant', description: 'Building momentum' },
      { week: 3, emoji: '🪴', name: 'Sapling', description: 'Growing stronger' },
      { week: 4, emoji: '🌳', name: 'Blooming Tree', description: 'Full bloom!' },
      { week: 5, emoji: '🌸', name: 'Majestic Blossom', description: 'Peak perfection achieved!' },
    ]
  },
  {
    id: 'pine',
    name: 'Pine Tree',
    stages: [
      { week: 0, emoji: '🌰', name: 'Seed', description: 'Your journey begins' },
      { week: 1, emoji: '🌱', name: 'Sprout', description: 'First signs of growth' },
      { week: 2, emoji: '🪴', name: 'Young Plant', description: 'Building momentum' },
      { week: 3, emoji: '🌲', name: 'Young Pine', description: 'Growing stronger' },
      { week: 4, emoji: '🌲⋆˙⟡', name: 'Strong Pine', description: 'Standing tall!' },
      { week: 5, emoji: '🎄', name: 'Celebration Pine', description: 'Timeless and majestic!' },
    ]
  },
  {
    id: 'maple',
    name: 'Maple Tree',
    stages: [
      { week: 0, emoji: '🌰', name: 'Seed', description: 'Your journey begins' },
      { week: 1, emoji: '🌱', name: 'Sprout', description: 'First signs of growth' },
      { week: 2, emoji: '🪴', name: 'Young Plant', description: 'Building momentum' },
      { week: 3, emoji: '🌳', name: 'Growing Maple', description: 'Growing stronger' },
      { week: 4, emoji: '🍁', name: 'Golden Maple', description: 'Radiant beauty!' },
      { week: 5, emoji: '🍂', name: 'Autumn Glory', description: 'Stunning transformation!' },
    ]
  },
  {
    id: 'cactus',
    name: 'Desert Cactus',
    stages: [
      { week: 0, emoji: '🌰', name: 'Seed', description: 'Your journey begins' },
      { week: 1, emoji: '🌱', name: 'Sprout', description: 'First signs of growth' },
      { week: 2, emoji: '🪴', name: 'Young Cactus', description: 'Building resilience' },
      { week: 3, emoji: '🌵', name: 'Strong Cactus', description: 'Thriving strong' },
      { week: 4, emoji: '🌺', name: 'Flowering Cactus', description: 'Rare bloom!' },
      { week: 5, emoji: '🏵️', name: 'Desert Crown', description: 'Ultimate resilience!' },
    ]
  },
  {
    id: 'palm',
    name: 'Palm Tree',
    stages: [
      { week: 0, emoji: '🌰', name: 'Seed', description: 'Your journey begins' },
      { week: 1, emoji: '🌱', name: 'Sprout', description: 'First signs of growth' },
      { week: 2, emoji: '🪴', name: 'Young Palm', description: 'Reaching upward' },
      { week: 3, emoji: '🌴', name: 'Tropical Palm', description: 'Growing stronger' },
      { week: 4, emoji: '🏝️', name: 'Paradise Palm', description: 'Tropical paradise!' },
      { week: 5, emoji: '🥥', name: 'Abundant Oasis', description: 'Fully flourished!' },
    ]
  },
  {
    id: 'bamboo',
    name: 'Bamboo',
    stages: [
      { week: 0, emoji: '🌰', name: 'Seed', description: 'Your journey begins' },
      { week: 1, emoji: '🌱', name: 'Sprout', description: 'First signs of growth' },
      { week: 2, emoji: '🪴', name: 'Young Bamboo', description: 'Flexible and strong' },
      { week: 3, emoji: '🎋', name: 'Growing Bamboo', description: 'Rising rapidly' },
      { week: 4, emoji: '🎍', name: 'Strong Bamboo', description: 'Unbreakable spirit!' },
      { week: 5, emoji: '🎍🎐', name: 'Zen Master', description: 'Perfect harmony achieved!' },
    ]
  },
];
