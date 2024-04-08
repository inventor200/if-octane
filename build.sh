#!/usr/bin/env bash

mkdir -p "$IF_OCTANE_ENGINE_PATH/precrunch"
mkdir -p "$IF_OCTANE_ENGINE_PATH/cache"

USE_DEBUG_MODE=0
for BUILD_ARG in "$@" 
do
    if [ "$BUILD_ARG" = "-d" ]; then
        USE_DEBUG_MODE=1
        echo "Running in debug mode; no uglifying will be performed"
    fi
done

if [[ -z "${IF_OCTANE_PROJ_SRC}" ]]; then
    echo "You must export a IF_OCTANE_PROJ_SRC path to continue."
    exit 1;
fi
if [[ -z "${IF_OCTANE_ENGINE_PATH}" ]]; then
    echo "You must export a IF_OCTANE_ENGINE_PATH path to continue."
    exit 1;
fi

INFO_FILENAME="info.txt"
MAKE_LIST_FILENAME="js-list.txt"
STYLE_FILENAME_BASE="style"
STYLE_FILENAME_PRE="$STYLE_FILENAME_BASE.scss"
STYLE_FILENAME="$STYLE_FILENAME_BASE.css"

if ! [ -f "$IF_OCTANE_PROJ_SRC/$STYLE_FILENAME_PRE" ]; then
    echo "WARNING: Project is missing: $STYLE_FILENAME_PRE"
fi

if ! [ -f "$IF_OCTANE_PROJ_SRC/$MAKE_LIST_FILENAME" ]; then
    echo "ERROR: Project is missing: $MAKE_LIST_FILENAME"
    exit 1
fi

if ! [ -f "$IF_OCTANE_PROJ_SRC/$INFO_FILENAME" ]; then
    echo "ERROR: Project is missing: $INFO_FILENAME"
    exit 1
fi

# Gather project info
PROJ_TITLE="Untitled Octane Game"
FOUND_TITLE=0
PROJ_AUTHOR="Anonymous Author"
FOUND_AUTHOR=0
PROJ_IFID=$(uuidgen)
FOUND_IFID=0
PROJ_BLURB="An IF-Octane game!"
FOUND_BLURB=0
PROJ_VERSION="0.9 BETA (PATCH 0)"
FOUND_VERSION=0
while IFS="" read -r p || [ -n "$p" ]
do
    LOWER_LINE=$(echo "$p" | tr '[:upper:]' '[:lower:]')
    if [[ $LOWER_LINE == title:* ]]; then
        PROJ_TITLE=$(echo "${p:6}" | awk '{$1=$1};1')
        FOUND_TITLE=1
    fi
    if [[ $LOWER_LINE == author:* ]]; then
        PROJ_AUTHOR=$(echo "${p:7}" | awk '{$1=$1};1')
        FOUND_AUTHOR=1
    fi
    if [[ $LOWER_LINE == ifid:* ]]; then
        PROJ_IFID=$(echo "${p:5}" | awk '{$1=$1};1')
        FOUND_IFID=1
    fi
    if [[ $LOWER_LINE == blurb:* ]]; then
        PROJ_BLURB=$(echo "${p:6}" | awk '{$1=$1};1')
        FOUND_BLURB=1
    fi
    if [[ $LOWER_LINE == version:* ]]; then
        PROJ_VERSION=$(echo "${p:8}" | awk '{$1=$1};1')
        FOUND_VERSION=1
    fi
done < "$IF_OCTANE_PROJ_SRC/$INFO_FILENAME"

# Fill in missing info
if [ $FOUND_TITLE -eq 0 ]; then
    echo "Title: $PROJ_TITLE" >> "$IF_OCTANE_PROJ_SRC/$INFO_FILENAME"
fi
if [ $FOUND_AUTHOR -eq 0 ]; then
    echo "Author: $PROJ_AUTHOR" >> "$IF_OCTANE_PROJ_SRC/$INFO_FILENAME"
fi
if [ $FOUND_IFID -eq 0 ]; then
    echo "IFID: $PROJ_IFID" >> "$IF_OCTANE_PROJ_SRC/$INFO_FILENAME"
fi
if [ $FOUND_BLURB -eq 0 ]; then
    echo "BLURB: $PROJ_BLURB" >> "$IF_OCTANE_PROJ_SRC/$INFO_FILENAME"
fi
if [ $FOUND_VERSION -eq 0 ]; then
    echo "VERSION: $PROJ_VERSION" >> "$IF_OCTANE_PROJ_SRC/$INFO_FILENAME"
fi

OUT_DIR="$IF_OCTANE_PROJ_SRC/out"
if ! [ -d "$OUT_DIR" ]; then
    mkdir "$OUT_DIR"
fi

EMBED_PATH="$IF_OCTANE_PROJ_SRC/embed"

USE_EMBEDDING=0
if [ -d "$EMBED_PATH" ]; then
    if [ $(ls -A "$EMBED_PATH" | wc -l) -ne 0 ]; then
        USE_EMBEDDING=1
    fi
fi

if [ $USE_EMBEDDING -eq 1 ]; then
    # Set a limit of 25 MB
    EMBED_SIZE=$(du -sh "$EMBED_PATH")
    if $(echo "$EMBED_SIZE" | grep -qE "^[1234567890]+M"); then
        if [ $(echo "$EMBED_SIZE" | grep -oE "^[1234567890]+") -ge 25 ]; then
            echo "Your embed directory contains more than 25 MB of data; the web page will not load!"
            exit 1
        fi
    fi
else
    echo "This project will not use embedding."
fi

if [ $USE_EMBEDDING -eq 1 ]; then
    echo "Compiling WebAssembly data..."

    #TODO: Need to make sure wasm works on node.js
    #https://nodejs.org/en/learn/getting-started/nodejs-with-webassembly

    # Compile WebAssembly
    # Load limit seems to be near 26214400 (25 MB), so limit to that, but allow for 26 MB of memory, just for padding.
    # Remap `./embed` to `/` in VM space.
    emcc -sENVIRONMENT=web -sFORCE_FILESYSTEM -Os "$IF_OCTANE_ENGINE_PATH/compiled-content.c" -o compiled-content.js --embed-file "$EMBED_PATH"@/ -sTOTAL_MEMORY=27262976 #-sUSE_ZLIB=1
    mv compiled-content.js "$IF_OCTANE_ENGINE_PATH/cache/compiled-content.js"
    mv compiled-content.wasm "$IF_OCTANE_ENGINE_PATH/cache/compiled-content.wasm"

    echo "Preparing package..."
fi

PREDOC_NAME="$IF_OCTANE_ENGINE_PATH/precrunch/index.html"

echo "Writing web page..."

# Assemble the webpage
echo '<!doctype html><html lang="en-us">' > "$PREDOC_NAME"

# Write header
echo '<head>' >> "$PREDOC_NAME"
echo '<meta charset="utf-8">' >> "$PREDOC_NAME"
echo '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' >> "$PREDOC_NAME"
echo '<meta name="viewport" content="width=device-width,initial-scale=1">' >> "$PREDOC_NAME"
echo "<title>$PROJ_TITLE</title>" >> "$PREDOC_NAME"
echo "<meta property="ifiction:ifid" content=\"$PROJ_IFID\">" >> "$PREDOC_NAME"
echo "<meta name=\"darkreader-lock\">" >> "$PREDOC_NAME"
cat "$IF_OCTANE_ENGINE_PATH/favicon-code.txt" >> "$PREDOC_NAME"

BUILT_CSS="$IF_OCTANE_ENGINE_PATH/cache/clean-styles"
cat "$IF_OCTANE_ENGINE_PATH/core-styles.css" > "$BUILT_CSS.css"
echo "" >> "$PREDOC_NAME"
if [ -f "$IF_OCTANE_PROJ_SRC/$STYLE_FILENAME_PRE" ]; then
    sass "$IF_OCTANE_PROJ_SRC/$STYLE_FILENAME_PRE" "$IF_OCTANE_ENGINE_PATH/cache/$STYLE_FILENAME"
    cat "$IF_OCTANE_ENGINE_PATH/cache/$STYLE_FILENAME" >> "$BUILT_CSS.css"
fi

if [ $USE_DEBUG_MODE -eq 0 ]; then
    echo "Cleaning CSS..."
    cleancss -o "$BUILT_CSS.min.css" "$BUILT_CSS.css"
fi

echo '<style>' >> "$PREDOC_NAME"
if [ $USE_DEBUG_MODE -eq 0 ]; then
    cat "$BUILT_CSS.min.css" >> "$PREDOC_NAME"
else
    cat "$BUILT_CSS.css" >> "$PREDOC_NAME"
fi
echo '</style>' >> "$PREDOC_NAME"

echo '</head>' >> "$PREDOC_NAME"

echo '<body>' >> "$PREDOC_NAME"

# Write page content
cat "$IF_OCTANE_ENGINE_PATH/layout.html" >> "$PREDOC_NAME"

BUILT_JS="$IF_OCTANE_ENGINE_PATH/cache/ugly-js"

echo "'use strict';" > "$BUILT_JS.js"
echo "" >> "$BUILT_JS.js"

# Add agnostic scripts
cat "$IF_OCTANE_ENGINE_PATH/agnostic-scripts.js" >> "$BUILT_JS.js"
cat "$IF_OCTANE_ENGINE_PATH/world-model.js" >> "$BUILT_JS.js"
echo "" >> "$BUILT_JS.js"

# Add browser scripts
#TODO: Create a nodeJS alternative
cat "$IF_OCTANE_ENGINE_PATH/browser-scripts.js" >> "$BUILT_JS.js"
echo "" >> "$BUILT_JS.js"

if [ $USE_EMBEDDING -eq 1 ]; then
    cat "$IF_OCTANE_ENGINE_PATH/vm-scripts.js" >> "$BUILT_JS.js"
else
    cat "$IF_OCTANE_ENGINE_PATH/no-vm-scripts.js" >> "$BUILT_JS.js"
fi
echo "" >> "$BUILT_JS.js"

# Create internal info object
echo 'const GAME_INFO = {title:' >> "$BUILT_JS.js"
echo "\"$PROJ_TITLE\"," >> "$BUILT_JS.js"
echo 'author:' >> "$BUILT_JS.js"
echo "\"$PROJ_AUTHOR\"," >> "$BUILT_JS.js"
echo 'ifid:' >> "$BUILT_JS.js"
echo "\"$PROJ_IFID\"," >> "$BUILT_JS.js"
echo 'blurb:' >> "$BUILT_JS.js"
echo "\"$PROJ_BLURB\"," >> "$BUILT_JS.js"
echo 'version:' >> "$BUILT_JS.js"
echo "\"$PROJ_VERSION\"," >> "$BUILT_JS.js"
echo 'isBrowserBased: true' >> "$BUILT_JS.js" #TODO: Handle this differently for nodeJS
echo '};' >> "$BUILT_JS.js"
echo "" >> "$BUILT_JS.js"

# Write custom scripts
echo "Combining scripts..."
while IFS="" read -r p || [ -n "$p" ]
do
    echo "    Including $p"
    if [[ $a == /* ]]; then
        if ! [ -f "$p" ]; then
            echo "File not found: $p"
            exit 1
        fi
        cat "$p" >> "$BUILT_JS.js"
        echo "" >> "$BUILT_JS.js"
    else
        if ! [ -f "$IF_OCTANE_PROJ_SRC/$p" ]; then
            echo "File not found: $IF_OCTANE_PROJ_SRC/$p"
            exit 1
        fi
        cat "$IF_OCTANE_PROJ_SRC/$p" >> "$BUILT_JS.js"
        echo "" >> "$BUILT_JS.js"
    fi
done < "$IF_OCTANE_PROJ_SRC/$MAKE_LIST_FILENAME"

if [ $USE_EMBEDDING -eq 1 ]; then
    echo "Converting WebAssembly data to base64..."

    # Generate the wasm data
    WASM_DATA_64=$(base64 --wrap 0 "$IF_OCTANE_ENGINE_PATH/cache/compiled-content.wasm")

    # Write to library file
    echo -n 'const _embedded_wasm_bin_data = "data:application/octet-stream;base64,' >> "$BUILT_JS.js"
    echo -n "$WASM_DATA_64" >> "$BUILT_JS.js"
    echo '";' >> "$BUILT_JS.js"

    # Inject the wasm replacement
    sed -i -e 's/"compiled-content.wasm"/_embedded_wasm_bin_data/g' "$IF_OCTANE_ENGINE_PATH/cache/compiled-content.js"

    echo "" >> "$BUILT_JS.js"
    cat "$IF_OCTANE_ENGINE_PATH/cache/compiled-content.js" >> "$BUILT_JS.js"
fi

if [ $USE_DEBUG_MODE -eq 0 ]; then
    echo "Uglifying..."
    uglifyjs "$BUILT_JS.js" -o "$BUILT_JS.min.js" -c drop_console -m toplevel
fi

echo '<script type="text/javascript">' >> "$PREDOC_NAME"
if [ $USE_DEBUG_MODE -eq 0 ]; then
    cat "$BUILT_JS.min.js" >> "$PREDOC_NAME"
else
    cat "$BUILT_JS.js" >> "$PREDOC_NAME"
fi
echo '</script></body></html>' >> "$PREDOC_NAME"

echo "Minifying..."
html-minifier \
--collapse-inline-tag-whitespace \
--collapse-whitespace \
--conservative-collapse \
--remove-attribute-quotes \
--remove-comments \
--remove-redundant-attributes \
--use-short-doctype \
--input-dir "$IF_OCTANE_ENGINE_PATH/precrunch" \
--output-dir "$OUT_DIR" \
-o index.html

# Add an IFID in a comment, for any tools which do not accept IFID in a meta tag.
# We do this last because minifying removes comments.
echo "<!-- UUID://$PROJ_IFID// -->" >> "$OUT_DIR/index.html"

if [ $USE_DEBUG_MODE -eq 0 ]; then
    function sanitize_file_name {
        echo -n $1 | perl -pe 's/[\?\[\]\/\\=<>:;,''"&\$#*()|~`!{}%+]//g;' -pe 's/[\r\n\t -]+/-/g;'
    }

    FINAL_FILE_NAME="$PROJ_TITLE-$PROJ_VERSION.html"
    CLEAN_FILE_NAME=$(sanitize_file_name "$FINAL_FILE_NAME")
    mv "$OUT_DIR/index.html" "$OUT_DIR/$CLEAN_FILE_NAME"
fi

echo "Done!"