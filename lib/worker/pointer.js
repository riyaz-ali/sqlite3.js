/*
** Pointer is a 32-bit integer value that represents
** a memory address. The provided handle can either be allocated on 
** stack or heap depending on the subclass.
*/
let Pointer = function(memory, handle) {
  this.view = new Int32Array(memory.buffer);
  this.p = handle;
}

// Get returns the current address stored inside the pointer
Pointer.prototype.get = function() {
  return this.view[this.p >> 2];
}

// Set sets the address value inside the pointer
Pointer.prototype.set = function(addr) {
  this.view[this.p >> 2] = addr;
}

export default Pointer;