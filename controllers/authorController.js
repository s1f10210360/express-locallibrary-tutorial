const { body, validationResult } = require("express-validator");

var Author = require("../models/author");
var async = require("async");
var Book = require("../models/book");

// Display list of all Authors.
exports.author_list = async function (req, res, next) {
  try {
    const list_authors = await Author.find()
      .sort([["family_name", "ascending"]])
      .exec();
    res.render("author_list", {
      title: "Author List",
      author_list: list_authors,
    });
  } catch (err) {
    return next(err);
  }
};

// Display detail page for a specific Author.
exports.author_detail = async function (req, res, next) {
  try {
    const author = await Author.findById(req.params.id).exec();
    const author_books = await Book.find(
      { author: req.params.id },
      "title summary"
    ).exec();
    if (author == null) {
      // No results.
      var err = new Error("Author not found");
      err.status = 404;
      return next(err);
    }

    // Successful, so render
    res.render("author_detail", {
      title: "Author Detail",
      author: author,
      author_books: author_books,
    });
  } catch (err) {
    return next(err);
  }
};

// Display Author create form on GET.
exports.author_create_get = (req, res, next) => {
  res.render("author_form", { title: "Create Author" });
};

// POSTでの著者作成を処理。
exports.author_create_post = [
  // フィールドを検証し、サニタイズ。
  body("first_name")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("名は必須です。")
    .isAlphanumeric()
    .withMessage("名には英数字以外の文字があります。"),
  body("family_name")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("姓は必須です。")
    .isAlphanumeric()
    .withMessage("姓には英数字以外の文字があります。"),
  body("date_of_birth", "無効な生年月日")
    .optional({ values: "falsy" })
    .isISO8601()
    .toDate(),
  body("date_of_death", "無効な死亡日")
    .optional({ values: "falsy" })
    .isISO8601()
    .toDate(),

  async (req, res, next) => {
    // リクエストから検証エラーを抽出。
    const errors = validationResult(req);

    // エスケープされ、トリムされたデータで著者オブジェクトを作成。
    const author = new Author({
      first_name: req.body.first_name,
      family_name: req.body.family_name,
      date_of_birth: req.body.date_of_birth,
      date_of_death: req.body.date_of_death,
    });

    if (!errors.isEmpty()) {
      // エラーがある場合、サニタイズされた値/エラーメッセージとともにフォームを再度表示。
      res.render("author_form", {
        title: "著者を作成",
        author: author,
        errors: errors.array(),
      });
      return;
    }

    try {
      // フォームからのデータが有効。

      // 著者を保存。
      await author.save();

      // 新しい著者レコードにリダイレクト。
      res.redirect(author.url);
    } catch (error) {
      return next(error);
    }
  },
];

exports.author_delete_get = async (req, res, next) => {
  try {
    // Get details of author and all their books (in parallel)
    const [author, allBooksByAuthor] = await Promise.all([
      Author.findById(req.params.id).exec(),
      Book.find({ author: req.params.id }, "title summary").exec(),
    ]);

    if (author === null) {
      // No results.
      res.redirect("/catalog/authors");
      return;
    }

    res.render("author_delete", {
      title: "Delete Author",
      author: author,
      author_books: allBooksByAuthor,
    });
  } catch (err) {
    return next(err);
  }
};

exports.author_delete_post = async (req, res, next) => {
  try {
    // Get details of author and all their books (in parallel)
    const [author, allBooksByAuthor] = await Promise.all([
      Author.findById(req.params.id).exec(),
      Book.find({ author: req.params.id }, "title summary").exec(),
    ]);

    if (allBooksByAuthor.length > 0) {
      // Author has books. Render in same way as for GET route.
      res.render("author_delete", {
        title: "Delete Author",
        author: author,
        author_books: allBooksByAuthor,
      });
      return;
    } else {
      // Author has no books. Delete object and redirect to the list of authors.
      await Author.findByIdAndRemove(req.body.authorid);
      res.redirect("/catalog/authors");
    }
  } catch (err) {
    return next(err);
  }
};

// Display author update form on GET.
exports.author_update_get = async (req, res, next) => {
  try {
    const author = await Author.findById(req.params.id).exec();

    if (author === null) {
      // No results.
      const err = new Error("Author not found");
      err.status = 404;
      return next(err);
    }

    res.render("author_form", {
      title: "Update Author",
      author: author,
    });
  } catch (err) {
    return next(err);
  }
};

// Handle author update on POST.
exports.author_update_post = [
  // Validate and sanitize fields.
  body("first_name", "First name must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("family_name", "Family name must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("date_of_birth", "Date of birth must not be empty")
    .optional({ checkFalsy: true })
    .isISO8601()
    .toDate(),
  body("date_of_death", "Date of death must not be empty")
    .optional({ checkFalsy: true })
    .isISO8601()
    .toDate(),

  // Process request after validation and sanitization.
  async (req, res, next) => {
    try {
      // Extract the validation errors from a request.
      const errors = validationResult(req);

      // Create an Author object with escaped/trimmed data and old id.
      const author = new Author({
        first_name: req.body.first_name,
        family_name: req.body.family_name,
        date_of_birth: req.body.date_of_birth,
        date_of_death: req.body.date_of_death,
        _id: req.params.id, // This is required, or a new ID will be assigned!
      });

      if (!errors.isEmpty()) {
        // There are errors. Render form again with sanitized values/error messages.
        res.render("author_form", {
          title: "Update Author",
          author: author,
          errors: errors.array(),
        });
        return;
      } else {
        // Data from form is valid. Update the record.
        const updatedAuthor = await Author.findByIdAndUpdate(
          req.params.id,
          author,
          {}
        );
        // Redirect to author detail page.
        res.redirect(updatedAuthor.url);
      }
    } catch (err) {
      return next(err);
    }
  },
];
