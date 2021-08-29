/*
** environment.js provides runtime dependencies for wasm module.
** It provides implementation of methods that C code callbacks into
** when it needs to interact with the _environment_
*/

import Pointer from './pointer';
import { memory } from './sqlite3'; // delibrate circular imports
import { UTF8ToString } from './runtime';

// wasm_crypto_get_random provides implementation of 
// C extern function with similar name defined in src/os_wasm.h
// It generates n random bytes and puts it onto the instance's memory
// starting at ptr.
export function wasm_crypto_get_random(ptr, n) {
  let view = new Int8Array(memory.buffer, ptr, n);
  crypto.getRandomValues(view); // mutates in place
  return view.byteLength;
}

// wasm_get_unix_epoch provides implementation of
// C extern function with similar name defined in src/os_wasm.h
// It returns the current unix epoch time as number of milliseconds.
export function wasm_get_unix_epoch() { return BigInt(Math.round(Date.now() / 1000)) }

// checks for nullptr before calling set(...)
const safeSet = (ptr, ...args) => { if(ptr.p !== 0) ptr.set(...args) }

// wasm_http_file_stat provides implementation of
// C extern function with similar name defined in src/os_wasm.h
// It returns the stat information about the remote file passed in as argument.
export function wasm_http_file_stat(i0, o0, o1) {
  const heap = new Uint8Array(memory.buffer);

  const path = UTF8ToString(heap, i0);
  const access = new Pointer(memory, o0);
  const size = new Pointer(memory, o1);

  let xhr = new XMLHttpRequest();
  xhr.open("HEAD", path, false /* synchronous request */);
  xhr.send();

  if (xhr.status !== 200) { // server must respond with 200
    safeSet(access, 0);
    safeSet(size, 0);
    return 0;
  }

  let contentLength = parseInt(xhr.getResponseHeader("Content-Length"), 10);
  safeSet(size, contentLength);

  let accessFlags = 1; // we know file exists .. just need to check if server supports range requests
  let acceptRanges = xhr.getResponseHeader('Accept-Ranges');
  if(acceptRanges !== 'bytes') {
    accessFlags |= 16;
  }
  safeSet(access, accessFlags);
  return 0;
}

// wasm_http_get_bytes provides implementation of
// C extern function with similar name defined in src/os_wasm.h
export function wasm_http_get_bytes(i0, i1, start, end) {
  const heap = new Uint8Array(memory.buffer);

  const path = UTF8ToString(heap, i0);
  const buf  = new Uint8Array(memory.buffer);

  let xhr = new XMLHttpRequest();
  xhr.open("GET", path, false /* synchronous request */);
  xhr.responseType = 'arraybuffer';
  xhr.setRequestHeader('Range', `bytes=${start}-${end}`);
  xhr.send();
  
  if(xhr.status !== 206) { // ensure request succeeded
    return 1;
  }

  buf.set(new Uint8Array(xhr.response), i1);
  return 0;
}

// wasm_console_log provides implementation of
// C extern function with similar name defined in src/os_wasm.h
// This function provides a sink for log messages originating from sqlite3
// core and extensions.
export function wasm_console_log(i0, i1) {
  const heap = new Uint8Array(memory.buffer);

  const code = i0;
  const msg = UTF8ToString(heap, i1);

  console.log(`sqlite3: code=${code} msg=${msg}`);
}
