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

import { PrintHandler } from "./printHandler";

export interface KeyStroke {
    name: string;
    content: string;
    shift: boolean;
}

export const getKey = (key : Buffer, keyBuffer : KeyStroke[]) : void => {
    if (key === undefined || key === null) return;
    if (key.length === 0) return;
    const keyString = String(key);

    // Complex ones first
    /*let keyCode = "";
    for (let i = 0; i < keyString.length; i++) {
        keyCode += Number(keyString.codePointAt(i)).toString(16);
    }
    process.stdout.write("Key = " + keyCode + "\n");*/
    if (keyString.length > 1) {
        switch (keyString) {
            case "\u001b\u005b\u0041":
                keyBuffer.push({
                    name: "up",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u0042":
                keyBuffer.push({
                    name: "down",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u0044":
                keyBuffer.push({
                    name: "left",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u0043":
                keyBuffer.push({
                    name: "right",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u0031\u003b\u0032\u0041":
                keyBuffer.push({
                    name: "up",
                    content: "",
                    shift: true
                });
                return;
            case "\u001b\u005b\u0031\u003b\u0032\u0042":
                keyBuffer.push({
                    name: "down",
                    content: "",
                    shift: true
                });
                return;
            case "\u001b\u005b\u0031\u003b\u0032\u0044":
                keyBuffer.push({
                    name: "left",
                    content: "",
                    shift: true
                });
                return;
            case "\u001b\u005b\u0031\u003b\u0032\u0043":
                keyBuffer.push({
                    name: "right",
                    content: "",
                    shift: true
                });
                return;
            case "\u001b\u005b\u0035\u007e":
                keyBuffer.push({
                    name: "page-up",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u0036\u007e":
                keyBuffer.push({
                    name: "page-down",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u0048":
                keyBuffer.push({
                    name: "home",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u0046":
                keyBuffer.push({
                    name: "end",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u0032\u007e":
                keyBuffer.push({
                    name: "insert",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u0033\u007e":
                keyBuffer.push({
                    name: "delete",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b\u005b\u005a":
                keyBuffer.push({
                    name: "tab",
                    content: "",
                    shift: true
                });
                return;
            case "\u0066\u0061\u006c\u0073\u0065":
                keyBuffer.push({
                    name: "insert",
                    content: "",
                    shift: true
                });
                return;
            case "\u001b\u005b\u0033\u003b\u0032\u007e":
                keyBuffer.push({
                    name: "delete",
                    content: "",
                    shift: true
                });
                return;
        }
        for (let i = 0; i < keyString.length; i++) {
            const singleKey = keyString[i];
            handleSimpleKey(singleKey, keyBuffer);
        }
    }
    else {
        switch (keyString) {
            default:
                handleSimpleKey(keyString, keyBuffer);
                return;
            case "\u0003":
                PrintHandler.printKillswitchAnnouncement();
                process.exit(0);
            case "\u007f":
                keyBuffer.push({
                    name: "backspace",
                    content: "",
                    shift: false
                });
                return;
            case "\u001b":
                keyBuffer.push({
                    name: "esc",
                    content: "",
                    shift: false
                });
                return;
            case "\u0020":
                keyBuffer.push({
                    name: " ",
                    content: " ",
                    shift: false
                });
                return;
            case "\u0009":
                keyBuffer.push({
                    name: "tab",
                    content: "",
                    shift: false
                });
                return;
            case "\u000d":
            case "\n":
                keyBuffer.push({
                    name: "enter",
                    content: "",
                    shift: false
                });
                return;
        }
    }
}

const handleSimpleKey = (singleKey : string, keyBuffer : KeyStroke[]) : void => {
    switch (singleKey) {
        case "a": case "b": case "c": case "d":
        case "e": case "f": case "g": case "h":
        case "i": case "j": case "k": case "l":
        case "m": case "n": case "o": case "p":
        case "q": case "r": case "s": case "t":
        case "u": case "v": case "w": case "x":
        case "y": case "z":
            keyBuffer.push({
                name: singleKey,
                content: singleKey,
                shift: false
            });
            return;
        case "A": case "B": case "C": case "D":
        case "E": case "F": case "G": case "H":
        case "I": case "J": case "K": case "L":
        case "M": case "N": case "O": case "P":
        case "Q": case "R": case "S": case "T":
        case "U": case "V": case "W": case "X":
        case "Y": case "Z":
            keyBuffer.push({
                name: singleKey.toLowerCase(),
                content: singleKey,
                shift: true
            });
            return;
        case "`": case "1": case "2": case "3":
        case "4": case "5": case "6": case "7":
        case "8": case "9": case "0": case "-":
        case "=": case "[": case "]": case "\\":
        case ";": case "'": case ",": case ".":
        case "/":
            keyBuffer.push({
                name: singleKey,
                content: singleKey,
                shift: false
            });
            return;
        case "~": case "!": case "@": case "#":
        case "$": case "%": case "^": case "&":
        case "*": case "(": case ")": case "_":
        case "+": case "{": case "}": case "|":
        case ":": case "\"": case "<": case ">":
        case "?":
            keyBuffer.push({
                name: singleKey,
                content: singleKey,
                shift: true
            });
            return;
    }
}
