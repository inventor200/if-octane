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

// Live region management

const ANNOUNCEMENT_TYPE_TEXT = 0;
const ANNOUNCEMENT_TYPE_AUDIO = 1;
const IF_OCTANE_RUDE_DURATION_THRESHOLD = 0.75;

class LiveRegionManager {
    constructor(id) {
        this.id = id;
        this.div = undefined;
        this.mainBuffer = [];
        this.secondaryBuffer = [];
        this.isLocked = false;
        this.fusionDiv = undefined;
        this.announcementPacket = undefined;
        this.audioQueue = [];
        this.armedFade = false;
    }

    getDiv() {
        if (!this.div) {
            this.div = document.getElementById(this.id);
        }

        return this.div;
    }

    clearDiv() {
        // Dump audio into queue and sort
        this.audioQueue = [];
        this.armedFade = false;
        
        while (this.mainBuffer.length > 0) {
            if (this.mainBuffer[0].type != ANNOUNCEMENT_TYPE_AUDIO) {
                // We have reached the end of audio content
                break;
            }
            this.audioQueue.push(this.mainBuffer.shift().content);
        }

        let queuedForegroundSounds = false;
        let foregroundIsSilence = false;

        if (this.audioQueue.length > 0) {
            const limitedSounds = [];
            const unlimitedSounds = [];
            while (this.audioQueue.length > 0) {
                const snd = this.audioQueue.shift();
                if (snd.channel < AUDIO_CHANNEL_BACKGROUND) {
                    limitedSounds.push(snd);
                }
                else {
                    unlimitedSounds.push(snd);
                }
            }

            // Change over the unlimited sounds
            if_octane_sync_background_audio(unlimitedSounds);

            if (limitedSounds.length > 0) {
                queuedForegroundSounds = true;
                if (limitedSounds[limitedSounds.length - 1].isSilence) {
                    foregroundIsSilence = true;
                }
                else {
                    // Remove repeated sounds
                    let lastBuffer = undefined;
                    for (let i = 0; i < limitedSounds.length; i++) {
                        const currentBuffer = limitedSounds[i].audioFile.buffer;
                        if (lastBuffer === currentBuffer) {
                            limitedSounds.splice(i, 1);
                            i--;
                        }
                        else {
                            lastBuffer = currentBuffer;
                        }
                    }

                    // Sort limited sounds
                    for (let i = 0; i < limitedSounds.length; i++) {
                        limitedSounds[i].playOrder = i;
                    }

                    limitedSounds.sort((a, b) => a.getPriority() - b.getPriority());
                    const survivingSounds = [];

                    // Announcements cannot be delayed more than 3 seconds
                    // for accessibility reasons.
                    let totalDuration = 0;
                    while (totalDuration < 3.0 && limitedSounds.length > 0) {
                        const survivingSound = limitedSounds.shift();
                        survivingSounds.push(survivingSound);

                        // If a sound has a long tail or something, then
                        // we're gonna assume the important content appears
                        // within one second.
                        let simpleDuration = survivingSound.audioFile.buffer.duration;
                        if (simpleDuration > IF_OCTANE_RUDE_DURATION_THRESHOLD) {
                            simpleDuration = IF_OCTANE_RUDE_DURATION_THRESHOLD;
                        }
                        totalDuration += simpleDuration;
                    }

                    survivingSounds.sort((a, b) => a.playOrder - b.playOrder);

                    this.audioQueue = survivingSounds;
                }
            }
        }

        if (!queuedForegroundSounds) {
            //TODO: Add default sound
        }

        if (foregroundIsSilence) {
            // We are forcing the foreground to be silent,
            // so clear the audio queue.
            this.audioQueue = [];
        }
        else {
            // There will always be a foreground sound,
            // so reload this channel every time.
            if_octane_foreground_channel.reload();
        }

        // Handle the screen reader announcement div
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
            if (IF_OCTANE_USING_EMBEDDING) {
                for (let i = 0; i < dest.length; i++) {
                    const currentType = dest[i].type;
                    if (currentType === ANNOUNCEMENT_TYPE_AUDIO) continue;
                    dest.insert(i, newMsg);
                    break;
                }
            }
        }
        else {
            dest.push(newMsg);
        }
    }

    startDump() {
        if (this.isLocked) return; // This will resolve itself later

        if (this.mainBuffer.length === 0) return; // There's nothing to do

        this.isLocked = true;

        this.clearDiv();
        this.iterateDump();
    }

    iterateDump() {
        if (this.mainBuffer.length === 0 && this.audioQueue.length === 0) {
            this.endDump();
            return;
        }

        if (!this.announcementPacket) {
            this.announcementPacket = document.createElement("div");
        }

        let armedSound = undefined;
        let audioQueueDuration = 0;
        let useFade = false;

        if (this.audioQueue.length > 0) {
            if (!this.armedFade) {
                // This only runs once, because this.armedFade is set
                // when the first sound is played later.

                // Measure the total duration of the audio queue
                for (let i = 0; i < this.audioQueue.length; i++) {
                    audioQueueDuration += this.audioQueue[i].audioFile.buffer.duration;
                }

                useFade = (audioQueueDuration >= 2.5);

                // For sounds that are really long (1+ seconds),
                // we will mark them as "rude". Any "polite" sounds
                // will play however long they need to, and the remaining
                // time will be split up among the rude sounds.
                //
                // We have 3 seconds to play everything, in order to
                // follow accessibility standards.
                let rudeDuration = 3.0;
                const rudeSounds = [];

                for (let i = 0; i < this.audioQueue.length; i++) {
                    const sound = this.audioQueue[i];
                    const myDuration = sound.audioFile.buffer.duration;
                    if (myDuration < IF_OCTANE_RUDE_DURATION_THRESHOLD) {
                        rudeDuration -= myDuration;
                    }
                    else {
                        rudeSounds.push(sound);
                    }
                }

                if (rudeSounds.length > 0) {
                    rudeDuration /= rudeSounds.length;

                    // Set duration overrides for rude sounds
                    for (let i = 0; i < rudeSounds.length; i++) {
                        rudeSounds[i].duration = rudeDuration;
                    }
                }

                audioQueueDuration = Math.floor(audioQueueDuration * 1000);
            }
            
            armedSound = this.audioQueue.shift();
        }
        else {
            while (this.mainBuffer.length > 0) {
                this.announcementPacket.textContent +=
                    (' ' + this.mainBuffer.shift().content);
            }

            this.getDiv().appendChild(this.announcementPacket);
        }

        var lockDelay = IF_OCTANE_LIVE_REGION_LOCK_DELAY;

        if (armedSound) {
            lockDelay = playAudioFromObject(armedSound);
            if (!this.armedFade) {
                // Prepare fadeout
                const batchObj = {
                    fader: if_octane_foreground_channel.getActiveFader()
                };
                if (useFade) {
                    setTimeout(() => {
                        if_octane_foreground_channel.fadeOut(batchObj);
                    }, 2500);
                }
                else {
                    setTimeout(() => {
                        if_octane_foreground_channel.stop(batchObj);
                    }, audioQueueDuration);
                }
                this.armedFade = true;
            }
        }

        const _this = this;
        setTimeout(() => { _this.endDump(); }, lockDelay);
    }

    endDump() {
        // Make sure there are no stragglers
        if (this.mainBuffer.length > 0 || this.audioQueue.length > 0) {
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

function queueAnnouncement(message) {
    announcementManager.addMessage(message, ANNOUNCEMENT_TYPE_TEXT);
}

function queueSFX(audioObject) {
    if (!IF_OCTANE_USING_EMBEDDING) return;
    announcementManager.addMessage(audioObject, ANNOUNCEMENT_TYPE_AUDIO);
}

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

function if_octane_create_inline_button(tooltip, func, clickOnce=false) {
    const paragraphEl = if_octane_get_last_paragraph();

    const button = document.createElement('button');
    paragraphEl.appendChild(button);
    button.textContent = clickOnce ? "1" : "\u25B6";
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
    if (isSpent) {
        // Announce to screen readers that the button has been disabled.
        announcementManager.addMessage("Action button has been spent.");
    }
}

function if_octane_get_truncated_turn_header(action) {
    const maxLen = 40;
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
    gotoLink.style.visibility = "hidden";
    newTranscript.appendChild(gotoLink);

    // Set the latest section element to not be the latest anymore
    if (if_octane_report_sections.length > 0) {
        const prevSection = if_octane_report_sections[if_octane_report_sections.length - 1];
        prevSection.header.removeAttribute("id");
        prevSection.gotoLink.style.visibility = "visible";
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