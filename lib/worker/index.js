import { expose, proxy } from 'comlink';
import { isArrayBuffer } from 'lodash';
import Connection from './connection';
import { memory, heap } from './sqlite3';

/*
** Open opens a new database connection and returns a reference 
** to the connection object.
*/
const open = function(buffer) {
  let connection; // Connection instance
  if(isArrayBuffer(buffer)) {
    let ptr = heap.malloc(buffer.byteLength);
    let buf = new Uint8Array(buffer);
    let mem = new Uint8Array(memory.buffer);
    mem.set(buf, ptr); // copy the buffer into memory

    connection = new Connection(`file:/buffer?ptr=${ptr}&sz=${buffer.byteLength}&freeonclose=1`,
      65 /* SQLITE_OPEN_READONLY|SQLITE_OPEN_URI */, "memvfs")
  } else {
    connection = new Connection(":memory:", 
      194 /* SQLITE_OPEN_READWRITE|SQLITE_OPEN_URI|SQLITE_OPEN_MEMORY */, "memdb")
  }
  
  // return a comlink proxy so that the other end can interact with connection object natively
  return proxy(connection);
}

// open is the entrypoint to the worker's public api exposed our Comlink
export default expose({ open }, self);
