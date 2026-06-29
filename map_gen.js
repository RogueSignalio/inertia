/**
 * Inertia Map Generator (Corrected with Bomb Verification)
 * Generates a solvable map for Simon Tatham's Inertia puzzle.
 * 
 * Legend:
 * '0' = Empty space
 * 'W' = Wall
 * 'B' = Bomb (Fatal obstacle)
 * 'P' = Player Start
 * 'S' = Stop Tile
 * 'D' = Diamond
 */

class InertiaMapGenerator {
    constructor(cfg={}) {
        this.width = cfg.columns || 32;
        this.height = cfg.rows || 32;
        this.diamondCount = cfg.diamonds || 8;
        this.bombCount = cfg.bombs || this.diamondCount * 2.5;
        this.diff_mod = cfg.diff_mod || 2;
        this.gen_tries = cfg.gen_tries || 30;
        this.wipe_solution = cfg.wipe_solution || false
        this.map = [];
        this.solution = [];
    }

    initGrid() {
        this.map = [];
        for (let y = 0; y < this.height; y++) {
            let row = [];
            for (let x = 0; x < this.width; x++) {
                if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
                    row.push('W');
                } else {
                    row.push('0');
                }
            }
            this.map.push(row);
        }
    }

    addWalls(density = 0.15) {
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                if (Math.random() < density && this.map[y][x] === '0') {
                    this.map[y][x] = 'W';
                }
            }
        }
    }

    placeStopTiles(count) {
        let placed = 0;
        while (placed < count) {
            let x = Math.floor(Math.random() * (this.width - 2)) + 1;
            let y = Math.floor(Math.random() * (this.height - 2)) + 1;
            if (this.map[y][x] === '0') {
                this.map[y][x] = 'S';
                placed++;
            }
        }
    }

    // Place Bombs randomly on empty spaces BEFORE solving
    placeBombs() {
        let placed = 0;
        let attempts = 0;
        while (placed < this.bombCount && attempts < 1000) {
            let x = Math.floor(Math.random() * (this.width - 2)) + 1;
            let y = Math.floor(Math.random() * (this.height - 2)) + 1;
            
            // Bombs only on empty space
            if (this.map[y][x] === '0') {
                this.map[y][x] = 'B';
                placed++;
            }
            attempts++;
        }
        if (placed < this.bombCount) {
            console.warn(`Warning: Only placed ${placed} of ${this.bombCount} bombs.`);
        }
    }

    // Simulation: Hitting a Bomb returns 'dead: true'
    simulateMove(startX, startY, dx, dy) {
        let x = startX;
        let y = startY;
        
        while (true) {
            let nextX = x + dx;
            let nextY = y + dy;
            let cell = this.map[nextY][nextX];

            if (cell === 'W') {
                if (x === startX && y === startY) return null; 
                return { x, y, landed: true, dead: false };
            }
            
            if (cell === 'B') {
                // Fatal: Hitting a bomb kills the player immediately
                return { x: nextX, y: nextY, landed: true, dead: true };
            }
            
            if (cell === 'S') {
                return { x: nextX, y: nextY, landed: true, dead: false };
            }

            x = nextX;
            y = nextY;
        }
    }

    // Get valid moves: Filters out ANY move that results in death
    getReachableNodes(startX, startY) {
        let moves = [];
        const directions = [
            { dx: 0, dy: -1, name: 'Up' }, { dx: 0, dy: 1, name: 'Down' },
            { dx: -1, dy: 0, name: 'Left' }, { dx: 1, dy: 0, name: 'Right' },
            { dx: -1, dy: -1, name: 'Up-Left' }, { dx: 1, dy: -1, name: 'Up-Right' },
            { dx: -1, dy: 1, name: 'Down-Left' }, { dx: 1, dy: 1, name: 'Down-Right' }
        ];

        for (let dir of directions) {
            let result = this.simulateMove(startX, startY, dir.dx, dir.dy);
            if (result && !result.dead) {
                // Only safe moves are returned
                moves.push({
                    from: { x: startX, y: startY },
                    to: { x: result.x, y: result.y },
                    dir: dir.name,
                    dx: dir.dx,
                    dy: dir.dy
                });
            }
        }
        return moves;
    }

    generateSolvableLayout() {
        let attempts = 0;
        while (attempts < 300) {
            this.initGrid();
            this.addWalls();
            this.placeStopTiles(Math.floor((this.width * this.height) / 20));
            this.placeBombs(); // Place bombs BEFORE solving

            let sx = Math.floor(Math.random() * (this.width - 2)) + 1;
            let sy = Math.floor(Math.random() * (this.height - 2)) + 1;
            
            // Ensure start is not on a bomb or wall
            if (this.map[sy][sx] !== '0') {
                attempts++;
                continue;
            }

            this.map[sy][sx] = 'P';
            let playerStart = { x: sx, y: sy };

            // BFS for reachability (ignoring deadly paths)
            let visited = new Set();
            let queue = [{ x: sx, y: sy }];
            let reachableCoords = [];
            visited.add(`${sx},${sy}`);
            reachableCoords.push({x: sx, y: sy});

            let head = 0;
            while(head < queue.length){
                let curr = queue[head++];
                let moves = this.getReachableNodes(curr.x, curr.y);
                for(let move of moves){
                    let key = `${move.to.x},${move.to.y}`;
                    if(!visited.has(key)){
                        visited.add(key);
                        reachableCoords.push(move.to);
                        queue.push(move.to);
                    }
                }
            }

            let validDiamondSpots = reachableCoords.filter(pos => 
                this.map[pos.y][pos.x] === '0' || this.map[pos.y][pos.x] === 'S'
            );

            if (validDiamondSpots.length >= this.diamondCount) {
                let diamonds = [];
                validDiamondSpots.sort(() => Math.random() - 0.5);
                
                for(let i=0; i<this.diamondCount; i++){
                    let spot = validDiamondSpots[i];
                    this.map[spot.y][spot.x] = 'D';
                    diamonds.push(spot);
                }

                // Solve with bombs present in the map
                let solutionPath = this.solveMap(playerStart, diamonds);
                if (solutionPath) {
                    this.solution = solutionPath;
                    if (this.solution.length < this.diamondCount * this.diff_mod) { return false; }
                    return true; // Success: Map is solvable with bombs
                }
            }
            attempts++;
        }
        return false;
    }

    solveMap(start, diamonds) {
        let diamondMap = {};
        diamonds.forEach((d, i) => {
            diamondMap[`${d.x},${d.y}`] = i;
        });
        let totalDiamonds = diamonds.length;
        let targetMask = (1 << totalDiamonds) - 1;

        let startMask = 0;
        if (diamondMap[`${start.x},${start.y}`] !== undefined) {
             startMask |= (1 << diamondMap[`${start.x},${start.y}`]);
        }

        let queue = [{ x: start.x, y: start.y, mask: startMask, path: [] }];
        let visited = new Set();
        visited.add(`${start.x},${start.y},${startMask}`);

        while (queue.length > 0) {
            let curr = queue.shift();

            if (curr.mask === targetMask) {
                return curr.path;
            }

            // getReachableNodes now automatically filters out bomb hits
            let moves = this.getReachableNodes(curr.x, curr.y);
            
            for (let move of moves) {
                let newMask = curr.mask;
                let key = `${move.to.x},${move.to.y}`;
                
                if (diamondMap[key] !== undefined) {
                    newMask |= (1 << diamondMap[key]);
                }

                let stateKey = `${move.to.x},${move.to.y},${newMask}`;
                if (!visited.has(stateKey)) {
                    visited.add(stateKey);
                    let newPath = [...curr.path, {
                        from: {x: curr.x, y: curr.y},
                        to: {x: move.to.x, y: move.to.y},
                        direction: move.dir
                    }];
                    queue.push({ x: move.to.x, y: move.to.y, mask: newMask, path: newPath });
                }
            }
        }
        return null;
    }

    generate() {
      let created = false;
      for (let i = 0; i < this.gen_tries ; i++) {
        if (this.generateSolvableLayout()) { created = true; break; }
      }

      if (created) {
        console.log(this.wipe_solution)
        if (this.wipe_solution) { this.solution = [] }
        console.log(this.solution)
        return { map: this.map, solution: this.solution };
      } else {
        throw new Error("Failed to generate a solvable map with bombs within attempt limits.");
      }
    }
}

// --- Usage Example ---

// const width = 20;
// const height = 15;
// const diamonds = 5;
// const bombs = 8; 

// const generator = new InertiaMapGenerator(width, height, diamonds, bombs);

// try {
//     const result = generator.generate();
    
//     console.log("Generated Map (Verified Solvable with Bombs):");
//     result.map.forEach(row => console.log(row.join(' ')));
    
//     console.log(`\nSolution Moves (${result.solution.length} steps):`);
//     result.solution.forEach((move, index) => {
//         console.log(`Move ${index + 1}: Slide ${move.direction} to (${move.to.x},${move.to.y})`);
//     });

// } catch (e) {
//     console.error(e.message);
// }   
