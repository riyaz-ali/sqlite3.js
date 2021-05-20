/*
** http_vfs.c implements a read-only virtual filesystem that
** works on http and uses range queries to fetch only necessary
** pages, reducing network traffic and saving on memory (by not having to load whole file into memory)
*/

#include <string.h>
#include <assert.h>
#include <sqlite3.h>
#include <os_wasm.h>

// suppress warnings for unused parameters
#define UNUSED(x) (void)(x)

typedef struct HttpFile HttpFile;

/* An open, stateless, remote file */
struct HttpFile {
  sqlite3_file base;      /* IO methods */
  const char* path;       /* absolute path to the file */
  sqlite3_int64 sz;       /* Size of the file */
};

/** Methods for http vfs */
static int httpOpen(sqlite3_vfs*, const char *, sqlite3_file*, int, int *);
static int httpDelete(sqlite3_vfs*, const char *zName, int syncDir);
static int httpAccess(sqlite3_vfs*, const char *zName, int flags, int *);
static int httpFullPathname(sqlite3_vfs*, const char *zName, int, char *zOut);
static void *httpDlOpen(sqlite3_vfs *pVfs, const char *zPath);
static void httpDlError(sqlite3_vfs *pVfs, int nByte, char *zErrMsg);
static void (*httpDlSym(sqlite3_vfs *pVfs, void *pH, const char *z))(void);
static void httpDlClose(sqlite3_vfs *pVfs, void *pHandle);
static int httpRandomness(sqlite3_vfs*, int nByte, char *zOut);
static int httpGetLastError(sqlite3_vfs*, int, char *);
static int httpCurrentTimeInt64(sqlite3_vfs*, sqlite3_int64*);

/** Methods for http I/O */
static int httpClose(sqlite3_file*);
static int httpRead(sqlite3_file*, void*, int iAmt, sqlite3_int64 iOfst);
static int httpWrite(sqlite3_file*,const void*,int iAmt, sqlite3_int64 iOfst);
static int httpTruncate(sqlite3_file*, sqlite3_int64 size);
static int httpSync(sqlite3_file*, int flags);
static int httpFileSize(sqlite3_file*, sqlite3_int64 *pSize);
static int httpLock(sqlite3_file*, int);
static int httpUnlock(sqlite3_file*, int);
static int httpCheckReservedLock(sqlite3_file*, int *pResOut);
static int httpFileControl(sqlite3_file*, int op, void *pArg);
static int httpSectorSize(sqlite3_file*);
static int httpDeviceCharacteristics(sqlite3_file*);
static int httpFetch(sqlite3_file*, sqlite3_int64 iOfst, int iAmt, void **pp);
static int httpUnfetch(sqlite3_file*, sqlite3_int64 iOfst, void *p);

// http-based vfs implementation of sqlite3_vfs
static sqlite3_vfs http_vfs = {
  2,                    /* iVersion */
  0,                    /* szOsFile (set when registered) */
  2048,                 /* mxPathname */
  0,                    /* pNext */
  "http",               /* zName */
  0,                    /* pAppData */ 
  httpOpen,             /* xOpen */
  httpDelete,           /* xDelete */
  httpAccess,           /* xAccess */
  httpFullPathname,     /* xFullPathname */
  httpDlOpen,           /* xDlOpen */
  httpDlError,          /* xDlError */
  httpDlSym,            /* xDlSym */
  httpDlClose,          /* xDlClose */
  httpRandomness,       /* xRandomness */
  0,                    /* xSleep */
  0,                    /* xCurrentTime */
  httpGetLastError,     /* xGetLastError */
  httpCurrentTimeInt64  /* xCurrentTimeInt64 */
};

// http-based I/O implementation of sqlite3_io_methods
static const sqlite3_io_methods http_io_methods = {
  3,                            /* iVersion */
  httpClose,                    /* xClose */
  httpRead,                     /* xRead */
  httpWrite,                    /* xWrite */
  httpTruncate,                 /* xTruncate */
  httpSync,                     /* xSync */
  httpFileSize,                 /* xFileSize */
  httpLock,                     /* xLock */
  httpUnlock,                   /* xUnlock */
  httpCheckReservedLock,        /* xCheckReservedLock */
  httpFileControl,              /* xFileControl */
  httpSectorSize,               /* xSectorSize */
  httpDeviceCharacteristics,    /* xDeviceCharacteristics */
  0,                            /* xShmMap */
  0,                            /* xShmLock */
  0,                            /* xShmBarrier */
  0,                            /* xShmUnmap */
  httpFetch,                    /* xFetch */
  httpUnfetch                   /* xUnfetch */
};

/*
** Open a new remote file. This first checks to verify for proper access
** and fetch size information. It returns an error if sqlite3 is trying to open
** file for writing, as writing is not supported over http.
*/
static int httpOpen(sqlite3_vfs* vfs, const char *zName, sqlite3_file* pFile, int flags, int *pOutFlags) {
  HttpFile *file = (HttpFile*) pFile;
  memset(file, 0, sizeof(HttpFile));

  if( zName == 0 ) {
    return SQLITE_CANTOPEN; // we don't support creating temp files
  }
  
  if( (flags&SQLITE_OPEN_MAIN_DB) == 0 ) {
    return SQLITE_CANTOPEN; // we do not support opening any object other than main database
  }

  if( (flags&SQLITE_OPEN_EXCLUSIVE) || (flags&SQLITE_OPEN_CREATE) || (flags&SQLITE_OPEN_READWRITE)) {
    return SQLITE_CANTOPEN; // we do not support writing / creating / locking a file
  }

  int access = 0;
  sqlite3_int64 size = 0;
  if( wasm_http_file_stat(zName, &access, &size) != 0 ) {
    return SQLITE_IOERR;
  } else if( !IS_ACCESSIBLE(access) ) {
    return SQLITE_IOERR_ACCESS;
  }
  
  file->base.pMethods = &http_io_methods;
  file->path = zName;
  file->sz = size;

  if( pOutFlags ) {
    *pOutFlags = flags; // we only support read-only files over http
  }

  return SQLITE_OK;
}

/*
** Check if the provided file is accessible over http.
*/
static int httpAccess(sqlite3_vfs* vfs, const char *zName, int flags, int *pResOut) {
  assert(
    flags == SQLITE_ACCESS_EXISTS 
    || flags == SQLITE_ACCESS_READ 
    || flags == SQLITE_ACCESS_READWRITE
  );

  int access = 0;
  if( wasm_http_file_stat(zName, &access, 0) != 0 ) {
    *pResOut = 0;
    return SQLITE_IOERR_ACCESS;
  }

  // must be accessible and support Range-Request
  *pResOut = IS_ACCESSIBLE(access);
  return SQLITE_OK;
}

/*
** Resolve a relative path to the absolute url of the file over http.
*/
static int httpFullPathname(sqlite3_vfs* vfs, const char *zName, int nOut, char *zOut) {
  UNUSED(vfs);
  // we rely on higher level javascript and trust that it'd always pass 
  // absolute value to us. This allows us to not depend on any uri parsing solution in c.
  // It couples this with the javascript but its ok in this case.
  sqlite3_snprintf(nOut, zOut, "%s", zName);
  return SQLITE_OK;
}

/*
** Deleting file is an error as deleting a file over http is not supported.
*/
static int httpDelete(sqlite3_vfs*, const char *zName, int syncDir) {
  return SQLITE_IOERR_DELETE; // deleting a file over http is not supported
}

static int httpGetLastError(sqlite3_vfs* vfs, int a, char *b) {
  return 0; // returns last error that occurred
}

/*
** The following four VFS methods:
**
**   xDlOpen
**   xDlError
**   xDlSym
**   xDlClose
**
** are supposed to implement the functionality needed by SQLite to load
** extensions compiled as shared objects. This http vfs does not support
** this functionality, so the following functions are no-ops.
*/

static void *httpDlOpen(sqlite3_vfs *pVfs, const char *zPath){
  return 0;
}
static void httpDlError(sqlite3_vfs *pVfs, int nByte, char *zErrMsg){
  sqlite3_snprintf(nByte, zErrMsg, "Loadable extensions are not supported");
  zErrMsg[nByte-1] = '\0';
}
static void (*httpDlSym(sqlite3_vfs *pVfs, void *pH, const char *z))(void){
  return 0;
}
static void httpDlClose(sqlite3_vfs *pVfs, void *pHandle){
  return;
}

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

/*
** Closes the open file. As an HttpFile is stateless,
** this is mostly a no-op. Use this to un-allocate any memory that
** you would have allocated.
*/
static int httpClose(sqlite3_file* pFile) {
  HttpFile* file = (HttpFile*)pFile;
  return SQLITE_OK;
}

static int httpRead(sqlite3_file* pFile, void* zBuf, int iAmt, sqlite3_int64 iOfst) {
  HttpFile* file = (HttpFile*) pFile;

  sqlite3_int64 start = iOfst; // start download at the offset
  sqlite3_int64 end = (start+iAmt > file->sz) ? file->sz : start+iAmt;
  if( wasm_http_get_bytes(file->path, zBuf, start, end-1) ){
    return SQLITE_IOERR_READ;
  }

  if( start+iAmt > file->sz ){ // short read
    int a = (start+iAmt) - file->sz;
    memset(zBuf+a, 0, iAmt); // zero-fill the remaining buffer
    return SQLITE_IOERR_SHORT_READ;
  }
  return SQLITE_OK;
}

/*
** Writing is not supported for http vfs and it results in an error.
*/
static int httpWrite(sqlite3_file*,const void*,int iAmt, sqlite3_int64 iOfst) {
  return SQLITE_IOERR_WRITE;
}

/*
** Truncate a file. Since we don't support writing to file,
** it's an error to call truncate.
*/
static int httpTruncate(sqlite3_file*, sqlite3_int64 size) {
  return SQLITE_IOERR_TRUNCATE;
}

/*
** Sync the contents of the file to the persistent media.
** Since we don't support writing to file, it's an error to call sync.
*/
static int httpSync(sqlite3_file*, int flags) {
  return SQLITE_IOERR_FSYNC;
}

/*
** Write the size of the file in bytes to *pSize.
*/
static int httpFileSize(sqlite3_file* pFile, sqlite3_int64 *pSize) {
  HttpFile* file = (HttpFile*)pFile;
  *pSize = file->sz;
  return SQLITE_OK;
}

/*
** Locking functions. The xLock() and xUnlock() methods are both no-ops.
** The xCheckReservedLock() always indicates that no other process holds
** a reserved lock on the database file.
*/
static int httpLock(sqlite3_file*, int eLock){
  return SQLITE_OK;
}
static int httpUnlock(sqlite3_file*, int eLock){
  return SQLITE_OK;
}
static int httpCheckReservedLock(sqlite3_file*, int *pResOut){
  *pResOut = 0;
  return SQLITE_OK;
}

/*
** No xFileControl() verbs are implemented by this VFS.
*/
static int httpFileControl(sqlite3_file*, int op, void *pArg){
  return SQLITE_NOTFOUND;
}

/*
** The xSectorSize() and xDeviceCharacteristics() methods. These two
** may return special values allowing SQLite to optimize file-system 
** access to some extent. But it is also safe to simply return 0.
*/

static int httpSectorSize(sqlite3_file* pFile){
  return 0;
}
static int httpDeviceCharacteristics(sqlite3_file* pFile){
  return 0;
}

/*
** The xFetch() and xUnfetch() methods provide support for
** mmap-based i/o operations. [https://www.sqlite.org/mmap.html]
** Currently, these methods are a no-op but in future we could use this
** space to provide a buffer and minimize network calls.
*/

static int httpFetch(sqlite3_file* pFile, sqlite3_int64 iOfst, int iAmt, void **pp) {
  UNUSED(pFile);
  UNUSED(iOfst);
  UNUSED(iAmt);
  *pp = 0; // returning NULL causes sqlite to invoke xRead()
  return SQLITE_OK;
}

static int httpUnfetch(sqlite3_file* pFile, sqlite3_int64 iOfst, void *p) {
  UNUSED(pFile);
  UNUSED(iOfst);
  UNUSED(p);
  return SQLITE_OK;
}

int sqlite3_http_vfs_init(void) { 
  http_vfs.szOsFile = sizeof(HttpFile);
  return sqlite3_vfs_register(&http_vfs, 0); 
}