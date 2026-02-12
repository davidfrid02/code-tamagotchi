import * as vscode from 'vscode';
import { StatusBarManager } from '../StatusBarManager';
import { PetStateData, PetMood, EvolutionStage } from '../../types';

function createMockState(overrides: Partial<PetStateData> = {}): PetStateData {
  return {
    name: 'Tama',
    stage: EvolutionStage.Egg,
    xp: 0,
    hunger: 0,
    health: 100,
    totalCommits: 0,
    totalLinesDeleted: 0,
    lastFedTimestamp: Date.now(),
    lastCheckTimestamp: Date.now(),
    createdAt: Date.now(),
    revivedCount: 0,
    ...overrides,
  };
}

describe('StatusBarManager', () => {
  let manager: StatusBarManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new StatusBarManager();
  });

  describe('constructor', () => {
    it('creates a status bar item with Left alignment', () => {
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
        vscode.StatusBarAlignment.Left,
        100
      );
    });

    it('creates a status bar item with priority 100', () => {
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
        expect.anything(),
        100
      );
    });

    it('sets the command to codeTamagotchi.showPet', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
      expect(item.command).toBe('codeTamagotchi.showPet');
    });

    it('sets an initial tooltip', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
      expect(item.tooltip).toBe('Code Tamagotchi - Click to view your pet');
    });
  });

  describe('update()', () => {
    it('sets text with heart indicator for happy mood', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
      const state = createMockState();

      manager.update(state, 'happy', '\u{1F95A}');

      expect(item.text).toBe('\u{1F95A} \u2665');
    });

    it('sets text with dots indicator for hungry mood', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
      const state = createMockState({ hunger: 80 });

      manager.update(state, 'hungry', '\u{1F95A}');

      expect(item.text).toBe('\u{1F95A} ...');
    });

    it('sets text with cross indicator for sick mood', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
      const state = createMockState({ health: 20 });

      manager.update(state, 'sick', '\u{1F95A}');

      expect(item.text).toBe('\u{1F95A} \u271A');
    });

    it('sets text with skull indicator for dead mood', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
      const state = createMockState({ health: 0 });

      manager.update(state, 'dead', '\u{1F95A}');

      expect(item.text).toBe('\u{1F95A} \u{1F480}');
    });

    it('sets text with only emoji for content mood (no indicator)', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
      const state = createMockState({ hunger: 40, health: 60 });

      manager.update(state, 'content', '\u{1F95A}');

      expect(item.text).toBe('\u{1F95A}');
    });

    it('uses the provided emoji for different stages', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
      const state = createMockState({ stage: EvolutionStage.Legendary });

      manager.update(state, 'happy', '\u{1F31F}');

      expect(item.text).toBe('\u{1F31F} \u2665');
    });

    it('sets tooltip with pet info', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;
      const state = createMockState({
        name: 'Tama',
        stage: EvolutionStage.Baby,
        hunger: 30,
        health: 85,
        xp: 120,
      });

      manager.update(state, 'content', '\u{1F423}');

      expect(item.tooltip).toBe('Tama (Baby) | Hunger: 30 | Health: 85 | XP: 120');
    });
  });

  describe('show()', () => {
    it('calls show() on the status bar item', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;

      manager.show();

      expect(item.show).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose()', () => {
    it('calls dispose() on the status bar item', () => {
      const item = (vscode.window.createStatusBarItem as jest.Mock).mock.results[0].value;

      manager.dispose();

      expect(item.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
