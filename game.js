document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dom = {
        stageTitle: document.getElementById('stage-title'),
        gameBoard: document.getElementById('game-board'),
        commandStock: document.getElementById('command-stock'),
        commandSlots: document.getElementById('command-slots'),
        executeButton: document.getElementById('execute-button'),
        hpDisplay: document.getElementById('hp-display'),
        directionIndicator: document.getElementById('bird-direction-indicator'),
        birdElement: document.getElementById('bird'),
        tutorialOverlay: document.getElementById('tutorial-overlay'),
        tutorialCloseButton: document.getElementById('tutorial-close-button'),
        gameOverOverlay: document.getElementById('game-over-overlay'),
        gameOverMessage: document.getElementById('game-over-message'),
        retryButtonModal: document.getElementById('retry-button-modal'),
        nextStageButton: document.getElementById('next-stage-button'),
    };

    // --- Game Constants ---
    const ANIMATION_STEP_DURATION = 500;
    const MAX_HP = 3;
    const COMMAND_MAP = {
        'UP': { symbol: '↑', type: 'forward' },
        'RIGHT45': { symbol: '↗', type: 'right45' },
        'RIGHT90': { symbol: '→', type: 'right90' },
        'LEFT45': { symbol: '↖', type: 'left45' },
        'LEFT90': { symbol: '←', type: 'left90' },
    };
    const ALL_COMMAND_TYPES = Object.keys(COMMAND_MAP);

    // --- Pre-defined Stage Data ---
    const PREDEFINED_STAGES = [
        { id: 1, name: "（チュートリアル）: はじまりの道", gridSize: [5, 5], initialWizardPos: [4, 2], initialBirdDirection: 0, enemyPos: [1, 2], wallPositions: [], availableCommands: ['UP', 'UP', 'UP', 'RIGHT90'], commandSlotCount: 3 },
        { id: 2, name: "（チュートリアル）: 斜め移動の試練", gridSize: [5, 5], initialWizardPos: [4, 0], initialBirdDirection: 0, enemyPos: [0, 4], wallPositions: [[3, 1], [2, 3], [0, 2], [2, 0]], availableCommands: ['UP', 'UP', 'UP', 'RIGHT45', 'RIGHT45', 'LEFT90'], commandSlotCount: 5 },
    ];

    // --- Game State ---
    let playerHP = MAX_HP;
    let hasFailedInCurrentStage = false;
    let currentStageIndex = 0; // Index for PREDEFINED_STAGES or virtual index for random
    let currentStageData = {}; // Holds the complete data for the currently active stage
    let bird = { x: 0, y: 0, direction: 0 };
    let gridCells = [];
    let isExecuting = false;
    let draggedItem = null;

    // --- Main Initialization ---
    function init() {
        setupEventListeners();
        loadStage(0, { resetHP: true }); // Initial load

        if (!localStorage.getItem('hasVisited-v2.12')) { // Updated version key
            dom.tutorialOverlay.classList.remove('hidden');
            localStorage.setItem('hasVisited-v2.12', 'true');
        }
    }

    /**
     * Loads a stage by index or generates a new random one.
     * This function is responsible for *determining* currentStageData.
     * @param {number} stageIdentifier - Index for predefined, or 0 for new random.
     * @param {object} [options={}] - Options for loading.
     * @param {boolean} [options.resetHP=false] - Whether to reset player HP.
     * @param {boolean} [options.generateRandom=false] - If true, generates a new random stage.
     */
    function loadStage(stageIdentifier, options = {}) {
        const { resetHP = false, generateRandom = false } = options;

        if (resetHP) {
            playerHP = MAX_HP;
        }
        updateHPDisplay();
        
        if (generateRandom) {
            const generatedData = generateRandomStage('easy');
            currentStageData = { id: 1, name: "ランダムステージ", ...generatedData }; // Random stages always start as ID 1 for display
            currentStageIndex = PREDEFINED_STAGES.length; // Set internal index to indicate we are in random sequence
        } else if (stageIdentifier < PREDEFINED_STAGES.length) {
            currentStageData = PREDEFINED_STAGES[stageIdentifier];
            currentStageIndex = stageIdentifier; // Actual index for predefined stages
        } else {
            // This case is for sequential random stages after predefined ones are exhausted
            // For now, just generate another random stage, keeping the ID sequential for display
            const generatedData = generateRandomStage('easy');
            currentStageData = { id: stageIdentifier - PREDEFINED_STAGES.length + 1, name: "ランダムステージ", ...generatedData };
            currentStageIndex = stageIdentifier; // Keep incrementing index for display
        }

        _initializeCurrentStage(options.isRetry); // Now initialize the UI based on currentStageData
    }

    /**
     * Re-initializes the game UI and state based on the currentStageData.
     * This is called by loadStage and by retry logic.
     * @param {boolean} [enablePreview=false] - Whether to enable preview immediately.
     */
    function _initializeCurrentStage(enablePreview = false) {
        isExecuting = false;
        dom.executeButton.disabled = false;
        dom.gameOverOverlay.classList.add('hidden');
        dom.stageTitle.textContent = `ステージ ${currentStageData.id}: ${currentStageData.name}`;

        createBoard(currentStageData.gridSize);
        populateBoard(currentStageData);
        createCommandUI(currentStageData.availableCommands, currentStageData.commandSlotCount);
        resetBirdState(currentStageData);
        
        hasFailedInCurrentStage = enablePreview; // Set preview state
        drawPreview(); // Draw preview if enabled
    }

    // --- Board and UI Creation ---
    function createBoard([width, height]) {
        dom.gameBoard.innerHTML = '';
        dom.gameBoard.appendChild(dom.birdElement);
        dom.gameBoard.style.gridTemplateColumns = `repeat(${width}, 60px)`;
        gridCells = [];
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const cell = document.createElement('div');
                cell.classList.add('grid-cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                dom.gameBoard.appendChild(cell);
                gridCells.push(cell);
            }
        }
    }

    function populateBoard(stage) {
        gridCells.forEach(cell => cell.className = 'grid-cell');
        getCellByCoords(stage.initialWizardPos[0], stage.initialWizardPos[1]).classList.add('player');
        getCellByCoords(stage.enemyPos[0], stage.enemyPos[1]).classList.add('enemy');
        stage.wallPositions.forEach(([r, c]) => getCellByCoords(r, c).classList.add('wall'));
    }

    function createCommandUI(commands, slotCount) {
        dom.commandStock.innerHTML = '';
        dom.commandSlots.innerHTML = '';
        commands.forEach(cmdKey => dom.commandStock.appendChild(createCommandElement(cmdKey)));
        for (let i = 0; i < slotCount; i++) {
            dom.commandSlots.appendChild(document.createElement('div')).classList.add('command-slot');
        }
    }
    
    function resetBirdState(stage) {
        const [row, col] = stage.initialWizardPos;
        bird.x = col;
        bird.y = row;
        bird.direction = stage.initialBirdDirection;
        dom.birdElement.className = '';
        dom.birdElement.style.opacity = 0;
        positionBirdOnGrid();
        updateDirectionIndicator();
    }

    function updateHPDisplay() {
        dom.hpDisplay.innerHTML = '';
        for (let i = 0; i < MAX_HP; i++) {
            const heart = document.createElement('span');
            heart.className = 'heart';
            heart.textContent = '❤️';
            if (i >= playerHP) {
                heart.classList.add('lost');
            }
            dom.hpDisplay.appendChild(heart);
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        dom.executeButton.addEventListener('click', executeCommands);
        
        dom.retryButtonModal.addEventListener('click', () => {
            if (playerHP <= 0) {
                // Game Over: Start a new random stage as "Stage 1" with full HP
                loadStage(0, { resetHP: true, generateRandom: true });
            } else {
                // Regular Retry: Re-initialize current stage, keep HP, enable preview
                _initializeCurrentStage(true); // Pass true to enable preview
            }
        });

        dom.nextStageButton.addEventListener('click', () => {
            // If currently on a predefined stage and not the last one
            if (currentStageIndex < PREDEFINED_STAGES.length - 1) {
                loadStage(currentStageIndex + 1);
            } else {
                // If on the last predefined stage, or already on a random stage, load a new random stage
                // The identifier for the next random stage should be currentStageIndex + 1
                loadStage(currentStageIndex + 1); // This will fall into the 'else' block in loadStage
            }
        });
        
        dom.tutorialCloseButton.addEventListener('click', () => dom.tutorialOverlay.classList.add('hidden'));
        
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('dragend', handleDragEnd);
        document.addEventListener('dragover', e => e.preventDefault());
        document.addEventListener('dragenter', handleDragEnter);
        document.addEventListener('dragleave', handleDragLeave);
        document.addEventListener('drop', handleDrop);
    }

    // --- Main Game Logic (Execution, Preview) ---
    async function executeCommands() {
        if (isExecuting) return;
        const commands = [...dom.commandSlots.querySelectorAll('.command-arrow')].map(el => el.dataset.command);
        if (commands.length === 0) return;

        isExecuting = true;
        dom.executeButton.disabled = true;
        document.querySelectorAll('.preview-dot').forEach(dot => dot.remove());
        
        dom.birdElement.style.opacity = 1;

        for (const command of commands) {
            const result = await executeSingleCommand(command);
            if (!result.success) { handleFailure('wall'); return; }
            if (result.hitEnemy) { handleSuccess(); return; }
        }
        handleFailure('end');
    }

    function drawPreview() {
        document.querySelectorAll('.preview-dot').forEach(dot => dot.remove());
        if (!hasFailedInCurrentStage) return; // Strict check

        const commands = [...dom.commandSlots.querySelectorAll('.command-arrow')].map(el => el.dataset.command);
        if (commands.length === 0) return;

        let tempBird = { ...bird };
        for (const command of commands) {
            const newDirection = calculateNewDirection(tempBird.direction, command);
            const { nextX, nextY } = calculateNextPosition(tempBird.x, tempBird.y, newDirection);
            const cell = getCellByCoords(nextY, nextX);
            if (!cell || cell.classList.contains('wall')) break;
            tempBird = { x: nextX, y: nextY, direction: newDirection };
            const dot = document.createElement('div');
            dot.classList.add('preview-dot');
            cell.appendChild(dot);
            if (cell.classList.contains('enemy')) break;
        }
    }

    // --- Game End Handlers ---
    function handleSuccess() {
        const enemyCell = getCellByCoords(currentStageData.enemyPos[0], currentStageData.enemyPos[1]);
        const explosion = document.createElement('div');
        explosion.className = 'explosion';
        enemyCell.appendChild(explosion);
        setTimeout(() => {
            enemyCell.classList.remove('enemy');
            dom.birdElement.style.opacity = 0;
            showGameOverModal("クリア！お見事です！", { isSuccess: true });
        }, 400);
    }

    function handleFailure(reason) {
        playerHP--;
        hasFailedInCurrentStage = true;
        updateHPDisplay();
        dom.hpDisplay.classList.add('hurt');
        setTimeout(() => dom.hpDisplay.classList.remove('hurt'), 300);

        if (reason === 'wall') dom.birdElement.classList.add('puff');
        getCellByCoords(currentStageData.initialWizardPos[0], currentStageData.initialWizardPos[1]).classList.add('fail');
        
        if (playerHP <= 0) {
            setTimeout(() => showGameOverModal("ゲームオーバー...", { isGameOver: true }), 1000);
        } else {
            const msg = reason === 'wall' ? '失敗！壁に衝突しました。' : '失敗！敵に届きませんでした。';
            setTimeout(() => {
                showGameOverModal(msg, { isRetryable: true });
            }, 1000);
        }
    }

    function showGameOverModal(message, options = {}) {
        const { isSuccess = false, isGameOver = false, isRetryable = false } = options;
        dom.gameOverMessage.textContent = message;
        dom.nextStageButton.classList.toggle('hidden', !isSuccess);
        dom.retryButtonModal.classList.toggle('hidden', isSuccess);
        
        if (isGameOver) {
            dom.retryButtonModal.textContent = "もう一度挑戦";
        } else if (isRetryable) {
            dom.retryButtonModal.textContent = "リトライ";
        }

        dom.gameOverOverlay.classList.remove('hidden');
        dom.executeButton.disabled = true;
    }

    // --- Unchanged functions (Drag/Drop, Calculations, etc.) are assumed to be here ---
    const calculateNewDirection = (dir, cmd) => (({ 'forward': 0, 'left90': -90, 'left45': -45, 'right45': 45, 'right90': 90 }[cmd] || 0) + dir + 360) % 360;
    const calculateNextPosition = (x, y, dir) => ({ nextX: x + Math.round(Math.sin(dir * Math.PI / 180)), nextY: y - Math.round(Math.cos(dir * Math.PI / 180)) });
    const getCellByCoords = (row, col) => { const [width, height] = currentStageData.gridSize; if (col < 0 || col >= width || row < 0 || row >= height) return null; return gridCells[row * width + col]; };
    const createCommandElement = (cmdKey) => { const el = document.createElement('div'); el.className = 'command-arrow'; el.dataset.command = COMMAND_MAP[cmdKey].type; el.textContent = COMMAND_MAP[cmdKey].symbol; el.draggable = true; return el; };
    function handleDragStart(e) { if (e.target.classList.contains('command-arrow')) { draggedItem = e.target; setTimeout(() => e.target.classList.add('dragging'), 0); } }
    function handleDragEnd() { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem = null; document.querySelectorAll('.over').forEach(el => el.classList.remove('over')); drawPreview(); } }
    function handleDragEnter(e) { const dz = e.target.closest('.command-slot, #command-stock'); if (dz) dz.classList.add('over'); }
    function handleDragLeave(e) { const dz = e.target.closest('.command-slot, #command-stock'); if (dz) dz.classList.remove('over'); }
    function handleDrop(e) { e.preventDefault(); if (!draggedItem) return; const dz = e.target.closest('#command-slots, #command-stock'); if (!dz) return; if (dz.id === 'command-slots') { const slot = e.target.closest('.command-slot'); if (slot) { if (slot.children.length === 0) { slot.appendChild(draggedItem); } else { const existing = slot.children[0]; draggedItem.parentElement.appendChild(existing); slot.appendChild(draggedItem); } } } else if (dz.id === 'command-stock') { dz.appendChild(draggedItem); } }
    function executeSingleCommand(type) { return new Promise(res => { bird.direction = calculateNewDirection(bird.direction, type); positionBirdOnGrid(); updateDirectionIndicator(); setTimeout(() => { const { nextX, nextY } = calculateNextPosition(bird.x, bird.y, bird.direction); const cell = getCellByCoords(nextY, nextX); if (!cell || cell.classList.contains('wall')) { res({ success: false }); return; } bird.x = nextX; bird.y = nextY; positionBirdOnGrid(); res({ success: true, hitEnemy: cell.classList.contains('enemy') }); }, ANIMATION_STEP_DURATION / 2); }); }
    function positionBirdOnGrid() { const cell = getCellByCoords(bird.y, bird.x); if (cell) { dom.birdElement.style.left = `${cell.offsetLeft}px`; dom.birdElement.style.top = `${cell.offsetTop}px`; dom.birdElement.style.transform = `rotate(${bird.direction}deg)`; } }
    function updateDirectionIndicator() { dom.directionIndicator.style.transform = `rotate(${bird.direction}deg)`; }
    function generateRandomStage(difficulty) { const gridSize = [5, 5]; const [width, height] = gridSize; let wizardPos, enemyPos, wallPositions, solutionPath; while (true) { wizardPos = [Math.floor(Math.random() * height), Math.floor(Math.random() * width)]; do { enemyPos = [Math.floor(Math.random() * height), Math.floor(Math.random() * width)]; } while (Math.abs(wizardPos[0] - enemyPos[0]) + Math.abs(wizardPos[1] - enemyPos[1]) < 4); const wallCount = { easy: 3, medium: 5, hard: 7 }[difficulty] || 3; wallPositions = []; const occupied = new Set([`${wizardPos[0]},${wizardPos[1]}`, `${enemyPos[0]},${enemyPos[1]}`]); for (let i = 0; i < wallCount; i++) { let r, c; do { r = Math.floor(Math.random() * height); c = Math.floor(Math.random() * width); } while (occupied.has(`${r},${c}`)); wallPositions.push([r, c]); occupied.add(`${r},${c}`); } const initialDirection = [0, 90, 180, 270][Math.floor(Math.random() * 4)]; solutionPath = findShortestCommandPath(gridSize, wizardPos, initialDirection, enemyPos, wallPositions); if (solutionPath && solutionPath.length > 0 && solutionPath.length <= 6) { const availableCommands = [...solutionPath]; for(let i = 0; i < 2; i++) { availableCommands.push(ALL_COMMAND_TYPES[Math.floor(Math.random() * ALL_COMMAND_TYPES.length)]); } availableCommands.sort(() => Math.random() - 0.5); return { gridSize: gridSize, initialWizardPos: wizardPos, initialBirdDirection: initialDirection, enemyPos: enemyPos, wallPositions: wallPositions, availableCommands: availableCommands, commandSlotCount: solutionPath.length, }; } } }
    function findShortestCommandPath(gridSize, startPos, startDir, endPos, walls) { const [width, height] = gridSize; const wallSet = new Set(walls.map(([r, c]) => `${r},${c}`)); const queue = [{ pos: startPos, dir: startDir, path: [] }]; const visited = new Set(`${startPos[0]},${startPos[1]},${startDir}`); while (queue.length > 0) { const { pos, dir, path } = queue.shift(); if (pos[0] === endPos[0] && pos[1] === endPos[1]) return path; if (path.length >= 6) continue; for (const command of ALL_COMMAND_TYPES) { const commandType = COMMAND_MAP[command].type; const newDir = calculateNewDirection(dir, commandType); const { nextX, nextY } = calculateNextPosition(pos[1], pos[0], newDir); const stateKey = `${nextY},${nextX},${newDir}`; if (nextY >= 0 && nextY < height && nextX >= 0 && nextX < width && !wallSet.has(`${nextY},${nextX}`) && !visited.has(stateKey)) { visited.add(stateKey); queue.push({ pos: [nextY, nextX], dir: newDir, path: [...path, command] }); } } } return null; }

    // --- Start the game ---
    init();
});