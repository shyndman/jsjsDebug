//
// ui.js
//

DJS.Panel = Class.create({
  initialize: function(options) {
    this.options = ( {
      
    }).extend( options || {});
    this.create();
  },
  
  create: function() {
    this.element = new Element("div");
  }
});

DJS.CodePanel = Class.create(DJS.Panel, {
  initialize: function($super) 
});