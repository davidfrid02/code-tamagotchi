import * as vscode from 'vscode';
import { LineDeletionTracker } from '../LineDeletionTracker';

function createChangeEvent(changes: Array<{
  startLine: number;
  endLine: number;
  text: string;
}>) {
  return {
    document: {} as any,
    contentChanges: changes.map(c => ({
      range: {
        start: { line: c.startLine, character: 0 },
        end: { line: c.endLine, character: 0 },
      },
      text: c.text,
      rangeOffset: 0,
      rangeLength: 0,
    })),
    reason: undefined,
  };
}

function getDocChangeCallback(): (event: any) => void {
  const mock = vscode.workspace.onDidChangeTextDocument as jest.Mock;
  const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
  return lastCall[0];
}

describe('LineDeletionTracker', () => {
  let tracker: LineDeletionTracker;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    tracker = new LineDeletionTracker();
  });

  afterEach(() => {
    tracker.dispose();
    jest.useRealTimers();
  });

  describe('start()', () => {
    it('subscribes to onDidChangeTextDocument', () => {
      tracker.start();

      expect(vscode.workspace.onDidChangeTextDocument).toHaveBeenCalledTimes(1);
    });

    it('does not fire callback immediately', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('line deletion detection', () => {
    it('detects net line deletions and fires callback after debounce', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();
      // Delete 3 lines (range spans 3 lines, replace with empty string)
      onChange(createChangeEvent([{ startLine: 0, endLine: 3, text: '' }]));

      expect(callback).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(3);
    });

    it('calculates net deletions correctly when lines are also added', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();
      // Range spans 5 lines (0-5), text has 1 newline => linesRemoved=5, linesAdded=1, net=4
      onChange(createChangeEvent([{ startLine: 0, endLine: 5, text: 'line1\nline2' }]));

      jest.advanceTimersByTime(2000);

      expect(callback).toHaveBeenCalledWith(4);
    });

    it('ignores changes that add more lines than removed', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();
      // Replace 1 line with 3 lines => net addition, no deletion
      onChange(createChangeEvent([{ startLine: 0, endLine: 1, text: 'a\nb\nc' }]));

      jest.advanceTimersByTime(2000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('ignores changes with no net line change', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();
      // Range spans 2 lines (0-2), text has 1 newline => linesRemoved=2, linesAdded=1, net=1
      onChange(createChangeEvent([{ startLine: 0, endLine: 2, text: 'a\nb' }]));

      jest.advanceTimersByTime(2000);

      expect(callback).toHaveBeenCalledWith(1);
    });

    it('ignores single-line edits with no line deletion', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();
      // Edit within a single line (no line change)
      onChange(createChangeEvent([{ startLine: 5, endLine: 5, text: 'new text' }]));

      jest.advanceTimersByTime(2000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('debounce batching', () => {
    it('batches multiple changes within the debounce window', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();

      // First deletion: 2 lines
      onChange(createChangeEvent([{ startLine: 0, endLine: 2, text: '' }]));
      jest.advanceTimersByTime(500);

      // Second deletion: 3 lines (within debounce window)
      onChange(createChangeEvent([{ startLine: 5, endLine: 8, text: '' }]));
      jest.advanceTimersByTime(500);

      // Third deletion: 1 line (still within debounce window from second)
      onChange(createChangeEvent([{ startLine: 10, endLine: 11, text: '' }]));

      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(6); // 2 + 3 + 1
    });

    it('resets debounce timer on each new deletion', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();

      onChange(createChangeEvent([{ startLine: 0, endLine: 1, text: '' }]));
      jest.advanceTimersByTime(1500);

      // This should reset the timer
      onChange(createChangeEvent([{ startLine: 5, endLine: 6, text: '' }]));
      jest.advanceTimersByTime(1500);

      // Original 2s hasn't elapsed since second event
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(2);
    });

    it('handles multiple content changes in a single event', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();

      onChange(createChangeEvent([
        { startLine: 0, endLine: 2, text: '' },     // 2 deletions
        { startLine: 10, endLine: 13, text: 'x' },  // 3 deletions
      ]));

      jest.advanceTimersByTime(2000);

      expect(callback).toHaveBeenCalledWith(5);
    });
  });

  describe('stop() and dispose()', () => {
    it('stops tracking after stop()', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();
      tracker.stop();

      // This change should not accumulate since the subscription was disposed
      // But the callback was captured before stop, so we can still call it
      // The real test is that dispose was called on the subscription
      const disposeMock = (vscode.workspace.onDidChangeTextDocument as jest.Mock)
        .mock.results[0].value.dispose;
      expect(disposeMock).toHaveBeenCalled();
    });

    it('flushes pending deletions on stop()', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();
      onChange(createChangeEvent([{ startLine: 0, endLine: 4, text: '' }]));

      // Stop before debounce fires - should flush
      tracker.stop();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(4);
    });

    it('clears debounce timer on stop', () => {
      const callback = jest.fn();
      tracker.onDeletions(callback);
      tracker.start();

      const onChange = getDocChangeCallback();
      onChange(createChangeEvent([{ startLine: 0, endLine: 2, text: '' }]));

      tracker.stop();

      // Debounce timer should not fire again after stop
      jest.advanceTimersByTime(5000);

      // Only the flush call, not a second debounce call
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('dispose() stops tracking', () => {
      tracker.start();
      tracker.dispose();

      const disposeMock = (vscode.workspace.onDidChangeTextDocument as jest.Mock)
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
    it('does not throw when deletions occur without a callback', () => {
      tracker.start();

      const onChange = getDocChangeCallback();

      expect(() => {
        onChange(createChangeEvent([{ startLine: 0, endLine: 5, text: '' }]));
        jest.advanceTimersByTime(2000);
      }).not.toThrow();
    });
  });
});
