var if_octane_output_element = null;
var if_octane_force_new_paragraph = false;
var if_octane_sr_announcements_element = null;
var if_octane_latest_report_number = 0;
const if_octane_report_sections = [];
const IF_OCTANE_LATEST_REPORT_ID = "latest-transcript-report";
const IF_OCTANE_LIVE_REGION_LOCK_DELAY = 1000;

class LiveRegionManager {
    constructor(id) {
        this.id = id;
        this.div = undefined;
        this.mainBuffer = [];
        this.secondaryBuffer = [];
        this.isLocked = false;
    }

    getDiv() {
        if (!this.div) {
            this.div = document.getElementById(this.id);
        }

        return this.div;
    }

    clearDiv() {
        const div = this.getDiv();

        while (div.childElementCount > 0) {
            this.clearElement(div.children[0]);
        }
    }

    clearElement(el) {
        el.remove();
    }

    addMessage(str) {
        if (this.isLocked) {
            this.secondaryBuffer.push(str);
        }
        else {
            this.mainBuffer.push(str);
        }
    }

    startDump() {
        if (this.mainBuffer.length === 0) return;

        this.isLocked = true;
        this.iterateDump();
    }

    iterateDump() {
        if (this.mainBuffer.length === 0) return;

        this.clearDiv();

        const packet = document.createElement("div");

        while (this.mainBuffer.length > 0) {
            const announcement = document.createElement("p");
            announcement.textContent = this.mainBuffer.shift();
            packet.appendChild(announcement);
        }

        this.getDiv().appendChild(packet);

        const _this = this;
        setTimeout(() => { _this.endDump(); }, IF_OCTANE_LIVE_REGION_LOCK_DELAY);
    }

    endDump() {
        // Make sure there are no stragglers
        if (this.secondaryBuffer.length === 0) {
            this.isLocked = false;
            return;
        }

        while (this.secondaryBuffer.length > 0) {
            this.mainBuffer.push(this.secondaryBuffer.shift());
        }

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
        const newPar = document.createElement('p');
        if_octane_get_output_element().appendChild(newPar);
        return newPar;
    }

    return lastEl;
}

function sayLiteral(str) {
    const strStruct = if_octane_process_say_string(str);
    const outputEl = if_octane_get_output_element();
    let paragraphEl = if_octane_get_last_paragraph();

    for (let i = 0; i < strStruct.length; i++) {
        const chunks = strStruct[i].chunks;
        for (let j = 0; j < chunks.length; j++) {
            const chunk = chunks[j];
            if (!chunk.isSpecial && chunk.content.length === 0) continue;
            
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
                if (chunk.isBold) stackInfo.addToStack('b');
                if (chunk.isUnderline) stackInfo.addToStack('u');

                stackInfo.lastElement.appendChild(document.createTextNode(chunk.content));
            }
            else {
                paragraphEl.appendChild(document.createTextNode(chunk.content));
            }
        }

        if (i < strStruct.length - 1 && strStruct.length > 1) {
            paragraphEl = document.createElement('p');
            outputEl.appendChild(paragraphEl);
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
            if (!chunk.isSpecial && chunk.content.length === 0) continue;
            
            if (chunk.isBreak) {
                title.appendChild(document.createTextNode(' '));
            }
            else if (chunk.isButton) {
                title.appendChild(document.createTextNode(chunk.phrase));
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

                stackInfo.lastElement.appendChild(document.createTextNode(chunk.content));
            }
            else {
                title.appendChild(document.createTextNode(chunk.content));
            }
        }

        if (i < strStruct.length - 1 && strStruct.length > 1) {
            title.appendChild(document.createTextNode(' '));
        }
    }
}

function printCredits() {
    const outputEl = if_octane_get_output_element();

    const title = document.createElement('h1');
    outputEl.appendChild(title);
    title.appendChild(document.createTextNode(GAME_INFO.title));
    
    const byline = document.createElement('p');
    byline.className = "author-info";
    outputEl.appendChild(byline);
    byline.appendChild(document.createTextNode('by ' + GAME_INFO.author));
    
    const blurb = document.createElement('p');
    blurb.className = "blurb-info";
    outputEl.appendChild(blurb);
    blurb.appendChild(document.createTextNode(GAME_INFO.blurb));
    
    const tiny_info0 = document.createElement('p');
    tiny_info0.className = "tiny-info";
    outputEl.appendChild(tiny_info0);
    tiny_info0.appendChild(document.createTextNode('IFID: ' + GAME_INFO.ifid));
    
    const tiny_info1 = document.createElement('p');
    tiny_info1.className = "tiny-info";
    outputEl.appendChild(tiny_info1);
    tiny_info1.appendChild(document.createTextNode('version ' + GAME_INFO.version));

    if_octane_force_new_paragraph = true;
}

function if_octane_create_inline_button(str, tooltip, func, clickOnce=false) {
    const paragraphEl = if_octane_get_last_paragraph();

    const button = document.createElement('button');
    paragraphEl.appendChild(button);
    button.textContent = str;
    button.title = tooltip;
    button.isClickOnce = clickOnce;
    button.className = 'action-button';
    button.hasBeenPressed = false;
    button.addEventListener("click", function (e) {
        const _button = e.target;
        if (_button.isClickOnce) {
            if (_button.hasBeenPressed) return;
            if_octane_spend_button(_button, true);
        }
        _button.hasBeenPressed = true;
        if_octane_start_new_turn(_button.title);
        func();
        if_octane_end_new_turn();
    });
    return button;
}

function if_octane_spend_button(buttonElement, isSpent=false) {
    buttonElement.setAttribute("aria-disabled", "true");
    if (isSpent) {
        // Announce to screen readers that the button has been disabled.
        announcementManager.addMessage("Push button is now spent and grayed.");
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
    const spacer = document.getElementById("bottom-page-spacer");
    const parent = spacer.parentElement;
    const newTranscript = document.createElement("div");
    newTranscript.className = "transcript-div";
    parent.insertBefore(newTranscript, spacer);
    if_octane_output_element = newTranscript;

    const newHeader = document.createElement("h2");
    newHeader.innerText = if_octane_get_truncated_turn_header(action);
    newTranscript.appendChild(newHeader);

    const gotoLink = document.createElement("a");
    gotoLink.innerText = "Jump to latest";
    gotoLink.className = "latest-link";
    gotoLink.href = "#" + IF_OCTANE_LATEST_REPORT_ID;
    newTranscript.appendChild(gotoLink);

    // Set the latest section element to not be the latest anymore
    if (if_octane_report_sections.length > 0) {
        const prevSection = if_octane_report_sections[if_octane_report_sections.length - 1];
        prevSection.header.removeAttribute("id");
    }

    newHeader.id = IF_OCTANE_LATEST_REPORT_ID;

    if_octane_report_sections.push({
        header: newHeader,
        transcriptDiv: newTranscript
    });

    if_octane_announce_turn_addition();
}

var if_octane_has_explained_scrolling = false;

function if_octane_announce_turn_addition() {
    // Let screen readers know that new content is available
    announcementManager.addMessage(
        "New text has been written below."
    );

    if (!if_octane_has_explained_scrolling) {
        if_octane_has_explained_scrolling = true;
        announcementManager.addMessage(
            "You can continue reading from here, or "+
            "jump to the next heading level 2."
        );
    }
}

function if_octane_end_new_turn() {
    announcementManager.startDump();
}