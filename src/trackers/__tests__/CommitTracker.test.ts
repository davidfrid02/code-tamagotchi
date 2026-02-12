import * as vscode from 'vscode';
import { CommitTracker } from '../CommitTracker';

function createMockGitExtension(initialCommit: string | undefined = 'abc123') {
  const repo = {
    state: {
      HEAD: initialCommit ? { commit: initialCommit } : undefined,
    },
  };

  return {
    isActive: true,
    exports: {
      getAPI: jest.fn(() => ({
        repositories: [repo],
      })),
    },
    repo,
  };
}

describe('CommitTracker', () => {
  let tracker: CommitTracker;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    tracker = new CommitTracker();
  });

  afterEach(() => {
    tracker.dispose();
    jest.useRealTimers();
  });

  describe('start() with no git extension', () => {
    it('does not throw when git extension is not available', () => {
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);

      expect(() => tracker.start()).not.toThrow();
    });

    it('does not start polling when git extension is missing', () => {
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);
      const callback = jest.fn();
      tracker.onCommit(callback);

      tracker.start();
      jest.advanceTimersByTime(30_000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('start() with git extension but no API', () => {
    it('does not throw when git API is not available', () => {
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
        isActive: false,
        exports: { getAPI: jest.fn(() => null) },
      });

      expect(() => tracker.start()).not.toThrow();
    });
  });

  describe('commit detection', () => {
    it('detects a new commit when HEAD changes', () => {
      const mockGit = createMockGitExtension('commit-1');
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGit);

      const callback = jest.fn();
      tracker.onCommit(callback);
      tracker.start();

      // Change the HEAD commit
      mockGit.repo.state.HEAD = { commit: 'commit-2' };
      jest.advanceTimersByTime(10_000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not fire callback on initial start (baseline read)', () => {
      const mockGit = createMockGitExtension('commit-1');
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGit);

      const callback = jest.fn();
      tracker.onCommit(callback);
      tracker.start();

      // First poll with same commit
      jest.advanceTimersByTime(10_000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('detects multiple commits over time', () => {
      const mockGit = createMockGitExtension('commit-1');
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGit);

      const callback = jest.fn();
      tracker.onCommit(callback);
      tracker.start();

      // First commit
      mockGit.repo.state.HEAD = { commit: 'commit-2' };
      jest.advanceTimersByTime(10_000);

      // Second commit
      mockGit.repo.state.HEAD = { commit: 'commit-3' };
      jest.advanceTimersByTime(10_000);

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('does not fire when HEAD stays the same', () => {
      const mockGit = createMockGitExtension('commit-1');
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGit);

      const callback = jest.fn();
      tracker.onCommit(callback);
      tracker.start();

      // Multiple polls with same commit
      jest.advanceTimersByTime(50_000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('handles repository with no HEAD', () => {
      const mockGit = createMockGitExtension(undefined);
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGit);

      const callback = jest.fn();
      tracker.onCommit(callback);

      expect(() => tracker.start()).not.toThrow();
      jest.advanceTimersByTime(10_000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('stop() and dispose()', () => {
    it('stops polling after stop()', () => {
      const mockGit = createMockGitExtension('commit-1');
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGit);

      const callback = jest.fn();
      tracker.onCommit(callback);
      tracker.start();
      tracker.stop();

      mockGit.repo.state.HEAD = { commit: 'commit-2' };
      jest.advanceTimersByTime(30_000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('dispose() stops polling', () => {
      const mockGit = createMockGitExtension('commit-1');
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGit);

      const callback = jest.fn();
      tracker.onCommit(callback);
      tracker.start();
      tracker.dispose();

      mockGit.repo.state.HEAD = { commit: 'commit-2' };
      jest.advanceTimersByTime(30_000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('calling stop() multiple times does not throw', () => {
      expect(() => {
        tracker.stop();
        tracker.stop();
      }).not.toThrow();
    });
  });
});
