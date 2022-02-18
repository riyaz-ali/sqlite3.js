# sqlite3.js

[![](https://data.jsdelivr.com/v1/package/gh/riyaz-ali/sqlite3.js/badge)](https://www.jsdelivr.com/package/gh/riyaz-ali/sqlite3.js)

It's [**`sqlite3`**](https://sqlite.org) built for the web! <sup>(:warning: experimental :warning:)</sup>

------------------------------------------------

`sqlite3.js` is build of `sqlite3` targetting the web, using [`WebAssembly`](https://webassembly.org). 

We compile from the official [`sqlite3` amalgamation file](./src/sqlite3.c), using [`emcc`](http://emscripten.org), to a _standalone `.wasm` file_ <sup>[[1]](https://v8.dev/blog/emscripten-standalone-wasm) [[2]](https://github.com/emscripten-core/emscripten/wiki/WebAssembly-Standalone)</sup> This works because `sqlite3` itself is [pretty _self-contained_](https://www.sqlite.org/selfcontained.html) and do not
have many (any?) dependency on external environment. To that end, we even [omit the default operating system bindings](https://www.sqlite.org/compile.html#os_other)
that sqlite3 ships with <sup>[[unix]](https://sqlite.org/src/file?name=src/os_unix.c&ci=trunk) [[windows]](https://sqlite.org/src/file?name=src/os_win.c&ci=trunk)</sup>
and provide [our own binding for the `wasm` environment](./src/os_wasm.c) (that utilizes [`wasi`](http://wasi.dev)) and ship a [custom build of `sqlite3`](https://www.sqlite.org/custombuild.html).

`sqlite3` built this way contains the default  [`memdb`](https://www.sqlite.org/src/file?name=src/memdb.c&ci=trunk). We allow the user to pass in a serialized copy of the database as an `ArrayBuffer` and load it into memory.

We also provide [an _HTTP Range-Request based_ read-only `virtual filesystem`](./src/http_vfs.c), inspired from [`phiresky/sql.js-httpvfs`](https://github.com/phiresky/sql.js-httpvfs).
The inner working of this system is _significantly_ different as it's implemented as an _actual_ [`virtual filesystem`](https://www.sqlite.org/vfs.html), providing a more tight integration with `sqlite3`, without depending on any Posix capabilities.

Future plans are to include more utilities and ship with more community extensions :raised_hands:

## Usage

Although technically possible, you should always try to import and use `sqlite3.js` from within a `Worker` instance only. 
This is because `sqlite3`'s API is synchronous and will block the main browser thread causing sluggish UI performance, or even crashes.

```javascript
// ... in a Web Worker
importScript('https://cdn.jsdelivr.net/gh/riyaz-ali/sqlite3.js@<release>/dist/sqlite3.js')
await sqlite3.load(file => `https://cdn.jsdelivr.net/gh/riyaz-ali/sqlite3.js@<release>/dist/${file}`)

// open a new connection
let connection = new sqlite3.open(); // opens a new in-memory connection

// let's try out a query
let stmt = connection.prepare("SELECT DATE('now') AS now");
stmt.step();
stmt.columns();  // returns ["now"]
stmt.get(); // returns ["2021-02-18"] as of date of writing...
```

You can also pass an existing database to `sqlite3.open()` call, and / or also download a serialized copy later.

```javascript
// ... assuming initialization is already done

// fetch a serialized copy of the chinook database
const chinook = await fetch('...').then(resp => resp.arrayBuffer());
let connection = new sqlite3.open(chinook);

let stmt = connection.prepare('SELECT * FROM employee');
while(stmt.step()) { console.log(stmt.get()) } // will print out each row to console
stmt.finalize(); // close the statement handle

const buffer = connection.serialize();
// ... buffer is an ArrayBuffer containing serialized copy of the database file
```
