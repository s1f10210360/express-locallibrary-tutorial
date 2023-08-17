const { body, validationResult } = require("express-validator");

var Book = require("../models/book");
var Author = require("../models/author");
var Genre = require("../models/genre");
var BookInstance = require("../models/bookinstance");

var async = require("async");

exports.index = async function (req, res) {
  try {
    const book_count = await Book.countDocuments({});
    const book_instance_count = await BookInstance.countDocuments({});
    const book_instance_available_count = await BookInstance.countDocuments({
      status: "Available",
    });
    const author_count = await Author.countDocuments({});
    const genre_count = await Genre.countDocuments({});

    res.render("index", {
      title: "Local Library Home",
      data: {
        book_count,
        book_instance_count,
        book_instance_available_count,
        author_count,
        genre_count,
      },
    });
  } catch (err) {
    res.render("index", {
      title: "Local Library Home",
      error: err,
    });
  }
};

// Display list of all Books.
exports.book_list = async function (req, res, next) {
  try {
    const list_books = await Book.find({}, "title author")
      .populate("author")
      .exec();
    res.render("book_list", { title: "Book List", book_list: list_books });
  } catch (err) {
    return next(err);
  }
};

// Display detail page for a specific book.
exports.book_detail = async function (req, res, next) {
  try {
    // Find the specific book by ID, and populate the author and genre details.
    const book = await Book.findById(req.params.id)
      .populate("author")
      .populate("genre")
      .exec();

    // Find all book instances related to the specific book.
    const book_instance = await BookInstance.find({
      book: req.params.id,
    }).exec();

    if (book == null) {
      // If no book is found, create an error and pass to the next middleware.
      var err = new Error("Book not found");
      err.status = 404;
      return next(err);
    }

    // Successful, so render the book detail page.
    res.render("book_detail", {
      title: "Title",
      book: book,
      book_instances: book_instance,
    });
  } catch (err) {
    // If an error occurs, pass it to the next middleware.
    return next(err);
  }
};

// Display book create form on GET.
exports.book_create_get = async (req, res, next) => {
  // Get all authors and genres, which we can use for adding to our book.
  const [allAuthors, allGenres] = await Promise.all([
    Author.find().exec(),
    Genre.find().exec(),
  ]);

  res.render("book_form", {
    title: "Create Book",
    authors: allAuthors,
    genres: allGenres,
  });
};

// ...

// Handle book create on POST.
exports.book_create_post = async function (req, res, next) {
  try {
    // Convert the genre to an array.
    if (!(req.body.genre instanceof Array)) {
      if (typeof req.body.genre === "undefined") req.body.genre = [];
      else req.body.genre = new Array(req.body.genre);
    }

    // Validate and sanitize fields.
    await body("title", "Title must not be empty.")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .run(req);
    await body("author", "Author must not be empty.")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .run(req);
    await body("summary", "Summary must not be empty.")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .run(req);
    await body("isbn", "ISBN must not be empty")
      .trim()
      .isLength({ min: 1 })
      .escape()
      .run(req);
    await body("genre.*").escape().run(req);

    // Extract the validation errors from a request.
    const errors = validationResult(req);

    // Create a Book object with escaped and trimmed data.
    const book = new Book({
      title: req.body.title,
      author: req.body.author,
      summary: req.body.summary,
      isbn: req.body.isbn,
      genre: req.body.genre,
    });

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.

      // Get all authors and genres for form.
      const [allAuthors, allGenres] = await Promise.all([
        Author.find().exec(),
        Genre.find().exec(),
      ]);

      // Mark our selected genres as checked.
      for (const genre of allGenres) {
        if (book.genre.includes(genre._id)) {
          genre.checked = "true";
        }
      }

      res.render("book_form", {
        title: "Create Book",
        authors: allAuthors,
        genres: allGenres,
        book: book,
        errors: errors.array(),
      });
    } else {
      // Data from form is valid. Save book.
      await book.save();
      res.redirect(book.url);
    }
  } catch (err) {
    // If an error occurs, pass it to the next middleware.
    return next(err);
  }
};

exports.book_delete_get = async (req, res, next) => {
  try {
    const [book, bookInstances] = await Promise.all([
      Book.findById(req.params.id).exec(),
      BookInstance.find({ book: req.params.id }).exec(),
    ]);

    if (book === null) {
      res.redirect("/catalog/books");
      return;
    }

    res.render("book_delete", {
      title: "Delete Book",
      book: book,
      book_instances: bookInstances,
    });
  } catch (err) {
    return next(err);
  }
};

exports.book_delete_post = async (req, res, next) => {
  try {
    // Get details of book and all its instances (in parallel)
    const [book, allBookInstances] = await Promise.all([
      Book.findById(req.params.id).exec(),
      BookInstance.find({ book: req.params.id }, "title summary").exec(),
    ]);

    if (allBookInstances.length > 0) {
      // Book has instances. Render in same way as for GET route.
      res.render("book_delete", {
        title: "Delete Book",
        book: book,
        book_instance: allBookInstances,
      });
      return;
    } else {
      // Book has no instances. Delete object and redirect to the list of books.
      await Book.findByIdAndRemove(req.body.bookid);
      res.redirect("/catalog/books"); // 軽微な変更：エンドポイントは "/catalog/books" のように複数形にすることが一般的です
    }
  } catch (err) {
    return next(err);
  }
};

// Display book update form on GET.
exports.book_update_get = async (req, res, next) => {
  try {
    // Get book, authors and genres for form.
    const [book, allAuthors, allGenres] = await Promise.all([
      Book.findById(req.params.id).populate("author").populate("genre").exec(),
      Author.find().exec(),
      Genre.find().exec(),
    ]);

    if (book === null) {
      // No results.
      const err = new Error("Book not found");
      err.status = 404;
      return next(err);
    }

    // Mark our selected genres as checked.
    for (const genre of allGenres) {
      for (const book_g of book.genre) {
        if (genre._id.toString() === book_g._id.toString()) {
          genre.checked = "true";
        }
      }
    }

    res.render("book_form", {
      title: "Update Book",
      authors: allAuthors,
      genres: allGenres,
      book: book,
    });
  } catch (err) {
    return next(err);
  }
};

// Handle book update on POST.
exports.book_update_post = [
  // Convert the genre to an array.
  (req, res, next) => {
    if (!(req.body.genre instanceof Array)) {
      if (typeof req.body.genre === "undefined") {
        req.body.genre = [];
      } else {
        req.body.genre = new Array(req.body.genre);
      }
    }
    next();
  },

  // Validate and sanitize fields.
  body("title", "Title must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("author", "Author must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("summary", "Summary must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("isbn", "ISBN must not be empty").trim().isLength({ min: 1 }).escape(),
  body("genre.*").escape(),

  // Process request after validation and sanitization.
  async (req, res, next) => {
    try {
      // Extract the validation errors from a request.
      const errors = validationResult(req);

      // Create a Book object with escaped/trimmed data and old id.
      const book = new Book({
        title: req.body.title,
        author: req.body.author,
        summary: req.body.summary,
        isbn: req.body.isbn,
        genre: typeof req.body.genre === "undefined" ? [] : req.body.genre,
        _id: req.params.id, // This is required, or a new ID will be assigned!
      });

      if (!errors.isEmpty()) {
        // There are errors. Render form again with sanitized values/error messages.
        const [allAuthors, allGenres] = await Promise.all([
          Author.find().exec(),
          Genre.find().exec(),
        ]);

        // Mark our selected genres as checked.
        for (const genre of allGenres) {
          if (book.genre.indexOf(genre._id) > -1) {
            genre.checked = "true";
          }
        }
        res.render("book_form", {
          title: "Update Book",
          authors: allAuthors,
          genres: allGenres,
          book: book,
          errors: errors.array(),
        });
        return;
      } else {
        // Data from form is valid. Update the record.
        const updatedBook = await Book.findByIdAndUpdate(
          req.params.id,
          book,
          {}
        );
        // Redirect to book detail page.
        res.redirect(updatedBook.url);
      }
    } catch (err) {
      return next(err);
    }
  },
];
