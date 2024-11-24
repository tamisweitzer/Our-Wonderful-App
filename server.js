const express = require( 'express' );
const app = express();

// Tell Express we are using EJS as the templating engine.
app.set( 'view engine', 'ejs' )

// Expose the /public/ dir to the public.
app.use( express.static( 'public' ) );

// Allows access to values from a form as 'request.body.<field>
app.use(express.urlencoded( {extended: false} ))


// Routes
app.get( '/', (req, res) => {
  res.render('homepage');
} );

app.get( '/login', ( req, res ) => {
  res.render( 'login' );
})

app.post( '/register', ( req, res ) => {
  console.log(req.body);
  res.send( "thanks" );
})




app.listen( 3000 );
