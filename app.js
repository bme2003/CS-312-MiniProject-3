const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const session = require('express-session');
const app = express();
const port = 3000;

// Database connection
const pool = new Pool({
  user: 'brodyengland',
  host: 'localhost',
  database: 'blogdb',
  port: 5432,
});

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session setup for user authentication
app.use(session({
  secret: 'my_secret_key',
  resave: false,
  saveUninitialized: true,
}));

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect('/signin');
  }
}

// Route: Home - Display all blog posts
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blogs ORDER BY date_created DESC');
    res.render('index', { blogs: result.rows, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.send('Error retrieving blog posts');
  }
});

// Route: Signup (GET)
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Route: Signup (POST) - Register new user
app.post('/signup', async (req, res) => {
  const { password, name } = req.body;
  try {
    await pool.query('INSERT INTO users (password, name) VALUES ($1, $2)', [password, name]);
    res.redirect('/signin');
  } catch (err) {
    console.error(err);
    res.send('Error signing up');
  }
});

// Route: Signin (GET)
app.get('/signin', (req, res) => {
  res.render('signin');
});

// Route: Signin (POST) - Login user
app.post('/signin', async (req, res) => {
  const { password, name } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE name = $1 AND password = $2', [name, password]);
    if (result.rows.length > 0) {
      req.session.user = result.rows[0];
      res.redirect('/');
    } else {
      res.send('Invalid credentials');
    }
  } catch (err) {
    console.error(err);
    res.send('Error signing in');
  }
});

// Route: Create Post (GET)
app.get('/create', isAuthenticated, (req, res) => {
  res.render('createPost');
});

// Route: Create Post (POST)
app.post('/create', isAuthenticated, async (req, res) => {
  const { title, body } = req.body;
  const user = req.session.user;
  try {
    await pool.query('INSERT INTO blogs (creator_name, creator_user_id, title, body, date_created) VALUES ($1, $2, $3, $4, NOW())',
      [user.name, user.user_id, title, body]);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send('Error creating post');
  }
});

// Route: Edit Post (GET)
app.get('/edit/:id', isAuthenticated, async (req, res) => {
  const blog_id = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM blogs WHERE blog_id = $1', [blog_id]);
    const blog = result.rows[0];
    if (blog.creator_user_id === req.session.user.user_id) {
      res.render('editPost', { blog });
    } else {
      res.send('You can only edit your own posts.');
    }
  } catch (err) {
    console.error(err);
    res.send('Error loading post for editing');
  }
});

// Route: Edit Post (POST)
app.post('/edit/:id', isAuthenticated, async (req, res) => {
  const blog_id = req.params.id;
  const { title, body } = req.body;
  try {
    await pool.query('UPDATE blogs SET title = $1, body = $2 WHERE blog_id = $3 AND creator_user_id = $4',
      [title, body, blog_id, req.session.user.user_id]);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send('Error updating post');
  }
});

// Route: Delete Post (POST)
app.post('/delete/:id', isAuthenticated, async (req, res) => {
  const blog_id = req.params.id;
  try {
    await pool.query('DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2', [blog_id, req.session.user.user_id]);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send('Error deleting post');
  }
});

// Route: Sign Out (POST)
app.post('/signout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.send('Error signing out');
    }
    res.redirect('/signin');
  });
});

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});
