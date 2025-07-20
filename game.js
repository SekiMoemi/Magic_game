document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dom = {
        stageTitle: document.getElementById('stage-title'),
        gameBoard: document.getElementById('game-board'),
        commandStock: document.getElementById('command-stock'),
        commandSlots: document.getElementById('command-slots'),
        executeButton: document.getElementById('execute-button'),
        resetButton: document.getElementById('reset-button'),
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
    const ANIMATION_STEP_DURATION = 500; // ms for one move
    const COMMAND_MAP = {
        'UP': { symbol: '↑', type: 'forward' },
        'RIGHT45': { symbol: '↗', type: 'right45' },
        'RIGHT90': { symbol: '→', type: 'right90' },
        'LEFT45': { symbol: '↖', type: 'left45' },
        'LEFT90': { symbol: '←', type: 'left90' },
    };

    // --- Stage Data ---
    const STAGES = [
        {
            id: 1,
            name: "はじまりの道",
            gridSize: [5, 5],
            initialWizardPos: [4, 2], // [row, col]
            initialBirdDirection: 0, // 0=Up
            enemyPos: [1, 2],
            wallPositions: [], // No walls for the first stage
            availableCommands: ['UP', 'UP', 'UP', 'RIGHT90'], // Provide one extra command
            commandSlotCount: 3,
            // Solution: ['UP', 'UP', 'UP']
        },
        {
            id: 2,
            name: "斜め移動の試練",
            gridSize: [5, 5],
            initialWizardPos: [4, 0],
            initialBirdDirection: 0,
            enemyPos: [0, 4],
            // Walls are placed to block direct paths and force a specific route.
            wallPositions: [[3, 1], [2, 3], [0, 2], [2, 0]],
            availableCommands: ['UP', 'UP', 'UP', 'RIGHT45', 'RIGHT45', 'LEFT90'],
            commandSlotCount: 5,
            // Solution: ['UP', 'RIGHT45', 'UP', 'RIGHT45', 'UP']
        }
    ];

    // --- Game State ---
    let currentStageIndex = 0;
    let bird = { x: 0, y: 0, direction: 0 };
    let gridCells = [];
    let isExecuting = false;
    let draggedItem = null;

    // --- Main Initialization ---
    function init() {
        setupEventListeners();
        loadStage(currentStageIndex);

        if (!localStorage.getItem('hasVisited-v2.2')) { // Updated version key
            dom.tutorialOverlay.classList.remove('hidden');
            localStorage.setItem('hasVisited-v2.2', 'true');
        }
    }

    /**
     * Loads a specific stage by its index.
     * @param {number} stageIndex - The index of the stage to load.
     */
    function loadStage(stageIndex) {
        if (stageIndex >= STAGES.length) {
            showGameOverModal("すべてのステージをクリアしました！おめでとう！", false);
            dom.nextStageButton.classList.add('hidden');
            return;
        }
        currentStageIndex = stageIndex;
        const stage = STAGES[currentStageIndex];

        isExecuting = false;
        dom.executeButton.disabled = false;
        dom.gameOverOverlay.classList.add('hidden');
        dom.stageTitle.textContent = `ステージ ${stage.id}: ${stage.name}`;

        createBoard(stage.gridSize);
        populateBoard(stage);
        createCommandUI(stage.availableCommands, stage.commandSlotCount);
        
        resetBirdState(stage);
        drawPreview();
    }

    /**
     * Creates the grid dynamically.
     * @param {number[]} gridSize - An array [width, height].
     */
    function createBoard([width, height]) {
        dom.gameBoard.innerHTML = '';
        dom.gameBoard.appendChild(dom.birdElement);
        dom.gameBoard.style.gridTemplateColumns = `repeat(${width}, 60px)`;
        dom.gameBoard.style.gridTemplateRows = `repeat(${height}, 60px)`;
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

    /**
     * Places player, enemy, and walls on the board.
     * @param {object} stage - The current stage data.
     */
    function populateBoard(stage) {
        const getCell = (r, c) => getCellByCoords(r, c);
        getCell(stage.initialWizardPos[0], stage.initialWizardPos[1]).classList.add('player');
        getCell(stage.enemyPos[0], stage.enemyPos[1]).classList.add('enemy');
        stage.wallPositions.forEach(([r, c]) => getCell(r, c).classList.add('wall'));
    }

    /**
     * Creates the command stock and empty slots.
     * @param {string[]} commands - Array of available command types.
     * @param {number} slotCount - Number of command slots to create.
     */
    function createCommandUI(commands, slotCount) {
        dom.commandStock.innerHTML = '';
        dom.commandSlots.innerHTML = '';

        commands.forEach(cmdKey => {
            const commandEl = createCommandElement(cmdKey);
            dom.commandStock.appendChild(commandEl);
        });

        for (let i = 0; i < slotCount; i++) {
            const slotEl = document.createElement('div');
            slotEl.classList.add('command-slot');
            dom.commandSlots.appendChild(slotEl);
        }
    }
    
    /**
     * Resets the bird's state and visual position.
     * @param {object} stage - The current stage data.
     */
    function resetBirdState(stage) {
        const [row, col] = stage.initialWizardPos;
        bird.x = col;
        bird.y = row;
        bird.direction = stage.initialBirdDirection;
        
        dom.birdElement.className = '';
        dom.birdElement.style.opacity = 1;
        positionBirdOnGrid();
        updateDirectionIndicator();
    }

    /**
     * Centralized event listener setup.
     */
    function setupEventListeners() {
        dom.executeButton.addEventListener('click', executeCommands);
        dom.resetButton.addEventListener('click', () => loadStage(currentStageIndex));
        dom.retryButtonModal.addEventListener('click', () => loadStage(currentStageIndex));
        dom.nextStageButton.addEventListener('click', () => loadStage(currentStageIndex + 1));
        dom.tutorialCloseButton.addEventListener('click', () => dom.tutorialOverlay.classList.add('hidden'));
        
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('dragend', handleDragEnd);
        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('dragenter', handleDragEnter);
        document.addEventListener('dragleave', handleDragLeave);
        document.addEventListener('drop', handleDrop);
    }

    // --- Drag and Drop Handlers ---
    function handleDragStart(e) {
        if (e.target.classList.contains('command-arrow')) {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    }

    function handleDragEnd() {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            document.querySelectorAll('.over').forEach(el => el.classList.remove('over'));
            drawPreview();
        }
    }

    function handleDragOver(e) { e.preventDefault(); }

    function handleDragEnter(e) {
        const dropZone = e.target.closest('.command-slot, #command-stock');
        if (dropZone) dropZone.classList.add('over');
    }

    function handleDragLeave(e) {
        const dropZone = e.target.closest('.command-slot, #command-stock');
        if (dropZone) dropZone.classList.remove('over');
    }

    function handleDrop(e) {
        e.preventDefault();
        if (!draggedItem) return;

        const dropZone = e.target.closest('#command-slots, #command-stock');
        if (!dropZone) return;

        if (dropZone.id === 'command-slots') {
            const slot = e.target.closest('.command-slot');
            if (slot) {
                if (slot.children.length === 0) {
                    slot.appendChild(draggedItem);
                } else {
                    const existingCommand = slot.children[0];
                    draggedItem.parentElement.appendChild(existingCommand);
                    slot.appendChild(draggedItem);
                }
            }
        } else if (dropZone.id === 'command-stock') {
            dropZone.appendChild(draggedItem);
        }
    }

    /**
     * Creates a draggable command element.
     * @param {string} cmdKey - The key of the command (e.g., 'UP').
     * @returns {HTMLElement} The created command element.
     */
    function createCommandElement(cmdKey) {
        const command = COMMAND_MAP[cmdKey];
        const el = document.createElement('div');
        el.classList.add('command-arrow');
        el.dataset.command = command.type;
        el.textContent = command.symbol;
        el.draggable = true;
        return el;
    }

    /**
     * Draws the projected path of the bird.
     */
    function drawPreview() {
        document.querySelectorAll('.preview-dot').forEach(dot => dot.remove());
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

    /**
     * Executes the command sequence with animations.
     */
    async function executeCommands() {
        if (isExecuting) return;
        const commands = [...dom.commandSlots.querySelectorAll('.command-arrow')].map(el => el.dataset.command);
        if (commands.length === 0) return;

        isExecuting = true;
        dom.executeButton.disabled = true;
        dom.resetButton.disabled = true;
        document.querySelectorAll('.preview-dot').forEach(dot => dot.remove());

        for (const command of commands) {
            const result = await executeSingleCommand(command);
            if (!result.success) {
                handleFailure('wall');
                return;
            }
            if (result.hitEnemy) {
                handleSuccess();
                return;
            }
        }
        handleFailure('end');
    }

    /**
     * Executes one command step with animation.
     * @param {string} commandType - The type of command to execute.
     * @returns {Promise<{success: boolean, hitEnemy?: boolean}>}
     */
    function executeSingleCommand(commandType) {
        return new Promise(resolve => {
            bird.direction = calculateNewDirection(bird.direction, commandType);
            positionBirdOnGrid();
            updateDirectionIndicator();

            setTimeout(() => {
                const { nextX, nextY } = calculateNextPosition(bird.x, bird.y, bird.direction);
                const nextCell = getCellByCoords(nextY, nextX);

                if (!nextCell || nextCell.classList.contains('wall')) {
                    resolve({ success: false });
                    return;
                }

                bird.x = nextX;
                bird.y = nextY;
                positionBirdOnGrid();

                const hitEnemy = nextCell.classList.contains('enemy');
                resolve({ success: true, hitEnemy });
            }, ANIMATION_STEP_DURATION / 2);
        });
    }

    // --- Game Logic Calculations ---
    const calculateNewDirection = (dir, cmd) => (({ 'forward': 0, 'left90': -90, 'left45': -45, 'right45': 45, 'right90': 90 }[cmd] || 0) + dir + 360) % 360;

    function calculateNextPosition(x, y, direction) {
        const rad = direction * Math.PI / 180;
        return { nextX: x + Math.round(Math.sin(rad)), nextY: y - Math.round(Math.cos(rad)) };
    }

    // --- Visual Updates ---
    function positionBirdOnGrid() {
        const cell = getCellByCoords(bird.y, bird.x);
        if (cell) {
            dom.birdElement.style.left = `${cell.offsetLeft}px`;
            dom.birdElement.style.top = `${cell.offsetTop}px`;
            dom.birdElement.style.transform = `rotate(${bird.direction}deg)`;
        }
    }

    function updateDirectionIndicator() {
        dom.directionIndicator.style.transform = `rotate(${bird.direction}deg)`;
    }

    // --- Game End Handlers ---
    function handleSuccess() {
        const stage = STAGES[currentStageIndex];
        const enemyCell = getCellByCoords(stage.enemyPos[0], stage.enemyPos[1]);
        const explosion = document.createElement('div');
        explosion.classList.add('explosion');
        enemyCell.appendChild(explosion);

        setTimeout(() => {
            enemyCell.classList.remove('enemy');
            dom.birdElement.style.opacity = 0;
            showGameOverModal("クリア！お見事です！", true);
        }, 400);
    }

    function handleFailure(reason) {
        if (reason === 'wall') dom.birdElement.classList.add('puff');
        
        const stage = STAGES[currentStageIndex];
        getCellByCoords(stage.initialWizardPos[0], stage.initialWizardPos[1]).classList.add('fail');
        
        const message = reason === 'wall' ? '失敗！壁に衝突しました。' : '失敗！敵に届きませんでした。';
        setTimeout(() => showGameOverModal(message, false), 1000);
    }

    function showGameOverModal(message, isSuccess) {
        dom.gameOverMessage.textContent = message;
        dom.nextStageButton.classList.toggle('hidden', !isSuccess || currentStageIndex >= STAGES.length - 1);
        dom.gameOverOverlay.classList.remove('hidden');
        dom.resetButton.disabled = false;
    }

    // --- Utility Functions ---
    function getCellByCoords(row, col) {
        const stage = STAGES[currentStageIndex];
        const [width, height] = stage.gridSize; // Note: width, height order
        if (col < 0 || col >= width || row < 0 || row >= height) return null;
        return gridCells[row * width + col];
    }

    // --- Start the game ---
    init();
});
