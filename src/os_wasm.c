/*
** os_wasm.c provides a custom build of sqlite3 targetted for WebAssembly.
** See: https://www.sqlite.org/custombuild.html
*/

#include <sqlite3.h>
#include <os_wasm.h>

extern int sqlite3_http_vfs_init(void); // defined in http_vfs.c to register http vfs

// statically linked extensions' entrypoints
extern int sqlite3_series_init(sqlite3*, char**, const sqlite3_api_routines *);

// deflect calls to function defined in javascript
void wasm_console_log_deflector(void* p, int code, char* msg) {
  wasm_console_log(code, msg);
}

/*
** sqlite3_os_init(...) is invoked by sqlite3 core to perform
** os-level intializations and setup the underlying os interface.
*/
int sqlite3_os_init(void) {
  int rc = SQLITE_OK;
  
  rc = sqlite3_http_vfs_init();
  if(rc != SQLITE_OK) { return rc; }

  // configure logging sink
  sqlite3_config(SQLITE_CONFIG_LOG, wasm_console_log_deflector, (void*)0);

  // register statically linked extensions
  sqlite3_auto_extension(sqlite3_series_init);

  return rc;
}

/*
** sqlite3_os_end(...) is invoked by sqlite3 core to perform
** unintialization and shutdown the underlying os interface.
*/
int sqlite3_os_end(void) { return SQLITE_OK; }
