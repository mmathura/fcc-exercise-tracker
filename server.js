const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')

var UserSchema = new mongoose.Schema({ username: String });
var ExerciseSchema = new mongoose.Schema({ userId: String, description: String, duration: Number, date: String });

var db; // put this global in connect() below

mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', { useNewUrlParser: true }, (err, client) => {
  if (err) {
    return console.log("Connection failed");
  }
  else {
    console.log("Connected to database");    
    db = client;
    // ... add server code here ...
  }
});

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// post /api/exercise/new-user 
// { username : " " _id : ObjectId }

app.post('/api/exercise/new-user', function(req, res) {
  // from form
  // console.log(req.body.username);
  // check if user name exits
  db.collection('users').findOne({username: req.body.username}, (err, data) => {
    if (err) return res.json({ error: err });
    // console.log(data);
    if (data) { // if found return user
      // console.log(data.username, data._id);
      return res.json({ username: data.username, id: data._id });
    } 
    else { // if new user does not exist
      // insert it into user table 
      // db.collection('users').insertOne({...}, cb ...);
      db.collection('users').insertOne({username: req.body.username}, (err, data) => {
        if (err) return res.json({ error: err });
        // get id for new user from db
        db.collection('users').findOne({username: req.body.username}, (err, data) => {
          if (err) return res.json({ error: err });
          if (data) {
            return res.json({ username: data.username, _id: data._id });
          }
          else {
            return res.json({ error: "User not found" });
          }
        });
      });
      // res.send("Added new user");
    }
  });
  // res.send("In new user");
});

// array [ ] of all users 
// get api/exercise/users
// format [ { username : " ", _id : ObjectId }, ... ]

app.get('/api/exercise/users', (req, res) => {
  // console.log("In users");
  db.collection('users').find({}).toArray((err, users) => {
    if (err) return res.send(err);
    // console.log(users);
    if (users) {
      res.send(users);
    }
    else { // db is empty
      return res.json({ error: "Database empty" }); 
    }
  });
});

// post form data 
// userId(_id), description, duration, and (optionally) date  
// post /api/exercise/add
// if n.d., use current date
// return user object with w/ exercise fields added

app.post('/api/exercise/add', (req, res) => {
  // from form
  // console.log(req.body.userId);
  // console.log(req.body.description);
  // console.log(req.body.duration);
  // console.log(req.body.date);
  // check if fields are null, return error
  if (!req.body.userId || !req.body.description || !req.body.duration)
    return res.json({ error: "Invalid entry" });
  var s_date; // date string
  if (!req.body.date) { // if n.d., use current date
    var date = new Date();
    var year = date.getFullYear();
    var day = date.getDate();
    var month = date.getMonth() + 1;
    // add leading zeros 00, 01 ... 09 to date string 
    if (day < 10) day = "0" + day; // 01 - 09
    if (month < 10) month = "0" + month; // 01 - 09
    // console.log(year + "-" + month + "-" + day);
    s_date = year + "-" + month + "-" + day;
    // console.log(s_date);
  }
  else { // or use date from input form 
    // check if input date is a valid date yyyy-mm-dd
    s_date = req.body.date;
    // console.log(s_date);
  }
  // add entry to exercises table  
  db.collection('exercises').insertOne({userId: req.body.userId, description: req.body.description, 
    duration: parseInt(req.body.duration), date: s_date}, (err, data) => {
    if (err) { 
      // console.log(err);
      return res.json({ error: err });
    } // could check for duplicate enteries
    // console.log(req.body.userId);
    var UserModel = db.model('User', UserSchema);
    UserModel.findById(req.body.userId, (err, data) => {
      if (err) { 
        // console.log(err);
        return res.json({ error: err });
      }
      if (data) { // return user object w/ exercise fields 
        // console.log(data.username);
        return res.json({ username: data.username, userId: req.body.userId, description: req.body.description, 
        duration: parseInt(req.body.duration), date: s_date });  
      } 
      else {
        return res.json({ error: "User not found" });    
      }       
    });
  });
  // res.send("In add exercise");
});

// get /api/exercise/log 
// param userId(_id)
// user object w/ added array log and count (total exercise count)
// optional params from & to or limit
// (Date format yyyy-mm-dd, limit = int)
// GET /api/exercise/log?{userId}[&from][&to][&limit]
// { } = required, [ ] = optional
// from, to = dates (yyyy-mm-dd); limit = number
// {id: ... , username: ..., log: [exercises ...], count: ...}
// split into 2 diff routes?

app.get('/api/exercise/log', (req, res) => {
  var userId = req.query['userId'];
  var from = req.query['from'];
  var to = req.query['to'];
  var limit = req.query['limit'];
  var ExerciseModel = db.model('Exercise', ExerciseSchema);
  var UserModel = db.model('User', UserSchema);
  // duplicate code here 
  if (userId && !from && !to && !limit) { // log
    // console.log(userId);
    // console.log(req.query);
    ExerciseModel.find({userId: userId}, '-_id description duration date', (err, data) => {
      if (err) return res.json({error: err});
      if (data) {
        // console.log(data);
        // query userid in users table to get username
        UserModel.findById(userId, (err, user) => {
          if (err) { 
            // console.log(err);
            return res.json({ error: err });
          }
          if (user) { // return user object w/ exercise fields 
            // console.log(data.username);
            return res.json({ userId: userId, username: user.username, log: data, count: data.length });
          }
          else {
            return res.json({ error: "User not found" });     
          }         
        }); 
      }
      else { // shound just return an empty array [{}]
        return res.json({ error: "Log not found" });
      } 
    }).sort('-date');
  }
  else if (userId && from && to && limit || (userId && from && to && !limit)) { // check limit > 0
    // log + params
    // console.log(userId);
    // console.log(from, to, limit);
    // console.log(req.query);
    // use json doc instead query builder below
    ExerciseModel.find({userId: userId}, '-_id description duration date', (err, data) => {
      if (err) return res.json({error: err});
      if (data) {
        // console.log(data);
        // query userid in users table to get username
        UserModel.findById(userId, (err, user) => {
          if (err) { 
            // console.log(err);
            return res.json({ error: err });
          }
          if (user) { // return user object w/ exercise fields 
            // console.log(data.username);
            return res.json({ userId: userId, username: user.username, log: data, count: data.length });
          }
          else { 
            return res.json({ error: "User not found" }); 
          }       
        }); 
      }
      else { // should return empty array { ... , log: [], count: 0 }
        return res.json({ error: "Log not found" }); // sorted
      }
    }).where('date').gte(from).lte(to).sort('-date').limit(parseInt(limit)); // using query builder
  }
  else {
     return res.json({ error: "Invalid log entry" });
  }
  // res.send("In log");
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
