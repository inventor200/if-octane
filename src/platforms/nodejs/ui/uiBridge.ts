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

// NODE.JS MODE
import { PrintChunk } from "../../../common/sayParser";
import { AbstractPrintElement } from "../../../common/abstracts";
import { NodeInterface } from "./nodeInterface";

export const gameTitleLevel = 1;
export const turnTitleLevel = 2;
export const roomTitleLevel = 3;
export const cleanDots = (str : string) => str; // Identity
export const TAB_EXPANSION = '\u00A0\u00A0';
export const fuseContent = (
    contentTarget : AbstractPrintElement,
    chunk : PrintChunk,
    isHeader: boolean
) : void => {
    contentTarget.fuseTextTo(chunk);
}
export const cleanStackTrace = (stack : string) : string => {
    // In HTML, this would also replace newlines with <br>
    return stack.replace(/[ \f\t\v\u00A0\u2028\u2029]{4}/g, TAB_EXPANSION);
}
export const cleanTerminalMessage = (msg : string) : string => {
    // In HTML, this would replace newlines with spaces
    return msg;
}
export const getEmoji = (index : number) : string => {
    // This is just for the oops message; this should not be used anywhere else.
    switch (index) {
        default:
        case 0:
            return ":D";
        case 1:
            return ":(";
        case 2:
            return ":,(";
        case 3:
            return "<3";
    }
}
export const printProtectionLines = () : void => {
    for (let i = 0; i < process.stdout.rows - 2; i++) {
        process.stdout.write("(scrollback protection line)\n");
    }
    for (let i = 0; i < 3; i++) {
        process.stdout.write("\n");
    }
}
export const startMainLoop = () : void => {
    // This is nothing in HTML
    NodeInterface.startMainLoop();
}
