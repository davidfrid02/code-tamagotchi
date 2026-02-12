export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
  };

  fire(data: T) {
    this.listeners.forEach(l => l(data));
  }

  dispose() {
    this.listeners = [];
  }
}

function createMockStatusBarItem() {
  return {
    text: '',
    tooltip: '',
    command: '',
    alignment: StatusBarAlignment.Left,
    priority: 100,
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  };
}

function createMockWebview() {
  return {
    html: '',
    options: {},
    onDidReceiveMessage: jest.fn((callback: (msg: any) => void) => {
      return { dispose: jest.fn() };
    }),
    postMessage: jest.fn().mockResolvedValue(true),
    asWebviewUri: jest.fn((uri: any) => uri),
  };
}

function createMockWebviewPanel() {
  const webview = createMockWebview();
  return {
    webview,
    viewType: 'codeTamagotchi',
    title: 'Code Tamagotchi',
    viewColumn: ViewColumn.Two,
    active: true,
    visible: true,
    onDidDispose: jest.fn((callback: () => void) => {
      return { dispose: jest.fn() };
    }),
    onDidChangeViewState: jest.fn(),
    reveal: jest.fn(),
    dispose: jest.fn(),
  };
}

export const window = {
  createStatusBarItem: jest.fn(
    (alignment?: StatusBarAlignment, priority?: number) => {
      const item = createMockStatusBarItem();
      item.alignment = alignment ?? StatusBarAlignment.Left;
      item.priority = priority ?? 0;
      return item;
    }
  ),
  createWebviewPanel: jest.fn(
    (_viewType: string, _title: string, _column: ViewColumn, _options?: any) => {
      return createMockWebviewPanel();
    }
  ),
  showInformationMessage: jest.fn().mockResolvedValue(undefined),
  showWarningMessage: jest.fn().mockResolvedValue(undefined),
  showErrorMessage: jest.fn().mockResolvedValue(undefined),
};

export const commands = {
  registerCommand: jest.fn((_command: string, _callback: (...args: any[]) => any) => {
    return { dispose: jest.fn() };
  }),
};

export const Uri = {
  file: jest.fn((path: string) => ({ scheme: 'file', path, fsPath: path })),
  joinPath: jest.fn((base: any, ...pathSegments: string[]) => {
    const joined = [base.path || base.fsPath || '', ...pathSegments].join('/');
    return { scheme: 'file', path: joined, fsPath: joined };
  }),
  parse: jest.fn((value: string) => ({ scheme: 'file', path: value, fsPath: value })),
};

export const languages = {
  onDidChangeDiagnostics: jest.fn((_callback: () => void) => {
    return { dispose: jest.fn() };
  }),
  getDiagnostics: jest.fn(() => []),
};

export const workspace = {
  onDidChangeTextDocument: jest.fn((_callback: () => void) => {
    return { dispose: jest.fn() };
  }),
  getConfiguration: jest.fn(() => ({
    get: jest.fn((_key: string, defaultValue?: any) => defaultValue),
    update: jest.fn(),
  })),
  workspaceFolders: [],
};

export const extensions = {
  getExtension: jest.fn((_id: string) => undefined),
};
