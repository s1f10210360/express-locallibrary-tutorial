const { body, validationResult } = require("express-validator");

var BookInstance = require("../models/bookinstance");
const Book = require("../models/book");
const book = require("../models/book");

// Display list of all BookInstances.
exports.bookinstance_list = async function (req, res, next) {
  try {
    const list_bookinstances = await BookInstance.find()
      .populate("book")
      .exec();
    res.render("bookinstance_list", {
      title: "Book Instance List",
      bookinstance_list: list_bookinstances,
    });
  } catch (err) {
    return next(err);
  }
};

// Display detail page for a specific BookInstance.
exports.bookinstance_detail = async function (req, res, next) {
  try {
    const bookinstance = await BookInstance.findById(req.params.id)
      .populate("book")
      .exec();
    if (bookinstance == null) {
      var err = new Error("Book copy not found");
      err.status = 404;
      return next(err); // エラーを次のミドルウェアへ渡す
    }
    res.render("bookinstance_detail", {
      title: "Book:",
      bookinstance: bookinstance,
    });
  } catch (err) {
    return next(err);
  }
};

exports.bookinstance_create_get = async (req, res, next) => {
  try {
    const allBooks = await Book.find({}, "title").exec();

    res.render("bookinstance_form", {
      title: "Create BookInstance",
      book_list: allBooks,
    });
  } catch (err) {
    return next(err);
  }
};

// Handle BookInstance create on POST.
exports.bookinstance_create_post = [
  // Validate and sanitize fields.
  body("book", "Book must be specified").trim().isLength({ min: 1 }).escape(),
  body("imprint", "Imprint must be specified")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("status").escape(),
  body("due_back", "Invalid date")
    .optional({ checkFalsy: true })
    .isISO8601()
    .toDate(),

  // Process request after validation and sanitization.
  async (req, res, next) => {
    try {
      // Extract the validation errors from a request.
      const errors = validationResult(req);

      // Create a BookInstance object with escaped and trimmed data.
      const bookInstance = new BookInstance({
        book: req.body.book,
        imprint: req.body.imprint,
        status: req.body.status,
        due_back: req.body.due_back,
      });

      if (!errors.isEmpty()) {
        // There are errors.
        // Render form again with sanitized values and error messages.
        const allBooks = await Book.find({}, "title").exec();

        res.render("bookinstance_form", {
          title: "Create BookInstance",
          book_list: allBooks,
          selected_book: bookInstance.book._id,
          errors: errors.array(),
          bookinstance: bookInstance,
        });
        return;
      } else {
        // Data from form is valid
        await bookInstance.save();
        res.redirect(bookInstance.url);
      }
    } catch (err) {
      return next(err);
    }
  },
];

// Display BookInstance delete form on GET.
exports.bookinstance_delete_get = async function (req, res, next) {
  try {
    const [bookinstance, allBooksInstance] = await Promise.all([
      BookInstance.findById(req.params.id).exec(),
      BookInstance.find({ book: req.params.id }, "title").exec(),
    ]);
    if (bookinstance === null) {
      // No results.
      res.redirect("/catalog/bookinstance");
      return;
    }

    res.render("bookinstance_delete", {
      title: "Delete bookinstance",
      bookinstance: bookinstance,
      all_books_instance: allBooksInstance,
    });
  } catch (err) {
    return next(err);
  }
};

// Handle BookInstance delete on POST.
exports.bookinstance_delete_post = async function (req, res, next) {
  try {
    const bookinstance = await BookInstance.findById(req.params.id).exec();

    if (bookinstance === null) {
      // No results.
      res.redirect("/catalog/bookinstances");
      return;
    }

    // Check if there are other book instances related to the same book.
    const allBooksInstance = await BookInstance.find(
      { book: bookinstance.book },
      "title"
    ).exec();

    if (allBooksInstance.length > 1) {
      // There are other book instances related to the same book.
      res.render("bookinstance_delete", {
        title: "Delete BookInstance",
        bookinstance: bookinstance,
        all_books_instance: allBooksInstance,
      });
      return;
    } else {
      // There are no other book instances related to the same book. Delete object and redirect to the list of book instances.
      await BookInstance.findByIdAndRemove(req.body.bookinstanceid);
      res.redirect("/catalog/bookinstances");
    }
  } catch (err) {
    return next(err);
  }
};

// Display BookInstance update form on GET.
exports.bookinstance_update_get = function (req, res) {
  res.send("NOT IMPLEMENTED: BookInstance update GET");
};

// Handle bookinstance update on POST.
exports.bookinstance_update_post = function (req, res) {
  res.send("NOT IMPLEMENTED: BookInstance update POST");
};
