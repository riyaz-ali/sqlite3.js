/*
** runtime.js provides implementation of some low level runtime helpers
** taken from emscripten's preamble and runtime scripts.
*/

import * as _ from 'lodash';
import { memory, stack } from './sqlite3'; // delibrate circular dependency

/*
** stringToUTF8 converts Javascript string to UTF-8 array and writes it to the heap starting at out pointer
*/
export function stringToUTF8(str, heap, outIdx, max) {
  if (!(max > 0)) return 0;

  let startIdx = outIdx;
  let endIdx = outIdx + max - 1; // -1 for string null terminator.
  for (let i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 0xC0 | (u >> 6);
      heap[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 0xE0 | (u >> 12);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      heap[outIdx++] = 0xF0 | (u >> 18);
      heap[outIdx++] = 0x80 | ((u >> 12) & 63);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
}


/*
** UTF8ArrayToString converts an array of UTF-8 characters to a Javascript string
*/
export function UTF8ArrayToString(heap, idx, max) {
  var decoder = new TextDecoder('utf8')
  var endIdx = idx + max;
  var endPtr = idx;
  
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && heap.subarray && decoder) {
    return decoder.decode(heap.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = heap[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = heap[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = heap[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

/*
** UTF8ToString converts a UTF-8 C string to a Javascript string
*/
export function UTF8ToString(heap, ptr, max) {
  return ptr ? UTF8ArrayToString(heap, ptr, max) : '';
}


/*
** ccall invokes the provided function and takes care of argument type conversion
** between C and Javascript environments.
*/
export function ccall(fn, returnType, argTypes, args) {
  const heap = new Int8Array(memory.buffer);
  
  // for fast lookup of conversion functions
  const converters = {
    'string': function(str) {
      let ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        let len = (str.length << 2) + 1;
        ret = stack.alloc(len);
        stringToUTF8(str, heap, ret, len);
      }
      return ret;
    },
    'array': function(a) {
      let ret = stack.alloc(a.length);
      heap.set(a, ret);
      return ret;
    }
  };

  const convert = ret => {
    return returnType === 'string'? UTF8ToString(heap, ret) : 
    returnType === 'boolean'? Boolean(ret) : ret;
  }

  let esp = stack.save();
  let cargs = _.map(args, (arg, i) => {
    let c = converters[argTypes[i]];
    return c? c(arg) : arg;
  })

  let ret = convert(fn.apply(null, cargs));
  stack.restore(esp);

  return ret;
}

/*
** cwrap wraps the provided function and returns a javascript
** closure that invokes the provided function at a later time with
** appropriate type conversions.
*/
export function cwrap(fn, returnType, argTypes) {
  return function() {
    return ccall(fn, returnType, argTypes, arguments);
  }
}
