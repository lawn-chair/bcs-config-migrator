
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'BCS Config 3.x to 4.0 Migrator' });
};
