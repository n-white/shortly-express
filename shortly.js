var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');

var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}));



app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

var sess; 
app.get('/', 
function(req, res) {
  if (req.session.loggedin === false) {
    res.render('login');
  } else {
    res.render('index');    
  }
});

app.get('/create', 
function(req, res) {
  res.render('index');
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/


app.post('/signup', 
  function(req, res) {
    /// duplicate catching

    new User({username: req.body.username, password: req.body.password})
      .fetch()
      .then(function(found) {
        if (found) {
          res.sendStatus(200).send(found.attributes);  
        } else {
          Users.create({
            username: req.body.username,
            password: req.body.password
          })
          .then(function(newUser) {
            res.setHeader('location', '/');
            //res.status(200).send(newUser.attributes);
            res.redirect('/');
            // res.render('/');
          });
        }
      });
  }
  );

app.post('/login', 
  function(req, res) {

    new User({username: req.body.username, password: req.body.password})
      .fetch()
      .then(function(results) {

        if (results === null) {
          console.log('failed');
          res.redirect('/');
        } else {
          console.log('success');
          console.log(req.session);
          req.session.loggedin = true;
          console.log('the user has a session');
          res.render('index');    
        }

      });
  });

app.get('/loggedout',
  function(req, res) {
    console.log('hello wurld');
    console.log(req.session);
    req.session.loggedin = false;
    console.log(req.session);
    res.redirect('/');
    res.render('login');
  });



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
