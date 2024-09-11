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
//
// This ensures that IF-Octane doesn't try to outpace the
// runtime environment when starting up.

import { TAB_EXPANSION, cleanStackTrace, cleanTerminalMessage, getEmoji } from './platform/ui/uiBridge';
import { GAME_EMAIL, GAME_TITLE } from "./gameInfo";
import { OctaneEngineError, OctaneGameError } from "./exceptions";

declare const DEBUG : boolean;

export enum ReportType {
    PrintedReport,
    ErrorReport
};

export interface ReportSegment {
    message: string;
    type: ReportType;
    endOfParagraph: boolean;
};

export interface ErrorPacket {
    segments: ReportSegment[],
    errorCode: number
};

const addPrinted = (
    arr : ReportSegment[],
    msg : string,
    endOfParagraph : boolean = false
) : void => {
    arr.push({
        message: msg,
        type: ReportType.PrintedReport,
        endOfParagraph: endOfParagraph
    });
}

const addError = (
    arr : ReportSegment[],
    msg : string,
    endOfParagraph : boolean = false
) : void => {
    arr.push({
        message: msg,
        type: ReportType.ErrorReport,
        endOfParagraph: endOfParagraph
    });
}

const sayOops = (arr : ReportSegment[]) : void => {
    addPrinted(arr, cleanTerminalMessage(
        "Dang...! I sincerely apologize for this disruption. " + getEmoji(2) + "\n"+
        "This is, uh... *not ideal*. Pretty embarrassing, actually..."
    ), true);
    addPrinted(arr, cleanTerminalMessage(
        "Let me see if the developer has left any contact info for\n"+
        "you, if you would like to send the above error report..."
    ), true);
    addPrinted(arr, cleanTerminalMessage(
        TAB_EXPANSION + GAME_EMAIL
    ), true);
    addPrinted(arr, cleanTerminalMessage(
        "Well... I hope something was written on the screen there.\n"+
        "Truthfully, I have no way of knowing. Maybe the developer\n"+
        "has pranked me, and left nothing there? That would be\n"+
        "humiliating... I hope you wouldn't laugh at me...! " + getEmoji(1)
    ), true);
    addPrinted(arr, cleanTerminalMessage(
        "Thank you for playing with me, though, even if it was\n"+
        "just for a moment! (Time is fuzzy; the error really messed\n"+
        "me up...) It was nice to spend some time in RAM, y'know?\n"+
        "Hopefully we can try this again soon! " + getEmoji(0)
    ), true);
    addPrinted(arr, cleanTerminalMessage(
        cleanStackTrace(
            "    Procedurally yours,\n"+
            "        - the source code for " + GAME_TITLE + "\n"+
            "            " + getEmoji(3)
        )
    ), true);
}

export const END_OF_ERROR_STRING = "{<end-of-error-report>}";

export const buildErrorReport = (error : any) : ErrorPacket => {
    const arr : ReportSegment[] = [];

    // Something very strange has happened
    if (error === undefined || error === null) {
        addError(arr, "An unknown error has occurred!", true);
        addPrinted(arr, END_OF_ERROR_STRING, true);
        if (!DEBUG) sayOops(arr);
        return {
            segments: arr,
            errorCode: 3
        };
    }
    else if ((typeof error) != 'object') {
        addError(arr, "An weird error message has been delivered:", true);
        addError(arr, String(error), true);
        addPrinted(arr, END_OF_ERROR_STRING, true);
        if (!DEBUG) sayOops(arr);
        return {
            segments: arr,
            errorCode: 3
        };
    }
    else if (!(error instanceof Error)) {
        addError(arr, "An weird error object has been delivered:", true);
        addError(arr, JSON.stringify(error), true);
        addPrinted(arr, END_OF_ERROR_STRING, true);
        if (!DEBUG) sayOops(arr);
        return {
            segments: arr,
            errorCode: 3
        };
    }

    if (error instanceof OctaneEngineError) {
        addError(arr, "An error has occurred in the IF-Octane engine!", true);
    }
    else if (error instanceof OctaneGameError) {
        addError(arr, "An error has occurred in the game world!", true);
    }
    else {
        addError(arr, "An error has occurred somewhere deep!", true);
    }

    // We have a bit more to work with
    if (error.stack) {
        addError(arr, cleanStackTrace(error.stack), true);
    }
    else {
        addError(arr, error.message, true);
    }

    addPrinted(arr, END_OF_ERROR_STRING, true);

    if (!DEBUG) sayOops(arr);

    if (error instanceof OctaneEngineError) {
        return {
            segments: arr,
            errorCode: 1
        };
    }
    else if (error instanceof OctaneGameError) {
        return {
            segments: arr,
            errorCode: 2
        };
    }
    else {
        return {
            segments: arr,
            errorCode: 3
        };
    }
}