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

import { PostedAction } from "./postedAction";

// Actions are assembled into group layers. When an action opens a submenu,
// a new layer is created below, which get hotkey preference.
// When a proper action is chosen, all layers are closed, and the
// final output action remains in the transcript.
export interface ActionGroupLayer {
    isLayer: boolean;
    hasPriority: boolean;
    newActions: PostedAction[];
    newlyDisabledActions: PostedAction[];
    familiarActions: PostedAction[];
    totalActions: PostedAction[];
}
