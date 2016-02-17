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
const GagObjects = Me.imports.gagObjects;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Lang = imports.lang;


let _httpSession = new Soup.Session();
_httpSession.user_agent = "What What";


const GagService = new Lang.Class({
    Name: "GagService",

    loadResultItem: function(category, onDataLoaded, nextPageID)
    {
        let payload = {};
        category = category || "hot";

        if(nextPageID)
        {
            payload["id"] = nextPageID;
        }

        this.loadAsyncUrlData("http://infinigag.k3min.eu/" + category, payload, onDataLoaded);
    },

    loadAsyncUrlData: function(url, payload, callback)
    {
        _httpSession.abort();

        let message = Soup.form_request_new_from_hash('GET', url, payload || {});

        _httpSession.queue_message(message, Lang.bind(this, function(session, response)
        {
            let data;
            try
            {
                data = JSON.parse(response.response_body.data);
            }catch(e)
            {
            }

            let resultItem = this.createGagStructureItem(data);
            callback.call(this, resultItem);
        }));
    },

    createGagStructureItem: function(jsonData)
    {
        let resultItem = new GagObjects.GagResult();

        if(!jsonData)
        {
            return resultItem;
        }

        resultItem.Status = jsonData.status;
        resultItem.StatusMessage = jsonData.message

        resultItem.PreviousPageID = jsonData.paging.previous;
        resultItem.NextPageID = jsonData.paging.next

        for(let i = 0; i < jsonData.data.length; i++)
        {
            let jsonGagItem = jsonData.data[i];
            let resultGagItem = new GagObjects.GagItem();

            resultGagItem.ID = jsonGagItem.id;
            resultGagItem.Title = jsonGagItem.caption;
            resultGagItem.Link = jsonGagItem.link;

            resultGagItem.VoteCount = jsonGagItem.votes.count;
            resultGagItem.CommentCount = jsonGagItem.comments.count;

            resultGagItem.Images = {
                "Cover" : jsonGagItem.images.cover,
                "Small" : jsonGagItem.images.small,
                "Normal": jsonGagItem.images.normal,
                "Large" : jsonGagItem.images.large
            };

            if(jsonGagItem.media && jsonGagItem.media.mp4)
            {
                resultGagItem.Media = {
                    "Mp4": jsonGagItem.media.mp4
                };
            }

            resultItem.Items.push(resultGagItem);
        }

        return resultItem;
    }
});
