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
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;
const Lang = imports.lang;

let _mediaHttpSession = new Soup.SessionAsync();
_mediaHttpSession.user_agent = "What What";


const MediaService = new Lang.Class({
    Name: "MediaService",

    loadDataToFile: function(url, filePath, params, callback)
    {
        let data;
        let total_size = 0;

        let file;
        let fileStream;

        let request = Soup.form_request_new_from_hash('GET', url, params || {});

        request.connect('got_headers', Lang.bind(this, function(response)
        {
            file = Gio.file_new_for_path(filePath);

            fileStream = file.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);

            total_size = response.response_headers.get_content_length();
        }));

        request.connect('got_chunk', Lang.bind(this, function(response, chunk)
        {
            //bytes_so_far += chunk.length;
            let bytes = chunk.get_as_bytes();
            fileStream.write_bytes(bytes, null);

            // take this for progressbar later

            //if(total_size)
            //{
            //    let fraction = bytes_so_far / total_size;
            //    let percent = Math.floor(fraction * 100);
            //    print("Download " + percent + "% done (" + bytes_so_far + " / " + total_size + " bytes)");
            //}
        }));

        _mediaHttpSession.queue_message(request, Lang.bind(this, function(session, response)
        {
            // important to shed the access
            fileStream.close(null);
            log("downloaded file: " + url);

            if(callback)
            {
                callback.call(this);
            }
        }));
    },

    wipeMediaFiles: function()
    {
        var paths = [EXTENSIONDIR + "/media/images", EXTENSIONDIR + "/media/clips"];
        for(let i = 0; i < paths.length; i++)
        {
            this.wipeFilesInDirectory(paths[i]);
        }
    },

    wipeFilesInDirectory: function(path)
    {
        let expirationThreshold = (new Date().getTime() / 1000) - 900;

        let directoryFile = Gio.file_new_for_path(path);
        this.getFilesAsync(directoryFile, Lang.bind(this, function(files)
        {
            for(let i = 0; i < files.length; i++)
            {
                let fileInfo = files[i];
                let modificationTime = fileInfo.get_modification_time("time");

                if(expirationThreshold >= modificationTime.tv_sec)
                {
                    let file = directoryFile.get_child(fileInfo.get_name());
                    file.delete(null);
                }
            }
        }));
    },

    getFilesAsync: function(file, callback)
    {
        let allFiles = [];
        let attributes = Gio.FILE_ATTRIBUTE_STANDARD_NAME + "," + Gio.FILE_ATTRIBUTE_TIME_MODIFIED;

        file.enumerate_children_async(attributes, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_LOW, null, function(source, result)
        {
            let enumerator = source.enumerate_children_finish(result);

            function onNextFileComplete(source, result)
            {
                let files = source.next_files_finish(result);
                if(files.length)
                {
                    allFiles = allFiles.concat(files);
                    enumerator.next_files_async(100, GLib.PRIORITY_LOW, null, onNextFileComplete);
                }
                else
                {
                    enumerator.close(null);
                    callback(allFiles);
                }
            }

            enumerator.next_files_async(100, GLib.PRIORITY_LOW, null, onNextFileComplete);
        });
    }
});
