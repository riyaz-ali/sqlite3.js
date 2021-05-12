#            _ _ _       _____   _
#  ___  __ _| (_| |_ ___|___ /  (_)___
# / __|/ _` | | | __/ _ \ |_ \  | / __|
# \__ | (_| | | | ||  __/___) _ | \__ \  - sqlite3 built for the web!
# |___/\__, |_|_|\__\___|____(__/ |___/
#         |_|                 |__/

CC			= emcc
SRCDIR		= src
BUILDDIR	= build

CFILES		= $(shell find $(SRCDIR) -name *.c)
OBJFILES	= $(CFILES:%=$(BUILDDIR)/%.o)

# Flags to compile sqlite with
CFLAGS = -O2 -DSQLITE_OMIT_LOAD_EXTENSION -DSQLITE_DISABLE_LFS \
	-DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_ENABLE_DESERIALIZE \
	-DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_PARENTHESIS -DSQLITE_ENABLE_JSON1 \
	-DSQLITE_THREADSAFE=0 -DSQLITE_ENABLE_NORMALIZE -DSQLITE_OS_OTHER=1

# Additional flags to pass to emscripten
EMFLAGS = --no-entry -s ALLOW_TABLE_GROWTH=1 -s EXPORTED_FUNCTIONS=@functions.json

# compile C source-files into LLVM bitcode using emscripten
$(BUILDDIR)/%.c.o: %.c
	mkdir -p $(dir $@)
	$(CC) $(CFLAGS) $(EMFLAGS) -c -o $@ $<

# link built object files into webassembly modules with debugging options applied
$(BUILDDIR)/sqlite3.debug.wasm: $(OBJFILES)
	$(CC) $(CFLAGS) $(EMFLAGS) -s INLINING_LIMIT=10 -s ASSERTIONS=1 -O1 -o $@ $^

# link built object files into webassembly modules with release optimisations
$(BUILDDIR)/sqlite3.wasm: $(OBJFILES)
	$(CC) $(CFLAGS) $(EMFLAGS) -s INLINING_LIMIT=50 -O3 -flto --closure 1 -o $@ $^

# build javascript worker source
$(BUILDDIR)/sqlite3.worker.js: 

# purge build root
clean:
	-rm -rf $(BUILDDIR)

.PHONY: clean
