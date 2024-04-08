// WORLD MODEL - BASICS

const if_octane_complete_dataset = [];

class OctaneReference {
    static localList = if_octane_complete_dataset;

    constructor() {
        this.id = if_octane_complete_dataset.length;
        if_octane_complete_dataset.push(this);
        this.localID = localList.length;
        localList.push(this);

    }

    getFromID(id) {
        return if_octane_complete_dataset[id];
    }

    getFromLocalID(localID) {
        return localList[localID];
    }
}

const if_octane_unknown_ordered_stack = [];

class StatefulOctaneReference extends OctaneReference {
    constructor(localStack) {
        super();
        this.localStack = localStack;
        this._isActive = true; // <- Fallback internal memory
        localStack.push(this);
        this.setOrder(getDefaultOrder(this.localID));
    }

    static getDefaultOrder(localID) {
        return (localID + 1) * 1000
    }

    activate() {
        this._isActive = true;
    }

    deactivate() {
        this._isActive = false;
    }

    // This can be overridden
    isActive() {
        return this._isActive;
    }

    setOrder(order) {
        if (!order) order = 0;
        this.order = order;
        for (let i = 0; i < this.localStack.length; i++) {
            const pick = this.localStack[i];
            if (this.order === pick.order) {
                console.error(
                    "There is already an ActionPhraseLayer with an order of "+
                    this.order + "!"
                );
                break;
            }
        }
        this.localStack.sort((a, b) => {a.order - b.order});
    }

    setOrderBefore(other) {
        for (let i = 0; i < this.localStack.length; i++) {
            const pick = this.localStack[i];
            if (pick === other) {
                if (i === 0) {
                    this.order = other.order / 2;
                }
                else {
                    this.order = (
                        other.order + this.localStack[i-1].order
                    ) / 2;
                }
                this.localStack.sort((a, b) => {a.order - b.order});
                return;
            }
        }

        console.error("setOrderBefore cannot find other in stack!");
    }

    setOrderAfter(other) {
        for (let i = 0; i < this.localStack.length; i++) {
            const pick = this.localStack[i];
            if (pick === other) {
                if (i === this.localStack.length - 1) {
                    this.order = (
                        other.order + getDefaultOrder(this.localStack.length)
                    ) / 2;
                }
                else {
                    this.order = (
                        other.order + this.localStack[i+1].order
                    ) / 2;
                }
                this.localStack.sort((a, b) => {a.order - b.order});
                return;
            }
        }

        console.error("setOrderAfter cannot find other in stack!");
    }
}

// Constants
var playerCharacter = undefined;

// ActionPhrases are organized into ActionPhraseLayers,
// allowing an ActionPhrase on one layer to override one on another.
const if_octane_action_phrase_layer_bank = [];
const if_octane_action_phrase_stack = [];

class ActionPhraseLayer extends StatefulOctaneReference {
    static localList = if_octane_action_phrase_layer_bank;

    constructor() {
        super(if_octane_action_phrase_stack);
        this.phrases = [];
    }
}

// An ActionPhrase matches to a command string, and pulls
// out property strings with attached roles.
// If provided context, we can reject certain phrases
// which do not look for roles contained in the context info.
// Once an ActionPhrase is matched, the info is sent to an
// ActionDistributor object, which the phrase is linked to.
const if_octane_action_phrasebook = [];

class ActionPhrase extends StatefulOctaneReference {
    static localList = if_octane_action_phrasebook;

    constructor(layer, ...format) {
        super(layer.phrases);
        this.layer = layer;

        format = format.flat();

        if (format.length === 1 && format[0] instanceof ActionPhrase) {
            // The incoming format is an ActionPhrase
            // that we are copying a format from.
            this.format = format[0].format;
        }
        else {
            this.format = format;
        }
    }
}
