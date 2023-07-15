require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const lodash = require("lodash");
const ejs = require("ejs");
const date = require(__dirname + "/date.js");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
  secret:process.env.SECRET_STRING,
  resave:false,
  saveUninitialized:false
}));

app.use(passport.initialize());
app.use(passport.session());

const pass = process.env.PASSWORD;
mongoose.connect("mongodb+srv://Satyam_2609:"+pass+"@cluster0.a4k1ost.mongodb.net/todolistDB", { useNewUrlParser: true, useUnifiedTopology: true});

const itemsSchema = new mongoose.Schema({
  item:String
});

const customSchema = new mongoose.Schema({
  name:String,
  items:[itemsSchema]
});

const userSchema = new mongoose.Schema({
  email:String,
  password:String,
  googleId:String,
  username:String,
  toDoList:[itemsSchema],
  customList:[customSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User",userSchema);
const Item = mongoose.model("Item",itemsSchema);
const List = mongoose.model("List",customSchema);

const item1 = new Item({item:"Welcome to your todoList..."});
const item2 = new Item({item:"Press '+' to add new items."});
const item3 = new Item({item:"<-- Hit this to delete items."});

const defaultItem = [item1,item2,item3];

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
});

passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
        return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: determineCallbackURL(),
  userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
},
function(accessToken, refreshToken, profile, cb) {
  User.findOrCreate({ username: profile.displayName,googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));

function determineCallbackURL() {
  var currentDomain = process.env.NODE_ENV === 'production' ? 'https://todo-list-qinf.onrender.com' : 'http://localhost:3000';
  return currentDomain + '/auth/google/todo-list';
}

app.get("/",function(req,res){
  res.render("home");
});

app.get("/auth/google",
      passport.authenticate('google', { scope: ["profile"] })
);
app.get("/auth/google/todo-list", 
      passport.authenticate('google', { failureRedirect: '/login' }),
      function(req, res) {
          res.redirect('/toDoList');
}); 

app.get("/login",function(req,res){
  res.render("login");
});

app.get("/register",function(req,res){
  res.render("register");
});

app.post("/register",function(req,res){
  User.register({username:req.body.username},req.body.password)
      .then(user => {
          passport.authenticate("local")(req,res,function(){
              res.redirect("/toDoList");
          })
      })
      .catch(err => {
          console.log("error1:"+err);
          res.redirect("/register");
      });
});

app.post("/login",function(req,res){
  const user = new User({
      username:req.body.username,
      password:req.body.password
  })
  req.login(user,function(err){
      if(err){
          console.log("error3:" + err);
      }
      else{
          passport.authenticate("local")(req,res,function(){
              res.redirect("/toDoList");
          })
      }
  })
});

app.get("/toDoList", function(req, res) {
  if(req.isAuthenticated()){
      const day = date.getDate();
      const uID = req.user.id;
      User.findOne({_id:uID})
          .then(foundList => {
              const itemsList = foundList.toDoList;
              if(itemsList.length===0){
                  foundList.toDoList=defaultItem;
                  foundList.save();
                  res.redirect("/toDoList");
              }
              else{
                  res.render("list", {listTitle: day, newListItems: itemsList});
              }
          })
          .catch(error => {
              console.log('Error finding data:', error);
          });
  }
  else
      res.redirect("/login");
});

app.get("/logout",function(req,res){
  req.logOut(function(err){
      if(err){
          console.log("error4:"+err);
      }
  });
  res.redirect("/");
});

app.get("/:customListName",function(req,res){
  if(req.isAuthenticated()){
      const customListName = lodash.capitalize(req.params.customListName);
      const uID = req.user.id;
      User.findOne({_id:uID})
          .then(foundProduct => {
              let flag = false,i=0;
              for(i;i<foundProduct.customList.length;i++){
                  if(foundProduct.customList[i].name === customListName){
                      flag = true;
                      break;
                  }
              };
              if (!flag) {
                  const list = new List({
                      name:customListName,
                      items:defaultItem
                  });
                  foundProduct.customList.push(list);
                  foundProduct.save();
                  res.redirect("/" + customListName);
              } else {
                  res.render("list", {listTitle: foundProduct.customList[i].name, newListItems: foundProduct.customList[i].items});
              }
          })
          .catch(error => {
              console.log('Error finding data:', error);
          });
  }
  else
      res.redirect("/login");
});

app.post("/toDoList", function(req, res){

  if(req.isAuthenticated()){
      const thisday = date.getDate();
      const itemName = req.body.newItem;
      const listName = req.body.list;
      const item = new Item({item:itemName});
      const uID = req.user.id;
      User.findOne({_id:uID})
          .then(foundList => {
              if(listName===thisday){
                  foundList.toDoList.push(item);
                  foundList.save();
                  res.redirect("/toDoList");
              }
              else{
                  let i=0;
                  for(i;i<foundList.customList.length;i++){
                      if(foundList.customList[i].name === listName){
                          break;
                      }
                  };
                  foundList.customList[i].items.push(item);
                  foundList.save();
                  res.redirect("/" + listName);
              }
          })
          .catch(error => {
              console.log('Error finding data:', error);
          });
  }
  else
      res.redirect("/login");
});

app.post("/delete", function(req,res){
  if(req.isAuthenticated()){
      const today = date.getDate();
      const listTitle = req.body.listTitle;
      const removeItem = req.body.checkbox;
      const uID = req.user.id;
      User.findOne({_id:uID})
          .then(foundList => {
              if(today===listTitle){
                  foundList.toDoList = (foundList.toDoList).filter(data => {
                      return data.id !== removeItem;
                  })
                  foundList.save();
                  res.redirect("/toDoList");
              }
              else{
                  let i=0;
                  for(i;i<foundList.customList.length;i++){
                      if(foundList.customList[i].name === listTitle){
                          break;
                      }
                  };
                  foundList.customList[i].items = foundList.customList[i].items.filter(data => {
                      return data.id !== removeItem;
                  })
                  foundList.save();
                  res.redirect("/" + foundList.customList[i].name);
              }
          })
          .catch(error => {
              console.log('Error finding data:', error);
          });
  }
  else
      res.redirect("/login");
});

app.listen(process.env.PORT || 3000, function() {
  console.log("Server started on port 3000");
});