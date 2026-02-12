import * as vscode from 'vscode';

const POLL_INTERVAL_MS = 10_000;

interface GitExtensionAPI {
  repositories: Array<{
    state: {
      HEAD?: {
        commit?: string;
      };
    };
  }>;
}

export class CommitTracker {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastHeadCommit: string | null = null;
  private commitCallback: (() => void) | null = null;

  onCommit(callback: () => void): void {
    this.commitCallback = callback;
  }

  start(): void {
    this.stop();

    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
      console.warn('Code Tamagotchi: Git extension not found. Commit tracking disabled.');
      return;
    }

    const git = gitExtension.isActive
      ? gitExtension.exports.getAPI(1)
      : null;

    if (!git) {
      console.warn('Code Tamagotchi: Git API not available. Commit tracking disabled.');
      return;
    }

    const api = git as GitExtensionAPI;
    this.lastHeadCommit = this.getCurrentHead(api);

    this.pollInterval = setInterval(() => {
      const currentHead = this.getCurrentHead(api);
      if (currentHead && currentHead !== this.lastHeadCommit && this.lastHeadCommit !== null) {
        this.commitCallback?.();
      }
      if (currentHead) {
        this.lastHeadCommit = currentHead;
      }
    }, POLL_INTERVAL_MS);
  }

  private getCurrentHead(api: GitExtensionAPI): string | null {
    const repo = api.repositories[0];
    if (!repo) {
      return null;
    }
    return repo.state.HEAD?.commit ?? null;
  }

  stop(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  dispose(): void {
    this.stop();
  }
}
