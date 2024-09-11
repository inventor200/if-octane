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
import { endWithError, showVerbose, isMissingString } from './reports.mjs';
import { path, isMissingFileOrDir } from './files.mjs';
import { MODE_NO_EMBED, MODE_NODEJS } from './modes.mjs';

export class EngineHandler {
    constructor(args) {
        this.args = args;
        this.process();
    }

    process() {
        if (isMissingString(this.args.enginePath)) {
            endWithError("Missing engine directory (--engine-dir)");
        }
        
        if (isMissingString(this.args.entryPointTitle)) {
            endWithError("Missing entry point (--entry-point)");
        }
        
        if (isMissingFileOrDir(this.args.enginePath)) {
            endWithError("Engine directory does not exist");
        }
        
        showVerbose(this.args, "Engine location: " + this.args.enginePath);
        
        this.engineSrcDir = path.resolve(this.args.enginePath, "src");
        
        if (isMissingFileOrDir(this.engineSrcDir)) {
            endWithError("Bad engine directory");
        }
        
        // Make sure the cache path is intact
        this.cachePath = path.resolve(this.args.enginePath, "cache");
        if (isMissingFileOrDir(this.cachePath)) {
            fs.mkdirSync(this.cachePath);
        }
        
        this.outputPath = path.resolve(this.cachePath, "bundle.js");
        this.platformPath = path.resolve(this.engineSrcDir, "common/platform");

        if (this.args.overrideMode != undefined) {
            showVerbose(this.args, "Overriding mode...");
            this.setMode(this.args.overrideMode);
            process.exit(0);
        }
        
        if (!this.args.buildForWeb && !this.args.buildForNode) {
            endWithError("No build targets specified");
        }
    }

    setMode(mode) {
        if (!isMissingFileOrDir(this.platformPath)) {
            fs.unlinkSync(this.platformPath);
        }
        
        if (isMissingFileOrDir(this.platformPath)) {
            if (mode === MODE_NO_EMBED) {
                showVerbose(this.args, "Setting mode: no-embed");
                fs.symlinkSync("../platforms/no-embed", this.platformPath, "dir");
            }
            else if (mode === MODE_NODEJS) {
                showVerbose(this.args, "Setting mode: node");
                fs.symlinkSync("../platforms/nodejs", this.platformPath, "dir");
            }
            else {
                showVerbose(this.args, "Setting mode: web");
                fs.symlinkSync("../platforms/embed", this.platformPath, "dir");
            }
        }
        else {
            endWithError("Failed to remove platform symlink");
        }
    }
}
