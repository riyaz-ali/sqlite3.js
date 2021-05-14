/*
** sqlite3.js loads the built wasm file (synchronously)
** and exports _wrapped_ Javascript equivalent of sqlite3's C API
*/

import { reduce, merge } from 'lodash';
import WASI from '@wasmer/wasi';
import bindings from '@wasmer/wasi/lib/bindings/browser';
import { wasm_crypto_get_random } from './environment';

// @wasmer/wasi provides an implementation of WASI (https://wasi.dev) interface
let wasi = new WASI({ bindings });

// request to fetch the wasm module
let xhr = new XMLHttpRequest();
xhr.open("GET", `${process.env.WASM_URL}`, false /* synchronous request */);
xhr.responseType = 'arraybuffer';
xhr.send(null);

if(xhr.status !== 200) { // ensure request succeeded
  throw new Error(`failed to load file: server returned ${xhr.statusText}`)
}

let bytes = xhr.response;
let module = new WebAssembly.Module(bytes); // compile wasm into native format

let imports = merge({}, wasi.getImports(module), {
  env: {
    wasm_crypto_get_random, // random bytes generator
  }
})

let instance = new WebAssembly.Instance(module, imports);
let ex = instance.exports;

// export stack related exported wasm routines
export const stack = { alloc: ex.stackAlloc, save: ex.stackSave, restore: ex.stackRestore };

// export the auto-allocated wasm memory (this is allocated by compiler during build time)
export const memory = ex.memory

// filter sqlite3 routines from exports and cwrap them
let routines = require('./routines.json')

// delibrate position of this import; this is a circular reference
import { cwrap } from './runtime';

// export the sqlite3 api routines
export default reduce(routines, (x, { return: ret, args }, name) => { 
  x[name] = cwrap(ex[name], ret, args); return x }, { /* collector */ });
