import { EvolutionStage } from '../../types';
import {
  getStageEmoji,
  getStageForXP,
  getNextStageXP,
  getStageXPThreshold,
  STAGE_ORDER,
} from '../EvolutionStages';

describe('EvolutionStages', () => {
  describe('getStageEmoji', () => {
    it('returns egg emoji for Egg stage', () => {
      expect(getStageEmoji(EvolutionStage.Egg)).toBe('\u{1F95A}');
    });

    it('returns baby chick emoji for Baby stage', () => {
      expect(getStageEmoji(EvolutionStage.Baby)).toBe('\u{1F423}');
    });

    it('returns chick emoji for Child stage', () => {
      expect(getStageEmoji(EvolutionStage.Child)).toBe('\u{1F425}');
    });

    it('returns dragon emoji for Teen stage', () => {
      expect(getStageEmoji(EvolutionStage.Teen)).toBe('\u{1F409}');
    });

    it('returns dragon face emoji for Adult stage', () => {
      expect(getStageEmoji(EvolutionStage.Adult)).toBe('\u{1F432}');
    });

    it('returns eagle emoji for Elder stage', () => {
      expect(getStageEmoji(EvolutionStage.Elder)).toBe('\u{1F985}');
    });

    it('returns star emoji for Legendary stage', () => {
      expect(getStageEmoji(EvolutionStage.Legendary)).toBe('\u{1F31F}');
    });

    it('returns egg emoji as fallback for unknown stage', () => {
      expect(getStageEmoji('unknown' as EvolutionStage)).toBe('\u{1F95A}');
    });
  });

  describe('getStageForXP', () => {
    it('returns Egg for 0 XP', () => {
      expect(getStageForXP(0)).toBe(EvolutionStage.Egg);
    });

    it('returns Egg for 49 XP (just below Baby threshold)', () => {
      expect(getStageForXP(49)).toBe(EvolutionStage.Egg);
    });

    it('returns Baby for exactly 50 XP', () => {
      expect(getStageForXP(50)).toBe(EvolutionStage.Baby);
    });

    it('returns Baby for 199 XP (just below Child threshold)', () => {
      expect(getStageForXP(199)).toBe(EvolutionStage.Baby);
    });

    it('returns Child for exactly 200 XP', () => {
      expect(getStageForXP(200)).toBe(EvolutionStage.Child);
    });

    it('returns Teen for exactly 500 XP', () => {
      expect(getStageForXP(500)).toBe(EvolutionStage.Teen);
    });

    it('returns Adult for exactly 1200 XP', () => {
      expect(getStageForXP(1200)).toBe(EvolutionStage.Adult);
    });

    it('returns Elder for exactly 3000 XP', () => {
      expect(getStageForXP(3000)).toBe(EvolutionStage.Elder);
    });

    it('returns Legendary for exactly 7000 XP', () => {
      expect(getStageForXP(7000)).toBe(EvolutionStage.Legendary);
    });

    it('returns Legendary for 10000 XP (well above threshold)', () => {
      expect(getStageForXP(10000)).toBe(EvolutionStage.Legendary);
    });
  });

  describe('getNextStageXP', () => {
    it('returns 50 for Egg (next is Baby)', () => {
      expect(getNextStageXP(EvolutionStage.Egg)).toBe(50);
    });

    it('returns 200 for Baby (next is Child)', () => {
      expect(getNextStageXP(EvolutionStage.Baby)).toBe(200);
    });

    it('returns 500 for Child (next is Teen)', () => {
      expect(getNextStageXP(EvolutionStage.Child)).toBe(500);
    });

    it('returns 1200 for Teen (next is Adult)', () => {
      expect(getNextStageXP(EvolutionStage.Teen)).toBe(1200);
    });

    it('returns 3000 for Adult (next is Elder)', () => {
      expect(getNextStageXP(EvolutionStage.Adult)).toBe(3000);
    });

    it('returns 7000 for Elder (next is Legendary)', () => {
      expect(getNextStageXP(EvolutionStage.Elder)).toBe(7000);
    });

    it('returns null for Legendary (no next stage)', () => {
      expect(getNextStageXP(EvolutionStage.Legendary)).toBeNull();
    });

    it('returns null for unknown stage', () => {
      expect(getNextStageXP('unknown' as EvolutionStage)).toBeNull();
    });
  });

  describe('getStageXPThreshold', () => {
    it('returns 0 for Egg', () => {
      expect(getStageXPThreshold(EvolutionStage.Egg)).toBe(0);
    });

    it('returns 50 for Baby', () => {
      expect(getStageXPThreshold(EvolutionStage.Baby)).toBe(50);
    });

    it('returns 7000 for Legendary', () => {
      expect(getStageXPThreshold(EvolutionStage.Legendary)).toBe(7000);
    });

    it('returns 0 for unknown stage as fallback', () => {
      expect(getStageXPThreshold('unknown' as EvolutionStage)).toBe(0);
    });
  });

  describe('STAGE_ORDER', () => {
    it('has exactly 7 stages', () => {
      expect(STAGE_ORDER).toHaveLength(7);
    });

    it('has stages in correct progression order', () => {
      expect(STAGE_ORDER).toEqual([
        EvolutionStage.Egg,
        EvolutionStage.Baby,
        EvolutionStage.Child,
        EvolutionStage.Teen,
        EvolutionStage.Adult,
        EvolutionStage.Elder,
        EvolutionStage.Legendary,
      ]);
    });

    it('starts with Egg and ends with Legendary', () => {
      expect(STAGE_ORDER[0]).toBe(EvolutionStage.Egg);
      expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe(EvolutionStage.Legendary);
    });
  });
});
