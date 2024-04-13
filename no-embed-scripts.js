// This is for anything that uses browser but no embedding.

window.onload = function() {
    if_octane_doReady();
}

class FakeAudioChannel {
    constructor(startingVolume) {
        this.volume = startingVolume;
    }

    setVolume(newVolume) {
        this.volume = newVolume;
    }
}

const if_octane_audio_context = undefined;
const if_octane_foreground_channel = new FakeAudioChannel(1.0);
const if_octane_background_channel = new FakeAudioChannel(0.75);
const if_octane_music_channel = new FakeAudioChannel(0.5);

var if_octane_primary_default_sound = undefined;
var if_octane_fail_default_sound = undefined;
var if_octane_current_default_sound = undefined;

const AUDIO_SILENCE = 'octane-core/silence';

function if_octane_fallback_no_media_error() {
    console.error('No audio found: "' + audioName + '"');
}

function if_octane_fetch_audio_file(audioName) {
    if_octane_fallback_no_media_error();
    return undefined;
}

function createAudioObject(audioName, channel=AUDIO_CHANNEL_UI) {
    if_octane_fallback_no_media_error();
    return undefined;
}

function setAudioPriority(audioName, priorityValue) {
    if_octane_fallback_no_media_error();
}

function setAudioRandomFrequency(audioName, randomFrequency) {
    if_octane_fallback_no_media_error();
}

function setAudioLoopStatus(audioName, isLoop) {
    if_octane_fallback_no_media_error();
}

function setAudioFineVolume(audioName, fineVolume) {
    if_octane_fallback_no_media_error();
}

function playAudioFromObject(audioObject) {
    if_octane_fallback_no_media_error();
}

function if_octane_arm_new_background_environment(environmentAudioProfile) {
    if_octane_pass_background_environment();
}

function if_octane_sync_background_audio(audioObjectList) {
    if_octane_fallback_no_media_error();
}