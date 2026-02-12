export enum EvolutionStage {
  Egg = 'egg',
  Baby = 'baby',
  Child = 'child',
  Teen = 'teen',
  Adult = 'adult',
  Elder = 'elder',
  Legendary = 'legendary',
}

export interface PetStateData {
  name: string;
  stage: EvolutionStage;
  xp: number;
  hunger: number;
  health: number;
  totalCommits: number;
  totalLinesDeleted: number;
  lastFedTimestamp: number;
  lastCheckTimestamp: number;
  createdAt: number;
  revivedCount: number;
}

export type PetMood = 'happy' | 'content' | 'hungry' | 'sick' | 'dead';

export type WebviewMessage =
  | { type: 'rename'; name: string }
  | { type: 'revive' }
  | { type: 'requestState' }
  | { type: 'stateUpdate'; state: PetStateData; mood: PetMood; emoji: string };
