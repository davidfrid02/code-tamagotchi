import * as vscode from 'vscode';
import { PetState } from './PetState';
import { getStageForXP, getStageEmoji } from './EvolutionStages';

const DEFAULT_HUNGER_PER_HOUR = 12.5;
const TICK_INTERVAL_MS = 60_000;
const STARVATION_THRESHOLD = 80;
const STARVATION_DAMAGE = 2;
const DEFAULT_COMMIT_HUNGER_REDUCTION = 30;
const HEALTH_DAMAGE_FROM_ERRORS = 5;
const HEALTH_RECOVERY = 3;
const DEFAULT_ERROR_THRESHOLD = 20;
const DEFAULT_XP_PER_LINE = 2;

interface EngineConfig {
  hungerPerHour: number;
  commitFeedAmount: number;
  xpPerLine: number;
  errorThreshold: number;
}

function getConfig(): EngineConfig {
  const cfg = vscode.workspace.getConfiguration('codeTamagotchi');
  return {
    hungerPerHour: cfg.get<number>('hungerRate', DEFAULT_HUNGER_PER_HOUR),
    commitFeedAmount: cfg.get<number>('commitFeedAmount', DEFAULT_COMMIT_HUNGER_REDUCTION),
    xpPerLine: cfg.get<number>('xpPerLine', DEFAULT_XP_PER_LINE),
    errorThreshold: cfg.get<number>('errorThreshold', DEFAULT_ERROR_THRESHOLD),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class PetEngine {
  private hungerInterval: ReturnType<typeof setInterval> | null = null;
  private notifiedHunger50 = false;
  private notifiedHunger80 = false;
  private notifiedHealthCritical = false;

  constructor(private petState: PetState) {}

  private checkNotifications(hunger: number, health: number): void {
    if (health <= 0) {
      return;
    }

    if (hunger >= 80 && !this.notifiedHunger80) {
      this.notifiedHunger80 = true;
      vscode.window.showWarningMessage(
        'Your pet is starving! Commit now or it will lose health!'
      );
    } else if (hunger >= 50 && !this.notifiedHunger50) {
      this.notifiedHunger50 = true;
      vscode.window.showWarningMessage(
        'Your pet is getting hungry... commit some code!'
      );
    }

    if (hunger < 50) {
      this.notifiedHunger50 = false;
      this.notifiedHunger80 = false;
    } else if (hunger < 80) {
      this.notifiedHunger80 = false;
    }

    if (health < 30 && !this.notifiedHealthCritical) {
      this.notifiedHealthCritical = true;
      vscode.window.showWarningMessage(
        "Your pet's health is critical!"
      );
    }

    if (health >= 30) {
      this.notifiedHealthCritical = false;
    }
  }

  start(): void {
    this.stop();
    this.hungerInterval = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private tick(): void {
    const state = this.petState.get();
    if (state.health <= 0) {
      return;
    }

    const config = getConfig();
    const hungerPerMinute = config.hungerPerHour / 60;
    let hunger = state.hunger + hungerPerMinute;
    let health = state.health;

    hunger = clamp(hunger, 0, 100);

    if (hunger >= STARVATION_THRESHOLD) {
      health -= STARVATION_DAMAGE;
    }

    health = clamp(health, 0, 100);

    const roundedHunger = Math.round(hunger * 100) / 100;
    const roundedHealth = Math.round(health * 100) / 100;
    this.petState.update({
      hunger: roundedHunger,
      health: roundedHealth,
      lastCheckTimestamp: Date.now(),
    });
    this.checkNotifications(roundedHunger, roundedHealth);
  }

  onCommit(): void {
    const state = this.petState.get();
    if (state.health <= 0) {
      return;
    }

    const config = getConfig();
    const hunger = clamp(state.hunger - config.commitFeedAmount, 0, 100);
    const roundedHunger = Math.round(hunger * 100) / 100;

    this.petState.update({
      hunger: roundedHunger,
      totalCommits: state.totalCommits + 1,
      lastFedTimestamp: Date.now(),
    });
    this.checkNotifications(roundedHunger, state.health);
  }

  onLinesDeletion(count: number): void {
    const state = this.petState.get();
    if (state.health <= 0) {
      return;
    }

    const config = getConfig();
    const newXp = state.xp + count * config.xpPerLine;
    const newTotalLinesDeleted = state.totalLinesDeleted + count;
    const newStage = getStageForXP(newXp);

    const updates: Partial<typeof state> = {
      xp: newXp,
      totalLinesDeleted: newTotalLinesDeleted,
    };

    if (newStage !== state.stage) {
      updates.stage = newStage;
      const emoji = getStageEmoji(newStage);
      vscode.window.showInformationMessage(
        `Your pet evolved into a ${emoji} ${newStage.charAt(0).toUpperCase() + newStage.slice(1)}!`
      );
    }

    this.petState.update(updates);
  }

  onDiagnosticsUpdate(errorCount: number): void {
    const state = this.petState.get();
    if (state.health <= 0) {
      return;
    }

    const config = getConfig();
    let health = state.health;
    if (errorCount > config.errorThreshold) {
      health -= HEALTH_DAMAGE_FROM_ERRORS;
    } else {
      health += HEALTH_RECOVERY;
    }

    health = clamp(health, 0, 100);
    this.petState.update({ health });
    this.checkNotifications(state.hunger, health);
  }

  catchUpHunger(): void {
    const state = this.petState.get();
    if (state.health <= 0) {
      return;
    }

    const now = Date.now();

    // Handle invalid timestamps (0, negative, or in the future)
    if (!state.lastCheckTimestamp || state.lastCheckTimestamp <= 0 || state.lastCheckTimestamp > now) {
      this.petState.update({ lastCheckTimestamp: now });
      return;
    }

    const elapsedMs = now - state.lastCheckTimestamp;
    if (elapsedMs <= 0) {
      return;
    }

    // Cap offline period to 24 hours to prevent extreme accumulation
    const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;
    const cappedElapsedMs = Math.min(elapsedMs, MAX_OFFLINE_MS);

    const config = getConfig();
    const elapsedHours = cappedElapsedMs / (1000 * 60 * 60);
    const hungerGain = config.hungerPerHour * elapsedHours;

    let hunger = state.hunger + hungerGain;
    let health = state.health;

    // Calculate starvation damage for time spent above threshold
    if (hunger >= STARVATION_THRESHOLD || state.hunger >= STARVATION_THRESHOLD) {
      const elapsedMinutes = cappedElapsedMs / (1000 * 60);
      // Estimate minutes spent above threshold
      let minutesAboveThreshold: number;
      if (state.hunger >= STARVATION_THRESHOLD) {
        minutesAboveThreshold = elapsedMinutes;
      } else {
        const hungerToThreshold = STARVATION_THRESHOLD - state.hunger;
        const hungerPerMinute = config.hungerPerHour / 60;
        const minutesToThreshold = hungerToThreshold / hungerPerMinute;
        minutesAboveThreshold = Math.max(0, elapsedMinutes - minutesToThreshold);
      }
      health -= STARVATION_DAMAGE * minutesAboveThreshold;
    }

    hunger = clamp(hunger, 0, 100);
    health = clamp(health, 0, 100);

    this.petState.update({
      hunger: Math.round(hunger * 100) / 100,
      health: Math.round(health * 100) / 100,
      lastCheckTimestamp: now,
    });
  }

  stop(): void {
    if (this.hungerInterval !== null) {
      clearInterval(this.hungerInterval);
      this.hungerInterval = null;
    }
  }

  dispose(): void {
    this.stop();
  }
}
