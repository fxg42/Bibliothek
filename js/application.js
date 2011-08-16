/*global $, _, jQuery, console */

(function($) {
    $.fn.subscribeTo = function (publisher, event_name, fn) {
        return this.each(function () {
            var $this = $(this);
            $this.bind(event_name, function (evt) {
                if (evt.target === $this.get(0)) {
                    fn.apply($this, [evt]);
                }
            });
            publisher.addSubscriber($this, event_name);
        });
    };
}(jQuery));

/*Namespace*/
var BOOKS = {};

BOOKS.api = (function () {
    return {
        findAll: function (callbacks) {
            $.ajax({
                url: '/couchdb/livres/_design/livres/_view/all',
                dataType: 'json',
                success: function (data, status, xhr) {
                    BOOKS.model.books(_.map(data.rows, function (it) { return it.value; }));
                    callbacks.success();
                },
                error: function (xhr, status, error) {
                    (callbacks.error || $.noop)(xhr.status);
                }
            });
        },
        create: function (form, callbacks) {
            $.ajax({
                type: 'POST',
                url: '/couchdb/livres/',
                contentType: 'application/json; charset=UTF-8',
                data: JSON.stringify({
                    title: form.find('input[name=title]').val(),
                    author: form.find('input[name=author]').val(),
                    cover_url: form.find('input[name=cover_url]:checked').val()
                }),
                dataType: 'json',
                success: function (data, status, xhr) {
                    BOOKS.api.findAll(callbacks);
                },
                error: function (xhr, status, error) {
                    (callbacks.error || $.noop)(xhr.status);
                }
            });
        },
        update: function (livre, form, callbacks) {
            livre.title = form.find('input[name=title]').val();
            livre.author = form.find('input[name=author]').val();
            livre.cover_url = form.find('input[name=cover_url]:checked').val();

            $.ajax({
                type: 'PUT',
                url: '/couchdb/livres/'+livre._id,
                contentType: 'application/json; charset=UTF-8',
                data: JSON.stringify(livre),
                dataType: 'json',
                success: function (data, status, xhr) {
                    BOOKS.api.findAll(callbacks);
                },
                error: function (xhr, status, error) {
                    (callbacks.error || $.noop)(xhr.status);
                }
            });
        },
        remove: function (livre, callbacks) {
            $.ajax({
                type: 'DELETE',
                url: '/couchdb/livres/'+livre._id+'?rev='+livre._rev,
                dataType: 'json',
                success: function (data, status, xhr) {
                    BOOKS.api.findAll(callbacks);
                },
                error: function (xhr, status, error) {
                    (callbacks.error || $.noop)(xhr.status);
                }
            });
        }
    };
}());

BOOKS.model = (function () {
    var books,
        selectedBook,
        subscribers = {},
        notify = function (event_name) {
            $.each(subscribers[event_name], function (idx, subscriber) {
                $(subscriber).trigger(event_name);
            });
        };

    return {
        addSubscriber: function (subscriber, event_name) {
            if (subscribers[event_name] === undefined) {
                subscribers[event_name] = [];
            }
            subscribers[event_name].push(subscriber);
        },
        books: function (val) {
            if (val === undefined) {
                return books;
            } else {
                books = val;
                notify('model.update.books');
            }
        },
        selectedBook: function (val) {
            if (val === undefined) {
                return selectedBook;
            } else {
                selectedBook = val;
                notify('model.update.selected.book');
            }
        }
    };
}());

BOOKS.bookView = function (book) {
    var bookTemplate = _.template($('#bookTemplate').html());

    return {
        render: function () {
            return $(bookTemplate(book)).click(function (evt) {
                BOOKS.model.selectedBook(book);
            }).hover(
                function () { $(this).css('color','#B9E0F5') },
                function () { $(this).css('color','#FFF') }
            );
        }
    };
};

BOOKS.libraryView = (function () {
    var bookViews = [];

    return {
        initialize: function () {
            var bookDialog = $('#bookDialog').dialog({
                autoOpen: false,
                modal: true,
                width: 500,
                buttons: [
                    {   text: "Retirer",
                        click: function () {
                            var self = this,
                                livre = BOOKS.model.selectedBook();
                            BOOKS.api.remove(livre, {
                                success: function () {
                                    $(self).dialog('close');
                                }
                            });
                            $(this).dialog('close');
                        }
                    },
                    {   text: "Enregistrer",
                        click: function () {
                            var self = this;
                            BOOKS.api.create($(this).find('form'), {
                                success: function (data) {
                                    $(self).dialog('close');
                                }
                            });
                        }
                    },
                    {   text: "Appliquer",
                        click: function () {
                            var self = this,
                                livre = BOOKS.model.selectedBook();
                            BOOKS.api.update(livre, $(this).find('form'), {
                                success: function (data) {
                                    $(self).dialog('close');
                                }
                            });
                        }
                    },
                    {   text: "Fermer",
                        click: function () {
                            $(this).dialog('close');
                        }
                    }
                ]
            })
            .subscribeTo(BOOKS.model, 'model.update.selected.book', function (evt) {
                this.dialog('open');
            })
            .prevAll('.ui-dialog-titlebar')
                .find('.ui-dialog-title')
                    .subscribeTo(BOOKS.model, 'model.update.selected.book', function (evt) {
                        var livre = BOOKS.model.selectedBook();
                        $(this).html(livre ? 'Modifier le livre' : 'Ajouter un nouveau livre');
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
                    .subscribeTo(BOOKS.model, 'model.update.selected.book', function (evt) {
                        var livre = BOOKS.model.selectedBook();
                        $(this)[livre ? 'show' : 'hide']();
                    })
                .end()
                .find('button:nth-child(2)')
                    .removeClass('ui-button-text-only')
                    .addClass('ui-button-text-icon-primary')
                    .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-disk"></span>')
                    .subscribeTo(BOOKS.model, 'model.update.selected.book', function (evt) {
                        var livre = BOOKS.model.selectedBook();
                        $(this)[livre ? 'hide' : 'show']();
                    })
                .end()
                .find('button:nth-child(3)')
                    .removeClass('ui-button-text-only')
                    .addClass('ui-button-text-icon-primary')
                    .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-disk"></span>')
                    .subscribeTo(BOOKS.model, 'model.update.selected.book', function (evt) {
                        var livre = BOOKS.model.selectedBook();
                        $(this)[livre ? 'show' : 'hide']();
                    })
                .end()
                .find('button:nth-child(4)')
                    .removeClass('ui-button-text-only')
                    .addClass('ui-button-text-icon-primary')
                    .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-close"></span>')
                .end()
            .end()
            .find('input[name=title]')
                .subscribeTo(BOOKS.model, 'model.update.selected.book', function (evt) {
                    var livre = BOOKS.model.selectedBook();
                    $(this).val(livre ? livre.title : "");
                })
            .end()
            .find('input[name=author]')
                .subscribeTo(BOOKS.model, 'model.update.selected.book', function (evt) {
                    var livre = BOOKS.model.selectedBook();
                    $(this).val(livre ? livre.author : "");
                })
            .end()
            .find('input[name=cover_url]')
                .subscribeTo(BOOKS.model, 'model.update.selected.book', function (evt) {
                    var livre = BOOKS.model.selectedBook();
                    $(this).prop('checked',livre && $(this).val() === livre.cover_url );
                })
            .end();

            $('#desktop').find('#books')
                .subscribeTo(BOOKS.model, 'model.update.books', function (evt) {
                    $(this).empty();
                    var self = this;
                    $.each(BOOKS.model.books(), function (idx, book) {
                        var view = BOOKS.bookView(book);
                        bookViews.push(view);
                        $(self).append(view.render());
                    });
                })
                .sortable()
            .end()
            .find('#addBook')
                .button({
                    icons: { primary: 'ui-icon-plus' }
                })
                .click(function () {
                    BOOKS.model.selectedBook(null);
                })
            .end();
        }
    };
}());

$(function () {

    BOOKS.libraryView.initialize();

    BOOKS.api.findAll({
        success: $.noop
    });

});
