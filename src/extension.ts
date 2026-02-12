import * as vscode from 'vscode';
import { PetState } from './pet/PetState';
import { PetEngine } from './pet/PetEngine';
import { StatusBarManager } from './ui/StatusBarManager';
import { PetPanelProvider } from './ui/PetPanelProvider';
import { CommitTracker } from './trackers/CommitTracker';
import { LineDeletionTracker } from './trackers/LineDeletionTracker';
import { DiagnosticsTracker } from './trackers/DiagnosticsTracker';
import { getStageEmoji, getStageForXP } from './pet/EvolutionStages';
import { PetStateData, PetMood, WebviewMessage } from './types';

function computeMood(state: PetStateData): PetMood {
  if (state.health <= 0) {
    return 'dead';
  }
  if (state.health < 30) {
    return 'sick';
  }
  if (state.hunger >= 70) {
    return 'hungry';
  }
  if (state.hunger <= 30 && state.health >= 70) {
    return 'happy';
  }
  return 'content';
}

function broadcastState(
  petState: PetState,
  statusBar: StatusBarManager,
  panel: PetPanelProvider
): void {
  const state = petState.get();
  const mood = computeMood(state);
  const emoji = getStageEmoji(state.stage);

  statusBar.update(state, mood, emoji);
  panel.updateState(state, mood, emoji);
}

export function activate(context: vscode.ExtensionContext): void {
  const petState = new PetState(context);
  const petEngine = new PetEngine(petState);
  const statusBar = new StatusBarManager();
  const panel = new PetPanelProvider(context.extensionUri, (message: WebviewMessage) => {
    handleWebviewMessage(message, petState);
  });
  const commitTracker = new CommitTracker();
  const lineDeletionTracker = new LineDeletionTracker();
  const diagnosticsTracker = new DiagnosticsTracker();

  let previousHealth = petState.get().health;

  petState.on('change', () => {
    const state = petState.get();

    // Death notification
    if (previousHealth > 0 && state.health <= 0) {
      vscode.window.showWarningMessage(
        `${state.name} has died! Open the pet panel to revive.`,
        'Show Pet'
      ).then((action) => {
        if (action === 'Show Pet') {
          panel.createOrShow();
          broadcastState(petState, statusBar, panel);
        }
      });
    }

    previousHealth = state.health;
    broadcastState(petState, statusBar, panel);
  });

  const showCommand = vscode.commands.registerCommand('codeTamagotchi.showPet', () => {
    panel.createOrShow();
    broadcastState(petState, statusBar, panel);
  });

  const resetCommand = vscode.commands.registerCommand('codeTamagotchi.resetPet', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to reset your pet? All progress will be lost.',
      'Reset',
      'Cancel'
    );
    if (confirm === 'Reset') {
      await petState.reset();
    }
  });

  // Catch up hunger for time VS Code was closed
  petEngine.catchUpHunger();

  // Notify if pet died while away
  const stateAfterCatchUp = petState.get();
  if (stateAfterCatchUp.health <= 0) {
    vscode.window.showWarningMessage(
      `${stateAfterCatchUp.name} died while you were away! Open the pet panel to revive.`,
      'Show Pet'
    ).then((action) => {
      if (action === 'Show Pet') {
        panel.createOrShow();
        broadcastState(petState, statusBar, panel);
      }
    });
  }

  petEngine.start();

  // Wire commit tracker to feed the pet on each commit
  commitTracker.onCommit(() => petEngine.onCommit());
  commitTracker.start();

  // Wire line deletion tracker for XP from refactoring
  lineDeletionTracker.onDeletions((count) => petEngine.onLinesDeletion(count));
  lineDeletionTracker.start();

  // Wire diagnostics tracker for health effects from linter errors
  diagnosticsTracker.onDiagnosticsChange((errorCount) => petEngine.onDiagnosticsUpdate(errorCount));
  diagnosticsTracker.start();

  statusBar.show();
  broadcastState(petState, statusBar, panel);

  context.subscriptions.push(
    showCommand,
    resetCommand,
    statusBar,
    { dispose: () => panel.dispose() },
    { dispose: () => petEngine.dispose() },
    { dispose: () => commitTracker.dispose() },
    { dispose: () => lineDeletionTracker.dispose() },
    { dispose: () => diagnosticsTracker.dispose() },
  );
}

async function handleWebviewMessage(
  message: WebviewMessage,
  petState: PetState
): Promise<void> {
  switch (message.type) {
    case 'rename': {
      const name = message.name.trim();
      if (name) {
        const state = petState.get();
        const newStage = getStageForXP(state.xp);
        await petState.update({ name, stage: newStage });
      }
      break;
    }
    case 'revive': {
      const state = petState.get();
      if (state.health <= 0) {
        await petState.update({
          health: 50,
          hunger: 0,
          revivedCount: state.revivedCount + 1,
        });
        vscode.window.showInformationMessage(
          `${state.name} has been revived! Take better care this time!`
        );
      }
      break;
    }
    case 'requestState':
      // The panel will receive state via the broadcastState triggered after createOrShow
      break;
  }
}

export function deactivate(): void {}
