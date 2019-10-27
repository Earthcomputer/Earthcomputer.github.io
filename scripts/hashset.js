
let _tieBreakOrder = function(a, b) {
    if (a.identHashCode === undefined)
        a.identHashCode = Math.random();
    if (b.identHashCode === undefined)
        b.identHashCode = Math.random();
    return a.identHashCode < b.identHashCode ? -1 : a.identHashCode > b.identHashCode ? 1 : 0;
};
let _treeContains = function(node, h, element) {
    return !!_find(_root(node), h, element);
};
let _treeAdd = function(node, h, element) {
    let searched = false;
    let root = (node.parent != null) ? _root(node) : node;
    for (let p = root;;) {
        let dir, ph;
        if ((ph = p.hash) > h)
            dir = -1;
        else if (ph < h)
            dir = 1;
        else if (p === element || (element && element.equals(p))) // this used to read p && element.equals(p), causing possible NPEs. See JDK-8046085
            return null;
        else if ((dir = element.compareTo(p)) === 0) {
            if (!searched) {
                let q, ch;
                searched = true;
                if (((ch = p.left) != null &&
                    (q = _find(ch, h, element)) != null) ||
                    ((ch = p.right) != null &&
                        (q = _find(ch, h, element)) != null))
                    return null;
            }
            dir = _tieBreakOrder(element, p);
        }

        let xp = p;
        if ((p = (dir <= 0) ? p.left : p.right) == null) {
            let xpn = xp.next;
            let x = element;
            x.tree = true;
            x.parent = x.left = x.right = x.next = x.prev = null;
            x.red = false;
            if (dir <= 0)
                xp.left = x;
            else
                xp.right = x;
            xp.next = x;
            x.parent = x.prev = xp;
            if (xpn != null)
                xpn.prev = x;
            let ret = _balanceInsertion(root, x);
            _moveRootToFront(node, ret);
            return ret;
        }
    }
};
let _treeRemove = function(node, h, element) {
    element = _find(_root(node), h, element);
    if (!element)
        return null;

    let first = node, root = first, rl;
    let succ = element.next, pred = element.prev;
    let ret = node;
    if (pred == null)
        ret = first = succ;
    else
        pred.next = succ;
    if (succ != null)
        succ.prev = pred;
    if (first == null)
        return ret;
    if (root.parent != null)
        root = _root(root);
    if (root == null || root.right == null ||
        (rl = root.left) == null || rl.left == null) {
        ret = _untreeify(first);  // too small
        return ret;
    }
    let p = element, pl = element.left, pr = element.right, replacement;
    if (pl != null && pr != null) {
        let s = pr, sl;
        while ((sl = s.left) != null) // find successor
            s = sl;
        let c = s.red; s.red = p.red; p.red = c; // swap colors
        let sr = s.right;
        let pp = p.parent;
        if (s === pr) { // p was s's direct parent
            p.parent = s;
            s.right = p;
        }
        else {
            let sp = s.parent;
            if ((p.parent = sp) != null) {
                if (s === sp.left)
                    sp.left = p;
                else
                    sp.right = p;
            }
            if ((s.right = pr) != null)
                pr.parent = s;
        }
        p.left = null;
        if ((p.right = sr) != null)
            sr.parent = p;
        if ((s.left = pl) != null)
            pl.parent = s;
        if ((s.parent = pp) == null)
            root = s;
        else if (p === pp.left)
            pp.left = s;
        else
            pp.right = s;
        if (sr != null)
            replacement = sr;
        else
            replacement = p;
    }
    else if (pl != null)
        replacement = pl;
    else if (pr != null)
        replacement = pr;
    else
        replacement = p;
    if (replacement !== p) {
        let pp = replacement.parent = p.parent;
        if (pp == null)
            root = replacement;
        else if (p === pp.left)
            pp.left = replacement;
        else
            pp.right = replacement;
        p.left = p.right = p.parent = null;
    }

    let r = p.red ? root : _balanceDeletion(root, replacement);

    if (replacement === p) {  // detach
        let pp = p.parent;
        p.parent = null;
        if (pp != null) {
            if (p === pp.left)
                pp.left = null;
            else if (p === pp.right)
                pp.right = null;
        }
    }
    _moveRootToFront(ret, r);
    return r;
};
let _treeIterator = function(node, output) {
    do {
        output.push(node.value);
        node = node.next;
    } while (node);
};
let _treeSplit = function(node, oldMask, newMask) {
    let leftArray = [], rightArray = [];
    let p = node;
    do {
        let newHash = _hash(p) & newMask;
        let oldHash = newHash & oldMask;
        if (newHash === oldHash)
            leftArray.push(p);
        else
            rightArray.push(p);
        p = p.next;
    } while (p);
    let left, right;
    if (leftArray.length > 0) {
        if (leftArray.length <= 6) {
            left = leftArray;
        } else if (rightArray.length === 0) {
            left = node;
        } else {
            left = _treeify(leftArray);
        }
    }
    if (rightArray.length > 0) {
        if (rightArray.length <= 6) {
            right = rightArray;
        } else if (leftArray.length === 0) {
            right = node;
        } else {
            right = _treeify(rightArray);
        }
    }
    return {left: left, right: right};
};
let _treeify = function(bucket) {
    for (let i = 0; i < bucket.length; i++) {
        let elem = bucket[i];
        if (i !== 0) {
            bucket[i - 1].next = elem;
            elem.prev = bucket[i - 1];
        }
        elem.tree = true;
        elem.parent = elem.left = elem.right = null;
        elem.red = false;
    }
    return _doTreeify(bucket[0]);
};
let _doTreeify = function(node) {
    let root = null;
    for (let x = node, next; x; x = next) {
        next = x.next;
        x.left = x.right = null;
        if (!root) {
            x.parent = null;
            x.red = false;
            root = x;
        }
        else {
            let h = x.h;
            for (let p = root;;) {
                let dir, ph;
                if ((ph = p.h) > h)
                    dir = -1;
                else if (ph < h)
                    dir = 1;
                else if ((dir = x.compareTo(p)) === 0)
                    dir = _tieBreakOrder(x, p);

                let xp = p;
                if (!(p = (dir <= 0) ? p.left : p.right)) {
                    x.parent = xp;
                    if (dir <= 0)
                        xp.left = x;
                    else
                        xp.right = x;
                    root = _balanceInsertion(root, x);
                    break;
                }
            }
        }
    }
    _moveRootToFront(node, root);
    return root;
};
let _untreeify = function(node) {
    let ret = [];
    do {
        ret.push(node);
        node = node.next;
    } while (node);
    return ret;
};
let _moveRootToFront = function(first, root) {
    if (root != null) {
        if (root !== first) {
            let rn;
            let rp = root.prev;
            if ((rn = root.next) != null)
                rn.prev = rp;
            if (rp != null)
                rp.next = rn;
            if (first != null)
                first.prev = root;
            root.next = first;
            root.prev = null;
        }
    }
};
let _root = function(node) {
    while (node.parent)
        node = node.parent;
    return node;
};
let _find = function(node, h, element) {
    let p = node;
    do {
        let ph, dir;
        let pl = p.left, pr = p.right, q;
        if ((ph = p.hash) > h)
            p = pl;
        else if (ph < h)
            p = pr;
        else if (p === element || (element && element.equals(p)))
            return p;
        else if (!pl)
            p = pr;
        else if (!pr)
            p = pl;
        else if ((dir = element.compareTo(p)) !== 0)
            p = (dir < 0) ? pl : pr;
        else { // noinspection JSAssignmentUsedAsCondition
            if (q = _find(pr, h, element))
                return q;
            else
                p = pl;
        }
    } while (p != null);
    return null;
};
let _rotateLeft = function(root, p) {
    let r, pp, rl;
    if (p && (r = p.right)) {
        if ((rl = p.right = r.left))
            rl.parent = p;
        if (!(pp = r.parent = p.parent))
            (root = r).red = false;
        else if (pp.left === p)
            pp.left = r;
        else
            pp.right = r;
        r.left = p;
        p.parent = r;
    }
    return root;
};
let _rotateRight = function(root, p) {
    let l, pp, lr;
    if (p && (l = p.left)) {
        if ((lr = p.left = l.right))
            lr.parent = p;
        if (!(pp = l.parent = p.parent))
            (root = l).red = false;
        else if (pp.right === p)
            pp.right = l;
        else
            pp.left = l;
        l.right = p;
        p.parent = l;
    }
    return root;
};
let _balanceInsertion = function(root, x) {
    x.red = true;
    for (let xp, xpp, xppl, xppr;;) {
        if (!(xp = x.parent)) {
            x.red = false;
            return x;
        }
        else if (!xp.red || !(xpp = xp.parent))
            return root;
        if (xp === (xppl = xpp.left)) {
            if ((xppr = xpp.right) && xppr.red) {
                xppr.red = false;
                xp.red = false;
                xpp.red = true;
                x = xpp;
            }
            else {
                if (x === xp.right) {
                    root = _rotateLeft(root, x = xp);
                    xpp = !(xp = x.parent) ? null : xp.parent;
                }
                if (xp) {
                    xp.red = false;
                    if (xpp != null) {
                        xpp.red = true;
                        root = _rotateRight(root, xpp);
                    }
                }
            }
        }
        else {
            if (xppl && xppl.red) {
                xppl.red = false;
                xp.red = false;
                xpp.red = true;
                x = xpp;
            }
            else {
                if (x === xp.left) {
                    root = _rotateRight(root, x = xp);
                    xpp = !(xp = x.parent) ? null : xp.parent;
                }
                if (xp) {
                    xp.red = false;
                    if (xpp) {
                        xpp.red = true;
                        root = _rotateLeft(root, xpp);
                    }
                }
            }
        }
    }
};
let _balanceDeletion = function(root, x) {
    for (let xp, xpl, xpr;;)  {
        if (x == null || x === root)
            return root;
        else if ((xp = x.parent) == null) {
            x.red = false;
            return x;
        }
        else if (x.red) {
            x.red = false;
            return root;
        }
        else if ((xpl = xp.left) === x) {
            if ((xpr = xp.right) != null && xpr.red) {
                xpr.red = false;
                xp.red = true;
                root = _rotateLeft(root, xp);
                xpr = (xp = x.parent) == null ? null : xp.right;
            }
            if (xpr == null)
                x = xp;
            else {
                let sl = xpr.left, sr = xpr.right;
                if ((sr == null || !sr.red) &&
                    (sl == null || !sl.red)) {
                    xpr.red = true;
                    x = xp;
                }
                else {
                    if (sr == null || !sr.red) {
                        if (sl != null)
                            sl.red = false;
                        xpr.red = true;
                        root = _rotateRight(root, xpr);
                        xpr = (xp = x.parent) == null ?
                            null : xp.right;
                    }
                    if (xpr != null) {
                        xpr.red = (xp == null) ? false : xp.red;
                        if ((sr = xpr.right) != null)
                            sr.red = false;
                    }
                    if (xp != null) {
                        xp.red = false;
                        root = _rotateLeft(root, xp);
                    }
                    x = root;
                }
            }
        }
        else { // symmetric
            if (xpl != null && xpl.red) {
                xpl.red = false;
                xp.red = true;
                root = _rotateRight(root, xp);
                xpl = (xp = x.parent) == null ? null : xp.left;
            }
            if (xpl == null)
                x = xp;
            else {
                let sl = xpl.left, sr = xpl.right;
                if ((sl == null || !sl.red) &&
                    (sr == null || !sr.red)) {
                    xpl.red = true;
                    x = xp;
                }
                else {
                    if (sl == null || !sl.red) {
                        if (sr != null)
                            sr.red = false;
                        xpl.red = true;
                        root = _rotateLeft(root, xpl);
                        xpl = (xp = x.parent) == null ?
                            null : xp.left;
                    }
                    if (xpl != null) {
                        xpl.red = (xp == null) ? false : xp.red;
                        if ((sl = xpl.left) != null)
                            sl.red = false;
                    }
                    if (xp != null) {
                        xp.red = false;
                        root = _rotateRight(root, xp);
                    }
                    x = root;
                }
            }
        }
    }
};

let _hash = function(object) {
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
    let bucketIndex = _hash(element) & this.mask;
    let bucket = this.buckets[bucketIndex];
    if (!bucket)
        return false;
    if (bucket.tree)
        return _treeContains(bucket, h, element);
    for (let i = 0; i < bucket.length; i++) {
        if (bucket[i].h === h && element.equals(bucket[i])) {
            return true;
        }
    }
    return false;
};
HashSet.prototype.add = function(element) {
    let h = element.hashCode();
    let bucketIndex = _hash(element) & this.mask;
    let bucket = this.buckets[bucketIndex];
    if (!bucket)
        bucket = this.buckets[bucketIndex] = [];
    if (bucket.tree) {
        let newRoot = _treeAdd(bucket, h, element);
        if (!newRoot)
            return false;
        this.buckets[bucketIndex] = newRoot;
    } else {
        for (let i = 0; i < bucket.length; i++) {
            if (bucket[i].h === h && element.equals(bucket[i])) {
                return false;
            }
        }
        bucket.push(element);
        if (bucket.length > 8) {
            if (this.buckets.length < 64)
                this._resize();
            else
                this.buckets[bucketIndex] = _treeify(bucket);
        }
    }
    element.h = h;
    this.size++;
    if (this.size > this.threshold)
        this._resize();
    return true;
};
HashSet.prototype.remove = function(element) {
    let h = element.hashCode();
    let bucketIndex = _hash(element) & this.mask;
    let bucket = this.buckets[bucketIndex];
    if (!bucket)
        return false;
    if (bucket.tree) {
        let newRoot = _treeRemove(bucket, h, element);
        if (!newRoot)
            return false;
        this.buckets[bucketIndex] = newRoot;
        this.size--;
        return true;
    }
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
        if (bucket.tree) {
            _treeIterator(bucket, ret);
        } else {
            for (let i = 0; i < bucket.length; i++) {
                ret.push(bucket[i].value);
            }
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
        if (bucket.tree) {
            let result = _treeSplit(bucket, this.mask, newBuckets.length - 1);
            bucket = result.left;
            newBuckets[bucketIndex + this.buckets.length] = result.right;
        } else {
            for (let i = 0; i < bucket.length; i++) {
                if ((_hash(bucket[i]) & (newBuckets.length - 1)) !== bucketIndex) {
                    if (!newBuckets[bucketIndex + this.buckets.length])
                        newBuckets[bucketIndex + this.buckets.length] = [];
                    newBuckets[bucketIndex + this.buckets.length].push(bucket[i]);
                    bucket.splice(i, 1);
                    i--;
                }
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

let getNodeMetrics = function(ctx, node) {
    ctx.font = NORMAL_FONT;
    ctx.fillStyle = NORMAL_STYLE;
    let width = ctx.measureText(node.value.replace('\n', '\\n')).width + 4;
    let height = ctx.measureText('M').width * 1.3;
    ctx.font = HASH_FONT;
    ctx.fillStyle = HASH_STYLE;
    width = Math.max(width, ctx.measureText('hash=' + node.h).width + 4);
    height += ctx.measureText('M').width * 1.3;
    return {width: width, height: height + 7};
};

let getBucketMetrics = function(ctx, number, bucket) {
    ctx.font = TITLE_FONT;
    ctx.fillStyle = TITLE_STYLE;
    let width = ctx.measureText('' + number).width;
    // noinspection JSSuspiciousNameCombination
    let height = ctx.measureText('M').width * 1.3;
    if (bucket) {
        if (bucket.tree) {
            let treeMetrics = getSubtreeMetrics(ctx, bucket, new Map());
            width = Math.max(width, treeMetrics.width);
            height += treeMetrics.height;
        } else {
            for (let i = 0; i < bucket.length; i++) {
                let metrics = getNodeMetrics(ctx, bucket[i]);
                width = Math.max(width, metrics.width);
                height += metrics.height;
            }
        }
    }
    return {width: width, height: height};
};

let getSubtreeMetrics = function(ctx, node, cache) {
    if (cache.has(node))
        return cache.get(node);

    let thisMetrics = getNodeMetrics(ctx, node);
    if (node.left) {
        if (node.right) {
            let leftMetrics = getSubtreeMetrics(ctx, node.left, cache);
            let rightMetrics = getSubtreeMetrics(ctx, node.right, cache);
            let leftX = thisMetrics.width / 2 - (leftMetrics.width + rightMetrics.width) / 2;
            let leftAnchor = leftX + leftMetrics.anchor;
            let rightAnchor = leftX + leftMetrics.width + rightMetrics.anchor;
            let shift = 0;
            if (leftAnchor > thisMetrics.width / 2 - 8) {
                shift = thisMetrics.width / 2 - 8 - leftAnchor;
            } else if (rightAnchor < thisMetrics.width / 2 + 8) {
                shift = thisMetrics.width / 2 + 8 - rightAnchor;
            }
            leftX += shift;
            leftAnchor += shift;
            rightAnchor += shift;
            let extraSpaceLeft = leftX < 0 ? -leftX : 0;
            let extraSpaceRight = Math.max(0, leftX + leftMetrics.width + rightMetrics.width - thisMetrics.width);
            let leftYGap = thisMetrics.height + Math.max(12, (thisMetrics.width / 2 - leftAnchor) / 4);
            let rightYGap = thisMetrics.height + Math.max(12, (rightAnchor - thisMetrics.width / 2) / 4);
            let ret = {leftAnchorX: extraSpaceLeft + leftAnchor,
                leftAnchorY: thisMetrics.height + leftYGap,
                rightAnchorX: extraSpaceLeft + rightAnchor,
                rightAnchorY: thisMetrics.height + rightYGap,
                width: extraSpaceLeft + thisMetrics.width + extraSpaceRight,
                height: thisMetrics.height + Math.max(leftYGap + leftMetrics.height, rightYGap + rightMetrics.height),
                anchor: extraSpaceLeft + thisMetrics.width / 2};
            cache.set(node, ret);
            return ret;
        } else {
            let childMetrics = getSubtreeMetrics(ctx, node.left, cache);
            let childAnchor = thisMetrics.width / 2 - 8;
            let childX = childAnchor - childMetrics.anchor;
            let extraSpaceLeft = childX < 0 ? -childX : 0;
            let extraSpaceRight = Math.max(0, childX + childMetrics.width - thisMetrics.width);
            let ret = {leftAnchorX: extraSpaceLeft + childAnchor,
                leftAnchorY: thisMetrics.height + 12,
                width: extraSpaceLeft + thisMetrics.width + extraSpaceRight,
                height: thisMetrics.height + 12 + childMetrics.height,
                anchor: extraSpaceLeft + thisMetrics.width / 2};
            cache.set(node, ret);
            return ret;
        }
    } else if (node.right) {
        let childMetrics = getSubtreeMetrics(ctx, node.right, cache);
        let childAnchor = thisMetrics.width / 2 + 8;
        let childX = childAnchor - childMetrics.anchor;
        let extraSpaceLeft = childX < 0 ? -childX : 0;
        let extraSpaceRight = Math.max(0, childX + childMetrics.width - thisMetrics.width);
        let ret = {rightAnchorX: extraSpaceLeft + childAnchor,
            rightAnchorY: thisMetrics.height + 12,
            width: extraSpaceLeft + thisMetrics.width + extraSpaceRight,
            height: thisMetrics.height + 12 + childMetrics.height,
            anchor: extraSpaceLeft + thisMetrics.width / 2};
        cache.set(node, ret);
        return ret;
    } else {
        thisMetrics.anchor = thisMetrics.width / 2;
        cache.set(node, thisMetrics);
        return thisMetrics;
    }
};
let populateGlobalAnchorPositions = function(globalAnchorX, globalAnchorY, node, cache) {
    let metrics = cache.get(node);
    metrics.globalAnchorX = globalAnchorX;
    metrics.globalAnchorY = globalAnchorY;
    if (node.left) {
        populateGlobalAnchorPositions(globalAnchorX - metrics.anchor + metrics.leftAnchorX, globalAnchorY + metrics.leftAnchorY, node.left, cache);
    }
    if (node.right) {
        populateGlobalAnchorPositions(globalAnchorX - metrics.anchor + metrics.rightAnchorX, globalAnchorY + metrics.rightAnchorY, node.right, cache);
    }
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

let drawNode = function(ctx, x, y, node) {
    let metrics = getNodeMetrics(ctx, node);
    ctx.font = NORMAL_FONT;
    ctx.fillStyle = NORMAL_STYLE;
    ctx.fillText(node.value.replace('\n', '\\n'), x + 2, y + 2);
    let normalHeight = ctx.measureText('M').width * 1.3;
    ctx.font = HASH_FONT;
    ctx.fillStyle = HASH_STYLE;
    ctx.fillText('hash=' + node.h, x + 2, y + 4 + normalHeight);
    ctx.strokeStyle = node.tree && node.red ? 'red' : 'white';
    ctx.strokeRect(x, y, metrics.width, metrics.height - 2);
};

let drawTree = function(ctx, x, y, rootNode, drawIterationOrder) {
    let cache = new Map();
    let rootMetrics = getSubtreeMetrics(ctx, rootNode, cache);
    populateGlobalAnchorPositions(x + rootMetrics.anchor, y, rootNode, cache);

    let node = rootNode;
    do {
        let nodeMetrics = getNodeMetrics(ctx, node);
        let subtreeMetrics = cache.get(node);
        drawNode(ctx, subtreeMetrics.globalAnchorX - nodeMetrics.width / 2, subtreeMetrics.globalAnchorY, node);
        if (node.left || node.right) {
            ctx.strokeStyle = 'white';
            ctx.beginPath();
            if (node.left) {
                let leftMetrics = cache.get(node.left);
                ctx.moveTo(subtreeMetrics.globalAnchorX, subtreeMetrics.globalAnchorY + nodeMetrics.height);
                ctx.lineTo(leftMetrics.globalAnchorX, leftMetrics.globalAnchorY);
            }
            if (node.right) {
                let rightMetrics = cache.get(node.right);
                ctx.moveTo(subtreeMetrics.globalAnchorX, subtreeMetrics.globalAnchorY + nodeMetrics.height);
                ctx.lineTo(rightMetrics.globalAnchorX, rightMetrics.globalAnchorY);
            }
            ctx.stroke();
        }
        node = node.next;
    } while (node);

    if (drawIterationOrder) {
        let drawArrow = function(context, fromx, fromy, tox, toy) {
            // source, adapted from: https://stackoverflow.com/questions/808826/draw-arrow-on-canvas-tag
            let headlen = 10; // length of head in pixels
            let dx = tox - fromx;
            let dy = toy - fromy;
            let headX = fromx + dx * 0.6;
            let headY = fromy + dy * 0.6;
            let angle = Math.atan2(dy, dx);
            context.moveTo(fromx, fromy);
            context.lineTo(tox, toy);
            context.moveTo(headX, headY);
            context.lineTo(headX - headlen * Math.cos(angle - Math.PI / 6), headY - headlen * Math.sin(angle - Math.PI / 6));
            context.moveTo(headX, headY);
            context.lineTo(headX - headlen * Math.cos(angle + Math.PI / 6), headY - headlen * Math.sin(angle + Math.PI / 6));
        };
        ctx.strokeStyle = 'green';
        ctx.beginPath();
        let node = rootNode;
        while (node.next) {
            let fromTreeMetrics = cache.get(node);
            let toTreeMetrics = cache.get(node.next);
            let fromNodeMetrics = getNodeMetrics(ctx, node);
            let toNodeMetrics = getNodeMetrics(ctx, node.next);
            drawArrow(ctx,
                fromTreeMetrics.globalAnchorX, fromTreeMetrics.globalAnchorY + fromNodeMetrics.height / 2,
                toTreeMetrics.globalAnchorX, toTreeMetrics.globalAnchorY + toNodeMetrics.height / 2);
            node = node.next;
        }
        ctx.stroke();
    }
};

let drawBucket = function(ctx, x, number, bucket) {
    let width = getBucketMetrics(ctx, number, bucket).width;
    ctx.textBaseline = 'top';
    ctx.font = TITLE_FONT;
    ctx.fillStyle = TITLE_STYLE;
    ctx.fillText('' + number, x + width / 2 - ctx.measureText('' + number).width / 2, 0);
    if (bucket) {
        let y = ctx.measureText('M').width * 1.3;
        if (bucket.tree) {
            drawTree(ctx, x, y, bucket, true);
        } else {
            for (let i = 0; i < bucket.length; i++) {
                drawNode(ctx, x, y, bucket[i]);
                y += getNodeMetrics(ctx, bucket[i]).height;
            }
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
    let input = document.getElementById('value');
    if (!input.select)
        input.select = function() {
            this.setSelectionRange(0, this.value.length);
        };
    let textOutput = document.getElementById('text_output');
    document.getElementById('add').addEventListener('click', function () {
        textOutput.innerText = '' + theSet.add(getCurrentElement());
        refreshCanvas();
        input.focus();
        input.select();
    });
    document.getElementById('remove').addEventListener('click', function () {
        textOutput.innerText = '' + theSet.remove(getCurrentElement());
        refreshCanvas();
        input.focus();
        input.select();
    });
    document.getElementById('contains').addEventListener('click', function () {
        textOutput.innerText = '' + theSet.contains(getCurrentElement());
        input.focus();
        input.select();
    });
    document.getElementById('iterator').addEventListener('click', function () {
        textOutput.innerText = '' + theSet.iterator();
        input.focus();
        input.select();
    });
    document.getElementById('clear').addEventListener('click', function () {
        theSet.clear();
        textOutput.innerText = '';
        refreshCanvas();
        input.focus();
        input.select();
    });
    refreshCanvas();
};
