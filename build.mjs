#!/usr/bin/env node
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
import * as esbuild from 'esbuild';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import { showMsg, showVerbose } from './builder/reports.mjs';
import { ArgsProcessor } from './builder/args.mjs';
import { EngineHandler } from './builder/engine.mjs';
import { MODE_EMBED, MODE_NO_EMBED, MODE_NODEJS } from './builder/modes.mjs';
import { GameSrcHandler } from './builder/gameSrc.mjs';
import { EmbedChecker } from './builder/embedChecker.mjs';
import { checkForConfig } from './builder/tsconfSafety.mjs';
import { getUnixTime, isMissingFileOrDir, path } from './builder/files.mjs';
import { AssetBundler } from './builder/assetBundler.mjs';
import { getMetadataBlock } from './builder/metadata.mjs';

       ////// INFO.TXT /////////////// [_][O][X] //
      // This is the build script for IF-Octane //
     //                                        //
    // Written by Joseph Cramsey              //
   //                                        //
  // Built for Linux;                       //
 // not guaranteed to work on Windows!     //
////////////////////////////////////////////

const TIMESTAMP = String(new Date());

const args = new ArgsProcessor();
const engine = new EngineHandler(args);
engine.setMode(MODE_NODEJS);
const gameSrc = new GameSrcHandler(engine);
const checker = new EmbedChecker(gameSrc);

gameSrc.reviewBuildTargets(checker);
gameSrc.doSanityCheck(checker);

checkForConfig(checker);

var targetNode = false;

const sterilizeTitle = (title) => {
    return (title
        .replace(/[\s\?\[\]\/\\=<>:;,'"&\$#*|~`!(){}%+\.]/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+/g, '')
        .replace(/-+$/g, '')
    );
}

const runBatch = async () => {
    const settings = {
        entryPoints: [gameSrc.entryPointPath],
        outfile: engine.outputPath,
        sourcemap: args.isDebug ? 'inline' : false,
        target: targetNode ? [ 'node18' ] : [
            'es2020',
            'chrome125',
            'edge125',
            'firefox128',
            'safari17.5'
        ],
        platform: targetNode ? 'node' : 'browser',
        bundle: true,
        minify: !args.isDebug,
        drop: args.isDebug ? undefined : ['console'],
        treeShaking: !args.isDebug,
        define: {
            DEBUG: (args.isDebug ? 'true' : 'false'),
            HANDLE_ASSETS: (checker.useEmbedding ? 'true' : 'false')
        },
        plugins: [
            esbuildPluginTsc({
                force: true
            }),
        ]
    };

    const result = await esbuild.build(settings);
    if (result.errors.length > 0) {
        for (let i = 0; i < result.errors.length; i++) {
            showMsg(result.errors[i], true);
        }
        process.exit(1);
    }
}

if (args.buildForWeb) {
    targetNode = false;
    if (checker.useEmbedding) {
        if (checker.assetsNeedRebuilding) {
            const dumpObj = new AssetBundler(args);
            const newHistoryObj = {
                items: []
            };
            const assetArray = checker.getAssets();

            for (let i = 0; i < assetArray.length; i++) {
                const assetPathInfo = assetArray[i];
                showVerbose(args, "Processing " + assetPathInfo.path + "...");
                const timestamp = getUnixTime(assetPathInfo.fullPath);
                
                newHistoryObj.items.push({
                    path: assetPathInfo.path,
                    timestamp: timestamp
                });

                dumpObj.addFile(assetPathInfo);
            }

            if (isMissingFileOrDir(gameSrc.embedCachePath)) {
                showVerbose(args, "Creating embed cache...");
                fs.mkdirSync(gameSrc.embedCachePath);
            }

            showVerbose(args, "Writing new history.json...");
            fs.writeFileSync(checker.embedHistoryPath, JSON.stringify(newHistoryObj), {
                encoding: 'utf-8'
            });

            //TODO: Write base64 to cache file
            //TODO: Generate assetManifest.ts in project cache
            //TODO: Point engine to project manifest
        }
        else {
            //TODO: Use generated manifest
            //TODO: Use cached base64
            //TODO: Point engine to project manifest
        }
    }
    else {
        //TODO: Point engine to default manifest
    }
    engine.setMode(checker.useEmbedding ? MODE_EMBED : MODE_NO_EMBED);
    //await runBatch();
    //TODO: Assemble webpage around engine.outputPath
    //TODO: Append babel data to webpage
    //TODO: Name webpage appropriately
}

if (args.buildForNode) {
    targetNode = true;
    engine.setMode(MODE_NODEJS);
    await runBatch();
    //TODO: Name file appropriately
    // We are going to prepend some data and copy the rest to a final location
    const outputPath = path.resolve(gameSrc.gameSrcPath, 
        args.isDebug ? "out.js" :
        sterilizeTitle(
            gameSrc.normalizedGameInfo.title+
            "-v" + gameSrc.normalizedGameInfo.version
        ) + ".js"
    );
    showVerbose(args, "Moving output to " + outputPath);
    const copyOutStream = fs.createWriteStream(outputPath, { encoding: 'utf-8' });
    const copyInStream = fs.createReadStream(engine.outputPath, { encoding: 'utf-8' });
    // Prepend metadata
    copyOutStream.write(
        getMetadataBlock(
            args, gameSrc.normalizedGameInfo, TIMESTAMP, true, gameSrc.infoPath
        )
    );
    // Copy the bundled contents to destination, writing after metadata
    copyInStream.pipe(copyOutStream).on('error', (error) => {
        throw new Error(error.message);
    }).on('finish', () => {
        copyInStream.close();
        copyOutStream.close();
        // Make executable
        fs.chmodSync(outputPath, 0o755);
        showMsg("Embedded node metadata written successfully!");
    });
}

// Reset to standard
engine.setMode(MODE_NODEJS);
showVerbose(args, "Done!");