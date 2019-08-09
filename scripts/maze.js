"use strict";

let maze = [];
const mazeWidth = 32;
const mazeHeight = 32;
window.maze = maze;
window.mazeWidth = mazeWidth;
window.mazeHeight = mazeHeight;

// Generate maze
// This algorithm was the work of many physics lessons many years ago. I don't know if it's unique (probably not).
{
    // Put walls everywhere
    for (let x = 0; x < mazeWidth * 2 + 1; x++) {
        maze[x] = [];
        for (let y = 0; y < mazeHeight * 2 + 1; y++) {
            maze[x][y] = x % 2 === 1 && y % 2 === 1;
        }
    }

    // Entrance and exit
    maze[1][mazeHeight * 2] = true;
    maze[mazeWidth * 2 - 1][0] = true;

    // Actual maze generation
    let visited = [];
    for (let x = 0; x < mazeWidth; x++) {
        visited[x] = [];
        for (let y = 0; y < mazeHeight; y++) {
            visited[x][y] = false;
        }
    }
    let leftToVisit = mazeWidth * mazeHeight;

    const NORTH = 0, EAST = 1, SOUTH = 2, WEST = 3;
    const dx = [0, 1, 0, -1];
    const dy = [-1, 0, 1, 0];
    // maze generation parameters
    const turnChance = 0.25; // how often a path turns on average
    const forkChance = 0.15; // how often a path forks on average
    const deadEndChance = 0.02; // how often a path randomly stops

    let visit = function(x, y, dir) {
        if (!visited[x][y])
            leftToVisit--;
        visited[x][y] = true;

        // find available directions
        let availableDirs = [];
        if (y !== 0 && !visited[x][y-1])
            availableDirs.push(NORTH);
        if (x !== mazeWidth - 1 && !visited[x+1][y])
            availableDirs.push(EAST);
        if (y !== mazeHeight - 1 && !visited[x][y+1])
            availableDirs.push(SOUTH);
        if (x !== 0 && !visited[x-1][y])
            availableDirs.push(WEST);

        // give up if we're stuck, or if randomly a dead end
        if (availableDirs.length === 0 || Math.random() < deadEndChance)
            return;

        // decide nextDir, based on turnChance
        let nextDir;
        if (availableDirs.includes(dir)) {
            nextDir = dir;
            if (availableDirs.length > 1 && Math.random() < turnChance) {
                let index = Math.floor(Math.random() * (availableDirs.length - 1));
                if (index >= availableDirs.indexOf(dir))
                    index++;
                nextDir = availableDirs[index];
            }
        } else {
            nextDir = availableDirs[Math.floor(Math.random() * availableDirs.length)];
        }

        // break the pathway
        maze[x * 2 + 1 + dx[nextDir]][y * 2 + 1 + dy[nextDir]] = true;

        // recursively visit next spot
        visit(x + dx[nextDir], y + dy[nextDir], nextDir);

        // randomly fork based on forkChance (revisit = fork)
        if (Math.random() < forkChance)
            visit(x, y, dir);
    };

    // initial visit
    visit(Math.floor(Math.random() * mazeWidth), Math.floor(Math.random() * mazeHeight), Math.floor(Math.random() * 4));

    while (leftToVisit > 0) {
        // find a visited cell with an adjacent unvisited cell
        let found = false;
        do {
            let x = Math.floor(Math.random() * mazeWidth);
            let y = Math.floor(Math.random() * mazeHeight);
            if (visited[x][y]) {
                for (let dir = 0; dir < 4; dir++) {
                    if (dir === NORTH && y === 0) continue;
                    if (dir === EAST && x === mazeWidth - 1) continue;
                    if (dir === SOUTH && y === mazeHeight - 1) continue;
                    if (dir === WEST && x === 0) continue;
                    if (!visited[x + dx[dir]][y + dy[dir]]) {
                        visit(x, y, dir);
                        found = true;
                        break;
                    }
                }
            }
        } while (!found);
    }
}


let drawMaze = function(canvas) {
    let ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#F00BAA";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < mazeWidth * 2 + 1; x++) {
        for (let y = 0; y < mazeHeight * 2 + 1; y++) {
            if (!maze[x][y]) {
                if (x !== 0 && !maze[x-1][y]) {
                    ctx.moveTo(x * 8 + 4, y * 8 + 4);
                    ctx.lineTo(x * 8, y * 8 + 4);
                }
                if (y !== 0 && !maze[x][y-1]) {
                    ctx.moveTo(x * 8 + 4, y * 8 + 4);
                    ctx.lineTo(x * 8 + 4, y * 8);
                }
                if (x !== mazeWidth * 2 && !maze[x+1][y]) {
                    ctx.moveTo(x * 8 + 4, y * 8 + 4);
                    ctx.lineTo(x * 8 + 8, y * 8 + 4);
                }
                if (y !== mazeHeight * 2 && !maze[x][y+1]) {
                    ctx.moveTo(x * 8 + 4, y * 8 + 4);
                    ctx.lineTo(x * 8 + 4, y * 8 + 8);
                }
            }
        }
    }
    ctx.stroke();
};

window.onload = function() {
    drawMaze(document.getElementById("maze"))
};
