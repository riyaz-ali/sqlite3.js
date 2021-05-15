import * as Comlink from 'comlink';
import { zip, reduce } from 'lodash';

// helper to wrap proxied prepare(...) function.
const prepare = fn => query => fn(query).then(stmt => new Proxy(stmt, statementProxy))

// handler for generated connection proxy
const connectionProxy = {
  get: function(target, prop, receiver) {
    if( prop === 'prepare' ) {
      return prepare(Reflect.get(...arguments));
    }
    return Reflect.get(...arguments);
  }
}

// handler for generated statement proxy
const statementProxy = {
  get: function(target, prop, receiver) {
    if(prop === "iterate") {
      return () => ({ [Symbol.asyncIterator]: () => new StatementIterator(target) })
    }
    return Reflect.get(...arguments);
  }
}

// StatementIterator implements the async iterator protocol for statement objects
const StatementIterator = function(stmt) {
  let columns = stmt.columns()

  return { 
    next: function() {
      return Promise.all([columns, stmt.step()]).then(([columns, has]) => {
        if(has) {
          return stmt.get().then(values => {
            return reduce(zip(columns, values), (x, [column, value]) => {
              x[column] = value; return x
            }, { /* collector */})
          }).then(value => ({ done: false, value }))
        }
        return stmt.reset().then(_ => ({ done: true }))
      })
    }
  }
}

// comlink wrapped proxy for worker
const wrapped = Comlink.wrap(new Worker('./worker/index.js'));

// open is the entrypoint to the package
export function open(buffer) {
  // don't use async/await to reduce dependence on regenerator runtime
  return wrapped.open(buffer).then(connection => {
    return new Proxy(connection, connectionProxy);
  })
}
