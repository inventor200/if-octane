var if_octane_output_element = null;
var if_octane_init_output_element = null;

function if_octane_get_output_element() {
    if (!if_octane_output_element) {
        if_octane_output_element = document.getElementById("init-transcript-area");
    }
    return if_octane_output_element;
}

function if_octane_get_last_paragraph() {
    const outputEl = if_octane_get_output_element();
    if (outputEl.childElementCount === 0) {
        const newPar = document.createElement('p');
        outputEl.append(newPar);
        return newPar;
    }
    const lastEl = outputEl.lastElementChild;
    if (lastEl.tagName != 'P') {
        const newPar = document.createElement('p');
        outputEl.append(newPar);
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
    
    const byline = document.createElement('div');
    byline.className = "author-info";
    outputEl.appendChild(byline);
    byline.appendChild(document.createTextNode('by ' + GAME_INFO.author));
    
    const blurb = document.createElement('div');
    blurb.className = "blurb-info";
    outputEl.appendChild(blurb);
    blurb.appendChild(document.createTextNode(GAME_INFO.blurb));
    
    const tiny_info0 = document.createElement('div');
    tiny_info0.className = "tiny-info";
    outputEl.appendChild(tiny_info0);
    tiny_info0.appendChild(document.createTextNode('IFID: ' + GAME_INFO.ifid));
    
    const tiny_info1 = document.createElement('div');
    tiny_info1.className = "tiny-info";
    outputEl.appendChild(tiny_info1);
    tiny_info1.appendChild(document.createTextNode('version ' + GAME_INFO.version));
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

function if_octane_spend_button(buttonElement, isSpent=false) {
    buttonElement.setAttribute("aria-disabled", "true");
    if (isSpent) {
        // Announce to screen readers that the button has been disabled.
        const spentNotification = document.createElement('div');
        spentNotification.textContent =
            "Push button is now spent and grayed.";
        spentNotification.className = "sr-only";
        if_octane_get_last_paragraph().appendChild(spentNotification);
    }
}

function if_octane_separate_turn_text() {
    const spacer = document.getElementById("bottom-page-spacer");
    const parent = spacer.parentElement;
    if_octane_output_element.setAttribute("aria-live", "off");
    if_octane_output_element.removeAttribute("role");
    const newTranscript = document.createElement("div");
    newTranscript.className = "transcript-div";
    newTranscript.setAttribute("aria-live", "polite");
    newTranscript.setAttribute("role", "status");
    parent.insertBefore(newTranscript, spacer);
    if_octane_output_element = newTranscript;
}