"use strict";

const MIN_STATES = 3;
const MAX_STATES = 8;
let fsm_container;
let colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white', 'black', 'lime', 'aqua'];
let foregroundColors = ['black', 'black', 'black', 'white', 'white', 'white', 'black', 'white', 'black', 'black'];

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
    try {
        output = parseInt(output);
    } catch (err) {
        return;
    }
    if (output < 0 || output > window.fsm.length)
        return;
    window.fsm[middle][left][right] = output;
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
    let width, maxHeight;
    try {
        width = parseInt(document.getElementById('width').value);
        if (width < 1)
            width = 1;
        if (width > 1000)
            width = 1000;
        maxHeight = parseInt(document.getElementById('height').value);
        if (maxHeight < 1)
            maxHeight = 1;
        if (maxHeight > 1000)
            maxHeight = 1000;
    } catch (err) {
        return;
    }
    let canvas = document.getElementById('output');
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2525';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let system = new Array(width);
    system.fill(0);
    system[0] = 1;
    let nextSystem = new Array(width);
    let y;
    let stop = false;
    for (y = 0; y < maxHeight && !stop; y++) {
        for (let x = 0; x < width; x++) {
            ctx.fillStyle = colors[system[x]];
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            if (system[x] === window.fsm.length)
                stop = true;
            else
                nextSystem[x] = window.fsm[system[x]][x === 0 ? window.fsm.length : system[x-1]][x === width - 1 ? window.fsm.length : system[x+1]];
        }
        let tmp = system;
        system = nextSystem;
        nextSystem = tmp;
    }
    ctx.fillStyle = 'black';
    ctx.beginPath();
    for (let line = 0; line <= y; line++) {
        ctx.moveTo(0, line * CELL_SIZE);
        ctx.lineTo(width * CELL_SIZE, line * CELL_SIZE);
    }
    for (let line = 0; line <= width; line++) {
        ctx.moveTo(line * CELL_SIZE, 0);
        ctx.lineTo(line * CELL_SIZE, y * CELL_SIZE);
    }
    ctx.stroke();
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
                if (fsm[middle][left][right] < 0 || fsm[middle][left][right] >= stateCount + 1)
                    throw new SyntaxError('Invalid dest state');
            }
        }
    }

    window.fsm = fsm;
    let html = '<table>' +
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
                        'onchange="window.setFsmValFromTextField('+left+','+middle+','+right+',this.value)" ' +
                    'value="' + window.fsm[middle][left][right] + '"></td>' +
                    '</tr>';
            }
        }
    }
    html += '</table>';
    fsm_container.innerHTML = html;
    let canvas = document.getElementById('output');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
};

let downloadFSM = function() {
    let data = JSON.stringify(window.fsm);
    let file = new Blob([data], {type: 'application/json'})
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

    loadFSM(window.fsm);
};
