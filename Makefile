#            _ _ _       _____   _
#  ___  __ _| (_| |_ ___|___ /  (_)___
# / __|/ _` | | | __/ _ \ |_ \  | / __|
# \__ | (_| | | | ||  __/___) _ | \__ \  - sqlite3 built for the web!
# |___/\__, |_|_|\__\___|____(__/ |___/
#         |_|                 |__/

CC			= emcc
NPM			= npm
SRCDIR		= src
EXTDIR		= ext
BUILDDIR	= build
DISTDIR		= dist

CFILES		= $(shell find $(SRCDIR) -name *.c)
CFILES	   += $(shell find $(EXTDIR) -name *.c)
OBJFILES	= $(CFILES:%=$(BUILDDIR)/%.o)

INC_DIRS 	= $(shell find $(SRCDIR) -type d)
INC_FLAGS 	= $(addprefix -I,$(INC_DIRS))

# Flags to compile sqlite with
CFLAGS = $(INC_FLAGS)				 \
	-DSQLITE_CORE					 \
	-DSQLITE_DQS=0					 \
	-DSQLITE_THREADSAFE=0 			 \
	-DSQLITE_DEFAULT_MEMSTATUS=0	 \
	-DSQLITE_LIKE_DOESNT_MATCH_BLOBS \
	-DSQLITE_OMIT_AUTOINIT			 \
	-DSQLITE_OMIT_COMPLETE			 \
	-DSQLITE_OMIT_DECLTYPE			 \
	-DSQLITE_OMIT_DEPRECATED		 \
	-DSQLITE_OMIT_PROGRESS_CALLBACK	 \
	-DSQLITE_OMIT_SHARED_CACHE 		 \
	-DSQLITE_ENABLE_DESERIALIZE 	 \
	-DSQLITE_ENABLE_FTS5			 \
	-DSQLITE_ENABLE_JSON1 			 \
	-DSQLITE_ENABLE_MATH_FUNCTIONS	 \
	-DSQLITE_ENABLE_NORMALIZE		 \
	-DSQLITE_ENABLE_STAT4			 \
	-DSQLITE_OS_OTHER=1

# Additional flags to pass to emscripten
EMFLAGS = --no-entry -s ALLOW_TABLE_GROWTH=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_FUNCTIONS=@functions.json -s ERROR_ON_UNDEFINED_SYMBOLS=0 -Wl,--import-memory

# compile C source-files into LLVM bitcode using emscripten
$(BUILDDIR)/%.c.o: %.c
	mkdir -p $(dir $@)
	$(CC) $(CFLAGS) $(EMFLAGS) -c -o $@ $<

# link built object files into webassembly modules with debugging options applied
$(DISTDIR)/sqlite3.debug.wasm: $(OBJFILES)
	mkdir -p $(dir $@)
	$(CC) $(CFLAGS) $(EMFLAGS) -DSQLITE_DEBUG -DSQLITE_ENABLE_API_ARMOR -s INLINING_LIMIT=10 -s ASSERTIONS=1 -g -o $@ $^

# link built object files into webassembly modules with release optimisations
$(DISTDIR)/sqlite3.wasm: $(OBJFILES)
	mkdir -p $(dir $@)
	$(CC) $(CFLAGS) $(EMFLAGS) -s INLINING_LIMIT=50 -Os -flto --closure 1 -o $@ $^

# build javascript worker source
$(DISTDIR)/sqlite3.js: 
	$(NPM) run build -- -o $@

# purge build root
clean:
	-rm -rf $(BUILDDIR) $(DISTDIR)

.PHONY: clean
