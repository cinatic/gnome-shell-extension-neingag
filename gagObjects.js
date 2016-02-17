/* jshint esnext:true */
/*
 *
 *  GNOME Shell Extension for the great Taskwarrior application
 *  - Displays pending Tasks.
 *  - adding / modifieing tasks.
 *
 * Copyright (C) 2016
 *     Florijan Hamzic <florijanh@gmail.com>,
 *
 * This file is part of gnome-shell-extension-taskwhisperer.
 *
 * gnome-shell-extension-taskwhisperer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * gnome-shell-extension-taskwhisperer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell-extension-taskwhisperer.  If not, see <http://www.gnu.org/licenses/>.
 *
 */


const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const EXTENSIONDIR = Me.dir.get_path();

const Convenience = Me.imports.convenience;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Lang = imports.lang;


const GagResult = new Lang.Class({
    Name: 'GagResult',


    _init: function()
    {
        this.Items = [];

        this.Status;
        this.StatusMessage;

        this.PreviousPageID;
        this.NextPageID;
    }
});


const GagItem = new Lang.Class({
    Name: 'GagItem',

    _init: function()
    {
        this.ID;
        this.Title;
        this.Images; // {Small: "", Cover: "", Large: ""}
        this.Media; // {mp4: "", webm: ""}
        this.Link;
        this.VoteCount;
        this.CommentCount;
    }
});