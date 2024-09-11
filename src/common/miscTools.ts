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

import { AbstractTurnBlock } from "./abstracts";

export const isWhitespace = (ch: string) : boolean => {
    if (ch.length > 1) return false;
    return ' \f\n\r\t\v\u00A0\u2028\u2029'.indexOf(ch) > -1;
}

// Provides the length of visible characters in a string
export const getVisibleLength = (str : string) : number => {
    if (str.length === 0) return 0;
    let count = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '\x1b') i += 3;
        else count++;
    }
    return count;
}

export const MAX_TURN_TITLE_LENGTH = 40;

export const createTurnTitle = (turnBlock : AbstractTurnBlock) => {
    const actionParts = turnBlock.getActionTitle().toLowerCase().split(' ');
    let truncatedAction = actionParts[0];
    let truncatedLen = actionParts[0].length;
    let truncatedCount = 1;
    while (
        truncatedCount < actionParts.length &&
        truncatedLen + actionParts[truncatedCount].length + 1 < MAX_TURN_TITLE_LENGTH
    ) {
        truncatedAction += " " + actionParts[truncatedCount];
        truncatedLen = truncatedAction.length;
        truncatedCount++;
    }
    if (truncatedLen < turnBlock.getActionTitle().length) {
        // ...
        truncatedAction += "\u2026";
    }
    let title = truncatedAction + " report";
    let writtenTurns = String(turnBlock.getTurn());
    if (turnBlock.getSubStep() > 0) {
        writtenTurns += '.' + String(turnBlock.getSubStep());
    }

    title =
        "Turn " + writtenTurns + " report, after \u201C" +
        truncatedAction + "\u201D";

    return title;
}

export const FIRST_TURN_TITLE = "begin game";
export const DEFAULT_TURN_ACTION_TITLE = "browsing actions";