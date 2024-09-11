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

// This is the default manifest definition.
// Specific definitions are generated per project.

class AssetManifest {
    private static _instance: AssetManifest;

    base64 : string;
    filePaths : string[];
    fileStarts : number[];

    private constructor() {
        this.base64 = '';
        this.filePaths = [];
        this.fileStarts = [];
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }
}

export const assetManifest = AssetManifest.Instance;
