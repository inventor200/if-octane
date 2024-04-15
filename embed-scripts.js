// This is for anything that uses browser and embedding.

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

//TODO: We might need to split up larger audio files into segments.
// A way to possibly do this in bash is below:
// https://superuser.com/questions/525210/splitting-an-audio-file-into-chunks-of-a-specified-length
// From there, we just need to understand a series of segment files as
// a whole track for streaming.
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
                buffer: assetProfile.buffer,
                isDecoded: false,
                priority: 0
            });
            if_octane_prepared_file_count++;
            if_octane_tryReady();
        }
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
}

const AUDIO_CHANNEL_UI = 0;
const AUDIO_CHANNEL_FOREGROUND = 1;
const AUDIO_CHANNEL_BACKGROUND = 2;
const AUDIO_CHANNEL_MUSIC = 3;

const AUDIO_SILENCE = 'octane-core/silence';

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
    constructor(audioFile, source, options) {
        this.audioFile = audioFile;
        this.source = source;
        this.channel = options.channel;
        this.faderGroup = undefined;
        this.connectionTail = undefined;
        this.priorityOffset = 0;
        this.distance = options.distance;
        this.muffle = options.muffle;
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
}

async function createAudioObject(audioName, options) {
    if (options === undefined) {
        options = {
            channel: AUDIO_CHANNEL_UI,
            distance: 0,
            muffle: 0
        }
    }

    if (options.channel === undefined) {
        options.channel = AUDIO_CHANNEL_UI;
    }

    if (options.distance === undefined) {
        options.distance = 0;
    }

    if (options.muffle === undefined) {
        options.muffle = 0;
    }

    if (audioName === AUDIO_SILENCE) {
        return {
            isSilence: true,
            channel: options.channel,
            priorityOffset: 0,
            getPriority: function() {
                return 0;
            },
            isLoop: function() {
                return false;
            },
            randomFrequency: function() {
                return 1.0;
            }
        };
    }

    const audioFile = if_octane_fetch_audio_file(audioName);

    if (audioFile === undefined) return;

    if (!audioFile.isDecoded) {
        console.log("Before: " + estimateAudioSize(audioFile.buffer));
        const decoded = await if_octane_audio_context.decodeAudioData(audioFile.buffer);
        console.log("After: " + estimateAudioSize(decoded));
        audioFile.buffer = decoded;
        audioFile.isDecoded = true;
    }

    const source = if_octane_audio_context.createBufferSource();
    source.buffer = audioFile.buffer;

    return new OctaneAudioObject(audioFile, source, options);
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

function setAudioFineVolume(audioName, fineVolume) {
    const audioFile = if_octane_fetch_audio_file(audioName);
    audioFile.fineVolume = fineVolume;
}

function playAudioFromObject(audioObject) {
    if (if_octane_audio_context.state === "suspended") {
        if_octane_audio_context.resume();
    }

    if (audioObject === undefined) return 0;

    if (audioObject.isSilence) return 0;

    let tailEnd = audioObject.source;

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
        if_octane_background_channel.connect(audioObject, tailEnd);
    }

    if (
        audioObject.channel === AUDIO_CHANNEL_BACKGROUND &&
        !audioObject.isLoop()
    ) {
        //TODO: Handle randomly-playing background sound
    }
    else {
        //TODO: Handle looping sounds
        audioObject.source.start();
    }

    // Return the milliseconds to wait before playing the next audio
    let myDuration = audioObject.audioFile.buffer.duration;
    if (audioObject.duration != undefined) {
        // This override gets set when sfx are cramming for play time.
        myDuration = audioObject.duration;
    }
    return Math.floor(myDuration * 1000);
}

class AudioFadeGroup {
    constructor(volumeController) {
        const faderNode = if_octane_audio_context.createGain();
        faderNode.gain.value = 1.0;
        faderNode.connect(volumeController);
        this.node = faderNode;
        this.sources = [];
        this.hasFade = false;
        this.isStopped = false;
    }

    isFresh() {
        if (this.isStopped) return false;
        if (this.hasFade) return false;
        if (this.sources.length > 0) return false;
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

    getActiveFader() {
        if (this.faderGroups.length === 0) return undefined;

        return this.faderGroups[this.faderGroups.length - 1];
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

    getNewFader() {
        this.reload();
        return this.getActiveFader();
    }

    fadeOut(batchObj, referenceNow) {
        const fader = batchObj.fader;
        if (fader.isStopped) return;
        if (fader.hasFade) return;

        fader.hasFade = true;

        if (!referenceNow) {
            // Set the start time of the fade
            fader.node.gain.setValueAtTime(
                1.0, if_octane_audio_context.currentTime
            );
            referenceNow = if_octane_audio_context.currentTime;
        }

        // Start the fade
        fader.node.gain.linearRampToValueAtTime(
            0, referenceNow + 0.5
        );

        const _this = this;
        setTimeout(() => { _this.stop({
            fader: fader
        }); }, 500);

        return referenceNow;
    }

    fadeIn(batchObj, referenceNow) {
        const fader = batchObj.fader;
        if (fader.isStopped) return;
        if (fader.hasFade) return;

        if (!referenceNow) {
            // Set the start time of the fade
            fader.node.gain.setValueAtTime(
                0.0, if_octane_audio_context.currentTime
            );
            referenceNow = if_octane_audio_context.currentTime;
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

        const activeSources = fader.sources;

        while (activeSources.length > 0) {
            const source = activeSources.shift();
            source.stop();
            source.disconnect();
        }

        fader.node.disconnect();

        this.sendToGC();
    }

    //TODO: Set up a test case for this
    syncPlayingSounds(audioObjectList) {
        if (audioObjectList.length === 0) {
            this.forceNewEnvironment = false;
            return;
        }

        const isSilence = audioObjectList[audioObjectList.length - 1].isSilence;

        // Collect list of currently-active faders
        const activeFaders = [];
        for (let i = 0; i < this.faderGroups.length; i++) {
            const fader = this.faderGroups[i];
            if (fader.sources.length === 0) continue;
            if (fader.isStopped) continue;
            if (fader.hasFade) continue;
            activeFaders.push(fader);
        }

        // Audio that gets transferred to the new fader
        const preservedAudio = [];
        // Audio that is brand-new
        const newAudio = [];

        if (!isSilence) {
            if (!this.forceNewEnvironment && activeFaders.length > 0) {
                for (let i = 0; i < audioObjectList.length; i++) {
                    const incomingAudio = audioObjectList[i];
                    let foundMatch = false;
                    for (let j = 0; j < activeFaders.length; j++) {
                        const compareFader = activeFaders[j];
                        for (let k = 0; k < compareFader.sources.length; k++) {
                            const compareSource = compareFader.sources[k];
                            if (incomingAudio.audioFile.buffer != compareSource.audioFile.buffer) {
                                // Already playing; move it to the new fader
                                preservedAudio.push(incomingAudio);
                                // Remove it from the old fader's list
                                compareFader.sources.splice(k, 1);
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

            const preservedFader = this.getNewFader();

            // Do the move
            for (let i = 0; i < preservedAudio.length; i++) {
                const audioObject = preservedAudio[i];
                const tailEnd = audioObject.connectionTail;
                tailEnd.disconnect();
                preservedFader.connect(audioObject, tailEnd);
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
            referenceNow = this.fadeOut({ fader: activeFaders[i] }, referenceNow);
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

    connect(audioObject, tailEnd) {
        const active = this.getActiveFader();
        active.sources.push(audioObject.source);
        tailEnd.connect(active.node);
        audioObject.connectionTail = tailEnd;
        audioObject.faderGroup = active;
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

// This gets called when changing between locations different enough to
// change how audio is perceived. In simpler situations, this is called
// when moving from one room to another.
function if_octane_arm_new_background_environment(environmentAudioProfile) {
    if_octane_pass_background_environment();
    if_octane_background_channel.forceNewEnvironment = true;
    //TODO: Use information in the profile to inform how effects will be applied.
}

function if_octane_sync_background_audio(audioObjectList) {
    if (audioObjectList.length === 0) return;

    let backgroundToSilence = undefined;
    const backgroundList = [];
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
            backgroundList.push(obj);
        }
        else if (!musicToSilence) {
            musicList.push(obj);
        }
    }

    if (backgroundToSilence) {
        if_octane_background_channel.syncPlayingSounds(backgroundToSilence);
    }
    else if (backgroundList.length > 0) {
        if_octane_background_channel.syncPlayingSounds(backgroundList);
    }

    if (musicToSilence) {
        if_octane_music_channel.syncPlayingSounds(musicToSilence);
    }
    else if (musicList.length > 0) {
        if_octane_music_channel.syncPlayingSounds(musicList);
    }
}