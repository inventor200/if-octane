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

import {
    gameTitleLevel, turnTitleLevel, roomTitleLevel,
    cleanDots, TAB_EXPANSION, fuseContent
} from './platform/ui/uiBridge';
import { isWhitespace } from './miscTools';
import { OutputListener } from './messageListener';
import { PrintHandler } from "./platform/ui/printHandler";
import { OctaneGameError } from './exceptions';

enum ParagraphBreakStatus {
    NO_BREAK = 0,
    ARM_BREAK = 1,
    CANCEL_BREAK = 2,
    FORCE_BREAK = 3
}

enum CapChangeStatus {
    NO_CHANGE = 0,
    CHANGE_UP = 1,
    CHANGE_DOWN = 2
}

enum SpecialType {
    NOT_SPECIAL = 0,
    BREAK = 1
}

export interface PrintChunk {
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
    isStrikethrough: boolean;
    content: string;
    specialType: SpecialType;
}

interface ParagraphSequence {
    chunks: PrintChunk[];
}

class SayParserClass {
    private static _instance: SayParserClass;

    private paragraphBreakStatus: ParagraphBreakStatus;
    private capChangeStatus: CapChangeStatus;
    public sayFollowsHeading: boolean;
    private quoteDepth: number;

    constructor() {
        this.paragraphBreakStatus = ParagraphBreakStatus.NO_BREAK;
        this.capChangeStatus = CapChangeStatus.NO_CHANGE;
        this.sayFollowsHeading = false;
        this.quoteDepth = 0;
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    private createEmptyChunk(lastChunk?: PrintChunk): PrintChunk {
        if (!lastChunk) {
            return {
                isBold: false,
                isItalic: false,
                isUnderline: false,
                isStrikethrough: false,
                content: '',
                specialType: SpecialType.NOT_SPECIAL
            };
        }
        return {
            isBold: lastChunk.isBold,
            isItalic: lastChunk.isItalic,
            isUnderline: lastChunk.isUnderline,
            isStrikethrough: lastChunk.isStrikethrough,
            content: '',
            specialType: SpecialType.NOT_SPECIAL
        };
    }

    public processSayString(str: string): ParagraphSequence[] {
        // HTML exclusively gets the "..." character.
        str = cleanDots(str);

        if (!str) return this.processSayString('<br>');

        // Sterilize
        const oldStr = str;
        str = "";
        for (let i = 0; i < oldStr.length; i++) {
            const c = oldStr[i];
            switch (c) {
                case '%':
                    str += '%%';
                    break;
                case '\n':
                    str += ' ';
                    break;
                case '\t':
                    str += '%t';
                    break;
                case '\^':
                    str += '%^';
                    break;
                case '\v':
                    str += '%v';
                    break;
                case '\b':
                    str += '<br>';
                    break;
                default:
                    str += c;
                    break;
            }
        }

        // Create paragraph-chunk structure
        let paragraph: ParagraphSequence = {
            chunks: [
                this.createEmptyChunk()
            ]
        };
        const paragraphs: ParagraphSequence[] = [paragraph];
        let escaping = false;
        let inTag = false;
        let closingTag = false;
        let tagContent: string = '';
        let wasSpace = false;

        for (let i = 0; i < str.length; i++) {
            let c = str[i];
            if (this.capChangeStatus === CapChangeStatus.CHANGE_UP) c = c.toUpperCase();
            if (this.capChangeStatus === CapChangeStatus.CHANGE_DOWN) c = c.toLowerCase();

            let pushableChunk: PrintChunk | undefined = undefined;
            let nextPushableChunk: PrintChunk | undefined = undefined;

            let lastChunk: PrintChunk = paragraph.chunks[paragraph.chunks.length - 1];
            if (escaping) {
                let skipOutput = false;
                switch (c.toLowerCase()) {
                    case '^':
                        this.capChangeStatus = CapChangeStatus.CHANGE_UP;
                        skipOutput = true;
                        break;
                    case 'v':
                        this.capChangeStatus = CapChangeStatus.CHANGE_DOWN;
                        skipOutput = true;
                        break;
                    case 't':
                        c = TAB_EXPANSION;
                        break;
                }
                escaping = false;
                OutputListener.markOutput();
                if (skipOutput) continue;
            }
            else if (c === '%') {
                escaping = true;
                continue;
            }
            else if (c === '<') {
                inTag = true;
                tagContent = '';
                continue;
            }
            else if (c === '>') {
                const lowerTag = tagContent.toLowerCase();
                inTag = false;

                let tagContentConversion = "";

                if (!closingTag) {
                    if (lowerTag === '.p') {
                        if (this.paragraphBreakStatus < ParagraphBreakStatus.CANCEL_BREAK) {
                            this.paragraphBreakStatus = ParagraphBreakStatus.ARM_BREAK;
                        }
                        continue;
                    }
                    else if (lowerTag === '.p0') {
                        if (this.paragraphBreakStatus < ParagraphBreakStatus.FORCE_BREAK) {
                            lastChunk.content += ' '; // Make sure some space pads it out.
                            this.paragraphBreakStatus = ParagraphBreakStatus.CANCEL_BREAK;
                        }
                        continue;
                    }
                    else if (lowerTag === './p0') {
                        this.paragraphBreakStatus = ParagraphBreakStatus.FORCE_BREAK;
                        continue;
                    }
                }

                const newChunk = this.createEmptyChunk(lastChunk);

                if (lowerTag === 'b' || lowerTag === 'strong') newChunk.isBold = !closingTag;
                if (lowerTag === 'i' || lowerTag === 'em') newChunk.isItalic = !closingTag;
                if (lowerTag === 'u') newChunk.isUnderline = !closingTag;
                if (lowerTag === 's') newChunk.isStrikethrough = !closingTag;

                if (lowerTag === 'br') {
                    pushableChunk = this.createEmptyChunk();
                    pushableChunk.specialType = SpecialType.BREAK;
                }

                if (lowerTag === 'q') {
                    if (!closingTag) {
                        if (this.quoteDepth % 2 === 0) {
                            tagContentConversion = '\u201C';
                        }
                        else {
                            tagContentConversion = '\u2018';
                        }
                    }
                    this.quoteDepth += (closingTag ? -1 : 1);
                    if (closingTag) {
                        if (this.quoteDepth % 2 === 0) {
                            tagContentConversion = '\u201D';
                        }
                        else {
                            tagContentConversion = '\u2019';
                        }
                    }
                }

                closingTag = false;

                if (tagContentConversion.length > 0) {
                    c = tagContentConversion;
                    OutputListener.markOutput();
                }
                else if (pushableChunk) {
                    OutputListener.markOutput();
                }
                else {
                    paragraph.chunks.push(newChunk);
                    continue;
                }
            }
            else if (inTag) {
                if (tagContent.length === 0 && c === '/') {
                    closingTag = true;
                }
                else {
                    tagContent += c;
                }
                continue;
            }

            do {
                const hasVisiblePushableChunk = (
                    pushableChunk &&
                    pushableChunk.specialType != SpecialType.BREAK
                );

                const isSpace: boolean =
                    (
                        !hasVisiblePushableChunk && isWhitespace(c)
                    ) || (
                        pushableChunk != undefined &&
                        pushableChunk.specialType === SpecialType.BREAK
                    );

                if (!isSpace && this.paragraphBreakStatus % 2 === 1) {
                    const newChunk = this.createEmptyChunk(lastChunk);
                    paragraph = {
                        chunks: [newChunk]
                    };
                    paragraphs.push(paragraph);
                    lastChunk = newChunk;
                    if (!hasVisiblePushableChunk) {
                        this.paragraphBreakStatus = ParagraphBreakStatus.NO_BREAK;
                    }
                    OutputListener.markOutput();
                }

                if (!isSpace) {
                    this.capChangeStatus = CapChangeStatus.NO_CHANGE;
                }

                if (pushableChunk) {
                    const newChunk = this.createEmptyChunk(lastChunk);
                    paragraph.chunks.push(pushableChunk);
                    paragraph.chunks.push(newChunk);
                }
                else if (!isSpace || !wasSpace) {
                    lastChunk.content += c;
                    OutputListener.markOutput();
                }

                wasSpace = isSpace;
                pushableChunk = undefined;
                if (nextPushableChunk) {
                    pushableChunk = nextPushableChunk;
                    nextPushableChunk = undefined;
                }
            } while (pushableChunk);
        }

        if (escaping) {
            throw new OctaneGameError("Incomplete escape sequence!");
        }

        if (inTag) {
            throw new OctaneGameError("Incomplete tag!");
        }

        // Clean out empties
        let firstSearchParagraph = 1;
        if (this.sayFollowsHeading) {
            firstSearchParagraph = 0;
            this.sayFollowsHeading = false;
        }

        for (let i = firstSearchParagraph; i < paragraphs.length; i++) {
            const tchunks = paragraphs[i].chunks;
            for (let j = 0; j < tchunks.length; j++) {
                const chunk = tchunks[j];
                if (
                    chunk.specialType === SpecialType.NOT_SPECIAL &&
                    chunk.content.length === 0
                ) {
                    tchunks.splice(j, 1);
                    j--;
                }
            }
            if (tchunks.length === 0) {
                paragraphs.splice(i, 1);
                i--;
            }
        }

        return paragraphs;
    }
}

const SayParser = SayParserClass.Instance;

export const sayLiteral = (str: string, headerLevel : number = 0): void => {
    const strStruct = SayParser.processSayString(str);
    const isHeader = headerLevel > 0;
    let contentTarget = isHeader ?
        PrintHandler.createTitle(headerLevel) :
        PrintHandler.getLastParagraph();
    
    if (isHeader) {
        PrintHandler.appendToOutput(contentTarget);
    }

    for (let i = 0; i < strStruct.length; i++) {
        const chunks = strStruct[i].chunks;
        for (let j = 0; j < chunks.length; j++) {
            const chunk = chunks[j];

            if (chunk.specialType === SpecialType.BREAK) {
                if (isHeader) {
                    contentTarget.fuseTextTo(' ');
                }
                else {
                    contentTarget.appendChild(
                        PrintHandler.createElement('br')
                    );
                }
            }
            else if (
                (chunk.isBold && !isHeader) ||
                chunk.isItalic ||
                (chunk.isUnderline && !isHeader) ||
                chunk.isStrikethrough
            ) {
                fuseContent(contentTarget, chunk, isHeader);
            }
            else {
                contentTarget.fuseTextTo(chunk);
            }
        }

        if (i < strStruct.length - 1 && strStruct.length > 1) {
            if (isHeader) {
                contentTarget.fuseTextTo(' ');
            }
            else {
                contentTarget = PrintHandler.createParagraph();
                PrintHandler.appendToOutput(contentTarget);
            }
        }
    }
}

export const say = (str: string): void => {
    sayLiteral(str + ' ');
}

export const sayTitle = (str : string) : void => {
    sayLiteral(str, gameTitleLevel);
    SayParser.sayFollowsHeading = true;
}

export const sayRoom = (str : string) : void => {
    sayLiteral(str, roomTitleLevel);
    SayParser.sayFollowsHeading = true;
}