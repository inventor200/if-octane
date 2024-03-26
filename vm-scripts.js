// This is for anything that uses browser and WASM.

var if_octane_emready1 = false;
var if_octane_emready2 = false;
var if_octane_emready3 = false;
var if_octane_doneReady = false;

function if_octane_allReady() {
    //console.log("Calling allReady!");
    if_octane_start_file_loading();
    if_octane_emready1 = true;
    if_octane_tryReady();
}

window.onload = function() {
    //console.log("Document ready");
    if_octane_emready3 = true;
    if_octane_tryReady();
}

function if_octane_tryReady() {
    if (if_octane_doneReady) return;
    if (!if_octane_emready1) return;
    if (!if_octane_emready2) return;
    if (!if_octane_emready3) return;
    if (if_octane_prepared_file_count
        < if_octane_total_files_to_load.length) return;
    if (if_octane_doneReady) return;
    if_octane_doneReady = true;
    if_octane_doReady();
}

var Module = {
    print: (function () {
        return function (text) {
            if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
            console.log(text);
        };
    })()
};

Module['onRuntimeInitialized'] = function() {
    //console.log("wasm loaded ");
    if_octane_emready2 = true;
    if_octane_tryReady();
}

// File management

const AudioContext = window.AudioContext || window.webkitAudioContext;
const if_octane_audio_context = new AudioContext();

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

function if_octane_prepare_file(vmPath) {
    vmPath = vmPath.trim();
    if (vmPath.startsWith('/')) {
        vmPath = vmPath.substring(1);
    }
    
    let name;
    let extension;
    let mime;
    let isImageFile;
    for (let i = vmPath.length - 1; i >= 0; i--) {
        if (vmPath[i] === '.') {
            name = vmPath.substring(0, i);
            extension = vmPath.substring(i).toLowerCase();
            break;
        }
    }

    if (extension === undefined) {
        console.error("File has no extension: " + vmPath);
        return;
    }

    for (let i = 0; i < if_octane_mime_profiles.length; i++) {
        const mimeProfile = if_octane_mime_profiles[i];
        if (extension === mimeProfile.extension) {
            mime = mimeProfile.mime;
            isImageFile = mimeProfile.isImageFile;
        }
    }

    console.log('Loading "/' + vmPath + '"...');
    if_octane_total_files_to_load.push({
        name: name,
        blob: new Blob([FS.readFile('/' + vmPath)], {'type': mime}),
        isImageFile: isImageFile
    });
}

function if_octane_load_files() {
    for (let i = 0; i < if_octane_total_files_to_load.length; i++) {
        const blobProfile = if_octane_total_files_to_load[i];

        if (blobProfile.isImageFile) {
            //TODO: Implement image caching
        }
        else {
            blobProfile.blob.arrayBuffer().then(arrayBuffer => {
                if_octane_audio_context.decodeAudioData(arrayBuffer, function(buffer) {
                    if_octane_loaded_audio_files.push({
                        name: blobProfile.name,
                        buffer: buffer,
                        priority: 0
                    });
                    if_octane_prepared_file_count++;
                    if_octane_tryReady();
                }, function(err) { console.log("err(decodeAudioData): "+err); });
            });
        }
    }
}

function if_octane_start_file_loading() {
    if_octane_search_directory('/');
    if_octane_load_files();
}

function if_octane_search_directory(path) {
    const contents = FS.readdir(path);
    for (let i = 0; i < contents.length; i++) {
        const item = contents[i];
        if (item === '.' || item === '..') continue;

        const isRoot = (path === '/');

        if (isRoot) {
            if (
                item === 'tmp' ||
                item === 'home' ||
                item === 'dev' ||
                item === 'proc'
            ) {
                console.log('Skipping system directory: "/' + item + '"...');
                continue;
            }
        }

        const addedPath = isRoot ? ('/' + item) : (path + '/' + item);
        const modeMask = FS.stat(addedPath).mode;
        if (FS.isDir(modeMask)) {
            if_octane_search_directory(addedPath);
        }
        else {
            if_octane_prepare_file(addedPath);
        }
    }
}

const AUDIO_CHANNEL_UI = 0;
const AUDIO_CHANNEL_FOREGROUND = 1;
const AUDIO_CHANNEL_BACKGROUND = 2;
const AUDIO_CHANNEL_MUSIC = 3;

function if_octane_fetch_audio_file(audioName) {
    for (let i = 0; i < if_octane_loaded_audio_files.length; i++) {
        const audioFile = if_octane_loaded_audio_files[i];
        if (audioName != audioFile.name) continue;

        const source = if_octane_audio_context.createBufferSource();
        source.buffer = audioFile.buffer;
        return audioFile;
    }

    console.error('No audio found: "' + audioName + '"');
    return undefined;
}

function createAudioObject(audioName, channel=AUDIO_CHANNEL_UI) {
    const audioFile = if_octane_fetch_audio_file(audioName);

    if (audioFile === undefined) return undefined;

    const source = if_octane_audio_context.createBufferSource();
    source.buffer = audioFile.buffer;

    let waitDuration = 0;

    if (channel < AUDIO_CHANNEL_BACKGROUND) {
        waitDuration = audioFile.buffer.duration;
        // Sounds cannot delay for more than 1 second.
        // We are also not playing more than 3 sounds between turns,
        // because accessibility guidelines dictate no more than
        // 3 seconds of sounds, which might interrupt screen readers.
        if (waitDuration > 1) waitDuration = 1.0;
    }

    return {
        audioFile: audioFile,
        source: source,
        channel: channel,
        priorityOffset: 0,
        duration: waitDuration,
        getPriority: function() {
            return audioFile.priority + this.priorityOffset;
        }
    };
}

function setAudioPriority(audioName, priorityValue) {
    const audioFile = if_octane_fetch_audio_file(audioName);
    audioFile.priority = priorityValue;
}

function playAudioFromObject(audioObject) {
    if (audioObject === undefined) return 0;

    if (if_octane_audio_context.state === "suspended") {
        if_octane_audio_context.resume();
    }

    //TODO: Process audio effects, and volume control
    let tailEnd = audioObject.source;

    tailEnd.connect(if_octane_audio_context.destination);
    audioObject.source.start();

    // Return the milliseconds to wait before playing the next audio
    return Math.floor(audioObject.duration * 1000);
}

function if_octane_sync_background_audio(audioObjectList) {
    if (audioObjectList.length === 0) return;

    //TODO: Transition background sfx and music
}

function if_octane_restore_foreground_volume() {
    //TODO: Implement
}

function if_octane_fade_foreground_volume() {
    //TODO: Implement
}