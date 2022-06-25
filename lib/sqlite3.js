/*
** sqlite3.js loads the built wasm file (synchronously)
** and exports _wrapped_ Javascript equivalent of sqlite3's C API
*/

import { assign, reduce, merge, identity, noop } from 'lodash';
import WASI from './wasi';
import * as environment from './environment';

let loaded = false;

// Proxy constructs a proxy object that is used 
// to guard the exports making sure that the exports ae only valid
// after the wasm module is loaded and the exported values point to the right routines.
const proxy = key => {
  const target = { };

  const _proxy = new Proxy(target, {
    get(obj, prop) {
      if(!loaded)
        throw new Error('sqlite3.wasm is not loaded! use sqlite3.load() to load the wasm module') 
      
      return key? Reflect.get(obj, key) : Reflect.get(obj, prop);
    }
  })

  return { proxy: _proxy, target };
}

// export stack related exported wasm routines
// stack = { alloc: ex.stackAlloc, save: ex.stackSave, restore: ex.stackRestore };
const _stack = proxy();
export const stack = _stack.proxy;

// export heap (dynamic memory) related exported wasm routines
// heap = { malloc: ex.malloc, free: ex.free, sqlite3_malloc64: ex.sqlite3_malloc64, sqlite3_free: ex.sqlite3_malloc };
const _heap = proxy();
export const heap = _heap.proxy;

// export the wasm runtime memory
export const memory = new WebAssembly.Memory({ initial: 256, maximum: 1600 }); // maximum 100MiB

// export the sqlite3 api routines
const _api = proxy();
export default _api.proxy;

// Load performs the one-time setup by downloading the required wasm file,
// compiling it and updating the synchornous exports by revoking the gating proxy.
export function load(fn = identity) {
  if(loaded) return;
  
  const wasi = new WASI(memory, {});
  const path = fn(process.env.WASM_URL);
  
  // request to fetch the wasm module
  const xhr = new XMLHttpRequest();
  xhr.open("GET", path, false /* synchronous request */);
  xhr.responseType = 'arraybuffer';
  xhr.send(null);
  
  const module = new WebAssembly.Module(xhr.response); // compile wasm into native format
  const emscripten = { emscripten_notify_memory_growth: noop, memory: memory };
  const imports = merge({}, wasi.imports, { env: { ...environment, ...emscripten }});
  
  const instance = new WebAssembly.Instance(module, imports);
  wasi.initialize(instance);
  const ex = instance.exports;
  
  loaded = true;
  
  // update the previous exports' bindings
  assign(_stack.target, { alloc: ex.stackAlloc, save: ex.stackSave, restore: ex.stackRestore });
  assign(_heap.target, { malloc: ex.malloc, free: ex.free, sqlite3_malloc64: ex.sqlite3_malloc64, sqlite3_free: ex.sqlite3_malloc });
  
  // filter sqlite3 routines from exports and cwrap them
  const { cwrap } = require('./runtime');
  const routines = require('./routines.json')
  
  assign(_api.target, reduce(routines, (x, { return: ret, args }, name) => { 
      x[name] = cwrap(ex[name], ret, args); return x }, { /* collector */ }));
}