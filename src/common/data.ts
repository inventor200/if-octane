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

interface DetachmentUpdate {
    parentIndex: number;
    childIndex: number;
    dataName: string;
}

export class DatabaseClass {
    public static _instance : DatabaseClass;

    private objects : DataGrain[];
    private intactObjects : DataGrain[]; // Objects not destroyed
    private livingObjects : DataGrain[]; // Objects with an update method
    // Objects with a special meaning/purpose
    private specialObjects : DataGrain[];
    // Objects created before the game begins
    private forerunners : DataGrain[];
    // Objects suspected of being destroyed for GC
    private suspiciousLoners : DataGrain[];

    // Specials
    private rootHolderOfAll : DataHolder;
    private destroyedPlaceholder : DataGrain;

    // Actively-pending detachments
    private pendingDetachments : Map<string, DetachmentUpdate>;
    // Actively-pending attachments
    private pendingAttachments : Map<string, DetachmentUpdate>;

    //TODO: Destruction removes node and all branches from the location tree,
    //      marks them all as "marked for destruction". All objects which have
    //      prop references to them get those references nulled, and those
    //      references are flagged for suspected loneliness.
    //      Objects with no location with nothing referring to them
    //      are marked for destruction, unless they are transient.
    //      Objects marked for destruction do not count as a valid reference.
    //      Objects can be explicitly destroyed, which circumvents the checks
    //      for locations and references.

    // Transient objects preserved from GC doom
    private transientDestructions : DataGrain[];

    // Are we still assembling the game?
    private _isAcceptingForerunners : boolean;

    constructor() {
        this.objects = [];
        this.intactObjects = [];
        this.livingObjects = [];
        this._isAcceptingForerunners = true;
        this.suspiciousLoners = [];
        this.pendingDetachments = new Map<string, DetachmentUpdate>();
        this.pendingAttachments = new Map<string, DetachmentUpdate>();
        this.transientDestructions = [];
        // This is the root of the world model
        this.rootHolderOfAll = new DataHolder({});
        this.rootHolderOfAll.markTransient();
        // This object takes up indices to mark that
        // index as a destroyed object, allowing the
        // actual object to be disposed of by GC.
        this.destroyedPlaceholder = new DataGrain({});
        this.destroyedPlaceholder.markTransient();
        this.specialObjects = [
            this.rootHolderOfAll,
            this.destroyedPlaceholder
        ];
    }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    //TODO: Call all update methods on every turn
    public registerForUpdates(obj : DataGrain) : void {
        for (let i = 0; i < this.livingObjects.length; i++) {
            if (this.livingObjects[i] === obj) return;
        }
        this.livingObjects.push(obj);
    }

    private hasRegisteredUpdateMethod(obj : DataGrain) : boolean {
        for (let i = 0; i < this.livingObjects.length; i++) {
            if (this.livingObjects[i] === obj) return true;
        }
        return false;
    }

    public get isAcceptingForerunners() {
        return this._isAcceptingForerunners;
    }

    public gameIsDoneAssembling() {
        // The objects created before play begins will be accounted for.
        this._isAcceptingForerunners = false;
        this.solidify();
    }

    public flagForSuspiciousLoneliness(obj : DataGrain) {
        for (let i = 0; i < this.suspiciousLoners.length; i++) {
            if (this.suspiciousLoners[i] === obj) return;
        }
        this.suspiciousLoners.push(obj);
    }

    public solidify() {
        //TODO: Review pending disconnections and destructions.
        // Also review suspiciousLoners contents for potential destroyed loners
    }

    public register(obj : DataGrain, argumentObj : any) : number {
        const returnIndex = this.top();
        this.objects.push(obj);
        this.intactObjects.push(obj);
        if (this._isAcceptingForerunners) {
            this.forerunners.push(obj);
        }
        obj.awake(argumentObj);
        return returnIndex;
    }

    public knows(index : number) : boolean {
        return this.top() > index;
    }

    public get(index : number, standIn? : DataConnection) : AbstractDataTarget {
        if (!this.knows(index)) {
            if (standIn) return standIn;
            return new DataConnection(index);
        }
        return this.objects[index];
    }

    public get ROOT_HOLDER_OF_ALL() {
        return this.rootHolderOfAll;
    }

    public get DESTROYED_REF() {
        return this.destroyedPlaceholder;
    }

    public top() : number {
        return this.objects.length;
    }

    public isRootHolder(target : AbstractDataTarget | number) {
        const targetIndex = AbstractDataTarget.getIndexOf(target);
        // The root is the first thing to be made; this shouldn't happen
        if (targetIndex >= this.objects.length) return false;
        return this.objects[targetIndex] === this.rootHolderOfAll;
    }

    public isDestroyed(target : AbstractDataTarget | number) {
        const targetIndex = AbstractDataTarget.getIndexOf(target);
        // Dissuade code from considering destroyed objects as non-null
        if (targetIndex >= this.objects.length) return true;
        return this.objects[targetIndex] === this.destroyedPlaceholder;
    }

    public isSpecial(target : AbstractDataTarget | number) {
        return AbstractDataTarget.getIndexOf(target) < this.specialObjects.length;
    }

    public isForerunner(target : AbstractDataTarget | number) {
        return AbstractDataTarget.getIndexOf(target) < this.forerunners.length;
    }

    public getXtachmentKey(
        parent : DataHolder | number, dataName : string
    ) : string {
        let index : number;
        if ((typeof parent) === 'number') {
            index = parent as number;
        }
        else {
            index = (parent as DataHolder).getDataIndex();
        }

        return String(index) + "." + dataName;
    }

    public notifyDetachment(
        parent : DataHolder, child : AbstractDataTarget, dataName : string
    ) : void {
        this.notifyXtachment(
            this.pendingDetachments, parent, child, dataName
        );
    }

    public notifyAttachment(
        parent : DataHolder, child : AbstractDataTarget, dataName : string
    ) : void {
        this.notifyXtachment(
            this.pendingAttachments, parent, child, dataName
        );
    }

    private notifyXtachment(
        map : Map<string, DetachmentUpdate>,
        parent : DataHolder, child : AbstractDataTarget, dataName : string
    ) : void {
        const detachment : DetachmentUpdate = {
            parentIndex: parent.getDataIndex(),
            childIndex: child.getDataIndex(),
            dataName: dataName
        };

        const parentKey = this.getXtachmentKey(detachment.parentIndex, dataName);
        if (!map.has(parentKey)) {
            map.set(parentKey, detachment);
        }
    }
}

export const Database = DatabaseClass.Instance;

export abstract class AbstractDataTarget {
    protected dataIndex : number;

    constructor(dataIndex : number) {
        this.dataIndex = dataIndex;
    }

    public isSpecial() : boolean {
        return Database.isSpecial(this);
    }

    public isForerunner() : boolean {
        return Database.isForerunner(this);
    }

    public getDataIndex() : number {
        return this.dataIndex;
    }

    public static getIndexOf(dataObj : number | AbstractDataTarget) : number {
        if (dataObj instanceof AbstractDataTarget) {
            return dataObj.getDataIndex();
        }
        return dataObj;
    }

    public static isDataConnection(data : any) : boolean {
        if (data === undefined || data === null) return false;
        if ((typeof data) === 'object') {
            return (data instanceof DataConnection);
        }
        return false;
    }

    public abstract deref() : AbstractDataTarget;
    public abstract isKnownToDatabase() : boolean;

    public static handleMultiData<T>(
        data : undefined | null | number | string | boolean | AbstractDataTarget,
        handleValue : (value : null | number | string | boolean) => T,
        handleDataConnection : (conn : DataConnection) => T,
        handleDataGrain : (grain : DataGrain) => T,
        fallbackValue : any,
        unexpectedTypeContingency? : () => Error,
        wrongObjectDataContingency? : () => Error
    ) : T {
        if (data === undefined || data === null) {
            // Nothing was even here
            return handleValue(null);
        }

        const dataType = typeof data;

        if (dataType != 'object') {
            switch (dataType) {
                case 'boolean':
                case 'number':
                case 'string':
                    // This isn't detachable data
                    return handleValue(
                        data as number | string | boolean
                    );
            }

            if (unexpectedTypeContingency === undefined) {
                return fallbackValue;
            }
            else {
                throw unexpectedTypeContingency();
            }
        }

        // Something else is attached here
        const oldProp = (data as AbstractDataTarget).deref();
        if (AbstractDataTarget.isDataConnection(oldProp)) {
            return handleDataConnection(oldProp as DataConnection);
        }
        else if (oldProp instanceof DataGrain) {
            return handleDataGrain(oldProp as DataGrain);
        }

        if (wrongObjectDataContingency === undefined) {
            return fallbackValue;
        }
        else {
            throw wrongObjectDataContingency();
        }
    }
}

export class DataConnection extends AbstractDataTarget {
    private obj : DataGrain | null;

    constructor(standInValue : number) {
        super(standInValue);
        this.obj = null;
    }

    public deref() : AbstractDataTarget {
        if (this.obj) {
            return this.obj;
        }

        if (this.isKnownToDatabase()) {
            return Database.get(this.dataIndex);
        }

        return this;
    }

    public isKnownToDatabase() : boolean {
        return Database.knows(this.dataIndex);
    }
}

// The bare-minimum needed to exist in the world model
export class DataGrain extends AbstractDataTarget {
    private _location : DataHolder | DataConnection | null;
    // Transient objects are forerunners which don't get wholesale-remade
    // when restarting or loading a game.
    private _isTransient : boolean;
    private dataTags : any; //TODO: Tag handler

    constructor(argumentObj : any) {
        super(Database.top());
        Database.register(this, argumentObj);
        this._location = null;
        this._isTransient = false;
        this.dataTags = {};
    }

    public awake(argumentObj : any) : void {
        // A method called right after construction
        // Can be overridden.
    }

    public start() : void {
        // Called when the game starts
    }

    public update() : void {
        // Called on every turn and subturn
        // Make sure to call this in the awake():
        //Database.registerForUpdates(this);
    }

    public markTransient() {
        if (!Database.isAcceptingForerunners) {
            throw new OctaneGameError(
                "Cannot mark an object as transient after Core.start()"
            );
        }

        this._isTransient = this.isForerunner();
    }

    public get isTransient() {
        return this._isTransient;
    }

    //TODO: Put contents[] on DataHolder
    private static derefLocation(
        loc : DataHolder | DataConnection
    ) : DataHolder | DataConnection {
        const dloc = loc.deref();
        if (dloc instanceof DataHolder) return loc;

        if (dloc instanceof DataGrain) {
            throw new OctaneGameError("Attempted to hack a DataGrain as a location");
        }

        return dloc as DataHolder | DataConnection;
    }

    public get location() : DataHolder | DataConnection | null {
        if (this._location === null) return null;

        // Make sure we have an up-to-date reference
        this._location = DataGrain.derefLocation(this._location);

        return this._location;
    }

    public set location(newLoc : DataHolder | DataConnection | null) {
        if (newLoc === null) {
            this._location = null;
            return;
        }

        this._location = DataGrain.derefLocation(newLoc);
    }

    public hasParent() {
        return this._location != null;
    }

    public getDataIndex() : number {
        return this.dataIndex;
    }

    public deref() : AbstractDataTarget {
        return this;
    }

    public isKnownToDatabase() : boolean {
        // This object shouldn't exist without being registered
        return true;
    }

    // Explores up the tree
    public isIn(parent : DataHolder) : boolean {
        if (this._location === null) return false;
        const loc = this.location;
        if (loc instanceof DataHolder) {
            if (loc === parent) return true;
            return loc.isIn(parent);
        }

        return false;
    }

    // Is a lot more forgiving, but only handles one step
    public isChildOf(parent : DataHolder) : boolean {
        if (this._location === null) return false;
        return this._location.getDataIndex() === parent.getDataIndex();
    }

    public isAlone() {
        if (this.dataIndex === 0) {
            // Index 0 is the root holder of all
            return false;
        }
        
        return this.isIn(Database.ROOT_HOLDER_OF_ALL);
    }

    public suspectOfLoneliness() : void {
        if (this._isTransient) return; // Transients are not subject to GC
        if (!this.isAlone()) return; // The map supports its existence

        Database.flagForSuspiciousLoneliness(this);
    }
}

export class DataHolder extends DataGrain {
    private dataProps : any;

    constructor(argumentObj : any) {
        super(argumentObj);
        this.dataProps = {};
    }

    public getProperty(
        dataName : string
    ) : DataGrain | DataConnection | null | number | string | boolean {
        let value = this.dataProps[dataName];

        if (value === undefined || value === null) {
            return null;
        }

        const wasConnection = AbstractDataTarget.isDataConnection(value);

        if (wasConnection) {
            value = value.deref();
        }

        if (wasConnection && !AbstractDataTarget.isDataConnection(value)) {
            // We've realized this property, so let's update the listing
            this.dataProps[dataName] = value;
        }

        return value;
    }

    public has(dataName : string) : boolean {
        const value = this.getProperty(dataName);
        return (value != undefined && value != null);
    }

    public isUndefined(dataName : string) : boolean {
        return this.dataProps[dataName] === undefined;
    }

    public get(dataName : string) : null | number | string | boolean {
        const prop = this.getProperty(dataName);
        if (prop === null) return null;
        const T = typeof prop;
        switch (T) {
            case 'boolean':
            case 'number':
            case 'string':
                return prop as (number | string | boolean);
        }

        return null;
    }

    public set(
        dataName : string,
        value : null | number | string | boolean | AbstractDataTarget
    ) {
        if (this.propEquals(dataName, value)) return; // Already done

        const currentProp = this.getProperty(dataName);
        if (currentProp === null) {
            this.dataProps[dataName] = value;
            return;
        }

        // Detach old value
        this.clear(dataName);

        if (value instanceof AbstractDataTarget) {
            this.attach(value, dataName);
        }
        else {
            this.dataProps[dataName] = value;
        }
    }

    public propEquals(
        dataName : string,
        other : null | number | string | boolean | AbstractDataTarget
    ) : boolean {
        return this.handleDataProperty<boolean>(dataName, (value) => {
            if (value === undefined || value === null) {
                return other === null;
            }
            // other cannot be null beyond this point
            if (other === null) return false;

            return value === other;
        }, (conn) => {
            if (!(other instanceof AbstractDataTarget)) return false;
            return (other as AbstractDataTarget)
                .getDataIndex() === (conn.getDataIndex());
        }, (grain) => {
            if (!(other instanceof AbstractDataTarget)) return false;
            return (other as AbstractDataTarget)
                .getDataIndex() === (grain.getDataIndex());
        }) as boolean;
    }

    private badAttachToMe(child : AbstractDataTarget, dataName : string) : void {
        this.dataProps[dataName] = child.deref();
    }

    private attach(child : AbstractDataTarget, dataName : string) : void {
        const catchSneakyData = () : Error => {
            // Should never happen, but we're prepared anyway.
            return new OctaneGameError(
                "Caught invalid property attach attempt for \"" + dataName+
                "\" (" + (typeof child) + ")! "+
                "Attach only data grain!"
            );
        }

        AbstractDataTarget.handleMultiData<void>(child,
            (value) => {
                throw catchSneakyData();
            }, (conn) => {
                // Announce to the Database that this hypothetical
                // attachment is waiting for the other object to become real.
                Database.notifyAttachment(
                    this, conn, dataName
                );
            }, (grain) => {
                // Attach data object
                this.badAttachToMe(grain, dataName);
            }, undefined, catchSneakyData,
            () => {
                // A non-data object was attached here.
                // This would mess up the whole system in so many ways,
                // so it's good that we caught it here.
                return new OctaneGameError(
                    "Caught non-data-grain property object attempting "+
                    "to attach to \"" + dataName + "\"! "+
                    "Don't use those!!"
                );
            }
        );
    }

    private badDetachFromMe(dataName : string) : void {
        this.dataProps[dataName] = undefined;
    }

    public clear(dataName : string) : void {
        this.handleDataProperty<void>(dataName, (value) => {
            this.badDetachFromMe(dataName);
        }, (conn) => {
            // Announce to the Database that this hypothetical
            // attachment is no longer valid.
            Database.notifyDetachment(
                this, conn, dataName
            );
        }, (grain) => {
            // Detach data object
            this.badDetachFromMe(dataName);
            grain.suspectOfLoneliness();
        });
    }

    private handleDataProperty<T>(
        dataName : string,
        handleValue : (value : null | number | string | boolean) => T,
        handleDataConnection : (conn : DataConnection) => T,
        handleDataGrain : (grain : DataGrain) => T
    ) : T {
        const currentProp = this.getProperty(dataName);
        return AbstractDataTarget.handleMultiData<T>(
            currentProp,
            handleValue, handleDataConnection, handleDataGrain,
            undefined,
            () => {
                return new OctaneGameError(
                    "Caught invalid property value on \"" + dataName+
                    "\" (" + (typeof currentProp) + ")! "+
                    "Use only null, number, string, boolean, or data grain!"
                );
            },
            () => {
                // A non-data object was attached here.
                // This would mess up the whole system in so many ways,
                // so it's good that we caught it here.
                return new OctaneGameError(
                    "Caught non-data-grain property object on \"" + dataName + "\"! "+
                    "Don't use those!!"
                );
            }
        );
    }
}
