#!/usr/bin/env bash

USE_DEBUG_MODE=0
USE_RECYCLE_MODE=0
for BUILD_ARG in "$@" 
do
    if [ "$BUILD_ARG" = "-d" ]; then
        USE_DEBUG_MODE=1
        echo "Running in debug mode; no uglifying will be performed"
    elif [ "$BUILD_ARG" = "-f" ]; then
        USE_RECYCLE_MODE=1
        echo "Running in recycle mode; no asset files will be modified"
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

mkdir -p "$IF_OCTANE_ENGINE_PATH/precrunch"
mkdir -p "$IF_OCTANE_ENGINE_PATH/cache"

# Automatically generate a tsconfig.json file in a project directory,
# if one is not already there.
TSCONFIG_FILE="$IF_OCTANE_PROJ_SRC/tsconfig.json"

if ! [ -f "$TSCONFIG_FILE" ]; then
    echo '{' > "$TSCONFIG_FILE"
    echo '    "compilerOptions": {' >> "$TSCONFIG_FILE"
    echo '        "target": "es2020",' >> "$TSCONFIG_FILE"
    echo '        "strict": true,' >> "$TSCONFIG_FILE"
    echo '        "paths": {' >> "$TSCONFIG_FILE"
    echo -n '            "if-octane/*": ["' >> "$TSCONFIG_FILE"
    echo -n "$IF_OCTANE_ENGINE_PATH" >> "$TSCONFIG_FILE"
    echo -n '/src/*"]' >> "$TSCONFIG_FILE"
    echo '        }' >> "$TSCONFIG_FILE"
    echo '    }' >> "$TSCONFIG_FILE"
    echo '}' >> "$TSCONFIG_FILE"
fi

INFO_FILENAME="info.txt"
MAIN_FILENAME="main.ts"
STYLE_FILENAME_BASE="style"
STYLE_FILENAME_PRE="$STYLE_FILENAME_BASE.scss"
STYLE_FILENAME="$STYLE_FILENAME_BASE.css"

if ! [ -f "$IF_OCTANE_PROJ_SRC/$STYLE_FILENAME_PRE" ]; then
    echo "WARNING: Project is missing: $STYLE_FILENAME_PRE"
fi

if ! [ -f "$IF_OCTANE_PROJ_SRC/$MAIN_FILENAME" ]; then
    echo "ERROR: Project is missing: $MAIN_FILENAME"
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

DUMP_PATH="$IF_OCTANE_ENGINE_PATH/cache/dump"

USE_EMBEDDING=0
if [ -d "$EMBED_PATH" ]; then
    if [ $(ls -A "$EMBED_PATH" | wc -l) -ne 0 ]; then
        USE_EMBEDDING=1
    fi
fi

recursiveFind() {
    for i in "$1"/*; do
        if [ -d "$i" ]; then
            recursiveFind "$i"
        elif [ -f "$i" ]; then
            ASSET_PATH=${i#"$EMBED_PATH/"}
            ASSET_SIZE=$(stat -c%s "$i")
            echo -n "{len:$ASSET_SIZE, path:\"$ASSET_PATH\"},"
        fi
    done
}

recursiveDump() {
    for i in "$1"/*; do
        if [ -d "$i" ]; then
            recursiveDump "$i"
        elif [ -f "$i" ]; then
            echo "Adding to data dump: $i"
            dd bs=1024 if="$i" of="$DUMP_PATH" conv=notrunc oflag=append
        fi
    done
}

if [ $USE_EMBEDDING -eq 0 ]; then
    echo "This project will not use embedding."
elif [ $USE_RECYCLE_MODE -eq 0 ]; then
    echo "Building embedded manifest..."

    # Write the manifest file
    MANIFEST_LIST=$(recursiveFind "$IF_OCTANE_PROJ_SRC/embed")
    MANIFEST_LIST=${MANIFEST_LIST::-1}

    echo -n "[$MANIFEST_LIST]," > "$IF_OCTANE_ENGINE_PATH/cache/manifest.js"

    # Write the byte dump file
    echo -n "" > "$DUMP_PATH"
    recursiveDump "$IF_OCTANE_PROJ_SRC/embed"
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
    cat "$IF_OCTANE_ENGINE_PATH/embed-scripts.js" >> "$BUILT_JS.js"
else
    cat "$IF_OCTANE_ENGINE_PATH/no-embed-scripts.js" >> "$BUILT_JS.js"
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
echo 'isBrowserBased: true,' >> "$BUILT_JS.js" #TODO: Handle this differently for nodeJS
if [ $USE_EMBEDDING -eq 1 ]; then
    echo "Writing embedded data to GAME_INFO.embeddedManifest and GAME_INFO.embeddedData..."
    echo -n 'useEmbedding: true,embeddedManifest: ' >> "$BUILT_JS.js"
    cat "$IF_OCTANE_ENGINE_PATH/cache/manifest.js" >> "$BUILT_JS.js"
    echo -n 'embeddedData:"data:application/octet-stream;base64,' >> "$BUILT_JS.js"
    base64 --wrap 0 "$DUMP_PATH" >> "$BUILT_JS.js"
    echo '",' >> "$BUILT_JS.js"
else
    echo 'useEmbedding: false,' >> "$BUILT_JS.js"
fi
if [ $USE_DEBUG_MODE -eq 1 ]; then
    echo 'isDebug: true' >> "$BUILT_JS.js"
else
    echo 'isDebug: false' >> "$BUILT_JS.js"
fi
echo '};' >> "$BUILT_JS.js"
echo "" >> "$BUILT_JS.js"
if [ $USE_EMBEDDING -eq 1 ]; then
    echo 'if_octane_start_file_loading();' >> "$BUILT_JS.js"
fi

#TODO: Modify the rest of the build process to fit this

# Build bundled JS
export IF_OCTANE_BUILD_DEBUG=$USE_DEBUG_MODE
node "$IF_OCTANE_ENGINE_PATH/build.js"

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