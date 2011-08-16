/*global $, _, window, jQuery, console */

$(function () {

    // API object
    // ----------
    // The API object is responsible for communicating with the back-end. In
    // this case, the "back-end" is a CouchDB database.

    var api = (function () {
        return {
            fetch: function (callbacks) {
                $.ajax({
                    url: '/couchdb/livres/_design/livres/_view/all',
                    dataType: 'json',
                    success: function (returnedData, status, xhr) {
                        var rows = _(returnedData.rows).pluck('value');
                        (callbacks.success || $.noop)(rows);
                    },
                    error: function (xhr, status, error) {
                        (callbacks.error || $.noop)(xhr.status);
                    }
                });
            },
            create: function (jsonData, callbacks) {
                $.ajax({
                    type: 'POST',
                    url: '/couchdb/livres/',
                    contentType: 'application/json; charset=UTF-8',
                    data: JSON.stringify(jsonData),
                    dataType: 'json',
                    success: function (returnedData, status, xhr) {
                        (callbacks.success || $.noop)(returnedData);
                    },
                    error: function (xhr, status, error) {
                        (callbacks.error || $.noop)(xhr.status);
                    }
                });
            },
            update: function (jsonData, callbacks) {
                $.ajax({
                    type: 'PUT',
                    url: '/couchdb/livres/'+jsonData._id,
                    contentType: 'application/json; charset=UTF-8',
                    data: JSON.stringify(jsonData),
                    dataType: 'json',
                    success: function (returnedData, status, xhr) {
                        (callbacks.success || $.noop)({_rev: returnedData.rev});
                    },
                    error: function (xhr, status, error) {
                        (callbacks.error || $.noop)(xhr.status);
                    }
                });
            },
            destroy: function (jsonData, callbacks) {
                $.ajax({
                    type: 'DELETE',
                    url: '/couchdb/livres/'+jsonData._id+'?rev='+jsonData._rev,
                    dataType: 'json',
                    success: function (returnedData, status, xhr) {
                        (callbacks.success || $.noop)(returnedData);
                    },
                    error: function (xhr, status, error) {
                        (callbacks.error || $.noop)(xhr.status);
                    }
                });
            }
        };
    }());

    // The "Book" model class
    // ----------------------
    // The Book model wraps the json data sent from the back-end. A Book is
    // responsible for saving and deleting itself. Views can subscribe to a
    // Book's events by calling the `bind` method passing in the event name for
    // wich they need to be notified of. A Book mainly notifies its views of
    // changes made in the data model.

    var Book = function (data) {
        var callbacks = {},
            trigger = function (evt) {
                var list = (callbacks[evt] = callbacks[evt] || []);
                _(list).each(function (it) {
                    it.apply(this, Array.prototype.slice.call(arguments, 1));
                });
            },
            isNew = function () {
                return !data._id;
            },
            set = function (properties) {
                _(properties).each(function (val, name) {
                    if (name === 'id') { name = '_id'; }
                    if (name === 'rev') { name = '_rev'; }
                    data[name] = val;
                });
                trigger('change');
            },
            sync = function (methodName, callbacks) {
                (api[methodName])(data, callbacks);
            };
        return {
            bind: function (evt, callback) {
                var list = (callbacks[evt] = callbacks[evt] || []);
                list.push(callback);
                return this;
            },
            get: function (name) {
                return data[name];
            },
            set: function (properties) {
                set(properties);
                return this;
            },
            save: function (callback) {
                var self = this;
                sync(isNew() ? 'create' : 'update', {
                    success: function (properties) {
                        set(properties);
                        if (callback && callback.success) {
                            callback.success(self);
                        }
                    }
                });
            },
            destroy: function () {
                sync('destroy', {
                    success: function () {
                        trigger('destroy');
                    }
                });
            },
            toJSON: function () {
                return data;
            }
        };
    };

    // bookCollection model object
    // ---------------------------
    // The bookCollection model object represents the list of Book model object
    // (hence the name). The bookCollection is responsible for fetching the list
    // of books from the back-end, adding new books to itself and knowing which
    // Book is currently selected.

    var bookCollection = (function () {
        var callbacks = {},
            models = [],
            selectedModel,
            trigger = function (evt) {
                var list = (callbacks[evt] = callbacks[evt] || []),
                    extraParameters = Array.prototype.slice.call(arguments, 1);
                _(list).each(function (it) {
                    it.apply(this, extraParameters);
                });
            },
            add = function (model) {
                models.push(model);
                trigger('add', model);
            },
            parse = function (rows) {
                _(rows).chain().map(Book).each(add);
            };
        return {
            bind: function (evt, callback) {
                var list = (callbacks[evt] = callbacks[evt] || []);
                list.push(callback);
                return this;
            },
            fetch: function () {
                api.fetch({success: parse});
            },
            add: function (model) {
                add(model);
            },
            select: function (model) {
                selectedModel = model;
                trigger('select', model);
            },
            selected: function () {
                return selectedModel;
            }
        };
    }());

    // BookView class
    // --------------
    // The BookView class represents a Book model instance on screen. It is
    // responsible for rendering itself, reacting to user interaction and to
    // events triggered from it's associated Book model instance.

    var BookView = function (model) {
        var template = _.template($('#bookTemplate').html()),
            el,
            render = function () {
                el = $(el || "<div>")
                    .html( $(template(model.toJSON())) )
                    .hover(
                        function () { $(this).css('color','#B9E0F5'); },
                        function () { $(this).css('color','#FFF'); }
                    );
            },
            remove = function () {
                $(el).remove();
            };

        model.bind('change', render);
        model.bind('destroy', remove);

        return {
            render: function () { render(); return this; },
            el: function () { return el; }
        };
    };

    // bookCollectionView object
    // -------------------------
    // The bookCollectionView represents the entire book collection on screen.
    // It reacts to the `add` event triggered from the `bookCollection` object
    // by creating a `BookView` instance and rendering it on screen.

    var bookCollectionView = (function () {
        var el = $('#books'),
            addOne = function (model) {
                BookView(model)
                    .render()
                    .el()
                    .click(function (evt) {
                        bookCollection.select(model);
                    })
                    .appendTo(el);
            };

        bookCollection.bind('add', addOne);
    }());

    // bookDialog object
    // -----------------
    // The bookDialog is responsible for presenting and allowing the user to
    // modify the data model. The book dialog bonds itself to the `select` event
    // of the `bookCollection` to initialize the input fields and showing the
    // dialog box.

    var bookDialog = (function () {
        var el = $('#bookDialog').dialog({
                autoOpen: false,
                width: 500,
                buttons: [
                    {   text: "Retirer",
                        click: function () {
                            bookCollection
                                .selected()
                                .destroy();
                            $(this).dialog('close');
                        }
                    },
                    {   text: "Enregistrer",
                        click: function () {
                            Book({
                                title: $(this).find('input[name=title]').val(),
                                author: $(this).find('input[name=author]').val(),
                                cover_url : $(this).find('input[name=cover_url]:checked').val()
                            }).save({
                                success: function (newBook) {
                                    bookCollection.add(newBook);
                                    bookCollection.select(newBook);
                                }
                            });
                        }
                    },
                    {   text: "Appliquer",
                        click: function () {
                            bookCollection
                                .selected()
                                .set({
                                    title: $(this).find('input[name=title]').val(),
                                    author: $(this).find('input[name=author]').val(),
                                    cover_url : $(this).find('input[name=cover_url]:checked').val()
                                })
                                .save();
                        }
                    },
                    {   text: "Fermer",
                        click: function () {
                            $(this).dialog('close');
                        }
                    }
                ]
            })
            .prevAll('.ui-dialog-titlebar')
                .find('.ui-dialog-title').each(function () {
                    var ui = this;
                    bookCollection.bind('select', function (model) {
                        $(ui).html(model ? 'Modifier le livre' : 'Ajouter un nouveau livre');
                    });
                })
                .end()
            .end()
            .nextAll('.ui-dialog-buttonpane')
                .find('button:nth-child(1)')
                    .removeClass('ui-button-text-only')
                    .addClass('ui-button-text-icon-primary')
                    .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-trash"></span>')
                    .css({
                        position: 'absolute',
                        left: '15px'
                    })
                    .each(function () {
                        var ui = this;
                        bookCollection.bind('select', function (model) {
                            $(ui)[model ? 'show' : 'hide']();
                        });
                    })
                .end()
                .find('button:nth-child(2)')
                    .removeClass('ui-button-text-only')
                    .addClass('ui-button-text-icon-primary')
                    .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-disk"></span>')
                    .each(function () {
                        var ui = this;
                        bookCollection.bind('select', function (model) {
                            $(ui)[model ? 'hide' : 'show']();
                        });
                    })
                .end()
                .find('button:nth-child(3)')
                    .removeClass('ui-button-text-only')
                    .addClass('ui-button-text-icon-primary')
                    .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-disk"></span>')
                    .each(function () {
                        var ui = this;
                        bookCollection.bind('select', function (model) {
                            $(ui)[model ? 'show' : 'hide']();
                        });
                    })
                .end()
                .find('button:nth-child(4)')
                    .removeClass('ui-button-text-only')
                    .addClass('ui-button-text-icon-primary')
                    .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-close"></span>')
                .end()
            .end()
            .each(function () {
                var ui = this;
                bookCollection.bind('select', function (model) {
                    $(ui).dialog('open');
                });
            })
            .find('input[name=title]')
                .each(function () {
                    var input = this;
                    bookCollection.bind('select', function (model) {
                        $(input).val(model ? model.toJSON().title : "");
                    });
                })
            .end()
            .find('input[name=author]')
                .each(function () {
                    var input = this;
                    bookCollection.bind('select', function (model) {
                        $(input).val(model ? model.toJSON().author : "");
                    });
                })
            .end()
            .find('input[name=cover_url]')
                .each(function () {
                    var input = this;
                    bookCollection.bind('select', function (model) {
                        $(input).prop('checked', model && $(input).val() === model.toJSON().cover_url);
                    });
                })
            .end();
    }());

    // buttonBar object
    // ----------------
    // The buttonBar contains the "add new book" button. It triggers the
    // bookCollection `select` event and thus, the opening of the `bookDialog`.

    var buttonBar = (function () {
        $('#addBook')
            .button({
                icons: { primary: 'ui-icon-plus' }
            })
            .click(function () {
                bookCollection.select();
            })
        .end();
    }());

    bookCollection.fetch();

});
