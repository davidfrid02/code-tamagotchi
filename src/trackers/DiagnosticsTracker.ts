import * as vscode from 'vscode';

const DEBOUNCE_MS = 3_000;

export class DiagnosticsTracker {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private disposable: vscode.Disposable | null = null;
  private onDiagnosticsCallback: ((errorCount: number) => void) | null = null;

  onDiagnosticsChange(callback: (errorCount: number) => void): void {
    this.onDiagnosticsCallback = callback;
  }

  start(): void {
    this.stop();

    this.disposable = vscode.languages.onDidChangeDiagnostics(() => {
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        const errorCount = this.countErrors();
        if (this.onDiagnosticsCallback) {
          this.onDiagnosticsCallback(errorCount);
        }
      }, DEBOUNCE_MS);
    });
  }

  private countErrors(): number {
    let count = 0;
    for (const [, diagnostics] of vscode.languages.getDiagnostics()) {
      for (const d of diagnostics) {
        if (d.severity === vscode.DiagnosticSeverity.Error) {
          count++;
        }
      }
    }
    return count;
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
  }

  dispose(): void {
    this.stop();
  }
}
