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

// HTML MODE
import { PrintChunk } from "../../../common/sayParser";
import { AbstractPrintElement } from "../../../common/abstracts";
import { PrintHandler } from "./printHandler";

export const gameTitleLevel = 1;
export const turnTitleLevel = 2;
export const roomTitleLevel = 3;
export const cleanDots = (str : string) => {
    // Use character for better screen reader compatibility
    return str.replace(/\.\.\./g, "\u2026");
}
export const TAB_EXPANSION = '\u00A0\u00A0\u00A0\u00A0';
export const fuseContent = (
    contentTarget : AbstractPrintElement,
    chunk : PrintChunk,
    isHeader : boolean
) : void => {
    // Use the nested model
    let current: AbstractPrintElement = contentTarget;
    const addToStack = (tag: string) : void => {
        //FIXME: Create the print handler for HTML
        const nel = PrintHandler.createElement(tag);
        current.appendChild(nel);
        current = nel;
    }

    if (chunk.isItalic) addToStack('em');
    if (chunk.isStrikethrough) addToStack('s');
    if (chunk.isBold && !isHeader) addToStack('strong');
    if (chunk.isUnderline && !isHeader) addToStack('u');

    current.fuseTextTo(chunk.content);
}
