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

import * as pathGeneric from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getYYYYMMDD } from './timestamp.mjs';

// Unsure if this whole process works outside of POSIX,
// so we're defaulting to POSIX for now.
export const path = pathGeneric.posix;
export const dirName = path.dirname(fileURLToPath(import.meta.url));

export const isMissingFileOrDir = (pathStr) => {
    try {
        fs.accessSync(pathStr, fs.F_OK);
    } catch (e) {
        return true;
    }
    return false;
}

const getModTime = (path) => {
    return new Date(fs.statSync(path).mtime);
}

export const getUnixTime = (path) => {
    return Math.floor(getModTime(path).getTime() / 1000);
}

export const getModifiedDate = (path) => {
    return getYYYYMMDD(getModTime(path));
}
