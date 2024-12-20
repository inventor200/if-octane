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

import { PrintHandler, NodeTurnBlock } from "./printHandler";
import { WaitFor } from "../../../common/time/waitForPlayer";
import { Clock } from "../../../common/time/clock";
import { KeyStroke, getKey } from "./keyStroke";

const simpleScrollAmount = 3;
const biggerScrollAmount = simpleScrollAmount * 2;
const pageScrollAmount = () => {
    return PrintHandler.getRows() - simpleScrollAmount;
}

class NodeInterfaceClass {
    private static _instance : NodeInterfaceClass;

    private keyBuffer : KeyStroke[];
    private keepRunning : boolean;

    constructor() {
        this.keyBuffer = [];
        this.keepRunning = true;
    }
    
    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    private async listenForKey() : Promise<void> {
        process.stdin.resume();
        return await new Promise<void>(function(resolve, reject) {
            process.stdin.once("data", (key : any) => {
                process.stdin.pause();
                const node = NodeInterfaceClass.Instance;
                getKey(key, node.keyBuffer);
                resolve();
            });
        });
    }

    public async startMainLoop() : Promise<void> {
        process.stdin.setRawMode(true);
        process.stdin.setEncoding("utf8");
        await this.refreshScreen();
        
        while (this.keepRunning) {
            await this.listenForKey();
            let somethingHappened = false;
            while (this.keyBuffer.length > 0) {
                somethingHappened = true;
                this.handleKey();
            }
            if (somethingHappened) {
                await this.refreshScreen();
            }
        }

        // Disengage key reading on exit
        process.stdin.pause();
    }

    private async refreshScreen() {
        PrintHandler.finishPage();
        await PrintHandler.showWrappedLines();
    }

    private handleKey() {
        const key = this.keyBuffer.shift()!;
        if (key.shift) {
            if (key.name === "up") {
                this.moveScrollOffset(-biggerScrollAmount);
                return;
            }
            if (key.name === "down") {
                this.moveScrollOffset(biggerScrollAmount);
                return;
            }
        }
        else {
            if (key.name === "up") {
                this.moveScrollOffset(-simpleScrollAmount);
                return;
            }
            if (key.name === "down") {
                this.moveScrollOffset(simpleScrollAmount);
                return;
            }
        }

        if (key.name === "page-up") {
            this.moveScrollOffset(-pageScrollAmount());
            return;
        }
        if (key.name === "page-down") {
            this.moveScrollOffset(pageScrollAmount());
            return;
        }

        // It's not a navigation key, so we count it.
        if (WaitFor.waitingForPlayer) {
            WaitFor.waitingForPlayer = false;
            WaitFor.disarm();
            Clock.advanceTurn(0, 0);
            return;
        }
    }

    private async setScrollOffset(scrollOffset : number) : Promise<void> {
        if (scrollOffset === PrintHandler.scrollOffset) return;
        PrintHandler.scrollOffset = scrollOffset;
    }

    private async moveScrollOffset(amount : number) : Promise<void> {
        let upperLimit = 0;
        const lastTurnBlock = PrintHandler.getLastTurnBlock() as NodeTurnBlock;
        if (lastTurnBlock != null) {
            upperLimit = lastTurnBlock.getLastLineNumber() - Math.floor(
                PrintHandler.getRows() / 2
            );
        }

        const oldOffset = PrintHandler.scrollOffset;
        let newOffset = oldOffset + amount;
        
        if (newOffset > upperLimit) newOffset = upperLimit;
        if (newOffset < 0) newOffset = 0;

        await this.setScrollOffset(newOffset);
    }
}

export const NodeInterface = NodeInterfaceClass.Instance;
