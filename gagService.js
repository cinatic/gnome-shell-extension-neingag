/* jshint esnext:true */
/*
 *
 *  GNOME Shell Extension for the well known 9gag
 *  - displays cute cats and rainbows.
 *  - that's it
 *
 * Copyright (C) 2016
 *     Florijan Hamzic <florijanh@gmail.com>,
 *
 * This file is part of gnome-shell-extension-neingag.
 *
 * gnome-shell-extension-neingag is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * gnome-shell-extension-neingag is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell-extension-neingag.  If not, see <http://www.gnu.org/licenses/>.
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

const GAG_URL = "http://46.51.195.70/irq";

let _httpSession = new Soup.Session();
_httpSession.user_agent = "What What";


const GagService = new Lang.Class({
    Name: "GagService",

    loadResultItem: function(category, onDataLoaded, nextPageID)
    {
        let payload = {
          "section": category || "hot",
        };

        category = category || "hot";

        var url = GAG_URL + "?section=" + category;

        if(nextPageID)
        {
            url += "&postID=" + nextPageID;
            payload["postID"] = nextPageID;
        }

        this.loadAsyncUrlData(url, payload, onDataLoaded);
    },

    loadAsyncUrlData: function(url, payload, callback)
    {
        _httpSession.abort();

        print(url);

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

//        resultItem.Status = jsonData.status;
//        resultItem.StatusMessage = jsonData.message

//        resultItem.PreviousPageID = jsonData.paging.previous;
//        resultItem.NextPageID = jsonData.paging.next

        for(let i = 0; i < jsonData.length; i++)
        {
            let jsonGagItem = jsonData[i];
            let resultGagItem = new GagObjects.GagItem();

            resultGagItem.ID = jsonGagItem.id;
            resultGagItem.Title = jsonGagItem.title;
            resultGagItem.Link = jsonGagItem.url;

            resultGagItem.VoteCount = jsonGagItem.upVoteCount;
            resultGagItem.CommentCount = jsonGagItem.commentsCount;

            resultGagItem.Images = {
                "Cover" : jsonGagItem.content,
                "Small" : jsonGagItem.content,
                "Normal": jsonGagItem.content,
                "Large" : jsonGagItem.content
            };

            if(jsonGagItem.type == "Video")
            {
                resultGagItem.Media = {
                    "Mp4": jsonGagItem.content
                };

                var firstPath = jsonGagItem.content.split('.').slice(0, -1).join('.');
                var imageUrl = firstPath.slice(0, -1) + ".jpg";
                resultGagItem.Images = {
                 "Cover" : imageUrl,
                 "Small" : imageUrl,
                 "Normal": imageUrl,
                 "Large" : imageUrl
               };
            }

            resultItem.Items.push(resultGagItem);

            if(jsonData.length == i+1)
            {
                resultItem.NextPageID = resultGagItem.ID;
            }
        }

        return resultItem;
    }
});
