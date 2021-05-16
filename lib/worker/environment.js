/*
** environment.js provides runtime dependencies for wasm module.
** It provides implementation of methods that C code callbacks into
** when it needs to interact with the _environment_
*/

import { memory } from './sqlite3'; // delibrate circular imports

// wasm_crypto_get_random provides implementation of 
// C extern function with similar name defined in src/underlay_vfs.c
// It generates n random bytes and puts it onto the instance's memory
// starting at ptr.
export function wasm_crypto_get_random(n, ptr) {
  let view = new Int8Array(memory.buffer, ptr, n);
  crypto.getRandomValues(view); // mutates in place
  return view.byteLength;
}

// wasm_get_unix_epoch provides implementation of
// C extern function with similar name defined in src/underlay_vfs.c
// It returns the current unix epoch time as number of milliseconds.
export function wasm_get_unix_epoch() { return BigInt(Math.round(Date.now() / 1000)) }
