var express = require('express');
var router = express.Router();

var fs = require('fs');
var path = require('path');



/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


router.get('/shaders/:shader', function(req, res, next) {
   fs.readFile(path.join(__dirname, '../public/shaders/'+req.params.shader), 'utf8', function(err, data) {
       if (err) {
        console.log(err);
        res.end('Shader not found!');
       }
       res.end(data);
   });
});

module.exports = router;
