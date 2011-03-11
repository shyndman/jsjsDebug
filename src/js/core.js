//
// core.js
//

var DJS = {};

//
// DJS.Base - base class for all DJS objects
//

DJS.Base = Class.create({
  trace: function(msg) {
    if (!console || !console.log) return;
    console.log( msg );
  }, 
  error: function(msg) {
    if (!console || !console.error) return;
    console.error( msg );
  },
  uid: function() {
    return this._uid ? this._uid : this._uid = (DJS.Base.count++).toString();
  }
});
DJS.Base.count = 0;

//
// Utils
//

/**  
 * Since Prototype decorates prototypes, might as well join the party.
 * Generally not recommended.
 */
Function.prototype.asEntryPoint = function() {
  var source = this.toString();
  return source.substring(13, source.length - 3);
};