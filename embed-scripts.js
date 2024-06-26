// This is for anything that uses browser and embedding.

var if_octane_long_audio_bank = null;

var if_octane_embed_ready = false;
var if_octane_window_ready = false;
var if_octane_doneReady = false;

window.onload = function() {
    //console.log("Document ready");
    if_octane_window_ready = true;
    if_octane_tryReady();
}

function if_octane_tryReady() {
    if (if_octane_doneReady) return;
    if (!if_octane_embed_ready) return;
    if (!if_octane_window_ready) return;
    if (if_octane_prepared_file_count
        < if_octane_total_files_to_load.length) return;
    if (if_octane_doneReady) return;
    if_octane_release_prep_memory();
    if_octane_doneReady = true;
    if_octane_doReady();
}

// File management

const AudioContext = window.AudioContext || window.webkitAudioContext;
const if_octane_audio_context = new AudioContext();

const AUDIO_CHANNEL_UI = 0;
const AUDIO_CHANNEL_FOREGROUND = 1;
const AUDIO_CHANNEL_BACKGROUND = 2;
const AUDIO_CHANNEL_MUSIC = 3;

const AUDIO_SILENCE = 'octane-core/silence';

//FIXME: This is for debug only!!
function estimateAudioSize(audioBuffer) {
    let byteSize = 0;
    if (audioBuffer instanceof AudioBuffer) {
        byteSize = audioBuffer.length * 4 * audioBuffer.numberOfChannels;
    }
    else {
        byteSize = audioBuffer.byteLength;
    }

    let byteMag = 0;
    while (byteSize >= 1024) {
        byteMag++;
        byteSize /= 1024;
    }

    let str = String(Math.round(byteSize)) + " ";
    switch(byteMag) {
        default:
        case 0:
            str += "B";
            break;
        case 1:
            str += "kB";
            break;
        case 2:
            str += "MB";
            break;
        case 3:
            str += "GB";
            break;
    }

    return str;
}

const if_octane_mime_profiles = [
    {
        extension: '.flac',
        mime: 'audio/flac',
        isImageFile: false
    },
    {
        extension: '.mid',
        mime: 'audio/midi',
        isImageFile: false
    },
    {
        extension: '.midi',
        mime: 'audio/midi',
        isImageFile: false
    },
    {
        extension: '.mp4',
        mime: 'audio/mp4',
        isImageFile: false
    },
    {
        extension: '.mp3',
        mime: 'audio/mpeg',
        isImageFile: false
    },
    {
        extension: '.ogg',
        mime: 'audio/ogg',
        isImageFile: false
    },
    {
        extension: '.wav',
        mime: 'audio/wav',
        isImageFile: false
    },
    {
        extension: '.bmp',
        mime: 'image/bmp',
        isImageFile: true
    },
    {
        extension: '.jpeg',
        mime: 'image/jpeg',
        isImageFile: true
    },
    {
        extension: '.jpg',
        mime: 'image/jpeg',
        isImageFile: true
    },
    {
        extension: '.png',
        mime: 'image/png',
        isImageFile: true
    },
    {
        extension: '.svg',
        mime: 'image/svg+xml',
        isImageFile: true
    }
]

var if_octane_prepared_file_count = 0;
const if_octane_total_files_to_load = [];

const if_octane_loaded_audio_files = [];

function if_octane_prepare_file(dumpArray, manifestItem, sliceStart) {
    const itemPath = manifestItem.path;
    
    let name;
    let extension;
    let mime;
    let isImageFile;
    for (let i = itemPath.length - 1; i >= 0; i--) {
        if (itemPath[i] === '.') {
            name = itemPath.substring(0, i);
            extension = itemPath.substring(i).toLowerCase();
            break;
        }
    }

    if (extension === undefined) {
        console.error("File has no extension: " + itemPath);
        return;
    }

    for (let i = 0; i < if_octane_mime_profiles.length; i++) {
        const mimeProfile = if_octane_mime_profiles[i];
        if (extension === mimeProfile.extension) {
            mime = mimeProfile.mime;
            isImageFile = mimeProfile.isImageFile;
        }
    }

    console.log('Loading "/' + itemPath + '"...');
    const sub = dumpArray.slice(
        sliceStart, sliceStart + manifestItem.len
    );
    if_octane_total_files_to_load.push({
        name: name,
        mime: mime,
        buffer: sub,
        isImageFile: isImageFile
    });
}

function if_octane_load_files() {
    for (let i = 0; i < if_octane_total_files_to_load.length; i++) {
        // We are shifting, so we don't create duplicate buffers
        const assetProfile = if_octane_total_files_to_load[i];

        if (assetProfile.isImageFile) {
            //TODO: Implement image caching
        }
        else {
            if_octane_loaded_audio_files.push({
                name: assetProfile.name,
                mime: assetProfile.mime,
                buffer: assetProfile.buffer,
                isDecoded: false,
                isLoop: false,
                isLong: false,
                priority: 0
            });
        }

        if_octane_prepared_file_count++;
        if_octane_tryReady();
    }
}

async function if_octane_start_file_loading() {
    // Also clears out the string instance
    GAME_INFO.embeddedData = await (
        await fetch(GAME_INFO.embeddedData, {
            cache: "no-store",
            credentials: "omit",
            keepalive: false,
            mode: "same-origin",
            priority: "high"
        })
    ).arrayBuffer();

    // Paranoid: Make sure no memory is wasted on resize padding
    GAME_INFO.embeddedData = GAME_INFO.embeddedData.transferToFixedLength(
        GAME_INFO.embeddedData.length
    );

    let sliceStart = 0;
    for (let i = 0; i < GAME_INFO.embeddedManifest.length; i++) {
        const manifestItem = GAME_INFO.embeddedManifest[i];
        if (manifestItem.len === 0) continue;
        if_octane_prepare_file(GAME_INFO.embeddedData, manifestItem, sliceStart);
        sliceStart += manifestItem.len;
    }

    // Release dump memory; file prep now holds the underlying data,
    // and larger games can't afford duplicates.
    GAME_INFO.embeddedData = null;

    if_octane_load_files();

    // Mark operation as done
    if_octane_embed_ready = true;
    if_octane_tryReady();
}

function if_octane_release_prep_memory() {
    while (if_octane_total_files_to_load.length > 0) {
        if_octane_total_files_to_load.shift();
    }

    GAME_INFO.embeddedManifest = null;
}

function if_octane_fetch_audio_file(audioName) {
    if (audioName === AUDIO_SILENCE) {
        console.error('Attempted to fetch silence!');
        return undefined;
    }

    for (let i = 0; i < if_octane_loaded_audio_files.length; i++) {
        const audioFile = if_octane_loaded_audio_files[i];
        if (audioName != audioFile.name) continue;
        return audioFile;
    }

    console.error('No audio found: "' + audioName + '"');
    return undefined;
}

class OctaneAudioObject {
    constructor(audioFile, options) {
        this.audioFile = audioFile;
        this.channel = options.channel;
        this.faderGroup = undefined;
        this.connectionTail = undefined;
        this.priorityOffset = 0;
        this.distance = options.distance;
        this.muffle = options.muffle;
        this.isPlaying = false;
    }
    getPriority() {
        return this.audioFile.priority + this.priorityOffset;
    }
    isLoop() {
        // Forcefully do not allow UI and foreground audio to loop
        if (this.channel <= AUDIO_CHANNEL_FOREGROUND) return false;
        return this.audioFile.isLoop;
    }
    randomFrequency() {
        return this.audioFile.randomFrequency;
    }
    getDuration() {
        if (this.duration != undefined) {
            return this.duration;
        }
        return this.audioFile.decodedBuffer.duration;
    }
    async decode() {
        if (!this.audioFile.isDecoded) {
            this.cloneBuffer();
            this.audioFile.decodedBuffer = await if_octane_audio_context.decodeAudioData(
                this.bufferCopy
            );
            this.bufferCopy = undefined;
            this.audioFile.isDecoded = true;
        }

        this.source = if_octane_audio_context.createBufferSource();
        this.source.buffer = this.audioFile.decodedBuffer;
    }
    getSource() {
        return this.source;
    }
    getKnuckle() {
        // This is the part which connects to the tail
        return this.getSource();
    }
    getConnectionTail() {
        if (!this.connectionTail) {
            return this.getKnuckle();
        }
        return this.connectionTail;
    }
    start() {
        const source = this.getSource();
        if (source === undefined) return;
        if (this.isPlaying) return;
        source.start();
        this.isPlaying = true;
        //TODO: Handle looping
    }
    stop() {
        const source = this.getSource();
        if (source === undefined) return;
        if (!this.isPlaying) return;
        source.stop();
        this.isPlaying = false;
    }
    disconnect() {
        const source = this.getSource();
        if (source === undefined) return;
        source.disconnect();
    }
    cloneBuffer() {
        this.bufferCopy = new ArrayBuffer(this.audioFile.buffer.byteLength);
        new Uint8Array(this.bufferCopy).set(new Uint8Array(this.audioFile.buffer));
    }
}

class OctaneSilenceObject extends OctaneAudioObject {
    constructor(options) {
        super(undefined, options);
        this.isSilence = true;
        this.channel = options.channel;
        this.priorityOffset = 0;
    }
    getPriority() {
        return 0;
    }
    isLoop() {
        return false;
    }
    randomFrequency() {
        return 1.0;
    }
    async decode() {
        // Do nothing
    }
}

class OctaneLongAudioObject extends OctaneAudioObject {
    constructor(audioFile, options) {
        super(audioFile, options);
    }
    async decode() {
        if (if_octane_long_audio_bank === null) {
            if_octane_long_audio_bank = document.getElementById("long-audio-bank");
        }

        if (!this.audioFile.isDecoded) {
            this.cloneBuffer();
            const blob = new Blob([this.bufferCopy], {
                type: this.audioFile.mime
            });
            this.bufferCopy = undefined;
            this.audioFile.blob = blob;
            this.audioFile.url = URL.createObjectURL(this.audioFile.blob);
            this.audioFile.isDecoded = true;
        }

        this.createBankElement();        
    }
    createBankElement() {
        if (!this.audioElement) {
            if (this.source) {
                this.source.disconnect();
                this.source = undefined;
            }
            this.audioElement = document.createElement('audio');
            this.audioElement.src = this.audioFile.url;
            if_octane_long_audio_bank.appendChild(this.audioElement);
            this.audioElement.loop = this.isLoop();
        }
        if (!this.source) {
            this.source = if_octane_audio_context.createMediaElementSource(
                this.audioElement
            );
        }
    }
    getDuration() {
        if (this.duration != undefined) {
            return this.duration;
        }
        if (!this.audioElement) {
            return 120;
        }
        return this.audioElement.duration;
    }
    start() {
        this.createBankElement();  
        const element = this.audioElement;
        if (!element.paused) return;
        element.play();
    }
    stop() {
        const element = this.audioElement;
        if (element === undefined) return;
        element.pause();
        element.remove();
        this.audioElement = undefined;
    }
}

function normalizeAudioChannel(possibleChannel, audioFile) {
    if (audioFile) {
        if (audioFile.defaultChannel) {
            return audioFile.defaultChannel;
        }
    }
    return possibleChannel;
}

function normalizeAudioOptions(options, audioFile) {
    if (options === undefined) {
        return {
            channel: normalizeAudioChannel(AUDIO_CHANNEL_UI, audioFile),
            distance: 0,
            muffle: 0
        }
    }

    if (options.channel === undefined) {
        options.channel = normalizeAudioChannel(AUDIO_CHANNEL_UI, audioFile);
    }

    if (options.distance === undefined) {
        options.distance = 0;
    }

    if (options.muffle === undefined) {
        options.muffle = 0;
    }

    return options;
}

async function createAudioObject(audioName, options) {
    if (audioName === AUDIO_SILENCE) {
        return new OctaneSilenceObject(normalizeAudioOptions(options));
    }

    const audioFile = if_octane_fetch_audio_file(audioName);

    if (audioFile === undefined) return null;

    options = normalizeAudioOptions(options, audioFile);

    let audioObj;

    if (audioFile.isLong) {
        audioObj = new OctaneLongAudioObject(audioFile, options);
    }
    else {
        audioObj = new OctaneAudioObject(audioFile, options);
    }

    await audioObj.decode();

    return audioObj;
}

function setAudioPriority(audioName, priorityValue) {
    const audioFile = if_octane_fetch_audio_file(audioName);
    audioFile.priority = priorityValue;
}

function setAudioRandomFrequency(audioName, randomFrequency) {
    const audioFile = if_octane_fetch_audio_file(audioName);
    if (randomFrequency <= 0) randomFrequency = 1.0;
    audioFile.randomFrequency = randomFrequency;
}

function setAudioLoopStatus(audioName, isLoop) {
    const audioFile = if_octane_fetch_audio_file(audioName);
    audioFile.isLoop = isLoop;
}

function setAudioLongStatus(audioName, isLong) {
    const audioFile = if_octane_fetch_audio_file(audioName);
    audioFile.isLong = isLong;
}

function setAudioFineVolume(audioName, fineVolume) {
    const audioFile = if_octane_fetch_audio_file(audioName);
    audioFile.fineVolume = fineVolume;
}

function setAudioDefaultChannel(audioName, defaultChannel) {
    const audioFile = if_octane_fetch_audio_file(audioName);
    audioFile.defaultChannel = defaultChannel;
}

function playAudioFromObject(audioObject) {
    if (if_octane_audio_context.state === "suspended") {
        if_octane_audio_context.resume();
    }

    if (audioObject === undefined) return 0;

    if (audioObject.isSilence) return 0;

    let tailEnd = audioObject.getKnuckle();

    if (audioObject.audioFile.fineVolume) {
        // If the audio file has fine volume, then apply it here.
        const fineGain = if_octane_audio_context.createGain();
        fineGain.gain.value = audioObject.audioFile.fineVolume;
        tailEnd = tailEnd.connect(fineGain);
    }

    if (
        audioObject.channel != AUDIO_CHANNEL_UI &&
        audioObject.channel != AUDIO_CHANNEL_MUSIC
    ) {
        //TODO: Process environmental audio effects.
        // Note to use the distance and muffle properties of the audioObject,
        // as well as any effects from the environment!
    }

    if (audioObject.channel < AUDIO_CHANNEL_BACKGROUND) {
        if_octane_foreground_channel.connect(audioObject, tailEnd);
    }
    else if (audioObject.channel === AUDIO_CHANNEL_MUSIC) {
        if_octane_music_channel.connect(audioObject, tailEnd);
    }
    else {
        let customFader = undefined;
        if (!audioObject.isLoop()) {
            // Specifically connect this sound to the latest random background fader
            customFader = if_octane_background_channel.getActiveFader(true);
        }
        if_octane_background_channel.connect(audioObject, tailEnd, customFader);
    }

    audioObject.start();

    // Return the milliseconds to wait before playing the next audio
    return Math.floor(audioObject.getDuration() * 1000);
}

class AudioFadeGroup {
    constructor(volumeController) {
        const faderNode = if_octane_audio_context.createGain();
        faderNode.gain.value = 1.0;
        faderNode.connect(volumeController);
        this.node = faderNode;
        this.audioObjects = [];
        this.hasFade = false;
        this.isStopped = false;
    }

    isFresh() {
        if (this.isStopped) return false;
        if (this.hasFade) return false;
        if (this.audioObjects.length > 0) return false;
        if (this.randomBackgroundBatchID != undefined) return false;
        return true;
    }
}

class AudioChannel {
    constructor(startingVolume) {
        this.volume = startingVolume;
        this.volumeController = if_octane_audio_context.createGain();
        this.volumeController.connect(if_octane_audio_context.destination);
        this.volumeController.gain.value = startingVolume;
        this.faderGroups = [new AudioFadeGroup(this.volumeController)];
        this.neededGCIterations = 0;
        this.forceNewEnvironment = false;
    }

    setVolume(newVolume) {
        this.volume = newVolume;
        this.volumeController.gain.value = newVolume;
    }

    getActiveFader(getRandomBackgroundFader=false) {
        if (this.faderGroups.length === 0) return undefined;

        if (getRandomBackgroundFader) {
            for (let i = this.faderGroups.length - 1; i >= 0; i--) {
                const faderGroup = this.faderGroups[i];
                if (
                    faderGroup.randomBackgroundBatchID
                    === if_octane_random_background_batch_id
                ) {
                    return faderGroup;
                }
            }
            const newRandomFader = new AudioFadeGroup(this.volumeController);
            newRandomFader.randomBackgroundBatchID = if_octane_random_background_batch_id;
            this.faderGroups.push(newRandomFader);
            return newRandomFader;
        }
        else {
            for (let i = this.faderGroups.length - 1; i >= 0; i--) {
                const faderGroup = this.faderGroups[i];
                if (
                    faderGroup.randomBackgroundBatchID === undefined
                ) {
                    return faderGroup;
                }
            }
        }

        return undefined;
    }

    reload() {
        this.sendToGC();
        for (let i = 0; i < this.faderGroups.length; i++) {
            const fader = this.faderGroups[i];
            if (fader.isFresh()) {
                // This fader group hasn't been utilized at all, so we
                // can just move it to the end, instead of creating a new one.
                this.faderGroups.splice(i, 1);
                this.faderGroups.push(fader);
                return;
            }
        }

        this.faderGroups.push(new AudioFadeGroup(this.volumeController));
    }

    getNewFader(getRandomBackgroundFader=false) {
        this.reload();
        return this.getActiveFader(getRandomBackgroundFader);
    }

    fadeOut(batchObj, referenceNow) {
        const fader = batchObj.fader;
        if (fader.isStopped) return;
        if (fader.hasFade) return;

        fader.hasFade = true;

        if (referenceNow === undefined) {
            // Set the start time of the fade
            fader.node.gain.setValueAtTime(
                1.0, if_octane_audio_context.currentTime
            );
            referenceNow = if_octane_audio_context.currentTime;
        }
        else {
            // Set the start time of the fade
            fader.node.gain.setValueAtTime(
                1.0, referenceNow
            );
        }

        // Start the fade
        fader.node.gain.linearRampToValueAtTime(
            0.0, referenceNow + 0.5
        );

        const _this = this;
        setTimeout(() => { _this.stop(batchObj); }, 500);

        return referenceNow;
    }

    fadeIn(batchObj, referenceNow) {
        const fader = batchObj.fader;
        if (fader.isStopped) return;
        if (fader.hasFade) return;

        if (referenceNow === undefined) {
            // Set the start time of the fade
            fader.node.gain.setValueAtTime(
                0.0, if_octane_audio_context.currentTime
            );
            referenceNow = if_octane_audio_context.currentTime;
        }
        else {
            // Set the start time of the fade
            fader.node.gain.setValueAtTime(
                0.0, referenceNow
            );
        }

        // Start the fade
        fader.node.gain.linearRampToValueAtTime(
            1.0, referenceNow + 0.5
        );

        return referenceNow;
    }

    stop(batchObj) {
        const fader = batchObj.fader;
        if (fader.isStopped) return;
        fader.isStopped = true;

        const activeAudioObjects = fader.audioObjects;

        while (activeAudioObjects.length > 0) {
            const audioObject = activeAudioObjects.shift();
            audioObject.stop();
            audioObject.disconnect();
        }

        fader.node.disconnect();

        this.sendToGC();
    }

    getCurrentlyActiveFaders() {
        const activeFaders = [];
        for (let i = 0; i < this.faderGroups.length; i++) {
            const fader = this.faderGroups[i];
            if (fader.audioObjects.length === 0) continue;
            if (fader.isStopped) continue;
            if (fader.hasFade) continue;
            activeFaders.push(fader);
        }
        return activeFaders;
    }

    syncPlayingSounds(audioObjectList) {
        if (audioObjectList.length === 0) {
            this.forceNewEnvironment = false;
            return;
        }

        const isSilence = audioObjectList[audioObjectList.length - 1].isSilence;

        // Collect list of currently-active faders
        const activeFaders = this.getCurrentlyActiveFaders();

        // Audio that gets transferred to the new fader
        const preservedAudio = [];
        // Audio that is brand-new
        const newAudio = [];

        let preservedFader;

        if (!isSilence) {
            if (!this.forceNewEnvironment && activeFaders.length > 0) {
                for (let i = 0; i < audioObjectList.length; i++) {
                    const incomingAudio = audioObjectList[i];
                    let foundMatch = false;
                    for (let j = 0; j < activeFaders.length; j++) {
                        const compareFader = activeFaders[j];
                        if (compareFader.randomBackgroundBatchID != undefined) continue;
                        for (let k = 0; k < compareFader.audioObjects.length; k++) {
                            const compareAudio = compareFader.audioObjects[k];
                            if (
                                incomingAudio.audioFile.name
                                === compareAudio.audioFile.name
                            ) {
                                // Already playing; move it to the new fader
                                preservedAudio.push(compareAudio);
                                // Remove it from the old fader's list
                                compareFader.audioObjects.splice(k, 1);
                                // Remove the redundant attempt
                                incomingAudio.stop();
                                incomingAudio.disconnect();
                                foundMatch = true;
                                break;
                            }
                        }
                        if (foundMatch) break;
                    }
    
                    if (!foundMatch) {
                        // Not playing; add it to the new fader
                        newAudio.push(incomingAudio);
                    }
                }
            }
            else {
                // All incoming audio is new
                for (let i = 0; i < audioObjectList.length; i++) {
                    newAudio.push(audioObjectList[i]);
                }
            }

            if (preservedAudio.length > 0) {
                preservedFader = this.getNewFader();

                // Do the move
                for (let i = 0; i < preservedAudio.length; i++) {
                    const audioObject = preservedAudio[i];
                    const tailEnd = audioObject.getConnectionTail();
                    tailEnd.disconnect();
                    this.connect(audioObject, tailEnd, preservedFader);
                }
            }
        }

        let newFader = undefined;
        let referenceNow = undefined;
        if (!isSilence && newAudio.length > 0) {
            // This must get created AFTER preservedFader!
            newFader = this.getNewFader();
            // Set currentTime, and start the fade-in
            newFader.node.gain.setValueAtTime(
                0.0, if_octane_audio_context.currentTime
            );
            referenceNow = if_octane_audio_context.currentTime;
        }

        // Transition
        for (let i = 0; i < activeFaders.length; i++) {
            const checkedFader = activeFaders[i];
            // Don't fade out the preserved fader!
            if (checkedFader === preservedFader) continue;
            // Don't fade out the new fader!
            if (checkedFader === newFader) continue;
            // Make sure random backgrounds are treated well
            if (
                checkedFader.randomBackgroundBatchID
                === if_octane_random_background_batch_id
            ) {
                continue;
            }
            referenceNow = this.fadeOut({ fader: checkedFader }, referenceNow);
        }

        if (newFader) {
            // Add new audio
            for (let i = 0; i < newAudio.length; i++) {
                playAudioFromObject(newAudio[i]);
            }

            this.fadeIn({ fader: newFader }, referenceNow);
        }

        this.forceNewEnvironment = false;
    }

    handleRandomBackgroundFade() {
        const activeFaders = this.getCurrentlyActiveFaders();
        let referenceNow = undefined;

        for (let i = 0; i < activeFaders.length; i++) {
            const checkedFader = activeFaders[i];
            if (checkedFader.randomBackgroundBatchID === undefined) continue;
            if (
                checkedFader.randomBackgroundBatchID
                === if_octane_random_background_batch_id
            ) {
                continue;
            }
            referenceNow = this.fadeOut({ fader: checkedFader }, referenceNow);
        }
    }

    sendToGC() {
        this.neededGCIterations++;
        if (this.neededGCIterations > 1) return;

        // Thread-safe, simple, and we won't be dealing with
        // enough sfx at once that this will become a complexity issue.
        while (this.neededGCIterations > 0) {
            for (let i = 0; i < this.faderGroups.length - 1; i++) {
                const oldFader = this.faderGroups[i];
                if (oldFader.isStopped) {
                    this.faderGroups.splice(i, 1);
                    i--;
                }
            }
            this.neededGCIterations--;
        }
    }

    connect(audioObject, tailEnd, preferredFader) {
        if (!preferredFader) {
            preferredFader = this.getActiveFader();
        }
        let isRegistered = false;
        for (let i = 0; i < preferredFader.audioObjects.length; i++) {
            if (preferredFader.audioObjects[i] === audioObject) {
                isRegistered = true;
                break;
            }
        }
        if (!isRegistered) {
            preferredFader.audioObjects.push(audioObject);
        }
        tailEnd.connect(preferredFader.node);
        audioObject.connectionTail = tailEnd;
        audioObject.faderGroup = preferredFader;
    }
}

const if_octane_foreground_channel = new AudioChannel(1.0);
const if_octane_background_channel = new AudioChannel(0.75);
const if_octane_music_channel = new AudioChannel(0.5);

var if_octane_primary_default_sound = undefined;
var if_octane_fail_default_sound = undefined;
var if_octane_current_default_sound = undefined;

function if_octane_arm_default_sound(audioName) {
    if (audioName === undefined) return;
    if_octane_current_default_sound = audioName;
}

var if_octane_random_background_batch_id = 0;

// This gets called when changing between locations different enough to
// change how audio is perceived. In simpler situations, this is called
// when moving from one room to another.
function if_octane_arm_new_background_environment(environmentAudioProfile) {
    if_octane_pass_background_environment();
    if_octane_background_channel.forceNewEnvironment = true;
    if_octane_random_background_batch_id++;
    //TODO: Use information in the profile to inform how effects will be applied.
}

function if_octane_sync_background_audio(audioObjectList) {
    if (audioObjectList.length === 0) return;

    let backgroundToSilence = undefined;
    const backgroundList = [];
    const backgroundRandomList = [];
    let musicToSilence = undefined;
    const musicList = [];

    for (let i = 0; i < audioObjectList.length; i++) {
        const obj = audioObjectList[i];
        if (obj.isSilence) {
            if (obj.channel === AUDIO_CHANNEL_BACKGROUND) {
                backgroundToSilence = obj;
            }
            else {
                musicToSilence = obj;
            }
            continue;
        }

        if (obj.channel === AUDIO_CHANNEL_BACKGROUND && !backgroundToSilence) {
            if (obj.isLoop()) {
                backgroundList.push(obj);
            }
            else {
                backgroundRandomList.push(obj);
            }
        }
        else if (!musicToSilence) {
            musicList.push(obj);
        }
    }

    let randomFadeHandled = false;

    if (backgroundToSilence) {
        if_octane_background_channel.syncPlayingSounds(backgroundToSilence);
        randomFadeHandled = true;
    }
    else if (backgroundList.length > 0) {
        if_octane_background_channel.syncPlayingSounds(backgroundList);
        randomFadeHandled = true;
    }

    if (musicToSilence) {
        if_octane_music_channel.syncPlayingSounds(musicToSilence);
    }
    else if (musicList.length > 0) {
        if_octane_music_channel.syncPlayingSounds(musicList);
    }

    const newBackgroundCount = backgroundList.length + backgroundRandomList.length;

    if (!backgroundToSilence && newBackgroundCount > 0) {
        if_octane_random_background_batch_id++;
        //TODO: Prepare the random-background-sound system with new batch
    }

    if (!randomFadeHandled) {
        // Make sure fade-out is handled for old random background sounds
        if_octane_background_channel.handleRandomBackgroundFade();
    }
}
