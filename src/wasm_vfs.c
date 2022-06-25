/*
** wasm_vfs.c implements a partial virtual filesystem that
** provides necessary services using WASM APIs.
*/

#include <string.h>
#include <assert.h>
#include <sqlite3.h>
#include <os_wasm.h>

// suppress warnings for unused parameters
#define UNUSED(x) (void)(x)

/** Methods for wasm vfs */
static int httpRandomness(sqlite3_vfs*, int nByte, char *zOut);
static int httpCurrentTimeInt64(sqlite3_vfs*, sqlite3_int64*);

// wasm-based vfs implementation of sqlite3_vfs
static sqlite3_vfs wasm_vfs = {
  2,                    /* iVersion */
  0,                    /* szOsFile */
  0,                    /* mxPathname */
  0,                    /* pNext */
  "wasm",               /* zName */
  0,                    /* pAppData */ 
  0,                    /* xOpen */
  0,                    /* xDelete */
  0,                    /* xAccess */
  0,                    /* xFullPathname */
  0,                    /* xDlOpen */
  0,                    /* xDlError */
  0,                    /* xDlSym */
  0,                    /* xDlClose */
  httpRandomness,       /* xRandomness */
  0,                    /* xSleep */
  0,                    /* xCurrentTime */
  0,                    /* xGetLastError */
  httpCurrentTimeInt64  /* xCurrentTimeInt64 */
};

/*
** Provides a high quality source for random values
** using Web Crypto API over a wasm interface. It is used by sqlite core
** to request random bytes to be used in various places.
*/
static int httpRandomness(sqlite3_vfs* vfs, int nByte, char *zOut) {
  UNUSED(vfs);
  return wasm_crypto_get_random(zOut, nByte);
}

/*
** Return the current time as Julian day converted into seconds.
** It uses an interface provided over wasm to use javascript api to get current time as unix epoch.
*/
static int httpCurrentTimeInt64(sqlite3_vfs* vfs, sqlite3_int64* piNow) {
  UNUSED(vfs);
  static const sqlite3_int64 unixEpoch = 24405875*(sqlite3_int64)8640000;
  sqlite3_int64 t = wasm_get_unix_epoch();
  *piNow = (t * 1000) + unixEpoch;
  return SQLITE_OK;
}

int sqlite3_wasm_vfs_init(void) { 
  return sqlite3_vfs_register(&wasm_vfs, 0);
}