const bigInt = require("big-integer");
const assert = require("assert");

function getRandomByte() {
    if (typeof window !== "undefined") { // Browser
        if (typeof window.crypto !== "undefined") { // Supported
            let array = new Uint8Array(1);
            window.crypto.getRandomValues(array);
            return array[0];
        }
        else { // fallback
            return Math.floor(Math.random() * 256);
        }
    }
    else { // NodeJS
        return module.require("crypto").randomBytes(1)[0];
    }
}

module.exports = class ZqField {
    constructor(p) {
        this.one = bigInt.one;
        this.zero = bigInt.zero;
        this.p = p;
        this.minusone = p.minus(bigInt.one);
        this.two = bigInt(2);
        this.half = p.shiftRight(1);
        this.bitLength = p.bitLength();
        this.mask = bigInt.one.shiftLeft(this.bitLength - 1).minus(bigInt.one);

        const e = this.minusone.shiftRight(this.one);
        this.nqr = this.two;
        let r = this.pow(this.nqr, e);
        while (!r.equals(this.minusone)) {
            this.nqr = this.nqr.add(this.one);
            r = this.pow(this.nqr, e);
        }

        this.s = this.zero;
        this.t = this.minusone;

        while (!this.t.isOdd()) {
            this.s = this.s.add(this.one);
            this.t = this.t.shiftRight(this.one);
        }

        this.nqr_to_t = this.pow(this.nqr, this.t);
    }

    add(a, b) {
        let res = a.add(b);
        if (res.geq(this.p)) {
            res = res.minus(this.p);
        }
        return res;
    }

    sub(a, b) {
        if (a.geq(b)) {
            return a.minus(b);
        } else {
            return this.p.minus(b.minus(a));
        }
    }

    neg(a) {
        if (a.isZero()) return a;
        return this.p.minus(a);
    }

    mul(a, b) {
        return a.times(b).mod(this.p);
    }

    square(a) {
        return a.square().mod(this.p);
    }

    lt(a, b) {
        const c = this.sub(a,b);
        return (c.gt(this.half)) ? bigInt.one : bigInt.zero;
    }

    eq(a, b) {
        return a.eq(b) ? bigInt(1) : bigInt(0);
    }

    gt(a, b) {
        const c = this.sub(b,a);
        return (c.gt(this.half)) ? bigInt.one : bigInt.zero;
    }

    leq(a, b) {
        const c = this.sub(b,a);
        return (c.gt(this.half)) ? bigInt.zero : bigInt.one;
    }

    geq(a, b) {
        const c = this.sub(a,b);
        return (c.gt(this.half)) ? bigInt.zero : bigInt.one;
    }

    neq(a, b) {
        return a.neq(b) ? bigInt(1) : bigInt(0);
    }

    div(a, b) {
        assert(!b.isZero(), "Division by zero");
        return a.times(b.modInv(this.p)).mod(this.p);
    }

    idiv(a, b) {
        assert(!b.isZero(), "Division by zero");
        return a.divide(b);
    }

    inv(a) {
        assert(!a.isZero(), "Division by zero");
        return a.modInv(this.p);
    }

    mod(a, b) {
        return a.mod(b);
    }

    pow(a, b) {
        return a.modPow(b, this.p);
    }

    band(a, b) {
        return a.and(b).and(this.mask);
    }

    bor(a, b) {
        return a.or(b).and(this.mask);
    }

    bxor(a, b) {
        return a.xor(b).and(this.mask);
    }

    bnot(a) {
        return a.xor(this.mask).and(this.mask);
    }

    shl(a, b) {
        if (b.geq(this.bitLength)) return bigInt.zero;
        return a.shiftLeft(b).and(this.mask);
    }

    shr(a, b) {
        if (b.geq(this.bitLength)) return bigInt.zero;
        return a.shiftRight(b).and(this.mask);
    }

    land(a, b) {
        return (a.isZero() || b.isZero()) ? bigInt.zero : bigInt.one;
    }

    lor(a, b) {
        return (a.isZero() && b.isZero()) ? bigInt.zero : bigInt.one;
    }

    lnot(a) {
        return a.isZero() ? bigInt.one : bigInt.zero;
    }

    sqrt(n) {

        if (n.equals(this.zero)) return this.zero;

        // Test that have solution
        const res = this.pow(n, this.minusone.shiftRight(this.one));
        if (!res.equals(this.one)) return null;

        let m = parseInt(this.s);
        let c = this.nqr_to_t;
        let t = this.pow(n, this.t);
        let r = this.pow(n, this.add(this.t, this.one).shiftRight(this.one) );

        while (!t.equals(this.one)) {
            let sq = this.square(t);
            let i = 1;
            while (!sq.equals(this.one)) {
                i++;
                sq = this.square(sq);
            }

            // b = c ^ m-i-1
            let b = c;
            for (let j=0; j< m-i-1; j ++) b = this.square(b);

            m = i;
            c = this.square(b);
            t = this.mul(t, c);
            r = this.mul(r, b);
        }

        if (r.greater(this.p.shiftRight(this.one))) {
            r = this.neg(r);
        }

        return r;
    }

    normalize(a) {
        a = bigInt(a);
        if (a.isNegative()) {
            return this.p.minus(a.abs().mod(this.p));
        } else {
            return a.mod(this.p);
        }
    }

    random() {
        let res = bigInt(0);
        let n = bigInt(this.p.square());
        while (!n.isZero()) {
            res = res.shiftLeft(8).add(bigInt(getRandomByte()));
            n = n.shiftRight(8);
        }
        return res.mod(this.p);
    }

};

