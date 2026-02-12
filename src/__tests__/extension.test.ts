import * as vscode from 'vscode';
import { activate, deactivate } from '../extension';
import { EvolutionStage, PetStateData } from '../types';

function createMockContext() {
  const store: Record<string, any> = {};
  return {
    globalState: {
      get: jest.fn((key: string) => store[key]),
      update: jest.fn(async (key: string, value: any) => {
        store[key] = value;
      }),
    },
    subscriptions: [] as any[],
    extensionUri: { scheme: 'file', path: '/mock-ext', fsPath: '/mock-ext' },
    extensionPath: '/mock-ext',
  } as any;
}

// We need to test computeMood but it's not exported.
// We import the module and test it indirectly through activate behavior,
// or we can access it through a workaround by re-importing the module.
// Since computeMood is a private function, we test it indirectly.

describe('extension', () => {
  let context: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    context = createMockContext();
  });

  afterEach(() => {
    // Dispose all subscriptions to clean up PetEngine/CommitTracker intervals
    for (const sub of context.subscriptions) {
      if (sub && typeof sub.dispose === 'function') {
        sub.dispose();
      }
    }
    jest.useRealTimers();
  });

  describe('activate()', () => {
    it('does not throw', () => {
      expect(() => activate(context)).not.toThrow();
    });

    it('registers the showPet command', () => {
      activate(context);

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'codeTamagotchi.showPet',
        expect.any(Function)
      );
    });

    it('registers the resetPet command', () => {
      activate(context);

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'codeTamagotchi.resetPet',
        expect.any(Function)
      );
    });

    it('registers exactly 2 commands', () => {
      activate(context);

      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(2);
    });

    it('creates a status bar item', () => {
      activate(context);

      expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
    });

    it('shows the status bar item', () => {
      activate(context);

      const statusBarItem = (vscode.window.createStatusBarItem as jest.Mock)
        .mock.results[0].value;
      expect(statusBarItem.show).toHaveBeenCalled();
    });

    it('adds disposables to context.subscriptions', () => {
      activate(context);

      expect(context.subscriptions.length).toBeGreaterThan(0);
    });

    it('initializes pet state and sets status bar text', () => {
      activate(context);

      const statusBarItem = (vscode.window.createStatusBarItem as jest.Mock)
        .mock.results[0].value;
      // Default state: health=100, hunger=0 => happy mood
      // Egg emoji with heart indicator
      expect(statusBarItem.text).toBe('\u{1F95A} \u2665');
    });
  });

  describe('computeMood (tested indirectly via status bar text)', () => {
    it('shows happy mood when health >= 70 and hunger <= 30', () => {
      // Default state: health=100, hunger=0
      activate(context);

      const statusBarItem = (vscode.window.createStatusBarItem as jest.Mock)
        .mock.results[0].value;
      expect(statusBarItem.text).toContain('\u2665'); // heart = happy
    });

    it('shows dead mood when health is 0', () => {
      const deadState: PetStateData = {
        name: 'Tama',
        stage: EvolutionStage.Egg,
        xp: 0,
        hunger: 0,
        health: 0,
        totalCommits: 0,
        totalLinesDeleted: 0,
        lastFedTimestamp: Date.now(),
        lastCheckTimestamp: Date.now(),
        createdAt: Date.now(),
        revivedCount: 0,
      };

      context.globalState.get.mockReturnValue(deadState);
      activate(context);

      const statusBarItem = (vscode.window.createStatusBarItem as jest.Mock)
        .mock.results[0].value;
      expect(statusBarItem.text).toContain('\u{1F480}'); // skull = dead
    });

    it('shows sick mood when health < 30 and > 0', () => {
      const sickState: PetStateData = {
        name: 'Tama',
        stage: EvolutionStage.Egg,
        xp: 0,
        hunger: 0,
        health: 20,
        totalCommits: 0,
        totalLinesDeleted: 0,
        lastFedTimestamp: Date.now(),
        lastCheckTimestamp: Date.now(),
        createdAt: Date.now(),
        revivedCount: 0,
      };

      context.globalState.get.mockReturnValue(sickState);
      activate(context);

      const statusBarItem = (vscode.window.createStatusBarItem as jest.Mock)
        .mock.results[0].value;
      expect(statusBarItem.text).toContain('\u271A'); // cross = sick
    });

    it('shows hungry mood when hunger >= 70 and health >= 30', () => {
      const hungryState: PetStateData = {
        name: 'Tama',
        stage: EvolutionStage.Egg,
        xp: 0,
        hunger: 80,
        health: 100,
        totalCommits: 0,
        totalLinesDeleted: 0,
        lastFedTimestamp: Date.now(),
        lastCheckTimestamp: Date.now(),
        createdAt: Date.now(),
        revivedCount: 0,
      };

      context.globalState.get.mockReturnValue(hungryState);
      activate(context);

      const statusBarItem = (vscode.window.createStatusBarItem as jest.Mock)
        .mock.results[0].value;
      expect(statusBarItem.text).toContain('...'); // dots = hungry
    });

    it('shows content mood when not happy, hungry, sick, or dead', () => {
      const contentState: PetStateData = {
        name: 'Tama',
        stage: EvolutionStage.Egg,
        xp: 0,
        hunger: 40,
        health: 60,
        totalCommits: 0,
        totalLinesDeleted: 0,
        lastFedTimestamp: Date.now(),
        lastCheckTimestamp: Date.now(),
        createdAt: Date.now(),
        revivedCount: 0,
      };

      context.globalState.get.mockReturnValue(contentState);
      activate(context);

      const statusBarItem = (vscode.window.createStatusBarItem as jest.Mock)
        .mock.results[0].value;
      // Content has empty indicator, so text should just be the emoji
      expect(statusBarItem.text).toBe('\u{1F95A}');
    });
  });

  describe('deactivate()', () => {
    it('exists and does not throw', () => {
      expect(() => deactivate()).not.toThrow();
    });
  });
});
