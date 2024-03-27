// This is for anything that uses browser but no WASM.

window.onload = function() {
    if_octane_doReady();
}

const IF_OCTANE_USING_EMBEDDING = false;

const if_octane_audio_context = undefined;
var if_octane_user_sfx_volume = 1.0;
var if_octane_user_background_volume = 1.0;
var if_octane_user_music_volume = 1.0;

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

function playAudioFromObject(audioObject) {
    if_octane_fallback_no_media_error();
}

function if_octane_sync_background_audio(audioObjectList) {
    if_octane_fallback_no_media_error();
}

function if_octane_get_active_fader() {
    if_octane_fallback_no_media_error();
}

function if_octane_restore_foreground_volume() {
    if_octane_fallback_no_media_error();
}

function if_octane_fade_foreground_volume() {
    if_octane_fallback_no_media_error();
}

function if_octane_interrupt_foreground_audio() {
    if_octane_fallback_no_media_error();
}