import * as vscode from 'vscode';
import { PetStateData, PetMood } from '../types';

const MOOD_INDICATORS: Record<PetMood, string> = {
  happy: '\u2665',
  content: '',
  hungry: '...',
  sick: '\u271A',
  dead: '\u{1F480}',
};

export class StatusBarManager {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = 'codeTamagotchi.showPet';
    this.item.tooltip = 'Code Tamagotchi - Click to view your pet';
  }

  update(state: PetStateData, mood: PetMood, emoji: string): void {
    const indicator = MOOD_INDICATORS[mood];
    this.item.text = indicator ? `${emoji} ${indicator}` : emoji;

    const stageName = state.stage.charAt(0).toUpperCase() + state.stage.slice(1);
    this.item.tooltip = `${state.name} (${stageName}) | Hunger: ${Math.round(state.hunger)} | Health: ${Math.round(state.health)} | XP: ${state.xp}`;
  }

  show(): void {
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
