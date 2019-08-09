"use strict";

var maze = [];
var mazeWidth = 32;
var mazeHeight = 32;

// Generate maze
{
    // Put walls everywhere
    for (var x = 0; x < mazeWidth * 2 + 1; x++) {
        maze[x] = [];
        for (var y = 0; y < mazeHeight * 2 + 1; y++) {
            maze[x][y] = x % 2 == 1 && y % 2 == 1;
        }
    }

    // Entrance and exit
    maze[1][mazeHeight * 2] = true;
    maze[mazeWidth * 2 - 1][0] = true;

    // Randomized Prim's from a random starting position
    var processedTiles = new Set();
    var nextTilesSet = new Set();
    var nextTiles = [{x: Math.floor(Math.random() * mazeWidth), y: Math.floor(Math.random() * mazeHeight)}];
    nextTilesSet.add(JSON.stringify(nextTiles[0]));

    while (nextTiles.length != 0) {
        var index = Math.floor(Math.random() * nextTiles.length);
        var curTile = nextTiles[index];
        nextTiles.splice(index, 1);
        nextTilesSet.delete(JSON.stringify(curTile));

        var possibleAttachments = [];

        if (curTile.x != 0)
            possibleAttachments.push({x: curTile.x - 1, y: curTile.y});
        if (curTile.y != 0)
            possibleAttachments.push({x: curTile.x, y: curTile.y - 1});
        if (curTile.x != mazeWidth - 1)
            possibleAttachments.push({x: curTile.x + 1, y: curTile.y});
        if (curTile.y != mazeHeight - 1)
            possibleAttachments.push({x: curTile.x, y: curTile.y + 1});

        for (var i = 0; i < possibleAttachments.length; i++) {
            if (!processedTiles.has(JSON.stringify(possibleAttachments[i]))) {
                if (!nextTilesSet.has(JSON.stringify(possibleAttachments[i]))) {
                    nextTiles.push(possibleAttachments[i]);
                    nextTilesSet.add(JSON.stringify(possibleAttachments[i]));
                }
                possibleAttachments.splice(i, 1);
                i--;
            }
        }

        if (possibleAttachments.length != 0) {
            var adjTile = possibleAttachments[Math.floor(Math.random() * possibleAttachments.length)];
            maze[((curTile.x * 2 + 1) + (adjTile.x * 2 + 1)) / 2][((curTile.y * 2 + 1) + (adjTile.y * 2 + 1)) / 2] = true;
        }

        processedTiles.add(JSON.stringify(curTile));
    }
}


var drawMaze = function(canvas) {
    var ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#F00BAA";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x < mazeWidth * 2 + 1; x++) {
        for (var y = 0; y < mazeHeight * 2 + 1; y++) {
            if (!maze[x][y]) {
                if (x != 0 && !maze[x-1][y]) {
                    ctx.moveTo(x * 8 + 4, y * 8 + 4);
                    ctx.lineTo(x * 8, y * 8 + 4);
                }
                if (y != 0 && !maze[x][y-1]) {
                    ctx.moveTo(x * 8 + 4, y * 8 + 4);
                    ctx.lineTo(x * 8 + 4, y * 8);
                }
                if (x != mazeWidth * 2 && !maze[x+1][y]) {
                    ctx.moveTo(x * 8 + 4, y * 8 + 4);
                    ctx.lineTo(x * 8 + 8, y * 8 + 4);
                }
                if (y != mazeHeight * 2 && !maze[x][y+1]) {
                    ctx.moveTo(x * 8 + 4, y * 8 + 4);
                    ctx.lineTo(x * 8 + 4, y * 8 + 8);
                }
            }
        }
    }
    ctx.stroke();
}

window.onload = function() {
    drawMaze(document.getElementById("maze"))
}
