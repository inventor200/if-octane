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

import { OctaneGameError } from "./exceptions";
import { Core } from "../core";

export type OctaneProperty = null | number | string | boolean | OctaneObject |
    number[] | string[] | boolean[] | OctaneObject[];

export const SPECIAL_TAG = "octane.special";

export class DatabaseClass {
    public static _instance : DatabaseClass;

    private awakeFunctions : Map<string, (argumentObj : any) => void>;
    private startFunctions : Map<string, () => void>;
    private updateFunctions : Map<string, () => void>;

    private objects : Map<number, OctaneObject>;
    private highestObjectIndex : number;
    private intactObjects : OctaneObject[]; // Objects not destroyed
    private livingObjects : OctaneObject[]; // Objects with an update method

    // Specials
    private rootHolderOfAll : OctaneObject;
    private destroyedPlaceholder : OctaneObject;

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
        this.awakeFunctions = new Map<string, (argumentObj : object) => void>;
        this.startFunctions = new Map<string, () => void>;
        this.updateFunctions = new Map<string, () => void>;
        this.objects = new Map<number, OctaneObject>();
        this.highestObjectIndex = 0;
        this.intactObjects = [];
        this.livingObjects = [];
        this.transientSafety = [];
        // This is the root of the world model
        this.rootHolderOfAll = new OctaneObject(
            "octane.special.rootHolderOfAll", {}
        );
        this.rootHolderOfAll.markTransient();
        this.rootHolderOfAll.tag(SPECIAL_TAG);
        // This object takes up indices to mark that
        // index as a destroyed object, allowing the
        // actual object to be disposed of by GC.
        this.destroyedPlaceholder = new OctaneObject(
            "octane.special.destroyedPlaceholder", {}
        );
        this.destroyedPlaceholder.markTransient();
        this.destroyedPlaceholder.tag(SPECIAL_TAG);
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
            const possibleStart = this.intactObjects[i].start;
            if (possibleStart != undefined) {
                possibleStart();
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
            obj.update!();
        }
    }

    private checkReachable(obj : OctaneObject) : void {
        if (obj._markedForDestruction) return;
        obj._markedUnreachable = false;
        for (let i = 0; i < obj.getContentSize(); i++) {
            this.checkReachable(obj.getContentItem(i));
        }
    }

    public solidify() {
        // Reset reach poll
        for (let i = 0; i < this.intactObjects.length; i++) {
            const obj = this.intactObjects[i];
            // Special objects know what they're doing
            if (obj.isSpecial()) continue;
            obj._markedUnreachable = true;
        }

        // This also resets _markedUnreachable
        this.checkReachable(this.rootHolderOfAll);

        // Mark unreachable for destruction
        for (let i = 0; i < this.intactObjects.length; i++) {
            const obj = this.intactObjects[i];
            // Special objects know what they're doing
            if (obj.isSpecial()) continue;

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

    public register(
        obj : OctaneObject, creationRecipeName : string, argumentObj : object
    ) : number {
        const returnIndex = this.top();
        this.highestObjectIndex++;
        this.objects.set(returnIndex, obj);
        this.intactObjects.push(obj);

        const awakeFunc = this.awakeFunctions.get(creationRecipeName);
        if (awakeFunc != undefined && awakeFunc != null) {
            obj.awake = awakeFunc.bind(obj);
        }

        const startFunc = this.startFunctions.get(creationRecipeName);
        if (startFunc != undefined && startFunc != null) {
            obj.start = startFunc.bind(obj);
        }

        const updateFunc = this.updateFunctions.get(creationRecipeName);
        if (updateFunc != undefined && updateFunc != null) {
            obj.update = updateFunc.bind(obj);
            this.registerForUpdates(obj);
        }

        if (obj.awake != undefined) {
            obj.awake(argumentObj);
        }
        return returnIndex;
    }

    public hasObjectRecipe(recipeName : string) : boolean {
        return (
            this.awakeFunctions.has(recipeName) ||
            this.startFunctions.has(recipeName) ||
            this.updateFunctions.has(recipeName)
        );
    }

    public defineNewObjectRecipe(
        recipeName : string,
        awakeFunction : (argumentObj : object) => void,
        startFunction? : () => void,
        updateFunction? : () => void
    ) {
        if (this.hasObjectRecipe(recipeName)) {
            throw new OctaneGameError(
                "Defined duplicate recipe: \"" + recipeName + "\""
            );
        }

        this.awakeFunctions.set(recipeName, awakeFunction);
        if (startFunction != undefined && startFunction != null) {
            this.startFunctions.set(recipeName, startFunction);
        }
        if (updateFunction != undefined && updateFunction != null) {
            this.updateFunctions.set(recipeName, updateFunction);
        }
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

    public get ROOT_HOLDER_OF_ALL() {
        return this.rootHolderOfAll;
    }

    public get DESTROYED_REF() {
        return this.destroyedPlaceholder;
    }

    public top() : number {
        return this.highestObjectIndex;
    }

    public isRootHolder(target : OctaneObject | number) {
        const targetIndex = this.getIndexOf(target);
        // The root is the first thing to be made; this shouldn't happen
        if (targetIndex >= this.top()) return false;
        return this.objects[targetIndex] === this.rootHolderOfAll;
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

// The bare-minimum needed to exist in the world model
export class OctaneObject {
    private dataIndex : number;
    private _location : OctaneObject | null;
    // Transient objects don't get wholesale-remade
    // when restarting or loading a game.
    private dataTags : Set<string>;

    private dataProps : Map<string, OctaneProperty>;
    private contents : OctaneObject[];

    // This can be pulled from the save for rebuilding
    private _creationRecipeName : string;
    private _creationArgsCache : object;

    public _markedForDestruction : boolean;
    public _markedUnreachable : boolean;

    public awake : ((argumentObj : object) => void) | undefined;
    public start : (() => void) | undefined;
    public update : (() => void) | undefined;

    constructor(creationRecipeName : string, argumentObj : object) {
        this._markedForDestruction = false;
        this._markedUnreachable = false;
        this.dataIndex = Database.top();
        this._creationRecipeName = creationRecipeName;
        this._creationArgsCache = argumentObj;
        Database.register(this, creationRecipeName, argumentObj);
        this._location = null;
        this.dataTags = new Set<string>();
        this.dataProps = new Map<string, OctaneProperty>();
        this.contents = [];
        this.awake = undefined;
        this.start = undefined;
        this.update = undefined;
    }

    public getContentSize() : number {
        return this.contents.length;
    }

    public getContentItem(index : number) : OctaneObject {
        if (index > this.contents.length) {
            throw new OctaneGameError(
                "Index " + index + " exceeds size of contents list"
            );
        }
        if (index < 0) {
            throw new OctaneGameError(
                "Index " + index + " is less than 0"
            );
        }
        return this.contents[index];
    }

    public get isDestroyed() {
        return this._markedForDestruction || this._markedUnreachable;
    }

    public markTransient() {
        if (Core.hasStarted) {
            throw new OctaneGameError(
                "Cannot mark an object as transient after Core.start()"
            );
        }

        Database.addTransient(this);
        this.tag("transient");
    }

    public get isTransient() {
        return this.hasTag("transient");
    }

    public get location() : OctaneObject | null {
        if (this.isDestroyed) return null;
        if (this._location === null) return null;
        if (this._location.isDestroyed) return null;
        return this._location;
    }

    public set location(newLoc : OctaneObject | null) {
        const oldLoc = this._location;
        if (newLoc === this._location) return;

        if (oldLoc != undefined && oldLoc != null) {
            oldLoc.remove(this);
        }

        if (newLoc != undefined && newLoc != null) {
            if (!newLoc.isDestroyed) {
                this._location = newLoc;
                newLoc.badlyAdd(this);
                return;
            }
        }

        this.sever();
        this._location = null;
    }

    private sever() {
        if (this.isSpecial()) return;
        this._markedUnreachable = true;
    }

    private unite() {
        if (this.isSpecial()) return;
        this._markedUnreachable = this._location!.isAlone();
    }

    public isSpecial() : boolean {
        return Database.isSpecial(this);
    }

    public getDataIndex() : number {
        return this.dataIndex;
    }

    public hasParent() {
        if (this._location === null) {
            return false;
        }

        return !this._location.isDestroyed;
    }

    // Explores up the tree
    public isIn(parent : OctaneObject) : boolean {
        if (this.location === null) return false;

        if (this._location === parent) {
            return true;
        }

        return this._location!.isIn(parent);
    }

    // Only handles one step
    public isChildOf(parent : OctaneObject) : boolean {
        if (this.location === null) return false;
        return this._location === parent;
    }

    public isUnderTag(tag : string) : boolean {
        if (this.isDestroyed) return false;
        if (this.hasTag(tag)) return true;
        if (this.location === null) return false;
        return this._location!.isUnderTag(tag);
    }

    private sendDestruction() : void {
        this._markedForDestruction = true;
        for (let i = 0; i < this.contents.length; i++) {
            this.contents[i].sendDestruction();
        }
    }

    public destroy() : void {
        if (this._location != null) {
            this._location.remove(this);
        }
        this.sendDestruction();
    }

    public isAlone() {
        if (this === Database.ROOT_HOLDER_OF_ALL) {
            return false;
        }

        if (this.isDestroyed) return true;
        
        return this.isIn(Database.ROOT_HOLDER_OF_ALL);
    }

    public contains(obj : OctaneObject) {
        if (this === obj) return true;
        for (let i = 0; i < this.contents.length; i++) {
            if (this.contents[i] === obj) return true;
        }

        return false;
    }

    // Goes further down the tree
    public containsSomewhere(obj : OctaneObject) {
        if (this === obj) return true;
        for (let i = 0; i < this.contents.length; i++) {
            const deepReach = this.contents[i].containsSomewhere(obj);
            if (deepReach) return true;
        }

        return false;
    }

    public badlyAdd(obj : OctaneObject) {
        obj.unite();
        if (!this.contains(obj)) {
            this.contents.push(obj);
        }
    }

    public add(obj : OctaneObject) {
        // This uses the setter, which automatically handles everything
        obj.location = this;
    }

    public remove(obj : OctaneObject) : null | OctaneObject {
        for (let i = 0; i < this.contents.length; i++) {
            const grain = this.contents[i];
            if (grain === obj) {
                obj.sever();
                this.contents.splice(i, 1);
                return obj;
            }
        }

        return null;
    }

    // Property functions

    private narrowProperty(dataName : string) : OctaneProperty {
        const prop = this.dataProps.get(dataName);
        if (prop === undefined) return null;
        return prop;
    }

    private sterilizeArray(dataProp : OctaneProperty) {
        if (dataProp === null) return;
        if (!Array.isArray(dataProp)) return;
        if (dataProp.length === 0) return;
        if (!(dataProp[0] instanceof OctaneObject)) return;

        for (let i = 0; i < dataProp.length; i++) {
            if ((dataProp[i] as OctaneObject).isAlone()) {
                dataProp.splice(i, 1);
                i--;
            }
        }
    }

    public get(dataName : string) : OctaneProperty {
        const prop = this.narrowProperty(dataName);
        if (prop === null) return null;
        // Do some on-demand filtering
        if (prop instanceof OctaneObject) {
            // Clear this if inaccessible
            if (prop.isAlone()) {
                // Clean as we go
                this.clear(dataName);
                return null;
            }
        }
        else {
            this.sterilizeArray(prop);
        }
        return prop;
    }

    public hasStrictly(dataName : string) : boolean {
        return this.get(dataName) != undefined;
    }

    public has(dataName : string) : boolean {
        const value = this.get(dataName);
        return value != undefined || value != null;
    }

    public set(dataName : string, value : OctaneProperty) {
        if (value != null) {
            if (value instanceof OctaneObject) {
                // Do not add severed references
                if (value.isAlone()) {
                    throw new OctaneGameError(
                        "Attempted to set destroyed/severed "+
                        "OctaneObject to property"
                    );
                }
            }
            else {
                this.sterilizeArray(value);
            }
        }
        this.dataProps.set(dataName, value);
    }

    public compare(dataName : string, other : OctaneProperty) : boolean {
        return this.get(dataName) === other;
    }

    public compareLoosely(dataName : string, other : OctaneProperty) : boolean {
        return this.get(dataName) == other;
    }

    public clear(dataName : string) : void {
        this.dataProps.delete(dataName);
    }

    public tag(tagName : string) : void {
        if (this.dataTags.has(tagName)) return;
        this.dataTags.add(tagName);
    }

    public untag(tagName : string) : void {
        if (!this.dataTags.has(tagName)) return;
        this.dataTags.delete(tagName);
    }

    public hasTag(tagName : string) : boolean {
        return this.dataTags.has(tagName);
    }
}
