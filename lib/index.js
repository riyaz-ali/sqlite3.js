import { isArrayBuffer, isString } from 'lodash';
import Connection from './connection';
import sqlite3, { memory, heap } from './sqlite3';

export { load } from './sqlite3';

/*
** Open opens a new database connection and returns a reference 
** to the connection object.
*/
export function open(arg) {
  let rc = sqlite3.sqlite3_initialize(); // explicitly initialize the library
  if(rc !== 0 /* SQLITE_OK */) {
    throw new Error(`failed to initialize sqlite3: ${sqlite3.sqlite3_errstr(rc)}`);
  }

  if(isString(arg)) {
    // we treat string based arguments as path to remote file and default to use http vfs
    return new Connection(arg, 0x01 /* SQLITE_OPEN_READONLY */, "http")
  }

  // open an in-memory database connection
  const connection = new Connection(":memory:", 0xc2 /* SQLITE_OPEN_READWRITE|SQLITE_OPEN_URI|SQLITE_OPEN_MEMORY */, "memdb");
  
  if(isArrayBuffer(arg)) {
    const bufferSize = BigInt(arg.byteLength);
    const deserializeFlags = 0x11;  // SQLITE_DESERIALIZE_FREEONCLOSE|SQLITE_DESERIALIZE_RESIZEABLE

    // allocate the memory using sqlite3's memory management routine
    // as this region is later on freed using sqlite3_free (automatically as we use SQLITE_DESERIALIZE_FREEONCLOSE)
    let ptr = heap.sqlite3_malloc64(bufferSize);
    
    let buf = new Uint8Array(arg);
    let mem = new Uint8Array(memory.buffer);
    mem.set(buf, ptr); // copy the buffer into memory

    let rc = sqlite3.sqlite3_deserialize(connection.handle, "main", ptr, bufferSize, bufferSize, deserializeFlags);
    if(rc !== 0) { // !== SQLITE_OK
      throw new Error(sqlite3.sqlite3_errstr(rc));
    }
  }
  
  return connection;
}
