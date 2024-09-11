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

import { say, sayLiteral } from './sayParser';

class OutputListenerClass {
    private static _instance: OutputListenerClass;

    private stack: boolean[];

    constructor() {
        this.stack = [];
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    public beginListeningToOutput(): void {
        this.stack.push(false);
    }

    public markOutput(): void {
        if (this.stack.length === 0) return;
        this.stack[this.stack.length - 1] = true;
    }

    public caughtOutput(): boolean {
        if (this.stack.length === 0) return false;
        return !this.stack.pop();
    }
}

export const OutputListener = OutputListenerClass.Instance;

export const listenToSay = (str: string): boolean => {
    OutputListener.beginListeningToOutput();
    say(str);
    return OutputListener.caughtOutput();
}

export const listenToSayLiterally = (str: string): boolean => {
    OutputListener.beginListeningToOutput();
    sayLiteral(str);
    return OutputListener.caughtOutput();
}
