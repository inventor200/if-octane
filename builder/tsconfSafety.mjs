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

import fs from 'fs';
import { path, isMissingFileOrDir } from './files.mjs';

const addToConfig = (configLines, tabCount, str) => {
    let line = "";
    for (let i = 0; i < tabCount; i++) {
        line += "    ";
    }
    line += str;
    configLines.push(line);
}

export const checkForConfig = (checker) => {
    // Make sure the game project has a TS config file
    const srcConfigJSON = path.resolve(
        checker.args.gameSrcPath, "tsconfig.json"
    );
    if (isMissingFileOrDir(srcConfigJSON)) {
        const configLines = [];

        addToConfig(configLines, 0, '{');
        addToConfig(configLines, 1, '"compilerOptions": {');
        addToConfig(configLines, 2, '"target": "es2020",');
        addToConfig(configLines, 2, '"strict": true,');
        addToConfig(configLines, 2, '"paths": {');
        addToConfig(configLines, 3,
            '"if-octane/*": ["' + checker.engine.engineSrcDir + '/*"]'
        );
        addToConfig(configLines, 2, '}');
        addToConfig(configLines, 1, '}');
        addToConfig(configLines, 0, '}');

        fs.writeFileSync(srcConfigJSON, configLines.join('\n'), {
            encoding: 'utf-8'
        });
    }
}
