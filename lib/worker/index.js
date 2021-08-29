import { isArrayBuffer, isString } from 'lodash';
import Connection from './connection';
import sqlite3, { memory, heap } from './sqlite3';

/*
** Open opens a new database connection and returns a reference 
** to the connection object.
*/
export default function open(arg) {
  let rc = sqlite3.sqlite3_initialize(); // explicitly initialize the library
  if(rc !== 0 /* SQLITE_OK */) {
    throw new Error(`failed to initialize sqlite3: ${sqlite3.sqlite3_errstr(rc)}`);
  }

  let connection; // Connection instance
  if(isArrayBuffer(arg)) {
    const buffer = arg;
    let ptr = heap.malloc(buffer.byteLength);
    let buf = new Uint8Array(buffer);
    let mem = new Uint8Array(memory.buffer);
    mem.set(buf, ptr); // copy the buffer into memory

    connection = new Connection(`file:/buffer?ptr=${ptr}&sz=${buffer.byteLength}&freeonclose=1`,
      0x42 /* SQLITE_OPEN_READWRITE|SQLITE_OPEN_URI */, "memvfs")
  } else if(isString(arg)) {
    const path = arg;
    connection = new Connection(path, 0x01 /* SQLITE_OPEN_READONLY */, "http")
  } else {
    connection = new Connection(":memory:", 
      0xc2 /* SQLITE_OPEN_READWRITE|SQLITE_OPEN_URI|SQLITE_OPEN_MEMORY */, "memdb")
  }
  
  return connection;
}
