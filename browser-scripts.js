var if_octane_output_element = null;
var if_octane_force_new_paragraph = false;
var if_octane_sr_announcements_element = null;
var if_octane_latest_report_number = 0;
var if_octane_latest_report_shortcut_element = null;

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
    });
    return button;
}

function if_octane_show_sr_announcement(str) {
    const announcement = document.createElement('div');
    announcement.innerText = str;

    if (!if_octane_sr_announcements_element) {
        if_octane_sr_announcements_element = document.getElementById("sr-announcements");
    }

    if_octane_sr_announcements_element.appendChild(announcement);
}

function if_octane_spend_button(buttonElement, isSpent=false) {
    buttonElement.setAttribute("aria-disabled", "true");
    if (isSpent) {
        // Announce to screen readers that the button has been disabled.
        if_octane_show_sr_announcement("Push button is now spent and grayed.");
    }
}

function if_octane_get_report_id() {
    return "transcript-report-" + String(if_octane_latest_report_number);
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
    if_octane_latest_report_number++;

    const reportID = if_octane_get_report_id();
    const headerID = reportID + "-header";

    const spacer = document.getElementById("bottom-page-spacer");
    const parent = spacer.parentElement;
    const newTranscript = document.createElement("div");
    newTranscript.className = "transcript-div";
    newTranscript.setAttribute("aria-labelledby", headerID)
    parent.insertBefore(newTranscript, spacer);
    if_octane_output_element = newTranscript;
    //newTranscript.id = reportID;

    const newHeader = document.createElement("h2");
    newHeader.id = headerID;
    newHeader.innerText = if_octane_get_truncated_turn_header(action);
    newTranscript.appendChild(newHeader);

    if_octane_announce_turn_addition();
}

function if_octane_announce_turn_addition() {
    // Let screen readers know that new content is available
    if_octane_show_sr_announcement(
        "Report written! Turn " +
        String(if_octane_turn_counter) +
        ", at heading level 2."
    );

    // Update page navigate to create a shortcut
    if (!if_octane_latest_report_shortcut_element) {
        // Create shortcut
        const parent = document.getElementById("nav-shortcuts");
        const listing = document.createElement("li");

        if_octane_latest_report_shortcut_element = document.createElement("a");
        if_octane_latest_report_shortcut_element.innerText = "Latest report";
        parent.appendChild(listing);
        listing.appendChild(if_octane_latest_report_shortcut_element);
        if_octane_show_sr_announcement(
            "A new shortcut has been created for you in the navigation landmark!"
        );
    }

    if_octane_latest_report_shortcut_element.href =
        "#" + if_octane_get_report_id() + "-header";
}