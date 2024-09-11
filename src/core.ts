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

import { AbstractAssetManager } from "./common/abstracts";
import { PrintHandler } from "./common/platform/ui/printHandler";
import { Bootstrapper } from "./platforms/nodejs/ui/bootstrapper";
import { OctaneEngineError, OctaneGameError } from './common/exceptions';
import { say } from "./common/sayParser";
import { startMainLoop, printProtectionLines } from "./common/platform/ui/uiBridge";
import { Clock } from './common/clock';
import { WaitFor } from "./common/waitForPlayer";

declare const DEBUG : boolean;

export class CoreClass {
    private static _instance : CoreClass;

    private enabled : boolean;
    private started : boolean;

    private bootstrapper : Bootstrapper;
    private _assets : AbstractAssetManager | null;

    private logBackup : string[];
    private allowLogging : boolean;

    public waitingForPlayer : boolean;

    constructor() {
        this.enabled = false;
        this.started = false;
        this.bootstrapper = new Bootstrapper();
        this._assets = null;
        this.logBackup = [];
        this.allowLogging = false;
        this.waitingForPlayer = false;
        if (DEBUG) {
            const thisCore = this;
            console.log = (message : any, ...optionalParams: any[]) : void => {
                let buffer = "[LOG] " + String(message);
                for (let i = 0; i < optionalParams.length; i++) {
                    buffer += " " + String(optionalParams[i]);
                }
                buffer = "<.p>" + buffer + "<.p>";
                if (thisCore.allowLogging) {
                    say(buffer);
                }
                else {
                    thisCore.logBackup.push(buffer);
                }
            }
        }
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    public get assets() : AbstractAssetManager {
        if (this._assets === null) {
            throw new OctaneGameError(
                "Tried to access asset manager before calling enable()!"
            );
        }
        return this._assets;
    }

    // Called before any game code is initialized
    public async enable(callback : () => void) : Promise<void> {
        if (this.enabled) return;
        this.enabled = true;

        // Make sure we don't overwrite any logs
        printProtectionLines();

        try {
            this.bootstrapper.prepareRuntime();
            await this.bootstrapper.waitForRuntime();
            this._assets = this.bootstrapper.unpackAssets();
            WaitFor.waitingForPlayer = true;
            
            // We don't need this here.
            // Creating a print handler sets up a new page by default
            //PrintHandler.startNewPage();
            this.allowLogging = true;
            if (this.logBackup.length > 0) {
                for (let i = 0; i < this.logBackup.length; i++) {
                    say(this.logBackup[i]);
                }
            }
            PrintHandler.showSetup();
            callback();
            if (!this.started) {
                throw new OctaneGameError(
                    "Core.start() was never called from the "+
                    "Core.enable() callback!"
                );
            }
        } catch (error) {
            this.bootstrapper.reportError(error);
        }
    }

    // Call this after game code is initialized
    public start(callback : () => void) : void {
        if (this.started) return;
        this.started = true;
        startMainLoop();
        WaitFor.Player(() => {
            Clock.finishPreGame();
            callback();
        });
    }

    public showCredits() : void {
        PrintHandler.showCredits();
    }
}

export const Core = CoreClass.Instance;
