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
import { path, isMissingFileOrDir, getUnixTime } from './files.mjs';

export class EmbedChecker {
    constructor(gameSrc) {
        this.gameSrc = gameSrc;
        this.engine = gameSrc.engine;
        this.args = gameSrc.args;
        this.useEmbedding = false;
        this.assetsNeedRebuilding = false;
        this.process();
    }

    rebuild(reason) {
        this.assetsNeedRebuilding = true;
        showVerbose(this.args, reason + "; needs rebuilding");
    }

    fuseDirPath(dirPath, tail) {
        if (dirPath === undefined || dirPath === null || dirPath.length === 0) {
            return tail;
        }

        return path.resolve(dirPath, tail);
    }

    getAssets(dumpArray=undefined, dirPath='') {
        if (dumpArray === undefined) {
            dumpArray = [];
        }

        const explorePath = dirPath.length > 1 ?
            path.resolve(
                this.gameSrc.embedPath, dirPath
            )
        : this.gameSrc.embedPath;

        const arr = fs.readdirSync(explorePath, {
            encoding: 'utf-8'
        });

        for (let i = 0; i < arr.length; i++) {
            const assetName = arr[i];

            const assetPath = dirPath.length > 1 ?
                dirPath + '/' + assetName
            : assetName;

            const fullPath = path.resolve(
                explorePath,
                assetName
            );

            if (fs.lstatSync(fullPath).isDirectory()) {
                this.getAssets(dumpArray, assetPath);
            }
            else {
                dumpArray.push({
                    path: assetPath,
                    fullPath: fullPath
                });
            }
        }

        return dumpArray;
    }

    getAssetCount() {
        return this.getAssets().length;
    }

    hasAssets() {
        return !(this.getAssetCount() === 0);
    }

    process() {
        this.embedHistoryPath = path.resolve(this.gameSrc.embedCachePath, "history.json");

        if (!this.args.forcefulNoEmbed && this.args.buildForWeb) {
            if (!isMissingFileOrDir(this.gameSrc.embedPath)) {
                if (this.hasAssets()) {
                    showVerbose(this.args, "Found assets to embed");
                    this.useEmbedding = true;
                    if (isMissingFileOrDir(this.gameSrc.embedCachePath)) {
                        this.rebuild("No embed cache found");
                    }
                    else if (isMissingFileOrDir(this.embedHistoryPath)) {
                        this.rebuild("Missing history.json");
                    }
                    else {
                        showVerbose(this.args, "Checking asset changes...");
                        // Check modified dates of files against history.json.
                        // Rebuild if a mismatch is found.
                        const history = JSON.parse(fs.readFileSync(
                            this.embedHistoryPath, {
                            encoding: 'utf-8'
                        }));

                        let knownItemsCount = 0;
        
                        if (history.items === undefined) {
                            this.rebuild("Corrupted history.json");
                        }
                        else if (history.items.length === 0) {
                            this.rebuild("Empty history.json");
                        }
                        else {
                            knownItemsCount = history.items.length;

                            // Compare item modification dates
                            for (let i = 0; i < history.items.length; i++) {
                                const itemPath = path.resolve(
                                    this.gameSrc.embedPath,
                                    history.items[i].path
                                );

                                const itemTimestamp = history.items[i].timestamp;
        
                                showVerbose(this.args, "    " + itemPath);
        
                                if (isMissingFileOrDir(itemPath)) {
                                    this.rebuild("        Missing");
                                    break;
                                }
                                else {
                                    const fileTimestamp = getUnixTime(itemPath);

                                    if (fileTimestamp != itemTimestamp) {
                                        this.rebuild("        Old");
                                        break;
                                    }
                                }
                            }
                        }

                        // Compare item counts
                        const actualItemsCount = this.getAssetCount();

                        if (knownItemsCount != actualItemsCount) {
                            this.rebuild("Asset count mismatch");
                        }
                    }
                }
                else {
                    showVerbose(this.args, "Empty embed directory; skipping assets...");
                }
            }
            else {
                showVerbose(this.args, "No embed directory; skipping assets...");
            }
        }
    }
}