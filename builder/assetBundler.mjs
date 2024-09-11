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

import fs from 'fs';
import { showVerbose } from './reports.mjs';

export class AssetBundler {
    constructor(args) {
        this.args = args;
        this.files = [];
        this.base64 = '';
    }

    addFile(filePathInfo) {
        this.base64 = '';
        const fileBuffer = fs.readFileSync(filePathInfo.fullPath).buffer;
        const fileInfo = {
            path: filePathInfo.path,
            buffer: fileBuffer,
            length: fileBuffer.byteLength,
            start: 0
        };
        this.files.push(fileInfo);
    }

    compileBase64() {
        // Use cached result instead
        if (this.base64.length > 0) return this.base64;

        // Build cache
        showVerbose(this.args, "Building asset dump...");

        let totalLength = 0;
        for (let i = 0; i < this.files.length; i++) {
            const fileInfo = this.files[i];
            fileInfo.start = totalLength;
            totalLength += fileInfo.length;
        }

        let indicatedSize = totalLength;
        let magnitude = 0;
        const magnitudes = [ " B", " kB", "MB", "GB" ];
        while (magnitude < magnitudes.length && indicatedSize >= 1024) {
            indicatedSize /= 1024;
            magnitude++;
        }

        showVerbose(this.args,
            "Total embedded size: " + totalLength + magnitudes[magnitude]
        );

        const dumpArray = new Uint8Array(totalLength);
        for (let i = 0; i < this.files.length; i++) {
            const fileInfo = this.files[i];
            const fileArray = new Uint8Array(fileInfo.buffer);
            dumpArray.set(fileArray, fileInfo.start);
        }

        this.base64 = "data:application/octet-stream;base64," + dumpArray.buffer.toString("base64");
        return this.base64;
    }
}
