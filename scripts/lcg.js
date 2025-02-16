
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
        let result = value.toString() + ' (';
        if (value < 0n) result += '-0x' + (-value).toString(16);
	else result += '0x' + value.toString(16);
	return result + ')'
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

const calcDistance = function(lcg) {
    const distanceSupported = (lcg.modulus & (lcg.modulus - 1n)) === 0n && lcg.modulus <= (1n << 61n) && lcg.multiplier % 2n !== 0n && lcg.addend % 2n !== 0n;
    if (!distanceSupported) {
        document.getElementById('output').innerHTML = '<span class="error">Distance is not supported for this LCG</span>';
        return null;
    }

    const from = (parseValue('distanceinput-from', 'from') & (lcg.modulus - 1n));
    if (from === null) return null;
    const to = (parseValue('distanceinput-to', 'to') & (lcg.modulus - 1n));
    if (to === null) return null;
    
    const ilog2 = function(value) {
        // https://stackoverflow.com/a/67682849
        let result = 0n, i, v;
        for (i = 1n; value >> (1n << i); i <<= 1n) {
        }
        while (value > 1n) {
            v = 1n << --i;
            if (value >> v) {
                result += v;
                value >>= v;
            }
        }
        return result;
    }

    const mask = function(value, bits) {
        return value & ((1n << bits) - 1n);
    }

    const modPow = function(a, b, m) {
        let k = a;
        let result = 1n;
        for (let mask = 1n; mask <= b; mask <<= 1n) {
	    if ((b & mask) !== 0n) {
                result = (result * k) % m;
	    }
            k = (k * k) % m;
	}
        return result;
    }

    const modInverse = function(value, bits) {
        const modulus = 1n << bits;
        return modPow(value, modulus - 1n, modulus);
    }

    const theta = function(number, exp) {
        if (number % 4n === 3n) {
            number = (1n << (exp + 2n)) - number;
	}
        let xHat = number;
        xHat = modPow(xHat, 1n << (exp + 1n), 1n << (2n * exp + 3n));
        xHat -= 1n;
        xHat /= 1n << (exp + 3n);
        xHat %= 1n << exp;
        return xHat;
    }
    
    const distanceFromZero = function(lcg, seed) {
        const exp = ilog2(lcg.modulus);
        const a = lcg.multiplier;
        const b = mask(seed * (lcg.multiplier - 1n) * modInverse(lcg.addend, exp) + 1n, exp + 2n);
        const aBar = theta(a, exp);
        const bBar = theta(b, exp);
        return mask(bBar * modInverse(aBar, exp), exp);
    }

    const fromDfz = distanceFromZero(lcg, from);
    const toDfz = distanceFromZero(lcg, to);
    let distance = toDfz - fromDfz;
    if (distance < 0n) distance += lcg.modulus;
    if (distance > lcg.modulus / 2n) distance -= lcg.modulus;
    return distance;
}

const inputs = {
    'next': 'advanceinput',
    'previous': 'advanceinput',
    'combine': 'combineinput',
    'distance': 'distanceinput'
};

const functions = {
    'next': nextSeed,
    'previous': previousSeed,
    'combine': combineSeed,
    'distance': calcDistance
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

