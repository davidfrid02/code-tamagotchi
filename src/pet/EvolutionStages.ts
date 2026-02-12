import { EvolutionStage } from '../types';

interface StageDefinition {
  stage: EvolutionStage;
  xpThreshold: number;
  emoji: string;
}

const STAGE_DEFINITIONS: StageDefinition[] = [
  { stage: EvolutionStage.Egg, xpThreshold: 0, emoji: '\u{1F95A}' },
  { stage: EvolutionStage.Baby, xpThreshold: 50, emoji: '\u{1F423}' },
  { stage: EvolutionStage.Child, xpThreshold: 200, emoji: '\u{1F425}' },
  { stage: EvolutionStage.Teen, xpThreshold: 500, emoji: '\u{1F409}' },
  { stage: EvolutionStage.Adult, xpThreshold: 1200, emoji: '\u{1F432}' },
  { stage: EvolutionStage.Elder, xpThreshold: 3000, emoji: '\u{1F985}' },
  { stage: EvolutionStage.Legendary, xpThreshold: 7000, emoji: '\u{1F31F}' },
];

export const STAGE_ORDER: EvolutionStage[] = STAGE_DEFINITIONS.map(d => d.stage);

export function getStageEmoji(stage: EvolutionStage): string {
  const def = STAGE_DEFINITIONS.find(d => d.stage === stage);
  return def?.emoji ?? '\u{1F95A}';
}

export function getStageForXP(xp: number): EvolutionStage {
  let result = EvolutionStage.Egg;
  for (const def of STAGE_DEFINITIONS) {
    if (xp >= def.xpThreshold) {
      result = def.stage;
    }
  }
  return result;
}

export function getNextStageXP(stage: EvolutionStage): number | null {
  const index = STAGE_DEFINITIONS.findIndex(d => d.stage === stage);
  if (index < 0 || index >= STAGE_DEFINITIONS.length - 1) {
    return null;
  }
  return STAGE_DEFINITIONS[index + 1].xpThreshold;
}

export function getStageXPThreshold(stage: EvolutionStage): number {
  const def = STAGE_DEFINITIONS.find(d => d.stage === stage);
  return def?.xpThreshold ?? 0;
}
