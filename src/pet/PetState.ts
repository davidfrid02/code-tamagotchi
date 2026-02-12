import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { PetStateData, EvolutionStage } from '../types';

const STATE_KEY = 'codeTamagotchi.petState';

function createDefaultState(): PetStateData {
  const now = Date.now();
  return {
    name: 'Byte',
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
  };
}

export class PetState extends EventEmitter {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;
  }

  get(): PetStateData {
    const stored = this.context.globalState.get<PetStateData>(STATE_KEY);
    if (!stored) {
      const defaultState = createDefaultState();
      this.context.globalState.update(STATE_KEY, defaultState);
      return defaultState;
    }
    return stored;
  }

  async update(partial: Partial<PetStateData>): Promise<void> {
    const current = this.get();
    const updated = { ...current, ...partial };
    await this.context.globalState.update(STATE_KEY, updated);
    this.emit('change', updated);
  }

  async reset(): Promise<void> {
    const defaultState = createDefaultState();
    await this.context.globalState.update(STATE_KEY, defaultState);
    this.emit('change', defaultState);
  }
}
