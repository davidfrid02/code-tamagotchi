import * as vscode from 'vscode';

const DEBOUNCE_MS = 2_000;

export class LineDeletionTracker {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingDeletions: number = 0;
  private disposable: vscode.Disposable | null = null;
  private onDeletionsCallback: ((lines: number) => void) | null = null;

  onDeletions(callback: (lines: number) => void): void {
    this.onDeletionsCallback = callback;
  }

  start(): void {
    this.stop();

    this.disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      for (const change of event.contentChanges) {
        const linesRemoved = change.range.end.line - change.range.start.line;
        const linesAdded = (change.text.match(/\n/g) || []).length;
        const netDeleted = linesRemoved - linesAdded;

        if (netDeleted > 0) {
          this.pendingDeletions += netDeleted;
        }
      }

      if (this.pendingDeletions > 0) {
        if (this.debounceTimer !== null) {
          clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
          this.flush();
        }, DEBOUNCE_MS);
      }
    });
  }

  private flush(): void {
    if (this.pendingDeletions > 0 && this.onDeletionsCallback) {
      this.onDeletionsCallback(this.pendingDeletions);
    }
    this.pendingDeletions = 0;
    this.debounceTimer = null;
  }

  stop(): void {
    if (this.disposable) {
      this.disposable.dispose();
      this.disposable = null;
    }
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    // Flush any pending deletions before stopping
    if (this.pendingDeletions > 0 && this.onDeletionsCallback) {
      this.onDeletionsCallback(this.pendingDeletions);
    }
    this.pendingDeletions = 0;
  }

  dispose(): void {
    this.stop();
  }
}
