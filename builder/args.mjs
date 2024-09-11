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

import { endWithError } from './reports.mjs';
import { path, dirName } from './files.mjs';

export class ArgsProcessor {
    constructor() {
        this.expandedArgs = [];
        this.needsHelp = false;
        // dirName is relative to builder imports
        this.enginePath = path.resolve(dirName, "..");
        this.gameSrcPath = path.resolve(".");
        this.argParserMode = null;
        this.isDebug = false;
        this.entryPointTitle = "main.ts";
        this.buildForWeb = false;
        this.buildForNode = false;
        this.isVerbose = false;
        this.forcefulNoEmbed = false;
        this.forceAssetRebuild = false;
        this.overrideMode;
        this.process();
    }

    process() {
        for (let i = 2; i < process.argv.length; i++) {
            const arg = process.argv[i];
            const argLow = arg.toLowerCase();
            if (arg.startsWith("--")) {
                // This is a normal arg
                this.expandedArgs.push(argLow);
                if (argLow === "--help") {
                    this.needsHelp = true;
                    break;
                }
            }
            else if (arg.startsWith("-")) {
                // This must be a mini-arg
                const noHead = arg.substring(1);
                for (let j = 0; j < noHead.length; j++) {
                    const miniArg = noHead[j];
                    this.expandedArgs.push("--" + miniArg);
                    if (miniArg === "h") {
                        this.needsHelp = true;
                        break;
                    }
                }
                if (this.needsHelp) break;
            }
            else {
                // This is something else
                this.expandedArgs.push(arg);
            }
        }

        if (this.needsHelp) {
            // Show the help text
            const showOption = (longName, argText, purpose) => {
                console.log("  --" + longName + " <" + argText + ">");
                console.log("    " + purpose.replace(/\n/g, "\n    "));
                console.log("");
            }
            const showFlag = (longName, shortName, purpose) => {
                console.log("  --" + longName + " | -" + shortName);
                console.log("    " + purpose.replace(/\n/g, "\n    "));
                console.log("");
            }
        
            console.log("OPTIONS:");
            showOption(
                "engine-dir", "path/to/directory",
                "Defines the IF-Octane engine directory.\n" +
                "By default, this is the directory containing this build script."
            );
            showOption(
                "source-dir", "path/to/directory",
                "Defines the game project source directory.\n" +
                "By default, this is the current working directory."
            );
            showOption(
                "entry-point", "filename",
                "Defines the game project entry point.\n" +
                "By default, this is \"main.ts\"."
            );
            showOption(
                "mode", "mode_id",
                "Defines the game project entry point.\n" +
                "By default, this is \"default\".\n" +
                "Available modes are:\n" +
                "  - default\n" +
                "  - no-embed\n" +
                "  - nodejs"
            );
        
            console.log("FLAGS:");
            showFlag(
                "help", "h",
                "Displays this help screen."
            );
            showFlag(
                "debug", "d",
                "Build the project in debug mode."
            );
            showFlag(
                "web", "w",
                "Build a version for web play."
            );
            showFlag(
                "node", "n",
                "Build a version for node.js."
            );
            showFlag(
                "verbose", "v",
                "Show extra messages, detailing the build process."
            );
            showFlag(
                "force-no-embed", "f",
                "Forcefully do not embed assets into build targets."
            );
            showFlag(
                "force-asset-rebuild", "r",
                "Forcefully rebuild all embedded assets."
            );
        
            process.exit(0);
        }

        for (let i = 0; i < this.expandedArgs.length; i++) {
            const arg = this.expandedArgs[i];
            if (this.argParserMode != null) {
                switch (this.argParserMode) {
                    case "--engine-dir":
                        this.enginePath = path.resolve(this.enginePath, arg);
                        break;
                    case "--source-dir":
                        this.gameSrcPath = path.resolve(".", arg);
                        break;
                    case "--entry-point":
                        this.entryPointTitle = arg;
                        break;
                    case "--mode":
                        switch (arg.toLowerCase()) {
                            default:
                            case "default":
                            case "embed":
                                this.overrideMode = MODE_EMBED;
                                break;
                            case "no-embed":
                                this.overrideMode = MODE_NO_EMBED;
                                break;
                            case "node":
                            case "nodejs":
                            case "node-js":
                                this.overrideMode = MODE_NODEJS;
                                break;
                        }
                }
                this.argParserMode = null;
            }
            else {
                switch (arg) {
                    case "--engine-dir":
                    case "--source-dir":
                    case "--entry-point":
                    case "--mode":
                        this.argParserMode = arg;
                        break;
                    case "--debug":
                    case "--d":
                        this.isDebug = true;
                        break;
                    case "--web":
                    case "--w":
                        this.buildForWeb = true;
                        break;
                    case "--node":
                    case "--n":
                        this.buildForNode = true;
                        break;
                    case "--verbose":
                    case "--v":
                        this.isVerbose = true;
                        break;
                    case "--force-no-embed":
                    case "--f":
                        this.forcefulNoEmbed = true;
                        break;
                    case "--force-asset-rebuild":
                    case "--r":
                        this.forceAssetRebuild = true;
                        break;
                    default:
                        endWithError("Unknown argument \"" + arg + '"');
                        break;
                }
            }
        }
    }
}