const express = require( 'express' );
const db = require( 'better-sqlite3' )( 'ourApp.db' );
const app = express();
const bcrypt = require( 'bcrypt' );

db.pragma('journal_mode = WAL')

// Database set up
const createTables = db.transaction( () => {
  db
    .prepare( `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username STRING NOT NULL UNIQUE,
        password STRING NOT NULL
      )
      `)
    .run()
});

createTables();
// end


// Tell Express we are using EJS as the templating engine.
app.set( 'view engine', 'ejs' )

// Expose the /public/ dir to the public.
app.use( express.static( 'public' ) );

// Allows access to values from a form as 'request.body.<field>
app.use(express.urlencoded( {extended: false} ))

// Middleware to set the errors array to an empty array so that we don't get an error when we first load the page.
app.use( function ( req, res, next ) {
  res.locals.errors = [];
  next();
} );


// List of Routes

// GET '/' Home
app.get( '/', (req, res) => {
  res.render('homepage');
} );

// GET '/login' Display login screen.
app.get( '/login', ( req, res ) => {
  res.render( 'login' );
})

// POST '/register' Send post request when attempting to login.
app.post( '/register', ( req, res ) => {
const errors = [];

   // Check if we're getting strings back from the form.
  if ( typeof req.body.username !== 'string' ) req.body.username = '';
  if ( typeof req.body.password !== 'string' ) req.body.password = '';

  // Trim any whitespace from the form before validating input.
  req.body.username = req.body.username.trim();
  req.body.password = req.body.password.trim();

  // Validate username is minimum 3 chars, and maximum 13 chars.
  if ( !req.body.username ) errors.push( "You must provide a username." );
  if ( req.body.username && req.body.username.length < 3 ) errors.push( "Username must be at least 3 characters long." );
  if ( req.body.username && req.body.username.length > 13 ) errors.push( "Username must be less than 14 characters long." );

  // Disallow special characters.
  if ( req.body.username && !req.body.username.match( /^[a-zA-Z0-9]+$/ ) ) errors.push( "Username may not contain special characters." );

  // Validate password is minimum 3 chars, and maximum 13 chars.
  if ( !req.body.password ) errors.push( "You must provide a password." );
  if ( req.body.password && req.body.password.length < 8 ) errors.push( "Password must be at least 8 characters long." );
  if ( req.body.password && req.body.password.length > 100 ) errors.push( "Password must be less than 101 characters long." );

  // Disallow special characters.
  if ( req.body.password && !req.body.password.match( /^[a-zA-Z0-9]+$/ ) ) errors.push( "Password may not contain special characters." );

  // If there are any errors, redirect to home page and display errors.
  if ( errors.length ) {
    return res.render( 'homepage', { errors } );
  }


  // Encrypt the password before sending to the database.
  const salt = bcrypt.genSaltSync( 10 );
  req.body.password = bcrypt.hashSync( req.body.password, salt );

  // Save new user to database.
  const statement = db.prepare("INSERT INTO users (username, password) VALUES(?, ?)");

  statement.run(req.body.username, req.body.password);

  // Log new user in with a cookie.

  res.render( 'homepage' );
  // res.render( "homepage" );


} );



app.listen( 3000 );
