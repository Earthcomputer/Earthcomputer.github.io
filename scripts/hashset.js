
let hash = function(object) {
    let h = object.hashCode();
    return h ^ (h >>> 16);
};
let HashSet = function() {
    this.size = 0;
    this.threshold = 12;
    this.mask = 15;
    this.buckets = new Array(16);
};
HashSet.prototype.contains = function(element) {
    let h = element.hashCode();
    let bucketIndex = hash(element) & this.mask;
    let bucket = this.buckets[bucketIndex];
    if (!bucket)
        return false;
    for (let i = 0; i < bucket.length; i++) {
        if (bucket[i].h === h && element.equals(bucket[i])) {
            return true;
        }
    }
    return false;
};
HashSet.prototype.add = function(element) {
    let h = element.hashCode();
    let bucketIndex = hash(element) & this.mask;
    let bucket = this.buckets[bucketIndex];
    if (!bucket)
        bucket = this.buckets[bucketIndex] = [];
    for (let i = 0; i < bucket.length; i++) {
        if (bucket[i].h === h && element.equals(bucket[i])) {
            return false;
        }
    }
    element.h = h;
    bucket.push(element);
    this.size++;
    if (this.size > this.threshold)
        this._resize();
    return true;
};
HashSet.prototype.remove = function(element) {
    let h = element.hashCode();
    let bucketIndex = hash(element) & this.mask;
    let bucket = this.buckets[bucketIndex];
    if (!bucket)
        return false;
    for (let i = 0; i < bucket.length; i++) {
        if (bucket[i].h === h && element.equals(bucket[i])) {
            bucket.splice(i, 1);
            this.size--;
            return true;
        }
    }
    return false;
};
HashSet.prototype.iterator = function() {
    let ret = [];
    for (let bucketIndex = 0; bucketIndex < this.buckets.length; bucketIndex++) {
        let bucket = this.buckets[bucketIndex];
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
            ret.push(bucket[i].value);
        }
    }
    return ret;
};
HashSet.prototype.clear = function() {
    for (let bucketIndex = 0; bucketIndex < this.buckets.length; bucketIndex++) {
        this.buckets[bucketIndex] = null;
    }
    this.size = 0;
};
HashSet.prototype._resize = function() {
    let newBuckets = new Array(this.buckets.length << 1);
    for (let bucketIndex = 0; bucketIndex < this.buckets.length; bucketIndex++) {
        let bucket = this.buckets[bucketIndex];
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
            if ((hash(bucket[i]) & (newBuckets.length - 1)) !== bucketIndex) {
                if (!newBuckets[bucketIndex + this.buckets.length])
                    newBuckets[bucketIndex + this.buckets.length] = [];
                newBuckets[bucketIndex + this.buckets.length].push(bucket[i]);
                bucket.splice(i, 1);
                i--;
            }
        }
        if (bucket)
            newBuckets[bucketIndex] = bucket;
    }
    this.threshold <<= 1;
    this.mask = newBuckets.length - 1;
    this.buckets = newBuckets;
};

let theSet = new HashSet();

const TITLE_FONT = '2em Consolas, "Courier New", Courier, monospace';
const TITLE_STYLE = 'green';
const NORMAL_FONT = '1em Consolas, "Courier New", Courier, monospace';
const NORMAL_STYLE = 'white';
const HASH_FONT = '0.8em Consolas, "Courier New", Courier, monospace';
const HASH_STYLE = 'white';

let getBucketMetrics = function(ctx, number, bucket) {
    ctx.font = TITLE_FONT;
    ctx.fillStyle = TITLE_STYLE;
    let width = ctx.measureText('' + number).width;
    // noinspection JSSuspiciousNameCombination
    let height = ctx.measureText('M').width * 1.3;
    if (bucket) {
        ctx.font = NORMAL_FONT;
        ctx.fillStyle = NORMAL_STYLE;
        // noinspection JSSuspiciousNameCombination
        let normalHeight = ctx.measureText('M').width * 1.3;
        ctx.font = HASH_FONT;
        ctx.fillStyle = HASH_STYLE;
        // noinspection JSSuspiciousNameCombination
        let hashHeight = ctx.measureText('M').width * 1.3;
        for (let i = 0; i < bucket.length; i++) {
            ctx.font = NORMAL_FONT;
            ctx.fillStyle = NORMAL_STYLE;
            width = Math.max(width, ctx.measureText(bucket[i].value.replace('\n', '\\n')).width + 4);
            ctx.font = HASH_FONT;
            ctx.fillStyle = HASH_STYLE;
            width = Math.max(width, ctx.measureText('hash=' + bucket[i].h).width + 4);
            height += 7 + normalHeight + hashHeight;
        }
    }
    return {width: width, height: height};
};

let getHashSetMetrics = function(ctx) {
    let width = 0, height = 0;
    for (let i = 0; i < theSet.buckets.length; i++) {
        let metrics = getBucketMetrics(ctx, i, theSet.buckets[i]);
        if (i !== 0)
            width += 8;
        width += metrics.width;
        height = Math.max(height, metrics.height);
    }
    return {width: width, height: height};
};

let drawBucket = function(ctx, x, number, bucket) {
    let width = getBucketMetrics(ctx, number, bucket).width;
    ctx.textBaseline = 'top';
    ctx.font = TITLE_FONT;
    ctx.fillStyle = TITLE_STYLE;
    ctx.fillText('' + number, x + width / 2 - ctx.measureText('' + number).width / 2, 0);
    if (bucket) {
        // noinspection JSSuspiciousNameCombination
        let y = ctx.measureText('M').width * 1.3;
        ctx.font = NORMAL_FONT;
        ctx.fillStyle = NORMAL_STYLE;
        // noinspection JSSuspiciousNameCombination
        let normalHeight = ctx.measureText('M').width * 1.3;
        ctx.font = HASH_FONT;
        ctx.fillStyle = HASH_STYLE;
        // noinspection JSSuspiciousNameCombination
        let hashHeight = ctx.measureText('M').width * 1.3;
        for (let i = 0; i < bucket.length; i++) {
            ctx.font = NORMAL_FONT;
            ctx.fillStyle = NORMAL_STYLE;
            ctx.fillText(bucket[i].value.replace('\n', '\\n'), x + 2, y + 2);
            ctx.font = HASH_FONT;
            ctx.fillStyle = HASH_STYLE;
            ctx.fillText('hash=' + bucket[i].h, x + 2, y + 4 + normalHeight);
            ctx.strokeStyle = 'white';
            ctx.strokeRect(x + 1, y + 1, width - 2, normalHeight + hashHeight + 5);
            y += 7 + normalHeight + hashHeight;
        }
    }
};

let drawHashSet = function(ctx) {
    let x = 0;
    for (let i = 0; i < theSet.buckets.length; i++) {
        drawBucket(ctx, x, i, theSet.buckets[i]);
        x += 8 + getBucketMetrics(ctx, i, theSet.buckets[i]).width;
    }
};

let refreshCanvas = function() {
    let canvas = document.getElementById('output');
    let ctx = canvas.getContext('2d');
    let metrics = getHashSetMetrics(ctx);
    canvas.setAttribute('style', 'width:' + metrics.width + 'px;height:' + metrics.height + 'px;');
    canvas.width = metrics.width;
    canvas.height = metrics.height;
    ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2525';
    ctx.fillRect(0, 0, metrics.width, metrics.height);
    drawHashSet(ctx);
};

let getCurrentElement = function() {
    let element = {value: document.getElementById('value').value};
    let equals = Function('a', 'b', equalsEditor.getValue());
    element.equals = function(other) {
        return equals(this.value, other.value);
    };
    let hashCode = Function('a', hashCodeEditor.getValue());
    element.hashCode = function() {
        return hashCode(this.value);
    };
    let compareTo = Function('a', 'b', compareToEditor.getValue());
    element.compareTo = function(other) {
        return compareTo(this.value, other.value);
    };
    return element;
};

window.onload = function() {
    let textOutput = document.getElementById('text_output');
    document.getElementById('add').addEventListener('click', function () {
        textOutput.innerText = '' + theSet.add(getCurrentElement());
        refreshCanvas();
    });
    document.getElementById('remove').addEventListener('click', function () {
        textOutput.innerText = '' + theSet.remove(getCurrentElement());
        refreshCanvas();
    });
    document.getElementById('contains').addEventListener('click', function () {
        textOutput.innerText = '' + theSet.contains(getCurrentElement());
    });
    document.getElementById('iterator').addEventListener('click', function () {
        textOutput.innerText = '' + theSet.iterator();
    });
    document.getElementById('clear').addEventListener('click', function () {
        theSet.clear();
        textOutput.innerText = '';
        refreshCanvas();
    });
    refreshCanvas();
};
