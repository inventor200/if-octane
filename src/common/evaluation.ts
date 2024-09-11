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

import { OutputListener } from "./messageListener";
import { say } from './sayParser';

export const evaluateMessage = (msg: any): boolean => {
    if (msg === null || msg === undefined || msg === '') return false;
    if (Array.isArray(msg)) {
        let state = false;
        for (let i = 0; i < msg.length; i++) {
            state = state || evaluateMessage(msg[i]);
        }
        return state;
    }

    OutputListener.beginListeningToOutput();
    if ((typeof msg) === 'function') {
        const ret = msg();
        const hadOutput = OutputListener.caughtOutput();
        if (ret === undefined || ret === '') {
            return hadOutput;
        }
        if (ret === null || !ret) {
            return false;
        }
        if (ret === true) {
            return true;
        }
        return evaluateMessage(ret);
    }

    say(String(msg));
    return OutputListener.caughtOutput();
}

export const evaluateString = (msg: any): string => {
    if (msg === null || msg === undefined || msg === '') return '';
    if (Array.isArray(msg)) {
        let total = "";
        for (let i = 0; i < msg.length; i++) {
            total += evaluateString(msg[i]);
        }
        return total;
    }

    if ((typeof msg) === 'function') {
        return evaluateString(msg());
    }

    return String(msg);
}

export const evaluateInteger = (msg: any, floorIsZero = false): number => {
    if (msg === null || msg === undefined || msg === '') {
        return floorIsZero ? 0 : -1;
    }
    if (Array.isArray(msg)) {
        let total = 0;
        for (let i = 0; i < msg.length; i++) {
            total += evaluateInteger(msg[i]);
        }
        return total;
    }

    if ((typeof msg) === 'function') {
        return evaluateInteger(msg());
    }

    if ((typeof msg) === 'string') {
        const intRes = parseInt(msg);
        if (!isNaN(intRes)) {
            return intRes;
        }

        const floatRes = parseFloat(msg);
        if (!isNaN(floatRes)) {
            return Math.round(floatRes);
        }
    }

    if ((typeof msg) === 'object') {
        if (msg.id != undefined) {
            return msg.id;
        }
        return 1;
    }

    return Math.round(msg);
}

export const evaluateBool = (msg: any): boolean => {
    if (
        msg === false ||
        msg === null ||
        msg === undefined ||
        msg === '' ||
        msg === 0 ||
        msg === -1
    ) {
        return false;
    }

    if (Array.isArray(msg)) {
        for (let i = 0; i < msg.length; i++) {
            if (evaluateBool(msg[i])) return true;
        }
        return false;
    }

    if ((typeof msg) === 'function') {
        return evaluateBool(msg());
    }

    return true;
}
