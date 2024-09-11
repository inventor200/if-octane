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

/*
This file demonstrates how an algorithm could locate the metadata
in an IF-Octane file.
*/
const fs = require('fs');

const CHUNK_SIZE = 64;

let terminator = "";
for (let i = 0; i < CHUNK_SIZE; i++) {
    terminator += ".";
}

const getMetadata = async (path) => {
    return new Promise((resolve) => {
        const res = {
            about: "",
            uuid: "",
            iFictionData: ""
        };

        fs.open(path, 'r', function(error, fd) {
            if (error) {
                console.error(error.message);
                resolve(res);
                return;
            }

            // Byte-level: Search for IF-Octane confirmation
            let octaneConfirmed = false;
            let buffer = Buffer.alloc(CHUNK_SIZE, 0, 'ascii');
            let terminatorAddress = 0;
            let num = CHUNK_SIZE;
            while (num === CHUNK_SIZE && terminatorAddress < 8) {
                num = fs.readSync(fd, buffer, 0, CHUNK_SIZE, terminatorAddress * CHUNK_SIZE);
                const line = buffer.toString('ascii', 0, num);
                if (line.startsWith("IF-Octane")) {
                    octaneConfirmed = true;
                    break;
                }
                terminatorAddress++;
            }

            if (!octaneConfirmed) {
                console.error("This is not an IF-Octane file!");
                resolve(res);
                return;
            }

            // Byte-level: Search for terminator chunk address
            terminatorAddress = 0;
            num = CHUNK_SIZE;
            while (num === CHUNK_SIZE) {
                num = fs.readSync(fd, buffer, 0, CHUNK_SIZE, terminatorAddress * CHUNK_SIZE);
                const line = buffer.toString('ascii', 0, num);
                if (line === terminator) break;
                terminatorAddress++;
            }

            // Collect UTF-8
            const maxBytes = terminatorAddress * CHUNK_SIZE;
            buffer = Buffer.alloc(maxBytes, 0, 'utf-8');
            num = fs.readSync(fd, buffer, 0, maxBytes, 0);
            const scrapeLines = buffer.toString('utf-8', 0, num).split("\n");

            let breakCount = 0;
            const SEARCH_HEADER = 0;
            const SEARCH_ABOUT = 1;
            const SEARCH_UUID = 2;
            const SEARCH_XML = 3;
            let searchStage = SEARCH_HEADER;

            let aboutText = "";
            let uuid = "";
            let iFictionData = "";

            for (let i = 0; i < scrapeLines.length; i++) {
                const scrapeLine = scrapeLines[i];
                if (searchStage === SEARCH_HEADER) {
                    if (scrapeLine.startsWith("[ABOUT]")) {
                        searchStage = SEARCH_ABOUT;
                        continue;
                    }
                }
                else if (searchStage === SEARCH_ABOUT) {
                    aboutText += scrapeLine + "\n";
                }
                else if (searchStage === SEARCH_UUID) {
                    if (scrapeLine.startsWith("UUID://")) {
                        uuid = scrapeLine;
                    }
                    else if (uuid.length > 0) {
                        searchStage = SEARCH_XML;
                        continue;
                    }
                }
                else if (searchStage === SEARCH_XML) {
                    if (scrapeLine.length > 0) {
                        iFictionData += scrapeLine + "\n";
                    }
                }
                
                if (scrapeLine.length === 0) {
                    breakCount++;
                }
                else {
                    breakCount = 0;
                }

                if (breakCount >= 2) {
                    if (searchStage === SEARCH_ABOUT) {
                        searchStage = SEARCH_UUID;
                    }
                    else if (searchStage === SEARCH_XML) {
                        res.about = aboutText.trim();
                        res.uuid = uuid.substring(7, uuid.length - 2);
                        res.iFictionData = iFictionData.trim();
                        resolve(res);
                        return;
                    }
                }
            }

            resolve(res);
            return;
        });
    });
}

getMetadata('./test-folder/out.js').then((data) => {
    console.log(data.about);
    console.log(data.uuid);
    console.log(data.iFictionData);
});
