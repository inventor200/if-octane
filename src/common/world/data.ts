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

import { OctaneGameError } from "../exceptions";
import { OctaneObject } from './octaneObject';

export type OctaneProperty = null | number | string | boolean | OctaneObject |
    number[] | string[] | boolean[] | OctaneObject[];

export const SPECIAL_TAG = "octane.special";

export interface OctaneObjectRecipe {
    awake: (oo : OctaneObject, argumentObj : object) => void;
    start?: (oo : OctaneObject) => void;
    afterLoad?: (oo : OctaneObject) => void;
    update?: (oo : OctaneObject) => void;
}

export class DatabaseClass {
    public static _instance : DatabaseClass;

    private objectRecipes : Map<string, OctaneObjectRecipe>;

    private objects : Map<number, OctaneObject>;
    private highestObjectIndex : number;
    private intactObjects : OctaneObject[]; // Objects not destroyed
    private livingObjects : OctaneObject[]; // Objects with an update method

    // Specials
    private rootHolderOfAll : undefined | OctaneObject;

    //TODO: Destruction removes node and all branches from the location tree,
    //      marks them all as "marked for destruction". All objects which have
    //      prop references to them get those references nulled, and those
    //      references are flagged for suspected loneliness.
    //      Objects with no location with nothing referring to them
    //      are marked for destruction, unless they are transient.
    //      Objects marked for destruction do not count as a valid reference.
    //      Objects can be explicitly destroyed, which circumvents the checks
    //      for locations and references.
    //      Also, destroyed objects should be removed from the update list.

    // Transient objects preserved from GC doom
    private transientSafety : OctaneObject[];

    constructor() {
        this.objectRecipes = new Map<string, OctaneObjectRecipe>;
        this.objects = new Map<number, OctaneObject>();
        this.highestObjectIndex = 0;
        this.intactObjects = [];
        this.livingObjects = [];
        this.transientSafety = [];
    }

    public unpack() {
        // This is still part of initialization, but it requires everything
        // to be constructed first, otherwise a lot of crashes happen.

        // This is the root of the world model
        this.rootHolderOfAll = this.createUnknownOctaneObject(
            "octane.special.rootHolderOfAll", {
            awake: (oo : OctaneObject, argumentObj : object) => {
                oo.markTransient();
                oo.tag(SPECIAL_TAG);
            }
        });
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    public addTransient(obj : OctaneObject) : void {
        if (!obj.isTransient) return;
        this.transientSafety.push(obj);
    }

    private registerForUpdates(obj : OctaneObject) : void {
        for (let i = 0; i < this.livingObjects.length; i++) {
            if (this.livingObjects[i] === obj) return;
        }
        if (obj.update === undefined) return;
        this.livingObjects.push(obj);
    }

    public runStarts() : void {
        for (let i = 0; i < this.intactObjects.length; i++) {
            const obj = this.intactObjects[i];
            if (obj.start != undefined) {
                obj.start(obj);
            }
        }
    }

    public doAfterLoad() : void {
        for (let i = 0; i < this.intactObjects.length; i++) {
            const obj = this.intactObjects[i];
            if (obj.afterLoad != undefined) {
                obj.afterLoad(obj);
            }
        }
    }

    public runUpdates() : void {
        for (let i = 0; i < this.livingObjects.length; i++) {
            const obj = this.livingObjects[i];
            if (obj.isDestroyed) {
                // Destroyed objects do not update
                this.livingObjects.splice(i, 1);
                i--;
                continue;
            }
            obj.update!(obj);
        }
    }

    private checkReachable(obj : OctaneObject) : void {
        if (obj._markedForDestruction) return;
        obj._markedUnreachable = false;
        for (let i = 0; i < obj.contentSize; i++) {
            this.checkReachable(obj.getContentItem(i));
        }
    }

    public solidify() {
        // Reset reach poll
        for (let i = 0; i < this.intactObjects.length; i++) {
            const obj = this.intactObjects[i];
            // Special objects know what they're doing
            if (obj.isSpecial) continue;
            obj._markedUnreachable = true;
        }

        // This also resets _markedUnreachable
        this.checkReachable(this.rootHolderOfAll!);

        // Mark unreachable for destruction
        for (let i = 0; i < this.intactObjects.length; i++) {
            const obj = this.intactObjects[i];
            // Special objects know what they're doing
            if (obj.isSpecial) continue;

            // obj.isDestroyed also takes obj._markedUnreachable into account
            if (obj.isDestroyed) {
                if (obj.isTransient) {
                    // Save transients from GC
                    let found = false;
                    for (let j = 0; j < this.transientSafety.length; j++) {
                        if (this.transientSafety[j] === obj) {
                            found = true;
                            break;
                        }
                    }

                    if (!found) this.transientSafety.push(obj);
                }

                // Toss destroyed objects to GC
                this.objects.delete(obj.getDataIndex());
                obj._markedForDestruction = true;
                this.intactObjects.splice(i, 1);
                i--;
            }
        }
    }

    private register(obj : OctaneObject) : number {
        const returnIndex = this.top();
        this.highestObjectIndex++;
        this.objects.set(returnIndex, obj);
        this.intactObjects.push(obj);

        const recipe = this.objectRecipes.get(obj.creationRecipeName);
        if (recipe === undefined) {
            throw new OctaneGameError(
                "No recipe found: \"" + obj.creationRecipeName + "\""
            );
        }

        if (recipe.awake != undefined) {
            obj.awake = recipe.awake.bind(obj);
        }

        if (recipe.start != undefined) {
            obj.start = recipe.start.bind(obj);
        }

        if (recipe.afterLoad != undefined) {
            obj.afterLoad = recipe.afterLoad.bind(obj);
        }

        if (recipe.update != undefined) {
            obj.update = recipe.update.bind(obj);
            this.registerForUpdates(obj);
        }

        if (obj.awake != undefined) {
            obj.awake(obj, obj.creationArgs);
        }

        return returnIndex;
    }

    public createOctaneObject(
        recipeName : string, argumentObj : object
    ) : OctaneObject {
        const fresh = new OctaneObject(recipeName, argumentObj);
        this.register(fresh);
        return fresh;
    }

    public createUnknownOctaneObject(
        recipeName : string, recipeDefinition : OctaneObjectRecipe,
        argumentObj? : object
    ) : OctaneObject {
        this.defineObjectRecipe(recipeName, recipeDefinition);
        const args : object = (argumentObj === undefined) ? {} : argumentObj;
        return this.createOctaneObject(recipeName, args);
    }

    public hasObjectRecipe(recipeName : string) : boolean {
        return this.objectRecipes.has(recipeName);
    }

    public defineObjectRecipe(
        recipeName : string,
        recipeDefinition : OctaneObjectRecipe
    ) : void {
        if (this.hasObjectRecipe(recipeName)) {
            throw new OctaneGameError(
                "Defined duplicate recipe: \"" + recipeName + "\""
            );
        }

        this.objectRecipes.set(recipeName, recipeDefinition);
    }

    public knows(index : number) : boolean {
        return (index < 0) && (this.top() > index);
    }

    public get(index : number) : null | OctaneObject {
        if (!this.knows(index)) {
            return null;
        }
        const ret = this.objects.get(index);
        if (ret === undefined) return null;
        if (ret.isDestroyed) {
            return null;
        }
        return ret;
    }

    public get ROOT_HOLDER_OF_ALL() : OctaneObject {
        return this.rootHolderOfAll!;
    }

    public top() : number {
        return this.highestObjectIndex;
    }

    public isRootHolder(target : OctaneObject | number) {
        const targetIndex = this.getIndexOf(target);
        // The root is the first thing to be made; this shouldn't happen
        if (targetIndex >= this.top()) return false;
        return this.objects.get(targetIndex) === this.rootHolderOfAll;
    }

    public isDestroyed(target : OctaneObject | number) : boolean {
        const targetIndex = this.getIndexOf(target);
        // Dissuade code from considering destroyed objects as non-null
        if (targetIndex >= this.top()) return true;
        const fetched = this.get(targetIndex);
        if (fetched === null) return true;
        return fetched.isDestroyed;
    }

    public isSpecial(target : OctaneObject | number) : boolean {
        let obj : undefined | number | OctaneObject = target;
        if ((typeof target) === 'number') {
            obj = this.objects.get(target as number);
            if (obj === undefined) return false;
        }

        return (obj as OctaneObject).hasTag(SPECIAL_TAG);
    }

    public getIndexOf(dataObj : number | OctaneObject) : number {
        if ((typeof dataObj) === 'number') return dataObj as number;
        return (dataObj as OctaneObject).getDataIndex();
    }
}

export const Database = DatabaseClass.Instance;
