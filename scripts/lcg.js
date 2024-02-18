
const parseValue = function(elementId, displayName) {
    const str = document.getElementById(elementId).value.toLowerCase();
    try {
        return BigInt(str);
    } catch (e) {
        document.getElementById('output').innerHTML = '<span class="error">Invalid ' + (displayName || elementId) + '</span>';
        return null;
    }
}

const toDecAndHexString = function(value) {
    if (typeof(value) === 'bigint') {
        return value.toString() + ' (0x' + value.toString(16) + ')'
    } else {
        return value;
    }
}

const lcgCombine = function(lcg, n) {
    n %= lcg.modulus;
    if (n < 0n) n += lcg.modulus;
    
    const powerLcg = Object.assign({}, lcg);
    const newLcg = {'multiplier': 1n, 'addend': 0n, 'modulus': lcg.modulus};
    // a*(c*x+d)+b = (a*c)*x + (a*d + b)
    for (let mask = 1n; mask <= n; mask <<= 1n) {
        if ((n & mask) !== 0n) {
            newLcg.addend = (newLcg.addend * powerLcg.multiplier + powerLcg.addend) % lcg.modulus;
            newLcg.multiplier = (newLcg.multiplier * powerLcg.multiplier) % lcg.modulus;
        }
	powerLcg.addend = (powerLcg.addend * powerLcg.multiplier + powerLcg.addend) % lcg.modulus;
        powerLcg.multiplier = (powerLcg.multiplier * powerLcg.multiplier) % lcg.modulus;
    }
    return newLcg;
}

const nextSeed = function(lcg) {
    const seed = parseValue('advanceinput-seed', 'seed');
    if (seed === null) return null;
    const amount = parseValue('advanceinput-amount', 'amount');
    if (amount === null) return null;
    const combinedLcg = lcgCombine(lcg, amount);
    return (seed * combinedLcg.multiplier + combinedLcg.addend) % lcg.modulus;
}

const previousSeed = function(lcg) {
    const seed = parseValue('advanceinput-seed', 'seed');
    if (seed === null) return null;
    const amount = parseValue('advanceinput-amount', 'amount');
    if (amount === null) return null;
    const combinedLcg = lcgCombine(lcg, -amount);
    return (seed * combinedLcg.multiplier + combinedLcg.addend) % lcg.modulus;
}

const combineSeed = function(lcg) {
    const amount = parseValue('combineinput-amount', 'amount');
    if (amount === null) return null;
    const combinedLcg = lcgCombine(lcg, amount);
    return 'Multiplier: ' + toDecAndHexString(combinedLcg.multiplier) + '<br>Addend: ' + toDecAndHexString(combinedLcg.addend) + '<br>Modulus: ' + toDecAndHexString(combinedLcg.modulus);
}

const inputs = {
    'next': 'advanceinput',
    'previous': 'advanceinput',
    'combine': 'combineinput'
};

const functions = {
    'next': nextSeed,
    'previous': previousSeed,
    'combine': combineSeed
};

const calculate = function() {
    const multiplier = parseValue('multiplier');
    if (multiplier === null) return;
    if (multiplier <= 0n) {
        document.getElementById('output').innerHTML = '<span class="error">Multiplier must be positive</span>';
        return;
    }
    const addend = parseValue('addend');
    if (addend === null) return;
    const modulus = parseValue('modulus');
    if (modulus === null) return;
    if (modulus <= 0n) {
        document.getElementById('output').innerHTML = '<span class="error">Modulus must be positive</span>';
        return;
    }

    const lcg = {'multiplier': multiplier, 'addend': addend, 'modulus': modulus};
    const result = functions[document.getElementById('operation').value](lcg);
    if (result === null) return;
    document.getElementById('output').innerHTML = toDecAndHexString(result);
}

window.onload = function() {
    document.getElementById('calculate').addEventListener('click', calculate);
    
    const selectedOperation = document.getElementById('operation').value;
    for (const [operation, inputFields] of Object.entries(inputs)) {
        document.getElementById(inputFields).style.display = 'none';
    }
    const inputFields = inputs[selectedOperation];
    if (inputFields) {
        document.getElementById(inputFields).style.removeProperty('display');
    }

    document.getElementById('operation').addEventListener('change', function() {
        const selectedOperation = document.getElementById('operation').value;
        for (const [operation, inputFields] of Object.entries(inputs)) {
            document.getElementById(inputFields).style.display = 'none';
        }
        const inputFields = inputs[selectedOperation];
        if (inputFields) {
            document.getElementById(inputFields).style.removeProperty('display');
        }
    });
}

