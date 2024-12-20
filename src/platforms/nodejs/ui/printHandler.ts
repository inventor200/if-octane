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
    isWhitespace, getVisibleLength, MAX_TURN_TITLE_LENGTH,
    createTurnTitle, DEFAULT_TURN_ACTION_TITLE
} from "../../../common/miscTools";
import {
    AbstractPrintElement, AbstractTurnBlock, AbstractPrintHandler
} from "../../../common/abstracts";
import { PrintChunk, say, sayLiteral } from '../../../common/sayParser';
import { OctaneEngineError } from "../../../common/exceptions";
import {
    GAME_TITLE, GAME_HEADLINE, GAME_AUTHOR,
    GAME_IFID, GAME_VERSION, GAME_PUBLISH_DATE
} from '../../../common/gameInfo';
import { gameTitleLevel, turnTitleLevel, printProtectionLines } from './uiBridge';
import { WaitFor } from "../../../common/time/waitForPlayer";

const P_BREAK = '\r';
const FOOTER_PREFIX = " \x1b[7m   ";
const KILLSW_PREFIX = "\x1b[7m    ";
const FOOTER_SUFFIX = "    \x1b[0m\u2593\u2593\u2592\u2592\u2591\u2591";
const MORE_TEXT =
FOOTER_PREFIX + "\u2193    more below...    \u2193" + FOOTER_SUFFIX;
const DONE_TEXT =
FOOTER_PREFIX + "\u2713    end of scroll    \u2713" + FOOTER_SUFFIX;
const KILLSWITCH_TEXT =
KILLSW_PREFIX +      "X killswitch pressed  X" + FOOTER_SUFFIX;
const AWAIT_PLAYER_TEXT =
FOOTER_PREFIX +      "     press any key     " + FOOTER_SUFFIX;
const MINIMUM_WIDTH = Math.max(
    getVisibleLength(MORE_TEXT + 1), 
    MAX_TURN_TITLE_LENGTH
);

enum LastSpaceStatus {
    NonSpace = 0,
    LineBreak = 1,
    ParagraphBreak = 2,
    NonBreakingSpace = 3,
    NormalSpace = 4
}

const getSpaceStatus = (ch: string): LastSpaceStatus => {
    if (ch === '\u00A0') return LastSpaceStatus.NonBreakingSpace;
    if (ch === '\n') return LastSpaceStatus.LineBreak;
    if (ch === P_BREAK) return LastSpaceStatus.ParagraphBreak;
    if (isWhitespace(ch)) return LastSpaceStatus.NormalSpace;
    return LastSpaceStatus.NonSpace;
}

abstract class AbstractNodePrintElement extends AbstractPrintElement {
    public abstract getPrefix() : string;
    public abstract getContent() : string;
    public abstract getSuffix() : string;
    public abstract isHeader() : boolean;
}

class NodeTextElement extends AbstractNodePrintElement {
    public content: string;
    public isBold: boolean;
    public isItalic: boolean;
    public isUnderline: boolean;
    public isStrikethrough: boolean;

    constructor(content: string | PrintChunk) {
        super();
        if ((typeof content) === "string") {
            this.content = content as string;
            this.isBold = false;
            this.isItalic = false;
            this.isUnderline = false;
            this.isStrikethrough = false;
        }
        else {
            const chunk = content as PrintChunk;
            this.content = chunk.content;
            this.isBold = chunk.isBold;
            this.isItalic = chunk.isItalic;
            this.isUnderline = chunk.isUnderline;
            this.isStrikethrough = chunk.isStrikethrough;
        }
    }

    public fuseTextTo(str: string | PrintChunk): void {
        if ((typeof str) === "string") {
            this.content += str;
        }
        else {
            throw new OctaneEngineError("Cannot append chunks to text!");
        }
    }

    public appendChild(child: AbstractPrintElement): void {
        throw new OctaneEngineError("Cannot append elements to text!");
    }

    public getPrefix(): string {
        if (this.content.trim().length === 0) {
            // Don't stylize spaces or empties
            return "";
        }

        let buffer = "";

        if (NodePrintHandlerClass.Instance.botMode) {
            if (this.isStrikethrough) {
                buffer += "~";
            }
        }
        else if (NodePrintHandlerClass.Instance.disableANSI) {
            if (this.isItalic) {
                buffer += "*";
            }
            if (this.isStrikethrough) {
                buffer += "~";
            }
        }
        else {
            if (this.isBold) {
                buffer += "\x1b[1m";
            }
            if (this.isItalic) {
                buffer += "\x1b[3m";
            }
            if (this.isUnderline) {
                buffer += "\x1b[4m";
            }
            if (this.isStrikethrough) {
                buffer += "\x1b[9m";
            }
        }

        return buffer;
    }

    public getContent(): string {
        return this.getPrefix() + this.content + this.getSuffix();
    }

    public getSuffix(): string {
        if (this.content.trim().length === 0) {
            // Don't stylize spaces or empties
            return "";
        }

        if (NodePrintHandlerClass.Instance.botMode) {
            if (this.isStrikethrough) {
                return "~"; 
            }
        }
        else if (NodePrintHandlerClass.Instance.disableANSI) {
            let suffix = "";
            if (this.isStrikethrough) {
                suffix += "~"; 
            }
            if (this.isItalic) {
                suffix += "*"; 
            }
            return suffix;
        }
        else if (
            this.isBold ||
            this.isItalic ||
            this.isUnderline ||
            this.isStrikethrough
        ) {
            return "\x1b[0m";
        }

        return "";
    }
    
    public isHeader() : boolean {
        return false;
    }
}

class NodePrintElement extends AbstractNodePrintElement {
    public children : AbstractNodePrintElement[];
    public prefix : string;
    public suffix : string;
    public _isHeader : boolean;
    public turnBlock : NodeTurnBlock | null;

    constructor() {
        super();
        this.children = [];
        this.prefix = "";
        this.suffix = "";
        this._isHeader = false;
        this.turnBlock = null;
    }

    private sterilizeString(str : string) : string {
        if (this.children.length === 0) {
            if (str.replace(
                /^[ \f\n\r\t\v\u00A0\u2028\u2029]+$/g, ""
            ).length === 0) {
                return "";
            }
        }

        return str;
    }

    private sterilizeChunk(chunk : PrintChunk) : string {
        return this.sterilizeString(chunk.content);
    }

    public fuseTextTo(str : string | PrintChunk) : void {
        if ((typeof str) === 'string') {
            if (this.sterilizeString(str as string).length === 0) {
                // Do not try to start this with a space!!
                return;
            }
        }
        else {
            if (this.sterilizeChunk(str as PrintChunk).length === 0) {
                // Do not try to start this with a space!!
                return;
            }
        }
        const text = new NodeTextElement(str);
        this.appendChild(text);
    }

    public appendChild(child : AbstractPrintElement) : void {
        this.children.push(child as AbstractNodePrintElement);
        if (this.turnBlock) this.turnBlock.needsRebuild = true;
    }

    public getPrefix() : string {
        return this.prefix;
    }

    public getContent() : string {
        if (this.children.length === 0) return "";
        let buffer = this.getPrefix();

        for (let i = 0; i < this.children.length; i++) {
            buffer += this.children[i].getContent();
        }

        return buffer + this.getSuffix();
    }

    public getSuffix() : string {
        return this.suffix;
    }

    public isHeader() : boolean {
        return this._isHeader;
    }
}

export class NodeTurnBlock extends AbstractTurnBlock {
    public children : NodePrintElement[];
    public turnNumber : number;
    public subStep : number;
    public isBlank : boolean;
    public actionTitle : string;

    public lastSpaceStatus : LastSpaceStatus;
    public compiledText : string;
    public needsRebuild : boolean;
    public needsRewrap : boolean;
    public lines : string[];

    public previousTurn : NodeTurnBlock | null;

    constructor(
        previousTurn : NodeTurnBlock | null,
        actionTitle : string
    ) {
        super();
        this.children = [];
        this.turnNumber = 0;
        this.subStep = 0;
        this.isBlank = false;
        this.actionTitle = actionTitle;
        this.lastSpaceStatus = LastSpaceStatus.NonSpace;
        this.compiledText = "";
        this.needsRebuild = true;
        this.needsRewrap = true;
        this.lines = [];
        this.previousTurn = previousTurn;
    }

    public appendChild(child : AbstractPrintElement): void {
        const el = child as NodePrintElement;
        el.turnBlock = this;
        this.children.push(el);
        this.needsRebuild = true;
    }

    public getTurn() : number {
        return this.turnNumber;
    }

    public getSubStep() : number {
        return this.subStep;
    }

    public getActionTitle() : string {
        return this.actionTitle;
    }

    public getFirstLineNumber() {
        if (this.previousTurn === null) {
            return 0;
        }

        return this.previousTurn.getLastLineNumber() + 1;
    }

    public getLastLineNumber(cachedFirstLine : number = -1) {
        if (cachedFirstLine === -1) {
            cachedFirstLine = this.getFirstLineNumber();
        }

        return cachedFirstLine + this.lines.length - 1;
    }

    private mergeWithLines(buffer : string, lastLine : string) : string {
        const handler = NodePrintHandlerClass.Instance;
        if (getVisibleLength(buffer) === 0) {
            if (getVisibleLength(lastLine) > 0) {
                this.lines.push(lastLine);
            }
            return "";
        }

        const maxWidth = Math.min(handler.getColumns(), 100);

        const fullWidth = getVisibleLength(lastLine + buffer);

        if (fullWidth >= maxWidth) {
            this.lines.push(lastLine);
            return buffer;
        }

        return lastLine + buffer;
    }

    private compileText() {
        this.lastSpaceStatus = (this.previousTurn === null) ?
            LastSpaceStatus.ParagraphBreak :
            this.previousTurn.lastSpaceStatus;

        for (let i = 0; i < this.children.length; i++) {
            this.compiledText += this.children[i].getContent();
        }
    }

    public rebuild() {
        if (this.needsRebuild) {
            this.needsRebuild = false;
            this.needsRewrap = true;
        
            this.compiledText = "";
            
            this.compileText();

            if (this.compiledText.length === 0) {
                this.lines = [];
                this.needsRewrap = false;
                return;
            }
        }

        if (this.needsRewrap) {
            this.needsRewrap = false;
            this.lines = [];
            let betterSpacing = "";

            for (let i = 0; i < this.compiledText.length; i++) {
                const c = this.compiledText[i];
                let currentStatus = getSpaceStatus(c);
                let allow = true;

                if (currentStatus === this.lastSpaceStatus) {
                    if (
                        currentStatus === LastSpaceStatus.NormalSpace ||
                        currentStatus === LastSpaceStatus.ParagraphBreak
                    ) {
                        // All statuses can repeat except for normal spaces
                        // and paragraph breaks
                        allow = false;
                    }
                }
                else if (currentStatus === LastSpaceStatus.NormalSpace) {
                    if (
                        this.lastSpaceStatus != LastSpaceStatus.NonSpace
                    ) {
                        // Normal space can only follow non-space
                        allow = false;
                    }
                }

                if (allow) {
                    betterSpacing += c;
                    this.lastSpaceStatus = currentStatus;
                }
            }

            this.compiledText = betterSpacing
                // Line breaks and paragraph breaks wipe out prior spaces
                .replace(/[ \f\t\v\u00A0\u2028\u2029]*\n/g, '\n')
                .replace(/[ \f\t\v\u00A0\u2028\u2029]*\r+/g, '\n\n');

            let lastLine = "";
            let buffer = "";

            for (let i = 0; i < this.compiledText.length; i++) {
                const c = this.compiledText[i];

                if (c === '\n' || c === ' ') {
                    lastLine = this.mergeWithLines(buffer, lastLine);
                    buffer = "";
                }

                if (c === ' ') {
                    lastLine += ' ';
                }
                else if (c != '\n') {
                    if (c === '\u00A0') buffer += ' ';
                    else buffer += c;
                }
                else {
                    // new line
                    this.lines.push(lastLine);
                    lastLine = "";
                }
            }

            // Dump excess
            lastLine = this.mergeWithLines(buffer, lastLine);
            buffer = "";
            if (lastLine.length > 0) this.lines.push(lastLine);
        }
    }
}

export class NodePrintHandlerClass extends AbstractPrintHandler {
    private static _instance : NodePrintHandlerClass;

    public turnBlocks : NodeTurnBlock[];

    private useLockedWidth : boolean;
    private lockedWidth : number;

    private useTerminalScrolling : boolean;
    public disableANSI : boolean;

    public botMode : boolean;

    public scrollOffset : number;

    private lastScreenWidth : number;
    private lastScreenHeight : number;

    constructor() {
        super();
        const firstParagraph = this.createParagraph();
        this.turnBlocks = [];
        this.addBlankSubStep();
        this.appendToOutput(firstParagraph);

        this.useLockedWidth = false;
        this.lockedWidth = 80;
        this.useTerminalScrolling = false;
        this.disableANSI = false;
        this.botMode = false;
        this.scrollOffset = 0;

        this.lastScreenWidth = this.getColumns();
        this.lastScreenHeight = this.getRows();
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    public createParagraph() : NodePrintElement {
        const paragraph = this.createElement("p") as NodePrintElement;
        return paragraph;
    }

    public appendToOutput(child : AbstractPrintElement) {
        this.getLastTurnBlock().appendChild(child);
    }

    public createTitle(level : number) : NodePrintElement {
        const title = this.createElement("h" + level) as NodePrintElement;
        return title;
    }

    public showCredits() : void {
        const title = this.createTitle(gameTitleLevel);
        title.fuseTextTo(GAME_TITLE);
        this.appendToOutput(title);
        const creditSection = this.createElement("subtitle") as NodePrintElement;
        this.appendToOutput(creditSection);
        creditSection.fuseTextTo("By: " + GAME_AUTHOR + "\n");
        creditSection.fuseTextTo(GAME_HEADLINE + "\n");
        creditSection.fuseTextTo("IFID: " + GAME_IFID + "\n");
        creditSection.fuseTextTo("Version: " + GAME_VERSION + "\n");
        creditSection.fuseTextTo("First published: " + GAME_PUBLISH_DATE);
    }

    public showSetup(): void {
        let readingOption = "";
        let showedArgReport = false;

        for (let i = 0; i < process.argv.length; i++) {
            const arg = process.argv[i];
            if (readingOption.length === 0 && arg[0] === '-') {
                //TODO: Add an option to choose another save directory.
                //TODO: Tell the player what directory is being used on start.
                //TODO: Also tell the player if the directory can be r/w from/to.
                if (arg === "-w" || arg === "--width") {
                    readingOption = "width";
                }
                else if (arg === "-t" || arg === "--use-terminal-scrolling") {
                    this.useTerminalScrolling = true;
                }
                else if (arg === "-s" || arg === "--simple") {
                    this.disableANSI = true;
                }
                else if (arg === "-b" || arg === "--bot-mode") {
                    this.botMode = true;
                    this.useTerminalScrolling = true;
                    this.useLockedWidth = true;
                    this.lockedWidth = Number.MAX_SAFE_INTEGER;
                }
                else if (arg === "-?" || arg === "--help") {
                    process.stdout.write(
                        "Options:\n"+
                        "  --width <c>, -w <c>\n"+
                        "    Sets the maximum text width for output.\n\n"+
                        "  --use-terminal-scrolling, -t\n"+
                        "    Defers scrollback to your terminal, instead\n"+
                        "    of the engine's internal scrollback controls.\n\n"+
                        "  --simple, -s\n"+
                        "    Disable ANSI text styles.\n"+
                        "    These will be used instead:\n"+
                        "      *these are italics*\n"+
                        "      ~this is strikethrough~\n"+
                        "  --bot-mode, -b\n"+
                        "    Text content is altered to make parsing by\n"+
                        "    automated scanners easier.\n"+
                        "\n"
                    );
                    process.exit(0);
                }
                else {
                    say("Unknown option: " + arg);
                    showedArgReport = true;
                }
            }
            else if (readingOption.length > 0) {
                if (readingOption === "width") {
                    const wv = Number.parseInt(arg);
                    if (!isNaN(MINIMUM_WIDTH)) {
                        if (wv >= 40) {
                            this.useLockedWidth = true;
                            this.lockedWidth = Number.parseInt(arg);
                        }
                        else {
                            say(
                                "--width option must be "+
                                MINIMUM_WIDTH + " or greater"
                            );
                            showedArgReport = true;
                        }
                    }
                    else {
                        say("Bad width value: " + arg);
                        showedArgReport = true;
                    }
                }
                readingOption = "";
            }
        }

        // In case an argument changed the screen;
        // this wouldn't matter before now, anyway.
        this.lastScreenWidth = this.getColumns();
        this.lastScreenHeight = this.getRows();

        if (showedArgReport) sayLiteral("<.p>");

        const noticeTitle = this.createTitle(2);
        noticeTitle.fuseTextTo("Accessibility Warning");
        this.appendToOutput(noticeTitle);

        say(
            "The webpage version of this game has many more "+
            "features for supporting screen readers. If you are "+
            "using a screen reader, some of the text-based menus "+
            "and navigation controls might disrupt your gameplay. "+
            "<.p>This Node.js version is intended for bots and sighted players "+
            "who are not able to access a web browser for various "+
            "technical reasons.<.p>"+
            "We appreciate your understanding in this matter.<.p>"+
            "To check output settings, run this program with the --help "+
            "argument.<.p>"
        );
    }

    public getLastParagraph(): NodePrintElement {
        const lastTurn = this.getLastTurnBlock() as NodeTurnBlock;
        if (lastTurn.children.length === 0) {
            const actualLast = this.createParagraph();
            this.appendToOutput(actualLast);
            return actualLast;
        }
        const last = lastTurn.children[lastTurn.children.length - 1] as NodePrintElement;
        if (last.isHeader()) {
            const actualLast = this.createParagraph();
            this.appendToOutput(actualLast);
            return actualLast;
        }
        return last;
    }

    public createElement(tag : string): AbstractNodePrintElement {
        if (tag === "br") {
            const newEl = new NodeTextElement("");
            newEl.content = '\n';
            return newEl;
        }

        const newEl = new NodePrintElement();
        if (tag === "p") {
            newEl.prefix = P_BREAK + "\u00A0\u00A0";
        }
        else if (tag === "subtitle") {
            // For opening credits
            newEl.prefix = "\n";
            newEl.suffix = P_BREAK;
        }
        else if (tag === "h1") {
            newEl.prefix = this.botMode ? P_BREAK + "![h1]" : (
                this.disableANSI ? P_BREAK + "// " : P_BREAK + "\x1b[1m\x1b[4m"
            );
            newEl.suffix = this.botMode ? "" : (
                this.disableANSI ? "" : "\x1b[0m"
            );
            newEl._isHeader = true;
        }
        else if (tag === "h2") {
            newEl.prefix = this.botMode ? P_BREAK + "![h2]" : (
                this.disableANSI ? P_BREAK + "//// " : P_BREAK + "\x1b[4m"
            );
            newEl.suffix = this.botMode ? "" : (
                this.disableANSI ? "" : "\x1b[0m"
            );
            newEl._isHeader = true;
        }
        else if (tag[0] === 'h') {
            newEl.prefix = this.botMode ? P_BREAK + "![h" + tag.substring(1) + "]" : (
                this.disableANSI ? P_BREAK + "////// " : P_BREAK + "\x1b[1m"
            );
            newEl.suffix = this.botMode ? "" : (
                this.disableANSI ? "" : "\x1b[0m"
            );
            newEl._isHeader = true;
        }

        return newEl;
    }

    public startNewPage(): void {
        this.turnBlocks = [];
    }

    public finishPage(): void {
        const newWidth = this.getColumns();
        const newHeight = this.getRows();
        if (newHeight != this.lastScreenHeight) {
            printProtectionLines();
        }
        if (newWidth != this.lastScreenWidth) {
            this.lastScreenWidth = newWidth;
            const topBlock = this.getTopBlock();
            if (topBlock != null) {
                const topIndex = topBlock.getFirstLineNumber();
                const gradient = (this.scrollOffset - topIndex) / topBlock.lines.length;

                // Rewrap EVERYTHIIIIING
                for (let i = 0; i < this.turnBlocks.length; i++) {
                    const block = this.turnBlocks[i];
                    block.needsRewrap = true;
                    block.rebuild();
                }

                // Recenter the view
                const newTopIndex = topBlock.getFirstLineNumber();
                this.scrollOffset = newTopIndex + Math.floor(
                    gradient * topBlock.lines.length
                );

                return; // We handled everything else by doing this
            }
        }

        for (let i = 0; i < this.turnBlocks.length; i++) {
            const block = this.turnBlocks[i];
            if (block.needsRebuild || block.needsRewrap) {
                block.rebuild();
            }
        }
    }

    public getColumns() {
        return this.useLockedWidth ? this.lockedWidth : Math.max(
            process.stdout.columns, MINIMUM_WIDTH
        );
    }

    public getRows() {
        return process.stdout.rows - 1;
    }

    public getTopBlock() : NodeTurnBlock | null {
        let runningLineCount = 0;
        for (let i = 0; i < this.turnBlocks.length; i++) {
            const block = this.turnBlocks[i];
            runningLineCount += block.lines.length;
            if (runningLineCount > this.scrollOffset) {
                return block;
            }
        }

        return null;
    }

    public async printAt(row : number, str : string) : Promise<void> {
        return new Promise<void>(function(resolve, reject) {
            process.stdout.cursorTo(0, row, () => {
                process.stdout.write(str, () => {
                    resolve();
                })
            });
        });
    }

    public async printNow(str : string) : Promise<void> {
        return new Promise<void>(function(resolve, reject) {
            process.stdout.write(str, () => {
                resolve();
            })
        });
    }

    public async showWrappedLines() : Promise<void> {
        const blankChar = " "; // For debugging
        const maxHeight = this.useTerminalScrolling ?
            Number.MAX_SAFE_INTEGER : this.getRows();
        
        const getOpaque = (str : string, beShort : boolean = false) => {
            const blankWidth = this.getColumns() - getVisibleLength(str);
            const realWidth = beShort ? (blankWidth - 1) : blankWidth;
            let blankLine = "";
            for (let i = 0; i < realWidth; i++) {
                blankLine += blankChar;
            }
            return str + blankLine;
        }

        let fullBlankLine = "";
        for (let i = 0; i < this.getColumns(); i++) {
            fullBlankLine += blankChar;
        }

        const topBlock = this.getTopBlock();
        let blockIndex = this.turnBlocks.length;
        let lastScannedLine = 0;
        if (topBlock != null) {
            for (let i = 0; i < this.turnBlocks.length; i++) {
                if (this.turnBlocks[i] === topBlock) {
                    blockIndex = i;
                    break;
                }
            }
            const firstBlockLine = topBlock.getFirstLineNumber();
            lastScannedLine = this.scrollOffset - firstBlockLine;
        }

        let lastRenderedLine = 0;

        for (let i = 0; i < maxHeight; i++) {
            if (blockIndex >= this.turnBlocks.length) break;
            while (lastScannedLine >= this.turnBlocks[blockIndex].lines.length) {
                lastScannedLine -= this.turnBlocks[blockIndex].lines.length;
                blockIndex++;
                if (blockIndex >= this.turnBlocks.length) break;
            }
            if (blockIndex >= this.turnBlocks.length) break;

            const currentBlock = this.turnBlocks[blockIndex];
            const currentLine = currentBlock.lines[lastScannedLine];
            const lineNumber = this.scrollOffset + i;

            if (this.useTerminalScrolling) {
                if (this.botMode) {
                    await this.printNow(
                        "" + lineNumber + "=" + currentLine + "\n"
                    );
                }
                else {
                    await this.printNow(
                        currentLine + "\n"
                    );
                }
            }
            else {
                lastRenderedLine = i;
                if (currentLine.length === 0) {
                    await this.printAt(i, fullBlankLine)
                }
                else {
                    await this.printAt(i, getOpaque(currentLine));
                }
            }
            lastScannedLine++;
        }
        if (!this.useTerminalScrolling) {
            // Blank the remaining lines
            for (let i = lastRenderedLine + 1; i < this.getRows(); i++) {
                await this.printAt(i, fullBlankLine);
            }

            // Tuck away cursor
            if (blockIndex < this.turnBlocks.length) {
                await this.printAt(this.getRows(), getOpaque(MORE_TEXT, true));
            }
            else if (WaitFor.waitingForPlayer) {
                await this.printAt(this.getRows(), getOpaque(AWAIT_PLAYER_TEXT, true));
            }
            else {
                await this.printAt(this.getRows(), getOpaque(DONE_TEXT, true));
            }
            await new Promise<void>(function(resolve, reject) {
                process.stdout.cursorTo(0, PrintHandler.getRows(), () => {
                    resolve();
                });
            });
        }
    }

    public printKillswitchAnnouncement() {
        process.stdout.write(KILLSWITCH_TEXT + "\n");
    }

    public getLastTurnBlock() : AbstractTurnBlock {
        if (this.turnBlocks.length === 0) {
            return this.addBlankSubStep();
        }
        return this.turnBlocks[this.turnBlocks.length - 1];
    }

    private getDangerousLastTurnBlock() : NodeTurnBlock | null {
        if (this.turnBlocks.length === 0) return null;

        return this.turnBlocks[this.turnBlocks.length - 1];
    }

    private attachHeaderToTurn(turnBlock : NodeTurnBlock) {
        const header = this.createTitle(turnTitleLevel);
        header.fuseTextTo(createTurnTitle(turnBlock));
        turnBlock.appendChild(header);
    }

    public addTurnBlock(
        turnNumber : number,
        actionTitle : string = DEFAULT_TURN_ACTION_TITLE
    ) : AbstractTurnBlock {
        const newTurnBlock = new NodeTurnBlock(
            this.getDangerousLastTurnBlock(), actionTitle
        );

        newTurnBlock.turnNumber = turnNumber;
        newTurnBlock.subStep = 0;

        this.attachHeaderToTurn(newTurnBlock);

        this.turnBlocks.push(newTurnBlock);
        return newTurnBlock;    
    }

    public addSubStep(
        subStep : number,
        actionTitle : string = DEFAULT_TURN_ACTION_TITLE
    ) : AbstractTurnBlock {
        const newTurnBlock = new NodeTurnBlock(
            this.getDangerousLastTurnBlock(), actionTitle
        );
        if (this.turnBlocks.length > 0) {
            const lastBlock = this.getLastTurnBlock() as NodeTurnBlock;
            newTurnBlock.turnNumber = lastBlock.turnNumber;
        }

        newTurnBlock.subStep = subStep;

        this.attachHeaderToTurn(newTurnBlock);
        
        this.turnBlocks.push(newTurnBlock);
        return newTurnBlock;    
    }

    public addBlankSubStep(
        actionTitle : string = DEFAULT_TURN_ACTION_TITLE
    ) : AbstractTurnBlock {
        const newTurnBlock = new NodeTurnBlock(
            this.getDangerousLastTurnBlock(), actionTitle
        );
        if (this.turnBlocks.length > 0) {
            const lastBlock = this.getLastTurnBlock() as NodeTurnBlock;
            newTurnBlock.turnNumber = lastBlock.turnNumber;
            newTurnBlock.subStep = lastBlock.subStep;
        }
        newTurnBlock.isBlank = true;
        this.turnBlocks.push(newTurnBlock);
        return newTurnBlock;    
    }

    public undoLastTurnBlock() : AbstractTurnBlock | null {
        if (this.turnBlocks.length === 0) return null;
        const removed = this.turnBlocks.pop();
        removed!.previousTurn = null;
        return removed as AbstractTurnBlock;
    }
}

export const PrintHandler = NodePrintHandlerClass.Instance;
