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

export const isMissingString = (str) => str === undefined || str === null || str.length === 0;
export const showMsg = (str, isError=false) => {
    const header = "\x1b[2mIF-Octane \u2502\x1b[0m ";
    if (isError) {
        console.error(header + "\x1b[41m[ERROR]\x1b[0m " + str);
        return;
    }
    console.log(header + "        " + str);
}
export const endWithError = (message) => {
    if (isMissingString(message)) {
        message = "unknown error encountered";
    }
    showMsg(message, true);
    process.exit(1);
}
export const showVerbose = (args, message) => {
    if (args.isVerbose) {
        showMsg(message);
    }
}
