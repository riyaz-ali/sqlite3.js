import * as _ from 'lodash';
import sqlite3, { memory, heap } from './sqlite3';

// helper routine that throws an error if rc !== SQLITE_OK
const _throwIf = rc => { if(rc !== 0) { throw new Error(sqlite3.sqlite3_errstr(rc)) } }

// bind is a helper function to bind val at pos with appropriate type call
const bind = function(stmt, pos, val) {
  if(_.isString(val)) {
    // we use SQLITE_TRANSIENT to bind string; this causes sqlite3 to make a local copy of the string
    // and is bit easier to deal with for us. But this causes increase overhead of copying (and memory)
    // @TODO: find a more sustainable alternative to SQLITE_TRANSIENT
    _throwIf(sqlite3.sqlite3_bind_text(stmt, pos, val, val.length, -1 /* SQLITE_TRANSIENT */));
  } else if(_.isNumber(val) || _.isBoolean(val)) {
    let fn = (val === (val | 0)) || _.isBoolean(val)? sqlite3.sqlite3_bind_int : sqlite3.sqlite3_bind_double;
    _throwIf(fn(stmt, pos, val));
  } else if(_.isArrayBuffer(val)) {
    let ptr = heap.malloc(val.byteLength); // allocate a region on heap
    let mem = new Uint8Array(memory.buffer); // create a view on heap
    mem.set(val, ptr); // copy the value onto heap
    let rc = sqlite3.sqlite3_bind_blob(stmt, pos, ptr, val.byteLength, -1 /* SQLITE_TRANSIENT */); // @TODO: fix me
    heap.free(ptr);
    _throwIf(rc)
  } else if (_.isNull(val)) {
    _throwIf(sqlite3.sqlite3_bind_null(stmt, pos));
  } else {
    throw new Error(`unsupported type: ${typeof val}`)
  }
}

/*
** Statement object represents an individual, compiled query / statement.
** It's analogous to sqlite3_stmt in C.
*/
export default class Statement {

  // create a new statement object.
  // this is a protected constructor and should only be
  // called by Connection#prepare
  constructor(connection, ref) { 
    this.connection = connection; 
    this.handle = ref; 
  }

  // BindParams bind arguments to this statement. It resets the statement
  // clearing any previous binding. If the passed in argument is an array
  // then it uses anonymous / position-based binding, else it uses named parameters
  // using object keys as parameter name.
  bindParams(params) {
    if(_.isArray(params)) {
      _.each(params, (param, idx) => bind(this.handle, idx+1, param)) // params are 1-indexed
    } else if(!_.isNull(params)) {
      _.each(params, (param, name) => {
        let idx = sqlite3.sqlite3_bind_parameter_index(this.handle, name);
        if(idx !== 0) {
          bind(this.handle, idx, param)
        }
      })
    }
  }

  // Step steps through the statement's execution using sqlite3_step function
  step() {
    let rc = sqlite3.sqlite3_step(this.handle);
    if(rc !== 100 /* SQLITE_ROW */ && rc !== 101 /* SQLITE_DONE */) {
      throw new Error(sqlite3.sqlite3_errmsg(this.connection.handle));
    }
    return rc === 100? true : false; // wheter the execution returned any rows
  }

  // Get returns all the values in current cursor from the 
  // resultset as an array indexed by column position
  get() {
    let results = [];
    let n = sqlite3.sqlite3_data_count(this.handle);
    for (let pos = 0; pos < n; pos += 1) {
      switch (sqlite3.sqlite3_column_type(this.handle, pos)) {
        case 1: /* SQLITE_INTEGER */
        case 2: /* SQLITE_FLOAT */ { 
          results.push(sqlite3.sqlite3_column_double(this.handle, pos));
        } break;
        case 3: /* SQLITE_TEXT */ {
          results.push(sqlite3.sqlite3_column_text(this.handle, pos));
        } break;
        case 4: /* SQLITE_BLOB */ {
          let size = sqlite3.sqlite3_column_bytes(this.handle, pos);
          let ptr = sqlite3.sqlite3_column_blob(this.handle, pos);
          let buf = new Uint8Array(size);
          
          // copy values into buffer
          let heap = new Uint8Array(memory.buffer, ptr, ptr+size)
          buf.set(heap);
          results.push(buf);
        } break;
        default: /* SQLITE_NULL */ {
          results.push(null);
        }
      }
    }
    return results;
  }

  // Columns returns an array of column names in the resultset
  columns() {
    let results = [];
    let n = sqlite3.sqlite3_column_count(this.handle);
    for (let i = 0; i < n; i += 1) {
      results.push(sqlite3.sqlite3_column_name(this.handle, i));
    }
    return results;
  }

  // Reset resets a statement, so that it's parameters can be bound to new values.
  // It also clears all previous bindings using sqlite3_clear_bindings
  reset() {
    _throwIf(sqlite3.sqlite3_reset(this.handle))
    _throwIf(sqlite3.sqlite3_clear_bindings(this.handle))
  }

  // Finalize destroys the stmt and unsets the reference making it invalid
  finalize() {
    let rc = sqlite3.sqlite3_finalize(this.handle);
    this.handle = 0;
    if(rc !== 0) {
      throw new Error(sqlite3.sqlite3_errstr(rc));
    }
  }
}