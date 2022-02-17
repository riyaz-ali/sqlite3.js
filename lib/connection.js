import Pointer from './pointer';
import sqlite3, { memory, stack } from './sqlite3';
import Statement from './statement';

/*
** Connection represents an individual database connection.
** It is analogous to sqlite3 object in C.
*/
export default class Connection {
  
  // open a new database connection
  constructor(uri, flags, vfs) {
    let esp = stack.save();
    let ptr = new Pointer(memory, stack.alloc(4));
    let rc = sqlite3.sqlite3_open_v2(uri, ptr.p, flags, vfs);
    if(rc !== 0) { // !== SQLITE_OK
      let msg = ptr.get() !== 0 ? 
        sqlite3.sqlite3_errmsg(ptr.get()) : 
        sqlite3.sqlite3_errstr(rc);
      
      throw new Error(msg);
    }

    this.handle = ptr.get(); // save the reference to the database
    stack.restore(esp);
  }

  // Prepare prepares / compiles the provided query returning the
  // resulting statement object.
  prepare(query) {
    let esp = stack.save();
    let ptr = new Pointer(memory, stack.alloc(4));
    let tail = new Pointer(memory, stack.alloc(4));
    let rc = sqlite3.sqlite3_prepare_v2(this.handle, query, -1 /* read in until nullptr */, ptr.p, tail.p);
    if(rc !== 0) { // !== SQLITE_OK
      throw new Error(sqlite3.sqlite3_errstr(rc));
    } else if (tail.get() !== 0) {
      // throw new Error('multiple statements not supported');
    }
    
    let stmt = new Statement(this, ptr.get());
    stack.restore(esp);
    return stmt;
  }

  // Serialize serilizes the database using sqlite3_serialize interface
  // and returns an ArrayBuffer containing the serialized view of the database
  serialize() {
    let esp = stack.save();

    let size = new Pointer(memory, stack.alloc(8)); // to hold the size of the buffer
    const ptr = sqlite3.sqlite3_serialize(this.handle, "main", size.p, 0);
    if(ptr === 0) {
      // it's likely that sqlite3_serialize failed to allocate memory
      const message = sqlite3.sqlite3_errmsg(this.handle);
      throw new Error(message);
    }

    const out = new ArrayBuffer(size.get());
    let buf = new Uint8Array(out);
    let mem = new Uint8Array(memory.buffer, ptr, size.get());
    buf.set(mem); // copy from memory into output buffer

    stack.restore(esp);
    return out;
  }
}
