require( 'dotenv' ).config();

const express = require( 'express' );
const db = require( 'better-sqlite3' )( 'ourApp.db' );
const app = express();
const bcrypt = require( 'bcrypt' );
const jwt = require( 'jsonwebtoken' );
const cookieParser = require( 'cookie-parser' );

db.pragma('journal_mode = WAL')


// Create tables for our database.
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




// Middleware_______________________

// Tell Express we are using EJS as the templating engine.
app.set( 'view engine', 'ejs' )

// Expose the /public/ dir to the public.
app.use( express.static( 'public' ) );

// Allows access to values from a form as 'request.body.<field>
app.use( express.urlencoded( { extended: false } ) );

app.use( cookieParser() );

// Set the errors array to an empty array so that we don't get an error when we first load the page.
app.use( function ( req, res, next ) {
  res.locals.errors = [];
  // Try to decode incoming cookie to determine if user is logged in.
  try {
    const decoded = jwt.verify( req.cookies.OurWonderfulApp, process.env.JWTSECRET );
    req.user = decoded
  } catch (error) {
    req.user = false;
  }
  res.locals.user = req.user;
  next();
} );

// Ensure visitor is logged in.
function mustBeLoggedIn( req, res, next ) {
  if ( req.user ) {
    next();
  }
  return res.redirect( '/' );
}



// GET Requests_______________________

// GET '/' Home
app.get( '/', ( req, res ) => {
  if ( req.user ) {
    return res.render('dashboard')
  }
  else {
    return res.render('homepage');
  }
} );

// GET '/login' Display login screen.
app.get( '/login', ( req, res ) => {
  res.render( 'login' );
} );

// GET '/logout' Log user out of app.
app.get( '/logout', ( req, res ) => {
  res.clearCookie( 'OurWonderfulApp' );
  res.redirect( '/' );
} );

// GET '/dashboard' Redirect logged in users to their dashboard.
app.get( '/dashboard', mustBeLoggedIn, ( req, res ) => {
  res.render( 'dashboard' );
} );

// GET '/create-post' Navigate to the Create Post page.
app.get( '/create-post', mustBeLoggedIn, ( req, res ) => {
  res.render( 'create-post' );
})




// POST Requests_______________________

// POST '/register' Send post request when attempting to login.
app.post( '/register', ( req, res ) => {
const errors = [];

   // Check if we're getting strings back from the form.
  if ( typeof req.body.username !== 'string' ) { req.body.username = ''; }
  if ( typeof req.body.password !== 'string' ) { req.body.password = ''; }

  // Trim any whitespace from the form before validating input.
  req.body.username = req.body.username.trim();
  req.body.password = req.body.password.trim();

  // Validate username is minimum 3 chars, and maximum 13 chars.
  if ( !req.body.username ) { errors.push( "You must provide a username." ); }
  if ( req.body.username && req.body.username.length < 3 ) { errors.push( "Username must be at least 3 characters long." ); }
  if ( req.body.username && req.body.username.length > 13 ) { errors.push( "Username must be less than 14 characters long." ); }

  // Disallow special characters.
  if ( req.body.username && !req.body.username.match( /^[a-zA-Z0-9]+$/ ) ) { errors.push( "Username may not contain special characters." ); }

  // Check if username exists already.
  const usernameExistsStmt = db.prepare( "SELECT * FROM users WHERE username = ?" );
  const usernameExists = usernameExistsStmt.get( req.body.username );

  if ( usernameExists ) { errors.push( "Please choose a different username" ); }

  // Validate password is minimum 3 chars, and maximum 13 chars.
  if ( !req.body.password ) { errors.push( "You must provide a password." ); }
  if ( req.body.password && req.body.password.length < 8 ) { errors.push( "Password must be at least 8 characters long." ); }
  if ( req.body.password && req.body.password.length > 100 ) { errors.push( "Password must be less than 101 characters long." ); }

  // Disallow special characters.
  if ( req.body.password && !req.body.password.match( /^[a-zA-Z0-9]+$/ ) ) { errors.push( "Password may not contain special characters." ); }

  // If there are any errors, redirect to home page and display errors.
  if ( errors.length ) { return res.render( 'homepage', { errors } );  }

  // Encrypt the password before sending to the database.
  const salt = bcrypt.genSaltSync( 10 );
  req.body.password = bcrypt.hashSync( req.body.password, salt );

  // Save new user to database.
  const statement = db.prepare("INSERT INTO users (username, password) VALUES(?, ?)");

  // Pass in the arguments for the ?'s.
  const result = statement.run( req.body.username, req.body.password );

  // Look up the user who who just registered.
  const lookupStatement = db.prepare( "SELECT * FROM users WHERE ROWID = ?" );

  // Get the row ID for the last registered user.
  const user = lookupStatement.get(result.lastInsertRowid);

  // Log new user in with a cookie.
  const oneDay = 1000 * 60 * 60 * 24;

  // Use JSON Web Token for secure transmission of data.
  const cookieToken = jwt.sign( {
    exp: Math.floor( Date.now() / 1000 ) + ( 60 * 60 * 24 ),
    userid: user.id,
    username: user.username
  }, process.env.JWTSECRET );

  res.cookie( "OurWonderfulApp", cookieToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: oneDay
  } );

  res.redirect( '/' );
} );


// POST '/login' Process login request
app.post( '/login', ( req, res ) => {
  const errors = [];
  if ( typeof req.body.username !== 'string' ) { req.body.username = ''; }
  if ( typeof req.body.password !== 'string' ) { req.body.password = ''; }

  if ( req.body.username.trim() === "" || req.body.password === "") {
    errors.push( "Invalid username or password" );
  }

  if ( errors.length ) {
    return res.render( 'login', { errors } );
  }

  const userInQuestionStatement = db.prepare( "SELECT * FROM users WHERE username = ?" );
  const userInQuestion = userInQuestionStatement.get( req.body.username );

  if ( !userInQuestion) {
    errors.push( "Invalid username or password" );
    res.render('login', { errors })
  }

  const matchOrNot = bcrypt.compareSync( req.body.password, userInQuestion.password );

  if ( !matchOrNot ) {
     errors.push( "Invalid username or password" );
    res.render('login', { errors })
  }

  const cookieToken = jwt.sign( {
    exp: Math.floor( Date.now() / 1000 ) + ( 60 * 60 * 24 ),
    userid: userInQuestion.id,
    username: userInQuestion.username
  }, process.env.JWTSECRET );

  const oneDay = 1000 * 60 * 60 * 24;
  res.cookie( "OurWonderfulApp", cookieToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: oneDay
  } );

  res.redirect( '/' );
} );


// POST '/create-post' Process attempt to create a post.
app.post( '/create-post', mustBeLoggedIn, ( req, res ) => {
  console.log(req);
  res.send( "Thanks" );
})





app.listen( 3000 );
