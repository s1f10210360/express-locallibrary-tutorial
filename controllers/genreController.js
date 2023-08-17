const { body, validationResult } = require("express-validator");
const author = require("../models/author");
var Genre = require("../models/genre");
const { genre_list } = require("./genreController");
const Book = require("../models/book");
var async = require("async");

// Display list of all Genre.
exports.genre_list = async function (req, res, next) {
  try {
    const list_genre = await Genre.find().exec();

    for (let genre of list_genre) {
      genre.book_count = await Book.countDocuments({ genre: genre._id });
    }
    res.render("genre_list", {
      title: "Genre List",
      genre_list: list_genre,
    });
  } catch (err) {
    return next(err);
  }
};

// Display detail page for a specific Genre.
exports.genre_detail = async function (req, res, next) {
  try {
    const genre = await Genre.findById(req.params.id).exec();
    const genre_books = await Book.find({ genre: req.params.id }).exec();

    if (genre == null) {
      // No results.
      var err = new Error("Genre not found");
      err.status = 404;
      return next(err);
    }

    // Successful, so render
    res.render("genre_detail", {
      title: "Genre Detail",
      genre: genre,
      genre_books: genre_books,
    });
  } catch (err) {
    return next(err);
  }
};

// Display Genre create form on GET.
exports.genre_create_get = (req, res, next) => {
  res.render("genre_form", { title: "Create Genre" });
};

exports.genre_create_post = [
  // 名前フィールドを検証およびサニタイズ。
  body("name", "ジャンル名は最低3文字でなければなりません")
    .trim()
    .isLength({ min: 3 })
    .escape(),

  async (req, res, next) => {
    try {
      // リクエストから検証エラーを抽出。
      const errors = validationResult(req);

      // エスケープされ、トリムされたデータを持つジャンルオブジェクトを作成。
      const genre = new Genre({ name: req.body.name });

      if (!errors.isEmpty()) {
        // エラーがある場合、サニタイズされた値/エラーメッセージとともにフォームを再度表示。
        res.render("genre_form", {
          title: "ジャンルを作成",
          genre: genre,
          errors: errors.array(),
        });
        return;
      } else {
        // フォームからのデータが有効。
        // 同じ名前のジャンルがすでに存在するか確認。
        const genreExists = await Genre.findOne({ name: req.body.name }).exec();
        if (genreExists) {
          // ジャンルが存在する場合、詳細ページにリダイレクト。
          res.redirect(genreExists.url);
        } else {
          await genre.save();
          // 新しいジャンルが保存されました。ジャンルの詳細ページにリダイレクト。
          res.redirect(genre.url);
        }
      }
    } catch (error) {
      return next(error);
    }
  },
];

// Display Genre delete form on GET.
exports.genre_delete_get = function (req, res) {
  res.send("NOT IMPLEMENTED: Genre delete GET");
};

// Handle Genre delete on POST.
exports.genre_delete_post = function (req, res) {
  res.send("NOT IMPLEMENTED: Genre delete POST");
};

// Display Genre update form on GET.
exports.genre_update_get = function (req, res) {
  res.send("NOT IMPLEMENTED: Genre update GET");
};

// Handle Genre update on POST.
exports.genre_update_post = function (req, res) {
  res.send("NOT IMPLEMENTED: Genre update POST");
};
