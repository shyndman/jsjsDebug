//
// script.js - Contains script related functions
//

DJS.Exception = Class.create( DJS.Base, {
  initialize: function( msg ) {
    this.message = msg;
  },
  toString: function() {
    return this.message;
  }
});

DJS.ExceptionNotExpecting = Class.create( DJS.Exception, {
  initialize: function( match, token, source ) {
    $super( "Expecting '" + match + "' but encountered '" + token.value + "' " + source.getPositionDescription( token ) );
  }
});

DJS.ExceptionBreak = Class.create( DJS.Exception, {
  initialize: function() {
    $super("break");
  }
});

DJS.ExceptionContinue = Class.create( DJS.Exception, {
  initialize: function() {
    $super("continue");
  }
});

DJS.ExceptionReturn = Class.create( DJS.Exception, {
  initialize: function( value ) {
    $super("return " + value);
    this.value = value;
  }
});