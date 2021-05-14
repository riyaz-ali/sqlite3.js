/*
** os_wasm.c provides a custom build of sqlite3 targetted for WebAssembly.
** See: https://www.sqlite.org/custombuild.html
*/

#include "sqlite3.h"

// suppress warnings for unused parameters
#define UNUSED(x) (void)(x)

extern sqlite3_vfs memdb_vfs; // externally registered in-memory database vfs

// function declared in javascript to provide random values using Web Crypto API
extern int wasm_crypto_get_random(char* out, int n);

// sqlite3_vfs xRandomness compatible function that calls into javascript 
int wasmRandomness(sqlite3_vfs *vfs, int nByte, char *zOut) {
  UNUSED(vfs);
  return wasm_crypto_get_random(zOut, nByte);
}

/*
** sqlite3_os_init(...) is invoked by sqlite3 core to perform
** os-level intializations and setup the underlying os interface.
*/
int sqlite3_os_init(void) {
  // override random bytes generator
  // since we do not have any alternate vfs registered
  // xRandomness in memdb_vfs would segfault
  memdb_vfs.xRandomness = wasmRandomness;
  return sqlite3_vfs_register(sqlite3_vfs_find("memdb"), 1 /* make default */);
}

/*
** sqlite3_os_end(...) is invoked by sqlite3 core to perform
** unintialization and shutdown the underlying os interface.
*/
int sqlite3_os_end(void) {
  return SQLITE_OK;
}
