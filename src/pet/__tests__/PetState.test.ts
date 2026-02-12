import { EvolutionStage, PetStateData } from '../../types';
import { PetState } from '../PetState';

function createMockContext() {
  const store: Record<string, any> = {};
  return {
    globalState: {
      get: jest.fn((key: string) => store[key]),
      update: jest.fn(async (key: string, value: any) => {
        store[key] = value;
      }),
    },
    subscriptions: [],
    extensionUri: { scheme: 'file', path: '/mock', fsPath: '/mock' },
    extensionPath: '/mock',
  } as any;
}

describe('PetState', () => {
  let context: ReturnType<typeof createMockContext>;
  let petState: PetState;

  beforeEach(() => {
    context = createMockContext();
    petState = new PetState(context);
  });

  describe('default state', () => {
    it('creates a default state when no stored state exists', () => {
      const state = petState.get();

      expect(state.name).toBe('Tama');
      expect(state.stage).toBe(EvolutionStage.Egg);
      expect(state.xp).toBe(0);
      expect(state.hunger).toBe(0);
      expect(state.health).toBe(100);
      expect(state.totalCommits).toBe(0);
      expect(state.totalLinesDeleted).toBe(0);
      expect(state.revivedCount).toBe(0);
    });

    it('sets timestamp fields to current time', () => {
      const before = Date.now();
      const state = petState.get();
      const after = Date.now();

      expect(state.lastFedTimestamp).toBeGreaterThanOrEqual(before);
      expect(state.lastFedTimestamp).toBeLessThanOrEqual(after);
      expect(state.lastCheckTimestamp).toBeGreaterThanOrEqual(before);
      expect(state.lastCheckTimestamp).toBeLessThanOrEqual(after);
      expect(state.createdAt).toBeGreaterThanOrEqual(before);
      expect(state.createdAt).toBeLessThanOrEqual(after);
    });

    it('persists default state to globalState on first get()', () => {
      petState.get();

      expect(context.globalState.update).toHaveBeenCalledWith(
        'codeTamagotchi.petState',
        expect.objectContaining({ name: 'Tama', xp: 0 })
      );
    });
  });

  describe('get()', () => {
    it('returns stored state when one exists', () => {
      const storedState: PetStateData = {
        name: 'Rex',
        stage: EvolutionStage.Teen,
        xp: 600,
        hunger: 25,
        health: 80,
        totalCommits: 10,
        totalLinesDeleted: 50,
        lastFedTimestamp: 1000,
        lastCheckTimestamp: 2000,
        createdAt: 500,
        revivedCount: 1,
      };

      context.globalState.get.mockReturnValue(storedState);
      const state = petState.get();

      expect(state).toEqual(storedState);
      expect(state.name).toBe('Rex');
      expect(state.xp).toBe(600);
    });

    it('does not overwrite globalState if stored state exists', () => {
      const storedState: PetStateData = {
        name: 'Rex',
        stage: EvolutionStage.Teen,
        xp: 600,
        hunger: 25,
        health: 80,
        totalCommits: 10,
        totalLinesDeleted: 50,
        lastFedTimestamp: 1000,
        lastCheckTimestamp: 2000,
        createdAt: 500,
        revivedCount: 1,
      };

      context.globalState.get.mockReturnValue(storedState);
      petState.get();

      expect(context.globalState.update).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('merges partial state correctly', async () => {
      petState.get();

      await petState.update({ name: 'Pixel', xp: 100 });

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updatedState = updateCall[1] as PetStateData;

      expect(updatedState.name).toBe('Pixel');
      expect(updatedState.xp).toBe(100);
      expect(updatedState.health).toBe(100);
      expect(updatedState.hunger).toBe(0);
    });

    it('preserves fields not included in the partial update', async () => {
      petState.get();

      await petState.update({ hunger: 50 });

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updatedState = updateCall[1] as PetStateData;

      expect(updatedState.name).toBe('Tama');
      expect(updatedState.stage).toBe(EvolutionStage.Egg);
      expect(updatedState.xp).toBe(0);
      expect(updatedState.hunger).toBe(50);
      expect(updatedState.health).toBe(100);
    });

    it('emits change event with the updated state', async () => {
      petState.get();

      const changeHandler = jest.fn();
      petState.on('change', changeHandler);

      await petState.update({ name: 'Sparky' });

      expect(changeHandler).toHaveBeenCalledTimes(1);
      const emittedState = changeHandler.mock.calls[0][0] as PetStateData;
      expect(emittedState.name).toBe('Sparky');
    });

    it('persists updated state to globalState', async () => {
      petState.get();

      await petState.update({ xp: 250, stage: EvolutionStage.Child });

      expect(context.globalState.update).toHaveBeenCalledWith(
        'codeTamagotchi.petState',
        expect.objectContaining({ xp: 250, stage: EvolutionStage.Child })
      );
    });
  });

  describe('reset()', () => {
    it('restores default state values', async () => {
      petState.get();
      await petState.update({ name: 'Sparky', xp: 500, hunger: 80 });

      await petState.reset();

      const lastUpdateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const resetState = lastUpdateCall[1] as PetStateData;

      expect(resetState.name).toBe('Tama');
      expect(resetState.stage).toBe(EvolutionStage.Egg);
      expect(resetState.xp).toBe(0);
      expect(resetState.hunger).toBe(0);
      expect(resetState.health).toBe(100);
      expect(resetState.totalCommits).toBe(0);
      expect(resetState.revivedCount).toBe(0);
    });

    it('emits change event with the default state', async () => {
      petState.get();

      const changeHandler = jest.fn();
      petState.on('change', changeHandler);

      await petState.reset();

      expect(changeHandler).toHaveBeenCalledTimes(1);
      const emittedState = changeHandler.mock.calls[0][0] as PetStateData;
      expect(emittedState.name).toBe('Tama');
      expect(emittedState.xp).toBe(0);
    });

    it('persists default state to globalState', async () => {
      petState.get();

      await petState.reset();

      expect(context.globalState.update).toHaveBeenCalledWith(
        'codeTamagotchi.petState',
        expect.objectContaining({
          name: 'Tama',
          stage: EvolutionStage.Egg,
          xp: 0,
          hunger: 0,
          health: 100,
        })
      );
    });
  });

  describe('state persistence', () => {
    it('uses the correct storage key', () => {
      petState.get();

      expect(context.globalState.get).toHaveBeenCalledWith('codeTamagotchi.petState');
    });

    it('reads from globalState on each get() call', () => {
      petState.get();
      petState.get();
      petState.get();

      expect(context.globalState.get).toHaveBeenCalledTimes(3);
    });
  });
});
