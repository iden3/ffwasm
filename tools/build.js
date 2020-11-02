const fs = require("fs");
const ModuleBuilder = require("wasmbuilder").ModuleBuilder;
const ModuleBuilderWat = require("wasmbuilder").ModuleBuilderWat;
const buildWasmFf = require("../index.js").buildWasmFf;
const bigInt = require("big-integer");

var argv = require("yargs")
    .usage("Usage: $0 -q [primeNum] -n [name] -os [out .wasm file] -ot [out .wat file]")
    .demandOption(["q","n"])
    .alias("q", "prime")
    .alias("n", "name")
    .argv;

const q = bigInt(argv.q);

const wasmFilename =  (argv.ow) ? argv.oc : argv.name.toLowerCase() + ".wasm";
const watFilename =  (argv.ot) ? argv.oc : argv.name.toLowerCase() + ".wat";


const res = buildField(q, argv.name);
fs.writeFileSync(wasmFilename, Buffer.from(res.code));
fs.writeFileSync(watFilename, res.wat, "utf8");

function buildField(prime, name) {

    const res = {};
    const module = new ModuleBuilder();
    module.setMemory(1000);
    buildWasmFf(module, name , prime, true);
    res.code = module.build();

    const moduleWat = new ModuleBuilderWat();
    moduleWat.setMemory(1000);
    buildWasmFf(moduleWat, name, prime, true);
    res.wat = writeCode(moduleWat.build());

    return res;
}

function writeCode(c) {
    if (c.push) {
        const arr = [];
        for (let i=0; i<c.length; i++) {
            arr.push(writeCode(c[i]));
        }
        return arr.join("");
    } else if (typeof c === "string") {
        return c + "\n";
    }
}



