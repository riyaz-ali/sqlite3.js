/*
** This file provides the common interface provided by the
** WebAssembly environment, as environment imports.
**
** Here we declare the common routines that we expect
** to find in the WebAssembly environment.
*/

#pragma once

#include <sqlite3.h>


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
