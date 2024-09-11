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

import { AbstractAssetManager } from "../../../common/abstracts";
import { buildErrorReport, ReportType, END_OF_ERROR_STRING } from "../../../common/errorPrinting";
import { BlankAssetManager } from "../assets/blankAssetManager";

//declare const HANDLE_ASSETS : boolean;

// This doesn't do much in Node's case.
export class Bootstrapper {
    constructor() { }

    public prepareRuntime() : void {
        // This would be where wait-for-page-load would be
    }

    public async waitForRuntime() : Promise<void> {
        // This halts execution until the prepare conditions are met
    }

    public unpackAssets() : AbstractAssetManager {
        // This effectively does nothing but meet expectations.
        const blank = new BlankAssetManager();
        return blank;
    }

    public reportError(error : any) : void {
        const report = buildErrorReport(error);
        const code = report.errorCode;

        process.stdout.write("\n\n\n");

        for (let i = 0; i < report.segments.length; i++) {
            const seg = report.segments[i];
            if (seg.message === END_OF_ERROR_STRING) {
                seg.message = "*** END OF ERROR REPORT ***";
            }
            if (seg.type === ReportType.PrintedReport) {
                process.stdout.write(seg.message);
                if (seg.endOfParagraph) {
                    process.stdout.write("\n\n");
                }
            }
            else {
                process.stderr.write(seg.message);
                if (seg.endOfParagraph) {
                    process.stderr.write("\n\n");
                }
            }
        }

        process.stdout.write("\n\n\n");

        process.exit(code);
    }
}
