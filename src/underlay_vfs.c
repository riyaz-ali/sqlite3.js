/*
** underlay_vfs.c provides an abstract vfs implementation that provides
** implementation of various non-io, os-level functionality such as
** fetching the current time, etc.
*/

#include <sqlite3.h>

// suppress warnings for unused parameters
#define UNUSED(x) (void)(x)

// function declared in javascript
extern int wasm_crypto_get_random(char* out, int n); // provide random values using Web Crypto API
extern sqlite3_int64 wasm_get_unix_epoch(void); // provide current unix epoch timestamp (in millis)

// methods for underlay vfs
static int underlayRandomness(sqlite3_vfs*, int nByte, char *zOut);
static int underlayCurrentTimeInt64(sqlite3_vfs*, sqlite3_int64*);
static int underlayGetLastError(sqlite3_vfs*, int, char *);

// abstract vfs that provides common underlying, os-level functionality
static sqlite3_vfs underlay_vfs = {
  3,                            /* iVersion */
  0,                            /* szOsFile */
  0,                            /* mxPathname */
  0,                            /* pNext */
  "underlay",                   /* zName */
  0,                            /* pAppData */ 
  0,                            /* xOpen */
  0,                            /* xDelete */
  0,                            /* xAccess */
  0,                            /* xFullPathname */
  0,                            /* xDlOpen */
  0,                            /* xDlError */
  0,                            /* xDlSym */
  0,                            /* xDlClose */
  underlayRandomness,           /* xRandomness */
  0,                            /* xSleep */
  0,                            /* xCurrentTime */
  underlayGetLastError,         /* xGetLastError */
  underlayCurrentTimeInt64,     /* xCurrentTimeInt64 */
  0,                            /* xSetSystemCall */
  0,                            /* xGetSystemCall */
  0                             /* xNextSystemCall */
};

static int underlayRandomness(sqlite3_vfs* vfs, int nByte, char *zOut) {
  UNUSED(vfs);
  return wasm_crypto_get_random(zOut, nByte);
}

static int underlayCurrentTimeInt64(sqlite3_vfs* vfs, sqlite3_int64* piNow) {
  UNUSED(vfs);
  static const sqlite3_int64 unixEpoch = 24405875*(sqlite3_int64)8640000;
  sqlite3_int64 t = wasm_get_unix_epoch();
  *piNow = (t * 1000) + unixEpoch;
  return SQLITE_OK;
}

static int underlayGetLastError(sqlite3_vfs *NotUsed, int NotUsed2, char *NotUsed3) {
  UNUSED(NotUsed);
  UNUSED(NotUsed2);
  UNUSED(NotUsed3);
  return 0; // not supported
}


// register underlay but don't make it default
int sqlite3_underlay_vfs_init(void){ return sqlite3_vfs_register(&underlay_vfs, 1); }
