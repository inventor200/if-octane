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
import YAML from 'yaml';
import { showMsg, endWithError, showVerbose, isMissingString } from './reports.mjs';
import { path, isMissingFileOrDir, getModifiedDate } from './files.mjs';
import { randomUUID } from 'crypto';
import { getSimpleTimestamp, getYear } from './timestamp.mjs';

export class GameSrcHandler {
    constructor(engine) {
        this.engine = engine;
        this.args = engine.args;
        this.process();
    }

    process() {
        if (isMissingString(this.args.gameSrcPath)) {
            endWithError("Missing source directory (--source-dir)");
        }
        
        if (isMissingFileOrDir(this.args.gameSrcPath)) {
            endWithError("Source directory does not exist");
        }

        this.gameSrcPath = this.args.gameSrcPath;
        
        showVerbose(this.args, "Source location: " + this.args.gameSrcPath);

        process.chdir(this.gameSrcPath);
        
        const baseInfoPath = path.resolve(this.args.gameSrcPath, "info");
        this.infoPath = baseInfoPath;
        // Check for valid alternative, if necessary
        if (isMissingFileOrDir(this.infoPath)) {
            // It's natural to append a text extension
            this.infoPath = baseInfoPath + ".txt";
        }
        else if (isMissingFileOrDir(this.infoPath)) {
            // It's technically in yaml format
            this.infoPath = baseInfoPath + ".yml";
        }
        
        showVerbose(this.args, "Info file: " + this.infoPath);
        
        if (isMissingFileOrDir(this.infoPath)) {
            endWithError("Info file expected at \"" + this.infoPath + '"');
        }

        this.gameInfo = YAML.parse(fs.readFileSync(this.infoPath, "utf-8"));
        this.normalizedGameInfo = {
            title: "",
            headline: "",
            author: "",
            email: "",
            ifid: "",
            version: "",
            blurb: "",
            buildCode: "",
            stageName: "",
            patchCode: "",
            firstPublished: getSimpleTimestamp()
        }

        if (this.args.isDebug) {
            // Check for a published token, which gives us our
            // first publication date. If we delete this token,
            // it resets the date.
            const firstPublishedToken = path.resolve(
                this.args.gameSrcPath, ".published"
            );
            if (isMissingFileOrDir(firstPublishedToken)) {
                // Create the missing token
                fs.closeSync(fs.openSync(firstPublishedToken, 'w'));
            }
            else {
                this.normalizedGameInfo.firstPublished =
                    getModifiedDate(firstPublishedToken);
            }
        }

        const propString = (prop) => {
            const sterilizeNewlines = (str) => {
                let lineBuffer = "";
                if (str.length > 2) {
                    lineBuffer += str[0];
                    for (let i = 1; i < str.length - 1; i++) {
                        if (
                            str[i - 1] != '\n' &&
                            str[i] === '\n' &&
                            str[i + 1] != '\n'
                        ) {
                            lineBuffer += ' ';
                        }
                        else {
                            lineBuffer += str[i];
                        }
                    }
                    lineBuffer += str[str.length - 1];
                }
                else {
                    lineBuffer = str;
                }

                return (lineBuffer
                    .replace(/\n{3,}/g, '\n\n')
                    .replace(/ {2,}/g, ' ')
                    .replace(/\.{4,}/g, "...") // Prevent false termination
                    .replace(/\*\//g, "o/") // Prevent false node end comment
                    .replace(/-->/g, "==>") // Prevent false HTML end comment
                );
            }
            const val = this.gameInfo[prop];
            if (Array.isArray(val)) {
                let buffer = "";
                for (let i = 0; i < val.length; i++) {
                    buffer += String(val[i]).trim() + "\n";
                }
                return sterilizeNewlines(buffer.trim());
            }
            return sterilizeNewlines(String(val).trim());
        }

        // Make capitalization more consistent
        let foundVersion = false;
        for (let prop in this.gameInfo) {
            if (Object.prototype.hasOwnProperty.call(this.gameInfo, prop)) {
                const propName = String(prop);
                const normalized = propName.toLowerCase();
                if (normalized === "title") {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"title\"...");
                    this.normalizedGameInfo.title = propString(prop);
                }
                else if (
                    normalized === "headline" ||
                    normalized === "subtitle"
                ) {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"headline\"...");
                    this.normalizedGameInfo.headline = propString(prop);
                }
                else if (
                    normalized === "author" ||
                    normalized === "by" ||
                    normalized === "byline" ||
                    normalized === "creator" || 
                    normalized === "writer"
                ) {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"author\"...");
                    this.normalizedGameInfo.author = propString(prop);
                }
                else if (
                    normalized === "email" ||
                    normalized === "contact"
                ) {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"email\"...");
                    this.normalizedGameInfo.email = propString(prop);
                }
                else if (
                    normalized === "ifid" ||
                    normalized === "uuid" ||
                    normalized === "guid" ||
                    normalized === "id"
                ) {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"IFID\"...");
                    this.normalizedGameInfo.ifid = propString(prop);
                }
                else if (normalized === "version") {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"version\"...");
                    this.normalizedGameInfo.version = propString(prop);
                    foundVersion = true;
                }
                else if (
                    normalized === "summary" ||
                    normalized === "blurb" ||
                    normalized === "description" ||
                    normalized === "desc" ||
                    normalized === "about"
                ) {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"blurb\"...");
                    this.normalizedGameInfo.blurb = propString(prop);
                }
                else if (normalized === "build") {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"build\"...");
                    this.normalizedGameInfo.buildCode = propString(prop);
                }
                else if (normalized === "stage") {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"stage\"...");
                    this.normalizedGameInfo.stageName = propString(prop);
                }
                else if (normalized === "patch") {
                    showVerbose(this.args, "Understanding \"" + propName + "\" as \"patch\"...");
                    this.normalizedGameInfo.patchCode = propString(prop);
                }
                else {
                    showVerbose(this.args, "Unknown property \"" + propName + "\"; skipping...");
                }
            }
        }

        // Check for missing info
        const checkMissingInfo = (prop, fallback) => {
            if (this.normalizedGameInfo[prop].length === 0) {
                this.normalizedGameInfo[prop] = fallback;
                showMsg(
                    " !! Info is missing " + prop + "! Fallback: " + fallback
                );
            }
        }
        
        checkMissingInfo("title", "Untitled");
        checkMissingInfo("headline", "An IF-Octane game!");
        checkMissingInfo("author", "Anonymous");
        checkMissingInfo("email", "No email listed");
        checkMissingInfo("ifid", randomUUID());
        checkMissingInfo("blurb", "A game built with IF-Octane.");

        // Check for composite versioning
        if (this.normalizedGameInfo.version.length === 0) {
            showVerbose(this.args, "Version is missing; building composite from build, stage, and patch...");
            this.normalizedGameInfo.version = "" + this.normalizedGameInfo.buildCode;
            let hasPatch = (this.normalizedGameInfo.patchCode.length > 0);
            if (hasPatch && !isNaN(this.normalizedGameInfo.patchCode) && Number(this.normalizedGameInfo.patchCode) === 0) {
                hasPatch = false; // A patch of "0" is not actually a patch
            }
            if (hasPatch) {
                this.normalizedGameInfo.version += "." + this.normalizedGameInfo.patchCode;
            }
            if (this.normalizedGameInfo.stageName.length > 0) {
                this.normalizedGameInfo.version += " " + this.normalizedGameInfo.stageName;
            }
            if (hasPatch) {
                this.normalizedGameInfo.version += " (patch " + this.normalizedGameInfo.patchCode + ")";
            }
            showVerbose(this.args, "Composite version: " + this.normalizedGameInfo.version);
        }

        checkMissingInfo("version", "unknown");

        showVerbose(this.args, "Writing gameInfo.ts ...");
        let gameInfoBuffer =
`// IF-Octane
// Copyright (C) ${getYear()}  Joseph Cramsey
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

export const GAME_TITLE = "${this.normalizedGameInfo.title}";
export const GAME_AUTHOR = "${this.normalizedGameInfo.author}";
export const GAME_EMAIL = "${this.normalizedGameInfo.email}";
export const GAME_IFID = "${this.normalizedGameInfo.ifid}";
export const GAME_VERSION = "${this.normalizedGameInfo.version}";
export const GAME_HEADLINE = "${this.normalizedGameInfo.headline}";
export const GAME_BLURB = "${this.normalizedGameInfo.blurb.replace(/\n/g, '\\n')}";
export const GAME_PUBLISH_DATE = "${this.normalizedGameInfo.firstPublished}";
`;
        fs.writeFileSync(
            path.resolve(this.engine.engineSrcDir, "common", "gameInfo.ts"),
            gameInfoBuffer, {
                encoding: 'utf-8',
            }
        );
        
        this.entryPointPath = path.resolve(this.args.gameSrcPath, this.args.entryPointTitle);
        
        showVerbose(this.args, "Source entry point: " + this.entryPointPath);
        
        if (isMissingFileOrDir(this.entryPointPath)) {
            endWithError("Source directory missing \"" + this.args.entryPointTitle + '"');
        }
        
        this.embedPath = path.resolve(this.args.gameSrcPath, "embed");
        this.embedCachePath = path.resolve(this.args.gameSrcPath, ".embed-cache");
    }

    reviewBuildTargets(checker) {
        if (this.args.isVerbose) {
            if (this.args.forcefulNoEmbed) {
                showMsg("Forcing no-embed mode!");
            }
            showMsg("Building for:");
            if (this.args.buildForWeb) {
                if (checker.useEmbedding) {
                    showMsg("  + Web (with embedded assets)");
                }
                else {
                    showMsg("  + Web");
                }
            }
            if (this.args.buildForNode) {
                showMsg("  + Node.JS");
            }
        }
    }

    doSanityCheck(checker) {
        if (this.args.forceAssetRebuild) {
            if (!this.args.buildForWeb || this.args.forcefulNoEmbed) {
                if (this.args.isVerbose) {
                    const messagesOfConcern = [
                        "Having a rough dev session, yeah...?",
                        "Everything going alright, outside of this...?",
                        "Have you had any water recently...?",
                        "Maybe it's time for a snack...?",
                        "How long have you been awake...?",
                        "Uh... Posture check, maybe...?"
                    ];
                    const concernIndex = Math.floor(
                        Math.random() * messagesOfConcern.length
                    );
                    const chosenConcern = messagesOfConcern[concernIndex];
                    const strangeBehavior = this.args.buildForWeb ?
                        "forcing no-embed" : // refuses assets
                        "only building for Node.JS"; // does not use assets
                    showMsg(
                        "Hey, uh... You're " + strangeBehavior + ", " +
                        "but you're also forcefully rebuilding all assets...? " +
                        "Are, um... Are you okay there, buddy...? " +
                        chosenConcern
                    );
                }
            }
            else {
                checker.assetsNeedRebuilding = true;
            }
        }
    }
}