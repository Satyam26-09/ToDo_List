//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const date = require(__dirname + "/date.js");
const mongoose = require("mongoose");
const lodash = require("lodash");

const app = express();


app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

const pass = process.env.PASSWORD;
mongoose.connect("mongodb+srv://Satyam_2609:"+pass+"@cluster0.a4k1ost.mongodb.net/todolistDB", { useNewUrlParser: true, useUnifiedTopology: true});

const itemsSchema = new mongoose.Schema({
  name:String
});

const customSchema = new mongoose.Schema({
  name:String,
  items:[itemsSchema]
});

const Item = mongoose.model("Item",itemsSchema);
const List = mongoose.model("List",customSchema);

const item1 = new Item({name:"Welcome to your todoList..."});
const item2 = new Item({name:"Press '+' to add new items."});
const item3 = new Item({name:"<-- Hit this to delete items."});

const defaultItem = [item1,item2,item3];
let itemsList = [];         //how to change let to constant here



app.get("/", function(req, res) {
  const day = date.getDate();
  (async() => {
    try{
          itemsList = await Item.find({});
          if(itemsList.length===0){
            const addedItem = await Item.insertMany(defaultItem);
            console.log("Items saved successfully and are : " + addedItem);
            res.redirect("/");
          }
          else{
            res.render("list", {listTitle: day, newListItems: itemsList});
          }
      } catch (error){
          console.error("the error is" + error);
        }
  })();

});

app.get("/:customListName",function(req,res){
  const customListName = lodash.capitalize(req.params.customListName);
  List.findOne({name:customListName})     //look it up
    .then(foundProduct => {
      if (!foundProduct) {
        const list = new List({
          name:customListName,
          items:defaultItem
        });
        list.save();
        res.redirect("/" + customListName);
      } else {
        res.render("list", {listTitle: foundProduct.name, newListItems: foundProduct.items});
      }
    })
    .catch(error => {
      console.error('Error finding data:', error);
    });
  
});

app.post("/", function(req, res){

  const thisday = date.getDate();

  const itemName = req.body.newItem;
  const listName = req.body.list;

  const item = new Item({name:itemName});
  
  if(listName===thisday){
    item.save();
    res.redirect("/");
  }
  else{
    List.findOne({name:listName})     //look it up
    .then(foundProduct => {
        foundProduct.items.push(item);
        foundProduct.save();
        res.redirect("/" +listName);
    })
    .catch(error => {
      console.error('Error finding data:', error);
    });
  }

});

app.post("/delete", function(req,res){
  const today = date.getDate();
  const listTitle = req.body.listTitle;
  const removeItem = req.body.checkbox;
  if(today===listTitle){
    Item.findByIdAndDelete(removeItem)      //look it up
      .then(deletedProduct => {
        if (deletedProduct) {
          console.log('Data deleted successfully:', deletedProduct);
        } else {
          console.log('Data not found');
        }
      })
      .catch(error => {
        console.error('Error deleting data:', error);
      });
      res.redirect("/");
  }
  else{
    List.findOneAndUpdate({name:listTitle},{$pull:{items:{_id:removeItem}}})     //look it up
    .then(updatedProduct => {
      if (updatedProduct) {
        res.redirect("/" + listTitle);
      }
    })
    .catch(error => {
      console.error('Error updating data:', error);
    });
  }
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});


