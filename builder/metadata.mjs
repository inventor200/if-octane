// IF-Octane
// Copyright (C) 2024  Joseph Cramsey
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { getModifiedDate } from "./files.mjs";
import { getYear } from "./timestamp.mjs";

const CHUNK_SIZE = 64;

// Instructional messages will only use single-byte characters.
//
// No matter if the file is read in ASCII or UTF-8,
// the termination at the final chunk can be found
// the same way.
//
// This means that both formats can open this file,
// read the header text and metadata, and receive
// instructions on how to parse the metadata.

const formatMessage = (gameInfo) => {
    return "IF-Octane\n\n\n" + gameInfo.title + " v" + gameInfo.version + "\n"+
`Copyright (C) ${getYear()}  Joey Tanden

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.`+
    "\n\n*** METADATA EXPLANATION *** \n\n"+
    "METADATA IS READ IN "+
    CHUNK_SIZE + "-BYTE CHUNKS OF UTF-8. \n"+
    "THE FINAL CHUNK WILL BE FULL OF DOTS (\".\" OR 0x2E). \n"+
    "THE FIRST CHUNK SKIPS THE BEGINNING-OF-FILE UTF-8 \n"+
    "MARKER, WHICH IS OFTEN 3 BYTES LONG (0xEF 0xBB 0xBF). \n"+
    "NOTE THAT THIS MARKER IS NOT ALWAYS PRESENT IN FILES. \n"+
    "CHUNK READING MUST BEGIN WITH ONE OF THESE ALTERNATIVE \n"+
    "3-BYTE SEQUENCES INSTEAD: \n"+
    "    0x23 0x21 0x2F \n"+
    "      OR \n"+
    "    0x2F 0x2A 0x3E \n"+
    "      OR \n"+
    "    0x3C 0x21 0x44 \n"+
    "ONE OF THESE SEQUENCES MUST BEGIN THE FIRST CHUNK. \n\n"+
    "THIS FILE WAS CREATED ON A UNIX-BASED SYSTEM, SO LINES \n"+
    "ARE SEPARATED BY THE LINE-FEED CHARACTER (0x0A). \n\n"+
    "METADATA CHAPTERS ARE ALWAYS CHUNK-ALIGNED, SO THEIR \n"+
    "FIRST BYTES ARE THE FIRST BYTES OF THEIR RESPECTIVE \n"+
    "CHUNKS. \n\n"+
    '    CHAPTER TITLE         | "LEADING CHUNK STRING" \n'+
    '    ============================================== \n'+
    '    THIS EXPLANATION .... | "IF-Octane" \n'+
    '    ABOUT SECTION ....... | "[ABOUT]" \n'+
    '    UUID / IFID ......... | "UUID" \n'+
    '    EMBEDDED IFICTION XML | "<?xml" \n'+
    '    TERMINATOR .......... | (64 counts of 0x2E) \n';
}

/*
Okay, so what THIS does is:
 1. Makes the message visually-distinct from the source code.
 2. Packs a combination of 0xD8 0x89 onto the end so that:
    2a. It shows up as a valid character for both ASCII and UTF-8.
    2b. No matter if the file is being read byte-wise or
        character-wise (in UTF-8), the file can be safely
        read in chunks of 64, and still hit the confirmation
        and termination strings safely.
*/
const chunkify = (str) => {
    const blockContent = str + "  \n\n";
    const charLength = blockContent.length;
    const byteLength = Buffer.byteLength(blockContent, 'utf-8');
    
    const longSpace = '\u0609'; // 0xD8 0x89
    const longSkip = Buffer.byteLength(longSpace, 'utf-8');

    let charTrail = charLength % CHUNK_SIZE;
    let byteTrail = byteLength % CHUNK_SIZE;

    let endPad = "";
    let loopCount = 0;
    while (!(charTrail === 0 && byteTrail === 0)) {
        if (charTrail === byteTrail) {
            endPad += ((charTrail === CHUNK_SIZE - 1) ? "\n" : " ");
            charTrail++;
            byteTrail++;
        }
        else {
            endPad += longSpace;
            charTrail++;
            byteTrail += longSkip;
        }

        charTrail %= CHUNK_SIZE;
        byteTrail %= CHUNK_SIZE;

        loopCount++;
        if (loopCount >= 4096) {
            throw new Error("Pad exceeded reasonable length!");
        }
    }

    return blockContent + endPad;
}

export const getMetadataBlock = (
    args, gameInfo, timestamp, isForNode, infoPath
) => {
    if (args.isDebug) {
        return isForNode ?
            "#!/usr/bin/env node\n" :
            "<!DOCTYPE html>\n";
    }
    let buffer = "";

    const formatHeader = isForNode ?
        "#!/usr/bin/env node\n/*>\n" :
        "<!DOCTYPE html>\n<!--\n";

    let readableCredits =
        "[ABOUT]\n"+
        gameInfo.title + "\n"+
        "By: " + gameInfo.author + "\n"+
        "    " + gameInfo.email + "\n"+
        "Version: " + gameInfo.version + "\n\n"+
        gameInfo.blurb + "\n========\n";

    if (isForNode) {
        readableCredits +=
            "Built to run on Node.js v18\n";
    }
    else {
        readableCredits +=
            "Built to run on:\n"+
            "  - Chrome 125\n"+
            "  - Firefox 128\n"+
            "  - Safari 17.5\n";
    }

    readableCredits +=
        "Build timestamp: " + timestamp + "\n"+
        "License: GPL 3.0\n"+
        "         https://www.gnu.org/licenses/gpl-3.0.en.html \n"+
        "NO INTERNET CONNECTION REQUIRED! :D\n\n\n\n";

    buffer +=
        chunkify(formatHeader)+
        // This chunk starts with "IF-Octane",
        // which can be checked quickly.
        chunkify(formatMessage(gameInfo))+
        chunkify(readableCredits)+
        chunkify("UUID://" + gameInfo.ifid + "//\n");
    
    // For embedding an iFiction file
    const iFictionFormat =
        '<?xml version="1.0" encoding="UTF-8"?>'+
        '<ifindex version="1.0" xmlns="http://babel.ifarchive.org/protocol/iFiction/"><story>'+
        '<identification>'+
        '<ifid>' + gameInfo.ifid + '</ifid>'+
        '<format>' + (isForNode ? "executable" : "html") + '</format>'+
        '</identification><bibliographic>'+
        '<title>' + gameInfo.title + '</title>'+
        '<author>' + gameInfo.author + '</author>'+
        '<language>en-US</language>'+
        '<headline>' + gameInfo.headline + '</headline>'+
        '<firstpublished>' + gameInfo.firstPublished + '</firstpublished>'+
        //TODO: <genre>
        '<group>IF-Octane</group>'+
        '<description>' + gameInfo.blurb.replace(/\n/g, "<br/>") + '</description>'+
        //TODO: <forgiveness>
        '</bibliographic>'+
        '<contacts>'+
        '<authoremail>' + gameInfo.email + '</authoremail>'+
        '</contacts>'+
        //TODO: Cover data
        //<cover>
        //<format>
        //<height>
        //<width>
        //TODO: Also let the player get this description in-game
        //<description>
        //</cover>
        '<colophon>'+
        '<generator>IF-Octane</generator>'+
        '<originated>' + getModifiedDate(infoPath) + '</originated>'+
        '</colophon></story></ifindex>\n\n\n\n';
    
    buffer += chunkify(iFictionFormat);

    for (let i = 0; i < CHUNK_SIZE; i++) {
        buffer += ".";
    }

    return buffer + "\n" + (isForNode ? "*/" : "-->") + "\n";
}
