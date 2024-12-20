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

import { Database } from '../world/data';
import { FIRST_TURN_TITLE } from '../miscTools';
import { PrintHandler } from "../platform/ui/printHandler";

export class ClockClass {
    private static _instance : ClockClass;

    private _currentTurn : number;
    private _currentSubStep : number;
    private inPregame : boolean;

    constructor() {
        this._currentTurn = -1;
        this._currentSubStep = 0;
        this.inPregame = true;
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    public get turn() {
        return this._currentTurn;
    }

    public get subStep() {
        return this._currentTurn;
    }

    public set currentTurn(turnNumber : number) {
        if (turnNumber === this._currentTurn) {
            return;
        }

        this.advanceTurn(turnNumber - this._currentTurn);
    }

    public advanceTurn(turns : number = 1, substeps : number = 0) {
        if (turns === 0) {
            this._currentSubStep += substeps;
        }
        else if (turns > 0) {
            for (let i = 0; i < turns; i++) {
                this.advanceTurnOnceForward();
            }
        }
        Database.solidify();
    }

    private advanceTurnOnceForward() {
        if (this.inPregame) return;
        Database.runUpdates();
        this._currentTurn++;
        this._currentSubStep = 0;
    }

    public finishPreGame() {
        if (!this.inPregame) return;
        this.inPregame = true;
        this._currentTurn = 0;
        PrintHandler.addTurnBlock(0, FIRST_TURN_TITLE);
    }
}

export const Clock = ClockClass.Instance;
