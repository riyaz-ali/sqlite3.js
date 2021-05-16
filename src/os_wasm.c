/*
** os_wasm.c provides a custom build of sqlite3 targetted for WebAssembly.
** See: https://www.sqlite.org/custombuild.html
*/

#include <sqlite3.h>

extern sqlite3_vfs memdb_vfs; // externally declared in-memory database vfs

extern int sqlite3_memvfs_init(void); // defined in ext/memvfs.c to register memvfs
extern int sqlite3_underlay_vfs_init(void); // defined in underlay_vfs.c to register underlay vfs

/*
** sqlite3_os_init(...) is invoked by sqlite3 core to perform
** os-level intializations and setup the underlying os interface.
*/
int sqlite3_os_init(void) {
  int rc = SQLITE_OK;
  if((rc = sqlite3_underlay_vfs_init()) != SQLITE_OK) { return rc; }
  if((rc = sqlite3_memvfs_init()) != SQLITE_OK)       { return rc; }

  memdb_vfs.pAppData = sqlite3_vfs_find(0);
  if((rc = sqlite3_vfs_register(&memdb_vfs, 0)) != SQLITE_OK) { return rc; }
  return rc;
}

/*
** sqlite3_os_end(...) is invoked by sqlite3 core to perform
** unintialization and shutdown the underlying os interface.
*/
int sqlite3_os_end(void) { return SQLITE_OK; }
