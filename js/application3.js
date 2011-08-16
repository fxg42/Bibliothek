(function() {
  var Book, BookCollection, BookCollectionView, BookDialog, BookView, ButtonBar, api;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  api = {
    fetch: function(callbacks) {
      return $.ajax({
        url: '/couchdb/livres/_design/livres/_view/all',
        dataType: 'json',
        success: function(returnedData, status, xhr) {
          var rows;
          rows = _(returnedData.rows).pluck('value');
          return (callbacks.success || $.noop)(rows);
        },
        error: function(xhr, status, error) {
          return (callbacks.error || $.noop)(xhr.status);
        }
      });
    },
    create: function(jsonData, callbacks) {
      return $.ajax({
        type: 'POST',
        url: '/couchdb/livres/',
        contentType: 'application/json; charset=UTF-8',
        data: JSON.stringify(jsonData),
        dataType: 'json',
        success: function(returnedData, status, xhr) {
          return (callbacks.success || $.noop)(returnedData);
        },
        error: function(xhr, status, error) {
          return (callbacks.error || $.noop)(xhr.status);
        }
      });
    },
    update: function(jsonData, callbacks) {
      return $.ajax({
        type: 'PUT',
        url: "/couchdb/livres/" + jsonData._id,
        contentType: 'application/json; charset=UTF-8',
        data: JSON.stringify(jsonData),
        dataType: 'json',
        success: function(returnedData, status, xhr) {
          return (callbacks.success || $.noop)({
            _rev: returnedData.rev
          });
        },
        error: function(xhr, status, error) {
          return (callbacks.error || $.noop)(xhr.status);
        }
      });
    },
    destroy: function(jsonData, callbacks) {
      return $.ajax({
        type: 'DELETE',
        url: "/couchdb/livres/" + jsonData._id + "?rev=" + jsonData._rev,
        dataType: 'json',
        success: function(returnedData, status, xhr) {
          return (callbacks.success || $.noop)(returnedData);
        },
        error: function(xhr, status, error) {
          return (callbacks.error || $.noop)(xhr.status);
        }
      });
    }
  };
  Book = (function() {
    function Book(data) {
      this.data = data;
      this.callbacks = {};
    }
    Book.prototype.trigger = function(evt) {
      var callbacks, extraParams, it, _base, _i, _len, _results;
      callbacks = ((_base = this.callbacks)[evt] || (_base[evt] = []));
      extraParams = Array.prototype.slice.call(arguments, 1);
      _results = [];
      for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
        it = callbacks[_i];
        _results.push(it.apply(this, extraParams));
      }
      return _results;
    };
    Book.prototype.isNew = function() {
      return !this.data._id;
    };
    Book.prototype.set = function(properties) {
      _(properties).each(__bind(function(val, name) {
        if (name === 'id') {
          name = '_id';
        }
        if (name === 'rev') {
          name = '_rev';
        }
        return this.data[name] = val;
      }, this));
      this.trigger('change');
      return this;
    };
    Book.prototype.sync = function(method, callbacks) {
      return method(this.data, callbacks);
    };
    Book.prototype.bind = function(evt, callback) {
      var _base;
      ((_base = this.callbacks)[evt] || (_base[evt] = [])).push(callback);
      return this;
    };
    Book.prototype.save = function(callback) {
      return this.sync((this.isNew() ? api.create : api.update), {
        success: __bind(function(properties) {
          this.set(properties);
          return callback.success(this);
        }, this)
      });
    };
    Book.prototype.destroy = function() {
      return this.sync(api.destroy, {
        success: __bind(function() {
          return this.trigger('destroy');
        }, this)
      });
    };
    Book.prototype.toJSON = function() {
      return this.data;
    };
    return Book;
  })();
  BookCollection = (function() {
    function BookCollection() {
      this.parse = __bind(this.parse, this);      this.callbacks = {};
      this.models = [];
    }
    BookCollection.prototype.trigger = function(evt) {
      var callbacks, extraParams, it, _base, _i, _len, _results;
      callbacks = ((_base = this.callbacks)[evt] || (_base[evt] = []));
      extraParams = Array.prototype.slice.call(arguments, 1);
      _results = [];
      for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
        it = callbacks[_i];
        _results.push(it.apply(this, extraParams));
      }
      return _results;
    };
    BookCollection.prototype.add = function(model) {
      this.models.push(model);
      return this.trigger('add', model);
    };
    BookCollection.prototype.parse = function(rows) {
      var row, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = rows.length; _i < _len; _i++) {
        row = rows[_i];
        _results.push(this.add(new Book(row)));
      }
      return _results;
    };
    BookCollection.prototype.bind = function(evt, callback) {
      var _base;
      ((_base = this.callbacks)[evt] || (_base[evt] = [])).push(callback);
      return this;
    };
    BookCollection.prototype.fetch = function() {
      return api.fetch({
        success: this.parse
      });
    };
    BookCollection.prototype.select = function(model) {
      this.selectedModel = model;
      return this.trigger('select', model);
    };
    return BookCollection;
  })();
  BookView = (function() {
    function BookView(model) {
      this.model = model;
      this.remove = __bind(this.remove, this);
      this.render = __bind(this.render, this);
      this.template = _.template($('#bookTemplate').html());
      this.model.bind('change', this.render);
      this.model.bind('destroy', this.remove);
    }
    BookView.prototype.render = function() {
      this.el = $(this.el || "<div>").html($(this.template(this.model.toJSON()))).hover(function() {
        return $(this).css('color', '#B9E0F5');
      }, function() {
        return $(this).css('color', '#FFF');
      });
      return this;
    };
    BookView.prototype.remove = function() {
      return $(this.el).remove();
    };
    return BookView;
  })();
  BookCollectionView = (function() {
    function BookCollectionView(bookCollection) {
      this.bookCollection = bookCollection;
      this.addOne = __bind(this.addOne, this);
      this.el = $('#books');
      this.bookCollection.bind('add', this.addOne);
    }
    BookCollectionView.prototype.addOne = function(model) {
      return (new BookView(model)).render().el.click(__bind(function() {
        return this.bookCollection.select(model);
      }, this)).appendTo(this.el);
    };
    return BookCollectionView;
  })();
  BookDialog = (function() {
    function BookDialog(bookCollection) {
      this.bookCollection = bookCollection;
      this.ui = $('#bookDialog').dialog({
        autoOpen: false,
        width: 500,
        buttons: [
          {
            text: "Retirer",
            click: __bind(function() {
              var _ref;
              if ((_ref = this.bookCollection.selectedModel) != null) {
                _ref.destroy();
              }
              return $(this.ui).dialog('close');
            }, this)
          }, {
            text: "Enregistrer",
            click: __bind(function() {
              var formData;
              formData = {
                title: $(this.ui).find('input[name=title]').val(),
                author: $(this.ui).find('input[name=author]').val(),
                cover_url: $(this.ui).find('input[name=cover_url]:checked').val()
              };
              return (new Book(formData)).save({
                success: __bind(function(newBook) {
                  this.bookCollection.add(newBook);
                  return this.bookCollection.select(newBook);
                }, this)
              });
            }, this)
          }, {
            text: "Appliquer",
            click: __bind(function() {
              var formData;
              formData = {
                title: $(this.ui).find('input[name=title]').val(),
                author: $(this.ui).find('input[name=author]').val(),
                cover_url: $(this.ui).find('input[name=cover_url]:checked').val()
              };
              return this.bookCollection.selectedModel.set(formData).save();
            }, this)
          }, {
            text: "Fermer",
            click: __bind(function() {
              return $(this.ui).dialog('close');
            }, this)
          }
        ]
      });
      $(this.ui).prevAll('.ui-dialog-titlebar').find('.ui-dialog-title').each(__bind(function(idx, el) {
        return this.bookCollection.bind('select', __bind(function(model) {
          return $(el).html(model ? 'Modifier le livre' : 'Ajouter un nouveau livre');
        }, this));
      }, this));
      $(this.ui).nextAll('.ui-dialog-buttonpane').find('button').removeClass('ui-button-text-only').addClass('ui-button-text-icon-primary').end().find('button:nth-child(1)').prepend('<span class="ui-button-icon-primary ui-icon ui-icon-trash"></span>').css({
        position: 'absolute',
        left: '15px'
      }).each(__bind(function(idx, el) {
        return this.bookCollection.bind('select', function(model) {
          return $(el)[model ? 'show' : 'hide']();
        });
      }, this)).end().find('button:nth-child(2)').prepend('<span class="ui-button-icon-primary ui-icon ui-icon-disk"></span>').each(__bind(function(idx, el) {
        return this.bookCollection.bind('select', function(model) {
          return $(el)[model ? 'hide' : 'show']();
        });
      }, this)).end().find('button:nth-child(3)').prepend('<span class="ui-button-icon-primary ui-icon ui-icon-disk"></span>').each(__bind(function(idx, el) {
        return this.bookCollection.bind('select', function(model) {
          return $(el)[model ? 'show' : 'hide']();
        });
      }, this)).end().find('button:nth-child(4)').prepend('<span class="ui-button-icon-primary ui-icon ui-icon-close"></span>').end();
      $(this.ui).find('input[name=title]').each(__bind(function(idx, el) {
        return this.bookCollection.bind('select', function(model) {
          return $(el).val(model ? model.toJSON().title : "");
        });
      }, this)).end().find('input[name=author]').each(__bind(function(idx, el) {
        return this.bookCollection.bind('select', function(model) {
          return $(el).val(model ? model.toJSON().author : "");
        });
      }, this)).end().find('input[name=cover_url]').each(__bind(function(idx, el) {
        return this.bookCollection.bind('select', function(model) {
          return $(el).prop('checked', model && $(el).val() === model.toJSON().cover_url);
        });
      }, this)).end();
      this.bookCollection.bind('select', __bind(function(model) {
        return $(this.ui).dialog('open');
      }, this));
    }
    return BookDialog;
  })();
  ButtonBar = (function() {
    function ButtonBar(bookCollection) {
      this.bookCollection = bookCollection;
      $('#addBook').button({
        icons: {
          primary: 'ui-icon-plus'
        }
      }).click(__bind(function() {
        return this.bookCollection.select();
      }, this));
    }
    return ButtonBar;
  })();
  $(function() {
    var bookCollection, bookCollectionView, bookDialog, buttonBar;
    bookCollection = new BookCollection;
    bookCollectionView = new BookCollectionView(bookCollection);
    bookDialog = new BookDialog(bookCollection);
    buttonBar = new ButtonBar(bookCollection);
    return bookCollection.fetch();
  });
}).call(this);
