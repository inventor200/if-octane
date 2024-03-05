var if_octane_output_element = null;
var if_octane_force_new_paragraph = false;
var if_octane_sr_announcements_element = null;
var if_octane_latest_report_number = 0;
const if_octane_report_sections = [];
const IF_OCTANE_LATEST_REPORT_ID = "latest-transcript-report";
const IF_OCTANE_LIVE_REGION_LOCK_DELAY = 250;

var if_octane_paragraphs_count = 0;
var if_octane_inline_action_count = 0;
var if_octane_grouped_action_count = 0;

const ANNOUNCEMENT_TYPE_TEXT = 0;
const ANNOUNCEMENT_TYPE_AUDIO = 1;

class LiveRegionManager {
    constructor(id) {
        this.id = id;
        this.div = undefined;
        this.mainBuffer = [];
        this.secondaryBuffer = [];
        this.isLocked = false;
        this.fusionDiv = undefined;
        this.announcementPacket = undefined;
    }

    getDiv() {
        if (!this.div) {
            this.div = document.getElementById(this.id);
        }

        return this.div;
    }

    shiftContent(contentDiv) {
        this.getDiv().parentElement.insertBefore(
            contentDiv, this.getDiv()
        );
    }

    clearDiv() {
        if (!this.announcementPacket) return;

        this.announcementPacket.remove();
        this.announcementPacket = undefined;
    }

    addMessage(str, msgType=ANNOUNCEMENT_TYPE_TEXT) {
        const newMsg = {
            content: str,
            type: msgType
        };

        let dest = this.mainBuffer;
        if (this.isLocked) {
            dest = this.secondaryBuffer;
        }

        // Audio clips always play before anything else
        if (msgType === ANNOUNCEMENT_TYPE_AUDIO && dest.length > 0) {
            for (let i = 0; i < dest.length; i++) {
                const currentType = dest[i].type;
                if (currentType === ANNOUNCEMENT_TYPE_AUDIO) continue;
                dest.insert(i, newMsg);
            }
        }
        else {
            dest.push(newMsg);
        }
    }

    startDump() {
        if (this.mainBuffer.length === 0) return;

        this.isLocked = true;
        this.clearDiv();
        this.iterateDump();
    }

    iterateDump() {
        if (this.mainBuffer.length === 0) {
            this.endDump();
            return;
        }

        if (!this.announcementPacket) {
            this.announcementPacket = document.createElement("div");
        }

        let armedSound = undefined;

        while (this.mainBuffer.length > 0) {
            const message = this.mainBuffer.shift();
            if (message.type === ANNOUNCEMENT_TYPE_TEXT) {
                this.announcementPacket.textContent += (' ' + message.content);
            }
            else if (message.type === ANNOUNCEMENT_TYPE_AUDIO) {
                armedSound = message.content;
                break;
            }
        }

        if (this.mainBuffer.length === 0) {
            this.getDiv().appendChild(this.announcementPacket);
        }

        var lockDelay = IF_OCTANE_LIVE_REGION_LOCK_DELAY;

        if (armedSound) {
            //TODO: if armedSound has content, play it.
            // lockDelay will be the duration of the sound in milliseconds.
            // lockDelay also cannot be longer than 3 seconds.
        }

        const _this = this;
        setTimeout(() => { _this.endDump(); }, lockDelay);
    }

    endDump() {
        // Make sure there are no stragglers
        if (this.mainBuffer.length > 0) {
            this.iterateDump();
            return;
        }
        if (this.secondaryBuffer.length === 0) {
            this.isLocked = false;
            return;
        }

        while (this.secondaryBuffer.length > 0) {
            this.mainBuffer.push(this.secondaryBuffer.shift());
        }

        this.clearDiv();
        this.iterateDump();
    }
}

// Firefox forces aria-atomic="true" behavior, so we are using a manager
// to enforce the correct behavior.
const announcementManager = new LiveRegionManager("sr-announcements");

function if_octane_get_output_element() {
    if (!if_octane_output_element) {
        if_octane_output_element = document.getElementById("init-transcript-area");
    }
    return if_octane_output_element;
}

function if_octane_create_paragraph() {
    const para = document.createElement('p');
    return para;
}

function if_octane_check_create_new_paragraph() {
    if (if_octane_force_new_paragraph) {
        if_octane_force_new_paragraph = false;
        return null;
    }
    const outputEl = if_octane_get_output_element();
    if (outputEl.childElementCount === 0) return null;
    const lastEl = outputEl.lastElementChild;
    if (lastEl.tagName != 'P') return null;
    return lastEl;
}

function if_octane_get_last_paragraph() {
    const lastEl = if_octane_check_create_new_paragraph();
    if (lastEl === null) {
        const newPar = if_octane_create_paragraph();
        if_octane_get_output_element().appendChild(newPar);
        if_octane_paragraphs_count++;
        return newPar;
    }

    return lastEl;
}

function if_octane_fuse_text_to(str, el) {
    // Check to concat to text node
    const lastNode = el.lastChild;
    if (lastNode != null && lastNode.nodeType === Node.TEXT_NODE) {
        lastNode.textContent += str;
        return;
    }

    // Add text node
    el.append(str);
}

function sayLiteral(str) {
    const strStruct = if_octane_process_say_string(str);
    const outputEl = if_octane_get_output_element();
    let paragraphEl = if_octane_get_last_paragraph();

    for (let i = 0; i < strStruct.length; i++) {
        const chunks = strStruct[i].chunks;
        for (let j = 0; j < chunks.length; j++) {
            const chunk = chunks[j];
            
            if (chunk.isBreak) {
                paragraphEl.appendChild(document.createElement('br'));
            }
            else if (chunk.isButton) {
                if_octane_create_inline_button(
                    chunk.phrase,
                    chunk.title,
                    chunk.parseAction,
                    chunk.clickOnce
                );
                if_octane_inline_action_count++;
            }
            else if (
                chunk.isBold ||
                chunk.isItalic ||
                chunk.isUnderline ||
                chunk.isStrikethrough
            ) {
                const stackInfo = {
                    lastElement: paragraphEl,
                    addToStack: function(tag) {
                        const nel = document.createElement(tag);
                        this.lastElement.appendChild(nel);
                        this.lastElement = nel;
                    }
                };

                if (chunk.isItalic) stackInfo.addToStack('em');
                if (chunk.isStrikethrough) stackInfo.addToStack('s');
                if (chunk.isBold) stackInfo.addToStack('strong');
                if (chunk.isUnderline) stackInfo.addToStack('u');

                if_octane_fuse_text_to(
                    chunk.content,
                    stackInfo.lastElement
                );
            }
            else {
                if_octane_fuse_text_to(
                    chunk.content,
                    paragraphEl
                );
            }
        }

        if (i < strStruct.length - 1 && strStruct.length > 1) {
            paragraphEl = if_octane_create_paragraph();
            outputEl.appendChild(paragraphEl);
            if_octane_paragraphs_count++;
        }
    }
}

function say(str) {
    sayLiteral(str + ' ');
}

function if_octane_process_say_title(str, level) {
    const outputEl = if_octane_get_output_element();
    const title = document.createElement('h' + level);
    outputEl.appendChild(title);

    const strStruct = if_octane_process_say_string(str);

    for (let i = 0; i < strStruct.length; i++) {
        const chunks = strStruct[i].chunks;
        for (let j = 0; j < chunks.length; j++) {
            const chunk = chunks[j];
            
            if (chunk.isBreak) {
                if_octane_fuse_text_to(
                    ' ',
                    title
                );
            }
            else if (chunk.isButton) {
                if_octane_fuse_text_to(
                    chunk.phrase,
                    title
                );
            }
            else if (
                chunk.isItalic ||
                chunk.isUnderline ||
                chunk.isStrikethrough
            ) {
                const stackInfo = {
                    lastElement: title,
                    addToStack: function(tag) {
                        const nel = document.createElement(tag);
                        this.lastElement.appendChild(nel);
                        this.lastElement = nel;
                    }
                };

                if (chunk.isItalic) stackInfo.addToStack('em');
                if (chunk.isStrikethrough) stackInfo.addToStack('s');
                if (chunk.isUnderline) stackInfo.addToStack('u');

                if_octane_fuse_text_to(
                    chunk.content,
                    stackInfo.lastElement
                );
            }
            else {
                if_octane_fuse_text_to(
                    chunk.content,
                    title
                );
            }
        }

        if (i < strStruct.length - 1 && strStruct.length > 1) {
            if_octane_fuse_text_to(
                ' ',
                title
            );
        }
    }
}

function printCredits() {
    const outputEl = if_octane_get_output_element();

    const title = document.createElement('h1');
    outputEl.appendChild(title);
    title.appendChild(document.createTextNode(GAME_INFO.title));
    
    const byline = if_octane_create_paragraph();
    byline.className = "author-info";
    outputEl.appendChild(byline);
    byline.appendChild(document.createTextNode('by ' + GAME_INFO.author));
    
    const blurb = if_octane_create_paragraph();
    blurb.className = "blurb-info";
    outputEl.appendChild(blurb);
    blurb.appendChild(document.createTextNode(GAME_INFO.blurb));
    
    const tiny_info0 = if_octane_create_paragraph();
    tiny_info0.className = "tiny-info";
    outputEl.appendChild(tiny_info0);
    tiny_info0.appendChild(document.createTextNode('IFID: ' + GAME_INFO.ifid));
    
    const tiny_info1 = if_octane_create_paragraph();
    tiny_info1.className = "tiny-info";
    outputEl.appendChild(tiny_info1);
    tiny_info1.appendChild(document.createTextNode('version ' + GAME_INFO.version));

    if_octane_force_new_paragraph = true;
}

function if_octane_create_inline_button(str, tooltip, func, clickOnce=false) {
    const paragraphEl = if_octane_get_last_paragraph();

    const button = document.createElement('button');
    if_octane_fuse_text_to(
        str,
        paragraphEl
    );
    paragraphEl.appendChild(button);
    button.textContent = clickOnce ? "\u25B6" : "\u21BB";
    button.setAttribute("aria-label", clickOnce ? "single use" : "repeatable");
    button.title = tooltip;
    button.isClickOnce = clickOnce;
    button.className = 'action-button';
    button.hasBeenPressed = false;
    button.addEventListener("click", function (e) {
        const _button = e.target;
        const phrase = _button.title;
        if (_button.isClickOnce) {
            if (_button.hasBeenPressed) return;
            if_octane_spend_button(_button, true);
        }
        _button.hasBeenPressed = true;
        if_octane_start_new_turn(phrase);
        func();
        if_octane_end_new_turn();
    });
    return button;
}

function if_octane_spend_button(buttonElement, isSpent=false) {
    buttonElement.setAttribute("aria-disabled", "true");
    buttonElement.title = "spent";
    if (isSpent) {
        // Announce to screen readers that the button has been disabled.
        announcementManager.addMessage("Action button has been spent.");
    }
}

function if_octane_get_truncated_turn_header(action) {
    const maxLen = 16;
    const actionParts = action.toLowerCase().split(' ');
    let truncatedAction = actionParts[0];
    let truncatedLen = actionParts[0].length;
    let truncatedCount = 1;
    while (
        truncatedCount < actionParts.length &&
        truncatedLen + actionParts[truncatedCount].length + 1 < maxLen
    ) {
        truncatedAction += " " + actionParts[truncatedCount];
        truncatedLen = truncatedAction.length;
        truncatedCount++;
    }
    if (truncatedLen < action.length) {
        // ...
        truncatedAction += "\u2026";
    }
    let title = truncatedAction + " report";

    title =
        "Turn " + String(if_octane_turn_counter) + " report, after \u201C" +
        truncatedAction + "\u201D";

    return title;
}

function if_octane_separate_turn_text(action) {
    const newTranscript = document.createElement("div");
    newTranscript.className = "transcript-div";
    const spacer = document.getElementById("bottom-page-spacer");
    const parent = spacer.parentElement;
    parent.insertBefore(newTranscript, spacer);
    if_octane_output_element = newTranscript;

    const newHeader = document.createElement("h2");
    newHeader.innerText = if_octane_get_truncated_turn_header(action);
    newTranscript.appendChild(newHeader);

    const gotoLink = document.createElement("a");
    gotoLink.innerText = "Jump to latest content";
    gotoLink.className = "latest-link";
    gotoLink.href = "#" + IF_OCTANE_LATEST_REPORT_ID;
    gotoLink.style.display = "none";
    newTranscript.appendChild(gotoLink);

    // Set the latest section element to not be the latest anymore
    if (if_octane_report_sections.length > 0) {
        const prevSection = if_octane_report_sections[if_octane_report_sections.length - 1];
        prevSection.header.removeAttribute("id");
        prevSection.gotoLink.style.display = "block";
    }

    newHeader.id = IF_OCTANE_LATEST_REPORT_ID;

    if_octane_report_sections.push({
        header: newHeader,
        gotoLink: gotoLink,
        transcriptDiv: newTranscript
    });

    // Reset new turn report announcements
    if_octane_paragraphs_count = 0;
    if_octane_inline_action_count = 0;
    if_octane_grouped_action_count = 0;
}

var if_octane_has_explained_scrolling = false;

function if_octane_end_new_turn() {
    // Read out turns stats
    const stats = [];
    if (if_octane_paragraphs_count > 0) {
        stats.push({
            singular: 'paragraph',
            plural: 'paragraphs',
            count: if_octane_paragraphs_count
        });
    }
    if (if_octane_inline_action_count > 0) {
        stats.push({
            singular: 'action control in text',
            plural: 'action controls in text',
            count: if_octane_inline_action_count
        });
    }
    if (if_octane_grouped_action_count > 0) {
        stats.push({
            singular: 'action control at bottom',
            plural: 'action controls at bottom',
            count: if_octane_grouped_action_count
        });
    }

    const readStat = function(stat) {
        return String(stat.count) + ' ' + (
            stat.count === 1 ? stat.singular : stat.plural
        );
    }

    announcementManager.addMessage(
        "New content has been written below."
    );

    //TODO: Create a generic lister
    if (stats.length === 1) {
        announcementManager.addMessage(
            readStat(stats[0]) + "."
        );
    }
    else if (stats.length === 2) {
        announcementManager.addMessage(
            readStat(stats[0]) + ", and " + readStat(stats[1]) + "."
        );
    }
    else if (stats.length === 3) {
        announcementManager.addMessage(
            readStat(stats[0]) + ", " + readStat(stats[1]) +
            ", and " + readStat(stats[2]) + "."
        );
    }

    if (!if_octane_has_explained_scrolling) {
        if_octane_has_explained_scrolling = true;
        announcementManager.addMessage(
            "After choosing an action, "+
            "you can always continue reading from here, or "+
            "jump to the next heading level 2."
        );
    }

    // Start the announcements
    announcementManager.startDump();
}