const bigInt = require("big-integer");
const buildF1m = require("./build_f1m");

module.exports = function buildWasmFf(module, prefix, prime, publish) {

    const q = bigInt(prime);
    const n64 = Math.floor((q.minus(1).bitLength() - 1)/64) +1;
    const pTmp = module.alloc((n64 +1)*8);

    const prefixI = prefix + "_int";
    const prefixF = prefix + "_F1m";
    buildF1m(module, q, prefixF, prefixI);

    function buildCopy() {
        const f = module.addFunction(prefix+"_copy");
        f.addParam("px", "i32");
        f.addParam("pr", "i32");

        const c = f.getCodeBuilder();

        for (let i=0; i<=n64; i++) {
            f.addCode(
                c.i64_store(
                    c.getLocal("pr"),
                    i*8,
                    c.i64_load(
                        c.getLocal("px"),
                        i*8
                    )
                )
            );
        }
    }


    function ifLong(c, vL, t,e) {
        return [
            ...c.if(
                c.i32_and(
                    c.i32_load8_u(
                        c.getLocal(vL),
                        7
                    ),
                    c.i32_const(0x80)
                ),
                t,
                e
            )
        ];
    }


    function ifMontgomery(c, vL, t,e) {
        return [
            ...c.if(
                c.i32_and(
                    c.i32_load8_u(
                        c.getLocal(vL),
                        7
                    ),
                    c.i32_const(0x40)
                ),
                t,
                e
            )
        ];
    }

    function toMontgomery(c, l) {
        return c.call(
            prefix + "_toMontgomery",
            c.getLocal(l)
        );
    }

    function setType(c, vL, t) {
        return c.i32_store(
            c.getLocal(vL),
            4,
            c.i32_const(t << 24)
        );
    }

    function buildRawCopyS2L() {
        const f = module.addFunction(prefix+"_rawCopyS2L");
        f.addParam("pR", "i32");
        f.addParam("v", "i64");

        const c = f.getCodeBuilder();

        f.addCode(
            c.if(
                c.i64_gt_s(
                    c.getLocal("v"), c.i64_const(0)
                ),
                [
                    ...copyShort(),
                ],[
                    ...c.setLocal("v", c.i64_sub(c.i64_const(0), c.getLocal("v"))),
                    ...copyShort(),
                    ...c.call(
                        prefixF + "_neg",
                        c.getLocal("pR"),
                        c.getLocal("pR")
                    )
                ]
            )
        );

        function copyShort() {
            const code = [];
            code.push(
                c.i64_store(
                    c.getLocal("pR"),
                    c.getLocal("v")
                )
            );
            for (let i=1; i<n64; i++) {
                code.push(
                    c.i64_store(
                        c.getLocal("pR"),
                        i*8,
                        c.i64_const(0)
                    )
                );
            }
            return [].concat(...code);
        }
    }

    function buildToMontgomery() {
        const f = module.addFunction(prefix+"_toMontgomery");
        f.addParam("pR", "i32");

        const c = f.getCodeBuilder();

        f.addCode(
            ifMontgomery(c, "pR",
                [  c.ret([]) ],
                [
                    ...ifLong(c, "pR",
                        [
                            ...setType(c, "pR", 0xC0),
                            ...c.call(
                                prefixF+"_toMontgomery",
                                c.i32_add(
                                    c.getLocal("pR"),
                                    c.i32_const(8)
                                ),
                                c.i32_add(
                                    c.getLocal("pR"),
                                    c.i32_const(8)
                                )
                            )
                        ],[
                            ...c.call(
                                prefix+"_rawCopyS2L",
                                c.i32_add(c.getLocal("pR"), c.i32_const(8)),
                                c.i64_load32_s(c.getLocal("pR"))
                            ),
                            ...c.call(
                                prefixF+"_toMontgomery",
                                c.i32_add(
                                    c.getLocal("pR"),
                                    c.i32_const(8)
                                ),
                                c.i32_add(
                                    c.getLocal("pR"),
                                    c.i32_const(8)
                                )
                            ),
                            ...setType(c, "pR", 0x40),
                        ])
                ]
            )
        );

    }


    function buildAdd() {
        const f = module.addFunction(prefix+"_add");
        f.addParam("pR", "i32");
        f.addParam("pA", "i32");
        f.addParam("pB", "i32");
        f.addLocal("r", "i64");
        f.addLocal("overflow", "i64");

        const c = f.getCodeBuilder();

        f.addCode(
            ifLong(c, "pA",
                [  // l1
                    ...ifLong(c, "pB",
                        [  // l1l2
                            ...ifMontgomery(c, "pA",
                                [ // l1ml2
                                    ...ifMontgomery(c, "pB",
                                        [ // l1ml2m
                                            ...setType(c, "pR", 0xC0),
                                            ...addLL(c, "pR", "pA", "pB")
                                        ],[ // l1ml2n
                                            ...toMontgomery(c, "pB"),
                                            ...setType(c, "pR", 0xC0),
                                            ...addLL(c, "pR", "pA", "pB")
                                        ]
                                    )
                                ],[  //l1nl2
                                    ...ifMontgomery(c, "pB",
                                        [ // l1nl2m
                                            ...toMontgomery(c, "pA"),
                                            ...setType(c, "pR", 0xC0),
                                            ...addLL(c, "pR", "pA", "pB")
                                        ],[ // l1nl2n
                                            ...setType(c, "pR", 0x80),
                                            ...addLL(c, "pR", "pA", "pB")
                                        ]
                                    )
                                ]
                            )
                        ],[  // l1s2
                            ...ifMontgomery(c, "pA",
                                [   // l1ms2
                                    ...toMontgomery(c, "pB"),
                                    ...setType(c, "pR", 0xC0),
                                    ...addLL(c, "pR", "pA", "pB")
                                ],[ // l1ns2
                                    ...setType(c, "pR", 0x80),
                                    ...addLS(c, "pR", "pA", "pB")
                                ]
                            )
                        ]
                    )
                ],[  // s1
                    ...ifLong(c, "pB",
                        [  // s1l2
                            ...ifMontgomery(c, "pB",
                                [   // s1l2m
                                    ...toMontgomery(c, "pA"),
                                    ...setType(c, "pR", 0xC0),
                                    ...addLL(c, "pR", "pA", "pB")
                                ],[ // s1l2n
                                    ...setType(c, "pR", 0x80),
                                    ...addLS(c, "pR", "pB", "pA")
                                ]
                            )
                        ],[  // s1s2
                            ...addSS(c, "pR", "pA", "pB")
                        ]
                    )
                ]
            )
        );

        function addLL(c, rL, aL, bL) {
            return c.call(
                prefixF + "_add",
                c.i32_add(c.getLocal(aL), c.i32_const(8)),
                c.i32_add(c.getLocal(bL), c.i32_const(8)),
                c.i32_add(c.getLocal(rL), c.i32_const(8))
            );
        }

        function addSS(c, rL, aL, bL) {
            return [
                ...c.setLocal(
                    "r",
                    c.i64_add(
                        c.i64_load32_s(
                            c.getLocal(aL)
                        ),
                        c.i64_load32_s(
                            c.getLocal(bL)
                        )
                    )
                ),
                ...c.setLocal(
                    "overflow",
                    c.i64_shr_s(
                        c.getLocal("r"),
                        c.i64_const(31)
                    )
                ),
                ...c.if(
                    c.i32_or(
                        c.i64_eqz(c.getLocal("overflow")),
                        c.i64_eqz(c.i64_add(
                            c.getLocal("overflow"),
                            c.i64_const(1)
                        ))
                    ),
                    [
                        ...c.i64_store32(
                            c.getLocal("pR"),
                            c.getLocal("r")
                        ),
                        ...c.i32_store(
                            c.getLocal("pR"),
                            4,
                            c.i32_const(0)
                        )
                    ],[ // Fix overflow
                        ...setType(c, "pR", 0x80),
                        ...c.call(
                            prefix + "_rawCopyS2L",
                            c.i32_add(c.getLocal("pR"), c.i32_const(8)),
                            c.getLocal("r")
                        )

                    ]

                )
            ];
        }

        function addLS(c, rL, aL, bL) {
            return [
                ...c.call(
                    prefix + "_rawCopyS2L",
                    c.i32_const(pTmp+8),
                    c.i64_load32_s(c.getLocal(bL))
                ),
                ...c.call(
                    prefixF + "_add",
                    c.i32_add(c.getLocal(aL), c.i32_const(8)),
                    c.i32_const(pTmp+8),
                    c.i32_add(c.getLocal(rL), c.i32_const(8)),
                )
            ];
        }
    }
    buildCopy();
    buildRawCopyS2L();
    buildToMontgomery();
    buildAdd();

    if (publish) {
        module.exportFunction(prefix + "_copy");
        module.exportFunction(prefix + "_add");
    }


};
