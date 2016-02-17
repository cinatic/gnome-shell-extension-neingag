/* jshint esnext:true */
/*
 *
 *  GNOME Shell Extension for the well known 9gag
 *  - displays cute cats and rainbows.
 *  - that's it
 *
 *  TODO:
 *  - Video implementation
 *  - avoid saving data to disk & use direct stream for Clutter.Image
 *  - fancy load effect & notification of new items
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

const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const Util = imports.misc.util;

const Me = ExtensionUtils.getCurrentExtension();

const Convenience = Me.imports.convenience;
const GagService = Me.imports.gagService.GagService;
const MediaService = Me.imports.mediaService.MediaService;

const Cogl = imports.gi.Cogl;
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Gettext = imports.gettext.domain('gnome-shell-extension-neingag');
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ShellEntry = imports.ui.shellEntry;

const EXTENSION_DIR = Me.dir.get_path();
const _ = Gettext.gettext;
const ngettext = Gettext.ngettext;

// Settings
const NEINGAG_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.neingag';
const NEINGAG_DESKTOP_INTERFACE = 'org.gnome.desktop.interface';


const MenuPosition = {
    CENTER: 0,
    RIGHT : 1,
    LEFT  : 2
};


let _isOpen = false;
let _lastTimeOpened;
let _hitScrollEvent = false;
let _currentResultItem;
let _currentCategory = "hot";
let _wipeMediaDataTimeoutID = undefined;

let neinGagMenu;
let gagService;
let mediaService = new MediaService();


const ScrollBox = new Lang.Class({
    Name   : 'ScrollBox',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(styleClass)
    {
        this.box = new St.BoxLayout({
            style_class: styleClass,
            vertical   : true
        });

        this.actor = new St.ScrollView({
            style_class      : 'scrollBox',
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.NEVER
        });

        this.actor.add_actor(this.box);
        this.actor._delegate = this;
        this.actor.clip_to_allocation = true;
        //this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

        let scrollBar = this.actor.get_vscroll_bar();
        let appsScrollBoxAdj = scrollBar.get_adjustment();

        this.actor.connect('scroll-event', Lang.bind(this, function()
        {
            if(_hitScrollEvent)
            {
                return;
            }

            let currentPosition = appsScrollBoxAdj.value + this.actor.height;

            if((currentPosition + 400) >= appsScrollBoxAdj.upper)
            {
                this.loadGagItems();
                _hitScrollEvent = true;
            }
        }));

        this.loadGagItems();
    },

    addGagItem: function(gagItem)
    {
        let gagItemBox = new St.BoxLayout({
            style_class: "gagItem",
            vertical   : true
        });

        let titleButton = new St.Button({
            style_class: "title",
            label      : gagItem.Title
        });

        titleButton.connect('clicked', Lang.bind(this, function()
        {
            neinGagMenu.menu.actor.hide();

            try
            {
                Gtk.show_uri(null, gagItem.Link, global.get_current_time());
            }
            catch(err)
            {
                let title = _("Can not open %s").format(gagItem.Link);
                Main.notifyError(title, err.message);
            }
        }));

        let imageBox = this.renderCoverImage(gagItem);

        let footerBox = new St.BoxLayout({
            style_class: "footer",
            vertical   : false
        });

        let voteLabel = new St.Label({
            style_class: "footerItem",
            text       : ngettext("%d Vote", "%d Votes", gagItem.VoteCount).format(gagItem.VoteCount)
        });

        let commentLabel = new St.Label({
            style_class: "footerItem",
            text       : ngettext("%d Comment", "%d Comments", gagItem.CommentCount).format(gagItem.CommentCount)
        });

        footerBox.add(voteLabel);
        footerBox.add(commentLabel);

        gagItemBox.add(titleButton, {expand: true, x_fill: true, x_align: St.Align.START});
        gagItemBox.add(imageBox, {expand: true, x_fill: true, x_align: St.Align.MIDDLE});
        gagItemBox.add(footerBox, {expand: true, x_fill: true, x_align: St.Align.START});

        this.box.add_actor(gagItemBox);
    },

    _destroyItems: function()
    {
        _currentResultItem = null;

        let gagItems = this.box.get_children();
        for(let i = 0; i < gagItems.length; i++)
        {
            let gagItem = gagItems[i];
            gagItem.destroy();
        }
    },

    loadGagItems: function(cleanItemBox)
    {
        if(cleanItemBox)
        {
            this._destroyItems();
        }

        let nextPageID = _currentResultItem ? _currentResultItem.NextPageID : null;

        gagService.loadResultItem(_currentCategory, Lang.bind(this, function(data, b)
        {
            for(let i = 0; i < data.Items.length; i++)
            {
                this.addGagItem(data.Items[i]);
            }

            _currentResultItem = data;
            _hitScrollEvent = false;

        }), nextPageID);
    },

    renderCoverImage: function(gagItem)
    {
        let imageBox = new St.Bin({style_class: "imageBox", x_align: St.Align.MIDDLE});
        var path = Convenience.getMediaPath("images/" + Convenience.getFileNameFromUrl(gagItem.Images.Normal));
        let file = Gio.file_new_for_path(path);

        if(file.query_exists(null))
        {
            // File is already loaded
            this.attachImageObject(imageBox, path);
        }
        else
        {
            // Download file and attach Image when ready
            mediaService.loadDataToFile(gagItem.Images.Normal, path, null, Lang.bind(this, function()
            {
                this.attachImageObject(imageBox, path)
            }));
        }

        return imageBox;
    },

    attachImageObject: function(imageBox, path)
    {
        let imageTexture = new Clutter.Image();
        let pixBuf = GdkPixbuf.Pixbuf.new_from_file(path);

        imageTexture.set_data(
            pixBuf.get_pixels(),
            pixBuf.get_has_alpha()
                ? Cogl.PixelFormat.RGBA_8888
                : Cogl.PixelFormat.RGB_888,
            pixBuf.width,
            pixBuf.height,
            pixBuf.get_rowstride());

        let actor = new Clutter.Actor();
        actor.content = imageTexture;
        actor.set_size(pixBuf.width, pixBuf.height);

        imageBox.set_child(actor);
    }
});


const TextIconMenuItem = new Lang.Class({
    Name   : 'TextIconMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(text, style_class, func)
    {
        this.parent();
        this.func = func;

        this._label = new St.Label({text: text, style_class: style_class});
        this.actor.add_child(this._label);
    },

    activate: function(event)
    {
        this.func();
    },
});


const NeinGagMenuButton = new Lang.Class({
    Name: 'NeinGagMenuButton',

    Extends: PanelMenu.Button,

    get _position_in_panel()
    {
        //if(!this._settings)
        //{
        //    this.loadConfig();
        //}

        return MenuPosition.CENTER;
    },

    _init: function()
    {
        this.switchProvider();

        // Load settings
        // this.loadConfig();

        // Label
        this._panelButtonLabel = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            text   : _('Gags')
        });

        // Panel menu item - the current class
        let menuAlignment = 0.25;

        if(Clutter.get_default_text_direction() == Clutter.TextDirection.RTL)
        {
            menuAlignment = 1.0 - menuAlignment;
        }

        this.parent(menuAlignment);

        // Putting the panel item together
        let topBox = new St.BoxLayout();
        topBox.add_actor(this._panelButtonLabel);
        this.actor.add_actor(topBox);

        let dummyBox = new St.BoxLayout();
        this.actor.reparent(dummyBox);
        dummyBox.remove_actor(this.actor);
        dummyBox.destroy();

        this.actor.add_style_class_name('neingag');

        let children = null;
        switch(this._position_in_panel)
        {
            case MenuPosition.LEFT:
                children = Main.panel._leftBox.get_children();
                Main.panel._leftBox.insert_child_at_index(this.actor, children.length);
                break;
            case MenuPosition.CENTER:
                children = Main.panel._centerBox.get_children();
                Main.panel._centerBox.insert_child_at_index(this.actor, children.length);
                break;
            case MenuPosition.RIGHT:
                children = Main.panel._rightBox.get_children();
                Main.panel._rightBox.insert_child_at_index(this.actor, 0);
                break;
        }

        if(Main.panel._menus === undefined)
        {
            Main.panel.menuManager.addMenu(this.menu);
        }
        else
        {
            Main.panel._menus.addMenu(this.menu);
        }

        this._renderPanelMenuHeaderBox();

        this.gagScrollBox = new ScrollBox("");
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);

        section.actor.add_actor(this.gagScrollBox.actor);

        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen)
        {
            _isOpen = isOpen;

            if(isOpen)
            {
                // if inactive for 5 Minutes refresh data
                if(_lastTimeOpened <= (new Date().getTime() / 1000) - 300)
                {
                    this.gagScrollBox.loadGagItems(true);
                }

                _lastTimeOpened = new Date().getTime() / 1000;
            }
        }));

        this.setWipeMediaDataTimeout();

        if(ExtensionUtils.versionCheck(['3.8'], Config.PACKAGE_VERSION))
        {
            this._needsColorUpdate = true;
            let context = St.ThemeContext.get_for_stage(global.stage);
            this._globalThemeChangedId = context.connect('changed', Lang.bind(this, function()
            {
                this._needsColorUpdate = true;
            }));
        }
    },

    _renderPanelMenuHeaderBox: function()
    {
        let clearRefreshButton = new TextIconMenuItem(_("Refresh View"), "refreshButton", Lang.bind(this, function()
        {
            this.gagScrollBox.loadGagItems(true);
        }));

        let barSection = new PopupMenu.PopupMenuSection();

        let categoryTabBar = new St.BoxLayout({
            style_class: 'categoryTabBar'
        });

        let hotButton = this.createButton(_("Hot"), "hot", "hot active", Lang.bind(this, this._toggleCategory))
        let trendingButton = this.createButton(_("Trending"), "trending", "trending", Lang.bind(this, this._toggleCategory))
        let freshButton = this.createButton(_("Fresh"), "fresh", "fresh", Lang.bind(this, this._toggleCategory))

        categoryTabBar.add(hotButton, {expand: true, x_fill: true});
        categoryTabBar.add(trendingButton, {expand: true, x_fill: true});
        categoryTabBar.add(freshButton, {expand: true, x_fill: true});

        barSection.actor.add_actor(categoryTabBar);

        this.menu.addMenuItem(clearRefreshButton);
        this.menu.addMenuItem(barSection);
        //this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },

    _toggleCategory: function(button)
    {
        // skip because it is already active
        if(_currentCategory == button.accessible_name)
        {
            return;
        }

        // first remove active classes then highlight the clicked button
        let tabBox = button.get_parent();
        let tabBoxChildren = tabBox.get_children();

        for(let i = 0; i < tabBoxChildren.length; i++)
        {
            let tabButton = tabBoxChildren[i];
            tabButton.remove_style_class_name("active");
        }

        button.add_style_class_name("active");
        _currentCategory = button.accessible_name;

        // clear box and fetch new data
        this.gagScrollBox.loadGagItems(true);
    },

    switchProvider: function()
    {
        // TODO: Add other APIs...
        this.userNineGagService();
    },

    userNineGagService: function()
    {
        gagService = new GagService();
    },

    createButton: function(text, accessibleName, classes, onClick)
    {
        let button = new St.Button({
            reactive       : true,
            can_focus      : true,
            track_hover    : true,
            label          : text,
            accessible_name: accessibleName,
            style_class    : 'popup-menu-item button ' + classes
        });

        if(onClick)
        {
            button.connect('clicked', Lang.bind(this, onClick));
        }

        return button;
    },

    setWipeMediaDataTimeout: function()
    {
        if(_wipeMediaDataTimeoutID)
        {
            Mainloop.source_remove(_wipeMediaDataTimeoutID);
            _wipeMediaDataTimeoutID = undefined;
        }

        _wipeMediaDataTimeoutID = Mainloop.timeout_add_seconds(300, Lang.bind(this, function()
        {
            mediaService.wipeMediaFiles();
            return true;
        }));
    },

    stop: function()
    {
        _currentResultItem = null;
        _currentCategory = "hot";

        if(_wipeMediaDataTimeoutID)
        {
            Mainloop.source_remove(_wipeMediaDataTimeoutID);
            _wipeMediaDataTimeoutID = undefined;
        }
    }
});

function init()
{
    Convenience.initTranslations('gnome-shell-extension-neingag');
}

function enable()
{
    neinGagMenu = new NeinGagMenuButton();
    Main.panel.addToStatusArea('neinGagMenu', neinGagMenu);
}

function disable()
{
    neinGagMenu.stop();
    neinGagMenu.destroy();
}
