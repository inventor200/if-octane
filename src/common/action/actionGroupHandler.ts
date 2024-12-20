// IF-Octane
// Copyright (C) 2024  Joseph Cramsey
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { OctaneEngineError } from "../exceptions";
import { ActionGroupLayer } from "./actionGroupLayer";
import { PostedAction } from "./postedAction";

export class ActionGroupHandlerClass {
    private static _instance : ActionGroupHandlerClass;

    private layerStack : ActionGroupLayer[];

    private oldTree : ActionGroupLayer;
    private newTree : ActionGroupLayer;

    constructor() {
        this.layerStack = [];
        this.oldTree = this.getNewTree();
        this.newTree = this.getNewTree();
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    private getNewTree() : ActionGroupLayer {
        return {
            isLayer: true,
            hasPriority: false,
            newActions: [],
            newlyDisabledActions: [],
            familiarActions: [],
            totalActions: []
        };
    }

    private traverse(
        tree : ActionGroupLayer | PostedAction, path : string[]
    ) : ActionGroupLayer | PostedAction {
        if (path.length === 0) return tree;
        if (!tree.isLayer) return tree;

        const nextTarget : string = path.shift()!;

        for (let i = 0; i < (tree as ActionGroupLayer).totalActions.length; i++) {
            const postedAction = (tree as ActionGroupLayer).totalActions[i];
            const target = postedAction.path![0];
            if (target === nextTarget) {
                if (postedAction.nextLayer === null) {
                    return postedAction;
                }
                else {
                    return this.traverse(postedAction.nextLayer, path);
                }
            }
        }

        // Target not found;
        // put it back and return our progress
        path.unshift(nextTarget);

        return tree;
    }

    private compareTreeBranches(
        newBranch : ActionGroupLayer, oldBranch : ActionGroupLayer
    ) : void {
        for (let newIndex = 0; newIndex < newBranch.totalActions.length; newIndex++) {
            const newAction = newBranch.totalActions[newIndex];
            let found = false;
            let handled = false;
            for (let oldIndex = 0; oldIndex < oldBranch.totalActions.length; oldIndex++) {
                const oldAction = oldBranch.totalActions[oldIndex];
                if (newAction.name === oldAction.name) {
                    // Action found in old tree; see if we can explore further
                    if (newAction.nextLayer != null && oldAction.nextLayer != null) {
                        this.compareTreeBranches(
                            newAction.nextLayer, oldAction.nextLayer
                        );
                        let allDisabled = true;
                        for (let i = 0; i < newAction.nextLayer.totalActions.length; i++) {
                            const peekedAction = newAction.nextLayer.totalActions[i];
                            if (peekedAction.isNew) {
                                newAction.isNew = true;
                                allDisabled = false;
                                break;
                            }
                            if (!peekedAction.isDisabled) {
                                allDisabled = false;
                            }
                        }
                        if (allDisabled) {
                            // There are some really strange circumstances which
                            // could cause this, but we want to handle it anyways.
                            newAction.isDisabled = true;
                            newBranch.newlyDisabledActions.push(newAction);
                            handled = true;
                        }
                        // Either the action is marked as new,
                        // or a previously-disabled action has be restored
                        else if (
                            newAction.isNew ||
                            newAction.isDisabled != oldAction.isDisabled
                        ) {
                            newBranch.newActions.push(newAction);
                            handled = true;
                        }
                        else {
                            newBranch.familiarActions.push(newAction);
                            handled = true;
                        }
                    }
                    else {
                        // This button does something very different now
                        newAction.isNew = true;
                    }
                    found = true;
                    break;
                }
            }
            if (!handled) {
                if (found) {
                    newBranch.familiarActions.push(newAction);
                }
                else {
                    newBranch.newActions.push(newAction);
                    newAction.isNew = true;
                }
            }
        }

        for (let oldIndex = 0; oldIndex < oldBranch.totalActions.length; oldIndex++) {
            const oldAction = oldBranch.totalActions[oldIndex];
            let found = false;
            for (let newIndex = 0; newIndex < newBranch.totalActions.length; newIndex++) {
                const newAction = newBranch.totalActions[newIndex];
                if (oldAction.name === newAction.name) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Record this old action as something that just got disabled
                newBranch.newlyDisabledActions.push(oldAction);
            }
        }
    }

    // Posts a new action menu from a list of potential actions
    public openActionMenu(potentialActions : PostedAction[]) {
        potentialActions.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
        for (let i = 0; i < potentialActions.length; i++) {
            const action = potentialActions[i];
            action.path = action.name.split('|');
            for (let j = 0; j < action.path.length; j++) {
                action.path[j] = action.path[j].trim();
            }
        }

        this.oldTree = this.newTree;
        //TODO: Add pause menu actions
        this.newTree = this.getNewTree();

        // Assemble tree from sorted list
        for (let i = 0; i < potentialActions.length; i++) {
            const newAction = potentialActions[i];
            const goalPath : string[] = [...newAction.path!];
            let lastTarget : ActionGroupLayer | PostedAction = this.newTree;
            while (goalPath.length > 1) {
                const oldLength = goalPath.length;
                lastTarget = this.traverse(lastTarget, goalPath);
                if (oldLength === goalPath.length) {
                    // Traversal got stuck; expand to new sub-tree
                    const stuckName = goalPath.shift()!;
                    const newLayer = this.getNewTree();

                    // Add cancel button
                    const cancelAction : PostedAction = {
                        name: 'CANCEL',
                        path: null,
                        isLayer: false,
                        isNew: false,
                        isDisabled: false,
                        isPauseOrCancel: true,
                        nextLayer: null
                    };
                    newLayer.totalActions.push(cancelAction);

                    // Create a button leading to our sub-tree
                    const gateway : PostedAction = {
                        name: stuckName,
                        path: null,
                        isLayer: false,
                        isNew: false,
                        isDisabled: false,
                        isPauseOrCancel: false,
                        nextLayer: newLayer
                    };
                    (lastTarget as ActionGroupLayer).totalActions.push(gateway);
                    lastTarget = newLayer;
                }
            }
            const destination = goalPath[0];
            newAction.path = [destination];
            (lastTarget as ActionGroupLayer).totalActions.push(newAction);
        }

        // Compare trees to find disabled and new actions
        this.compareTreeBranches(this.newTree, this.oldTree);
    }

    public openSubMenu(subMenu : ActionGroupLayer) {
        //TODO: This adds a layer for more choices
    }

    public goUpOneLevel() {
        //TODO: Remove the last submenu from the stack, and remove the visible buttons
    }
}

export const ActionGroupHandler = ActionGroupHandlerClass.Instance;
