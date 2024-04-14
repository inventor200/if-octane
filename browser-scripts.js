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
        this.activeJobs = 0;
    }

    getDiv() {
        if (!this.div) {
            this.div = document.getElementById(this.id);
        }

        return this.div;
    }

    async clearDiv() {
        // Dump audio into queue and sort
        this.audioQueue = [];
        this.armedFade = false;
        
        while (this.mainBuffer.length > 0) {
            if (this.mainBuffer[0].type != ANNOUNCEMENT_TYPE_AUDIO) {
                // We have reached the end of audio content
                break;
            }
            const audioContent = this.mainBuffer.shift().content;
            if (audioContent.isRequest) {
                const requestedAudio = await createAudioObject(
                    audioContent.audioName, audioContent.options
                )
                this.audioQueue.push(requestedAudio);
            }
            else {
                this.audioQueue.push(audioContent);
            }
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
                // Check for silence in foreground, which will cancel
                // all other sounds.
                for (let i = 0; i < limitedSounds.length; i++) {
                    if (limitedSounds[i].isSilence) {
                        foregroundIsSilence = true;
                        break;
                    }
                }

                if (!foregroundIsSilence) {
                    queuedForegroundSounds = true;

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
            // Add default sound
            if (!if_octane_current_default_sound && if_octane_primary_default_sound) {
                if_octane_current_default_sound = if_octane_primary_default_sound;
            }
            if (if_octane_current_default_sound) {
                const defaultAudio = await createAudioObject(
                    if_octane_current_default_sound, {
                        channel: AUDIO_CHANNEL_UI
                    }
                )
                this.audioQueue.push(defaultAudio);
            }
        }

        // There will always be a foreground sound,
        // so reload this channel every time.
        if_octane_foreground_channel.reload();

        // Handle the screen reader announcement div
        if (!this.announcementPacket) return;

        this.announcementPacket.remove();
        this.announcementPacket = undefined;

        if_octane_current_default_sound = if_octane_primary_default_sound;
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
            if (GAME_INFO.useEmbedding) {
                if (dest[dest.length - 1].type === ANNOUNCEMENT_TYPE_AUDIO) {
                    // No text content yet; just slap it onto the end
                    dest.push(newMsg);
                }
                else {
                    // We need to put it before the text content
                    for (let i = 0; i < dest.length; i++) {
                        const currentType = dest[i].type;
                        if (currentType === ANNOUNCEMENT_TYPE_AUDIO) continue;
                        dest.insert(i, newMsg);
                        break;
                    }
                }
            }
        }
        // If we cannot do embedding, then skip audio pushes
        else if (msgType != ANNOUNCEMENT_TYPE_AUDIO || GAME_INFO.useEmbedding) {
            dest.push(newMsg);
        }
    }

    async fireAnotherIteration() {
        await this.clearDiv();
        this.iterateDump();
    }

    startDump() {
        if (this.isLocked) return; // This will resolve itself later

        if (this.mainBuffer.length === 0) return; // There's nothing to do

        this.isLocked = true;

        this.fireAnotherIteration();
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

        this.fireAnotherIteration();
    }
}

// Firefox forces aria-atomic="true" behavior, so we are using a manager
// to enforce the correct behavior.
const announcementManager = new LiveRegionManager("sr-announcements");

function queueAnnouncement(message) {
    announcementManager.addMessage(message, ANNOUNCEMENT_TYPE_TEXT);
}

function queueSFX(audioName, options) {
    if (!GAME_INFO.useEmbedding) return;
    announcementManager.addMessage({
        isRequest: true,
        audioName: audioName,
        options: options
    }, ANNOUNCEMENT_TYPE_AUDIO);
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
                if_octane_create_inline_button(chunk.parseAction);
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

function if_octane_create_inline_button(actionObject) {
    const paragraphEl = if_octane_get_last_paragraph();
    const button = document.createElement('button');
    paragraphEl.appendChild(button);
    button.actionObject = actionObject;

    if_octane_format_button(button);

    button.addEventListener("click", function (e) {
        const _button = e.target;
        if (_button.isLocked) {
            if_octane_start_new_turn(_button.actionObject);
            if_octane_arm_default_sound(if_octane_fail_default_sound);
            const hasOutput = evaluateMessage(_button.verifyReason);
            if (!hasOutput) say(msg_fallback_failure);
            if_octane_end_new_turn();
            return;
        }
        if_octane_start_new_turn(_button.actionObject);
        const hasOutput = evaluateMessage(_button.actionObject.execute);
        if (!hasOutput) say(msg_fallback_success);
        if_octane_end_new_turn();
    });

    const prevSection = if_octane_report_sections[if_octane_report_sections.length - 1];
    prevSection.buttonList.push(button);
    return button;
}

function if_octane_format_button(button) {
    const actionObject = button.actionObject;

    if (actionObject.resolveReferences != undefined) {
        actionObject.resolveReferences();
    }

    const buttonProfiles = [
        {
            index: 0,
            label: "full action",
            icon: "turn-action-button"
        },
        {
            index: 1,
            label: "free action",
            icon: "free-action-button"
        },
        {
            index: 2,
            label: "check action",
            icon: "look-action-button"
        }
    ];
    const buttonProfile = (evaluateInteger(actionObject.turnCost) > 0)
    ? buttonProfiles[0] : (
        evaluateBool(actionObject.isExamineAction)
        ? buttonProfiles[2] : buttonProfiles[1]
    );
    button.verifyReason = evaluateString(actionObject.verify);
    const isLocked = (button.verifyReason.length > 0);

    if (button.buttonProfileIndex != buttonProfile.index) {
        button.buttonProfileIndex = buttonProfile.index;
        button.setAttribute("aria-label", buttonProfile.label);
        button.className = buttonProfile.icon;
    }

    if (button.isLocked != isLocked) {
        button.isLocked = isLocked;
        button.setAttribute("aria-disabled", isLocked ? "true" : "false");
    }

    if (button.title != actionObject.tooltip) {
        button.title = actionObject.tooltip;
    }
}

function if_octane_get_truncated_turn_header(actionObject) {
    const maxLen = 40;
    const actionParts = actionObject.parsingText.toLowerCase().split(' ');
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
    if (truncatedLen < actionObject.parsingText.length) {
        // ...
        truncatedAction += "\u2026";
    }
    let title = truncatedAction + " report";
    let writtenTurns = String(time_full_turns);
    if (time_free_turns > 0) {
        writtenTurns += '.' + String(time_free_turns);
    }

    title =
        "Turn " + writtenTurns + " report, after \u201C" +
        truncatedAction + "\u201D";

    return title;
}

const IF_OCTANE_MAX_SECTION_ACTIVITY_DECAY = 4;
const IF_OCTANE_INIT_SECTION_ACTIVITY_SCORE = 6;

function if_octane_declare_first_transcript() {
    if_octane_report_sections.push({
        index: 0,
        transcriptDiv: document.getElementById("init-transcript-area"),
        backgroundEnvironmentOrigin: if_octane_background_environments_passed,
        turnNumber: time_total_turns,
        activityScore: IF_OCTANE_INIT_SECTION_ACTIVITY_SCORE,
        buttonList: []
    });
}

function if_octane_separate_turn_text(actionObject, fromButton) {
    const newTranscript = document.createElement("div");
    newTranscript.className = "transcript-div";
    const spacer = document.getElementById("bottom-page-spacer");
    const parent = spacer.parentElement;
    parent.insertBefore(newTranscript, spacer);
    if_octane_output_element = newTranscript;

    const newHeader = document.createElement("h2");
    newHeader.innerText = if_octane_get_truncated_turn_header(actionObject);
    newTranscript.appendChild(newHeader);

    const gotoLink = document.createElement("a");
    gotoLink.innerText = "Jump to latest content";
    gotoLink.className = "latest-link";
    gotoLink.href = "#" + IF_OCTANE_LATEST_REPORT_ID;
    gotoLink.style.visibility = "hidden";
    newTranscript.appendChild(gotoLink);

    // Set the latest section element to not be the latest anymore
    const prevSection = if_octane_report_sections[if_octane_report_sections.length - 1];
    if (prevSection.header) {
        prevSection.header.removeAttribute("id");
    }
    if (prevSection.gotoLink) {
        prevSection.gotoLink.style.visibility = "visible";
    }

    if (fromButton) {
        //TODO: Fill in the parser field with actionObject.parsingText
        // to simulate an example parser input, which does the same thing.
        //TODO: Also, announce to the screen reader what was typed in.
        // (Unless all buttons are above the parser, in which case we
        // could just pop an on-screen message there without being weird?)
    }

    // We can use these two strategies to reduce the number of button checks:
    //TODO: If the section is from before the previous turn,
    // remove the parser field and offered actions at the bottom, and then
    // add a string which shows what the player had typed in.
    // This is because we cannot modify what a screen reader might still be viewing,
    // but the advance of a turn proves that the screen reader focus must be
    // past some known point.

    newHeader.id = IF_OCTANE_LATEST_REPORT_ID;

    const newIndex = if_octane_report_sections.length;

    if_octane_report_sections.push({
        index: newIndex,
        header: newHeader,
        gotoLink: gotoLink,
        transcriptDiv: newTranscript,
        backgroundEnvironmentOrigin: if_octane_background_environments_passed,
        turnNumber: time_total_turns,
        activityScore: IF_OCTANE_INIT_SECTION_ACTIVITY_SCORE,
        buttonList: []
    });

    // Reset new turn report announcements
    if_octane_paragraphs_count = 0;
    if_octane_inline_action_count = 0;
    if_octane_grouped_action_count = 0;
}

function if_octane_bump_activity(startIndex) {
    for (let i = startIndex; i < if_octane_report_sections.length; i++) {
        const section = if_octane_report_sections[i];
        let nextScore = section.activityScore + IF_OCTANE_MAX_SECTION_ACTIVITY_DECAY;
        if (nextScore > IF_OCTANE_INIT_SECTION_ACTIVITY_SCORE) {
            nextScore = IF_OCTANE_INIT_SECTION_ACTIVITY_SCORE;
        }
        if (section.activityScore < 0) {
            section.activityScore = IF_OCTANE_MAX_SECTION_ACTIVITY_DECAY;
        }
        else {
            section.activityScore = nextScore;
        }
    }
}

function if_octane_update_button_states() {
    for (let i = 0; i < if_octane_report_sections.length - 2; i++) {
        const section = if_octane_report_sections[i];

        // Activity decay
        if (section.activityScore >= 0) {
            let environmentOffset =
                if_octane_background_environments_passed
                - section.backgroundEnvironmentOrigin;
            if (environmentOffset > IF_OCTANE_MAX_SECTION_ACTIVITY_DECAY) {
                environmentOffset = IF_OCTANE_MAX_SECTION_ACTIVITY_DECAY;
            }
            if (environmentOffset < 0) environmentOffset = 1;
            section.activityScore -= environmentOffset;
            if (section.activityScore < -1) section.activityScore = -1;
        }
    }

    for (let i = 0; i < if_octane_report_sections.length; i++) {
        const section = if_octane_report_sections[i];

        if (section.activityScore < 0) {
            // Delete buttons, once aged-out
            while (section.buttonList.length > 0) {
                section.buttonList.shift().remove();
            }
        }
        else {
            // Update state
            for (let j = 0; j < section.buttonList.length; j++) {
                if_octane_format_button(section.buttonList[j]);
            }
        }
    }
}

var if_octane_has_explained_scrolling = false;

function if_octane_end_new_turn() {
    // Update button states
    if_octane_update_button_states();

    // Read out turns stats
    const stats = [];

    stats.push({
        singular: 'paragraph',
        plural: 'paragraphs',
        count: if_octane_paragraphs_count
    });
    stats.push({
        singular: 'action control in text',
        plural: 'action controls in text',
        count: if_octane_inline_action_count
    });
    stats.push({
        singular: 'action control at bottom',
        plural: 'action controls at bottom',
        count: if_octane_grouped_action_count
    });

    announcementManager.addMessage(
        "New content has been written below."
    );

    announcementManager.addMessage(getCountListString(stats));

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