/*
** os_wasm.c provides a custom build of sqlite3 targetted for WebAssembly.
** See: https://www.sqlite.org/custombuild.html
*/

#include <sqlite3.h>

extern int sqlite3_memvfs_init(void); // defined in ext/memvfs.c to register memvfs
extern int sqlite3_http_vfs_init(void); // defined in http_vfs.c to register http vfs

/*
** sqlite3_os_init(...) is invoked by sqlite3 core to perform
** os-level intializations and setup the underlying os interface.
*/
int sqlite3_os_init(void) {
  int rc = SQLITE_OK;
  
  rc = sqlite3_http_vfs_init();
  if(rc != SQLITE_OK) { return rc; }

  rc = sqlite3_vfs_register(sqlite3_vfs_find("http"), 1 /* make default */);
  if(rc != SQLITE_OK) { return rc; }

  rc = sqlite3_memvfs_init();
  if(rc != SQLITE_OK)   { return rc; }

  return rc;
}

/*
** sqlite3_os_end(...) is invoked by sqlite3 core to perform
** unintialization and shutdown the underlying os interface.
*/
int sqlite3_os_end(void) { return SQLITE_OK; }
