/*
** os_wasm.c provides a custom build of sqlite3 targetted for WebAssembly.
** See: https://www.sqlite.org/custombuild.html
*/

#include <sqlite3.h>
#include <os_wasm.h>

extern int sqlite3_wasm_vfs_init(void); // defined in wasm_vfs.c to register http vfs

// statically linked extensions' entrypoints
extern int sqlite3_series_init(sqlite3*, char**, const sqlite3_api_routines *);

/*
** sqlite3_os_init(...) is invoked by sqlite3 core to perform
** os-level intializations and setup the underlying os interface.
*/
int sqlite3_os_init(void) {
  int rc = SQLITE_OK;
  
  rc = sqlite3_wasm_vfs_init();
  if(rc != SQLITE_OK) { return rc; }

  // register statically linked extensions
  sqlite3_auto_extension(sqlite3_series_init);

  return rc;
}

/*
** sqlite3_os_end(...) is invoked by sqlite3 core to perform
** unintialization and shutdown the underlying os interface.
*/
int sqlite3_os_end(void) { return SQLITE_OK; }
