// This is for anything that uses browser and WASM.

var if_octane_emready1 = false;
var if_octane_emready2 = false;
var if_octane_emready3 = false;
var if_octane_doneReady = false;

function if_octane_allReady() {
    //console.log("Calling allReady!");
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