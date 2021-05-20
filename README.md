# sqlite3.js

It's [**`sqlite3`**](https://sqlite.org) built for the web! <sup>(:warning: experimental :warning:)</sup>

------------------------------------------------

`sqlite3.js` is build of `sqlite3` targetting the web, using [`WebAssembly`](https://webassembly.org). 

We compile from the official [`sqlite3` amalgamation file](./src/sqlite3.c), using [`emcc`](http://emscripten.org), to a _standalone `.wasm` file_ <sup>[[1](https://v8.dev/blog/emscripten-standalone-wasm)] [[2](https://github.com/emscripten-core/emscripten/wiki/WebAssembly-Standalone)]</sup>
The advantage of compiling to standalone `wasm` instead of the more _traditional_, full-fledged build using `emcc` is that the builds are very minimal (containing just the raw `sqlite3` library);
no `FS` module emulating a posix filesystem, no pseudo-network stack, no threading, nothing! This works because `sqlite3` itself is [pretty _self-contained_](https://www.sqlite.org/selfcontained.html) and do not
have many (any?) dependency on external environment. To that end, we even [omit the default operating system bindings](https://www.sqlite.org/compile.html#os_other)
that sqlite3 ships with <sup>[[unix](https://sqlite.org/src/file?name=src/os_unix.c&ci=trunk)] [[windows](https://sqlite.org/src/file?name=src/os_win.c&ci=trunk)]</sup>
and provide [our own binding for the `wasm` environment](./src/os_wasm.c) (that utilizes [`wasi`](http://wasi.dev)) and ship a [custom build of `sqlite3`](https://www.sqlite.org/custombuild.html).

`sqlite3` built this way contains just the default  [`memdb`](https://www.sqlite.org/src/file?name=src/memdb.c&ci=trunk). For certain use cases this might be sufficient, but you won't be able to use any existing databases.
To solve that, we also ship with [a slightly modified build of `memvfs`](./src/ext/memvfs.c) <sup>[[source](https://www.sqlite.org/src/file/ext/misc/memvfs.c)]</sup> with some modifications
to allow user to supply an `ArrayBuffer` containing a serialized database and load it into memory.

We also provide [an _HTTP Range-Request based_ read-only `virtual filesystem`](./src/http_vfs.c), inspired from [`phiresky/sql.js-httpvfs`](https://github.com/phiresky/sql.js-httpvfs).
The inner working of this system is _significantly_ different as it's implemented as an _actual_ [`virtual filesystem`](https://www.sqlite.org/vfs.html), providing a more
tight integration with `sqlite3`, without depending on any Posix capabilities.

Even with all these goodies, a standalone `wasm` file isn't terribly useful. We still need some way to interact with it. This is provided using an 
[`RPC`-style service](./lib/worker) over [`Web Worker`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) and 
[an accompanying _frontend_](./lib/index.js) <sup>not _user-interface_ :neutral_face:</sup> to interact with the `Web Worker`. 

Doing `RPC` over `Web Worker` might seem like complicating stuff, but it actually simplify our lives _a lot_! Now we don't have to worry about long running queries
blocking the renderer (causing sluggish ui) or deal with async operations in an inherently synchronous environment.

Future plans are to include more utilities and ship with more community extensions :raised_hands:
