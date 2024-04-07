// This is for anything that relies on neither WASM inclusion nor browser-vs-terminal.

Array.prototype.insert = function(index, element) {
    if (index >= this.length) {
        this.push(element);
        return this;
    }

    this.splice(index, 0, element);
    return this;
}

Array.prototype.swap = function(index, element) {
    if (index >= this.length) {
        this.push(element);
        return this;
    }

    this.splice(index, 1, element);
    return this;
}

function if_octane_get_function_id(funcID) {
    if (!funcID) {
        funcID = "";
    }

    funcID = String(funcID);

    if (funcID.length === 0) {
        funcID = 'if-octane-anonymous-function' + if_octane_ready_functions.length;
    }

    return funcID;
}

// Other handy stuff
var if_octane_say_follows_heading = false;

function isWhitespace(ch) {
    if (ch.length > 1) return false;
    return ' \f\n\r\t\v\u00A0\u2028\u2029'.indexOf(ch) > -1;
}

const if_octane_output_listener_stack = [];

function if_octane_begin_listening_to_output() {
    if_octane_output_listener_stack.push(false);
}

function if_octane_mark_output_listener() {
    if_octane_output_listener_stack[if_octane_output_listener_stack.length - 1] = true;
}

function if_octane_end_listening_to_output() {
    return if_octane_output_listener_stack.pop();
}

function listenToSay(str) {
    if_octane_begin_listening_to_output();
    say(str);
    return if_octane_end_listening_to_output();
}

function listenToSayLiterally(str) {
    if_octane_begin_listening_to_output();
    sayLiteral(str);
    return if_octane_end_listening_to_output();
}

function evaluateMessage(msg) {
    if (msg === null || msg === undefined || msg === '') return false;
    if (Array.isArray(msg)) {
        let state = false;
        for (let i = 0; i < msg.length; i++) {
            state = state || evaluateMessage(msg[i]);
        }
        return state;
    }

    if_octane_begin_listening_to_output();
    if ((typeof msg) === 'function') {
        const ret = msg();
        const hadOutput = if_octane_end_listening_to_output();
        if (ret === undefined || ret === '') {
            return hadOutput;
        }
        if (ret === null || !ret) {
            return false;
        }
        if (ret === true) {
            return true;
        }
        return evaluateMessage(ret);
    }

    say(String(msg));
    return if_octane_end_listening_to_output();
}

const IF_OCTANE_SIGNAL_EXECUTE = 0;
const IF_OCTANE_SIGNAL_VERIFY = 1;
const IF_OCTANE_SIGNAL_GET_TURN_COUNT = 2;

var if_octane_turn_counter = 0;

const if_octane_button_function_queue = [];

function armButton(func) {
    if_octane_button_function_queue.push(func);
}

//TODO: Implement a method for generating context-ful inline action tags.

function if_octane_get_object_from_id(id) {
    //TODO: implement, once the world model supports it.
    return undefined;
}

function if_octane_build_context_info_object(inlineString) {
    const series = inlineString.trim().toLowerCase().split(',');
    const outObj = {};
    for (let i = 0; i < series.length; i++) {
        const pair = series[i].trim().split('=');
        if (pair.length != 2) {
            console.error(
                "Bad inline action context pair: \"" +
                series[i].trim() + "\" in \"" + inlineString + "\""
            );
            return undefined;
        }
        const key = pair[0].trim();
        const id = parseInt(pair[1].trim());
        outObj[key] = if_octane_get_object_from_id(id);
    }
    return outObj;
}

function createParseActionObject(str, contextInfoObj) {
    //TODO: Allow for nouns/objects/etc to be sent, and baked into the
    // action info, in cases where a button was created for a specific
    // and known interaction. This can save quite a lot on verification
    // and processing.
    return {
        parsingText: str,
        canParse: true, // <- Indicate to other system that this came from text parsing.
        // This is all an interface, so we can cache actions
        // and load custom ones at any time.
        contextInfoObj: contextInfoObj,
        cachedResolvedAction: null,
        //TODO: Use the cachedResolvedAction for evaluating these
        isExamineAction: function() {
            return this.parsingText.startsWith('x ');
        },
        getTurnCost: function() {
            if (this.isExamineAction === undefined) return 1;
            if (this.isExamineAction()) return 0;
            return 1;
        },
        verify: function() {
            // Returning null means it passes.
            // Otherwise it returns an explanation of why it's invalid.
            return null;
        },
        execute: function() {
            say('<.p>' + this.parsingText);
        },
        resolveReferences() {
            if (this.cachedResolvedAction === undefined) {
                // This must be a custom-built action.
                // We can't do anything about this.
                return;
            }
            if (this.cachedResolvedAction != null) {
                // We already got the job done.
                return;
            }
            //TODO: Figure out what action we must be referring to,
            // and use any extra context in this.contextInfoObj to narrow it down.
            // Once we have it, cache it in cachedResolvedAction
        }
    }
}

// Add a function to run on page ready
// If a function with a reused funcID is added, it overrides the function
const if_octane_ready_functions = [];

function doOnReady(readyFunc, funcID) {
    funcID = if_octane_get_function_id(funcID);

    for (let i = 0; i < if_octane_ready_functions.length; i++) {
        const currentFunc = if_octane_ready_functions[i];
        if (currentFunc.id === funcID) {
            currentFunc.code = readyFunc;
            return;
        }
    }

    if_octane_ready_functions.push({
        id: funcID,
        code: readyFunc
    });
}

function if_octane_insertReady(offset, lookID, readyFunc, funcID) {
    const originalID = lookID;
    funcID = if_octane_get_function_id(funcID);
    lookID = if_octane_get_function_id(lookID);

    if (lookID.startsWith('if-octane-anonymous-function')) {
        throw new Error("Cannot search with id: \"" + originalID + "\"");
    }

    for (let i = 0; i < if_octane_ready_functions.length; i++) {
        const currentFunc = if_octane_ready_functions[i];
        if (currentFunc.id === lookID) {
            if_octane_ready_functions.insert(i + offset, {
                id: funcID,
                code: readyFunc
            });
            return;
        }
    }

    throw new Error("Function id not found: \"" + originalID + "\"");
}

function doOnReadyBefore(lookID, readyFunc, funcID) {
    if_octane_insertReady(0, lookID, readyFunc, funcID);
}

function doOnReadyAfter(lookID, readyFunc, funcID) {
    if_octane_insertReady(1, lookID, readyFunc, funcID);
}

// Resource-loading routines are simpler:
const if_octane_resource_loading_functions = [];

function handleResourcesWith(resFunc) {
    if_octane_resource_loading_functions.push(resFunc);
}

// This runs on program start.
function if_octane_doReady() {
    if (IF_OCTANE_USING_EMBEDDING) {
        for (let i = 0; i < if_octane_resource_loading_functions.length; i++) {
            const resFunc = if_octane_resource_loading_functions[i]
            resFunc();
        }
    }

    if_octane_declare_first_transcript();
    
    printCredits();

    for (let i = 0; i < if_octane_ready_functions.length; i++) {
        if_octane_ready_functions[i].code();
    }

    if_octane_update_button_states();
}

// This is for processing output strings
const IF_OCTANE_NO_PARAGRAPH_BREAK = 0;
const IF_OCTANE_ARM_PARAGRAPH_BREAK = 1;
const IF_OCTANE_CANCEL_PARAGRAPH_BREAK = 2;
const IF_OCTANE_FORCE_PARAGRAPH_BREAK = 3;
var if_octane_paragraph_break_status = IF_OCTANE_NO_PARAGRAPH_BREAK;

const IF_OCTANE_NO_CAP_CHANGE = 0;
const IF_OCTANE_CAP_CHANGE_UP = 1;
const IF_OCTANE_CAP_CHANGE_DOWN = 2;
var if_octane_cap_change_status = IF_OCTANE_NO_CAP_CHANGE;

var if_octane_quote_depth = 0;

function if_octane_create_empty_chunk(lastChunk) {
    if (!lastChunk) {
        return {
            isBold: false,
            isItalic: false,
            isUnderline: false,
            isStrikethrough: false,
            content: ''
        };
    }
    return {
        isBold: lastChunk.isBold,
        isItalic: lastChunk.isItalic,
        isUnderline: lastChunk.isUnderline,
        isStrikethrough: lastChunk.isStrikethrough,
        content: ''
    };
}

function if_octane_process_say_string(str) {
    str = str.replace(/\.\.\./g, "\u2026");
    if (!str) return if_octane_process_say_string('<br>');

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
    let paragraph = {
        chunks: [
            if_octane_create_empty_chunk()
        ]
    };
    const paragraphs = [paragraph];
    let escaping = false;
    let inTag = false;
    let closingTag = false;
    let tagContent = '';
    let wasSpace = false;

    for (let i = 0; i < str.length; i++) {
        let c = str[i];
        if (if_octane_cap_change_status === IF_OCTANE_CAP_CHANGE_UP) c = c.toUpperCase();
        if (if_octane_cap_change_status === IF_OCTANE_CAP_CHANGE_DOWN) c = c.toLowerCase();

        let pushableChunk = undefined;
        let nextPushableChunk = undefined;

        let lastChunk = paragraph.chunks[paragraph.chunks.length - 1];
        if (escaping) {
            let skipOutput = false;
            switch (c.toLowerCase()) {
                case '^':
                    if_octane_cap_change_status = IF_OCTANE_CAP_CHANGE_UP;
                    skipOutput = true;
                    break;
                case 'v':
                    if_octane_cap_change_status = IF_OCTANE_CAP_CHANGE_DOWN;
                    skipOutput = true;
                    break;
                case 't':
                    c = '\u00A0\u00A0\u00A0\u00A0';
                    break;
            }
            escaping = false;
            if_octane_mark_output_listener();
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

            let tagContentConversion = undefined;

            if (!closingTag) {
                if (lowerTag === '.p') {
                    if (if_octane_paragraph_break_status < IF_OCTANE_CANCEL_PARAGRAPH_BREAK) {
                        if_octane_paragraph_break_status = IF_OCTANE_ARM_PARAGRAPH_BREAK;
                    }
                    continue;
                }
                else if (lowerTag === '.p0') {
                    if (if_octane_paragraph_break_status < IF_OCTANE_FORCE_PARAGRAPH_BREAK) {
                        lastChunk.content += ' '; // Make sure some space pads it out.
                        if_octane_paragraph_break_status = IF_OCTANE_CANCEL_PARAGRAPH_BREAK;
                    }
                    continue;
                }
                else if (lowerTag === './p0') {
                    if_octane_paragraph_break_status = IF_OCTANE_FORCE_PARAGRAPH_BREAK;
                    continue;
                }
            }

            const newChunk = if_octane_create_empty_chunk(lastChunk);

            if (lowerTag === 'b' || lowerTag === 'strong') newChunk.isBold = !closingTag;
            if (lowerTag === 'i' || lowerTag === 'em') newChunk.isItalic = !closingTag;
            if (lowerTag === 'u') newChunk.isUnderline = !closingTag;
            if (lowerTag === 's') newChunk.isStrikethrough = !closingTag;

            if (lowerTag === 'br') {
                pushableChunk = {
                    isSpecial: true,
                    isBreak: true
                };
            }

            if (lowerTag === 'q') {
                if (!closingTag) {
                    if (if_octane_quote_depth % 2 === 0) {
                        tagContentConversion = '\u201C';
                    }
                    else {
                        tagContentConversion = '\u2018';
                    }
                }
                if_octane_quote_depth += (closingTag ? -1 : 1);
                if (closingTag) {
                    if (if_octane_quote_depth % 2 === 0) {
                        tagContentConversion = '\u201D';
                    }
                    else {
                        tagContentConversion = '\u2019';
                    }
                }
            }
            
            if (!closingTag) {
                /*
                <# title/action>
                <# title > (title as action)
                <# title | action >
                <# title | * > (uses armed function from list)

                Numbers are ID numbers, which are part of the world model:
                <# title | action ? action=0,dobj=1,...>
                */
                if (lowerTag.startsWith('#')) {
                    const dataHalves = tagContent.substring(1).split('?');
                    const content = dataHalves[0];
                    const parts = content.split('|');
                    
                    let title = parts[0].trim().toLowerCase();
                    let parseAction;
                    let parseActionText;

                    let contextInfoObj = undefined;
                    if (dataHalves.length > 1) {
                        contextInfoObj = if_octane_build_context_info_object(dataHalves[1]);
                    }

                    if (parts.length === 1) {
                        parseActionText = title.toLowerCase();
                        parseAction = createParseActionObject(
                            title.toLowerCase(), contextInfoObj
                        );
                    }
                    else {
                        const potentialAction = parts[1].trim().toLowerCase();
                        if (potentialAction === "*") {
                            parseActionText = title.toLowerCase();
                            parseAction = if_octane_button_function_queue.shift();
                        }
                        else {
                            parseActionText = potentialAction;
                            parseAction = createParseActionObject(
                                potentialAction, contextInfoObj
                            );
                        }
                    }

                    if (parseAction.parsingText === undefined) {
                        parseAction.parsingText = parseActionText;
                    }

                    if (parseAction.tooltip === undefined) {
                        parseAction.tooltip = title;
                    }

                    if (wasSpace) {
                        pushableChunk = {
                            isSpecial: true,
                            isButton: true,
                            parseAction: parseAction
                        };
                    }
                    else {
                        tagContentConversion = '\u00A0';

                        nextPushableChunk = {
                            isSpecial: true,
                            isButton: true,
                            parseAction: parseAction
                        };
                    }
                }
                /*
                <@ item name>
                
                Numbers are ID numbers, which are part of the world model:
                <@ item name?action=0,dobj=1,...>
                */
                else if (lowerTag.startsWith('@')) {
                    const dataHalves = tagContent.substring(1).split('?');
                    const cappedContent = dataHalves[0].trim();
                    const content = cappedContent.toLowerCase();
                    const parseActionText = 'x ' + content;

                    let contextInfoObj = undefined;
                    if (dataHalves.length > 1) {
                        contextInfoObj = if_octane_build_context_info_object(dataHalves[1]);
                    }

                    const parseAction = createParseActionObject(
                        parseActionText, contextInfoObj
                    );
                    parseAction.tooltip = 'examine ' + content;

                    tagContentConversion = cappedContent + '\u00A0';

                    nextPushableChunk = {
                        isSpecial: true,
                        isButton: true,
                        parseAction: parseAction
                    };
                }
            }

            closingTag = false;

            if (tagContentConversion) {
                c = tagContentConversion;
                if_octane_mark_output_listener();
            }
            else if (pushableChunk) {
                if_octane_mark_output_listener();
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
            const hasVisiblePushableChunk = (pushableChunk && !pushableChunk.isBreak);

            const isSpace = (!hasVisiblePushableChunk && isWhitespace(c)) ||
                (pushableChunk && pushableChunk.isBreak);

            if (!isSpace && if_octane_paragraph_break_status % 2 === 1) {
                const newChunk = if_octane_create_empty_chunk(lastChunk);
                paragraph = {
                    chunks: [newChunk]
                };
                paragraphs.push(paragraph);
                lastChunk = newChunk;
                if (!hasVisiblePushableChunk) {
                    if_octane_paragraph_break_status = IF_OCTANE_NO_PARAGRAPH_BREAK;
                }
                if_octane_mark_output_listener();
            }

            if (!isSpace) {
                if_octane_cap_change_status = IF_OCTANE_NO_CAP_CHANGE;
            }

            if (pushableChunk) {
                const newChunk = if_octane_create_empty_chunk(lastChunk);
                paragraph.chunks.push(pushableChunk);
                paragraph.chunks.push(newChunk);
            }
            else if (!isSpace || !wasSpace) {
                lastChunk.content += c;
                if_octane_mark_output_listener();
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
        throw new Error("Incomplete escape sequence!");
    }

    if (inTag) {
        throw new Error("Incomplete tag!");
    }

    // Clean out empties
    let firstSearchParagraph = 1;
    if (if_octane_say_follows_heading) {
        firstSearchParagraph = 0;
        if_octane_say_follows_heading = false;
    }

    for (let i = firstSearchParagraph; i < paragraphs.length; i++) {
        const tchunks = paragraphs[i].chunks;
        for (let j = 0; j < tchunks.length; j++) {
            const chunk = tchunks[j];
            if (!chunk.isSpecial && chunk.content.length === 0) {
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

function if_octane_say_title(str) {
    if_octane_process_say_title(str, 1);
    if_octane_say_follows_heading = true;
}

function if_octane_say_room(str) {
    if_octane_process_say_title(str, 3);
    if_octane_say_follows_heading = true;
}

function if_octane_start_new_turn(actionObject, fromButton=false) {
    if_octane_turn_counter++;
    if_octane_separate_turn_text(actionObject,
        fromButton && (actionObject.canParse != undefined)
    );
    if_octane_say_follows_heading = true;
}

function getListString(listObjects) {
    if (listObjects.length === 0) return '';
    if (listObjects.length === 1) return listObjects[0];
    if (listObjects.length === 2) {
        return listObjects[0] + ', and ' + listObjects[1];
    }

    let str = listObjects[0];
    for (let i = 1; i < listObjects.length; i++) {
        str += ', ';
        if (i === listObjects.length - 1) {
            str += ' and ';
        }
        str += listObjects[i];
    }

    return str;
}

function getCountListString(countListObjects, filterZeroes=true) {
    const listObjects = [];
    for (let i = 0; i < countListObjects.length; i++) {
        const countObj = countListObjects[i];
        if (countObj.count === 0 && filterZeroes) continue;
        if (countObj.count === 1) {
            listObjects.push(
                String(countObj.count) + ' ' + countObj.singular
            );
        }
        else {
            listObjects.push(
                String(countObj.count) + ' ' + countObj.plural
            );
        }
    }
    return getListString(listObjects);
}

var if_octane_background_environments_passed = 0;

function if_octane_pass_background_environment() {
    if_octane_background_environments_passed++;
}
