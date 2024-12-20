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
import { Database, OctaneProperty } from "./data";
import { Core } from "../../core";

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

    public awake : ((oo : OctaneObject, argumentObj : object) => void) | undefined;
    public start : ((oo : OctaneObject) => void) | undefined;
    public afterLoad : ((oo : OctaneObject) => void) | undefined;
    public update : ((oo : OctaneObject) => void) | undefined;

    constructor(creationRecipeName : string, argumentObj : object) {
        this._markedForDestruction = false;
        this._markedUnreachable = false;
        this.dataIndex = Database.top();
        this._creationRecipeName = creationRecipeName;
        this._creationArgsCache = argumentObj;
        this._location = null;
        this.dataTags = new Set<string>();
        this.dataProps = new Map<string, OctaneProperty>();
        this.contents = [];
        this.awake = undefined;
        this.start = undefined;
        this.update = undefined;
    }

    public get creationRecipeName() {
        return this._creationRecipeName;
    }

    public get creationArgs() {
        return this._creationArgsCache;
    }

    public get contentSize() : number {
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
        if (this.isSpecial) return;
        this._markedUnreachable = true;
    }

    private unite() {
        if (this.isSpecial) return;
        this._markedUnreachable = this._location!.isAlone;
    }

    public get isSpecial() : boolean {
        return Database.isSpecial(this);
    }

    public getDataIndex() : number {
        return this.dataIndex;
    }

    public get hasParent() {
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

    public get isAlone() {
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
            if ((dataProp[i] as OctaneObject).isAlone) {
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
            if (prop.isAlone) {
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
                if (value.isAlone) {
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
