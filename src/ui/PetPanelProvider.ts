import * as vscode from 'vscode';
import { PetStateData, PetMood, WebviewMessage } from '../types';
import { getNextStageXP, getStageXPThreshold } from '../pet/EvolutionStages';

export type PanelMessageHandler = (message: WebviewMessage) => void;

export class PetPanelProvider {
  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;
  private onMessage: PanelMessageHandler;
  private lastState: { state: PetStateData; mood: PetMood; emoji: string } | undefined;

  constructor(extensionUri: vscode.Uri, onMessage: PanelMessageHandler) {
    this.extensionUri = extensionUri;
    this.onMessage = onMessage;
  }

  createOrShow(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'codeTamagotchi',
      'Code Tamagotchi',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      this.onMessage(message);
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    if (this.lastState) {
      this.updateState(this.lastState.state, this.lastState.mood, this.lastState.emoji);
    }
  }

  updateState(state: PetStateData, mood: PetMood, emoji: string): void {
    this.lastState = { state, mood, emoji };
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'stateUpdate',
        state,
        mood,
        emoji,
      });
    }
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Tamagotchi</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #cccccc);
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      position: relative;
      overflow-x: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        radial-gradient(circle at 20% 50%, rgba(86, 156, 214, 0.03) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(206, 145, 120, 0.03) 0%, transparent 50%),
        radial-gradient(circle at 50% 80%, rgba(106, 153, 85, 0.03) 0%, transparent 50%);
      pointer-events: none;
      z-index: 0;
    }

    .pet-container {
      text-align: center;
      width: 100%;
      max-width: 420px;
      position: relative;
      z-index: 1;
    }

    /* --- ASCII Art Pet --- */
    .pet-art-wrapper {
      position: relative;
      margin: 16px 0 20px 0;
      min-height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pet-ascii {
      font-family: 'Courier New', 'Fira Code', 'Consolas', monospace;
      font-size: 16px;
      line-height: 1.3;
      white-space: pre;
      color: var(--vscode-editor-foreground, #cccccc);
      padding: 16px 24px;
      background: var(--vscode-input-background, #2d2d2d);
      border: 1px solid var(--vscode-widget-border, #444444);
      border-radius: 12px;
      display: inline-block;
      text-align: center;
      transition: opacity 0.5s ease, filter 0.5s ease, transform 0.3s ease;
    }

    /* Mood-based animations */
    .pet-ascii.mood-happy {
      animation: petBounce 2s ease-in-out infinite;
    }
    .pet-ascii.mood-content {
      animation: petBreathe 3s ease-in-out infinite;
    }
    .pet-ascii.mood-hungry {
      animation: petShake 0.6s ease-in-out infinite;
    }
    .pet-ascii.mood-sick {
      animation: petSway 2s ease-in-out infinite;
    }
    .pet-ascii.mood-dead {
      animation: none;
      opacity: 0.35;
      filter: grayscale(1);
    }

    @keyframes petBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    @keyframes petBreathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.03); }
    }

    @keyframes petShake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }

    @keyframes petSway {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-3deg); }
      75% { transform: rotate(3deg); }
    }

    /* --- Evolution Animation Overlay --- */
    .evolution-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      background: rgba(0, 0, 0, 0.6);
      pointer-events: none;
    }

    .evolution-overlay.active {
      display: flex;
      animation: overlayFade 2.5s ease-out forwards;
    }

    @keyframes overlayFade {
      0% { opacity: 0; }
      15% { opacity: 1; }
      75% { opacity: 1; }
      100% { opacity: 0; }
    }

    .evolution-text {
      font-size: 48px;
      font-weight: bold;
      color: #ffd700;
      text-shadow: 0 0 20px #ffd700, 0 0 40px #ff8c00, 0 0 60px #ff4500;
      animation: evolveText 2.5s ease-out forwards;
      letter-spacing: 8px;
    }

    @keyframes evolveText {
      0% { transform: scale(0.3); opacity: 0; }
      30% { transform: scale(1.4); opacity: 1; }
      50% { transform: scale(1); }
      75% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 0; }
    }

    .sparkle {
      position: absolute;
      width: 6px;
      height: 6px;
      background: #ffd700;
      border-radius: 50%;
      pointer-events: none;
    }

    /* --- Card Section --- */
    .card {
      background: var(--vscode-input-background, #2d2d2d);
      border: 1px solid var(--vscode-widget-border, #444444);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 14px;
      width: 100%;
      text-align: left;
    }

    .card-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--vscode-descriptionForeground, #888888);
      margin-bottom: 12px;
    }

    /* --- Pet Info Section --- */
    .pet-name-display {
      font-size: 26px;
      font-weight: bold;
      color: var(--vscode-editor-foreground, #ffffff);
      cursor: pointer;
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid transparent;
      transition: border-color 0.2s ease, background 0.2s ease;
    }

    .pet-name-display:hover {
      border-color: var(--vscode-focusBorder, #007acc);
      background: rgba(0, 122, 204, 0.08);
    }

    .pet-name-edit {
      display: none;
      gap: 8px;
      align-items: center;
      margin-bottom: 4px;
    }

    .pet-name-edit.active {
      display: flex;
    }

    .pet-name-display.hidden {
      display: none;
    }

    .pet-stage-line {
      font-size: 15px;
      color: var(--vscode-descriptionForeground, #aaaaaa);
      margin: 6px 0 4px 0;
    }

    .stage-emoji {
      margin-right: 4px;
    }

    .stage-name {
      text-transform: capitalize;
      font-weight: 500;
    }

    .pet-mood-text {
      font-size: 13px;
      color: var(--vscode-descriptionForeground, #888888);
      font-style: italic;
      margin: 8px 0 0 0;
      line-height: 1.4;
    }

    .pet-age {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #888888);
      margin-top: 6px;
    }

    /* --- Stat Bars --- */
    .bar-container {
      width: 100%;
      margin: 10px 0;
    }

    .bar-label {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 5px;
      color: var(--vscode-descriptionForeground, #aaaaaa);
      font-weight: 500;
    }

    .bar-value {
      font-variant-numeric: tabular-nums;
    }

    .bar-track {
      width: 100%;
      height: 14px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 7px;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      height: 100%;
      border-radius: 7px;
      transition: width 0.6s ease, background 0.4s ease;
      position: relative;
    }

    .bar-fill::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 50%;
      background: linear-gradient(to bottom, rgba(255,255,255,0.12), transparent);
      border-radius: 7px 7px 0 0;
    }

    .bar-fill.xp {
      background: linear-gradient(90deg, #569cd6, #9b59b6);
    }

    .bar-fill.hunger-green { background: linear-gradient(90deg, #4caf50, #6a9955); }
    .bar-fill.hunger-yellow { background: linear-gradient(90deg, #f0ad4e, #dcdcaa); }
    .bar-fill.hunger-red { background: linear-gradient(90deg, #e74c3c, #f44747); }

    .bar-fill.health-green { background: linear-gradient(90deg, #4caf50, #6a9955); }
    .bar-fill.health-yellow { background: linear-gradient(90deg, #f0ad4e, #dcdcaa); }
    .bar-fill.health-red { background: linear-gradient(90deg, #e74c3c, #f44747); }

    /* --- Stats Grid --- */
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      width: 100%;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 10px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 6px;
      font-size: 13px;
      color: var(--vscode-descriptionForeground, #aaaaaa);
    }

    .stat-item .stat-val {
      font-weight: 600;
      color: var(--vscode-editor-foreground, #cccccc);
      font-variant-numeric: tabular-nums;
    }

    /* --- Actions --- */
    .actions-section {
      width: 100%;
    }

    input[type="text"] {
      flex: 1;
      padding: 7px 10px;
      background: var(--vscode-input-background, #333333);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #555555);
      border-radius: 5px;
      font-size: 13px;
      outline: none;
      font-family: inherit;
    }

    input[type="text"]:focus {
      border-color: var(--vscode-focusBorder, #007acc);
    }

    button {
      padding: 7px 16px;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      transition: background 0.2s ease, box-shadow 0.2s ease;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }

    .revive-btn {
      width: 100%;
      padding: 12px;
      font-size: 15px;
      font-weight: 600;
      background: linear-gradient(135deg, #e74c3c, #c0392b);
      color: #ffffff;
      display: none;
      border-radius: 8px;
      margin-bottom: 10px;
      position: relative;
      overflow: hidden;
    }

    .revive-btn.visible {
      display: block;
      animation: reviveGlow 2s ease-in-out infinite;
    }

    @keyframes reviveGlow {
      0%, 100% { box-shadow: 0 0 8px rgba(231, 76, 60, 0.3); }
      50% { box-shadow: 0 0 20px rgba(231, 76, 60, 0.6), 0 0 40px rgba(231, 76, 60, 0.2); }
    }

    .revive-btn:hover {
      background: linear-gradient(135deg, #c0392b, #e74c3c);
    }

    .rename-row {
      display: flex;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="pet-container">

    <!-- Evolution animation overlay -->
    <div class="evolution-overlay" id="evolution-overlay">
      <div class="evolution-text">EVOLVED!</div>
    </div>

    <!-- ASCII Art Pet -->
    <div class="pet-art-wrapper">
      <pre class="pet-ascii mood-content" id="pet-ascii"></pre>
    </div>

    <!-- Info Card -->
    <div class="card">
      <div id="name-display" class="pet-name-display"></div>
      <div id="name-edit" class="pet-name-edit">
        <input type="text" id="rename-input" placeholder="New name..." maxlength="20" />
        <button id="rename-btn">Save</button>
        <button id="rename-cancel" style="background: transparent; color: var(--vscode-descriptionForeground, #888); border: 1px solid var(--vscode-widget-border, #444);">Cancel</button>
      </div>
      <div class="pet-stage-line">
        <span class="stage-emoji" id="stage-emoji"></span>
        <span class="stage-name" id="stage-name"></span>
      </div>
      <div class="pet-mood-text" id="mood-text"></div>
      <div class="pet-age" id="age"></div>
    </div>

    <!-- Stats Bars Card -->
    <div class="card">
      <div class="card-header">Vitals</div>

      <div class="bar-container">
        <div class="bar-label">
          <span>XP</span>
          <span class="bar-value" id="xp-text">0 / 50</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill xp" id="xp-bar" style="width: 0%"></div>
        </div>
      </div>

      <div class="bar-container">
        <div class="bar-label">
          <span>Hunger</span>
          <span class="bar-value" id="hunger-text">0</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill hunger-green" id="hunger-bar" style="width: 0%"></div>
        </div>
      </div>

      <div class="bar-container">
        <div class="bar-label">
          <span>Health</span>
          <span class="bar-value" id="health-text">100</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill health-green" id="health-bar" style="width: 100%"></div>
        </div>
      </div>
    </div>

    <!-- Lifetime Stats Card -->
    <div class="card">
      <div class="card-header">Lifetime Stats</div>
      <div class="stats">
        <div class="stat-item"><span>Commits</span><span class="stat-val" id="commits">0</span></div>
        <div class="stat-item"><span>Lines Deleted</span><span class="stat-val" id="lines-deleted">0</span></div>
        <div class="stat-item"><span>Times Revived</span><span class="stat-val" id="revived">0</span></div>
      </div>
    </div>

    <!-- Actions Card -->
    <div class="card actions-section">
      <button class="revive-btn" id="revive-btn">Revive Pet</button>
      <div class="rename-row">
        <input type="text" id="rename-input-bottom" placeholder="New name..." maxlength="20" />
        <button id="rename-btn-bottom">Rename</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const els = {
      petAscii: document.getElementById('pet-ascii'),
      nameDisplay: document.getElementById('name-display'),
      nameEdit: document.getElementById('name-edit'),
      renameInput: document.getElementById('rename-input'),
      renameBtn: document.getElementById('rename-btn'),
      renameCancel: document.getElementById('rename-cancel'),
      stageEmoji: document.getElementById('stage-emoji'),
      stageName: document.getElementById('stage-name'),
      moodText: document.getElementById('mood-text'),
      age: document.getElementById('age'),
      xpBar: document.getElementById('xp-bar'),
      xpText: document.getElementById('xp-text'),
      hungerBar: document.getElementById('hunger-bar'),
      hungerText: document.getElementById('hunger-text'),
      healthBar: document.getElementById('health-bar'),
      healthText: document.getElementById('health-text'),
      commits: document.getElementById('commits'),
      linesDeleted: document.getElementById('lines-deleted'),
      revived: document.getElementById('revived'),
      reviveBtn: document.getElementById('revive-btn'),
      renameInputBottom: document.getElementById('rename-input-bottom'),
      renameBtnBottom: document.getElementById('rename-btn-bottom'),
      evolutionOverlay: document.getElementById('evolution-overlay'),
    };

    const ASCII_ART = {
      egg: '     ,,,     \\n   /     \\\\   \\n  |  . .  |  \\n  |   ~   |  \\n   \\\\     /   \\n    -----    ',
      baby: '    ,_,      \\n   (o o)     \\n   ( > )     \\n    " "      ',
      child: '    \\\\._./    \\n   (o   o)   \\n   /|   |\\\\   \\n    |   |    \\n    d   b    ',
      teen: '     /\\\\   /\\\\  \\n    {  ~  }  \\n    { O O }  \\n    { > < }  \\n     ~   ~   \\n      |_|    ',
      adult: '    .  ~  .   \\n   / o   o \\\\  \\n  |    <    | \\n   \\\\ ===== /  \\n    -------   \\n     /|   |\\\\  \\n    / |   | \\\\ ',
      elder: '      ___      \\n    /  o  \\\\    \\n   | o   o |   \\n    \\\\ \\\\_/ /    \\n   --/   \\\\--   \\n     ^^ ^^     ',
      legendary: '    \\\\  |  /    \\n   -- -*- --   \\n    *  |  *   \\n   . --|-- .  \\n    *  |  *   \\n   -- -*- --  \\n    /  |  \\\\   ',
    };

    const STAGE_XP = {
      egg: { threshold: 0, next: 50 },
      baby: { threshold: 50, next: 200 },
      child: { threshold: 200, next: 500 },
      teen: { threshold: 500, next: 1200 },
      adult: { threshold: 1200, next: 3000 },
      elder: { threshold: 3000, next: 7000 },
      legendary: { threshold: 7000, next: null },
    };

    const STAGE_EMOJIS = {
      egg: '\\u{1F95A}',
      baby: '\\u{1F423}',
      child: '\\u{1F425}',
      teen: '\\u{1F409}',
      adult: '\\u{1F432}',
      elder: '\\u{1F985}',
      legendary: '\\u{1F31F}',
    };

    const MOOD_MESSAGES = {
      happy: 'Your pet is thriving! Keep up the good work!',
      content: 'Your pet is doing fine.',
      hungry: 'Your pet is getting hungry... time to commit!',
      sick: 'Your pet is sick! Fix those linter errors!',
      dead: 'Your pet has passed away...',
    };

    function formatAge(createdAt) {
      const ms = Date.now() - createdAt;
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      if (days > 0) return days + 'd ' + hours + 'h';
      return hours + 'h';
    }

    function hungerClass(hunger) {
      if (hunger < 40) return 'hunger-green';
      if (hunger < 70) return 'hunger-yellow';
      return 'hunger-red';
    }

    function healthClass(health) {
      if (health < 30) return 'health-red';
      if (health < 60) return 'health-yellow';
      return 'health-green';
    }

    function createSparkles() {
      const overlay = els.evolutionOverlay;
      for (let i = 0; i < 20; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.animationDelay = Math.random() * 1 + 's';
        sparkle.style.opacity = '0';
        sparkle.style.transition = 'opacity 0.3s, transform 1s';
        overlay.appendChild(sparkle);

        setTimeout(() => {
          sparkle.style.opacity = '1';
          sparkle.style.transform = 'translate(' + (Math.random() * 100 - 50) + 'px, ' + (Math.random() * 100 - 50) + 'px) scale(0)';
        }, Math.random() * 800);

        setTimeout(() => sparkle.remove(), 2500);
      }
    }

    function showEvolutionAnimation() {
      els.evolutionOverlay.classList.add('active');
      createSparkles();
      setTimeout(() => {
        els.evolutionOverlay.classList.remove('active');
      }, 2500);
    }

    let lastStage = null;
    let isRenaming = false;

    function updateUI(state, mood, emoji) {
      // ASCII art
      const art = ASCII_ART[state.stage] || ASCII_ART.egg;
      els.petAscii.textContent = art;

      // Mood-based animation class
      els.petAscii.className = 'pet-ascii mood-' + mood;

      // Evolution animation
      if (lastStage !== null && lastStage !== state.stage) {
        showEvolutionAnimation();
      }
      lastStage = state.stage;

      // Name (only update if not currently renaming)
      if (!isRenaming) {
        els.nameDisplay.textContent = state.name;
      }

      // Stage
      els.stageEmoji.textContent = STAGE_EMOJIS[state.stage] || '';
      els.stageName.textContent = state.stage;

      // Mood text
      els.moodText.textContent = MOOD_MESSAGES[mood] || '';

      // Age
      els.age.textContent = 'Age: ' + formatAge(state.createdAt);

      // XP bar
      const stageInfo = STAGE_XP[state.stage];
      if (stageInfo && stageInfo.next !== null) {
        const progress = state.xp - stageInfo.threshold;
        const needed = stageInfo.next - stageInfo.threshold;
        const pct = Math.min(100, (progress / needed) * 100);
        els.xpBar.style.width = pct + '%';
        els.xpText.textContent = state.xp + ' / ' + stageInfo.next;
      } else {
        els.xpBar.style.width = '100%';
        els.xpText.textContent = state.xp + ' (MAX)';
      }

      // Hunger bar
      els.hungerBar.style.width = state.hunger + '%';
      els.hungerBar.className = 'bar-fill ' + hungerClass(state.hunger);
      els.hungerText.textContent = state.hunger;

      // Health bar
      els.healthBar.style.width = state.health + '%';
      els.healthBar.className = 'bar-fill ' + healthClass(state.health);
      els.healthText.textContent = state.health;

      // Lifetime stats
      els.commits.textContent = state.totalCommits;
      els.linesDeleted.textContent = state.totalLinesDeleted;
      els.revived.textContent = state.revivedCount;

      // Revive button visibility
      els.reviveBtn.className = 'revive-btn' + (mood === 'dead' ? ' visible' : '');
    }

    // Click name to edit (inline rename)
    els.nameDisplay.addEventListener('click', () => {
      isRenaming = true;
      els.nameDisplay.classList.add('hidden');
      els.nameEdit.classList.add('active');
      els.renameInput.value = els.nameDisplay.textContent || '';
      els.renameInput.focus();
      els.renameInput.select();
    });

    function finishInlineRename(submit) {
      if (submit) {
        const name = els.renameInput.value.trim();
        if (name) {
          vscode.postMessage({ type: 'rename', name: name });
        }
      }
      isRenaming = false;
      els.nameDisplay.classList.remove('hidden');
      els.nameEdit.classList.remove('active');
    }

    els.renameBtn.addEventListener('click', () => finishInlineRename(true));
    els.renameCancel.addEventListener('click', () => finishInlineRename(false));
    els.renameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finishInlineRename(true);
      if (e.key === 'Escape') finishInlineRename(false);
    });

    // Bottom rename row
    els.renameBtnBottom.addEventListener('click', () => {
      const name = els.renameInputBottom.value.trim();
      if (name) {
        vscode.postMessage({ type: 'rename', name: name });
        els.renameInputBottom.value = '';
      }
    });

    els.renameInputBottom.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') els.renameBtnBottom.click();
    });

    // Revive
    els.reviveBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'revive' });
    });

    // Listen for state updates
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'stateUpdate') {
        updateUI(msg.state, msg.mood, msg.emoji);
      }
    });

    // Request initial state
    vscode.postMessage({ type: 'requestState' });
  </script>
</body>
</html>`;
  }
}
