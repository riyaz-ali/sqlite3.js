/*
** This file provides the common interface provided by the
** WebAssembly environment, as environment imports.
**
** Here we declare the common routines that we expect
** to find in the WebAssembly environment.
*/

#pragma once

#include <sqlite3.h>

// IS_ACCESSIBLE(var) returns true if var contains permissible access flags
#define IS_ACCESSIBLE(var) ((((var&HTTP_FILE_READONLY) || (var&HTTP_FILE_READWRITE)) && !(var&HTTP_NO_RANGE_REQUEST)) != 0)

/* ******************** HTTP / Network methods  ******************** */

#define HTTP_FILE_NO_ACCESS  0
#define HTTP_FILE_READONLY   1
#define HTTP_FILE_READWRITE  2 /* un-used */

#define HTTP_NO_RANGE_REQUEST 16 // special flag used to indicate Range-Requests are not available

/*
** wasm_http_file_stat provides information about the file at the path provided
** such as its size, access mode, etc. using the OUT variables.
*/
int wasm_http_file_stat(const char* path, int* access, sqlite3_int64* sz);

int wasm_http_get_bytes(const char* path, void* zBuf, sqlite3_int64 start, sqlite3_int64 end);


/* ******************** Other utilty methods  ******************** */

/*
** wasm_crypto_get_random provide random bytes using Web Crypto API.
** Implementation of this routine is expected in the WebAssembly environment.
** See: lib/worker/environment.js#wasm_crypto_get_random for default implementation.
*/
int wasm_crypto_get_random(char* out, int n);

/*
** wasm_get_unix_epoch returns the current unix epoch as seconds from Jan 1, 1970.
** See: lib/worker/environment.js#wasm_get_unix_epoch for default implementation.
*/
sqlite3_int64 wasm_get_unix_epoch(void);

/*
** wasm_console_log is a sink for sqlite error log defined in Javascript that sends out
** log using console.log(...)
**
** See: https://www.sqlite.org/errlog.html
*/
void wasm_console_log(int code, char* msg);
