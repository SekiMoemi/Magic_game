document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dom = {
        gameBoard: document.getElementById('game-board'),
        commandUi: document.getElementById('command-ui'),
        executeButton: document.getElementById('execute-button'),
        resetButton: document.getElementById('reset-button'),
        directionIndicator: document.getElementById('bird-direction-indicator'),
        birdElement: document.getElementById('bird'),
        tutorialOverlay: document.getElementById('tutorial-overlay'),
        tutorialCloseButton: document.getElementById('tutorial-close-button'),
        gameOverOverlay: document.getElementById('game-over-overlay'),
        gameOverMessage: document.getElementById('game-over-message'),
        retryButton: document.getElementById('retry-button'),
    };

    // --- Game Constants ---
    const GRID_SIZE = 5;
    const ANIMATION_STEP_DURATION = 500; // ms for one move
    const BIRD_SPRITES = { // Using emojis as placeholders for 8-direction sprites
        0: '🐦', 45: '🐦', 90: '🐦', 135: '🐦', 180: '🐦', 225: '🐦', 270: '🐦', 315: '🐦'
    };
    const DIRECTION_ARROWS = {0: '↑', 45: '↗', 90: '→', 135: '↘', 180: '↓', 225: '↙', 270: '←', 315: '↖'};

    // --- Game State ---
    const stage = {
        playerStartPos: { x: 2, y: 4 },
        enemyPos: { x: 2, y: 2 },
        wallPositions: [
            { x: 1, y: 1 }, { x: 3, y: 1 },
            { x: 0, y: 2 }, { x: 4, y: 2 },
            { x: 1, y: 4 }, { x: 3, y: 4 }
        ],
        initialCommands: ['forward', 'right45', 'right90', 'left45', 'left90']
    };

    let bird = { x: -1, y: -1, direction: 0 };
    let gridCells = [];
    let isExecuting = false;

    // --- Main Initialization ---
    initializeGame();

    /**
     * Sets up the entire game, board, and event listeners.
     */
    function initializeGame() {
        createBoard();
        setupEventListeners();
        resetGame();

        // Show tutorial on first visit
        if (!localStorage.getItem('hasVisited')) {
            dom.tutorialOverlay.classList.remove('hidden');
            localStorage.setItem('hasVisited', 'true');
        }
    }

    /**
     * Creates the grid cells and populates the game board.
     */
    function createBoard() {
        dom.gameBoard.innerHTML = ''; // Clear previous content
        dom.gameBoard.appendChild(dom.birdElement); // Re-append bird
        gridCells = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = document.createElement('div');
                cell.classList.add('grid-cell');
                cell.dataset.x = x;
                cell.dataset.y = y;
                dom.gameBoard.appendChild(cell);
                gridCells.push(cell);
            }
        }
    }

    /**
     * Centralized event listener setup.
     */
    function setupEventListeners() {
        dom.executeButton.addEventListener('click', executeCommands);
        dom.resetButton.addEventListener('click', resetGame);
        dom.retryButton.addEventListener('click', () => {
            dom.gameOverOverlay.classList.add('hidden');
            resetGame();
        });
        dom.tutorialCloseButton.addEventListener('click', () => {
            dom.tutorialOverlay.classList.add('hidden');
        });
        setupCommandDragAndDrop();
    }

    /**
     * Resets the game to its initial state for a new attempt.
     */
    function resetGame() {
        isExecuting = false;
        dom.executeButton.disabled = false;
        dom.gameOverOverlay.classList.add('hidden');

        // Reset visual elements
        gridCells.forEach(cell => {
            cell.className = 'grid-cell';
            cell.innerHTML = '';
        });
        
        stage.wallPositions.forEach(pos => getCell(pos.x, pos.y).classList.add('wall'));
        getCell(stage.playerStartPos.x, stage.playerStartPos.y).classList.add('player');
        getCell(stage.enemyPos.x, stage.enemyPos.y).classList.add('enemy');

        // Reset bird state and position
        bird.x = stage.playerStartPos.x;
        bird.y = stage.playerStartPos.y;
        bird.direction = 0; // Always start facing up
        
        dom.birdElement.className = '';
        dom.birdElement.style.opacity = 1;
        positionBirdOnGrid();
        updateDirectionIndicator();
        drawPreview();
    }

    /**
     * Positions the bird element on the grid based on its state.
     */
    function positionBirdOnGrid() {
        const cell = getCell(bird.x, bird.y);
        if (cell) {
            dom.birdElement.style.left = `${cell.offsetLeft}px`;
            dom.birdElement.style.top = `${cell.offsetTop}px`;
            dom.birdElement.style.transform = `rotate(${bird.direction}deg)`;
            dom.birdElement.innerText = BIRD_SPRITES[bird.direction] || '🐦';
        }
    }

    /**
     * Utility to get a cell element at specific coordinates.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {HTMLElement|null} The cell element or null if out of bounds.
     */
    function getCell(x, y) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return null;
        return gridCells[y * GRID_SIZE + x];
    }

    /**
     * Updates the direction indicator UI with the correct arrow and rotation.
     */
    function updateDirectionIndicator() {
        dom.directionIndicator.querySelector('p').textContent = DIRECTION_ARROWS[bird.direction] || '?';
        dom.directionIndicator.style.transform = `rotate(${bird.direction}deg)`;
    }

    /**
     * Sets up drag and drop functionality for command elements.
     */
    function setupCommandDragAndDrop() {
        const commandArrows = dom.commandUi.querySelectorAll('.command-arrow');
        let draggedItem = null;

        commandArrows.forEach(item => {
            item.addEventListener('dragstart', () => {
                draggedItem = item;
                setTimeout(() => item.classList.add('dragging'), 0);
            });

            item.addEventListener('dragend', () => {
                setTimeout(() => draggedItem.classList.remove('dragging'), 0);
                draggedItem = null;
                drawPreview();
            });
        });

        dom.commandUi.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(dom.commandUi, e.clientX);
            if (draggedItem) {
                if (afterElement == null) {
                    dom.commandUi.appendChild(draggedItem);
                } else {
                    dom.commandUi.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }

    function getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.command-arrow:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Draws the projected path of the bird based on the current command order.
     */
    function drawPreview() {
        document.querySelectorAll('.preview-dot').forEach(dot => dot.remove());

        let tempBird = { ...bird };
        const commands = [...dom.commandUi.querySelectorAll('.command-arrow')].map(el => el.dataset.command);

        for (const command of commands) {
            const { nextX, nextY } = calculateNextStep(tempBird, command);
            const cell = getCell(nextX, nextY);

            if (!cell || cell.classList.contains('wall')) {
                break; // Stop preview at a wall
            }

            tempBird.x = nextX;
            tempBird.y = nextY;
            tempBird.direction = calculateNewDirection(tempBird.direction, command);

            const dot = document.createElement('div');
            dot.classList.add('preview-dot');
            cell.appendChild(dot);

            if (cell.classList.contains('enemy')) {
                break; // Stop preview at the enemy
            }
        }
    }

    /**
     * Calculates the bird's new direction based on a command.
     * @param {number} currentDirection - The starting direction.
     * @param {string} command - The command to apply.
     * @returns {number} The new direction.
     */
    function calculateNewDirection(currentDirection, command) {
        switch (command) {
            case 'left90': return (currentDirection - 90 + 360) % 360;
            case 'left45': return (currentDirection - 45 + 360) % 360;
            case 'right45': return (currentDirection + 45) % 360;
            case 'right90': return (currentDirection + 90) % 360;
            default: return currentDirection;
        }
    }

    /**
     * Calculates the bird's next grid cell based on its state and a command.
     * @param {{x: number, y: number, direction: number}} currentBird - The bird's current state.
     * @param {string} command - The command to apply.
     * @returns {{nextX: number, nextY: number}} The coordinates of the next cell.
     */
    function calculateNextStep(currentBird, command) {
        const newDirection = calculateNewDirection(currentBird.direction, command);
        const rad = newDirection * Math.PI / 180;
        const nextX = currentBird.x + Math.round(Math.sin(rad));
        const nextY = currentBird.y - Math.round(Math.cos(rad));
        return { nextX, nextY };
    }

    /**
     * Executes the entire command sequence with animations.
     */
    async function executeCommands() {
        if (isExecuting) return;
        isExecuting = true;
        dom.executeButton.disabled = true;
        document.querySelectorAll('.preview-dot').forEach(dot => dot.remove());

        const commands = [...dom.commandUi.querySelectorAll('.command-arrow')].map(el => el.dataset.command);

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
        handleFailure('end'); // Finished commands without reaching the enemy
    }

    /**
     * Executes a single command step with animation.
     * @param {string} command - The command to execute.
     * @returns {Promise<{success: boolean, hitEnemy?: boolean}>}
     */
    function executeSingleCommand(command) {
        return new Promise(resolve => {
            // 1. Rotate
            bird.direction = calculateNewDirection(bird.direction, command);
            dom.birdElement.style.transform = `rotate(${bird.direction}deg)`;
            dom.birdElement.innerText = BIRD_SPRITES[bird.direction] || '🐦';
            updateDirectionIndicator();

            // 2. Move after a delay
            setTimeout(() => {
                const { nextX, nextY } = calculateNextStep({ ...bird, direction: bird.direction }, 'forward'); // Move forward in the new direction
                const nextCell = getCell(nextX, nextY);

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

    /**
     * Handles the successful completion of the level.
     */
    function handleSuccess() {
        const enemyCell = getCell(stage.enemyPos.x, stage.enemyPos.y);
        const explosion = document.createElement('div');
        explosion.classList.add('explosion');
        enemyCell.appendChild(explosion);

        setTimeout(() => {
            enemyCell.classList.remove('enemy');
            dom.birdElement.style.opacity = 0;
            showGameOverModal('クリア！お見事です！');
        }, 400);
    }

    /**
     * Handles any failure condition.
     * @param {string} reason - The cause of the failure ('wall' or 'end').
     */
    function handleFailure(reason) {
        if (reason === 'wall') {
            dom.birdElement.classList.add('puff');
        }
        getCell(stage.playerStartPos.x, stage.playerStartPos.y).classList.add('fail');
        
        const message = reason === 'wall' ? '失敗！壁に衝突しました。' : '失敗！敵に届きませんでした。';
        
        setTimeout(() => {
            showGameOverModal(message);
        }, 1000);
    }

    /**
     * Displays the game over/success modal.
     * @param {string} message - The message to display.
     */
    function showGameOverModal(message) {
        dom.gameOverMessage.textContent = message;
        dom.gameOverOverlay.classList.remove('hidden');
    }

});
