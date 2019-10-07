"use strict";

const MIN_STATES = 3;
const MAX_STATES = 8;
let fsm_container;
let colors = ['red', 'cyan', 'blue', 'yellow', 'green', 'magenta', 'lime', 'brown', 'black', 'white'];
let foregroundColors = ['white', 'black', 'white', 'black', 'white', 'black', 'white', 'black', 'white', 'black'];
let dirty = false;
window.focusedRule = null;

let makeArray = function(length) {
    let arr = new Array(length || 0), i = length;
    arr.fill(0);

    if (arguments.length > 1) {
        let args = Array.prototype.slice.call(arguments, 1);
        while (i--) arr[length - 1 - i] = makeArray.apply(this, args);
    }

    return arr;
};

window.fsm = makeArray(MIN_STATES, MIN_STATES+1, MIN_STATES+1);

window.setFsmValFromTextField = function(left, middle, right, output) {
    if (output === '') {
        output = -1;
    } else {
        try {
            output = parseInt(output);
        } catch (err) {
            return;
        }
        if (output < 0 || output > window.fsm.length)
            return;
    }
    window.fsm[middle][left][right] = output;

    simulate();

    dirty = true;
};

let addFsmState = function() {
    if (window.fsm.length === MAX_STATES)
        return;
    window.fsm[window.fsm.length] = makeArray(window.fsm.length + 1, window.fsm.length + 1);
    for (let middle = 0; middle < window.fsm.length; middle++) {
        window.fsm[middle].splice(window.fsm.length - 1, 0, makeArray(window.fsm.length));
        for (let left = 0; left <= window.fsm.length; left++) {
            window.fsm[middle][left].splice(window.fsm.length - 1, 0, 0);
        }
    }
    for (let middle = 0; middle < window.fsm.length; middle++) {
        for (let left = 0; left <= window.fsm.length; left++) {
            for (let right = 0; right <= window.fsm.length; right++) {
                if (window.fsm[middle][left][right] === window.fsm.length - 1)
                    window.fsm[middle][left][right]++;
            }
        }
    }
    loadFSM(window.fsm);
};

let removeFsmState = function() {
    if (window.fsm.length === MIN_STATES)
        return;
    if (!window.confirm('Are you sure? This can lose data.'))
        return;

    window.fsm.pop();
    for (let middle = 0; middle < window.fsm.length; middle++) {
        window.fsm[middle].splice(window.fsm.length, 1);
        for (let left = 0; left <= window.fsm.length; left++) {
            window.fsm[middle][left].splice(window.fsm.length, 1);
        }
    }
    for (let middle = 0; middle < window.fsm.length; middle++) {
        for (let left = 0; left <= window.fsm.length; left++) {
            for (let right = 0; right <= window.fsm.length; right++) {
                if (window.fsm[middle][left][right] === window.fsm.length + 1)
                    window.fsm[middle][left][right]--;
            }
        }
    }
    loadFSM(window.fsm);
};

let simulate = function() {
    const CELL_SIZE = 16;
    let widths;
    try {
        widths = document.getElementById('width').value.split(/\s*[\s,;]\s*/);
        for (let i = 0; i < widths.length; i++) {
            widths[i] = parseInt(widths[i]);
            if (widths[i] < 1)
                widths[i] = 1;
            if (widths[i] > 1000)
                widths[i] = 1000;
        }
        if (widths.length > 3)
            widths = widths.slice(0, 3);
    } catch (err) {
        return;
    }
    let canvas = document.getElementById('output');
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2525';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let simX = 0;
    for (let sim = 0; sim < widths.length; sim++) {
        let width = widths[sim];
        let grid = doSimulate(width, applyRule);

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < width; x++) {
                if (grid[y][x] !== -1) {
                    ctx.fillStyle = colors[grid[y][x]];
                    ctx.fillRect(simX + x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

                    if (y !== 0 && window.focusedRule && window.focusedRule.left === (x === 0 ? -1 : grid[y-1][x-1]) && window.focusedRule.middle === grid[y-1][x] && window.focusedRule.right === (x === width - 1 ? -1 : grid[y-1][x+1])) {
                        if (x !== 0) {
                            ctx.beginPath();
                            ctx.strokeStyle = foregroundColors[grid[y-1][x-1]];
                            ctx.rect(simX + (x-1) * CELL_SIZE + 2, (y-1) * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                            ctx.stroke();
                        }
                        ctx.beginPath();
                        ctx.strokeStyle = foregroundColors[grid[y-1][x]];
                        ctx.rect(simX + x * CELL_SIZE + 2, (y-1) * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                        ctx.stroke();
                        if (x !== width - 1) {
                            ctx.beginPath();
                            ctx.strokeStyle = foregroundColors[grid[y-1][x+1]];
                            ctx.rect(simX + (x+1) * CELL_SIZE + 2, (y-1) * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                            ctx.stroke();
                        }
                    }
                }
            }
        }
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        for (let line = 0; line <= grid.length; line++) {
            ctx.moveTo(simX, line * CELL_SIZE);
            ctx.lineTo(simX + width * CELL_SIZE, line * CELL_SIZE);
        }
        for (let line = 0; line <= width; line++) {
            ctx.moveTo(simX + line * CELL_SIZE, 0);
            ctx.lineTo(simX + line * CELL_SIZE, grid.length * CELL_SIZE);
        }
        ctx.stroke();

        simX += (width + 1) * CELL_SIZE;
    }
};

let applyRule = function(left, middle, right) {
    return window.fsm[middle][left][right];
};

let doSimulate = function(width, ruleFunction) {
    let maxHeight;
    try {
        maxHeight = parseInt(document.getElementById('height').value);
        if (maxHeight < 1)
            maxHeight = 1;
        if (maxHeight > 1000)
            maxHeight = 1000;
    } catch (err) {
        return [];
    }

    let grid = [];
    let system = new Array(width);
    system.fill(0);
    system[0] = 1;
    grid.push(system);

    for (let y = 0; y < maxHeight; y++) {
        system = new Array(width);
        let stop = false;
        for (let x = 0; x < width; x++) {
            let val = ruleFunction(x === 0 ? window.fsm.length : grid[y][x-1], grid[y][x], x === width - 1 ? window.fsm.length : grid[y][x+1]);
            system[x] = val;
            if (val === window.fsm.length || val === -1)
                stop = true;
        }
        grid.push(system);
        if (stop)
            break;
    }

    return grid;
};

let loadFSM = function(fsm) {
    if (!(fsm instanceof Array))
        throw new SyntaxError('Expected array');
    let stateCount = fsm.length;
    if (stateCount < MIN_STATES || stateCount > MAX_STATES)
        throw new SyntaxError('Invalid number of states');
    for (let middle = 0; middle < stateCount; middle++) {
        if (!(fsm[middle] instanceof Array))
            throw new SyntaxError('Expected array');
        if (fsm[middle].length !== stateCount + 1)
            throw new SyntaxError('Invalid table size');
        for (let left = 0; left <= stateCount; left++) {
            if (!(fsm[middle][left] instanceof Array))
                throw new SyntaxError('Expected array');
            if (fsm[middle][left].length !== stateCount + 1)
                throw new SyntaxError('Invalid table size');
            for (let right = 0; right <= stateCount; right++) {
                if (typeof(fsm[middle][left][right]) !== 'number')
                    throw new SyntaxError('Expected number');
                if (!Number.isInteger(fsm[middle][left][right]))
                    throw new SyntaxError('Expected integer');
                if (fsm[middle][left][right] < -1 || fsm[middle][left][right] >= stateCount + 1)
                    throw new SyntaxError('Invalid dest state');
            }
        }
    }

    window.fsm = fsm;
    refreshHTML();
};

let refreshHTML = function() {
    let stateCount = window.fsm.length;
    let fsm_layout = document.getElementById('fsm_layout');
    let html;
    if (fsm_layout.value === 'matrix') {
        html = '';
        for (let middle = 0; middle < stateCount; middle++) {
            if (middle !== 0)
                html += '<br/>';
            html += '<table>' +
                '<tr><th style="background:' + colors[middle] + ';color:' + foregroundColors[middle] + '">' + middle + '</th><th colspan="' + (stateCount + 2) + '">Right</th></tr>' +
                '<tr><th rowspan="' + (stateCount + 2) + '">Left</th>' +
                    '<th></th>';
            for (let right = 0; right < stateCount; right++) {
                html += '<td style="background:' + colors[right] + ';color:' + foregroundColors[right] + '">' + right + '</td>';
            }
            html += '<td style="background:white;color:black">x</td></tr>';
            for (let left = 0; left <= stateCount; left++) {
                html += '<tr>';
                if (left === stateCount)
                    html += '<td style="background:white;color:black">x</td>';
                else
                    html += '<td style="background:' + colors[left] + ';color:' + foregroundColors[left] + '">' + left + '</td>';
                for (let right = 0; right <= stateCount; right++) {
                    html += '<td><input type="number" min="0" max="' + stateCount + '" ' +
                        'oninput="window.setFsmValFromTextField(' + left + ',' + middle + ',' + right + ',this.value)" ' +
                        'onfocus="window.focusedRule = {left: ' + left + ', middle: ' + middle + ', right: ' + right + '}; simulate();" ' +
                        'onblur="window.focusedRule = null; simulate();" ' +
                        'value="' + (window.fsm[middle][left][right] === -1 ? '' : window.fsm[middle][left][right]) + '" ' +
                        'style="width:64px"></td>'
                }
                html += '</tr>';
            }
            html += '</table>';
        }
    } else if (fsm_layout.value === 'list') {
        html = '<table>' +
            '<tr><th>Left</th><th>Middle</th><th>Right</th><th>Output</th></tr>';
        for (let left = 0; left <= stateCount; left++) {
            for (let middle = 0; middle < stateCount; middle++) {
                for (let right = 0; right <= stateCount; right++) {
                    html += '<tr>' +
                        '<td style="background:' + (left === stateCount ? 'white' : colors[left]) + ';color:' + (left === stateCount ? 'black' : foregroundColors[left]) + '">' +
                        (left === stateCount ? 'x' : left) + '</td>' +
                        '<td style="background:' + colors[middle] + ';color:' + foregroundColors[middle] + '">' + middle + '</td>' +
                        '<td style="background:' + (right === stateCount ? 'white' : colors[right]) + ';color:' + (right === stateCount ? 'black' : foregroundColors[right]) + '">' +
                        (right === stateCount ? 'x' : right) + '</td>' +
                        '<td><input type="number" min="0" max="' + stateCount + '" ' +
                        'oninput="window.setFsmValFromTextField(' + left + ',' + middle + ',' + right + ',this.value)" ' +
                        'onfocus="window.focusedRule = {left: ' + left + ', middle: ' + middle + ', right: ' + right + '}; simulate();" ' +
                        'onblur="window.focusedRule = null; simulate();" ' +
                        'value="' + (window.fsm[middle][left][right] === -1 ? '' : window.fsm[middle][left][right]) + '"></td>' +
                        '</tr>';
                }
            }
        }
        html += '</table>';
    }
    fsm_container.innerHTML = html;
    let canvas = document.getElementById('output');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
};

let downloadFSM = function() {
    let data = JSON.stringify(window.fsm);
    let file = new Blob([data], {type: 'application/json'});
    if (window.navigator.msSaveOrOpenBlob)
        window.navigator.msSaveOrOpenBlob(file, 'fsm.json');
    else {
        let a = document.createElement('a');
        let url = URL.createObjectURL(file);
        a.href = url;
        a.download = 'fsm.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
    dirty = false;
};

let removeRedundantRules = function() {
    let ruleUsed = makeArray(window.fsm.length, window.fsm.length+1, window.fsm.length+1);
    for (let width = 2; width <= 32; width++) {
        doSimulate(width, function(left, middle, right) {
            ruleUsed[middle][left][right] = true;
            return applyRule(left, middle, right);
        });
    }
    for (let middle = 0; middle < window.fsm.length; middle++) {
        for (let left = 0; left <= window.fsm.length; left++) {
            for (let right = 0; right <= window.fsm.length; right++) {
                if (!ruleUsed[middle][left][right]) {
                    window.fsm[middle][left][right] = -1;
                    dirty = true;
                }
            }
        }
    }
    refreshHTML();
};

window.onload = function() {
    fsm_container = document.getElementById('fsm');

    let upload = document.getElementById('upload');
    upload.addEventListener('change', function (event) {
        let file = event.target.files[0];
        if (file) {
            let reader = new FileReader();
            reader.onload = function(event) {
                try {
                    let fsm = JSON.parse(event.target.result);
                    loadFSM(fsm);
                } catch (err) {
                    fsm_container.innerHTML = 'Couldn\'t load FSM file';
                }
            };
            reader.readAsText(file);
        }
    });

    let fsm_layout = document.getElementById('fsm_layout');
    fsm_layout.addEventListener('change', function (event) {
        refreshHTML();
    });

    let add_state = document.getElementById('add_state');
    add_state.addEventListener('click', function(event) {
        addFsmState();
    });
    let remove_state = document.getElementById('remove_state');
    remove_state.addEventListener('click', function (event) {
        removeFsmState();
    });
    let simulateBtn = document.getElementById('simulate');
    simulateBtn.addEventListener('click', function (event) {
        simulate();
    });

    let downloadBtn = document.getElementById('download');
    downloadBtn.addEventListener('click', function (event) {
        downloadFSM();
    });

    let removeRedundantStatesBtn = document.getElementById('remove_redundant');
    removeRedundantStatesBtn.addEventListener('click', function(event) {
        removeRedundantRules();
    });

    loadFSM(window.fsm);

    window.addEventListener('beforeunload', function (event) {
        if (!dirty)
            return undefined;
        let message = 'Are you sure you want to close this page? You have unsaved changes that will be lost.';
        (event || window.event).returnValue = message;
        return message;
    });
};
