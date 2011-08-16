# API object
# ----------
# The API object is responsible for communicating with the back-end. In
# this case, the "back-end" is a CouchDB database.

api =
  fetch: (callbacks) ->
    $.ajax
      url: '/couchdb/livres/_design/livres/_view/all'
      dataType: 'json'
      success: (returnedData, status, xhr) ->
        rows = _(returnedData.rows).pluck('value')
        (callbacks.success or $.noop)(rows)
      error: (xhr, status, error) ->
        (callbacks.error or $.noop)(xhr.status)
    
  create: (jsonData, callbacks) ->
    $.ajax
      type: 'POST'
      url: '/couchdb/livres/'
      contentType: 'application/json; charset=UTF-8'
      data: JSON.stringify jsonData
      dataType: 'json'
      success: (returnedData, status, xhr) ->
        (callbacks.success or $.noop)(returnedData)
      error: (xhr, status, error) ->
        (callbacks.error or $.noop)(xhr.status)
    
  update: (jsonData, callbacks) ->
    $.ajax
      type: 'PUT'
      url: "/couchdb/livres/#{jsonData._id}"
      contentType: 'application/json; charset=UTF-8'
      data: JSON.stringify(jsonData)
      dataType: 'json'
      success: (returnedData, status, xhr) ->
        (callbacks.success or $.noop)({_rev: returnedData.rev})
      error: (xhr, status, error) ->
        (callbacks.error or $.noop)(xhr.status)

  destroy: (jsonData, callbacks) ->
    $.ajax
      type: 'DELETE'
      url: "/couchdb/livres/#{jsonData._id}?rev=#{jsonData._rev}"
      dataType: 'json'
      success: (returnedData, status, xhr) ->
        (callbacks.success or $.noop)(returnedData)
      error: (xhr, status, error) ->
        (callbacks.error or $.noop)(xhr.status)

# The "Book" model class
# ----------------------
# The Book model wraps the json data sent from the back-end. A Book is
# responsible for saving and deleting itself. Views can subscribe to a Book's
# events by calling the `bind` method passing in the event name for wich they
# need to be notified of. A Book mainly notifies its views of changes made in
# the data model.
    
class Book
  constructor: (@data) ->
    @callbacks = {} 

  trigger: (evt) ->
    callbacks = (@callbacks[evt] or= [])
    extraParams = (Array.prototype.slice.call arguments, 1)
    (it.apply this, extraParams) for it in callbacks

  isNew: ->
    not @data._id
    
  set: (properties) ->
    _(properties).each (val, name) =>
      name = '_id' if name is 'id'
      name = '_rev' if name is 'rev'
      @data[name] = val
    @trigger 'change'
    this

  sync: (method, callbacks) ->
    (method @data, callbacks)

  bind: (evt, callback) ->
    (@callbacks[evt] or= []).push callback
    this

  save: (callback) ->
    @sync (if @isNew() then api.create else api.update), success: (properties) =>
      @set properties
      callback.success this

  destroy: ->
    @sync api.destroy, success: =>
      @trigger 'destroy'

  toJSON: -> @data

# bookCollection model object
# ---------------------------
# The bookCollection model object represents the list of Book model object
# (hence the name). The bookCollection is responsible for fetching the list of
# books from the back-end, adding new books to itself and knowing which Book is
# currently selected.

class BookCollection
  constructor: ->
    @callbacks = {}
    @models = []

  trigger: (evt) ->
    callbacks = (@callbacks[evt] or= [])
    extraParams = (Array.prototype.slice.call arguments, 1)
    (it.apply this, extraParams) for it in callbacks

  add: (model) ->
    @models.push model
    @trigger 'add', model

  parse: (rows) =>
    (@add new Book row) for row in rows

  bind: (evt, callback) ->
    (@callbacks[evt] or= []).push callback
    this

  fetch: ->
    api.fetch success: @parse

  select: (model) ->
    @selectedModel = model
    @trigger 'select', model

# BookView class
# --------------
# The BookView class represents a Book model instance on screen. It is
# responsible for rendering itself, reacting to user interaction and to events
# triggered from it's associated Book model instance.

class BookView
  constructor: (@model) ->
    @template = _.template $('#bookTemplate').html()
    @model.bind 'change', @render
    @model.bind 'destroy', @remove

  render: =>
    @el = $(@el or "<div>")
      .html($ @template @model.toJSON())
      .hover(
        -> $(this).css('color', '#B9E0F5'),
        -> $(this).css('color', '#FFF')
      )
    this

  remove: => $(@el).remove()

# bookCollectionView object
# -------------------------
# The bookCollectionView represents the entire book collection on screen. It
# reacts to the `add` event triggered from the `bookCollection` object by
# creating a `BookView` instance and rendering it on screen.

class BookCollectionView
  constructor: (@bookCollection) ->
    @el = $ '#books'
    @bookCollection.bind 'add', @addOne

  addOne: (model) =>
    (new BookView model).render().el.click =>
      @bookCollection.select model
    .appendTo(@el)

# bookDialog object
# -----------------
# The bookDialog is responsible for presenting and allowing the user to modify
# the data model. The book dialog bonds itself to the `select` event of the
# `bookCollection` to initialize the input fields and showing the dialog box.

class BookDialog
  constructor: (@bookCollection) ->
    @ui = $('#bookDialog').dialog
      autoOpen: false
      width: 500
      buttons: [
          text: "Retirer"
          click: =>
            @bookCollection.selectedModel?.destroy()
            $(@ui).dialog 'close'
        ,
          text: "Enregistrer"
          click: =>
            formData =
              title: $(@ui).find('input[name=title]').val()
              author: $(@ui).find('input[name=author]').val()
              cover_url: $(@ui).find('input[name=cover_url]:checked').val()
            (new Book formData).save success: (newBook) =>
              @bookCollection.add newBook
              @bookCollection.select newBook
        ,
          text: "Appliquer"
          click: =>
            formData =
              title: $(@ui).find('input[name=title]').val()
              author: $(@ui).find('input[name=author]').val()
              cover_url: $(@ui).find('input[name=cover_url]:checked').val()
            @bookCollection.selectedModel.set(formData).save()
        ,
          text: "Fermer"
          click: =>
            $(@ui).dialog 'close'
      ]

    $(@ui).prevAll('.ui-dialog-titlebar')
      .find('.ui-dialog-title').each (idx, el) =>
        @bookCollection.bind 'select', (model) =>
          $(el).html if model then 'Modifier le livre' else 'Ajouter un nouveau livre'

    $(@ui).nextAll('.ui-dialog-buttonpane')
      .find('button')
        .removeClass('ui-button-text-only')
        .addClass('ui-button-text-icon-primary')
      .end()
      .find('button:nth-child(1)')
        .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-trash"></span>')
        .css
          position: 'absolute'
          left: '15px'
        .each (idx, el) =>
          @bookCollection.bind 'select', (model) ->
            $(el)[if model then 'show' else 'hide']()
      .end()
      .find('button:nth-child(2)')
        .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-disk"></span>')
        .each (idx, el) =>
          @bookCollection.bind 'select', (model) ->
            $(el)[if model then 'hide' else 'show']()
      .end()
      .find('button:nth-child(3)')
        .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-disk"></span>')
        .each (idx, el) =>
          @bookCollection.bind 'select', (model) ->
            $(el)[if model then 'show' else 'hide']()
      .end()
      .find('button:nth-child(4)')
        .prepend('<span class="ui-button-icon-primary ui-icon ui-icon-close"></span>')
      .end()

      $(@ui).find('input[name=title]').each (idx, el) =>
        @bookCollection.bind 'select', (model) ->
          $(el).val(if model then model.toJSON().title else "")
      .end()
      .find('input[name=author]').each (idx, el) =>
        @bookCollection.bind 'select', (model) ->
          $(el).val(if model then model.toJSON().author else "")
      .end()
      .find('input[name=cover_url]').each (idx, el) =>
        @bookCollection.bind 'select', (model) ->
          $(el).prop 'checked', model and $(el).val() is model.toJSON().cover_url
      .end()

      @bookCollection.bind 'select', (model) =>
        $(@ui).dialog 'open'

# buttonBar object
# ----------------
# The buttonBar contains the "add new book" button. It triggers the
# bookCollection `select` event and thus, the opening of the `bookDialog`.

class ButtonBar
  constructor: (@bookCollection) ->
    $('#addBook')
      .button
        icons: primary: 'ui-icon-plus'
      .click =>
        @bookCollection.select()

# Wire and launch app
# -------------------

$ ->
  bookCollection = new BookCollection
  bookCollectionView = new BookCollectionView bookCollection
  bookDialog = new BookDialog bookCollection
  buttonBar = new ButtonBar bookCollection
  bookCollection.fetch()
