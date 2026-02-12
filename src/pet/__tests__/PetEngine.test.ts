import * as vscode from 'vscode';
import { PetEngine } from '../PetEngine';
import { PetState } from '../PetState';
import { EvolutionStage, PetStateData } from '../../types';

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

function createState(overrides: Partial<PetStateData> = {}): PetStateData {
  const now = Date.now();
  return {
    name: 'Tama',
    stage: EvolutionStage.Egg,
    xp: 0,
    hunger: 0,
    health: 100,
    totalCommits: 0,
    totalLinesDeleted: 0,
    lastFedTimestamp: now,
    lastCheckTimestamp: now,
    createdAt: now,
    revivedCount: 0,
    ...overrides,
  };
}

describe('PetEngine', () => {
  let context: ReturnType<typeof createMockContext>;
  let petState: PetState;
  let engine: PetEngine;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    context = createMockContext();
    petState = new PetState(context);
    engine = new PetEngine(petState);
  });

  afterEach(() => {
    engine.dispose();
    jest.useRealTimers();
  });

  describe('start() and hunger tick', () => {
    it('increases hunger by ~0.208 each tick (every 60 seconds)', () => {
      const state = createState({ hunger: 0, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.start();
      jest.advanceTimersByTime(60_000);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.hunger).toBeCloseTo(0.21, 1);
    });

    it('accumulates hunger over multiple ticks', () => {
      const state = createState({ hunger: 0, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.start();

      // Simulate 5 ticks (5 minutes)
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(60_000);
        // After each tick, update the mock to return the latest state
        const lastCall = context.globalState.update.mock.calls[
          context.globalState.update.mock.calls.length - 1
        ];
        if (lastCall) {
          context.globalState.get.mockReturnValue(lastCall[1]);
        }
      }

      const finalCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = finalCall[1] as PetStateData;
      expect(updated.hunger).toBeCloseTo(1.04, 1);
    });

    it('clamps hunger to 100', () => {
      const state = createState({ hunger: 99.9, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.start();
      jest.advanceTimersByTime(60_000);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.hunger).toBe(100);
    });

    it('applies starvation damage when hunger >= 80', () => {
      const state = createState({ hunger: 85, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.start();
      jest.advanceTimersByTime(60_000);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(98);
    });

    it('does not apply starvation damage when hunger < 80', () => {
      const state = createState({ hunger: 50, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.start();
      jest.advanceTimersByTime(60_000);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(100);
    });

    it('clamps health to 0 (never goes negative)', () => {
      const state = createState({ hunger: 90, health: 1 });
      context.globalState.get.mockReturnValue(state);

      engine.start();
      jest.advanceTimersByTime(60_000);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(0);
    });

    it('does not tick when pet is dead', () => {
      const state = createState({ health: 0, hunger: 50 });
      context.globalState.get.mockReturnValue(state);

      engine.start();
      const callsBefore = context.globalState.update.mock.calls.length;
      jest.advanceTimersByTime(60_000);

      expect(context.globalState.update.mock.calls.length).toBe(callsBefore);
    });

    it('updates lastCheckTimestamp on each tick', () => {
      const state = createState({ hunger: 0, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.start();
      jest.advanceTimersByTime(60_000);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.lastCheckTimestamp).toBeDefined();
    });
  });

  describe('onCommit()', () => {
    it('decreases hunger by 30', () => {
      const state = createState({ hunger: 50, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.onCommit();

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.hunger).toBe(20);
    });

    it('clamps hunger to 0 (does not go negative)', () => {
      const state = createState({ hunger: 10, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.onCommit();

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.hunger).toBe(0);
    });

    it('increments totalCommits', () => {
      const state = createState({ totalCommits: 5, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.onCommit();

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.totalCommits).toBe(6);
    });

    it('updates lastFedTimestamp', () => {
      const state = createState({ health: 100 });
      context.globalState.get.mockReturnValue(state);

      const before = Date.now();
      engine.onCommit();

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.lastFedTimestamp).toBeGreaterThanOrEqual(before);
    });

    it('does nothing when pet is dead', () => {
      const state = createState({ health: 0, hunger: 50 });
      context.globalState.get.mockReturnValue(state);

      const callsBefore = context.globalState.update.mock.calls.length;
      engine.onCommit();

      expect(context.globalState.update.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('onLinesDeletion()', () => {
    it('adds +2 XP per deleted line', () => {
      const state = createState({ xp: 0, health: 100, totalLinesDeleted: 0 });
      context.globalState.get.mockReturnValue(state);

      engine.onLinesDeletion(10);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.xp).toBe(20); // 10 lines * 2 XP
    });

    it('accumulates XP from multiple calls', () => {
      const state = createState({ xp: 10, health: 100, totalLinesDeleted: 5 });
      context.globalState.get.mockReturnValue(state);

      engine.onLinesDeletion(5);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.xp).toBe(20); // 10 + (5 * 2)
    });

    it('increments totalLinesDeleted', () => {
      const state = createState({ xp: 0, health: 100, totalLinesDeleted: 10 });
      context.globalState.get.mockReturnValue(state);

      engine.onLinesDeletion(7);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.totalLinesDeleted).toBe(17);
    });

    it('triggers evolution when XP crosses threshold (egg -> baby at 50)', () => {
      const state = createState({
        xp: 40,
        health: 100,
        stage: EvolutionStage.Egg,
        totalLinesDeleted: 20,
      });
      context.globalState.get.mockReturnValue(state);

      engine.onLinesDeletion(10); // +20 XP => total 60 XP => baby stage

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.stage).toBe(EvolutionStage.Baby);
      expect(updated.xp).toBe(60);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
    });

    it('shows notification with correct stage name on evolution', () => {
      const state = createState({
        xp: 190,
        health: 100,
        stage: EvolutionStage.Baby,
        totalLinesDeleted: 95,
      });
      context.globalState.get.mockReturnValue(state);

      engine.onLinesDeletion(10); // +20 XP => total 210 XP => child stage

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Child')
      );
    });

    it('does not trigger evolution when XP stays within current stage', () => {
      const state = createState({
        xp: 10,
        health: 100,
        stage: EvolutionStage.Egg,
        totalLinesDeleted: 5,
      });
      context.globalState.get.mockReturnValue(state);

      engine.onLinesDeletion(5); // +10 XP => total 20 XP => still egg

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.stage).toBe(EvolutionStage.Egg);
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('does nothing when pet is dead', () => {
      const state = createState({ health: 0, xp: 0, totalLinesDeleted: 0 });
      context.globalState.get.mockReturnValue(state);

      const callsBefore = context.globalState.update.mock.calls.length;
      engine.onLinesDeletion(10);

      expect(context.globalState.update.mock.calls.length).toBe(callsBefore);
    });

    it('can skip multiple evolution stages at once', () => {
      const state = createState({
        xp: 0,
        health: 100,
        stage: EvolutionStage.Egg,
        totalLinesDeleted: 0,
      });
      context.globalState.get.mockReturnValue(state);

      // 150 lines * 2 = 300 XP => child stage (skipping baby)
      engine.onLinesDeletion(150);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.stage).toBe(EvolutionStage.Child);
      expect(updated.xp).toBe(300);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('onDiagnosticsUpdate()', () => {
    it('decreases health by 5 when error count > 20', () => {
      const state = createState({ health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.onDiagnosticsUpdate(25);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(95);
    });

    it('increases health by 3 when error count <= 20', () => {
      const state = createState({ health: 80 });
      context.globalState.get.mockReturnValue(state);

      engine.onDiagnosticsUpdate(15);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(83);
    });

    it('increases health by 3 when error count is exactly 20', () => {
      const state = createState({ health: 80 });
      context.globalState.get.mockReturnValue(state);

      engine.onDiagnosticsUpdate(20);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(83);
    });

    it('decreases health by 5 when error count is exactly 21', () => {
      const state = createState({ health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.onDiagnosticsUpdate(21);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(95);
    });

    it('increases health by 3 when error count is 0', () => {
      const state = createState({ health: 90 });
      context.globalState.get.mockReturnValue(state);

      engine.onDiagnosticsUpdate(0);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(93);
    });

    it('clamps health to 100 (does not exceed max)', () => {
      const state = createState({ health: 99 });
      context.globalState.get.mockReturnValue(state);

      engine.onDiagnosticsUpdate(0);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(100);
    });

    it('clamps health to 0 (does not go negative)', () => {
      const state = createState({ health: 3 });
      context.globalState.get.mockReturnValue(state);

      engine.onDiagnosticsUpdate(50);

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.health).toBe(0);
    });

    it('does nothing when pet is dead', () => {
      const state = createState({ health: 0 });
      context.globalState.get.mockReturnValue(state);

      const callsBefore = context.globalState.update.mock.calls.length;
      engine.onDiagnosticsUpdate(5);

      expect(context.globalState.update.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('catchUpHunger()', () => {
    it('applies hunger for elapsed time', () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const state = createState({
        hunger: 0,
        health: 100,
        lastCheckTimestamp: oneHourAgo,
      });
      context.globalState.get.mockReturnValue(state);

      engine.catchUpHunger();

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.hunger).toBeCloseTo(12.5, 0);
    });

    it('clamps hunger to 100 after long absence', () => {
      const tenHoursAgo = Date.now() - 10 * 60 * 60 * 1000;
      const state = createState({
        hunger: 0,
        health: 100,
        lastCheckTimestamp: tenHoursAgo,
      });
      context.globalState.get.mockReturnValue(state);

      engine.catchUpHunger();

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.hunger).toBe(100);
    });

    it('applies starvation damage when pet was starving during elapsed time', () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const state = createState({
        hunger: 90,
        health: 100,
        lastCheckTimestamp: twoHoursAgo,
      });
      context.globalState.get.mockReturnValue(state);

      engine.catchUpHunger();

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      // 2 hours = 120 minutes, all above threshold
      // 120 * 2 = 240 damage
      expect(updated.health).toBe(0);
    });

    it('does not catch up when pet is dead', () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const state = createState({
        health: 0,
        lastCheckTimestamp: oneHourAgo,
      });
      context.globalState.get.mockReturnValue(state);

      const callsBefore = context.globalState.update.mock.calls.length;
      engine.catchUpHunger();

      expect(context.globalState.update.mock.calls.length).toBe(callsBefore);
    });

    it('does nothing when no time has elapsed', () => {
      const state = createState({
        hunger: 10,
        health: 100,
        lastCheckTimestamp: Date.now(),
      });
      context.globalState.get.mockReturnValue(state);

      const callsBefore = context.globalState.update.mock.calls.length;
      engine.catchUpHunger();

      expect(context.globalState.update.mock.calls.length).toBe(callsBefore);
    });

    it('updates lastCheckTimestamp to now', () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const state = createState({
        hunger: 0,
        health: 100,
        lastCheckTimestamp: oneHourAgo,
      });
      context.globalState.get.mockReturnValue(state);

      const before = Date.now();
      engine.catchUpHunger();

      const updateCall = context.globalState.update.mock.calls[
        context.globalState.update.mock.calls.length - 1
      ];
      const updated = updateCall[1] as PetStateData;
      expect(updated.lastCheckTimestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe('stop() and dispose()', () => {
    it('stops the hunger interval', () => {
      const state = createState({ hunger: 0, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.start();
      engine.stop();

      const callsBefore = context.globalState.update.mock.calls.length;
      jest.advanceTimersByTime(120_000);

      expect(context.globalState.update.mock.calls.length).toBe(callsBefore);
    });

    it('dispose() stops the interval', () => {
      const state = createState({ hunger: 0, health: 100 });
      context.globalState.get.mockReturnValue(state);

      engine.start();
      engine.dispose();

      const callsBefore = context.globalState.update.mock.calls.length;
      jest.advanceTimersByTime(120_000);

      expect(context.globalState.update.mock.calls.length).toBe(callsBefore);
    });

    it('calling stop() multiple times does not throw', () => {
      expect(() => {
        engine.stop();
        engine.stop();
      }).not.toThrow();
    });
  });
});
