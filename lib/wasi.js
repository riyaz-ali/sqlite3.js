/*
 ** WASI.js - implements a minimal WASI interface; just enough for our use case!
 */

import { partial } from 'lodash';
import { Buffer } from 'buffer';

// adapted from https://is.gd/x7M80e
export default class WASI {
  constructor(memory, env) {
    this.memory = memory;

    //- return codes
    this.WASI_ERRNO_SUCCESS = 0;
    this.WASI_ERRNO_BADF = 8;
    this.WASI_ERRNO_NOSYS = 52;
    this.WASI_ERRNO_INVAL = 28;
    this.WASI_FILETYPE_CHARACTER_DEVICE = 2;
    this.WASI_RIGHTS_FD_SYNC = 1 << 4;
    this.WASI_RIGHTS_FD_WRITE = 1 << 6;
    this.WASI_RIGHTS_FD_FILESTAT_GET = 1 << 21;
    this.WASI_FDFLAGS_APPEND = 1 << 0;

    // WASI namespace and the corresponding functions
    this.nameSpaces = {
      wasi_snapshot_preview1: {
        args_get: undefined,
        args_sizes_get: undefined,

        clock_res_get: this.clock_res_get,
        clock_time_get: this.clock_time_get,

        environ_get: partial(this.environ_get, env),
        environ_sizes_get: partial(this.environ_sizes_get, env),

        fd_advise: undefined,
        fd_allocate: undefined,
        fd_close: undefined,
        fd_datasync: undefined,
        fd_fdstat_get: this.fd_fdstat_get,
        fd_fdstat_set_flags: undefined,
        fd_fdstat_set_rights: undefined,
        fd_filestat_get: undefined,
        fd_filestat_set_size: undefined,
        fd_filestat_set_times: undefined,
        fd_pread: undefined,
        fd_prestat_dir_name: undefined,
        fd_prestat_get: undefined,
        fd_pwrite: undefined,
        fd_read: undefined,
        fd_readdir: undefined,
        fd_renumber: undefined,
        fd_seek: undefined,
        fd_sync: undefined,
        fd_tell: undefined,
        fd_write: this.fd_write,

        path_create_directory: undefined,
        path_filestat_get: undefined,
        path_filestat_set_times: undefined,
        path_link: undefined,
        path_open: undefined,
        path_readlink: undefined,
        path_remove_directory: undefined,
        path_rename: undefined,
        path_symlink: undefined,
        path_unlink_file: undefined,

        poll_oneoff: undefined,

        proc_exit: undefined,
        proc_raise: undefined,

        random_get: undefined,

        sched_yield: undefined,

        sock_recv: undefined,
        sock_send: undefined,
        sock_shutdown: undefined,
      },
    };

    // for each function in the namespace, update the bindings
    for (const ns of Object.keys(this.nameSpaces)) {
      const nameSpace = this.nameSpaces[ns];

      for (const fn of Object.keys(nameSpace)) {
        const func = nameSpace[fn] || this.nosys(fn);
        nameSpace[fn] = func.bind(this);
      }
    }
  }

  initialize(instance) {
    instance.exports._initialize();
  }

  get imports() {
    return this.nameSpaces;
  }

  nosys(name) {
    return (...args) => {
      console.error(`Unimplemented call to ${name}(${args.toString()})`);
      return this.WASI_ERRNO_NOSYS;
    };
  }

  clock_res_get(id, resOut) {
    if (id !== 0) return this.WASI_ERRNO_INVAL;
    const view = new DataView(this.memory.buffer);
    view.setUint32(resOut, 1000000.0 % 0x100000000, true);
    view.setUint32(resOut + 4, 1000000.0 / 0x100000000, true);
    return this.WASI_ERRNO_SUCCESS;
  }

  clock_time_get(id, precision, timeOut) {
    if (id !== 0) return this.WASI_ERRNO_INVAL;
    const view = new DataView(this.memory.buffer)
    const now = new Date().getTime();
    view.setUint32(timeOut, (now * 1000000.0) % 0x100000000, true);
    view.setUint32(timeOut + 4, (now * 1000000.0) / 0x100000000, true);
    return this.WASI_ERRNO_SUCCESS;
  }

  environ_get(env, environ, environBuf) {
    const dataView = new DataView(this.memory.buffer);

    let coffset = environ;
    let offset = environBuf;

    Object.entries(env).forEach(
      ([key, value]) => {
        dataView.setUint32(coffset, offset, true);
        coffset += 4;
        offset += Buffer.from(this.memory.buffer)
          .write(`${key}=${value}\0`, offset);
      }
    );
  }

  environ_sizes_get(env, environCount, environBufSize) {
    const processed = Object.entries(env).map(
      ([key, value]) => `${key}=${value}\0`
    );
    const size = processed.reduce((acc, e) => acc + Buffer.byteLength(e), 0);

    const dataView = new DataView(this.memory.buffer);
    dataView.setUint32(environCount, processed.length, true);
    dataView.setUint32(environBufSize, size, true);

    return this.WASI_ERRNO_SUCCESS;
  }

  fd_fdstat_get(fd, fdstat) {
    if (fd > 2) return this.WASI_ERRNO_BADF;
    const view = new DataView(this.memory.buffer);
    view.setUint8(fdstat, this.WASI_FILETYPE_CHARACTER_DEVICE);
    view.setUint16(fdstat + 2, this.WASI_FDFLAGS_APPEND, true);
    view.setUint16(
      fdstat + 8,
      this.WASI_RIGHTS_FD_SYNC |
        this.WASI_RIGHTS_FD_WRITE |
        this.WASI_RIGHTS_FD_FILESTAT_GET,
      true
    );
    view.setUint16(fdstat + 16, 0, true);
    return this.WASI_ERRNO_SUCCESS;
  }

  fd_write(fd, iovs, iovsLen, nwritten) {
    if (fd > 2) return this.WASI_ERRNO_BADF;
    const view = new DataView(this.memory.buffer);
    const memory = this.memory;
    const buffers = [];
    for (let i = 0; i < iovsLen; i++) {
      const iov = iovs + i * 8;
      const offset = view.getUint32(iov, true);
      const len = view.getUint32(iov + 4, true);
      buffers.push(new Uint8Array(memory.buffer, offset, len));
    }
    const length = buffers.reduce((s, b) => s + b.length, 0);
    const buffer = new Uint8Array(length);
    let offset = 0;
    buffers.forEach((b) => {
      buffer.set(b, offset);
      offset += b.length;
    });
    const string = new TextDecoder("utf-8").decode(buffer).replace(/\n$/, "");
    if (fd === 1) console.log(string);
    else console.error(string);
    view.setUint32(nwritten, buffer.length, true);
    return this.WASI_ERRNO_SUCCESS;
  }
}
