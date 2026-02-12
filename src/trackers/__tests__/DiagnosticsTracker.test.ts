import * as vscode from 'vscode';
import { DiagnosticsTracker } from '../DiagnosticsTracker';

function getDiagnosticsChangeCallback(): () => void {
  const mock = vscode.languages.onDidChangeDiagnostics as jest.Mock;
  const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
  return lastCall[0];
}

function mockDiagnostics(entries: Array<{ uri: string; diagnostics: Array<{ severity: number }> }>) {
  (vscode.languages.getDiagnostics as jest.Mock).mockReturnValue(
    entries.map(e => [
      { scheme: 'file', path: e.uri },
      e.diagnostics.map(d => ({ severity: d.severity })),
    ])
  );
}

describe('DiagnosticsTracker', () => {
  let tracker: DiagnosticsTracker;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    tracker = new DiagnosticsTracker();
  });

  afterEach(() => {
    tracker.dispose();
    jest.useRealTimers();
  });

  describe('start()', () => {
    it('subscribes to onDidChangeDiagnostics', () => {
      tracker.start();

      expect(vscode.languages.onDidChangeDiagnostics).toHaveBeenCalledTimes(1);
    });

    it('does not fire callback immediately', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('error counting', () => {
    it('counts only Error-severity diagnostics across all files', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      mockDiagnostics([
        {
          uri: 'file:///a.ts',
          diagnostics: [
            { severity: vscode.DiagnosticSeverity.Error },
            { severity: vscode.DiagnosticSeverity.Warning },
            { severity: vscode.DiagnosticSeverity.Error },
          ],
        },
        {
          uri: 'file:///b.ts',
          diagnostics: [
            { severity: vscode.DiagnosticSeverity.Error },
            { severity: vscode.DiagnosticSeverity.Information },
            { severity: vscode.DiagnosticSeverity.Hint },
          ],
        },
      ]);

      const onChange = getDiagnosticsChangeCallback();
      onChange();
      jest.advanceTimersByTime(3000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(3); // 2 errors in a.ts + 1 in b.ts
    });

    it('returns 0 when there are no errors', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      mockDiagnostics([
        {
          uri: 'file:///a.ts',
          diagnostics: [
            { severity: vscode.DiagnosticSeverity.Warning },
            { severity: vscode.DiagnosticSeverity.Information },
          ],
        },
      ]);

      const onChange = getDiagnosticsChangeCallback();
      onChange();
      jest.advanceTimersByTime(3000);

      expect(callback).toHaveBeenCalledWith(0);
    });

    it('returns 0 when there are no diagnostics at all', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      mockDiagnostics([]);

      const onChange = getDiagnosticsChangeCallback();
      onChange();
      jest.advanceTimersByTime(3000);

      expect(callback).toHaveBeenCalledWith(0);
    });

    it('counts errors across many files', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      const entries = [];
      for (let i = 0; i < 25; i++) {
        entries.push({
          uri: `file:///file${i}.ts`,
          diagnostics: [{ severity: vscode.DiagnosticSeverity.Error }],
        });
      }
      mockDiagnostics(entries);

      const onChange = getDiagnosticsChangeCallback();
      onChange();
      jest.advanceTimersByTime(3000);

      expect(callback).toHaveBeenCalledWith(25);
    });
  });

  describe('debounce behavior', () => {
    it('debounces with a 3-second timer', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      mockDiagnostics([
        { uri: 'file:///a.ts', diagnostics: [{ severity: vscode.DiagnosticSeverity.Error }] },
      ]);

      const onChange = getDiagnosticsChangeCallback();
      onChange();

      // Not yet fired at 2 seconds
      jest.advanceTimersByTime(2000);
      expect(callback).not.toHaveBeenCalled();

      // Fires at 3 seconds
      jest.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('resets the debounce timer on each new diagnostic change', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      mockDiagnostics([
        { uri: 'file:///a.ts', diagnostics: [{ severity: vscode.DiagnosticSeverity.Error }] },
      ]);

      const onChange = getDiagnosticsChangeCallback();

      onChange();
      jest.advanceTimersByTime(2000);

      // Reset the timer
      onChange();
      jest.advanceTimersByTime(2000);

      // Original 3s from second call hasn't elapsed yet
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('only calls callback once per debounce window even with many changes', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      mockDiagnostics([
        { uri: 'file:///a.ts', diagnostics: [{ severity: vscode.DiagnosticSeverity.Error }] },
      ]);

      const onChange = getDiagnosticsChangeCallback();

      // Rapid-fire changes
      for (let i = 0; i < 10; i++) {
        onChange();
        jest.advanceTimersByTime(100);
      }

      // Wait for debounce to fire
      jest.advanceTimersByTime(3000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('uses fresh diagnostics state when debounce fires', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      // Initially 1 error
      mockDiagnostics([
        { uri: 'file:///a.ts', diagnostics: [{ severity: vscode.DiagnosticSeverity.Error }] },
      ]);

      const onChange = getDiagnosticsChangeCallback();
      onChange();

      // Before debounce fires, errors are fixed
      jest.advanceTimersByTime(1000);
      mockDiagnostics([]);
      onChange(); // triggers a new debounce reset

      jest.advanceTimersByTime(3000);

      // Should report 0 errors (the latest state)
      expect(callback).toHaveBeenCalledWith(0);
    });
  });

  describe('stop() and dispose()', () => {
    it('disposes the subscription on stop()', () => {
      tracker.start();
      tracker.stop();

      const disposeMock = (vscode.languages.onDidChangeDiagnostics as jest.Mock)
        .mock.results[0].value.dispose;
      expect(disposeMock).toHaveBeenCalled();
    });

    it('clears debounce timer on stop()', () => {
      const callback = jest.fn();
      tracker.onDiagnosticsChange(callback);
      tracker.start();

      mockDiagnostics([
        { uri: 'file:///a.ts', diagnostics: [{ severity: vscode.DiagnosticSeverity.Error }] },
      ]);

      const onChange = getDiagnosticsChangeCallback();
      onChange();

      tracker.stop();

      // Debounce timer should not fire after stop
      jest.advanceTimersByTime(5000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('dispose() stops tracking', () => {
      tracker.start();
      tracker.dispose();

      const disposeMock = (vscode.languages.onDidChangeDiagnostics as jest.Mock)
        .mock.results[0].value.dispose;
      expect(disposeMock).toHaveBeenCalled();
    });

    it('calling stop() multiple times does not throw', () => {
      expect(() => {
        tracker.stop();
        tracker.stop();
      }).not.toThrow();
    });

    it('calling dispose() multiple times does not throw', () => {
      expect(() => {
        tracker.dispose();
        tracker.dispose();
      }).not.toThrow();
    });
  });

  describe('no callback set', () => {
    it('does not throw when diagnostics change without a callback', () => {
      tracker.start();

      mockDiagnostics([
        { uri: 'file:///a.ts', diagnostics: [{ severity: vscode.DiagnosticSeverity.Error }] },
      ]);

      const onChange = getDiagnosticsChangeCallback();

      expect(() => {
        onChange();
        jest.advanceTimersByTime(3000);
      }).not.toThrow();
    });
  });
});
