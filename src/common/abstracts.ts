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

import { PrintChunk } from "./sayParser";

export abstract class AbstractTurnBlock {
    public abstract appendChild(child : AbstractPrintElement) : void;
    public abstract getTurn() : number;
    public abstract getSubStep() : number;
    public abstract getActionTitle() : string;
}

export abstract class AbstractPrintElement {
    public abstract fuseTextTo(str : string | PrintChunk) : void;
    public abstract appendChild(child : AbstractPrintElement) : void;
}

export abstract class AbstractPrintHandler {
    public abstract getLastParagraph() : AbstractPrintElement;
    public abstract createElement(tag : string) : AbstractPrintElement;
    public abstract createParagraph() : AbstractPrintElement;
    public abstract createTitle(level : number) : AbstractPrintElement;
    public abstract appendToOutput(child : AbstractPrintElement) : void;
    public abstract finishPage() : void;
    public abstract startNewPage() : void;
    public abstract showCredits() : void;
    public abstract showSetup() : void;
    public abstract getLastTurnBlock() : AbstractTurnBlock | null;
    public abstract addTurnBlock(turnNumber : number, actionTitle : string) : AbstractTurnBlock;
    public abstract addSubStep(subStep : number, actionTitle : string) : AbstractTurnBlock;
    public abstract addBlankSubStep() : AbstractTurnBlock;
    public abstract undoLastTurnBlock() : AbstractTurnBlock | null;
}

export abstract class AbstractAssetManager {
    public abstract unpack() : void;
}
